import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInitialTrialTransition,
  buildPaidExpiryRecoveryTransition,
  buildTrialWindow,
  getTrialPhase,
  isTrialConversionEligible,
  isTrialExpiredAfterGrace,
} from "./trial-lifecycle";

const now = new Date("2026-09-12T08:00:00.000Z");

test("builds an initial Trial window from the published duration", () => {
  const transition = buildInitialTrialTransition(now, 14, 7);

  assert.equal(transition.origin, "initial_signup");
  assert.equal(transition.previousPaidPlan, null);
  assert.equal(transition.trialStartedAt.toISOString(), "2026-09-12T08:00:00.000Z");
  assert.equal(transition.trialEndsAt.toISOString(), "2026-09-26T08:00:00.000Z");
  assert.equal(transition.trialGraceEndsAt.toISOString(), "2026-10-03T08:00:00.000Z");
});

test("recovers an active paid clinic exactly once in the transition layer", () => {
  const transition = buildPaidExpiryRecoveryTransition({
    plan: "growth",
    subscriptionStatus: "active",
    trialStartedAt: null,
    trialEndsAt: null,
    trialGraceEndsAt: null,
    previousPaidPlan: null,
  }, now, 14, 7);

  assert.ok(transition);
  assert.equal(transition.origin, "paid_expiry");
  assert.equal(transition.previousPaidPlan, "growth");
  assert.equal(transition.trialEndsAt.toISOString(), "2026-09-26T08:00:00.000Z");
});

test("does not recover Trial, pending-payment, or unknown plans", () => {
  for (const clinic of [
    { plan: "trial", subscriptionStatus: "trialing" },
    { plan: "starter", subscriptionStatus: "pending_payment" },
    { plan: "future_plan", subscriptionStatus: "active" },
  ]) {
    assert.equal(buildPaidExpiryRecoveryTransition({
      ...clinic,
      trialStartedAt: null,
      trialEndsAt: null,
      trialGraceEndsAt: null,
      previousPaidPlan: null,
    }, now, 14, 7), null);
  }
});

test("rejects invalid Trial windows", () => {
  assert.throws(() => buildTrialWindow(now, 0, 7), /duration/);
  assert.throws(() => buildTrialWindow(now, 14, -1), /grace/);
});

test("uses the exact Trial and grace boundaries", () => {
  const clinic = {
    plan: "trial",
    subscriptionStatus: "trialing",
    trialStartedAt: now,
    trialEndsAt: new Date("2026-09-26T08:00:00.000Z"),
    trialGraceEndsAt: new Date("2026-10-03T08:00:00.000Z"),
    previousPaidPlan: null,
  };

  assert.equal(getTrialPhase(clinic, new Date("2026-09-26T07:59:59.999Z")), "active");
  assert.equal(getTrialPhase(clinic, new Date("2026-09-26T08:00:00.000Z")), "grace");
  assert.equal(getTrialPhase(clinic, new Date("2026-10-02T23:59:59.999Z")), "grace");
  assert.equal(getTrialPhase(clinic, new Date("2026-10-03T08:00:00.000Z")), "expired");
  assert.equal(isTrialConversionEligible(clinic, new Date("2026-10-02T23:59:59.999Z")), true);
  assert.equal(isTrialExpiredAfterGrace(clinic, new Date("2026-10-03T08:00:00.000Z")), true);
});

test("does not treat missing Trial dates or non-Trial plans as active", () => {
  assert.equal(getTrialPhase({
    plan: "trial",
    trialEndsAt: null,
    trialGraceEndsAt: null,
  }, now), "unknown");
  assert.equal(getTrialPhase({
    plan: "starter",
    trialEndsAt: null,
    trialGraceEndsAt: null,
  }, now), "not_trial");
  assert.equal(isTrialConversionEligible({
    plan: "trial",
    subscriptionStatus: "expired",
    trialEndsAt: new Date("2026-09-01T00:00:00.000Z"),
    trialGraceEndsAt: new Date("2026-09-08T00:00:00.000Z"),
  }, now), false);
});