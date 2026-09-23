import crypto from "crypto";
import { addMonths } from "date-fns";
import { and, desc, eq, sql } from "drizzle-orm";
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
import { buildTrialWindow } from "@shared/subscription-lifecycle";

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
    currentAccessPlan: clinic.plan,
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

      const [current] = await tx.select()
        .from(clinics)
        .where(eq(clinics.id, input.clinicId))
        .limit(1);
      if (!current) throw new SubscriptionApprovalError("Clinic not found", 404);

      const currentAccessState = resolveApprovalAccessState(current, now);
      if (input.outcome === "trial" && currentAccessState === "active_paid") {
        throw new SubscriptionApprovalError("An active paid clinic cannot be replaced by a Trial", 409);
      }

      const trialWindow = buildTrialWindow(input.effectiveAt);
      const hasTrialHistory = Boolean(current.trialStartedAt);
      if (input.outcome === "trial" && hasTrialHistory && current.status !== "pending") {
        throw new SubscriptionApprovalError(
          "This clinic already has Trial history. Use the dedicated Trial extension workflow.",
          409,
        );
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
          trialOrigin: current.trialOrigin || "admin_granted",
          paidAccessExpiresAt: null,
          razorpaySubscriptionId: null,
        });
      } else if (input.outcome === "online_payment_required") {
        if (!paymentPendingKeepsCurrentAccess) {
          Object.assign(clinicUpdate, {
            plan: "trial",
            billingCycle: "monthly",
            subscriptionStatus: "trialing",
            trialStartedAt: current.trialStartedAt || trialWindow.startedAt,
            trialEndsAt: current.trialEndsAt || trialWindow.endsAt,
            trialGraceEndsAt: current.trialGraceEndsAt || trialWindow.graceEndsAt,
            trialOrigin: current.trialOrigin || "admin_granted",
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

      const upgradeRequestId = approvalDecisionIdFromSourceRequest(input.sourceRequestId);
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