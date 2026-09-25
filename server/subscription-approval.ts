import crypto from "crypto";
import { addMonths } from "date-fns";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  activationTokens,
  clinicUpgradeRequests,
  clinics,
  subscriptionAccessGrants,
  subscriptionApprovalDecisions,
  subscriptionLifecycleEvents,
  subscriptionOfflinePayments,
  subscriptionPlanAssignments,
  subscriptionProviderEvents,
  type Clinic,
  type SubscriptionAccessGrant,
  type SubscriptionApprovalDecision,
  type SubscriptionLifecycleEvent,
  type SubscriptionOfflinePayment,
  type SubscriptionPlanAssignment,
} from "@shared/schema";
import {
  subscriptionApprovalInputSchema,
  type SubscriptionApprovalInput,
} from "@shared/subscription-approval";
import {
  PAID_PLAN_KEYS,
  PUBLISHED_PLAN_POLICY,
} from "@shared/plan-catalog";
import {
  buildRecoveryTrialTransition,
  buildTrialWindow,
} from "@shared/subscription-lifecycle";
import { getAccessRevocationEventType, isAccessRevocable } from "@shared/subscription-access-revocation";

export type ApprovalAccessState =
  | "trial"
  | "trial_grace"
  | "active_paid"
  | "pending_payment"
  | "sponsored"
  | "attention"
  | "unknown"
  | "rejected";

export type OnlinePaymentIntent = {
  provider: string;
  providerSubscriptionId?: string | null;
  shortUrl?: string | null;
  linkExpiresAt?: Date | null;
  linkStatus?: string | null;
  paymentLinkMetadata?: Record<string, unknown>;
};

export type CreateOnlinePaymentIntent = (input: {
  clinic: Clinic;
  approval: SubscriptionApprovalInput;
  activationToken: string;
  linkExpiresAt: Date;
}) => Promise<OnlinePaymentIntent>;

export type ApplySubscriptionApprovalOptions = {
  now?: Date;
  createOnlinePaymentIntent?: CreateOnlinePaymentIntent;
};

export class SubscriptionApprovalError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "SubscriptionApprovalError";
    this.statusCode = statusCode;
  }
}

export type SubscriptionApprovalResult = {
  decision: SubscriptionApprovalDecision;
  clinic: Clinic;
  assignment: SubscriptionPlanAssignment | null;
  lifecycleEvent: SubscriptionLifecycleEvent | null;
  offlinePayment: SubscriptionOfflinePayment | null;
  accessGrant: SubscriptionAccessGrant | null;
  activationToken: typeof activationTokens.$inferSelect | null;
  idempotent: boolean;
  requestedPlan: string | null;
  assignedPlan: string | null;
  currentAccessPlan: string | null;
  accessState: ApprovalAccessState;
  paymentStatus: "not_required" | "pending" | "verified_offline" | "complimentary" | "rejected";
  paymentBasis: SubscriptionApprovalInput["paymentBasis"];
  renewalMode: SubscriptionApprovalInput["renewalMode"];
  nextAction:
    | "continue_trial"
    | "complete_activation_payment"
    | "active_paid_access"
    | "review_complimentary_access"
    | "review_rejection";
};

export type ProviderSubscriptionEventInput = {
  providerEventRecordId: number;
  clinicId: number;
  provider: string;
  providerSubscriptionId: string;
  providerEventId: string | null;
  providerEventType: string;
  providerCurrentEnd: Date | null;
  now?: Date;
};

export type ProviderSubscriptionEventResult = {
  status: "applied" | "ignored" | "missing" | "duplicate";
  transitionId: string | null;
  clinic: Clinic | null;
};

export type OfflinePaymentReversalResult = {
  status: "reversed" | "already_reversed" | "not_found";
  payment: SubscriptionOfflinePayment | null;
  clinic: Clinic | null;
  lifecycleEvent: SubscriptionLifecycleEvent | null;
  accessChanged: boolean;
};

export type SponsoredAccessMutationResult = {
  status: "revoked" | "already_revoked" | "ended" | "not_found";
  grant: SubscriptionAccessGrant | null;
  clinic: Clinic | null;
  lifecycleEvent: SubscriptionLifecycleEvent | null;
};

function normalizeStatus(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function buildInputFingerprint(input: SubscriptionApprovalInput): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export function resolveApprovalAccessState(
  clinic: Pick<Clinic, "plan" | "subscriptionStatus" | "trialEndsAt" | "trialGraceEndsAt">,
  now: Date,
): ApprovalAccessState {
  const status = normalizeStatus(clinic.subscriptionStatus);
  const trialEndsAt = clinic.trialEndsAt ? new Date(clinic.trialEndsAt) : null;
  const trialGraceEndsAt = clinic.trialGraceEndsAt ? new Date(clinic.trialGraceEndsAt) : null;
  const isTrialPlan = clinic.plan === "trial";

  if (isTrialPlan && trialEndsAt && trialEndsAt > now) return "trial";
  if (isTrialPlan && trialGraceEndsAt && trialGraceEndsAt > now) return "trial_grace";
  if (status === "active" || status === "manual_override") {
    return PAID_PLAN_KEYS.includes(clinic.plan as typeof PAID_PLAN_KEYS[number])
      ? "active_paid"
      : "attention";
  }
  if (status === "pending_payment") return "pending_payment";
  if (status === "rejected") return "rejected";
  if (["expired", "cancelled", "provider_error", "past_due"].includes(status)) return "attention";
  if (status === "trialing" && isTrialPlan) return "trial";
  return "unknown";
}

function paymentStatusForOutcome(
  outcome: SubscriptionApprovalInput["outcome"],
): SubscriptionApprovalResult["paymentStatus"] {
  switch (outcome) {
    case "trial":
      return "not_required";
    case "online_payment_required":
      return "pending";
    case "verified_offline_payment":
      return "verified_offline";
    case "complimentary":
      return "complimentary";
    case "reject":
      return "rejected";
  }
}

function nextActionForOutcome(
  outcome: SubscriptionApprovalInput["outcome"],
): SubscriptionApprovalResult["nextAction"] {
  switch (outcome) {
    case "trial":
      return "continue_trial";
    case "online_payment_required":
      return "complete_activation_payment";
    case "verified_offline_payment":
      return "active_paid_access";
    case "complimentary":
      return "review_complimentary_access";
    case "reject":
      return "review_rejection";
  }
}

function lifecycleEventType(
  input: SubscriptionApprovalInput,
  current: Clinic,
): string {
  if (input.outcome === "trial") {
    return current.plan === "trial" ? "trial_started" : "converted";
  }
  if (input.outcome === "online_payment_required") {
    return current.plan === "trial" ? "converted" : "plan_assigned";
  }
  if (input.outcome === "verified_offline_payment") return "manual_payment_recorded";
  if (input.outcome === "complimentary") return "sponsored_access_granted";
  return "approval_rejected";
}

function approvalDecisionIdFromSourceRequest(sourceRequestId: string | null): number | null {
  if (!sourceRequestId || !/^\d+$/.test(sourceRequestId)) return null;
  const id = Number(sourceRequestId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function getExistingDecision(
  clinicId: number,
  transitionId: string,
): Promise<SubscriptionApprovalDecision | null> {
  const [decision] = await db.select()
    .from(subscriptionApprovalDecisions)
    .where(and(
      eq(subscriptionApprovalDecisions.clinicId, clinicId),
      eq(subscriptionApprovalDecisions.transitionId, transitionId),
    ))
    .limit(1);
  return decision ?? null;
}

async function hydrateResult(
  decision: SubscriptionApprovalDecision,
  idempotent: boolean,
): Promise<SubscriptionApprovalResult> {
  const [clinic, assignment, lifecycleEvent, offlinePayment, accessGrant, activationToken] = await Promise.all([
    db.select().from(clinics).where(eq(clinics.id, decision.clinicId)).limit(1).then(([row]) => row),
    db.select()
      .from(subscriptionPlanAssignments)
      .where(eq(subscriptionPlanAssignments.approvalDecisionId, decision.id))
      .orderBy(desc(subscriptionPlanAssignments.id))
      .limit(1)
      .then(([row]) => row ?? null),
    db.select()
      .from(subscriptionLifecycleEvents)
      .where(eq(subscriptionLifecycleEvents.approvalDecisionId, decision.id))
      .orderBy(desc(subscriptionLifecycleEvents.id))
      .limit(1)
      .then(([row]) => row ?? null),
    db.select()
      .from(subscriptionOfflinePayments)
      .where(eq(subscriptionOfflinePayments.approvalDecisionId, decision.id))
      .limit(1)
      .then(([row]) => row ?? null),
    db.select()
      .from(subscriptionAccessGrants)
      .where(eq(subscriptionAccessGrants.approvalDecisionId, decision.id))
      .limit(1)
      .then(([row]) => row ?? null),
    db.select()
      .from(activationTokens)
      .where(eq(activationTokens.approvalDecisionId, decision.id))
      .limit(1)
      .then(([row]) => row ?? null),
  ]);

  if (!clinic) {
    throw new SubscriptionApprovalError("Clinic not found for approval decision", 404);
  }

  return {
    decision,
    clinic,
    assignment: assignment ?? null,
    lifecycleEvent: lifecycleEvent ?? null,
    offlinePayment: offlinePayment ?? null,
    accessGrant: accessGrant ?? null,
    activationToken: activationToken ?? null,
    idempotent,
    requestedPlan: decision.requestedPlan,
    assignedPlan: decision.approvedPlan,
    currentAccessPlan: decision.approvalOutcome === "complimentary"
      ? accessGrant?.plan ?? clinic.plan
      : clinic.plan,
    accessState: (decision.toAccessState as ApprovalAccessState) || resolveApprovalAccessState(clinic, new Date()),
    paymentStatus: paymentStatusForOutcome(decision.approvalOutcome as SubscriptionApprovalInput["outcome"]),
    paymentBasis: decision.paymentBasis as SubscriptionApprovalInput["paymentBasis"],
    renewalMode: decision.renewalMode as SubscriptionApprovalInput["renewalMode"],
    nextAction: nextActionForOutcome(decision.approvalOutcome as SubscriptionApprovalInput["outcome"]),
  };
}

async function recordUnlinkedProviderIntent(
  input: SubscriptionApprovalInput,
  intent: OnlinePaymentIntent,
  activationToken: string,
  error: unknown,
): Promise<void> {
  try {
    await db.insert(subscriptionProviderEvents).values({
      clinicId: input.clinicId,
      provider: intent.provider,
      subscriptionId: intent.providerSubscriptionId || null,
      eventType: "approval_provider_intent_created",
      processingStatus: "unlinked",
      details: {
        transitionId: input.transitionId,
        activationToken,
        providerLinkStatus: intent.linkStatus || null,
        providerLinkMetadata: intent.paymentLinkMetadata || {},
        error: error instanceof Error ? error.message : String(error),
      },
      occurredAt: input.effectiveAt,
    });
  } catch (recordError) {
    console.error("[SUBSCRIPTION APPROVAL] Failed to record unlinked provider intent", {
      transitionId: input.transitionId,
      error: recordError instanceof Error ? recordError.message : String(recordError),
    });
  }
}

export async function applySubscriptionApproval(
  rawInput: unknown,
  options: ApplySubscriptionApprovalOptions = {},
): Promise<SubscriptionApprovalResult> {
  const parsed = subscriptionApprovalInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new SubscriptionApprovalError(
      parsed.error.issues[0]?.message || "Invalid subscription approval",
      400,
    );
  }

  const input = parsed.data;
  const now = options.now ?? new Date();
  if (input.offlinePayment) {
    if (input.offlinePayment.receivedAt > now) {
      throw new SubscriptionApprovalError("Offline payment receipt cannot be in the future", 400);
    }
    if (input.offlinePayment.verifiedAt > now) {
      throw new SubscriptionApprovalError("Offline payment verification cannot be in the future", 400);
    }
  }
  const inputFingerprint = buildInputFingerprint(input);
  const existing = await getExistingDecision(input.clinicId, input.transitionId);
  if (existing) {
    if (existing.inputFingerprint && existing.inputFingerprint !== inputFingerprint) {
      throw new SubscriptionApprovalError(
        "This transition ID was already used with different approval input",
        409,
      );
    }
    return hydrateResult(existing, true);
  }

  const [initialClinic] = await db.select()
    .from(clinics)
    .where(eq(clinics.id, input.clinicId))
    .limit(1);
  if (!initialClinic) throw new SubscriptionApprovalError("Clinic not found", 404);
  if (input.approvalContext === "registration" && initialClinic.status !== "pending") {
    throw new SubscriptionApprovalError("Only pending clinics can be approved", 409);
  }

  const initialAccessState = resolveApprovalAccessState(initialClinic, now);
  if (input.outcome === "trial" && initialAccessState === "active_paid") {
    throw new SubscriptionApprovalError("An active paid clinic cannot be replaced by a Trial", 409);
  }

  let providerIntent: OnlinePaymentIntent | null = null;
  const activationToken = input.outcome === "online_payment_required" ? crypto.randomUUID() : null;
  const linkExpiresAt = new Date(input.effectiveAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (input.outcome === "online_payment_required") {
    if (!options.createOnlinePaymentIntent) {
      throw new SubscriptionApprovalError("An online payment provider is required for this approval", 503);
    }
    try {
      providerIntent = await options.createOnlinePaymentIntent({
        clinic: initialClinic,
        approval: input,
        activationToken: activationToken!,
        linkExpiresAt,
      });
    } catch (error) {
      throw new SubscriptionApprovalError(
        "The payment provider could not prepare this subscription. The clinic was not changed.",
        502,
      );
    }
  }

  try {
    const transactionResult = await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT id FROM clinics WHERE id = ${input.clinicId} FOR UPDATE`);

      const upgradeRequestId = input.approvalContext === "upgrade_request"
        ? approvalDecisionIdFromSourceRequest(input.sourceRequestId)
        : null;
      if (input.approvalContext === "upgrade_request" && !upgradeRequestId) {
        throw new SubscriptionApprovalError("An upgrade-request approval must reference its source request", 400);
      }
      if (upgradeRequestId) {
        await tx.execute(sql`SELECT id FROM clinic_upgrade_requests WHERE id = ${upgradeRequestId} FOR UPDATE`);
      }

      const [raceDecision] = await tx.select()
        .from(subscriptionApprovalDecisions)
        .where(and(
          eq(subscriptionApprovalDecisions.clinicId, input.clinicId),
          eq(subscriptionApprovalDecisions.transitionId, input.transitionId),
        ))
        .limit(1);
      if (raceDecision) {
        if (raceDecision.inputFingerprint && raceDecision.inputFingerprint !== inputFingerprint) {
          throw new SubscriptionApprovalError(
            "This transition ID was already used with different approval input",
            409,
          );
        }
        return { kind: "idempotent" as const, decisionId: raceDecision.id };
      }

      if (upgradeRequestId) {
        const [sourceRequest] = await tx.select()
          .from(clinicUpgradeRequests)
          .where(eq(clinicUpgradeRequests.id, upgradeRequestId))
          .limit(1);
        if (!sourceRequest || sourceRequest.clinicId !== input.clinicId) {
          throw new SubscriptionApprovalError("Upgrade request not found for this clinic", 404);
        }
        if (sourceRequest.status !== "pending" || sourceRequest.approvalDecisionId !== null) {
          throw new SubscriptionApprovalError("Only pending upgrade requests without a prior approval decision can be reviewed", 409);
        }
      }

      const [current] = await tx.select()
        .from(clinics)
        .where(eq(clinics.id, input.clinicId))
        .limit(1);
      if (!current) throw new SubscriptionApprovalError("Clinic not found", 404);
      if (input.approvalContext === "registration" && current.status !== "pending") {
        throw new SubscriptionApprovalError("Only pending clinics can be approved", 409);
      }

      const currentAccessState = resolveApprovalAccessState(current, now);
      if (input.outcome === "trial" && currentAccessState === "active_paid") {
        throw new SubscriptionApprovalError("An active paid clinic cannot be replaced by a Trial", 409);
      }

      const trialWindow = input.trialSchedule
        ? {
            startedAt: input.trialSchedule.startedAt,
            endsAt: input.trialSchedule.endsAt,
            graceEndsAt: input.trialSchedule.graceEndsAt,
          }
        : buildTrialWindow(input.effectiveAt);
      const hasTrialHistory = Boolean(current.trialStartedAt);
      if (input.outcome === "trial" && hasTrialHistory && current.status !== "pending") {
        throw new SubscriptionApprovalError(
          "This clinic already has Trial history. Use the dedicated Trial extension workflow.",
          409,
        );
      }

      if (input.outcome === "complimentary" && input.complimentaryAccess) {
        const startsAt = input.complimentaryAccess.startsAt;
        const endsAt = input.complimentaryAccess.endsAt;
        const existingGrants = await tx.select()
          .from(subscriptionAccessGrants)
          .where(eq(subscriptionAccessGrants.clinicId, input.clinicId));
        const overlapsExistingGrant = existingGrants.some((grant: SubscriptionAccessGrant) =>
          !grant.revokedAt &&
          new Date(grant.startsAt) < endsAt &&
          new Date(grant.endsAt) > startsAt,
        );
        if (overlapsExistingGrant) {
          throw new SubscriptionApprovalError(
            "This clinic already has sponsored access during the requested period. End or extend the existing grant instead.",
            409,
          );
        }

        const currentStatus = normalizeStatus(current.subscriptionStatus);
        const currentPlanIsPaid = PAID_PLAN_KEYS.includes(current.plan as typeof PAID_PLAN_KEYS[number]);
        const currentPaidEndsAt = current.paidAccessExpiresAt ? new Date(current.paidAccessExpiresAt) : null;
        const overlapsActivePaidAccess =
          currentPlanIsPaid &&
          ["active", "past_due", "manual_override"].includes(currentStatus) &&
          (!currentPaidEndsAt || currentPaidEndsAt > startsAt);
        if (overlapsActivePaidAccess) {
          throw new SubscriptionApprovalError(
            "Sponsored access cannot overlap the clinic's active paid subscription.",
            409,
          );
        }
      }

      const startsPaidAccess = input.outcome === "verified_offline_payment";
      const isPendingRegistration = current.status === "pending";
      const approvedPlan = input.approvedPlan;
      const approvedBillingCycle = input.approvedBillingCycle;
      const paidAccessExpiresAt = startsPaidAccess && approvedBillingCycle
        ? addMonths(input.effectiveAt, approvedBillingCycle === "annual" ? 12 : 1)
        : null;
      const paymentPendingKeepsCurrentAccess =
        input.outcome === "online_payment_required" &&
        (currentAccessState === "trial" || currentAccessState === "trial_grace" || currentAccessState === "active_paid");

      const decisionToAccessState: ApprovalAccessState =
        input.outcome === "trial" ? "trial" :
        input.outcome === "online_payment_required"
          ? (paymentPendingKeepsCurrentAccess ? currentAccessState : "pending_payment") :
        input.outcome === "verified_offline_payment" ? "active_paid" :
        input.outcome === "complimentary" ? "sponsored" :
        "rejected";

      const clinicUpdate: Partial<typeof clinics.$inferInsert> = {
        status: isPendingRegistration
          ? (input.outcome === "reject" ? "rejected" : "approved")
          : current.status,
        subscriptionPolicyVersion: PUBLISHED_PLAN_POLICY.version,
      };

      if (input.outcome === "trial") {
        Object.assign(clinicUpdate, {
          plan: "trial",
          billingCycle: "monthly",
          subscriptionStatus: "trialing",
          trialStartedAt: trialWindow.startedAt,
          trialEndsAt: trialWindow.endsAt,
          trialGraceEndsAt: trialWindow.graceEndsAt,
          trialOrigin: input.approvalContext === "registration"
            ? "initial_signup"
            : current.trialOrigin || "admin_granted",
          paidAccessExpiresAt: null,
          razorpaySubscriptionId: null,
        });
      } else if (input.outcome === "online_payment_required") {
        Object.assign(clinicUpdate, {
          razorpaySubscriptionId: providerIntent?.providerSubscriptionId || current.razorpaySubscriptionId,
        });
        if (!paymentPendingKeepsCurrentAccess) {
          Object.assign(clinicUpdate, {
            plan: "trial",
            billingCycle: "monthly",
            subscriptionStatus: "trialing",
            trialStartedAt: current.trialStartedAt || trialWindow.startedAt,
            trialEndsAt: current.trialEndsAt || trialWindow.endsAt,
            trialGraceEndsAt: current.trialGraceEndsAt || trialWindow.graceEndsAt,
            trialOrigin: input.approvalContext === "registration"
              ? "initial_signup"
              : current.trialOrigin || "admin_granted",
          });
        }
      } else if (input.outcome === "verified_offline_payment") {
        Object.assign(clinicUpdate, {
          plan: approvedPlan,
          billingCycle: approvedBillingCycle,
          subscriptionStatus: "active",
          paidAccessExpiresAt,
          trialStartedAt: null,
          trialEndsAt: null,
          trialGraceEndsAt: null,
          trialOrigin: null,
          previousPaidPlan: current.plan === "trial" ? current.previousPaidPlan : current.plan,
          razorpaySubscriptionId: null,
        });
      }

      const [decision] = await tx.insert(subscriptionApprovalDecisions).values({
        clinicId: input.clinicId,
        approvalContext: input.approvalContext,
        approvalOutcome: input.outcome,
        requestedPlan: input.requestedPlan,
        approvedPlan: input.approvedPlan,
        requestedBillingCycle: input.requestedBillingCycle,
        approvedBillingCycle: input.approvedBillingCycle,
        paymentBasis: input.paymentBasis,
        renewalMode: input.renewalMode,
        policyVersion: PUBLISHED_PLAN_POLICY.version,
        fromAccessState: currentAccessState,
        toAccessState: decisionToAccessState,
        reason: input.reason,
        actorType: input.actor.type,
        actorId: input.actor.id,
        sourceRequestId: input.sourceRequestId,
        transitionId: input.transitionId,
        inputFingerprint,
        effectiveAt: input.effectiveAt,
      }).returning();

      let offlinePayment: SubscriptionOfflinePayment | null = null;
      if (input.outcome === "verified_offline_payment" && input.offlinePayment) {
        if (!Number.isSafeInteger(input.offlinePayment.amount)) {
          throw new SubscriptionApprovalError("Offline payment amount must be a whole currency unit", 400);
        }
        [offlinePayment] = await tx.insert(subscriptionOfflinePayments).values({
          clinicId: input.clinicId,
          approvalDecisionId: decision.id,
          plan: approvedPlan!,
          billingCycle: approvedBillingCycle!,
          amount: input.offlinePayment.amount,
          currency: input.offlinePayment.currency,
          receivedAt: input.offlinePayment.receivedAt,
          paymentMethod: input.offlinePayment.paymentMethod,
          externalReference: input.offlinePayment.externalReference,
          evidenceReference: input.offlinePayment.evidenceReference,
          verificationStatus: "verified",
          verifiedBy: input.offlinePayment.verifiedBy,
          verifiedAt: input.offlinePayment.verifiedAt,
          reason: input.reason || "Verified offline subscription payment",
          reversalStatus: "not_reversed",
        }).returning();
      }

      if (input.outcome === "online_payment_required" && providerIntent && activationToken) {
        await tx.insert(activationTokens).values({
          token: activationToken,
          clinicId: input.clinicId,
          approvalDecisionId: decision.id,
          plan: approvedPlan!,
          billingCycle: approvedBillingCycle!,
          razorpaySubscriptionId: providerIntent.providerSubscriptionId || null,
          shortUrl: providerIntent.shortUrl || null,
          expiresAt: providerIntent.linkExpiresAt || linkExpiresAt,
          used: false,
        });
      }

      let accessGrant: SubscriptionAccessGrant | null = null;
      if (input.outcome === "complimentary" && input.complimentaryAccess) {
        const policy = approvedPlan ? PUBLISHED_PLAN_POLICY.plans[approvedPlan] : null;
        [accessGrant] = await tx.insert(subscriptionAccessGrants).values({
          clinicId: input.clinicId,
          approvalDecisionId: decision.id,
          grantId: `approval-grant:${input.transitionId}`,
          plan: approvedPlan!,
          policyVersion: PUBLISHED_PLAN_POLICY.version,
          listPriceMinor: policy?.pricing.monthly ?? null,
          currency: "INR",
          reason: input.reason!,
          sponsorReference: input.complimentaryAccess.sponsorReference,
          grantedByType: input.actor.type,
          grantedById: input.actor.id,
          startsAt: input.complimentaryAccess.startsAt,
          endsAt: input.complimentaryAccess.endsAt,
        }).returning();
      }

      const [updatedClinic] = await tx.update(clinics)
        .set(clinicUpdate)
        .where(eq(clinics.id, input.clinicId))
        .returning();
      if (!updatedClinic) throw new SubscriptionApprovalError("Clinic could not be updated", 409);

      let assignment: SubscriptionPlanAssignment | null = null;
      if (approvedPlan) {
        const assignmentEndsAt =
          input.outcome === "verified_offline_payment" ? paidAccessExpiresAt :
          input.outcome === "complimentary" ? input.complimentaryAccess?.endsAt ?? null :
          input.outcome === "trial" ? trialWindow.graceEndsAt : null;
        [assignment] = await tx.insert(subscriptionPlanAssignments).values({
          clinicId: input.clinicId,
          approvalDecisionId: decision.id,
          plan: approvedPlan,
          billingCycle: approvedBillingCycle || "monthly",
          source:
            input.outcome === "trial" ? "approval_trial" :
            input.outcome === "online_payment_required" ? "approval_online_payment" :
            input.outcome === "verified_offline_payment" ? "approval_offline_payment" :
            "approval_complimentary",
          policyVersion: PUBLISHED_PLAN_POLICY.version,
          transitionId: input.transitionId,
          assignedByType: input.actor.type,
          assignedById: input.actor.id,
          reason: input.reason,
          startsAt: input.effectiveAt,
          endsAt: assignmentEndsAt,
        }).returning();
      }

      const eventMetadata: Record<string, unknown> = {
        approvalOutcome: input.outcome,
        paymentBasis: input.paymentBasis,
        renewalMode: input.renewalMode,
        assignmentId: assignment?.id ?? null,
        offlinePaymentId: offlinePayment?.id ?? null,
        grantId: accessGrant?.grantId ?? null,
        provider: providerIntent?.provider ?? null,
        providerSubscriptionId: providerIntent?.providerSubscriptionId ?? null,
        activationToken: activationToken ?? null,
        providerLinkMetadata: providerIntent?.paymentLinkMetadata ?? null,
        trialSchedule: input.trialSchedule
          ? {
              startedAt: input.trialSchedule.startedAt.toISOString(),
              endsAt: input.trialSchedule.endsAt.toISOString(),
              graceEndsAt: input.trialSchedule.graceEndsAt.toISOString(),
            }
          : null,
      };
      const [lifecycleEvent] = await tx.insert(subscriptionLifecycleEvents).values({
        clinicId: input.clinicId,
        approvalDecisionId: decision.id,
        eventType: lifecycleEventType(input, current),
        fromPlan: current.plan,
        toPlan: approvedPlan,
        fromStatus: current.subscriptionStatus,
        toStatus: updatedClinic.subscriptionStatus,
        policyVersion: PUBLISHED_PLAN_POLICY.version,
        transitionId: input.transitionId,
        actorType: input.actor.type,
        actorId: input.actor.id,
        reason: input.reason,
        metadata: eventMetadata,
        effectiveAt: input.effectiveAt,
      }).returning();

      if (upgradeRequestId) {
        await tx.update(clinicUpgradeRequests)
          .set({ approvalDecisionId: decision.id })
          .where(and(
            eq(clinicUpgradeRequests.id, upgradeRequestId),
            eq(clinicUpgradeRequests.clinicId, input.clinicId),
          ));
      }

      return {
        kind: "created" as const,
        decisionId: decision.id,
      };
    });

    return hydrateResult(
      await db.select()
        .from(subscriptionApprovalDecisions)
        .where(eq(subscriptionApprovalDecisions.id, transactionResult.decisionId))
        .limit(1)
        .then(([decision]) => decision!),
      transactionResult.kind === "idempotent",
    );
  } catch (error) {
    if (error instanceof SubscriptionApprovalError) {
      if (providerIntent && activationToken && error.statusCode >= 500) {
        await recordUnlinkedProviderIntent(input, providerIntent, activationToken, error);
      }
      throw error;
    }

    const raceWinner = await getExistingDecision(input.clinicId, input.transitionId);
    if (raceWinner) return hydrateResult(raceWinner, true);

    if (providerIntent && activationToken) {
      await recordUnlinkedProviderIntent(input, providerIntent, activationToken, error);
    }
    throw error;
  }
}

/**
 * Revokes a sponsored grant without rewriting its approval decision. The grant
 * remains in history and the revocation is recorded as a separate lifecycle
 * transition so retries are safe and the original complimentary decision is
 * preserved.
 */
export async function revokeSubscriptionAccessGrant(input: {
  clinicId: number;
  grantId: string;
  transitionId: string;
  reason: string;
  actorId: string;
  now?: Date;
}): Promise<SponsoredAccessMutationResult> {
  const now = input.now ?? new Date();

  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM clinics WHERE id = ${input.clinicId} FOR UPDATE`);
    const [clinic] = await tx.select()
      .from(clinics)
      .where(eq(clinics.id, input.clinicId))
      .limit(1);
    if (!clinic) {
      return { status: "not_found" as const, grant: null, clinic: null, lifecycleEvent: null };
    }

    const [grant] = await tx.select()
      .from(subscriptionAccessGrants)
      .where(and(
        eq(subscriptionAccessGrants.clinicId, input.clinicId),
        eq(subscriptionAccessGrants.grantId, input.grantId),
      ))
      .limit(1);
    if (!grant) {
      return { status: "not_found" as const, grant: null, clinic, lifecycleEvent: null };
    }

    const [existingEvent] = await tx.select()
      .from(subscriptionLifecycleEvents)
      .where(and(
        eq(subscriptionLifecycleEvents.clinicId, input.clinicId),
        eq(subscriptionLifecycleEvents.transitionId, input.transitionId),
      ))
      .limit(1);
    if (existingEvent || grant.revokedAt) {
      return {
        status: "already_revoked" as const,
        grant,
        clinic,
        lifecycleEvent: existingEvent ?? null,
      };
    }
    if (!isAccessRevocable(grant, now)) {
      return { status: "ended" as const, grant, clinic, lifecycleEvent: null };
    }

    const [revokedGrant] = await tx.update(subscriptionAccessGrants)
      .set({ revokedAt: now })
      .where(and(
        eq(subscriptionAccessGrants.clinicId, input.clinicId),
        eq(subscriptionAccessGrants.grantId, input.grantId),
        isNull(subscriptionAccessGrants.revokedAt),
      ))
      .returning();
    if (!revokedGrant) {
      return { status: "already_revoked" as const, grant, clinic, lifecycleEvent: existingEvent ?? null };
    }

    const [lifecycleEvent] = await tx.insert(subscriptionLifecycleEvents).values({
      clinicId: input.clinicId,
      approvalDecisionId: grant.approvalDecisionId,
      eventType: getAccessRevocationEventType("sponsored_access"),
      fromPlan: clinic.plan ?? grant.plan,
      toPlan: clinic.plan ?? grant.plan,
      fromStatus: clinic.subscriptionStatus ?? null,
      toStatus: clinic.subscriptionStatus ?? null,
      policyVersion: grant.policyVersion ?? PUBLISHED_PLAN_POLICY.version,
      transitionId: input.transitionId,
      actorType: "superuser",
      actorId: input.actorId,
      reason: input.reason,
      metadata: {
        grantId: grant.grantId,
        approvalDecisionId: grant.approvalDecisionId,
        revokedAt: now.toISOString(),
      },
      effectiveAt: now,
    }).returning();

    return { status: "revoked" as const, grant: revokedGrant, clinic, lifecycleEvent };
  });
}

/**
 * Records expiry for sponsored grants that have passed their finite end date.
 * Expiry is intentionally not represented as revocation: the original grant
 * and its dates remain immutable evidence, while the lifecycle event makes the
 * transition visible to operators and makes scheduler retries idempotent.
 */
export async function reconcileExpiredSponsoredAccess(now = new Date()) {
  const candidates = await db.select()
    .from(subscriptionAccessGrants)
    .where(and(
      isNull(subscriptionAccessGrants.revokedAt),
      sql`${subscriptionAccessGrants.endsAt} <= ${now}`,
    ));
  const results: Array<{ grantId: string; status: "processed" | "idempotent" | "missing" }> = [];

  for (const candidate of candidates) {
    const transitionId = `sponsored-access-expiry:${candidate.grantId}:${new Date(candidate.endsAt).toISOString()}`;
    const result = await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT id FROM clinics WHERE id = ${candidate.clinicId} FOR UPDATE`);
      const [clinic] = await tx.select()
        .from(clinics)
        .where(eq(clinics.id, candidate.clinicId))
        .limit(1);
      if (!clinic) return { status: "missing" as const };

      const [existingEvent] = await tx.select()
        .from(subscriptionLifecycleEvents)
        .where(and(
          eq(subscriptionLifecycleEvents.clinicId, candidate.clinicId),
          eq(subscriptionLifecycleEvents.transitionId, transitionId),
        ))
        .limit(1);
      if (existingEvent) return { status: "idempotent" as const };

      const [grant] = await tx.select()
        .from(subscriptionAccessGrants)
        .where(and(
          eq(subscriptionAccessGrants.id, candidate.id),
          isNull(subscriptionAccessGrants.revokedAt),
        ))
        .limit(1);
      if (!grant || new Date(grant.endsAt) > now) return { status: "idempotent" as const };

      await tx.insert(subscriptionLifecycleEvents).values({
        clinicId: candidate.clinicId,
        approvalDecisionId: candidate.approvalDecisionId,
        eventType: "sponsored_access_expired",
        fromPlan: clinic.plan ?? candidate.plan,
        toPlan: clinic.plan ?? candidate.plan,
        fromStatus: clinic.subscriptionStatus ?? null,
        toStatus: clinic.subscriptionStatus ?? null,
        policyVersion: candidate.policyVersion ?? PUBLISHED_PLAN_POLICY.version,
        transitionId,
        actorType: "system",
        actorId: "sponsored_access_lifecycle",
        reason: "Complimentary access reached its scheduled end date",
        metadata: {
          grantId: candidate.grantId,
          approvalDecisionId: candidate.approvalDecisionId,
          endsAt: new Date(candidate.endsAt).toISOString(),
        },
        effectiveAt: candidate.endsAt,
      });
      return { status: "processed" as const };
    });
    results.push({ grantId: candidate.grantId, ...result });
  }

  return {
    measuredAt: now.toISOString(),
    candidates: candidates.length,
    processed: results.filter(result => result.status === "processed").length,
    idempotent: results.filter(result => result.status === "idempotent").length,
    missing: results.filter(result => result.status === "missing").length,
    results,
  };
}

/**
 * Reverses an offline payment without deleting its financial evidence.
 *
 * A reversal only changes current access when the payment is still the latest
 * verified offline payment supporting the clinic's active paid snapshot. Older
 * payment records remain historical evidence and must not revoke a later
 * renewal.
 */
export async function applyOfflinePaymentReversal(input: {
  clinicId: number;
  paymentId: number;
  transitionId: string;
  reason: string;
  actorId: string;
  now?: Date;
}): Promise<OfflinePaymentReversalResult> {
  const now = input.now ?? new Date();

  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM clinics WHERE id = ${input.clinicId} FOR UPDATE`);
    const [clinic] = await tx.select()
      .from(clinics)
      .where(eq(clinics.id, input.clinicId))
      .limit(1);
    if (!clinic) return {
      status: "not_found" as const,
      payment: null,
      clinic: null,
      lifecycleEvent: null,
      accessChanged: false,
    };

    const [existingEvent] = await tx.select()
      .from(subscriptionLifecycleEvents)
      .where(and(
        eq(subscriptionLifecycleEvents.clinicId, input.clinicId),
        eq(subscriptionLifecycleEvents.transitionId, input.transitionId),
      ))
      .limit(1);

    const [payment] = await tx.select()
      .from(subscriptionOfflinePayments)
      .where(and(
        eq(subscriptionOfflinePayments.id, input.paymentId),
        eq(subscriptionOfflinePayments.clinicId, input.clinicId),
      ))
      .limit(1);
    if (!payment) return {
      status: "not_found" as const,
      payment: null,
      clinic,
      lifecycleEvent: existingEvent ?? null,
      accessChanged: false,
    };

    if (existingEvent || payment.reversalStatus === "reversed") {
      return {
        status: "already_reversed" as const,
        payment,
        clinic,
        lifecycleEvent: existingEvent ?? null,
        accessChanged: false,
      };
    }

    const [latestPayment] = await tx.select()
      .from(subscriptionOfflinePayments)
      .where(and(
        eq(subscriptionOfflinePayments.clinicId, input.clinicId),
        eq(subscriptionOfflinePayments.verificationStatus, "verified"),
      ))
      .orderBy(desc(subscriptionOfflinePayments.receivedAt), desc(subscriptionOfflinePayments.id))
      .limit(1);

    const currentStatus = normalizeStatus(clinic.subscriptionStatus);
    const isCurrentActiveSnapshot =
      latestPayment?.id === payment.id &&
      PAID_PLAN_KEYS.includes(clinic.plan as typeof PAID_PLAN_KEYS[number]) &&
      ["active", "manual_override"].includes(currentStatus) &&
      clinic.plan === payment.plan &&
      clinic.billingCycle === payment.billingCycle &&
      (!clinic.paidAccessExpiresAt || new Date(clinic.paidAccessExpiresAt) > now);

    const [reversedPayment] = await tx.update(subscriptionOfflinePayments)
      .set({
        reversalStatus: "reversed",
        reversedAt: now,
        reversalReason: input.reason,
      })
      .where(and(
        eq(subscriptionOfflinePayments.id, input.paymentId),
        eq(subscriptionOfflinePayments.clinicId, input.clinicId),
        isNull(subscriptionOfflinePayments.reversedAt),
      ))
      .returning();
    if (!reversedPayment) {
      return {
        status: "already_reversed" as const,
        payment,
        clinic,
        lifecycleEvent: existingEvent ?? null,
        accessChanged: false,
      };
    }

    let updatedClinic = clinic;
    if (isCurrentActiveSnapshot) {
      const [updated] = await tx.update(clinics)
        .set({
          subscriptionStatus: "expired",
          paidAccessExpiresAt: now,
          previousPaidPlan: clinic.plan,
        })
        .where(eq(clinics.id, input.clinicId))
        .returning();
      if (updated) updatedClinic = updated;
    }

    const [lifecycleEvent] = await tx.insert(subscriptionLifecycleEvents).values({
      clinicId: input.clinicId,
      eventType: "offline_payment_reversed",
      fromPlan: clinic.plan,
      toPlan: updatedClinic.plan,
      fromStatus: clinic.subscriptionStatus,
      toStatus: updatedClinic.subscriptionStatus,
      policyVersion: clinic.subscriptionPolicyVersion || PUBLISHED_PLAN_POLICY.version,
      transitionId: input.transitionId,
      actorType: "superuser",
      actorId: input.actorId,
      reason: input.reason,
      metadata: {
        offlinePaymentId: payment.id,
        externalReference: payment.externalReference,
        accessChanged: isCurrentActiveSnapshot,
        reversedAt: now.toISOString(),
      },
      effectiveAt: now,
    }).returning();

    return {
      status: "reversed" as const,
      payment: reversedPayment,
      clinic: updatedClinic,
      lifecycleEvent,
      accessChanged: isCurrentActiveSnapshot,
    };
  });
}

const PROVIDER_CONFIRMATION_EVENTS = new Set([
  "subscription.charged",
  "subscription.activated",
]);

const PROVIDER_FAILURE_EVENTS = new Set([
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "subscription.expired",
]);

function providerTransitionId(input: ProviderSubscriptionEventInput): string {
  return `provider:${input.provider}:${input.providerEventId || input.providerSubscriptionId}:${input.providerEventType}`;
}

/**
 * Central provider-event adapter. The webhook route owns signature validation
 * and raw event ingestion; all subscription state changes happen here.
 */
export async function applyProviderSubscriptionEvent(
  input: ProviderSubscriptionEventInput,
): Promise<ProviderSubscriptionEventResult> {
  const now = input.now ?? new Date();
  const transitionId = providerTransitionId(input);

  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM clinics WHERE id = ${input.clinicId} FOR UPDATE`);
    const [current] = await tx.select()
      .from(clinics)
      .where(eq(clinics.id, input.clinicId))
      .limit(1);
    if (!current) {
      await tx.update(subscriptionProviderEvents)
        .set({ processingStatus: "unmatched" })
        .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
      return { status: "missing" as const, transitionId: null, clinic: null };
    }

    const [activationToken] = await tx.select()
      .from(activationTokens)
      .where(and(
        eq(activationTokens.clinicId, input.clinicId),
        eq(activationTokens.razorpaySubscriptionId, input.providerSubscriptionId),
      ))
      .orderBy(desc(activationTokens.id))
      .limit(1);

    const providerMatchesClinic =
      !current.razorpaySubscriptionId ||
      current.razorpaySubscriptionId === input.providerSubscriptionId ||
      Boolean(activationToken);
    if (!providerMatchesClinic) {
      await tx.update(subscriptionProviderEvents)
        .set({ processingStatus: "ignored" })
        .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
      return { status: "ignored" as const, transitionId: null, clinic: current };
    }

    const [existingLifecycle] = await tx.select({ id: subscriptionLifecycleEvents.id })
      .from(subscriptionLifecycleEvents)
      .where(and(
        eq(subscriptionLifecycleEvents.clinicId, input.clinicId),
        eq(subscriptionLifecycleEvents.transitionId, transitionId),
      ))
      .limit(1);
    if (existingLifecycle) {
      await tx.update(subscriptionProviderEvents)
        .set({ processingStatus: "applied" })
        .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
      return { status: "duplicate" as const, transitionId, clinic: current };
    }

    if (PROVIDER_CONFIRMATION_EVENTS.has(input.providerEventType)) {
      const targetPlan = activationToken?.plan || current.plan;
      if (!PAID_PLAN_KEYS.includes(targetPlan as typeof PAID_PLAN_KEYS[number])) {
        await tx.update(subscriptionProviderEvents)
          .set({ processingStatus: "ignored" })
          .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
        return { status: "ignored" as const, transitionId: null, clinic: current };
      }

      const wasPendingActivation =
        current.subscriptionStatus === "pending_payment" ||
        (current.plan === "trial" && Boolean(activationToken));
      const [updatedClinic] = await tx.update(clinics)
        .set({
          plan: targetPlan,
          billingCycle: activationToken?.billingCycle || current.billingCycle || "monthly",
          subscriptionStatus: "active",
          razorpaySubscriptionId: input.providerSubscriptionId,
          paidAccessExpiresAt: input.providerCurrentEnd || current.paidAccessExpiresAt,
          trialStartedAt: null,
          trialEndsAt: null,
          trialGraceEndsAt: null,
          trialOrigin: null,
        })
        .where(eq(clinics.id, input.clinicId))
        .returning();
      if (!updatedClinic) {
        await tx.update(subscriptionProviderEvents)
          .set({ processingStatus: "ignored" })
          .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
        return { status: "ignored" as const, transitionId: null, clinic: current };
      }

      await tx.insert(subscriptionLifecycleEvents).values({
        clinicId: input.clinicId,
        approvalDecisionId: activationToken?.approvalDecisionId || null,
        eventType: wasPendingActivation ? "converted" : "renewed",
        fromPlan: current.plan,
        toPlan: targetPlan,
        fromStatus: current.subscriptionStatus,
        toStatus: "active",
        policyVersion: current.subscriptionPolicyVersion || PUBLISHED_PLAN_POLICY.version,
        transitionId,
        actorType: "provider",
        actorId: input.provider,
        reason: wasPendingActivation
          ? "Provider confirmed paid access after Trial or payment approval"
          : "Provider confirmed subscription payment",
        metadata: {
          providerEventId: input.providerEventId,
          providerSubscriptionId: input.providerSubscriptionId,
          currentEnd: input.providerCurrentEnd?.toISOString() || null,
          activationTokenId: activationToken?.id || null,
        },
        effectiveAt: input.providerCurrentEnd || now,
      });

      if (activationToken) {
        await tx.update(activationTokens)
          .set({ used: true })
          .where(eq(activationTokens.id, activationToken.id));
      }
      await tx.update(subscriptionProviderEvents)
        .set({ processingStatus: "applied" })
        .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
      return { status: "applied" as const, transitionId, clinic: updatedClinic };
    }

    if (!PROVIDER_FAILURE_EVENTS.has(input.providerEventType) ||
      !PAID_PLAN_KEYS.includes(current.plan as typeof PAID_PLAN_KEYS[number])) {
      await tx.update(subscriptionProviderEvents)
        .set({ processingStatus: "ignored" })
        .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
      return { status: "ignored" as const, transitionId: null, clinic: current };
    }

    const paidAccessExpiresAt = input.providerCurrentEnd || current.paidAccessExpiresAt;
    const recovery = buildRecoveryTrialTransition({
      now,
      paidPlan: current.plan,
      subscriptionStatus: current.subscriptionStatus,
      subscriptionId: input.providerSubscriptionId,
      provider: input.provider,
      providerEventId: input.providerEventId,
      providerEventType: input.providerEventType,
      paidAccessExpiresAt,
    });

    if (recovery) {
      const [updatedClinic] = await tx.update(clinics)
        .set({
          plan: "trial",
          billingCycle: "monthly",
          subscriptionStatus: "trialing",
          trialStartedAt: recovery.trialWindow.startedAt,
          trialEndsAt: recovery.trialWindow.endsAt,
          trialGraceEndsAt: recovery.trialWindow.graceEndsAt,
          trialOrigin: "paid_expiry",
          previousPaidPlan: recovery.previousPaidPlan,
          paidAccessExpiresAt,
          subscriptionPolicyVersion: PUBLISHED_PLAN_POLICY.version,
        })
        .where(eq(clinics.id, input.clinicId))
        .returning();
      if (!updatedClinic) {
        throw new SubscriptionApprovalError("Clinic could not be moved to recovery Trial", 409);
      }

      await tx.insert(subscriptionPlanAssignments).values({
        clinicId: input.clinicId,
        plan: "trial",
        billingCycle: "monthly",
        source: "paid_expiry_recovery",
        policyVersion: PUBLISHED_PLAN_POLICY.version,
        transitionId: recovery.transitionId,
        assignedByType: "provider",
        assignedById: input.provider,
        reason: recovery.reason,
        startsAt: recovery.trialWindow.startedAt,
        endsAt: recovery.trialWindow.graceEndsAt,
      });
      await tx.insert(subscriptionLifecycleEvents).values({
        clinicId: input.clinicId,
        eventType: "recovered",
        fromPlan: current.plan,
        toPlan: "trial",
        fromStatus: current.subscriptionStatus,
        toStatus: "trialing",
        policyVersion: current.subscriptionPolicyVersion || PUBLISHED_PLAN_POLICY.version,
        transitionId: recovery.transitionId,
        actorType: "provider",
        actorId: input.provider,
        reason: recovery.reason,
        metadata: recovery.metadata,
        effectiveAt: now,
      });
      await tx.update(subscriptionProviderEvents)
        .set({ processingStatus: "applied" })
        .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
      return { status: "applied" as const, transitionId: recovery.transitionId, clinic: updatedClinic };
    }

    const shouldRemainPastDue = paidAccessExpiresAt && paidAccessExpiresAt > now;
    const nextStatus = shouldRemainPastDue ? "past_due" : current.subscriptionStatus;
    if (nextStatus === "past_due" && current.subscriptionStatus !== "past_due") {
      const [updatedClinic] = await tx.update(clinics)
        .set({
          subscriptionStatus: "past_due",
          paidAccessExpiresAt,
          subscriptionPolicyVersion: PUBLISHED_PLAN_POLICY.version,
        })
        .where(eq(clinics.id, input.clinicId))
        .returning();
      if (!updatedClinic) throw new SubscriptionApprovalError("Clinic could not be marked past due", 409);
      await tx.insert(subscriptionLifecycleEvents).values({
        clinicId: input.clinicId,
        eventType: input.providerEventType === "subscription.cancelled" ? "cancelled" : "expired",
        fromPlan: current.plan,
        toPlan: current.plan,
        fromStatus: current.subscriptionStatus,
        toStatus: "past_due",
        policyVersion: current.subscriptionPolicyVersion || PUBLISHED_PLAN_POLICY.version,
        transitionId,
        actorType: "provider",
        actorId: input.provider,
        reason: `Provider reported ${input.providerEventType}`,
        metadata: {
          providerEventId: input.providerEventId,
          providerSubscriptionId: input.providerSubscriptionId,
          currentEnd: paidAccessExpiresAt?.toISOString() || null,
        },
        effectiveAt: now,
      });
      await tx.update(subscriptionProviderEvents)
        .set({ processingStatus: "applied" })
        .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
      return { status: "applied" as const, transitionId, clinic: updatedClinic };
    }

    await tx.update(subscriptionProviderEvents)
      .set({ processingStatus: "ignored" })
      .where(eq(subscriptionProviderEvents.id, input.providerEventRecordId));
    return { status: "ignored" as const, transitionId: null, clinic: current };
  });
}