import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Copy,
  Database,
  Gift,
  Gauge,
  Globe,
  History,
  KeyRound,
  Link2,
  Mail,
  MapPin,
  Phone,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  XCircle,
} from "lucide-react";
import type { Clinic } from "@shared/schema";
import type { EffectiveEntitlementItem, EffectiveEntitlementReport } from "@shared/effective-entitlement";
import { getAdminClinicLifecycleState } from "@shared/admin-operations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccessAction = "sponsored" | "exception";

const CAPABILITY_LABELS: Record<string, string> = {
  bookings: "Bookings",
  active_doctors: "Active doctors",
  smile_deals: "Live Smile Deals",
  storage: "Storage",
  messaging_sms: "SMS",
  messaging_whatsapp: "WhatsApp",
  messaging_email: "Email",
  analytics: "Analytics",
  export: "Data export",
  inventory: "Inventory",
  pharmacy: "Pharmacy",
  website: "Clinic website",
  support: "Support",
  public_profile: "Public profile",
  verified_badge: "Verified badge",
  featured_deal_placement: "Featured deal placement",
  essential_whatsapp: "Essential WhatsApp",
  routine_whatsapp: "Routine WhatsApp",
  bulk_whatsapp: "Bulk WhatsApp",
  promotional_whatsapp: "Promotional WhatsApp",
  advanced_whatsapp: "Advanced WhatsApp",
};

const formatDate = (value: string | null) => {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

const formatBytes = (value: number | null) => {
  if (value === null) return "—";
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatNumber = (value: number | null) => value === null ? "—" : value.toLocaleString("en-IN");

const formatCapabilityValue = (capability: EffectiveEntitlementItem["capability"], value: number | null) => (
  capability === "storage" ? formatBytes(value) : formatNumber(value)
);

const usagePercent = (item: EffectiveEntitlementItem) => {
  if (!item.usage?.available || item.usage.value === null || item.limit === null || item.limit <= 0) return null;
  return Math.min(100, Math.max(0, (item.usage.value / item.limit) * 100));
};

const labelFor = (value: string | null | undefined) => {
  if (!value) return "—";
  if (value === "active_paid") return "Active Paid";
  if (value === "sponsored") return "Sponsored Access";
  return value.replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
};

const sourceLabel = (source: EffectiveEntitlementReport["plan"]["source"]) => ({
  plan: "Published plan",
  sponsored_access: "Sponsored access",
  exception: "Temporary exception",
  unknown: "Unknown",
}[source]);

const accessStateClass = (state: EffectiveEntitlementReport["access"]["state"]) => {
  if (state === "active_paid" || state === "trial") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
  if (state === "sponsored") {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300";
  }
  if (state === "unknown") {
    return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
};

const nextBestActionClass = (action: EffectiveEntitlementReport["nextStep"]["action"]) => {
  if (action === "contact_support") {
    return "border-red-200 border-l-red-500 bg-red-50/70 dark:border-red-900/60 dark:border-l-red-500 dark:bg-red-950/20";
  }
  if (action === "view_plans") {
    return "border-amber-200 border-l-amber-500 bg-amber-50/70 dark:border-amber-900/60 dark:border-l-amber-500 dark:bg-amber-950/20";
  }
  return "border-emerald-200 border-l-emerald-500 bg-emerald-50/70 dark:border-emerald-900/60 dark:border-l-emerald-500 dark:bg-emerald-950/20";
};

const lifecycleLabel = (clinic: Clinic) => {
  const state = getAdminClinicLifecycleState(clinic);
  return state === "active" ? "Active" : state === "pending" ? "Pending" : state === "archived" ? "Archived" : labelFor(state);
};

function SectionHeading({ icon: Icon, title, description }: { icon: typeof Database; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function MetricItem({ label, value, detail, valueClass = "" }: { label: string; value: string; detail: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-xs font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function FeatureStatus({ item }: { item: EffectiveEntitlementItem }) {
  const className = item.enabled === false
    ? "text-muted-foreground"
    : item.source === "exception"
      ? "text-amber-700 dark:text-amber-300"
      : item.enabled === null
        ? "text-slate-600 dark:text-slate-300"
        : "text-emerald-700 dark:text-emerald-300";
  const Icon = item.enabled === false ? XCircle : item.enabled === null ? ShieldAlert : CheckCircle2;
  const value = item.enabled === false
    ? "Not included"
    : item.enabled === null
      ? "Unknown"
      : typeof item.value === "string"
        ? labelFor(item.value)
        : "Included";

  return (
    <span className={`inline-flex items-center gap-1 text-right text-[11px] font-semibold ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />{value}
    </span>
  );
}

function UsageItem({ item }: { item: EffectiveEntitlementItem }) {
  const percent = usagePercent(item);
  const usageAvailable = Boolean(item.usage?.available && item.usage.value !== null);
  const currentValue = usageAvailable ? formatCapabilityValue(item.capability, item.usage!.value) : "Unavailable";
  const limitValue = item.fairUse ? "Fair use" : item.limit !== null ? formatCapabilityValue(item.capability, item.limit) : "No limit";
  const remainingValue = item.remaining !== null
    ? `${formatCapabilityValue(item.capability, item.remaining)} remaining`
    : item.reasonCode === "USAGE_UNAVAILABLE"
      ? "Usage unavailable"
      : labelFor(item.reasonCode);

  return (
    <div className={`rounded-lg border p-3 ${item.overLimit ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold">{CAPABILITY_LABELS[item.capability] || labelFor(item.capability)}</span>
        {item.overLimit ? <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" /> : usageAvailable ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{currentValue}</span>
        <span className="text-[11px] text-muted-foreground">of {limitValue}</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role={percent === null ? undefined : "progressbar"}
        aria-label={`${CAPABILITY_LABELS[item.capability] || labelFor(item.capability)} usage`}
        aria-valuemin={percent === null ? undefined : 0}
        aria-valuemax={percent === null ? undefined : 100}
        aria-valuenow={percent === null ? undefined : percent}
      >
        {percent !== null && <div className={`h-full rounded-full ${item.overLimit ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${percent}%` }} />}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{remainingValue} · {sourceLabel(item.source)}</p>
    </div>
  );
}

export default function ClinicControlCenter({
  clinic,
  report,
  attentionCount,
  numericCapabilities,
  featureCapabilities,
  hasTrialHistory,
  reportLoading,
  reportError,
  onRetryReport,
  onStartTrial,
  onAssignPaidPlan,
  onRecordOfflinePayment,
  onOpenAccessDialog,
  auditEventCount,
  auditHistoryLoading,
  onOpenAuditTrail,
  onCopyClinicUrl,
  onEditClinic,
  onManageCredentials,
  onArchiveClinic,
  onRestoreClinic,
}: {
  clinic: Clinic;
  report: EffectiveEntitlementReport | null | undefined;
  attentionCount: number;
  numericCapabilities: EffectiveEntitlementItem[];
  featureCapabilities: EffectiveEntitlementItem[];
  hasTrialHistory: boolean;
  reportLoading: boolean;
  reportError: boolean;
  onRetryReport: () => void;
  onStartTrial: () => void;
  onAssignPaidPlan: () => void;
  onRecordOfflinePayment: (mode: "activation" | "renewal") => void;
  onOpenAccessDialog: (action: AccessAction) => void;
  auditEventCount: number;
  auditHistoryLoading: boolean;
  onOpenAuditTrail: () => void;
  onCopyClinicUrl?: (clinic: Clinic, kind: "book" | "about") => void;
  onEditClinic?: (clinic: Clinic) => void;
  onManageCredentials?: (clinic: Clinic) => void;
  onArchiveClinic?: (clinic: Clinic) => void;
  onRestoreClinic?: (clinic: Clinic) => void;
}) {
  const hasContactDetails = Boolean(clinic.address || clinic.city || (clinic as any).pincode || clinic.email || clinic.phone || clinic.website);
  const lifecycle = lifecycleLabel(clinic);
  const isArchived = getAdminClinicLifecycleState(clinic) === "archived";
  const clinicInitials = clinic.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div data-testid={`clinic-profile-actions-${clinic.id}`} data-clinic-control-center="true" className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
                {clinicInitials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{clinic.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{lifecycle}</Badge>
                  {report && (
                    <Badge variant="outline" className={`text-[10px] ${accessStateClass(report.access.state)}`}>
                      {report.access.state === "unknown" ? <ShieldAlert className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {labelFor(report.access.state)}
                    </Badge>
                  )}
                  {attentionCount > 0 && (
                    <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-300">
                      {attentionCount} attention {attentionCount === 1 ? "item" : "items"}
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1 truncate">
                  {clinic.city || "Clinic"} · {clinic.id ? `Clinic #${clinic.id}` : "Clinic identity"} · {report ? `Measured ${formatDate(report.measuredAt)}` : reportLoading ? "Entitlement summary loading" : "Entitlement summary unavailable"}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {onCopyClinicUrl && (
                <>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onCopyClinicUrl(clinic, "book")} title="Copy booking URL">
                    <Copy className="mr-1.5 h-3.5 w-3.5" />Book URL
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onCopyClinicUrl(clinic, "about")} title="Copy About URL">
                    <Copy className="mr-1.5 h-3.5 w-3.5" />About URL
                  </Button>
                </>
              )}
              {onEditClinic && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onEditClinic(clinic)}>
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Edit clinic
                </Button>
              )}
              {onManageCredentials && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onManageCredentials(clinic)}>
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />Credentials
                </Button>
              )}
            </div>
          </div>
          {report && (
            <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricItem label="Effective plan" value={report.plan.displayName || labelFor(report.plan.effective)} detail={`${sourceLabel(report.plan.source)} · ${report.plan.requested || "not requested"}`} valueClass="text-primary" />
              <MetricItem label="Subscription" value={report.subscription.label} detail={labelFor(report.access.reasonCode)} />
              <MetricItem
                label="Plan timing"
                value={report.access.trialEndsAt ? "Trial access" : report.access.paidAccessExpiresAt ? "Paid access" : "No renewal date"}
                detail={formatDate(report.access.trialEndsAt || report.access.paidAccessExpiresAt)}
              />
              <MetricItem label="Policy version" value={report.plan.policyVersion || "Unavailable"} detail={`Timezone · ${report.timezone}`} />
              <MetricItem
                label="Account status"
                value={attentionCount ? `${attentionCount} over limit` : labelFor(report.access.state)}
                detail={`${report.exceptions.active} exception${report.exceptions.active === 1 ? "" : "s"} · ${report.grants.active} grant${report.grants.active === 1 ? "" : "s"}`}
                valueClass={attentionCount ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}
              />
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={Link2} title="Contact & location" description="Clinic identity and contact details." />
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              {hasContactDetails ? (
                <>
                  {(clinic.address || clinic.city || (clinic as any).pincode) && (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{[clinic.address, clinic.city, (clinic as any).pincode].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  {clinic.email && (
                    <a href={`mailto:${clinic.email}`} className="flex items-center gap-2 hover:text-primary">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />{clinic.email}
                    </a>
                  )}
                  {clinic.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />{clinic.phone}
                    </div>
                  )}
                  {clinic.website && (
                    <a href={clinic.website} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-primary hover:underline">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{clinic.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                </>
              ) : <p className="text-muted-foreground">No contact details recorded.</p>}
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
                Added {clinic.createdAt ? new Date(clinic.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "not recorded"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <SectionHeading icon={Stethoscope} title="Assigned doctors" description="Doctors currently associated with this clinic." />
                <Badge variant="secondary" className="shrink-0 text-[10px]">{clinic.doctors?.length || 0} registered</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {clinic.doctors && clinic.doctors.length > 0 ? clinic.doctors.map((doctor, index) => (
                <div key={`${doctor.name}-${index}`} className="flex items-center gap-2.5 rounded-lg border bg-muted/20 px-2.5 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary">
                    {doctor.name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">Dr. {doctor.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{doctor.specialization}{doctor.degree ? ` · ${doctor.degree}` : ""}</p>
                  </div>
                </div>
              )) : <p className="text-xs text-muted-foreground">No doctors listed.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <Card>
            <CardHeader className="pb-3">
              <SectionHeading icon={ShieldCheck} title="Administrative access control" description="Separate plan lifecycle actions from temporary access overrides." />
            </CardHeader>
            <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Plan lifecycle</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Button size="sm" variant={hasTrialHistory ? "outline" : "default"} className="h-9 text-xs" onClick={onStartTrial} data-testid={`button-${hasTrialHistory ? "extend" : "start"}-trial-${clinic.id}`}>
                    {hasTrialHistory ? <Plus className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                    {hasTrialHistory ? "Extend trial" : "Start trial"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={onAssignPaidPlan}>
                    <CreditCard className="mr-1.5 h-3.5 w-3.5" />Assign paid plan
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => onRecordOfflinePayment("activation")}>
                    <Banknote className="mr-1.5 h-3.5 w-3.5" />Verify offline payment
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => onRecordOfflinePayment("renewal")}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Record renewal
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Access overrides</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Button size="sm" variant="outline" className="h-9 border-sky-200 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/30" onClick={() => onOpenAccessDialog("sponsored")}>
                    <Gift className="mr-1.5 h-3.5 w-3.5" />Sponsored access
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 border-amber-200 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30" onClick={() => onOpenAccessDialog("exception")}>
                    <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Grant exception
                  </Button>
                </div>
              </div>
            </CardContent>
            {report && (
              <CardContent className="border-t pt-4">
                <div className={`rounded-lg border border-l-4 p-3 ${nextBestActionClass(report.nextStep.action)}`} data-testid={`admin-next-best-action-${clinic.id}`}>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      {report.nextStep.action === "contact_support"
                        ? <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                        : report.nextStep.action === "view_plans"
                          ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          : <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide">Next best action</p>
                        <span className="rounded-full border border-current/15 bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {report.nextStep.action === "none" ? "No action required" : report.nextStep.action === "view_plans" ? "Review" : "Support"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{report.nextStep.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.nextStep.description}</p>
                      {(report.access.trialOrigin || report.access.previousPaidPlan) && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {[
                            report.access.trialOrigin && `Origin: ${labelFor(report.access.trialOrigin)}`,
                            report.access.previousPaidPlan && `Previous paid plan: ${labelFor(report.access.previousPaidPlan)}`,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {report ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionHeading icon={Gauge} title="Resource usage & quotas" description={`${numericCapabilities.length} measured capabilities · ${report.timezone}`} />
                    <Badge variant={attentionCount ? "outline" : "secondary"} className={attentionCount ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300" : ""}>
                      {attentionCount ? `${attentionCount} over limit` : "Within limits"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 pt-0 sm:grid-cols-2 xl:grid-cols-3" data-testid={`admin-usage-limits-${clinic.id}`}>
                  {numericCapabilities.length > 0 ? numericCapabilities.map(item => <UsageItem key={item.capability} item={item} />) : (
                    <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-3">No measured usage capabilities are available for this plan.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <SectionHeading icon={Sparkles} title="Included capabilities & feature flags" description={`${report.plan.displayName || labelFor(report.plan.effective)} · ${sourceLabel(report.plan.source)}`} />
                </CardHeader>
                <CardContent className="grid gap-2 pt-0 sm:grid-cols-2 xl:grid-cols-3" data-testid={`admin-included-features-${clinic.id}`}>
                  {featureCapabilities.length > 0 ? featureCapabilities.map(item => (
                    <div key={item.capability} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                      <span className="min-w-0 truncate text-xs font-medium">{CAPABILITY_LABELS[item.capability] || labelFor(item.capability)}</span>
                      <FeatureStatus item={item} />
                    </div>
                  )) : <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-3">No feature entitlements are recorded for this plan.</p>}
                </CardContent>
              </Card>

              {(report.access.trialEndsAt || report.access.trialGraceEndsAt || report.access.paidAccessExpiresAt || report.grants.endsAt) && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-primary" />Important dates</CardTitle></CardHeader>
                  <CardContent className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    {report.access.trialEndsAt && <div className="rounded-lg border bg-muted/20 p-3"><span className="text-muted-foreground">Trial ends</span><strong className="mt-1 block">{formatDate(report.access.trialEndsAt)}</strong></div>}
                    {report.access.trialGraceEndsAt && <div className="rounded-lg border bg-muted/20 p-3"><span className="text-muted-foreground">Trial grace ends</span><strong className="mt-1 block">{formatDate(report.access.trialGraceEndsAt)}</strong></div>}
                    {report.access.paidAccessExpiresAt && <div className="rounded-lg border bg-muted/20 p-3"><span className="text-muted-foreground">Paid access expires</span><strong className="mt-1 block">{formatDate(report.access.paidAccessExpiresAt)}</strong></div>}
                    {report.grants.endsAt && <div className="rounded-lg border bg-muted/20 p-3"><span className="text-muted-foreground">Sponsored access ends</span><strong className="mt-1 block">{formatDate(report.grants.endsAt)}</strong></div>}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
                <span className="text-muted-foreground">{reportLoading ? "Loading entitlement summary…" : reportError ? "Entitlement summary unavailable." : "Entitlement summary not available."}</span>
                {reportError && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRetryReport}>Retry summary</Button>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <History className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide">Audit trail</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {auditHistoryLoading ? "Loading access events…" : `${auditEventCount} recorded event${auditEventCount === 1 ? "" : "s"}`}
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onOpenAuditTrail} data-testid={`button-open-audit-trail-${clinic.id}`}>
              View full history
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lifecycle state</p>
              <p className="text-xs font-semibold">{lifecycle}</p>
            </div>
            {isArchived ? (
              onRestoreClinic && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onRestoreClinic(clinic)}><ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />Restore clinic</Button>
            ) : (
              onArchiveClinic && <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => onArchiveClinic(clinic)}><Archive className="mr-1.5 h-3.5 w-3.5" />Archive clinic</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}