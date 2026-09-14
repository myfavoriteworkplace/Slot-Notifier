import {
  ADMIN_CLINIC_FILTERS,
  matchesAdminClinicFilter,
  type AdminClinicFilter,
  type AdminClinicFilterRecord,
  type AdminClinicLifecycleState,
} from "./admin-operations";

/**
 * The server-backed summary required by the shared Clinics & Access directory.
 *
 * Entitlement-specific fields remain optional because the base clinic list does
 * not load every clinic's effective access report. Missing access context must
 * remain unknown rather than being inferred in the browser.
 */
export type AdminClinicDirectoryRecord = AdminClinicFilterRecord & {
  id: number;
  name: string;
  city?: string | null;
  email?: string | null;
};

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
  return clinic.plan;
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