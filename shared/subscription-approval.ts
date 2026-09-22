import { z } from "zod";
import {
  BILLING_CYCLES,
  PAID_PLAN_KEYS,
  PLAN_KEYS,
} from "./plan-catalog";

export const APPROVAL_CONTEXTS = [
  "registration",
  "upgrade_request",
  "renewal",
  "access_management",
] as const;
export type ApprovalContext = (typeof APPROVAL_CONTEXTS)[number];

export const APPROVAL_OUTCOMES = [
  "trial",
  "online_payment_required",
  "verified_offline_payment",
  "complimentary",
  "reject",
] as const;
export type ApprovalOutcome = (typeof APPROVAL_OUTCOMES)[number];

export const PAYMENT_BASES = [
  "none",
  "provider",
  "offline_verified",
  "complimentary",
] as const;
export type PaymentBasis = (typeof PAYMENT_BASES)[number];

export const RENEWAL_MODES = [
  "trial_expiry",
  "provider_auto",
  "manual",
  "admin_review",
] as const;
export type RenewalMode = (typeof RENEWAL_MODES)[number];

export const APPROVAL_ACTOR_TYPES = [
  "system",
  "superadmin",
  "clinic_admin",
  "provider",
  "migration",
] as const;
export type ApprovalActorType = (typeof APPROVAL_ACTOR_TYPES)[number];

const dateSchema = z.coerce.date();
const planSchema = z.enum(PLAN_KEYS);
const nullablePlanSchema = planSchema.nullable();
const billingCycleSchema = z.enum(BILLING_CYCLES);
const nullableBillingCycleSchema = billingCycleSchema.nullable();
const nonEmptyReferenceSchema = z.string().trim().min(1).max(160);

const actorSchema = z.object({
  type: z.enum(APPROVAL_ACTOR_TYPES),
  id: nonEmptyReferenceSchema.nullable(),
}).strict();

const onlinePaymentSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  paymentLinkMetadata: z.record(z.string(), z.unknown()),
}).strict();

const offlinePaymentSchema = z.object({
  amount: z.number().finite().positive(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  receivedAt: dateSchema,
  paymentMethod: z.enum(["bank_transfer", "cash", "upi", "card", "other"]),
  externalReference: nonEmptyReferenceSchema,
  evidenceReference: nonEmptyReferenceSchema,
  verifiedBy: nonEmptyReferenceSchema,
  verifiedAt: dateSchema,
}).strict();

const complimentaryAccessSchema = z.object({
  startsAt: dateSchema,
  endsAt: dateSchema,
  sponsorReference: nonEmptyReferenceSchema,
}).strict();

export const subscriptionApprovalInputSchema = z.object({
  clinicId: z.number().int().positive(),
  approvalContext: z.enum(APPROVAL_CONTEXTS),
  outcome: z.enum(APPROVAL_OUTCOMES),
  requestedPlan: nullablePlanSchema,
  approvedPlan: nullablePlanSchema,
  requestedBillingCycle: nullableBillingCycleSchema,
  approvedBillingCycle: nullableBillingCycleSchema,
  paymentBasis: z.enum(PAYMENT_BASES),
  renewalMode: z.enum(RENEWAL_MODES),
  reason: z.string().trim().max(500).nullable(),
  actor: actorSchema,
  transitionId: z.string().trim().min(1).max(120).regex(/^\S+$/),
  sourceRequestId: nonEmptyReferenceSchema.nullable(),
  effectiveAt: dateSchema,
  onlinePayment: onlinePaymentSchema.optional(),
  offlinePayment: offlinePaymentSchema.optional(),
  complimentaryAccess: complimentaryAccessSchema.optional(),
}).strict().superRefine((input, context) => {
  const addIssue = (message: string, path: string[] = ["outcome"]) => {
    context.addIssue({ code: z.ZodIssueCode.custom, message, path });
  };
  const reason = input.reason?.trim() ?? "";
  const approvedPlanIsPaid = input.approvedPlan !== null && PAID_PLAN_KEYS.includes(input.approvedPlan as typeof PAID_PLAN_KEYS[number]);
  const planWasOverridden =
    input.requestedPlan !== null &&
    input.approvedPlan !== null &&
    input.requestedPlan !== input.approvedPlan;
  const billingCycleWasOverridden =
    input.requestedBillingCycle !== null &&
    input.approvedBillingCycle !== null &&
    input.requestedBillingCycle !== input.approvedBillingCycle;

  if (planWasOverridden || billingCycleWasOverridden) {
    if (reason.length < 10) {
      addIssue("A reason of at least 10 characters is required for a plan or billing-cycle override", ["reason"]);
    }
  }

  if (approvedPlanIsPaid && input.approvedBillingCycle === null) {
    addIssue("Paid plans require a monthly or annual billing cycle", ["approvedBillingCycle"]);
  }
  if (input.approvedPlan === "trial" && input.approvedBillingCycle !== null) {
    addIssue("Trial approval cannot include a paid billing cycle", ["approvedBillingCycle"]);
  }

  const hasOnlinePayment = input.onlinePayment !== undefined;
  const hasOfflinePayment = input.offlinePayment !== undefined;
  const hasComplimentaryAccess = input.complimentaryAccess !== undefined;
  const expectedPaymentBasis: Record<ApprovalOutcome, PaymentBasis> = {
    trial: "none",
    online_payment_required: "provider",
    verified_offline_payment: "offline_verified",
    complimentary: "complimentary",
    reject: "none",
  };

  if (input.paymentBasis !== expectedPaymentBasis[input.outcome]) {
    addIssue(`Payment basis must be ${expectedPaymentBasis[input.outcome]} for this approval outcome`, ["paymentBasis"]);
  }

  if (input.outcome === "trial") {
    if (input.approvedPlan !== "trial") {
      addIssue("Trial approval must assign the Trial plan", ["approvedPlan"]);
    }
    if (hasOnlinePayment || hasOfflinePayment || hasComplimentaryAccess) {
      addIssue("Trial approval cannot include payment or complimentary-access evidence");
    }
  }

  if (input.outcome === "online_payment_required") {
    if (!approvedPlanIsPaid) {
      addIssue("Online payment approval requires a paid plan", ["approvedPlan"]);
    }
    if (!hasOnlinePayment) {
      addIssue("Online payment approval requires provider and payment-link metadata", ["onlinePayment"]);
    }
    if (hasOfflinePayment || hasComplimentaryAccess) {
      addIssue("Online payment approval cannot include offline or complimentary-access evidence");
    }
  }

  if (input.outcome === "verified_offline_payment") {
    if (!approvedPlanIsPaid) {
      addIssue("Verified offline payment requires a paid plan", ["approvedPlan"]);
    }
    if (!hasOfflinePayment) {
      addIssue("Verified offline payment requires complete payment evidence", ["offlinePayment"]);
    }
    if (hasOnlinePayment || hasComplimentaryAccess) {
      addIssue("Verified offline payment cannot include online or complimentary-access evidence");
    }
    if (input.offlinePayment) {
      if (input.offlinePayment.verifiedAt < input.offlinePayment.receivedAt) {
        addIssue("Offline payment verification cannot predate payment receipt", ["offlinePayment", "verifiedAt"]);
      }
      if (/^sub[_-]/i.test(input.offlinePayment.evidenceReference)) {
        addIssue("A provider subscription ID is not offline payment evidence", ["offlinePayment", "evidenceReference"]);
      }
    }
  }

  if (input.outcome === "complimentary") {
    if (!approvedPlanIsPaid) {
      addIssue("Complimentary access requires a paid plan", ["approvedPlan"]);
    }
    if (reason.length === 0) {
      addIssue("Complimentary access requires a reason", ["reason"]);
    }
    if (!hasComplimentaryAccess) {
      addIssue("Complimentary access requires a start date, end date, and sponsor reference", ["complimentaryAccess"]);
    }
    if (hasOnlinePayment || hasOfflinePayment) {
      addIssue("Complimentary access cannot include payment evidence");
    }
    if (input.complimentaryAccess && input.complimentaryAccess.endsAt <= input.complimentaryAccess.startsAt) {
      addIssue("The complimentary-access end date must be after the start date", ["complimentaryAccess", "endsAt"]);
    }
  }

  if (input.outcome === "reject") {
    if (input.approvedPlan !== null || input.approvedBillingCycle !== null) {
      addIssue("Rejected approval cannot assign a plan or billing cycle");
    }
    if (reason.length === 0) {
      addIssue("Rejection requires a reason", ["reason"]);
    }
    if (hasOnlinePayment || hasOfflinePayment || hasComplimentaryAccess) {
      addIssue("Rejection cannot include payment or complimentary-access evidence");
    }
  }
});

export type SubscriptionApprovalInput = z.infer<typeof subscriptionApprovalInputSchema>;

/**
 * Returns a stable first validation message for route adapters that need a
 * simple error string. Database writes and transition-id idempotency checks
 * remain outside this pure boundary.
 */
export function validateSubscriptionApprovalInput(input: unknown): string | null {
  const parsed = subscriptionApprovalInputSchema.safeParse(input);
  return parsed.success ? null : parsed.error.issues[0]?.message ?? "Invalid subscription approval";
}