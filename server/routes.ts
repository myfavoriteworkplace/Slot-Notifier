import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq, and } from "drizzle-orm";
import { api, errorSchemas } from "@shared/routes";
import { insertClinicSchema, insertBookingSchema, clinics, slots, bookings, notifications, doctorInvites, doctors, clinicDoctors, siteSettings, smileDeals } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from 'resend';
import crypto from "crypto";
import { generateSignedUploadUrl } from "./signedUrl.service";
import ExcelJS from "exceljs";
import { sendWhatsAppBookingNotification, sendWhatsAppConfirmationNotification } from "./twilio.service";
import Razorpay from "razorpay";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'BookMySlot <onboarding@resend.dev>';
const RESEND_MODE = (process.env.RESEND || 'DEV').toUpperCase();
const TEST_EMAIL = 'itsmyfavoriteworkplace@gmail.com';

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

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

async function sendBookingEmails(customerEmail: string, customerName: string, clinicEmail: string | null, clinicName: string, startTime: Date) {
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

  const patientHtml = emailShell(
    'linear-gradient(90deg,#3e34b4 0%,#a83cd2 100%)',
    'Booking Received ✓',
    `Your request has been sent to <strong>${clinicName}</strong>.`,
    `<tr><td style="padding:24px 32px 0">
      <p style="margin:0;font-size:15px;color:#1e1c3c">Hi <strong>${customerName}</strong>,</p>
      <p style="margin:10px 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        Thanks for booking with us! Your appointment request is now <strong>pending clinic confirmation</strong>. You will receive another email as soon as the clinic approves it.
      </p>
      ${detailsTable([
        { label: 'Clinic', value: clinicName },
        { label: 'Date &amp; Time', value: formattedTime },
      ])}
    </td></tr>
    <tr><td style="padding:20px 32px 28px">
      ${actionButton('Add to Google Calendar', calLink)}
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">The calendar invite is a placeholder — it will update once confirmed.</p>
    </td></tr>`
  );

  const clinicHtml = emailShell(
    'linear-gradient(90deg,#1e1c3c 0%,#3e34b4 100%)',
    'New Booking Request',
    `A patient has requested an appointment at <strong>${clinicName}</strong>.`,
    `<tr><td style="padding:24px 32px 20px">
      <p style="margin:0 0 20px;font-size:14px;color:#6b6f8c;line-height:1.6">
        A new appointment request is waiting for your review. Log in to your Clinic Portal to confirm or manage this booking.
      </p>
      ${detailsTable([
        { label: 'Patient', value: customerName },
        { label: 'Date &amp; Time', value: formattedTime },
      ])}
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
  const mapsLink = clinicAddress ? `https://maps.google.com/?q=${encodeURIComponent(clinicAddress)}` : null;

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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const isAdmin = (req: any, res: any, next: any) => {
    const sess = req.session as any;
    if (sess && sess.adminLoggedIn && sess.role === 'superuser') return next();
    res.status(403).json({ message: "Admin access required" });
  };

  app.post("/api/clinics/register", async (req, res) => {
    try {
      const passwordHash = await bcrypt.hash(req.body.passwordHash, 10);
      const clinic = await storage.createClinic({ ...req.body, status: "pending", isArchived: false, passwordHash } as any);
      res.status(201).json(clinic);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/clinics/:id/approve", isAuthenticated, async (req, res) => {
    if ((req as any).user.role !== 'superuser') return res.status(403).json({ message: "Only superusers can approve clinics" });
    try {
      const clinic = await storage.updateClinic(parseInt(req.params.id), { status: "approved" });
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
      const defaultPasswordHash = await bcrypt.hash("demo123", 10);
      let doctor = await storage.getDoctorByEmail(email);
      if (!doctor) {
        doctor = await storage.createDoctor({ name, email, passwordHash: defaultPasswordHash, specialization: specialization || null, degree: degree || null, imageUrl: null });
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

  // ── RAZORPAY: create order (₹1 token) ─────────────────────────────────────
  app.post("/api/public/razorpay/create-order", async (req, res) => {
    try {
      if (!razorpay) return res.status(503).json({ message: "Razorpay not configured" });
      const { clinicId, startTime } = req.body;
      if (!clinicId || !startTime) return res.status(400).json({ message: "Missing clinicId or startTime" });

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
        clinicId, clinicName, startTime, endTime, description,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: "Missing payment verification fields" });
      }
      if (!customerName || !customerPhone || !customerEmail || !clinicId || !startTime || !endTime) {
        return res.status(400).json({ message: "Missing booking fields" });
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
        verificationStatus: 'confirmed',
        paymentStatus: 'paid',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      });

      await sendBookingEmails(customerEmail, customerName, clinic.email, clinic.name, requestedStart);

      if (customerPhone) {
        await sendWhatsAppBookingNotification(customerPhone, customerName, clinic.name, requestedStart);
      }

      res.status(201).json({ message: "Payment verified and booking confirmed!", booking: { ...booking, slot } });
    } catch (err: any) {
      console.error('[RAZORPAY VERIFY ERROR]', err.message);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // ── PUBLIC BOOKING: clinic-approval path (pending) ─────────────────────────
  app.post("/api/public/bookings", async (req, res) => {
    try {
      const { customerName, customerPhone, customerEmail, clinicId, clinicName, startTime, endTime, description } = req.body;

      if (!customerName || !customerPhone || !customerEmail || !clinicId || !startTime || !endTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
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
        verificationStatus: 'pending',
      });

      await sendBookingEmails(customerEmail, customerName, clinic.email, clinic.name, requestedStart);

      if (customerPhone) {
        await sendWhatsAppBookingNotification(customerPhone, customerName, clinic.name, requestedStart);
      }

      res.status(201).json({ message: "Booking request submitted!", booking: { ...booking, slot } });
    } catch (err: any) {
      console.error('[PUBLIC BOOKING ERROR]', err.message);
      res.status(500).json({ message: "Failed to create booking" });
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
    try {
      const deals = await storage.getSmileDeals(onlyActive);
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

  app.post("/api/auth/clinic/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const clinic = await storage.getClinicByUsername(username);
      if (!clinic || clinic.isArchived) return res.status(401).json({ message: "Invalid credentials" });
      const isMatch = await bcrypt.compare(password, clinic.passwordHash || "");
      if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
      const sess = req.session as any;
      sess.adminLoggedIn = true;
      sess.clinicId = clinic.id;
      sess.role = 'owner';
      req.session.save(() => res.json({ message: "Login successful", user: { id: clinic.id, name: clinic.name, role: 'owner' } }));
    } catch (error: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/admin/login", async (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const sess = req.session as any;
      sess.adminLoggedIn = true;
      sess.role = 'superuser';
      sess.adminEmail = email;
      req.session.save(() => res.json({ message: "Login successful", user: { email, role: 'superuser', firstName: 'Super', lastName: 'Admin' } }));
      return;
    }
    res.status(401).json({ message: "Invalid credentials" });
  });

  app.post("/api/auth/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid', { path: '/' });
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    const sess = req.session as any;
    if (sess.adminLoggedIn && sess.role === 'superuser') {
      res.json({ email: sess.adminEmail || process.env.ADMIN_EMAIL, role: 'superuser', firstName: 'Super', lastName: 'Admin' });
    } else if (sess.adminLoggedIn && sess.clinicId && sess.role === 'owner') {
      // Clinic owner login
      res.status(401).json({ message: "Not authenticated as superuser" });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.get("/api/auth/me", isAuthenticated, (req, res) => res.json((req as any).user));

  app.get("/api/auth/clinic/me", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    try {
      const clinic = await storage.getClinic(sess.clinicId);
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      res.json(clinic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/auth/clinic/me", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (!sess.clinicId) return res.status(403).json({ message: "Not a clinic admin session" });
    const ALLOWED_FIELDS = ["phone", "email", "website", "address", "city", "pincode", "doctorName", "logoUrl"];
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
        const defaultPasswordHash = await bcrypt.hash("demo123", 10);
        let doctorRecord = await storage.getDoctorByEmail(email);
        if (!doctorRecord) {
          doctorRecord = await storage.createDoctor({ name, email, passwordHash: defaultPasswordHash, specialization: specialization || null, degree: degree || null, imageUrl: imageUrl || null });
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
    try {
      const doctor = await storage.getDoctorByEmail(email);
      if (!doctor) return res.status(401).json({ message: "Invalid credentials" });
      const isMatch = await bcrypt.compare(password, doctor.passwordHash || "");
      if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
      const clinicResults = await db.select({ clinic: clinics })
        .from(clinics)
        .innerJoin(clinicDoctors, eq(clinics.id, clinicDoctors.clinicId))
        .where(eq(clinicDoctors.doctorId, doctor.id));
      if (!clinicResults.length) return res.status(403).json({ message: "Doctor is not linked to any clinic" });
      const clinic = clinicResults[0].clinic;
      const isDefaultPassword = await bcrypt.compare("demo123", doctor.passwordHash || "");
      const sess = req.session as any;
      sess.doctorLoggedIn = true;
      sess.role = 'doctor';
      sess.doctorEmail = doctor.email;
      sess.doctorId = doctor.id;
      req.session.save(() => res.json({
        email: doctor.email,
        name: doctor.name,
        specialization: doctor.specialization,
        clinicId: clinic.id,
        clinicName: clinic.name,
        logoUrl: clinic.logoUrl ?? null,
        isDefaultPassword,
      }));
    } catch (error: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/doctor/me", async (req, res) => {
    const sess = req.session as any;
    if (!sess.doctorLoggedIn || sess.role !== 'doctor' || !sess.doctorEmail) {
      return res.status(401).json({ message: "Not authenticated as doctor" });
    }
    try {
      const doctor = await storage.getDoctorByEmail(sess.doctorEmail);
      if (!doctor) return res.status(401).json({ message: "Doctor not found" });
      const clinicResults = await db.select({ clinic: clinics })
        .from(clinics)
        .innerJoin(clinicDoctors, eq(clinics.id, clinicDoctors.clinicId))
        .where(eq(clinicDoctors.doctorId, doctor.id));
      if (!clinicResults.length) return res.status(403).json({ message: "Doctor is not linked to any clinic" });
      const clinic = clinicResults[0].clinic;
      const isDefaultPassword = await bcrypt.compare("demo123", doctor.passwordHash || "");
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
      return res.json(results.map(r => ({ ...r.booking, slot: r.slot, clinic: r.clinic })));
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
      const updated = await storage.rescheduleBooking(bookingId, newSlotId);
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
      if (booking.customerEmail) {
        sendConfirmationEmail(
          booking.customerEmail,
          booking.customerName,
          clinic?.name || 'the clinic',
          slot ? new Date(slot.startTime) : new Date(),
          booking.assignedDoctor || null,
          (clinic as any)?.phone || null,
          (clinic as any)?.address || null,
          clinic?.email || null,
          bookingId,
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
      if (booking.customerEmail) {
        sendConfirmationEmail(
          booking.customerEmail,
          booking.customerName,
          booking.assignedDoctor || 'your clinic',
          slot ? new Date(slot.startTime) : new Date(),
          booking.assignedDoctor || null,
          null, null, null,
          booking.id,
        ).catch(() => {});
      }
      if (booking.customerPhone) {
        sendWhatsAppConfirmationNotification(
          booking.customerPhone,
          booking.customerName,
          slot?.clinicName || booking.assignedDoctor || 'your clinic',
          slot ? new Date(slot.startTime) : new Date(),
          booking.assignedDoctor || null,
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid clinic ID" });
      const clinic = await storage.getClinic(id);
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

  // ── Public Doctor Profile (no auth) ──
  app.get("/api/public/doctor/:id", async (req, res) => {
    try {
      const d = await storage.getDoctorById(Number(req.params.id));
      if (!d) return res.status(404).json({ message: "Doctor not found" });
      const certs = await storage.getCertificationsByDoctor(d.id);
      const cases = await storage.getCasesByDoctor(d.id);
      const { passwordHash, ...safeDoctor } = d;
      res.json({ doctor: safeDoctor, certifications: certs, cases });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/upload", isAdmin, async (req, res) => {
    try {
      // Since we are using R2 with signed URLs in other parts of the app,
      // and this is a simple "upload" for admin, we'll implement a basic version
      // or redirect to the signed URL flow. 
      // For now, let's just make it return a 400 with instructions or 
      // if the user expects a direct upload, we'd need multer.
      // But looking at the project, we have generateSignedUploadUrl.
      res.status(400).json({ message: "Use /api/uploads/signed-url for R2 uploads" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return createServer(app);
}
