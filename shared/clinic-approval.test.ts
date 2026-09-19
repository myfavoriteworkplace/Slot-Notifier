import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveInitialApprovalSelection,
  validateInitialApprovalSelection,
} from "./clinic-approval";

test("defaults approval to the requested Trial plan", () => {
  assert.deepEqual(
    resolveInitialApprovalSelection("trial"),
    { requestedPlan: "trial", approvedPlan: "trial", isOverride: false },
  );
});

test("preserves a requested paid plan for approval", () => {
  assert.deepEqual(
    resolveInitialApprovalSelection("growth"),
    { requestedPlan: "growth", approvedPlan: "growth", isOverride: false },
  );
});

test("requires a reason when Super Admin overrides the requested plan", () => {
  const selection = resolveInitialApprovalSelection("starter", "growth");
  assert.equal(selection.isOverride, true);
  assert.equal(
    validateInitialApprovalSelection({
      ...selection,
      billingCycle: "monthly",
      reason: "short",
    }),
    "A reason of at least 10 characters is required when overriding the requested plan",
  );
});

test("requires billing cycle for paid approval and rejects it for Trial", () => {
  const paid = resolveInitialApprovalSelection("starter");
  assert.match(
    validateInitialApprovalSelection(paid),
    /billing cycle is required/,
  );

  const trial = resolveInitialApprovalSelection("trial");
  assert.equal(
    validateInitialApprovalSelection({ ...trial, billingCycle: "annual" }),
    "Billing cycle can only be provided for a paid plan",
  );
});

test("keeps custom Trial schedule fields together", () => {
  const trial = resolveInitialApprovalSelection("trial");
  assert.equal(
    validateInitialApprovalSelection({
      ...trial,
      trialStartDate: "2026-09-19",
      trialGraceDays: 7,
    }),
    "Custom Trial approval requires a start date, end date, and grace period",
  );

  assert.equal(
    validateInitialApprovalSelection({
      ...trial,
      trialStartDate: "2026-09-19",
      trialEndDate: "2026-10-03",
      trialGraceDays: 7,
    }),
    null,
  );
});

test("unknown requested plans fail closed to Trial", () => {
  assert.deepEqual(
    resolveInitialApprovalSelection("unknown-plan"),
    { requestedPlan: "trial", approvedPlan: "trial", isOverride: false },
  );
});