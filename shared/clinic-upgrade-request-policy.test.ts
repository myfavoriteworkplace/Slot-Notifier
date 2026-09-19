import test from "node:test";
import assert from "node:assert/strict";
import {
  clinicUpgradeRequestBodySchema,
  isClinicUpgradeEligible,
} from "./clinic-upgrade-request-policy";

test("accepts only paid plans, valid billing cycles, and a bounded reason", () => {
  const parsed = clinicUpgradeRequestBodySchema.safeParse({
    requestedPlan: "growth",
    billingCycle: "annual",
    clinicReason: "We need more appointment capacity.",
  });

  assert.equal(parsed.success, true);
});

test("rejects Trial, invalid billing, browser clinic IDs, and oversized reasons", () => {
  assert.equal(
    clinicUpgradeRequestBodySchema.safeParse({
      requestedPlan: "trial",
      billingCycle: "monthly",
    }).success,
    false,
  );
  assert.equal(
    clinicUpgradeRequestBodySchema.safeParse({
      requestedPlan: "starter",
      billingCycle: "quarterly",
    }).success,
    false,
  );
  assert.equal(
    clinicUpgradeRequestBodySchema.safeParse({
      requestedPlan: "starter",
      billingCycle: "monthly",
      clinicId: 123,
    }).success,
    false,
  );
  assert.equal(
    clinicUpgradeRequestBodySchema.safeParse({
      requestedPlan: "starter",
      billingCycle: "monthly",
      clinicReason: "x".repeat(501),
    }).success,
    false,
  );
});

test("allows requests only during active Trial or grace", () => {
  const activeTrial = {
    plan: "trial",
    subscriptionStatus: "trialing",
    trialStartedAt: new Date("2026-09-01T00:00:00Z"),
    trialEndsAt: new Date("2026-09-15T00:00:00Z"),
    trialGraceEndsAt: new Date("2026-09-22T00:00:00Z"),
    previousPaidPlan: null,
  };

  assert.equal(
    isClinicUpgradeEligible(activeTrial, new Date("2026-09-10T00:00:00Z")),
    true,
  );
  assert.equal(
    isClinicUpgradeEligible(activeTrial, new Date("2026-09-18T00:00:00Z")),
    true,
  );
  assert.equal(
    isClinicUpgradeEligible(activeTrial, new Date("2026-09-23T00:00:00Z")),
    false,
  );
  assert.equal(
    isClinicUpgradeEligible({ ...activeTrial, plan: "starter" }, new Date("2026-09-10T00:00:00Z")),
    false,
  );
});