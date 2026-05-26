import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, IndianRupee, Users, CalendarDays, Activity,
  ShieldCheck, Package, AlertTriangle, RefreshCw, BarChart2,
  CheckCircle2, Clock, XCircle, UserCheck, UserPlus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Chart color palette (SVG fills — CSS vars can't be used in SVG attribute strings) ──
const C = {
  primary:  '#0F9B6E',
  accent:   '#1D9E75',
  blue:     '#3B82F6',
  amber:    '#F59E0B',
  rose:     '#F43F5E',
  teal:     '#14B8A6',
  violet:   '#8B5CF6',
  slate:    '#94A3B8',
  orange:   '#F97316',
};
const PIE_COLORS = [C.primary, C.blue, C.amber, C.rose, C.teal, C.violet, C.slate];

// ── Types ─────────────────────────────────────────────────────────────────────
type Range = '30d' | '60d' | '90d' | 'year';

interface AnalyticsData {
  range: string;
  overview: {
    totalBookings: number;
    todayBookings: number;
    utilizationPct: number;
    cancellations: number;
    trendByDay: { date: string; count: number }[];
  };
  financial: {
    totalRevenue: number;
    outstanding: number;
    avgRevenuePerPatient: number;
    paymentBreakdown: { method: string; amount: number; count: number }[];
    revenueTrend: { week: string; amount: number }[];
  };
  appointments: {
    statusBreakdown: { status: string; count: number }[];
    doctorWorkload: { doctor: string; count: number }[];
    topProcedures: { procedure: string; count: number }[];
  };
  patients: {
    total: number;
    newPatients: number;
    repeatPatients: number;
    growthByMonth: { month: string; count: number }[];
  };
  compliance: {
    consentRate: number;
    signedCount: number;
    totalWithConsent: number;
    inventoryAlerts: number;
    lowStockItems: number;
    expiringItems: number;
    loginSuccess: number;
    loginFail: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtINR(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`;
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, currency = false }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background shadow-lg px-3 py-2">
      {label && <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color ?? p.fill }}>
          {currency ? fmtINR(p.value) : p.value.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub,
  icon: Icon,
  iconBg = 'bg-primary/10',
  iconColor = 'text-primary',
}: {
  label: string;
  value: string | number;
  sub?: string;
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
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
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

// ── Chart card wrapper ────────────────────────────────────────────────────────
function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/50 bg-card shadow-sm p-4 ${className}`}>
      <p className="text-sm font-semibold text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[160px] w-full rounded-lg" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[160px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
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

// ── Empty state ───────────────────────────────────────────────────────────────
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

// ── Status colour map ─────────────────────────────────────────────────────────
function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('closed') || s.includes('complete')) return C.primary;
  if (s.includes('await') || s.includes('pending'))   return C.amber;
  if (s.includes('cancel') || s.includes('declined')) return C.rose;
  if (s.includes('progress') || s.includes('active')) return C.blue;
  return C.slate;
}

// ── Range config ──────────────────────────────────────────────────────────────
const RANGES: { key: Range; label: string }[] = [
  { key: '30d',  label: '30 Days'   },
  { key: '60d',  label: '60 Days'   },
  { key: '90d',  label: '90 Days'   },
  { key: 'year', label: 'This Year' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function ClinicAnalyticsPanel() {
  const [range, setRange] = useState<Range>('30d');

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
    queryKey: [`/api/auth/clinic/analytics?range=${range}`],
  });

  if (isLoading) return <AnalyticsSkeleton />;
  if (isError)   return <ErrorState onRetry={refetch} />;
  if (!data)     return <EmptyState />;

  const { overview, financial, appointments, patients, compliance } = data;
  const hasFinancial    = financial.paymentBreakdown.length > 0 || financial.totalRevenue > 0;
  const hasDoctors      = appointments.doctorWorkload.length > 0;
  const hasProcedures   = appointments.topProcedures.length > 0;
  const hasPatientChart = patients.growthByMonth.length > 0;
  const maxProcCount    = appointments.topProcedures[0]?.count ?? 1;

  return (
    <div className="space-y-7 animate-in fade-in duration-200">

      {/* ── Header row ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="flex">
          <div className="w-1.5 bg-violet-500/60 shrink-0" />
          <div className="flex-1 px-5 py-4 bg-gradient-to-r from-violet-500/[0.06] to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <TrendingUp className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Analytics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All metrics are scoped to your clinic for the selected period.
                </p>
              </div>
            </div>
            {/* Range filter pills */}
            <div
              className="flex items-center gap-1 p-1 rounded-xl border border-border/50 bg-muted/30 self-start sm:self-auto shrink-0"
              role="group"
              aria-label="Date range"
            >
              {RANGES.map(r => (
                <button
                  key={r.key}
                  data-testid={`range-${r.key}`}
                  onClick={() => setRange(r.key)}
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

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 — Clinic Overview
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={Activity}
          title="Clinic Overview"
          sub="Appointment volume and slot utilisation"
          iconBg="bg-primary/10"
          iconColor="text-primary"
        />

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Total Bookings"
            value={overview.totalBookings.toLocaleString('en-IN')}
            sub="In selected period"
            icon={CalendarDays}
            iconBg="bg-primary/10"
            iconColor="text-primary"
          />
          <StatCard
            label="Today"
            value={overview.todayBookings}
            sub="Appointments today"
            icon={Clock}
            iconBg="bg-sky-500/10"
            iconColor="text-sky-500"
          />
          <StatCard
            label="Utilisation"
            value={`${overview.utilizationPct}%`}
            sub="Slots filled"
            icon={TrendingUp}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Cancellations"
            value={overview.cancellations}
            sub="Cancelled slots"
            icon={XCircle}
            iconBg="bg-rose-500/10"
            iconColor="text-rose-500"
          />
        </div>

        {/* Appointments trend */}
        <ChartCard title="Appointments Trend">
          {overview.trendByDay.length === 0 ? (
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

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 — Financial Overview
      ══════════════════════════════════════════════════════════════════ */}
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
            sub="Paid bills"
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
            sub="Average revenue"
            icon={Users}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payment method donut */}
          <ChartCard title="Payment Method Breakdown">
            {!hasFinancial || financial.paymentBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-[200px]">
                <p className="text-sm text-muted-foreground">No billing data for this period.</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={190}>
                  <PieChart>
                    <Pie
                      data={financial.paymentBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={52} outerRadius={78}
                      dataKey="amount" nameKey="method"
                      paddingAngle={3}
                    >
                      {financial.paymentBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {financial.paymentBreakdown.map((p, i) => (
                    <div key={p.method} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{p.method}</p>
                        <p className="text-xs text-muted-foreground">{fmtINR(p.amount)} · {p.count} bill{p.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          {/* Revenue trend */}
          <ChartCard title="Revenue Trend (by week)">
            {financial.revenueTrend.length === 0 ? (
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
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3 — Appointment Metrics
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={BarChart2}
          title="Appointment Metrics"
          sub="Doctor workload, clinical status and top procedures"
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Doctor workload */}
          <ChartCard title="Doctor Workload">
            {!hasDoctors ? (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-sm text-muted-foreground">No appointments assigned yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, appointments.doctorWorkload.length * 44)}>
                <BarChart
                  data={appointments.doctorWorkload}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" tick={tickStyle} allowDecimals={false} />
                  <YAxis
                    type="category" dataKey="doctor"
                    tick={tickStyle} width={90}
                    tickFormatter={v => v.length > 11 ? v.slice(0, 11) + '…' : v}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill={C.primary} radius={[0, 5, 5, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Clinical status breakdown */}
          <ChartCard title="Clinical Status Breakdown">
            {appointments.statusBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-sm text-muted-foreground">No booking status data yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5 py-2">
                {appointments.statusBreakdown.map(s => {
                  const total = appointments.statusBreakdown.reduce((a, b) => a + b.count, 0);
                  const pct   = total > 0 ? Math.round((s.count / total) * 100) : 0;
                  const col   = statusColor(s.status);
                  return (
                    <div key={s.status} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold capitalize truncate">{s.status}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{s.count} · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, background: col }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>
        </div>

        {/* Top procedures */}
        {hasProcedures && (
          <ChartCard title="Top Procedures / Diagnoses" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {appointments.topProcedures.map((p, i) => {
                const pct = Math.round((p.count / maxProcCount) * 100);
                return (
                  <div key={p.procedure} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                        <span className="text-xs font-semibold truncate">{p.procedure}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{p.count}</Badge>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4 — Patient Insights
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={Users}
          title="Patient Insights"
          sub="New vs repeat patients and growth over time"
          iconBg="bg-rose-500/10"
          iconColor="text-rose-500"
        />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <StatCard
            label="Total Patients"
            value={patients.total.toLocaleString('en-IN')}
            sub="All time"
            icon={Users}
            iconBg="bg-rose-500/10"
            iconColor="text-rose-500"
          />
          <StatCard
            label="New Patients"
            value={patients.newPatients}
            sub="1st visit only"
            icon={UserPlus}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-500"
          />
          <StatCard
            label="Repeat Patients"
            value={patients.repeatPatients}
            sub="2+ visits"
            icon={UserCheck}
            iconBg="bg-teal-500/10"
            iconColor="text-teal-600 dark:text-teal-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* New vs Repeat donut */}
          <ChartCard title="New vs Repeat Patients">
            {patients.total === 0 ? (
              <div className="flex items-center justify-center h-[190px]">
                <p className="text-sm text-muted-foreground">No patients yet.</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={190}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'New',    value: patients.newPatients },
                        { name: 'Repeat', value: patients.repeatPatients },
                      ]}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={76}
                      dataKey="value" paddingAngle={3}
                    >
                      <Cell fill={C.violet} />
                      <Cell fill={C.teal} />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: C.violet }} />
                    <div>
                      <p className="text-xs font-semibold">New Patients</p>
                      <p className="text-xs text-muted-foreground">{patients.newPatients} ({patients.total > 0 ? Math.round((patients.newPatients / patients.total) * 100) : 0}%)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: C.teal }} />
                    <div>
                      <p className="text-xs font-semibold">Repeat Patients</p>
                      <p className="text-xs text-muted-foreground">{patients.repeatPatients} ({patients.total > 0 ? Math.round((patients.repeatPatients / patients.total) * 100) : 0}%)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ChartCard>

          {/* Patient growth by month */}
          <ChartCard title="Patient Growth (by month)">
            {!hasPatientChart ? (
              <div className="flex items-center justify-center h-[190px]">
                <p className="text-sm text-muted-foreground">No growth data yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={patients.growthByMonth} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="month" tick={tickStyle} />
                  <YAxis tick={tickStyle} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill={C.violet} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5 — Quality & Compliance
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={ShieldCheck}
          title="Quality & Compliance"
          sub="Consent, inventory and login audit"
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600 dark:text-amber-400"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

          {/* Consent compliance */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">Consent Compliance</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Signed</span>
                <span className="text-xs font-bold text-primary">{compliance.consentRate}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${compliance.consentRate}%`, background: C.primary }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {compliance.signedCount} of {compliance.totalWithConsent} bookings have signed consent
              </p>
            </div>
          </div>

          {/* Inventory alerts */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold">Inventory Health</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Active alerts</span>
                <Badge variant={compliance.inventoryAlerts > 0 ? "destructive" : "secondary"} className="text-[10px]">
                  {compliance.inventoryAlerts}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Low / out of stock</span>
                <Badge variant={compliance.lowStockItems > 0 ? "destructive" : "secondary"} className="text-[10px]">
                  {compliance.lowStockItems}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Expiring in 30 days</span>
                <Badge variant={compliance.expiringItems > 0 ? "destructive" : "secondary"} className="text-[10px]">
                  {compliance.expiringItems}
                </Badge>
              </div>
            </div>
          </div>

          {/* Login audit */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-sm font-semibold">Login Audit</p>
            </div>
            {compliance.loginSuccess + compliance.loginFail === 0 ? (
              <p className="text-xs text-muted-foreground">No login events in this period.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Successful logins</span>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    {compliance.loginSuccess}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Failed attempts</span>
                  <Badge variant={compliance.loginFail > 0 ? "destructive" : "secondary"} className="text-[10px]">
                    {compliance.loginFail}
                  </Badge>
                </div>
                {compliance.loginFail > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {compliance.loginFail} failed login{compliance.loginFail !== 1 ? 's' : ''} detected
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
