import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  CreditCard,
  Gift,
  History,
  Play,
  Plus,
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
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

type ClinicFilter = "all" | "attention" | "trial" | "paid";
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
  assignments: Array<{ id: number; plan: string; billingCycle: string; source: string; startsAt: string; endsAt: string | null }>;
  grants: Array<{ id: number; plan: string; reason: string; startsAt: string; endsAt: string; revokedAt: string | null }>;
  exceptions: Array<{ id: number; entitlementKey: string; reason: string; startsAt: string; endsAt: string; revokedAt: string | null }>;
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

const labelFor = (value: string | null | undefined) =>
  value ? value.replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase()) : "—";

const statusClass = (state: EffectiveEntitlementReport["access"]["state"]) => {
  if (state === "active_paid" || state === "trial") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
  if (state === "unknown") {
    return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
};

const sourceLabel = (source: EffectiveEntitlementItem["source"]) => ({
  plan: "Published plan",
  sponsored_access: "Sponsored access",
  exception: "Temporary exception",
  unknown: "Unknown",
}[source]);

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

export default function AdminEntitlementReview({ clinics }: { clinics: Clinic[] }) {
  const [search, setSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState<ClinicFilter>("all");
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
      .filter(clinic => !clinic.isArchived)
      .filter(clinic => {
        const plan = String(clinic.plan || "").toLowerCase();
        const status = String(clinic.subscriptionStatus || "").toLowerCase();
        if (clinicFilter === "trial") return plan === "trial" || status === "trialing" || status === "trial";
        if (clinicFilter === "paid") return ["starter", "growth", "pro"].includes(plan) && ["active", "manual_override"].includes(status);
        if (clinicFilter === "attention") return !["active", "trialing", "trial"].includes(status);
        return true;
      })
      .filter(clinic => !needle || [clinic.name, clinic.city, clinic.email, clinic.plan]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle)));
  }, [clinicFilter, clinics, search]);

  const numericCapabilities = reportQuery.data?.capabilities.filter(item => USAGE_CAPABILITIES.has(item.capability)) ?? [];
  const featureCapabilities = reportQuery.data?.capabilities.filter(item => !USAGE_CAPABILITIES.has(item.capability)) ?? [];
  const attentionCount = reportQuery.data?.capabilities.filter(item => item.overLimit === true).length ?? 0;
  const report = reportQuery.data;
  const hasTrialHistory = Boolean(report?.access.trialStartedAt && report.plan.effective === "trial");

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
        <h2 className="text-xl font-bold tracking-tight">Subscription plans & entitlements</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and manage audited plan access without enabling commercial enforcement.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.8fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Clinic subscriptions</CardTitle>
            <CardDescription>{filteredClinics.length} clinic{filteredClinics.length === 1 ? "" : "s"} available for review</CardDescription>
            <div className="relative pt-2">
              <Search className="pointer-events-none absolute left-2.5 top-4 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search clinics"
                className="h-8 pl-8 text-xs"
                aria-label="Search clinics for entitlement review"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <select
                value={clinicFilter}
                onChange={event => setClinicFilter(event.target.value as ClinicFilter)}
                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                aria-label="Filter subscription clinics"
              >
                <option value="all">All clinics</option>
                <option value="attention">Needs attention</option>
                <option value="trial">Trial</option>
                <option value="paid">Active paid</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="max-h-[620px] space-y-2 overflow-y-auto pt-0">
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
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {[clinic.city, clinic.subscriptionStatus || "state unavailable"].filter(Boolean).join(" · ")}
                </p>
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
            {reportQuery.isLoading && (
              <Card><CardContent className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">Loading entitlement report…</CardContent></Card>
            )}
            {reportQuery.isError && (
              <Card className="border-red-200 dark:border-red-900">
                <CardContent className="flex items-start gap-3 p-5 text-sm text-red-700 dark:text-red-300">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold">Entitlement report unavailable</p>
                    <p className="mt-1 text-xs">The clinic can remain unchanged while this read-only report is unavailable.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => reportQuery.refetch()} disabled={reportQuery.isFetching}>
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${reportQuery.isFetching ? "animate-spin" : ""}`} />Retry
                  </Button>
                </CardContent>
              </Card>
            )}
            {report && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Database className="h-4 w-4 text-primary" />{selectedClinic.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {selectedClinic.city || "Clinic"} · measured {formatDate(report.measuredAt)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Badge variant="outline" className={`capitalize ${statusClass(report.access.state)}`}>
                          {report.access.state === "attention" ? <AlertTriangle className="mr-1 h-3 w-3" /> : report.access.state === "unknown" ? <ShieldAlert className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                          {labelFor(report.access.state)}
                        </Badge>
                        <Button
                          size="sm"
                          variant={hasTrialHistory ? "outline" : "default"}
                          className="h-8"
                          onClick={() => openTrialDialog(hasTrialHistory ? "extend" : "start")}
                          data-testid={`button-${hasTrialHistory ? "extend" : "start"}-trial-${selectedClinic.id}`}
                        >
                          {hasTrialHistory ? <Plus className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                          {hasTrialHistory ? "Extend Trial" : "Start Trial"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setPaidDialogOpen(true)}>
                          <CreditCard className="mr-1.5 h-3.5 w-3.5" />Assign paid plan
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => openAccessDialog("sponsored")}>
                          <Gift className="mr-1.5 h-3.5 w-3.5" />Sponsored access
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => openAccessDialog("exception")}>
                          <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Exception
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Effective plan</p>
                      <p className="mt-1 text-sm font-bold">{report.plan.displayName || labelFor(report.plan.effective)}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">Requested: {report.plan.requested || "not set"} · {sourceLabel(report.plan.source)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subscription</p>
                      <p className="mt-1 text-sm font-bold">{report.subscription.label}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{labelFor(report.access.reasonCode)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Policy</p>
                      <p className="mt-1 text-sm font-bold">{report.plan.policyVersion || "Unavailable"}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">Timezone: {report.timezone}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Attention</p>
                      <p className={`mt-1 text-sm font-bold ${attentionCount ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{attentionCount ? `${attentionCount} over limit` : "No over-limit usage"}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{report.exceptions.active} exception{report.exceptions.active === 1 ? "" : "s"} · {report.grants.active} grant{report.grants.active === 1 ? "" : "s"}</p>
                    </div>
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
                    <CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4" />Subscription history</CardTitle>
                    <CardDescription>Append-only plan assignments and access decisions for this clinic.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historyQuery.isLoading && <p className="text-xs text-muted-foreground">Loading history…</p>}
                    {historyQuery.isError && <p className="text-xs text-red-600">Subscription history is unavailable.</p>}
                    {historyQuery.data && !historyQuery.data.lifecycleEvents.length && <p className="text-xs text-muted-foreground">No lifecycle events recorded yet.</p>}
                    {historyQuery.data && historyQuery.data.lifecycleEvents.length > 0 && (
                      <div className="space-y-2">
                        {historyQuery.data.lifecycleEvents.slice(0, 8).map(event => (
                          <div key={event.id} className="rounded-lg border px-3 py-2.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">{labelFor(event.eventType)}</span>
                              <span className="text-muted-foreground">{formatDate(event.effectiveAt)}</span>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              {[event.fromPlan && `${labelFor(event.fromPlan)} →`, event.toPlan && labelFor(event.toPlan), event.toStatus && `(${labelFor(event.toStatus)})`].filter(Boolean).join(" ")}
                              {" · "}{labelFor(event.actorType)}
                            </p>
                            {event.reason && <p className="mt-1 leading-5">{event.reason}</p>}
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
    </div>
  );
}