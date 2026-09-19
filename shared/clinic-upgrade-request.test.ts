import test from "node:test";
import assert from "node:assert/strict";
import {
  CLINIC_UPGRADE_REQUEST_STATUSES,
  insertClinicUpgradeRequestSchema,
} from "./schema";

test("upgrade requests expose the complete review status set", () => {
  assert.deepEqual(CLINIC_UPGRADE_REQUEST_STATUSES, [
    "pending",
    "approved",
    "rejected",
    "cancelled",
  ]);
});

test("new upgrade requests require clinic, paid plan, and billing cycle", () => {
  const result = insertClinicUpgradeRequestSchema.safeParse({
    clinicId: 42,
    requestedPlan: "growth",
    billingCycle: "annual",
    clinicReason: "We need additional clinic capacity.",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.clinicId, 42);
    assert.equal(result.data.requestedPlan, "growth");
    assert.equal(result.data.billingCycle, "annual");
    assert.equal(result.data.status, undefined);
    assert.equal(result.data.reviewedBy, undefined);
  }
});

test("review-only fields cannot be supplied when creating a request", () => {
  const result = insertClinicUpgradeRequestSchema.safeParse({
    clinicId: 42,
    requestedPlan: "starter",
    billingCycle: "monthly",
    reviewedBy: "super-admin-1",
    reviewReason: "Approved",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.reviewedBy, undefined);
    assert.equal(result.data.reviewReason, undefined);
  }
});