/**
 * Development-stage shared plan policy catalog.
 *
 * This is a reporting and presentation contract only. It does not enforce
 * limits, change clinic rows, or create a Trial lifecycle. Subscription state
 * remains separate in shared/subscription-status.ts.
 */

export const PLAN_KEYS = ["trial", "starter", "growth", "pro"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const PAID_PLAN_KEYS = ["starter", "growth", "pro"] as const;
export type PaidPlanKey = (typeof PAID_PLAN_KEYS)[number];

export const BILLING_CYCLES = ["monthly", "annual"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const PLAN_POLICY_VERSION = "2026-09-11.v1";
export const PLAN_POLICY_EFFECTIVE_DATE = "2026-09-11";

export type PlanPolicyStatus = "draft" | "published";
export type PlanResolutionKey = PlanKey | "unknown";

export type LimitPeriod = "trial_lifetime" | "calendar_month" | "fair_use";

export type NumericPlanLimit = {
  value: number | null;
  period: LimitPeriod;
  fairUse: boolean;
};

export type MessagingPlanLimit = {
  sms: number;
  whatsapp: number;
  email: number;
  period: "trial_lifetime" | "calendar_month";
};

export type PlanFeatures = {
  analytics: "basic_snapshot" | "basic" | "advanced" | "full";
  export: "one_export" | "standard" | "advanced_scheduled" | "full_priority";
  inventory: "limited_volume" | "basic" | "advanced" | "full";
  pharmacy: "limited_volume" | "basic" | "advanced" | "full";
  website: "trial_branding" | "basic" | "sections_theme" | "custom_premium";
  support: "help_center_onboarding" | "standard_email" | "priority_email" | "priority_email_phone";
  publicProfile: "trial_branding" | "standard" | "premium_visibility";
  verifiedBadge: boolean;
  featuredDealPlacement: boolean;
  essentialWhatsapp: boolean;
  routineWhatsapp: boolean;
  bulkWhatsapp: boolean;
  promotionalWhatsapp: boolean;
  advancedWhatsapp: boolean;
};

export type PlanPolicy = {
  key: PlanKey;
  displayName: string;
  summary: string;
  kind: "trial" | "paid";
  recommended: boolean;
  pricing: {
    monthly: number | null;
    annual: number | null;
  };
  trial: {
    durationDays: number | null;
    graceDays: number | null;
  };
  limits: {
    bookings: NumericPlanLimit;
    activeDoctors: NumericPlanLimit;
    smileDeals: NumericPlanLimit;
    storageBytes: number;
    messaging: MessagingPlanLimit;
  };
  features: PlanFeatures;
};

export type PlanPolicyDocument = {
  version: string;
  effectiveDate: string;
  status: PlanPolicyStatus;
  plans: Record<PlanKey, PlanPolicy>;
  explicitDeferrals: {
    transactionFees: "deferred";
    inventoryItemCounts: "deferred";
    pharmacyItemCounts: "deferred";
  };
};

export type PlanResolution = {
  rawPlan: string | null;
  planKey: PlanResolutionKey;
  policy: PlanPolicy | null;
  known: boolean;
};

const MEGABYTE = 1024 * 1024;

const numericLimit = (
  value: number | null,
  period: LimitPeriod,
  fairUse = false,
): NumericPlanLimit => ({ value, period, fairUse });

const commonCoreFeatures = {
  essentialWhatsapp: true,
  promotionalWhatsapp: false,
} as const;

export const PUBLISHED_PLAN_POLICY: PlanPolicyDocument = {
  version: PLAN_POLICY_VERSION,
  effectiveDate: PLAN_POLICY_EFFECTIVE_DATE,
  status: "published",
  explicitDeferrals: {
    transactionFees: "deferred",
    inventoryItemCounts: "deferred",
    pharmacyItemCounts: "deferred",
  },
  plans: {
    trial: {
      key: "trial",
      displayName: "Trial",
      summary: "A 14-day no-card evaluation of the core clinic workflow.",
      kind: "trial",
      recommended: false,
      pricing: { monthly: null, annual: null },
      trial: { durationDays: 14, graceDays: 7 },
      limits: {
        bookings: numericLimit(10, "trial_lifetime"),
        activeDoctors: numericLimit(1, "trial_lifetime"),
        smileDeals: numericLimit(1, "trial_lifetime"),
        storageBytes: 50 * MEGABYTE,
        messaging: { sms: 25, whatsapp: 25, email: 50, period: "trial_lifetime" },
      },
      features: {
        ...commonCoreFeatures,
        analytics: "basic_snapshot",
        export: "one_export",
        inventory: "limited_volume",
        pharmacy: "limited_volume",
        website: "trial_branding",
        support: "help_center_onboarding",
        publicProfile: "trial_branding",
        verifiedBadge: false,
        featuredDealPlacement: false,
        routineWhatsapp: false,
        bulkWhatsapp: false,
        promotionalWhatsapp: false,
        advancedWhatsapp: false,
      },
    },
    starter: {
      key: "starter",
      displayName: "Starter",
      summary: "A complete basic workflow for a small or single-doctor clinic.",
      kind: "paid",
      recommended: false,
      pricing: { monthly: 999, annual: 9990 },
      trial: { durationDays: null, graceDays: null },
      limits: {
        bookings: numericLimit(30, "calendar_month"),
        activeDoctors: numericLimit(1, "calendar_month"),
        smileDeals: numericLimit(1, "calendar_month"),
        storageBytes: 100 * MEGABYTE,
        messaging: { sms: 100, whatsapp: 100, email: 300, period: "calendar_month" },
      },
      features: {
        ...commonCoreFeatures,
        analytics: "basic",
        export: "standard",
        inventory: "basic",
        pharmacy: "basic",
        website: "basic",
        support: "standard_email",
        publicProfile: "standard",
        verifiedBadge: false,
        featuredDealPlacement: false,
        routineWhatsapp: false,
        bulkWhatsapp: false,
        promotionalWhatsapp: false,
        advancedWhatsapp: false,
      },
    },
    growth: {
      key: "growth",
      displayName: "Growth",
      summary: "The recommended operating plan for an actively growing clinic.",
      kind: "paid",
      recommended: true,
      pricing: { monthly: 1599, annual: 15990 },
      trial: { durationDays: null, graceDays: null },
      limits: {
        bookings: numericLimit(150, "calendar_month"),
        activeDoctors: numericLimit(3, "calendar_month"),
        smileDeals: numericLimit(3, "calendar_month"),
        storageBytes: 500 * MEGABYTE,
        messaging: { sms: 500, whatsapp: 500, email: 1500, period: "calendar_month" },
      },
      features: {
        ...commonCoreFeatures,
        analytics: "advanced",
        export: "advanced_scheduled",
        inventory: "advanced",
        pharmacy: "advanced",
        website: "sections_theme",
        support: "priority_email",
        publicProfile: "standard",
        verifiedBadge: false,
        featuredDealPlacement: false,
        routineWhatsapp: true,
        bulkWhatsapp: true,
        promotionalWhatsapp: true,
        advancedWhatsapp: true,
      },
    },
    pro: {
      key: "pro",
      displayName: "Pro",
      summary: "A high-volume plan with premium visibility and fair-use monitoring.",
      kind: "paid",
      recommended: false,
      pricing: { monthly: 2999, annual: 29990 },
      trial: { durationDays: null, graceDays: null },
      limits: {
        bookings: numericLimit(null, "fair_use", true),
        activeDoctors: numericLimit(null, "fair_use", true),
        smileDeals: numericLimit(null, "fair_use", true),
        storageBytes: 2047 * MEGABYTE,
        messaging: { sms: 2000, whatsapp: 2000, email: 6000, period: "calendar_month" },
      },
      features: {
        ...commonCoreFeatures,
        analytics: "full",
        export: "full_priority",
        inventory: "full",
        pharmacy: "full",
        website: "custom_premium",
        support: "priority_email_phone",
        publicProfile: "premium_visibility",
        verifiedBadge: true,
        featuredDealPlacement: true,
        routineWhatsapp: true,
        bulkWhatsapp: true,
        promotionalWhatsapp: true,
        advancedWhatsapp: true,
      },
    },
  },
};

export function isPlanKey(value: string | null | undefined): value is PlanKey {
  return !!value && (PLAN_KEYS as readonly string[]).includes(value);
}

export function isPaidPlanKey(value: string | null | undefined): value is PaidPlanKey {
  return !!value && (PAID_PLAN_KEYS as readonly string[]).includes(value);
}

/**
 * Normalizes a plan at the application boundary without silently converting
 * unknown values to Starter. Subscription states such as "unpaid" belong to
 * the subscription-state model, not the plan catalog.
 */
export function resolvePlanPolicy(
  rawPlan: string | null | undefined,
  catalog: PlanPolicyDocument = PUBLISHED_PLAN_POLICY,
): PlanResolution {
  const raw = rawPlan?.trim() || null;
  const normalized = raw?.toLowerCase() || null;
  if (normalized && isPlanKey(normalized)) {
    return {
      rawPlan: raw,
      planKey: normalized,
      policy: catalog.plans[normalized],
      known: true,
    };
  }
  return { rawPlan: raw, planKey: "unknown", policy: null, known: false };
}

export function calculateAnnualSavings(policy: PlanPolicy): number | null {
  if (policy.pricing.monthly === null || policy.pricing.annual === null) return null;
  return policy.pricing.monthly * 12 - policy.pricing.annual;
}

export function getAnnualSavings(plan: PlanKey | PlanPolicy): number | null {
  const policy = typeof plan === "string" ? PUBLISHED_PLAN_POLICY.plans[plan] : plan;
  return calculateAnnualSavings(policy);
}