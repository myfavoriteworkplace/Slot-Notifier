import {
  isBillingCycle,
  resolvePlanPolicy,
  type BillingCycle,
  type PlanKey,
} from "./plan-catalog";

export type InitialApprovalSelection = {
  requestedPlan: PlanKey;
  approvedPlan: PlanKey;
  isOverride: boolean;
};

export type InitialApprovalValidationInput = {
  requestedPlan: PlanKey;
  approvedPlan: PlanKey;
  billingCycle?: BillingCycle | null;
  trialStartDate?: string;
  trialEndDate?: string;
  trialGraceDays?: number;
  reason?: string;
};

/**
 * Resolves the effective plan for a pending registration. Unknown or legacy
 * requested values fail closed to Trial instead of becoming an active plan.
 */
export function resolveInitialApprovalSelection(
  requestedPlan: unknown,
  approvedPlan?: PlanKey,
): InitialApprovalSelection {
  const resolution = resolvePlanPolicy(
    typeof requestedPlan === "string" ? requestedPlan : null,
  );
  const resolvedRequestedPlan =
    resolution.known && resolution.planKey !== "unknown"
      ? resolution.planKey
      : "trial";
  const resolvedApprovedPlan = approvedPlan ?? resolvedRequestedPlan;

  return {
    requestedPlan: resolvedRequestedPlan,
    approvedPlan: resolvedApprovedPlan,
    isOverride: resolvedApprovedPlan !== resolvedRequestedPlan,
  };
}

/**
 * Validates the cross-field rules for initial registration approval. Route
 * authentication, database state, and calendar-date validation remain in the
 * server route.
 */
export function validateInitialApprovalSelection(
  input: InitialApprovalValidationInput,
): string | null {
  const reason = input.reason?.trim() ?? "";
  const isOverride = input.approvedPlan !== input.requestedPlan;
  if (isOverride && reason.length < 10) {
    return "A reason of at least 10 characters is required when overriding the requested plan";
  }

  const hasAnyTrialScheduleField =
    input.trialStartDate !== undefined ||
    input.trialEndDate !== undefined ||
    input.trialGraceDays !== undefined;

  if (input.approvedPlan !== "trial" && hasAnyTrialScheduleField) {
    return "Trial dates can only be provided when Trial is approved";
  }

  if (input.approvedPlan === "trial" && input.billingCycle) {
    return "Billing cycle can only be provided for a paid plan";
  }

  if (input.approvedPlan !== "trial" && !isBillingCycle(input.billingCycle)) {
    return "A monthly or annual billing cycle is required for a paid approval";
  }

  if (input.approvedPlan === "trial" && hasAnyTrialScheduleField && (
    !input.trialStartDate ||
    !input.trialEndDate ||
    input.trialGraceDays === undefined
  )) {
    return "Custom Trial approval requires a start date, end date, and grace period";
  }

  return null;
}