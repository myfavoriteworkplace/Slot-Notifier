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
  requestedPlan: z.enum(PAID_PLAN_KEYS).optional(),
  billingCycle: z.enum(BILLING_CYCLES).optional(),
  reviewReason: z.string().trim().max(500).optional().nullable()
    .transform((value) => value || null),
  transitionId: z.string().uuid().optional(),
}).strict();

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