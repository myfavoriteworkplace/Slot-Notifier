import test from "node:test";
import assert from "node:assert/strict";
import { PUBLISHED_PLAN_POLICY } from "./plan-catalog";
import { validatePlanPolicyDocument } from "./plan-policy-validation";

test("the reviewed catalog passes plan policy validation", () => {
  const result = validatePlanPolicyDocument(PUBLISHED_PLAN_POLICY);
  assert.deepEqual(result.errors, []);
});

test("validation rejects paid Trial pricing and missing plan content", () => {
  const document = structuredClone(PUBLISHED_PLAN_POLICY);
  document.plans.trial.pricing.monthly = 1998;
  delete (document.plans.pro.features as any).website;
  const result = validatePlanPolicyDocument(document);
  assert.ok(result.errors.some(error => error.includes("Trial must not have paid")));
  assert.ok(result.errors.some(error => error.includes("pro needs a valid website")));
});

test("validation preserves the annual savings contract", () => {
  const document = structuredClone(PUBLISHED_PLAN_POLICY);
  document.plans.starter.pricing.annual = 30_000;
  const result = validatePlanPolicyDocument(document);
  assert.ok(result.errors.some(error => error.includes("annual price cannot exceed")));
});