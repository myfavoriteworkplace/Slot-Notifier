import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import type {
  ClinicMonitoringClinicRow,
  ClinicMonitoringResponse,
} from "@shared/clinic-monitoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";

type DatePreset = "7d" | "30d" | "90d" | "custom";
type ActivityFilter = "all" | "active" | "inactive";
type SortKey = "bookings" | "activeDays" | "externalShare" | "change";

const dateInput = (date: Date) => date.toISOString().slice(0, 10);

function shiftDateInput(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateInput(date);
}

function defaultRange(days: number) {
  const to = dateInput(new Date());
  return { from: shiftDateInput(to, -(days - 1)), to };
}

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

function formatHours(value: number) {
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} h`;
}

function formatRate(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

function formatChange(value: number | null) {
  if (value === null) return "New activity";
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

function changeClass(value: number | null) {
  if (value === null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-2xl font-extrabold tracking-tight">{value}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: ClinicMonitoringResponse["trend"] }) {
  const maxTotal = Math.max(...data.map(point => point.totalBookings), 1);

  if (!data.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No booking activity in this period.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 overflow-x-auto rounded-lg border bg-muted/20 px-3 pb-3 pt-5">
        {data.map(point => {
          const totalHeight = Math.max(5, (point.totalBookings / maxTotal) * 130);
          const externalHeight = point.totalBookings ? (point.externalBookings / point.totalBookings) * totalHeight : 0;
          const internalHeight = point.totalBookings ? (point.internalBookings / point.totalBookings) * totalHeight : 0;
          const unclassifiedHeight = Math.max(0, totalHeight - externalHeight - internalHeight);
          return (
            <div key={point.date} className="group flex min-w-7 flex-1 flex-col items-center gap-1" title={`${point.date}: ${point.totalBookings} bookings`}>
              <div className="flex h-36 items-end">
                <div className="flex w-5 flex-col justify-end overflow-hidden rounded-t bg-muted">
                  <div className="bg-slate-400" style={{ height: `${unclassifiedHeight}px` }} />
                  <div className="bg-amber-400" style={{ height: `${internalHeight}px` }} />
                  <div className="bg-primary" style={{ height: `${externalHeight}px` }} />
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground">{point.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Public bookings</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Clinic-created bookings</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Unclassified legacy bookings</span>
      </div>
    </div>
  );
}

function DetailContent({ report }: { report?: ClinicMonitoringResponse }) {
  const clinic = report?.clinics[0];
  if (!report || !clinic) {
    return <p className="text-sm text-muted-foreground">Monitoring details are unavailable.</p>;
  }

  return (
    <div className="mt-5 space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Aggregate activity</CardTitle>
          <CardDescription>Counts are shown without patient, appointment, or clinical details.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          {[
            ["Active days", formatNumber(clinic.activeDays)],
            ["Public bookings", formatNumber(clinic.externalBookings)],
            ["Clinic-created", formatNumber(clinic.internalBookings)],
            ["Scheduled hours", formatHours(clinic.scheduledHours)],
            ["Observed visit hours", formatHours(clinic.observedVisitHours)],
            ["Average visit", clinic.averageObservedVisitMinutes === null ? "—" : `${clinic.averageObservedVisitMinutes} min`],
            ["Cancellation rate", formatRate(clinic.cancellationRate)],
            ["No-show rate", formatRate(clinic.noShowRate)],
            ["Previous period", formatChange(clinic.changePercent)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-muted/20 p-3">
              <p className="text-muted-foreground">{label}</p>
              <p className={`mt-1 font-bold ${label === "Previous period" ? changeClass(clinic.changePercent) : ""}`}>{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Daily booking trend</CardTitle>
          <CardDescription>Dates are grouped using this clinic’s configured timezone: {clinic.timezone}.</CardDescription>
        </CardHeader>
        <CardContent><TrendChart data={report.trend} /></CardContent>
      </Card>

      <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200">
        Observed visit duration means the time between check-in and completion. It is not an exact consultation-time measurement.
        {clinic.anomalousVisitDurationCount > 0 && ` ${clinic.anomalousVisitDurationCount} unusual duration${clinic.anomalousVisitDurationCount === 1 ? "" : "s"} excluded.`}
      </div>
    </div>
  );
}

export default function AdminClinicMonitoring() {
  const initial = defaultRange(30);
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [sort, setSort] = useState<SortKey>("bookings");
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);

  const monitoringQuery = useQuery<ClinicMonitoringResponse>({
    queryKey: ["/api/admin/clinic-monitoring", from, to, plan],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (plan !== "all") params.set("plan", plan);
      return (await apiRequest("GET", `/api/admin/clinic-monitoring?${params.toString()}`)).json();
    },
    enabled: Boolean(from && to),
    staleTime: 60_000,
    retry: 1,
  });

  const detailQuery = useQuery<ClinicMonitoringResponse>({
    queryKey: ["/api/admin/clinic-monitoring", from, to, selectedClinicId],
    queryFn: async () => {
      const params = new URLSearchParams({
        from,
        to,
        clinicId: String(selectedClinicId),
      });
      return (await apiRequest("GET", `/api/admin/clinic-monitoring?${params.toString()}`)).json();
    },
    enabled: selectedClinicId !== null && Boolean(from && to),
    staleTime: 60_000,
    retry: 1,
  });

  const plans = useMemo(() => {
    const values = new Set((monitoringQuery.data?.clinics ?? []).map(clinic => clinic.plan).filter(Boolean) as string[]);
    return ["all", ...Array.from(values).sort()];
  }, [monitoringQuery.data?.clinics]);

  const filteredClinics = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = (monitoringQuery.data?.clinics ?? [])
      .filter(clinic => activity === "all" || (activity === "active" ? clinic.totalBookings > 0 : clinic.totalBookings === 0))
      .filter(clinic => !needle || clinic.clinicName.toLowerCase().includes(needle));
    return rows.sort((a, b) => {
      if (sort === "activeDays") return b.activeDays - a.activeDays || a.clinicName.localeCompare(b.clinicName);
      if (sort === "externalShare") {
        const aShare = a.totalBookings ? a.externalBookings / a.totalBookings : 0;
        const bShare = b.totalBookings ? b.externalBookings / b.totalBookings : 0;
        return bShare - aShare || a.clinicName.localeCompare(b.clinicName);
      }
      if (sort === "change") return (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity) || a.clinicName.localeCompare(b.clinicName);
      return b.totalBookings - a.totalBookings || a.clinicName.localeCompare(b.clinicName);
    });
  }, [activity, monitoringQuery.data?.clinics, search, sort]);

  const applyPreset = (nextPreset: DatePreset) => {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const next = defaultRange(Number(nextPreset.slice(0, -1)));
      setFrom(next.from);
      setTo(next.to);
    }
  };

  const summary = monitoringQuery.data?.summary;
  const selectedClinic = monitoringQuery.data?.clinics.find(clinic => clinic.clinicId === selectedClinicId);
  const isLoading = monitoringQuery.isLoading;

  return (
    <div className="space-y-5" data-testid="clinic-monitoring-workspace">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Clinic Monitoring</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            See how clinics use BookMySlot at an aggregate level. Patient names, appointments, clinical information, bills, and treatment revenue are not shown.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => monitoringQuery.refetch()} disabled={monitoringQuery.isFetching} className="h-9">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${monitoringQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh monitoring
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reporting period</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["7d", "Last 7 days"],
                ["30d", "Last 30 days"],
                ["90d", "Last 90 days"],
                ["custom", "Custom"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyPreset(value)}
                  className={`rounded-full border px-2.5 py-1.5 text-xs font-medium ${preset === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs text-muted-foreground">
            From
            <input type="date" value={from} onChange={event => { setPreset("custom"); setFrom(event.target.value); }} className="mt-1 block h-9 rounded-md border bg-background px-2 text-xs text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <input type="date" value={to} onChange={event => { setPreset("custom"); setTo(event.target.value); }} className="mt-1 block h-9 rounded-md border bg-background px-2 text-xs text-foreground" />
          </label>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Dates use each clinic’s configured timezone
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-300" role="status">Loading clinic activity…</div>}
      {monitoringQuery.isError && (
        <Card className="border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/15">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span className="flex items-center gap-2 text-red-800 dark:text-red-200"><XCircle className="h-4 w-4" /> Clinic monitoring data could not be loaded.</span>
            <Button size="sm" variant="outline" onClick={() => monitoringQuery.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Active clinics" value={formatNumber(summary.activeClinicCount)} detail={`of ${formatNumber(monitoringQuery.data?.clinics.length ?? 0)} monitored clinics`} icon={Building2} />
          <MetricCard label="Public bookings" value={formatNumber(summary.externalBookingCount)} detail={`${formatNumber(summary.totalBookingCount)} total bookings`} icon={Users} />
          <MetricCard label="Clinic-created bookings" value={formatNumber(summary.internalBookingCount)} detail={summary.unclassifiedBookingCount ? `${formatNumber(summary.unclassifiedBookingCount)} legacy source unknown` : "Source recorded for every booking"} icon={Activity} />
          <MetricCard label="Scheduled hours" value={formatHours(summary.scheduledHours)} detail="Non-cancelled slot time" icon={Clock3} />
          <MetricCard label="Observed visit hours" value={formatHours(summary.observedVisitHours)} detail={summary.averageObservedVisitMinutes === null ? "No usable durations" : `${summary.averageObservedVisitMinutes} min average`} icon={BarChart3} />
        </div>
      )}

      {monitoringQuery.data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide"><BarChart3 className="h-4 w-4 text-primary" />Booking trend</CardTitle>
            <CardDescription>Daily public, clinic-created, and total bookings. No booking-level details are included.</CardDescription>
          </CardHeader>
          <CardContent><TrendChart data={monitoringQuery.data.trend} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide"><Building2 className="h-4 w-4 text-primary" />Clinic activity</CardTitle>
              <CardDescription className="mt-1">{filteredClinics.length} matching clinic{filteredClinics.length === 1 ? "" : "s"} · aggregate activity only</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search clinics" className="h-9 pl-8 text-xs" aria-label="Search clinics" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select value={plan} onChange={event => setPlan(event.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs" aria-label="Filter by plan">
              {plans.map(value => <option key={value} value={value}>{value === "all" ? "All plans" : value}</option>)}
            </select>
            <select value={activity} onChange={event => setActivity(event.target.value as ActivityFilter)} className="h-8 rounded-md border bg-background px-2 text-xs" aria-label="Filter by activity">
              <option value="all">All activity</option>
              <option value="active">Active clinics</option>
              <option value="inactive">No bookings</option>
            </select>
            <select value={sort} onChange={event => setSort(event.target.value as SortKey)} className="h-8 rounded-md border bg-background px-2 text-xs" aria-label="Sort clinic activity">
              <option value="bookings">Sort: bookings</option>
              <option value="activeDays">Sort: active days</option>
              <option value="externalShare">Sort: public share</option>
              <option value="change">Sort: usage change</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {["Clinic", "Plan", "Active days", "Public", "Clinic-created", "Total", "Scheduled", "Observed", "Change", ""].map(label => (
                    <th key={label} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClinics.map(clinic => (
                  <tr key={clinic.clinicId} className="border-b border-border/30 transition-colors hover:bg-muted/20" data-testid={`row-clinic-monitoring-${clinic.clinicId}`}>
                    <th className="px-4 py-3 text-left">
                      <button type="button" onClick={() => setSelectedClinicId(clinic.clinicId)} className="flex items-center gap-2 text-left hover:text-primary">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-xs font-bold text-primary">{clinic.clinicName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                        <span>
                          <span className="block max-w-[190px] truncate text-xs font-semibold">{clinic.clinicName}</span>
                          <span className="block text-[11px] font-normal text-muted-foreground">{clinic.timezone}</span>
                        </span>
                      </button>
                    </th>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-[10px] capitalize">{clinic.plan || "Not selected"}</Badge></td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(clinic.activeDays)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(clinic.externalBookings)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(clinic.internalBookings)}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{formatNumber(clinic.totalBookings)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatHours(clinic.scheduledHours)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatHours(clinic.observedVisitHours)}</td>
                    <td className={`px-4 py-3 text-xs font-semibold ${changeClass(clinic.changePercent)}`}>
                      <span className="inline-flex items-center gap-1">{clinic.changePercent !== null && clinic.changePercent < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : clinic.changePercent !== null && clinic.changePercent > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{formatChange(clinic.changePercent)}</span>
                    </td>
                    <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedClinicId(clinic.clinicId)}>Open</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredClinics.length && <div className="flex flex-col items-center justify-center px-4 py-12 text-center"><Search className="mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-muted-foreground">No clinics match this view</p><p className="mt-1 text-xs text-muted-foreground/70">Try a different search or filter.</p></div>}
          </div>
        </CardContent>
      </Card>

      <Sheet open={selectedClinicId !== null} onOpenChange={open => !open && setSelectedClinicId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />{selectedClinic?.clinicName || "Clinic activity"}</SheetTitle>
            <SheetDescription>{selectedClinic ? `Aggregate monitoring · ${selectedClinic.timezone}` : "Aggregate monitoring details"}</SheetDescription>
          </SheetHeader>
          {detailQuery.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading clinic details…</p> : detailQuery.isError ? <p className="mt-6 text-sm text-red-600">Clinic details are unavailable.</p> : <DetailContent report={detailQuery.data} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}