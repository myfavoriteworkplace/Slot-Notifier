import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Copy,
  Database,
  Gift,
  Gauge,
  Globe,
  KeyRound,
  Link2,
  Mail,
  MapPin,
  Phone,
  Play,
  Plus,
  Settings2,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

function SummaryItem({ label, value, detail, valueClass = "" }: { label: string; value: string; detail: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
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
  onOpenAccessDialog,
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
  onOpenAccessDialog: (action: AccessAction) => void;
  onCopyClinicUrl?: (clinic: Clinic, kind: "book" | "about") => void;
  onEditClinic?: (clinic: Clinic) => void;
  onManageCredentials?: (clinic: Clinic) => void;
  onArchiveClinic?: (clinic: Clinic) => void;
  onRestoreClinic?: (clinic: Clinic) => void;
}) {
  const hasContactDetails = Boolean(clinic.address || clinic.city || (clinic as any).pincode || clinic.email || clinic.phone || clinic.website);
  const lifecycle = lifecycleLabel(clinic);
  const isArchived = getAdminClinicLifecycleState(clinic) === "archived";

  return (
    <Card data-testid={`clinic-profile-actions-${clinic.id}`} data-clinic-control-center="true" className="overflow-hidden">
      <CardHeader className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{clinic.name}</span>
            </CardTitle>
            <CardDescription className="mt-1">
              {clinic.city || "Clinic"} · {clinic.id ? `Clinic #${clinic.id}` : "Clinic identity"} · {report ? `measured ${formatDate(report.measuredAt)}` : "entitlement summary loading"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="capitalize">{lifecycle}</Badge>
            {report && (
              <Badge variant="outline" className={`capitalize ${accessStateClass(report.access.state)}`}>
                {report.access.state === "unknown" ? <ShieldAlert className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                {labelFor(report.access.state)}
              </Badge>
            )}
            {clinic.plan && <Badge variant="secondary" className="capitalize">{clinic.plan}</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <section aria-labelledby={`clinic-profile-actions-heading-${clinic.id}`}>
          <SectionHeading
            icon={Settings2}
            title="Profile actions"
            description="Manage clinic identity, links, and administrator access."
          />
          <div id={`clinic-profile-actions-heading-${clinic.id}`} className="mt-3 flex flex-wrap gap-2">
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
        </section>

        {report && (
          <>
            <div className="border-t" />

            <section aria-labelledby={`clinic-plan-details-heading-${clinic.id}`}>
              <SectionHeading
                icon={Sparkles}
                title="Plan details"
                description="Expand measured limits or inspect the features included in the effective plan."
              />
              <div id={`clinic-plan-details-heading-${clinic.id}`} className="mt-3 space-y-2">
                <details className="group rounded-lg border" data-testid={`admin-usage-limits-${clinic.id}`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <Gauge className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">Usage and limits</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {numericCapabilities.length} measured capabilities · {report.timezone}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={attentionCount ? "outline" : "secondary"} className={attentionCount ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300" : ""}>
                        {attentionCount ? `${attentionCount} over limit` : "Within limits"}
                      </Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="grid gap-2 border-t p-3 sm:grid-cols-2">
                    {numericCapabilities.length > 0 ? numericCapabilities.map(item => <UsageItem key={item.capability} item={item} />) : (
                      <p className="text-xs text-muted-foreground sm:col-span-2">No measured usage capabilities are available for this plan.</p>
                    )}
                  </div>
                </details>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid={`admin-included-features-trigger-${clinic.id}`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">Included features</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {report.plan.displayName || labelFor(report.plan.effective)} · {featureCapabilities.length} feature{featureCapabilities.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-xl p-0"
                    data-testid={`admin-included-features-popover-${clinic.id}`}
                  >
                    <div className="border-b px-4 py-3">
                      <p className="text-sm font-semibold">Included features</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {report.plan.displayName || labelFor(report.plan.effective)} · {sourceLabel(report.plan.source)}
                      </p>
                    </div>
                    <div className="max-h-[min(420px,65vh)] space-y-1 overflow-y-auto p-3">
                      {featureCapabilities.length > 0 ? featureCapabilities.map(item => (
                        <div key={item.capability} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                          <span className="min-w-0 text-xs font-medium">{CAPABILITY_LABELS[item.capability] || labelFor(item.capability)}</span>
                          <FeatureStatus item={item} />
                        </div>
                      )) : <p className="px-1 py-2 text-xs text-muted-foreground">No feature entitlements are recorded for this plan.</p>}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </section>
          </>
        )}

        <div className="border-t" />

        <section aria-labelledby={`clinic-profile-heading-${clinic.id}`}>
          <SectionHeading icon={Link2} title="Clinic profile" description="Contact details, location, registration context, and assigned doctors." />
          <div id={`clinic-profile-heading-${clinic.id}`} className="mt-3 grid gap-5 md:grid-cols-2">
            <div className="space-y-2 text-xs">
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
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Stethoscope className="h-3.5 w-3.5" />Assigned doctors
              </p>
              <div className="mt-2 space-y-2">
                {clinic.doctors && clinic.doctors.length > 0 ? clinic.doctors.map((doctor, index) => (
                  <div key={`${doctor.name}-${index}`} className="flex items-center gap-2.5 rounded-md border bg-muted/20 px-2.5 py-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary">
                      {doctor.name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">Dr. {doctor.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{doctor.specialization}{doctor.degree ? ` · ${doctor.degree}` : ""}</p>
                    </div>
                  </div>
                )) : <p className="text-xs text-muted-foreground">No doctors listed.</p>}
              </div>
            </div>
          </div>
        </section>

        <div className="border-t" />

        <section aria-labelledby={`clinic-access-controls-heading-${clinic.id}`}>
          <SectionHeading icon={ShieldCheck} title="Access controls" description="Change trial, paid, sponsored, or exceptional platform access." />
          <div id={`clinic-access-controls-heading-${clinic.id}`} className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={hasTrialHistory ? "outline" : "default"} className="h-8 text-xs" onClick={onStartTrial} data-testid={`button-${hasTrialHistory ? "extend" : "start"}-trial-${clinic.id}`}>
              {hasTrialHistory ? <Plus className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
              {hasTrialHistory ? "Extend trial" : "Start trial"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onAssignPaidPlan}>
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />Assign paid plan
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onOpenAccessDialog("sponsored")}>
              <Gift className="mr-1.5 h-3.5 w-3.5" />Sponsored access
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onOpenAccessDialog("exception")}>
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Exception
            </Button>
          </div>
        </section>

        <div className="border-t" />

        <section aria-labelledby={`clinic-access-summary-heading-${clinic.id}`}>
          <SectionHeading icon={ShieldCheck} title="Access summary" description="Server-derived entitlement state and the latest attention signals." />
          {report ? (
            <div id={`clinic-access-summary-heading-${clinic.id}`} className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryItem label="Effective plan" value={report.plan.displayName || labelFor(report.plan.effective)} detail={`Requested: ${report.plan.requested || "not set"} · ${sourceLabel(report.plan.source)}`} />
              <SummaryItem label="Subscription" value={report.subscription.label} detail={labelFor(report.access.reasonCode)} />
              <SummaryItem label="Policy" value={report.plan.policyVersion || "Unavailable"} detail={`Timezone: ${report.timezone}`} />
              <SummaryItem
                label="Attention"
                value={attentionCount ? `${attentionCount} over limit` : "No over-limit usage"}
                valueClass={attentionCount ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}
                detail={`${report.exceptions.active} exception${report.exceptions.active === 1 ? "" : "s"} · ${report.grants.active} grant${report.grants.active === 1 ? "" : "s"}`}
              />
            </div>
          ) : (
            <div id={`clinic-access-summary-heading-${clinic.id}`} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground">{reportLoading ? "Loading entitlement summary…" : reportError ? "Entitlement summary unavailable." : "Entitlement summary not available."}</span>
              {reportError && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRetryReport}>Retry summary</Button>}
            </div>
          )}
        </section>

        <div className="border-t" />

        <section aria-labelledby={`clinic-lifecycle-heading-${clinic.id}`} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-muted-foreground/20 bg-muted/40 text-muted-foreground">
              {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </div>
            <div>
              <h3 id={`clinic-lifecycle-heading-${clinic.id}`} className="text-xs font-semibold uppercase tracking-wide">Lifecycle</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{isArchived ? "Restore this clinic to return it to active administration." : "Archive only when the clinic should leave active administration."}</p>
            </div>
          </div>
          {isArchived ? (
            onRestoreClinic && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onRestoreClinic(clinic)}><ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />Restore clinic</Button>
          ) : (
            onArchiveClinic && <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => onArchiveClinic(clinic)}><Archive className="mr-1.5 h-3.5 w-3.5" />Archive clinic</Button>
          )}
        </section>
      </CardContent>
    </Card>
  );
}