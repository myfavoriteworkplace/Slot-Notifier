import { PUBLISHED_PLAN_POLICY } from "./plan-catalog";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialWindow = {
  startedAt: Date;
  endsAt: Date;
  graceEndsAt: Date;
};

export type RecoveryTrialInput = {
  now: Date;
  paidPlan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  subscriptionId: string | null | undefined;
  provider: string;
  providerEventId: string | null | undefined;
  providerEventType: string;
  paidAccessExpiresAt: Date | null | undefined;
};

export type RecoveryTrialTransition = {
  transitionId: string;
  trialWindow: TrialWindow;
  previousPaidPlan: string;
  reason: string;
  metadata: Record<string, string | null>;
};

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function buildTrialWindow(
  startedAt: Date,
  durationDays = PUBLISHED_PLAN_POLICY.plans.trial.trial.durationDays ?? 14,
  graceDays = PUBLISHED_PLAN_POLICY.plans.trial.trial.graceDays ?? 7,
): TrialWindow {
  const endsAt = addCalendarDays(startedAt, durationDays);
  return {
    startedAt,
    endsAt,
    graceEndsAt: addCalendarDays(endsAt, graceDays),
  };
}

export function buildRecoveryTrialTransition(
  input: RecoveryTrialInput,
): RecoveryTrialTransition | null {
  const paidPlan = input.paidPlan?.trim().toLowerCase();
  const status = input.subscriptionStatus?.trim().toLowerCase();
  const subscriptionId = input.subscriptionId?.trim();
  const paidAccessExpiresAt = input.paidAccessExpiresAt;
  const confirmedExpiryEvent = [
    "subscription.completed",
    "subscription.cancelled",
    "subscription.halted",
  ].includes(input.providerEventType);

  if (
    !paidPlan ||
    !["starter", "growth", "pro"].includes(paidPlan) ||
    !["active", "past_due", "expired", "cancelled", "manual_override"].includes(status || "") ||
    !subscriptionId ||
    !paidAccessExpiresAt ||
    !confirmedExpiryEvent ||
    paidAccessExpiresAt > input.now
  ) {
    return null;
  }

  const transitionId = `recovery:${input.provider}:${subscriptionId}`;
  const trialWindow = buildTrialWindow(paidAccessExpiresAt);

  return {
    transitionId,
    trialWindow,
    previousPaidPlan: paidPlan,
    reason: `${input.provider} confirmed paid subscription expiry (${input.providerEventType})`,
    metadata: {
      provider: input.provider,
      providerSubscriptionId: subscriptionId,
      providerEventId: input.providerEventId?.trim() || null,
      providerEventType: input.providerEventType,
      paidAccessExpiresAt: paidAccessExpiresAt.toISOString(),
    },
  };
}