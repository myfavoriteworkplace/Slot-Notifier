import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_VISIT_STATUSES,
  classifyBooking,
  COMPLETED_PATIENT_VISIT_STATUSES,
  DEFAULT_CLINIC_TIMEZONE,
  createBusinessDateContext,
  getCalendarDateInTimezone,
  isActiveVisitStatus,
  isCompletedPatientVisitStatus,
  isStartedPatientVisitStatus,
  isTerminalVisitStatus,
  normalizeConfirmationStatus,
  normalizeDoctorApprovalStatus,
  normalizeVisitStatus,
  STARTED_PATIENT_VISIT_STATUSES,
  TERMINAL_VISIT_STATUSES,
  VISIT_CLOSED_STATUSES,
} from "./booking-status";

test("normalizes nullable visit status to not_started without changing stored data", () => {
  const result = normalizeVisitStatus(null);

  assert.deepEqual(result, {
    value: "not_started",
    rawValue: null,
    isKnown: true,
    isLegacy: false,
  });
});

test("preserves supported, legacy, and unknown confirmation values", () => {
  assert.deepEqual(normalizeConfirmationStatus("confirmed"), {
    value: "confirmed",
    rawValue: "confirmed",
    isKnown: true,
    isLegacy: false,
  });

  assert.deepEqual(normalizeConfirmationStatus("admin_booked"), {
    value: "admin_booked",
    rawValue: "admin_booked",
    isKnown: false,
    isLegacy: true,
  });

  assert.deepEqual(normalizeConfirmationStatus("historical_value"), {
    value: "unknown",
    rawValue: "historical_value",
    isKnown: false,
    isLegacy: false,
  });
});

test("maps null doctor approval to unassigned and unknown values safely", () => {
  assert.equal(normalizeDoctorApprovalStatus(null).value, "unassigned");
  assert.equal(normalizeDoctorApprovalStatus("accepted").value, "unknown");
  assert.equal(normalizeDoctorApprovalStatus("accepted").isKnown, false);
});

test("preserves unsupported visit values as legacy_unknown", () => {
  const result = normalizeVisitStatus("scheduled");

  assert.equal(result.value, "legacy_unknown");
  assert.equal(result.rawValue, "scheduled");
  assert.equal(result.isLegacy, true);
  assert.equal(result.isKnown, false);
});

test("named visit groups match the approved lifecycle policy", () => {
  assert.deepEqual(TERMINAL_VISIT_STATUSES, ["patient_left_early"]);
  assert.deepEqual(ACTIVE_VISIT_STATUSES, ["checked_in", "in_consultation"]);
  assert.deepEqual(COMPLETED_PATIENT_VISIT_STATUSES, ["treatment_completed", "completed"]);
  assert.deepEqual(VISIT_CLOSED_STATUSES, ["completed"]);
  assert.deepEqual(STARTED_PATIENT_VISIT_STATUSES, [
    "checked_in",
    "in_consultation",
    "treatment_completed",
    "completed",
    "patient_left_early",
  ]);

  assert.equal(isTerminalVisitStatus("patient_left_early"), true);
  assert.equal(isCompletedPatientVisitStatus("patient_left_early"), false);
  assert.equal(isActiveVisitStatus("in_consultation"), true);
  assert.equal(isStartedPatientVisitStatus("checked_in"), true);
});

test("uses the clinic timezone rather than UTC for business dates", () => {
  const instant = new Date("2026-08-10T20:00:00.000Z");

  assert.equal(getCalendarDateInTimezone(instant, "Asia/Kolkata"), "2026-08-11");
  assert.equal(getCalendarDateInTimezone(instant, "UTC"), "2026-08-10");

  const context = createBusinessDateContext(instant);
  assert.equal(context.timezone, DEFAULT_CLINIC_TIMEZONE);
  assert.equal(context.currentDate, "2026-08-11");
  assert.notEqual(context.now, instant);
  assert.equal(context.now.getTime(), instant.getTime());
});

const classifierContext = createBusinessDateContext(
  new Date("2026-08-10T08:00:00.000Z"),
  "Asia/Kolkata",
);

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  verificationStatus: "confirmed",
  doctorApprovalStatus: "approved",
  visitStatus: null,
  confirmedBy: "clinic",
  slot: { startTime: "2026-08-10T10:00:00.000+05:30" },
  ...overrides,
});

test("classifies the complete old-booking and same-day state matrix", () => {
  const cases = [
    ["old pending", { verificationStatus: "pending", confirmedBy: null, slot: { startTime: "2026-08-09T10:00:00+05:30" } }, "old_needs_resolution"],
    ["old confirmed", { slot: { startTime: "2026-08-09T10:00:00+05:30" } }, "old_needs_resolution"],
    ["old checked in", { visitStatus: "checked_in", slot: { startTime: "2026-08-09T10:00:00+05:30" } }, "old_active"],
    ["old in consultation", { visitStatus: "in_consultation", slot: { startTime: "2026-08-09T10:00:00+05:30" } }, "old_active"],
    ["old treatment complete", { visitStatus: "treatment_completed", slot: { startTime: "2026-08-09T10:00:00+05:30" } }, "old_treatment_completed"],
    ["old completed", { visitStatus: "completed", slot: { startTime: "2026-08-09T10:00:00+05:30" } }, "historical_completed"],
    ["same-day past due", { slot: { startTime: "2026-08-10T12:00:00+05:30" } }, "same_day_past_due"],
    ["today upcoming", { slot: { startTime: "2026-08-10T15:00:00+05:30" } }, "today_upcoming"],
    ["future", { slot: { startTime: "2026-08-11T10:00:00+05:30" } }, "future_waiting"],
  ] as const;

  for (const [name, overrides, expected] of cases) {
    assert.equal(
      classifyBooking(makeBooking(overrides), classifierContext, "doctor").operationalState,
      expected,
      name,
    );
  }
});

test("classifies terminal and early-exit states before date meaning", () => {
  const cancelled = classifyBooking(
    makeBooking({ verificationStatus: "cancelled", visitStatus: "checked_in" }),
    classifierContext,
    "doctor",
  );
  assert.equal(cancelled.operationalState, "cancelled");
  assert.equal(cancelled.isTerminal, true);
  assert.equal(cancelled.isActive, false);
  assert.equal(cancelled.hasConflictingTerminalVisitState, true);
  assert.equal(cancelled.actions.canContinueVisit, false);
  assert.equal(cancelled.actions.canRebook, true);

  const earlyExit = classifyBooking(
    makeBooking({ visitStatus: "patient_left_early" }),
    classifierContext,
    "doctor",
  );
  assert.equal(earlyExit.operationalState, "early_exit");
  assert.equal(earlyExit.isEarlyExit, true);
  assert.equal(earlyExit.isCompleted, false);
  assert.equal(earlyExit.actions.canRebook, true);
});

test("allows clinic no-show only for confirmed appointments that are past due", () => {
  const futureConfirmed = classifyBooking(
    makeBooking({ slot: { startTime: "2026-08-11T10:00:00+05:30" } }),
    classifierContext,
    "owner",
  );
  assert.equal(futureConfirmed.actions.canNoShow, false);

  const futurePending = classifyBooking(
    makeBooking({
      verificationStatus: "pending",
      confirmedBy: null,
      slot: { startTime: "2026-08-11T10:00:00+05:30" },
    }),
    classifierContext,
    "owner",
  );
  assert.equal(futurePending.actions.canNoShow, false);

  const pastDueConfirmed = classifyBooking(
    makeBooking({ slot: { startTime: "2026-08-10T07:00:00+05:30" } }),
    classifierContext,
    "owner",
  );
  assert.equal(pastDueConfirmed.actions.canNoShow, true);

  const pastDuePending = classifyBooking(
    makeBooking({
      verificationStatus: "pending",
      confirmedBy: null,
      slot: { startTime: "2026-08-10T07:00:00+05:30" },
    }),
    classifierContext,
    "owner",
  );
  assert.equal(pastDuePending.actions.canNoShow, false);

  const pastDueCheckedIn = classifyBooking(
    makeBooking({
      visitStatus: "checked_in",
      slot: { startTime: "2026-08-10T07:00:00+05:30" },
    }),
    classifierContext,
    "owner",
  );
  assert.equal(pastDueCheckedIn.actions.canNoShow, false);
});

test("keeps doctor approval separate from confirmation and limits doctor actions", () => {
  const result = classifyBooking(
    makeBooking({ doctorApprovalStatus: "pending", verificationStatus: "pending", confirmedBy: null }),
    classifierContext,
    "doctor",
  );

  assert.equal(result.operationalState, "awaiting_doctor_approval");
  assert.equal(result.normalizedLifecycle, "awaiting_doctor_approval");
  assert.equal(result.isAwaitingDoctorApproval, true);
  assert.equal(result.actions.canAcceptDoctorApproval, true);
  assert.equal(result.actions.canDeclineDoctorApproval, true);
  assert.equal(result.actions.canContinueVisit, false);
  assert.equal(result.actions.canCheckIn, false);
});

test("uses clinic timezone at UTC midnight and handles missing or legacy dates safely", () => {
  const nearMidnight = createBusinessDateContext(
    new Date("2026-08-10T20:00:00.000Z"),
    "Asia/Kolkata",
  );
  const localTomorrow = classifyBooking(
    makeBooking({ slot: { startTime: "2026-08-11T02:00:00+05:30" } }),
    nearMidnight,
    "owner",
  );
  assert.equal(localTomorrow.dateCategory, "today_upcoming");
  assert.equal(localTomorrow.isToday, true);

  const missingDate = classifyBooking(
    makeBooking({ slot: null }),
    classifierContext,
    "doctor",
  );
  assert.equal(missingDate.dateCategory, "unknown");
  assert.equal(missingDate.operationalState, "unknown_date");
  assert.equal(missingDate.isDateKnown, false);
  assert.equal(missingDate.actions.canOverride, false);

  const legacy = classifyBooking(
    makeBooking({ verificationStatus: "historical_value", confirmedBy: null, visitStatus: "scheduled" }),
    classifierContext,
    "doctor",
  );
  assert.equal(legacy.confirmation.value, "unknown");
  assert.equal(legacy.confirmation.rawValue, "historical_value");
  assert.equal(legacy.visit.value, "legacy_unknown");
  assert.equal(legacy.normalizedLifecycle, "unknown");
});

test("returns stable, role-specific policy results without mutating the input", () => {
  const booking = makeBooking({
    verificationStatus: "pending",
    confirmedBy: null,
    slot: { startTime: "2026-08-10T15:00:00+05:30" },
  });
  const before = JSON.stringify(booking);
  const doctor = classifyBooking(booking, classifierContext, "doctor");
  const clinic = classifyBooking(booking, classifierContext, "owner");

  assert.equal(JSON.stringify(booking), before);
  assert.deepEqual(classifyBooking(booking, classifierContext, "doctor"), doctor);
  assert.equal(doctor.actions.canConfirm, false);
  assert.equal(clinic.actions.canConfirm, true);
  assert.equal(doctor.actions.canContinueVisit, false);
});