import {
  classifyBooking,
  createBusinessDateContext,
  type BookingClassification,
} from "@shared/booking-status";

export type BookingTransition =
  | "clinic_confirm"
  | "clinic_cancel"
  | "clinic_checkin"
  | "clinic_complete"
  | "clinic_no_show"
  | "clinic_override_complete"
  | "clinic_patient_left_early"
  | "clinic_reschedule"
  | "doctor_start_consultation"
  | "doctor_complete"
  | "doctor_approve"
  | "doctor_decline";

export interface TransitionBooking {
  verificationStatus?: string | null;
  confirmedBy?: string | null;
  doctorApprovalStatus?: string | null;
  visitStatus?: string | null;
  slot?: { startTime?: Date | string | number | null } | null;
}

export class BookingTransitionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 403 | 404 | 409 = 409,
  ) {
    super(message);
    this.name = "BookingTransitionError";
  }
}

export function assertClinicBookingOwnership(
  slot: { clinicId?: number | null } | null | undefined,
  clinicId: number | null | undefined,
  isSuperuser = false,
): void {
  if (isSuperuser) return;
  if (!clinicId || !slot || slot.clinicId !== Number(clinicId)) {
    throw new BookingTransitionError(
      "Booking does not belong to this clinic",
      403,
    );
  }
}

function classifyForTransition(
  booking: TransitionBooking,
  clinicTimezone?: string | null,
): BookingClassification {
  return classifyBooking(
    booking,
    createBusinessDateContext(new Date(), clinicTimezone || "Asia/Kolkata"),
    "owner",
  );
}

function requireReason(reason: unknown): string {
  if (typeof reason !== "string" || !reason.trim()) {
    throw new BookingTransitionError(
      "A reason is required for this transition",
      400,
    );
  }
  return reason.trim();
}

function rejectTerminal(classification: BookingClassification): void {
  if (classification.isTerminal) {
    throw new BookingTransitionError(
      "Cannot transition a terminal booking",
      409,
    );
  }
}

/**
 * Server-side lifecycle policy. UI action flags are intentionally not trusted:
 * this function is called again immediately before each protected mutation.
 */
export function assertBookingTransition(
  booking: TransitionBooking,
  transition: BookingTransition,
  options: {
    clinicTimezone?: string | null;
    reason?: unknown;
    undo?: boolean;
  } = {},
): BookingClassification {
  const classification = classifyForTransition(
    booking,
    options.clinicTimezone,
  );

  switch (transition) {
    case "clinic_confirm":
      rejectTerminal(classification);
      if (
        classification.isConfirmed ||
        classification.isStarted ||
        classification.isTreatmentCompleted ||
        classification.isCompleted ||
        classification.isOld ||
        classification.isPastDueToday ||
        !classification.isDateKnown
      ) {
        throw new BookingTransitionError(
          "Only a current, not-started booking can be confirmed",
          409,
        );
      }
      break;

    case "clinic_cancel":
      rejectTerminal(classification);
      if (
        classification.isStarted ||
        classification.isTreatmentCompleted ||
        classification.isCompleted
      ) {
        throw new BookingTransitionError(
          "Started or completed visits cannot be cancelled",
          409,
        );
      }
      break;

    case "clinic_checkin":
      rejectTerminal(classification);
      if (options.undo) {
        if (classification.visit.value !== "checked_in") {
          throw new BookingTransitionError(
            "Only a checked-in booking can be checked back out",
            409,
          );
        }
      } else if (
        !classification.isConfirmed ||
        classification.isStarted ||
        classification.isTreatmentCompleted ||
        classification.isCompleted
      ) {
        throw new BookingTransitionError(
          "Only a confirmed, not-started booking can be checked in",
          409,
        );
      }
      break;

    case "clinic_complete":
      rejectTerminal(classification);
      if (!classification.isActive && !classification.isTreatmentCompleted) {
        throw new BookingTransitionError(
          "Only an active or treatment-completed visit can be closed",
          409,
        );
      }
      break;

    case "clinic_no_show":
      rejectTerminal(classification);
      requireReason(options.reason);
      if (
        !classification.isConfirmed ||
        classification.isStarted ||
        classification.isTreatmentCompleted ||
        classification.isCompleted ||
        (!classification.isOld && !classification.isPastDueToday)
      ) {
        throw new BookingTransitionError(
          "Only a past, confirmed, not-started booking can be marked no-show",
          409,
        );
      }
      break;

    case "clinic_override_complete":
      rejectTerminal(classification);
      requireReason(options.reason);
      if (
        classification.isCompleted ||
        classification.isTreatmentCompleted ||
        (!classification.isOld &&
          !classification.isPastDueToday &&
          classification.isDateKnown)
      ) {
        throw new BookingTransitionError(
          "Override is only available for unresolved old or past-due bookings",
          409,
        );
      }
      break;

    case "clinic_patient_left_early":
      rejectTerminal(classification);
      requireReason(options.reason);
      if (!classification.isActive) {
        throw new BookingTransitionError(
          "Patient-left-early can only be recorded for an active visit",
          409,
        );
      }
      break;

    case "clinic_reschedule":
      rejectTerminal(classification);
      if (
        classification.isStarted ||
        classification.isTreatmentCompleted ||
        classification.isCompleted ||
        classification.isActive
      ) {
        throw new BookingTransitionError(
          "Only a not-started booking can be rescheduled",
          409,
        );
      }
      break;

    case "doctor_start_consultation":
      rejectTerminal(classification);
      if (
        !classification.isConfirmed ||
        classification.visit.value !== "checked_in"
      ) {
        throw new BookingTransitionError(
          "Only a confirmed, checked-in booking can start consultation",
          409,
        );
      }
      break;

    case "doctor_complete":
      rejectTerminal(classification);
      if (classification.visit.value !== "in_consultation") {
        throw new BookingTransitionError(
          "Only an in-consultation booking can be marked treatment-completed",
          409,
        );
      }
      break;

    case "doctor_approve":
    case "doctor_decline":
      rejectTerminal(classification);
      if (
        classification.doctorApproval.value !== "pending" ||
        classification.isOld ||
        classification.isTreatmentCompleted ||
        classification.isCompleted
      ) {
        throw new BookingTransitionError(
          "This booking is not awaiting current doctor approval",
          409,
        );
      }
      break;
  }

  return classification;
}