import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, ChevronRight, Mail, MessageSquare, RefreshCw, Search, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type UsageEvent = { eventType: string; sms: number; whatsapp: number; email: number; total: number };
type UsageTrend = { month: string; sms: number; whatsapp: number; email: number; total: number; billable: number };
type ClinicUsage = {
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
  byEvent: UsageEvent[];
};
type AdminMessagingUsage = {
  period: { month: string; timezone: string; from: string; to: string };
  totals: { sms: number; whatsapp: number; email: number; total: number; billable: number; accepted: number; failed: number; skipped: number };
  trend: UsageTrend[];
  byEvent: UsageEvent[];
  clinics: ClinicUsage[];
};

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}`;
};
const formatMonth = (month: string) => new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
const eventLabel = (eventType: string) => eventType.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
const number = (value: number) => value.toLocaleString("en-IN");

export default function AdminMessagingUsagePanel() {
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);
  const query = useQuery<AdminMessagingUsage>({
    queryKey: ["/api/admin/messaging-usage", month],
    queryFn: async () => (await apiRequest("GET", `/api/admin/messaging-usage?month=${encodeURIComponent(month)}`)).json(),
    staleTime: 60_000,
  });
  const detailQuery = useQuery<AdminMessagingUsage>({
    queryKey: ["/api/admin/messaging-usage", month, selectedClinicId],
    queryFn: async () => (await apiRequest("GET", `/api/admin/messaging-usage?month=${encodeURIComponent(month)}&clinicId=${selectedClinicId}`)).json(),
    enabled: selectedClinicId !== null,
    staleTime: 60_000,
  });
  const filteredClinics = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (query.data?.clinics ?? []).filter(clinic => !normalized || clinic.clinicName.toLowerCase().includes(normalized));
  }, [query.data?.clinics, search]);
  const selectedClinic = query.data?.clinics.find(clinic => clinic.clinicId === selectedClinicId);
  const totalClinicsWithUsage = query.data?.clinics.filter(clinic => clinic.total > 0).length ?? 0;
  const channelMix: Array<{ label: string; value: number; Icon: LucideIcon; bar: string; text: string }> = [
    { label: "SMS", value: query.data?.totals.sms ?? 0, Icon: Smartphone, bar: "bg-sky-500", text: "text-sky-700" },
    { label: "WhatsApp", value: query.data?.totals.whatsapp ?? 0, Icon: MessageSquare, bar: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Email", value: query.data?.totals.email ?? 0, Icon: Mail, bar: "bg-violet-500", text: "text-violet-700" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Messaging usage</h2>
          <p className="text-sm text-muted-foreground">Compare SMS, WhatsApp, and email usage across every clinic.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="admin-messaging-usage-month" className="sr-only">Usage month</label>
          <input id="admin-messaging-usage-month" type="month" value={month} max={currentMonth()} onChange={event => setMonth(event.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs" />
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching} className="h-8"><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </div>

      {query.error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Unable to load application messaging usage.</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Total messages", query.data?.totals.total ?? 0, "text-blue-700", "bg-blue-50 dark:bg-blue-950/20"],
          ["Billable units", query.data?.totals.billable ?? 0, "text-amber-700", "bg-amber-50 dark:bg-amber-950/20"],
          ["Accepted", query.data?.totals.accepted ?? 0, "text-emerald-700", "bg-emerald-50 dark:bg-emerald-950/20"],
          ["Failed", query.data?.totals.failed ?? 0, "text-red-700", "bg-red-50 dark:bg-red-950/20"],
          ["Clinics with usage", totalClinicsWithUsage, "text-violet-700", "bg-violet-50 dark:bg-violet-950/20"],
        ].map(([label, value, text, bg]) => <Card key={String(label)} className={String(bg)}><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-extrabold ${text}`}>{query.isLoading ? "…" : number(Number(value))}</p></CardContent></Card>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide"><MessageSquare className="h-4 w-4 text-blue-600" />Six-month usage trend</CardTitle></CardHeader>
          <CardContent><div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={query.data?.trend ?? []} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={value => formatMonth(String(value))} formatter={(value: number, name: string) => [value, name === "sms" ? "SMS" : name === "whatsapp" ? "WhatsApp" : "Email"]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="sms" stackId="messages" fill="#0284c7" />
                <Bar dataKey="whatsapp" stackId="messages" fill="#059669" />
                <Bar dataKey="email" stackId="messages" fill="#7c3aed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide">Channel mix · {query.data?.period.month}</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-4">
            {channelMix.map(({ label, value, Icon, bar, text }) => {
              const total = query.data?.totals.total ?? 0;
              const percent = total ? Math.round(value / total * 100) : 0;
              return <div key={label}><div className="mb-1 flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><Icon className={`h-3.5 w-3.5 ${text}`} />{label}</span><span className="font-semibold">{number(value)} · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${bar}`} style={{ width: `${percent}%` }} /></div></div>;
            })}
            <p className="border-t pt-3 text-[11px] text-muted-foreground">Reporting period uses UTC for cross-clinic comparison.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide"><Building2 className="h-4 w-4 text-violet-600" />Clinic comparison</CardTitle><p className="mt-1 text-xs text-muted-foreground">Select a clinic to inspect its monthly event breakdown.</p></div>
            <div className="relative w-full sm:w-64"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search clinics" className="h-8 pl-8 text-xs" /></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[850px]">
              <div className="grid grid-cols-[minmax(210px,1.5fr)_80px_80px_repeat(5,75px)_32px] gap-2 border-b bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Clinic</span><span>Plan</span><span>Status</span><span>SMS</span><span>WA</span><span>Email</span><span>Total</span><span>Failed</span><span />
              </div>
              {filteredClinics.map(clinic => (
                <button key={clinic.clinicId} type="button" onClick={() => setSelectedClinicId(clinic.clinicId)} className="grid w-full grid-cols-[minmax(210px,1.5fr)_80px_80px_repeat(5,75px)_32px] items-center gap-2 border-b px-4 py-3 text-left text-xs transition-colors hover:bg-muted/30">
                  <span className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${clinic.isArchived ? "bg-slate-400" : clinic.status === "approved" ? "bg-emerald-500" : "bg-amber-500"}`} /><span className="truncate font-semibold">{clinic.clinicName}</span></span>
                  <span className="capitalize text-muted-foreground">{clinic.plan || "—"}</span><span className="capitalize text-muted-foreground">{clinic.subscriptionStatus === "active" ? "Paid" : clinic.subscriptionStatus || "—"}</span>
                  <span className="font-medium text-sky-700">{number(clinic.sms)}</span><span className="font-medium text-emerald-700">{number(clinic.whatsapp)}</span><span className="font-medium text-violet-700">{number(clinic.email)}</span><span className="font-bold">{number(clinic.total)}</span><span className={clinic.failed ? "font-bold text-red-600" : "text-muted-foreground"}>{number(clinic.failed)}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              {!filteredClinics.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No clinics match this search.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={selectedClinicId !== null} onOpenChange={open => !open && setSelectedClinicId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{selectedClinic?.clinicName || "Clinic messaging usage"}</SheetTitle><SheetDescription>{query.data?.period.month} · detailed communication usage and event breakdown</SheetDescription></SheetHeader>
          {detailQuery.isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading clinic usage…</div> : detailQuery.data && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-3 gap-2">
                {[["SMS", detailQuery.data.totals.sms, "text-sky-700"], ["WhatsApp", detailQuery.data.totals.whatsapp, "text-emerald-700"], ["Email", detailQuery.data.totals.email, "text-violet-700"]].map(([label, value, text]) => <div key={String(label)} className="rounded-lg border bg-muted/20 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold ${text}`}>{number(Number(value))}</p></div>)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-md bg-emerald-50 p-2 text-emerald-700">Accepted<br /><strong>{number(detailQuery.data.totals.accepted)}</strong></div><div className="rounded-md bg-amber-50 p-2 text-amber-700">Skipped<br /><strong>{number(detailQuery.data.totals.skipped)}</strong></div><div className="rounded-md bg-red-50 p-2 text-red-700">Failed<br /><strong>{number(detailQuery.data.totals.failed)}</strong></div></div>
              <div className="rounded-lg border"><div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message purpose</div><div className="divide-y">{(detailQuery.data.byEvent ?? []).map(event => <div key={event.eventType} className="flex items-center justify-between gap-3 px-3 py-2 text-xs"><span className="font-medium">{eventLabel(event.eventType)}</span><span className="text-muted-foreground">{event.total} accepted message{event.total === 1 ? "" : "s"}</span></div>)}{!detailQuery.data.byEvent.length && <p className="p-4 text-xs text-muted-foreground">No accepted messages this month.</p>}</div></div>
              <p className="text-[11px] text-muted-foreground">Billable units: <strong>{number(detailQuery.data.totals.billable)}</strong>. Reporting period uses UTC in the application admin view.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}