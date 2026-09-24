import {
  BILLING_CYCLES,
  isBillingCycle,
  PLAN_KEYS,
  resolvePlanPolicy,
  type BillingCycle,
  type PlanKey,
} from "./plan-catalog";
import { z } from "zod";

export const registrationApprovalRequestSchema = z.object({
  outcome: z.enum([
    "trial",
    "online_payment_required",
    "verified_offline_payment",
    "complimentary",
    "reject",
  ]),
  approvedPlan: z.enum(PLAN_KEYS).nullable(),
  billingCycle: z.enum(BILLING_CYCLES).nullable(),
  trialStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  trialEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  trialGraceDays: z.coerce.number().int().min(0).max(365).optional(),
  offlinePayment: z.object({
    amount: z.coerce.number().finite().positive(),
    receivedAt: z.string().datetime(),
    paymentMethod: z.enum(["bank_transfer", "cash", "upi", "card", "other"]),
    externalReference: z.string().trim().min(1).max(160),
    evidenceReference: z.string().trim().min(1).max(160),
  }).strict().optional(),
  complimentaryAccess: z.object({
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sponsorReference: z.string().trim().min(1).max(160).optional(),
  }).strict().optional(),
  reason: z.string().trim().max(500).optional(),
  transitionId: z.string().uuid().optional(),
}).strict().superRefine((input, context) => {
  const addIssue = (path: string[], message: string) => {
    context.addIssue({ code: z.ZodIssueCode.custom, path, message });
  };
  const hasTrialDates =
    input.trialStartDate !== undefined ||
    input.trialEndDate !== undefined ||
    input.trialGraceDays !== undefined;
  const isPaidOutcome =
    input.outcome === "online_payment_required" ||
    input.outcome === "verified_offline_payment" ||
    input.outcome === "complimentary";

  if (input.outcome === "trial") {
    if (input.approvedPlan !== "trial") addIssue(["approvedPlan"], "Trial approval must assign the Trial plan");
    if (input.billingCycle !== null) addIssue(["billingCycle"], "Trial approval cannot include a paid billing cycle");
    if (input.offlinePayment || input.complimentaryAccess) {
      addIssue(["outcome"], "Trial approval cannot include payment or complimentary-access details");
    }
  } else if (hasTrialDates) {
    addIssue(["trialStartDate"], "Trial dates can only be provided for a Trial outcome");
  }

  if (isPaidOutcome && (input.approvedPlan === null || input.approvedPlan === "trial")) {
    addIssue(["approvedPlan"], "Paid outcomes require a paid plan");
  }
  if (isPaidOutcome && input.billingCycle === null) {
    addIssue(["billingCycle"], "Paid outcomes require a billing cycle");
  }

  if (input.outcome === "verified_offline_payment" && !input.offlinePayment) {
    addIssue(["offlinePayment"], "Verified offline payment details are required");
  } else if (input.outcome !== "verified_offline_payment" && input.offlinePayment) {
    addIssue(["offlinePayment"], "Offline payment details are only valid for verified offline payment");
  }

  if (input.outcome === "complimentary" && !input.complimentaryAccess) {
    addIssue(["complimentaryAccess"], "Complimentary access dates are required");
  } else if (input.outcome !== "complimentary" && input.complimentaryAccess) {
    addIssue(["complimentaryAccess"], "Complimentary access details are only valid for complimentary approval");
  }

  if (input.outcome === "reject") {
    if (input.approvedPlan !== null || input.billingCycle !== null) {
      addIssue(["approvedPlan"], "Rejection cannot assign a plan or billing cycle");
    }
    if (input.reason?.trim().length === 0 || input.reason === undefined) {
      addIssue(["reason"], "Rejection requires a reason");
    }
  }
});

export type RegistrationApprovalRequest = z.infer<typeof registrationApprovalRequestSchema>;

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