import { isPlanKey, type PlanKey } from "./plan-catalog";

export type ClinicRegistrationPlanInput = {
  requestedPlan?: unknown;
  plan?: unknown;
};

export type RequestedPlanResolution =
  | {
      ok: true;
      requestedPlan: PlanKey;
      source: "requestedPlan" | "legacyPlan";
    }
  | {
      ok: false;
      code: "missing" | "invalid" | "conflict";
      message: string;
    };

function normalizePlan(value: unknown): PlanKey | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isPlanKey(normalized) ? normalized : null;
}

/**
 * Resolves the registration preference without allowing it to become active
 * subscription state. The legacy `plan` input is accepted only for older
 * clients during the rollout and is always saved as `requestedPlan`.
 */
export function resolveRequestedPlan(
  input: ClinicRegistrationPlanInput,
): RequestedPlanResolution {
  const hasRequestedPlan = input.requestedPlan !== undefined;
  const hasLegacyPlan = input.plan !== undefined;
  const requestedPlan = hasRequestedPlan ? normalizePlan(input.requestedPlan) : null;
  const legacyPlan = hasLegacyPlan ? normalizePlan(input.plan) : null;

  if (!hasRequestedPlan && !hasLegacyPlan) {
    return {
      ok: false,
      code: "missing",
      message: "A valid requested plan is required",
    };
  }

  if (hasRequestedPlan && !requestedPlan) {
    return {
      ok: false,
      code: "invalid",
      message: "Requested plan must be trial, starter, growth, or pro",
    };
  }

  if (hasLegacyPlan && !legacyPlan) {
    return {
      ok: false,
      code: "invalid",
      message: "Plan must be trial, starter, growth, or pro",
    };
  }

  if (requestedPlan && legacyPlan && requestedPlan !== legacyPlan) {
    return {
      ok: false,
      code: "conflict",
      message: "Requested plan values do not match",
    };
  }

  return {
    ok: true,
    requestedPlan: requestedPlan ?? legacyPlan!,
    source: hasRequestedPlan ? "requestedPlan" : "legacyPlan",
  };
}