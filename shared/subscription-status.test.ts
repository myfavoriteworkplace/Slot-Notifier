import test from "node:test";
import assert from "node:assert/strict";
import { getSubscriptionStatusInfo } from "./subscription-status";

test("normalizes supported subscription states", () => {
  assert.equal(getSubscriptionStatusInfo("active").state, "active");
  assert.equal(getSubscriptionStatusInfo("past_due").state, "past_due");
  assert.equal(getSubscriptionStatusInfo("provider_error").state, "provider_error");
});

test("maps the legacy unpaid value to pending payment", () => {
  const result = getSubscriptionStatusInfo("unpaid");
  assert.equal(result.state, "pending_payment");
  assert.equal(result.label, "Payment pending");
  assert.equal(result.needsAttention, true);
});

test("keeps unknown values visible and actionable", () => {
  const result = getSubscriptionStatusInfo("future_provider_state");
  assert.equal(result.state, "unknown");
  assert.equal(result.raw, "future_provider_state");
  assert.equal(result.label, "Unknown state");
  assert.equal(result.needsAttention, true);
});