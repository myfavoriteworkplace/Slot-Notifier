import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import { api, errorSchemas } from "@shared/routes";
import { insertClinicSchema, insertBookingSchema, clinics, slots, bookings, notifications, doctorInvites, doctors, clinicDoctors, siteSettings, smileDeals, emailOtps, activationTokens } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from 'resend';
import { format } from 'date-fns';
import crypto from "crypto";
import { generateSignedUploadUrl } from "./signedUrl.service";
import { auditLog } from "./auditLog.middleware";
import ExcelJS from "exceljs";
import { sendWhatsAppBookingNotification, sendWhatsAppConfirmationNotification, sendWhatsAppConsentLink } from "./whatsapp.service";
import Razorpay from "razorpay";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { wakeAndAnalyse } from "./aiService";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'BookMySlot <onboarding@resend.dev>';
const RESEND_MODE = (process.env.RESEND || 'DEV').toUpperCase();
const TEST_EMAIL = 'itsmyfavoriteworkplace@gmail.com';

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

const RAZORPAY_PLAN_IDS: Record<string, Record<string, string | undefined>> = {
  starter: {
    monthly: process.env.RAZORPAY_PLAN_ID_STARTER_MONTHLY,
    annual:  process.env.RAZORPAY_PLAN_ID_STARTER_ANNUAL,
  },
  growth: {
    monthly: process.env.RAZORPAY_PLAN_ID_GROWTH_MONTHLY,
    annual:  process.env.RAZORPAY_PLAN_ID_GROWTH_ANNUAL,
  },
  pro: {
    monthly: process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY,
    annual:  process.env.RAZORPAY_PLAN_ID_PRO_ANNUAL,
  },
};

function makeGoogleCalLink(title: string, start: Date, location?: string | null): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(start)}/${fmt(end)}`;
  if (location) url += `&location=${encodeURIComponent(location)}`;
  return url;
}

// ─── EMAIL DESIGN SYSTEM ──────────────────────────────────────────────────────
// All 17 emails share one structural shell. Only the 4-px accent bar colour
// and the inner body HTML differ per template. See docs/email-design-system.md.
//
// Helpers:
//   logoBlock(onDark)              — "bookMySlot DENTAL" mark
//   emailShell(accentColor, body)  — outer card wrapper with consistent footer
//   heroBand(gradient, title, sub) — full-colour hero for celebratory emails
//   detailCard(fields, opts)       — 2-col responsive detail grid
//   infoBanner(type, html)         — amber / green / red / blue status notice
//   primaryButton(label, href, c)  — solid CTA button
//   splitButtons(...)              — side-by-side Accept / Decline pair
// ─────────────────────────────────────────────────────────────────────────────

function logoBlock(onDark = false): string {
  const text   = onDark ? 'white'                : '#0d1f1a';
  const tag    = onDark ? 'rgba(255,255,255,.7)' : '#1a9e6f';
  const iconBg = onDark ? 'rgba(255,255,255,.2)' : '#1a9e6f';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:34px;height:34px;background:${iconBg};border-radius:8px;text-align:center;vertical-align:middle;">
      <span style="font-size:17px;line-height:34px;color:white;">&#128197;</span>
    </td>
    <td style="padding-left:10px;vertical-align:middle;">
      <span style="font-size:16px;font-weight:700;color:${text};letter-spacing:-.3px;">bookMySlot</span>
      <span style="font-size:11px;color:${tag};font-weight:600;"> DENTAL</span>
    </td>
  </tr></table>`;
}

function emailShell(accentColor: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>BookMySlot Dental</title>
</head>
<body style="margin:0;padding:0;background:#f0f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f5f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.07);">
        <!-- 4-px accent bar — the only colour that changes between templates -->
        <tr><td style="height:4px;background:${accentColor};font-size:0;">&nbsp;</td></tr>
        ${body}
        <!-- consistent footer -->
        <tr><td style="padding:18px 40px;border-top:1px solid #edf2ef;">
          <p style="margin:0;font-size:11px;color:#a8b8b0;text-align:center;line-height:1.6;">
            bookMySlot Dental &nbsp;&middot;&nbsp; Automated message &nbsp;&middot;&nbsp;
            <a href="mailto:bookmyslot@mail.mossaic.in" style="color:#1a9e6f;text-decoration:none;">bookmyslot@mail.mossaic.in</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function heroBand(gradient: string, title: string, subtitle: string): string {
  return `<tr><td style="background:${gradient};padding:32px 40px;">
    ${logoBlock(true)}
    <p style="margin:20px 0 4px;font-size:26px;font-weight:700;color:white;letter-spacing:-.4px;">${title}</p>
    <p style="margin:0;font-size:15px;color:rgba(255,255,255,.82);line-height:1.5;">${subtitle}</p>
  </td></tr>`;
}

function detailCard(
  fields: { label: string; value: string; strikethrough?: boolean }[],
  accentColor = '#5a9070',
  cardBg      = '#f8fbf9',
  borderColor = '#d4ebe0',
): string {
  const pairs: string[] = [];
  for (let i = 0; i < fields.length; i += 2) {
    const a    = fields[i];
    const b    = fields[i + 1];
    const last = i + 2 >= fields.length;
    const cell = (f: { label: string; value: string; strikethrough?: boolean }) =>
      `<p style="margin:0;font-size:10px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:.08em;">${f.label}</p>
       <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${f.strikethrough ? '#9aaa9e' : '#0d1f1a'};${f.strikethrough ? 'text-decoration:line-through;' : ''}">${f.value}</p>`;
    pairs.push(`<tr>
      <td width="50%" style="${!last ? 'padding-bottom:14px;' : ''}vertical-align:top;">${cell(a)}</td>
      ${b
        ? `<td width="50%" style="${!last ? 'padding-bottom:14px;' : ''}vertical-align:top;">${cell(b)}</td>`
        : '<td width="50%"></td>'
      }
    </tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${cardBg};border:1px solid ${borderColor};border-radius:10px;">
    <tr><td style="padding:20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${pairs.join('')}
      </table>
    </td></tr>
  </table>`;
}

function infoBanner(type: 'amber' | 'green' | 'red' | 'blue', html: string): string {
  const s = {
    amber: { bg: '#fef9ec', border: '#f0c870', text: '#7a5010' },
    green: { bg: '#f0faf5', border: '#a8dfc4', text: '#2d6a4a' },
    red:   { bg: '#fff5f5', border: '#fca5a5', text: '#8b2020' },
    blue:  { bg: '#f0f6ff', border: '#bfdbfe', text: '#1e4ba0' },
  }[type];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${s.bg};border:1px solid ${s.border};border-radius:8px;">
    <tr><td style="padding:13px 18px;">
      <p style="margin:0;font-size:13px;color:${s.text};line-height:1.6;">${html}</p>
    </td></tr>
  </table>`;
}

function primaryButton(label: string, href: string, color = '#1a9e6f'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
    <tr><td style="border-radius:8px;background:${color};">
      <a href="${href}" style="display:inline-block;padding:13px 32px;background:${color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;letter-spacing:.01em;">${label}</a>
    </td></tr>
  </table>`;
}

function splitButtons(
  leftLabel: string,  leftHref: string,  leftColor: string,
  rightLabel: string, rightHref: string,
): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="48%" align="center">
        <a href="${leftHref}" style="display:block;background:${leftColor};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 16px;border-radius:8px;text-align:center;">${leftLabel}</a>
      </td>
      <td width="4%"></td>
      <td width="48%" align="center">
        <a href="${rightHref}" style="display:block;background:#fff5f5;color:#dc2626;text-decoration:none;font-size:13px;font-weight:600;padding:11px 16px;border-radius:8px;text-align:center;border:1.5px solid #fca5a5;">${rightLabel}</a>
      </td>
    </tr>
  </table>`;
}

// Legacy shims — keeps any remaining call-sites outside named email functions compiling
function detailsTable(rows: { label: string; value: string; mono?: boolean }[]): string {
  return detailCard(rows.map(r => ({ label: r.label, value: r.value })));
}
function actionButton(label: string, href: string, color = '#1a9e6f'): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background:${color};color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">${label}</a>`;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'Bms@';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sendOtpEmail(code: string, recipientName?: string): string {
  const greeting = recipientName
    ? `Hi <strong style="color:#0d1f1a;">${recipientName}</strong>, use the code below to verify your email and complete your request.`
    : `Use the code below to verify your email address.`;
  return emailShell(
    'linear-gradient(90deg,#0f9b6e,#1dbe88)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 36px;">
      <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Verify your email</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">${greeting}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"
            style="background:#f0faf5;border:1.5px solid #a8dfc4;border-radius:12px;">
            <tr><td style="padding:28px 48px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#3b8c62;text-transform:uppercase;letter-spacing:.1em;">Your verification code</p>
              <p style="margin:0;font-size:52px;font-weight:700;color:#0d7a50;letter-spacing:.35em;font-family:'Courier New',Courier,monospace;line-height:1.1;">${code}</p>
              <p style="margin:10px 0 0;font-size:12px;color:#7aaa8e;">Expires in <strong>5 minutes</strong></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#8fa89a;line-height:1.6;">If you didn't request this, you can safely ignore this email. The code will expire automatically.</p>
    </td></tr>`
  );
}

async function sendBookingEmails(
  customerEmail: string,
  customerName: string,
  clinicEmail: string | null,
  clinicName: string,
  startTime: Date,
  customerPhone?: string | null,
  clinicPhone?: string | null,
  bookingId?: number | null,
) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured.`);
    return;
  }
  const finalCustomerEmail = RESEND_MODE === 'PRODUCTION' ? customerEmail : TEST_EMAIL;
  const finalClinicEmail   = RESEND_MODE === 'PRODUCTION' ? clinicEmail   : TEST_EMAIL;
  const apptDate  = startTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const apptTime  = startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const calLink   = makeGoogleCalLink(`Appointment at ${clinicName}`, startTime);
  const refNum    = bookingId ? `BMS-${bookingId}` : '—';
  const dashLink  = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login`;

  // ── Patient: booking received ───────────────────────────────────────────────
  const patientHtml = emailShell(
    'linear-gradient(90deg,#0f9b6e,#1dbe88)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Booking received ✓</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">Hi <strong style="color:#0d1f1a;">${customerName}</strong>, your appointment request has been received. The clinic will confirm it shortly.</p>
      ${detailCard([
        { label: 'Clinic',    value: clinicName },
        { label: 'Reference', value: refNum },
        { label: 'Date',      value: apptDate },
        { label: 'Time',      value: apptTime },
      ])}
      <div style="margin-top:16px;">${infoBanner('amber', '&#9203; <strong>Awaiting confirmation</strong> — The clinic will confirm your booking within 1 working day. You\'ll receive another email once confirmed.')}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
        <tr><td align="center">${primaryButton('&#128197; &nbsp;Add to Google Calendar', calLink)}</td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#8fa89a;line-height:1.6;">Questions? Contact <strong style="color:#0d1f1a;">${clinicName}</strong> directly or reply to this email.</p>
    </td></tr>`
  );

  // ── Clinic admin: new booking request ──────────────────────────────────────
  const clinicHtml = emailShell(
    'linear-gradient(90deg,#2563eb,#3b82f6)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">New booking request</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">A patient has requested an appointment at <strong style="color:#0d1f1a;">${clinicName}</strong>. Log in to confirm or manage this booking.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:#f0f6ff;border:1px solid #bfdbfe;border-radius:10px;">
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding-bottom:12px;border-bottom:1px solid #dbeafe;">
              <p style="margin:0;font-size:10px;font-weight:600;color:#3b6ac2;text-transform:uppercase;letter-spacing:.08em;">Patient</p>
              <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0d1f1a;">${customerName}</p>
              <p style="margin:2px 0 0;font-size:13px;color:#5a7a6a;">${customerPhone ? customerPhone + ' &nbsp;&middot;&nbsp; ' : ''}${customerEmail}</p>
            </td></tr>
            <tr><td style="padding-top:12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="34%"><p style="margin:0;font-size:10px;font-weight:600;color:#3b6ac2;text-transform:uppercase;letter-spacing:.08em;">Date</p><p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0d1f1a;">${apptDate}</p></td>
                <td width="33%"><p style="margin:0;font-size:10px;font-weight:600;color:#3b6ac2;text-transform:uppercase;letter-spacing:.08em;">Time</p><p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0d1f1a;">${apptTime}</p></td>
                <td width="33%"><p style="margin:0;font-size:10px;font-weight:600;color:#3b6ac2;text-transform:uppercase;letter-spacing:.08em;">Ref</p><p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0d1f1a;">${refNum}</p></td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr><td align="center">${primaryButton('Open dashboard to confirm', dashLink, '#2563eb')}</td></tr>
      </table>
    </td></tr>`
  );

  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalCustomerEmail,
      subject: `${clinicName} – Booking Received`,
      html: patientHtml,
    });
    if (finalClinicEmail) {
      await resend.emails.send({
        from: EMAIL_FROM, to: finalClinicEmail,
        subject: `New Booking Received – ${customerName} on ${apptDate}`,
        html: clinicHtml,
      });
    }
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send booking emails:', error);
  }
}

async function sendConfirmationEmail(
  customerEmail: string,
  customerName: string,
  clinicName: string,
  startTime: Date,
  doctorName?: string | null,
  clinicPhone?: string | null,
  clinicAddress?: string | null,
  clinicEmail?: string | null,
  bookingId?: number | null,
  lat?: number | null,
  lng?: number | null,
) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured — confirmation email skipped.`);
    return;
  }
  const finalEmail  = RESEND_MODE === 'PRODUCTION' ? customerEmail : TEST_EMAIL;
  const apptDate    = startTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const apptTime    = startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const refNum      = bookingId ? `BMS-${bookingId}` : '—';
  const calLink     = makeGoogleCalLink(`Appointment at ${clinicName}`, startTime, clinicAddress);
  const mapsLink    = (lat != null && lng != null)
    ? `https://maps.google.com/?q=${lat},${lng}`
    : clinicAddress ? `https://maps.google.com/?q=${encodeURIComponent(clinicAddress)}` : null;

  const detailFields: { label: string; value: string }[] = [
    { label: 'Clinic',    value: clinicName },
    ...(doctorName ? [{ label: 'Doctor', value: `Dr. ${doctorName}` }] : [{ label: 'Reference', value: refNum }]),
    { label: 'Date',      value: apptDate },
    { label: 'Time',      value: apptTime },
    ...(doctorName ? [{ label: 'Reference', value: refNum }, ...(clinicPhone ? [{ label: 'Phone', value: clinicPhone }] : [])] : (clinicPhone ? [{ label: 'Phone', value: clinicPhone }, { label: '', value: '' }] : [])),
  ].filter(f => !(f.label === '' && f.value === ''));

  const html = emailShell(
    'linear-gradient(90deg,#0f9b6e,#1dbe88)',
    `${heroBand('linear-gradient(135deg,#0d7a50 0%,#1a9e6f 100%)', 'Appointment confirmed &#127881;', `Hi <strong style="color:rgba(255,255,255,.95);">${customerName}</strong> — we\'re looking forward to seeing you.`)}
    <tr><td style="padding:28px 40px 0;">
      ${detailCard(detailFields)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr>
          ${mapsLink ? `<td width="48%" align="center"><a href="${mapsLink}" style="display:block;background:#1a9e6f;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 16px;border-radius:8px;text-align:center;">&#128205; &nbsp;Get directions</a></td><td width="4%"></td>` : ''}
          <td width="${mapsLink ? '48' : '100'}%" align="center">
            ${clinicPhone
              ? `<a href="tel:${clinicPhone}" style="display:block;background:#f0faf5;color:#0d7a50;text-decoration:none;font-size:13px;font-weight:600;padding:12px 16px;border-radius:8px;text-align:center;border:1.5px solid #a8dfc4;">&#128222; &nbsp;Call clinic</a>`
              : `<a href="${calLink}" style="display:block;background:#f0faf5;color:#0d7a50;text-decoration:none;font-size:13px;font-weight:600;padding:12px 16px;border-radius:8px;text-align:center;border:1.5px solid #a8dfc4;">&#128197; &nbsp;Add to Calendar</a>`
            }
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#8fa89a;line-height:1.6;">Please arrive 5 minutes early.${clinicPhone ? ` If you need to reschedule, call <strong style="color:#0d1f1a;">${clinicPhone}</strong>.` : ''}</p>
    </td></tr>`
  );

  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `${clinicName} – Your Appointment is Confirmed`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send confirmation email:', error);
  }
}

async function sendCancellationEmail(email: string, name: string, date: Date, clinic: string, clinicPhone?: string | null, bookingId?: number | null, reason?: string | null) {
  if (!resend) return;
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? email : TEST_EMAIL;
  const apptDate   = date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const apptTime   = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const refNum     = bookingId ? `BMS-${bookingId}` : '—';
  const detailRows: { label: string; value: string; strikethrough?: boolean }[] = [
    { label: 'Clinic',        value: clinic },
    { label: 'Reference',     value: refNum },
    { label: 'Was scheduled', value: apptDate, strikethrough: true },
    { label: 'Time',          value: apptTime, strikethrough: true },
  ];
  if (reason) detailRows.push({ label: 'Reason', value: reason });
  const html = emailShell(
    'linear-gradient(90deg,#dc2626,#ef4444)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Appointment cancelled</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">Hi <strong style="color:#0d1f1a;">${name}</strong>, we're sorry to let you know that your appointment has been cancelled.</p>
      ${detailCard(detailRows, '#e05050', '#fff5f5', '#fca5a5')}
      <div style="margin-top:16px;">${infoBanner('green', `To book a new appointment, please contact <strong>${clinic}</strong>${clinicPhone ? ` at <strong>${clinicPhone}</strong>` : ' directly'}. Their team will be happy to help you find a suitable time.`)}</div>
      <p style="margin:20px 0 0;font-size:13px;color:#8fa89a;line-height:1.6;">We apologise for any inconvenience caused.</p>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `${clinic} – Appointment Cancelled`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send cancellation email:', error);
  }
}

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again after 15 minutes" },
});

// OTP send: max 5 requests per IP per 10 minutes (public endpoint, email cost + abuse risk)
const otpSendRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Please wait 10 minutes before trying again." },
});

// OTP verify: max 10 attempts per IP per 10 minutes (prevents brute-force)
const otpVerifyRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification attempts. Please wait before trying again." },
});

// Public booking creation: max 20 per IP per hour (prevents spam bookings)
const bookingCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many booking requests. Please try again later." },
});

// Consent form sign: max 10 per IP per hour (public endpoint, prevents replay attacks)
const consentSignRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many consent submissions. Please try again later." },
});

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const sess = req.session as any;
  if (req.session && (sess.adminLoggedIn || sess.doctorLoggedIn)) {
    (req as any).user = {
      claims: {
        sub: sess.role === 'doctor' ? (sess.doctorId || sess.doctorEmail) : 'admin',
        email: sess.role === 'doctor' ? sess.doctorEmail : sess.adminEmail,
      },
      id: sess.clinicId || 'superuser',
      role: sess.role || (sess.clinicId ? 'owner' : 'superuser')
    };
    return next();
  }
  return res.status(401).json({ message: "Authentication required" });
}

async function sendDoctorAssignmentEmail(
  doctorEmail: string,
  doctorName: string,
  patientName: string,
  clinicName: string,
  startTime: Date,
  bookingId: number,
) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured — doctor assignment email skipped.`);
    return;
  }
  const finalEmail  = RESEND_MODE === 'PRODUCTION' ? doctorEmail : TEST_EMAIL;
  const apptDate    = startTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const apptTime    = startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dashLink    = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login?tab=doctor`;
  const html = emailShell(
    'linear-gradient(90deg,#7c3aed,#a78bfa)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">New appointment assigned</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">Hi <strong style="color:#0d1f1a;">Dr. ${doctorName}</strong>, a new appointment has been assigned to you and is <strong style="color:#0d1f1a;">awaiting your approval</strong>.</p>
      ${detailCard([
        { label: 'Patient',   value: patientName },
        { label: 'Clinic',    value: clinicName },
        { label: 'Date',      value: apptDate },
        { label: 'Time',      value: apptTime },
        { label: 'Reference', value: `BMS-${bookingId}` },
        { label: '',          value: '' },
      ].filter(f => !(f.label === '' && f.value === '')), '#6d3abf', '#faf5ff', '#e9d5ff')}
      <div style="margin-top:16px;">${infoBanner('amber', '&#9203; Please log in to your doctor portal to <strong>accept or decline</strong> this appointment before the scheduled time.')}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr><td align="center">${primaryButton('View in Doctor Portal', dashLink, '#7c3aed')}</td></tr>
      </table>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `${clinicName} – New Appointment Assigned`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send doctor assignment email:', error);
  }
}

async function sendDoctorAdminConfirmEmail(
  doctorEmail: string,
  doctorName: string,
  patientName: string,
  clinicName: string,
  startTime: Date,
  bookingId: number,
) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured — doctor admin-confirm email skipped.`);
    return;
  }
  const finalEmail  = RESEND_MODE === 'PRODUCTION' ? doctorEmail : TEST_EMAIL;
  const apptDate    = startTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const apptTime    = startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const calLink     = makeGoogleCalLink(`Patient: ${patientName} at ${clinicName}`, startTime);
  const dashLink    = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login?tab=doctor`;
  const html = emailShell(
    'linear-gradient(90deg,#d97706,#f59e0b)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Added to your schedule</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">Hi <strong style="color:#0d1f1a;">Dr. ${doctorName}</strong>, the clinic admin confirmed an appointment on your behalf. It is now active on your schedule.</p>
      ${detailCard([
        { label: 'Patient',   value: patientName },
        { label: 'Clinic',    value: clinicName },
        { label: 'Date',      value: apptDate },
        { label: 'Time',      value: apptTime },
        { label: 'Reference', value: `BMS-${bookingId}` },
        { label: '',          value: '' },
      ].filter(f => !(f.label === '' && f.value === '')), '#a16207', '#fefce8', '#fde68a')}
      <div style="margin-top:16px;">${infoBanner('amber', 'This appointment was confirmed by the clinic admin without waiting for your approval. If you have a conflict, please contact the clinic directly.')}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr>
          <td width="48%" align="center"><a href="${calLink}" style="display:block;background:#d97706;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 16px;border-radius:8px;text-align:center;">&#128197; &nbsp;Add to Calendar</a></td>
          <td width="4%"></td>
          <td width="48%" align="center"><a href="${dashLink}" style="display:block;background:#fefce8;color:#a16207;text-decoration:none;font-size:13px;font-weight:600;padding:11px 16px;border-radius:8px;text-align:center;border:1.5px solid #fde68a;">View in portal</a></td>
        </tr>
      </table>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `${clinicName} – Appointment Added to Your Schedule`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send doctor admin-confirm email:', error);
  }
}

async function sendAdminDoctorDeclineEmail(
  adminEmail: string,
  clinicName: string,
  doctorName: string,
  patientName: string,
  startTime: Date,
  bookingId: number,
) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured — admin doctor-decline email skipped.`);
    return;
  }
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? adminEmail : TEST_EMAIL;
  const apptDate   = startTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const apptTime   = startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dashLink   = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login`;
  const html = emailShell(
    'linear-gradient(90deg,#dc2626,#ef4444)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Action needed: doctor declined</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;"><strong style="color:#0d1f1a;">Dr. ${doctorName}</strong> has declined the appointment below. Please log in to reassign a doctor before the patient's slot time.</p>
      ${detailCard([
        { label: 'Patient',   value: patientName },
        { label: 'Doctor',    value: `Dr. ${doctorName}` },
        { label: 'Date',      value: apptDate },
        { label: 'Time',      value: apptTime },
        { label: 'Clinic',    value: clinicName },
        { label: 'Reference', value: `BMS-${bookingId}` },
      ], '#c02020', '#fff5f5', '#fca5a5')}
      <div style="margin-top:16px;">${infoBanner('red', '&#128680; The patient has not yet been notified. Reassign a doctor promptly to avoid disruption.')}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr><td align="center">${primaryButton('Reassign doctor now', dashLink, '#dc2626')}</td></tr>
      </table>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `Action Needed – Dr. ${doctorName} Declined on ${apptDate}`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send admin doctor-decline email:', error);
  }
}

async function sendDoctorInviteEmail(email: string, clinicName: string, inviteLink: string) {
  if (!resend) return;
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? email : TEST_EMAIL;
  const html = emailShell(
    'linear-gradient(90deg,#7c3aed,#a78bfa)',
    `${heroBand('linear-gradient(135deg,#5b21b6 0%,#7c3aed 100%)', `You're invited to join ${clinicName}`, 'Set up your Doctor Portal account and start managing your appointments.')}
    <tr><td style="padding:28px 40px 0;">
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;"><strong style="color:#0d1f1a;">${clinicName}</strong> has added you as a doctor on bookMySlot Dental. Accept the invitation to create your account.</p>
      ${infoBanner('amber', '&#9203; This invitation link expires in <strong>72 hours</strong>. If you did not expect this email, you can safely ignore it.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
        <tr><td align="center">${primaryButton('Set Up My Account', inviteLink, '#7c3aed')}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#a8b8b0;text-align:center;">Or copy this link: <a href="${inviteLink}" style="color:#7c3aed;text-decoration:none;word-break:break-all;">${inviteLink}</a></p>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `${clinicName} – You're Invited to Join`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send doctor invite email:', error);
  }
}

async function sendDoctorWelcomeEmail(email: string, doctorName: string, clinicName: string, tempPassword: string) {
  const loginUrl = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login?tab=doctor`;
  if (!resend) {
    console.log(`[EMAIL MOCK] Doctor welcome: ${email} — Login: ${email}, Password: ${tempPassword}`);
    return;
  }
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? email : TEST_EMAIL;
  const html = emailShell(
    'linear-gradient(90deg,#7c3aed,#a78bfa)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Your login credentials</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">Hi <strong style="color:#0d1f1a;">Dr. ${doctorName}</strong>, you've been added to <strong style="color:#0d1f1a;">${clinicName}</strong> on bookMySlot Dental. Use the details below to sign in.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;">
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr style="border-bottom:1px solid #e9d5ff;">
              <td style="padding-bottom:12px;width:42%;vertical-align:top;">
                <p style="margin:0;font-size:10px;font-weight:600;color:#6d3abf;text-transform:uppercase;letter-spacing:.08em;">Login email</p>
              </td>
              <td style="padding-bottom:12px;vertical-align:top;">
                <p style="margin:0;font-size:13px;font-weight:600;color:#0d1f1a;font-family:'Courier New',Courier,monospace;">${email}</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top:12px;vertical-align:top;">
                <p style="margin:0;font-size:10px;font-weight:600;color:#6d3abf;text-transform:uppercase;letter-spacing:.08em;">Temp password</p>
              </td>
              <td style="padding-top:12px;vertical-align:top;">
                <p style="margin:0;font-size:18px;font-weight:700;color:#7c3aed;font-family:'Courier New',Courier,monospace;letter-spacing:.1em;">${tempPassword}</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
      <div style="margin-top:16px;">${infoBanner('amber', '&#128274; Please change your password after your first login. Keep these credentials safe and do not share them.')}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr><td align="center">${primaryButton('Sign In to Doctor Portal', loginUrl, '#7c3aed')}</td></tr>
      </table>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `${clinicName} – Your Login Credentials`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send doctor welcome email:', error);
  }
}

async function sendRescheduleEmail(
  customerEmail: string,
  customerName: string,
  clinicName: string,
  oldTime: Date,
  newTime: Date,
  clinicPhone?: string | null,
  bookingId?: number | null,
) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured — reschedule email skipped.`);
    return;
  }
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? customerEmail : TEST_EMAIL;
  const fmtDate: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const fmtTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const oldDate  = oldTime.toLocaleDateString('en-IN', fmtDate);
  const oldTm    = oldTime.toLocaleTimeString('en-IN', fmtTime);
  const newDate  = newTime.toLocaleDateString('en-IN', fmtDate);
  const newTm    = newTime.toLocaleTimeString('en-IN', fmtTime);
  const refNum   = bookingId ? `BMS-${bookingId}` : '—';
  const calLink  = makeGoogleCalLink(`Appointment at ${clinicName}`, newTime);
  const html = emailShell(
    'linear-gradient(90deg,#d97706,#f59e0b)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Appointment rescheduled</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">Hi <strong style="color:#0d1f1a;">${customerName}</strong>, your appointment at <strong style="color:#0d1f1a;">${clinicName}</strong> has been moved to a new time.</p>
      <!-- Old / New side-by-side -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="44%" style="background:#fff5f5;border:1px solid #fca5a5;border-radius:10px;padding:16px 18px;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:600;color:#c02020;text-transform:uppercase;letter-spacing:.08em;">Previous</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:#9aaa9e;text-decoration:line-through;">${oldDate}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#b0b8b4;text-decoration:line-through;">${oldTm}</p>
          </td>
          <td width="12%" style="text-align:center;vertical-align:middle;font-size:20px;color:#a8b8b0;">&#8594;</td>
          <td width="44%" style="background:#f0faf5;border:1px solid #a8dfc4;border-radius:10px;padding:16px 18px;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:600;color:#3b8c62;text-transform:uppercase;letter-spacing:.08em;">New time</p>
            <p style="margin:0;font-size:13px;font-weight:700;color:#0d7a50;">${newDate}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#3b8c62;">${newTm}</p>
          </td>
        </tr>
      </table>
      <div style="margin-top:16px;">
        ${detailCard([
          { label: 'Clinic',    value: clinicName },
          { label: 'Reference', value: refNum },
          ...(clinicPhone ? [{ label: 'Clinic phone', value: clinicPhone }, { label: '', value: '' }] : []),
        ].filter(f => !(f.label === '' && f.value === '')))}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr><td align="center">${primaryButton('&#128197; &nbsp;Update Calendar', calLink)}</td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#8fa89a;line-height:1.6;">If this new time does not work for you, please contact ${clinicName} directly${clinicPhone ? ` at <strong style="color:#0d1f1a;">${clinicPhone}</strong>` : ''}.</p>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `${clinicName} – Appointment Rescheduled`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send reschedule email:', error);
  }
}

async function sendClinicApprovalEmail(
  clinicName: string,
  clinicEmail: string,
  username: string,
  plainPassword: string,
  activationUrl?: string,
  planLabel?: string,
) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Clinic approval email for ${clinicEmail} — username: ${username}, password: ${plainPassword}${activationUrl ? `, activation: ${activationUrl}` : ''}`);
    return;
  }
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? clinicEmail : TEST_EMAIL;
  const loginUrl   = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login`;
  const html = emailShell(
    'linear-gradient(90deg,#0f9b6e,#1dbe88)',
    `${heroBand('linear-gradient(135deg,#085041 0%,#0f9b6e 100%)', 'Your clinic is approved &#127881;', `Welcome to bookMySlot Dental, <strong style="color:rgba(255,255,255,.95);">${clinicName}</strong>`)}
    <tr><td style="padding:28px 40px 0;">
      <p style="margin:0 0 20px;font-size:15px;color:#5a7a6a;line-height:1.5;">Your registration has been reviewed and approved. Use the credentials below to log in and start managing your appointments.</p>
      <!-- Credentials card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:#f8fbf9;border:1px solid #d4ebe0;border-radius:10px;">
        <tr><td style="padding:6px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr style="border-bottom:1px solid #d4ebe0;">
              <td style="padding:12px 20px;width:38%;vertical-align:top;">
                <p style="margin:0;font-size:10px;font-weight:600;color:#5a9070;text-transform:uppercase;letter-spacing:.08em;">Username</p>
              </td>
              <td style="padding:12px 20px;vertical-align:top;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#0d7a50;font-family:'Courier New',Courier,monospace;">${username}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 20px;vertical-align:top;">
                <p style="margin:0;font-size:10px;font-weight:600;color:#5a9070;text-transform:uppercase;letter-spacing:.08em;">Password</p>
              </td>
              <td style="padding:12px 20px;vertical-align:top;">
                <p style="margin:0;font-size:18px;font-weight:700;color:#0d7a50;font-family:'Courier New',Courier,monospace;letter-spacing:.1em;">${plainPassword}</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
      <div style="margin-top:16px;">${infoBanner('amber', '&#128274; Keep this email safe and do not share your credentials. Please change your password after your first login.')}</div>
      ${activationUrl ? `
      <div style="margin-top:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:linear-gradient(135deg,#085041 0%,#1a9e6f 100%);border-radius:10px;">
          <tr><td style="padding:20px 24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:rgba(255,255,255,.9);">Next step — Activate your subscription${planLabel ? ` (${planLabel})` : ''}</p>
            <p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,.7);line-height:1.5;">Complete your payment to unlock all dashboard features. This link expires in 7 days.</p>
            <a href="${activationUrl}" style="display:inline-block;background:white;color:#085041;text-decoration:none;font-size:13px;font-weight:700;padding:11px 28px;border-radius:8px;">Activate &amp; Pay</a>
          </td></tr>
        </table>
      </div>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr><td align="center">${primaryButton('Go to Clinic Dashboard', loginUrl)}</td></tr>
      </table>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `BookMySlot – Your Clinic is Approved`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send clinic approval email:', error);
  }
}

async function sendPasswordResetEmail(toEmail: string, resetUrl: string, userType: "clinic" | "doctor") {
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? toEmail : TEST_EMAIL;
  if (!resend) {
    console.log(`[EMAIL MOCK] Password reset for ${toEmail}: ${resetUrl}`);
    return;
  }
  const html = emailShell(
    'linear-gradient(90deg,#d97706,#f59e0b)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Reset your password</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">We received a request to reset your bookMySlot Dental password. Click the button below to choose a new one.</p>
      ${infoBanner('amber', '&#9203; This link expires in <strong>30 minutes</strong>. If it expires, request a new one from the login page.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
        <tr><td align="center">${primaryButton('Reset my password', resetUrl, '#d97706')}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#a8b8b0;text-align:center;">Or: <a href="${resetUrl}" style="color:#d97706;text-decoration:none;word-break:break-all;">${resetUrl}</a></p>
      <p style="margin:20px 0 0;font-size:13px;color:#8fa89a;line-height:1.6;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `BookMySlot – Reset Your Password (expires in 30 min)`,
      html,
    });
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send password reset email:', err);
  }
}

async function sendPasswordChangedEmail(toEmail: string, userType: "clinic" | "doctor") {
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? toEmail : TEST_EMAIL;
  if (!resend) {
    console.log(`[EMAIL MOCK] Password changed confirmation for ${toEmail}`);
    return;
  }
  const changedAt = new Date().toLocaleString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const html = emailShell(
    'linear-gradient(90deg,#0f9b6e,#1dbe88)',
    `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
    <tr><td style="padding:24px 40px 0;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">Password changed ✓</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">Your bookMySlot Dental password was successfully changed on <strong style="color:#0d1f1a;">${changedAt}</strong>.</p>
      ${infoBanner('green', '&#10003; &nbsp;Your account is secure. No further action is needed.')}
      <div style="margin-top:12px;">${infoBanner('red', '&#128274; <strong>Didn\'t make this change?</strong> Contact us immediately at <a href="mailto:bookmyslot@mail.mossaic.in" style="color:#dc2626;text-decoration:none;font-weight:600;">bookmyslot@mail.mossaic.in</a> to secure your account.')}</div>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM, to: finalEmail,
      subject: `BookMySlot – Password Changed Successfully`,
      html,
    });
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send password changed email:', err);
  }
}

// In-memory admin OTP store — single admin, one active OTP at a time
let adminOtpStore: { otp: string; expiresAt: number } | null = null;

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ── WebSocket server for real-time clinic + doctor notifications ─────────
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/notifications" });
  const clinicSockets = new Map<string, Set<WebSocket>>();
  const doctorSockets = new Map<string, Set<WebSocket>>();

  function broadcastToClinic(clinicId: string, data: object) {
    const clients = clinicSockets.get(clinicId);
    if (!clients) return;
    const message = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  function broadcastToDoctor(doctorId: string, data: object) {
    const clients = doctorSockets.get(doctorId);
    if (!clients) return;
    const message = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  wss.on("connection", (ws) => {
    let registeredClinicId: string | null = null;
    let registeredDoctorId: string | null = null;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth" && msg.clinicId) {
          registeredClinicId = String(msg.clinicId);
          if (!clinicSockets.has(registeredClinicId)) clinicSockets.set(registeredClinicId, new Set());
          clinicSockets.get(registeredClinicId)!.add(ws);
          ws.send(JSON.stringify({ type: "auth_ok" }));
        } else if (msg.type === "auth" && msg.doctorId) {
          registeredDoctorId = String(msg.doctorId);
          if (!doctorSockets.has(registeredDoctorId)) doctorSockets.set(registeredDoctorId, new Set());
          doctorSockets.get(registeredDoctorId)!.add(ws);
          ws.send(JSON.stringify({ type: "auth_ok" }));
        }
      } catch {}
    });

    ws.on("close", () => {
      if (registeredClinicId) clinicSockets.get(registeredClinicId)?.delete(ws);
      if (registeredDoctorId) doctorSockets.get(registeredDoctorId)?.delete(ws);
    });

    ws.on("error", () => {});
  });
  // ─────────────────────────────────────────────────────────────────────────

  const isAdmin = (req: any, res: any, next: any) => {
    const sess = req.session as any;
    if (sess && sess.adminLoggedIn && sess.role === 'superuser') return next();
    res.status(403).json({ message: "Admin access required" });
  };

  // ── PII Audit Logging ─────────────────────────────────────────────────────
  // Group-level fire-and-forget middleware. Covers every route under each
  // prefix automatically — no need to touch individual route handlers.
  // Logs are written after the response is sent (res.on("finish")) so they
  // never slow down a request. Failed writes are console-logged only.
  app.use("/api/auth/clinic/bookings",    auditLog({ resource: "booking" }));
  app.use("/api/auth/clinic/patients",    auditLog({ resource: "patient" }));
  app.use("/api/auth/clinic/bills",       auditLog({ resource: "bill" }));
  app.use("/api/auth/clinic/export",      auditLog({ resource: "export",           action: "export" }));
  app.use("/api/auth/clinic/booking-notes", auditLog({ resource: "booking_note" }));
  app.use("/api/clinical-records",        auditLog({ resource: "clinical_record" }));
  app.use("/api/consent",                 auditLog({ resource: "consent",          action: "sign" }));
  app.use("/api/xray",                    auditLog({ resource: "xray" }));
  app.use("/api/auth/doctor/bookings",    auditLog({ resource: "booking" }));
  app.use("/api/auth/doctor/patients",    auditLog({ resource: "patient" }));
  // ─────────────────────────────────────────────────────────────────────────

  app.post("/api/clinics/register", async (req, res) => {
    try {
      const {
        verifiedToken, email,
        username: _u, passwordHash: _p,
        googleBusinessUrl, gstNumber, medicalLicenseUrl, clinicRegCertUrl,
        ...rest
      } = req.body;

      if (!verifiedToken || !email) {
        return res.status(401).json({ message: "Email verification is required to register a clinic" });
      }

      const [otpRow] = await db.select().from(emailOtps)
        .where(and(
          eq(emailOtps.verified, true),
          eq(emailOtps.verifiedToken, verifiedToken),
          eq(emailOtps.email, email.toLowerCase()),
          eq(emailOtps.purpose, "clinic_registration"),
          sql`${emailOtps.expiresAt} > NOW()`
        ))
        .limit(1);

      if (!otpRow) {
        return res.status(401).json({ message: "Email verification expired or invalid. Please verify your email and try again." });
      }

      // Compute trust score server-side
      const trustScore = (() => {
        let score = 0;
        if (rest.name) score += 7;
        if (rest.address || rest.city) score += 7;
        if (rest.pincode) score += 6;
        const digits = (rest.phone || "").replace(/\D/g, "");
        if (digits.length >= 10) score += 30;
        const isGenericEmail = /gmail\.|yahoo\.|hotmail\.|outlook\.|rediffmail\./.test(email.toLowerCase());
        score += isGenericEmail ? 10 : 15;
        if (medicalLicenseUrl) score += 15;
        if (clinicRegCertUrl) score += 10;
        if (googleBusinessUrl) score += 15;
        if (gstNumber) score += 10;
        return Math.min(score, 100);
      })();

      // Username and password are not set at registration — generated on admin approval
      const clinic = await storage.createClinic({
        ...rest, email,
        status: "pending", isArchived: false,
        username: null, passwordHash: null,
        googleBusinessUrl: googleBusinessUrl || null,
        gstNumber: gstNumber || null,
        medicalLicenseUrl: medicalLicenseUrl || null,
        clinicRegCertUrl: clinicRegCertUrl || null,
        trustScore,
      } as any);

      // Consume the token — one use only
      await db.delete(emailOtps).where(eq(emailOtps.id, otpRow.id));

      res.status(201).json(clinic);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/clinics/:id/approve", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Only superusers can approve clinics" });
    try {
      const clinicId = parseInt(req.params.id);
      const existing = await storage.getClinic(clinicId);
      if (!existing) return res.status(404).json({ message: "Clinic not found" });

      // Resolve plan and billing cycle — admin can override, otherwise use registration choice
      const plan: string = req.body.plan || existing.plan || "starter";
      const billingCycle: string = req.body.billingCycle || existing.billingCycle || "monthly";

      // Generate a meaningful username from the clinic name
      const base = existing.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 30);

      let username = base;
      let suffix = 2;
      while (await storage.getClinicByUsername(username)) {
        username = `${base}_${suffix}`;
        suffix++;
      }

      // Generate a secure readable temporary password
      const adjectives = ["bright", "swift", "clear", "smart", "care", "prime", "vital", "safe"];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const digits = Math.floor(1000 + Math.random() * 9000).toString();
      const symbols = ["@", "#", "!"];
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const plainPassword = `${adj.charAt(0).toUpperCase()}${adj.slice(1)}${digits}${sym}`;

      const passwordHash = await bcrypt.hash(plainPassword, 10);
      await storage.updateClinicCredentials(clinicId, username, passwordHash);

      // Create Razorpay Subscription if plan IDs are configured
      let razorpaySubId: string | undefined;
      let shortUrl: string | undefined;
      const planId = RAZORPAY_PLAN_IDS[plan]?.[billingCycle];

      if (razorpay && planId) {
        try {
          const sub = await (razorpay as any).subscriptions.create({
            plan_id: planId,
            quantity: 1,
            total_count: billingCycle === "annual" ? 1 : 12,
            customer_notify: 0,
            notes: {
              clinicId: clinicId.toString(),
              clinicName: existing.name,
              plan,
              billingCycle,
            },
          });
          razorpaySubId = sub.id;
          shortUrl = sub.short_url;
          console.log(`[RAZORPAY] Subscription created: ${sub.id} for clinic ${clinicId}`);
        } catch (err: any) {
          console.error("[RAZORPAY] Failed to create subscription:", err?.error?.description || err?.message);
        }
      } else {
        if (!razorpay) console.log("[RAZORPAY] Not configured — skipping subscription creation");
        else console.log(`[RAZORPAY] No plan ID for ${plan}/${billingCycle} — skipping subscription`);
      }

      // Generate an activation token (7-day expiry)
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(activationTokens).values({
        token,
        clinicId,
        plan,
        billingCycle,
        razorpaySubscriptionId: razorpaySubId || null,
        shortUrl: shortUrl || null,
        expiresAt,
        used: false,
      });

      // Update clinic: status, plan, billingCycle, subscriptionStatus, razorpaySubscriptionId
      const clinic = await storage.updateClinic(clinicId, {
        status: "approved",
        plan,
        billingCycle,
        subscriptionStatus: "unpaid",
        razorpaySubscriptionId: razorpaySubId || null,
      } as any);

      // Send approval email with credentials and activation link
      const frontendBase = process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in';
      const activationUrl = `${frontendBase}/activate/${token}`;
      const planLabels: Record<string, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };
      const cycleLabels: Record<string, string> = { monthly: "Monthly", annual: "Annual" };
      const planLabel = `${planLabels[plan] || plan} — ${cycleLabels[billingCycle] || billingCycle}`;

      if (existing.email) {
        await sendClinicApprovalEmail(existing.name, existing.email, username, plainPassword, activationUrl, planLabel);
      }

      res.json({ ...clinic, activationToken: token });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // GET /api/activate/:token — public, used by the activation page
  app.get("/api/activate/:token", async (req, res) => {
    try {
      const [row] = await db.select().from(activationTokens)
        .where(eq(activationTokens.token, req.params.token))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Activation link not found" });
      if (row.used) return res.status(410).json({ message: "This activation link has already been used" });
      if (new Date() > row.expiresAt) return res.status(410).json({ message: "This activation link has expired" });
      const clinic = await storage.getClinic(row.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      const planPrices: Record<string, Record<string, number>> = {
        starter: { monthly: 999, annual: 9990 },
        growth:  { monthly: 1599, annual: 15990 },
        pro:     { monthly: 2999, annual: 29990 },
      };
      res.json({
        clinicName: clinic.name,
        plan: row.plan,
        billingCycle: row.billingCycle,
        price: planPrices[row.plan]?.[row.billingCycle] ?? 999,
        shortUrl: row.shortUrl,
        razorpaySubscriptionId: row.razorpaySubscriptionId,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
        expiresAt: row.expiresAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/webhooks/razorpay-subscription — Razorpay calls this on payment events
  app.post("/api/webhooks/razorpay-subscription", async (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-razorpay-signature'] as string;
        const body = JSON.stringify(req.body);
        const expected = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
        if (signature !== expected) {
          console.warn("[WEBHOOK] Invalid Razorpay signature");
          return res.status(400).json({ message: "Invalid signature" });
        }
      }
      const event = req.body?.event as string;
      const subscriptionId = req.body?.payload?.subscription?.entity?.id as string | undefined;
      console.log(`[WEBHOOK] Razorpay event: ${event}, subscriptionId: ${subscriptionId}`);
      if ((event === "subscription.charged" || event === "subscription.activated") && subscriptionId) {
        const [clinic] = await db.select().from(clinics)
          .where(eq(clinics.razorpaySubscriptionId, subscriptionId))
          .limit(1);
        if (clinic) {
          await storage.updateClinic(clinic.id, { subscriptionStatus: "active" } as any);
          await db.update(activationTokens)
            .set({ used: true })
            .where(eq(activationTokens.razorpaySubscriptionId, subscriptionId));
          console.log(`[WEBHOOK] Clinic ${clinic.id} subscription activated`);
        } else {
          console.warn(`[WEBHOOK] No clinic found for subscription ${subscriptionId}`);
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("[WEBHOOK] Error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/clinics/:id/mark-paid — admin manual override
  app.patch("/api/clinics/:id/mark-paid", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Only superusers can mark clinics as paid" });
    try {
      const clinicId = parseInt(req.params.id);
      const clinic = await storage.updateClinic(clinicId, { subscriptionStatus: "active" } as any);
      await db.update(activationTokens)
        .set({ used: true })
        .where(and(eq(activationTokens.clinicId, clinicId), eq(activationTokens.used, false)));
      res.json(clinic);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // GET /api/clinics/:id/activation-link — returns unexpired activation token URL for a clinic
  app.get("/api/clinics/:id/activation-link", isAuthenticated, async (req, res) => {
    try {
      const clinicId = parseInt(req.params.id);
      const [row] = await db.select().from(activationTokens)
        .where(and(
          eq(activationTokens.clinicId, clinicId),
          eq(activationTokens.used, false),
          sql`${activationTokens.expiresAt} > NOW()`
        ))
        .limit(1);
      if (!row) return res.json({ url: null });
      const frontendBase = process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in';
      res.json({ url: `${frontendBase}/activate/${row.token}` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clinics/:id/reject", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Only superusers can reject clinics" });
    try {
      const clinicId = parseInt(req.params.id);
      const existing = await storage.getClinic(clinicId);
      if (!existing) return res.status(404).json({ message: "Clinic not found" });
      const clinic = await storage.updateClinic(clinicId, { status: "rejected" });
      res.json(clinic);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/uploads/signed-url", isAuthenticated, async (req, res) => {
    try {
      const { fileName, contentType, fileType, fileSize, folder } = req.body;
      const result = await generateSignedUploadUrl({
        fileName: fileName || `upload-${Date.now()}`,
        fileType: fileType || contentType,
        fileSize: fileSize || 1024 * 1024, // Default 1MB if not provided
        folder
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/clinics/:id/doctors", isAuthenticated, async (req, res) => {
    const clinicId = parseInt(req.params.id);
    const { name, email, specialization, degree } = req.body;
    try {
      const clinic = await storage.getClinic(clinicId);
      let doctor = await storage.getDoctorByEmail(email);
      let isNewDoctor = false;
      if (!doctor) {
        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        doctor = await storage.createDoctor({ name, email, passwordHash, isTemporaryPassword: true, specialization: specialization || null, degree: degree || null, imageUrl: null } as any);
        isNewDoctor = true;
        if (clinic) {
          sendDoctorWelcomeEmail(email, name, clinic.name, tempPassword).catch(() => {});
        }
      }
      await storage.linkDoctorToClinic(clinicId, doctor.id);
      res.status(201).json(doctor);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/public/clinics", async (req, res) => {
    try {
      const clinicsList = await storage.getClinics();
      res.json(clinicsList.filter(c => !c.isArchived).map(({ id, name, address, username, city, pincode }) => ({ id, name, address, username, city, pincode })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch clinics" });
    }
  });

  // ── OTP: send verification code ────────────────────────────────────────────
  app.post("/api/public/otp/send", otpSendRateLimiter, async (req, res) => {
    const OTP_SEND_MAX = 3;
    const OTP_SEND_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    try {
      const { email, purpose = "booking" } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "A valid email address is required" });
      }
      const normalizedEmail = email.toLowerCase();

      // Check existing OTP row for send-rate enforcement
      const [existing] = await db.select().from(emailOtps)
        .where(and(
          eq(emailOtps.email, normalizedEmail),
          eq(emailOtps.purpose, purpose),
          eq(emailOtps.verified, false),
        ))
        .limit(1);

      if (existing) {
        const windowStart = existing.sendWindowStart ? new Date(existing.sendWindowStart).getTime() : 0;
        const windowExpired = Date.now() - windowStart > OTP_SEND_WINDOW_MS;
        const currentCount = windowExpired ? 0 : (existing.sendCount ?? 1);

        if (!windowExpired && currentCount >= OTP_SEND_MAX) {
          const retryAfterSec = Math.ceil((windowStart + OTP_SEND_WINDOW_MS - Date.now()) / 1000);
          return res.status(429).json({
            message: `Too many codes sent. Please wait ${Math.ceil(retryAfterSec / 60)} minute(s) before requesting another.`,
            retryAfterSeconds: retryAfterSec,
          });
        }

        // Within the 60-second cooldown per send attempt
        const lastSentAt = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
        if (!windowExpired && Date.now() - lastSentAt < 60_000) {
          return res.status(429).json({ message: "Please wait at least 60 seconds before requesting a new code" });
        }

        // Issue fresh OTP — reset attempts + lock, update send count
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const newSendWindowStart = windowExpired ? new Date() : existing.sendWindowStart;
        const newSendCount = windowExpired ? 1 : currentCount + 1;

        await db.update(emailOtps)
          .set({
            otpHash,
            expiresAt,
            attempts: 0,
            lockedUntil: null,
            createdAt: new Date(),
            sendCount: newSendCount,
            sendWindowStart: newSendWindowStart,
          })
          .where(eq(emailOtps.id, existing.id));

        if (resend && RESEND_MODE === 'PRODUCTION') {
          await resend.emails.send({ from: EMAIL_FROM, to: email, subject: "Your BookMySlot verification code", html: sendOtpEmail(code) });
        } else {
          console.log(`[OTP DEV] Resend for ${email}: ${code}`);
        }
        return res.json({ success: true, message: "New verification code sent to your email" });
      }

      // No existing row — fresh send
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await db.insert(emailOtps).values({
        email: normalizedEmail,
        otpHash,
        expiresAt,
        purpose,
        attempts: 0,
        sendCount: 1,
        sendWindowStart: new Date(),
      });

      if (resend && RESEND_MODE === 'PRODUCTION') {
        await resend.emails.send({ from: EMAIL_FROM, to: email, subject: "Your BookMySlot verification code", html: sendOtpEmail(code) });
      } else {
        console.log(`[OTP DEV] Code for ${email}: ${code}`);
      }

      res.json({ success: true, message: "Verification code sent to your email" });
    } catch (err: any) {
      console.error('[OTP SEND ERROR]', err.message);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // ── OTP: verify code and return session token ──────────────────────────────
  app.post("/api/public/otp/verify", otpVerifyRateLimiter, async (req, res) => {
    const OTP_MAX_ATTEMPTS = 5;
    const OTP_LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
    try {
      const { email, code, purpose = "booking" } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }
      const normalizedEmail = email.toLowerCase();

      const [otpRow] = await db.select().from(emailOtps)
        .where(and(
          eq(emailOtps.email, normalizedEmail),
          eq(emailOtps.purpose, purpose),
          eq(emailOtps.verified, false),
          sql`${emailOtps.expiresAt} > NOW()`
        ))
        .limit(1);

      if (!otpRow) {
        return res.status(400).json({ message: "No valid code found. Please request a new one." });
      }

      // Check if currently locked
      if (otpRow.lockedUntil && new Date(otpRow.lockedUntil) > new Date()) {
        const lockedUntilSec = Math.ceil((new Date(otpRow.lockedUntil).getTime() - Date.now()) / 1000);
        return res.status(429).json({
          message: `Too many incorrect attempts. Please request a new code or try again in ${Math.ceil(lockedUntilSec / 60)} minute(s).`,
          lockedUntilSeconds: lockedUntilSec,
          locked: true,
        });
      }

      const isMatch = await bcrypt.compare(code.toString(), otpRow.otpHash);

      if (!isMatch) {
        const newAttempts = (otpRow.attempts ?? 0) + 1;
        const shouldLock = newAttempts >= OTP_MAX_ATTEMPTS;
        const lockedUntil = shouldLock ? new Date(Date.now() + OTP_LOCK_DURATION_MS) : null;

        await db.update(emailOtps)
          .set({ attempts: newAttempts, lockedUntil })
          .where(eq(emailOtps.id, otpRow.id));

        const attemptsLeft = OTP_MAX_ATTEMPTS - newAttempts;

        if (shouldLock) {
          return res.status(429).json({
            message: "Too many incorrect attempts. Your code is locked for 30 minutes. You can also request a new code to reset the lock immediately.",
            lockedUntilSeconds: Math.ceil(OTP_LOCK_DURATION_MS / 1000),
            locked: true,
          });
        }

        return res.status(400).json({
          message: `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining before lock.`,
          attemptsLeft,
        });
      }

      // Correct code — mark verified, clear lock state
      const verifiedToken = crypto.randomBytes(32).toString("hex");
      await db.update(emailOtps)
        .set({ verified: true, verifiedToken, attempts: 0, lockedUntil: null })
        .where(eq(emailOtps.id, otpRow.id));

      res.json({ success: true, verifiedToken });
    } catch (err: any) {
      console.error('[OTP VERIFY ERROR]', err.message);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // ── PUBLIC: supplier listing request ──────────────────────────────────────
  app.post("/api/public/supplier-listing-request/submit", async (req, res) => {
    try {
      const { verifiedToken, companyName, email, phone, category, description, website } = req.body;
      if (!verifiedToken || !companyName || !email || !phone || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const normalizedEmail = email.toLowerCase().trim();

      // Validate that the token belongs to a verified OTP for this email + purpose
      const [otpRow] = await db.select().from(emailOtps).where(
        and(
          eq(emailOtps.email, normalizedEmail),
          eq(emailOtps.purpose, "supplier-listing"),
          eq(emailOtps.verified, true),
          eq(emailOtps.verifiedToken, verifiedToken),
        )
      ).limit(1);

      if (!otpRow) {
        return res.status(400).json({ message: "Email verification expired or invalid. Please verify your email again." });
      }

      const adminEmail = process.env.ADMIN_EMAIL || TEST_EMAIL;
      const finalAdminEmail = RESEND_MODE === 'PRODUCTION' ? adminEmail : TEST_EMAIL;
      const finalSupplierEmail = RESEND_MODE === 'PRODUCTION' ? normalizedEmail : TEST_EMAIL;
      const submittedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

      const adminHtml = emailShell(
        'linear-gradient(90deg,#2563eb,#3b82f6)',
        `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
        <tr><td style="padding:24px 40px 0;">
          <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">New supplier submission</p>
          <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">A supplier has submitted their details through the marketplace form. Full submission below.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
            style="background:#f0f6ff;border:1px solid #bfdbfe;border-radius:10px;">
            <tr><td style="padding:6px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${[
                  ['Supplier / Company', companyName],
                  ['Business email', `${normalizedEmail} <span style="color:#1a9e6f;font-weight:700;font-size:11px;">&#10003; Verified</span>`],
                  ['Phone', phone],
                  ['Category', category],
                  ...(description ? [['Products / services', description]] : []),
                  ...(website ? [['Website', `<a href="${website}" style="color:#2563eb;text-decoration:none;">${website}</a>`]] : []),
                  ['Submitted at', submittedAt],
                ].map(([label, value], i, arr) => `
                  <tr${i < arr.length - 1 ? ' style="border-bottom:1px solid #dbeafe;"' : ''}>
                    <td style="padding:10px 20px;width:38%;vertical-align:top;"><p style="margin:0;font-size:11px;font-weight:600;color:#3b6ac2;text-transform:uppercase;letter-spacing:.07em;">${label}</p></td>
                    <td style="padding:10px 20px;vertical-align:top;"><p style="margin:0;font-size:13px;font-weight:600;color:#0d1f1a;">${value}</p></td>
                  </tr>`).join('')}
              </table>
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:13px;color:#8fa89a;line-height:1.6;">Log in to the admin panel to approve, create a deal, or contact this supplier.</p>
        </td></tr>`
      );

      const supplierHtml = emailShell(
        'linear-gradient(90deg,#2563eb,#3b82f6)',
        `<tr><td align="center" style="padding:28px 40px 0;">${logoBlock()}</td></tr>
        <tr><td style="padding:24px 40px 0;">
          <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;letter-spacing:-.3px;">We've received your submission ✓</p>
          <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;line-height:1.5;">Hi <strong style="color:#0d1f1a;">${companyName}</strong>, thank you for your interest in partnering with bookMySlot Dental.</p>
          ${infoBanner('blue', '<strong style="font-size:13px;">&#128203; &nbsp;What happens next</strong><br/>Our team will review your submission and get back to you within <strong>2 working days</strong>. We\'ll reach out to the email or phone number you provided to discuss next steps.')}
          <p style="margin:20px 0 0;font-size:13px;color:#8fa89a;line-height:1.6;">If you have any questions in the meantime, write to us at <a href="mailto:bookmyslot@mail.mossaic.in" style="color:#1a9e6f;text-decoration:none;">bookmyslot@mail.mossaic.in</a>.</p>
        </td></tr>`
      );

      if (resend) {
        await Promise.allSettled([
          resend.emails.send({ from: EMAIL_FROM, to: finalAdminEmail, subject: `BookMySlot – New Supplier Submission · ${companyName}`, html: adminHtml }),
          resend.emails.send({ from: EMAIL_FROM, to: finalSupplierEmail, subject: `BookMySlot – We've Received Your Submission`, html: supplierHtml }),
        ]);
      } else {
        console.log(`[SUPPLIER LISTING DEV] Request from ${companyName} <${normalizedEmail}>, category: ${category}`);
      }

      // Clean up the used OTP
      await db.delete(emailOtps).where(eq(emailOtps.id, otpRow.id));

      res.json({ success: true, message: "Listing request submitted successfully" });
    } catch (err: any) {
      console.error('[SUPPLIER LISTING ERROR]', err.message);
      res.status(500).json({ message: "Failed to submit listing request" });
    }
  });

  // ── PUBLIC UPLOAD: signed URL for clinic registration docs ─────────────────
  app.post("/api/public/uploads/signed-url", async (req, res) => {
    try {
      const { fileName, contentType, fileSize, folder } = req.body;
      if (!fileName || !contentType) {
        return res.status(400).json({ message: "fileName and contentType are required" });
      }
      const result = await generateSignedUploadUrl({
        fileName,
        fileType: contentType,
        fileSize: fileSize || 5 * 1024 * 1024,
        folder: folder || "clinic-docs",
      });
      res.json(result);
    } catch (err: any) {
      res.status(503).json({ message: err.message || "File upload not available" });
    }
  });

  // ── RAZORPAY: create order (₹1 token) ─────────────────────────────────────
  app.post("/api/public/razorpay/create-order", async (req, res) => {
    try {
      if (!razorpay) return res.status(503).json({ message: "Razorpay not configured" });
      const { clinicId, startTime, email, verifiedToken } = req.body;
      if (!clinicId || !startTime) return res.status(400).json({ message: "Missing clinicId or startTime" });

      // Require verified email token
      if (!email || !verifiedToken) {
        return res.status(401).json({ message: "Email verification required before booking" });
      }
      const [otpRow] = await db.select().from(emailOtps)
        .where(and(
          eq(emailOtps.verified, true),
          eq(emailOtps.verifiedToken, verifiedToken),
          eq(emailOtps.email, email.toLowerCase()),
          eq(emailOtps.purpose, "booking"),
          sql`${emailOtps.expiresAt} > NOW()`
        ))
        .limit(1);
      if (!otpRow) {
        return res.status(401).json({ message: "Email verification expired. Please verify your email again." });
      }

      const clinic = await storage.getClinic(parseInt(clinicId));
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const requestedStart = new Date(startTime);
      const existingBookings = await storage.countVerifiedBookingsForClinicTime(clinic.id, clinic.name, requestedStart);
      if (existingBookings >= 3) return res.status(400).json({ message: "This time slot is fully booked. Please choose another time." });

      const order = await razorpay.orders.create({
        amount: 100, // ₹1 in paise
        currency: "INR",
        receipt: `bms_${Date.now()}`,
      });

      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err: any) {
      console.error('[RAZORPAY CREATE ORDER ERROR]', err.message);
      res.status(500).json({ message: "Failed to create Razorpay order" });
    }
  });

  // ── RAZORPAY: verify payment + create confirmed booking ─────────────────────
  app.post("/api/public/razorpay/verify-payment", async (req, res) => {
    try {
      if (!razorpay) return res.status(503).json({ message: "Razorpay not configured" });
      const {
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        customerName, customerPhone, customerEmail,
        clinicId, clinicName, startTime, endTime, description, verifiedToken,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: "Missing payment verification fields" });
      }
      if (!customerName || !customerPhone || !customerEmail || !clinicId || !startTime || !endTime) {
        return res.status(400).json({ message: "Missing booking fields" });
      }

      // Require verified email token
      if (!verifiedToken) {
        return res.status(401).json({ message: "Email verification required before booking" });
      }
      const [otpRow] = await db.select().from(emailOtps)
        .where(and(
          eq(emailOtps.verified, true),
          eq(emailOtps.verifiedToken, verifiedToken),
          eq(emailOtps.email, customerEmail.toLowerCase()),
          eq(emailOtps.purpose, "booking"),
          sql`${emailOtps.expiresAt} > NOW()`
        ))
        .limit(1);
      if (!otpRow) {
        return res.status(401).json({ message: "Email verification expired. Please verify your email again." });
      }

      // HMAC-SHA256 signature verification (mandatory security check)
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: "Payment verification failed: invalid signature" });
      }

      const clinic = await storage.getClinic(parseInt(clinicId));
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const requestedStart = new Date(startTime);

      // ── Atomic: consume OTP + capacity re-check + insert (double-booking protection) ──
      // Razorpay create-order already did a soft capacity check before payment, but that
      // check is not binding — a concurrent booking could have filled the slot between
      // order creation and payment verification. This transaction closes that window.
      let slot: any;
      let booking: any;
      try {
        await db.transaction(async (tx) => {
          // 1. Consume OTP first — concurrent duplicate submission gets 0 rows (Race B)
          const [consumed] = await tx.delete(emailOtps)
            .where(eq(emailOtps.id, otpRow.id))
            .returning({ id: emailOtps.id });
          if (!consumed) {
            const e = new Error("TOKEN_USED"); (e as any).code = "TOKEN_USED"; throw e;
          }

          // 2. Re-check capacity inside transaction (Race A — slot filled after order created)
          const txW0 = new Date(requestedStart.getTime() - 60_000);
          const txW1 = new Date(requestedStart.getTime() + 60_000);
          const txRows = await tx.select({ b: bookings, s: slots })
            .from(bookings)
            .innerJoin(slots, eq(bookings.slotId, slots.id))
            .where(and(gte(slots.startTime, txW0), lte(slots.startTime, txW1), eq(slots.isCancelled, false)));
          const txUsed = txRows
            .filter(r => (r.s.clinicId === clinic.id || r.s.clinicName === (clinicName || clinic.name)) && !['cancelled', 'pending'].includes(r.b.verificationStatus ?? ''))
            .reduce((sum: number, r: any) => sum + ((r.b as any).slotCost ?? 1), 0);
          if (txUsed >= 3) {
            const e = new Error("SLOT_FULL"); (e as any).code = "SLOT_FULL"; throw e;
          }

          // 3. Insert slot + booking atomically
          const [newSlot] = await tx.insert(slots).values({
            ownerId: null,
            startTime: requestedStart,
            endTime: new Date(endTime),
            clinicName: clinicName || clinic.name,
            clinicId: clinic.id,
            isBooked: true,
            isCancelled: false,
          } as any).returning();
          slot = newSlot;

          const [newBooking] = await tx.insert(bookings).values({
            slotId: slot.id,
            customerName,
            customerPhone,
            customerEmail,
            description: description || null,
            verificationCode: null,
            verificationExpiresAt: null,
            verificationStatus: 'email_verified',
            paymentStatus: 'paid',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
          } as any).returning();
          booking = newBooking;
        });
      } catch (txErr: any) {
        if (txErr.code === "SLOT_FULL") return res.status(400).json({ message: "This time slot is fully booked. Please choose another time." });
        if (txErr.code === "TOKEN_USED") return res.status(409).json({ message: "Your booking session is already in progress. Please wait a moment and try again." });
        throw txErr;
      }

      // Link booking to the correct patient profile
      try {
        const bodyPatientId = req.body.patientId;
        const isNewProfile = bodyPatientId === 'new';
        const selectedId = (!isNewProfile && bodyPatientId) ? parseInt(bodyPatientId) : NaN;
        let patient;
        if (!isNaN(selectedId)) {
          const existing = await storage.getPatientById(clinic.id, selectedId);
          patient = existing
            ? await storage.incrementPatientVisit(existing.id)
            : await storage.upsertPatientByEmail(clinic.id, customerEmail, customerName, customerPhone);
        } else if (isNewProfile) {
          patient = await storage.createNewPatient(clinic.id, customerEmail, customerName, customerPhone);
        } else {
          patient = await storage.upsertPatientByEmail(clinic.id, customerEmail, customerName, customerPhone);
        }
        await db.update(bookings).set({ patientId: patient.id } as any).where(eq(bookings.id, booking.id));
      } catch (e: any) {
        console.error('[PATIENT PROFILE] Failed to link:', e.message);
      }

      // OTP was consumed inside the transaction above — send confirmation emails now
      await sendBookingEmails(customerEmail, customerName, clinic.email, clinic.name, requestedStart, customerPhone, (clinic as any).phone ?? null, booking.id);

      if (customerPhone) {
        await sendWhatsAppBookingNotification(customerPhone, customerName, clinic.name, requestedStart);
      }

      // In-app notification for clinic admin — paid booking confirmed
      try {
        const dateStr = requestedStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const timeStr = requestedStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const paidNotif = await storage.createNotification({
          userId: String(clinic.id),
          message: `Paid booking confirmed — ${customerName} on ${dateStr} at ${timeStr}`,
          read: false,
          type: "paid_booking_confirmed",
          bookingId: booking.id,
        });
        broadcastToClinic(String(clinic.id), { type: "paid_booking_confirmed", bookingId: booking.id, notification: paidNotif });
      } catch (e: any) {
        console.error('[NOTIFICATION] Paid booking notification failed:', e.message);
      }

      res.status(201).json({ message: "Payment verified and booking confirmed!", booking: { ...booking, slot } });
    } catch (err: any) {
      console.error('[RAZORPAY VERIFY ERROR]', err.message);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // ── PUBLIC: Patient lookup by email + clinicId (returning patient detection) ─
  app.get("/api/public/patient-lookup", async (req, res) => {
    try {
      const { email, clinicId } = req.query;
      if (!email || !clinicId) return res.status(400).json({ message: "email and clinicId required" });
      const patient = await storage.getPatientByEmail(parseInt(clinicId as string), (email as string).toLowerCase().trim());
      if (!patient) return res.json({ found: false });
      res.json({
        found: true,
        patientCode: patient.patientCode,
        name: patient.name,
        phone: patient.phone,
        visitCount: patient.visitCount,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Lookup failed" });
    }
  });

  // ── PUBLIC: All patient profiles by email + clinicId (family/multi-profile picker) ─
  app.get("/api/public/patients-by-email", async (req, res) => {
    try {
      const { email, clinicId } = req.query;
      if (!email || !clinicId) return res.status(400).json({ message: "email and clinicId required" });
      const profiles = await storage.getPatientsByEmail(parseInt(clinicId as string), (email as string).toLowerCase().trim());
      res.json(profiles);
    } catch (err: any) {
      res.status(500).json({ message: "Lookup failed" });
    }
  });

  // ── CLINIC AUTH: Search patients by name / email / phone for admin autocomplete ─
  app.get("/api/auth/clinic/patients/search", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    try {
      const q = ((req.query.q as string) || "").trim();
      if (q.length < 2) return res.json([]);
      const results = await storage.searchPatients(sess.clinicId, q);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  // ── PUBLIC BOOKING: clinic-approval path (pending) ─────────────────────────
  app.post("/api/public/bookings", bookingCreateRateLimiter, async (req, res) => {
    try {
      const { customerName, customerPhone, customerEmail, customerAge, customerGender, clinicId, clinicName, startTime, endTime, description, verifiedToken } = req.body;

      if (!customerName || !customerPhone || !customerEmail || !clinicId || !startTime || !endTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Require verified email token
      if (!verifiedToken) {
        return res.status(401).json({ message: "Email verification required before booking" });
      }
      const [otpRow] = await db.select().from(emailOtps)
        .where(and(
          eq(emailOtps.verified, true),
          eq(emailOtps.verifiedToken, verifiedToken),
          eq(emailOtps.email, customerEmail.toLowerCase()),
          eq(emailOtps.purpose, "booking"),
          sql`${emailOtps.expiresAt} > NOW()`
        ))
        .limit(1);
      if (!otpRow) {
        return res.status(401).json({ message: "Email verification expired. Please verify your email again." });
      }

      const clinic = await storage.getClinic(parseInt(clinicId));
      if (!clinic) {
        return res.status(404).json({ message: "Clinic not found" });
      }

      const requestedStart = new Date(startTime);

      // Look up clinic-configured max for this time bracket (same logic as slot-availability endpoint)
      const pubStartWindow = new Date(requestedStart.getTime() - 60_000);
      const pubEndWindow   = new Date(requestedStart.getTime() + 60_000);
      const [pubConfigSlot] = await db.select().from(slots)
        .where(and(eq(slots.clinicId, clinic.id), eq(slots.isBooked, false), gte(slots.startTime, pubStartWindow), lte(slots.startTime, pubEndWindow)))
        .limit(1);
      const pubDefaultCfg = (clinic as any).defaultSlotConfig;
      // Determine bracket index by matching start hour to the 5 standard brackets
      const pubHour = requestedStart.getHours();
      const pubMin  = requestedStart.getMinutes();
      const pubBracketMap: Record<number, string> = { 8: "1", 10: "2", 12: "3", 14: "4", 17: "5" };
      const pubKey = pubBracketMap[pubHour] ?? (pubMin === 30 && pubHour === 12 ? "3" : undefined);
      const pubDefaultSection = pubKey ? pubDefaultCfg?.sections?.[pubKey] : undefined;
      const pubMax = pubConfigSlot?.maxBookings ?? pubDefaultSection?.maxBookings ?? 4;
      // ── Atomic: consume OTP + capacity re-check + insert (double-booking protection) ──
      // Race A (two patients, same slot): capacity is re-checked inside the same DB transaction
      //   so both concurrent requests cannot both pass the check before either inserts.
      // Race B (same patient, duplicate submission): OTP token is deleted first inside the
      //   transaction — the second concurrent request gets 0 rows back and is rejected with 409.
      let slot: any;
      let booking: any;
      try {
        await db.transaction(async (tx) => {
          // 1. Consume OTP — concurrent duplicate gets 0 rows → TOKEN_USED (Race B)
          const [consumed] = await tx.delete(emailOtps)
            .where(eq(emailOtps.id, otpRow.id))
            .returning({ id: emailOtps.id });
          if (!consumed) {
            const e = new Error("TOKEN_USED"); (e as any).code = "TOKEN_USED"; throw e;
          }

          // 2. Re-check capacity inside the transaction (Race A)
          const txW0 = new Date(requestedStart.getTime() - 60_000);
          const txW1 = new Date(requestedStart.getTime() + 60_000);
          const txRows = await tx.select({ b: bookings, s: slots })
            .from(bookings)
            .innerJoin(slots, eq(bookings.slotId, slots.id))
            .where(and(gte(slots.startTime, txW0), lte(slots.startTime, txW1), eq(slots.isCancelled, false)));
          const txUsed = txRows
            .filter(r => (r.s.clinicId === clinic.id || r.s.clinicName === (clinicName || clinic.name)) && !['cancelled', 'pending'].includes(r.b.verificationStatus ?? ''))
            .reduce((sum: number, r: any) => sum + ((r.b as any).slotCost ?? 1), 0);
          if (txUsed + 1 > pubMax) {
            const e = new Error("SLOT_FULL"); (e as any).code = "SLOT_FULL"; throw e;
          }

          // 3. Insert slot + booking atomically
          const [newSlot] = await tx.insert(slots).values({
            ownerId: null,
            startTime: requestedStart,
            endTime: new Date(endTime),
            clinicName: clinicName || clinic.name,
            clinicId: clinic.id,
            isBooked: true,
            isCancelled: false,
          } as any).returning();
          slot = newSlot;

          const [newBooking] = await tx.insert(bookings).values({
            slotId: slot.id,
            customerName,
            customerPhone,
            customerEmail,
            customerAge: customerAge ? parseInt(customerAge) : null,
            customerGender: customerGender || null,
            description: description || null,
            verificationCode: null,
            verificationExpiresAt: null,
            verificationStatus: 'email_verified',
          } as any).returning();
          booking = newBooking;
        });
      } catch (txErr: any) {
        if (txErr.code === "SLOT_FULL") return res.status(400).json({ message: "This time slot is fully booked. Please choose another time." });
        if (txErr.code === "TOKEN_USED") return res.status(409).json({ message: "Your booking session is already in progress. Please wait a moment and try again." });
        throw txErr;
      }

      // Link booking to the correct patient profile
      try {
        const bodyPatientId = req.body.patientId;
        const isNewProfile = bodyPatientId === 'new';
        const selectedId = (!isNewProfile && bodyPatientId) ? parseInt(bodyPatientId) : NaN;
        let patient;
        if (!isNaN(selectedId)) {
          const existing = await storage.getPatientById(clinic.id, selectedId);
          patient = existing
            ? await storage.incrementPatientVisit(existing.id)
            : await storage.upsertPatientByEmail(clinic.id, customerEmail, customerName, customerPhone);
        } else if (isNewProfile) {
          patient = await storage.createNewPatient(clinic.id, customerEmail, customerName, customerPhone);
        } else {
          patient = await storage.upsertPatientByEmail(clinic.id, customerEmail, customerName, customerPhone);
        }
        await db.update(bookings).set({ patientId: patient.id } as any).where(eq(bookings.id, booking.id));
      } catch (e: any) {
        console.error('[PATIENT PROFILE] Failed to link:', e.message);
      }

      // OTP was consumed inside the transaction above — send confirmation emails now
      await sendBookingEmails(customerEmail, customerName, clinic.email, clinic.name, requestedStart, customerPhone, (clinic as any).phone ?? null, booking.id);

      if (customerPhone) {
        await sendWhatsAppBookingNotification(customerPhone, customerName, clinic.name, requestedStart);
      }

      // Create in-app notification and push it instantly to the clinic admin via WebSocket
      try {
        const notifMessage = `New booking from ${customerName} on ${requestedStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${requestedStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
        const notification = await storage.createNotification({
          userId: String(clinic.id),
          message: notifMessage,
          read: false,
          type: "new_booking",
          bookingId: booking.id,
        });
        broadcastToClinic(String(clinic.id), { type: "new_booking", bookingId: booking.id, notification });
      } catch (e: any) {
        console.error('[NOTIFICATION] Failed to create or broadcast:', e.message);
      }

      res.status(201).json({ message: "Booking request submitted!", booking: { ...booking, slot } });
    } catch (err: any) {
      console.error('[PUBLIC BOOKING ERROR]', err.message);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  // ── PUBLIC: Slot booking counts per time slot ────────────────────────────
  app.post("/api/public/slot-availability", async (req, res) => {
    try {
      const { clinicId, slots: requestedSlots } = req.body;
      if (!clinicId || !Array.isArray(requestedSlots)) {
        return res.status(400).json({ message: "clinicId and slots array required" });
      }
      const clinic = await storage.getClinic(parseInt(clinicId));
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const results = await Promise.all(
        requestedSlots.map(async (s: { slotIndex: number; label: string; startTimeISO: string }) => {
          const startTime  = new Date(s.startTimeISO);
          const startWindow = new Date(startTime.getTime() - 60_000);
          const endWindow   = new Date(startTime.getTime() + 60_000);

          // Look for a clinic-admin-configured slot (isBooked = false) to get maxBookings / isCancelled
          const [configSlot] = await db.select().from(slots)
            .where(and(
              eq(slots.clinicId, clinic.id),
              eq(slots.isBooked, false),
              gte(slots.startTime, startWindow),
              lte(slots.startTime, endWindow),
            ))
            .limit(1);

          // Fall back to clinic-level default config when no explicit slot row exists
          const defaultCfg = (clinic as any).defaultSlotConfig;
          const sectionKey = String(s.slotIndex + 1);
          const defaultSection = defaultCfg?.sections?.[sectionKey];
          const max         = configSlot?.maxBookings ?? defaultSection?.maxBookings ?? 3;
          const isCancelled = configSlot?.isCancelled ?? defaultCfg?.isClosed ?? defaultSection?.isCancelled ?? false;
          const count       = await storage.countVerifiedBookingsForClinicTime(clinic.id, clinic.name, startTime);
          const spotsLeft   = Math.max(0, max - count);

          return { slotIndex: s.slotIndex, label: s.label, startTimeISO: s.startTimeISO, count, max, isCancelled, spotsLeft };
        }),
      );

      res.json(results);
    } catch (err: any) {
      console.error("[SLOT AVAILABILITY ERROR]", err.message);
      res.status(500).json({ message: "Failed to get slot availability" });
    }
  });

  // ── CLINIC ADMIN: 30-day availability summary (single bulk query, not 150) ─
  app.get("/api/auth/clinic/available-dates", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const days = Math.min(parseInt((req.query.days as string) || "30"), 60);
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      const defaultCfg = (clinic as any).defaultSlotConfig;
      const SLOT_TIMINGS = [
        { id: "1", label: "Early Morning", startHour: 8,  startMinute: 0  },
        { id: "2", label: "Late Morning",  startHour: 10, startMinute: 0  },
        { id: "3", label: "Midday",        startHour: 12, startMinute: 30 },
        { id: "4", label: "Afternoon",     startHour: 14, startMinute: 0  },
        { id: "5", label: "Evening",       startHour: 17, startMinute: 0  },
      ];
      const DEFAULT_CAPACITY: Record<string, number> = { "1": 4, "2": 6, "3": 3, "4": 7, "5": 6 };
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(todayStart); rangeEnd.setDate(rangeEnd.getDate() + days); rangeEnd.setHours(23, 59, 59, 999);
      const getSlotId = (d: Date): string | null => {
        const h = d.getHours(); const m = d.getMinutes();
        return SLOT_TIMINGS.find(s => s.startHour === h && s.startMinute === m)?.id ?? null;
      };
      // Query 1: all active bookings for this clinic in range
      const bookingRows = await db
        .select({ slotStartTime: slots.startTime, slotCost: bookings.slotCost, status: bookings.verificationStatus })
        .from(bookings)
        .innerJoin(slots, eq(bookings.slotId, slots.id))
        .where(and(eq(slots.clinicId, sess.clinicId), gte(slots.startTime, todayStart), lte(slots.startTime, rangeEnd)));
      // Query 2: admin-configured slot rows (isCancelled / maxBookings overrides)
      const configRows = await db
        .select({ startTime: slots.startTime, isCancelled: slots.isCancelled, maxBookings: slots.maxBookings })
        .from(slots)
        .where(and(eq(slots.clinicId, sess.clinicId), eq(slots.isBooked, false), gte(slots.startTime, todayStart), lte(slots.startTime, rangeEnd)));
      // Config map: "dateStr:slotId" -> { isCancelled, max }
      const configMap = new Map<string, { isCancelled: boolean; max: number }>();
      for (const row of configRows) {
        const d = new Date(row.startTime); const dateStr = d.toISOString().slice(0, 10); const slotId = getSlotId(d);
        if (!slotId) continue;
        const ds = defaultCfg?.sections?.[slotId];
        configMap.set(`${dateStr}:${slotId}`, { isCancelled: row.isCancelled ?? false, max: row.maxBookings ?? ds?.maxBookings ?? DEFAULT_CAPACITY[slotId] ?? 4 });
      }
      // Usage map: "dateStr:slotId" -> summed slotCost for confirmed bookings
      const usageMap = new Map<string, number>();
      for (const row of bookingRows) {
        if (['cancelled', 'pending'].includes(row.status ?? '')) continue;
        const d = new Date(row.slotStartTime); const dateStr = d.toISOString().slice(0, 10); const slotId = getSlotId(d);
        if (!slotId) continue;
        const key = `${dateStr}:${slotId}`; usageMap.set(key, (usageMap.get(key) ?? 0) + (row.slotCost ?? 1));
      }
      // Build per-day result
      const result = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(todayStart); d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        let totalSpotsLeft = 0; let availableSlotCount = 0; let nextSlotLabel: string | null = null;
        for (const slotDef of SLOT_TIMINGS) {
          const key = `${dateStr}:${slotDef.id}`;
          const cfg = configMap.get(key); const ds = defaultCfg?.sections?.[slotDef.id];
          const isCancelled = cfg?.isCancelled ?? (defaultCfg?.isClosed ?? ds?.isCancelled ?? false);
          if (isCancelled) continue;
          const max = cfg?.max ?? ds?.maxBookings ?? DEFAULT_CAPACITY[slotDef.id] ?? 4;
          const used = usageMap.get(key) ?? 0; const spotsLeft = Math.max(0, max - used);
          totalSpotsLeft += spotsLeft;
          if (spotsLeft > 0) { availableSlotCount++; if (!nextSlotLabel) nextSlotLabel = slotDef.label; }
        }
        result.push({ date: dateStr, isFull: availableSlotCount === 0, availableSlotCount, totalSpotsLeft, nextSlotLabel });
      }
      res.json(result);
    } catch (err: any) {
      console.error("[AVAILABLE DATES ERROR]", err.message);
      res.status(500).json({ message: "Failed to get available dates" });
    }
  });

  // ── PUBLIC: Doctor leave check for a clinic on a date ────────────────────
  app.get("/api/public/clinic-availability", async (req, res) => {
    try {
      const { clinicId, date } = req.query as { clinicId?: string; date?: string };
      if (!clinicId || !date) {
        return res.status(400).json({ message: "clinicId and date required" });
      }
      const clinic = await storage.getClinic(parseInt(clinicId));
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const clinicDocs = await storage.getClinicDoctors(parseInt(clinicId));
      if (clinicDocs.length === 0) {
        // No registered doctors — can't determine leave, don't block
        return res.json({ hasAnyAvailable: true, totalDoctors: 0, onLeaveCount: 0 });
      }

      const doctorIds = clinicDocs.map((d: any) => d.id);
      const leaves    = await storage.getDoctorLeavesOnDate(date, doctorIds);
      res.json({
        hasAnyAvailable: leaves.length < clinicDocs.length,
        totalDoctors:    clinicDocs.length,
        onLeaveCount:    leaves.length,
      });
    } catch (err: any) {
      console.error("[CLINIC AVAILABILITY ERROR]", err.message);
      res.status(500).json({ message: "Failed to check clinic availability" });
    }
  });

  app.get("/api/site-settings/:key", async (req, res) => {
    try {
      const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, req.params.key));
      res.json(setting || { key: req.params.key, value: "" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/smile-deals", async (req, res) => {
    const onlyActive = req.query.active === 'true';
    const audience = req.query.audience as string | undefined;
    try {
      let deals = await storage.getSmileDeals(onlyActive);
      if (audience && audience !== "all") {
        deals = deals.filter((d: any) => {
          const ta = d.targetAudience || "patient";
          return ta === audience || ta === "both";
        });
      }
      res.json(deals);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch deals", error: err.message });
    }
  });

  app.post("/api/smile-deals/:id/view", async (req, res) => {
    try {
      await storage.incrementDealView(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/smile-deals/:id/click", async (req, res) => {
    try {
      await storage.incrementDealClick(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/smile-deals", isAdmin, async (req, res) => {
    try {
      const dealData = {
        ...req.body,
        price: req.body.price || null,
        originalPrice: req.body.originalPrice || null,
        subcategory: req.body.subcategory || null,
        isFlash: req.body.isFlash ?? false,
        startsAt: req.body.startsAt ? new Date(req.body.startsAt) : null,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null
      };
      const deal = await storage.createSmileDeal(dealData);
      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create deal", error: err.message });
    }
  });

  app.patch("/api/admin/smile-deals/:id", isAdmin, async (req, res) => {
    try {
      const updates = {
        ...req.body,
        ...(req.body.startsAt !== undefined && { startsAt: req.body.startsAt ? new Date(req.body.startsAt) : null }),
        ...(req.body.expiresAt !== undefined && { expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null })
      };
      const deal = await storage.updateSmileDeal(Number(req.params.id), updates);
      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update deal", error: err.message });
    }
  });

  app.delete("/api/admin/smile-deals/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteSmileDeal(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete deal", error: err.message });
    }
  });

  app.get("/api/whatsapp-webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === "subscribe" && verifyToken && token === verifyToken) {
      console.log("[WHATSAPP-META] Webhook verified by Meta.");
      res.status(200).send(challenge);
    } else {
      console.warn("[WHATSAPP-META] Webhook verification failed — token mismatch or missing.");
      res.sendStatus(403);
    }
  });

  app.post("/api/whatsapp-webhook", (req, res) => {
    const body = req.body;
    if (body?.object === "whatsapp_business_account") {
      const entries = body.entry ?? [];
      for (const entry of entries) {
        for (const change of entry.changes ?? []) {
          const statuses = change.value?.statuses ?? [];
          for (const status of statuses) {
            console.log(`[WHATSAPP-META] Delivery event: id=${status.id} status=${status.status} to=${status.recipient_id}`);
          }
        }
      }
    }
    res.sendStatus(200);
  });

  app.get("/api/health/backend", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/health/database", async (req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok", message: "Database connection is healthy", database: true });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message, database: false });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok", timestamp: new Date().toISOString(), backend: true, database: true });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message, backend: true, database: false });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    const sess = req.session as any;
    if (!sess?.adminLoggedIn && !sess?.doctorLoggedIn) {
      return res.json([]);
    }

    const userId = String(sess.doctorId || sess.doctorEmail || sess.clinicId || sess.adminEmail || "superuser");

    try {
      const userNotifications = await storage.getNotifications(userId);
      res.json(userNotifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    const sess = req.session as any;
    if (!sess?.adminLoggedIn && !sess?.doctorLoggedIn) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = String(sess.doctorId || sess.doctorEmail || sess.clinicId || sess.adminEmail || "superuser");
    try {
      await storage.markAllNotificationsRead(userId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notification = await storage.markNotificationRead(Number(req.params.id));
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/clinic/login", loginRateLimiter, async (req, res) => {
    const { username, password } = req.body;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
    const ua = req.headers["user-agent"] || null;
    try {
      const clinic = await storage.getClinicByUsername(username);
      if (!clinic || clinic.isArchived) {
        storage.createLoginEvent({ role: "owner", identifier: username || "unknown", ipAddress: ip, userAgent: ua, success: false }).catch(() => {});
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const isMatch = await bcrypt.compare(password, clinic.passwordHash || "");
      if (!isMatch) {
        storage.createLoginEvent({ role: "owner", identifier: username, ipAddress: ip, userAgent: ua, success: false }).catch(() => {});
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ message: "Session error" });
        const sess = req.session as any;
        sess.adminLoggedIn = true;
        sess.clinicId = clinic.id;
        sess.role = 'owner';
        storage.createLoginEvent({ role: "owner", identifier: clinic.name, ipAddress: ip, userAgent: ua, success: true }).catch(() => {});
        req.session.save(() => res.json({ message: "Login successful", user: { id: clinic.id, name: clinic.name, role: 'owner' } }));
      });
    } catch (error: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/admin/login", loginRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      adminOtpStore = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

      const adminEmail = process.env.ADMIN_EMAIL || TEST_EMAIL;
      const finalEmail = RESEND_MODE === 'PRODUCTION' ? adminEmail : TEST_EMAIL;

      if (resend) {
        try {
          await resend.emails.send({
            from: EMAIL_FROM,
            to: finalEmail,
            subject: `BookMySlot – Admin Login Code (expires in 10 min)`,
            html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>BookMySlot Admin OTP</title></head>
<body style="margin:0;padding:0;background:#0d1f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d1f1a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;background:#0d2a1f;border-radius:14px;overflow:hidden;border:1px solid #1a4a30;box-shadow:0 2px 30px rgba(0,0,0,.4);">
        <tr><td style="height:3px;background:linear-gradient(90deg,#0f9b6e,#1dbe88,#5dcaa5);font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 40px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
            <td style="width:34px;height:34px;background:rgba(255,255,255,.15);border-radius:8px;text-align:center;vertical-align:middle;"><span style="font-size:17px;line-height:34px;color:white;">&#128197;</span></td>
            <td style="padding-left:10px;vertical-align:middle;"><span style="font-size:16px;font-weight:700;color:white;letter-spacing:-.3px;">bookMySlot</span><span style="font-size:11px;color:#5dcaa5;font-weight:600;"> DENTAL</span></td>
          </tr></table>
          <p style="margin:24px 0 4px;font-size:13px;font-weight:600;color:#5dcaa5;text-transform:uppercase;letter-spacing:.12em;">Superadmin authentication</p>
          <p style="margin:0 0 24px;font-size:16px;color:rgba(255,255,255,.7);">Your one-time access code</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="background:#0a3020;border:1.5px solid #1a9e6f;border-radius:12px;">
            <tr><td style="padding:24px 48px;text-align:center;">
              <p style="margin:0;font-size:52px;font-weight:700;color:#5dcaa5;letter-spacing:.35em;font-family:'Courier New',Courier,monospace;line-height:1.1;">${otp}</p>
              <p style="margin:10px 0 0;font-size:12px;color:#4a8a60;">Expires in <strong style="color:#5dcaa5;">10 minutes</strong> &nbsp;&middot;&nbsp; Single use only</p>
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:12px;color:#4a7060;line-height:1.6;">Never share this code. If you did not request this, your password may be compromised.</p>
        </td></tr>
        <tr><td style="padding:16px 40px;border-top:1px solid #1a3a28;"><p style="margin:0;font-size:11px;color:#3a5a48;text-align:center;">bookMySlot Dental &nbsp;&middot;&nbsp; Internal use only &nbsp;&middot;&nbsp; <a href="mailto:bookmyslot@mail.mossaic.in" style="color:#5dcaa5;text-decoration:none;">bookmyslot@mail.mossaic.in</a></p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          });
        } catch (err) {
          console.error('[ADMIN 2FA] Failed to send OTP email:', err);
        }
      } else {
        console.log(`[ADMIN 2FA DEV] OTP for admin login: ${otp}`);
      }

      return res.json({ step: "otp_required" });
    }
    res.status(401).json({ message: "Invalid credentials" });
  });

  app.post("/api/auth/admin/verify-otp", (req, res) => {
    const { otp } = req.body;
    if (!adminOtpStore) {
      return res.status(400).json({ message: "No OTP pending. Please start login again." });
    }
    if (Date.now() > adminOtpStore.expiresAt) {
      adminOtpStore = null;
      return res.status(400).json({ message: "OTP has expired. Please start login again." });
    }
    if (otp !== adminOtpStore.otp) {
      return res.status(401).json({ message: "Incorrect OTP. Please try again." });
    }
    adminOtpStore = null;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
    const ua = req.headers["user-agent"] || null;
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: "Session error" });
      const sess = req.session as any;
      sess.adminLoggedIn = true;
      sess.role = 'superuser';
      sess.adminEmail = process.env.ADMIN_EMAIL;
      storage.createLoginEvent({ role: "superuser", identifier: process.env.ADMIN_EMAIL || "superuser", ipAddress: ip, userAgent: ua, success: true }).catch(() => {});
      req.session.save(() =>
        res.json({ message: "Login successful", user: { email: process.env.ADMIN_EMAIL, role: 'superuser', firstName: 'Super', lastName: 'Admin' } })
      );
    });
  });

  app.post("/api/auth/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid', { path: '/' });
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/admin/login-events", async (req, res) => {
    const sess = req.session as any;
    if (!sess?.adminLoggedIn || sess.role !== 'superuser') {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
      const events = await storage.getLoginEvents(limit);
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/user", (req, res) => {
    const sess = req.session as any;
    if (sess.adminLoggedIn && sess.role === 'superuser') {
      res.json({ email: sess.adminEmail || process.env.ADMIN_EMAIL, role: 'superuser', firstName: 'Super', lastName: 'Admin' });
    } else if (sess.adminLoggedIn && sess.clinicId && sess.role === 'owner') {
      res.json(null);
    } else {
      res.json(null);
    }
  });

  app.get("/api/auth/me", isAuthenticated, (req, res) => res.json((req as any).user));

  app.get("/api/auth/clinic/me", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess?.adminLoggedIn || !sess.clinicId || sess.role !== 'owner') return res.json(null);
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/website-config", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    try {
      const clinic = await storage.updateClinic(sess.clinicId, { websiteConfig: req.body } as any);
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/me", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const ALLOWED_FIELDS = ["phone", "email", "website", "address", "city", "pincode", "doctorName", "logoUrl", "latitude", "longitude"];
    const updates: Record<string, any> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in req.body) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided" });
    }
    try {
      const clinic = await storage.updateClinic(sess.clinicId, updates);
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/clinic/doctors", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const { name, specialization, degree, email, imageUrl } = req.body;
    if (!name || !specialization || !degree) return res.status(400).json({ message: "name, specialization and degree are required" });
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      const existingDoctors: any[] = Array.isArray(clinic.doctors) ? clinic.doctors : [];
      if (email) {
        const emailLower = email.trim().toLowerCase();
        const alreadyInClinic = existingDoctors.some(
          (d: any) => d.email && d.email.trim().toLowerCase() === emailLower
        );
        if (alreadyInClinic) {
          return res.status(409).json({ message: "A doctor with this email is already part of your clinic." });
        }
      }
      const newDoctorEntry = { name, specialization, degree, email: email || null, imageUrl: imageUrl || null };
      const updatedClinic = await storage.updateClinic(sess.clinicId, { doctors: [...existingDoctors, newDoctorEntry] });
      if (email) {
        let doctorRecord = await storage.getDoctorByEmail(email);
        if (!doctorRecord) {
          const tempPassword = generateTempPassword();
          const passwordHash = await bcrypt.hash(tempPassword, 10);
          doctorRecord = await storage.createDoctor({ name, email, passwordHash, isTemporaryPassword: true, specialization: specialization || null, degree: degree || null, imageUrl: imageUrl || null } as any);
          sendDoctorWelcomeEmail(email, name, clinic.name, tempPassword).catch(() => {});
        }
        const existingLinks = await storage.getClinicDoctors(sess.clinicId);
        const alreadyLinked = existingLinks.some(d => d.id === doctorRecord!.id);
        if (!alreadyLinked) {
          await storage.linkDoctorToClinic(sess.clinicId, doctorRecord.id);
        }
      }
      res.status(201).json(updatedClinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/clinic/linked-doctors", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    try {
      const linked = await storage.getClinicDoctors(sess.clinicId);
      res.json(linked.map(d => ({ id: d.id, name: d.name, email: d.email })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/clinic/doctors/:doctorId/reset-password", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const doctorId = parseInt(req.params.doctorId);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters." });
    try {
      const linked = await storage.getClinicDoctors(sess.clinicId);
      const isLinked = linked.some(d => d.id === doctorId);
      if (!isLinked) return res.status(403).json({ message: "This doctor is not linked to your clinic." });
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(doctors).set({ passwordHash, isTemporaryPassword: true }).where(eq(doctors.id, doctorId));
      res.json({ message: "Password reset successfully." });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/auth/clinic/doctors/:index", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const index = parseInt(req.params.index);
    if (isNaN(index)) return res.status(400).json({ message: "Invalid doctor index" });
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      const existingDoctors: any[] = Array.isArray(clinic.doctors) ? clinic.doctors : [];
      if (index < 0 || index >= existingDoctors.length) return res.status(404).json({ message: "Doctor not found at that index" });
      const updatedDoctors = existingDoctors.filter((_, i) => i !== index);
      const updatedClinic = await storage.updateClinic(sess.clinicId, { doctors: updatedDoctors });
      res.json(updatedClinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/doctor/login", loginRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
    const ua = req.headers["user-agent"] || null;
    try {
      const doctor = await storage.getDoctorByEmail(email);
      if (!doctor) {
        storage.createLoginEvent({ role: "doctor", identifier: email, ipAddress: ip, userAgent: ua, success: false }).catch(() => {});
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const isMatch = await bcrypt.compare(password, doctor.passwordHash || "");
      if (!isMatch) {
        storage.createLoginEvent({ role: "doctor", identifier: email, ipAddress: ip, userAgent: ua, success: false }).catch(() => {});
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const clinicResults = await db.select({ clinic: clinics })
        .from(clinics)
        .innerJoin(clinicDoctors, eq(clinics.id, clinicDoctors.clinicId))
        .where(eq(clinicDoctors.doctorId, doctor.id));
      if (!clinicResults.length) return res.status(403).json({ message: "Doctor is not linked to any clinic" });
      const clinic = clinicResults[0].clinic;
      const isDefaultPassword = (doctor as any).isTemporaryPassword ?? await bcrypt.compare("demo123", doctor.passwordHash || "");
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ message: "Session error" });
        const sess = req.session as any;
        sess.doctorLoggedIn = true;
        sess.role = 'doctor';
        sess.doctorEmail = doctor.email;
        sess.doctorId = doctor.id;
        storage.createLoginEvent({ role: "doctor", identifier: doctor.email, ipAddress: ip, userAgent: ua, success: true }).catch(() => {});
        req.session.save(() => res.json({
          email: doctor.email,
          name: doctor.name,
          specialization: doctor.specialization,
          clinicId: clinic.id,
          clinicName: clinic.name,
          logoUrl: clinic.logoUrl ?? null,
          isDefaultPassword,
        }));
      });
    } catch (error: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/auth/clinic/forgot-password — send reset link to clinic's registered email
  app.post("/api/auth/clinic/forgot-password", async (req, res) => {
    const { email } = req.body;
    // Always respond with neutral message to prevent email enumeration
    res.json({ message: "If this email is registered, you will receive a reset link shortly." });
    if (!email) return;
    try {
      const [clinic] = await db.select().from(clinics)
        .where(eq(clinics.email, email.toLowerCase().trim()))
        .limit(1);
      if (!clinic || clinic.isArchived || !clinic.passwordHash) return;
      const rawToken = crypto.randomUUID();
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await db.delete(emailOtps).where(
        and(eq(emailOtps.email, email.toLowerCase().trim()), eq(emailOtps.purpose, "clinic_password_reset"))
      );
      await db.insert(emailOtps).values({
        email: email.toLowerCase().trim(),
        otpHash: tokenHash,
        expiresAt,
        verified: false,
        purpose: "clinic_password_reset",
      });
      const frontendBase = process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in';
      const resetUrl = `${frontendBase}/reset-password?token=${rawToken}&type=clinic`;
      await sendPasswordResetEmail(email, resetUrl, "clinic");
    } catch (err: any) {
      console.error("[FORGOT PASSWORD] Clinic error:", err.message);
    }
  });

  // POST /api/auth/doctor/forgot-password — send reset link to doctor's email
  app.post("/api/auth/doctor/forgot-password", async (req, res) => {
    const { email } = req.body;
    res.json({ message: "If this email is registered, you will receive a reset link shortly." });
    if (!email) return;
    try {
      const doctor = await storage.getDoctorByEmail(email.toLowerCase().trim());
      if (!doctor || !doctor.passwordHash) return;
      const rawToken = crypto.randomUUID();
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await db.delete(emailOtps).where(
        and(eq(emailOtps.email, email.toLowerCase().trim()), eq(emailOtps.purpose, "doctor_password_reset"))
      );
      await db.insert(emailOtps).values({
        email: email.toLowerCase().trim(),
        otpHash: tokenHash,
        expiresAt,
        verified: false,
        purpose: "doctor_password_reset",
      });
      const frontendBase = process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in';
      const resetUrl = `${frontendBase}/reset-password?token=${rawToken}&type=doctor`;
      await sendPasswordResetEmail(email, resetUrl, "doctor");
    } catch (err: any) {
      console.error("[FORGOT PASSWORD] Doctor error:", err.message);
    }
  });

  // POST /api/auth/reset-password — validate token and set new password
  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, type, newPassword } = req.body;
    if (!token || !type || !newPassword) return res.status(400).json({ message: "Token, type, and new password are required." });
    if (!["clinic", "doctor"].includes(type)) return res.status(400).json({ message: "Invalid type." });
    if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    try {
      const purpose = type === "clinic" ? "clinic_password_reset" : "doctor_password_reset";
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const [row] = await db.select().from(emailOtps)
        .where(and(eq(emailOtps.otpHash, tokenHash), eq(emailOtps.purpose, purpose), eq(emailOtps.verified, false)))
        .limit(1);
      if (!row) return res.status(400).json({ message: "This reset link is invalid or has already been used." });
      if (new Date() > row.expiresAt) return res.status(410).json({ message: "This reset link has expired. Please request a new one." });
      const passwordHash = await bcrypt.hash(newPassword, 10);
      if (type === "clinic") {
        const [clinic] = await db.select().from(clinics)
          .where(eq(clinics.email, row.email))
          .limit(1);
        if (!clinic) return res.status(404).json({ message: "Account not found." });
        await storage.updateClinic(clinic.id, { passwordHash } as any);
      } else {
        const doctor = await storage.getDoctorByEmail(row.email);
        if (!doctor) return res.status(404).json({ message: "Account not found." });
        await db.update(doctors).set({ passwordHash }).where(eq(doctors.id, doctor.id));
      }
      await db.update(emailOtps).set({ verified: true }).where(eq(emailOtps.id, row.id));
      await sendPasswordChangedEmail(row.email, type);
      res.json({ message: "Password updated successfully." });
    } catch (err: any) {
      console.error("[RESET PASSWORD] Error:", err.message);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get("/api/auth/doctor/me", async (req, res) => {
    const sess = req.session as any;
    if (!sess.doctorLoggedIn || sess.role !== 'doctor' || !sess.doctorEmail) {
      return res.json(null);
    }
    try {
      const doctor = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!doctor) return res.json(null);
      const clinicResults = await db.select({ clinic: clinics })
        .from(clinics)
        .innerJoin(clinicDoctors, eq(clinics.id, clinicDoctors.clinicId))
        .where(eq(clinicDoctors.doctorId, doctor.id));
      if (!clinicResults.length) return res.status(403).json({ message: "Doctor is not linked to any clinic" });
      const clinic = clinicResults[0].clinic;
      const isDefaultPassword = (doctor as any).isTemporaryPassword ?? await bcrypt.compare("demo123", doctor.passwordHash || "");
      res.json({
        id: doctor.id,
        email: doctor.email,
        name: doctor.name,
        specialization: doctor.specialization,
        clinicId: clinic.id,
        clinicName: clinic.name,
        logoUrl: clinic.logoUrl ?? null,
        isDefaultPassword,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/doctor/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid', { path: '/' });
      res.json({ message: "Logout successful" });
    });
  });

  app.post("/api/auth/doctor/change-password", async (req, res) => {
    const sess = req.session as any;
    if (!sess.doctorLoggedIn || sess.role !== 'doctor' || !sess.doctorEmail) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters." });
    if (newPassword !== confirmPassword) return res.status(400).json({ message: "Passwords do not match." });
    try {
      const doctor = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!doctor) return res.status(404).json({ message: "Doctor not found." });
      const isTemp = (doctor as any).isTemporaryPassword ?? await bcrypt.compare("demo123", doctor.passwordHash || "");
      if (!isTemp && currentPassword) {
        const valid = await bcrypt.compare(currentPassword, doctor.passwordHash || "");
        if (!valid) return res.status(401).json({ message: "Current password is incorrect." });
      } else if (!isTemp && !currentPassword) {
        return res.status(400).json({ message: "Current password is required." });
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(doctors).set({ passwordHash, isTemporaryPassword: false }).where(eq(doctors.id, doctor.id));
      res.json({ message: "Password changed successfully." });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/clinic/bookings", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role === 'doctor') {
      const email = sess.doctorEmail;
      const doctorId = sess.doctorId;
      // Get the clinic IDs this doctor is linked to via the authoritative join table
      const clinicLinks = await db.select({ clinicId: clinicDoctors.clinicId })
        .from(clinicDoctors)
        .where(eq(clinicDoctors.doctorId, doctorId));
      if (!clinicLinks.length) return res.json([]);
      // Return all bookings assigned to this doctor by email
      const results = await db.select({ booking: bookings, slot: slots, clinic: clinics })
        .from(bookings)
        .innerJoin(slots, eq(bookings.slotId, slots.id))
        .leftJoin(clinics, eq(slots.clinicId, clinics.id))
        .where(eq(bookings.assignedDoctorEmail, email));
      return res.json(results.map(r => ({ ...r.booking, clinicId: r.slot.clinicId, slot: r.slot, clinic: r.clinic })));
    }
    if (sess.clinicId) {
      const b = await storage.getClinicBookings(sess.clinicId);
      return res.json(b);
    }
    if (sess.role === 'superuser') {
      const cs = await storage.getClinics();
      const abs = await Promise.all(cs.map(c => storage.getClinicBookings(c.id)));
      return res.json(abs.flat());
    }
    res.status(403).json({ message: "Forbidden" });
  });

  // ── CLINIC ADMIN: create booking for a patient (walk-in or with email) ──────
  app.post("/api/auth/clinic/bookings", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });

    try {
      const { customerName, customerPhone, customerEmail, startTime, endTime, description, slotCost: rawSlotCost } = req.body;

      if (!customerName || !customerPhone || !startTime || !endTime) {
        return res.status(400).json({ message: "Name, phone, start time and end time are required" });
      }

      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const requestedStart = new Date(startTime);
      const slotCost = Math.max(1, Math.min(4, parseInt(rawSlotCost) || 1));

      // Look up clinic-configured max for this time bracket
      const admStartWindow = new Date(requestedStart.getTime() - 60_000);
      const admEndWindow   = new Date(requestedStart.getTime() + 60_000);
      const [admConfigSlot] = await db.select().from(slots)
        .where(and(eq(slots.clinicId, clinic.id), eq(slots.isBooked, false), gte(slots.startTime, admStartWindow), lte(slots.startTime, admEndWindow)))
        .limit(1);
      const admDefaultCfg = (clinic as any).defaultSlotConfig;
      const admHour = requestedStart.getHours();
      const admMin  = requestedStart.getMinutes();
      const admBracketMap: Record<number, string> = { 8: "1", 10: "2", 14: "4", 17: "5" };
      const admKey = admBracketMap[admHour] ?? (admHour === 12 && admMin === 30 ? "3" : undefined);
      const admDefaultSection = admKey ? admDefaultCfg?.sections?.[admKey] : undefined;
      const admMax = admConfigSlot?.maxBookings ?? admDefaultSection?.maxBookings ?? 4;
      const existingBookings = await storage.countVerifiedBookingsForClinicTime(clinic.id, clinic.name, requestedStart);
      if (existingBookings + slotCost > admMax) {
        const remaining = Math.max(0, admMax - existingBookings);
        return res.status(400).json({
          message: remaining === 0
            ? "This time slot is fully booked. Please choose another time."
            : `Only ${remaining} slot unit${remaining !== 1 ? 's' : ''} remaining. This procedure needs ${slotCost}. Choose a different bracket or procedure.`
        });
      }

      const slot = await storage.createSlot({
        ownerId: null,
        startTime: requestedStart,
        endTime: new Date(endTime),
        clinicName: clinic.name,
        clinicId: clinic.id,
        isBooked: true,
      } as any);

      const booking = await storage.createPublicBooking({
        slotId: slot.id,
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        description: description || null,
        verificationCode: null,
        verificationExpiresAt: null,
        verificationStatus: 'admin_booked',
      });

      // Store slot_cost on the booking
      try {
        await db.update(bookings).set({ slotCost } as any).where(eq(bookings.id, booking.id));
      } catch (e: any) { console.error('[ADMIN BOOKING] slot_cost update failed:', e.message); }

      // Upsert patient record so they appear in the Patients tab
      try {
        if (customerEmail && customerEmail.trim()) {
          const patient = await storage.upsertPatientByEmail(clinic.id, customerEmail.trim(), customerName, customerPhone);
          await db.update(bookings).set({ patientId: patient.id } as any).where(eq(bookings.id, booking.id));
        } else {
          const patient = await storage.upsertPatientByPhone(clinic.id, customerPhone, customerName);
          await db.update(bookings).set({ patientId: patient.id } as any).where(eq(bookings.id, booking.id));
        }
      } catch (e: any) {
        console.error('[ADMIN BOOKING] Patient upsert failed:', e.message);
      }

      // Send confirmation email to patient if email provided
      if (customerEmail && customerEmail.trim()) {
        try {
          await sendBookingEmails(customerEmail.trim(), customerName, clinic.email, clinic.name, requestedStart, customerPhone, (clinic as any).phone ?? null, booking.id);
        } catch (e: any) {
          console.error('[ADMIN BOOKING] Email send failed:', e.message);
        }
      }

      // Send WhatsApp notification if phone provided
      if (customerPhone) {
        try {
          await sendWhatsAppBookingNotification(customerPhone, customerName, clinic.name, requestedStart);
        } catch (e: any) {
          console.error('[ADMIN BOOKING] WhatsApp send failed:', e.message);
        }
      }

      res.status(201).json({ message: "Booking created successfully", booking: { ...booking, slot } });
    } catch (err: any) {
      console.error('[ADMIN BOOKING ERROR]', err.message);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.get("/api/auth/clinic/export-history", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    try {
      const history = await storage.getExportHistory(sess.clinicId);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/clinic/export-log", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const { fileName, format, scope, recordCount } = req.body;
    if (!fileName || !format || !scope || recordCount === undefined) {
      return res.status(400).json({ message: "fileName, format, scope and recordCount are required" });
    }
    try {
      const record = await storage.createExportRecord({
        clinicId: sess.clinicId,
        fileName,
        format,
        scope,
        recordCount,
      });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/clinic/export/xlsx", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const { scope, dateFrom, dateTo } = req.body as { scope: string[]; dateFrom?: string; dateTo?: string };
    if (!scope || !Array.isArray(scope) || scope.length === 0) {
      return res.status(400).json({ message: "scope is required" });
    }
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      let allBookings = await storage.getClinicBookings(sess.clinicId);

      // Apply optional date filter
      if (dateFrom || dateTo) {
        const from = dateFrom ? new Date(dateFrom) : null;
        const to   = dateTo   ? new Date(dateTo)   : null;
        if (to) to.setHours(23, 59, 59, 999);
        allBookings = allBookings.filter(b => {
          const d = new Date(b.slot.startTime);
          if (from && d < from) return false;
          if (to   && d > to)   return false;
          return true;
        });
      }

      const exportDate = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

      // Human-readable status helpers
      const apptStatusLabel  = (s: string) =>
        s === "confirmed" ? "Confirmed" : s === "cancelled" ? "Cancelled" : "Pending";
      const visitStatusLabel = (s: string | null | undefined) =>
        !s ? "" : s === "checked_in" ? "Arrived" : s === "in_consultation" ? "With Doctor" : s === "completed" ? "Visit Done" : s;
      const clinicalLabel    = (s: string | null | undefined) =>
        !s ? "" : s === "first_visit" ? "First Visit" : s === "revisit" ? "Revisit" :
        s === "follow_up_required" ? "Follow-up Required" : s === "case_closed" ? "Case Closed" : s;

      // Deduplicate patients — patientId first, then email, then phone
      const seen = new Set<string>();
      const uniquePatients = allBookings.filter(b => {
        const key = String((b as any).patientId ?? b.customerEmail ?? b.customerPhone);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Compute per-patient visit stats
      const patientStats = new Map<string, { firstVisit: Date; lastVisit: Date; totalVisits: number }>();
      for (const b of allBookings) {
        const key = String((b as any).patientId ?? b.customerEmail ?? b.customerPhone);
        const d   = new Date(b.slot.startTime);
        const ex  = patientStats.get(key);
        if (!ex) {
          patientStats.set(key, { firstVisit: d, lastVisit: d, totalVisits: 1 });
        } else {
          if (d < ex.firstVisit) ex.firstVisit = d;
          if (d > ex.lastVisit)  ex.lastVisit  = d;
          ex.totalVisits++;
        }
      }

      // ── Patient Profiles ──
      const patientsHeaders = ["Patient Code", "Patient Name", "Phone", "Email", "Age", "Gender", "First Visit", "Last Visit", "Total Visits"];
      const patientsData = uniquePatients.map(b => {
        const key   = String((b as any).patientId ?? b.customerEmail ?? b.customerPhone);
        const stats = patientStats.get(key);
        return [
          (b as any).patientCode ?? "",
          b.customerName,
          b.customerPhone,
          b.customerEmail ?? "",
          b.customerAge ?? "",
          b.customerGender ? (b.customerGender.charAt(0).toUpperCase() + b.customerGender.slice(1)) : "",
          stats ? fmtDate(stats.firstVisit) : "",
          stats ? fmtDate(stats.lastVisit)  : "",
          stats?.totalVisits ?? 1,
        ];
      });

      // ── Appointments ──
      const apptHeaders = [
        "Booking ID", "Patient Code", "Patient Name", "Phone", "Age", "Gender",
        "Date", "Day", "Time", "Duration (min)", "Doctor",
        "Appt Status", "Visit Status", "Clinical Status",
        "Chief Complaint", "Payment Status", "Amount (₹)",
      ];
      const apptData = allBookings.map(b => {
        const start = new Date(b.slot.startTime);
        const end   = new Date(b.slot.endTime);
        const durMin = Math.round((end.getTime() - start.getTime()) / 60000);
        return [
          b.id,
          (b as any).patientCode ?? "",
          b.customerName,
          b.customerPhone,
          b.customerAge ?? "",
          b.customerGender ? (b.customerGender.charAt(0).toUpperCase() + b.customerGender.slice(1)) : "",
          fmtDate(start),
          start.toLocaleDateString("en-GB", { weekday: "long" }),
          start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          durMin,
          (b as any).assignedDoctor ?? "Unassigned",
          apptStatusLabel(b.verificationStatus),
          visitStatusLabel((b as any).visitStatus),
          clinicalLabel((b as any).clinicalStatus),
          b.description ?? "",
          (b as any).paymentStatus ?? "",
          (b as any).paymentAmount ? String((b as any).paymentAmount / 100) : "",
        ];
      });

      // ── Billing History ──
      const billsHeaders = [
        "Bill #", "Date", "Patient Name", "Patient Code", "Patient Phone",
        "Doctor", "Services", "Subtotal (₹)", "Discount %", "Tax %",
        "Total (₹)", "Payment Method", "Status",
      ];
      let billsData: (string | number)[][] = [];
      let billsCount = 0;
      if (scope.includes("billing")) {
        const allBills = await storage.getPatientBillsByClinicId(sess.clinicId);
        const filteredBills = allBills.filter(b => {
          if (!dateFrom && !dateTo) return true;
          const d   = new Date(b.createdAt!);
          const from = dateFrom ? new Date(dateFrom) : null;
          const to   = dateTo   ? new Date(dateTo)   : null;
          if (to) to.setHours(23, 59, 59, 999);
          if (from && d < from) return false;
          if (to   && d > to)   return false;
          return true;
        });
        billsCount = filteredBills.length;
        billsData  = filteredBills.map(b => {
          const matchedBooking = allBookings.find(bk => bk.id === b.bookingId);
          const patientCode    = (matchedBooking as any)?.patientCode ?? "";
          const doctor         = (matchedBooking as any)?.assignedDoctor ?? "";
          const servicesSummary = ((b.services ?? []) as any[]).map((s: any) => s.description).filter(Boolean).join(", ");
          const statusLabel = b.paymentStatus === "paid" ? "Paid" : b.paymentStatus === "partial" ? "Partial" : "Pending";
          return [
            b.billNumber,
            fmtDate(new Date(b.createdAt!)),
            b.patientName,
            patientCode,
            b.patientPhone ?? "",
            doctor,
            servicesSummary,
            b.subtotal  ?? 0,
            b.discountPct ?? 0,
            b.taxPct    ?? 0,
            b.total     ?? 0,
            b.paymentMethod ?? "Cash",
            statusLabel,
          ];
        });
      }

      // --- ExcelJS formatting ---
      const DARK    = "FF085041";
      const MID     = "FF0A6649";
      const PRIMARY = "FF0F9B6E";
      const TINT    = "FFE1F5EE";
      const OFF     = "FFF8F8F6";
      const WHITE   = "FFFFFFFF";
      const thin = (argb = "FFCCCCCC") => ({ style: "thin" as const, color: { argb } });

      function applyHeaderCell(cell: ExcelJS.Cell) {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
        cell.font      = { bold: true, size: 10, color: { argb: WHITE } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border    = { top: thin(DARK), bottom: thin(DARK), left: thin(DARK), right: thin(DARK) };
      }

      function applyDataCell(cell: ExcelJS.Cell, rowIdx: number, statusColor?: string) {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: rowIdx % 2 === 0 ? TINT : OFF } };
        cell.border    = { top: thin(), bottom: thin(), left: thin(), right: thin() };
        cell.alignment = { vertical: "middle", wrapText: false };
        cell.font      = statusColor
          ? { size: 9, bold: true, color: { argb: statusColor } }
          : { size: 9, color: { argb: "FF1A1A1A" } };
      }

      type StatusMap = { col: number; map: Record<string, string> };

      function buildSheet(
        wb: ExcelJS.Workbook,
        sheetName: string,
        headers: string[],
        rows: (string | number | null | undefined)[][],
        colWidths: number[],
        recordCount: number,
        statusCols: StatusMap[] = [],
      ) {
        const ws = wb.addWorksheet(sheetName);
        const nc = headers.length;
        const lastCol = nc <= 26 ? String.fromCharCode(64 + nc) : "Z";

        // Row 1 — Clinic name banner
        ws.mergeCells(`A1:${lastCol}1`);
        const r1 = ws.getCell("A1");
        r1.value = clinic!.name;
        r1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
        r1.font  = { bold: true, size: 14, color: { argb: WHITE } };
        r1.alignment = { vertical: "middle", horizontal: "center" };
        ws.getRow(1).height = 32;

        // Row 2 — Meta subtitle
        ws.mergeCells(`A2:${lastCol}2`);
        const r2 = ws.getCell("A2");
        r2.value = `${sheetName}  ·  Exported: ${exportDate}  ·  ${recordCount} records`;
        r2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: MID } };
        r2.font  = { italic: true, size: 9, color: { argb: "FFAACCBB" } };
        r2.alignment = { vertical: "middle", horizontal: "center" };
        ws.getRow(2).height = 18;

        // Row 3 — Accent stripe
        ws.mergeCells(`A3:${lastCol}3`);
        ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
        ws.getRow(3).height = 4;

        // Row 4 — Headers
        const hRow = ws.getRow(4);
        headers.forEach((h, i) => {
          hRow.getCell(i + 1).value = h;
          applyHeaderCell(hRow.getCell(i + 1));
        });
        hRow.height = 22;

        // Data rows
        rows.forEach((row, rIdx) => {
          const dRow = ws.getRow(5 + rIdx);
          row.forEach((val, cIdx) => {
            const cell = dRow.getCell(cIdx + 1);
            cell.value = val ?? "";
            let statusColor: string | undefined;
            for (const sc of statusCols) {
              if (cIdx === sc.col) statusColor = sc.map[String(val ?? "").toLowerCase()];
            }
            applyDataCell(cell, rIdx, statusColor);
          });
          dRow.height = 18;
        });

        colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
        ws.autoFilter = `A4:${lastCol}4`;
        ws.views = [{ state: "frozen", ySplit: 4, xSplit: 0, topLeftCell: "A5", activeCell: "A5" }];
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = clinic.name;
      wb.created = new Date();

      // ── Summary sheet (always first) ──
      const summaryWs = wb.addWorksheet("Summary");
      summaryWs.getColumn(1).width = 26;
      summaryWs.getColumn(2).width = 42;

      summaryWs.mergeCells("A1:B1");
      const sumTitle = summaryWs.getCell("A1");
      sumTitle.value = `${clinic.name} — Export Summary`;
      sumTitle.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      sumTitle.font  = { bold: true, size: 13, color: { argb: WHITE } };
      sumTitle.alignment = { vertical: "middle", horizontal: "center" };
      summaryWs.getRow(1).height = 30;

      const summaryRows: [string, string | number][] = [
        ["Clinic",         clinic.name],
        ["Phone",          (clinic as any).phone   ?? ""],
        ["Email",          (clinic as any).email   ?? ""],
        ["Address",        (clinic as any).address ?? ""],
        ["Export Date",    exportDate],
        ["Date Range",     (dateFrom || dateTo) ? `${dateFrom ?? "Start"} to ${dateTo ?? "Today"}` : "All time"],
        ["", ""],
        ...(scope.includes("patients")     ? [["Unique Patients",    uniquePatients.length] as [string, number]] : []),
        ...(scope.includes("appointments") ? [["Total Appointments", allBookings.length]   as [string, number]] : []),
        ...(scope.includes("billing")      ? [["Total Bills",        billsCount]           as [string, number]] : []),
      ];

      summaryRows.forEach(([label, value], i) => {
        const row = summaryWs.getRow(i + 2);
        const c1  = row.getCell(1);
        const c2  = row.getCell(2);
        c1.value = label; c2.value = value;
        c1.font = { bold: true, size: 9, color: { argb: MID } };
        c2.font = { size: 9, color: { argb: "FF1A1A1A" } };
        const bg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: i % 2 === 0 ? TINT : OFF } };
        c1.fill = c2.fill = bg;
        c1.border = c2.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
        c1.alignment = c2.alignment = { vertical: "middle" };
        row.height = 18;
      });

      // Status color maps for conditional formatting
      const apptStatusColors: Record<string, string> = {
        confirmed: "FF0F9B6E", pending: "FFD97706", cancelled: "FFDC2626",
      };
      const visitStatusColors: Record<string, string> = {
        arrived: "FF059669", "with doctor": "FF0D9488", "visit done": "FF64748B",
      };
      const payStatusColors: Record<string, string> = {
        paid: "FF0F9B6E", partial: "FF2563EB", pending: "FFD97706",
        "": "",
      };

      if (scope.includes("patients")) {
        buildSheet(wb, "Patient Profiles", patientsHeaders, patientsData,
          [14, 26, 16, 32, 8, 10, 14, 14, 12], uniquePatients.length);
      }
      if (scope.includes("appointments")) {
        buildSheet(wb, "Appointments", apptHeaders, apptData,
          [10, 14, 24, 16, 7, 10, 14, 13, 10, 12, 22, 12, 13, 16, 34, 14, 12],
          allBookings.length,
          [
            { col: 11, map: apptStatusColors  },
            { col: 12, map: visitStatusColors },
            { col: 15, map: payStatusColors   },
          ],
        );
      }
      if (scope.includes("billing")) {
        buildSheet(wb, "Billing History", billsHeaders, billsData,
          [14, 12, 26, 14, 14, 22, 38, 12, 10, 8, 12, 16, 10],
          billsCount,
          [{ col: 12, map: { paid: "FF0F9B6E", partial: "FF2563EB", pending: "FFD97706" } }],
        );
      }

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="export.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("[EXPORT] XLSX generation failed:", err);
      res.status(500).json({ message: "Failed to generate Excel file" });
    }
  });

  const bulkConfigBodySchema = z.object({
    slots: z.array(z.object({
      startTime: z.string().refine(v => !isNaN(new Date(v).getTime()), { message: "startTime must be a valid ISO date string" }),
      maxBookings: z.number().int().min(0).max(30).default(3),
      isCancelled: z.boolean().default(false),
    })).min(1, "slots array must not be empty"),
  });

  app.post("/api/auth/clinic/slots/configure-bulk", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const parsed = bulkConfigBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid request body" });
    const { slots: slotConfigs } = parsed.data;
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      const parsedSlots = slotConfigs.map((s: any) => ({
        startTime: new Date(s.startTime),
        endTime: new Date(new Date(s.startTime).getTime() + 30 * 60 * 1000),
        maxBookings: s.maxBookings ?? 3,
        isCancelled: s.isCancelled ?? false,
      }));
      const minTime = new Date(Math.min(...parsedSlots.map((s: any) => s.startTime.getTime())));
      const maxTime = new Date(Math.max(...parsedSlots.map((s: any) => s.startTime.getTime())));
      const existing = await db.select({ id: slots.id, startTime: slots.startTime })
        .from(slots)
        .where(and(eq(slots.clinicId, sess.clinicId), gte(slots.startTime, minTime), lte(slots.startTime, maxTime)))
        .orderBy(desc(slots.id));
      const existingMap = new Map<string, number>();
      for (const row of existing) {
        const key = new Date(row.startTime).toISOString();
        if (!existingMap.has(key)) existingMap.set(key, row.id);
      }
      let saved = 0;
      await db.transaction(async (tx) => {
        for (const s of parsedSlots) {
          const key = s.startTime.toISOString();
          const existingId = existingMap.get(key);
          if (existingId) {
            await tx.update(slots).set({ maxBookings: s.maxBookings, isCancelled: s.isCancelled }).where(eq(slots.id, existingId));
          } else {
            await tx.insert(slots).values({
              ownerId: null, startTime: s.startTime, endTime: s.endTime,
              clinicName: clinic.name, clinicId: clinic.id,
              isBooked: false, maxBookings: s.maxBookings, isCancelled: s.isCancelled,
            } as any);
          }
          saved++;
        }
      });
      res.json({ saved });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/clinic/default-config", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      res.json({ defaultSlotConfig: (clinic as any).defaultSlotConfig ?? null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/default-config", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const defaultConfigSchema = z.object({
      isClosed: z.boolean(),
      sections: z.record(z.object({
        maxBookings: z.number().int().min(0).max(30),
        isCancelled: z.boolean(),
      })),
    });
    const parsed = defaultConfigSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid config" });
    try {
      await storage.updateClinic(sess.clinicId, { defaultSlotConfig: parsed.data } as any);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/clinic/slots/configs", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const { from, to } = req.query;
    try {
      const fromDate = from ? new Date(from as string) : new Date();
      const rawTo = to ? new Date(to as string) : new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);
      if (isNaN(fromDate.getTime()) || isNaN(rawTo.getTime())) {
        return res.status(400).json({ message: "Invalid from/to date parameters" });
      }
      const toDate = new Date(rawTo);
      toDate.setHours(23, 59, 59, 999);
      const rows = await db.select({ startTime: slots.startTime, maxBookings: slots.maxBookings, isCancelled: slots.isCancelled })
        .from(slots)
        .where(and(eq(slots.clinicId, sess.clinicId), gte(slots.startTime, fromDate), lte(slots.startTime, toDate)))
        .orderBy(desc(slots.id));
      const seen = new Set<string>();
      const deduped = rows.filter(row => {
        const key = new Date(row.startTime).toISOString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      res.json(deduped);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/bookings/:id/reschedule", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    const { newSlotId } = req.body;
    if (!newSlotId) return res.status(400).json({ message: "newSlotId is required" });
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const oldSlot = await storage.getSlot(booking.slotId);
      const updated = await storage.rescheduleBooking(bookingId, newSlotId);
      const newSlot = await storage.getSlot(newSlotId);
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, sess.clinicId || 0));
      if (booking.customerEmail && newSlot) {
        sendRescheduleEmail(
          booking.customerEmail,
          booking.customerName,
          clinic?.name || 'the clinic',
          oldSlot ? new Date(oldSlot.startTime) : new Date(),
          new Date(newSlot.startTime),
          (clinic as any)?.phone ?? null,
          bookingId,
        ).catch((err) => console.error('[EMAIL ERROR] Reschedule email failed:', err));
      }
      // In-app notification for clinic admin — booking rescheduled
      if (clinic?.id && newSlot) {
        try {
          const newDateStr = new Date(newSlot.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          const reschedNotif = await storage.createNotification({
            userId: String(clinic.id),
            message: `Booking #${bookingId} for ${booking.customerName} rescheduled to ${newDateStr}`,
            read: false,
            type: "booking_rescheduled",
            bookingId,
          });
          broadcastToClinic(String(clinic.id), { type: "booking_rescheduled", bookingId, notification: reschedNotif });
        } catch (e: any) {
          console.error('[NOTIFICATION] Reschedule notification failed:', e.message);
        }
      }

      // G6 — Notify assigned doctor that the appointment was rescheduled
      if (booking.assignedDoctorEmail && newSlot) {
        try {
          const [reschedDoc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, booking.assignedDoctorEmail)).limit(1);
          if (reschedDoc) {
            const newTimeStr = format(new Date(newSlot.startTime), 'EEE d MMM, h:mm a');
            const reschedDocNotif = await storage.createNotification({
              userId: String(reschedDoc.id),
              message: `Appointment for ${booking.customerName} has been rescheduled to ${newTimeStr}`,
              read: false,
              type: "booking_rescheduled",
              bookingId,
            });
            broadcastToDoctor(String(reschedDoc.id), { type: "booking_rescheduled", bookingId, notification: reschedDocNotif });
          }
        } catch (e: any) {
          console.error('[NOTIFICATION] Reschedule doctor notification failed:', e.message);
        }
      }

      // G7 — WhatsApp notification to patient on reschedule
      if (booking.customerPhone && newSlot) {
        try {
          const { sendWhatsAppMessage } = await import('./whatsapp.service');
          const newFmtStr = format(new Date(newSlot.startTime), 'EEE d MMM, h:mm a');
          sendWhatsAppMessage(
            booking.customerPhone,
            `Hi ${booking.customerName}, your appointment at ${clinic?.name || 'the clinic'} has been rescheduled to *${newFmtStr}*. Please reply if you have any questions.`
          ).catch(() => {});
        } catch { /* WhatsApp unavailable */ }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/bookings/:id/clinical-status", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    try {
      const { clinicalStatus } = req.body;
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const [updated] = await db.update(bookings)
        .set({ clinicalStatus: clinicalStatus ?? null })
        .where(eq(bookings.id, bookingId))
        .returning();
      // G10 — Notify assigned doctor on ALL clinical status changes (not just case_closed)
      if (clinicalStatus && booking.assignedDoctorEmail) {
        try {
          const [doc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, booking.assignedDoctorEmail)).limit(1);
          if (doc) {
            const statusLabels: Record<string, string> = {
              first_visit: 'First Visit', revisit: 'Revisit',
              follow_up_required: 'Follow-up Required', case_closed: 'Case Closed',
            };
            const label = statusLabels[clinicalStatus] ?? clinicalStatus;
            const notifType = clinicalStatus === 'case_closed' ? 'case_closed_by_clinic' : 'clinical_status_updated';
            const notif = await storage.createNotification({
              userId: String(doc.id),
              message: `Clinic admin updated ${booking.customerName}'s clinical status to "${label}"`,
              read: false,
              type: notifType,
              bookingId,
            });
            broadcastToDoctor(String(doc.id), { type: notifType, bookingId, notification: notif });
          }
        } catch (e: any) { console.error('[NOTIFICATION] Clinical status (clinic) notification failed:', e.message); }
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/bookings/:id/checkin", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    try {
      const { undo } = req.body;
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const visitStatus = undo ? null : 'checked_in';
      const checkedInAt = undo ? null : new Date();
      const updated = await storage.updateVisitStatus(bookingId, visitStatus, checkedInAt);
      if (!undo && booking.assignedDoctorEmail) {
        try {
          const [doc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, booking.assignedDoctorEmail)).limit(1);
          if (doc) {
            const slot = await storage.getSlot(booking.slotId);
            const timeStr = slot ? new Date(slot.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
            const notif = await storage.createNotification({ userId: String(doc.id), message: `${booking.customerName} is in the waiting room${timeStr ? ` — ${timeStr} slot` : ''}`, read: false, type: "patient_checked_in", bookingId });
            broadcastToDoctor(String(doc.id), { type: "patient_checked_in", bookingId, notification: notif });
          }
        } catch (e: any) { console.error('[NOTIFICATION] Check-in notification failed:', e.message); }
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/bookings/:id/complete-visit", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const { note } = req.body ?? {};
      const updated = await storage.updateVisitStatus(bookingId, 'completed', undefined, new Date(), note?.trim() || null);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/bookings/:id/confirm", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.verificationStatus === 'confirmed') return res.status(400).json({ message: "Booking already confirmed" });

      // If a doctor was assigned and their approval is still pending, admin is overriding — mark as admin_confirmed
      const needsDoctorOverride = booking.assignedDoctorEmail && booking.doctorApprovalStatus === 'pending';
      const updated = await storage.updateBookingStatus(bookingId, 'confirmed', 'admin');
      if (needsDoctorOverride) {
        await storage.updateBookingAssignment(bookingId, booking.assignedDoctor!, booking.assignedDoctorEmail!, 'admin_confirmed');
      }

      // Fetch clinic details for the email
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, sess.clinicId || 0));
      const slot = await storage.getSlot(booking.slotId);

      // Send confirmation email to patient (fire-and-forget)
      const clinicLat = (clinic as any)?.latitude ?? null;
      const clinicLng = (clinic as any)?.longitude ?? null;
      const clinicAddress = (clinic as any)?.address ?? null;
      const clinicPhone = (clinic as any)?.phone ?? null;
      const confirmMapsLink = (clinicLat != null && clinicLng != null)
        ? `https://maps.google.com/?q=${clinicLat},${clinicLng}`
        : clinicAddress ? `https://maps.google.com/?q=${encodeURIComponent(clinicAddress)}` : null;
      if (booking.customerEmail) {
        sendConfirmationEmail(
          booking.customerEmail,
          booking.customerName,
          clinic?.name || 'the clinic',
          slot ? new Date(slot.startTime) : new Date(),
          booking.assignedDoctor || null,
          clinicPhone,
          clinicAddress,
          clinic?.email || null,
          bookingId,
          clinicLat,
          clinicLng,
        ).catch((err) => console.error('[EMAIL ERROR] Confirm email failed:', err));
      }

      // Send WhatsApp confirmation to patient (fire-and-forget)
      if (booking.customerPhone) {
        sendWhatsAppConfirmationNotification(
          booking.customerPhone,
          booking.customerName,
          clinic?.name || slot?.clinicName || 'the clinic',
          slot ? new Date(slot.startTime) : new Date(),
          booking.assignedDoctor || null,
          clinicAddress,
          clinicPhone,
          confirmMapsLink,
          `BMS-${bookingId}`,
        ).catch(() => {});
      }

      // Notify the doctor that the admin confirmed on their behalf (fire-and-forget)
      if (needsDoctorOverride) {
        sendDoctorAdminConfirmEmail(
          booking.assignedDoctorEmail!,
          booking.assignedDoctor!,
          booking.customerName,
          clinic?.name || 'the clinic',
          slot ? new Date(slot.startTime) : new Date(),
          bookingId,
        ).catch((err) => console.error('[EMAIL ERROR] Doctor admin-confirm email failed:', err));

        // In-app notification for doctor — admin confirmed on their behalf
        try {
          const [overriddenDoc] = await db.select({ id: doctors.id })
            .from(doctors).where(eq(doctors.email, booking.assignedDoctorEmail!)).limit(1);
          if (overriddenDoc) {
            const dateStr = slot
              ? new Date(slot.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : '';
            const overrideNotif = await storage.createNotification({
              userId: String(overriddenDoc.id),
              message: `Admin confirmed ${booking.customerName}'s appointment on your behalf${dateStr ? ` on ${dateStr}` : ''} — no action needed`,
              read: false,
              type: "admin_confirmed",
              bookingId,
            });
            broadcastToDoctor(String(overriddenDoc.id), { type: "admin_confirmed", bookingId, notification: overrideNotif });
          }
        } catch (e: any) {
          console.error('[NOTIFICATION] Admin override notification failed:', e.message);
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/auth/clinic/bookings/:id — cancel a booking (soft cancel, keeps record with status 'cancelled')
  app.delete("/api/auth/clinic/bookings/:id", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking ID" });
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.verificationStatus === 'cancelled') return res.status(400).json({ message: "Booking is already cancelled" });

      // Verify ownership — the booking's slot must belong to this clinic
      const slot = await storage.getSlot(booking.slotId);
      if (!slot || (slot.clinicId !== sess.clinicId && sess.role !== 'superuser')) {
        return res.status(403).json({ message: "Not authorised to cancel this booking" });
      }

      const { reason } = req.body as { reason?: string };
      await storage.cancelBooking(bookingId, reason);

      // Send cancellation email to patient (fire-and-forget)
      if (booking.customerEmail) {
        const [clinic] = await db.select().from(clinics).where(eq(clinics.id, sess.clinicId || slot.clinicId));
        const clinicPhone = (clinic as any)?.phone ?? null;
        sendCancellationEmail(
          booking.customerEmail,
          booking.customerName,
          slot ? new Date(slot.startTime) : new Date(),
          clinic?.name || slot?.clinicName || 'the clinic',
          clinicPhone,
          bookingId,
          reason || null,
        ).catch((err) => console.error('[EMAIL ERROR] Cancellation email failed:', err));
      }

      // In-app notification for clinic (WebSocket push)
      try {
        const clinicId = sess.clinicId || slot.clinicId;
        const notif = await storage.createNotification({
          userId: String(clinicId),
          message: `Booking for ${booking.customerName} has been cancelled`,
          read: false,
          type: "booking_cancelled",
          bookingId,
        });
        broadcastToClinic(String(clinicId), { type: "booking_cancelled", bookingId, notification: notif });
      } catch (e: any) {
        console.error('[NOTIFICATION] Cancel notification failed:', e.message);
      }

      // G3 — Notify assigned doctor the appointment was cancelled
      if (booking.assignedDoctorEmail) {
        try {
          const [cancelDoc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, booking.assignedDoctorEmail)).limit(1);
          if (cancelDoc) {
            const dateStr = slot ? new Date(slot.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
            const cancelDocNotif = await storage.createNotification({
              userId: String(cancelDoc.id),
              message: `Appointment for ${booking.customerName}${dateStr ? ` on ${dateStr}` : ''} has been cancelled by the clinic`,
              read: false,
              type: "booking_cancelled",
              bookingId,
            });
            broadcastToDoctor(String(cancelDoc.id), { type: "booking_cancelled", bookingId, notification: cancelDocNotif });
          }
        } catch (e: any) {
          console.error('[NOTIFICATION] Cancel doctor notification failed:', e.message);
        }
      }

      res.json({ message: "Booking cancelled successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clinic/bookings/:id/assign-doctor", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    const { doctorName, doctorEmail } = req.body;
    if (!doctorName) return res.status(400).json({ message: "doctorName is required" });
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      // If no email provided, look it up from the doctors table by name within this clinic
      let resolvedEmail: string | null = doctorEmail || null;
      if (!resolvedEmail && sess.clinicId) {
        const [doctorRecord] = await db.select({ email: doctors.email })
          .from(doctors)
          .innerJoin(clinicDoctors, eq(doctors.id, clinicDoctors.doctorId))
          .where(and(eq(clinicDoctors.clinicId, sess.clinicId), eq(doctors.name, doctorName)));
        if (doctorRecord?.email) resolvedEmail = doctorRecord.email;
      }
      // If doctor has a known email, set doctorApprovalStatus to 'pending' so they must approve first.
      // If no email is known, fall back to null (no approval gate for display-only doctor names).
      const approvalStatus = resolvedEmail ? 'pending' : null;
      const updated = await storage.updateBookingAssignment(bookingId, doctorName, resolvedEmail, approvalStatus);

      // Notify doctor by email and in-app that they have a new appointment awaiting their approval
      if (resolvedEmail) {
        const slot = await storage.getSlot(booking.slotId);
        const clinicForAssign = sess.clinicId ? await storage.getClinic(sess.clinicId) : null;
        sendDoctorAssignmentEmail(
          resolvedEmail,
          doctorName,
          booking.customerName,
          clinicForAssign?.name || 'the clinic',
          slot ? new Date(slot.startTime) : new Date(),
          bookingId,
        ).catch((err) => console.error('[EMAIL ERROR] Doctor assignment email failed:', err));

        // In-app notification for the doctor
        try {
          const [assignedDoc] = await db.select({ id: doctors.id })
            .from(doctors).where(eq(doctors.email, resolvedEmail)).limit(1);
          if (assignedDoc) {
            const dateStr = slot
              ? new Date(slot.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : 'upcoming date';
            const timeStr = slot
              ? new Date(slot.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
              : '';
            const assignNotif = await storage.createNotification({
              userId: String(assignedDoc.id),
              message: `New appointment assigned: ${booking.customerName} on ${dateStr}${timeStr ? ` at ${timeStr}` : ''} — awaiting your approval`,
              read: false,
              type: "doctor_assigned",
              bookingId,
            });
            broadcastToDoctor(String(assignedDoc.id), { type: "doctor_assigned", bookingId, notification: assignNotif });
          }
        } catch (e: any) {
          console.error('[NOTIFICATION] Doctor assignment notification failed:', e.message);
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Doctor approves an appointment assigned to them
  app.patch("/api/doctor/bookings/:id/approve", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor' || !sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
    try {
      const booking = await storage.getBookingById(Number(req.params.id));
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.assignedDoctorEmail !== sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
      if (booking.doctorApprovalStatus !== 'pending') return res.status(400).json({ message: "No pending approval for this booking" });

      const updated = await storage.updateBookingDoctorApproval(Number(req.params.id), sess.doctorEmail, 'approved');

      // Notify patient via email and WhatsApp that their appointment is confirmed (fire-and-forget)
      const slot = await storage.getSlot(booking.slotId);
      const doctorClinic = slot?.clinicId ? await storage.getClinic(slot.clinicId) : null;
      const dClinicLat = (doctorClinic as any)?.latitude ?? null;
      const dClinicLng = (doctorClinic as any)?.longitude ?? null;
      const dClinicAddress = (doctorClinic as any)?.address ?? null;
      const dClinicPhone = (doctorClinic as any)?.phone ?? null;
      const dMapsLink = (dClinicLat != null && dClinicLng != null)
        ? `https://maps.google.com/?q=${dClinicLat},${dClinicLng}`
        : dClinicAddress ? `https://maps.google.com/?q=${encodeURIComponent(dClinicAddress)}` : null;
      if (booking.customerEmail) {
        sendConfirmationEmail(
          booking.customerEmail,
          booking.customerName,
          doctorClinic?.name || slot?.clinicName || 'the clinic',
          slot ? new Date(slot.startTime) : new Date(),
          booking.assignedDoctor || null,
          dClinicPhone,
          dClinicAddress,
          doctorClinic?.email || null,
          booking.id,
          dClinicLat,
          dClinicLng,
        ).catch(() => {});
      }
      if (booking.customerPhone) {
        sendWhatsAppConfirmationNotification(
          booking.customerPhone,
          booking.customerName,
          doctorClinic?.name || slot?.clinicName || 'the clinic',
          slot ? new Date(slot.startTime) : new Date(),
          booking.assignedDoctor || null,
          dClinicAddress,
          dClinicPhone,
          dMapsLink,
          `BMS-${booking.id}`,
        ).catch(() => {});
      }

      // In-app notification for clinic admin — doctor approved
      if (doctorClinic?.id) {
        try {
          const dateStr = slot
            ? new Date(slot.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : '';
          const approveNotif = await storage.createNotification({
            userId: String(doctorClinic.id),
            message: `Dr. ${booking.assignedDoctor || sess.doctorEmail} confirmed ${booking.customerName}'s appointment${dateStr ? ` on ${dateStr}` : ''}`,
            read: false,
            type: "doctor_approved",
            bookingId: booking.id,
          });
          broadcastToClinic(String(doctorClinic.id), { type: "doctor_approved", bookingId: booking.id, notification: approveNotif });
        } catch (e: any) {
          console.error('[NOTIFICATION] Doctor approve notification failed:', e.message);
        }
      }

      res.json(updated);
    } catch (err: any) {
      const status = err.message === "Booking not found" ? 404 : err.message === "Forbidden" ? 403 : 500;
      res.status(status).json({ message: err.message });
    }
  });

  // Doctor declines an appointment assigned to them
  app.patch("/api/doctor/bookings/:id/decline", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor' || !sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
    try {
      const booking = await storage.getBookingById(Number(req.params.id));
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.assignedDoctorEmail !== sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
      if (booking.doctorApprovalStatus !== 'pending') return res.status(400).json({ message: "No pending approval for this booking" });

      const updated = await storage.updateBookingDoctorApproval(Number(req.params.id), sess.doctorEmail, 'declined');

      // Notify clinic admin that the doctor has declined (fire-and-forget + in-app)
      const slot = await storage.getSlot(booking.slotId);
      if (slot?.clinicId) {
        const clinicForDecline = await storage.getClinic(slot.clinicId);
        if (clinicForDecline?.email) {
          sendAdminDoctorDeclineEmail(
            clinicForDecline.email,
            clinicForDecline.name,
            booking.assignedDoctor || sess.doctorEmail,
            booking.customerName,
            new Date(slot.startTime),
            booking.id,
          ).catch((err) => console.error('[EMAIL ERROR] Admin doctor-decline email failed:', err));
        }
        if (clinicForDecline) {
          try {
            const dateStr = new Date(slot.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const declineNotif = await storage.createNotification({
              userId: String(clinicForDecline.id),
              message: `Dr. ${booking.assignedDoctor || sess.doctorEmail} declined ${booking.customerName}'s appointment on ${dateStr} — reassignment needed`,
              read: false,
              type: "doctor_declined",
              bookingId: booking.id,
            });
            broadcastToClinic(String(clinicForDecline.id), { type: "doctor_declined", bookingId: booking.id, notification: declineNotif });
          } catch (e: any) {
            console.error('[NOTIFICATION] Doctor decline notification failed:', e.message);
          }
        }
      }

      res.json(updated);
    } catch (err: any) {
      const status = err.message === "Booking not found" ? 404 : err.message === "Forbidden" ? 403 : 500;
      res.status(status).json({ message: err.message });
    }
  });

  app.get("/api/clinics/:id/public", async (req, res) => {
    try {
      const raw = req.params.id;
      const numericId = parseInt(raw);
      const clinic = isNaN(numericId)
        ? await storage.getClinicByUsername(raw)
        : await storage.getClinic(numericId);
      if (!clinic || clinic.isArchived) return res.status(404).json({ message: "Clinic not found" });
      const { passwordHash, registeredBy, ...publicFields } = clinic;
      res.json(publicFields);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clinics", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Forbidden" });
    try {
      const cs = await storage.getClinics(true);
      res.json(cs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clinics", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Forbidden" });
    try {
      const clinic = await storage.createClinic(req.body);
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clinics/:id", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Forbidden" });
    try {
      const clinic = await storage.updateClinic(Number(req.params.id), req.body);
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clinics/:id/archive", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Forbidden" });
    try {
      const clinic = await storage.archiveClinic(Number(req.params.id));
      // G16 — Email clinic owner that their account was suspended
      if (resend && clinic?.email) {
        const archiveEmail = RESEND_MODE === 'PRODUCTION' ? clinic.email : TEST_EMAIL;
        resend.emails.send({
          from: EMAIL_FROM,
          to: archiveEmail,
          subject: `Your BookMySlot clinic account has been suspended`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px"><h2 style="color:#dc2626;margin-top:0">Account Suspended</h2><p style="color:#374151">Dear <strong>${clinic.name}</strong>,</p><p style="color:#374151">Your clinic account on BookMySlot has been <strong>suspended</strong> by the platform administrator. During this period you will not be able to accept new bookings.</p><p style="color:#374151">Please contact <a href="mailto:support@bookmyslot.dental" style="color:#0F9B6E">support@bookmyslot.dental</a> if you believe this is an error or to discuss reinstatement.</p><p style="color:#d1d5db;font-size:11px;margin-top:24px">Powered by BookMySlot</p></div>`,
        }).catch(() => {});
      }
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clinics/:id/unarchive", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Forbidden" });
    try {
      const clinic = await storage.unarchiveClinic(Number(req.params.id));
      // G16 — Email clinic owner that their account was reinstated
      if (resend && clinic?.email) {
        const unarchiveEmail = RESEND_MODE === 'PRODUCTION' ? clinic.email : TEST_EMAIL;
        resend.emails.send({
          from: EMAIL_FROM,
          to: unarchiveEmail,
          subject: `Your BookMySlot clinic account has been reinstated`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px"><h2 style="color:#059669;margin-top:0">Account Reinstated</h2><p style="color:#374151">Dear <strong>${clinic.name}</strong>,</p><p style="color:#374151">Great news — your clinic account on BookMySlot has been <strong>reinstated</strong>. You can now log in and resume accepting appointments.</p><p style="color:#374151">If you have any questions, contact <a href="mailto:support@bookmyslot.dental" style="color:#0F9B6E">support@bookmyslot.dental</a>.</p><p style="color:#d1d5db;font-size:11px;margin-top:24px">Powered by BookMySlot</p></div>`,
        }).catch(() => {});
      }
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clinics/:id/credentials", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Forbidden" });
    try {
      const { username, password } = req.body;
      const hash = await bcrypt.hash(password, 10);
      await storage.updateClinicCredentials(Number(req.params.id), username, hash);
      // G17 — Email clinic owner their new credentials
      const credClinic = await storage.getClinic(Number(req.params.id));
      if (resend && credClinic?.email) {
        const credEmail = RESEND_MODE === 'PRODUCTION' ? credClinic.email : TEST_EMAIL;
        resend.emails.send({
          from: EMAIL_FROM,
          to: credEmail,
          subject: `Your BookMySlot login credentials have been updated`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px"><h2 style="color:#085041;margin-top:0">Credentials Updated</h2><p style="color:#374151">Dear <strong>${credClinic.name}</strong>,</p><p style="color:#374151">Your BookMySlot clinic login credentials have been updated by the platform administrator.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden"><tr style="background:#f3f4f6"><td style="padding:10px 12px;font-size:13px;color:#6b7280;font-weight:600">Username</td><td style="padding:10px 12px;font-size:14px;color:#0d1f1a;font-weight:700">${username}</td></tr><tr><td style="padding:10px 12px;font-size:13px;color:#6b7280;font-weight:600">Password</td><td style="padding:10px 12px;font-size:14px;color:#0d1f1a;font-weight:700">${password}</td></tr></table><p style="color:#dc2626;font-size:13px">Please change your password after logging in and keep these credentials safe.</p><p style="color:#d1d5db;font-size:11px;margin-top:24px">Powered by BookMySlot</p></div>`,
        }).catch(() => {});
      }
      res.json({ message: "Credentials updated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/doctor/clinics", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const email = sess.doctorEmail;
      const d = await storage.getDoctorByEmail(email);
      if (!d) return res.json([]);
      const results = await db.select({ clinic: clinics }).from(clinics).innerJoin(clinicDoctors, eq(clinics.id, clinicDoctors.clinicId)).where(eq(clinicDoctors.doctorId, d.id));
      res.json(results.map(r => r.clinic));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/doctor/patients", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const email = sess.doctorEmail;
      const d = await storage.getDoctorByEmail(email);
      if (!d) return res.json([]);
      const ps = await storage.getPatientsByDoctor(d.id);
      res.json(ps);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Doctor Profile (self-update) ──
  app.patch("/api/doctor/profile", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const updated = await storage.updateDoctorProfile(d.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Doctor Certifications ──
  app.get("/api/doctor/certifications", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.json([]);
      res.json(await storage.getCertificationsByDoctor(d.id));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/doctor/certifications", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const cert = await storage.createCertification({ ...req.body, doctorId: d.id });
      res.status(201).json(cert);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/doctor/certifications/:id", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const cert = await storage.updateCertification(Number(req.params.id), d.id, req.body);
      res.json(cert);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/doctor/certifications/:id", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      await storage.deleteCertification(Number(req.params.id), d.id);
      res.sendStatus(204);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Doctor Cases ──
  app.get("/api/doctor/cases", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.json([]);
      res.json(await storage.getCasesByDoctor(d.id));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/doctor/cases", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const c = await storage.createCase({ ...req.body, doctorId: d.id });
      res.status(201).json(c);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/doctor/cases/:id", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const c = await storage.updateCase(Number(req.params.id), d.id, req.body);
      res.json(c);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/doctor/cases/:id", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      await storage.deleteCase(Number(req.params.id), d.id);
      res.sendStatus(204);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Doctor Leaves (Out of Office) ──
  app.get("/api/doctor/leaves", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const leaves = await storage.getDoctorLeaves(d.id);
      res.json(leaves);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/doctor/leaves", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const { leaveDate, reason } = req.body;
      if (!leaveDate) return res.status(400).json({ message: "leaveDate is required" });
      const leave = await storage.addDoctorLeave({ doctorId: d.id, leaveDate, reason: reason || null });

      // G5 — Notify all linked clinic admins that this doctor is on leave
      try {
        const linkedClinics = await db.select({ clinic: clinics })
          .from(clinics)
          .innerJoin(clinicDoctors, eq(clinics.id, clinicDoctors.clinicId))
          .where(eq(clinicDoctors.doctorId, d.id));
        const leaveDateFmt = new Date(leaveDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        for (const { clinic } of linkedClinics) {
          const leaveNotif = await storage.createNotification({
            userId: String(clinic.id),
            message: `Dr. ${d.name} has marked ${leaveDateFmt} as leave${reason ? ` — ${reason}` : ''}`,
            read: false,
            type: "doctor_on_leave",
          });
          broadcastToClinic(String(clinic.id), { type: "doctor_on_leave", notification: leaveNotif });
        }
      } catch (e: any) {
        console.error('[NOTIFICATION] Doctor leave notification failed:', e.message);
      }

      res.status(201).json(leave);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/doctor/leaves/:id", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const d = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      await storage.removeDoctorLeave(Number(req.params.id), d.id);

      // G20 — Notify all linked clinic admins that the doctor cancelled their leave
      try {
        const linkedClinics = await db.select({ clinic: clinics })
          .from(clinics)
          .innerJoin(clinicDoctors, eq(clinics.id, clinicDoctors.clinicId))
          .where(eq(clinicDoctors.doctorId, d.id));
        for (const { clinic } of linkedClinics) {
          const cancelLeaveNotif = await storage.createNotification({
            userId: String(clinic.id),
            message: `Dr. ${d.name} cancelled a leave and is now available`,
            read: false,
            type: "doctor_leave_cancelled",
          });
          broadcastToClinic(String(clinic.id), { type: "doctor_leave_cancelled", notification: cancelLeaveNotif });
        }
      } catch (e: any) {
        console.error('[NOTIFICATION] Doctor leave cancel notification failed:', e.message);
      }

      res.sendStatus(204);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/doctor/clinic/:clinicId/pharmacy — read-only catalogue for prescription autocomplete
  app.get("/api/doctor/clinic/:clinicId/pharmacy", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const clinicId = parseInt(req.params.clinicId);
      if (isNaN(clinicId)) return res.status(400).json({ message: "Invalid clinic ID" });
      const items = await storage.getPharmacyStock(clinicId);
      res.json(items);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Clinic: get all doctor leaves for all clinic doctors (for OOO in assign panel) ──
  app.get("/api/clinic/doctor-leaves/all", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Forbidden" });
    try {
      const clinicDocList = await storage.getClinicDoctors(sess.clinicId);
      const doctorIds = clinicDocList.map((d: any) => d.id);
      const leaves = await storage.getAllDoctorLeavesForClinic(doctorIds);
      res.json(leaves);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Clinic: get doctor leaves for a specific date ──
  app.get("/api/clinic/doctor-leaves", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Forbidden" });
    try {
      const { date } = req.query as { date?: string };
      if (!date) return res.status(400).json({ message: "date query param required" });
      const clinicDocList = await storage.getClinicDoctors(sess.clinicId);
      const doctorIds = clinicDocList.map((d: any) => d.id);
      const leaves = await storage.getDoctorLeavesOnDate(date, doctorIds);
      const onLeave = leaves.map(l => {
        const doc = clinicDocList.find((d: any) => d.id === l.doctorId);
        return { doctorId: l.doctorId, doctorEmail: doc?.email, doctorName: doc?.name, reason: l.reason };
      });
      res.json(onLeave);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Doctor Booking Notes (doctor updates notes + clinical status on their own bookings) ──
  app.patch("/api/doctor/bookings/:id/notes", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor' || !sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
    try {
      const { doctorNotes, clinicalStatus } = req.body;
      const updated = await storage.updateBookingDoctorNotes(
        Number(req.params.id),
        sess.doctorEmail,
        doctorNotes ?? null,
        clinicalStatus ?? null,
      );
      if (clinicalStatus === 'case_closed') {
        try {
          const booking = await storage.getBookingById(Number(req.params.id));
          if (booking) {
            const slot = await storage.getSlot(booking.slotId);
            if (slot) {
              const [clinic] = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.id, (slot as any).clinicId)).limit(1);
              if (clinic) {
                const notif = await storage.createNotification({ userId: String(clinic.id), message: `Dr. ${booking.assignedDoctor || sess.doctorEmail} marked ${booking.customerName}'s case as closed`, read: false, type: "case_closed_by_doctor", bookingId: Number(req.params.id) });
                broadcastToClinic(String(clinic.id), { type: "case_closed_by_doctor", bookingId: Number(req.params.id), notification: notif });
              }
            }
          }
        } catch (e: any) { console.error('[NOTIFICATION] Case closed (doctor notes) notification failed:', e.message); }
      }
      res.json(updated);
    } catch (err: any) {
      const status = err.message?.startsWith("Forbidden") ? 403 : err.message === "Booking not found" ? 404 : 500;
      res.status(status).json({ message: err.message });
    }
  });

  // ── Booking Notes (shared conversation thread) ──
  app.get("/api/booking/:id/notes", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking id" });
    try {
      const notes = await storage.getBookingNotes(bookingId);
      res.json(notes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/booking/:id/notes", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking id" });
    const { content } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }
    try {
      let authorType: string;
      let authorName: string;
      if (sess.role === "doctor" && sess.doctorId) {
        const doc = await storage.getDoctorById(sess.doctorId);
        authorType = "doctor";
        authorName = doc ? `Dr. ${doc.name}` : "Doctor";
      } else if ((sess.adminLoggedIn || sess.role === "owner") && sess.clinicId) {
        const clinic = await storage.getClinic(sess.clinicId);
        authorType = "clinic_admin";
        authorName = clinic ? `${clinic.name} Admin` : "Clinic Admin";
      } else {
        return res.status(403).json({ message: "Forbidden" });
      }
      const note = await storage.createBookingNote({
        bookingId,
        authorType,
        authorName,
        content: content.trim(),
      });

      // G8 — Notify the other party: clinic → doctor, doctor → clinic
      try {
        const noteBooking = await storage.getBookingById(bookingId);
        if (noteBooking) {
          const previewText = content.trim().length > 60 ? content.trim().slice(0, 60) + '…' : content.trim();
          if (authorType === 'doctor') {
            const noteSlot = await storage.getSlot(noteBooking.slotId);
            if (noteSlot?.clinicId) {
              const clinicNoteNotif = await storage.createNotification({
                userId: String(noteSlot.clinicId),
                message: `${authorName} added a note on ${noteBooking.customerName}'s booking: "${previewText}"`,
                read: false,
                type: "booking_note_added",
                bookingId,
              });
              broadcastToClinic(String(noteSlot.clinicId), { type: "booking_note_added", bookingId, notification: clinicNoteNotif });
            }
          } else if (authorType === 'clinic_admin' && noteBooking.assignedDoctorEmail) {
            const [noteDoc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, noteBooking.assignedDoctorEmail)).limit(1);
            if (noteDoc) {
              const docNoteNotif = await storage.createNotification({
                userId: String(noteDoc.id),
                message: `${authorName} added a note on ${noteBooking.customerName}'s booking: "${previewText}"`,
                read: false,
                type: "booking_note_added",
                bookingId,
              });
              broadcastToDoctor(String(noteDoc.id), { type: "booking_note_added", bookingId, notification: docNoteNotif });
            }
          }
        }
      } catch (e: any) {
        console.error('[NOTIFICATION] Booking note notification failed:', e.message);
      }

      res.json(note);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Clinical status only (doesn't touch doctorNotes / thread)
  app.patch("/api/doctor/bookings/:id/clinical-status", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== "doctor" || !sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
    try {
      const { clinicalStatus } = req.body;
      const booking = await storage.getBooking(Number(req.params.id));
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.assignedDoctorEmail !== sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateBookingDoctorNotes(
        Number(req.params.id),
        sess.doctorEmail,
        booking.doctorNotes ?? null,
        clinicalStatus ?? null,
      );
      if (clinicalStatus === 'case_closed') {
        try {
          const slot = await storage.getSlot(booking.slotId);
          if (slot) {
            const [clinic] = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.id, (slot as any).clinicId)).limit(1);
            if (clinic) {
              const notif = await storage.createNotification({ userId: String(clinic.id), message: `Dr. ${booking.assignedDoctor || sess.doctorEmail} marked ${booking.customerName}'s case as closed`, read: false, type: "case_closed_by_doctor", bookingId: Number(req.params.id) });
              broadcastToClinic(String(clinic.id), { type: "case_closed_by_doctor", bookingId: Number(req.params.id), notification: notif });
            }
          }
        } catch (e: any) { console.error('[NOTIFICATION] Case closed (doctor) notification failed:', e.message); }
      }
      res.json(updated);
    } catch (err: any) {
      const status = err.message?.startsWith("Forbidden") ? 403 : err.message === "Booking not found" ? 404 : 500;
      res.status(status).json({ message: err.message });
    }
  });

  app.patch("/api/doctor/bookings/:id/start-consultation", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor' || !sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
    const bookingId = parseInt(req.params.id);
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.assignedDoctorEmail !== sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateVisitStatus(bookingId, 'in_consultation');
      try {
        const slot = await storage.getSlot(booking.slotId);
        if (slot) {
          const [clinic] = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.id, (slot as any).clinicId)).limit(1);
          if (clinic) {
            const notif = await storage.createNotification({ userId: String(clinic.id), message: `Dr. ${booking.assignedDoctor || sess.doctorEmail} has started consultation with ${booking.customerName}`, read: false, type: "consultation_started", bookingId });
            broadcastToClinic(String(clinic.id), { type: "consultation_started", bookingId, notification: notif });
          }
        }
      } catch (e: any) { console.error('[NOTIFICATION] Start consultation notification failed:', e.message); }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/doctor/bookings/:id/complete-visit", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role !== 'doctor' || !sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
    const bookingId = parseInt(req.params.id);
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.assignedDoctorEmail !== sess.doctorEmail) return res.status(403).json({ message: "Forbidden" });
      // Stage 5 — Treatment Completed (doctor side). Clinic still needs to close with Stage 6.
      const updated = await storage.updateVisitStatus(bookingId, 'treatment_completed', undefined, new Date());
      try {
        const slot = await storage.getSlot(booking.slotId);
        if (slot) {
          const [clinic] = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.id, (slot as any).clinicId)).limit(1);
          if (clinic) {
            const notif = await storage.createNotification({ userId: String(clinic.id), message: `Dr. ${booking.assignedDoctor || sess.doctorEmail} has completed treatment for ${booking.customerName} — please mark the visit as complete`, read: false, type: "visit_completed", bookingId });
            broadcastToClinic(String(clinic.id), { type: "visit_completed", bookingId, notification: notif });
          }
        }
      } catch (e: any) { console.error('[NOTIFICATION] Treatment complete notification failed:', e.message); }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/bookings/:id/no-show", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const { reason } = req.body;
      const [updated] = await db.update(bookings)
        .set({ verificationStatus: 'no_show', ...(reason ? { cancellationReason: reason } : {}) })
        .where(eq(bookings.id, bookingId))
        .returning();
      // Audit log
      await db.execute(sql`INSERT INTO booking_state_log (booking_id, from_state, to_state, actor_role, actor_name, reason)
        VALUES (${bookingId}, ${booking.verificationStatus}, 'no_show', 'admin', ${(sess as any).clinicUsername || 'Admin'}, ${reason || null})`);

      // G11 — Notify assigned doctor that patient is a no-show
      if (booking.assignedDoctorEmail) {
        try {
          const [nsDoc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, booking.assignedDoctorEmail)).limit(1);
          if (nsDoc) {
            const nsNotif = await storage.createNotification({
              userId: String(nsDoc.id),
              message: `${booking.customerName} did not show up for their appointment — marked as No-Show`,
              read: false,
              type: "patient_no_show",
              bookingId,
            });
            broadcastToDoctor(String(nsDoc.id), { type: "patient_no_show", bookingId, notification: nsNotif });
          }
        } catch (e: any) {
          console.error('[NOTIFICATION] No-show doctor notification failed:', e.message);
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/auth/clinic/bookings/:id/send-reminder — WhatsApp/email nudge
  app.patch("/api/auth/clinic/bookings/:id/send-reminder", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const slot = await storage.getSlot(booking.slotId);
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, sess.clinicId || 0));
      const dateStr = slot ? format(new Date(slot.startTime), 'EEE d MMM, h:mm a') : 'your appointment';
      // Send WhatsApp reminder (fire-and-forget)
      if (booking.customerPhone) {
        const { sendWhatsAppMessage } = await import('./whatsapp.service');
        sendWhatsAppMessage(booking.customerPhone,
          `Reminder: You have an appointment at ${clinic?.name || 'the clinic'} on ${dateStr}. Please arrive on time.`
        ).catch((e: any) => console.error('[REMINDER] WhatsApp failed:', e.message));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/auth/clinic/bookings/:id/override-complete — admin force-completes any non-terminal state
  app.patch("/api/auth/clinic/bookings/:id/override-complete", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (['cancelled', 'no_show'].includes(booking.verificationStatus)) {
        return res.status(400).json({ message: "Cannot override a terminal state" });
      }
      const { reason } = req.body;
      const prevVisit = (booking as any).visitStatus || 'booked';
      const overrideNote = reason?.trim() ? `Override: ${reason.trim()}` : 'Admin override';
      const updated = await storage.updateVisitStatus(bookingId, 'completed', undefined, new Date(), overrideNote);
      // Audit log
      await db.execute(sql`INSERT INTO booking_state_log (booking_id, from_state, to_state, actor_role, actor_name, reason)
        VALUES (${bookingId}, ${prevVisit}, 'completed_override', 'admin', ${(sess as any).clinicUsername || 'Admin'}, ${reason || 'Admin override'})`);

      // G12 — Notify assigned doctor the visit was force-completed by admin
      if (booking.assignedDoctorEmail) {
        try {
          const [ocDoc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, booking.assignedDoctorEmail)).limit(1);
          if (ocDoc) {
            const ocNotif = await storage.createNotification({
              userId: String(ocDoc.id),
              message: `${booking.customerName}'s visit was marked complete by clinic admin${reason ? ` — "${reason}"` : ''}`,
              read: false,
              type: "visit_override_completed",
              bookingId,
            });
            broadcastToDoctor(String(ocDoc.id), { type: "visit_override_completed", bookingId, notification: ocNotif });
          }
        } catch (e: any) {
          console.error('[NOTIFICATION] Override complete doctor notification failed:', e.message);
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/auth/clinic/bookings/:id/patient-left-early
  // Admin records that the patient walked out during or before consultation
  app.patch("/api/auth/clinic/bookings/:id/patient-left-early", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId && sess.role !== 'superuser') return res.status(403).json({ message: "Not a clinic admin session" });
    const bookingId = parseInt(req.params.id);
    try {
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const terminalStates = ['cancelled', 'no_show'];
      if (terminalStates.includes(booking.verificationStatus)) {
        return res.status(400).json({ message: "Cannot act on a terminal booking" });
      }
      if (booking.visitStatus === 'completed' || booking.visitStatus === 'treatment_completed') {
        return res.status(400).json({ message: "Visit is already completed — use override if needed" });
      }
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ message: "Reason is required" });
      const prevVisit = booking.visitStatus || 'checked_in';
      const [updated] = await db.update(bookings)
        .set({ visitStatus: 'patient_left_early' })
        .where(eq(bookings.id, bookingId))
        .returning();
      await db.execute(sql`INSERT INTO booking_state_log (booking_id, from_state, to_state, actor_role, actor_name, reason)
        VALUES (${bookingId}, ${prevVisit}, 'patient_left_early', 'admin', ${(sess as any).clinicUsername || 'Admin'}, ${reason})`);

      // G12b — Notify assigned doctor that patient left early
      if (booking.assignedDoctorEmail) {
        try {
          const [pleDoc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, booking.assignedDoctorEmail)).limit(1);
          if (pleDoc) {
            const pleNotif = await storage.createNotification({
              userId: String(pleDoc.id),
              message: `${booking.customerName} left early${reason ? ` — "${reason}"` : ''}`,
              read: false,
              type: "patient_left_early",
              bookingId,
            });
            broadcastToDoctor(String(pleDoc.id), { type: "patient_left_early", bookingId, notification: pleNotif });
          }
        } catch (e: any) {
          console.error('[NOTIFICATION] Patient left early doctor notification failed:', e.message);
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Public Doctor Profile (no auth) — supports /doctor/:id or /doctor/:username ──
  app.get("/api/public/doctor/:id", async (req, res) => {
    try {
      const param = req.params.id;
      const isNumeric = /^\d+$/.test(param);
      const d = isNumeric
        ? await storage.getDoctorById(Number(param))
        : await storage.getDoctorByUsername(param);
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const certs = await storage.getCertificationsByDoctor(d.id);
      const cases = await storage.getCasesByDoctor(d.id);
      const clinic = await storage.getClinicByDoctorId(d.id);
      const { passwordHash, ...safeDoctor } = d;
      res.json({ doctor: safeDoctor, certifications: certs, cases, clinic: clinic ?? null });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/upload", isAdmin, async (req, res) => {
    try {
      res.status(400).json({ message: "Use /api/uploads/signed-url for R2 uploads" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Digital Consent Form ──

  // POST /api/auth/clinic/bookings/:id/request-consent
  // Generates a consent token and sends the WhatsApp link to the patient
  app.post("/api/auth/clinic/bookings/:id/request-consent", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Forbidden" });
    try {
      const bookingId = Number(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const clinic = await storage.getClinic(Number(sess.clinicId));
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

      await storage.createConsentToken(bookingId, clinic.id, token, expiresAt);

      const baseUrl = process.env.FRONTEND_URL ||
        `${req.protocol}://${req.get("host")}`;
      const consentUrl = `${baseUrl}/consent/${token}`;

      await sendWhatsAppConsentLink(
        booking.customerPhone,
        booking.customerName,
        clinic.name,
        consentUrl,
      );

      // G15 — Notify assigned doctor that the clinic sent a consent form request
      if ((booking as any).assignedDoctorEmail) {
        try {
          const [clinicConsentDoc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.email, (booking as any).assignedDoctorEmail)).limit(1);
          if (clinicConsentDoc) {
            const clinicConsentNotif = await storage.createNotification({
              userId: String(clinicConsentDoc.id),
              message: `Clinic sent a consent form request to ${booking.customerName}`,
              read: false,
              type: "consent_requested",
              bookingId,
            });
            broadcastToDoctor(String(clinicConsentDoc.id), { type: "consent_requested", bookingId, notification: clinicConsentNotif });
          }
        } catch (e: any) {
          console.error('[NOTIFICATION] Clinic consent request doctor notification failed:', e.message);
        }
      }

      res.json({ success: true, consentUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/doctor/bookings/:id/request-consent
  // Doctor-authenticated endpoint — generates / refreshes consent token and sends WhatsApp link
  app.post("/api/doctor/bookings/:id/request-consent", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.doctorLoggedIn || sess.role !== 'doctor') return res.status(403).json({ message: "Forbidden" });
    try {
      const bookingId = Number(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const slot = await storage.getSlot(booking.slotId);
      if (!slot?.clinicId) return res.status(404).json({ message: "Clinic not found" });
      const clinic = await storage.getClinic(slot.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      await storage.createConsentToken(bookingId, clinic.id, token, expiresAt);

      const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
      const consentUrl = `${baseUrl}/consent/${token}`;

      await sendWhatsAppConsentLink(booking.customerPhone, booking.customerName, clinic.name, consentUrl);

      // G14 — Notify clinic admin that the doctor requested a consent form
      try {
        const drConsentNotif = await storage.createNotification({
          userId: String(clinic.id),
          message: `Consent form requested for ${booking.customerName} by Dr. ${sess.doctorEmail}`,
          read: false,
          type: "consent_requested",
          bookingId,
        });
        broadcastToClinic(String(clinic.id), { type: "consent_requested", bookingId, notification: drConsentNotif });
      } catch (e: any) {
        console.error('[NOTIFICATION] Doctor consent request notification failed:', e.message);
      }

      res.json({ success: true, consentUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/consent/:token — public, no auth, loads form data for patient
  app.get("/api/consent/:token", async (req, res) => {
    try {
      const record = await storage.getConsentByToken(req.params.token);
      if (!record) return res.status(404).json({ message: "Invalid or expired consent link" });
      if (record.status === "signed") return res.status(410).json({ message: "This consent form has already been signed" });
      if (new Date() > record.expiresAt) return res.status(410).json({ message: "This consent link has expired" });

      const slot = await storage.getSlot(record.booking.slotId);
      const { passwordHash, ...safeClinic } = record.clinic as any;

      res.json({
        patientName: record.booking.customerName,
        patientPhone: record.booking.customerPhone,
        clinicName: record.clinic.name,
        clinicAddress: record.clinic.address,
        clinicPhone: record.clinic.phone,
        appointmentTime: slot?.startTime || null,
        status: record.status,
        expiresAt: record.expiresAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/consent/:token/sign — public, patient submits their signature
  app.post("/api/consent/:token/sign", consentSignRateLimiter, async (req, res) => {
    try {
      const record = await storage.getConsentByToken(req.params.token);
      if (!record) return res.status(404).json({ message: "Invalid or expired consent link" });
      if (record.status === "signed") return res.status(410).json({ message: "Already signed" });
      if (new Date() > record.expiresAt) return res.status(410).json({ message: "This consent link has expired" });

      const { signature } = req.body;
      if (!signature || typeof signature !== "string") {
        return res.status(400).json({ message: "Signature is required" });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress || "unknown";

      await storage.markConsentSigned(req.params.token, signature, ip);

      // In-app notification for clinic admin — consent signed
      try {
        const consentClinicId = (record as any).clinic?.id;
        if (consentClinicId) {
          const consentSlot = await storage.getSlot(record.booking.slotId);
          const dateStr = consentSlot
            ? new Date(consentSlot.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : '';
          const consentNotif = await storage.createNotification({
            userId: String(consentClinicId),
            message: `Consent signed by ${record.booking.customerName}${dateStr ? ` for appointment on ${dateStr}` : ''}`,
            read: false,
            type: "consent_signed",
            bookingId: record.booking.id,
          });
          broadcastToClinic(String(consentClinicId), { type: "consent_signed", bookingId: record.booking.id, notification: consentNotif });
        }
      } catch (e: any) {
        console.error('[NOTIFICATION] Consent sign notification failed:', e.message);
      }

      res.json({ success: true, message: "Consent signed successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── CLINICAL RECORDS ────────────────────────────────────────────────────────

  // GET /api/clinical-records/booking/:bookingId — doctor or clinic admin
  app.get("/api/clinical-records/booking/:bookingId", isAuthenticated, async (req, res) => {
    try {
      const session = req.session as any;
      console.log("[CLINICAL-RECORDS-GET] session doctorLoggedIn:", session?.doctorLoggedIn, "adminLoggedIn:", session?.adminLoggedIn, "role:", session?.role);
      if (!session?.doctorLoggedIn && !session?.adminLoggedIn) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bookingId = parseInt(req.params.bookingId);
      if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking ID" });
      const records = await storage.getClinicalRecordsByBookingId(bookingId);
      console.log("[CLINICAL-RECORDS-GET] bookingId:", bookingId, "found records:", records.length);
      res.json(records);
    } catch (err: any) {
      console.error("[CLINICAL-RECORDS-GET] error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/clinical-records — doctor only
  app.post("/api/clinical-records", isAuthenticated, async (req, res) => {
    try {
      const session = req.session as any;
      if (!session?.doctorLoggedIn) {
        return res.status(401).json({ message: "Doctor authentication required" });
      }
      const { bookingId, patientName, patientPhone, doctorName, diagnosis, prescription, notes } = req.body;
      let { clinicId } = req.body;
      if (bookingId == null || !patientName) {
        return res.status(400).json({ message: "bookingId and patientName are required" });
      }
      if (clinicId == null) {
        const [row] = await db.select({ slotClinicId: slots.clinicId })
          .from(bookings)
          .innerJoin(slots, eq(bookings.slotId, slots.id))
          .where(eq(bookings.id, Number(bookingId)))
          .limit(1);
        clinicId = row?.slotClinicId ?? null;
      }
      if (clinicId == null) {
        return res.status(400).json({ message: "Could not determine clinic for this booking" });
      }
      const record = await storage.createClinicalRecord({
        bookingId: Number(bookingId),
        clinicId: Number(clinicId),
        patientName,
        patientPhone: patientPhone || null,
        doctorName: doctorName || null,
        diagnosis: Array.isArray(diagnosis) ? diagnosis : [],
        prescription: prescription || null,
        notes: notes || null,
      });

      // G9 — Notify clinic admin that a clinical record was created
      if (clinicId) {
        try {
          const crNotif = await storage.createNotification({
            userId: String(clinicId),
            message: `${doctorName || 'Doctor'} created a clinical record for ${patientName}${prescription ? ' (includes prescription)' : ''}`,
            read: false,
            type: "clinical_record_created",
            bookingId: Number(bookingId),
          });
          broadcastToClinic(String(clinicId), { type: "clinical_record_created", bookingId: Number(bookingId), notification: crNotif });
        } catch (e: any) {
          console.error('[NOTIFICATION] Clinical record created notification failed:', e.message);
        }
      }

      res.status(201).json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/clinical-records/:id — doctor only, update latest
  app.patch("/api/clinical-records/:id", isAuthenticated, async (req, res) => {
    try {
      const session = req.session as any;
      if (!session?.doctorLoggedIn) {
        return res.status(401).json({ message: "Doctor authentication required" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid record ID" });
      const { diagnosis, prescription, notes, doctorName } = req.body;
      const record = await storage.updateClinicalRecord(id, {
        ...(diagnosis !== undefined ? { diagnosis } : {}),
        ...(prescription !== undefined ? { prescription } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(doctorName !== undefined ? { doctorName } : {}),
      });

      // G9b — Notify clinic admin that a clinical record was updated
      if (record.clinicId) {
        try {
          const crUpdateNotif = await storage.createNotification({
            userId: String(record.clinicId),
            message: `${record.doctorName || 'Doctor'} updated clinical record for ${record.patientName}${prescription !== undefined ? ' (prescription updated)' : ''}`,
            read: false,
            type: "clinical_record_updated",
            bookingId: record.bookingId,
          });
          broadcastToClinic(String(record.clinicId), { type: "clinical_record_updated", bookingId: record.bookingId, notification: crUpdateNotif });
        } catch (e: any) {
          console.error('[NOTIFICATION] Clinical record updated notification failed:', e.message);
        }
      }

      res.json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/clinical-records/:id — doctor only, soft delete
  app.delete("/api/clinical-records/:id", isAuthenticated, async (req, res) => {
    try {
      const session = req.session as any;
      if (!session?.doctorLoggedIn) {
        return res.status(401).json({ message: "Doctor authentication required" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid record ID" });
      await storage.softDeleteClinicalRecord(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── INVENTORY ROUTES ──────────────────────────────────────────────────────

  function clinicSession(req: Request) {
    const sess = req.session as any;
    const clinicId: number | undefined = sess?.clinicId;
    const loggedIn: boolean = !!(sess?.adminLoggedIn || (sess?.clinicId && sess?.role === 'owner'));
    return { clinicId, loggedIn };
  }

  // GET /api/clinic/inventory/categories
  app.get("/api/clinic/inventory/categories", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const cats = await storage.getInventoryCategories(clinicId);
      res.json(cats);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/clinic/inventory/categories
  app.post("/api/clinic/inventory/categories", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const { name, department } = req.body;
      if (!name) return res.status(400).json({ message: "Name required" });
      const cat = await storage.createInventoryCategory({ clinicId, name, department });
      res.json(cat);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/clinic/inventory/items
  app.get("/api/clinic/inventory/items", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const items = await storage.getInventoryItems(clinicId);
      res.json(items);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/clinic/inventory/items
  app.post("/api/clinic/inventory/items", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const { name, trackingType, unit, currentQty, reorderLevel, criticalLevel,
              expiryDate, warrantyExpiry, nextServiceDate, notes, categoryId } = req.body;
      if (!name) return res.status(400).json({ message: "Name required" });
      const item = await storage.createInventoryItem({
        clinicId, name,
        trackingType: trackingType || "consumable",
        unit: unit || null,
        currentQty: currentQty ?? 0,
        reorderLevel: reorderLevel ?? null,
        criticalLevel: criticalLevel ?? null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
        notes: notes || null,
        categoryId: categoryId || null,
      });
      // Record initial stock transaction if qty > 0
      if (item.currentQty > 0) {
        const sess = req.session as any;
        await storage.createStockTransaction({
          itemId: item.id, clinicId,
          type: "add",
          qtyBefore: 0, qtyChange: item.currentQty, qtyAfter: item.currentQty,
          reason: "Initial stock",
          performedBy: sess?.adminEmail || "clinic admin",
        });
      }
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/clinic/inventory/items/:id
  app.patch("/api/clinic/inventory/items/:id", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const updates = req.body;
      if (updates.expiryDate) updates.expiryDate = new Date(updates.expiryDate);
      if (updates.warrantyExpiry) updates.warrantyExpiry = new Date(updates.warrantyExpiry);
      if (updates.nextServiceDate) updates.nextServiceDate = new Date(updates.nextServiceDate);
      const item = await storage.updateInventoryItem(id, clinicId, updates);
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/clinic/inventory/items/:id
  app.delete("/api/clinic/inventory/items/:id", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteInventoryItem(id, clinicId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/clinic/inventory/transactions
  app.get("/api/clinic/inventory/transactions", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const txs = await storage.getStockTransactions(clinicId);
      res.json(txs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/clinic/inventory/transactions  (add / deduct / adjust stock)
  app.post("/api/clinic/inventory/transactions", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const { itemId, type, qtyChange, reason } = req.body;
      if (!itemId || !type || qtyChange === undefined) {
        return res.status(400).json({ message: "itemId, type and qtyChange required" });
      }
      const items = await storage.getInventoryItems(clinicId);
      const item = items.find(i => i.id === itemId);
      if (!item) return res.status(404).json({ message: "Item not found" });

      const qtyBefore = item.currentQty;
      let qtyAfter: number;
      if (type === "add") qtyAfter = qtyBefore + Math.abs(qtyChange);
      else if (type === "deduct") qtyAfter = Math.max(0, qtyBefore - Math.abs(qtyChange));
      else qtyAfter = Math.max(0, qtyChange); // adjust = set to value

      const sess = req.session as any;
      const tx = await storage.createStockTransaction({
        itemId, clinicId, type,
        qtyBefore, qtyChange: qtyAfter - qtyBefore, qtyAfter,
        reason: reason || null,
        performedBy: sess?.adminEmail || "clinic admin",
      });

      const updated = await storage.updateInventoryItem(itemId, clinicId, { currentQty: qtyAfter });

      // Auto-generate alerts based on new quantity
      if (updated.criticalLevel !== null && qtyAfter <= updated.criticalLevel) {
        await storage.createStockAlert({ itemId, clinicId, alertType: "critical", isDismissed: false });
      } else if (updated.reorderLevel !== null && qtyAfter <= updated.reorderLevel) {
        await storage.createStockAlert({ itemId, clinicId, alertType: "low", isDismissed: false });
      }

      res.json({ tx, item: updated });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/clinic/inventory/alerts
  app.get("/api/clinic/inventory/alerts", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const alerts = await storage.getStockAlerts(clinicId);
      res.json(alerts);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/clinic/inventory/alerts/:id/dismiss
  app.patch("/api/clinic/inventory/alerts/:id/dismiss", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.dismissStockAlert(id, clinicId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── PHARMACY STOCK ─────────────────────────────────────────────────────────

  // GET /api/auth/clinic/pharmacy — list all catalog items
  app.get("/api/auth/clinic/pharmacy", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const items = await storage.getPharmacyStock(clinicId);
      res.json(items);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/auth/clinic/pharmacy — add item
  app.post("/api/auth/clinic/pharmacy", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const { medicineName, dosage, unitPrice, availableQty, expiryDate } = req.body;
      if (!medicineName) return res.status(400).json({ message: "medicineName is required" });
      const item = await storage.createPharmacyItem({
        clinicId, medicineName, dosage: dosage || null,
        unitPrice: parseFloat(unitPrice) || 0,
        availableQty: parseInt(availableQty) || 0,
        expiryDate: expiryDate || null,
      });
      res.status(201).json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/auth/clinic/pharmacy/:id — update item
  app.patch("/api/auth/clinic/pharmacy/:id", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const item = await storage.updatePharmacyItem(id, clinicId, req.body);
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/auth/clinic/pharmacy/:id — delete item
  app.delete("/api/auth/clinic/pharmacy/:id", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deletePharmacyItem(id, clinicId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── PATIENT BILLS ──────────────────────────────────────────────────────────

  // GET /api/auth/clinic/bills — all bills for this clinic
  app.get("/api/auth/clinic/bills", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const bills = await storage.getPatientBillsByClinicId(clinicId);
      res.json(bills);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/bills/patient/:phone — all bills for a patient by phone across all bookings
  app.get("/api/auth/clinic/bills/patient/:phone", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const phone = decodeURIComponent(req.params.phone);
      if (!phone) return res.status(400).json({ message: "Phone required" });
      const bills = await storage.getPatientBillsByPhone(clinicId, phone);
      res.json(bills);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/bills/patient-by-email/:email — all bills for a patient by email (primary identifier)
  app.get("/api/auth/clinic/bills/patient-by-email/:email", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const email = decodeURIComponent(req.params.email);
      if (!email) return res.status(400).json({ message: "Email required" });
      const bills = await storage.getPatientBillsByEmail(clinicId, email);
      res.json(bills);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/patients — all patient profiles for this clinic
  app.get("/api/auth/clinic/patients", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const patientList = await storage.getPatientsByClinic(clinicId);
      res.json(patientList);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/patients/:patientId/history — full history for one patient
  app.get("/api/auth/clinic/patients/:patientId/history", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) return res.status(400).json({ message: "Invalid patient ID" });
      const history = await storage.getPatientHistory(clinicId, patientId);
      res.json(history);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/bills/patient-by-id/:patientId — all bills for a patient by patientId
  app.get("/api/auth/clinic/bills/patient-by-id/:patientId", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) return res.status(400).json({ message: "Invalid patient ID" });
      const bills = await storage.getPatientBillsByPatientId(clinicId, patientId);
      res.json(bills);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/bills/booking/:bookingId — bills for a specific booking
  app.get("/api/auth/clinic/bills/booking/:bookingId", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const bookingId = parseInt(req.params.bookingId);
      if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking ID" });
      const bills = await storage.getPatientBillsByBookingId(bookingId, clinicId);
      res.json(bills);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/auth/clinic/bills — create a new bill
  app.post("/api/auth/clinic/bills", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const { bookingId, billNumber, patientName, patientPhone, patientEmail, patientId,
              services, subtotal, discountPct, taxPct, total,
              paymentMethod, paymentStatus, notes } = req.body;
      if (!patientName || !billNumber) {
        return res.status(400).json({ message: "patientName and billNumber are required" });
      }
      const bill = await storage.createPatientBill({
        clinicId,
        bookingId: bookingId || null,
        patientId: patientId || null,
        billNumber,
        patientName,
        patientPhone: patientPhone || null,
        patientEmail: patientEmail || null,
        services: services || [],
        subtotal: subtotal || 0,
        discountPct: discountPct || 0,
        taxPct: taxPct || 0,
        total: total || 0,
        paymentMethod: paymentMethod || "Cash",
        paymentStatus: paymentStatus || "paid",
        notes: notes || null,
      });
      res.status(201).json(bill);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/auth/clinic/bills/:id — update a bill
  app.patch("/api/auth/clinic/bills/:id", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const bill = await storage.updatePatientBill(id, clinicId, req.body);

      // Auto-close booking when all its bills are now paid
      // Triggers from treatment_completed OR in_consultation (billing done before doctor marks done)
      if (req.body.paymentStatus === 'paid' && bill.bookingId) {
        try {
          const bookingBills = await storage.getPatientBillsByBookingId(bill.bookingId, clinicId);
          const allPaid = bookingBills.length > 0 && bookingBills.every(b => b.paymentStatus === 'paid');
          if (allPaid) {
            const booking = await storage.getBookingById(bill.bookingId);
            const billableStates = ['treatment_completed', 'in_consultation'];
            if (booking && billableStates.includes(booking.visitStatus || '')) {
              await storage.updateVisitStatus(bill.bookingId, 'completed', undefined, new Date());
              broadcastToClinic(String(clinicId), { type: 'visit_auto_completed', bookingId: bill.bookingId });
              console.log(`[AUTO-COMPLETE] Booking ${bill.bookingId} auto-completed from '${booking.visitStatus}' — all bills settled`);
            }
          }
        } catch (e: any) {
          console.error('[AUTO-COMPLETE] Failed:', e.message);
        }

        // G13 — Auto-send payment confirmation email to patient when bill is marked paid
        if (bill.patientEmail || bill.patientPhone) {
          try {
            const billClinic = await storage.getClinic(clinicId);
            const clinicNameForBill = billClinic?.name || 'Your clinic';
            const billServices = (bill.services ?? []) as { description: string; amount: number }[];
            const billLineItems = billServices.map(s => `<tr><td style="padding:4px 8px">${s.description}</td><td style="padding:4px 8px;text-align:right">₹${Number(s.amount).toFixed(0)}</td></tr>`).join('');
            if (resend && bill.patientEmail) {
              const paidToEmail = RESEND_MODE === 'PRODUCTION' ? bill.patientEmail : TEST_EMAIL;
              resend.emails.send({
                from: EMAIL_FROM,
                to: paidToEmail,
                subject: `Payment Confirmed — ${clinicNameForBill}`,
                html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px"><div style="background:#085041;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px"><h2 style="color:#fff;margin:0;font-size:20px">${clinicNameForBill}</h2><p style="color:#a7f3d0;margin:6px 0 0;font-size:13px">Payment Confirmation</p></div><p style="color:#374151">Dear <strong>${bill.patientName}</strong>,</p><p style="color:#374151">Your bill <strong>${bill.billNumber}</strong> has been marked as <strong style="color:#059669">Paid</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden"><thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;color:#6b7280;font-size:13px">Item</th><th style="padding:8px;text-align:right;color:#6b7280;font-size:13px">Amount</th></tr></thead><tbody style="font-size:13px;color:#374151">${billLineItems}</tbody><tfoot><tr style="border-top:2px solid #e5e7eb"><td style="padding:8px;font-weight:700">Total Paid</td><td style="padding:8px;text-align:right;font-weight:700;color:#059669">₹${Number(bill.total ?? 0).toFixed(0)}</td></tr></tfoot></table><p style="color:#6b7280;font-size:12px;text-align:center">Thank you for choosing ${clinicNameForBill}. We wish you a speedy recovery.</p><p style="color:#d1d5db;font-size:11px;text-align:center;margin-top:16px">Powered by BookMySlot</p></div>`,
              }).catch(() => {});
            }
          } catch (e: any) {
            console.error('[AUTO-NOTIFY-PAID] Failed:', e.message);
          }
        }
      }

      res.json(bill);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/auth/clinic/bills/:id — delete a bill
  app.delete("/api/auth/clinic/bills/:id", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deletePatientBill(id, clinicId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/auth/clinic/bills/:id/notify-paid — send payment confirmation to patient
  app.post("/api/auth/clinic/bills/:id/notify-paid", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const bill = await storage.getPatientBillById(id, clinicId);
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      if (!bill.patientEmail && !bill.patientPhone) {
        return res.json({ success: true, message: "No contact info — notification skipped" });
      }

      const clinic = await storage.getClinic(clinicId);
      const clinicName = clinic?.name || "Your clinic";

      const services = (bill.services ?? []) as { description: string; amount: number; paid?: boolean }[];
      const lineItems = services.map(s => `<tr><td style="padding:4px 8px">${s.description}</td><td style="padding:4px 8px;text-align:right">₹${s.amount.toFixed(0)}</td></tr>`).join('');

      if (resend && bill.patientEmail) {
        const finalEmail = RESEND_MODE === 'PRODUCTION' ? bill.patientEmail : TEST_EMAIL;
        await resend.emails.send({
          from: EMAIL_FROM,
          to: finalEmail,
          subject: `Payment Confirmed — ${clinicName}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px">
              <div style="background:#085041;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px">
                <h2 style="color:#fff;margin:0;font-size:20px">${clinicName}</h2>
                <p style="color:#a7f3d0;margin:6px 0 0;font-size:13px">Payment Confirmation</p>
              </div>
              <p style="color:#374151">Dear <strong>${bill.patientName}</strong>,</p>
              <p style="color:#374151">Your bill <strong>${bill.billNumber}</strong> has been marked as <strong style="color:#059669">Paid</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden">
                <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;color:#6b7280;font-size:13px">Item</th><th style="padding:8px;text-align:right;color:#6b7280;font-size:13px">Amount</th></tr></thead>
                <tbody style="font-size:13px;color:#374151">${lineItems}</tbody>
                <tfoot><tr style="border-top:2px solid #e5e7eb"><td style="padding:8px;font-weight:700">Total Paid</td><td style="padding:8px;text-align:right;font-weight:700;color:#059669">₹${(bill.total ?? 0).toFixed(0)}</td></tr></tfoot>
              </table>
              <p style="color:#6b7280;font-size:12px;text-align:center">Thank you for choosing ${clinicName}. We wish you a speedy recovery.</p>
              <p style="color:#d1d5db;font-size:11px;text-align:center;margin-top:16px">Powered by BookMySlot</p>
            </div>`,
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("notify-paid error:", err.message);
      res.json({ success: false, error: err.message });
    }
  });

  // GET /api/auth/clinic/clinical-records/patient — all clinical records for a patient by phone
  app.get("/api/auth/clinic/clinical-records/patient", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
      if (!phone) return res.status(400).json({ message: "phone required" });
      const { db } = await import("./db");
      const { clinicalRecords } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const records = await db.select().from(clinicalRecords)
        .where(and(eq(clinicalRecords.clinicId, clinicId), eq(clinicalRecords.patientPhone, phone)))
        .orderBy(desc(clinicalRecords.createdAt));
      res.json(records.filter((r: any) => !r.isDeleted));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── BILLING AUDIT LOGS ────────────────────────────────────────────────────
  // POST /api/auth/clinic/billing-audit — create a log entry
  app.post("/api/auth/clinic/billing-audit", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const { bookingId, billId, action, details, performedBy } = req.body;
      if (!action) return res.status(400).json({ message: "action required" });
      const { db } = await import("./db");
      const { billingAuditLogs } = await import("@shared/schema");
      const [entry] = await db.insert(billingAuditLogs).values({
        clinicId,
        bookingId: bookingId ? parseInt(bookingId) : null,
        billId: billId ? parseInt(billId) : null,
        action: String(action),
        details: details ?? {},
        performedBy: performedBy ?? null,
      }).returning();
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/billing-audit/booking/:bookingId — audit trail for a booking
  app.get("/api/auth/clinic/billing-audit/booking/:bookingId", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const bookingId = parseInt(req.params.bookingId);
      if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking ID" });
      const { db } = await import("./db");
      const { billingAuditLogs } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const logs = await db.select().from(billingAuditLogs)
        .where(and(eq(billingAuditLogs.clinicId, clinicId), eq(billingAuditLogs.bookingId, bookingId)))
        .orderBy(desc(billingAuditLogs.createdAt))
        .limit(50);
      res.json(logs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── CLINIC ANALYTICS ──────────────────────────────────────────────────────
  // GET /api/auth/clinic/analytics?range=30d
  app.get("/api/auth/clinic/analytics", isAuthenticated, async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const range = typeof req.query.range === 'string' ? req.query.range : '30d';
      const analytics = await storage.getClinicAnalytics(clinicId, range);
      res.json(analytics);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── X-RAY ANALYSIS ────────────────────────────────────────────────────────
  // POST /api/xray/analyse
  // Accepts a dental X-ray image, proxies it to the Hugging Face AI service,
  // and returns detected findings. Doctor session required.
  const xrayUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only JPEG, PNG, WebP and BMP images are accepted."));
      }
    },
  });

  app.post("/api/xray/analyse", xrayUpload.single("file"), async (req, res) => {
    const sess = req.session as any;
    if (!sess.doctorLoggedIn || sess.role !== "doctor" || !sess.doctorEmail) {
      return res.status(401).json({ success: false, message: "Not authenticated. Please log in as a doctor." });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided." });
    }
    try {
      const result = await wakeAndAnalyse(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      if (!result.success) {
        return res.status(502).json({
          success: false,
          message: result.message || "AI analysis failed. Please try again.",
        });
      }
      return res.json({
        success: true,
        findings: result.analysis?.findings ?? [],
      });
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("abort")) {
        return res.status(504).json({
          success: false,
          message: "AI service timed out. The service may be waking up — please try again in 30 seconds.",
        });
      }
      console.error("[X-Ray] AI service error:", err.message);
      return res.status(503).json({
        success: false,
        message: "AI service is currently unavailable. Please try again shortly.",
      });
    }
  });

  return createServer(app);
}
