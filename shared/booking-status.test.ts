import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_VISIT_STATUSES,
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