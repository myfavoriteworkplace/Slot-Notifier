import {
  PUBLISHED_PLAN_POLICY,
  resolvePlanPolicy,
  type PlanFeatures,
  type PlanKey,
  type PlanPolicyDocument,
} from "./plan-catalog";
import { getSubscriptionStatusInfo, type SubscriptionStatusInfo } from "./subscription-status";

export const ENTITLEMENT_CAPABILITIES = [
  "bookings",
  "active_doctors",
  "smile_deals",
  "storage",
  "messaging_sms",
  "messaging_whatsapp",
  "messaging_email",
  "analytics",
  "export",
  "inventory",
  "pharmacy",
  "website",
  "support",
  "public_profile",
  "verified_badge",
  "featured_deal_placement",
  "essential_whatsapp",
  "routine_whatsapp",
  "bulk_whatsapp",
  "promotional_whatsapp",
  "advanced_whatsapp",
] as const;

export type EntitlementCapability = (typeof ENTITLEMENT_CAPABILITIES)[number];
export type EntitlementSource = "plan" | "sponsored_access" | "exception" | "unknown";
export type EntitlementReasonCode =
  | "POLICY_LIMIT"
  | "FAIR_USE_REVIEW"
  | "FEATURE_INCLUDED"
  | "USAGE_UNAVAILABLE"
  | "EXCEPTION_OVERRIDE"
  | "UNKNOWN_PLAN"
  | "SUBSCRIPTION_STATE_REQUIRES_RECONCILIATION";

export type EntitlementUsageValue = {
  value: number | null;
  available: boolean;
  measuredAt: string | null;
  period: string | null;
  timezone: string | null;
};

export type EffectiveEntitlementUsage = {
  bookings: { allTime: number | null; currentLocalMonth: number | null };
  activeDoctors: number | null;
  liveSmileDeals: number | null;
  storageBytes: number | null;
  messages: {
    allTime: { sms: number | null; whatsapp: number | null; email: number | null };
    currentLocalMonth: { sms: number | null; whatsapp: number | null; email: number | null };
  };
  measuredAt?: string | null;
  timezone?: string | null;
};

export type EffectiveEntitlementGrant = {
  plan: string | null;
  policyVersion?: string | null;
  startsAt: Date;
  endsAt: Date;
  revokedAt?: Date | null;
};

export type EffectiveEntitlementException = {
  entitlementKey: string;
  overrideValue: unknown;
  policyVersion?: string | null;
  startsAt: Date;
  endsAt: Date;
  revokedAt?: Date | null;
};

export type EffectiveEntitlementInput = {
  clinicId: number;
  rawPlan: string | null | undefined;
  rawSubscriptionStatus: string | null | undefined;
  timezone: string;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  trialGraceEndsAt?: Date | null;
  trialOrigin?: string | null;
  previousPaidPlan?: string | null;
  paidAccessExpiresAt?: Date | null;
  usage?: EffectiveEntitlementUsage;
  activeGrants?: EffectiveEntitlementGrant[];
  activeExceptions?: EffectiveEntitlementException[];
  measuredAt?: Date;
  now?: Date;
  catalog?: PlanPolicyDocument;
};

export type EffectiveEntitlementItem = {
  capability: EntitlementCapability;
  enabled: boolean | null;
  value: number | string | boolean | null;
  limit: number | null;
  fairUse: boolean;
  source: EntitlementSource;
  usage: EntitlementUsageValue | null;
  remaining: number | null;
  overLimit: boolean | null;
  reasonCode: EntitlementReasonCode;
};

export type EffectiveEntitlementReport = {
  mode: "reporting_only";
  clinicId: number;
  plan: {
    requested: string | null;
    effective: PlanKey | "unknown";
    displayName: string | null;
    policyVersion: string | null;
    source: EntitlementSource;
  };
  subscription: SubscriptionStatusInfo;
  access: {
    state: "trial" | "trial_grace" | "active_paid" | "sponsored" | "attention" | "unknown";
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    trialGraceEndsAt: string | null;
    trialOrigin: string | null;
    previousPaidPlan: string | null;
    paidAccessExpiresAt: string | null;
    reasonCode: EntitlementReasonCode;
  };
  nextStep: {
    code: "CONTINUE_TRIAL" | "REVIEW_RECOVERY_TRIAL" | "WAIT_FOR_PAYMENT" | "ACTIVE_PAID" | "REVIEW_SPONSORED_ACCESS" | "VIEW_PLANS" | "CONTACT_SUPPORT";
    label: string;
    description: string;
    action: "none" | "view_plans" | "contact_support";
  };
  grants: { active: number; plan: string | null; endsAt: string | null };
  exceptions: { active: number; keys: string[] };
  capabilities: EffectiveEntitlementItem[];
  measuredAt: string | null;
  timezone: string;
};

type NumericCapability = {
  capability: EntitlementCapability;
  limit: number | null;
  fairUse: boolean;
  usage: number | null;
  period: string;
};

const numericCapabilityMap: Record<string, NumericCapability["capability"]> = {
  bookings: "bookings",
  activeDoctors: "active_doctors",
  liveSmileDeals: "smile_deals",
  storageBytes: "storage",
  "messages.sms": "messaging_sms",
  "messages.whatsapp": "messaging_whatsapp",
  "messages.email": "messaging_email",
};

const featureCapabilityMap: Record<keyof PlanFeatures, EntitlementCapability> = {
  analytics: "analytics",
  export: "export",
  inventory: "inventory",
  pharmacy: "pharmacy",
  website: "website",
  support: "support",
  publicProfile: "public_profile",
  verifiedBadge: "verified_badge",
  featuredDealPlacement: "featured_deal_placement",
  essentialWhatsapp: "essential_whatsapp",
  routineWhatsapp: "routine_whatsapp",
  bulkWhatsapp: "bulk_whatsapp",
  promotionalWhatsapp: "promotional_whatsapp",
  advancedWhatsapp: "advanced_whatsapp",
};

function usageValue(
  value: number | null,
  period: string,
  measuredAt: string | null,
  timezone: string,
): EntitlementUsageValue {
  return {
    value,
    available: value !== null,
    measuredAt,
    period,
    timezone,
  };
}

function asPrimitive(value: unknown): number | string | boolean | null {
  return typeof value === "number" || typeof value === "string" || typeof value === "boolean"
    ? value
    : null;
}

function exceptionValue(
  exceptions: EffectiveEntitlementException[],
  capability: EntitlementCapability,
): { value: number | string | boolean | null; source: EntitlementSource } | null {
  const match = exceptions.find((exception) => {
    const mapped = numericCapabilityMap[exception.entitlementKey] || featureCapabilityMap[exception.entitlementKey as keyof PlanFeatures];
    return mapped === capability;
  });
  if (!match) return null;
  return { value: asPrimitive(match.overrideValue), source: "exception" };
}

export function resolveEffectiveEntitlements(input: EffectiveEntitlementInput): EffectiveEntitlementReport {
  const now = input.now ?? new Date();
  const catalog = input.catalog ?? PUBLISHED_PLAN_POLICY;
  const subscription = getSubscriptionStatusInfo(input.rawSubscriptionStatus);
  const grants = (input.activeGrants ?? []).filter((grant) =>
    grant.startsAt <= now && grant.endsAt > now && !grant.revokedAt,
  );
  const exceptions = (input.activeExceptions ?? []).filter((exception) =>
    exception.startsAt <= now && exception.endsAt > now && !exception.revokedAt,
  );
  const sponsoredGrant = [...grants]
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .find((grant) => resolvePlanPolicy(grant.plan, catalog).known);
  const requestedPlan = input.rawPlan?.trim() || null;
  const baseResolution = resolvePlanPolicy(input.rawPlan, catalog);
  const grantResolution = sponsoredGrant ? resolvePlanPolicy(sponsoredGrant.plan, catalog) : null;
  const effectiveResolution = grantResolution?.known ? grantResolution : baseResolution;
  const policy = effectiveResolution.policy;
  const source: EntitlementSource = grantResolution?.known ? "sponsored_access" : policy ? "plan" : "unknown";
  const usage = input.usage;
  const measuredAt = input.measuredAt?.toISOString() ?? usage?.measuredAt ?? null;

  const usageFor = (capability: NumericCapability["capability"]): EntitlementUsageValue | null => {
    if (!usage) return null;
    const period = capability === "bookings" && policy?.kind === "trial" ? "trial_lifetime" :
      capability === "messaging_sms" || capability === "messaging_whatsapp" || capability === "messaging_email"
        ? policy?.limits.messaging.period ?? "calendar_month"
        : capability === "bookings" ? "calendar_month" : "ongoing";
    const value =
      capability === "bookings"
        ? policy?.kind === "trial" ? usage.bookings.allTime : usage.bookings.currentLocalMonth
        : capability === "active_doctors" ? usage.activeDoctors
        : capability === "smile_deals" ? usage.liveSmileDeals
        : capability === "storage" ? usage.storageBytes
        : capability === "messaging_sms" ? policy?.kind === "trial" ? usage.messages.allTime.sms : usage.messages.currentLocalMonth.sms
        : capability === "messaging_whatsapp" ? policy?.kind === "trial" ? usage.messages.allTime.whatsapp : usage.messages.currentLocalMonth.whatsapp
        : policy?.kind === "trial" ? usage.messages.allTime.email : usage.messages.currentLocalMonth.email;
    return usageValue(value ?? null, period, measuredAt, input.timezone);
  };

  const numericItems: NumericCapability[] = policy ? [
    { capability: "bookings", limit: policy.limits.bookings.value, fairUse: policy.limits.bookings.fairUse, usage: usage?.bookings[policy.kind === "trial" ? "allTime" : "currentLocalMonth"] ?? null, period: policy.limits.bookings.period },
    { capability: "active_doctors", limit: policy.limits.activeDoctors.value, fairUse: policy.limits.activeDoctors.fairUse, usage: usage?.activeDoctors ?? null, period: policy.limits.activeDoctors.period },
    { capability: "smile_deals", limit: policy.limits.smileDeals.value, fairUse: policy.limits.smileDeals.fairUse, usage: usage?.liveSmileDeals ?? null, period: policy.limits.smileDeals.period },
    { capability: "storage", limit: policy.limits.storageBytes, fairUse: false, usage: usage?.storageBytes ?? null, period: "ongoing" },
    { capability: "messaging_sms", limit: policy.limits.messaging.sms, fairUse: false, usage: usage?.messages[policy.kind === "trial" ? "allTime" : "currentLocalMonth"].sms ?? null, period: policy.limits.messaging.period },
    { capability: "messaging_whatsapp", limit: policy.limits.messaging.whatsapp, fairUse: false, usage: usage?.messages[policy.kind === "trial" ? "allTime" : "currentLocalMonth"].whatsapp ?? null, period: policy.limits.messaging.period },
    { capability: "messaging_email", limit: policy.limits.messaging.email, fairUse: false, usage: usage?.messages[policy.kind === "trial" ? "allTime" : "currentLocalMonth"].email ?? null, period: policy.limits.messaging.period },
  ] : [];

  const capabilities: EffectiveEntitlementItem[] = numericItems.map((item) => {
    const override = exceptionValue(exceptions, item.capability);
    const limit = override?.value !== null && typeof override?.value === "number" ? override.value : item.limit;
    const itemSource = override ? "exception" : source;
    const usageSnapshot = usageFor(item.capability);
    const overLimit = usageSnapshot?.available && limit !== null ? item.usage! > limit : null;
    return {
      capability: item.capability,
      enabled: policy ? true : null,
      value: limit,
      limit,
      fairUse: item.fairUse,
      source: itemSource,
      usage: usageSnapshot,
      remaining: usageSnapshot?.available && limit !== null ? Math.max(0, limit - item.usage!) : null,
      overLimit,
      reasonCode: override
        ? "EXCEPTION_OVERRIDE"
        : !usageSnapshot?.available
          ? "USAGE_UNAVAILABLE"
          : item.fairUse
            ? "FAIR_USE_REVIEW"
            : policy
              ? "POLICY_LIMIT"
              : "UNKNOWN_PLAN",
    };
  });

  if (policy) {
    for (const [featureKey, capability] of Object.entries(featureCapabilityMap) as [keyof PlanFeatures, EntitlementCapability][]) {
      const override = exceptionValue(exceptions, capability);
      const value = override ? override.value : policy.features[featureKey];
      capabilities.push({
        capability,
        enabled: typeof value === "boolean" ? value : true,
        value,
        limit: null,
        fairUse: false,
        source: override ? "exception" : source,
        usage: null,
        remaining: null,
        overLimit: null,
        reasonCode: override ? "EXCEPTION_OVERRIDE" : "FEATURE_INCLUDED",
      });
    }
  } else {
    for (const capability of ENTITLEMENT_CAPABILITIES) {
      if (!capabilities.some((item) => item.capability === capability)) {
        capabilities.push({
          capability,
          enabled: null,
          value: null,
          limit: null,
          fairUse: false,
          source: "unknown",
          usage: null,
          remaining: null,
          overLimit: null,
          reasonCode: "UNKNOWN_PLAN",
        });
      }
    }
  }

  const trialIsActive =
    effectiveResolution.planKey === "trial" &&
    !!input.trialEndsAt &&
    input.trialEndsAt > now;
  const trialIsInGrace =
    effectiveResolution.planKey === "trial" &&
    !!input.trialEndsAt &&
    input.trialEndsAt <= now &&
    !!input.trialGraceEndsAt &&
    input.trialGraceEndsAt > now;
  const accessState: EffectiveEntitlementReport["access"]["state"] =
    trialIsActive ? "trial" :
    trialIsInGrace ? "trial_grace" :
    sponsoredGrant ? "sponsored" :
    subscription.state === "active" || subscription.state === "manual_override" ? "active_paid" :
    subscription.state === "unknown" ? "unknown" : "attention";
  const accessReason: EntitlementReasonCode =
    !policy ? "UNKNOWN_PLAN" :
    accessState === "attention" ? "SUBSCRIPTION_STATE_REQUIRES_RECONCILIATION" :
    policy.kind === "trial" ? "POLICY_LIMIT" : "FEATURE_INCLUDED";
  const isRecoveryTrial = Boolean(input.trialOrigin && /expiry|recovery/i.test(input.trialOrigin))
    || Boolean(input.previousPaidPlan && effectiveResolution.planKey === "trial");
  const nextStep: EffectiveEntitlementReport["nextStep"] =
    (trialIsActive || trialIsInGrace) && isRecoveryTrial
      ? {
          code: "REVIEW_RECOVERY_TRIAL",
          label: "Review your recovery Trial",
          description: "Your previous paid access ended. Review the Trial dates below and choose a plan before the grace period ends.",
          action: "view_plans",
        }
      : (trialIsActive || trialIsInGrace)
        ? {
            code: "CONTINUE_TRIAL",
            label: trialIsInGrace ? "Choose a plan before grace ends" : "Continue your Trial",
            description: trialIsInGrace
              ? "Your Trial period has ended, but access remains available during the grace period."
              : "Your clinic is using the catalog-defined Trial allowances.",
            action: "view_plans",
          }
        : accessState === "active_paid"
          ? {
              code: "ACTIVE_PAID",
              label: "Your paid plan is active",
              description: "Your clinic has active paid access. The renewal or paid-access expiry date is shown below when available.",
              action: "none",
            }
          : accessState === "sponsored"
            ? {
                code: "REVIEW_SPONSORED_ACCESS",
                label: "Sponsored access is active",
                description: "This access was granted separately from a paid provider subscription and has its own expiry date.",
                action: "none",
              }
            : subscription.state === "pending_payment"
              ? {
                  code: "WAIT_FOR_PAYMENT",
                  label: "Payment confirmation is pending",
                  description: "Complete the activation payment and wait for provider confirmation before paid access begins.",
                  action: "none",
                }
              : subscription.state === "unknown" || subscription.state === "provider_error"
                ? {
                    code: "CONTACT_SUPPORT",
                    label: "Subscription review is needed",
                    description: "The subscription state could not be confirmed. Contact support before relying on plan limits.",
                    action: "contact_support",
                  }
                : {
                    code: "VIEW_PLANS",
                    label: "Review plan options",
                    description: "Choose a plan to keep your clinic access aligned with your needs.",
                    action: "view_plans",
                  };

  return {
    mode: "reporting_only",
    clinicId: input.clinicId,
    plan: {
      requested: requestedPlan,
      effective: effectiveResolution.planKey,
      displayName: policy?.displayName ?? null,
      policyVersion: policy ? catalog.version : null,
      source,
    },
    subscription,
    access: {
      state: accessState,
      trialStartedAt: input.trialStartedAt?.toISOString() ?? null,
      trialEndsAt: input.trialEndsAt?.toISOString() ?? null,
      trialGraceEndsAt: input.trialGraceEndsAt?.toISOString() ?? null,
      trialOrigin: input.trialOrigin ?? null,
      previousPaidPlan: input.previousPaidPlan ?? null,
      paidAccessExpiresAt: input.paidAccessExpiresAt?.toISOString() ?? null,
      reasonCode: accessReason,
    },
    nextStep,
    grants: {
      active: grants.length,
      plan: sponsoredGrant?.plan ?? null,
      endsAt: sponsoredGrant?.endsAt.toISOString() ?? null,
    },
    exceptions: {
      active: exceptions.length,
      keys: exceptions.map((exception) => exception.entitlementKey),
    },
    capabilities,
    measuredAt,
    timezone: input.timezone,
  };
}