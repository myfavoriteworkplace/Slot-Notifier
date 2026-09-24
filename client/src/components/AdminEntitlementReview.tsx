import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gift,
  GitBranch,
  History,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import type { Clinic } from "@shared/schema";
import type { EffectiveEntitlementReport } from "@shared/effective-entitlement";
import {
  ADMIN_CLINIC_DIRECTORY_DEFAULT_FILTER,
  ADMIN_CLINIC_DIRECTORY_FILTER_OPTIONS,
  matchesAdminClinicDirectoryFilter,
  matchesAdminClinicDirectorySearch,
  type AdminClinicAccessSummary,
  type AdminClinicDirectoryFilter,
  type AdminClinicDirectoryRecord,
} from "@shared/admin-clinic-directory";
import { getAdminClinicLifecycleState } from "@shared/admin-operations";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ClinicControlCenter from "@/components/ClinicControlCenter";

const USAGE_CAPABILITIES = new Set([
  "bookings",
  "active_doctors",
  "smile_deals",
  "storage",
  "messaging_sms",
  "messaging_whatsapp",
  "messaging_email",
]);

type AccessAction = "sponsored" | "exception";
type SubscriptionHistory = {
  lifecycleEvents: Array<{
    id: number;
    eventType: string;
    fromPlan: string | null;
    toPlan: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    actorType: string;
    reason: string | null;
    effectiveAt: string;
  }>;
  assignments: Array<{ id: number; plan: string; billingCycle: string; source: string; reason: string | null; startsAt: string; endsAt: string | null }>;
  grants: Array<{ id: number; grantId: string; plan: string; reason: string; sponsorReference: string | null; startsAt: string; endsAt: string; revokedAt: string | null }>;
  exceptions: Array<{ id: number; exceptionId: string; entitlementKey: string; overrideValue: unknown; reason: string; startsAt: string; endsAt: string; revokedAt: string | null }>;
  providerEvents?: Array<{
    id: number;
    clinicId: number | null;
    provider: string;
    subscriptionId: string | null;
    eventId: string | null;
    eventType: string;
    processingStatus: string;
    details: Record<string, unknown> | null;
    occurredAt: string | null;
    receivedAt: string | null;
  }>;
  offlinePayments?: Array<{
    id: number;
    plan: string;
    billingCycle: string;
    amount: number;
    currency: string;
    receivedAt: string;
    paymentMethod: string;
    externalReference: string;
    evidenceReference: string;
    verificationStatus: string;
    verifiedBy: string | null;
    verifiedAt: string | null;
    reason: string;
    reversalStatus: string;
    reversedAt: string | null;
    reversalReason: string | null;
  }>;
};

type RevokeTarget = {
  kind: "sponsored_access" | "entitlement_exception";
  id: string;
  label: string;
};

type AccessHistoryEntry = {
  id: string;
  kind: "lifecycle" | "assignment" | "sponsored" | "exception" | "provider" | "offline";
  title: string;
  occurredAt: string | null;
  detail: string;
  reason: string | null;
  status: string | null;
  revokeTarget?: RevokeTarget;
  extendTarget?: { grantId: string; plan: "starter" | "growth" | "pro"; endsAt: string; sponsorReference: string | null };
  offlinePaymentId?: number;
};

type HistoryFilter = "all" | "lifecycle" | "plan" | "temporary" | "provider" | "offline";

const HISTORY_FILTER_OPTIONS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lifecycle", label: "Lifecycle" },
  { value: "plan", label: "Plan changes" },
  { value: "temporary", label: "Temporary access" },
  { value: "provider", label: "Provider events" },
  { value: "offline", label: "Offline payments" },
];

const formatDate = (value: string | null) => {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

const formatClinicDate = (value: Date | string | null | undefined) => {
  if (!value) return "Not recorded";
  return formatDate(value instanceof Date ? value.toISOString() : value);
};

const labelFor = (value: string | null | undefined) => {
  if (!value) return "—";
  if (value === "active_paid") return "Active Paid";
  if (value === "sponsored") return "Sponsored Access";
  return value.replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
};

const paymentBasisLabel = (value: string | null) => {
  if (value === "provider") return "Online provider";
  if (value === "offline_verified") return "Verified offline";
  if (value === "complimentary") return "Complimentary";
  if (value === "none") return "Not required";
  return value ? labelFor(value) : "Legacy / unknown";
};

const paymentStatusLabel = (value: AdminClinicAccessSummary["paymentStatus"]) => {
  if (value === "not_required") return "Not required";
  if (value === "verified_offline") return "Verified offline";
  if (value === "waived") return "Waived";
  return labelFor(value);
};

const importantDateLabel = (value: AdminClinicAccessSummary["nextImportantDateType"]) => {
  if (value === "trial_ends") return "Trial ends";
  if (value === "trial_grace_ends") return "Grace ends";
  if (value === "paid_access_expires") return "Paid access expires";
  if (value === "sponsored_access_ends") return "Sponsored access ends";
  return "No next date";
};

const historyDateValue = (value: string | null) => value ? new Date(value).getTime() : 0;

const localDateTimeValue = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const temporalHistoryStatus = (startsAt: string, endsAt: string | null, revokedAt: string | null) => {
  if (revokedAt) return "Revoked";
  const now = Date.now();
  if (historyDateValue(startsAt) > now) return "Scheduled";
  if (endsAt && historyDateValue(endsAt) <= now) return "Ended";
  return "Active";
};

const formatOverrideValue = (value: unknown) => {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "number" || typeof value === "string") return String(value);
  return "Recorded";
};

const historyStatusClass = (status: string | null) => {
  if (status === "Active" || status === "Applied") return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300";
  if (status === "Scheduled" || status === "Received") return "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300";
  if (status === "Revoked" || status === "Failed" || status === "Unmatched") return "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300";
  return "text-muted-foreground";
};

export default function AdminEntitlementReview({
  clinics,
  clinicsLoading = false,
  clinicsError = false,
  onRetryClinics,
  onEditClinic,
  onManageCredentials,
  onCopyClinicUrl,
  onArchiveClinic,
  onRestoreClinic,
}: {
  clinics: AdminClinicDirectoryRecord[];
  clinicsLoading?: boolean;
  clinicsError?: boolean;
  onRetryClinics?: () => void;
  onEditClinic?: (clinic: Clinic) => void;
  onManageCredentials?: (clinic: Clinic) => void;
  onCopyClinicUrl?: (clinic: Clinic, kind: "book" | "about") => void;
  onArchiveClinic?: (clinic: Clinic) => void;
  onRestoreClinic?: (clinic: Clinic) => void;
}) {
  const [search, setSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState<AdminClinicDirectoryFilter>(ADMIN_CLINIC_DIRECTORY_DEFAULT_FILTER);
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialAction, setTrialAction] = useState<"start" | "extend">("start");
  const [trialReason, setTrialReason] = useState("");
  const [extensionDays, setExtensionDays] = useState("7");
  const [paidDialogOpen, setPaidDialogOpen] = useState(false);
  const [paidPlan, setPaidPlan] = useState<"starter" | "growth" | "pro">("starter");
  const [paidBillingCycle, setPaidBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [paidReason, setPaidReason] = useState("");
  const [offlineDialogOpen, setOfflineDialogOpen] = useState(false);
  const [offlineMode, setOfflineMode] = useState<"activation" | "renewal">("activation");
  const [offlinePlan, setOfflinePlan] = useState<"starter" | "growth" | "pro">("starter");
  const [offlineBillingCycle, setOfflineBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [offlineAmount, setOfflineAmount] = useState("");
  const [offlinePaymentMethod, setOfflinePaymentMethod] = useState<"bank_transfer" | "cash" | "upi" | "card" | "other">("bank_transfer");
  const [offlineExternalReference, setOfflineExternalReference] = useState("");
  const [offlineEvidenceReference, setOfflineEvidenceReference] = useState("");
  const [offlineReceivedAt, setOfflineReceivedAt] = useState("");
  const [offlineReason, setOfflineReason] = useState("");
  const [offlineReversalTarget, setOfflineReversalTarget] = useState<{ id: number; label: string } | null>(null);
  const [offlineReversalReason, setOfflineReversalReason] = useState("");
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessAction, setAccessAction] = useState<AccessAction>("sponsored");
  const [accessPlan, setAccessPlan] = useState<"starter" | "growth" | "pro">("growth");
  const [accessBillingCycle, setAccessBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [accessEntitlement, setAccessEntitlement] = useState("bookings");
  const [accessOverrideValue, setAccessOverrideValue] = useState("true");
  const [accessStartsAt, setAccessStartsAt] = useState("");
  const [accessEndsAt, setAccessEndsAt] = useState("");
  const [accessReason, setAccessReason] = useState("");
  const [accessSponsorReference, setAccessSponsorReference] = useState("");
  const [extensionTarget, setExtensionTarget] = useState<AccessHistoryEntry["extendTarget"] | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [clinicPickerOpen, setClinicPickerOpen] = useState(false);
  const [directoryCollapsed, setDirectoryCollapsed] = useState(false);
  const clinicPickerRef = useRef<HTMLDivElement>(null);
  const clinicDirectoryListRef = useRef<HTMLDivElement>(null);
  const clinicDirectorySentinelRef = useRef<HTMLDivElement>(null);
  const [visibleClinicCount, setVisibleClinicCount] = useState(10);
  const queryClient = useQueryClient();
  const selectedClinic = clinics.find(clinic => clinic.id === selectedClinicId) ?? null;

  const reportQuery = useQuery<EffectiveEntitlementReport>({
    queryKey: ["/api/admin/clinics", selectedClinicId, "entitlements"],
    queryFn: async () => (await apiRequest("GET", `/api/admin/clinics/${selectedClinicId}/entitlements`)).json(),
    enabled: selectedClinicId !== null,
    staleTime: 30_000,
    retry: 1,
  });

  const historyQuery = useQuery<SubscriptionHistory>({
    queryKey: ["/api/admin/clinics", selectedClinicId, "subscription-history"],
    queryFn: async () => (await apiRequest("GET", `/api/admin/clinics/${selectedClinicId}/subscription-history`)).json(),
    enabled: selectedClinicId !== null,
    staleTime: 30_000,
    retry: 1,
  });

  const filteredClinics = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return clinics
      .filter(clinic => matchesAdminClinicDirectoryFilter(clinic, clinicFilter))
      .filter(clinic => matchesAdminClinicDirectorySearch(clinic, needle));
  }, [clinicFilter, clinics, search]);

  const clinicStatusCounts = useMemo(() => {
    const counts = { active: 0, pending: 0, archived: 0 };
    clinics.forEach(clinic => {
      const lifecycle = getAdminClinicLifecycleState(clinic);
      if (lifecycle === "active") counts.active += 1;
      else if (lifecycle === "pending") counts.pending += 1;
      else if (lifecycle === "archived") counts.archived += 1;
    });
    return counts;
  }, [clinics]);

  const attentionClinicCount = useMemo(
    () => clinics.filter(clinic => matchesAdminClinicDirectoryFilter(clinic, "attention")).length,
    [clinics],
  );
  const pickerClinics = filteredClinics.slice(0, 10);
  const visibleClinics = filteredClinics.slice(0, visibleClinicCount);

  useEffect(() => {
    setVisibleClinicCount(10);
  }, [clinicFilter, search, clinics]);

  useEffect(() => {
    const list = clinicDirectoryListRef.current;
    const sentinel = clinicDirectorySentinelRef.current;
    if (!list || !sentinel || visibleClinicCount >= filteredClinics.length) return;

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        setVisibleClinicCount(currentCount => Math.min(currentCount + 10, filteredClinics.length));
      },
      { root: list, rootMargin: "160px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredClinics.length, visibleClinicCount]);

  useEffect(() => {
    setSelectedClinicId(currentId => {
      if (currentId !== null && clinics.some(clinic => clinic.id === currentId)) return currentId;
      return filteredClinics[0]?.id ?? clinics[0]?.id ?? null;
    });
  }, [clinics, filteredClinics]);

  useEffect(() => {
    if (!clinicPickerOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!clinicPickerRef.current?.contains(event.target as Node)) setClinicPickerOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [clinicPickerOpen]);

  const numericCapabilities = reportQuery.data?.capabilities.filter(item => USAGE_CAPABILITIES.has(item.capability)) ?? [];
  const featureCapabilities = reportQuery.data?.capabilities.filter(item => !USAGE_CAPABILITIES.has(item.capability)) ?? [];
  const attentionCount = reportQuery.data?.capabilities.filter(item => item.overLimit === true).length ?? 0;
  const report = reportQuery.data;
  const hasTrialHistory = Boolean(report?.access.trialStartedAt && report.plan.effective === "trial");
  const historyEntries = useMemo<AccessHistoryEntry[]>(() => {
    const data = historyQuery.data;
    if (!data) return [];

    const entries: AccessHistoryEntry[] = [
      ...data.lifecycleEvents.map(event => ({
        id: `lifecycle-${event.id}`,
        kind: "lifecycle" as const,
        title: labelFor(event.eventType),
        occurredAt: event.effectiveAt,
        detail: [
          [event.fromPlan && `${labelFor(event.fromPlan)} →`, event.toPlan && labelFor(event.toPlan)].filter(Boolean).join(" "),
          event.toStatus && `Status: ${labelFor(event.toStatus)}`,
          `Actor: ${labelFor(event.actorType)}`,
        ].filter(Boolean).join(" · "),
        reason: event.reason,
        status: "Recorded",
      })),
      ...data.assignments.map(assignment => ({
        id: `assignment-${assignment.id}`,
        kind: "assignment" as const,
        title: `Plan assignment · ${labelFor(assignment.plan)}`,
        occurredAt: assignment.startsAt,
        detail: [
          assignment.source && `Source: ${labelFor(assignment.source)}`,
          assignment.billingCycle && `Billing: ${labelFor(assignment.billingCycle)}`,
          assignment.endsAt && `Ends ${formatDate(assignment.endsAt)}`,
        ].filter(Boolean).join(" · "),
        reason: assignment.reason,
        status: temporalHistoryStatus(assignment.startsAt, assignment.endsAt, null),
      })),
      ...data.grants.map(grant => ({
        id: `grant-${grant.id}`,
        kind: "sponsored" as const,
        title: `Sponsored access · ${labelFor(grant.plan)}`,
        occurredAt: grant.startsAt,
        detail: grant.revokedAt
          ? `Started ${formatDate(grant.startsAt)} · Revoked ${formatDate(grant.revokedAt)}`
          : `Ends ${formatDate(grant.endsAt)}${grant.sponsorReference ? ` · Sponsor: ${grant.sponsorReference}` : ""}`,
        reason: grant.reason,
        status: temporalHistoryStatus(grant.startsAt, grant.endsAt, grant.revokedAt),
        extendTarget: {
          grantId: grant.grantId,
          plan: grant.plan as "starter" | "growth" | "pro",
          endsAt: grant.endsAt,
          sponsorReference: grant.sponsorReference,
        },
        revokeTarget: {
          kind: "sponsored_access" as const,
          id: grant.grantId,
          label: `Sponsored ${labelFor(grant.plan)}`,
        },
      })),
      ...data.exceptions.map(exception => ({
        id: `exception-${exception.id}`,
        kind: "exception" as const,
        title: `Entitlement exception · ${labelFor(exception.entitlementKey)}`,
        occurredAt: exception.startsAt,
        detail: exception.revokedAt
          ? `Override: ${formatOverrideValue(exception.overrideValue)} · Started ${formatDate(exception.startsAt)} · Revoked ${formatDate(exception.revokedAt)}`
          : `Override: ${formatOverrideValue(exception.overrideValue)} · Ends ${formatDate(exception.endsAt)}`,
        reason: exception.reason,
        status: temporalHistoryStatus(exception.startsAt, exception.endsAt, exception.revokedAt),
        revokeTarget: {
          kind: "entitlement_exception" as const,
          id: exception.exceptionId,
          label: `Exception · ${labelFor(exception.entitlementKey)}`,
        },
      })),
      ...(data.providerEvents ?? []).map(event => ({
        id: `provider-${event.id}`,
        kind: "provider" as const,
        title: `Provider event · ${event.eventType.replaceAll(".", " ")}`,
        occurredAt: event.receivedAt ?? event.occurredAt,
        detail: [
          labelFor(event.provider),
          event.subscriptionId && `Subscription: ${event.subscriptionId}`,
          event.eventId && `Event: ${event.eventId}`,
        ].filter(Boolean).join(" · "),
        reason: event.details ? `Provider payload recorded (${Object.keys(event.details).length} fields)` : null,
        status: event.processingStatus === "applied"
          ? "Applied"
          : event.processingStatus === "unmatched"
            ? "Unmatched"
            : labelFor(event.processingStatus),
      })),
      ...(data.offlinePayments ?? []).map(payment => ({
        id: `offline-${payment.id}`,
        kind: "offline" as const,
        title: `Verified offline payment · ${labelFor(payment.plan)}`,
        occurredAt: payment.receivedAt,
        detail: [
          `₹${payment.amount.toLocaleString("en-IN")} ${payment.currency}`,
          labelFor(payment.billingCycle),
          labelFor(payment.paymentMethod),
          `Reference: ${payment.externalReference}`,
          `Evidence: ${payment.evidenceReference}`,
          payment.reversalStatus === "reversed" ? `Reversed ${formatDate(payment.reversedAt)}` : "Verified",
        ].join(" · "),
        reason: payment.reversalStatus === "reversed"
          ? payment.reversalReason || payment.reason
          : payment.reason,
        status: payment.reversalStatus === "reversed" ? "Reversed" : "Verified",
        offlinePaymentId: payment.id,
      })),
    ];

    return entries.sort((a, b) => historyDateValue(b.occurredAt) - historyDateValue(a.occurredAt) || b.id.localeCompare(a.id));
  }, [historyQuery.data]);
  const filteredHistoryEntries = useMemo(
    () => historyEntries.filter(entry =>
      historyFilter === "all"
      || historyFilter === "lifecycle" && entry.kind === "lifecycle"
      || historyFilter === "plan" && entry.kind === "assignment"
      || historyFilter === "temporary" && (entry.kind === "sponsored" || entry.kind === "exception")
       || historyFilter === "provider" && entry.kind === "provider"
       || historyFilter === "offline" && entry.kind === "offline"
    ),
    [historyEntries, historyFilter],
  );

  const refreshSubscriptionQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinics/directory"] }),
    ]);
    await Promise.all([reportQuery.refetch(), historyQuery.refetch()]);
  };

  const trialMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null) throw new Error("Select a clinic first");
      const response = await apiRequest("POST", `/api/admin/clinics/${selectedClinicId}/trial`, {
        action: trialAction,
        reason: trialReason.trim(),
        extensionDays: trialAction === "extend" ? Number(extensionDays) : undefined,
        transitionId: crypto.randomUUID(),
      });
      return response.json();
    },
    onSuccess: async () => {
      setTrialDialogOpen(false);
      setTrialReason("");
      notify.success(trialAction === "start" ? "Trial started" : "Trial extended", {
        description: `${selectedClinic?.name || "Clinic"} now has an audited Trial lifecycle record.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/clinics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/clinics/directory"] }),
      ]);
      await reportQuery.refetch();
    },
    onError: (error: Error) => notify.error(error.message || "Could not update Trial"),
  });

  const paidPlanMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null) throw new Error("Select a clinic first");
      const response = await apiRequest("POST", `/api/admin/clinics/${selectedClinicId}/paid-plan`, {
        plan: paidPlan,
        billingCycle: paidBillingCycle,
        reason: paidReason.trim(),
        transitionId: crypto.randomUUID(),
      });
      return response.json();
    },
    onSuccess: async (result) => {
      setPaidDialogOpen(false);
      setPaidReason("");
      notify.success("Paid plan assignment prepared", {
        description: result.activationUrl
          ? `The clinic is pending payment. Activation link: ${result.activationUrl}`
          : "The clinic is pending payment and the provider activation link is not available.",
      });
      await refreshSubscriptionQueries();
    },
    onError: (error: Error) => notify.error(error.message || "Could not assign paid plan"),
  });

  const offlinePaymentMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null) throw new Error("Select a clinic first");
      if (!offlineReceivedAt) throw new Error("Choose when the payment was received");
      const response = await apiRequest("POST", `/api/admin/clinics/${selectedClinicId}/offline-payment`, {
        mode: offlineMode,
        plan: offlinePlan,
        billingCycle: offlineBillingCycle,
        amount: Number(offlineAmount),
        currency: "INR",
        receivedAt: new Date(offlineReceivedAt).toISOString(),
        paymentMethod: offlinePaymentMethod,
        externalReference: offlineExternalReference.trim(),
        evidenceReference: offlineEvidenceReference.trim(),
        reason: offlineReason.trim(),
        transitionId: crypto.randomUUID(),
      });
      return response.json();
    },
    onSuccess: async () => {
      setOfflineDialogOpen(false);
      setOfflineExternalReference("");
      setOfflineEvidenceReference("");
      setOfflineReason("");
      setOfflineAmount("");
      notify.success(offlineMode === "activation" ? "Offline payment verified" : "Offline renewal recorded", {
        description: "Paid access and immutable payment evidence were recorded in subscription history.",
      });
      await refreshSubscriptionQueries();
    },
    onError: (error: Error) => notify.error(error.message || "Could not record offline payment"),
  });

  const offlineReversalMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null || !offlineReversalTarget) throw new Error("Select an offline payment first");
      const response = await apiRequest("POST", `/api/admin/clinics/${selectedClinicId}/offline-payment/${offlineReversalTarget.id}/reverse`, {
        reason: offlineReversalReason.trim(),
        transitionId: crypto.randomUUID(),
      });
      return response.json();
    },
    onSuccess: async (result) => {
      setOfflineReversalTarget(null);
      setOfflineReversalReason("");
      notify.success("Offline payment reversed", {
        description: result.accessChanged ? "Current paid access was moved to an expired attention state." : "Historical payment evidence was retained without changing later access.",
      });
      await refreshSubscriptionQueries();
    },
    onError: (error: Error) => notify.error(error.message || "Could not reverse offline payment"),
  });

  const accessMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null) throw new Error("Select a clinic first");
      if (!accessEndsAt) throw new Error("Choose an end date");
      const payload = {
        startsAt: accessStartsAt ? new Date(accessStartsAt).toISOString() : undefined,
        endsAt: new Date(accessEndsAt).toISOString(),
        reason: accessReason.trim(),
      };
      const path = accessAction === "sponsored"
        ? `/api/admin/clinics/${selectedClinicId}/sponsored-access`
        : `/api/admin/clinics/${selectedClinicId}/entitlement-exceptions`;
      const body = accessAction === "sponsored"
        ? {
            ...payload,
            plan: accessPlan,
            billingCycle: accessBillingCycle,
            sponsorReference: accessSponsorReference.trim() || undefined,
            transitionId: crypto.randomUUID(),
          }
        : { ...payload, entitlementKey: accessEntitlement, overrideValue: accessOverrideValue === "true" ? true : accessOverrideValue === "false" ? false : Number(accessOverrideValue) || accessOverrideValue, exceptionId: crypto.randomUUID() };
      const response = await apiRequest("POST", path, body);
      return response.json();
    },
    onSuccess: async () => {
      setAccessDialogOpen(false);
      setAccessReason("");
      setAccessStartsAt("");
      setAccessEndsAt("");
      setAccessSponsorReference("");
      setExtensionTarget(null);
      notify.success(accessAction === "sponsored" ? (extensionTarget ? "Sponsored access extended" : "Sponsored access granted") : "Entitlement exception granted", {
        description: accessAction === "sponsored" ? "No payment was recorded and this access will not renew automatically." : undefined,
      });
      await refreshSubscriptionQueries();
    },
    onError: (error: Error) => notify.error(error.message || "Could not grant access"),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (selectedClinicId === null || !revokeTarget) throw new Error("Select an access record first");
      const path = revokeTarget.kind === "sponsored_access"
        ? `/api/admin/clinics/${selectedClinicId}/sponsored-access/${revokeTarget.id}/revoke`
        : `/api/admin/clinics/${selectedClinicId}/entitlement-exceptions/${revokeTarget.id}/revoke`;
      const response = await apiRequest("POST", path, {
        reason: revokeReason.trim(),
        transitionId: crypto.randomUUID(),
      });
      return response.json();
    },
    onSuccess: async () => {
      setRevokeTarget(null);
      setRevokeReason("");
      notify.success("Temporary access revoked", {
        description: "The revocation was recorded in subscription history.",
      });
      await refreshSubscriptionQueries();
    },
    onError: (error: Error) => notify.error(error.message || "Could not revoke temporary access"),
  });

  const openTrialDialog = (action: "start" | "extend") => {
    setTrialAction(action);
    setTrialReason("");
    setExtensionDays("7");
    setTrialDialogOpen(true);
  };

  const openAccessDialog = (action: AccessAction, extension?: AccessHistoryEntry["extendTarget"]) => {
    setAccessAction(action);
    setExtensionTarget(extension ?? null);
    setAccessPlan(extension?.plan ?? "growth");
    setAccessBillingCycle("monthly");
    setAccessReason("");
    setAccessSponsorReference(extension?.sponsorReference ?? "");
    setAccessStartsAt(extension ? (() => {
      const date = new Date(extension.endsAt);
      const offset = date.getTimezoneOffset();
      return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
    })() : "");
    setAccessEndsAt("");
    setAccessDialogOpen(true);
  };

  const openOfflineDialog = (mode: "activation" | "renewal") => {
    setOfflineMode(mode);
    setOfflinePlan((selectedClinic?.plan === "growth" || selectedClinic?.plan === "pro" || selectedClinic?.plan === "starter") ? selectedClinic.plan : "starter");
    setOfflineBillingCycle(selectedClinic?.billingCycle === "annual" ? "annual" : "monthly");
    setOfflineAmount("");
    setOfflinePaymentMethod("bank_transfer");
    setOfflineExternalReference("");
    setOfflineEvidenceReference("");
    setOfflineReceivedAt(localDateTimeValue());
    setOfflineReason("");
    setOfflineDialogOpen(true);
  };

  const selectClinicFromDirectory = (clinicId: number) => {
    setSelectedClinicId(clinicId);
    setDirectoryCollapsed(true);
    setClinicPickerOpen(false);
  };

  const restoreDirectory = () => {
    setDirectoryCollapsed(false);
    setSelectedClinicId(null);
    setClinicPickerOpen(false);
  };

  return (
    <div className="space-y-5">
      {!directoryCollapsed && (
        <>
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[220px] flex-1">
              <CardTitle className="text-sm">Clinic directory</CardTitle>
              <CardDescription className="mt-0.5">
                {filteredClinics.length} matching · {clinics.length} total clinic{clinics.length === 1 ? "" : "s"}
              </CardDescription>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {([
                  { value: "active", label: "Active", count: clinicStatusCounts.active },
                  { value: "pending", label: "Pending", count: clinicStatusCounts.pending },
                  { value: "archived", label: "Archived", count: clinicStatusCounts.archived },
                  { value: "attention", label: "Attention", count: attentionClinicCount },
                ] as const).map(status => (
                  <button
                    key={status.value}
                    type="button"
                    aria-pressed={clinicFilter === status.value}
                    onClick={() => setClinicFilter(status.value)}
                    className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors ${
                      clinicFilter === status.value
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {status.label} {status.count}
                  </button>
                ))}
              </div>
            </div>

            <div ref={clinicPickerRef} className="relative min-w-[min(100%,280px)] flex-1 sm:max-w-lg">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onFocus={() => setClinicPickerOpen(true)}
                onClick={() => setClinicPickerOpen(true)}
                onKeyDown={event => {
                  if (event.key === "Escape") setClinicPickerOpen(false);
                }}
                onChange={event => {
                  setSearch(event.target.value);
                  setClinicPickerOpen(true);
                }}
                placeholder="Search name, city, email, or plan"
                className="h-9 pl-8 text-xs"
                aria-label="Search Clinics and Access directory"
                aria-expanded={clinicPickerOpen}
                aria-controls="clinic-directory-picker"
              />
              {clinicPickerOpen && (
                <div
                  id="clinic-directory-picker"
                  className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
                  role="listbox"
                  aria-label="Clinic search results"
                >
                  <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold">Select a clinic</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {ADMIN_CLINIC_DIRECTORY_FILTER_OPTIONS.find(option => option.value === clinicFilter)?.label || "Current view"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {filteredClinics.length} matching
                    </Badge>
                  </div>
                  {clinicsError && (
                    <div className="border-b border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/15 dark:text-red-300" role="alert">
                      <p className="font-semibold">Clinic directory unavailable.</p>
                      {onRetryClinics && <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onRetryClinics} disabled={clinicsLoading}>Retry clinics</Button>}
                    </div>
                  )}
                  <div className="max-h-[500px] overflow-y-auto p-2">
                    {clinicsLoading && <p className="px-2 py-8 text-center text-xs text-muted-foreground">Loading clinics…</p>}
                    {!clinicsLoading && pickerClinics.map(clinic => (
                      <button
                        key={clinic.id}
                        type="button"
                        role="option"
                        aria-selected={selectedClinicId === clinic.id}
                        onClick={() => {
                          setSelectedClinicId(clinic.id);
                          setSearch("");
                          setClinicPickerOpen(false);
                        }}
                        className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          selectedClinicId === clinic.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}
                        data-testid={`button-review-entitlements-${clinic.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate text-xs font-semibold">{clinic.name}</span>
                          <span className="shrink-0 text-[10px] capitalize text-muted-foreground">{clinic.plan || "No plan"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {clinic.city && <span className="truncate">{clinic.city}</span>}
                          <span className="capitalize">{getAdminClinicLifecycleState(clinic)}</span>
                          <span className="capitalize">{clinic.subscriptionStatus || "state unavailable"}</span>
                        </div>
                      </button>
                    ))}
                    {!clinicsLoading && !pickerClinics.length && (
                      <p className="px-2 py-8 text-center text-xs text-muted-foreground">No clinics match this search.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
                    <span>
                      Showing {Math.min(pickerClinics.length, 10)} of {filteredClinics.length} matching clinics
                    </span>
                    <span>{clinics.length} total clinics</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-w-[min(100%,220px)] items-center gap-2 sm:w-56">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <select
                value={clinicFilter}
                onChange={event => setClinicFilter(event.target.value as AdminClinicDirectoryFilter)}
                className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                aria-label="Filter Clinics and Access directory"
              >
                {ADMIN_CLINIC_DIRECTORY_FILTER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 border-t pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">Clinics</p>
                <p className="text-[10px] text-muted-foreground">
                  Click a clinic to expand its full access workspace.
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Showing {Math.min(visibleClinics.length, filteredClinics.length)} of {filteredClinics.length}
              </Badge>
            </div>

            <div
              ref={clinicDirectoryListRef}
              className="max-h-[560px] space-y-2 overflow-y-auto rounded-xl border bg-muted/10 p-2"
              aria-label="Visible clinic directory"
            >
              {clinicsLoading && (
                <p className="px-3 py-10 text-center text-xs text-muted-foreground">Loading clinics…</p>
              )}
              {!clinicsLoading && visibleClinics.map(clinic => {
                const lifecycle = getAdminClinicLifecycleState(clinic);
                const hasAttention = matchesAdminClinicDirectoryFilter(clinic, "attention");
                return (
                  <div
                    key={clinic.id}
                    role="button"
                    tabIndex={0}
                    aria-expanded={selectedClinicId === clinic.id}
                    aria-controls={selectedClinicId === clinic.id ? `admin-clinic-details-${clinic.id}` : undefined}
                    onClick={() => selectClinicFromDirectory(clinic.id)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectClinicFromDirectory(clinic.id);
                      }
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selectedClinicId === clinic.id
                        ? "border-primary/50 bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-muted/30"
                    }`}
                    data-testid={`clinic-directory-row-${clinic.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                          {clinic.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold">{clinic.name}</p>
                            <Badge variant="outline" className="text-[10px]">{labelFor(lifecycle)}</Badge>
                            {hasAttention && (
                              <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-300">
                                Attention
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {clinic.city || "Clinic"} · Clinic #{clinic.id}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5" onClick={event => event.stopPropagation()}>
                        {onCopyClinicUrl && (
                          <>
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onCopyClinicUrl(clinic, "book")} title="Copy booking URL">
                              Book URL
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onCopyClinicUrl(clinic, "about")} title="Copy About URL">
                              About URL
                            </Button>
                          </>
                        )}
                        {onEditClinic && (
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onEditClinic(clinic)}>
                            Edit clinic
                          </Button>
                        )}
                        {onManageCredentials && (
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onManageCredentials(clinic)}>
                            Credentials
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 xl:grid-cols-6">
                      {[
                        { label: "Current access", value: labelFor(clinic.currentAccessState), detail: clinic.attentionCode ? `Attention · ${labelFor(clinic.attentionCode)}` : "Central entitlement result" },
                        { label: "Current plan", value: labelFor(clinic.currentAccessPlan), detail: clinic.currentAccessPlan ? "Enforced access plan" : "No confirmed plan" },
                        { label: "Assigned plan", value: labelFor(clinic.assignedPlan), detail: clinic.latestApprovalOutcome ? `Latest · ${labelFor(clinic.latestApprovalOutcome)}` : "No approval decision" },
                        { label: "Payment", value: paymentStatusLabel(clinic.paymentStatus), detail: paymentBasisLabel(clinic.paymentBasis) },
                        { label: importantDateLabel(clinic.nextImportantDateType), value: clinic.nextImportantDate ? formatClinicDate(clinic.nextImportantDate) : "Not recorded", detail: clinic.renewalMode ? `Renewal · ${labelFor(clinic.renewalMode)}` : "No renewal mode" },
                        { label: "Latest approval", value: clinic.latestApproval ? formatClinicDate(clinic.latestApproval.effectiveAt) : "Not recorded", detail: clinic.latestApproval ? `${labelFor(clinic.latestApproval.actorType)}${clinic.latestApproval.actorId ? ` · ${clinic.latestApproval.actorId}` : ""}` : "No approval decision" },
                      ].map(metric => (
                        <div key={metric.label} className="min-w-0 rounded-lg bg-muted/30 px-2.5 py-2">
                          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                          <p className="mt-1 truncate text-xs font-semibold">{metric.value}</p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{metric.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!clinicsLoading && !visibleClinics.length && (
                <p className="px-3 py-10 text-center text-xs text-muted-foreground">No clinics match the current search and filter.</p>
              )}
              {!clinicsLoading && visibleClinics.length < filteredClinics.length && (
                <div ref={clinicDirectorySentinelRef} className="flex justify-center py-3 text-[10px] text-muted-foreground" role="status">
                  Scroll for more clinics…
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {clinicsError && !clinicPickerOpen && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/15 dark:text-red-300" role="alert">
          <p className="font-semibold">Clinic directory unavailable.</p>
          {onRetryClinics && <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onRetryClinics} disabled={clinicsLoading}>Retry clinics</Button>}
        </div>
      )}
        </>
      )}

      {directoryCollapsed && selectedClinic && (
        <div className="relative pl-10">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute left-0 top-4 z-10 h-8 w-8 rounded-full border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 focus-visible:ring-amber-400 dark:border-amber-800/70 dark:bg-amber-950/25 dark:text-amber-300 dark:hover:border-amber-700 dark:hover:bg-amber-950/45 dark:hover:text-amber-200"
            onClick={restoreDirectory}
            aria-label="Close clinic details and return to clinic directory"
            title="Close clinic details"
            data-testid="button-restore-clinic-directory"
          >
            <X className="h-4 w-4" />
          </Button>
          <div id={`admin-clinic-details-${selectedClinic.id}`} className="min-w-0 space-y-4">
             <ClinicControlCenter
               clinic={selectedClinic}
               accessSummary={selectedClinic}
               report={report}
               attentionCount={attentionCount}
               numericCapabilities={numericCapabilities}
               featureCapabilities={featureCapabilities}
               hasTrialHistory={hasTrialHistory}
                auditEventCount={historyEntries.length}
                auditHistoryLoading={historyQuery.isLoading}
               reportLoading={reportQuery.isLoading}
               reportError={reportQuery.isError}
               onRetryReport={() => reportQuery.refetch()}
               onStartTrial={() => openTrialDialog(hasTrialHistory ? "extend" : "start")}
               onAssignPaidPlan={() => setPaidDialogOpen(true)}
                onRecordOfflinePayment={openOfflineDialog}
               onOpenAccessDialog={openAccessDialog}
                onOpenAuditTrail={() => setAuditTrailOpen(true)}
               onCopyClinicUrl={onCopyClinicUrl}
               onEditClinic={onEditClinic}
               onManageCredentials={onManageCredentials}
               onArchiveClinic={onArchiveClinic}
               onRestoreClinic={onRestoreClinic}
             />

            {reportQuery.isFetching && report && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300" role="status">
                Refreshing the entitlement report; the displayed values are from the previous successful report until the refresh completes.
              </div>
            )}
            {report && (
              <>
                {(report.access.trialEndsAt || report.access.trialGraceEndsAt || report.access.paidAccessExpiresAt || report.grants.endsAt) && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4" />Important dates</CardTitle></CardHeader>
                    <CardContent className="grid gap-2 text-xs sm:grid-cols-2">
                      {report.access.trialEndsAt && <div className="rounded-lg border p-3"><span className="text-muted-foreground">Trial ends</span><strong className="mt-1 block">{formatDate(report.access.trialEndsAt)}</strong></div>}
                      {report.access.trialGraceEndsAt && <div className="rounded-lg border p-3"><span className="text-muted-foreground">Trial grace ends</span><strong className="mt-1 block">{formatDate(report.access.trialGraceEndsAt)}</strong></div>}
                      {report.access.paidAccessExpiresAt && <div className="rounded-lg border p-3"><span className="text-muted-foreground">Paid access expires</span><strong className="mt-1 block">{formatDate(report.access.paidAccessExpiresAt)}</strong></div>}
                      {report.grants.endsAt && <div className="rounded-lg border p-3"><span className="text-muted-foreground">Sponsored access ends</span><strong className="mt-1 block">{formatDate(report.grants.endsAt)}</strong></div>}
                    </CardContent>
                  </Card>
                )}

                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Every Admin action requires a reason and writes an append-only lifecycle record. Paid assignment remains pending payment until provider activation. These controls do not enforce limits.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Sheet open={auditTrailOpen} onOpenChange={setAuditTrailOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
          data-testid="sheet-audit-trail"
        >
          <SheetHeader className="shrink-0 border-b px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" />
              Audit trail
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {historyEntries.length} event{historyEntries.length === 1 ? "" : "s"}
              </Badge>
            </SheetTitle>
            <SheetDescription className="text-xs leading-5">
              Append-only lifecycle, plan, temporary access, and provider records for {selectedClinic?.name || "this clinic"}.
            </SheetDescription>
          </SheetHeader>

          <div className="shrink-0 overflow-x-auto border-b bg-muted/20 px-4 py-3">
            <div className="flex min-w-max items-center gap-1.5" role="group" aria-label="Audit trail filters">
              {HISTORY_FILTER_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={historyFilter === option.value}
                  onClick={() => setHistoryFilter(option.value)}
                  className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    historyFilter === option.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid={`audit-filter-${option.value}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {historyQuery.isLoading && <p className="text-xs text-muted-foreground">Loading audit events…</p>}
            {historyQuery.isError && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
                <span>Audit trail is unavailable.</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => historyQuery.refetch()} disabled={historyQuery.isFetching}>Retry</Button>
              </div>
            )}
            {historyQuery.isFetching && historyQuery.data && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300" role="status">
                Refreshing audit trail; displayed records may be delayed.
              </p>
            )}
            {historyQuery.data && filteredHistoryEntries.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <History className="mx-auto h-7 w-7 text-muted-foreground/50" />
                <p className="mt-2 text-xs font-semibold">No matching events</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {historyEntries.length === 0 ? "No access history has been recorded for this clinic." : "Try a different audit trail filter."}
                </p>
              </div>
            )}
            {filteredHistoryEntries.length > 0 && (
              <div className="relative space-y-4 pl-7" data-testid={`admin-access-history-${selectedClinic?.id}`}>
                <div className="absolute bottom-3 left-[11px] top-3 w-px bg-border" aria-hidden="true" />
                {filteredHistoryEntries.map(entry => {
                  const EntryIcon = entry.kind === "provider"
                    ? Radio
                    : entry.kind === "assignment"
                      ? CreditCard
                      : entry.kind === "offline"
                        ? Banknote
                      : entry.kind === "sponsored"
                        ? Gift
                        : entry.kind === "exception"
                          ? SlidersHorizontal
                          : GitBranch;
                  const kindLabel = entry.kind === "assignment"
                    ? "Plan change"
                    : entry.kind === "sponsored" || entry.kind === "exception"
                      ? "Temporary access"
                      : entry.kind === "provider"
                        ? "Provider event"
                      : entry.kind === "offline"
                        ? "Offline payment"
                        : "Lifecycle";
                  return (
                    <article key={entry.id} className="relative rounded-xl border bg-background p-3 shadow-sm">
                      <div className="absolute -left-[27px] top-3 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-primary shadow-sm">
                        <EntryIcon className="h-3 w-3" />
                      </div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold">{entry.title}</span>
                            <Badge variant="outline" className={`text-[10px] ${historyStatusClass(entry.status)}`}>{entry.status || "Recorded"}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{kindLabel}</Badge>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{entry.detail || "No additional details recorded."}</p>
                          {entry.reason && <p className="mt-1.5 text-xs leading-5">{entry.reason}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <time className="font-mono text-[10px] text-muted-foreground">{entry.occurredAt ? formatDate(entry.occurredAt) : "Date unavailable"}</time>
                          {entry.extendTarget && entry.kind === "sponsored" && entry.status !== "Revoked" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => openAccessDialog("sponsored", entry.extendTarget)}
                            >
                              <CalendarDays className="mr-1 h-3 w-3" />Extend
                            </Button>
                          )}
                          {entry.revokeTarget && entry.status === "Active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => { setRevokeTarget(entry.revokeTarget!); setRevokeReason(""); }}
                            >
                              <XCircle className="mr-1 h-3 w-3" />Revoke
                            </Button>
                          )}
                          {entry.kind === "offline" && entry.offlinePaymentId && entry.status === "Verified" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] text-destructive hover:text-destructive"
                              onClick={() => { setOfflineReversalTarget({ id: entry.offlinePaymentId!, label: entry.title }); setOfflineReversalReason(""); }}
                            >
                              <XCircle className="mr-1 h-3 w-3" />Reverse payment
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {trialAction === "start" ? "Start Trial" : "Extend Trial"}
            </DialogTitle>
            <DialogDescription>
              {trialAction === "start"
                ? `${selectedClinic?.name || "This clinic"} will receive the published 14-day Trial policy.`
                : `${selectedClinic?.name || "This clinic"} will receive additional Trial time without restarting its Trial history.`}
              {" "}This does not create or change a Razorpay subscription.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {trialAction === "extend" && (
              <div className="space-y-2">
                <label htmlFor="trial-extension-days" className="text-sm font-semibold">Additional days</label>
                <Input
                  id="trial-extension-days"
                  type="number"
                  min={1}
                  max={30}
                  value={extensionDays}
                  onChange={event => setExtensionDays(event.target.value)}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">Choose between 1 and 30 days. The grace date moves with the Trial end date.</p>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="trial-reason" className="text-sm font-semibold">Reason <span className="text-destructive">*</span></label>
              <Textarea
                id="trial-reason"
                value={trialReason}
                onChange={event => setTrialReason(event.target.value)}
                placeholder="Record why this Trial access is being granted or extended."
                maxLength={500}
                className="min-h-[100px] text-sm"
              />
              <p className="text-xs text-muted-foreground">{trialReason.trim().length}/10 minimum characters · {trialReason.length}/500</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTrialDialogOpen(false)} disabled={trialMutation.isPending}>Cancel</Button>
            <Button
              onClick={() => trialMutation.mutate()}
              disabled={trialMutation.isPending || trialReason.trim().length < 10 || (trialAction === "extend" && (!Number.isInteger(Number(extensionDays)) || Number(extensionDays) < 1 || Number(extensionDays) > 30))}
            >
              {trialMutation.isPending ? "Saving…" : trialAction === "start" ? "Start Trial" : "Extend Trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paidDialogOpen} onOpenChange={setPaidDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Assign paid plan</DialogTitle>
            <DialogDescription>
              This prepares a provider activation and records the assignment as pending payment. It does not mark the clinic as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="paid-plan" className="text-sm font-semibold">Plan</label>
              <select id="paid-plan" value={paidPlan} onChange={event => setPaidPlan(event.target.value as typeof paidPlan)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="paid-cycle" className="text-sm font-semibold">Billing cycle</label>
              <select id="paid-cycle" value={paidBillingCycle} onChange={event => setPaidBillingCycle(event.target.value as typeof paidBillingCycle)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="paid-reason" className="text-sm font-semibold">Reason <span className="text-destructive">*</span></label>
              <Textarea id="paid-reason" value={paidReason} onChange={event => setPaidReason(event.target.value)} placeholder="Record why this paid plan is being assigned." maxLength={500} className="min-h-[100px] text-sm" />
              <p className="text-xs text-muted-foreground">{paidReason.trim().length}/10 minimum characters · {paidReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidDialogOpen(false)} disabled={paidPlanMutation.isPending}>Cancel</Button>
            <Button onClick={() => paidPlanMutation.mutate()} disabled={paidPlanMutation.isPending || paidReason.trim().length < 10}>
              {paidPlanMutation.isPending ? "Preparing…" : "Assign and prepare payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={offlineDialogOpen} onOpenChange={setOfflineDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              {offlineMode === "activation" ? "Verify offline payment" : "Record offline renewal"}
            </DialogTitle>
            <DialogDescription>
              This marks the payment as verified, activates the paid period, and retains the original evidence as immutable audit history.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="offline-plan" className="text-sm font-semibold">Plan</label>
              <select id="offline-plan" value={offlinePlan} onChange={event => setOfflinePlan(event.target.value as typeof offlinePlan)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="offline-cycle" className="text-sm font-semibold">Billing cycle</label>
              <select id="offline-cycle" value={offlineBillingCycle} onChange={event => setOfflineBillingCycle(event.target.value as typeof offlineBillingCycle)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="offline-amount" className="text-sm font-semibold">Amount (INR)</label>
              <Input id="offline-amount" type="number" min={1} step={1} value={offlineAmount} onChange={event => setOfflineAmount(event.target.value)} placeholder="e.g. 12000" />
            </div>
            <div className="space-y-2">
              <label htmlFor="offline-method" className="text-sm font-semibold">Payment method</label>
              <select id="offline-method" value={offlinePaymentMethod} onChange={event => setOfflinePaymentMethod(event.target.value as typeof offlinePaymentMethod)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="bank_transfer">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="offline-received-at" className="text-sm font-semibold">Received at</label>
              <Input id="offline-received-at" type="datetime-local" value={offlineReceivedAt} onChange={event => setOfflineReceivedAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="offline-reference" className="text-sm font-semibold">Payment reference <span className="text-destructive">*</span></label>
              <Input id="offline-reference" value={offlineExternalReference} onChange={event => setOfflineExternalReference(event.target.value)} placeholder="Bank/UPI receipt reference" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="offline-evidence" className="text-sm font-semibold">Evidence reference <span className="text-destructive">*</span></label>
              <Input id="offline-evidence" value={offlineEvidenceReference} onChange={event => setOfflineEvidenceReference(event.target.value)} placeholder="Receipt location, document ID, or internal evidence reference" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="offline-reason" className="text-sm font-semibold">Verification reason <span className="text-destructive">*</span></label>
              <Textarea id="offline-reason" value={offlineReason} onChange={event => setOfflineReason(event.target.value)} placeholder="Record how this offline payment was verified." maxLength={500} className="min-h-[90px] text-sm" />
              <p className="text-xs text-muted-foreground">{offlineReason.trim().length}/10 minimum characters · {offlineReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfflineDialogOpen(false)} disabled={offlinePaymentMutation.isPending}>Cancel</Button>
            <Button
              onClick={() => offlinePaymentMutation.mutate()}
              disabled={offlinePaymentMutation.isPending || !offlineReceivedAt || !Number.isInteger(Number(offlineAmount)) || Number(offlineAmount) <= 0 || !offlineExternalReference.trim() || !offlineEvidenceReference.trim() || offlineReason.trim().length < 10}
            >
              {offlinePaymentMutation.isPending ? "Saving…" : offlineMode === "activation" ? "Verify and activate" : "Verify renewal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(offlineReversalTarget)} onOpenChange={open => { if (!open && !offlineReversalMutation.isPending) { setOfflineReversalTarget(null); setOfflineReversalReason(""); } }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" />Reverse offline payment</DialogTitle>
            <DialogDescription>
              Reverse {offlineReversalTarget?.label || "this payment"} without deleting the original payment evidence. If it is the current paid period, access will move to an expired attention state.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="offline-reversal-reason" className="text-sm font-semibold">Reversal reason <span className="text-destructive">*</span></label>
            <Textarea id="offline-reversal-reason" value={offlineReversalReason} onChange={event => setOfflineReversalReason(event.target.value)} placeholder="Record why the payment is being reversed." maxLength={500} className="min-h-[100px] text-sm" />
            <p className="text-xs text-muted-foreground">{offlineReversalReason.trim().length}/10 minimum characters · {offlineReversalReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfflineReversalTarget(null)} disabled={offlineReversalMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => offlineReversalMutation.mutate()} disabled={offlineReversalMutation.isPending || offlineReversalReason.trim().length < 10}>
              {offlineReversalMutation.isPending ? "Reversing…" : "Reverse payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {accessAction === "sponsored" ? <Gift className="h-5 w-5 text-primary" /> : <SlidersHorizontal className="h-5 w-5 text-primary" />}
              {accessAction === "sponsored" ? "Grant sponsored access" : "Grant entitlement exception"}
            </DialogTitle>
            <DialogDescription>
              {extensionTarget
                ? "This creates a new complimentary decision starting when the existing grant ends. No payment is recorded and it will not renew automatically."
                : "This creates a finite complimentary grant. No payment is recorded and it will not renew automatically."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {accessAction === "sponsored" ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="sponsored-plan" className="text-sm font-semibold">Effective plan</label>
                  <select id="sponsored-plan" value={accessPlan} onChange={event => setAccessPlan(event.target.value as typeof accessPlan)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="sponsored-cycle" className="text-sm font-semibold">Reference cycle</label>
                  <select id="sponsored-cycle" value={accessBillingCycle} onChange={event => setAccessBillingCycle(event.target.value as typeof accessBillingCycle)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="exception-key" className="text-sm font-semibold">Entitlement</label>
                  <select id="exception-key" value={accessEntitlement} onChange={event => setAccessEntitlement(event.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    {["bookings", "active_doctors", "smile_deals", "storage", "messaging_sms", "messaging_whatsapp", "messaging_email", "analytics", "export"].map(key => <option key={key} value={key}>{labelFor(key)}</option>)}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="exception-value" className="text-sm font-semibold">Override value</label>
                  <Input id="exception-value" value={accessOverrideValue} onChange={event => setAccessOverrideValue(event.target.value)} placeholder="true, false, or a number" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <label htmlFor="access-start" className="text-sm font-semibold">Starts</label>
              <Input id="access-start" type="datetime-local" value={accessStartsAt} onChange={event => setAccessStartsAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="access-end" className="text-sm font-semibold">Ends <span className="text-destructive">*</span></label>
              <Input id="access-end" type="datetime-local" value={accessEndsAt} onChange={event => setAccessEndsAt(event.target.value)} />
            </div>
            {accessAction === "sponsored" && (
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="sponsor-reference" className="text-sm font-semibold">Sponsor reference <span className="text-muted-foreground">(optional)</span></label>
                <Input id="sponsor-reference" value={accessSponsorReference} onChange={event => setAccessSponsorReference(event.target.value)} placeholder="Partner, program, or internal reference" maxLength={160} />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="access-reason" className="text-sm font-semibold">Reason <span className="text-destructive">*</span></label>
              <Textarea id="access-reason" value={accessReason} onChange={event => setAccessReason(event.target.value)} placeholder="Record why this temporary access is being granted." maxLength={500} className="min-h-[100px] text-sm" />
              <p className="text-xs text-muted-foreground">{accessReason.trim().length}/10 minimum characters · {accessReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialogOpen(false)} disabled={accessMutation.isPending}>Cancel</Button>
            <Button onClick={() => accessMutation.mutate()} disabled={accessMutation.isPending || accessReason.trim().length < 10 || !accessEndsAt || (extensionTarget !== null && !accessStartsAt)}>
              {accessMutation.isPending ? "Saving…" : accessAction === "sponsored" ? extensionTarget ? "Extend sponsored access" : "Grant sponsored access" : "Grant exception"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeTarget)} onOpenChange={open => { if (!open && !revokeMutation.isPending) { setRevokeTarget(null); setRevokeReason(""); } }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" />Revoke temporary access</DialogTitle>
            <DialogDescription>
              Revoke {revokeTarget?.label || "this access record"} for {selectedClinic?.name || "this clinic"}. The paid subscription and clinic data will not be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="revoke-reason" className="text-sm font-semibold">Reason <span className="text-destructive">*</span></label>
            <Textarea
              id="revoke-reason"
              value={revokeReason}
              onChange={event => setRevokeReason(event.target.value)}
              placeholder="Record why this temporary access is being revoked."
              maxLength={500}
              className="min-h-[100px] text-sm"
            />
            <p className="text-xs text-muted-foreground">{revokeReason.trim().length}/10 minimum characters · {revokeReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevokeTarget(null); setRevokeReason(""); }} disabled={revokeMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => revokeMutation.mutate()} disabled={revokeMutation.isPending || revokeReason.trim().length < 10}>
              {revokeMutation.isPending ? "Revoking…" : "Revoke access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}