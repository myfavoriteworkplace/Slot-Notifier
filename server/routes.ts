import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { api, errorSchemas } from "@shared/routes";
import { insertClinicSchema, insertBookingSchema, clinics, slots, bookings, notifications, doctorInvites, doctors, clinicDoctors, siteSettings, smileDeals, emailOtps, activationTokens } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from 'resend';
import crypto from "crypto";
import { generateSignedUploadUrl } from "./signedUrl.service";
import ExcelJS from "exceljs";
import { sendWhatsAppBookingNotification, sendWhatsAppConfirmationNotification, sendWhatsAppConsentLink } from "./twilio.service";
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

function emailShell(headerColor: string, headerTitle: string, headerSubtitle: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ff;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(62,52,180,0.10)">
        <tr>
          <td style="background:${headerColor};padding:28px 32px 24px">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.60)">BookMySlot</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.2">${headerTitle}</h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.82)">${headerSubtitle}</p>
          </td>
        </tr>
        ${body}
        <tr>
          <td style="background:${headerColor};padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.60)">Powered by <strong style="color:#fff">BookMySlot</strong> &nbsp;·&nbsp; Please do not reply to this email</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailsTable(rows: { label: string; value: string; mono?: boolean }[]): string {
  const rowsHtml = rows.map((r, i) => `
    <tr style="${i < rows.length - 1 ? 'border-bottom:1px solid #e5e3fa' : ''}">
      <td style="padding:9px 14px;color:#6b6f8c;font-size:13px;width:130px;vertical-align:top">${r.label}</td>
      <td style="padding:9px 14px;font-size:13px;font-weight:600;color:${r.mono ? '#3e34b4' : '#1e1c3c'};${r.mono ? 'font-family:monospace' : ''}">${r.value}</td>
    </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ff;border-radius:10px;overflow:hidden;border:1px solid #e5e3fa">
    <tr style="background:#3e34b4"><td colspan="2" style="padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.85)">Appointment Details</td></tr>
    ${rowsHtml}
  </table>`;
}

function actionButton(label: string, href: string, color = '#3e34b4'): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background:${color};color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px">${label}</a>`;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'Bms@';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sendOtpEmail(code: string): string {
  return emailShell(
    '#3e34b4',
    'Your Verification Code',
    'Use this code to verify your email and complete your booking',
    `<tr><td style="padding:28px 32px">
      <p style="margin:0 0 20px;font-size:14px;color:#4a4a6a;line-height:1.6">Enter the code below in the booking form. It is valid for <strong>5 minutes</strong> and can only be used once.</p>
      <div style="background:#f5f4ff;border:2px dashed #c4c0f0;border-radius:12px;padding:28px;text-align:center;margin:0 0 20px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#6b6f8c">Your verification code</p>
        <p style="margin:0;font-size:44px;font-weight:900;letter-spacing:12px;color:#3e34b4;font-family:monospace">${code}</p>
      </div>
      <p style="margin:0;font-size:12px;color:#9090aa;text-align:center">If you did not request this, you can safely ignore this email.</p>
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
  const finalClinicEmail = RESEND_MODE === 'PRODUCTION' ? clinicEmail : TEST_EMAIL;
  const formattedTime = startTime.toLocaleString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const calLink = makeGoogleCalLink(`Appointment at ${clinicName}`, startTime);
  const receiptRef = bookingId ? `BMS-${bookingId}` : null;

  const patientDetailRows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Clinic', value: clinicName },
    { label: 'Date &amp; Time', value: formattedTime },
    ...(clinicPhone ? [{ label: 'Clinic Phone', value: clinicPhone }] : []),
    ...(receiptRef ? [{ label: 'Reference', value: receiptRef, mono: true }] : []),
  ];

  const patientHtml = emailShell(
    'linear-gradient(90deg,#3e34b4 0%,#a83cd2 100%)',
    'Booking Received ✓',
    `Your request has been sent to <strong>${clinicName}</strong>.`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi <strong>${customerName}</strong>,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        Thanks for booking with us! Your appointment request is now <strong>pending clinic confirmation</strong>. You will receive another email as soon as the clinic approves it.
      </p>
      ${detailsTable(patientDetailRows)}
    </td></tr>
    <tr><td style="padding:20px 32px 28px">
      ${actionButton('Add to Google Calendar', calLink)}
    </td></tr>`
  );

  const clinicDetailRows: { label: string; value: string }[] = [
    { label: 'Patient', value: customerName },
    ...(customerPhone ? [{ label: 'Phone', value: customerPhone }] : []),
    ...(customerEmail ? [{ label: 'Email', value: customerEmail }] : []),
    { label: 'Date &amp; Time', value: formattedTime },
    ...(receiptRef ? [{ label: 'Reference', value: receiptRef }] : []),
  ];

  const clinicHtml = emailShell(
    'linear-gradient(90deg,#1e1c3c 0%,#3e34b4 100%)',
    'New Booking Request',
    `A patient has requested an appointment at <strong>${clinicName}</strong>.`,
    `<tr><td style="padding:24px 32px 20px">
      <p style="margin:0 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        A new appointment request is waiting for your review. Log in to your Clinic Portal to confirm or manage this booking.
      </p>
      ${detailsTable(clinicDetailRows)}
    </td></tr>`
  );

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalCustomerEmail,
      subject: `Booking Received at ${clinicName} — Pending Confirmation`,
      html: patientHtml,
    });
    if (finalClinicEmail) {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: finalClinicEmail,
        subject: `New Booking Request: ${customerName} — ${formattedTime}`,
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
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? customerEmail : TEST_EMAIL;
  const formattedTime = startTime.toLocaleString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const receiptRef = bookingId ? `BMS-${bookingId}` : '—';
  const calLink = makeGoogleCalLink(`Appointment at ${clinicName}`, startTime, clinicAddress);
  const mapsLink = (lat != null && lng != null)
    ? `https://maps.google.com/?q=${lat},${lng}`
    : clinicAddress ? `https://maps.google.com/?q=${encodeURIComponent(clinicAddress)}` : null;

  const detailRows = [
    { label: 'Date &amp; Time', value: formattedTime },
    { label: 'Clinic', value: clinicName },
    ...(doctorName ? [{ label: 'Doctor', value: doctorName }] : []),
    { label: 'Reference', value: receiptRef, mono: true },
  ];

  const contactRows = [
    ...(clinicPhone ? [{ label: 'Phone', value: clinicPhone }] : []),
    ...(clinicAddress ? [{ label: 'Address', value: mapsLink ? `<a href="${mapsLink}" style="color:#3e34b4;text-decoration:none">${clinicAddress} ↗</a>` : clinicAddress }] : []),
    ...(clinicEmail ? [{ label: 'Email', value: clinicEmail }] : []),
  ];

  const contactSection = contactRows.length > 0
    ? `<tr><td style="padding:0 32px 24px">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ff;border-radius:10px;overflow:hidden;border:1px solid #e5e3fa">
          <tr style="background:#6357dc"><td colspan="2" style="padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.85)">Clinic Contact</td></tr>
          ${contactRows.map((r, i) => `<tr style="${i < contactRows.length - 1 ? 'border-bottom:1px solid #e5e3fa' : ''}"><td style="padding:9px 14px;color:#6b6f8c;font-size:13px;width:130px">${r.label}</td><td style="padding:9px 14px;font-size:13px;color:#1e1c3c">${r.value}</td></tr>`).join('')}
        </table>
      </td></tr>`
    : '';

  const html = emailShell(
    'linear-gradient(90deg,#3e34b4 0%,#a83cd2 100%)',
    'Appointment Confirmed ✓',
    `Your booking at <strong>${clinicName}</strong> has been confirmed.`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi <strong>${customerName}</strong>,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        Great news — your appointment has been confirmed. Find the details below and please arrive a few minutes early.
      </p>
      ${detailsTable(detailRows)}
    </td></tr>
    <tr><td style="padding:20px 32px">
      ${actionButton('Add to Google Calendar', calLink)}
      ${mapsLink ? `&nbsp;&nbsp;${actionButton('Get Directions ↗', mapsLink, '#6357dc')}` : ''}
    </td></tr>
    ${contactSection}`
  );

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Appointment Confirmed at ${clinicName} — ${formattedTime}`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send confirmation email:', error);
  }
}

async function sendCancellationEmail(email: string, name: string, date: Date, clinic: string) {
  if (!resend) return;
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? email : TEST_EMAIL;
  const formattedTime = date.toLocaleString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const html = emailShell(
    'linear-gradient(90deg,#7c3aed 0%,#c026d3 100%)',
    'Appointment Cancelled',
    `Your booking at <strong>${clinic}</strong> has been cancelled.`,
    `<tr><td style="padding:24px 32px 32px">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi <strong>${name}</strong>,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        Your appointment has been cancelled. If this was unexpected, please contact the clinic directly to rebook.
      </p>
      ${detailsTable([
        { label: 'Clinic', value: clinic },
        { label: 'Date &amp; Time', value: formattedTime },
      ])}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Appointment Cancelled at ${clinic}`,
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
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? doctorEmail : TEST_EMAIL;
  const formattedTime = startTime.toLocaleString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const html = emailShell(
    'linear-gradient(90deg,#1e1c3c 0%,#3e34b4 100%)',
    'New Appointment — Action Required',
    `You have been assigned a patient at <strong>${clinicName}</strong>.`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi <strong>${doctorName}</strong>,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        A new appointment has been assigned to you and is <strong>awaiting your approval</strong>. Please log in to your Doctor Portal to accept or decline.
      </p>
      ${detailsTable([
        { label: 'Patient', value: patientName },
        { label: 'Clinic', value: clinicName },
        { label: 'Date &amp; Time', value: formattedTime },
        { label: 'Reference', value: `BMS-${bookingId}`, mono: true },
      ])}
    </td></tr>
    <tr><td style="padding:20px 32px 28px">
      ${actionButton('View in Doctor Portal →', '#')}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Action Required: New appointment assigned to you at ${clinicName}`,
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
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? doctorEmail : TEST_EMAIL;
  const formattedTime = startTime.toLocaleString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const calLink = makeGoogleCalLink(`Patient: ${patientName} at ${clinicName}`, startTime);
  const html = emailShell(
    'linear-gradient(90deg,#b45309 0%,#d97706 100%)',
    'Appointment Confirmed by Admin',
    `The clinic admin confirmed a booking on your behalf at <strong>${clinicName}</strong>.`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi <strong>${doctorName}</strong>,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        The clinic admin confirmed the appointment below on your behalf without waiting for your approval. This appointment is now active on your schedule.
      </p>
      ${detailsTable([
        { label: 'Patient', value: patientName },
        { label: 'Clinic', value: clinicName },
        { label: 'Date &amp; Time', value: formattedTime },
        { label: 'Reference', value: `BMS-${bookingId}`, mono: true },
      ])}
    </td></tr>
    <tr><td style="padding:20px 32px 28px">
      ${actionButton('Add to Google Calendar', calLink, '#b45309')}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `FYI: Clinic admin confirmed an appointment on your behalf at ${clinicName}`,
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
  const formattedTime = startTime.toLocaleString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const html = emailShell(
    'linear-gradient(90deg,#991b1b 0%,#b45309 100%)',
    'Doctor Declined — Action Needed',
    `A doctor has declined an assignment at <strong>${clinicName}</strong>.`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        <strong>${doctorName}</strong> has declined the appointment below. Please log in to your Clinic Portal to reassign a doctor or take further action before the patient's slot time.
      </p>
      ${detailsTable([
        { label: 'Patient', value: patientName },
        { label: 'Doctor', value: doctorName },
        { label: 'Date &amp; Time', value: formattedTime },
        { label: 'Reference', value: `BMS-${bookingId}`, mono: true },
      ])}
    </td></tr>
    <tr><td style="padding:20px 32px 28px">
      ${actionButton('Manage in Clinic Portal →', '#', '#991b1b')}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `⚠ Doctor Declined: ${patientName}'s appointment at ${clinicName} — action needed`,
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
    'linear-gradient(90deg,#3e34b4 0%,#a83cd2 100%)',
    "You've Been Invited",
    `<strong>${clinicName}</strong> has added you as a doctor on BookMySlot.`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi there,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        You have been invited to join <strong>${clinicName}</strong> on BookMySlot. Click the button below to set up your Doctor Portal account and start managing your appointments.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ff;border-radius:10px;border:1px solid #e5e3fa">
        <tr><td style="padding:14px 16px;font-size:13px;color:#6b6f8c">
          This invitation link will expire. If you did not expect this email, you can safely ignore it.
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 32px 28px">
      ${actionButton('Set Up My Account →', inviteLink)}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `You've been invited to join ${clinicName} on BookMySlot`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send doctor invite email:', error);
  }
}

async function sendDoctorWelcomeEmail(email: string, doctorName: string, clinicName: string, tempPassword: string) {
  const loginUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/clinic-login`
    : `https://${process.env.REPLIT_DEV_DOMAIN || 'bookmyslot.dental'}/clinic-login`;
  if (!resend) {
    console.log(`[EMAIL MOCK] Doctor welcome: ${email} — Login: ${email}, Password: ${tempPassword}`);
    return;
  }
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? email : TEST_EMAIL;
  const html = emailShell(
    'linear-gradient(90deg,#059669 0%,#10b981 100%)',
    'Welcome to BookMySlot',
    `You've been added as a doctor at <strong>${clinicName}</strong>`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi Dr. ${doctorName},</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        You've been added to <strong>${clinicName}</strong> on BookMySlot. Use the credentials below to sign in to your Doctor Portal.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;margin-bottom:20px">
        <tr style="border-bottom:1px solid #bbf7d0">
          <td style="padding:10px 16px;font-size:13px;color:#6b6f8c;width:150px">Login ID (Email)</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#1e1c3c;font-family:monospace">${email}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b6f8c">Temporary Password</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:800;color:#059669;font-family:monospace;letter-spacing:1px">${tempPassword}</td>
        </tr>
      </table>
      <p style="margin:0 0 20px;font-size:13px;color:#9090aa;line-height:1.6">
        ⚠&nbsp; Please change your password after your first login for security.
      </p>
    </td></tr>
    <tr><td style="padding:0 32px 28px">
      ${actionButton('Sign In to Doctor Portal →', loginUrl, '#059669')}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Welcome to ${clinicName} — Your Doctor Portal credentials`,
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
  const fmtOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const formattedOld = oldTime.toLocaleString('en-IN', fmtOpts);
  const formattedNew = newTime.toLocaleString('en-IN', fmtOpts);
  const receiptRef = bookingId ? `BMS-${bookingId}` : '—';
  const calLink = makeGoogleCalLink(`Appointment at ${clinicName}`, newTime);
  const html = emailShell(
    'linear-gradient(90deg,#085041 0%,#0F9B6E 100%)',
    'Appointment Rescheduled',
    `Your appointment at <strong>${clinicName}</strong> has been moved to a new time.`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi <strong>${customerName}</strong>,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        Your appointment has been rescheduled by the clinic. Please see the updated details below. If this does not suit you, please contact the clinic directly.
      </p>
      ${detailsTable([
        { label: 'Previous Time', value: formattedOld },
        { label: 'New Time', value: `<strong style="color:#085041">${formattedNew}</strong>` },
        { label: 'Clinic', value: clinicName },
        ...(clinicPhone ? [{ label: 'Clinic Phone', value: clinicPhone }] : []),
        { label: 'Reference', value: receiptRef, mono: true },
      ])}
    </td></tr>
    <tr><td style="padding:20px 32px 28px">
      ${actionButton('Add to Google Calendar', calLink, '#0F9B6E')}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Your Appointment Has Been Rescheduled — ${clinicName}`,
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
  const loginUrl = `${process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'}/clinic-login`;
  const activationSection = activationUrl ? `
    <tr><td style="padding:0 32px 8px">
      <div style="background:linear-gradient(135deg,#3e34b4 0%,#1ab97c 100%);border-radius:12px;padding:20px 24px;text-align:center">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.75)">Next Step</p>
        <p style="margin:0 0 14px;font-size:16px;font-weight:800;color:#fff">Activate Your Subscription${planLabel ? ` — ${planLabel}` : ''}</p>
        <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.85);line-height:1.5">Complete your payment to unlock all dashboard features. Your activation link expires in 7 days.</p>
        ${actionButton('Activate Now & Pay →', activationUrl, '#ffffff').replace('color:#fff', 'color:#3e34b4')}
      </div>
    </td></tr>` : '';
  const html = emailShell(
    'linear-gradient(90deg,#3e34b4 0%,#1ab97c 100%)',
    '🎉 Your Clinic is Approved!',
    `Welcome to BookMySlot, <strong>${clinicName}</strong>`,
    `<tr><td style="padding:28px 32px 16px">
      <p style="margin:0 0 12px;font-size:14px;color:#4a4a6a;line-height:1.6">
        Congratulations! Your clinic registration has been reviewed and approved by our team.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#4a4a6a;line-height:1.6">
        Here are your login credentials. We recommend changing your password after your first login.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ff;border-radius:12px;overflow:hidden;border:1px solid #e5e3fa;margin-bottom:20px">
        <tr style="background:#3e34b4">
          <td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.85)">Your Login Credentials</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e3fa">
          <td style="padding:12px 16px;color:#6b6f8c;font-size:13px;width:130px">Username</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#3e34b4;font-family:monospace">${username}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b6f8c;font-size:13px">Password</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#3e34b4;font-family:monospace">${plainPassword}</td>
        </tr>
      </table>
      <p style="margin:0 0 4px;font-size:12px;color:#9090aa;">Keep this email safe. Do not share your credentials with anyone.</p>
    </td></tr>
    ${activationSection}
    <tr><td style="padding:8px 32px 28px">
      ${actionButton('Go to Clinic Dashboard →', loginUrl, '#1ab97c')}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Your clinic "${clinicName}" has been approved on BookMySlot`,
      html,
    });
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send clinic approval email:', error);
  }
}

async function sendPasswordResetEmail(toEmail: string, resetUrl: string, userType: "clinic" | "doctor") {
  const label = userType === "clinic" ? "Clinic Account" : "Doctor Account";
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? toEmail : TEST_EMAIL;
  if (!resend) {
    console.log(`[EMAIL MOCK] Password reset for ${toEmail}: ${resetUrl}`);
    return;
  }
  const html = emailShell(
    'linear-gradient(90deg,#3e34b4 0%,#1ab97c 100%)',
    '🔐 Reset Your Password',
    `Password reset request for your <strong>${label}</strong>`,
    `<tr><td style="padding:28px 32px 8px">
      <p style="margin:0 0 12px;font-size:14px;color:#4a4a6a;line-height:1.6">
        We received a request to reset the password for your BookMySlot ${label}.
        Click the button below to choose a new password.
      </p>
      <p style="margin:0 0 20px;font-size:13px;color:#9090aa;line-height:1.5">
        This link expires in <strong>30 minutes</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.
      </p>
    </td></tr>
    <tr><td style="padding:0 32px 28px">
      ${actionButton('Reset My Password →', resetUrl, '#3e34b4')}
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Reset your BookMySlot ${label} password`,
      html,
    });
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send password reset email:', err);
  }
}

async function sendPasswordChangedEmail(toEmail: string, userType: "clinic" | "doctor") {
  const label = userType === "clinic" ? "Clinic Account" : "Doctor Account";
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? toEmail : TEST_EMAIL;
  if (!resend) {
    console.log(`[EMAIL MOCK] Password changed confirmation for ${toEmail}`);
    return;
  }
  const html = emailShell(
    'linear-gradient(90deg,#1ab97c 0%,#3e34b4 100%)',
    '✅ Password Changed',
    `Your <strong>${label}</strong> password was updated`,
    `<tr><td style="padding:28px 32px 28px">
      <p style="margin:0 0 12px;font-size:14px;color:#4a4a6a;line-height:1.6">
        Your BookMySlot ${label} password was successfully changed.
      </p>
      <p style="margin:0;font-size:13px;color:#9090aa;line-height:1.5">
        If you did not make this change, please contact support immediately at
        <a href="mailto:support@bookmyslot.in" style="color:#3e34b4;">support@bookmyslot.in</a>.
      </p>
    </td></tr>`
  );
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Your BookMySlot ${label} password was changed`,
      html,
    });
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send password changed email:', err);
  }
}

// In-memory admin OTP store — single admin, one active OTP at a time
let adminOtpStore: { otp: string; expiresAt: number } | null = null;

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
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

      const adminHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f7;padding:32px 24px;border-radius:12px">
          <div style="background:linear-gradient(135deg,#085041,#0F9B6E);border-radius:10px;padding:24px 28px;margin-bottom:24px">
            <div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">BookMySlot — Supplier Marketplace</div>
            <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-.01em">New Listing Request</div>
          </div>
          <table style="width:100%;border-collapse:collapse">
            ${[
              ['Company / Brand', companyName],
              ['Business Email', `${normalizedEmail} <span style="color:#0F9B6E;font-weight:700;font-size:11px">✓ Verified</span>`],
              ['Phone', phone],
              ['Category', category],
              ...(description ? [['Description', description]] : []),
              ...(website ? [['Website', `<a href="${website}" style="color:#0F9B6E">${website}</a>`]] : []),
              ['Submitted At', submittedAt],
            ].map(([label, value]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:13px;font-weight:600;width:38%;vertical-align:top">${label}</td>
                <td style="padding:10px 0;border-bottom:1px solid #eee;color:#111;font-size:14px;vertical-align:top">${value}</td>
              </tr>`).join('')}
          </table>
          <div style="margin-top:24px;padding:14px 18px;background:#E1F5EE;border-radius:8px;border-left:3px solid #0F9B6E;font-size:13px;color:#085041">
            Log in to the admin panel to approve, create a deal, or contact this supplier.
          </div>
        </div>`;

      const supplierHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f7;padding:32px 24px;border-radius:12px">
          <div style="background:linear-gradient(135deg,#085041,#0F9B6E);border-radius:10px;padding:24px 28px;margin-bottom:24px">
            <div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">BookMySlot Dental Marketplace</div>
            <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-.01em">We've received your request!</div>
          </div>
          <p style="font-size:15px;color:#333;line-height:1.7">Hi <strong>${companyName}</strong>,</p>
          <p style="font-size:14px;color:#555;line-height:1.7">Thank you for applying to list on <strong>BookMySlot Smile Deals</strong>. Our team will review your request and get back to you within <strong>2 working days</strong>.</p>
          <div style="background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:20px 24px;margin:20px 0">
            <div style="font-size:12px;font-weight:700;color:#0F9B6E;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Your submission details</div>
            ${[
              ['Company', companyName],
              ['Category', category],
              ...(website ? [['Website', website]] : []),
            ].map(([l, v]) => `<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px"><span style="color:#888;min-width:90px">${l}</span><span style="color:#111;font-weight:600">${v}</span></div>`).join('')}
          </div>
          <p style="font-size:13px;color:#888;line-height:1.6">If you have questions in the meantime, reply to this email or write to <a href="mailto:hello@bookmyslot.in" style="color:#0F9B6E">hello@bookmyslot.in</a>.</p>
        </div>`;

      if (resend) {
        await Promise.allSettled([
          resend.emails.send({ from: EMAIL_FROM, to: finalAdminEmail, subject: `New Supplier Listing Request — ${companyName}`, html: adminHtml }),
          resend.emails.send({ from: EMAIL_FROM, to: finalSupplierEmail, subject: "We received your listing request — BookMySlot", html: supplierHtml }),
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
      const { customerName, customerPhone, customerEmail, clinicId, clinicName, startTime, endTime, description, verifiedToken } = req.body;

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
            subject: `BookMySlot Admin — Your Login OTP`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
                <div style="text-align:center;margin-bottom:24px;">
                  <div style="display:inline-block;background:#0F9B6E;border-radius:10px;padding:10px 16px;">
                    <span style="color:#fff;font-size:15px;font-weight:700;letter-spacing:.04em;">bookMySlot</span>
                  </div>
                </div>
                <h2 style="font-size:20px;font-weight:700;color:#0A1F16;margin:0 0 8px;">Admin Login Verification</h2>
                <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">Use the code below to complete your login. It expires in <strong>10 minutes</strong>.</p>
                <div style="background:#fff;border:2px solid #0F9B6E;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
                  <div style="font-size:38px;font-weight:800;letter-spacing:10px;color:#0F9B6E;">${otp}</div>
                </div>
                <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">If you did not request this, your password may be compromised. Please change it immediately.</p>
              </div>`,
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

  app.post("/api/auth/clinic/slots/configure", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const { startTime, maxBookings, isCancelled } = req.body;
    if (!startTime) return res.status(400).json({ message: "startTime is required" });
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      const start = new Date(startTime);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const slot = await storage.createSlot({
        ownerId: null,
        startTime: start,
        endTime: end,
        clinicName: clinic.name,
        clinicId: clinic.id,
        isBooked: false,
        maxBookings: maxBookings ?? 3,
        isCancelled: isCancelled ?? false,
      } as any);
      res.status(201).json(slot);
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
      }

      res.json(updated);
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

      // Notify doctor by email that they have a new appointment awaiting their approval
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

      // Notify clinic admin that the doctor has declined (fire-and-forget)
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
      const { passwordHash, ...safeDoctor } = d;
      res.json({ doctor: safeDoctor, certifications: certs, cases });
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

  return createServer(app);
}
