import assert from "node:assert/strict";
import test from "node:test";
import { createBookingDateBoundaries, type BookingPolicyRow } from "./booking-predicates";
import {
  getReminderDateGroup,
  getReminderWindowDates,
  isClinicReminderEligible,
  isDigestEligibleClinic,
  isDoctorReminderEligible,
  type ReminderPolicyRow,
} from "./reminder-policy";

const NOW = new Date("2026-08-10T08:00:00.000Z");
const boundaries = createBookingDateBoundaries(NOW, "Asia/Kolkata");

const atIndia = (localDateTime: string): Date => new Date(`${localDateTime}+05:30`);

const booking = (
  startTime: Date,
  overrides: Partial<ReminderPolicyRow> = {},
): ReminderPolicyRow => ({
  startTime,
  verificationStatus: "confirmed",
  confirmedBy: "clinic",
  doctorApprovalStatus: "approved",
  visitStatus: null,
  slotExists: true,
  slotCancelled: false,
  assignedDoctorEmail: "doctor@example.com",
  ...overrides,
});

test("includes clinic bookings confirmed by admin and excludes unconfirmed or invalid visits", () => {
  assert.equal(isClinicReminderEligible(booking(atIndia("2026-08-10T10:00:00")), boundaries), true);
  assert.equal(
    isClinicReminderEligible(
      booking(atIndia("2026-08-10T10:00:00"), {
        verificationStatus: "pending",
        confirmedBy: null,
        doctorApprovalStatus: "approved",
      }),
      boundaries,
    ),
    false,
    "doctor approval alone is not clinic confirmation",
  );
  assert.equal(
    isClinicReminderEligible(
      booking(atIndia("2026-08-10T10:00:00"), {
        verificationStatus: "pending",
        confirmedBy: null,
      }),
      boundaries,
    ),
    false,
  );

  for (const overrides of [
    { verificationStatus: "cancelled" },
    { verificationStatus: "no_show" },
    { visitStatus: "completed" },
    { visitStatus: "treatment_completed" },
    { visitStatus: "patient_left_early" },
    { slotCancelled: true },
    { slotExists: false },
  ] satisfies Partial<ReminderPolicyRow>[]) {
    assert.equal(
      isClinicReminderEligible(booking(atIndia("2026-08-10T10:00:00"), overrides), boundaries),
      false,
      JSON.stringify(overrides),
    );
  }
});

test("requires explicit doctor approval and assignment", () => {
  assert.equal(
    isDoctorReminderEligible(
      booking(atIndia("2026-08-11T10:00:00"), { verificationStatus: "pending", confirmedBy: null }),
      boundaries,
    ),
    true,
    "doctor approval makes the appointment eligible independently of admin confirmation",
  );
  assert.equal(
    isDoctorReminderEligible(
      booking(atIndia("2026-08-11T10:00:00"), { doctorApprovalStatus: "admin_confirmed" }),
      boundaries,
    ),
    true,
  );

  for (const doctorApprovalStatus of [null, "", "pending", "declined", "unknown"]) {
    assert.equal(
      isDoctorReminderEligible(
        booking(atIndia("2026-08-11T10:00:00"), { doctorApprovalStatus }),
        boundaries,
      ),
      false,
      `approval=${doctorApprovalStatus}`,
    );
  }
  assert.equal(
    isDoctorReminderEligible(
      booking(atIndia("2026-08-11T10:00:00"), { assignedDoctorEmail: " " }),
      boundaries,
    ),
    false,
  );

  for (const overrides of [
    { verificationStatus: "cancelled" },
    { verificationStatus: "no_show" },
    { visitStatus: "completed" },
    { visitStatus: "treatment_completed" },
    { visitStatus: "patient_left_early" },
  ] satisfies Partial<ReminderPolicyRow>[]) {
    assert.equal(
      isDoctorReminderEligible(
        booking(atIndia("2026-08-11T10:00:00"), overrides),
        boundaries,
      ),
      false,
      JSON.stringify(overrides),
    );
  }
});

test("groups exactly seven clinic-local dates without overlap", () => {
  const dates = [
    "2026-08-10",
    "2026-08-11",
    "2026-08-12",
    "2026-08-13",
    "2026-08-14",
    "2026-08-15",
    "2026-08-16",
    "2026-08-17",
  ];
  const groups = dates.map((date) =>
    getReminderDateGroup(booking(atIndia(`${date}T10:00:00`)), boundaries.context),
  );
  assert.deepEqual(groups, [
    "nextThreeDays",
    "nextThreeDays",
    "nextThreeDays",
    "comingWeek",
    "comingWeek",
    "comingWeek",
    "comingWeek",
    null,
  ]);
  assert.deepEqual(getReminderWindowDates(boundaries.context.currentDate), {
    nextThreeDays: ["2026-08-10", "2026-08-11", "2026-08-12"],
    comingWeek: ["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"],
  });
});

test("eligibility includes local dates zero through six and excludes seven", () => {
  for (const offset of [0, 1, 2, 3, 4, 5, 6]) {
    const date = getReminderWindowDates(boundaries.context.currentDate).comingWeek[0];
    const startTime = atIndia(`${date}T10:00:00`);
    const adjustedStartTime = new Date(startTime.getTime() + (offset - 3) * 24 * 60 * 60 * 1000);
    assert.equal(isClinicReminderEligible(booking(adjustedStartTime), boundaries), true, `offset=${offset}`);
    assert.equal(isDoctorReminderEligible(booking(adjustedStartTime), boundaries), true, `offset=${offset}`);
  }

  const sevenDaysLater = atIndia("2026-08-17T10:00:00");
  assert.equal(isClinicReminderEligible(booking(sevenDaysLater), boundaries), false);
  assert.equal(isDoctorReminderEligible(booking(sevenDaysLater), boundaries), false);
});

test("uses clinic timezone rather than server or browser timezone", () => {
  const utcBoundaries = createBookingDateBoundaries(new Date("2026-08-10T20:00:00.000Z"), "UTC");
  const indiaBoundaries = createBookingDateBoundaries(new Date("2026-08-10T20:00:00.000Z"), "Asia/Kolkata");
  const bookingAtUtcMidnight = booking(new Date("2026-08-10T20:30:00.000Z"));

  assert.equal(getReminderDateGroup(bookingAtUtcMidnight, utcBoundaries.context), "nextThreeDays");
  assert.equal(getReminderDateGroup(bookingAtUtcMidnight, indiaBoundaries.context), "nextThreeDays");
  assert.equal(indiaBoundaries.context.currentDate, "2026-08-11");
  assert.equal(utcBoundaries.context.currentDate, "2026-08-10");

  const nearWindowBoundary = booking(new Date("2026-08-17T18:00:00.000Z"));
  assert.equal(isClinicReminderEligible(nearWindowBoundary, utcBoundaries), false);
  assert.equal(isClinicReminderEligible(nearWindowBoundary, indiaBoundaries), true);
});

test("limits digest recipients to approved, active, non-archived clinics", () => {
  assert.equal(isDigestEligibleClinic({ status: "approved", isArchived: false, subscriptionStatus: "active" }), true);
  for (const overrides of [
    { status: "pending" },
    { status: "rejected" },
    { status: "approved", isArchived: true },
    { status: "approved", subscriptionStatus: "unpaid" },
    { status: "approved", subscriptionStatus: "expired" },
    { status: "approved", subscriptionStatus: null },
  ]) {
    assert.equal(
      isDigestEligibleClinic({ status: "approved", isArchived: false, subscriptionStatus: "active", ...overrides }),
      false,
      JSON.stringify(overrides),
    );
  }
});