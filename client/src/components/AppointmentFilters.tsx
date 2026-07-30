import { addDays, format, startOfDay, startOfMonth } from "date-fns";
import {
  Activity, CalendarDays, CheckCircle2, Filter, Stethoscope, UserX, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StatusFilter = "" | "in-clinic" | "completed" | "cancelled" | "no-show";
type QuickFilter = string;

export type AppointmentFilterOption = { value: string; label: string };

interface AppointmentFiltersProps {
  role: "clinic" | "doctor";
  filterDate?: Date;
  setFilterDate: (date: Date | undefined) => void;
  filterEndDate?: Date;
  setFilterEndDate: (date: Date | undefined) => void;
  quickFilter: QuickFilter;
  setQuickFilter: (filter: any) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
  roleOptions: AppointmentFilterOption[];
  filterRowOpen: boolean;
  onClose: () => void;
  thisWeekCount?: number;
  nextWeekCount?: number;
}

const statusOptions = [
  { value: "in-clinic" as const, label: "In Clinic Now", Icon: Activity, tone: "emerald" },
  { value: "completed" as const, label: "Visit Completed", Icon: CheckCircle2, tone: "slate" },
  { value: "cancelled" as const, label: "Cancelled", Icon: X, tone: "rose" },
  { value: "no-show" as const, label: "No Show", Icon: UserX, tone: "amber" },
];

function sameDate(a?: Date, b?: Date) {
  return !!a && !!b && format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");
}

const chipBase = "min-h-[44px] rounded-full border px-3 text-xs font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";
const sectionClass = "rounded-lg border border-border/40 bg-muted/15 p-2.5";

export function AppointmentFilters({
  role, filterDate, setFilterDate, filterEndDate, setFilterEndDate,
  quickFilter, setQuickFilter, statusFilter, setStatusFilter,
  roleFilter, setRoleFilter, roleOptions, filterRowOpen, onClose,
  thisWeekCount = 0, nextWeekCount = 0,
}: AppointmentFiltersProps) {
  if (!filterRowOpen) return null;

  const today = startOfDay(new Date());
  const presets = [
    { value: "tomorrow", label: "Tomorrow", from: addDays(today, 1), to: addDays(today, 1) },
    { value: "last-7", label: "Last 7 Days", from: addDays(today, -6), to: today },
    { value: "month", label: "This Month", from: startOfMonth(today), to: today },
  ];
  const activeCount = [
    filterDate || filterEndDate,
    quickFilter === "this-week" || quickFilter === "next-week",
    statusFilter,
    roleFilter,
  ].filter(Boolean).length;

  const clearDates = () => { setFilterDate(undefined); setFilterEndDate(undefined); };
  const clearAll = () => {
    clearDates();
    if (quickFilter === "this-week" || quickFilter === "next-week") setQuickFilter("all");
    setStatusFilter("");
    setRoleFilter("");
  };
  const selectPreset = (from: Date, to: Date) => {
    if (sameDate(filterDate, from) && sameDate(filterEndDate, to)) clearDates();
    else {
      setQuickFilter("all");
      setFilterDate(from);
      setFilterEndDate(to);
    }
  };
  const dateLabel = filterDate && filterEndDate
    ? `${format(filterDate, "MMM d")} — ${format(filterEndDate, "MMM d")}`
    : filterDate ? `From ${format(filterDate, "MMM d")}` : filterEndDate ? `Until ${format(filterEndDate, "MMM d")}` : "";

  return (
    <div
      id="appointment-filters"
      aria-label="Appointment filters"
      className="animate-in fade-in slide-in-from-top-1 duration-200 rounded-xl border border-border/50 bg-card p-2.5 shadow-sm sm:p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold tracking-tight">Appointment filters</p>
        {activeCount > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground" aria-live="polite">
            {activeCount} active
          </span>
        )}
        <p className="hidden text-xs text-muted-foreground sm:block">Refine the appointments shown below.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(190px,0.8fr)_minmax(300px,1.35fr)_minmax(180px,0.75fr)]">
        <section className={sectionClass} aria-labelledby="filter-date-label">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span id="filter-date-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Date range
            </span>
            {(filterDate || filterEndDate) && (
              <button type="button" onClick={clearDates} className="text-xs font-semibold text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" data-testid="button-clear-date-filter">Clear</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="min-h-[44px] justify-start rounded-lg border border-border/60 bg-background px-2.5 text-base font-medium sm:text-sm" aria-label="Choose start date" data-testid="button-filter-start-date">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />{filterDate ? format(filterDate, "MMM d") : "Start"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[55] w-auto rounded-xl p-0" align="start">
                <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" disabled={!filterDate} className="min-h-[44px] justify-start rounded-lg border border-border/60 bg-background px-2.5 text-base font-medium sm:text-sm" aria-label="Choose end date" data-testid="button-filter-end-date">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />{filterEndDate ? format(filterEndDate, "MMM d") : "End"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[55] w-auto rounded-xl p-0" align="start">
                <Calendar mode="single" selected={filterEndDate} onSelect={setFilterEndDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </section>

        <section className={sectionClass} aria-labelledby="filter-quick-label">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span id="filter-quick-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick views</span>
            {(quickFilter === "this-week" || quickFilter === "next-week" || filterDate || filterEndDate) && (
              <button type="button" onClick={() => { setQuickFilter("all"); clearDates(); }} className="text-xs font-semibold text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" data-testid="button-clear-quick-filters">Clear</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: "this-week", label: "This Week", count: thisWeekCount },
              { value: "next-week", label: "Next Week", count: nextWeekCount },
            ].map(item => (
              <button key={item.value} type="button" onClick={() => { clearDates(); setQuickFilter(quickFilter === item.value ? "all" : item.value); }} aria-pressed={quickFilter === item.value} className={`${chipBase} ${quickFilter === item.value ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`} data-testid={`chip-filter-${item.value}`}>
                {item.label}<span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${quickFilter === item.value ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>{item.count}</span>
              </button>
            ))}
            {presets.map(preset => {
              const active = sameDate(filterDate, preset.from) && sameDate(filterEndDate, preset.to);
              return <button key={preset.value} type="button" onClick={() => selectPreset(preset.from, preset.to)} aria-pressed={active} className={`${chipBase} ${active ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`} data-testid={`chip-date-${preset.value}`}>{preset.label}</button>;
            })}
          </div>
        </section>

        <section className={sectionClass} aria-labelledby="filter-role-label">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span id="filter-role-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Stethoscope className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> {role === "clinic" ? "Doctor" : "Clinic"}</span>
            {roleFilter && <button type="button" onClick={() => setRoleFilter("")} className="text-xs font-semibold text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" data-testid="button-clear-role-filter">Clear</button>}
          </div>
          <Select value={roleFilter || "all"} onValueChange={value => setRoleFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="h-11 w-full rounded-lg bg-background text-base sm:text-sm" data-testid={role === "clinic" ? "select-doctor-filter" : "select-clinic-filter"} aria-label={`Filter by ${role === "clinic" ? "doctor" : "clinic"}`}>
              <SelectValue placeholder={role === "clinic" ? "All Doctors" : "All Clinics"} />
            </SelectTrigger>
            <SelectContent className="z-[55]">
              <SelectItem value="all">{role === "clinic" ? "All Doctors" : "All Clinics"}</SelectItem>
              {roleOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </section>

        <section className={`${sectionClass} sm:col-span-2 xl:col-span-3`} aria-labelledby="filter-status-label">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span id="filter-status-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Activity className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Status</span>
            {statusFilter && <button type="button" onClick={() => setStatusFilter("")} className="text-xs font-semibold text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" data-testid="button-clear-status-filter">Clear</button>}
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            {statusOptions.map(({ value, label, Icon, tone }) => {
              const active = statusFilter === value;
              const toneClasses = {
                emerald: active ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-200 bg-background text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/20",
                slate: active ? "border-slate-500 bg-slate-500 text-white" : "border-slate-200 bg-background text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-950/20",
                rose: active ? "border-rose-500 bg-rose-500 text-white" : "border-rose-200 bg-background text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/20",
                amber: active ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-background text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/20",
              }[tone];
              return <button key={value} type="button" onClick={() => setStatusFilter(active ? "" : value)} aria-pressed={active} className={`${chipBase} ${toneClasses}`} data-testid={`chip-status-${value}`}><Icon className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{label}</button>;
            })}
          </div>
        </section>
      </div>

      {(activeCount > 0 || dateLabel) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 p-2" aria-live="polite">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active:</span>
          {dateLabel && <button type="button" onClick={clearDates} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">{dateLabel} <X className="ml-1 inline h-3 w-3" aria-hidden="true" /></button>}
          {(quickFilter === "this-week" || quickFilter === "next-week") && <button type="button" onClick={() => setQuickFilter("all")} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">{quickFilter === "this-week" ? "This Week" : "Next Week"} <X className="ml-1 inline h-3 w-3" aria-hidden="true" /></button>}
          {statusFilter && <button type="button" onClick={() => setStatusFilter("")} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">{statusOptions.find(s => s.value === statusFilter)?.label} <X className="ml-1 inline h-3 w-3" aria-hidden="true" /></button>}
          {roleFilter && <button type="button" onClick={() => setRoleFilter("")} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">{roleOptions.find(o => o.value === roleFilter)?.label || roleFilter} <X className="ml-1 inline h-3 w-3" aria-hidden="true" /></button>}
          <button type="button" onClick={clearAll} className="ml-auto text-xs font-semibold text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" data-testid="button-clear-all-filters">Clear all</button>
        </div>
      )}
    </div>
  );
}