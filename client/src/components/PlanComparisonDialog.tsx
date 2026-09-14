import {
  Check,
  CheckCircle2,
  Eye,
  Info,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAnnualSavings,
  PLAN_KEYS,
  PUBLISHED_PLAN_POLICY,
  type PlanKey,
  type PlanPolicy,
} from "@shared/plan-catalog";

const FEATURE_LABELS: Record<keyof PlanPolicy["features"], string> = {
  analytics: "Analytics",
  export: "Exports",
  inventory: "Inventory",
  pharmacy: "Pharmacy",
  website: "Clinic website",
  support: "Support",
  publicProfile: "Public profile",
  verifiedBadge: "Verified badge",
  featuredDealPlacement: "Featured Deal placement",
  essentialWhatsapp: "Essential WhatsApp",
  routineWhatsapp: "Routine WhatsApp",
  bulkWhatsapp: "Bulk WhatsApp",
  promotionalWhatsapp: "Promotional WhatsApp",
  advancedWhatsapp: "Advanced WhatsApp",
};

const FEATURE_VALUE_LABELS: Record<string, string> = {
  basic_snapshot: "Basic snapshot",
  basic: "Basic",
  advanced: "Advanced",
  full: "Full",
  one_export: "One export",
  standard: "Standard",
  advanced_scheduled: "Advanced and scheduled",
  full_priority: "Full and priority",
  limited_volume: "Limited volume",
  sections_theme: "Sections and themes",
  custom_premium: "Custom premium",
  trial_branding: "Trial branding",
  help_center_onboarding: "Help centre and onboarding",
  standard_email: "Standard email",
  priority_email: "Priority email",
  priority_email_phone: "Priority email and phone",
  premium_visibility: "Premium visibility",
};

const formatCurrency = (value: number | null) => (
  value === null ? null : `₹${value.toLocaleString("en-IN")}`
);

const formatBytes = (value: number) => {
  const megabytes = value / (1024 * 1024);
  return megabytes >= 1024
    ? `${(megabytes / 1024).toFixed(megabytes % 1024 === 0 ? 0 : 1)} GB`
    : `${megabytes.toFixed(megabytes % 1 === 0 ? 0 : 1)} MB`;
};

const formatPeriod = (period: string) => {
  const labels: Record<string, string> = {
    trial_lifetime: "for the Trial",
    calendar_month: "per calendar month",
    ongoing: "ongoing",
    fair_use: "fair use",
  };
  return labels[period] ?? period.replace(/_/g, " ");
};

const formatLimit = (
  value: number | null,
  fairUse: boolean,
  period: string,
  suffix?: string,
) => {
  if (fairUse) return "Unlimited with fair use";
  if (value === null) return "Included";
  return `${value.toLocaleString("en-IN")}${suffix ?? ""} ${formatPeriod(period)}`;
};

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
        <Check className="h-3.5 w-3.5" /> Included
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <X className="h-3.5 w-3.5" /> Not included
      </span>
    );
  }

  return FEATURE_VALUE_LABELS[value] ?? value.replace(/_/g, " ");
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{children}</span>
    </div>
  );
}

function PlanPreviewCard({
  plan,
  isCurrent,
}: {
  plan: PlanPolicy;
  isCurrent: boolean;
}) {
  const annualSavings = getAnnualSavings(plan);
  const featureEntries = Object.entries(plan.features) as Array<
    [keyof PlanPolicy["features"], PlanPolicy["features"][keyof PlanPolicy["features"]]]
  >;

  return (
    <section
      className={`rounded-2xl border p-4 ${
        isCurrent
          ? "border-emerald-300 bg-emerald-50/50 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20"
          : "border-border/70 bg-background"
      }`}
      aria-label={`${plan.displayName} plan`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{plan.displayName}</h3>
            {isCurrent && (
              <Badge className="bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">
                Current plan
              </Badge>
            )}
            {plan.recommended && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                Recommended
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plan.summary}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted/50 p-3">
        {plan.kind === "trial" ? (
          <div>
            <p className="text-lg font-bold">No card required</p>
            <p className="text-[11px] text-muted-foreground">
              {plan.trial.durationDays} days, followed by a {plan.trial.graceDays}-day grace period
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-lg font-bold">
                {formatCurrency(plan.pricing.monthly)}
                <span className="text-xs font-normal text-muted-foreground">/month</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatCurrency(plan.pricing.annual)}/year
                {annualSavings !== null && ` · Save ${formatCurrency(annualSavings)}/year`}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground">Read-only preview</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Usage allowances</p>
        <DetailRow label="Bookings">
          {formatLimit(plan.limits.bookings.value, plan.limits.bookings.fairUse, plan.limits.bookings.period)}
        </DetailRow>
        <DetailRow label="Active doctors">
          {formatLimit(plan.limits.activeDoctors.value, plan.limits.activeDoctors.fairUse, plan.limits.activeDoctors.period)}
        </DetailRow>
        <DetailRow label="Smile Deals">
          {formatLimit(plan.limits.smileDeals.value, plan.limits.smileDeals.fairUse, plan.limits.smileDeals.period)}
        </DetailRow>
        <DetailRow label="Storage">{formatBytes(plan.limits.storageBytes)}</DetailRow>
        <DetailRow label="Messaging">
          <span className="space-y-0.5">
            <span className="block">{plan.limits.messaging.sms.toLocaleString("en-IN")} SMS</span>
            <span className="block">{plan.limits.messaging.whatsapp.toLocaleString("en-IN")} WhatsApp</span>
            <span className="block">{plan.limits.messaging.email.toLocaleString("en-IN")} Email</span>
            <span className="block text-[10px] font-normal text-muted-foreground">{formatPeriod(plan.limits.messaging.period)}</span>
          </span>
        </DetailRow>
      </div>

      <div className="mt-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Included features</p>
        {featureEntries.map(([key, value]) => (
          <DetailRow key={key} label={FEATURE_LABELS[key]}>
            <FeatureValue value={value} />
          </DetailRow>
        ))}
      </div>
    </section>
  );
}

export default function PlanComparisonDialog({ currentPlan }: { currentPlan: string | null }) {
  const normalizedCurrentPlan = currentPlan?.trim().toLowerCase();
  const currentPlanKey = PLAN_KEYS.includes(normalizedCurrentPlan as PlanKey)
    ? normalizedCurrentPlan as PlanKey
    : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Compare plans
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b px-5 py-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-emerald-600" />
            Available plans
          </DialogTitle>
          <DialogDescription className="max-w-3xl text-xs leading-relaxed">
            Compare the current published plan details. This is a read-only preview and does not change your clinic subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {PLAN_KEYS.map(planKey => (
              <PlanPreviewCard
                key={planKey}
                plan={PUBLISHED_PLAN_POLICY.plans[planKey]}
                isCurrent={currentPlanKey === planKey}
              />
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <p>
              Plan information is based on policy {PUBLISHED_PLAN_POLICY.version}. Transaction fees and exact inventory/pharmacy item-count thresholds are not included because those policy details are still deferred.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}