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

export function isClinicUpgradeEligible(
  clinic: TrialLifecycleClinic,
  now: Date,
): boolean {
  return isTrialConversionEligible(clinic, now);
}