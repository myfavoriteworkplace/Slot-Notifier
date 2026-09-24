import { desc, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  subscriptionAccessExceptions,
  subscriptionAccessGrants,
  subscriptionApprovalDecisions,
  type Clinic,
  type SubscriptionAccessException,
  type SubscriptionAccessGrant,
  type SubscriptionApprovalDecision,
} from "@shared/schema";
import {
  resolveEffectiveEntitlements,
  type EffectiveEntitlementReport,
} from "@shared/effective-entitlement";
import type {
  AdminClinicAccessSummary,
  AdminClinicDirectoryRecord,
  AdminClinicLatestApproval,
  AdminClinicNextAction,
  AdminClinicNextImportantDateType,
  AdminClinicPaymentStatus,
} from "@shared/admin-clinic-directory";

function paymentStatusForOutcome(outcome: string | null): AdminClinicPaymentStatus {
  switch (outcome) {
    case "trial":
      return "not_required";
    case "online_payment_required":
      return "pending";
    case "verified_offline_payment":
      return "verified_offline";
    case "complimentary":
      return "waived";
    case "reject":
      return "rejected";
    default:
      return "unknown";
  }
}

function currentAccessPlan(report: EffectiveEntitlementReport): string | null {
  return report.plan.effective === "unknown" ? null : report.plan.effective;
}

function nextImportantDate(
  report: EffectiveEntitlementReport,
): { date: string | null; type: AdminClinicNextImportantDateType | null } {
  if (report.access.state === "trial" && report.access.trialEndsAt) {
    return { date: report.access.trialEndsAt, type: "trial_ends" };
  }
  if (report.access.state === "trial_grace" && report.access.trialGraceEndsAt) {
    return { date: report.access.trialGraceEndsAt, type: "trial_grace_ends" };
  }
  if (report.access.state === "sponsored" && report.grants.endsAt) {
    return { date: report.grants.endsAt, type: "sponsored_access_ends" };
  }
  if (report.access.state === "active_paid" && report.access.paidAccessExpiresAt) {
    return { date: report.access.paidAccessExpiresAt, type: "paid_access_expires" };
  }
  return { date: null, type: null };
}

function nextAction(
  report: EffectiveEntitlementReport,
  latestApproval: SubscriptionApprovalDecision | null,
): AdminClinicNextAction {
  if (latestApproval?.approvalOutcome === "online_payment_required") {
    return {
      code: "WAIT_FOR_PAYMENT",
      label: "Complete activation payment",
      description: "The assigned paid plan remains pending until the provider confirms payment.",
      action: "review",
    };
  }

  return {
    code: report.nextStep.code,
    label: report.nextStep.label,
    description: report.nextStep.description,
    action:
      report.nextStep.action === "contact_support"
        ? "contact_support"
        : report.nextStep.action === "view_plans"
          ? "review"
          : "none",
  };
}

function latestApprovalSummary(
  decision: SubscriptionApprovalDecision | null,
): AdminClinicLatestApproval | null {
  if (!decision) return null;
  return {
    id: decision.id,
    outcome: decision.approvalOutcome,
    requestedPlan: decision.requestedPlan,
    approvedPlan: decision.approvedPlan,
    paymentBasis: decision.paymentBasis,
    renewalMode: decision.renewalMode,
    effectiveAt: decision.effectiveAt.toISOString(),
    createdAt: decision.createdAt.toISOString(),
    actorType: decision.actorType,
    actorId: decision.actorId,
    reason: decision.reason,
    transitionId: decision.transitionId,
  };
}

function buildAccessSummary(
  report: EffectiveEntitlementReport,
  latestApproval: SubscriptionApprovalDecision | null,
): AdminClinicAccessSummary {
  const importantDate = nextImportantDate(report);
  const attentionCode =
    report.access.state === "attention" || report.access.state === "unknown"
      ? report.access.reasonCode
      : latestApproval?.approvalOutcome === "online_payment_required"
        ? "PAYMENT_PENDING"
        : null;

  return {
    currentAccessState: report.access.state,
    currentAccessPlan: currentAccessPlan(report),
    assignedPlan: latestApproval?.approvedPlan ?? null,
    latestApprovalOutcome: latestApproval?.approvalOutcome ?? null,
    paymentBasis: latestApproval?.paymentBasis ?? null,
    paymentStatus: paymentStatusForOutcome(latestApproval?.approvalOutcome ?? null),
    renewalMode: latestApproval?.renewalMode ?? null,
    nextImportantDate: importantDate.date,
    nextImportantDateType: importantDate.type,
    attentionCode,
    nextAction: nextAction(report, latestApproval),
    latestApproval: latestApprovalSummary(latestApproval),
  };
}

function groupByClinic<T extends { clinicId: number }>(rows: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const current = grouped.get(row.clinicId) ?? [];
    current.push(row);
    grouped.set(row.clinicId, current);
  }
  return grouped;
}

export async function getAdminClinicDirectoryRecords(
  clinics: Clinic[],
  now = new Date(),
): Promise<AdminClinicDirectoryRecord[]> {
  if (clinics.length === 0) return [];

  const clinicIds = clinics.map(clinic => clinic.id);
  const [grantRows, exceptionRows, approvalRows] = await Promise.all([
    db.select().from(subscriptionAccessGrants).where(inArray(subscriptionAccessGrants.clinicId, clinicIds)),
    db.select().from(subscriptionAccessExceptions).where(inArray(subscriptionAccessExceptions.clinicId, clinicIds)),
    db.select()
      .from(subscriptionApprovalDecisions)
      .where(inArray(subscriptionApprovalDecisions.clinicId, clinicIds))
      .orderBy(desc(subscriptionApprovalDecisions.effectiveAt), desc(subscriptionApprovalDecisions.id)),
  ]);

  const grantsByClinic = groupByClinic(grantRows);
  const exceptionsByClinic = groupByClinic(exceptionRows);
  const latestApprovalByClinic = new Map<number, SubscriptionApprovalDecision>();
  for (const decision of approvalRows) {
    if (!latestApprovalByClinic.has(decision.clinicId)) {
      latestApprovalByClinic.set(decision.clinicId, decision);
    }
  }

  return clinics.map(clinic => {
    const report = resolveEffectiveEntitlements({
      clinicId: clinic.id,
      rawPlan: clinic.plan,
      rawSubscriptionStatus: clinic.subscriptionStatus,
      timezone: clinic.timezone,
      trialStartedAt: clinic.trialStartedAt,
      trialEndsAt: clinic.trialEndsAt,
      trialGraceEndsAt: clinic.trialGraceEndsAt,
      trialOrigin: clinic.trialOrigin,
      previousPaidPlan: clinic.previousPaidPlan,
      paidAccessExpiresAt: clinic.paidAccessExpiresAt,
      activeGrants: grantsByClinic.get(clinic.id) as SubscriptionAccessGrant[] | undefined,
      activeExceptions: exceptionsByClinic.get(clinic.id) as SubscriptionAccessException[] | undefined,
      now,
    });
    const latestApproval = latestApprovalByClinic.get(clinic.id) ?? null;
    const access = buildAccessSummary(report, latestApproval);

    return {
      ...clinic,
      ...access,
      effectiveAccessState: access.currentAccessState,
      hasSponsoredAccess: report.grants.active > 0,
      hasActiveException: report.exceptions.active > 0,
      attentionReasons: access.attentionCode
        ? [{ code: "subscription", severity: access.currentAccessState === "unknown" ? "critical" : "warning", label: access.attentionCode }]
        : [],
    };
  });
}