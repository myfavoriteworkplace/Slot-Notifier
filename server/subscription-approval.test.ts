import assert from "node:assert/strict";
import test from "node:test";
import { resolveApprovalAccessState, SubscriptionApprovalError } from "./subscription-approval";

const now = new Date("2026-09-23T00:00:00.000Z");

test("resolves an active Trial before paid states", () => {
  assert.equal(resolveApprovalAccessState({
    plan: "trial",
    subscriptionStatus: "trialing",
    trialEndsAt: new Date("2026-09-30T00:00:00.000Z"),
    trialGraceEndsAt: new Date("2026-10-07T00:00:00.000Z"),
  }, now), "trial");
});

test("resolves Trial grace separately from an active Trial", () => {
  assert.equal(resolveApprovalAccessState({
    plan: "trial",
    subscriptionStatus: "trialing",
    trialEndsAt: new Date("2026-09-20T00:00:00.000Z"),
    trialGraceEndsAt: new Date("2026-09-27T00:00:00.000Z"),
  }, now), "trial_grace");
});

test("resolves paid, pending, and attention states conservatively", () => {
  assert.equal(resolveApprovalAccessState({
    plan: "growth",
    subscriptionStatus: "active",
    trialEndsAt: null,
    trialGraceEndsAt: null,
  }, now), "active_paid");
  assert.equal(resolveApprovalAccessState({
    plan: "growth",
    subscriptionStatus: "pending_payment",
    trialEndsAt: null,
    trialGraceEndsAt: null,
  }, now), "pending_payment");
  assert.equal(resolveApprovalAccessState({
    plan: "growth",
    subscriptionStatus: "provider_error",
    trialEndsAt: null,
    trialGraceEndsAt: null,
  }, now), "attention");
});

test("exposes a stable typed service error for route adapters", () => {
  const error = new SubscriptionApprovalError("Conflict", 409);
  assert.equal(error.name, "SubscriptionApprovalError");
  assert.equal(error.statusCode, 409);
  assert.equal(error.message, "Conflict");
});