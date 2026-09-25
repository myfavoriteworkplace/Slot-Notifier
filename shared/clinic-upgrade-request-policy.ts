import { z } from "zod";
import { PAID_PLAN_KEYS, BILLING_CYCLES } from "./plan-catalog";
import { isTrialConversionEligible, type TrialLifecycleClinic } from "./trial-lifecycle";

export const clinicUpgradeRequestBodySchema = z.object({
  requestedPlan: z.enum(PAID_PLAN_KEYS),
  billingCycle: z.enum(BILLING_CYCLES),
  clinicReason: z.string().trim().max(500).optional().nullable()
    .transform((value) => value || null),
}).strict();

export type ClinicUpgradeRequestBody = z.infer<typeof clinicUpgradeRequestBodySchema>;

export const clinicUpgradeRequestListStatusSchema = z.enum(["pending", "all"]);

export const clinicUpgradeRequestApprovalBodySchema = z.object({
  approvalOutcome: z.enum(["online_payment_required", "verified_offline_payment", "complimentary"]).optional().default("online_payment_required"),
  requestedPlan: z.enum(PAID_PLAN_KEYS).optional(),
  billingCycle: z.enum(BILLING_CYCLES).optional(),
  reviewReason: z.string().trim().max(500).optional().nullable()
    .transform((value) => value || null),
  transitionId: z.string().uuid().optional(),
  offlinePayment: z.object({
    amount: z.number().int().positive(),
    receivedAt: z.string().datetime(),
    paymentMethod: z.enum(["bank_transfer", "cash", "upi", "card", "other"]),
    externalReference: z.string().trim().min(1).max(160),
    evidenceReference: z.string().trim().min(1).max(160),
  }).strict().optional(),
  complimentaryAccess: z.object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    sponsorReference: z.string().trim().min(1).max(160).optional(),
  }).strict().optional(),
}).strict().superRefine((input, context) => {
  if (input.approvalOutcome === "verified_offline_payment" && !input.offlinePayment) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Verified offline approval requires payment evidence",
      path: ["offlinePayment"],
    });
  }
  if (input.approvalOutcome === "complimentary" && !input.complimentaryAccess) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Complimentary approval requires start and end dates",
      path: ["complimentaryAccess"],
    });
  }
  if (input.approvalOutcome !== "verified_offline_payment" && input.offlinePayment) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Offline payment evidence is only valid for verified offline approval",
      path: ["offlinePayment"],
    });
  }
  if (input.approvalOutcome !== "complimentary" && input.complimentaryAccess) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Complimentary access details are only valid for complimentary approval",
      path: ["complimentaryAccess"],
    });
  }
  if (input.complimentaryAccess) {
    const startsAt = new Date(input.complimentaryAccess.startsAt);
    const endsAt = new Date(input.complimentaryAccess.endsAt);
    if (endsAt <= startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Complimentary access must end after it starts",
        path: ["complimentaryAccess", "endsAt"],
      });
    }
  }
});

export const clinicUpgradeRequestRejectionBodySchema = z.object({
  reviewReason: z.string().trim().min(1).max(500),
  transitionId: z.string().uuid().optional(),
}).strict();

export type ClinicUpgradeRequestApprovalBody = z.infer<typeof clinicUpgradeRequestApprovalBodySchema>;

export function validateClinicUpgradeRequestApproval(
  input: {
    approvedPlan: string;
    approvedBillingCycle: string;
    requestedPlan: string;
    requestedBillingCycle: string;
    reviewReason?: string | null;
  },
): string | null {
  const planChanged = input.approvedPlan !== input.requestedPlan;
  const billingCycleChanged = input.approvedBillingCycle !== input.requestedBillingCycle;
  const reason = input.reviewReason?.trim() ?? "";

  if ((planChanged || billingCycleChanged) && reason.length < 10) {
    return "A reason of at least 10 characters is required when changing the requested plan or billing cycle";
  }

  return null;
}

export function isClinicUpgradeEligible(
  clinic: TrialLifecycleClinic,
  now: Date,
): boolean {
  return isTrialConversionEligible(clinic, now);
}