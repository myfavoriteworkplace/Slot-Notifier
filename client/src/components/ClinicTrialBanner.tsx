import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import {
  BILLING_CYCLES,
  PAID_PLAN_KEYS,
  PUBLISHED_PLAN_POLICY,
  type BillingCycle,
  type PaidPlanKey,
} from "@shared/plan-catalog";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

type UpgradeRequestMutationResponse = {
  request: ClinicUpgradeRequest;
  idempotent?: boolean;
};

type ClinicTrialBannerProps = {
  enabled: boolean;
  onRequestUpgrade: () => void;
};

const formatPlan = (plan: string) => (
  plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase()
);

const formatBillingCycle = (billingCycle: string) => (
  billingCycle === "annual" ? "Annual" : "Monthly"
);

const formatCurrency = (value: number | null) => (
  value === null ? "Included" : `₹${value.toLocaleString("en-IN")}`
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

function UpgradeRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanKey>("starter");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [clinicReason, setClinicReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submitMutation = useMutation<UpgradeRequestMutationResponse, Error>({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/clinic/subscription/upgrade-requests", {
        requestedPlan: selectedPlan,
        billingCycle,
        clinicReason: clinicReason.trim() || null,
      });

      if (!response.ok) {
        let message = "Unable to submit upgrade request";
        try {
          const body = await response.json();
          if (typeof body?.message === "string") message = body.message;
        } catch {
          // Keep the generic message when the server response is not JSON.
        }
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.setQueryData<UpgradeRequestResponse>(
        ["/api/auth/clinic/subscription/upgrade-request"],
        {
          request: data.request,
          hasPending: data.request.status === "pending",
        },
      );
      await queryClient.invalidateQueries({
        queryKey: ["/api/auth/clinic/subscription/upgrade-request"],
      });
      setFormError(null);
      onOpenChange(false);

      if (data.idempotent) {
        notify.info("An upgrade request is already pending", {
          description: `Your existing ${formatPlan(data.request.requestedPlan)} request is now shown on the dashboard.`,
        });
      } else {
        notify.success("Upgrade request submitted", {
          description: "Super Admin will review your request and update its status.",
        });
      }
    },
    onError: (error) => {
      setFormError(error.message || "Unable to submit upgrade request");
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submitMutation.isPending) return;
    if (nextOpen) setFormError(null);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        data-testid="dialog-upgrade-request"
      >
        <DialogHeader>
          <DialogTitle>Request a plan upgrade</DialogTitle>
          <DialogDescription>
            Choose the paid plan and billing cycle you want Super Admin to review. Your current Trial access will not change until the request is reviewed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold">Paid plan</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Paid plan">
              {PAID_PLAN_KEYS.map((planKey) => {
                const plan = PUBLISHED_PLAN_POLICY.plans[planKey];
                const selected = selectedPlan === planKey;
                return (
                  <button
                    key={planKey}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${plan.displayName} plan`}
                    onClick={() => setSelectedPlan(planKey)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20 dark:border-emerald-400 dark:bg-emerald-950/30"
                        : "border-border bg-background hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                    }`}
                    data-testid={`upgrade-plan-${planKey}`}
                  >
                    <span className="block text-sm font-semibold">{plan.displayName}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{plan.summary}</span>
                    <span className="mt-2 block text-xs font-medium text-foreground">
                      {formatCurrency(plan.pricing.monthly)}/month · {formatCurrency(plan.pricing.annual)}/year
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="upgrade-billing-cycle">Billing cycle</Label>
            <select
              id="upgrade-billing-cycle"
              value={billingCycle}
              onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
              data-testid="select-upgrade-billing-cycle"
            >
              {BILLING_CYCLES.map((cycle) => (
                <option key={cycle} value={cycle}>
                  {formatBillingCycle(cycle)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="upgrade-clinic-reason">Reason or note (optional)</Label>
              <span className="text-[11px] text-muted-foreground">{clinicReason.length}/500</span>
            </div>
            <Textarea
              id="upgrade-clinic-reason"
              value={clinicReason}
              onChange={(event) => setClinicReason(event.target.value)}
              placeholder="Tell Super Admin what your clinic needs from this plan."
              maxLength={500}
              rows={4}
              data-testid="textarea-upgrade-reason"
            />
          </div>

          {formError && (
            <div
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
              role="alert"
              data-testid="upgrade-request-error"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitMutation.isPending}
            data-testid="button-cancel-upgrade-request"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !selectedPlan || !billingCycle}
            className="bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            data-testid="button-submit-upgrade-request"
          >
            {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitMutation.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClinicTrialBanner({
  enabled,
  onRequestUpgrade,
}: ClinicTrialBannerProps) {
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

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
  const openRequestDialog = () => {
    onRequestUpgrade();
    setRequestDialogOpen(true);
  };
  const requestDialog = isEligible ? (
    <UpgradeRequestDialog
      open={requestDialogOpen}
      onOpenChange={setRequestDialogOpen}
    />
  ) : null;
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
      <>
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
            <RequestUpgradeButton onRequestUpgrade={openRequestDialog} />
          </div>
        </BannerShell>
        {requestDialog}
      </>
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
      <>
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
            <RequestUpgradeButton onRequestUpgrade={openRequestDialog} />
          </div>
        </BannerShell>
        {requestDialog}
      </>
    );
  }

  if (entitlement.access.state === "trial_grace") {
    return (
      <>
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
            <RequestUpgradeButton onRequestUpgrade={openRequestDialog} />
          </div>
        </BannerShell>
        {requestDialog}
      </>
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