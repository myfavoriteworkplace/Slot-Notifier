import {
  classifyBooking,
  createBusinessDateContext,
  DEFAULT_CLINIC_TIMEZONE,
  type BookingClassification,
  type BookingClassifierRole,
  type BusinessDateContext,
} from "@shared/booking-status";
import type { BookingWithSlot } from "@/lib/clinic-constants";

export type ClientBookingRole = "clinic" | "doctor";

/**
 * Client boundary for the shared booking policy.
 *
 * The clinic timezone is intentionally centralized here until clinic-specific
 * IANA timezones are exposed by the session APIs. Keeping the fallback in one
 * place prevents cards, dialogs, and dashboards from drifting into browser or
 * UTC date calculations.
 */
export function createClientBookingDateContext(now = new Date()): BusinessDateContext {
  return createBusinessDateContext(now, DEFAULT_CLINIC_TIMEZONE);
}

export function classifyClientBooking(
  booking: BookingWithSlot,
  role: ClientBookingRole,
  context?: BusinessDateContext,
): BookingClassification {
  const classifierRole: BookingClassifierRole = role === "clinic" ? "owner" : "doctor";
  return classifyBooking(
    booking,
    context ?? createClientBookingDateContext(),
    classifierRole,
  );
}

export function getBookingLifecycleStage(
  classification: BookingClassification,
): "booked" | "confirmed" | "checked_in" | "in_consultation" | "treatment_completed" | "visit_completed" | "cancelled" | "no_show" | "left_early" {
  switch (classification.normalizedLifecycle) {
    case "cancelled":
      return "cancelled";
    case "no_show":
      return "no_show";
    case "patient_left_early":
      return "left_early";
    case "completed":
      return "visit_completed";
    case "treatment_completed":
      return "treatment_completed";
    case "in_consultation":
      return "in_consultation";
    case "checked_in":
      return "checked_in";
    case "confirmed_not_started":
      return "confirmed";
    default:
      return "booked";
  }
}
