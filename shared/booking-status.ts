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

// ── Pure booking classifier ─────────────────────────────────────────────────

export type BookingClassifierRole =
  | "doctor"
  | "owner"
  | "superuser"
  | "clinic_admin"
  | "customer";

export type BookingDateCategory =
  | "unknown"
  | "old"
  | "today_past_due"
  | "today_upcoming"
  | "future";

export type BookingOperationalState =
  | "unknown_date"
  | "old_needs_resolution"
  | "old_active"
  | "old_treatment_completed"
  | "historical_completed"
  | "same_day_past_due"
  | "today_upcoming"
  | "future_waiting"
  | "awaiting_doctor_approval"
  | "cancelled"
  | "no_show"
  | "early_exit";

export type BookingNormalizedLifecycle =
  | "pending_not_started"
  | "confirmed_not_started"
  | "awaiting_doctor_approval"
  | "checked_in"
  | "in_consultation"
  | "treatment_completed"
  | "completed"
  | "patient_left_early"
  | "cancelled"
  | "no_show"
  | "unknown";

export interface BookingClassifierInput {
  verificationStatus?: RawBookingStatus;
  doctorApprovalStatus?: RawBookingStatus;
  visitStatus?: RawBookingStatus;
  confirmedBy?: string | null;
  slot?: { startTime?: Date | string | number | null } | null;
  startTime?: Date | string | number | null;
}

export interface BookingActionPolicy {
  canConfirm: boolean;
  canCancel: boolean;
  canCheckIn: boolean;
  canCompleteVisit: boolean;
  canNoShow: boolean;
  canSendReminder: boolean;
  canAssignDoctor: boolean;
  canRequestConsent: boolean;
  canReschedule: boolean;
  canContinueVisit: boolean;
  canUpdateClinicalStatus: boolean;
  canAcceptDoctorApproval: boolean;
  canDeclineDoctorApproval: boolean;
  canRebook: boolean;
  canViewHistory: boolean;
  canViewBilling: boolean;
  /**
   * This only indicates that an explicit override could be offered. It is not
   * authorization to perform the override; the server must re-check state and
   * permissions in Phase 7.
   */
  canOverride: boolean;
}

export interface BookingClassification {
  dateCategory: BookingDateCategory;
  operationalState: BookingOperationalState;
  normalizedLifecycle: BookingNormalizedLifecycle;
  confirmation: NormalizedStatus<NormalizedConfirmationStatus>;
  doctorApproval: NormalizedStatus<NormalizedDoctorApprovalStatus>;
  visit: NormalizedStatus<NormalizedVisitStatus>;
  rawStartTime: Date | null;
  isDateKnown: boolean;
  isToday: boolean;
  isPastDueToday: boolean;
  isOld: boolean;
  isTerminal: boolean;
  isActive: boolean;
  isStarted: boolean;
  isTreatmentCompleted: boolean;
  isCompleted: boolean;
  isEarlyExit: boolean;
  isConfirmed: boolean;
  isAwaitingDoctorApproval: boolean;
  hasConflictingTerminalVisitState: boolean;
  messageInputs: {
    showOldResolution: boolean;
    showSameDayPastDue: boolean;
    showActiveVisit: boolean;
    showTreatmentCompleted: boolean;
    showCompleted: boolean;
    showTerminal: boolean;
    showEarlyExit: boolean;
    showAwaitingDoctorApproval: boolean;
    showNotArrived: boolean;
  };
  actions: BookingActionPolicy;
}

function parseBookingStartTime(
  booking: BookingClassifierInput,
): Date | null {
  const rawValue = booking.slot?.startTime ?? booking.startTime;
  if (rawValue == null) return null;

  const date = rawValue instanceof Date
    ? new Date(rawValue.getTime())
    : new Date(rawValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isClinicRole(role: BookingClassifierRole): boolean {
  return role === "owner" || role === "superuser" || role === "clinic_admin";
}

/**
 * Interprets one booking without rendering, I/O, or mutation.
 *
 * This is deliberately independent of the database Booking type so callers
 * can provide a booking joined to a slot without coupling this policy module
 * to Drizzle or a particular API response shape.
 */
export function classifyBooking(
  booking: BookingClassifierInput,
  dateContext: BusinessDateContext,
  role: BookingClassifierRole,
): BookingClassification {
  const rawStartTime = parseBookingStartTime(booking);
  const confirmation = normalizeConfirmationStatus(booking.verificationStatus);
  const doctorApproval = normalizeDoctorApprovalStatus(booking.doctorApprovalStatus);
  const visit = normalizeVisitStatus(booking.visitStatus);
  const startDate = rawStartTime
    ? getCalendarDateInTimezone(rawStartTime, dateContext.timezone)
    : null;
  const isDateKnown = startDate !== null;
  const isToday = startDate === dateContext.currentDate;
  const isOld = isDateKnown && startDate! < dateContext.currentDate;
  const isPastDueToday = isToday && rawStartTime!.getTime() <= dateContext.now.getTime();
  const dateCategory: BookingDateCategory = !isDateKnown
    ? "unknown"
    : isOld
    ? "old"
    : isToday && isPastDueToday
    ? "today_past_due"
    : isToday
    ? "today_upcoming"
    : "future";

  const isCancelled = confirmation.value === "cancelled";
  const isNoShow = confirmation.value === "no_show";
  const isEarlyExit = visit.value === "patient_left_early";
  const isCompleted = visit.value === "completed";
  const isTreatmentCompleted = visit.value === "treatment_completed";
  const isActiveVisit = isActiveVisitStatus(visit.value);
  const isStarted = isStartedPatientVisitStatus(visit.value);
  const isConfirmed = confirmation.value === "confirmed" || !!booking.confirmedBy;
  const isTerminal = isCancelled || isNoShow || isEarlyExit;
  const hasConflictingTerminalVisitState =
    (isCancelled || isNoShow || isEarlyExit) && isActiveVisit;
  // Terminal confirmation wins over an active visit in conflicts. This keeps
  // an inconsistent record from receiving normal consultation actions.
  const isActive = isActiveVisit && !isTerminal;
  const isAwaitingDoctorApproval =
    doctorApproval.value === "pending" && !isTerminal;

  let normalizedLifecycle: BookingNormalizedLifecycle;
  if (isCancelled) normalizedLifecycle = "cancelled";
  else if (isNoShow) normalizedLifecycle = "no_show";
  else if (isEarlyExit) normalizedLifecycle = "patient_left_early";
  else if (isCompleted) normalizedLifecycle = "completed";
  else if (isTreatmentCompleted) normalizedLifecycle = "treatment_completed";
  else if (visit.value === "in_consultation") normalizedLifecycle = "in_consultation";
  else if (visit.value === "checked_in") normalizedLifecycle = "checked_in";
  else if (isAwaitingDoctorApproval) normalizedLifecycle = "awaiting_doctor_approval";
  else if (isConfirmed) normalizedLifecycle = "confirmed_not_started";
  else if (confirmation.value === "pending") normalizedLifecycle = "pending_not_started";
  else normalizedLifecycle = "unknown";

  let operationalState: BookingOperationalState;
  if (isCancelled) operationalState = "cancelled";
  else if (isNoShow) operationalState = "no_show";
  else if (isEarlyExit) operationalState = "early_exit";
  else if (isOld && isActive) operationalState = "old_active";
  else if (isOld && isTreatmentCompleted) operationalState = "old_treatment_completed";
  else if (isOld && isCompleted) operationalState = "historical_completed";
  else if (isOld) operationalState = "old_needs_resolution";
  else if (isAwaitingDoctorApproval) operationalState = "awaiting_doctor_approval";
  else if (!isDateKnown) operationalState = "unknown_date";
  else if (isPastDueToday) operationalState = "same_day_past_due";
  else if (isToday) operationalState = "today_upcoming";
  else operationalState = "future_waiting";

  const isClinic = isClinicRole(role);
  const canProgress = !isTerminal && !isCompleted;
  const canUseNormalDoctorActions =
    role === "doctor" && canProgress && (isActive || (!isOld && !isPastDueToday && !isStarted));
  const canOverride =
    isClinic &&
    !isTerminal &&
    !isCompleted &&
    !isTreatmentCompleted &&
    (isOld || isPastDueToday || !isDateKnown);

  const actions: BookingActionPolicy = {
    canConfirm:
      isClinic &&
      canProgress &&
      !isTreatmentCompleted &&
      !isActive &&
      !isConfirmed,
    canCancel: isClinic && canProgress && !isTreatmentCompleted,
    canCheckIn:
      isClinic &&
      canProgress &&
      !isTreatmentCompleted &&
      !isActive &&
      !isStarted,
    canCompleteVisit:
      canProgress &&
      (isActive || isTreatmentCompleted) &&
      (isClinic || role === "doctor"),
    canNoShow:
      isClinic &&
      canProgress &&
      !isTreatmentCompleted &&
      !isStarted,
    canSendReminder: isClinic && canProgress,
    canAssignDoctor: isClinic && canProgress,
    canRequestConsent: isClinic && canProgress,
    canReschedule: isClinic && canProgress && !isActive,
    canContinueVisit: canUseNormalDoctorActions && isActive,
    canUpdateClinicalStatus: canUseNormalDoctorActions && isActive,
    canAcceptDoctorApproval:
      role === "doctor" && isAwaitingDoctorApproval,
    canDeclineDoctorApproval:
      role === "doctor" && isAwaitingDoctorApproval,
    canRebook: isTerminal || isCompleted || isOld,
    canViewHistory: isTerminal || isCompleted || isTreatmentCompleted || isOld,
    canViewBilling: isTerminal || isCompleted || isTreatmentCompleted || isOld,
    canOverride,
  };

  return {
    dateCategory,
    operationalState,
    normalizedLifecycle,
    confirmation,
    doctorApproval,
    visit,
    rawStartTime,
    isDateKnown,
    isToday,
    isPastDueToday,
    isOld,
    isTerminal,
    isActive,
    isStarted,
    isTreatmentCompleted,
    isCompleted,
    isEarlyExit,
    isConfirmed,
    isAwaitingDoctorApproval,
    hasConflictingTerminalVisitState,
    messageInputs: {
      showOldResolution: operationalState === "old_needs_resolution",
      showSameDayPastDue: operationalState === "same_day_past_due",
      showActiveVisit: isActive,
      showTreatmentCompleted: isTreatmentCompleted,
      showCompleted: isCompleted,
      showTerminal: isTerminal,
      showEarlyExit: isEarlyExit,
      showAwaitingDoctorApproval: isAwaitingDoctorApproval,
      showNotArrived:
        !isTerminal &&
        !isStarted &&
        !isTreatmentCompleted &&
        !isCompleted,
    },
    actions,
  };
}