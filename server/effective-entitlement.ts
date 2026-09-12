import { db } from "./db";
import { storage } from "./storage";
import { getUtcInstantForCalendarDate } from "@shared/booking-status";
import { resolveEffectiveEntitlements, type EffectiveEntitlementReport, type EffectiveEntitlementUsage } from "@shared/effective-entitlement";
import {
  bookings,
  clinicDoctors,
  communicationUsage,
  patientDocuments,
  slots,
  smileDeals,
} from "@shared/schema";
import { and, eq, gte, isNull, lte, lt, or, sql } from "drizzle-orm";

function localCalendarDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthBounds(now: Date, timezone: string) {
  const today = localCalendarDate(now, timezone);
  const [year, month] = today.split("-").map(Number);
  const monthStart = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    start: getUtcInstantForCalendarDate(monthStart, timezone),
    end: getUtcInstantForCalendarDate(nextMonth, timezone),
    label: monthStart.slice(0, 7),
  };
}

export async function getEffectiveEntitlementReport(
  clinicId: number,
  now = new Date(),
): Promise<EffectiveEntitlementReport | null> {
  const clinic = await storage.getClinic(clinicId);
  if (!clinic) return null;

  const bounds = monthBounds(now, clinic.timezone);
  const [bookingUsage, doctorUsage, dealUsage, storageUsage, messageRows] = await Promise.all([
    db.select({
      allTime: sql<number>`count(*)`,
      currentLocalMonth: sql<number>`count(*) filter (where ${bookings.createdAt} >= ${bounds.start} and ${bookings.createdAt} < ${bounds.end})`,
    })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(eq(slots.clinicId, clinicId)),
    db.select({ count: sql<number>`count(distinct ${clinicDoctors.doctorId})` })
      .from(clinicDoctors)
      .where(eq(clinicDoctors.clinicId, clinicId)),
    db.select({ count: sql<number>`count(*)` })
      .from(smileDeals)
      .where(and(
        eq(smileDeals.clinicId, clinicId),
        eq(smileDeals.isActive, true),
        or(isNull(smileDeals.startsAt), lte(smileDeals.startsAt, now)),
        or(isNull(smileDeals.expiresAt), gte(smileDeals.expiresAt, now)),
      )),
    db.select({ bytes: sql<number>`coalesce(sum(${patientDocuments.fileSize}), 0)` })
      .from(patientDocuments)
      .where(and(eq(patientDocuments.clinicId, clinicId), isNull(patientDocuments.deletedAt))),
    db.select({
      channel: communicationUsage.channel,
      units: communicationUsage.units,
      status: communicationUsage.status,
      billable: communicationUsage.billable,
      isTest: communicationUsage.isTest,
      sentAt: communicationUsage.sentAt,
    })
      .from(communicationUsage)
      .where(eq(communicationUsage.clinicId, clinicId)),
  ]);

  const messages = {
    allTime: { sms: 0, whatsapp: 0, email: 0 },
    currentLocalMonth: { sms: 0, whatsapp: 0, email: 0 },
  };
  for (const row of messageRows) {
    if (row.isTest || !["sms", "whatsapp", "email"].includes(row.channel)) continue;
    const counts = row.status === "accepted" || (row.status === "failed" && row.billable);
    if (!counts) continue;
    const channel = row.channel as "sms" | "whatsapp" | "email";
    const units = Number(row.units ?? 0);
    messages.allTime[channel] += units;
    if (row.sentAt >= bounds.start && row.sentAt < bounds.end) {
      messages.currentLocalMonth[channel] += units;
    }
  }

  const [grants, exceptions] = await Promise.all([
    storage.getSubscriptionAccessGrants(clinicId),
    storage.getSubscriptionAccessExceptions(clinicId),
  ]);

  const usage: EffectiveEntitlementUsage = {
    bookings: {
      allTime: Number(bookingUsage[0]?.allTime ?? 0),
      currentLocalMonth: Number(bookingUsage[0]?.currentLocalMonth ?? 0),
    },
    activeDoctors: Number(doctorUsage[0]?.count ?? 0),
    liveSmileDeals: Number(dealUsage[0]?.count ?? 0),
    storageBytes: Number(storageUsage[0]?.bytes ?? 0),
    messages,
    measuredAt: now.toISOString(),
    timezone: clinic.timezone,
  };

  return resolveEffectiveEntitlements({
    clinicId,
    rawPlan: clinic.plan,
    rawSubscriptionStatus: clinic.subscriptionStatus,
    timezone: clinic.timezone,
    trialStartedAt: clinic.trialStartedAt,
    trialEndsAt: clinic.trialEndsAt,
    trialGraceEndsAt: clinic.trialGraceEndsAt,
    paidAccessExpiresAt: clinic.paidAccessExpiresAt,
    usage,
    activeGrants: grants,
    activeExceptions: exceptions,
    measuredAt: now,
    now,
  });
}