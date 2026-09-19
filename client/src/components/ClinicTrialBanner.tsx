import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import type { EffectiveEntitlementReport } from "@shared/effective-entitlement";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

type ClinicUpgradeRequest = {
  id: number;
  requestedPlan: string;
  billingCycle: string;
  status: string;
  clinicReason?: string | null;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewReason?: string | null;
};

type UpgradeRequestResponse = {
  request: ClinicUpgradeRequest | null;
  hasPending: boolean;
};

type ClinicTrialBannerProps = {
  enabled: boolean;
  onRequestUpgrade: () => void;
};

const formatPlan = (plan: string) => (
  plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase()
);

const formatBillingCycle = (billingCycle: string) => (
  billingCycle === "yearly" ? "Yearly" : "Monthly"
);

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const daysUntil = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
};

function BannerShell({
  children,
  tone,
  testId,
}: {
  children: ReactNode;
  tone: "success" | "warning" | "danger" | "neutral";
  testId: string;
}) {
  const toneClasses = {
    success: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
    warning: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30",
    danger: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30",
    neutral: "border-border bg-muted/30",
  };

  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3.5 ${toneClasses[tone]}`}
      data-testid={testId}
      role="region"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

function RequestUpgradeButton({ onRequestUpgrade }: { onRequestUpgrade: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={onRequestUpgrade}
      className="shrink-0 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
      data-testid="button-request-upgrade"
    >
      Request upgrade
      <ExternalLink className="h-3.5 w-3.5" />
    </Button>
  );
}

export default function ClinicTrialBanner({
  enabled,
  onRequestUpgrade,
}: ClinicTrialBannerProps) {
  const entitlementQuery = useQuery<EffectiveEntitlementReport>({
    queryKey: ["/api/auth/clinic/settings/entitlements"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/clinic/settings/entitlements");
      if (!response.ok) throw new Error("Unable to load Trial status");
      return response.json();
    },
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const requestQuery = useQuery<UpgradeRequestResponse>({
    queryKey: ["/api/auth/clinic/subscription/upgrade-request"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/clinic/subscription/upgrade-request");
      if (!response.ok) throw new Error("Unable to load upgrade request status");
      return response.json();
    },
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  if (!enabled) return null;

  if (entitlementQuery.isLoading || requestQuery.isLoading) {
    return (
      <BannerShell tone="neutral" testId="clinic-trial-banner-loading">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      </BannerShell>
    );
  }

  if (entitlementQuery.isError || requestQuery.isError) {
    return (
      <BannerShell tone="warning" testId="clinic-trial-banner-error">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Trial status is temporarily unavailable
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              We could not load your subscription status. Try again before requesting an upgrade.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void entitlementQuery.refetch();
              void requestQuery.refetch();
            }}
            data-testid="button-retry-trial-status"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      </BannerShell>
    );
  }

  const entitlement = entitlementQuery.data;
  const requestData = requestQuery.data;

  if (!entitlement || !requestData) {
    return (
      <BannerShell tone="neutral" testId="clinic-trial-banner-empty">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Trial status is not available yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Subscription details will appear here when they are available for this clinic.
            </p>
          </div>
        </div>
      </BannerShell>
    );
  }

  const request = requestData.request;
  const isEligible = entitlement.access.state === "trial" || entitlement.access.state === "trial_grace";
  const isPending = requestData.hasPending || request?.status === "pending";
  const isRejected = request?.status === "rejected";
  const isApproved = request?.status === "approved";
  const daysRemaining = daysUntil(
    entitlement.access.state === "trial"
      ? entitlement.access.trialEndsAt
      : entitlement.access.trialGraceEndsAt,
  );

  if (isPending && request) {
    return (
      <BannerShell tone="warning" testId="clinic-trial-banner-pending">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Upgrade request pending
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              Your request for {formatPlan(request.requestedPlan)} ({formatBillingCycle(request.billingCycle)}) was submitted on {formatDate(request.requestedAt)}.
              Super Admin will review it and contact you if more information is needed.
            </p>
          </div>
        </div>
      </BannerShell>
    );
  }

  if (isRejected && request && isEligible) {
    return (
      <BannerShell tone="warning" testId="clinic-trial-banner-rejected">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Upgrade request rejected
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              {request.reviewReason || "Your previous upgrade request was not approved. You can submit a new request while your Trial access remains eligible."}
            </p>
          </div>
          <RequestUpgradeButton onRequestUpgrade={onRequestUpgrade} />
        </div>
      </BannerShell>
    );
  }

  if (isApproved && request) {
    return (
      <BannerShell tone="success" testId="clinic-trial-banner-approved">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              Upgrade request approved
            </p>
            <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
              Your request for {formatPlan(request.requestedPlan)} ({formatBillingCycle(request.billingCycle)}) was approved on {formatDate(request.reviewedAt)}. Contact support if your subscription does not update.
            </p>
          </div>
        </div>
      </BannerShell>
    );
  }

  if (entitlement.access.state === "trial") {
    return (
      <BannerShell tone="success" testId="clinic-trial-banner-active">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              Trial active
            </p>
            <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
              {daysRemaining === null
                ? `Your Trial ends on ${formatDate(entitlement.access.trialEndsAt)}.`
                : `You have ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining. Your Trial ends on ${formatDate(entitlement.access.trialEndsAt)}.`}
              {" "}Review paid plans before your Trial ends.
            </p>
          </div>
          <RequestUpgradeButton onRequestUpgrade={onRequestUpgrade} />
        </div>
      </BannerShell>
    );
  }

  if (entitlement.access.state === "trial_grace") {
    return (
      <BannerShell tone="warning" testId="clinic-trial-banner-grace">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Trial grace period
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              Your Trial has ended. Access remains available until {formatDate(entitlement.access.trialGraceEndsAt)}
              {daysRemaining === null ? "." : ` (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining).`} Request an upgrade to keep your clinic active.
            </p>
          </div>
          <RequestUpgradeButton onRequestUpgrade={onRequestUpgrade} />
        </div>
      </BannerShell>
    );
  }

  if (entitlement.plan.effective === "trial" && entitlement.access.state === "attention") {
    return (
      <BannerShell tone="danger" testId="clinic-trial-banner-expired">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              Trial ended
            </p>
            <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-300">
              Your Trial and grace period have ended. Please contact support or ask an administrator to review access before requesting a plan change.
            </p>
          </div>
        </div>
      </BannerShell>
    );
  }

  return null;
}