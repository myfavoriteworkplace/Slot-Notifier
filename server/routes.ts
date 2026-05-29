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
import crypto from "crypto";
import { generateSignedUploadUrl } from "./signedUrl.service";
import ExcelJS from "exceljs";
import { sendWhatsAppBookingNotification, sendWhatsAppConfirmationNotification, sendWhatsAppConsentLink } from "./whatsapp.service";
import Razorpay from "razorpay";

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
  const dashLink    = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login`;
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
  const dashLink    = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login`;
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
  const loginUrl = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login`;
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
  app.post("/api/public/otp/send", async (req, res) => {
    try {
      const { email, purpose = "booking" } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "A valid email address is required" });
      }
      const normalizedEmail = email.toLowerCase();

      // Rate-limit: if an OTP was created < 60 seconds ago for same email+purpose, block
      const [recent] = await db.select().from(emailOtps)
        .where(and(
          eq(emailOtps.email, normalizedEmail),
          eq(emailOtps.purpose, purpose),
          sql`${emailOtps.expiresAt} > NOW() + INTERVAL '4 minutes'`
        ))
        .limit(1);

      if (recent) {
        return res.status(429).json({ message: "Please wait before requesting a new code" });
      }

      // Remove any previous OTPs for this email+purpose combination
      await db.delete(emailOtps).where(and(
        eq(emailOtps.email, normalizedEmail),
        eq(emailOtps.purpose, purpose),
      ));

      // Generate 6-digit code and hash it
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await db.insert(emailOtps).values({ email: normalizedEmail, otpHash, expiresAt, purpose });

      if (resend && RESEND_MODE === 'PRODUCTION') {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject: "Your BookMySlot verification code",
          html: sendOtpEmail(code),
        });
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
  app.post("/api/public/otp/verify", async (req, res) => {
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

      const isMatch = await bcrypt.compare(code.toString(), otpRow.otpHash);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect code. Please try again." });
      }

      const verifiedToken = crypto.randomBytes(32).toString("hex");
      await db.update(emailOtps)
        .set({ verified: true, verifiedToken })
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

      const slot = await storage.createSlot({
        ownerId: null,
        startTime: requestedStart,
        endTime: new Date(endTime),
        clinicName: clinicName || clinic.name,
        clinicId: clinic.id,
        isBooked: true,
      } as any);

      const booking = await storage.createPublicBooking({
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
      });

      // Upsert patient profile and link to booking
      try {
        const patient = await storage.upsertPatientByEmail(clinic.id, customerEmail, customerName, customerPhone);
        await db.update(bookings).set({ patientId: patient.id } as any).where(eq(bookings.id, booking.id));
      } catch (e: any) {
        console.error('[PATIENT PROFILE] Failed to upsert:', e.message);
      }

      // Consume the OTP token — one token, one booking
      await db.delete(emailOtps).where(eq(emailOtps.id, otpRow.id));

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
        });
        broadcastToClinic(String(clinic.id), { type: "paid_booking", notification: paidNotif });
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

  // ── PUBLIC BOOKING: clinic-approval path (pending) ─────────────────────────
  app.post("/api/public/bookings", async (req, res) => {
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
      const existingBookings = await storage.countVerifiedBookingsForClinicTime(clinic.id, clinic.name, requestedStart);
      const MAX_BOOKINGS_PER_SLOT = 3;
      if (existingBookings >= MAX_BOOKINGS_PER_SLOT) {
        return res.status(400).json({ message: "This time slot is fully booked. Please choose another time." });
      }

      const slot = await storage.createSlot({
        ownerId: null,
        startTime: requestedStart,
        endTime: new Date(endTime),
        clinicName: clinicName || clinic.name,
        clinicId: clinic.id,
        isBooked: true,
      } as any);

      const booking = await storage.createPublicBooking({
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
      });

      // Upsert patient profile and link to booking
      try {
        const patient = await storage.upsertPatientByEmail(clinic.id, customerEmail, customerName, customerPhone);
        await db.update(bookings).set({ patientId: patient.id } as any).where(eq(bookings.id, booking.id));
      } catch (e: any) {
        console.error('[PATIENT PROFILE] Failed to upsert:', e.message);
      }

      // Consume the OTP token — one token, one booking
      await db.delete(emailOtps).where(eq(emailOtps.id, otpRow.id));

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
        });
        broadcastToClinic(String(clinic.id), { type: "new_booking", notification });
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

          const max         = configSlot?.maxBookings ?? 3;
          const isCancelled = configSlot?.isCancelled ?? false;
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

  app.post("/api/auth/clinic/login", async (req, res) => {
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

  app.post("/api/auth/admin/login", async (req, res) => {
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

  app.get("/api/auth/clinic/me", async (req, res) => {
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

  app.post("/api/auth/doctor/login", async (req, res) => {
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
      return res.json(results.map(r => ({ ...r.booking, clinicId: r.booking.clinicId ?? r.slot.clinicId, slot: r.slot, clinic: r.clinic })));
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
      const { customerName, customerPhone, customerEmail, startTime, endTime, description } = req.body;

      if (!customerName || !customerPhone || !startTime || !endTime) {
        return res.status(400).json({ message: "Name, phone, start time and end time are required" });
      }

      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const requestedStart = new Date(startTime);
      const existingBookings = await storage.countVerifiedBookingsForClinicTime(clinic.id, clinic.name, requestedStart);
      const MAX_BOOKINGS_PER_SLOT = 3;
      if (existingBookings >= MAX_BOOKINGS_PER_SLOT) {
        return res.status(400).json({ message: "This time slot is fully booked. Please choose another time." });
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
    const { scope } = req.body as { scope: string[] };
    if (!scope || !Array.isArray(scope) || scope.length === 0) {
      return res.status(400).json({ message: "scope is required" });
    }
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      const allBookings = await storage.getClinicBookings(sess.clinicId);
      const exportDate = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      // Deduplicate patients
      const seen = new Set<string>();
      const uniquePatients = allBookings.filter(b => {
        const key = b.customerEmail || b.customerPhone;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const patientsHeaders = ["Patient Name", "Phone", "Email"];
      const patientsData = uniquePatients.map(b => [
        b.customerName,
        b.customerPhone,
        b.customerEmail ?? "",
      ]);

      const apptHeaders = ["Booking ID", "Patient Name", "Phone", "Email", "Date", "Time", "Doctor", "Status", "Chief Complaint"];
      const apptData = allBookings.map(b => [
        b.id,
        b.customerName,
        b.customerPhone,
        b.customerEmail ?? "",
        new Date(b.slot.startTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        new Date(b.slot.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        (b as any).assignedDoctor ?? "Unassigned",
        b.verificationStatus,
        b.description ?? "",
      ]);

      // --- ExcelJS formatting ---
      const DARK    = "FF085041";
      const MID     = "FF0A6649";
      const PRIMARY = "FF0F9B6E";
      const TINT    = "FFE1F5EE";
      const OFF     = "FFF8F8F6";
      const WHITE   = "FFFFFFFF";
      const STATUS_COLORS: Record<string, string> = {
        verified:   "FF0F9B6E",
        pending:    "FFD97706",
        cancelled:  "FFDC2626",
        unverified: "FFD97706",
      };
      const thin = (argb = "FFCCCCCC") => ({ style: "thin" as const, color: { argb } });

      function applyHeaderCell(cell: ExcelJS.Cell) {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
        cell.font      = { bold: true, size: 10, color: { argb: WHITE } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border    = { top: thin("FF085041"), bottom: thin("FF085041"), left: thin("FF085041"), right: thin("FF085041") };
      }

      function applyDataCell(cell: ExcelJS.Cell, rowIdx: number, statusColor?: string) {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: rowIdx % 2 === 1 ? TINT : OFF } };
        cell.border    = { top: thin(), bottom: thin(), left: thin(), right: thin() };
        cell.alignment = { vertical: "middle", wrapText: false };
        cell.font      = statusColor
          ? { size: 9, bold: true, color: { argb: statusColor } }
          : { size: 9, color: { argb: "FF1A1A1A" } };
      }

      function buildSheet(
        wb: ExcelJS.Workbook,
        sheetName: string,
        headers: string[],
        rows: (string | number | null | undefined)[][],
        colWidths: number[],
        recordCount: number,
        statusColIdx?: number,
      ) {
        const ws = wb.addWorksheet(sheetName);
        const nc = headers.length;
        const lastLetter = nc <= 26 ? String.fromCharCode(64 + nc) : "Z";

        ws.mergeCells(`A1:${lastLetter}1`);
        const r1 = ws.getCell("A1");
        r1.value = clinic!.name;
        r1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
        r1.font  = { bold: true, size: 14, color: { argb: WHITE } };
        r1.alignment = { vertical: "middle", horizontal: "center" };
        ws.getRow(1).height = 32;

        ws.mergeCells(`A2:${lastLetter}2`);
        const r2 = ws.getCell("A2");
        r2.value = `${sheetName}  ·  Exported: ${exportDate}  ·  ${recordCount} records`;
        r2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: MID } };
        r2.font  = { italic: true, size: 9, color: { argb: "FFAACCBB" } };
        r2.alignment = { vertical: "middle", horizontal: "center" };
        ws.getRow(2).height = 18;

        ws.mergeCells(`A3:${lastLetter}3`);
        ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
        ws.getRow(3).height = 4;

        const hRow = ws.getRow(4);
        hRow.values = ["", ...headers];
        headers.forEach((_h, i) => applyHeaderCell(hRow.getCell(i + 1)));
        hRow.height = 22;

        rows.forEach((row, rIdx) => {
          const dRow = ws.getRow(5 + rIdx);
          row.forEach((val, cIdx) => {
            const cell = dRow.getCell(cIdx + 1);
            cell.value = val ?? "";
            const statusColor =
              statusColIdx !== undefined && cIdx === statusColIdx
                ? STATUS_COLORS[String(val ?? "").toLowerCase()]
                : undefined;
            applyDataCell(cell, rIdx, statusColor);
          });
          dRow.height = 18;
        });

        colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
        ws.autoFilter = `A4:${lastLetter}4`;
        ws.views = [{ state: "frozen", ySplit: 4, xSplit: 0, topLeftCell: "A5", activeCell: "A5" }];
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = clinic.name;
      wb.created = new Date();

      if (scope.includes("patients")) {
        buildSheet(wb, "Patient Profiles", patientsHeaders, patientsData,
          [32, 20, 36], uniquePatients.length);
      }
      if (scope.includes("appointments")) {
        buildSheet(wb, "Appointments", apptHeaders, apptData,
          [10, 28, 18, 32, 14, 10, 26, 14, 40], allBookings.length, 7);
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
          });
          broadcastToClinic(String(clinic.id), { type: "booking_rescheduled", notification: reschedNotif });
        } catch (e: any) {
          console.error('[NOTIFICATION] Reschedule notification failed:', e.message);
        }
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
            });
            broadcastToDoctor(String(overriddenDoc.id), { type: "admin_confirmed", notification: overrideNotif });
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
        });
        broadcastToClinic(String(clinicId), { type: "booking_cancelled", notification: notif });
      } catch (e: any) {
        console.error('[NOTIFICATION] Cancel notification failed:', e.message);
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
            });
            broadcastToDoctor(String(assignedDoc.id), { type: "doctor_assigned", notification: assignNotif });
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
          });
          broadcastToClinic(String(doctorClinic.id), { type: "doctor_approved", notification: approveNotif });
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
            });
            broadcastToClinic(String(clinicForDecline.id), { type: "doctor_declined", notification: declineNotif });
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
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clinics/:id/unarchive", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Forbidden" });
    try {
      const clinic = await storage.unarchiveClinic(Number(req.params.id));
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
      res.sendStatus(204);
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
      res.json(updated);
    } catch (err: any) {
      const status = err.message?.startsWith("Forbidden") ? 403 : err.message === "Booking not found" ? 404 : 500;
      res.status(status).json({ message: err.message });
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
  app.post("/api/auth/clinic/bookings/:id/request-consent", async (req, res) => {
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
  app.post("/api/consent/:token/sign", async (req, res) => {
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
          });
          broadcastToClinic(String(consentClinicId), { type: "consent_signed", notification: consentNotif });
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
  app.get("/api/clinical-records/booking/:bookingId", async (req, res) => {
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
  app.post("/api/clinical-records", async (req, res) => {
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
      res.status(201).json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/clinical-records/:id — doctor only, update latest
  app.patch("/api/clinical-records/:id", async (req, res) => {
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
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/clinical-records/:id — doctor only, soft delete
  app.delete("/api/clinical-records/:id", async (req, res) => {
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
  app.get("/api/clinic/inventory/categories", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const cats = await storage.getInventoryCategories(clinicId);
      res.json(cats);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/clinic/inventory/categories
  app.post("/api/clinic/inventory/categories", async (req, res) => {
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
  app.get("/api/clinic/inventory/items", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const items = await storage.getInventoryItems(clinicId);
      res.json(items);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/clinic/inventory/items
  app.post("/api/clinic/inventory/items", async (req, res) => {
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
  app.patch("/api/clinic/inventory/items/:id", async (req, res) => {
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
  app.delete("/api/clinic/inventory/items/:id", async (req, res) => {
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
  app.get("/api/clinic/inventory/transactions", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const txs = await storage.getStockTransactions(clinicId);
      res.json(txs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/clinic/inventory/transactions  (add / deduct / adjust stock)
  app.post("/api/clinic/inventory/transactions", async (req, res) => {
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
  app.get("/api/clinic/inventory/alerts", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const alerts = await storage.getStockAlerts(clinicId);
      res.json(alerts);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/clinic/inventory/alerts/:id/dismiss
  app.patch("/api/clinic/inventory/alerts/:id/dismiss", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.dismissStockAlert(id, clinicId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── PATIENT BILLS ──────────────────────────────────────────────────────────

  // GET /api/auth/clinic/bills — all bills for this clinic
  app.get("/api/auth/clinic/bills", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const bills = await storage.getPatientBillsByClinicId(clinicId);
      res.json(bills);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/bills/patient/:phone — all bills for a patient by phone across all bookings
  app.get("/api/auth/clinic/bills/patient/:phone", async (req, res) => {
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
  app.get("/api/auth/clinic/bills/patient-by-email/:email", async (req, res) => {
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
  app.get("/api/auth/clinic/patients", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const patientList = await storage.getPatientsByClinic(clinicId);
      res.json(patientList);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/patients/:patientId/history — full history for one patient
  app.get("/api/auth/clinic/patients/:patientId/history", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) return res.status(400).json({ message: "Invalid patient ID" });
      const history = await storage.getPatientHistory(clinicId, patientId);
      res.json(history);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/auth/clinic/bills/booking/:bookingId — bills for a specific booking
  app.get("/api/auth/clinic/bills/booking/:bookingId", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const bookingId = parseInt(req.params.bookingId);
      if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking ID" });
      const bills = await storage.getPatientBillsByBookingId(bookingId);
      res.json(bills);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/auth/clinic/bills — create a new bill
  app.post("/api/auth/clinic/bills", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const { bookingId, billNumber, patientName, patientPhone, patientEmail,
              services, subtotal, discountPct, taxPct, total,
              paymentMethod, paymentStatus, notes } = req.body;
      if (!patientName || !billNumber) {
        return res.status(400).json({ message: "patientName and billNumber are required" });
      }
      const bill = await storage.createPatientBill({
        clinicId,
        bookingId: bookingId || null,
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
  app.patch("/api/auth/clinic/bills/:id", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const bill = await storage.updatePatientBill(id, clinicId, req.body);
      res.json(bill);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/auth/clinic/bills/:id — delete a bill
  app.delete("/api/auth/clinic/bills/:id", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deletePatientBill(id, clinicId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── CLINIC ANALYTICS ──────────────────────────────────────────────────────
  // GET /api/auth/clinic/analytics?range=30d
  app.get("/api/auth/clinic/analytics", async (req, res) => {
    try {
      const { clinicId, loggedIn } = clinicSession(req);
      if (!loggedIn || !clinicId) return res.status(401).json({ message: "Unauthorized" });
      const range = typeof req.query.range === 'string' ? req.query.range : '30d';
      const analytics = await storage.getClinicAnalytics(clinicId, range);
      res.json(analytics);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  return createServer(app);
}
