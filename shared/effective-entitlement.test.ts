import assert from "node:assert/strict";
import test from "node:test";
import { resolveEffectiveEntitlements } from "./effective-entitlement";

const now = new Date("2026-09-12T08:00:00.000Z");

const usage = {
  bookings: { allTime: 17, currentLocalMonth: 17 },
  activeDoctors: 1,
  liveSmileDeals: 0,
  storageBytes: 0,
  messages: {
    allTime: { sms: 0, whatsapp: 0, email: 0 },
    currentLocalMonth: { sms: 0, whatsapp: 0, email: 0 },
  },
  measuredAt: now.toISOString(),
  timezone: "Asia/Kolkata",
};

test("resolves a known paid plan in reporting-only mode", () => {
  const report = resolveEffectiveEntitlements({
    clinicId: 1,
    rawPlan: "starter",
    rawSubscriptionStatus: "active",
    timezone: "Asia/Kolkata",
    usage,
    now,
  });

  const bookings = report.capabilities.find((item) => item.capability === "bookings");
  assert.equal(report.mode, "reporting_only");
  assert.equal(report.plan.effective, "starter");
  assert.equal(report.access.state, "active_paid");
  assert.equal(report.nextStep.code, "ACTIVE_PAID");
  assert.equal(report.nextStep.action, "none");
  assert.equal(bookings?.limit, 30);
  assert.equal(bookings?.remaining, 13);
  assert.equal(bookings?.overLimit, false);
});

test("keeps pending payment visible without silently denying reporting output", () => {
  const report = resolveEffectiveEntitlements({
    clinicId: 2,
    rawPlan: "starter",
    rawSubscriptionStatus: "unpaid",
    timezone: "Asia/Kolkata",
    usage,
    now,
  });

  assert.equal(report.subscription.state, "pending_payment");
  assert.equal(report.access.state, "attention");
  assert.equal(report.access.reasonCode, "SUBSCRIPTION_STATE_REQUIRES_RECONCILIATION");
  assert.equal(report.nextStep.code, "WAIT_FOR_PAYMENT");
  assert.equal(report.nextStep.action, "none");
  assert.equal(report.capabilities.find((item) => item.capability === "bookings")?.enabled, true);
});

test("labels a post-Trial clinic inside grace as Trial grace period", () => {
  const report = resolveEffectiveEntitlements({
    clinicId: 5,
    rawPlan: "trial",
    rawSubscriptionStatus: "trialing",
    timezone: "Asia/Kolkata",
    trialStartedAt: new Date("2026-08-20T08:00:00.000Z"),
    trialEndsAt: new Date("2026-09-10T08:00:00.000Z"),
    trialGraceEndsAt: new Date("2026-09-17T08:00:00.000Z"),
    usage,
    now,
  });

  assert.equal(report.subscription.state, "trialing");
  assert.equal(report.access.state, "trial_grace");
  assert.equal(report.nextStep.code, "CONTINUE_TRIAL");
  assert.equal(report.nextStep.action, "view_plans");
});

test("explains recovery Trial origin and directs the clinic to review plans", () => {
  const report = resolveEffectiveEntitlements({
    clinicId: 6,
    rawPlan: "trial",
    rawSubscriptionStatus: "trialing",
    timezone: "Asia/Kolkata",
    trialStartedAt: new Date("2026-09-01T08:00:00.000Z"),
    trialEndsAt: new Date("2026-09-15T08:00:00.000Z"),
    trialGraceEndsAt: new Date("2026-09-22T08:00:00.000Z"),
    trialOrigin: "paid_expiry",
    previousPaidPlan: "growth",
    usage,
    now,
  });

  assert.equal(report.access.state, "trial");
  assert.equal(report.access.trialOrigin, "paid_expiry");
  assert.equal(report.access.previousPaidPlan, "growth");
  assert.equal(report.nextStep.code, "REVIEW_RECOVERY_TRIAL");
  assert.equal(report.nextStep.action, "view_plans");
});

test("uses a current sponsored plan and explicit exception without mutating state", () => {
  const report = resolveEffectiveEntitlements({
    clinicId: 3,
    rawPlan: "starter",
    rawSubscriptionStatus: "expired",
    timezone: "Asia/Kolkata",
    usage,
    now,
    activeGrants: [{
      plan: "growth",
      startsAt: new Date("2026-09-01T00:00:00.000Z"),
      endsAt: new Date("2026-10-01T00:00:00.000Z"),
    }],
    activeExceptions: [{
      entitlementKey: "bookings",
      overrideValue: 40,
      startsAt: new Date("2026-09-10T00:00:00.000Z"),
      endsAt: new Date("2026-09-20T00:00:00.000Z"),
    }],
  });

  const bookings = report.capabilities.find((item) => item.capability === "bookings");
  assert.equal(report.plan.effective, "growth");
  assert.equal(report.plan.source, "sponsored_access");
  assert.equal(report.access.state, "sponsored");
  assert.equal(report.nextStep.code, "REVIEW_SPONSORED_ACCESS");
  assert.equal(report.nextStep.action, "none");
  assert.equal(bookings?.limit, 40);
  assert.equal(bookings?.source, "exception");
  assert.equal(report.grants.active, 1);
  assert.deepEqual(report.exceptions.keys, ["bookings"]);
});

test("does not silently fall back when the plan is unknown", () => {
  const report = resolveEffectiveEntitlements({
    clinicId: 4,
    rawPlan: "future_plan",
    rawSubscriptionStatus: "active",
    timezone: "Asia/Kolkata",
    usage,
    now,
  });

  assert.equal(report.plan.effective, "unknown");
  assert.equal(report.plan.displayName, null);
  assert.equal(report.access.reasonCode, "UNKNOWN_PLAN");
  assert.equal(report.nextStep.code, "CONTACT_SUPPORT");
  assert.equal(report.nextStep.action, "contact_support");
  assert.equal(report.capabilities.every((item) => item.enabled === null), true);
});