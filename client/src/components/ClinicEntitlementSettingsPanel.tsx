import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  Gift,
  HardDrive,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import type { EffectiveEntitlementItem, EffectiveEntitlementReport } from "@shared/effective-entitlement";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PlanComparisonDialog from "@/components/PlanComparisonDialog";

const SUPPORT_EMAIL = "bookmyslot@mail.mossaic.in";

const CAPABILITY_LABELS: Record<string, string> = {
  bookings: "Bookings",
  active_doctors: "Active doctors",
  smile_deals: "Smile Deals",
  storage: "Storage",
  messaging_sms: "SMS",
  messaging_whatsapp: "WhatsApp",
  messaging_email: "Email",
};

const CAPABILITY_ICONS: Record<string, typeof Users> = {
  bookings: CalendarDays,
  active_doctors: Users,
  smile_deals: Gift,
  storage: HardDrive,
  messaging_sms: MessageSquare,
  messaging_whatsapp: MessageSquare,
  messaging_email: Mail,
};

const formatDate = (value: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatNumber = (value: number | null) => value === null ? "Unavailable" : value.toLocaleString("en-IN");

const formatBytes = (value: number | null) => {
  if (value === null) return "Unavailable";
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatPlan = (plan: string | null) => {
  if (!plan) return "Plan not resolved";
  if (plan === "trial") return "Trial";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
};

const formatState = (state: EffectiveEntitlementReport["access"]["state"]) => {
  const labels: Record<EffectiveEntitlementReport["access"]["state"], string> = {
    trial: "Trial active",
    trial_grace: "Trial grace period",
    active_paid: "Active paid",
    sponsored: "Sponsored access",
    attention: "Requires attention",
    unknown: "State unavailable",
  };
  return labels[state];
};

const stateStyles: Record<EffectiveEntitlementReport["access"]["state"], string> = {
  trial: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  trial_grace: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  active_paid: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300",
  sponsored: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
  attention: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  unknown: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
};

const capabilityValue = (item: EffectiveEntitlementItem) => {
  if (item.capability === "storage") return formatBytes(item.usage?.value ?? null);
  return formatNumber(item.usage?.value ?? null);
};

const capabilityLimit = (item: EffectiveEntitlementItem) => {
  if (item.fairUse) return "Fair use";
  if (item.limit === null) return "Included";
  if (item.capability === "storage") return formatBytes(item.limit);
  return item.limit.toLocaleString("en-IN");
};

const periodLabel = (period: string | null | undefined) => {
  if (!period) return null;
  return period.replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
};

function UsageCard({ item }: { item: EffectiveEntitlementItem }) {
  const Icon = CAPABILITY_ICONS[item.capability] ?? Database;
  const used = item.usage?.value;
  const percent = used !== null && used !== undefined && item.limit !== null && item.limit > 0
    ? Math.min(100, (used / item.limit) * 100)
    : null;
  const isUnavailable = !item.usage?.available;

  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-xs font-semibold">{CAPABILITY_LABELS[item.capability] ?? item.capability}</span>
        </div>
        {item.overLimit === true && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className={`text-sm font-bold ${isUnavailable ? "text-muted-foreground" : "text-foreground"}`}>
          {capabilityValue(item)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {isUnavailable ? "Measurement unavailable" : `${capabilityLimit(item)} limit`}
        </span>
      </div>
      {percent !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${percent >= 95 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{periodLabel(item.usage?.period) ?? "Period unavailable"}</span>
        {item.remaining !== null && <span>{formatNumber(item.remaining)} remaining</span>}
      </div>
    </div>
  );
}

export default function ClinicEntitlementSettingsPanel() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isFetching, isError, refetch } = useQuery<EffectiveEntitlementReport>({
    queryKey: ["/api/auth/clinic/settings/entitlements"],
    queryFn: async () => (await apiRequest("GET", "/api/auth/clinic/settings/entitlements")).json(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <div>
            <p className="font-semibold">Plan &amp; access is unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">We could not load your current subscription information.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const usageItems = data.capabilities.filter(item => CAPABILITY_LABELS[item.capability]);
  const isAttention = data.access.state === "attention" || data.access.state === "unknown";
  const isTrial = data.access.state === "trial" || data.access.state === "trial_grace";
  const action = data.nextStep.action;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-emerald-50/40 pb-4 dark:bg-emerald-950/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide">
              <CreditCard className="h-4 w-4 text-emerald-600" />Plan &amp; access
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-2xl">
              A read-only view of your current plan, access status, and measured platform usage.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold">{data.plan.displayName ?? formatPlan(data.plan.effective)}</h3>
              <Badge variant="outline" className={`capitalize ${stateStyles[data.access.state]}`}>
                {data.access.state === "active_paid" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : data.access.state === "unknown" ? <ShieldAlert className="mr-1 h-3 w-3" /> : <Clock3 className="mr-1 h-3 w-3" />}
                {formatState(data.access.state)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.plan.source === "sponsored_access" ? "Provided through sponsored access" : data.plan.source === "plan" ? "Based on your clinic plan" : "Plan source needs review"}
              {data.plan.policyVersion ? ` · Policy ${data.plan.policyVersion}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <PlanComparisonDialog currentPlan={data.plan.effective} />
            {action === "view_plans" && (
              <Button size="sm" onClick={() => setLocation("/pricing")} className="bg-emerald-600 text-white hover:bg-emerald-700">
                View plans <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
            {action === "contact_support" && (
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${SUPPORT_EMAIL}`}>Contact support <Mail className="ml-1.5 h-3.5 w-3.5" /></a>
              </Button>
            )}
          </div>
        </div>

        <div className={`rounded-xl border p-3 ${isAttention ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20" : "border-border/60 bg-background/50"}`}>
          <div className="flex items-start gap-2.5">
            {isAttention ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
            <div>
              <p className="text-sm font-semibold">{data.nextStep.label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{data.nextStep.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trial started</p>
            <p className="mt-1 text-xs font-medium">{formatDate(data.access.trialStartedAt)}</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{isTrial ? "Trial ends" : "Paid access ends"}</p>
            <p className="mt-1 text-xs font-medium">{formatDate(isTrial ? data.access.trialEndsAt : data.access.paidAccessExpiresAt)}</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grace period ends</p>
            <p className="mt-1 text-xs font-medium">{formatDate(data.access.trialGraceEndsAt)}</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Measured</p>
            <p className="mt-1 text-xs font-medium">{formatDate(data.measuredAt)}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{data.timezone}</p>
          </div>
        </div>

        {(data.access.trialOrigin || data.access.previousPaidPlan || data.grants.active > 0 || data.exceptions.active > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {data.access.trialOrigin && <span>Trial origin: <strong className="font-semibold text-foreground">{data.access.trialOrigin.replace(/_/g, " ")}</strong></span>}
            {data.access.previousPaidPlan && <span>Previous paid plan: <strong className="font-semibold text-foreground">{formatPlan(data.access.previousPaidPlan)}</strong></span>}
            {data.grants.active > 0 && <span>Sponsored access ends: <strong className="font-semibold text-foreground">{formatDate(data.grants.endsAt)}</strong></span>}
            {data.exceptions.active > 0 && <span>{data.exceptions.active} temporary access exception{data.exceptions.active === 1 ? "" : "s"}</span>}
          </div>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold">Usage overview</h4>
              <p className="text-xs text-muted-foreground">Measured for your current plan period. Detailed storage and messaging views remain below.</p>
            </div>
            <span className="text-[10px] text-muted-foreground">Reporting only</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {usageItems.map(item => <UsageCard key={item.capability} item={item} />)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}