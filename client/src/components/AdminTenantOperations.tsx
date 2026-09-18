import { useMemo, useState, type ComponentProps } from "react";
import type AdminOperationsOverview from "@/components/AdminOperationsOverview";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
  XCircle,
} from "lucide-react";
import type { Clinic } from "@shared/schema";
import {
  getAdminClinicAttentionReasons,
  getAdminClinicLifecycleState,
  getAdminCurrentMonth,
  getAdminStorageUsageLevel,
  matchesAdminClinicFilter,
  type AdminClinicFilter,
  type AdminMessagingUsageSummary,
  type AdminStorageUsageSummary,
} from "@shared/admin-operations";
import { getSubscriptionStatusInfo } from "@shared/subscription-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";

type TenantOperationsProps = Omit<ComponentProps<typeof AdminOperationsOverview>, "view">;

type TenantFilterOption = {
  value: AdminClinicFilter;
  label: string;
};

const FILTER_OPTIONS: TenantFilterOption[] = [
  { value: "all", label: "All tenants" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "archived", label: "Archived" },
  { value: "trial", label: "Trial access" },
  { value: "paid", label: "Paid access" },
  { value: "attention", label: "Needs attention" },
  { value: "unknown", label: "Unknown access" },
];

const formatNumber = (value: number) => value.toLocaleString("en-IN");

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatPercent = (value: number) => `${Math.round(value * 10) / 10}%`;

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const subscriptionLabel = (status: string | null | undefined) => getSubscriptionStatusInfo(status).label;

const subscriptionClass = (status: string | null | undefined) => {
  const state = getSubscriptionStatusInfo(status).state;
  if (state === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (state === "expired" || state === "past_due" || state === "provider_error") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
};

const storageTone = (percent: number | null | undefined, available = true) => {
  const level = getAdminStorageUsageLevel(percent, available);
  if (level === "critical") return "bg-red-500";
  if (level === "warning") return "bg-amber-500";
  if (level === "unavailable") return "bg-muted";
  return "bg-emerald-500";
};

const messageTone = (failed: number | null | undefined) => {
  if (failed === null || failed === undefined) return "text-muted-foreground";
  return failed > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
};

const lifecycleLabel = (clinic: Clinic) => {
  const lifecycle = getAdminClinicLifecycleState(clinic);
  return lifecycle === "active" ? "Active" : lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1);
};

const clinicSearchValues = (clinic: Clinic) => [
  clinic.name,
  clinic.city,
  clinic.email,
  clinic.phone,
  clinic.plan,
  clinic.id,
];

export default function AdminTenantOperations({
  clinics,
  month,
  onMonthChange,
  onRefreshOperations,
  clinicsLoading = false,
  clinicsFetching = false,
  clinicsError = false,
  onRetryClinics,
}: TenantOperationsProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AdminClinicFilter>("active");

  const messagingQuery = useQuery<AdminMessagingUsageSummary>({
    queryKey: ["/api/admin/messaging-usage", month],
    queryFn: async () => (await apiRequest("GET", `/api/admin/messaging-usage?month=${encodeURIComponent(month)}`)).json(),
    staleTime: 60_000,
    retry: 1,
  });

  const storageQuery = useQuery<AdminStorageUsageSummary>({
    queryKey: ["/api/admin/storage-usage"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/storage-usage")).json(),
    staleTime: 60_000,
    retry: 1,
  });

  const messagingByClinic = useMemo(
    () => new Map((messagingQuery.data?.clinics ?? []).map(item => [item.clinicId, item])),
    [messagingQuery.data?.clinics],
  );
  const storageByClinic = useMemo(
    () => new Map((storageQuery.data?.clinics ?? []).map(item => [item.clinicId, item])),
    [storageQuery.data?.clinics],
  );

  const visibleClinics = clinics.filter(clinic => !clinic.isArchived || filter === "archived" || filter === "all");
  const attentionReasonsByClinic = useMemo(
    () => new Map(
      visibleClinics.map(clinic => {
        const storage = storageByClinic.get(clinic.id);
        const messaging = messagingByClinic.get(clinic.id);
        return [clinic.id, getAdminClinicAttentionReasons({
          subscriptionStatus: clinic.subscriptionStatus,
          storage: storage ? { available: true, usagePercent: storage.usagePercent } : { available: false },
          messaging: messaging ? { available: true, failed: messaging.failed } : { available: false },
        })] as const;
      }),
    ),
    [messagingByClinic, storageByClinic, visibleClinics],
  );

  const filterRecord = (clinic: Clinic) => ({
    ...clinic,
    attentionReasons: attentionReasonsByClinic.get(clinic.id) ?? [],
  });

  const filteredClinics = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return clinics
      .filter(clinic => matchesAdminClinicFilter(filterRecord(clinic), filter))
      .filter(clinic => !needle || clinicSearchValues(clinic).some(value => String(value ?? "").toLowerCase().includes(needle)));
  }, [clinics, filter, search, attentionReasonsByClinic]);

  const filterCounts = useMemo(
    () => new Map(FILTER_OPTIONS.map(option => [
      option.value,
      clinics.filter(clinic => matchesAdminClinicFilter(filterRecord(clinic), option.value)).length,
    ])),
    [clinics, attentionReasonsByClinic],
  );

  const activeCount = clinics.filter(clinic => getAdminClinicLifecycleState(clinic) === "active").length;
  const attentionCount = filterCounts.get("attention") ?? 0;
  const hasOperationsError = clinicsError || messagingQuery.isError || storageQuery.isError;
  const isRefreshing = clinicsFetching || messagingQuery.isFetching || storageQuery.isFetching;
  const isLoading = clinicsLoading || messagingQuery.isLoading || storageQuery.isLoading;

  return (
    <div className="space-y-5" data-testid="tenant-operations-directory">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Tenant Operations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor subscription access and platform-service health for every tenant. Clinic treatment revenue is not shown here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="admin-tenant-operations-month" className="sr-only">Tenant operations reporting month</label>
          <input
            id="admin-tenant-operations-month"
            type="month"
            value={month}
            max={getAdminCurrentMonth()}
            onChange={event => onMonthChange(event.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-xs"
          />
          <Button variant="outline" size="sm" onClick={onRefreshOperations} disabled={isRefreshing} className="h-9">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh tenant data
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-300" role="status">
          Loading the latest tenant operations data…
        </div>
      )}

      {hasOperationsError && (
        <Card className="border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/15">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div className="flex min-w-0 items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-200">Some tenant data could not be verified.</p>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">Unavailable values are shown as unavailable, not zero.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {clinicsError && onRetryClinics && <Button size="sm" variant="outline" onClick={onRetryClinics}>Retry tenants</Button>}
              {messagingQuery.isError && <Button size="sm" variant="outline" onClick={() => messagingQuery.refetch()}>Retry messaging</Button>}
              {storageQuery.isError && <Button size="sm" variant="outline" onClick={() => storageQuery.refetch()}>Retry storage</Button>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide">
                <Building2 className="h-4 w-4 text-primary" />
                Tenant directory
              </CardTitle>
              <CardDescription className="mt-1">
                {filteredClinics.length} matching · {activeCount} active · {attentionCount} needing attention
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search name, city, email, phone, or ID"
                className="h-9 pl-8 text-xs"
                aria-label="Search tenants"
                data-testid="input-operations-tenant-search"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pt-3 pb-0" role="group" aria-label="Tenant directory filters">
            {FILTER_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={`shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  filter === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted/50"
                }`}
                data-testid={`filter-operations-${option.value}`}
              >
                {option.label} ({filterCounts.get(option.value) ?? 0})
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-3 sm:p-4">
          {filteredClinics.map(clinic => {
            const messaging = messagingByClinic.get(clinic.id);
            const storage = storageByClinic.get(clinic.id);
            const attentionReasons = attentionReasonsByClinic.get(clinic.id) ?? [];
            const serviceDataAvailable = Boolean(messagingQuery.data && storageQuery.data && messaging && storage);
            const serviceDataDelayed = messagingQuery.isError || storageQuery.isError || clinicsError;
            const lifecycle = lifecycleLabel(clinic);
            const accessDate = clinic.trialEndsAt || clinic.paidAccessExpiresAt;
            const accessDateLabel = clinic.trialEndsAt ? "Trial ends" : clinic.paidAccessExpiresAt ? "Paid access ends" : "Access date";

            return (
              <article
                key={clinic.id}
                className={`rounded-xl border p-4 transition-colors ${
                  attentionReasons.length > 0
                    ? "border-amber-200 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/10"
                    : "border-border bg-background hover:bg-muted/20"
                }`}
                data-testid={`card-operations-tenant-${clinic.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                      {clinic.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold">{clinic.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{lifecycle}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${subscriptionClass(clinic.subscriptionStatus)}`}>
                          {subscriptionLabel(clinic.subscriptionStatus)}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {[clinic.city, clinic.email, `Clinic #${clinic.id}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-full border px-2 py-1 capitalize">{clinic.plan || "Plan not selected"}</span>
                    <span className="rounded-full border px-2 py-1 capitalize">{clinic.billingCycle || "monthly"}</span>
                    <span className="rounded-full border px-2 py-1">{clinic.razorpaySubscriptionId ? "Provider linked" : "Provider not linked"}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5 text-primary" /> Access
                    </p>
                    <p className="mt-1 text-xs font-semibold">{clinic.plan || "Plan not selected"}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {accessDateLabel}: {formatDate(accessDate)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> Messaging
                    </p>
                    <p className={`mt-1 text-xs font-semibold ${messageTone(messaging?.failed)}`}>
                      {messaging ? `${formatNumber(messaging.total)} this month` : messagingQuery.isLoading ? "Loading…" : "Unavailable"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {messaging ? `${formatNumber(messaging.sms)} SMS · ${formatNumber(messaging.whatsapp)} WA · ${formatNumber(messaging.email)} email` : "Usage summary unavailable"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Database className="h-3.5 w-3.5 text-sky-600" /> Storage
                    </p>
                    <p className="mt-1 text-xs font-semibold">
                      {storage ? `${formatBytes(storage.usedBytes)} / ${formatBytes(storage.limitBytes)}` : storageQuery.isLoading ? "Loading…" : "Unavailable"}
                    </p>
                    {storage ? (
                      <>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
                          <div className={`h-full rounded-full ${storageTone(storage.usagePercent)}`} style={{ width: `${Math.min(100, storage.usagePercent)}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">{formatPercent(storage.usagePercent)} · {formatNumber(storage.fileCount)} files</p>
                      </>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">Storage summary unavailable</p>
                    )}
                  </div>

                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Server className="h-3.5 w-3.5 text-violet-600" /> Operational health
                    </p>
                    {!serviceDataAvailable ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Data unavailable</p>
                    ) : serviceDataDelayed ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"><RefreshCw className="h-3.5 w-3.5" /> Delayed data</p>
                    ) : attentionReasons.length === 0 ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> No warnings</p>
                    ) : (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> {attentionReasons.length} warning{attentionReasons.length === 1 ? "" : "s"}</p>
                    )}
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {attentionReasons.length > 0 ? attentionReasons.map(reason => reason.label).join(" · ") : `Timezone · ${clinic.timezone || "Unavailable"}`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[10px] text-muted-foreground">
                  <span>
                    {messaging?.lastSentAt ? `Last message ${formatDate(messaging.lastSentAt)}` : "No message activity recorded this month"}
                  </span>
                  <span>
                    {storage ? `${storage.source.replace("_", " ")} storage limit` : "Storage source unavailable"}
                  </span>
                </div>
              </article>
            );
          })}

          {!filteredClinics.length && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12 text-center">
              <Search className="mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No tenants match this view</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Try a different search or operational filter.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}