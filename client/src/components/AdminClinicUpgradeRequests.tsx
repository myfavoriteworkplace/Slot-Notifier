import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BILLING_CYCLES, PAID_PLAN_KEYS, type BillingCycle, type PaidPlanKey } from "@shared/plan-catalog";

type UpgradeRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

type UpgradeRequest = {
  id: number;
  clinicId: number;
  requestedPlan: string;
  billingCycle: string;
  status: UpgradeRequestStatus;
  clinicReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewReason: string | null;
};

type ClinicSnapshot = {
  id: number;
  name: string;
  email: string;
  city: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  billingCycle: string | null;
  trialEndsAt: string | null;
  trialGraceEndsAt: string | null;
};

type ApprovalSummary = {
  approvalOutcome: string;
  approvedPlan: string | null;
  approvedBillingCycle: string | null;
  paymentBasis: string;
  renewalMode: string;
  fromAccessState: string | null;
  toAccessState: string | null;
};

type UpgradeRequestRow = {
  request: UpgradeRequest;
  clinic: ClinicSnapshot;
  approval: ApprovalSummary | null;
};

type UpgradeRequestListResponse = {
  requests: UpgradeRequestRow[];
  pendingCount: number;
};

type AdminClinicUpgradeRequestsProps = {
  enabled: boolean;
  pendingCount: number;
};

type UpgradeApprovalOutcome = "online_payment_required" | "verified_offline_payment" | "complimentary";

const formatPlan = (plan: string) => plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
const formatCycle = (cycle: string) => cycle === "annual" ? "Annual" : "Monthly";
const formatAccessState = (state: string | null | undefined) => {
  if (!state) return "Not recorded";
  return state.split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
};
const formatPaymentBasis = (basis: string) => {
  if (basis === "provider") return "Provider pending";
  if (basis === "offline_verified") return "Verified offline";
  if (basis === "complimentary") return "Complimentary";
  return "None";
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const requestAge = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Age unavailable";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  return days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} ago`;
};

const localDateTimeValue = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const trialState = (clinic: ClinicSnapshot) => {
  const now = Date.now();
  const trialEndsAt = clinic.trialEndsAt ? new Date(clinic.trialEndsAt).getTime() : NaN;
  const graceEndsAt = clinic.trialGraceEndsAt ? new Date(clinic.trialGraceEndsAt).getTime() : NaN;
  if (clinic.plan !== "trial") return formatPlan(clinic.plan || "unknown");
  if (Number.isFinite(trialEndsAt) && now <= trialEndsAt) return "Trial active";
  if (Number.isFinite(graceEndsAt) && now <= graceEndsAt) return "Trial grace";
  return "Trial expired";
};

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body?.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}

export default function AdminClinicUpgradeRequests({
  enabled,
  pendingCount,
}: AdminClinicUpgradeRequestsProps) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"pending" | "all">("pending");
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequestRow | null>(null);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | null>(null);
  const [approvedPlan, setApprovedPlan] = useState<PaidPlanKey>("starter");
  const [approvedBillingCycle, setApprovedBillingCycle] = useState<BillingCycle>("monthly");
  const [approvalOutcome, setApprovalOutcome] = useState<UpgradeApprovalOutcome>("online_payment_required");
  const [reviewReason, setReviewReason] = useState("");
  const [approvalTransitionId, setApprovalTransitionId] = useState("");
  const [offlineAmount, setOfflineAmount] = useState("");
  const [offlineReceivedAt, setOfflineReceivedAt] = useState("");
  const [offlinePaymentMethod, setOfflinePaymentMethod] = useState<"bank_transfer" | "cash" | "upi" | "card" | "other">("bank_transfer");
  const [offlineExternalReference, setOfflineExternalReference] = useState("");
  const [offlineEvidenceReference, setOfflineEvidenceReference] = useState("");
  const [complimentaryStartsAt, setComplimentaryStartsAt] = useState("");
  const [complimentaryEndsAt, setComplimentaryEndsAt] = useState("");
  const [complimentarySponsorReference, setComplimentarySponsorReference] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const requestsQuery = useQuery<UpgradeRequestListResponse>({
    queryKey: ["/api/admin/clinic-upgrade-requests", scope],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/clinic-upgrade-requests?status=${scope}`);
      if (!response.ok) throw new Error(await responseError(response, "Unable to load upgrade requests"));
      return response.json();
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });

  const refresh = async () => {
    await Promise.all([
      requestsQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinic-upgrade-requests", "pending"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinic-upgrade-requests", "all"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinic-upgrade-requests-count"] }),
    ]);
  };

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !reviewMode) throw new Error("Select an upgrade request first");
      const path = `/api/admin/clinic-upgrade-requests/${selectedRequest.request.id}/${reviewMode}`;
      if (reviewMode === "approve") {
        const requestedPlan = selectedRequest.request.requestedPlan;
        const requestedCycle = selectedRequest.request.billingCycle;
        const planChanged = approvedPlan !== requestedPlan;
        const cycleChanged = approvedBillingCycle !== requestedCycle;
        if ((planChanged || cycleChanged || approvalOutcome !== "online_payment_required") &&
          reviewReason.trim().length < 10) {
          throw new Error("Add a reason of at least 10 characters for this approval");
        }
        const body: Record<string, unknown> = {
          approvalOutcome,
          requestedPlan: approvedPlan,
          billingCycle: approvedBillingCycle,
          reviewReason: reviewReason.trim() || null,
          transitionId: approvalTransitionId,
        };
        if (approvalOutcome === "verified_offline_payment") {
          const receivedAt = new Date(offlineReceivedAt);
          if (!Number.isSafeInteger(Number(offlineAmount)) || Number(offlineAmount) <= 0) {
            throw new Error("Enter the whole-rupee amount received");
          }
          if (!offlineReceivedAt || !Number.isFinite(receivedAt.getTime()) || receivedAt > new Date()) {
            throw new Error("Enter a valid payment date that is not in the future");
          }
          if (!offlineExternalReference.trim() || !offlineEvidenceReference.trim()) {
            throw new Error("Enter both the payment reference and evidence reference");
          }
          body.offlinePayment = {
            amount: Number(offlineAmount),
            receivedAt: receivedAt.toISOString(),
            paymentMethod: offlinePaymentMethod,
            externalReference: offlineExternalReference.trim(),
            evidenceReference: offlineEvidenceReference.trim(),
          };
        }
        if (approvalOutcome === "complimentary") {
          if (!complimentaryStartsAt || !complimentaryEndsAt || complimentaryEndsAt <= complimentaryStartsAt) {
            throw new Error("Choose valid complimentary-access start and end dates");
          }
          body.complimentaryAccess = {
            startsAt: new Date(complimentaryStartsAt).toISOString(),
            endsAt: new Date(complimentaryEndsAt).toISOString(),
            ...(complimentarySponsorReference.trim()
              ? { sponsorReference: complimentarySponsorReference.trim() }
              : {}),
          };
        }
        const response = await apiRequest("POST", path, body);
        if (!response.ok) throw new Error(await responseError(response, "Unable to review upgrade request"));
        return response.json();
      }
      const response = await apiRequest("POST", path, {
        reviewReason: reviewReason.trim(),
        transitionId: approvalTransitionId,
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to review upgrade request"));
      return response.json();
    },
    onSuccess: async () => {
      setSelectedRequest(null);
      setReviewMode(null);
      setReviewReason("");
      setApprovalOutcome("online_payment_required");
      setOfflineAmount("");
      setOfflineExternalReference("");
      setOfflineEvidenceReference("");
      setComplimentaryStartsAt("");
      setComplimentaryEndsAt("");
      setComplimentarySponsorReference("");
      setReviewError(null);
      notify.success("Upgrade request reviewed");
      await refresh();
    },
    onError: (error: Error) => {
      setReviewError(error.message || "Unable to review upgrade request");
    },
  });

  const openReview = (row: UpgradeRequestRow, mode: "approve" | "reject") => {
    setSelectedRequest(row);
    setReviewMode(mode);
    setApprovedPlan((PAID_PLAN_KEYS as readonly string[]).includes(row.request.requestedPlan)
      ? row.request.requestedPlan as PaidPlanKey
      : "starter");
    setApprovedBillingCycle((BILLING_CYCLES as readonly string[]).includes(row.request.billingCycle)
      ? row.request.billingCycle as BillingCycle
      : "monthly");
    setApprovalOutcome("online_payment_required");
    setReviewReason("");
    setApprovalTransitionId(crypto.randomUUID());
    setOfflineAmount("");
    setOfflineReceivedAt(localDateTimeValue());
    setOfflinePaymentMethod("bank_transfer");
    setOfflineExternalReference("");
    setOfflineEvidenceReference("");
    setComplimentaryStartsAt(localDateTimeValue());
    setComplimentaryEndsAt(localDateTimeValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
    setComplimentarySponsorReference("");
    setReviewError(null);
  };

  const closeReview = () => {
    if (reviewMutation.isPending) return;
    setSelectedRequest(null);
    setReviewMode(null);
    setReviewReason("");
    setApprovalTransitionId("");
    setApprovalOutcome("online_payment_required");
    setOfflineAmount("");
    setOfflineExternalReference("");
    setOfflineEvidenceReference("");
    setComplimentaryStartsAt("");
    setComplimentaryEndsAt("");
    setComplimentarySponsorReference("");
    setReviewError(null);
  };

  const rows = requestsQuery.data?.requests ?? [];
  const displayedCount = useMemo(() => requestsQuery.data?.pendingCount ?? pendingCount, [pendingCount, requestsQuery.data?.pendingCount]);

  return (
    <>
      <Card data-testid="admin-upgrade-requests-panel">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Upgrade requests
                <Badge variant={displayedCount > 0 ? "default" : "secondary"} data-testid="badge-upgrade-request-count">
                  {displayedCount} pending
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Review Trial clinic requests without exposing unrelated patient information.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              disabled={requestsQuery.isFetching}
              data-testid="button-refresh-upgrade-requests"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${requestsQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <div className="flex gap-2 pt-2" role="tablist" aria-label="Upgrade request history">
            {(["pending", "all"] as const).map(value => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={scope === value ? "default" : "outline"}
                onClick={() => setScope(value)}
                role="tab"
                aria-selected={scope === value}
                data-testid={`tab-upgrade-requests-${value}`}
              >
                {value === "pending" ? `Pending (${pendingCount})` : "All history"}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {requestsQuery.isLoading && (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground" data-testid="upgrade-requests-loading">
              Loading upgrade requests…
            </div>
          )}
          {requestsQuery.isError && (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200" role="alert" data-testid="upgrade-requests-error">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{requestsQuery.error instanceof Error ? requestsQuery.error.message : "Unable to load upgrade requests"}</span>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void requestsQuery.refetch()} data-testid="button-retry-upgrade-requests">
                Try again
              </Button>
            </div>
          )}
          {!requestsQuery.isLoading && !requestsQuery.isError && rows.length === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground" data-testid="upgrade-requests-empty">
              {scope === "pending" ? "No pending upgrade requests." : "No upgrade request history yet."}
            </div>
          )}
          {rows.map(({ request, clinic, approval }) => (
            <div key={request.id} className="rounded-xl border bg-card p-4 shadow-sm" data-testid={`upgrade-request-row-${request.id}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{clinic.name}</h3>
                    <Badge variant={request.status === "pending" ? "default" : "outline"}>{formatPlan(request.status)}</Badge>
                    <Badge variant="outline">{trialState(clinic)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {clinic.city || "Clinic"} · Clinic #{clinic.id} · {clinic.email}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
                    <div><span className="text-muted-foreground">Current plan</span><p className="font-medium">{formatPlan(clinic.plan || "unknown")}</p></div>
                    <div><span className="text-muted-foreground">Requested</span><p className="font-medium">{formatPlan(request.requestedPlan)} · {formatCycle(request.billingCycle)}</p></div>
                    <div><span className="text-muted-foreground">Submitted</span><p className="font-medium">{formatDate(request.requestedAt)}</p><p className="text-muted-foreground">{requestAge(request.requestedAt)}</p></div>
                    <div><span className="text-muted-foreground">Trial ends</span><p className="font-medium">{formatDate(clinic.trialEndsAt)}</p></div>
                    <div>
                      <span className="text-muted-foreground">Decision</span>
                      {approval ? (
                        <>
                          <p className="font-medium">{formatPaymentBasis(approval.paymentBasis)}</p>
                          <p className="text-muted-foreground">Access: {formatAccessState(approval.toAccessState)}</p>
                        </>
                      ) : (
                        <p className="font-medium">Awaiting review</p>
                      )}
                    </div>
                  </div>
                  {request.clinicReason && (
                    <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <span className="font-medium">Clinic note:</span> {request.clinicReason}
                    </p>
                  )}
                  {request.reviewReason && request.status !== "pending" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Review note: {request.reviewReason} · {formatDate(request.reviewedAt)}
                    </p>
                  )}
                </div>
                {request.status === "pending" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => openReview({ request, clinic, approval }, "approve")} data-testid={`button-approve-upgrade-request-${request.id}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => openReview({ request, clinic, approval }, "reject")} data-testid={`button-reject-upgrade-request-${request.id}`}>
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedRequest && reviewMode)} onOpenChange={open => !open && closeReview()}>
        <DialogContent data-testid="dialog-review-upgrade-request">
          <DialogHeader>
            <DialogTitle>{reviewMode === "approve" ? "Approve upgrade request" : "Reject upgrade request"}</DialogTitle>
            <DialogDescription>
              {selectedRequest?.clinic.name} requested {formatPlan(selectedRequest?.request.requestedPlan || "")} ({formatCycle(selectedRequest?.request.billingCycle || "monthly")}).
            </DialogDescription>
          </DialogHeader>

          {reviewMode === "approve" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-upgrade-approval-outcome">Approval outcome</Label>
                <select
                  id="admin-upgrade-approval-outcome"
                  value={approvalOutcome}
                  onChange={event => setApprovalOutcome(event.target.value as UpgradeApprovalOutcome)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="select-admin-upgrade-outcome"
                >
                  <option value="online_payment_required">Approve with online payment</option>
                  <option value="verified_offline_payment">Approve after verified offline payment</option>
                  <option value="complimentary">Grant complimentary/sponsored access</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-upgrade-approved-plan">Approved plan</Label>
                  <select
                    id="admin-upgrade-approved-plan"
                    value={approvedPlan}
                    onChange={event => setApprovedPlan(event.target.value as PaidPlanKey)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-admin-upgrade-plan"
                  >
                    {PAID_PLAN_KEYS.map(plan => <option key={plan} value={plan}>{formatPlan(plan)}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-upgrade-approved-cycle">Billing cycle</Label>
                  <select
                    id="admin-upgrade-approved-cycle"
                    value={approvedBillingCycle}
                    onChange={event => setApprovedBillingCycle(event.target.value as BillingCycle)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-admin-upgrade-cycle"
                  >
                    {BILLING_CYCLES.map(cycle => <option key={cycle} value={cycle}>{formatCycle(cycle)}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-upgrade-review-reason">
                  {approvalOutcome === "online_payment_required" ? "Review note (optional unless changing the request)" : "Reason"}
                </Label>
                <Textarea
                  id="admin-upgrade-review-reason"
                  value={reviewReason}
                  onChange={event => setReviewReason(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Explain the approval or any plan/cycle change."
                  data-testid="textarea-admin-upgrade-review-reason"
                />
              </div>
              {approvalOutcome === "verified_offline_payment" && (
                <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 sm:grid-cols-2 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="space-y-2">
                    <Label htmlFor="admin-upgrade-offline-amount">Amount received (INR)</Label>
                    <input id="admin-upgrade-offline-amount" type="number" min={1} step={1} value={offlineAmount} onChange={event => setOfflineAmount(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="input-admin-upgrade-offline-amount" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-upgrade-offline-method">Payment method</Label>
                    <select id="admin-upgrade-offline-method" value={offlinePaymentMethod} onChange={event => setOfflinePaymentMethod(event.target.value as typeof offlinePaymentMethod)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-upgrade-offline-received-at">Payment date</Label>
                    <input id="admin-upgrade-offline-received-at" type="datetime-local" value={offlineReceivedAt} onChange={event => setOfflineReceivedAt(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-upgrade-offline-reference">External reference</Label>
                    <input id="admin-upgrade-offline-reference" value={offlineExternalReference} onChange={event => setOfflineExternalReference(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Bank/UPI receipt reference" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="admin-upgrade-offline-evidence">Evidence reference</Label>
                    <input id="admin-upgrade-offline-evidence" value={offlineEvidenceReference} onChange={event => setOfflineEvidenceReference(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Receipt location or evidence ID" />
                  </div>
                </div>
              )}
              {approvalOutcome === "complimentary" && (
                <div className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3 sm:grid-cols-2 dark:border-sky-900/60 dark:bg-sky-950/20">
                  <div className="space-y-2">
                    <Label htmlFor="admin-upgrade-complimentary-start">Start date</Label>
                    <input id="admin-upgrade-complimentary-start" type="datetime-local" value={complimentaryStartsAt} onChange={event => setComplimentaryStartsAt(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-upgrade-complimentary-end">End date</Label>
                    <input id="admin-upgrade-complimentary-end" type="datetime-local" value={complimentaryEndsAt} min={complimentaryStartsAt} onChange={event => setComplimentaryEndsAt(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="admin-upgrade-complimentary-reference">Sponsor/internal reference (optional)</Label>
                    <input id="admin-upgrade-complimentary-reference" value={complimentarySponsorReference} onChange={event => setComplimentarySponsorReference(event.target.value)} maxLength={160} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                </div>
              )}
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                {approvalOutcome === "online_payment_required"
                  ? "The clinic remains on Trial until provider confirmation."
                  : approvalOutcome === "verified_offline_payment"
                    ? "Full payment evidence is required. No provider subscription will be created."
                    : "No payment will be recorded. Complimentary access ends on the selected date and does not auto-renew."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="admin-upgrade-rejection-reason">Rejection reason</Label>
              <Textarea
                id="admin-upgrade-rejection-reason"
                value={reviewReason}
                onChange={event => setReviewReason(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Tell the clinic why this request was rejected."
                data-testid="textarea-admin-upgrade-rejection-reason"
              />
            </div>
          )}

          {reviewError && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200" role="alert" data-testid="admin-upgrade-review-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {reviewError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeReview} disabled={reviewMutation.isPending} data-testid="button-cancel-upgrade-review">
              Cancel
            </Button>
            <Button
              type="button"
              variant={reviewMode === "approve" ? "default" : "destructive"}
              onClick={() => {
                if (reviewMode === "reject" && !reviewReason.trim()) {
                  setReviewError("A rejection reason is required");
                  return;
                }
                reviewMutation.mutate();
              }}
              disabled={reviewMutation.isPending}
              data-testid={`button-submit-upgrade-${reviewMode || "review"}`}
            >
              {reviewMutation.isPending ? "Saving…" : reviewMode === "approve" ? "Approve request" : "Reject request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}