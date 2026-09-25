import {
  ADMIN_CLINIC_FILTERS,
  matchesAdminClinicFilter,
  type AdminClinicFilter,
  type AdminClinicFilterRecord,
  type AdminClinicLifecycleState,
} from "./admin-operations";
import type { Clinic } from "./schema";

export type AdminClinicAccessState =
  | "trial"
  | "trial_grace"
  | "active_paid"
  | "sponsored"
  | "attention"
  | "unknown";

export type AdminClinicPaymentStatus =
  | "not_required"
  | "pending"
  | "verified_offline"
  | "reversed"
  | "waived"
  | "rejected"
  | "unknown";

export type AdminClinicNextImportantDateType =
  | "trial_ends"
  | "trial_grace_ends"
  | "paid_access_expires"
  | "sponsored_access_ends";

export type AdminClinicNextAction = {
  code: string;
  label: string;
  description: string;
  action: "none" | "review" | "reconcile" | "contact_support";
};

export type AdminClinicLatestApproval = {
  id: number;
  outcome: string;
  requestedPlan: string | null;
  approvedPlan: string | null;
  paymentBasis: string;
  renewalMode: string;
  effectiveAt: string;
  createdAt: string;
  actorType: string;
  actorId: string | null;
  reason: string | null;
  transitionId: string;
};

export type AdminClinicAccessSummary = {
  currentAccessState: AdminClinicAccessState;
  currentAccessPlan: string | null;
  assignedPlan: string | null;
  latestApprovalOutcome: string | null;
  paymentBasis: string | null;
  paymentStatus: AdminClinicPaymentStatus;
  renewalMode: string | null;
  nextImportantDate: string | null;
  nextImportantDateType: AdminClinicNextImportantDateType | null;
  attentionCode: string | null;
  nextAction: AdminClinicNextAction;
  latestApproval: AdminClinicLatestApproval | null;
};

/**
 * The server-backed summary required by the shared Clinics & Access directory.
 *
 * Entitlement-specific fields remain optional because the base clinic list does
 * not load every clinic's effective access report. Missing access context must
 * remain unknown rather than being inferred in the browser.
 */
export type AdminClinicDirectoryRecord = Clinic & AdminClinicAccessSummary & AdminClinicFilterRecord;

export const ADMIN_CLINIC_DIRECTORY_COLUMNS = [
  "identity",
  "location",
  "contact",
  "lifecycle",
  "access",
  "attention",
  "primary_action",
] as const;

export type AdminClinicDirectoryColumn = (typeof ADMIN_CLINIC_DIRECTORY_COLUMNS)[number];

export const ADMIN_CLINIC_DIRECTORY_SEARCH_FIELDS = [
  "name",
  "city",
  "email",
  "plan",
  "currentAccessPlan",
  "assignedPlan",
  "currentAccessState",
] as const;

export type AdminClinicDirectorySearchField = (typeof ADMIN_CLINIC_DIRECTORY_SEARCH_FIELDS)[number];

export const ADMIN_CLINIC_DIRECTORY_FILTERS = ADMIN_CLINIC_FILTERS;
export type AdminClinicDirectoryFilter = AdminClinicFilter;
export const ADMIN_CLINIC_DIRECTORY_DEFAULT_FILTER: AdminClinicDirectoryFilter = "active";

export const ADMIN_CLINIC_DIRECTORY_FILTER_OPTIONS = [
  { value: "active", label: "Active Clinics" },
  { value: "pending", label: "Pending Clinics" },
  { value: "archived", label: "Archived / Inactive" },
  { value: "all", label: "All Statuses" },
  { value: "attention", label: "Needs attention" },
  { value: "trial", label: "Trial access" },
  { value: "paid", label: "Paid access" },
  { value: "sponsored", label: "Sponsored access" },
  { value: "exception", label: "Access exceptions" },
  { value: "unknown", label: "Unknown access" },
] as const satisfies readonly { value: AdminClinicDirectoryFilter; label: string }[];

/**
 * Selection stays in the Clinics & Access workspace state for now. Closing a
 * detail view returns to the current directory search/filter state; URL
 * routing can be added later without changing the directory record contract.
 */
export const ADMIN_CLINIC_DIRECTORY_SELECTION = {
  mode: "workspace-state",
  closeBehavior: "preserve-directory-state",
} as const;

export type AdminClinicDirectorySelection = {
  selectedClinicId: number | null;
};

export const ADMIN_CLINIC_DIRECTORY_MOBILE_FIELDS = [
  "identity",
  "lifecycle",
  "access",
  "attention",
  "primary_action",
] as const satisfies readonly AdminClinicDirectoryColumn[];

function searchValue(
  clinic: AdminClinicDirectoryRecord,
  field: AdminClinicDirectorySearchField,
): string | null | undefined {
  if (field === "name") return clinic.name;
  if (field === "city") return clinic.city;
  if (field === "email") return clinic.email;
  if (field === "plan") return clinic.plan;
  if (field === "currentAccessPlan") return clinic.currentAccessPlan;
  if (field === "assignedPlan") return clinic.assignedPlan;
  return clinic.currentAccessState;
}

export function matchesAdminClinicDirectorySearch(
  clinic: AdminClinicDirectoryRecord,
  query: string,
  fields: readonly AdminClinicDirectorySearchField[] = ADMIN_CLINIC_DIRECTORY_SEARCH_FIELDS,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;

  return fields.some(field => String(searchValue(clinic, field) ?? "").toLocaleLowerCase().includes(needle));
}

/**
 * Directory filtering delegates to the shared lifecycle/access policy so
 * archived, pending, Trial, paid, sponsored, exception, and unknown records
 * have one interpretation across Super Admin workspaces.
 */
export function matchesAdminClinicDirectoryFilter(
  clinic: AdminClinicDirectoryRecord,
  filter: AdminClinicDirectoryFilter,
): boolean {
  return matchesAdminClinicFilter(clinic, filter);
}

export type AdminClinicDirectoryMobileRow = {
  clinicId: number;
  primaryLabel: string;
  secondaryLabel: string | null;
  lifecycle: AdminClinicLifecycleState;
};