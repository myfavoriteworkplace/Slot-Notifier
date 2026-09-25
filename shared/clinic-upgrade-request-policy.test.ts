import test from "node:test";
import assert from "node:assert/strict";
import {
  clinicUpgradeRequestApprovalBodySchema,
  clinicUpgradeRequestBodySchema,
  clinicUpgradeRequestRejectionBodySchema,
  isClinicUpgradeEligible,
  validateClinicUpgradeRequestApproval,
} from "./clinic-upgrade-request-policy";

test("accepts only paid plans, valid billing cycles, and a bounded reason", () => {
  const parsed = clinicUpgradeRequestBodySchema.safeParse({
    requestedPlan: "growth",
    billingCycle: "annual",
    clinicReason: "We need more appointment capacity.",
  });

  assert.equal(parsed.success, true);
});

test("rejects Trial, invalid billing, browser clinic IDs, and oversized reasons", () => {
  assert.equal(
    clinicUpgradeRequestBodySchema.safeParse({
      requestedPlan: "trial",
      billingCycle: "monthly",
    }).success,
    false,
  );
  assert.equal(
    clinicUpgradeRequestBodySchema.safeParse({
      requestedPlan: "starter",
      billingCycle: "quarterly",
    }).success,
    false,
  );
  assert.equal(
    clinicUpgradeRequestBodySchema.safeParse({
      requestedPlan: "starter",
      billingCycle: "monthly",
      clinicId: 123,
    }).success,
    false,
  );
  assert.equal(
    clinicUpgradeRequestBodySchema.safeParse({
      requestedPlan: "starter",
      billingCycle: "monthly",
      clinicReason: "x".repeat(501),
    }).success,
    false,
  );
});

test("allows requests only during active Trial or grace", () => {
  const activeTrial = {
    plan: "trial",
    subscriptionStatus: "trialing",
    trialStartedAt: new Date("2026-09-01T00:00:00Z"),
    trialEndsAt: new Date("2026-09-15T00:00:00Z"),
    trialGraceEndsAt: new Date("2026-09-22T00:00:00Z"),
    previousPaidPlan: null,
  };

  assert.equal(
    isClinicUpgradeEligible(activeTrial, new Date("2026-09-10T00:00:00Z")),
    true,
  );
  assert.equal(
    isClinicUpgradeEligible(activeTrial, new Date("2026-09-18T00:00:00Z")),
    true,
  );
  assert.equal(
    isClinicUpgradeEligible(activeTrial, new Date("2026-09-23T00:00:00Z")),
    false,
  );
  assert.equal(
    isClinicUpgradeEligible({ ...activeTrial, plan: "starter" }, new Date("2026-09-10T00:00:00Z")),
    false,
  );
});

test("validates Super Admin review bodies and requires a reason for overrides", () => {
  assert.equal(
    clinicUpgradeRequestApprovalBodySchema.safeParse({
      requestedPlan: "growth",
      billingCycle: "annual",
      reviewReason: "Approved after review",
    }).success,
    true,
  );
  assert.equal(
    clinicUpgradeRequestApprovalBodySchema.safeParse({
      approvalOutcome: "verified_offline_payment",
      requestedPlan: "growth",
      billingCycle: "annual",
      reviewReason: "Verified bank receipt against the clinic account",
      offlinePayment: {
        amount: 15990,
        receivedAt: "2026-09-22T08:00:00.000Z",
        paymentMethod: "bank_transfer",
        externalReference: "bank-ref-123",
        evidenceReference: "receipt-123",
      },
    }).success,
    true,
  );
  assert.equal(
    clinicUpgradeRequestApprovalBodySchema.safeParse({
      approvalOutcome: "complimentary",
      requestedPlan: "growth",
      billingCycle: "annual",
      reviewReason: "Sponsored access approved for the clinic pilot",
      complimentaryAccess: {
        startsAt: "2026-09-23T08:00:00.000Z",
        endsAt: "2026-10-23T08:00:00.000Z",
      },
    }).success,
    true,
  );
  assert.equal(
    clinicUpgradeRequestApprovalBodySchema.safeParse({
      approvalOutcome: "verified_offline_payment",
      requestedPlan: "growth",
      billingCycle: "annual",
      reviewReason: "Missing evidence should be rejected",
    }).success,
    false,
  );
  assert.equal(
    clinicUpgradeRequestRejectionBodySchema.safeParse({ reviewReason: "" }).success,
    false,
  );
  assert.equal(
    validateClinicUpgradeRequestApproval({
      approvedPlan: "pro",
      approvedBillingCycle: "annual",
      requestedPlan: "starter",
      requestedBillingCycle: "monthly",
      reviewReason: "Too short",
    }),
    "A reason of at least 10 characters is required when changing the requested plan or billing cycle",
  );
  assert.equal(
    validateClinicUpgradeRequestApproval({
      approvedPlan: "pro",
      approvedBillingCycle: "annual",
      requestedPlan: "starter",
      requestedBillingCycle: "monthly",
      reviewReason: "Approved for the clinic's documented growth needs",
    }),
    null,
  );
});