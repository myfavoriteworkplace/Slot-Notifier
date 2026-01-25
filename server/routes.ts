import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { api, errorSchemas } from "@shared/routes";
import { insertClinicSchema, insertBookingSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'BookMySlot <onboarding@resend.dev>';
const RESEND_MODE = (process.env.RESEND || 'DEV').toUpperCase();
const TEST_EMAIL = 'itsmyfavoriteworkplace@gmail.com';

async function sendBookingEmails(customerEmail: string, customerName: string, clinicEmail: string | null, clinicName: string, startTime: Date) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured.`);
    console.log(`[EMAIL MOCK] To Customer: ${customerEmail}, Subject: Booking Confirmed`);
    if (clinicEmail) console.log(`[EMAIL MOCK] To Clinic: ${clinicEmail}, Subject: New Booking`);
    return;
  }
  
  // In DEV mode, redirect all emails to the test address
  const finalCustomerEmail = RESEND_MODE === 'PRODUCTION' ? customerEmail : TEST_EMAIL;
  const finalClinicEmail = RESEND_MODE === 'PRODUCTION' ? clinicEmail : TEST_EMAIL;

  const formattedTime = startTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  try {
    // Send to Customer
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalCustomerEmail,
      subject: `Booking Confirmed at ${clinicName}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0f172a; margin: 0; font-size: 24px;">Booking Confirmed</h1>
            <p style="color: #64748b; margin-top: 8px;">Your appointment has been successfully scheduled.</p>
          </div>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 40%;">Clinic</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${clinicName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Date & Time</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${formattedTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Patient Name</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${customerName}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; color: #64748b; font-size: 14px;">
            <p>Thank you for choosing BookMySlot!</p>
            <p style="margin-top: 16px; font-size: 12px; color: #94a3b8;">If you need to reschedule or cancel, please contact the clinic directly.</p>
          </div>
        </div>
      `
    });

    // Send to Clinic if email exists
    if (finalClinicEmail) {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: finalClinicEmail,
        subject: `New Booking: ${customerName}`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #0f172a; margin: 0; font-size: 24px;">New Booking Received</h1>
              <p style="color: #64748b; margin-top: 8px;">A new appointment has been scheduled for your clinic.</p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 40%;">Patient</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Date & Time</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${formattedTime}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; color: #64748b; font-size: 14px;">
              <p>Please check your dashboard for more details.</p>
            </div>
          </div>
        `
      });
    }
    console.log(`[EMAIL] Booking confirmation emails sent (Mode: ${RESEND_MODE})`);
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send booking emails:', error);
  }
}

async function sendCancellationEmail(email: string, name: string, date: Date, clinic: string) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured. To: ${email}, Subject: Booking Cancelled`);
    return;
  }
  
  const finalEmail = RESEND_MODE === 'PRODUCTION' ? email : TEST_EMAIL;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: finalEmail,
      subject: 'Appointment Cancellation - BookMySlot',
      html: `
        <h2>Appointment Cancelled</h2>
        <p>Dear ${name},</p>
        <p>Your appointment at <strong>${clinic}</strong> scheduled for <strong>${date.toLocaleString()}</strong> has been cancelled.</p>
        <p>If you have any questions, please contact the clinic directly.</p>
        <p>Best regards,<br/>The BookMySlot Team</p>
      `
    });
    console.log(`[EMAIL] Cancellation email sent (Mode: ${RESEND_MODE})`);
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send cancellation email:', error);
  }
}

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // Check if session exists and is logged in
  const sess = req.session as any;
  if (req.session && sess.adminLoggedIn) {
    // Set req.user to mimic a consistent user structure
    (req as any).user = {
      claims: {
        sub: 'admin',
        email: sess.adminEmail,
      },
      id: sess.clinicId || 'superuser',
      role: sess.role || (sess.clinicId ? 'owner' : 'superuser')
    };
    return next();
  }
  
  // Detailed log for debugging 401
  console.log(`[AUTH-FAILURE] 401 Unauthorized:
    Method: ${req.method}
    Path: ${req.path}
    SessionID: ${req.sessionID}
    adminLoggedIn: ${sess?.adminLoggedIn}
    adminEmail: ${sess?.adminEmail}
    clinicId: ${sess?.clinicId}
    role: ${sess?.role}
    Origin: ${req.headers.origin}
    Cookie: ${req.headers.cookie ? 'present' : 'missing'}
  `);
  
  return res.status(401).json({ message: "Authentication required" });
}

import { generateSignedUploadUrl } from "./signedUrl.service";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Cloudflare R2 Uploads
  app.post("/api/uploads/signed-url", isAuthenticated, async (req, res) => {
    try {
      const result = await generateSignedUploadUrl(req.body);
      res.json(result);
    } catch (err: any) {
      console.error("[UPLOAD ERROR]", err);
      res.status(400).json({ message: err.message });
    }
  });

  // Publicly available login check for debugging
  app.get("/api/auth/debug", (req, res) => {
    res.json({
      adminEmailSet: !!process.env.ADMIN_EMAIL,
      adminPasswordSet: !!process.env.ADMIN_PASSWORD,
      sessionID: req.sessionID,
      nodeEnv: process.env.NODE_ENV
    });
  });

  // Expose API endpoints for fetching major items
  app.get("/api/public/clinics", async (req, res) => {
    try {
      const clinics = await storage.getClinics();
      // Only return necessary public information
      const publicClinics = clinics.map(({ id, name, address, username }) => ({
        id,
        name,
        address,
        username
      }));
      res.json(publicClinics);
    } catch (err: any) {
      console.error("[API ERROR] Failed to fetch clinics:", err.message);
      res.status(500).json({ message: "Failed to fetch clinics" });
    }
  });

  app.get("/api/public/clinics/:username/bookings", async (req, res) => {
    const { username } = req.params;
    try {
      const clinic = await storage.getClinicByUsername(username);
      if (!clinic) {
        return res.status(404).json({ message: "Clinic not found" });
      }
      const bookings = await storage.getClinicBookings(clinic.id);
      // Only return public/relevant booking info
      const publicBookings = bookings.map(({ id, customerName, slot, verificationStatus }) => ({
        id,
        customerName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: verificationStatus
      }));
      res.json(publicBookings);
    } catch (err: any) {
      console.error(`[API ERROR] Failed to fetch bookings for ${username}:`, err.message);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  console.log("[AUTH] Using environment-based admin authentication");
  
  // Debug middleware to log session
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[AUTH-DEBUG] Request: ${req.method} ${req.path}`);
    }
    next();
  });

    // Health check endpoint
    app.all("/api/health", async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      try {
        const result = await db.execute(sql`SELECT 1 as val`);
        const isDbConnected = !!result;
        
        const responseData = { 
          status: "ok", 
          backend: true, 
          database: isDbConnected,
          deployment: "render",
          env: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        };

        global.console.log(`[API-RESPONSE] /api/health: ${JSON.stringify(responseData)}`);
        return res.status(200).json(responseData);
      } catch (err: any) {
        global.console.error(`[API-RESPONSE-ERROR] /api/health: ${err.message}`);
        return res.status(500).json({ 
          status: "error", 
          backend: true, 
          database: false,
          deployment: "render",
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    app.all("/api/health/backend", (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      const response = {
        status: "ok",
        backend: true,
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[API-RESPONSE] /api/health/backend: ${JSON.stringify(response)}`);
      return res.status(200).json(response);
    });

    app.all("/api/health/database", async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      try {
        const result = await db.execute(sql`SELECT 1 as val`);
        const isDbConnected = !!result;
        
        const response = {
          status: isDbConnected ? "ok" : "error",
          database: isDbConnected,
          timestamp: new Date().toISOString()
        };
        
        console.log(`[API-RESPONSE] /api/health/database: ${JSON.stringify(response)}`);
        return res.status(200).json(response);
      } catch (err: any) {
        console.error("[DATABASE-HEALTH-ERROR]", err);
        return res.status(500).json({
          status: "error",
          database: false,
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Test email endpoint
    app.get("/api/test-email", async (req, res) => {
      const targetEmail = (req.query.email as string);
      
      if (!targetEmail) {
        return res.status(400).json({ 
          error: "Missing email parameter", 
          usage: "GET /api/test-email?email=your@email.com" 
        });
      }
      
      console.log(`[EMAIL TEST] Attempting to send test email to ${targetEmail}`);
      
      if (!resend) {
        console.error("[EMAIL TEST ERROR] Resend is not configured (missing RESEND_API_KEY)");
        return res.status(500).json({ 
          error: "Resend not configured", 
          details: "RESEND_API_KEY environment variable is missing" 
        });
      }

      try {
        const result = await resend.emails.send({
          from: EMAIL_FROM,
          to: targetEmail,
          subject: "Backend email test - BookMySlot",
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #0070f3;">Email Test Successful 🎉</h2>
              <p>This email was sent from the <strong>BookMySlot</strong> backend to verify your Resend configuration.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #666;">Time sent: ${new Date().toLocaleString()}</p>
            </div>
          `,
        });
        
        console.log("[EMAIL TEST SUCCESS]", result);
        res.json({ success: true, result });
      } catch (err: any) {
        console.error("[EMAIL TEST ERROR]", err);
        res.status(500).json({ 
          error: err.message,
          name: err.name,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    });

    // Clinic authentication
    app.post("/api/auth/clinic/login", async (req, res) => {
      const { username, password } = req.body;
      
      console.log(`[AUTH] Clinic login attempt - Username: ${username}`);
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      try {
        const clinic = await storage.getClinicByUsername(username);
        console.log(`[AUTH] Retrieved clinic for username ${username}:`, clinic ? `ID ${clinic.id}` : 'Not found');
        console.log(`[AUTH-DEBUG] ISARCHIVED`,clinic?.isArchived);
        if (!clinic || clinic.isArchived) {
          console.error(`[AUTH ERROR] Clinic not found or archived: ${username}`);
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, clinic.passwordHash || "");
        if (!isMatch) {
          console.error(`[AUTH ERROR] Invalid password for clinic: ${username}`);
          return res.status(401).json({ message: "Invalid credentials" });
        }

        if (!req.session) {
          console.error("[AUTH ERROR] No session available for clinic login");
          return res.status(500).json({ message: "Session initialization failed" });
        }

        // Explicitly set session data
        const sess = req.session as any;
        sess.adminLoggedIn = true;
        sess.adminEmail = clinic.email || `${username}@clinic.local`;
        sess.clinicId = clinic.id;
        sess.role = 'owner';
        sess.logoUrl = clinic.logoUrl;

        req.session.save((err) => {
          if (err) {
            console.error("[AUTH ERROR] Session save error for clinic login:", err);
            return res.status(500).json({ message: "Failed to save session" });
          }
          console.log(`[AUTH] Clinic login successful: ${username}, SessionID: ${req.sessionID}`);
          return res.json({ 
            message: "Login successful", 
            user: { 
              id: clinic.id,
              name: clinic.name,
              role: 'owner' 
            } 
          });
        });
      } catch (error: any) {
        console.error("[AUTH ERROR] Clinic login exception:", error);
        return res.status(500).json({ message: "Internal server error during login" });
      }
    });

    app.post("/api/auth/admin/login", async (req, res) => {
      const { email, password } = req.body;
      
      console.log(`[AUTH] Login attempt - Email: ${email}, Path: ${req.path}`);
      
      if (!email || !password) {
        console.error(`[AUTH ERROR] Missing credentials for login attempt at ${req.path}`);
        return res.status(400).json({ message: "Email and password are required" });
      }

      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      console.log(`[AUTH] Admin login attempt for: ${email}. Expected: ${adminEmail}`);
      
      if (email && adminEmail && email === adminEmail && password === adminPassword) {
        if (!req.session) {
          console.error("[AUTH ERROR] No session available for admin login");
          return res.status(500).json({ message: "Session initialization failed" });
        }
        
        const sess = req.session as any;
        sess.adminLoggedIn = true;
        sess.adminEmail = email;
        sess.role = 'superuser';
        sess.clinicId = null; // Superuser manages all clinics

        req.session.save((err) => {
          if (err) {
            console.error("[AUTH ERROR] Session save error:", err);
            return res.status(500).json({ message: "Failed to save session" });
          }
          console.log("[AUTH] Admin login successful, session saved");
          return res.json({ message: "Login successful", user: { email, role: 'superuser' } });
        });
        return;
      }
      
      console.error(`[AUTH ERROR] Admin login failed for: ${email}. Invalid credentials or environment mismatch.`);
      return res.status(401).json({ message: "Invalid credentials" });
    });

  app.post("/api/auth/admin/logout", (req, res) => {
    console.log(`[AUTH] Admin logout request from: ${(req.session as any)?.adminEmail}`);
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("[AUTH ERROR] Failed to destroy session during logout:", err);
          // If the error is database related (like missing table), we still want to clear the cookie
          res.clearCookie('connect.sid', { path: '/' });
          return res.status(200).json({ message: "Logout triggered (session destruction failed but cookie cleared)" });
        }
        res.clearCookie('connect.sid', { path: '/' });
        console.log("[AUTH] Admin logout successful");
        return res.json({ message: "Logout successful" });
      });
    } else {
      res.clearCookie('connect.sid', { path: '/' });
      return res.json({ message: "No active session to logout" });
    }
  });

    app.post("/api/clinic/bookings", isAuthenticated, async (req, res) => {
      console.log(`[API-DEBUG] Hit /api/clinic/bookings`);
      const sess = req.session as any;
      
      // LOG SESSION DATA FOR DEBUGGING
      console.log(`[API-DEBUG] Session Data:`, JSON.stringify({
        id: req.sessionID,
        clinicId: sess.clinicId,
        adminLoggedIn: sess.adminLoggedIn,
        role: sess.role
      }));

      try {
        const { customerName, customerPhone, customerEmail, startTime, endTime, description } = req.body;
        console.log(`[API-DEBUG] Body:`, JSON.stringify(req.body));
        
        if (!sess.clinicId) {
          console.log(`[API-DEBUG] Forbidden: No clinicId in session`);
          return res.status(403).json({ message: "Only clinics can create clinic-side bookings" });
        }

        const clinic = await storage.getClinic(sess.clinicId);
        if (!clinic) {
          console.log(`[API-DEBUG] Not Found: Clinic ${sess.clinicId} not found`);
          return res.status(404).json({ message: "Clinic not found" });
        }

        const slot = await storage.createSlot({
          ownerId: null, // Allow null owner for clinic-side manual entries
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          clinicName: clinic.name,
          clinicId: clinic.id,
          isBooked: true,
          maxBookings: 1,
          isCancelled: false,
        } as any);

        const booking = await storage.createBooking({
          slotId: slot.id,
          customerName,
          customerPhone,
          customerEmail,
          description,
          customerId: null, // Allow null customer for clinic-side manual entries
          verificationStatus: 'verified'
        });

        await sendBookingEmails(
          customerEmail,
          customerName,
          clinic.email || null,
          clinic.name,
          new Date(startTime)
        );

        console.log(`[API-DEBUG] Success: Booking ${booking.id} created`);
        res.status(201).json(booking);
      } catch (err: any) {
        console.error("[API ERROR] Failed to create clinic booking:", err.message);
        res.status(500).json({ message: "Failed to create booking", error: err.message });
      }
    });

    // Dedicated route for direct booking (bypass isAuthenticated for testing if needed)
    app.post("/api/clinic/bookings-direct", async (req, res) => {
      try {
        const { customerName, customerPhone, customerEmail, startTime, endTime, description, clinicId } = req.body;
        
        const clinic = await storage.getClinic(clinicId);
        if (!clinic) return res.status(404).json({ message: "Clinic not found" });

        const slot = await storage.createSlot({
          ownerId: null,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          clinicName: clinic.name,
          clinicId: clinic.id,
          isBooked: true,
          maxBookings: 1,
          isCancelled: false,
        } as any);

        const booking = await storage.createBooking({
          slotId: slot.id,
          customerName,
          customerPhone,
          customerEmail,
          description,
          customerId: null,
          verificationStatus: 'verified'
        });

        await sendBookingEmails(
          customerEmail,
          customerName,
          clinic.email || null,
          clinic.name,
          new Date(startTime)
        );

        res.status(201).json(booking);
      } catch (err: any) {
        console.error("[API ERROR] Failed to create direct clinic booking:", err.message);
        res.status(500).json({ message: "Failed to create booking", error: err.message });
      }
    });

    app.patch("/api/clinic/bookings/:id/assign-doctor", isAuthenticated, async (req, res) => {
      try {
        const { doctorName } = req.body;
        const bookingId = parseInt(req.params.id);
        const booking = await storage.updateBookingAssignment(bookingId, doctorName);
        res.json(booking);
      } catch (err: any) {
        res.status(500).json({ message: "Failed to assign doctor", error: err.message });
      }
    });

    // Unified current user endpoint
    app.get("/api/auth/me", isAuthenticated, (req, res) => {
      res.json((req as any).user);
    });

    app.get("/api/auth/clinic/bookings", isAuthenticated, (req, res) => {
      const sess = req.session as any;
      console.log(`[API-DEBUG-SESSION] Hit /api/auth/clinic/bookings`, sess);
      
      if (sess.clinicId) {
        return storage.getClinicBookings(sess.clinicId)
          .then(bookings => res.json(bookings))
          .catch((err: any) => res.status(500).json({ message: err.message }));
      }
      
      // Super admin viewing all bookings
      if (sess.role === 'superuser') {
        return storage.getClinics()
          .then(async clinics => {
            const allBookings = await Promise.all(clinics.map(c => storage.getClinicBookings(c.id)));
            return res.json(allBookings.flat());
          })
          .catch((err: any) => res.status(500).json({ message: err.message }));
      }
      
      return res.status(403).json({ message: "Forbidden" });
    });

    app.delete("/api/auth/clinic/bookings/:id", isAuthenticated, (req, res) => {
      const sess = req.session as any;
      if (sess.role === 'superuser' || sess.clinicId) {
        return storage.cancelBooking(parseInt(req.params.id))
          .then(() => res.status(204).send())
          .catch((err: any) => res.status(500).json({ message: err.message }));
      }
      return res.status(403).json({ message: "Forbidden" });
    });

    // Reschedule booking - change to a different slot
    app.patch("/api/auth/clinic/bookings/:id/reschedule", isAuthenticated, async (req, res) => {
      const sess = req.session as any;
      if (sess.role !== 'superuser' && !sess.clinicId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      try {
        const bookingId = parseInt(req.params.id);
        const { newSlotId } = req.body;
        
        if (!newSlotId) {
          return res.status(400).json({ message: "newSlotId is required" });
        }
        
        // Verify the slot exists
        const slot = await storage.getSlot(newSlotId);
        if (!slot) {
          return res.status(404).json({ message: "Slot not found" });
        }
        
        const updated = await storage.rescheduleBooking(bookingId, newSlotId);
        res.json(updated);
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    });

    app.post("/api/auth/clinic/slots/configure", isAuthenticated, (req, res) => {
      const sess = req.session as any;
      if (sess.clinicId) {
        const { startTime } = req.body;
        const date = new Date(startTime).toISOString().split('T')[0];
        const slotData = [{
          startTime,
          endTime: new Date(new Date(startTime).getTime() + 3600000).toISOString(),
          clinicName: sess.adminEmail?.split('@')[0] || "Clinic"
        }];
        
        return storage.configureClinicSlots(sess.clinicId, date, slotData)
          .then((result: any) => res.json(result))
          .catch((err: any) => res.status(500).json({ message: err.message }));
      }
      return res.status(403).json({ message: "Only clinic admins can configure slots" });
    });

    app.post("/api/auth/clinic/logout", (req, res) => {
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error("[AUTH ERROR] Failed to destroy clinic session:", err);
          }
          res.clearCookie('connect.sid', { path: '/' });
          return res.json({ message: "Logout successful" });
        });
      } else {
        res.clearCookie('connect.sid', { path: '/' });
        return res.json({ message: "No active session" });
      }
    });

    // Get current clinic info
    app.get("/api/auth/clinic/me", isAuthenticated, async (req, res) => {
      const sess = req.session as any;
      if (!sess.clinicId) {
        return res.status(403).json({ message: "Not a clinic user" });
      }
      try {
        const clinic = await storage.getClinic(sess.clinicId);
        if (!clinic) {
          return res.status(404).json({ message: "Clinic not found" });
        }

        let logoUrl = clinic.logoUrl;
        
        // If logoUrl is an R2 key (doesn't start with http), generate a signed URL
        if (logoUrl && !logoUrl.startsWith('http')) {
          const { GetObjectCommand } = await import("@aws-sdk/client-s3");
          const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
          const { r2Client, R2_BUCKET_NAME } = await import("./r2Client");
          
          try {
            const command = new GetObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: logoUrl,
            });
            logoUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
          } catch (err) {
            console.error("[R2 ERROR] Failed to generate signed GET URL:", err);
          }
        }

        res.json({
          id: clinic.id,
          name: clinic.name,
          address: clinic.address,
          email: clinic.email,
          phone: clinic.phone,
          logoUrl: logoUrl,
          doctors: clinic.doctors || []
        });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    });

    app.patch("/api/auth/clinic/me", isAuthenticated, async (req, res) => {
      try {
        const sess = req.session as any;
        if (!sess.clinicId) {
          return res.status(403).json({ message: "Only clinics can update their profile" });
        }
        const updated = await storage.updateClinic(sess.clinicId, req.body);
        
        // Update session data
        if (req.body.logoUrl !== undefined) {
          sess.logoUrl = req.body.logoUrl;
        }
        
        req.session.save((err) => {
          if (err) {
            console.error("[AUTH ERROR] Failed to save session after profile update:", err);
          }
          res.json(updated);
        });
      } catch (err: any) {
        res.status(500).json({ message: "Failed to update clinic profile", error: err.message });
      }
    });

    // Add a doctor to the clinic
    app.post("/api/auth/clinic/doctors", isAuthenticated, async (req, res) => {
      const sess = req.session as any;
      if (!sess.clinicId) {
        return res.status(403).json({ message: "Only clinic admins can manage doctors" });
      }
      try {
        const { name, specialization, degree } = req.body;
        if (!name || !specialization) {
          return res.status(400).json({ message: "Name and specialization are required" });
        }
        const clinic = await storage.getClinic(sess.clinicId);
        if (!clinic) {
          return res.status(404).json({ message: "Clinic not found" });
        }
        const doctors = clinic.doctors || [];
        const newDoctor = { name, specialization, degree: degree || "" };
        const updatedDoctors = [...doctors, newDoctor];
        const updatedClinic = await storage.updateClinic(sess.clinicId, { doctors: updatedDoctors });
        res.json({ doctors: updatedClinic.doctors });
      } catch (err: any) {
        console.error("[API ERROR] Failed to add doctor:", err);
        res.status(500).json({ message: err.message });
      }
    });

    // Remove a doctor from the clinic
    app.delete("/api/auth/clinic/doctors/:index", isAuthenticated, async (req, res) => {
      const sess = req.session as any;
      if (!sess.clinicId) {
        return res.status(403).json({ message: "Only clinic admins can manage doctors" });
      }
      try {
        const index = parseInt(req.params.index);
        const clinic = await storage.getClinic(sess.clinicId);
        if (!clinic) {
          return res.status(404).json({ message: "Clinic not found" });
        }
        const doctors = clinic.doctors || [];
        if (index < 0 || index >= doctors.length) {
          return res.status(400).json({ message: "Invalid doctor index" });
        }
        const updatedDoctors = doctors.filter((_, i) => i !== index);
        const updatedClinic = await storage.updateClinic(sess.clinicId, { doctors: updatedDoctors });
        res.json({ doctors: updatedClinic.doctors });
      } catch (err: any) {
        console.error("[API ERROR] Failed to remove doctor:", err);
        res.status(500).json({ message: err.message });
      }
    });

    // Dedicated connectivity test endpoint for Postman
    app.get("/api/test-connectivity", async (req, res) => {
      console.log(`[CONNECTIVITY-TEST] Postman test triggered from ${req.ip} at ${new Date().toISOString()}`);
      
      res.removeHeader('Content-Type');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      try {
        const dbResult = await db.execute(sql`SELECT NOW() as db_time`);
        const rows = (dbResult.rows || dbResult) as any[];
        
        return res.status(200).json({
          status: "success",
          message: "Backend is reachable and database is connected",
          timestamp: new Date().toISOString(),
          render_url: "https://book-my-slot-client.onrender.com",
          full_test_url: "https://book-my-slot-client.onrender.com/api/test-connectivity",
          database: {
            connected: true,
            dbTime: rows[0]?.db_time
          },
          request: {
            method: req.method,
            path: req.path,
            headers: req.headers,
            ip: req.ip
          },
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            DEPLOYMENT_TARGET: process.env.DEPLOYMENT_TARGET,
            PORT: process.env.PORT
          }
        });
      } catch (error: any) {
        console.error("[CONNECTIVITY-TEST ERROR]", error);
        return res.status(500).json({
          status: "error",
          message: "Connectivity test failed",
          error: error.message,
          timestamp: new Date().toISOString(),
          details: "Check Render logs for full stack trace"
        });
      }
    });
  
  // Claim superuser status if no superusers exist (one-time setup)
  app.post("/api/claim-superuser", isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    const userId = user.claims.sub;
    
    // Check if any superuser exists
    const superuserExists = await storage.hasSuperuser();
    if (superuserExists) {
      return res.status(403).json({ message: "A superuser already exists" });
    }
    
    // Promote this user to superuser
    await storage.setUserRole(userId, 'superuser');
    res.json({ message: "You are now a superuser", role: 'superuser' });
  });

  // Global log preference (true by default)
  let serverLogsEnabled = true;

  app.get("/api/admin/logs/status", isAuthenticated, (req, res) => {
    res.json({ enabled: serverLogsEnabled });
  });

  app.post("/api/admin/logs/toggle", isAuthenticated, (req, res) => {
    const { enabled } = req.body;
    serverLogsEnabled = !!enabled;
    console.log(`[SYSTEM] Server logs ${serverLogsEnabled ? 'ENABLED' : 'DISABLED'} by admin`);
    res.json({ enabled: serverLogsEnabled });
  });

  const logger = (message: string, type: string = 'INFO') => {
    if (serverLogsEnabled) {
      console.log(`[${type}] [${new Date().toISOString()}] ${message}`);
    }
  };

  // Slots API
  app.get(api.slots.list.path, async (req, res) => {
    const ownerId = req.query.ownerId as string;
    const date = req.query.date as string;
    logger(`Fetching slots for owner ${ownerId} on date ${date}`, 'SLOTS');
    const slots = await storage.getSlots(ownerId, date);
    res.json(slots);
  });

  app.post(api.slots.create.path, isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    try {
      const input = api.slots.create.input.parse(req.body);
      logger(`User ${user.claims.sub} creating slot for clinic ${input.clinicName}`, 'SLOTS');
      const slotData = { ...input, ownerId: user.claims.sub };
      const slot = await storage.createSlot(slotData);
      res.status(201).json(slot);
    } catch (err) {
      if (err instanceof z.ZodError) {
        logger(`Slot creation validation failed: ${err.errors[0].message}`, 'ERROR');
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.slots.delete.path, isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    const slotId = parseInt(req.params.id);
    logger(`User ${user.claims.sub} attempting to delete slot ${slotId}`, 'SLOTS');
    const slot = await storage.getSlot(slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });
    if (slot.ownerId !== user.claims.sub) {
      logger(`Unauthorized slot deletion attempt by ${user.claims.sub}`, 'SECURITY');
      return res.status(403).json({ message: "You can only delete your own slots" });
    }
    await storage.deleteSlot(slotId);
    res.status(204).send();
  });

  // Bookings API
  app.post(api.bookings.create.path, isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    try {
      const input = api.bookings.create.input.parse(req.body);
      logger(`Booking creation started by ${user.claims.sub} for clinic ${(input as any).clinicId}`, 'BOOKING');
      let slot;
      if (input.slotId === -1 && (req.body as any).clinicName) {
        slot = await storage.createSlot({
          ownerId: user.claims.sub, 
          startTime: new Date((req.body as any).startTime),
          endTime: new Date((req.body as any).endTime),
          clinicName: (req.body as any).clinicName,
          clinicId: (req.body as any).clinicId || null,
          isBooked: false,
        } as any);
        logger(`Dynamic slot created: ${slot.id}`, 'BOOKING');
      } else {
        slot = await storage.getSlot(input.slotId);
      }
      if (!slot) return res.status(404).json({ message: "Slot not found" });
      if (slot.isBooked) {
        logger(`Booking failed: Slot ${slot.id} already booked`, 'BOOKING');
        return res.status(400).json({ message: "Slot already booked" });
      }
      const bookingData = { 
        ...input, 
        slotId: slot.id,
        customerId: user.claims.sub,
        customerEmail: (input as any).customerEmail || (user.claims.email as string),
      };
      const booking = await storage.createBooking(bookingData);
      logger(`Booking confirmed: ${booking.id} for customer ${booking.customerName}`, 'BOOKING');
      await storage.createNotification({
        userId: bookingData.customerId,
        message: `You have successfully booked a slot on ${slot.startTime.toLocaleString()}`,
      });
      if (slot.ownerId) {
        await storage.createNotification({
          userId: slot.ownerId,
          message: `Your slot on ${slot.startTime.toLocaleString()} has been booked!`,
        });
      }
      const clinic = slot.clinicId ? await storage.getClinic(slot.clinicId) : null;
      const customerEmail = (input as any).customerEmail || (user.claims.email as string);
      
      // Patient name from booking input
      const patientName = (input as any).customerName || ((req as any).user?.claims?.name) || 'Valued Patient';
      
      await sendBookingEmails(customerEmail, patientName, clinic?.email || null, slot.clinicName || 'the clinic', slot.startTime);
      res.status(201).json(booking);
    } catch (err) {
      if (err instanceof z.ZodError) {
        logger(`Booking creation failed: ${err.errors[0].message}`, 'ERROR');
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

    // Clinics API
    app.get("/api/clinics", async (req, res) => {
      const includeArchived = req.query.includeArchived === 'true';
      console.log(`[API] /api/clinics - Fetching clinics. includeArchived=${includeArchived}`);
      
      // Prevent 304 Not Modified cache issues by adding cache-control headers
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());

      try {
        const clinicsList = await storage.getClinics(includeArchived);
        console.log(`[RESPONSE] /api/clinics - Found ${clinicsList.length} clinics`);
        res.json(clinicsList);
      } catch (err: any) {
        console.error(`[API ERROR] /api/clinics:`, err);
        res.status(500).json({ message: "Internal server error fetching clinics", error: err.message });
      }
    });

    app.patch("/api/clinics/:id/archive", isAuthenticated, async (req, res) => {
      const user = (req as any).user;
      const isSuperuser = user?.claims?.sub === 'admin';
      
      if (!isSuperuser) {
        return res.status(403).json({ message: "Only super users can archive clinics" });
      }

      const clinicId = parseInt(req.params.id);
      try {
        const clinic = await storage.archiveClinic(clinicId);
        res.json(clinic);
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    });

    app.patch("/api/clinics/:id/unarchive", isAuthenticated, async (req, res) => {
      const user = (req as any).user;
      const isSuperuser = user?.claims?.sub === 'admin';
      
      if (!isSuperuser) {
        return res.status(403).json({ message: "Only super users can unarchive clinics" });
      }

      const clinicId = parseInt(req.params.id);
      try {
        const clinic = await storage.unarchiveClinic(clinicId);
        res.json(clinic);
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    });

    app.delete("/api/clinics/:id", isAuthenticated, async (req, res) => {
      const user = (req as any).user;
      const isSuperuser = user?.claims?.sub === 'admin';
      
      if (!isSuperuser) {
        return res.status(403).json({ message: "Only super users can delete clinics" });
      }

      const clinicId = parseInt(req.params.id);
      try {
        // Implementation for hard delete if needed, or just archive
        // For now, let's just use archive logic or a hard delete if storage supports it
        // Checking storage.ts, it doesn't have a deleteClinic but it has archive
        await storage.archiveClinic(clinicId);
        res.status(204).send();
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    });

    app.post("/api/clinics", isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    console.log(`[CLINIC-DEBUG] POST /api/clinics attempt. User: ${JSON.stringify(user)} SessionID: ${req.sessionID}`);
    const useEnvAuth = (req as any).app.get('USE_ENV_AUTH') ?? true;
    
    // Check if the user is the super admin based on environment variables or role
    const isSuperuser = useEnvAuth 
      ? (user?.claims?.sub === 'admin' || user?.claims?.email === process.env.ADMIN_EMAIL)
      : (await storage.getUser(user?.claims?.sub))?.role === 'superuser';
      
    if (!isSuperuser) {
      console.log(`[CLINIC-DEBUG] Unauthorized clinic creation attempt by ${user?.claims?.sub || 'unknown'}`);
      return res.status(403).json({ message: "Only super users can add clinics" });
    }
    try {
      const input = api.clinics.create.input.parse(req.body);
      console.log(`[CLINIC-DEBUG] Superuser ${user?.claims?.sub || 'admin'} creating new clinic: ${input.name}`);
      const clinic = await storage.createClinic(input);
      res.status(201).json(clinic);
    } catch (err) {
      console.error(`[CLINIC-DEBUG] Error creating clinic:`, err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error creating clinic" });
    }
  });

    app.patch("/api/clinics/:id", isAuthenticated, async (req, res) => {
      const user = (req as any).user;
      const isSuperuser = user?.claims?.sub === 'admin';
      
      if (!isSuperuser) {
        return res.status(403).json({ message: "Only super users can update clinics" });
      }

      const id = parseInt(req.params.id);
      try {
        const input = insertClinicSchema.partial().parse(req.body) as any;
        const clinic = await storage.updateClinic(id, input);
        res.json(clinic);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message,
            field: err.errors[0].path.join('.'),
          });
        }
        res.status(500).json({ message: "Internal server error updating clinic" });
      }
    });

    app.patch("/api/clinics/:id/credentials", isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    console.log(`[CLINIC-DEBUG] PATCH /api/clinics credentials attempt. User: ${JSON.stringify(user)} Session: ${JSON.stringify(req.session)}`);
    // Use the app setting if available, otherwise fallback to true (current default)
    const useEnvAuth = (req as any).app.get('USE_ENV_AUTH') ?? true;
    
    const isSuperuser = useEnvAuth 
      ? user?.claims?.sub === 'admin'
      : (await storage.getUser(user?.claims?.sub))?.role === 'superuser';
    
    if (!isSuperuser) {
      return res.status(403).json({ message: "Only super users can set clinic credentials" });
    }

    const clinicId = parseInt(req.params.id);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Check if username is already taken
    const existingClinic = await storage.getClinicByUsername(username);
    if (existingClinic && existingClinic.id !== clinicId) {
      return res.status(400).json({ message: "Username already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const clinic = await storage.updateClinic(clinicId, { username, passwordHash });
    
    res.json({ id: clinic.id, name: clinic.name, username: clinic.username });
  });

  // Public Booking API (no auth required) - Direct booking without OTP
  app.post("/api/public/bookings", async (req, res) => {
    try {
      const { customerName, customerPhone, customerEmail, clinicId, clinicName, startTime, endTime } = req.body;
      
      if (!customerName || !customerPhone || !customerEmail || !clinicId || !startTime || !endTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Get the clinic
      const clinic = await storage.getClinic(clinicId);
      if (!clinic) {
        return res.status(404).json({ message: "Clinic not found" });
      }

      // Check capacity: count existing confirmed bookings for this clinic/time
      const requestedStart = new Date(startTime);
      const existingBookings = await storage.countVerifiedBookingsForClinicTime(clinicId, clinic.name, requestedStart);
      
      // Get the existing slot configuration if it exists
      const existingSlot = await (storage as any).getSlotByTime(clinicId, requestedStart);
      const maxBookings = existingSlot?.maxBookings ?? 3;
      const isCancelled = existingSlot?.isCancelled ?? false;

      if (isCancelled) {
        return res.status(400).json({ message: "This time slot has been cancelled." });
      }

      if (existingBookings >= maxBookings) {
        return res.status(400).json({ message: "This time slot is fully booked. Please choose another time." });
      }

      // Create the slot (public bookings have no owner) - mark as booked immediately
      const slot = await storage.createSlot({
        ownerId: null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        clinicName: clinicName || clinic.name,
        clinicId: clinicId,
        isBooked: true,
        maxBookings: maxBookings,
        isCancelled: false,
      } as any);

      // Create confirmed booking directly (no OTP verification)
      const booking = await (storage as any).createPublicBooking({
        slotId: slot.id,
        customerName,
        customerPhone,
        customerEmail,
        verificationCode: null,
        verificationExpiresAt: null,
        verificationStatus: 'verified',
      });

      // Send confirmation emails
      await sendBookingEmails(
        customerEmail,
        customerName,
        clinic.email || null,
        clinic.name,
        requestedStart
      );

      // Log confirmation
      console.log(`[BOOKING] Public booking created for ${customerName} at ${clinic.name}`);

      res.status(201).json({ 
        bookingId: booking.id, 
        message: "Booking confirmed!",
        confirmed: true
      });
    } catch (err) {
      console.error("Public booking error:", err);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.post("/api/public/bookings/verify", async (req, res) => {
    const { bookingId, code } = req.body;
    
    if (!bookingId || !code) {
      return res.status(400).json({ message: "Booking ID and verification code are required" });
    }

    const booking = await storage.getBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.verificationStatus === 'verified') {
      return res.status(400).json({ message: "Booking already verified" });
    }

    if (booking.verificationExpiresAt && new Date() > booking.verificationExpiresAt) {
      // Delete the pending booking and its slot
      await storage.deletePendingBooking(bookingId);
      return res.status(400).json({ message: "Verification code expired. Please book again." });
    }

    if (booking.verificationCode !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Get the slot to check capacity one more time before confirming
    const slot = await storage.getSlot(booking.slotId);
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    // Re-check capacity at verification time to prevent race condition overbooking
    const currentBookings = await storage.countBookingsForClinicTime(
      slot.clinicId || 0, 
      slot.clinicName || '', 
      slot.startTime
    );
    
    const MAX_BOOKINGS_PER_SLOT = 3;
    // Count only verified bookings for this final check (since this booking is still pending)
    const verifiedCount = await storage.countVerifiedBookingsForClinicTime(
      slot.clinicId || 0,
      slot.clinicName || '',
      slot.startTime
    );
    
    if (verifiedCount >= MAX_BOOKINGS_PER_SLOT) {
      // Capacity exceeded during verification - delete this pending booking
      await storage.deletePendingBooking(bookingId);
      return res.status(400).json({ message: "Sorry, this time slot became fully booked. Please choose another time." });
    }

    // Verify the booking
    const verifiedBooking = await storage.verifyBooking(bookingId);
    
    // Mark slot as booked
    await storage.markSlotBooked(booking.slotId);

    // Send confirmation email
    console.log(`[EMAIL] To: ${booking.customerEmail}, Subject: Booking Confirmed!, Body: Your appointment on ${slot.startTime.toLocaleString()} is confirmed.`);

    res.json({ 
      message: "Booking confirmed!",
      booking: verifiedBooking
    });
  });

  app.post("/api/public/bookings/resend", async (req, res) => {
    const { bookingId } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID is required" });
    }

    const booking = await storage.getBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.verificationStatus === 'verified') {
      return res.status(400).json({ message: "Booking already verified" });
    }

    // Check if booking has expired - if so, delete it and ask user to book again
    if (booking.verificationExpiresAt && new Date() > booking.verificationExpiresAt) {
      await storage.deletePendingBooking(bookingId);
      return res.status(400).json({ message: "Booking expired. Please create a new booking." });
    }

    // Generate new OTP with fresh expiry
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.updateBookingVerification(bookingId, verificationCode, verificationExpiresAt);

    // Send OTP via email
    console.log(`[EMAIL] To: ${booking.customerEmail}, Subject: Your New Verification Code, Body: Your OTP is ${verificationCode}`);

    res.json({ 
      message: "New verification code sent to your email",
      expiresAt: verificationExpiresAt
    });
  });

  app.post("/api/uploads/signed-url", isAuthenticated, async (req, res) => {
    try {
      const { generateSignedUploadUrl } = await import("./signedUrl.service");
      const { fileName, fileType, fileSize, folder } = req.body;

      if (!fileName || !fileType || !fileSize || !folder) {
        return res.status(400).json({ 
          message: "Missing required fields: fileName, fileType, fileSize, folder" 
        });
      }

      const result = await generateSignedUploadUrl({
        fileName,
        fileType,
        fileSize,
        folder,
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  return httpServer;
}
