/**
 * Canonical booking status vocabulary.
 *
 * This module is intentionally behavior-neutral in Phase 3. Existing callers
 * continue using their current comparisons until the classifier migration.
 * Raw database values are preserved by every normalization result.
 */

export const DEFAULT_CLINIC_TIMEZONE = "Asia/Kolkata" as const;

export const CONFIRMATION_STATUS_VALUES = [
  "pending",
  "confirmed",
  "cancelled",
  "no_show",
] as const;

export type ConfirmationStatus = typeof CONFIRMATION_STATUS_VALUES[number];

export const LEGACY_CONFIRMATION_STATUS_VALUES = [
  "email_verified",
  "admin_booked",
] as const;

export type LegacyConfirmationStatus = typeof LEGACY_CONFIRMATION_STATUS_VALUES[number];

export const DOCTOR_APPROVAL_STATUS_VALUES = [
  "unassigned",
  "pending",
  "approved",
  "declined",
  "admin_confirmed",
] as const;

export type DoctorApprovalStatus = typeof DOCTOR_APPROVAL_STATUS_VALUES[number];

export const VISIT_STATUS_VALUES = [
  "not_started",
  "checked_in",
  "in_consultation",
  "treatment_completed",
  "completed",
  "patient_left_early",
] as const;

export type VisitStatus = typeof VISIT_STATUS_VALUES[number];

export type UnknownStatus = "unknown";
export type LegacyStatus = "legacy_unknown";

export type NormalizedConfirmationStatus =
  | ConfirmationStatus
  | LegacyConfirmationStatus
  | UnknownStatus;

export type NormalizedDoctorApprovalStatus =
  | DoctorApprovalStatus
  | UnknownStatus;

export type NormalizedVisitStatus =
  | VisitStatus
  | LegacyStatus;

export type RawBookingStatus = string | null | undefined;

export interface NormalizedStatus<T extends string> {
  value: T;
  rawValue: string | null;
  isKnown: boolean;
  isLegacy: boolean;
}

export const TERMINAL_CONFIRMATION_STATUSES = [
  "cancelled",
  "no_show",
] as const satisfies readonly ConfirmationStatus[];

export const TERMINAL_VISIT_STATUSES = [
  "patient_left_early",
] as const satisfies readonly VisitStatus[];

export const ACTIVE_VISIT_STATUSES = [
  "checked_in",
  "in_consultation",
] as const satisfies readonly VisitStatus[];

export const TREATMENT_COMPLETE_VISIT_STATUSES = [
  "treatment_completed",
] as const satisfies readonly VisitStatus[];

export const VISIT_CLOSED_STATUSES = [
  "completed",
] as const satisfies readonly VisitStatus[];

export const COMPLETED_PATIENT_VISIT_STATUSES = [
  "treatment_completed",
  "completed",
] as const satisfies readonly VisitStatus[];

export const STARTED_PATIENT_VISIT_STATUSES = [
  "checked_in",
  "in_consultation",
  "treatment_completed",
  "completed",
  "patient_left_early",
] as const satisfies readonly VisitStatus[];

export const EARLY_EXIT_VISIT_STATUSES = [
  "patient_left_early",
] as const satisfies readonly VisitStatus[];

export const CONFIRMATION_STATUS_LABELS: Record<ConfirmationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const DOCTOR_APPROVAL_STATUS_LABELS: Record<DoctorApprovalStatus, string> = {
  unassigned: "Unassigned",
  pending: "Awaiting doctor approval",
  approved: "Approved",
  declined: "Declined",
  admin_confirmed: "Confirmed by clinic",
};

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  not_started: "Not started",
  checked_in: "Checked in",
  in_consultation: "In consultation",
  treatment_completed: "Treatment completed",
  completed: "Completed",
  patient_left_early: "Patient left early",
};

function normalizedResult<T extends string>(
  value: T,
  rawValue: RawBookingStatus,
  options?: { isKnown?: boolean; isLegacy?: boolean },
): NormalizedStatus<T> {
  return {
    value,
    rawValue: rawValue == null ? null : rawValue,
    isKnown: options?.isKnown ?? true,
    isLegacy: options?.isLegacy ?? false,
  };
}

export function normalizeConfirmationStatus(
  rawValue: RawBookingStatus,
): NormalizedStatus<NormalizedConfirmationStatus> {
  if (rawValue == null || rawValue === "") {
    return normalizedResult("unknown", rawValue, { isKnown: false });
  }

  if ((CONFIRMATION_STATUS_VALUES as readonly string[]).includes(rawValue)) {
    return normalizedResult(rawValue as ConfirmationStatus, rawValue);
  }

  if ((LEGACY_CONFIRMATION_STATUS_VALUES as readonly string[]).includes(rawValue)) {
    return normalizedResult(rawValue as LegacyConfirmationStatus, rawValue, {
      isKnown: false,
      isLegacy: true,
    });
  }

  return normalizedResult("unknown", rawValue, { isKnown: false });
}

export function normalizeDoctorApprovalStatus(
  rawValue: RawBookingStatus,
): NormalizedStatus<NormalizedDoctorApprovalStatus> {
  if (rawValue == null || rawValue === "") {
    return normalizedResult("unassigned", rawValue);
  }

  if ((DOCTOR_APPROVAL_STATUS_VALUES as readonly string[]).includes(rawValue)) {
    return normalizedResult(rawValue as DoctorApprovalStatus, rawValue);
  }

  return normalizedResult("unknown", rawValue, { isKnown: false });
}

export function normalizeVisitStatus(
  rawValue: RawBookingStatus,
): NormalizedStatus<NormalizedVisitStatus> {
  if (rawValue == null || rawValue === "") {
    return normalizedResult("not_started", rawValue);
  }

  if ((VISIT_STATUS_VALUES as readonly string[]).includes(rawValue)) {
    return normalizedResult(rawValue as VisitStatus, rawValue);
  }

  return normalizedResult("legacy_unknown", rawValue, {
    isKnown: false,
    isLegacy: true,
  });
}

export function isTerminalVisitStatus(status: NormalizedVisitStatus): boolean {
  return (TERMINAL_VISIT_STATUSES as readonly string[]).includes(status);
}

export function isActiveVisitStatus(status: NormalizedVisitStatus): boolean {
  return (ACTIVE_VISIT_STATUSES as readonly string[]).includes(status);
}

export function isCompletedPatientVisitStatus(status: NormalizedVisitStatus): boolean {
  return (COMPLETED_PATIENT_VISIT_STATUSES as readonly string[]).includes(status);
}

export function isStartedPatientVisitStatus(status: NormalizedVisitStatus): boolean {
  return (STARTED_PATIENT_VISIT_STATUSES as readonly string[]).includes(status);
}

export interface BusinessDateContext {
  now: Date;
  currentDate: string;
  timezone: string;
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date supplied to booking date context");
  }
}

/**
 * Returns the calendar date as seen in a clinic's IANA timezone.
 * The `en-CA` locale gives a stable yyyy-MM-dd representation.
 */
export function getCalendarDateInTimezone(
  value: Date | string | number,
  timezone: string = DEFAULT_CLINIC_TIMEZONE,
): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  assertValidDate(date);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: "year" | "month" | "day"): string => {
    const matchingPart = parts.find((item) => item.type === type)?.value;
    if (!matchingPart) {
      throw new Error(`Unable to determine ${type} in timezone ${timezone}`);
    }
    return matchingPart;
  };

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function createBusinessDateContext(
  now: Date = new Date(),
  timezone: string = DEFAULT_CLINIC_TIMEZONE,
): BusinessDateContext {
  assertValidDate(now);
  const contextNow = new Date(now.getTime());

  return {
    now: contextNow,
    currentDate: getCalendarDateInTimezone(contextNow, timezone),
    timezone,
  };
}