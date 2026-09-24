import test from "node:test";
import assert from "node:assert/strict";
import {
  registrationApprovalRequestSchema,
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

test("registration approval request accepts all five explicit outcomes", () => {
  const common = {
    billingCycle: null,
    transitionId: "6d1c9a2a-f3f4-4cce-b634-96def060718a",
  };
  const requests = [
    { ...common, outcome: "trial", approvedPlan: "trial" },
    { ...common, outcome: "online_payment_required", approvedPlan: "growth", billingCycle: "annual" },
    {
      ...common,
      outcome: "verified_offline_payment",
      approvedPlan: "starter",
      billingCycle: "monthly",
      offlinePayment: {
        amount: 999,
        receivedAt: "2026-09-24T08:00:00.000Z",
        paymentMethod: "bank_transfer",
        externalReference: "bank-ref-123",
        evidenceReference: "receipt-123",
      },
    },
    {
      ...common,
      outcome: "complimentary",
      approvedPlan: "pro",
      billingCycle: "monthly",
      reason: "Sponsored access approved for the clinic pilot",
      complimentaryAccess: {
        startsAt: "2026-09-24",
        endsAt: "2026-10-24",
        sponsorReference: "pilot-sponsor-1",
      },
    },
    {
      ...common,
      outcome: "reject",
      approvedPlan: null,
      reason: "Registration documents could not be verified",
    },
  ];

  for (const request of requests) {
    assert.equal(registrationApprovalRequestSchema.safeParse(request).success, true);
  }
});

test("complimentary registration approval permits an omitted sponsor reference", () => {
  assert.equal(registrationApprovalRequestSchema.safeParse({
    outcome: "complimentary",
    approvedPlan: "growth",
    billingCycle: "annual",
    reason: "Sponsored access approved for the clinic pilot",
    complimentaryAccess: {
      startsAt: "2026-09-24",
      endsAt: "2026-10-24",
    },
  }).success, true);
});

test("registration approval request requires an explicit matching outcome and rejects extra fields", () => {
  assert.equal(registrationApprovalRequestSchema.safeParse({
    approvedPlan: "growth",
    billingCycle: "annual",
  }).success, false);
  assert.equal(registrationApprovalRequestSchema.safeParse({
    outcome: "reject",
    approvedPlan: null,
    billingCycle: null,
    reason: "Not eligible",
    clientVerifiedBy: "forged-admin",
  }).success, false);
  assert.equal(registrationApprovalRequestSchema.safeParse({
    outcome: "verified_offline_payment",
    approvedPlan: "growth",
    billingCycle: "annual",
    offlinePayment: {
      amount: 100,
      receivedAt: "2026-09-24T08:00:00.000Z",
      paymentMethod: "upi",
      externalReference: "bank-ref-123",
      evidenceReference: "receipt-123",
    },
  }).success, true);
  assert.equal(registrationApprovalRequestSchema.safeParse({
    outcome: "reject",
    approvedPlan: null,
    billingCycle: null,
    reason: "Not eligible",
    offlinePayment: {
      amount: 100,
      receivedAt: "2026-09-24T08:00:00.000Z",
      paymentMethod: "upi",
      externalReference: "bank-ref-123",
      evidenceReference: "receipt-123",
    },
  }).success, false);
});