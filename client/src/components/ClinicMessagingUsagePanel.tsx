import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare, RefreshCw, Smartphone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UsageEvent = {
  eventType: string;
  sms: number;
  whatsapp: number;
  email: number;
  total: number;
};

type MessagingUsage = {
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
  byEvent: UsageEvent[];
};

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = parts.find(part => part.type === "year")?.value ?? String(new Date().getFullYear());
  const month = parts.find(part => part.type === "month")?.value ?? String(new Date().getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const eventLabel = (eventType: string) =>
  eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());

const channelCards = [
  { key: "sms" as const, label: "SMS sent", icon: Smartphone, className: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/20" },
  { key: "whatsapp" as const, label: "WhatsApp sent", icon: MessageSquare, className: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
  { key: "email" as const, label: "Emails sent", icon: Mail, className: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/20" },
];

export default function ClinicMessagingUsagePanel() {
  const [month, setMonth] = useState(currentMonth);
  const { data, isLoading, isFetching, refetch } = useQuery<MessagingUsage>({
    queryKey: ["/api/auth/clinic/settings/messaging-usage", month],
    queryFn: async () => (await apiRequest("GET", `/api/auth/clinic/settings/messaging-usage?month=${encodeURIComponent(month)}`)).json(),
    staleTime: 60_000,
  });
  const periodLabel = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  }, [month]);

  return (
    <Card>
      <CardHeader className="border-b bg-blue-50/40 pb-4 dark:bg-blue-950/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide">
              <MessageSquare className="h-4 w-4 text-blue-600" />Messaging usage
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Provider-accepted messages sent for this clinic. Delivery status may be reported separately by the provider.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="messaging-usage-month" className="sr-only">Messaging usage month</label>
            <input
              id="messaging-usage-month"
              type="month"
              value={month}
              max={currentMonth()}
              onChange={event => setMonth(event.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            />
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {channelCards.map(({ key, label, icon: Icon, className, bg }) => (
            <div key={key} className={`rounded-lg border p-3 ${bg}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${className}`} />
              </div>
              <p className={`mt-2 text-2xl font-extrabold ${className}`}>{isLoading ? "…" : (data?.totals[key] ?? 0).toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
          <span className="text-muted-foreground">{periodLabel} · {data?.period.timezone || "clinic timezone"}</span>
          <span className="font-semibold text-foreground">
            {isLoading ? "Loading…" : `${data?.totals.billable ?? 0} billable message${data?.totals.billable === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md bg-emerald-50 p-2.5 dark:bg-emerald-950/20">
            <p className="text-[11px] text-muted-foreground">Accepted</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{data?.totals.accepted ?? 0}</p>
          </div>
          <div className="rounded-md bg-amber-50 p-2.5 dark:bg-amber-950/20">
            <p className="text-[11px] text-muted-foreground">Skipped</p>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{data?.totals.skipped ?? 0}</p>
          </div>
          <div className="rounded-md bg-red-50 p-2.5 dark:bg-red-950/20">
            <p className="text-[11px] text-muted-foreground">Failed</p>
            <p className="text-sm font-bold text-red-700 dark:text-red-400">{data?.totals.failed ?? 0}</p>
          </div>
        </div>

        {data?.byEvent && data.byEvent.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message breakdown</div>
            <div className="divide-y">
              {data.byEvent.map(event => (
                <div key={event.eventType} className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center gap-3 px-3 py-2 text-xs">
                  <span className="truncate font-medium">{eventLabel(event.eventType)}</span>
                  <span className="text-sky-700 dark:text-sky-400">{event.sms} SMS</span>
                  <span className="text-emerald-700 dark:text-emerald-400">{event.whatsapp} WA</span>
                  <span className="text-violet-700 dark:text-violet-400">{event.email} email</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}