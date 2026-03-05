import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { api, errorSchemas } from "@shared/routes";
import { insertClinicSchema, insertBookingSchema, clinics, slots, bookings, notifications, doctorInvites, doctors, clinicDoctors, siteSettings, smileDeals } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from 'resend';
import crypto from "crypto";
import { generateSignedUploadUrl } from "./signedUrl.service";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'BookMySlot <onboarding@resend.dev>';
const RESEND_MODE = (process.env.RESEND || 'DEV').toUpperCase();
const TEST_EMAIL = 'itsmyfavoriteworkplace@gmail.com';

async function sendBookingEmails(customerEmail: string, customerName: string, clinicEmail: string | null, clinicName: string, startTime: Date) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured.`);
    return;
  }
  const finalCustomerEmail = RESEND_MODE === 'PRODUCTION' ? customerEmail : TEST_EMAIL;
  const finalClinicEmail = RESEND_MODE === 'PRODUCTION' ? clinicEmail : TEST_EMAIL;
  const formattedTime = startTime.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalCustomerEmail,
      subject: `Booking Confirmed at ${clinicName}`,
      html: `<p>Booking confirmed for ${customerName} at ${clinicName} on ${formattedTime}</p>`
    });
    if (finalClinicEmail) {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: finalClinicEmail,
        subject: `New Booking: ${customerName}`,
        html: `<p>New booking for ${customerName} at ${formattedTime}</p>`
      });
    }
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send booking emails:', error);
  }
}

async function sendCancellationEmail(email: string, name: string, date: Date, clinic: string) {
  if (!resend) return;
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? email : TEST_EMAIL;
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: 'Appointment Cancellation - BookMySlot',
      html: `<p>Appointment at ${clinic} on ${date.toLocaleString()} has been cancelled.</p>`
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

async function sendDoctorInviteEmail(email: string, clinicName: string, inviteLink: string) {
  if (!resend) return;
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? email : TEST_EMAIL;
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: `Invitation to join ${clinicName} on BookMySlot`,
      html: `<p>Join ${clinicName}: <a href="${inviteLink}">Setup Account</a></p>`
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
      const result = await generateSignedUploadUrl(req.body);
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
      res.json(clinicsList.map(({ id, name, address, username }) => ({ id, name, address, username })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch clinics" });
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

  app.post("/api/admin/smile-deals", isAdmin, async (req, res) => {
    try {
      const dealData = {
        ...req.body,
        price: req.body.price || null
      };
      const deal = await storage.createSmileDeal(dealData);
      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create deal", error: err.message });
    }
  });

  app.patch("/api/admin/smile-deals/:id", isAdmin, async (req, res) => {
    try {
      const deal = await storage.updateSmileDeal(Number(req.params.id), req.body);
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
      req.session.save(() => res.json({ message: "Login successful", user: { email, role: 'superuser' } }));
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

  app.get("/api/auth/me", isAuthenticated, (req, res) => res.json((req as any).user));

  app.get("/api/auth/clinic/bookings", isAuthenticated, async (req, res) => {
    const sess = req.session as any;
    if (sess.role === 'doctor') {
      const email = sess.doctorEmail;
      const results = await db.select({ booking: bookings, slot: slots, clinic: clinics })
        .from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id)).leftJoin(clinics, eq(slots.clinicId, clinics.id))
        .where(sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${clinics.doctors}) AS doc WHERE (doc->>'email')::text = ${email})`);
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
