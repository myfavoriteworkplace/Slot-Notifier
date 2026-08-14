import type {
  BookingClassification,
  BookingNormalizedLifecycle,
} from "@shared/booking-status";

export type AppointmentFooterRole = "clinic" | "doctor";

export type AppointmentFooterActionId =
  | "accept"
  | "add_observation"
  | "bill"
  | "cancel"
  | "confirm"
  | "decline"
  | "doctor_complete_visit"
  | "manage_visit"
  | "mark_arrived"
  | "mark_visit_done"
  | "open_notes"
  | "rebook"
  | "remind"
  | "resolve_booking"
  | "review_appointment"
  | "review_visit"
  | "revert_no_show"
  | "settle_payment"
  | "start_consultation"
  | "view_edit_prescription"
  | "view_invoice";

export type AppointmentFooterActionTarget =
  | "actions"
  | "billing"
  | "notes"
  | "overview"
  | "prescription"
  | "records";

export interface AppointmentFooterAction {
  id: AppointmentFooterActionId;
  label: string;
  target?: AppointmentFooterActionTarget;
}

export interface AppointmentFooterModel {
  role: AppointmentFooterRole;
  primary: AppointmentFooterAction | null;
  secondary: AppointmentFooterAction[];
  readOnly: boolean;
  /**
   * A stable explanation for tests and future analytics. This is intentionally
   * not user-facing copy.
   */
  policyState:
    | "approval_required"
    | "future_pending"
    | "future_confirmed"
    | "same_day_past_due"
    | "old_needs_resolution"
    | "old_active"
    | "old_treatment_completed"
    | "historical_completed"
    | "active_visit"
    | "treatment_completed"
    | "completed"
    | "terminal"
    | "review";
}

export interface AppointmentFooterModelOptions {
  totalBillsCount?: number;
  openBillsCount?: number;
  noShowSource?: string | null;
}

const action = (
  id: AppointmentFooterActionId,
  label: string,
  target?: AppointmentFooterActionTarget,
): AppointmentFooterAction => ({ id, label, target });

function count(value: number | undefined): number {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 0;
}

function canShowRebook(classification: BookingClassification): boolean {
  // The classifier intentionally has a broad canRebook flag for historical
  // records. Active visits and treatment-completed visits must never have
  // Rebook replace their current clinical/administrative workflow.
  return (
    classification.actions.canRebook &&
    !classification.isActive &&
    !classification.isTreatmentCompleted
  );
}

function isUnresolvedDateState(classification: BookingClassification): boolean {
  return (
    classification.operationalState === "old_needs_resolution" ||
    classification.operationalState === "same_day_past_due" ||
    classification.operationalState === "unknown_date"
  );
}

function clinicFooter(
  classification: BookingClassification,
  options: AppointmentFooterModelOptions,
): AppointmentFooterModel {
  const totalBillsCount = count(options.totalBillsCount);
  const openBillsCount = count(options.openBillsCount);
  const hasBills = totalBillsCount > 0;
  const hasUnpaidBills = openBillsCount > 0;
  const addBillingSecondary = (secondary: AppointmentFooterAction[]) => {
    if (hasBills) {
      secondary.push(action("bill", "View Billing", "billing"));
    }
  };
  const addRebookSecondary = (secondary: AppointmentFooterAction[]) => {
    if (canShowRebook(classification)) {
      secondary.push(action("rebook", "Rebook"));
    }
  };

  if (classification.isTerminal) {
    const secondary: AppointmentFooterAction[] = [];
    if (options.noShowSource === "batch_admin") {
      secondary.push(action("revert_no_show", "Revert No-Show"));
    }
    addBillingSecondary(secondary);

    return {
      role: "clinic",
      primary: canShowRebook(classification)
        ? action("rebook", "Rebook")
        : action("review_visit", "Review Visit", "overview"),
      secondary,
      readOnly: false,
      policyState: "terminal",
    };
  }

  if (classification.isCompleted) {
    const secondary: AppointmentFooterAction[] = [];
    addRebookSecondary(secondary);

    return {
      role: "clinic",
      primary: hasUnpaidBills
        ? action("settle_payment", "Settle Payment", "billing")
        : hasBills
        ? action("view_invoice", "View Invoice", "billing")
        : action("review_visit", "Review Visit", "overview"),
      secondary,
      readOnly: false,
      policyState: "completed",
    };
  }

  if (classification.isTreatmentCompleted) {
    const secondary: AppointmentFooterAction[] = [];
    addBillingSecondary(secondary);

    return {
      role: "clinic",
      primary: classification.actions.canCompleteVisit
        ? action("mark_visit_done", "Mark Visit Done")
        : action("review_visit", "Review Visit", "overview"),
      secondary,
      readOnly: false,
      policyState: "treatment_completed",
    };
  }

  if (classification.isActive) {
    const secondary: AppointmentFooterAction[] = [];
    addBillingSecondary(secondary);

    return {
      role: "clinic",
      primary: action("manage_visit", "Manage Visit", "actions"),
      secondary,
      readOnly: false,
      policyState: "active_visit",
    };
  }

  if (isUnresolvedDateState(classification)) {
    const secondary: AppointmentFooterAction[] = [];
    addRebookSecondary(secondary);

    return {
      role: "clinic",
      primary: action("resolve_booking", "Resolve Booking", "actions"),
      secondary,
      readOnly: false,
      policyState:
        classification.operationalState === "old_needs_resolution"
          ? "old_needs_resolution"
          : "same_day_past_due",
    };
  }

  if (classification.actions.canConfirm && !classification.isConfirmed) {
    const secondary: AppointmentFooterAction[] = [];
    if (classification.actions.canCancel) {
      secondary.push(action("cancel", "Cancel"));
    }

    return {
      role: "clinic",
      primary: action("confirm", "Confirm"),
      secondary,
      readOnly: false,
      policyState: "future_pending",
    };
  }

  if (classification.actions.canCheckIn && classification.isConfirmed) {
    const secondary: AppointmentFooterAction[] = [];
    if (classification.actions.canSendReminder) {
      secondary.push(action("remind", "Remind"));
    }

    return {
      role: "clinic",
      primary: action("mark_arrived", "Mark Arrived"),
      secondary,
      readOnly: false,
      policyState: "future_confirmed",
    };
  }

  return {
    role: "clinic",
    primary: action("review_visit", "Review Visit", "overview"),
    secondary: [],
    readOnly: false,
    policyState: "review",
  };
}

function doctorFooter(
  classification: BookingClassification,
): AppointmentFooterModel {
  if (classification.actions.canAcceptDoctorApproval) {
    return {
      role: "doctor",
      primary: action("accept", "Accept"),
      secondary: classification.actions.canDeclineDoctorApproval
        ? [action("decline", "Decline")]
        : [],
      readOnly: false,
      policyState: "approval_required",
    };
  }

  if (classification.normalizedLifecycle === "checked_in") {
    return {
      role: "doctor",
      primary: action("start_consultation", "Start Consultation"),
      secondary: [action("add_observation", "Add Observation", "records")],
      readOnly: false,
      policyState: "active_visit",
    };
  }

  if (classification.normalizedLifecycle === "in_consultation") {
    return {
      role: "doctor",
      primary: action("doctor_complete_visit", "Done"),
      secondary: [
        action("add_observation", "Add Observation", "records"),
        action("open_notes", "Notes", "notes"),
        action("view_edit_prescription", "View / Edit Rx", "prescription"),
      ],
      readOnly: false,
      policyState: "active_visit",
    };
  }

  if (classification.normalizedLifecycle === "treatment_completed") {
    return {
      role: "doctor",
      primary: action("view_edit_prescription", "View / Edit Rx", "prescription"),
      secondary: [],
      readOnly: false,
      policyState: "treatment_completed",
    };
  }

  if (classification.isCompleted) {
    return {
      role: "doctor",
      primary: action("review_visit", "Review Visit", "overview"),
      secondary: [],
      readOnly: true,
      policyState: "historical_completed",
    };
  }

  if (classification.isTerminal) {
    return {
      role: "doctor",
      primary: action("review_visit", "Review Visit", "overview"),
      secondary: [],
      readOnly: true,
      policyState: "terminal",
    };
  }

  if (
    classification.operationalState === "old_needs_resolution" ||
    classification.operationalState === "same_day_past_due"
  ) {
    return {
      role: "doctor",
      primary: action("review_visit", "Review Visit", "overview"),
      secondary: [],
      readOnly: true,
      policyState:
        classification.operationalState === "old_needs_resolution"
          ? "old_needs_resolution"
          : "same_day_past_due",
    };
  }

  return {
    role: "doctor",
    primary: action("review_appointment", "Review Appointment", "overview"),
    secondary: [],
    readOnly: false,
    policyState: "review",
  };
}

/**
 * Converts the classifier's lifecycle interpretation into a role-specific
 * footer intent. This is a pure presentation policy: it does not authorize,
 * mutate, navigate, or perform billing operations.
 */
export function getAppointmentFooterModel(
  classification: BookingClassification,
  role: AppointmentFooterRole,
  options: AppointmentFooterModelOptions = {},
): AppointmentFooterModel {
  return role === "clinic"
    ? clinicFooter(classification, options)
    : doctorFooter(classification);
}

export function getBookingLifecycleLabel(
  lifecycle: BookingNormalizedLifecycle,
): string {
  switch (lifecycle) {
    case "checked_in":
      return "Checked in";
    case "in_consultation":
      return "In consultation";
    case "treatment_completed":
      return "Treatment completed";
    case "completed":
      return "Completed";
    case "patient_left_early":
      return "Patient left early";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No-show";
    case "awaiting_doctor_approval":
      return "Awaiting doctor approval";
    case "confirmed_not_started":
      return "Confirmed";
    case "pending_not_started":
      return "Pending";
    default:
      return "Review";
  }
}