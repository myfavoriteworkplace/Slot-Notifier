import { PAID_PLAN_KEYS } from "./plan-catalog";

export const TRIAL_ORIGINS = [
  "initial_signup",
  "paid_expiry",
  "admin_granted",
] as const;

export type TrialOrigin = (typeof TRIAL_ORIGINS)[number];

export type TrialLifecycleClinic = {
  plan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  trialStartedAt: Date | null | undefined;
  trialEndsAt: Date | null | undefined;
  trialGraceEndsAt: Date | null | undefined;
  previousPaidPlan: string | null | undefined;
};

export type TrialWindow = {
  trialStartedAt: Date;
  trialEndsAt: Date;
  trialGraceEndsAt: Date;
};

export type TrialTransition = TrialWindow & {
  origin: TrialOrigin;
  previousPaidPlan: string | null;
};

export type TrialPhase = "not_trial" | "unknown" | "active" | "grace" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildTrialWindow(
  now: Date,
  durationDays: number,
  graceDays: number,
): TrialWindow {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    throw new Error("Trial duration must be greater than zero");
  }
  if (!Number.isFinite(graceDays) || graceDays < 0) {
    throw new Error("Trial grace period cannot be negative");
  }

  const trialStartedAt = new Date(now);
  const trialEndsAt = new Date(now.getTime() + durationDays * DAY_MS);
  const trialGraceEndsAt = new Date(trialEndsAt.getTime() + graceDays * DAY_MS);

  return { trialStartedAt, trialEndsAt, trialGraceEndsAt };
}

export function buildInitialTrialTransition(
  now: Date,
  durationDays: number,
  graceDays: number,
): TrialTransition {
  return {
    ...buildTrialWindow(now, durationDays, graceDays),
    origin: "initial_signup",
    previousPaidPlan: null,
  };
}

export function buildPaidExpiryRecoveryTransition(
  clinic: TrialLifecycleClinic,
  now: Date,
  durationDays: number,
  graceDays: number,
): TrialTransition | null {
  const currentPlan = clinic.plan ?? null;
  const currentStatus = clinic.subscriptionStatus?.toLowerCase() ?? "";
  const isPaidPlan = PAID_PLAN_KEYS.includes(currentPlan as typeof PAID_PLAN_KEYS[number]);
  const isRecoverableStatus = ["active", "past_due", "expired"].includes(currentStatus);

  if (!isPaidPlan || !isRecoverableStatus) return null;

  return {
    ...buildTrialWindow(now, durationDays, graceDays),
    origin: "paid_expiry",
    previousPaidPlan: currentPlan,
  };
}

export function getTrialPhase(
  clinic: Pick<TrialLifecycleClinic, "plan" | "trialEndsAt" | "trialGraceEndsAt">,
  now: Date,
): TrialPhase {
  if (clinic.plan !== "trial") return "not_trial";

  const trialEndsAt = clinic.trialEndsAt?.getTime();
  const trialGraceEndsAt = clinic.trialGraceEndsAt?.getTime();
  if (
    trialEndsAt === undefined ||
    trialGraceEndsAt === undefined ||
    !Number.isFinite(trialEndsAt) ||
    !Number.isFinite(trialGraceEndsAt)
  ) {
    return "unknown";
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error("Trial phase requires a valid current time");
  }
  if (nowMs < trialEndsAt) return "active";
  if (nowMs < trialGraceEndsAt) return "grace";
  return "expired";
}

export function isTrialConversionEligible(
  clinic: TrialLifecycleClinic,
  now: Date,
): boolean {
  return (
    clinic.plan === "trial" &&
    clinic.subscriptionStatus?.toLowerCase() === "trialing" &&
    ["active", "grace"].includes(getTrialPhase(clinic, now))
  );
}

export function isTrialExpiredAfterGrace(
  clinic: TrialLifecycleClinic,
  now: Date,
): boolean {
  return (
    clinic.plan === "trial" &&
    clinic.subscriptionStatus?.toLowerCase() === "trialing" &&
    getTrialPhase(clinic, now) === "expired"
  );
}