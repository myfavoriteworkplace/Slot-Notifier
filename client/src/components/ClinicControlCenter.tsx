import type { ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Copy,
  Database,
  Gift,
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
  Stethoscope,
} from "lucide-react";
import type { Clinic } from "@shared/schema";
import type { EffectiveEntitlementReport } from "@shared/effective-entitlement";
import { getAdminClinicLifecycleState } from "@shared/admin-operations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccessAction = "sponsored" | "exception";

const formatDate = (value: string | null) => {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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

export default function ClinicControlCenter({
  clinic,
  report,
  attentionCount,
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