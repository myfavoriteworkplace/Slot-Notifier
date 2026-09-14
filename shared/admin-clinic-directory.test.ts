import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_CLINIC_DIRECTORY_FILTER_OPTIONS,
  ADMIN_CLINIC_DIRECTORY_MOBILE_FIELDS,
  ADMIN_CLINIC_DIRECTORY_SEARCH_FIELDS,
  ADMIN_CLINIC_DIRECTORY_SELECTION,
  matchesAdminClinicDirectoryFilter,
  matchesAdminClinicDirectorySearch,
  type AdminClinicDirectoryRecord,
} from "./admin-clinic-directory";

const clinic: AdminClinicDirectoryRecord = {
  id: 42,
  name: "Smile Harbour Dental",
  city: "Kochi",
  email: "hello@smileharbour.example",
  plan: "Growth",
  status: "approved",
  isArchived: false,
  subscriptionStatus: "active",
};

test("directory contract exposes the required search fields and lifecycle filters", () => {
  assert.deepEqual(ADMIN_CLINIC_DIRECTORY_SEARCH_FIELDS, ["name", "city", "email", "plan"]);
  assert.deepEqual(
    ADMIN_CLINIC_DIRECTORY_FILTER_OPTIONS.map(option => option.value),
    ["all", "active", "attention", "trial", "paid", "pending", "archived", "sponsored", "exception", "unknown"],
  );
});

test("directory search is trimmed, case-insensitive, and searches the contract fields", () => {
  assert.equal(matchesAdminClinicDirectorySearch(clinic, "  HARBOUR  "), true);
  assert.equal(matchesAdminClinicDirectorySearch(clinic, "KOCHI"), true);
  assert.equal(matchesAdminClinicDirectorySearch(clinic, "hello@smileharbour.example"), true);
  assert.equal(matchesAdminClinicDirectorySearch(clinic, "starter"), false);
  assert.equal(matchesAdminClinicDirectorySearch(clinic, ""), true);
  assert.equal(matchesAdminClinicDirectorySearch(clinic, "growth", ["plan"]), true);
  assert.equal(matchesAdminClinicDirectorySearch(clinic, "growth", ["name", "city"]), false);
});

test("directory filters preserve shared archived precedence and access rules", () => {
  const archivedPending = { ...clinic, status: "pending", isArchived: true };
  assert.equal(matchesAdminClinicDirectoryFilter(archivedPending, "archived"), true);
  assert.equal(matchesAdminClinicDirectoryFilter(archivedPending, "pending"), false);
  assert.equal(matchesAdminClinicDirectoryFilter(clinic, "active"), true);
  assert.equal(matchesAdminClinicDirectoryFilter(clinic, "paid"), true);
});

test("directory selection preserves list state and mobile prioritizes actionable fields", () => {
  assert.deepEqual(ADMIN_CLINIC_DIRECTORY_SELECTION, {
    mode: "workspace-state",
    closeBehavior: "preserve-directory-state",
  });
  assert.deepEqual(ADMIN_CLINIC_DIRECTORY_MOBILE_FIELDS, [
    "identity",
    "lifecycle",
    "access",
    "attention",
    "primary_action",
  ]);
});