import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import type { Clinic } from "@shared/schema";
import type { EffectiveEntitlementItem, EffectiveEntitlementReport } from "@shared/effective-entitlement";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);
  const selectedClinic = clinics.find(clinic => clinic.id === selectedClinicId) ?? null;

  const reportQuery = useQuery<EffectiveEntitlementReport>({
    queryKey: ["/api/admin/clinics", selectedClinicId, "entitlements"],
    queryFn: async () => (await apiRequest("GET", `/api/admin/clinics/${selectedClinicId}/entitlements`)).json(),
    enabled: selectedClinicId !== null,
    staleTime: 30_000,
    retry: 1,
  });

  const filteredClinics = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return clinics
      .filter(clinic => !clinic.isArchived)
      .filter(clinic => !needle || [clinic.name, clinic.city, clinic.email, clinic.plan]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle)));
  }, [clinics, search]);

  const numericCapabilities = reportQuery.data?.capabilities.filter(item => USAGE_CAPABILITIES.has(item.capability)) ?? [];
  const featureCapabilities = reportQuery.data?.capabilities.filter(item => !USAGE_CAPABILITIES.has(item.capability)) ?? [];
  const attentionCount = reportQuery.data?.capabilities.filter(item => item.overLimit === true).length ?? 0;
  const report = reportQuery.data;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Subscription plans & entitlements</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review effective plan access, usage, limits, and exceptions without changing clinic or provider state.
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
                      <Badge variant="outline" className={`capitalize ${statusClass(report.access.state)}`}>
                        {report.access.state === "attention" ? <AlertTriangle className="mr-1 h-3 w-3" /> : report.access.state === "unknown" ? <ShieldAlert className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {labelFor(report.access.state)}
                      </Badge>
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
                  This is a reporting-only view. It does not assign plans, create Trial records, change subscription state, call payment providers, or enforce limits.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}