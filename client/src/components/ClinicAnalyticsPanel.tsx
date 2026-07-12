import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, CartesianGrid,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, IndianRupee, Users, CalendarDays, Activity,
  ShieldCheck, Package, AlertTriangle, RefreshCw, BarChart2,
  CheckCircle2, Clock, XCircle, UserCheck, UserPlus,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import type { AnalyticsData } from "@/lib/clinic-constants";

// -- Chart color palette (SVG fills - CSS vars can't be used in SVG attribute strings) --
const C = {
  primary: '#0F9B6E',
  accent:  '#1D9E75',
  blue:    '#3B82F6',
  amber:   '#F59E0B',
  rose:    '#F43F5E',
  teal:    '#14B8A6',
  violet:  '#8B5CF6',
  slate:   '#94A3B8',
  orange:  '#F97316',
};

// -- Helpers ---------------------------------------------------------------
function fmtINR(n: number): string {
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `\u20b9${(n / 1000).toFixed(1)}K`;
  return `\u20b9${Math.round(n).toLocaleString('en-IN')}`;
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`;
}

// -- Chart tooltip ----------------------------------------------------------
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ color?: string; fill?: string; value: number; name?: string }>;
  label?: string;
  currency?: boolean;
}
const ChartTooltip = ({ active, payload, label, currency = false }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background shadow-lg px-3 py-2">
      {label && <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color ?? p.fill }}>
          {currency ? fmtINR(p.value) : p.value.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
};

// -- Comparison pill ---------------------------------------------------------
function ChangePill({ value, label }: { value: number; label?: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">{label ?? 'No change'}</span>;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}% {label ?? (isUp ? 'vs last period' : 'vs last period')}
    </span>
  );
}

// -- Stat card --------------------------------------------------------------
function StatCard({
  label, value, sub, change,
  icon: Icon,
  iconBg = 'bg-primary/10',
  iconColor = 'text-primary',
}: {
  label: string;
  value: string | number;
  sub?: string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 flex items-start gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-display font-bold mt-0.5 leading-none">{value}</p>
        {change !== undefined && <div className="mt-1"><ChangePill value={change} /></div>}
        {sub && !change && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// -- Section header ---------------------------------------------------------
function SectionHeader({
  icon: Icon, title, sub,
  iconBg = 'bg-primary/10', iconColor = 'text-primary',
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div>
        <p className="text-base font-semibold">{title}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// -- Chart card wrapper - subtle inner background for chart distinction -----
function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/50 bg-card shadow-sm p-4 ${className}`}>
      <p className="text-sm font-semibold text-muted-foreground mb-3">{title}</p>
      <div className="rounded-xl bg-[#F8F8F6] dark:bg-[#0f172a] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// -- Skeleton ---------------------------------------------------------------
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card shadow-sm p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4">
        <Skeleton className="h-4 w-36 mb-3" />
        <Skeleton className="h-[180px] w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card shadow-sm p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Error state ------------------------------------------------------------
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-rose-500" />
      </div>
      <div>
        <p className="text-base font-semibold">Failed to load analytics</p>
        <p className="text-sm text-muted-foreground mt-1">Something went wrong fetching your dashboard data.</p>
      </div>
      <Button onClick={onRetry} variant="outline" className="gap-2 min-h-[44px]">
        <RefreshCw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}

// -- Empty state ------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <BarChart2 className="h-6 w-6 text-primary" />
      </div>
      <p className="text-base font-semibold">No data yet</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Analytics will appear once your clinic has bookings, bills, and patient records.
      </p>
    </div>
  );
}

// -- Range config -----------------------------------------------------------
const PRESET_RANGES = [
  { key: '30d',  label: '30 Days'   },
  { key: '60d',  label: '60 Days'   },
  { key: '90d',  label: '90 Days'   },
  { key: 'year', label: 'This Year' },
] as const;

type PresetRange = typeof PRESET_RANGES[number]['key'];

// -- Main component ---------------------------------------------------------
export default function ClinicAnalyticsPanel() {
  const { isAuthenticated } = useClinicAuth();
  const [range, setRange] = useState<PresetRange>('30d');

  // Dark-mode aware chart colours
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const tickStyle  = { fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 } as const;
  const gridStroke = isDark ? '#1e293b' : '#f1f5f9';

  const { data, isLoading, isError, refetch } = useQuery<AnalyticsData>({
    queryKey: ['/api/auth/clinic/analytics', range],
    enabled: isAuthenticated,
  });

  if (isLoading) return <AnalyticsSkeleton />;
  if (isError)   return <ErrorState onRetry={refetch} />;
  if (!data)     return <EmptyState />;

  const { overview, financial, patients, compliance, appointments } = data;

  return (
    <div className="space-y-7 animate-in fade-in duration-200">

      {/* Header — card with icon + title + range pills (matches Inventory / other panels) */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="flex">
          <div className="w-1.5 bg-violet-500/60 shrink-0" />
          <div className="flex-1 px-5 py-4 bg-gradient-to-r from-violet-500/[0.06] to-transparent flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <BarChart2 className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Analytics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Clinic performance</p>
              </div>
            </div>
            <div
              className="flex items-center gap-1 p-1 rounded-xl border border-border/50 bg-muted/30"
              role="group"
              aria-label="Date range"
            >
              {PRESET_RANGES.map(r => (
                <button
                  key={r.key}
                  data-testid={`range-${r.key}`}
                  onClick={() => setRange(r.key)}
                  aria-pressed={range === r.key}
                  className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg transition-all active:scale-[0.97] ${
                    range === r.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts banner */}
      {compliance.alerts && compliance.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold">Attention needed</span>
          </div>
          <ul className="space-y-1">
            {compliance.alerts.map((alert, idx) => (
              <li key={idx} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ================================================================
          SECTION 1 - Overview (slots, utilization, cancellations, no-shows)
          ================================================================ */}
      <section>
        <SectionHeader
          icon={TrendingUp}
          title="Overview"
          sub="Appointments, slot utilization and patient activity"
          iconBg="bg-violet-500/10"
          iconColor="text-violet-600 dark:text-violet-400"
        />

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <StatCard
            label="Total Bookings"
            value={overview.totalBookings}
            change={overview.changeTotalBookings}
            icon={CalendarDays}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="New Patients"
            value={patients.newPatients}
            sub={`${patients.total} total`}
            icon={UserPlus}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            label="Utilization"
            value={`${overview.utilizationPct}%`}
            sub="Booked vs available slots"
            icon={Activity}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-600 dark:text-violet-400"
          />
          <StatCard
            label="Cancellations"
            value={overview.cancellations}
            sub="Cancelled / no-show"
            icon={XCircle}
            iconBg="bg-rose-500/10"
            iconColor="text-rose-500"
          />
          <StatCard
            label="No-Show Rate"
            value={`${overview.noShowRate}%`}
            change={overview.changeNoShowRate}
            sub={`${overview.noShowCount} missed appointments`}
            icon={AlertTriangle}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600 dark:text-amber-400"
          />
        </div>

        {/* Appointments trend */}
        <ChartCard title="Appointments Trend">
          {overview.trendByDay && overview.trendByDay.length === 0 ? (
            <div className="flex items-center justify-center h-[180px]">
              <p className="text-sm text-muted-foreground">No appointment data for this period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={overview.trendByDay} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={tickStyle} tickFormatter={fmtDate} interval="preserveStartEnd" />
                <YAxis tick={tickStyle} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" stroke={C.primary} strokeWidth={2} fill="url(#gradBookings)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* ================================================================
          SECTION 2 - Financial Overview
          ================================================================ */}
      <section>
        <SectionHeader
          icon={IndianRupee}
          title="Financial Overview"
          sub="Revenue, outstanding and payment breakdown"
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <StatCard
            label="Total Revenue"
            value={fmtINR(financial.totalRevenue)}
            change={financial.changeRevenue}
            icon={IndianRupee}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Outstanding"
            value={fmtINR(financial.outstanding)}
            sub="Unpaid / pending"
            icon={AlertTriangle}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            label="Avg / Patient"
            value={fmtINR(financial.avgRevenuePerPatient)}
            sub="Per unique patient billed"
            icon={UserCheck}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
          />
        </div>

        {/* Revenue trend */}
        <ChartCard title="Revenue Trend (by week)">
          {financial.revenueTrend && financial.revenueTrend.length === 0 ? (
            <div className="flex items-center justify-center h-[190px]">
              <p className="text-sm text-muted-foreground">No revenue data for this period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={financial.revenueTrend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="week" tick={tickStyle} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={tickStyle} tickFormatter={v => fmtINR(v)} width={58} />
                <Tooltip content={<ChartTooltip currency />} />
                <Area type="monotone" dataKey="amount" stroke={C.accent} strokeWidth={2} fill="url(#gradRevenue)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Revenue by Doctor */}
        {financial.revenueByDoctor && financial.revenueByDoctor.length > 0 && (
          <ChartCard title="Revenue by Doctor" className="mt-4">
            <div className="space-y-3 p-2">
              {financial.revenueByDoctor.map((d) => {
                const max = financial.revenueByDoctor[0]?.amount ?? 1;
                const pct = max > 0 ? (d.amount / max) * 100 : 0;
                return (
                  <div key={d.doctor} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold truncate">{d.doctor}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtINR(d.amount)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        )}
      </section>

      {/* ================================================================
          SECTION 3 - Conversion Funnel
          ================================================================ */}
      {appointments && appointments.funnel && appointments.funnel.booked > 0 && (
        <section>
          <SectionHeader
            icon={BarChart2}
            title="Conversion Funnel"
            sub="Patient journey from booking to payment"
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
          />

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4">
            <div className="space-y-2 max-w-lg mx-auto">
              {[
                { label: 'Booked', value: appointments.funnel.booked, color: 'bg-slate-400' },
                { label: 'Confirmed', value: appointments.funnel.confirmed, color: 'bg-violet-400' },
                { label: 'Checked In', value: appointments.funnel.checkedIn, color: 'bg-blue-400' },
                { label: 'Treatment Done', value: appointments.funnel.treatmentDone, color: 'bg-emerald-400' },
                { label: 'Visit Completed', value: appointments.funnel.visitCompleted, color: 'bg-emerald-500' },
                { label: 'Bills Paid', value: appointments.funnel.billsPaid, color: 'bg-emerald-600' },
              ].map((step, idx) => {
                const max = appointments.funnel.booked || 1;
                const pct = (step.value / max) * 100;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-36 text-xs font-medium text-muted-foreground text-right shrink-0">
                      {step.label}
                    </span>
                    <div className="flex-1 h-6 rounded-md overflow-hidden bg-muted">
                      <div
                        className={`h-full flex items-center justify-end px-2 text-xs font-bold text-white ${step.color}`}
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={step.value}
                        aria-valuemin={0}
                        aria-valuemax={max}
                      >
                        {pct > 15 ? step.value.toLocaleString('en-IN') : ''}
                      </div>
                    </div>
                    <span className="w-16 text-xs font-semibold shrink-0">{step.value.toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          SECTION 4 - Patient Demographics
          ================================================================ */}
      <section>
        <SectionHeader
          icon={Users}
          title="Patient Demographics"
          sub="Gender and age distribution"
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gender */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Gender Distribution</p>
            {patients.genderBreakdown && patients.genderBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-[120px]">
                <p className="text-sm text-muted-foreground">No gender data available.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {patients.genderBreakdown.map((g) => {
                  const total = patients.genderBreakdown.reduce((s, x) => s + x.count, 0) || 1;
                  const pct = (g.count / total) * 100;
                  const color = g.gender === 'male' ? C.blue : g.gender === 'female' ? C.rose : C.violet;
                  return (
                    <div key={g.gender} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize font-medium">{g.gender}</span>
                        <span className="font-bold">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Age */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Age Distribution</p>
            {patients.ageBreakdown && patients.ageBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-[120px]">
                <p className="text-sm text-muted-foreground">No age data available.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {patients.ageBreakdown.map((a) => {
                  const max = patients.ageBreakdown[0]?.count ?? 1;
                  const pct = max > 0 ? (a.count / max) * 100 : 0;
                  return (
                    <div key={a.bucket} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{a.bucket}</span>
                        <span className="font-bold">{a.count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 5 - Compliance
          ================================================================ */}
      <section>
        <SectionHeader
          icon={ShieldCheck}
          title="Compliance"
          sub="Consent status and inventory checks"
          iconBg="bg-sky-500/10"
          iconColor="text-sky-500"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Consent Rate"
            value={`${compliance.consentRate}%`}
            sub={`${compliance.signedCount} of ${compliance.totalWithConsent}`}
            icon={CheckCircle2}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Consent Pending"
            value={compliance.totalWithConsent - compliance.signedCount}
            icon={Clock}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            label="Low Stock"
            value={compliance.lowStockItems}
            icon={Package}
            iconBg="bg-rose-500/10"
            iconColor="text-rose-500"
          />
          <StatCard
            label="Expiring Items"
            value={compliance.expiringItems}
            icon={AlertTriangle}
            iconBg="bg-orange-500/10"
            iconColor="text-orange-500"
          />
        </div>
      </section>

    </div>
  );
}
