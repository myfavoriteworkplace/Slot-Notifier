import test from "node:test";
import assert from "node:assert/strict";
import { resolveRequestedPlan } from "./clinic-registration";

test("accepts every published plan as a requested registration plan", () => {
  for (const plan of ["trial", "starter", "growth", "pro"]) {
    const result = resolveRequestedPlan({ requestedPlan: plan });
    assert.deepEqual(result, {
      ok: true,
      requestedPlan: plan,
      source: "requestedPlan",
    });
  }
});

test("normalizes plan casing and whitespace without changing the plan meaning", () => {
  const result = resolveRequestedPlan({ requestedPlan: "  GROWTH " });
  assert.deepEqual(result, {
    ok: true,
    requestedPlan: "growth",
    source: "requestedPlan",
  });
});

test("accepts the legacy plan field only as a requested-plan compatibility input", () => {
  const result = resolveRequestedPlan({ plan: "starter" });
  assert.deepEqual(result, {
    ok: true,
    requestedPlan: "starter",
    source: "legacyPlan",
  });
});

test("rejects missing, unknown, and conflicting plan values", () => {
  assert.equal(resolveRequestedPlan({}).ok, false);
  assert.equal(resolveRequestedPlan({ requestedPlan: "unpaid" }).ok, false);
  assert.equal(resolveRequestedPlan({ plan: "future_plan" }).ok, false);
  assert.equal(
    resolveRequestedPlan({ requestedPlan: "growth", plan: "starter" }).ok,
    false,
  );
});