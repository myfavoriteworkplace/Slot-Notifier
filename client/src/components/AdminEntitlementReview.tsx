import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gift,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import type { Clinic } from "@shared/schema";
import type { EffectiveEntitlementItem, EffectiveEntitlementReport } from "@shared/effective-entitlement";
import {
  ADMIN_CLINIC_DIRECTORY_DEFAULT_FILTER,
  ADMIN_CLINIC_DIRECTORY_FILTER_OPTIONS,
  matchesAdminClinicDirectoryFilter,
  matchesAdminClinicDirectorySearch,
  type AdminClinicDirectoryFilter,
  type AdminClinicDirectoryRecord,
} from "@shared/admin-clinic-directory";
import { getAdminClinicLifecycleState } from "@shared/admin-operations";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ClinicControlCenter from "@/components/ClinicControlCenter";

const CAPABILITY_LABELS: Record<string, string> = {
  bookings: "Bookings",
  active_doctors: "Active doctors",
  smile_deals: "Live Smile Deals",
  storage: "Storage",
  messaging_sms: "SMS",
  messaging_whatsapp: "WhatsApp",
  messaging_email: "Email",
  analytics: "Analytics",
  export: "Data export",
  inventory: "Inventory",
  pharmacy: "Pharmacy",
  website: "Clinic website",
  support: "Support",
  public_profile: "Public profile",
  verified_badge: "Verified badge",
  featured_deal_placement: "Featured deal placement",
  essential_whatsapp: "Essential WhatsApp",
  routine_whatsapp: "Routine WhatsApp",
  bulk_whatsapp: "Bulk WhatsApp",
  promotional_whatsapp: "Promotional WhatsApp",
  advanced_whatsapp: "Advanced WhatsApp",
};

const USAGE_CAPABILITIES = new Set([
  "bookings",
  "active_doctors",
  "smile_deals",
  "storage",
  "messaging_sms",
  "messaging_whatsapp",
  "messaging_email",
]);

type AccessAction = "sponsored" | "exception";
type SubscriptionHistory = {
  lifecycleEvents: Array<{
    id: number;
    eventType: string;
    fromPlan: string | null;
    toPlan: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    actorType: string;
    reason: string | null;
    effectiveAt: string;
  }>;
  assignments: Array<{ id: number; plan: string; billingCycle: string; source: string; reason: string | null; startsAt: string; endsAt: string | null }>;
  grants: Array<{ id: number; grantId: string; plan: string; reason: string; startsAt: string; endsAt: string; revokedAt: string | null }>;
  exceptions: Array<{ id: number; exceptionId: string; entitlementKey: string; overrideValue: unknown; reason: string; startsAt: string; endsAt: string; revokedAt: string | null }>;
  providerEvents?: Array<{
    id: number;
    clinicId: number | null;
    provider: string;
    subscriptionId: string | null;
    eventId: string | null;
    eventType: string;
    processingStatus: string;
    details: Record<string, unknown> | null;
    occurredAt: string | null;
    receivedAt: string | null;
  }>;
};

type RevokeTarget = {
  kind: "sponsored_access" | "entitlement_exception";
  id: string;
  label: string;
};

type AccessHistoryEntry = {
  id: string;
  kind: "lifecycle" | "assignment" | "sponsored" | "exception" | "provider";
  title: string;
  occurredAt: string | null;
  detail: string;
  reason: string | null;
  status: string | null;
  revokeTarget?: RevokeTarget;
};

const formatBytes = (value: number | null) => {
  if (value === null) return "—";
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatNumber = (value: number | null) => value === null ? "—" : value.toLocaleString("en-IN");

const formatDate = (value: string | null) => {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

const labelFor = (value: string | null | undefined) => {
  if (!value) return "—";
  if (value === "active_paid") return "Active Paid";
  if (value === "sponsored") return "Sponsored Access";
  return value.replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
};

const guidanceClass = (action: EffectiveEntitlementReport["nextStep"]["action"]) => {
  if (action === "contact_support") {
    return "border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20";
  }
  if (action === "view_plans") {
    return "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20";
  }
  return "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20";
};

const sourceLabel = (source: EffectiveEntitlementItem["source"]) => ({
  plan: "Published plan",
  sponsored_access: "Sponsored access",
  exception: "Temporary exception",
  unknown: "Unknown",
}[source]);

const historyDateValue = (value: string | null) => value ? new Date(value).getTime() : 0;

const temporalHistoryStatus = (startsAt: string, endsAt: string | null, revokedAt: string | null) => {
  if (revokedAt) return "Revoked";
  const now = Date.now();
  if (historyDateValue(startsAt) > now) return "Scheduled";
  if (endsAt && historyDateValue(endsAt) <= now) return "Ended";
  return "Active";
};

const formatOverrideValue = (value: unknown) => {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "number" || typeof value === "string") return String(value);
  return "Recorded";
};

const historyStatusClass = (status: string | null) => {
  if (status === "Active" || status === "Applied") return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300";
  if (status === "Scheduled" || status === "Received") return "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300";
  if (status === "Revoked" || status === "Failed" || status === "Unmatched") return "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300";
  return "text-muted-foreground";
};

function CapabilityValue({ item }: { item: EffectiveEntitlementItem }) {
  if (item.capability === "storage") return <>{formatBytes(item.value as number | null)}</>;
  if (typeof item.value === "boolean") return <>{item.value ? "Included" : "Not included"}</>;
  if (typeof item.value === "string") return <>{labelFor(item.value)}</>;
  if (item.fairUse) return <>Fair use</>;
  return <>{formatNumber(item.value as number | null)}</>;
}

function UsageValue({ item }: { item: EffectiveEntitlementItem }) {
  if (!item.usage?.available) return <span className="text-muted-foreground">Unavailable</span>;
  if (item.capability === "storage") return <>{formatBytes(item.usage.value)}</>;
  return <>{formatNumber(item.usage.value)}</>;
}

export default function AdminEntitlementReview({
  clinics,
  clinicsLoading = false,
  clinicsError = false,
  onRetryClinics,
  onEditClinic,
  onManageCredentials,
  onCopyClinicUrl,
  onArchiveClinic,
  onRestoreClinic,
}: {
  clinics: Clinic[];
  clinicsLoading?: boolean;
  clinicsError?: boolean;
  onRetryClinics?: () => void;
  onEditClinic?: (clinic: Clinic) => void;
  onManageCredentials?: (clinic: Clinic) => void;
  onCopyClinicUrl?: (clinic: Clinic, kind: "book" | "about") => void;
  onArchiveClinic?: (clinic: Clinic) => void;
  onRestoreClinic?: (clinic: Clinic) => void;
}) {
  const [search, setSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState<AdminClinicDirectoryFilter>(ADMIN_CLINIC_DIRECTORY_DEFAULT_FILTER);
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialAction, setTrialAction] = useState<"start" | "extend">("start");
  const [trialReason, setTrialReason] = useState("");
  const [extensionDays, setExtensionDays] = useState("7");
  const [paidDialogOpen, setPaidDialogOpen] = useState(false);
  const [paidPlan, setPaidPlan] = useState<"starter" | "growth" | "pro">("starter");
  const [paidBillingCycle, setPaidBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [paidReason, setPaidReason] = useState("");
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessAction, setAccessAction] = useState<AccessAction>("sponsored");
  const [accessPlan, setAccessPlan] = useState<"starter" | "growth" | "pro">("growth");
  const [accessEntitlement, setAccessEntitlement] = useState("bookings");
  const [accessOverrideValue, setAccessOverrideValue] = useState("true");
  const [accessStartsAt, setAccessStartsAt] = useState("");
  const [accessEndsAt, setAccessEndsAt] = useState("");
  const [accessReason, setAccessReason] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const queryClient = useQueryClient();
  const selectedClinic = clinics.find(clinic => clinic.id === selectedClinicId) ?? null;

  const reportQuery = useQuery<EffectiveEntitlementReport>({
    queryKey: ["/api/admin/clinics", selectedClinicId, "entitlements"],
    queryFn: async () => (await apiRequest("GET", `/api/admin/clinics/${selectedClinicId}/entitlements`)).json(),
    enabled: selectedClinicId !== null,
    staleTime: 30_000,
    retry: 1,
  });

  const historyQuery = useQuery<SubscriptionHistory>({
    queryKey: ["/api/admin/clinics", selectedClinicId, "subscription-history"],
    queryFn: async () => (await apiRequest("GET", `/api/admin/clinics/${selectedClinicId}/subscription-history`)).json(),
    enabled: selectedClinicId !== null,
    staleTime: 30_000,
    retry: 1,
  });

  const filteredClinics = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return clinics
      .filter(clinic => matchesAdminClinicDirectoryFilter(clinic, clinicFilter))
      .filter(clinic => matchesAdminClinicDirectorySearch(clinic as AdminClinicDirectoryRecord, needle));
  }, [clinicFilter, clinics, search]);

  useEffect(() => {
    setSelectedClinicId(currentId => {
      if (filteredClinics.some(clinic => clinic.id === currentId)) return currentId;
      return filteredClinics[0]?.id ?? null;
    });
  }, [filteredClinics]);

  const numericCapabilities = reportQuery.data?.capabilities.filter(item => USAGE_CAPABILITIES.has(item.capability)) ?? [];
  const featureCapabilities = reportQuery.data?.capabilities.filter(item => !USAGE_CAPABILITIES.has(item.capability)) ?? [];
  const attentionCount = reportQuery.data?.capabilities.filter(item => item.overLimit === true).length ?? 0;
  const report = reportQuery.data;
  const hasTrialHistory = Boolean(report?.access.trialStartedAt && report.plan.effective === "trial");
  const historyEntries = useMemo<AccessHistoryEntry[]>(() => {
    const data = historyQuery.data;
    if (!data) return [];

    const entries: AccessHistoryEntry[] = [
      ...data.lifecycleEvents.map(event => ({
        id: `lifecycle-${event.id}`,
        kind: "lifecycle" as const,
        title: labelFor(event.eventType),
        occurredAt: event.effectiveAt,
        detail: [
          [event.fromPlan && `${labelFor(event.fromPlan)} →`, event.toPlan && labelFor(event.toPlan)].filter(Boolean).join(" "),
          event.toStatus && `Status: ${labelFor(event.toStatus)}`,
          `Actor: ${labelFor(event.actorType)}`,
        ].filter(Boolean).join(" · "),
        reason: event.reason,
        status: "Recorded",
      })),
      ...data.assignments.map(assignment => ({
        id: `assignment-${assignment.id}`,
        kind: "assignment" as const,
        title: `Plan assignment · ${labelFor(assignment.plan)}`,
        occurredAt: assignment.startsAt,
        detail: [
          assignment.source && `Source: ${labelFor(assignment.source)}`,
          assignment.billingCycle && `Billing: ${labelFor(assignment.billingCycle)}`,
          assignment.endsAt && `Ends ${formatDate(assignment.endsAt)}`,
        ].filter(Boolean).join(" · "),
        reason: assignment.reason,
        status: temporalHistoryStatus(assignment.startsAt, assignment.endsAt, null),
      })),
      ...data.grants.map(grant => ({
        id: `grant-${grant.id}`,
        kind: "sponsored" as const,
        title: `Sponsored access · ${labelFor(grant.plan)}`,
        occurredAt: grant.startsAt,
        detail: grant.revokedAt
          ? `Started ${formatDate(grant.startsAt)} · Revoked ${formatDate(grant.revokedAt)}`
          : `Ends ${formatDate(grant.endsAt)}`,
        reason: grant.reason,
        status: temporalHistoryStatus(grant.startsAt, grant.endsAt, grant.revokedAt),
        revokeTarget: {
          kind: "sponsored_access" as const,
          id: grant.grantId,
          label: `Sponsored ${labelFor(grant.plan)}`,
        },
      })),
      ...data.exceptions.map(exception => ({
        id: `exception-${exception.id}`,
        kind: "exception" as const,
        title: `Entitlement exception · ${labelFor(exception.entitlementKey)}`,
        occurredAt: exception.startsAt,
        detail: exception.revokedAt
          ? `Override: ${formatOverrideValue(exception.overrideValue)} · Started ${formatDate(exception.startsAt)} · Revoked ${formatDate(exception.revokedAt)}`
          : `Override: ${formatOverrideValue(exception.overrideValue)} · Ends ${formatDate(exception.endsAt)}`,
        reason: exception.reason,
        status: temporalHistoryStatus(exception.startsAt, exception.endsAt, exception.revokedAt),
        revokeTarget: {
          kind: "entitlement_exception" as const,
          id: exception.exceptionId,
          label: `Exception · ${labelFor(exception.entitlementKey)}`,
        },
      })),
      ...(data.providerEvents ?? []).map(event => ({
        id: `provider-${event.id}`,
        kind: "provider" as const,
        title: `Provider event · ${event.eventType.replaceAll(".", " ")}`,
        occurredAt: event.receivedAt ?? event.occurredAt,
        detail: [
          labelFor(event.provider),
          event.subscriptionId && `Subscription: ${event.subscriptionId}`,
          event.eventId && `Event: ${event.eventId}`,
        ].filter(Boolean).join(" · "),
        reason: event.details ? `Provider payload recorded (${Object.keys(event.details).length} fields)` : null,
        status: event.processingStatus === "applied"
          ? "Applied"
          : event.processingStatus === "unmatched"
            ? "Unmatched"
            : labelFor(event.processingStatus),
      })),
    ];

    return entries.sort((a, b) => historyDateValue(b.occurredAt) - historyDateValue(a.occurredAt) || b.id.localeCompare(a.id));
  }, [historyQuery.data]);

  const refreshSubscriptionQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
    await Promise.all([reportQuery.refetch(), historyQuery.refetch()]);
  };

  const trialMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null) throw new Error("Select a clinic first");
      const response = await apiRequest("POST", `/api/admin/clinics/${selectedClinicId}/trial`, {
        action: trialAction,
        reason: trialReason.trim(),
        extensionDays: trialAction === "extend" ? Number(extensionDays) : undefined,
        transitionId: crypto.randomUUID(),
      });
      return response.json();
    },
    onSuccess: async () => {
      setTrialDialogOpen(false);
      setTrialReason("");
      notify.success(trialAction === "start" ? "Trial started" : "Trial extended", {
        description: `${selectedClinic?.name || "Clinic"} now has an audited Trial lifecycle record.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      await reportQuery.refetch();
    },
    onError: (error: Error) => notify.error(error.message || "Could not update Trial"),
  });

  const paidPlanMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null) throw new Error("Select a clinic first");
      const response = await apiRequest("POST", `/api/admin/clinics/${selectedClinicId}/paid-plan`, {
        plan: paidPlan,
        billingCycle: paidBillingCycle,
        reason: paidReason.trim(),
        transitionId: crypto.randomUUID(),
      });
      return response.json();
    },
    onSuccess: async (result) => {
      setPaidDialogOpen(false);
      setPaidReason("");
      notify.success("Paid plan assignment prepared", {
        description: result.activationUrl
          ? `The clinic is pending payment. Activation link: ${result.activationUrl}`
          : "The clinic is pending payment and the provider activation link is not available.",
      });
      await refreshSubscriptionQueries();
    },
    onError: (error: Error) => notify.error(error.message || "Could not assign paid plan"),
  });

  const accessMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null) throw new Error("Select a clinic first");
      if (!accessEndsAt) throw new Error("Choose an end date");
      const payload = {
        startsAt: accessStartsAt ? new Date(accessStartsAt).toISOString() : undefined,
        endsAt: new Date(accessEndsAt).toISOString(),
        reason: accessReason.trim(),
      };
      const path = accessAction === "sponsored"
        ? `/api/admin/clinics/${selectedClinicId}/sponsored-access`
        : `/api/admin/clinics/${selectedClinicId}/entitlement-exceptions`;
      const body = accessAction === "sponsored"
        ? { ...payload, plan: accessPlan, grantId: crypto.randomUUID() }
        : { ...payload, entitlementKey: accessEntitlement, overrideValue: accessOverrideValue === "true" ? true : accessOverrideValue === "false" ? false : Number(accessOverrideValue) || accessOverrideValue, exceptionId: crypto.randomUUID() };
      const response = await apiRequest("POST", path, body);
      return response.json();
    },
    onSuccess: async () => {
      setAccessDialogOpen(false);
      setAccessReason("");
      setAccessStartsAt("");
      setAccessEndsAt("");
      notify.success(accessAction === "sponsored" ? "Sponsored access granted" : "Entitlement exception granted");
      await refreshSubscriptionQueries();
    },
    onError: (error: Error) => notify.error(error.message || "Could not grant access"),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null || !revokeTarget) throw new Error("Select an access record first");
      const path = revokeTarget.kind === "sponsored_access"
        ? `/api/admin/clinics/${selectedClinicId}/sponsored-access/${revokeTarget.id}/revoke`
        : `/api/admin/clinics/${selectedClinicId}/entitlement-exceptions/${revokeTarget.id}/revoke`;
      const response = await apiRequest("POST", path, {
        reason: revokeReason.trim(),
        transitionId: crypto.randomUUID(),
      });
      return response.json();
    },
    onSuccess: async () => {
      setRevokeTarget(null);
      setRevokeReason("");
      notify.success("Temporary access revoked", {
        description: "The revocation was recorded in subscription history.",
      });
      await refreshSubscriptionQueries();
    },
    onError: (error: Error) => notify.error(error.message || "Could not revoke temporary access"),
  });

  const openTrialDialog = (action: "start" | "extend") => {
    setTrialAction(action);
    setTrialReason("");
    setExtensionDays("7");
    setTrialDialogOpen(true);
  };

  const openAccessDialog = (action: AccessAction) => {
    setAccessAction(action);
    setAccessReason("");
    setAccessStartsAt("");
    setAccessEndsAt("");
    setAccessDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Clinics & Access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find a clinic once, then review its profile context, effective access, usage, limits, and audited history in one workspace.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.8fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Clinic directory</CardTitle>
            <CardDescription>{filteredClinics.length} clinic{filteredClinics.length === 1 ? "" : "s"} match the current view</CardDescription>
            <div className="relative pt-2">
              <Search className="pointer-events-none absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search name, city, email, or plan"
                className="h-8 pl-8 text-xs"
                aria-label="Search Clinics and Access directory"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <select
                value={clinicFilter}
                onChange={event => setClinicFilter(event.target.value as AdminClinicDirectoryFilter)}
                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                aria-label="Filter Clinics and Access directory"
              >
                {ADMIN_CLINIC_DIRECTORY_FILTER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="max-h-[620px] space-y-2 overflow-y-auto pt-0">
            {clinicsError && (
              <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/15 dark:text-red-300" role="alert">
                <p className="font-semibold">Clinic directory unavailable.</p>
                {onRetryClinics && <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onRetryClinics} disabled={clinicsLoading}>Retry clinics</Button>}
              </div>
            )}
            {clinicsLoading && <p className="py-8 text-center text-xs text-muted-foreground">Loading clinics…</p>}
            {filteredClinics.map(clinic => (
              <button
                key={clinic.id}
                type="button"
                onClick={() => setSelectedClinicId(clinic.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedClinicId === clinic.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                data-testid={`button-review-entitlements-${clinic.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-semibold">{clinic.name}</span>
                  <span className="shrink-0 text-[10px] capitalize text-muted-foreground">{clinic.plan || "No plan"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {clinic.city && <span className="truncate">{clinic.city}</span>}
                  <span className="capitalize">{getAdminClinicLifecycleState(clinic)}</span>
                  <span className="capitalize">{clinic.subscriptionStatus || "state unavailable"}</span>
                </div>
              </button>
            ))}
            {!filteredClinics.length && <p className="py-8 text-center text-xs text-muted-foreground">No clinics match this search.</p>}
          </CardContent>
        </Card>

        {!selectedClinic && (
          <Card className="flex min-h-[320px] items-center justify-center">
            <CardContent className="max-w-sm text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-primary/50" />
              <h3 className="mt-3 text-sm font-semibold">Select a clinic to review access</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The report is read-only and explains the published plan, subscription attention state, usage, limits, and temporary access sources.
              </p>
            </CardContent>
          </Card>
        )}

        {selectedClinic && (
          <div className="min-w-0 space-y-4">
             <ClinicControlCenter
               clinic={selectedClinic}
               report={report}
               attentionCount={attentionCount}
               hasTrialHistory={hasTrialHistory}
               reportLoading={reportQuery.isLoading}
               reportError={reportQuery.isError}
               onRetryReport={() => reportQuery.refetch()}
               onStartTrial={() => openTrialDialog(hasTrialHistory ? "extend" : "start")}
               onAssignPaidPlan={() => setPaidDialogOpen(true)}
               onOpenAccessDialog={openAccessDialog}
               onCopyClinicUrl={onCopyClinicUrl}
               onEditClinic={onEditClinic}
               onManageCredentials={onManageCredentials}
               onArchiveClinic={onArchiveClinic}
               onRestoreClinic={onRestoreClinic}
             />

            {reportQuery.isFetching && report && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300" role="status">
                Refreshing the entitlement report; the displayed values are from the previous successful report until the refresh completes.
              </div>
            )}
            {report && (
              <>
                <Card className={guidanceClass(report.nextStep.action)} data-testid={`admin-access-guidance-${selectedClinic.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {report.nextStep.action === "contact_support"
                        ? <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                        : report.nextStep.action === "view_plans"
                          ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          : <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                      Access guidance
                    </CardTitle>
                    <CardDescription>Server-derived guidance for the clinic’s current access state.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <div>
                      <p className="text-sm font-semibold">{report.nextStep.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.nextStep.description}</p>
                    </div>
                    {(report.access.trialOrigin || report.access.previousPaidPlan) && (
                      <div className="rounded-md border border-current/10 bg-background/60 px-3 py-2 text-xs">
                        <p className="font-semibold">Recovery context</p>
                        <p className="mt-1 text-muted-foreground">
                          {[
                            report.access.trialOrigin && `Origin: ${labelFor(report.access.trialOrigin)}`,
                            report.access.previousPaidPlan && `Previous paid plan: ${labelFor(report.access.previousPaidPlan)}`,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {(report.access.trialEndsAt || report.access.trialGraceEndsAt || report.access.paidAccessExpiresAt || report.grants.endsAt) && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4" />Important dates</CardTitle></CardHeader>
                    <CardContent className="grid gap-2 text-xs sm:grid-cols-2">
                      {report.access.trialEndsAt && <div className="rounded-lg border p-3"><span className="text-muted-foreground">Trial ends</span><strong className="mt-1 block">{formatDate(report.access.trialEndsAt)}</strong></div>}
                      {report.access.trialGraceEndsAt && <div className="rounded-lg border p-3"><span className="text-muted-foreground">Trial grace ends</span><strong className="mt-1 block">{formatDate(report.access.trialGraceEndsAt)}</strong></div>}
                      {report.access.paidAccessExpiresAt && <div className="rounded-lg border p-3"><span className="text-muted-foreground">Paid access expires</span><strong className="mt-1 block">{formatDate(report.access.paidAccessExpiresAt)}</strong></div>}
                      {report.grants.endsAt && <div className="rounded-lg border p-3"><span className="text-muted-foreground">Sponsored access ends</span><strong className="mt-1 block">{formatDate(report.grants.endsAt)}</strong></div>}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4" />Access history</CardTitle>
                    <CardDescription>One chronological view of lifecycle, plan, temporary access, exception, and provider records. Records are append-only.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historyQuery.isLoading && <p className="text-xs text-muted-foreground">Loading access history…</p>}
                    {historyQuery.isError && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-red-600 dark:text-red-400">
                        <span>Access history is unavailable.</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => historyQuery.refetch()} disabled={historyQuery.isFetching}>Retry history</Button>
                      </div>
                    )}
                    {historyQuery.isFetching && historyQuery.data && (
                      <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300" role="status">
                        Refreshing access history; the displayed records may be delayed.
                      </p>
                    )}
                    {historyQuery.data && historyEntries.length === 0 && <p className="text-xs text-muted-foreground">No access history has been recorded for this clinic.</p>}
                    {historyQuery.data && historyEntries.length > 0 && (
                      <div className="space-y-2" data-testid={`admin-access-history-${selectedClinic.id}`}>
                        {historyEntries.map(entry => (
                          <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{entry.title}</span>
                                <Badge variant="outline" className={`text-[10px] ${historyStatusClass(entry.status)}`}>{entry.status || "Recorded"}</Badge>
                                <Badge variant="secondary" className="text-[10px] capitalize">{entry.kind.replace("_", " ")}</Badge>
                              </div>
                              <p className="mt-1 text-muted-foreground">{entry.detail || "No additional details recorded."}</p>
                              {entry.reason && <p className="mt-1 leading-5">{entry.reason}</p>}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <time className="text-[10px] text-muted-foreground">{entry.occurredAt ? formatDate(entry.occurredAt) : "Date unavailable"}</time>
                              {entry.revokeTarget && entry.status === "Active" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px]"
                                  onClick={() => { setRevokeTarget(entry.revokeTarget!); setRevokeReason(""); }}
                                >
                                  <XCircle className="mr-1 h-3 w-3" />Revoke
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" />Usage and limits</CardTitle>
                    <CardDescription>Measured in {report.timezone}. Unavailable values are not treated as zero.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2">
                    {numericCapabilities.map(item => (
                      <div key={item.capability} className={`rounded-lg border p-3 ${item.overLimit ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold">{CAPABILITY_LABELS[item.capability] || labelFor(item.capability)}</span>
                          {item.overLimit ? <XCircle className="h-3.5 w-3.5 text-amber-600" /> : item.usage?.available ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-2">
                          <span className="text-lg font-bold"><UsageValue item={item} /></span>
                          <span className="text-[11px] text-muted-foreground">of <CapabilityValue item={item} /></span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.remaining !== null ? `${item.capability === "storage" ? formatBytes(item.remaining) : formatNumber(item.remaining)} remaining` : item.reasonCode === "USAGE_UNAVAILABLE" ? "Usage unavailable" : labelFor(item.reasonCode)}
                          {" · "}{sourceLabel(item.source)}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4" />Included features</CardTitle></CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2">
                    {featureCapabilities.map(item => (
                      <div key={item.capability} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs">
                        <span className="font-medium">{CAPABILITY_LABELS[item.capability] || labelFor(item.capability)}</span>
                        <span className={`inline-flex items-center gap-1 font-semibold ${item.enabled === false ? "text-muted-foreground" : item.source === "exception" ? "text-amber-700 dark:text-amber-300" : item.enabled === null ? "text-slate-600" : "text-emerald-700 dark:text-emerald-300"}`}>
                          {item.enabled === false ? <XCircle className="h-3.5 w-3.5" /> : item.enabled === null ? <ShieldAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {item.enabled === false ? "Not included" : item.enabled === null ? "Unknown" : typeof item.value === "string" ? labelFor(item.value) : "Included"}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Every Admin action requires a reason and writes an append-only lifecycle record. Paid assignment remains pending payment until provider activation. These controls do not enforce limits.
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {trialAction === "start" ? "Start Trial" : "Extend Trial"}
            </DialogTitle>
            <DialogDescription>
              {trialAction === "start"
                ? `${selectedClinic?.name || "This clinic"} will receive the published 14-day Trial policy.`
                : `${selectedClinic?.name || "This clinic"} will receive additional Trial time without restarting its Trial history.`}
              {" "}This does not create or change a Razorpay subscription.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {trialAction === "extend" && (
              <div className="space-y-2">
                <label htmlFor="trial-extension-days" className="text-sm font-semibold">Additional days</label>
                <Input
                  id="trial-extension-days"
                  type="number"
                  min={1}
                  max={30}
                  value={extensionDays}
                  onChange={event => setExtensionDays(event.target.value)}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">Choose between 1 and 30 days. The grace date moves with the Trial end date.</p>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="trial-reason" className="text-sm font-semibold">Reason <span className="text-destructive">*</span></label>
              <Textarea
                id="trial-reason"
                value={trialReason}
                onChange={event => setTrialReason(event.target.value)}
                placeholder="Record why this Trial access is being granted or extended."
                maxLength={500}
                className="min-h-[100px] text-sm"
              />
              <p className="text-xs text-muted-foreground">{trialReason.trim().length}/10 minimum characters · {trialReason.length}/500</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTrialDialogOpen(false)} disabled={trialMutation.isPending}>Cancel</Button>
            <Button
              onClick={() => trialMutation.mutate()}
              disabled={trialMutation.isPending || trialReason.trim().length < 10 || (trialAction === "extend" && (!Number.isInteger(Number(extensionDays)) || Number(extensionDays) < 1 || Number(extensionDays) > 30))}
            >
              {trialMutation.isPending ? "Saving…" : trialAction === "start" ? "Start Trial" : "Extend Trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paidDialogOpen} onOpenChange={setPaidDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Assign paid plan</DialogTitle>
            <DialogDescription>
              This prepares a provider activation and records the assignment as pending payment. It does not mark the clinic as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="paid-plan" className="text-sm font-semibold">Plan</label>
              <select id="paid-plan" value={paidPlan} onChange={event => setPaidPlan(event.target.value as typeof paidPlan)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="paid-cycle" className="text-sm font-semibold">Billing cycle</label>
              <select id="paid-cycle" value={paidBillingCycle} onChange={event => setPaidBillingCycle(event.target.value as typeof paidBillingCycle)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="paid-reason" className="text-sm font-semibold">Reason <span className="text-destructive">*</span></label>
              <Textarea id="paid-reason" value={paidReason} onChange={event => setPaidReason(event.target.value)} placeholder="Record why this paid plan is being assigned." maxLength={500} className="min-h-[100px] text-sm" />
              <p className="text-xs text-muted-foreground">{paidReason.trim().length}/10 minimum characters · {paidReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidDialogOpen(false)} disabled={paidPlanMutation.isPending}>Cancel</Button>
            <Button onClick={() => paidPlanMutation.mutate()} disabled={paidPlanMutation.isPending || paidReason.trim().length < 10}>
              {paidPlanMutation.isPending ? "Preparing…" : "Assign and prepare payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {accessAction === "sponsored" ? <Gift className="h-5 w-5 text-primary" /> : <SlidersHorizontal className="h-5 w-5 text-primary" />}
              {accessAction === "sponsored" ? "Grant sponsored access" : "Grant entitlement exception"}
            </DialogTitle>
            <DialogDescription>
              This is temporary complimentary access and is kept separate from paid subscription status.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {accessAction === "sponsored" ? (
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="sponsored-plan" className="text-sm font-semibold">Effective plan</label>
                <select id="sponsored-plan" value={accessPlan} onChange={event => setAccessPlan(event.target.value as typeof accessPlan)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            ) : (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="exception-key" className="text-sm font-semibold">Entitlement</label>
                  <select id="exception-key" value={accessEntitlement} onChange={event => setAccessEntitlement(event.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    {["bookings", "active_doctors", "smile_deals", "storage", "messaging_sms", "messaging_whatsapp", "messaging_email", "analytics", "export"].map(key => <option key={key} value={key}>{labelFor(key)}</option>)}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="exception-value" className="text-sm font-semibold">Override value</label>
                  <Input id="exception-value" value={accessOverrideValue} onChange={event => setAccessOverrideValue(event.target.value)} placeholder="true, false, or a number" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <label htmlFor="access-start" className="text-sm font-semibold">Starts</label>
              <Input id="access-start" type="datetime-local" value={accessStartsAt} onChange={event => setAccessStartsAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="access-end" className="text-sm font-semibold">Ends <span className="text-destructive">*</span></label>
              <Input id="access-end" type="datetime-local" value={accessEndsAt} onChange={event => setAccessEndsAt(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="access-reason" className="text-sm font-semibold">Reason <span className="text-destructive">*</span></label>
              <Textarea id="access-reason" value={accessReason} onChange={event => setAccessReason(event.target.value)} placeholder="Record why this temporary access is being granted." maxLength={500} className="min-h-[100px] text-sm" />
              <p className="text-xs text-muted-foreground">{accessReason.trim().length}/10 minimum characters · {accessReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialogOpen(false)} disabled={accessMutation.isPending}>Cancel</Button>
            <Button onClick={() => accessMutation.mutate()} disabled={accessMutation.isPending || accessReason.trim().length < 10 || !accessEndsAt}>
              {accessMutation.isPending ? "Saving…" : accessAction === "sponsored" ? "Grant sponsored access" : "Grant exception"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeTarget)} onOpenChange={open => { if (!open && !revokeMutation.isPending) { setRevokeTarget(null); setRevokeReason(""); } }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" />Revoke temporary access</DialogTitle>
            <DialogDescription>
              Revoke {revokeTarget?.label || "this access record"} for {selectedClinic?.name || "this clinic"}. The paid subscription and clinic data will not be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="revoke-reason" className="text-sm font-semibold">Reason <span className="text-destructive">*</span></label>
            <Textarea
              id="revoke-reason"
              value={revokeReason}
              onChange={event => setRevokeReason(event.target.value)}
              placeholder="Record why this temporary access is being revoked."
              maxLength={500}
              className="min-h-[100px] text-sm"
            />
            <p className="text-xs text-muted-foreground">{revokeReason.trim().length}/10 minimum characters · {revokeReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevokeTarget(null); setRevokeReason(""); }} disabled={revokeMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => revokeMutation.mutate()} disabled={revokeMutation.isPending || revokeReason.trim().length < 10}>
              {revokeMutation.isPending ? "Revoking…" : "Revoke access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}