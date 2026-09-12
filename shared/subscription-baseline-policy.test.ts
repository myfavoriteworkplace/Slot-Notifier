import test from "node:test";
import assert from "node:assert/strict";
import {
  compareBaselineImpact,
  getBaselinePlanLimits,
} from "./subscription-baseline-policy";
import { SUBSCRIPTION_BASELINE_FIXTURES } from "./subscription-baseline-fixtures";

test("derives baseline limits from the published catalog", () => {
  assert.deepEqual(getBaselinePlanLimits("trial"), {
    bookingsMonthly: null,
    bookingsTrialTotal: 10,
    doctors: 1,
    smileDeals: 1,
    storageBytes: 50 * 1024 * 1024,
    messaging: { sms: 25, whatsapp: 25, email: 50 },
  });
  assert.deepEqual(getBaselinePlanLimits("growth"), {
    bookingsMonthly: 150,
    bookingsTrialTotal: null,
    doctors: 3,
    smileDeals: 3,
    storageBytes: 500 * 1024 * 1024,
    messaging: { sms: 500, whatsapp: 500, email: 1500 },
  });
  assert.deepEqual(getBaselinePlanLimits("pro"), {
    bookingsMonthly: null,
    bookingsTrialTotal: null,
    doctors: null,
    smileDeals: null,
    storageBytes: 2047 * 1024 * 1024,
    messaging: { sms: 2000, whatsapp: 2000, email: 6000 },
  });
  assert.equal(getBaselinePlanLimits("future_plan"), null);
  assert.equal(getBaselinePlanLimits("unpaid"), null);
});

for (const fixture of SUBSCRIPTION_BASELINE_FIXTURES) {
  test(`baseline fixture: ${fixture.name}`, () => {
    assert.deepEqual(
      compareBaselineImpact(fixture.usage, fixture.plan, fixture.plan === "trial"),
      fixture.expectedTrialImpact.length ? fixture.expectedTrialImpact : fixture.expectedAssignedPlanImpact,
    );
  });
}

test("trial fixtures use lifetime bookings and messages", () => {
  const fixture = SUBSCRIPTION_BASELINE_FIXTURES.find((item) => item.name === "trial-at-every-limit")!;
  assert.deepEqual(compareBaselineImpact(fixture.usage, "trial", true), []);
  assert.deepEqual(compareBaselineImpact({
    ...fixture.usage,
    bookingsAllTime: 11,
    allTimeMessages: { sms: 26, whatsapp: 25, email: 50 },
  }, "trial", true), ["bookings 11/10", "sms 26/25"]);
});