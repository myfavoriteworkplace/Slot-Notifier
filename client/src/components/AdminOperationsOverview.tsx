import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  Mail,
  MessageSquare,
  Search,
  Server,
  ShieldAlert,
  Smartphone,
  XCircle,
} from "lucide-react";
import type { Clinic } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";

type ClinicMessagingUsage = {
  clinicId: number;
  clinicName: string;
  plan: string | null;
  subscriptionStatus: string | null;
  status: string | null;
  isArchived: boolean | null;
  sms: number;
  whatsapp: number;
  email: number;
  total: number;
  billable: number;
  accepted: number;
  failed: number;
  skipped: number;
  lastSentAt: string | null;
};

type AdminMessagingUsageSummary = {
  period: { month: string; timezone: string; from: string; to: string };
  totals: {
    sms: number;
    whatsapp: number;
    email: number;
    total: number;
    billable: number;
    accepted: number;
    failed: number;
    skipped: number;
  };
  clinics: ClinicMessagingUsage[];
};

type ClinicStorageUsage = {
  clinicId: number;
  clinicName: string;
  plan: string | null;
  subscriptionStatus: string | null;
  status: string | null;
  isArchived: boolean;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usagePercent: number;
  fileCount: number;
  source: "plan" | "clinic_override" | "default";
};

type AdminStorageUsageSummary = {
  totals: {
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    usagePercent: number;
    fileCount: number;
  };
  clinics: ClinicStorageUsage[];
};

type TenantFilter = "all" | "attention" | "active" | "pending";

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}`;
};

const formatNumber = (value: number) => value.toLocaleString("en-IN");

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatPercent = (value: number) => `${Math.round(value * 10) / 10}%`;

const subscriptionLabel = (status: string | null | undefined) => {
  switch (status) {
    case "active":
      return "Active";
    case "pending_payment":
      return "Payment pending";
    case "expired":
      return "Expired";
    case "past_due":
      return "Past due";
    default:
      return status ? status.replace(/_/g, " ") : "Not activated";
  }
};

const subscriptionClass = (status: string | null | undefined) => {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "expired" || status === "past_due") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
};

const isSubscriptionAttention = (status: string | null | undefined) => status !== "active";

const storageTone = (percent: number) => {
  if (percent >= 95) return "bg-red-500";
  if (percent >= 80) return "bg-amber-500";
  return "bg-emerald-500";
};

const messageTone = (failed: number) => failed > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Building2;
  tone?: "primary" | "good" | "warning" | "danger";
}) {
  const iconClass = {
    primary: "bg-primary/10 text-primary",
    good: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
    danger: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300",
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-2xl font-extrabold tracking-tight">{value}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminOperationsOverview({ clinics }: { clinics: Clinic[] }) {
  const [month] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TenantFilter>("all");
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  const messagingQuery = useQuery<AdminMessagingUsageSummary>({
    queryKey: ["/api/admin/messaging-usage", month],
    queryFn: async () => (await apiRequest("GET", `/api/admin/messaging-usage?month=${encodeURIComponent(month)}`)).json(),
    staleTime: 60_000,
  });

  const storageQuery = useQuery<AdminStorageUsageSummary>({
    queryKey: ["/api/admin/storage-usage"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/storage-usage")).json(),
    staleTime: 60_000,
  });

  const messagingByClinic = useMemo(
    () => new Map((messagingQuery.data?.clinics ?? []).map(item => [item.clinicId, item])),
    [messagingQuery.data?.clinics],
  );
  const storageByClinic = useMemo(
    () => new Map((storageQuery.data?.clinics ?? []).map(item => [item.clinicId, item])),
    [storageQuery.data?.clinics],
  );

  const activeClinics = clinics.filter(clinic => clinic.status === "approved" && !clinic.isArchived);
  const pendingClinics = clinics.filter(clinic => clinic.status === "pending" && !clinic.isArchived);
  const attentionClinics = activeClinics.filter(clinic => {
    const storage = storageByClinic.get(clinic.id);
    const messaging = messagingByClinic.get(clinic.id);
    return isSubscriptionAttention(clinic.subscriptionStatus) ||
      (storage?.usagePercent ?? 0) >= 80 ||
      (messaging?.failed ?? 0) > 0;
  });

  const filteredClinics = clinics
    .filter(clinic => !clinic.isArchived)
    .filter(clinic => {
      if (filter === "active") return clinic.status === "approved";
      if (filter === "pending") return clinic.status === "pending";
      if (filter === "attention") return attentionClinics.some(item => item.id === clinic.id);
      return true;
    })
    .filter(clinic => {
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return [clinic.name, clinic.city, clinic.email, clinic.plan]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle));
    });

  const totalMessages = messagingQuery.data?.totals.total ?? 0;
  const failedMessages = messagingQuery.data?.totals.failed ?? 0;
  const storageTotals = storageQuery.data?.totals;
  const storagePercent = storageTotals?.usagePercent ?? 0;
  const activeSubscriptions = activeClinics.filter(clinic => clinic.subscriptionStatus === "active").length;
  const platformSignalsHealthy = failedMessages === 0 && attentionClinics.length === 0;
  const selectedMessaging = selectedClinic ? messagingByClinic.get(selectedClinic.id) : undefined;
  const selectedStorage = selectedClinic ? storageByClinic.get(selectedClinic.id) : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Platform operations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Subscription access and BookMySlot service consumption. Clinic treatment revenue is not shown here.
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
          platformSignalsHealthy
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
        }`}>
          {platformSignalsHealthy ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {platformSignalsHealthy ? "Service signals healthy" : `${attentionClinics.length} tenant${attentionClinics.length === 1 ? "" : "s"} need attention`}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Active tenants" value={formatNumber(activeClinics.length)} detail={`${formatNumber(pendingClinics.length)} pending registration${pendingClinics.length === 1 ? "" : "s"}`} icon={Building2} />
        <MetricCard label="Subscriptions" value={`${formatNumber(activeSubscriptions)} / ${formatNumber(activeClinics.length)}`} detail="Active subscription coverage" icon={CreditCard} tone={activeSubscriptions === activeClinics.length ? "good" : "warning"} />
        <MetricCard label="Needs attention" value={formatNumber(attentionClinics.length)} detail="Subscription, storage, or message signals" icon={ShieldAlert} tone={attentionClinics.length ? "warning" : "good"} />
        <MetricCard label="Messages this month" value={formatNumber(totalMessages)} detail={`${formatNumber(messagingQuery.data?.totals.accepted ?? 0)} accepted · ${formatNumber(failedMessages)} failed`} icon={MessageSquare} tone={failedMessages ? "danger" : "good"} />
        <MetricCard label="Tracked storage" value={storageTotals ? `${formatPercent(storagePercent)}` : "—"} detail={storageTotals ? `${formatBytes(storageTotals.usedBytes)} of ${formatBytes(storageTotals.limitBytes)}` : "Loading usage summary"} icon={Database} tone={storagePercent >= 95 ? "danger" : storagePercent >= 80 ? "warning" : "primary"} />
        <MetricCard label="Reporting period" value={month} detail={`Messaging timezone: ${messagingQuery.data?.period.timezone ?? "UTC"}`} icon={Server} />
      </div>

      {attentionClinics.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Needs attention
            </CardTitle>
            <CardDescription>Operational warnings that may affect a clinic’s access to platform services.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attentionClinics.slice(0, 6).map(clinic => {
              const storage = storageByClinic.get(clinic.id);
              const messaging = messagingByClinic.get(clinic.id);
              const reasons = [
                isSubscriptionAttention(clinic.subscriptionStatus) ? `Subscription ${subscriptionLabel(clinic.subscriptionStatus).toLowerCase()}` : null,
                storage && storage.usagePercent >= 80 ? `Storage ${formatPercent(storage.usagePercent)}` : null,
                messaging && messaging.failed > 0 ? `${formatNumber(messaging.failed)} failed messages` : null,
              ].filter(Boolean);
              return (
                <button
                  key={clinic.id}
                  type="button"
                  className="rounded-lg border border-amber-200 bg-background/80 p-3 text-left transition-colors hover:border-amber-400 dark:border-amber-900/60"
                  onClick={() => setSelectedClinic(clinic)}
                  data-testid={`button-operations-alert-${clinic.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{clinic.name}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{reasons.join(" · ")}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide">
                <Building2 className="h-4 w-4 text-primary" />
                Tenant operations
              </CardTitle>
              <CardDescription className="mt-1">Subscription and platform-service status only.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tenants" className="h-8 pl-8 text-xs" aria-label="Search tenants" data-testid="input-operations-tenant-search" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-3">
            {([
              ["all", `All (${clinics.filter(clinic => !clinic.isArchived).length})`],
              ["attention", `Needs attention (${attentionClinics.length})`],
              ["active", `Active (${activeClinics.length})`],
              ["pending", `Pending (${pendingClinics.length})`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/50"}`}
                data-testid={`filter-operations-${value}`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tenant</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subscription</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Messages</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Storage</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Signals</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClinics.map(clinic => {
                  const messaging = messagingByClinic.get(clinic.id);
                  const storage = storageByClinic.get(clinic.id);
                  const signalCount = [
                    isSubscriptionAttention(clinic.subscriptionStatus),
                    (storage?.usagePercent ?? 0) >= 80,
                    (messaging?.failed ?? 0) > 0,
                  ].filter(Boolean).length;
                  return (
                    <tr key={clinic.id} className="border-b border-border/30 transition-colors hover:bg-muted/20" data-testid={`row-operations-tenant-${clinic.id}`}>
                      <th className="px-4 py-3 text-left">
                        <div className="flex min-w-[210px] items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                            {clinic.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{clinic.name}</p>
                            <p className="truncate text-[11px] font-normal text-muted-foreground">{[clinic.city, clinic.status === "pending" ? "Pending registration" : "Active"].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                      </th>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="outline" className={`text-[10px] capitalize ${subscriptionClass(clinic.subscriptionStatus)}`}>{subscriptionLabel(clinic.subscriptionStatus)}</Badge>
                          <span className="text-[11px] capitalize text-muted-foreground">{clinic.plan || "Plan not selected"} · {clinic.billingCycle || "monthly"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${messageTone(messaging?.failed ?? 0)}`}>{formatNumber(messaging?.total ?? 0)}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">this month</span>
                        {messaging && <p className="text-[11px] text-muted-foreground">{formatNumber(messaging.sms)} SMS · {formatNumber(messaging.whatsapp)} WA · {formatNumber(messaging.email)} email</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{storage ? formatBytes(storage.usedBytes) : "—"}</span>
                        <span className="text-[11px] text-muted-foreground"> {storage ? `/ ${formatBytes(storage.limitBytes)}` : ""}</span>
                        {storage && (
                          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${storageTone(storage.usagePercent)}`} style={{ width: `${Math.min(100, storage.usagePercent)}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {signalCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> None</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> {signalCount} warning{signalCount === 1 ? "" : "s"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedClinic(clinic)} data-testid={`button-open-operations-tenant-${clinic.id}`}>
                          Open <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredClinics.length === 0 && (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <Search className="mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No tenants match this view</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Try a different search or operational filter.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={selectedClinic !== null} onOpenChange={open => !open && setSelectedClinic(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {selectedClinic?.name || "Tenant details"}
            </SheetTitle>
            <SheetDescription>
              {selectedClinic ? [selectedClinic.city, selectedClinic.status === "pending" ? "Pending registration" : "Platform services"].filter(Boolean).join(" · ") : ""}
            </SheetDescription>
          </SheetHeader>

          {selectedClinic && (
            <div className="mt-6 space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Subscription access</CardTitle>
                  <CardDescription>BookMySlot subscription metadata, not clinic treatment revenue.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border bg-muted/20 p-3"><p className="text-muted-foreground">Plan</p><p className="mt-1 font-bold capitalize">{selectedClinic.plan || "Not selected"}</p></div>
                  <div className="rounded-lg border bg-muted/20 p-3"><p className="text-muted-foreground">Billing cycle</p><p className="mt-1 font-bold capitalize">{selectedClinic.billingCycle || "Monthly"}</p></div>
                  <div className="rounded-lg border bg-muted/20 p-3"><p className="text-muted-foreground">Status</p><Badge variant="outline" className={`mt-1 text-[10px] ${subscriptionClass(selectedClinic.subscriptionStatus)}`}>{subscriptionLabel(selectedClinic.subscriptionStatus)}</Badge></div>
                  <div className="rounded-lg border bg-muted/20 p-3"><p className="text-muted-foreground">Provider link</p><p className="mt-1 font-bold">{selectedClinic.razorpaySubscriptionId ? "Connected" : "Not linked"}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Platform service usage</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "SMS", value: selectedMessaging?.sms ?? 0, Icon: Smartphone, color: "text-sky-600" },
                      { label: "WhatsApp", value: selectedMessaging?.whatsapp ?? 0, Icon: MessageSquare, color: "text-emerald-600" },
                      { label: "Email", value: selectedMessaging?.email ?? 0, Icon: Mail, color: "text-violet-600" },
                    ].map(({ label, value, Icon: ServiceIcon, color }) => (
                      <div key={label} className="rounded-lg border bg-muted/20 p-3">
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ServiceIcon className={`h-3.5 w-3.5 ${color}`} />{label}</p>
                        <p className="mt-1 text-xl font-bold">{formatNumber(Number(value))}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-xs"><span className="font-medium">Message delivery</span><span className={messageTone(selectedMessaging?.failed ?? 0)}>{selectedMessaging?.failed ? `${formatNumber(selectedMessaging.failed)} failed` : "No failed messages"}</span></div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{month} · {messagingQuery.data?.period.timezone ?? "UTC"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-xs"><span className="font-medium">Tracked storage</span><span className="font-semibold">{selectedStorage ? formatPercent(selectedStorage.usagePercent) : "—"}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${storageTone(selectedStorage?.usagePercent ?? 0)}`} style={{ width: `${Math.min(100, selectedStorage?.usagePercent ?? 0)}%` }} /></div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{selectedStorage ? `${formatBytes(selectedStorage.usedBytes)} of ${formatBytes(selectedStorage.limitBytes)} · ${formatNumber(selectedStorage.fileCount)} files` : "Storage summary unavailable"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Operational context</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-muted-foreground">Clinic status</span><span className="font-semibold capitalize">{selectedClinic.status}</span></div>
                  <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-muted-foreground">Configured doctors</span><span className="font-semibold">{selectedClinic.doctors?.length ?? 0}</span></div>
                  <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-muted-foreground">Storage source</span><span className="font-semibold capitalize">{selectedStorage?.source?.replace("_", " ") || "—"}</span></div>
                </CardContent>
              </Card>

              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                Patient bills, treatment revenue, doctor earnings, clinical records, and patient payment history are intentionally excluded from this operations view.
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}