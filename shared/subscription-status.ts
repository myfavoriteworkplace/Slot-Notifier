export const SUBSCRIPTION_STATES = [
  "pending_payment",
  "active",
  "past_due",
  "expired",
  "cancelled",
  "provider_error",
  "manual_override",
  "unknown",
] as const;

export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

export type SubscriptionStatusInfo = {
  state: SubscriptionState;
  raw: string | null;
  label: string;
  isActive: boolean;
  needsAttention: boolean;
};

/**
 * Converts stored and legacy subscription values into the platform-level
 * state machine used by Super Admin operations views.
 *
 * Legacy values are mapped deliberately so old clinic rows remain readable
 * while unknown future values remain visible as an attention state.
 */
export function getSubscriptionStatusInfo(rawStatus: string | null | undefined): SubscriptionStatusInfo {
  const raw = rawStatus?.trim() || null;
  const normalized = raw?.toLowerCase();

  const state: SubscriptionState =
    normalized === "active" ? "active" :
    normalized === "pending_payment" || normalized === "unpaid" ? "pending_payment" :
    normalized === "past_due" ? "past_due" :
    normalized === "expired" ? "expired" :
    normalized === "cancelled" || normalized === "canceled" ? "cancelled" :
    normalized === "provider_error" || normalized === "provider_failed" || normalized === "failed" ? "provider_error" :
    normalized === "manual_override" || normalized === "manual" ? "manual_override" :
    "unknown";

  const labels: Record<SubscriptionState, string> = {
    pending_payment: "Payment pending",
    active: "Active",
    past_due: "Past due",
    expired: "Expired",
    cancelled: "Cancelled",
    provider_error: "Provider error",
    manual_override: "Manual override",
    unknown: "Unknown state",
  };

  return {
    state,
    raw,
    label: labels[state],
    isActive: state === "active",
    needsAttention: state !== "active",
  };
}