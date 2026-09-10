import { pool } from "../server/db";
import { getSubscriptionStatusInfo } from "../shared/subscription-status";
import {
  BASELINE_MESSAGE_CHANNELS,
  compareBaselineImpact,
  type BaselineUsage,
} from "../shared/subscription-baseline-policy";
import { isPaidPlanKey } from "../shared/plan-catalog";

type ClinicRow = {
  id: number;
  name: string;
  status: string | null;
  is_archived: boolean;
  plan: string | null;
  storage_limit_bytes: number | string | null;
  timezone: string | null;
  subscription_status: string | null;
  billing_cycle: string | null;
  razorpay_subscription_id: string | null;
};

type BookingRow = {
  clinic_id: number | null;
  clinic_name: string | null;
  created_at: Date | string | null;
  verification_status: string | null;
};

type MessageRow = {
  clinic_id: number;
  channel: string;
  status: string;
  billable: boolean;
  is_test: boolean;
  units: number | string;
  sent_at: Date | string | null;
};

type MetricBucket = {
  rows: number;
  totalUnits: number;
  acceptedUnits: number;
  failedUnits: number;
  skippedUnits: number;
  billableUnits: number;
  countedUnits: number;
  testUnits: number;
};

type ClinicBaseline = {
  clinicId: number;
  status: string | null;
  archived: boolean;
  plan: string | null;
  rawSubscriptionStatus: string | null;
  subscriptionState: string;
  billingCycle: string | null;
  providerLink: "linked" | "not_linked";
  timezone: string;
  doctors: {
    linkedCount: number | null;
    definition: string;
  };
  bookings: {
    allTime: number | null;
    currentLocalMonth: number | null;
    statusCounts: Record<string, number>;
    attribution: "complete" | "partial" | "unavailable";
  };
  smileDeals: {
    total: number | null;
    activePublishedProxy: number | null;
    definition: string;
  };
  storage: {
    documentCount: number | null;
    trackedBytes: number | null;
    documentsWithMissingFileSize: number | null;
    status: "complete" | "partial" | "unavailable";
  };
  messaging: {
    allTime: Record<string, MetricBucket>;
    currentLocalMonth: Record<string, MetricBucket>;
  };
  providerEvents: {
    count: number | null;
    unresolvedCount: number | null;
    latestReceivedAt: string | null;
  };
  patientCount: number | null;
  impact: {
    trial: string[];
    assignedPlan: string[];
  };
  flags: string[];
};

const MESSAGE_CHANNELS = BASELINE_MESSAGE_CHANNELS;

async function query<T = Record<string, unknown>>(text: string): Promise<T[]> {
  const result = await pool.query(text);
  return result.rows as T[];
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function emptyMetricBucket(): MetricBucket {
  return {
    rows: 0,
    totalUnits: 0,
    acceptedUnits: 0,
    failedUnits: 0,
    skippedUnits: 0,
    billableUnits: 0,
    countedUnits: 0,
    testUnits: 0,
  };
}

function localYearMonth(value: Date | string | null, timezone: string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    return year && month ? `${year}-${month}` : null;
  } catch {
    return null;
  }
}

function currentLocalYearMonth(timezone: string): string | null {
  return localYearMonth(new Date(), timezone);
}

function addMessageRow(
  target: Record<string, MetricBucket>,
  row: Pick<MessageRow, "channel" | "status" | "billable" | "is_test" | "units">,
) {
  if (!target[row.channel]) target[row.channel] = emptyMetricBucket();
  const bucket = target[row.channel];
  const units = numberValue(row.units);
  bucket.rows += 1;
  bucket.totalUnits += units;
  if (row.status === "accepted") bucket.acceptedUnits += units;
  if (row.status === "failed") bucket.failedUnits += units;
  if (row.status === "skipped") bucket.skippedUnits += units;
  if (row.billable) bucket.billableUnits += units;
  if (row.is_test) bucket.testUnits += units;
  if (!row.is_test && (row.status === "accepted" || (row.status === "failed" && row.billable))) {
    bucket.countedUnits += units;
  }
}

function ensureChannels(messages: Record<string, MetricBucket>) {
  for (const channel of MESSAGE_CHANNELS) {
    if (!messages[channel]) messages[channel] = emptyMetricBucket();
  }
  return messages;
}

function incrementStatus(target: Record<string, number>, status: string | null) {
  const key = status || "<null>";
  target[key] = (target[key] ?? 0) + 1;
}

function uniqueClinicIdByName(clinics: ClinicRow[]) {
  const idsByName = new Map<string, number[]>();
  for (const clinic of clinics) {
    const name = clinic.name.trim();
    if (!name) continue;
    idsByName.set(name, [...(idsByName.get(name) ?? []), clinic.id]);
  }
  return new Map(
    [...idsByName.entries()]
      .filter(([, ids]) => ids.length === 1)
      .map(([name, ids]) => [name, ids[0]]),
  );
}

function compareImpact(
  baseline: ClinicBaseline,
  planKey: string | null,
  isTrial: boolean,
): string[] {
  const usage: BaselineUsage = {
    bookingsAllTime: baseline.bookings.allTime,
    bookingsCurrentLocalMonth: baseline.bookings.currentLocalMonth,
    activeDoctors: baseline.doctors.linkedCount,
    liveSmileDeals: baseline.smileDeals.activePublishedProxy,
    storageBytes: baseline.storage.trackedBytes,
    allTimeMessages: Object.fromEntries(
      MESSAGE_CHANNELS.map((channel) => [channel, baseline.messaging.allTime[channel]?.countedUnits ?? null]),
    ) as BaselineUsage["allTimeMessages"],
    currentLocalMonthMessages: Object.fromEntries(
      MESSAGE_CHANNELS.map((channel) => [channel, baseline.messaging.currentLocalMonth[channel]?.countedUnits ?? null]),
    ) as BaselineUsage["currentLocalMonthMessages"],
  };
  return compareBaselineImpact(usage, planKey, isTrial);
}

async function main() {
  const tableRows = await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  );
  const tables = new Set(tableRows.map((row) => row.table_name));
  if (!tables.has("clinics")) {
    throw new Error("The clinics table is unavailable. Run the existing development schema setup before generating the baseline.");
  }

  const clinics = await query<ClinicRow>(
    `SELECT id, name, status, is_archived, plan, storage_limit_bytes, timezone,
            subscription_status, billing_cycle, razorpay_subscription_id
       FROM clinics
      ORDER BY id`,
  );
  const nameToClinicId = uniqueClinicIdByName(clinics);
  const clinicById = new Map(clinics.map((clinic) => [clinic.id, clinic]));

  const doctorsAvailable = tables.has("clinic_doctors");
  const doctorRows = doctorsAvailable
    ? await query<{ clinic_id: number; count: number | string }>(
        "SELECT clinic_id, COUNT(*)::int AS count FROM clinic_doctors GROUP BY clinic_id",
      )
    : [];
  const doctorCounts = new Map(doctorRows.map((row) => [row.clinic_id, numberValue(row.count)]));

  const smileDealsAvailable = tables.has("smile_deals");
  const smileDealRows = smileDealsAvailable
    ? await query<{ clinic_id: number | null; total: number | string; active_published_proxy: number | string }>(
        `SELECT clinic_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (
                  WHERE is_active = true
                    AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
                    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                )::int AS active_published_proxy
           FROM smile_deals
          GROUP BY clinic_id`,
      )
    : [];
  const smileDealsByClinic = new Map(
    smileDealRows
      .filter((row) => row.clinic_id !== null)
      .map((row) => [row.clinic_id as number, {
        total: numberValue(row.total),
        activePublishedProxy: numberValue(row.active_published_proxy),
      }]),
  );

  const bookingsAvailable = tables.has("bookings") && tables.has("slots");
  const bookingRows = bookingsAvailable
    ? await query<BookingRow>(
        `SELECT s.clinic_id, s.clinic_name, b.created_at, b.verification_status
           FROM bookings b
           JOIN slots s ON s.id = b.slot_id
          WHERE s.clinic_id IS NOT NULL OR s.clinic_name IS NOT NULL`,
      )
    : [];
  const bookingStats = new Map<number, { allTime: number; currentLocalMonth: number; statusCounts: Record<string, number>; partial: boolean }>();
  let unattributedBookings = 0;
  for (const row of bookingRows) {
    const clinicId = row.clinic_id ?? (row.clinic_name ? nameToClinicId.get(row.clinic_name) ?? null : null);
    if (!clinicId || !clinicById.has(clinicId)) {
      unattributedBookings += 1;
      continue;
    }
    const clinic = clinicById.get(clinicId)!;
    const stats = bookingStats.get(clinicId) ?? { allTime: 0, currentLocalMonth: 0, statusCounts: {}, partial: false };
    stats.allTime += 1;
    incrementStatus(stats.statusCounts, row.verification_status);
    if (localYearMonth(row.created_at, clinic.timezone || "Asia/Kolkata") === currentLocalYearMonth(clinic.timezone || "Asia/Kolkata")) {
      stats.currentLocalMonth += 1;
    }
    if (!row.clinic_id) stats.partial = true;
    bookingStats.set(clinicId, stats);
  }

  const messageRows = tables.has("communication_usage")
    ? await query<MessageRow>(
        "SELECT clinic_id, channel, status, billable, is_test, units, sent_at FROM communication_usage",
      )
    : [];
  const allTimeMessages = new Map<number, Record<string, MetricBucket>>();
  const currentMonthMessages = new Map<number, Record<string, MetricBucket>>();
  for (const row of messageRows) {
    const clinic = clinicById.get(row.clinic_id);
    if (!clinic) continue;
    const allTime = allTimeMessages.get(row.clinic_id) ?? {};
    addMessageRow(allTime, row);
    allTimeMessages.set(row.clinic_id, allTime);
    if (localYearMonth(row.sent_at, clinic.timezone || "Asia/Kolkata") === currentLocalYearMonth(clinic.timezone || "Asia/Kolkata")) {
      const current = currentMonthMessages.get(row.clinic_id) ?? {};
      addMessageRow(current, row);
      currentMonthMessages.set(row.clinic_id, current);
    }
  }

  const storageAvailable = tables.has("patient_documents");
  const storageRows = storageAvailable
    ? await query<{ clinic_id: number; document_count: number | string; tracked_bytes: number | string; missing_file_size: number | string }>(
        `SELECT clinic_id,
                COUNT(*)::int AS document_count,
                COALESCE(SUM(file_size) FILTER (WHERE file_size IS NOT NULL), 0)::bigint AS tracked_bytes,
                COUNT(*) FILTER (WHERE file_size IS NULL)::int AS missing_file_size
           FROM patient_documents
          WHERE deleted_at IS NULL
          GROUP BY clinic_id`,
      )
    : [];
  const storageByClinic = new Map(
    storageRows.map((row) => [row.clinic_id, {
      documentCount: numberValue(row.document_count),
      trackedBytes: numberValue(row.tracked_bytes),
      missingFileSize: numberValue(row.missing_file_size),
    }]),
  );

  const providerEventsAvailable = tables.has("subscription_provider_events");
  const providerRows = providerEventsAvailable
    ? await query<{ clinic_id: number | null; event_count: number | string; unresolved_count: number | string; latest_received_at: Date | string | null }>(
        `SELECT clinic_id,
                COUNT(*)::int AS event_count,
                COUNT(*) FILTER (WHERE processing_status <> 'processed')::int AS unresolved_count,
                MAX(received_at) AS latest_received_at
           FROM subscription_provider_events
          GROUP BY clinic_id`,
      )
    : [];
  const providerByClinic = new Map(
    providerRows
      .filter((row) => row.clinic_id !== null)
      .map((row) => [row.clinic_id as number, {
        count: numberValue(row.event_count),
        unresolvedCount: numberValue(row.unresolved_count),
        latestReceivedAt: isoDate(row.latest_received_at),
      }]),
  );

  const patientsAvailable = tables.has("patients");
  const patientRows = patientsAvailable
    ? await query<{ clinic_id: number | null; count: number | string }>(
        "SELECT clinic_id, COUNT(*)::int AS count FROM patients GROUP BY clinic_id",
      )
    : [];
  const patientCounts = new Map(
    patientRows
      .filter((row) => row.clinic_id !== null)
      .map((row) => [row.clinic_id as number, numberValue(row.count)]),
  );

  const baselines: ClinicBaseline[] = clinics.map((clinic) => {
    const timezone = clinic.timezone || "Asia/Kolkata";
    const rawPlan = clinic.plan?.toLowerCase() || null;
    const subscriptionInfo = getSubscriptionStatusInfo(clinic.subscription_status);
    const bookings = bookingStats.get(clinic.id);
    const deals = smileDealsByClinic.get(clinic.id);
    const storage = storageByClinic.get(clinic.id);
    const provider = providerByClinic.get(clinic.id);
    const allTime = ensureChannels(allTimeMessages.get(clinic.id) ?? {});
    const currentLocalMonth = ensureChannels(currentMonthMessages.get(clinic.id) ?? {});
    const baseline: ClinicBaseline = {
      clinicId: clinic.id,
      status: clinic.status,
      archived: clinic.is_archived,
      plan: rawPlan,
      rawSubscriptionStatus: clinic.subscription_status,
      subscriptionState: subscriptionInfo.state,
      billingCycle: clinic.billing_cycle ?? null,
      providerLink: clinic.razorpay_subscription_id ? "linked" : "not_linked",
      timezone,
      doctors: {
        linkedCount: doctorsAvailable ? doctorCounts.get(clinic.id) ?? 0 : null,
        definition: doctorsAvailable
          ? "clinic_doctors link rows; the current schema has no active/inactive doctor flag"
          : "unavailable: clinic_doctors table is missing",
      },
      bookings: {
        allTime: bookingsAvailable ? bookings?.allTime ?? 0 : null,
        currentLocalMonth: bookingsAvailable ? bookings?.currentLocalMonth ?? 0 : null,
        statusCounts: bookings?.statusCounts ?? {},
        attribution: !bookingsAvailable ? "unavailable" : bookings?.partial || unattributedBookings > 0 ? "partial" : "complete",
      },
      smileDeals: {
        total: smileDealsAvailable ? deals?.total ?? 0 : null,
        activePublishedProxy: smileDealsAvailable ? deals?.activePublishedProxy ?? 0 : null,
        definition: smileDealsAvailable
          ? "is_active plus starts_at/expiration window; no separate draft/published field exists"
          : "unavailable: smile_deals table is missing",
      },
      storage: {
        documentCount: storageAvailable ? storage?.documentCount ?? 0 : null,
        trackedBytes: storageAvailable ? storage?.trackedBytes ?? 0 : null,
        documentsWithMissingFileSize: storageAvailable ? storage?.missingFileSize ?? 0 : null,
        status: !storageAvailable ? "unavailable" : storage?.missingFileSize ? "partial" : "complete",
      },
      messaging: {
        allTime,
        currentLocalMonth,
      },
      providerEvents: {
        count: providerEventsAvailable ? provider?.count ?? 0 : null,
        unresolvedCount: providerEventsAvailable ? provider?.unresolvedCount ?? 0 : null,
        latestReceivedAt: provider?.latestReceivedAt ?? null,
      },
      patientCount: patientsAvailable ? patientCounts.get(clinic.id) ?? 0 : null,
      impact: { trial: [], assignedPlan: [] },
      flags: [],
    };

    baseline.impact.trial = compareImpact(baseline, "trial", true);
    baseline.impact.assignedPlan = compareImpact(baseline, rawPlan, false);

    if (!rawPlan || !isPaidPlanKey(rawPlan) && rawPlan !== "trial") baseline.flags.push("unknown_plan");
    if (clinic.subscription_status?.toLowerCase() === "unpaid") baseline.flags.push("legacy_unpaid_maps_to_pending_payment");
    if (subscriptionInfo.state === "unknown") baseline.flags.push("unknown_subscription_state");
    if (isPaidPlanKey(rawPlan) && !clinic.razorpay_subscription_id) baseline.flags.push("paid_plan_without_provider_link");
    if (clinic.is_archived && subscriptionInfo.state === "active") baseline.flags.push("archived_with_active_subscription");
    if (clinic.storage_limit_bytes !== null) baseline.flags.push("clinic_storage_override_present");
    if (providerEventsAvailable && clinic.razorpay_subscription_id && !provider) baseline.flags.push("provider_link_without_event_history");
    if (provider?.unresolvedCount) baseline.flags.push("provider_events_need_reconciliation");
    if (baseline.impact.trial.length) baseline.flags.push("above_proposed_trial_limit");
    if (baseline.impact.assignedPlan.length) baseline.flags.push("above_assigned_plan_limit");
    if (baseline.bookings.attribution === "partial") baseline.flags.push("booking_attribution_partial");
    if (baseline.storage.status === "partial") baseline.flags.push("storage_file_size_partial");
    return baseline;
  });

  const summary = {
    totalClinics: baselines.length,
    activeClinics: baselines.filter((clinic) => !clinic.archived).length,
    archivedClinics: baselines.filter((clinic) => clinic.archived).length,
    plans: Object.fromEntries([...new Set(baselines.map((clinic) => clinic.plan ?? "<null>"))].sort().map((plan) => [
      plan,
      baselines.filter((clinic) => (clinic.plan ?? "<null>") === plan).length,
    ])),
    subscriptionStates: Object.fromEntries([...new Set(baselines.map((clinic) => clinic.subscriptionState))].sort().map((state) => [
      state,
      baselines.filter((clinic) => clinic.subscriptionState === state).length,
    ])),
    clinicsWithFlags: baselines.filter((clinic) => clinic.flags.length).length,
    unattributedBookings,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    environment: process.env.APP_ENV || "development",
    scope: "All clinic rows in the configured database, including archived clinics. No patient names, clinic names, emails, phone numbers, or provider identifiers are emitted.",
    summary,
    dataAvailability: {
      clinics: "available",
      clinicDoctors: doctorsAvailable ? "available" : "unavailable",
      bookingsAndSlots: bookingsAvailable ? "available" : "unavailable",
      smileDeals: smileDealsAvailable ? "available" : "unavailable",
      communicationUsage: tables.has("communication_usage") ? "available" : "unavailable",
      patientDocuments: storageAvailable ? "available" : "unavailable",
      subscriptionProviderEvents: providerEventsAvailable ? "available" : "unavailable",
      patients: patientsAvailable ? "available" : "unavailable",
      trialLifecycle: "unavailable: no explicit Trial lifecycle fields or table exist",
      manualExceptions: "unavailable: no dedicated exception history table or fields exist",
      policyVersion: "unavailable: no versioned plan-policy catalog exists",
      activeDoctorDefinition: doctorsAvailable ? "partial: clinic_doctors links have no active flag" : "unavailable",
      smileDealDraftDefinition: smileDealsAvailable ? "partial: no draft/published status exists" : "unavailable",
      bookingAttribution: bookingsAvailable && unattributedBookings === 0 ? "complete" : "partial",
    },
    limitations: [
      "The configured development database currently has no clinic rows.",
      "This project has no production database attached, so a live production baseline cannot be generated here until deployment creates one.",
      "Trial dates, Trial origin, previous paid plan, paid-expiry history, exception history, and policy versions are not currently stored.",
      "Active doctor counts are based on clinic_doctors links because the current schema has no active/inactive doctor field.",
      "Smile Deal live-post counts are a proxy based on is_active and the starts_at/expires_at window because draft and published states are not separate fields.",
    ],
    clinics: baselines,
  };

  const outputMode = process.argv.includes("--json") ? "json" : "markdown";
  if (outputMode === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const lines: string[] = [
    "# Subscription Baseline Report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Environment: ${report.environment}`,
    `- Scope: ${report.scope}`,
    "",
    "## Summary",
    "",
    `- Total clinics: ${summary.totalClinics}`,
    `- Active clinics: ${summary.activeClinics}`,
    `- Archived clinics: ${summary.archivedClinics}`,
    `- Clinics with risk/data-quality flags: ${summary.clinicsWithFlags}`,
    `- Unattributed bookings: ${summary.unattributedBookings}`,
    `- Plan distribution: ${Object.entries(summary.plans).map(([key, value]) => `${key}=${value}`).join(", ") || "none"}`,
    `- Subscription states: ${Object.entries(summary.subscriptionStates).map(([key, value]) => `${key}=${value}`).join(", ") || "none"}`,
    "",
    "## Data availability",
    "",
    "| Area | Status |",
    "|---|---|",
    ...Object.entries(report.dataAvailability).map(([key, value]) => `| ${key} | ${value} |`),
    "",
    "## Clinic baseline",
    "",
    "| Clinic ID | Status | Archived | Plan | Subscription state | Provider link | Billing | Bookings (month/all) | Doctors | Smile Deals (live/total) | Storage bytes | Messages (SMS/WA/email) | Flags |",
    "|---:|---|---|---|---|---|---|---:|---:|---:|---:|---|---|",
  ];

  if (!baselines.length) {
    lines.push("| — | No clinic rows are present in the configured database | — | — | — | — | — | — | — | — | — | — |");
  } else {
    for (const clinic of baselines) {
      const messages = MESSAGE_CHANNELS.map((channel) => clinic.messaging.currentLocalMonth[channel]?.countedUnits ?? 0).join("/");
      lines.push(`| ${clinic.clinicId} | ${clinic.status ?? "<null>"} | ${clinic.archived ? "yes" : "no"} | ${clinic.plan ?? "<null>"} | ${clinic.subscriptionState} | ${clinic.providerLink} | ${clinic.billingCycle ?? "<null>"} | ${clinic.bookings.currentLocalMonth ?? "unavailable"}/${clinic.bookings.allTime ?? "unavailable"} | ${clinic.doctors.linkedCount ?? "unavailable"} | ${clinic.smileDeals.activePublishedProxy ?? "unavailable"}/${clinic.smileDeals.total ?? "unavailable"} | ${clinic.storage.trackedBytes ?? "unavailable"} | ${messages} | ${clinic.flags.join(", ") || "none"} |`);
    }
  }

  lines.push("", "## Limitations and migration decisions", "", ...report.limitations.map((limitation) => `- ${limitation}`));
  lines.push("", "This report is read-only. It does not assign plans, change subscription state, create exceptions, or enforce limits.", "");
  process.stdout.write(`${lines.join("\n")}\n`);
}

main()
  .catch((error) => {
    console.error("[SUBSCRIPTION BASELINE] Failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });