import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminClinicAttentionReasons,
  getAdminDataState,
  getAdminStorageUsageLevel,
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