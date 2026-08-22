import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBookingTransition,
  assertClinicBookingOwnership,
  BookingTransitionError,
} from "./booking-transition-policy";

const futureSlot = () =>
  ({ startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) });
const pastSlot = () =>
  ({ startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });

const baseBooking = (overrides: Record<string, unknown> = {}) => ({
  verificationStatus: "confirmed",
  confirmedBy: "clinic",
  doctorApprovalStatus: "approved",
  visitStatus: null,
  slot: futureSlot(),
  ...overrides,
});

const assertTransitionError = (
  callback: () => unknown,
  message: string,
  statusCode = 409,
) => {
  assert.throws(callback, (error: unknown) => {
    assert.ok(error instanceof BookingTransitionError);
    assert.equal(error.message, message);
    assert.equal(error.statusCode, statusCode);
    return true;
  });
};

test("terminal confirmation states cannot be advanced or overridden", () => {
  for (const verificationStatus of ["cancelled", "no_show"]) {
    const booking = baseBooking({ verificationStatus });
    assertTransitionError(
      () => assertBookingTransition(booking, "clinic_confirm"),
      "Cannot transition a terminal booking",
    );
    assertTransitionError(
      () => assertBookingTransition(booking, "clinic_override_complete", { reason: "Correction" }),
      "Cannot transition a terminal booking",
    );
  }
});

test("patient-left-early and treatment-completed records cannot be override-completed", () => {
  for (const visitStatus of ["patient_left_early", "treatment_completed"]) {
    assertTransitionError(
      () => assertBookingTransition(baseBooking({ visitStatus }), "clinic_override_complete", { reason: "Correction" }),
      visitStatus === "patient_left_early"
        ? "Cannot transition a terminal booking"
        : "Override is only available for unresolved old or past-due bookings",
    );
  }
});

test("manual no-show requires a reason and a past, confirmed, not-started visit", () => {
  const booking = baseBooking({
    slot: pastSlot(),
    visitStatus: null,
  });
  assertTransitionError(
    () => assertBookingTransition(booking, "clinic_no_show"),
    "A reason is required for this transition",
    400,
  );
  assert.equal(
    assertBookingTransition(booking, "clinic_no_show", { reason: "Patient did not attend" }).isOld,
    true,
  );
  assertTransitionError(
    () => assertBookingTransition({ ...booking, visitStatus: "checked_in" }, "clinic_no_show", { reason: "No-show" }),
    "Only a past, confirmed, not-started booking can be marked no-show",
  );
});

test("early exit is limited to an active visit and always needs a reason", () => {
  assertTransitionError(
    () => assertBookingTransition(baseBooking({ visitStatus: "checked_in" }), "clinic_patient_left_early"),
    "A reason is required for this transition",
    400,
  );
  assert.equal(
    assertBookingTransition(
      baseBooking({ visitStatus: "in_consultation" }),
      "clinic_patient_left_early",
      { reason: "Patient left before treatment finished" },
    ).isActive,
    true,
  );
  assertTransitionError(
    () => assertBookingTransition(baseBooking(), "clinic_patient_left_early", { reason: "Left" }),
    "Patient-left-early can only be recorded for an active visit",
  );
});

test("doctor consultation transitions require the expected visit sequence", () => {
  assert.equal(
    assertBookingTransition(
      baseBooking({ visitStatus: "checked_in" }),
      "doctor_start_consultation",
    ).visit.value,
    "checked_in",
  );
  assertTransitionError(
    () => assertBookingTransition(baseBooking(), "doctor_start_consultation"),
    "Only a confirmed, checked-in booking can start consultation",
  );
  assertTransitionError(
    () => assertBookingTransition(baseBooking({ visitStatus: "checked_in" }), "doctor_complete"),
    "Only an in-consultation booking can be marked treatment-completed",
  );
  assert.equal(
    assertBookingTransition(
      baseBooking({ visitStatus: "in_consultation" }),
      "doctor_complete",
    ).visit.value,
    "in_consultation",
  );
});

test("clinic ownership is enforced unless the actor is superuser", () => {
  assertClinicBookingOwnership({ clinicId: 7 }, 7);
  assertClinicBookingOwnership({ clinicId: 7 }, undefined, true);
  assertTransitionError(
    () => assertClinicBookingOwnership({ clinicId: 7 }, 8),
    "Booking does not belong to this clinic",
    403,
  );
});