import assert from "node:assert/strict";
import test from "node:test";
import { buildRecoveryTrialTransition, buildTrialWindow } from "./subscription-lifecycle";

const paidExpiry = new Date("2026-09-01T08:00:00.000Z");
const now = new Date("2026-09-12T08:00:00.000Z");

test("builds the approved initial/recovery Trial window", () => {
  assert.deepEqual(buildTrialWindow(paidExpiry), {
    startedAt: paidExpiry,
    endsAt: new Date("2026-09-15T08:00:00.000Z"),
    graceEndsAt: new Date("2026-09-22T08:00:00.000Z"),
  });
});

test("creates one provider-subscription-scoped recovery transition", () => {
  const transition = buildRecoveryTrialTransition({
    now,
    paidPlan: "growth",
    subscriptionStatus: "active",
    subscriptionId: "sub_123",
    provider: "razorpay",
    providerEventId: "evt_123",
    providerEventType: "subscription.completed",
    paidAccessExpiresAt: paidExpiry,
  });

  assert.equal(transition?.transitionId, "recovery:razorpay:sub_123");
  assert.equal(transition?.previousPaidPlan, "growth");
  assert.equal(transition?.trialWindow.startedAt, paidExpiry);
  assert.equal(transition?.trialWindow.endsAt.toISOString(), "2026-09-15T08:00:00.000Z");
  assert.equal(transition?.metadata.providerEventId, "evt_123");
});

test("does not start recovery before the paid period ends", () => {
  const transition = buildRecoveryTrialTransition({
    now,
    paidPlan: "starter",
    subscriptionStatus: "active",
    subscriptionId: "sub_123",
    provider: "razorpay",
    providerEventId: "evt_123",
    providerEventType: "subscription.cancelled",
    paidAccessExpiresAt: new Date("2026-09-20T08:00:00.000Z"),
  });

  assert.equal(transition, null);
});

test("does not create recovery for unmatched or non-paid states", () => {
  assert.equal(buildRecoveryTrialTransition({
    now,
    paidPlan: "trial",
    subscriptionStatus: "trialing",
    subscriptionId: "sub_123",
    provider: "razorpay",
    providerEventId: "evt_123",
    providerEventType: "subscription.completed",
    paidAccessExpiresAt: paidExpiry,
  }), null);
  assert.equal(buildRecoveryTrialTransition({
    now,
    paidPlan: "pro",
    subscriptionStatus: "active",
    subscriptionId: null,
    provider: "razorpay",
    providerEventId: "evt_123",
    providerEventType: "subscription.completed",
    paidAccessExpiresAt: paidExpiry,
  }), null);
});