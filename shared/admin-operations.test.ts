import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminClinicLifecycleState,
  getAdminClinicAttentionReasons,
  getAdminDataState,
  getAdminStorageUsageLevel,
  matchesAdminClinicFilter,
} from "./admin-operations";

test("admin data state distinguishes loading, error, empty, and available", () => {
  assert.equal(getAdminDataState({ isLoading: true }), "loading");
  assert.equal(getAdminDataState({ isError: true }), "error");
  assert.equal(getAdminDataState({ hasData: false }), "empty");
  assert.equal(getAdminDataState({ hasData: true }), "available");
});

test("storage usage levels use the shared warning thresholds", () => {
  assert.equal(getAdminStorageUsageLevel(null, false), "unavailable");
  assert.equal(getAdminStorageUsageLevel(79.9), "normal");
  assert.equal(getAdminStorageUsageLevel(80), "warning");
  assert.equal(getAdminStorageUsageLevel(95), "critical");
});

test("attention reasons ignore unavailable service data instead of treating it as zero", () => {
  assert.deepEqual(
    getAdminClinicAttentionReasons({
      subscriptionStatus: "active",
      storage: { available: false },
      messaging: { available: false },
    }),
    [],
  );
});

test("attention reasons include normalized subscription, storage, messaging, and entitlement signals", () => {
  assert.deepEqual(
    getAdminClinicAttentionReasons({
      subscriptionStatus: "unpaid",
      storage: { available: true, usagePercent: 96 },
      messaging: { available: true, failed: 2 },
      entitlement: { available: true, overLimitCount: 1 },
    }),
    [
      { code: "subscription", severity: "warning", label: "Subscription payment pending" },
      { code: "storage", severity: "critical", label: "Storage 96%" },
      { code: "messaging", severity: "warning", label: "2 failed messages" },
      { code: "entitlement", severity: "warning", label: "1 entitlement limit exceeded" },
    ],
  );
});

test("healthy active clinic has no attention reasons", () => {
  assert.deepEqual(
    getAdminClinicAttentionReasons({
      subscriptionStatus: "active",
      storage: { available: true, usagePercent: 25 },
      messaging: { available: true, failed: 0 },
      entitlement: { available: true, overLimitCount: 0 },
    }),
    [],
  );
});

test("clinic lifecycle filters treat archived as a distinct state", () => {
  assert.equal(
    getAdminClinicLifecycleState({ status: "approved", isArchived: false }),
    "active",
  );
  assert.equal(
    getAdminClinicLifecycleState({ status: "pending", isArchived: false }),
    "pending",
  );
  assert.equal(
    getAdminClinicLifecycleState({ status: "pending", isArchived: true }),
    "archived",
  );
  assert.equal(
    matchesAdminClinicFilter({ status: "pending", isArchived: true }, "pending"),
    false,
  );
  assert.equal(
    matchesAdminClinicFilter({ status: "pending", isArchived: true }, "archived"),
    true,
  );
});

test("trial and paid filters normalize legacy subscription values", () => {
  assert.equal(
    matchesAdminClinicFilter({ plan: "trial", subscriptionStatus: "trialing" }, "trial"),
    true,
  );
  assert.equal(
    matchesAdminClinicFilter({ plan: "starter", subscriptionStatus: "unpaid" }, "trial"),
    false,
  );
  assert.equal(
    matchesAdminClinicFilter({ plan: "growth", subscriptionStatus: "active" }, "paid"),
    true,
  );
  assert.equal(
    matchesAdminClinicFilter({ plan: "starter", subscriptionStatus: "manual" }, "paid"),
    true,
  );
  assert.equal(
    matchesAdminClinicFilter({ plan: "growth", subscriptionStatus: "past_due" }, "paid"),
    false,
  );
});

test("effective access state overrides raw plan fields for access filters", () => {
  assert.equal(
    matchesAdminClinicFilter({
      plan: "starter",
      subscriptionStatus: "active",
      effectiveAccessState: "sponsored",
    }, "sponsored"),
    true,
  );
  assert.equal(
    matchesAdminClinicFilter({
      plan: "starter",
      subscriptionStatus: "active",
      effectiveAccessState: "sponsored",
    }, "paid"),
    false,
  );
  assert.equal(
    matchesAdminClinicFilter({
      plan: "growth",
      subscriptionStatus: "active",
      effectiveAccessState: "active_paid",
    }, "paid"),
    true,
  );
});

test("sponsored and exception filters do not guess without server access context", () => {
  const rawClinic = { plan: "growth", subscriptionStatus: "active" };
  assert.equal(matchesAdminClinicFilter(rawClinic, "sponsored"), false);
  assert.equal(matchesAdminClinicFilter(rawClinic, "exception"), false);
  assert.equal(
    matchesAdminClinicFilter({ ...rawClinic, hasSponsoredAccess: true }, "sponsored"),
    true,
  );
  assert.equal(
    matchesAdminClinicFilter({ ...rawClinic, hasActiveException: true }, "exception"),
    true,
  );
});

test("attention and unknown filters remain explicit", () => {
  assert.equal(
    matchesAdminClinicFilter({
      status: "approved",
      subscriptionStatus: "active",
      attentionReasons: [],
    }, "attention"),
    false,
  );
  assert.equal(
    matchesAdminClinicFilter({
      status: "approved",
      subscriptionStatus: "active",
      attentionReasons: [{ code: "storage", severity: "warning", label: "Storage 86%" }],
    }, "attention"),
    true,
  );
  assert.equal(
    matchesAdminClinicFilter({ status: "approved", subscriptionStatus: "future_state" }, "unknown"),
    true,
  );
  assert.equal(
    matchesAdminClinicFilter({ status: "approved", subscriptionStatus: "active" }, "unknown"),
    false,
  );
});