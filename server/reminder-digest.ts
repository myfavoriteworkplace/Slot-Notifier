import crypto from "node:crypto";
import { Resend } from "resend";
import { isDigestEligibleClinic } from "./reminder-policy";
import { db } from "./db";
import { doctors } from "@shared/schema";
import { isNotNull } from "drizzle-orm";
import { storage, type ReminderBooking, type ReminderResult } from "./storage";

export const REMINDER_DIGEST_TEMPLATE_VERSION = "v1";

export interface DigestRecipient {
  email: string;
  role: "clinic" | "doctor" | "combined";
  clinicId: number | null;
  doctorId: number | null;
  localDigestDate: string;
  reminders: ReminderResult;
}

export interface DigestJobResult {
  dryRun: boolean;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export function normalizeRecipientEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emptyReminderResult(): ReminderResult {
  return { nextThreeDays: [], comingWeek: [], totalCount: 0, generatedAt: "" };
}

function mergeReminderResults(left: ReminderResult, right: ReminderResult): ReminderResult {
  const byId = new Map<number, ReminderBooking>();
  for (const booking of [...left.nextThreeDays, ...left.comingWeek, ...right.nextThreeDays, ...right.comingWeek]) {
    byId.set(booking.bookingId, booking);
  }
  const all = [...byId.values()].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || a.bookingId - b.bookingId,
  );
  return {
    nextThreeDays: all.filter(booking => booking.dateGroup === "nextThreeDays"),
    comingWeek: all.filter(booking => booking.dateGroup === "comingWeek"),
    totalCount: all.length,
    generatedAt: right.generatedAt || left.generatedAt,
  };
}

export async function selectDigestRecipients(now = new Date()): Promise<DigestRecipient[]> {
  const recipients = new Map<string, DigestRecipient>();
  const clinics = await storage.getClinics(true);

  for (const clinic of clinics) {
    if (!isDigestEligibleClinic(clinic)) continue;
    const reminders = await storage.getClinicReminders(clinic.id, now);
    const email = normalizeRecipientEmail(clinic.email);
    if (!email) continue;
    const localDigestDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: clinic.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const key = `${email}|${localDigestDate}`;
    const existing = recipients.get(key);
    recipients.set(key, existing
      ? { ...existing, role: existing.role === "clinic" ? "combined" : existing.role, reminders: mergeReminderResults(existing.reminders, reminders) }
      : { email, role: "clinic", clinicId: clinic.id, doctorId: null, localDigestDate, reminders });
  }

  const doctorRows = await db.select({ id: doctors.id, email: doctors.email }).from(doctors).where(isNotNull(doctors.email));
  for (const doctor of doctorRows) {
    const reminders = await storage.getDoctorReminders(doctor.email, now);
    if (reminders.totalCount === 0) continue;
    const firstBooking = reminders.nextThreeDays[0] ?? reminders.comingWeek[0];
    if (!firstBooking) continue;
    const email = normalizeRecipientEmail(doctor.email);
    const localDigestDate = firstBooking.localDate;
    const key = `${email}|${localDigestDate}`;
    const existing = recipients.get(key);
    recipients.set(key, existing
      ? { ...existing, role: "combined", doctorId: doctor.id, reminders: mergeReminderResults(existing.reminders, reminders) }
      : { email, role: "doctor", clinicId: null, doctorId: doctor.id, localDigestDate, reminders });
  }

  return [...recipients.values()];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] as string);
}

export function renderReminderDigestEmail(recipient: DigestRecipient, dashboardUrl: string): string {
  const renderBooking = (booking: ReminderBooking) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #edf2ef;">
        <strong style="color:#0d1f1a;">${escapeHtml(booking.customerName)}</strong>
        <br/><span style="font-size:13px;color:#5a7a6a;">${escapeHtml(booking.localDate)} at ${escapeHtml(new Date(booking.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: booking.clinicTimezone }))}</span>
        ${booking.assignedDoctor ? `<br/><span style="font-size:12px;color:#71877d;">${escapeHtml(booking.assignedDoctor)}</span>` : ""}
      </td>
    </tr>`;
  const renderGroup = (title: string, bookings: ReminderBooking[]) => bookings.length === 0 ? "" : `
    <h3 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#5a9070;">${title}</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bookings.map(renderBooking).join("")}</table>`;
  const body = recipient.reminders.totalCount === 0
    ? `<p style="margin:24px 0;color:#374f43;line-height:1.6;">There are no upcoming appointments in the next seven calendar days.</p>`
    : `${renderGroup("Next 3 Days", recipient.reminders.nextThreeDays)}${renderGroup("Coming Week", recipient.reminders.comingWeek)}`;
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f0f5f2;font-family:Arial,sans-serif;color:#0d1f1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;background:#fff;border-radius:12px;padding:28px;">
        <tr><td><strong style="font-size:20px;">bookMySlot <span style="color:#1a9e6f;">DENTAL</span></strong>
        <h1 style="font-size:24px;margin:24px 0 4px;">Upcoming appointment reminders</h1>
        <p style="margin:0;color:#5a7a6a;">${recipient.reminders.totalCount} appointment${recipient.reminders.totalCount === 1 ? "" : "s"} in your reminder window</p>
        ${body}
        <p style="margin:28px 0 0;"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:11px 16px;background:#1a9e6f;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Open dashboard</a></p>
        </td></tr>
      </table>
    </td></tr></table></body></html>`;
}

export function digestContentHash(recipient: DigestRecipient, html: string): string {
  return crypto.createHash("sha256").update(`${REMINDER_DIGEST_TEMPLATE_VERSION}:${recipient.email}:${recipient.localDigestDate}:${html}`).digest("hex");
}

export async function runReminderDigestJob(now = new Date()): Promise<DigestJobResult> {
  const recipients = await selectDigestRecipients(now);
  const dryRun = process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY;
  const resend = dryRun ? null : new Resend(process.env.RESEND_API_KEY);
  const dashboardUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim() || "https://book-my-slot-client.onrender.com";
  const result: DigestJobResult = { dryRun, claimed: 0, sent: 0, skipped: 0, failed: 0 };

  for (const recipient of recipients) {
    const html = renderReminderDigestEmail(recipient, dashboardUrl);
    if (dryRun) continue;
    const claim = await storage.claimReminderDigest({
      recipientEmail: recipient.email,
      role: recipient.role,
      clinicId: recipient.clinicId,
      doctorId: recipient.doctorId,
      localDigestDate: recipient.localDigestDate,
      appointmentIds: [...recipient.reminders.nextThreeDays, ...recipient.reminders.comingWeek].map(booking => booking.bookingId),
      templateVersion: REMINDER_DIGEST_TEMPLATE_VERSION,
      contentHash: digestContentHash(recipient, html),
    });
    if (!claim) {
      result.skipped++;
      continue;
    }
    result.claimed++;
    try {
      const response = await resend!.emails.send({
        from: process.env.EMAIL_FROM || "BookMySlot <onboarding@resend.dev>",
        to: recipient.email,
        subject: "Your upcoming BookMySlot appointments",
        html,
      });
      if (response.error) throw new Error(response.error.message);
      await storage.markReminderDigestSent(claim.id);
      result.sent++;
    } catch (error) {
      result.failed++;
      await storage.markReminderDigestFailed(claim.id, error instanceof Error ? error.message : String(error));
    }
  }
  return result;
}