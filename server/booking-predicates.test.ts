import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateClinicBookingStats,
  calculateDoctorBookingStats,
  createBookingDateBoundaries,
  getBookingLifecycleMetadata,
  isActiveVisit,
  isAwaitingDoctorApproval,
  isCompletedPatientVisit,
  isConfirmedBooking,
  isDoctorApprovedBooking,
  isPendingBooking,
  isTerminalBooking,
  type BookingPolicyRow,
} from "./booking-predicates";
import {
  getCalendarDateInTimezone,
  normalizeConfirmationStatus,
  normalizeDoctorApprovalStatus,
  normalizeVisitStatus,
  resolveClinicTimezone,
} from "@shared/booking-status";

const NOW = new Date("2026-08-10T08:00:00.000Z");
const boundaries = createBookingDateBoundaries(NOW, "Asia/Kolkata");

const atIndia = (localDateTime: string): Date =>
  new Date(`${localDateTime}+05:30`);

const booking = (
  startTime: Date,
  overrides: Partial<BookingPolicyRow> = {},
): BookingPolicyRow => ({
  startTime,
  verificationStatus: "confirmed",
  confirmedBy: "clinic",
  doctorApprovalStatus: "approved",
  visitStatus: null,
  ...overrides,
});

test("normalizes null, legacy, and unknown server status values", () => {
  assert.equal(normalizeConfirmationStatus(null).value, "unknown");
  assert.equal(normalizeConfirmationStatus("admin_booked").isLegacy, true);
  assert.equal(normalizeConfirmationStatus("historical").isKnown, false);
  assert.equal(normalizeDoctorApprovalStatus(null).value, "unassigned");
  assert.equal(normalizeDoctorApprovalStatus("historical").value, "unknown");
  assert.equal(normalizeVisitStatus(null).value, "not_started");
  assert.equal(normalizeVisitStatus("scheduled").value, "legacy_unknown");
});

test("applies confirmation, pending, terminal, active, and completed predicates", () => {
  const confirmedByDoctor = booking(atIndia("2026-08-11T10:00:00"), {
    verificationStatus: "pending",
    confirmedBy: "doctor",
  });
  assert.equal(isConfirmedBooking(confirmedByDoctor), true);
  assert.equal(isPendingBooking(confirmedByDoctor), false);

  const legacyPending = booking(atIndia("2026-08-11T10:00:00"), {
    verificationStatus: "admin_booked",
    confirmedBy: null,
  });
  assert.equal(isPendingBooking(legacyPending), true);

  for (const terminal of [
    booking(atIndia("2026-08-11T10:00:00"), { verificationStatus: "cancelled" }),
    booking(atIndia("2026-08-11T10:00:00"), { verificationStatus: "no_show" }),
    booking(atIndia("2026-08-11T10:00:00"), { visitStatus: "patient_left_early" }),
  ]) {
    assert.equal(isTerminalBooking(terminal), true);
    assert.equal(isPendingBooking(terminal), false);
  }

  assert.equal(
    isActiveVisit(booking(atIndia("2026-08-11T10:00:00"), { visitStatus: "in_consultation" })),
    true,
  );
  assert.equal(
    isActiveVisit(booking(atIndia("2026-08-11T10:00:00"), {
      verificationStatus: "no_show",
      visitStatus: "in_consultation",
    })),
    true,
    "the raw active predicate exposes the state conflict for server policy handling",
  );
  assert.equal(isCompletedPatientVisit(booking(NOW, { visitStatus: "treatment_completed" })), true);
  assert.equal(isCompletedPatientVisit(booking(NOW, { visitStatus: "completed" })), true);
  assert.equal(isPendingBooking(booking(NOW, { visitStatus: "completed" })), false);
});

test("handles doctor approval independently from confirmation", () => {
  const approvalPending = booking(atIndia("2026-08-11T10:00:00"), {
    verificationStatus: "pending",
    confirmedBy: null,
    doctorApprovalStatus: "pending",
  });
  assert.equal(isDoctorApprovedBooking(approvalPending), false);
  assert.equal(isAwaitingDoctorApproval(approvalPending, boundaries), true);

  assert.equal(
    isAwaitingDoctorApproval(
      { ...approvalPending, startTime: atIndia("2026-08-09T10:00:00") },
      boundaries,
    ),
    false,
    "old pending approvals are not awaiting current approval",
  );
  assert.equal(
    isDoctorApprovedBooking({ ...approvalPending, doctorApprovalStatus: null }),
    true,
    "null approval is treated as unassigned rather than pending",
  );
  assert.equal(
    isDoctorApprovedBooking({ ...approvalPending, doctorApprovalStatus: "declined" }),
    false,
  );
});

test("classifies old, same-day, and future records using the clinic timezone", () => {
  const old = getBookingLifecycleMetadata(
    booking(atIndia("2026-08-09T10:00:00")),
    boundaries,
  );
  assert.equal(old.localDate, "2026-08-09");
  assert.equal(old.dateCategory, "old");
  assert.equal(old.operationalState, "old_needs_resolution");
  assert.equal(old.isOld, true);
  assert.equal(old.isPast, true);
  assert.equal(old.isUpcoming, false);

  const todayPastDue = getBookingLifecycleMetadata(
    booking(atIndia("2026-08-10T10:00:00")),
    boundaries,
  );
  assert.equal(todayPastDue.dateCategory, "today_past_due");
  assert.equal(todayPastDue.isToday, true);
  assert.equal(todayPastDue.isPast, false);
  assert.equal(todayPastDue.isPastDueToday, true);

  const todayUpcoming = getBookingLifecycleMetadata(
    booking(atIndia("2026-08-10T18:00:00")),
    boundaries,
  );
  assert.equal(todayUpcoming.dateCategory, "today_upcoming");
  assert.equal(todayUpcoming.isToday, true);
  assert.equal(todayUpcoming.isPastDueToday, false);

  const future = getBookingLifecycleMetadata(
    booking(atIndia("2026-08-11T10:00:00")),
    boundaries,
  );
  assert.equal(future.dateCategory, "future");
  assert.equal(future.isUpcoming, true);
  assert.equal(future.isOld, false);
});

test("uses local calendar boundaries at UTC midnight and invalid timezone fallback", () => {
  const instant = new Date("2026-08-10T20:00:00.000Z");
  assert.equal(getCalendarDateInTimezone(instant, "Asia/Kolkata"), "2026-08-11");
  assert.equal(getCalendarDateInTimezone(instant, "UTC"), "2026-08-10");

  const utcBoundaries = createBookingDateBoundaries(instant, "UTC");
  assert.equal(utcBoundaries.todayStr, "2026-08-10");
  assert.equal(utcBoundaries.todayStart.toISOString(), "2026-08-10T00:00:00.000Z");

  assert.equal(resolveClinicTimezone("not/a-timezone"), "Asia/Kolkata");
  assert.equal(resolveClinicTimezone(null), "Asia/Kolkata");

  const dstBoundaries = createBookingDateBoundaries(
    new Date("2026-03-08T07:00:00.000Z"),
    "America/New_York",
  );
  assert.equal(dstBoundaries.todayStr, "2026-03-08");
  assert.equal(dstBoundaries.todayStart.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(dstBoundaries.tomorrowStart.toISOString(), "2026-03-09T04:00:00.000Z");
});

test("calculates clinic statistics across lifecycle and date boundaries", () => {
  const rows: BookingPolicyRow[] = [
    booking(atIndia("2026-08-10T10:00:00")),
    booking(atIndia("2026-08-10T18:00:00"), {
      verificationStatus: "pending",
      confirmedBy: null,
    }),
    booking(atIndia("2026-08-11T10:00:00")),
    booking(atIndia("2026-08-11T11:00:00"), {
      verificationStatus: "pending",
      confirmedBy: null,
    }),
    booking(atIndia("2026-08-09T10:00:00")),
    booking(atIndia("2026-08-17T10:00:00")),
    booking(atIndia("2026-08-11T12:00:00"), { visitStatus: "treatment_completed" }),
    booking(atIndia("2026-08-11T13:00:00"), { verificationStatus: "no_show" }),
    booking(atIndia("2026-08-11T14:00:00"), { visitStatus: "patient_left_early" }),
  ];

  assert.deepEqual(calculateClinicBookingStats(rows, boundaries), {
    todayCount: 2,
    todayConfirmedCount: 1,
    upcomingCount: 2,
    pastCount: 1,
    thisWeekCount: 7,
    nextWeekCount: 1,
    pendingNext7Count: 2,
    confirmedNext7Count: 2,
    totalPendingCount: 2,
    totalAllCount: 9,
  });
});

test("calculates doctor statistics with approval visibility separated from lifecycle", () => {
  const rows: BookingPolicyRow[] = [
    booking(atIndia("2026-08-10T10:00:00")),
    booking(atIndia("2026-08-10T18:00:00"), {
      verificationStatus: "pending",
      confirmedBy: null,
      doctorApprovalStatus: null,
    }),
    booking(atIndia("2026-08-11T10:00:00")),
    booking(atIndia("2026-08-11T11:00:00"), {
      verificationStatus: "pending",
      confirmedBy: null,
      doctorApprovalStatus: "pending",
    }),
    booking(atIndia("2026-08-09T10:00:00"), {
      doctorApprovalStatus: "declined",
    }),
    booking(atIndia("2026-08-17T10:00:00")),
    booking(atIndia("2026-08-11T12:00:00"), { visitStatus: "treatment_completed" }),
    booking(atIndia("2026-08-11T13:00:00"), { verificationStatus: "no_show" }),
    booking(atIndia("2026-08-11T14:00:00"), { visitStatus: "patient_left_early" }),
  ];

  assert.deepEqual(calculateDoctorBookingStats(rows, boundaries), {
    todayCount: 2,
    todayConfirmedCount: 1,
    upcomingCount: 2,
    pastCount: 0,
    thisWeekCount: 6,
    nextWeekCount: 1,
    pendingNext7Count: 1,
    confirmedNext7Count: 2,
    totalPendingCount: 2,
    totalAllCount: 9,
    totalOwnedCount: 7,
    awaitingApprovalCount: 1,
  });
});