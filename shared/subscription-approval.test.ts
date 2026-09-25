import assert from "node:assert/strict";
import test from "node:test";
import {
  subscriptionApprovalInputSchema,
  validateSubscriptionApprovalInput,
} from "./subscription-approval";

const baseApproval = {
  clinicId: 7,
  approvalContext: "registration" as const,
  requestedPlan: "trial" as const,
  requestedBillingCycle: null,
  paymentBasis: "none" as const,
  renewalMode: "manual" as const,
  reason: null,
  actor: { type: "superadmin" as const, id: "admin-1" },
  transitionId: "registration:clinic-7:decision-1",
  sourceRequestId: null,
  effectiveAt: "2026-09-23T08:00:00.000Z",
};

test("accepts a Trial approval without paid billing or payment evidence", () => {
  const result = subscriptionApprovalInputSchema.safeParse({
    ...baseApproval,
    outcome: "trial",
    approvedPlan: "trial",
    approvedBillingCycle: null,
  });

  assert.equal(result.success, true);
});

test("accepts a bounded custom Trial schedule and rejects it for paid approval", () => {
  const trialSchedule = {
    startedAt: "2026-09-22T08:00:00.000Z",
    endsAt: "2026-10-06T08:00:00.000Z",
    graceEndsAt: "2026-10-13T08:00:00.000Z",
  };
  assert.equal(subscriptionApprovalInputSchema.safeParse({
    ...baseApproval,
    outcome: "trial",
    approvedPlan: "trial",
    approvedBillingCycle: null,
    trialSchedule,
  }).success, true);
  assert.equal(subscriptionApprovalInputSchema.safeParse({
    ...baseApproval,
    outcome: "online_payment_required",
    approvedPlan: "growth",
    approvedBillingCycle: "annual",
    paymentBasis: "provider",
    reason: "Approved paid plan after registration review",
    trialSchedule,
    onlinePayment: {
      provider: "razorpay",
      paymentLinkMetadata: { paymentLinkId: "plink_123" },
    },
  }).success, false);
});

test("accepts online payment required without activating paid access", () => {
  const result = subscriptionApprovalInputSchema.safeParse({
    ...baseApproval,
    outcome: "online_payment_required",
    approvedPlan: "growth",
    approvedBillingCycle: "annual",
    paymentBasis: "provider",
    reason: "Approved paid plan after registration review",
    onlinePayment: {
      provider: "razorpay",
      paymentLinkMetadata: { paymentLinkId: "plink_123", amount: 15990 },
    },
  });

  assert.equal(result.success, true);
});

test("requires complete, verified offline evidence and rejects provider IDs as evidence", () => {
  const valid = {
    ...baseApproval,
    outcome: "verified_offline_payment" as const,
    approvedPlan: "starter" as const,
    approvedBillingCycle: "monthly" as const,
    paymentBasis: "offline_verified" as const,
    reason: "Verified offline payment received and reviewed",
    offlinePayment: {
      amount: 999,
      currency: "INR",
      receivedAt: "2026-09-22T08:00:00.000Z",
      paymentMethod: "bank_transfer" as const,
      externalReference: "bank-ref-123",
      evidenceReference: "receipt-123",
      verifiedBy: "admin-1",
      verifiedAt: "2026-09-23T08:00:00.000Z",
    },
  };

  assert.equal(subscriptionApprovalInputSchema.safeParse(valid).success, true);
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...valid,
      offlinePayment: { ...valid.offlinePayment, evidenceReference: "sub_123" },
    }).success,
    false,
  );
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...valid,
      offlinePayment: { ...valid.offlinePayment, verifiedAt: "2026-09-21T08:00:00.000Z" },
    }).success,
    false,
  );
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...valid,
      offlinePayment: { ...valid.offlinePayment, amount: 1 },
    }).success,
    false,
  );
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...valid,
      offlinePayment: { ...valid.offlinePayment, currency: "USD" },
    }).success,
    false,
  );
});

test("requires bounded complimentary access and a reason", () => {
  const valid = {
    ...baseApproval,
    outcome: "complimentary" as const,
    approvedPlan: "pro" as const,
    approvedBillingCycle: "monthly" as const,
    paymentBasis: "complimentary" as const,
    reason: "Sponsored access approved for the clinic pilot",
    complimentaryAccess: {
      startsAt: "2026-09-23T08:00:00.000Z",
      endsAt: "2026-10-23T08:00:00.000Z",
      sponsorReference: "pilot-sponsor-1",
    },
  };

  assert.equal(subscriptionApprovalInputSchema.safeParse(valid).success, true);
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...valid,
      complimentaryAccess: {
        ...valid.complimentaryAccess,
        endsAt: "2026-09-22T08:00:00.000Z",
      },
    }).success,
    false,
  );
  assert.equal(
    validateSubscriptionApprovalInput({
      ...valid,
      requestedPlan: "pro",
      requestedBillingCycle: "monthly",
      reason: null,
    }),
    "Complimentary access requires a reason",
  );
});

test("requires reasons for rejection and plan or cycle overrides", () => {
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...baseApproval,
      outcome: "reject",
      approvedPlan: null,
      approvedBillingCycle: null,
      reason: "No supporting approval evidence",
    }).success,
    true,
  );
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...baseApproval,
      outcome: "reject",
      approvedPlan: null,
      approvedBillingCycle: null,
      reason: null,
    }).success,
    false,
  );
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...baseApproval,
      outcome: "trial",
      requestedPlan: "growth",
      approvedPlan: "trial",
      approvedBillingCycle: null,
      reason: "short",
    }).success,
    false,
  );

  const cycleOverride = {
    ...baseApproval,
    outcome: "online_payment_required" as const,
    requestedPlan: "growth" as const,
    requestedBillingCycle: "annual" as const,
    approvedPlan: "growth" as const,
    approvedBillingCycle: "monthly" as const,
    paymentBasis: "provider" as const,
    renewalMode: "provider_auto" as const,
    onlinePayment: {
      provider: "razorpay",
      paymentLinkMetadata: { paymentLinkId: "plink_123" },
    },
  };
  assert.equal(subscriptionApprovalInputSchema.safeParse({
    ...cycleOverride,
    reason: null,
  }).success, false);
  assert.equal(subscriptionApprovalInputSchema.safeParse({
    ...cycleOverride,
    reason: "Clinic requested annual, approved monthly after review",
  }).success, true);
  assert.equal(subscriptionApprovalInputSchema.safeParse({
    ...cycleOverride,
    approvedPlan: "starter",
    reason: null,
  }).success, false);
  assert.equal(subscriptionApprovalInputSchema.safeParse({
    ...cycleOverride,
    approvedPlan: "starter",
    reason: "Approved Starter Monthly after reviewing the clinic application",
  }).success, true);
});

test("rejects paid plans without a billing cycle and preserves strict boundaries", () => {
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...baseApproval,
      outcome: "online_payment_required",
      approvedPlan: "starter",
      approvedBillingCycle: null,
      paymentBasis: "provider",
      onlinePayment: {
        provider: "razorpay",
        paymentLinkMetadata: { paymentLinkId: "plink_123" },
      },
    }).success,
    false,
  );
  assert.equal(
    subscriptionApprovalInputSchema.safeParse({
      ...baseApproval,
      outcome: "trial",
      approvedPlan: "trial",
      approvedBillingCycle: null,
      unexpectedField: true,
    }).success,
    false,
  );
});