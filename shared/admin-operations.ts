import { getSubscriptionStatusInfo } from "./subscription-status";

export const ADMIN_DATA_STATES = [
  "loading",
  "available",
  "empty",
  "error",
  "unavailable",
] as const;

export type AdminDataState = (typeof ADMIN_DATA_STATES)[number];

export type AdminAttentionReasonCode =
  | "subscription"
  | "storage"
  | "messaging"
  | "entitlement";

export type AdminAttentionSeverity = "warning" | "critical";

export type AdminAttentionReason = {
  code: AdminAttentionReasonCode;
  severity: AdminAttentionSeverity;
  label: string;
};

export const ADMIN_CLINIC_FILTERS = [
  "all",
  "active",
  "pending",
  "archived",
  "trial",
  "paid",
  "sponsored",
  "exception",
  "attention",
  "unknown",
] as const;

export type AdminClinicFilter = (typeof ADMIN_CLINIC_FILTERS)[number];

export type AdminClinicLifecycleState =
  | "active"
  | "pending"
  | "archived"
  | "rejected"
  | "unknown";

/**
 * This is the minimum server-backed summary needed by shared clinic lists.
 *
 * `effectiveAccessState`, `hasSponsoredAccess`, and `hasActiveException` are
 * optional because the base clinic directory does not load every clinic's
 * entitlement report. When they are absent, sponsored and exception filters
 * deliberately do not match instead of guessing from raw plan fields.
 */
export type AdminClinicFilterRecord = {
  status?: string | null;
  isArchived?: boolean | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
  effectiveAccessState?: "trial" | "trial_grace" | "active_paid" | "sponsored" | "attention" | "unknown" | null;
  hasSponsoredAccess?: boolean;
  hasActiveException?: boolean;
  attentionReasons?: readonly AdminAttentionReason[];
};

export type AdminDataStateInput = {
  isLoading?: boolean;
  isError?: boolean;
  hasData?: boolean;
};

export type AdminMessagingUsagePeriod = {
  month: string;
  timezone: string;
  from: string;
  to: string;
};

export type AdminMessagingUsageTotals = {
  sms: number;
  whatsapp: number;
  email: number;
  total: number;
  billable: number;
  accepted: number;
  failed: number;
  skipped: number;
};

export type AdminMessagingUsageEvent = {
  eventType: string;
  sms: number;
  whatsapp: number;
  email: number;
  total: number;
};

export type AdminMessagingUsageTrend = {
  month: string;
  sms: number;
  whatsapp: number;
  email: number;
  total: number;
  billable: number;
};

export type AdminMessagingClinicUsage = {
  clinicId: number;
  clinicName: string;
  plan: string | null;
  subscriptionStatus: string | null;
  status: string | null;
  isArchived: boolean | null;
  sms: number;
  whatsapp: number;
  email: number;
  total: number;
  billable: number;
  accepted: number;
  failed: number;
  skipped: number;
  lastSentAt: string | null;
  byEvent?: AdminMessagingUsageEvent[];
};

export type AdminMessagingUsageSummary = {
  period: AdminMessagingUsagePeriod;
  totals: AdminMessagingUsageTotals;
  trend: AdminMessagingUsageTrend[];
  byEvent: AdminMessagingUsageEvent[];
  clinics: AdminMessagingClinicUsage[];
};

export type AdminStorageClinicUsage = {
  clinicId: number;
  clinicName: string;
  plan: string | null;
  subscriptionStatus: string | null;
  status: string | null;
  isArchived: boolean;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usagePercent: number;
  fileCount: number;
  source: "plan" | "clinic_override" | "default";
};

export type AdminStorageUsageSummary = {
  measuredAt?: string;
  timezone?: string;
  totals: {
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    usagePercent: number;
    fileCount: number;
  };
  clinics: AdminStorageClinicUsage[];
};

export type AdminClinicOperationalSignals = {
  subscriptionStatus?: string | null;
  storage?: {
    available: boolean;
    usagePercent?: number | null;
  } | null;
  messaging?: {
    available: boolean;
    failed?: number | null;
  } | null;
  entitlement?: {
    available: boolean;
    overLimitCount?: number | null;
  } | null;
};

export type AdminStorageUsageLevel = "normal" | "warning" | "critical" | "unavailable";

export function getAdminDataState({
  isLoading = false,
  isError = false,
  hasData = false,
}: AdminDataStateInput): AdminDataState {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (!hasData) return "empty";
  return "available";
}

export function getAdminClinicLifecycleState(
  clinic: AdminClinicFilterRecord,
): AdminClinicLifecycleState {
  if (clinic.isArchived === true) return "archived";

  const status = clinic.status?.trim().toLowerCase();
  if (status === "pending") return "pending";
  if (status === "approved") return "active";
  if (status === "rejected") return "rejected";
  return "unknown";
}

function isTrialClinic(clinic: AdminClinicFilterRecord): boolean {
  if (clinic.effectiveAccessState === "trial" || clinic.effectiveAccessState === "trial_grace") {
    return true;
  }
  if (clinic.effectiveAccessState !== undefined && clinic.effectiveAccessState !== null) {
    return false;
  }

  const subscription = getSubscriptionStatusInfo(clinic.subscriptionStatus);
  return subscription.state === "trialing" || clinic.plan?.trim().toLowerCase() === "trial";
}

function isPaidClinic(clinic: AdminClinicFilterRecord): boolean {
  if (clinic.effectiveAccessState === "active_paid") return true;
  if (clinic.effectiveAccessState !== undefined && clinic.effectiveAccessState !== null) {
    return false;
  }

  const plan = clinic.plan?.trim().toLowerCase();
  const subscription = getSubscriptionStatusInfo(clinic.subscriptionStatus);
  return Boolean(plan && plan !== "trial") &&
    (subscription.state === "active" || subscription.state === "manual_override");
}

function hasAdminClinicAttention(clinic: AdminClinicFilterRecord): boolean {
  if (clinic.attentionReasons !== undefined) {
    return clinic.attentionReasons.length > 0;
  }
  return getSubscriptionStatusInfo(clinic.subscriptionStatus).needsAttention;
}

/**
 * Shared inclusion rules for all Super Admin clinic directories.
 *
 * This function classifies records for display and filtering only. It does
 * not grant access or replace the server's effective-entitlement decision.
 */
export function matchesAdminClinicFilter(
  clinic: AdminClinicFilterRecord,
  filter: AdminClinicFilter,
): boolean {
  if (filter === "all") return true;

  const lifecycle = getAdminClinicLifecycleState(clinic);
  if (filter === lifecycle) return true;
  if (filter === "trial") return isTrialClinic(clinic);
  if (filter === "paid") return isPaidClinic(clinic);
  if (filter === "sponsored") {
    return clinic.effectiveAccessState === "sponsored" || clinic.hasSponsoredAccess === true;
  }
  if (filter === "exception") return clinic.hasActiveException === true;
  if (filter === "attention") return hasAdminClinicAttention(clinic);
  if (filter === "unknown") {
    return lifecycle === "unknown" ||
      clinic.effectiveAccessState === "unknown" ||
      getSubscriptionStatusInfo(clinic.subscriptionStatus).state === "unknown";
  }

  return false;
}

export function getAdminStorageUsageLevel(
  usagePercent: number | null | undefined,
  available = true,
): AdminStorageUsageLevel {
  if (!available || usagePercent === null || usagePercent === undefined || !Number.isFinite(usagePercent)) {
    return "unavailable";
  }
  if (usagePercent >= 95) return "critical";
  if (usagePercent >= 80) return "warning";
  return "normal";
}

export function getAdminClinicAttentionReasons(
  signals: AdminClinicOperationalSignals,
): AdminAttentionReason[] {
  const reasons: AdminAttentionReason[] = [];
  const subscription = getSubscriptionStatusInfo(signals.subscriptionStatus);

  if (subscription.needsAttention) {
    reasons.push({
      code: "subscription",
      severity: subscription.state === "provider_error" || subscription.state === "expired" || subscription.state === "past_due"
        ? "critical"
        : "warning",
      label: `Subscription ${subscription.label.toLowerCase()}`,
    });
  }

  const storageLevel = getAdminStorageUsageLevel(
    signals.storage?.usagePercent,
    signals.storage?.available ?? false,
  );
  if (storageLevel !== "normal" && storageLevel !== "unavailable") {
    reasons.push({
      code: "storage",
      severity: storageLevel === "critical" ? "critical" : "warning",
      label: `Storage ${Math.round(signals.storage?.usagePercent ?? 0)}%`,
    });
  }

  if (signals.messaging?.available && (signals.messaging.failed ?? 0) > 0) {
    reasons.push({
      code: "messaging",
      severity: "warning",
      label: `${signals.messaging?.failed ?? 0} failed messages`,
    });
  }

  if (signals.entitlement?.available && (signals.entitlement.overLimitCount ?? 0) > 0) {
    reasons.push({
      code: "entitlement",
      severity: "warning",
      label: `${signals.entitlement.overLimitCount ?? 0} entitlement limit${signals.entitlement.overLimitCount === 1 ? "" : "s"} exceeded`,
    });
  }

  return reasons;
}