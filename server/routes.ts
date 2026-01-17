import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { setupAuth, registerAuthRoutes, isAuthenticated as replitIsAuthenticated, getSession } from "./replit_integrations/auth";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'BookMySlot <onboarding@resend.dev>';

async function sendBookingEmails(customerEmail: string, customerName: string, clinicEmail: string | null, clinicName: string, startTime: Date) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured.`);
    console.log(`[EMAIL MOCK] To Customer: ${customerEmail}, Subject: Booking Confirmed`);
    if (clinicEmail) console.log(`[EMAIL MOCK] To Clinic: ${clinicEmail}, Subject: New Booking`);
    return;
  }
  
  const formattedTime = startTime.toLocaleString();

  try {
    // Send to Customer
    await resend.emails.send({
      from: EMAIL_FROM,
      to: customerEmail,
      subject: 'Booking Confirmed - BookMySlot',
      html: `
        <h2>Booking Confirmed</h2>
        <p>Dear ${customerName},</p>
        <p>Your appointment at <strong>${clinicName}</strong> for <strong>${formattedTime}</strong> has been successfully booked.</p>
        <p>Thank you for choosing BookMySlot!</p>
      `
    });

    // Send to Clinic if email exists
    if (clinicEmail) {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: clinicEmail,
        subject: 'New Booking Received - BookMySlot',
        html: `
          <h2>New Booking Received</h2>
          <p>A new appointment has been booked for <strong>${formattedTime}</strong>.</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p>Please check your dashboard for details.</p>
        `
      });
    }
    console.log(`[EMAIL] Booking confirmation emails sent`);
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send booking emails:', error);
  }
}

async function sendCancellationEmail(email: string, name: string, date: Date, clinic: string) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured. To: ${email}, Subject: Booking Cancelled`);
    return;
  }
  
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'Appointment Cancellation - BookMySlot',
      html: `
        <h2>Appointment Cancelled</h2>
        <p>Dear ${name},</p>
        <p>Your appointment at <strong>${clinic}</strong> scheduled for <strong>${date.toLocaleString()}</strong> has been cancelled.</p>
        <p>If you have any questions, please contact the clinic directly.</p>
        <p>Best regards,<br/>The BookMySlot Team</p>
      `
    });
    console.log(`[EMAIL] Cancellation email sent to ${email}`);
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send cancellation email:', error);
  }
}

const USE_ENV_AUTH = true;

console.log(`[AUTH] USE_ENV_AUTH: ${USE_ENV_AUTH}`);
console.log(`[AUTH] ADMIN_EMAIL present: ${!!process.env.ADMIN_EMAIL}`);
console.log(`[AUTH] ADMIN_PASSWORD present: ${!!process.env.ADMIN_PASSWORD}`);

function envIsAuthenticated(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.adminLoggedIn) {
    // Set req.user to mimic Replit OIDC structure for compatibility with downstream handlers
    (req as any).user = {
      claims: {
        sub: 'admin',
        email: (req.session as any).adminEmail,
      }
    };
    return next();
  }
  return res.status(401).json({ message: "Authentication required" });
}

const isAuthenticated = USE_ENV_AUTH ? envIsAuthenticated : replitIsAuthenticated;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Publicly available login check for debugging
  app.get("/api/auth/debug", (req, res) => {
    res.json({
      useEnvAuth: USE_ENV_AUTH,
      adminEmailSet: !!process.env.ADMIN_EMAIL,
      adminPasswordSet: !!process.env.ADMIN_PASSWORD,
      sessionID: req.sessionID,
      nodeEnv: process.env.NODE_ENV
    });
  });

  if (USE_ENV_AUTH) {
    console.log("[AUTH] Using environment-based admin authentication");
    
    // Set up session middleware for env auth
    app.set("trust proxy", 1);
    app.use(getSession());

    // Debug middleware to log session and cookies
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        console.log(`[AUTH-DEBUG] Request: ${req.method} ${req.path}`);
        // console.log(`[AUTH-DEBUG] SessionID: ${req.sessionID}`);
        // console.log(`[AUTH-DEBUG] Cookies: ${JSON.stringify(req.headers.cookie)}`);
      }
      next();
    });

    // Separate Health check for Backend
    app.get("/api/health/backend", (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const response = {
        status: "ok",
        backend: true,
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[API-RESPONSE] /api/health/backend: ${JSON.stringify(response)}`);
      return res.status(200).json(response);
    });

    // Separate Health check for Database
    app.get("/api/health/database", async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
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

    // Main Health check endpoint - Combined
    app.get("/api/health", async (req, res) => {
      // Force response headers to prevent any caching or unexpected content types
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      console.log(`[API-REQUEST] /api/health from IP: ${req.ip}`);
      
      try {
        // Simple query to check DB connection
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

        // Explicitly use global console.log to ensure it's not swallowed
        global.console.log(`[API-RESPONSE] /api/health: ${JSON.stringify(responseData)}`);
        return res.status(200).send(JSON.stringify(responseData));
      } catch (err: any) {
        global.console.error(`[API-RESPONSE-ERROR] /api/health: ${err.message}`);
        const errorResponse = { 
          status: "error", 
          backend: true, 
          database: false,
          deployment: "render",
          error: err.message,
          timestamp: new Date().toISOString()
        };
        return res.status(500).send(JSON.stringify(errorResponse));
      }
    });

    app.post("/api/auth/admin/login", async (req, res) => {
      const { email, password } = req.body;
      
      console.log(`[AUTH] Login attempt - Email: ${email}, Path: ${req.path}`);
      
      if (!email || !password) {
        console.error(`[AUTH ERROR] Missing credentials for login attempt at ${req.path}`);
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Special bypass for demo_super_admin
      if (email === "demo_super_admin@bookmyslot.com") {
        console.log("[AUTH] Demo super admin login detected");
        if (!req.session) {
          console.error("[AUTH ERROR] No session available for demo_super_admin");
          return res.status(500).json({ message: "Session initialization failed" });
        }
        (req.session as any).adminLoggedIn = true;
        (req.session as any).adminEmail = "demo_super_admin@bookmyslot.com";
        req.session.save((err) => {
          if (err) {
            console.error("[AUTH ERROR] Failed to save session for demo_super_admin:", err);
            return res.status(500).json({ message: "Failed to save session" });
          }
          console.log("[AUTH] Demo session saved successfully");
          return res.json({ message: "Login successful", user: { email: "demo_super_admin@bookmyslot.com", role: 'superuser' } });
        });
        return;
      }

      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      console.log(`[AUTH] Admin login attempt for: ${email}. Expected: ${adminEmail}`);
      
      if (email && adminEmail && email === adminEmail && password === adminPassword) {
        if (!req.session) {
          console.error("[AUTH ERROR] No session available for admin login");
          return res.status(500).json({ message: "Session initialization failed" });
        }
        (req.session as any).adminLoggedIn = true;
        (req.session as any).adminEmail = email;
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
            REPL_ID: !!process.env.REPL_ID,
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
  } else {
    console.log("[AUTH] Using Replit OIDC authentication");
    await setupAuth(app);
    registerAuthRoutes(app);
  }

  // Claim superuser status if no superusers exist (one-time setup)
  app.post("/api/claim-superuser", isAuthenticated, async (req, res) => {
    const user = req.user as any;
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
    const user = req.user as any;
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
    const user = req.user as any;
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
    const user = req.user as any;
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
      await sendBookingEmails(customerEmail, (input as any).customerName, clinic?.email || null, slot.clinicName || 'the clinic', slot.startTime);
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
  app.post(api.clinics.create.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const isSuperuser = USE_ENV_AUTH 
      ? user.claims.sub === 'admin'
      : (await storage.getUser(user.claims.sub))?.role === 'superuser';
    if (!isSuperuser) {
      logger(`Unauthorized clinic creation attempt by ${user.claims.sub}`, 'SECURITY');
      return res.status(403).json({ message: "Only super users can add clinics" });
    }
    try {
      const input = api.clinics.create.input.parse(req.body);
      logger(`Superuser ${user.claims.sub} creating new clinic: ${input.name}`, 'ADMIN');
      const clinic = await storage.createClinic(input);
      res.status(201).json(clinic);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.clinics.archive.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const isSuperuser = USE_ENV_AUTH 
      ? user.claims.sub === 'admin'
      : (await storage.getUser(user.claims.sub))?.role === 'superuser';
    if (!isSuperuser) return res.status(403).json({ message: "Only super users can archive clinics" });
    const clinicId = parseInt(req.params.id);
    logger(`Archiving clinic ${clinicId} by ${user.claims.sub}`, 'ADMIN');
    try {
      const clinic = await storage.archiveClinic(clinicId);
      res.json(clinic);
    } catch {
      return res.status(404).json({ message: "Clinic not found" });
    }
  });

  // Clinic Authentication
  app.post("/api/clinic/login", async (req, res) => {
    const { username, password } = req.body;
    logger(`Clinic login attempt for username: ${username}`, 'AUTH');

    // Allow superuser to bypass clinic login
    if ((req.session as any)?.adminLoggedIn && (req.session as any)?.adminEmail) {
      const clinic = await storage.getClinics();
      const targetClinic = clinic.find(c => c.username === username || c.name === username);
      
      if (targetClinic) {
        (req.session as any).clinicId = targetClinic.id;
        (req.session as any).clinicName = targetClinic.name;
        (req.session as any).authType = 'clinic';
        logger(`Superuser bypassed login for clinic: ${targetClinic.name}`, 'AUTH');
        return res.json({ id: targetClinic.id, name: targetClinic.name, username: targetClinic.username });
      }
    }

    if (username === "demo_clinic" && password === "demo_password123") {
      const demoClinic = await storage.getClinicByUsername("demo_clinic");
      if (demoClinic) {
        (req.session as any).clinicId = demoClinic.id;
        (req.session as any).clinicName = demoClinic.name;
        (req.session as any).authType = 'clinic';
        logger(`Demo clinic login successful: ${demoClinic.name}`, 'AUTH');
        return res.json({ id: demoClinic.id, name: demoClinic.name, username: demoClinic.username });
      }
    }
    if (!username || !password) return res.status(400).json({ message: "Username and password are required" });
    const clinic = await storage.getClinicByUsername(username);
    if (!clinic || !clinic.passwordHash) {
      logger(`Login failed: Invalid clinic or no setup for ${username}`, 'AUTH');
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const isValid = await bcrypt.compare(password, clinic.passwordHash);
    if (!isValid) {
      logger(`Login failed: Password mismatch for ${username}`, 'AUTH');
      return res.status(401).json({ message: "Invalid username or password" });
    }
    if (clinic.isArchived) {
      logger(`Login failed: Deactivated clinic account ${username}`, 'AUTH');
      return res.status(401).json({ message: "This clinic account is deactivated" });
    }
    if (!req.session) return res.status(500).json({ message: "Session not available" });
    (req.session as any).clinicId = clinic.id;
    (req.session as any).clinicName = clinic.name;
    (req.session as any).authType = 'clinic';
    logger(`Clinic login successful: ${clinic.name}`, 'AUTH');
    res.json({ id: clinic.id, name: clinic.name, username: clinic.username });
  });

  // Slot Configuration API (Clinic Admin)
  app.post("/api/clinic/slots/configure", async (req, res) => {
    const clinicId = (req.session as any).clinicId;
    const authType = (req.session as any).authType;
    if (authType !== 'clinic' || !clinicId) return res.status(401).json({ message: "Not authenticated as clinic" });
    const { startTime, maxBookings, isCancelled } = req.body;
    logger(`Clinic ${clinicId} configuring slot at ${startTime}`, 'CLINIC-ADMIN');
    if (!startTime) return res.status(400).json({ message: "Start time is required" });
    const start = new Date(startTime);
    let slot = await (storage as any).getSlotByTime(clinicId, start);
    if (slot) {
      slot = await storage.updateSlot(slot.id, { maxBookings: maxBookings ?? slot.maxBookings, isCancelled: isCancelled ?? slot.isCancelled });
    } else {
      slot = await storage.createSlot({ clinicId, startTime: start, endTime: new Date(start.getTime() + 30 * 60000), maxBookings: maxBookings ?? 3, isCancelled: isCancelled ?? false, isBooked: false, ownerId: null, clinicName: (req.session as any).clinicName } as any);
    }
    res.json(slot);
  });

  // Update clinic when creating (with credentials)
  app.patch("/api/clinics/:id/credentials", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    
    const isSuperuser = USE_ENV_AUTH 
      ? user.claims.sub === 'admin'
      : (await storage.getUser(user.claims.sub))?.role === 'superuser';
    
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

  return httpServer;
}
