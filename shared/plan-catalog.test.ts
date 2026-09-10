import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_KEYS,
  PUBLISHED_PLAN_POLICY,
  calculateAnnualSavings,
  getAnnualSavings,
  isPaidPlanKey,
  isPlanKey,
  resolvePlanPolicy,
} from "./plan-catalog";

test("published catalog contains the approved four plans", () => {
  assert.deepEqual(Object.keys(PUBLISHED_PLAN_POLICY.plans), PLAN_KEYS);
  assert.equal(PUBLISHED_PLAN_POLICY.status, "published");
  assert.equal(PUBLISHED_PLAN_POLICY.version, "2026-09-11.v1");
  assert.deepEqual(PUBLISHED_PLAN_POLICY.explicitDeferrals, {
    transactionFees: "deferred",
    inventoryItemCounts: "deferred",
    pharmacyItemCounts: "deferred",
  });
});

test("resolves Trial and paid plans without mixing subscription state into plan", () => {
  assert.equal(resolvePlanPolicy("trial").planKey, "trial");
  assert.equal(resolvePlanPolicy("STARTER").planKey, "starter");
  assert.equal(resolvePlanPolicy("growth").policy?.kind, "paid");
  assert.equal(resolvePlanPolicy("unpaid").known, false);
  assert.equal(resolvePlanPolicy("unpaid").planKey, "unknown");
});

test("keeps unknown plans visible instead of silently falling back", () => {
  const result = resolvePlanPolicy("future_plan");
  assert.equal(result.known, false);
  assert.equal(result.planKey, "unknown");
  assert.equal(result.policy, null);
  assert.equal(result.rawPlan, "future_plan");
  assert.equal(resolvePlanPolicy(null).policy, null);
});

test("represents Trial and paid limits with the approved periods", () => {
  const trial = PUBLISHED_PLAN_POLICY.plans.trial;
  const starter = PUBLISHED_PLAN_POLICY.plans.starter;
  const pro = PUBLISHED_PLAN_POLICY.plans.pro;

  assert.deepEqual(trial.limits.bookings, { value: 10, period: "trial_lifetime", fairUse: false });
  assert.deepEqual(trial.limits.messaging, {
    sms: 25,
    whatsapp: 25,
    email: 50,
    period: "trial_lifetime",
  });
  assert.equal(starter.limits.bookings.period, "calendar_month");
  assert.equal(starter.limits.messaging.period, "calendar_month");
  assert.deepEqual(pro.limits.bookings, { value: null, period: "fair_use", fairUse: true });
});

test("calculates annual savings from monthly and annual prices", () => {
  assert.equal(getAnnualSavings("starter"), 1998);
  assert.equal(getAnnualSavings("growth"), 3198);
  assert.equal(calculateAnnualSavings(PUBLISHED_PLAN_POLICY.plans.pro), 5998);
  assert.equal(getAnnualSavings("trial"), null);
});

test("keeps approved feature packaging explicit", () => {
  const trial = PUBLISHED_PLAN_POLICY.plans.trial.features;
  const starter = PUBLISHED_PLAN_POLICY.plans.starter.features;
  const growth = PUBLISHED_PLAN_POLICY.plans.growth.features;
  const pro = PUBLISHED_PLAN_POLICY.plans.pro.features;

  assert.equal(trial.essentialWhatsapp, true);
  assert.equal(trial.routineWhatsapp, false);
  assert.equal(starter.essentialWhatsapp, true);
  assert.equal(starter.routineWhatsapp, false);
  assert.equal(growth.routineWhatsapp, true);
  assert.equal(pro.verifiedBadge, true);
  assert.equal(pro.featuredDealPlacement, true);
});

test("plan type guards distinguish paid plans from Trial and unknown values", () => {
  assert.equal(isPlanKey("trial"), true);
  assert.equal(isPlanKey("unpaid"), false);
  assert.equal(isPlanKey(undefined), false);
  assert.equal(isPaidPlanKey("starter"), true);
  assert.equal(isPaidPlanKey("trial"), false);
  assert.equal(isPaidPlanKey("future_plan"), false);
});