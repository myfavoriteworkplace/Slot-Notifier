import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Mail, MessageSquare, RefreshCw, Smartphone, TrendingUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UsageEvent = { eventType: string; sms: number; whatsapp: number; email: number; total: number };
type UsageTrend = { month: string; sms: number; whatsapp: number; email: number; total: number; billable: number };
type MessagingUsage = {
  period: { month: string; timezone: string; from: string; to: string };
  totals: { sms: number; whatsapp: number; email: number; total: number; billable: number; accepted: number; failed: number; skipped: number };
  trend: UsageTrend[];
  byEvent: UsageEvent[];
};

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = parts.find(part => part.type === "year")?.value ?? String(new Date().getFullYear());
  const month = parts.find(part => part.type === "month")?.value ?? String(new Date().getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(year, monthNumber - 1, 1));
};

const eventLabel = (eventType: string) => eventType.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
const colors = { sms: "#0284c7", whatsapp: "#059669", email: "#7c3aed" };
const statusColors = ["#059669", "#dc2626", "#d97706"];

const channelCards = [
  { key: "sms" as const, label: "SMS", icon: Smartphone, className: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/20" },
  { key: "whatsapp" as const, label: "WhatsApp", icon: MessageSquare, className: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
  { key: "email" as const, label: "Email", icon: Mail, className: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/20" },
];

export default function ClinicMessagingUsagePanel() {
  const [month, setMonth] = useState(currentMonth);
  const { data, error, isLoading, isFetching, refetch } = useQuery<MessagingUsage>({
    queryKey: ["/api/auth/clinic/settings/messaging-usage", month],
    queryFn: async () => (await apiRequest("GET", `/api/auth/clinic/settings/messaging-usage?month=${encodeURIComponent(month)}`)).json(),
    staleTime: 60_000,
  });
  const periodLabel = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  }, [month]);
  const statusData = data ? [
    { name: "Accepted", value: data.totals.accepted },
    { name: "Failed", value: data.totals.failed },
    { name: "Skipped", value: data.totals.skipped },
  ] : [];
  const hasStatusData = statusData.some(item => item.value > 0);

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Messaging usage</h2>
          <p className="text-sm text-muted-foreground">Monitor provider-accepted messages, channel mix, and usage by message purpose.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="messaging-usage-month" className="sr-only">Messaging usage month</label>
          <input id="messaging-usage-month" type="month" value={month} max={currentMonth()} onChange={event => setMonth(event.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs" />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-blue-50/40 pb-4 dark:bg-blue-950/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide"><MessageSquare className="h-4 w-4 text-blue-600" />Monthly communication report</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Accepted means the provider accepted the send request. Delivery receipts may be reported separately by the provider.</p>
            </div>
            <span className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{periodLabel} · {data?.period.timezone || "clinic timezone"}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Unable to load messaging usage. Please refresh and try again.</div>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total messages", data?.totals.total ?? 0, "text-blue-700", "bg-blue-50 dark:bg-blue-950/20"],
              ["Billable units", data?.totals.billable ?? 0, "text-amber-700", "bg-amber-50 dark:bg-amber-950/20"],
              ["Accepted", data?.totals.accepted ?? 0, "text-emerald-700", "bg-emerald-50 dark:bg-emerald-950/20"],
              ["Failed", data?.totals.failed ?? 0, "text-red-700", "bg-red-50 dark:bg-red-950/20"],
            ].map(([label, value, text, bg]) => (
              <div key={String(label)} className={`rounded-lg border p-3 ${bg}`}>
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className={`mt-1 text-2xl font-extrabold ${text}`}>{isLoading ? "…" : Number(value).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {channelCards.map(({ key, label, icon: Icon, className, bg }) => (
              <div key={key} className={`rounded-lg border p-3 ${bg}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">{label} sent</span><Icon className={`h-4 w-4 ${className}`} /></div>
                <p className={`mt-2 text-xl font-extrabold ${className}`}>{isLoading ? "…" : (data?.totals[key] ?? 0).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Six-month channel trend</p><span className="text-[11px] text-muted-foreground">Accepted sends</span></div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.trend ?? []} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={value => formatMonth(String(value))} formatter={(value: number, name: string) => [value, name === "sms" ? "SMS" : name === "whatsapp" ? "WhatsApp" : "Email"]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="sms" stackId="messages" fill={colors.sms} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="whatsapp" stackId="messages" fill={colors.whatsapp} />
                    <Bar dataKey="email" stackId="messages" fill={colors.email} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Send outcome</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={hasStatusData ? statusData : [{ name: "No activity", value: 1 }]} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>
                      {(hasStatusData ? statusData : [{ name: "No activity", value: 1 }]).map((entry, index) => <Cell key={entry.name} fill={hasStatusData ? statusColors[index] : "#cbd5e1"} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "Messages"]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message purpose breakdown</span><span className="text-[11px] text-muted-foreground">{data?.byEvent.length ?? 0} event types</span></div>
            {data?.byEvent.length ? (
              <div className="divide-y">
                {data.byEvent.map(event => (
                  <div key={event.eventType} className="grid grid-cols-[minmax(0,1fr)_repeat(4,auto)] items-center gap-3 px-3 py-2 text-xs">
                    <span className="truncate font-medium">{eventLabel(event.eventType)}</span>
                    <span className="text-sky-700 dark:text-sky-400">{event.sms} SMS</span>
                    <span className="text-emerald-700 dark:text-emerald-400">{event.whatsapp} WA</span>
                    <span className="text-violet-700 dark:text-violet-400">{event.email} email</span>
                    <span className="font-semibold">{event.total} total</span>
                  </div>
                ))}
              </div>
            ) : <p className="px-3 py-5 text-center text-xs text-muted-foreground">No accepted messages recorded for this month.</p>}
          </div>
          <p className="text-[11px] text-muted-foreground">Skipped and failed sends are tracked for operational visibility but are not included in channel totals or billable units.</p>
        </CardContent>
      </Card>
    </div>
  );
}