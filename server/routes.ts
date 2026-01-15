import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated as replitIsAuthenticated, getSession } from "./replit_integrations/auth";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendCancellationEmail(email: string, name: string, date: Date, clinic: string) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Resend not configured. To: ${email}, Subject: Booking Cancelled`);
    return;
  }
  
  try {
    await resend.emails.send({
      from: 'BookMySlot <onboarding@resend.dev>',
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

const USE_ENV_AUTH = !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);

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
    
    app.post("/api/auth/admin/login", async (req, res) => {
      const { email, password } = req.body;
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (email === adminEmail && password === adminPassword) {
        (req.session as any).adminLoggedIn = true;
        (req.session as any).adminEmail = email;
        return res.json({ message: "Login successful", user: { email, role: 'superuser' } });
      }
      return res.status(401).json({ message: "Invalid credentials" });
    });
    
    app.post("/api/auth/admin/logout", (req, res) => {
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Logout failed" });
        res.json({ message: "Logged out" });
      });
    });
    
    app.get("/api/auth/user", (req, res) => {
      if ((req.session as any)?.adminLoggedIn) {
        return res.json({ 
          id: 'admin',
          email: (req.session as any).adminEmail,
          role: 'superuser'
        });
      }
      return res.status(401).json({ message: "Not authenticated" });
    });

    // Ensure the login endpoint is registered correctly
    app.post("/api/auth/admin/login", (req, res) => {
      const { email, password } = req.body;
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      console.log(`[AUTH] Admin login attempt for: ${email}`);
      
      if (email && adminEmail && email === adminEmail && password === adminPassword) {
        if (!req.session) {
          console.log("[AUTH] No session available");
          return res.status(500).json({ message: "Session initialization failed" });
        }
        (req.session as any).adminLoggedIn = true;
        (req.session as any).adminEmail = email;
        req.session.save((err) => {
          if (err) {
            console.error("[AUTH] Session save error:", err);
            return res.status(500).json({ message: "Failed to save session" });
          }
          console.log("[AUTH] Admin login successful, session saved");
          res.cookie('connect.sid', req.sessionID, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
          });
          return res.json({ message: "Login successful", user: { email, role: 'superuser' } });
        });
        return;
      }
      
      console.log(`[AUTH] Admin login failed for: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    });

    // Add a fallback for the /api/login path used in the UI
    app.get("/api/login", (req, res) => {
      res.redirect("/admin");
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

  // Slots API
  app.get(api.slots.list.path, async (req, res) => {
    const ownerId = req.query.ownerId as string;
    const date = req.query.date as string;
    const slots = await storage.getSlots(ownerId, date);
    res.json(slots);
  });

  app.post(api.slots.create.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    
    // Check if user is owner
    // Note: In a real app we'd enforce this strictly, but for MVP let's assume UI handles it
    // or just check the role if available in session
    // const dbUser = await storage.getUser(user.claims.sub);
    // if (dbUser?.role !== 'owner') return res.status(403).json({ message: "Only owners can create slots" });

    try {
      const input = api.slots.create.input.parse(req.body);
      
      // Force ownerId to be current user
      const slotData = { ...input, ownerId: user.claims.sub };
      
      const slot = await storage.createSlot(slotData);
      res.status(201).json(slot);
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

  app.delete(api.slots.delete.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const slotId = parseInt(req.params.id);
    
    const slot = await storage.getSlot(slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });
    
    if (slot.ownerId !== user.claims.sub) {
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
      let slot;
      
      // If slotId is -1, it's a dynamic slot from the clinic selection UI
      if (input.slotId === -1 && (req.body as any).clinicName) {
        // Create the slot first
        slot = await storage.createSlot({
          ownerId: user.claims.sub, 
          startTime: new Date((req.body as any).startTime),
          endTime: new Date((req.body as any).endTime),
          clinicName: (req.body as any).clinicName,
          clinicId: (req.body as any).clinicId || null,
          isBooked: false, // Ensure it's not marked booked yet so validation passes
        } as any);
      } else {
        slot = await storage.getSlot(input.slotId);
      }
      
      if (!slot) return res.status(404).json({ message: "Slot not found" });
      if (slot.isBooked) return res.status(400).json({ message: "Slot already booked" });

      // Force customerId to be current user
      const bookingData = { 
        ...input, 
        slotId: slot.id,
        customerId: user.claims.sub,
      };
      const booking = await storage.createBooking(bookingData);

      // Create notifications
      // 1. Notify Customer
      await storage.createNotification({
        userId: bookingData.customerId,
        message: `You have successfully booked a slot on ${slot.startTime.toLocaleString()}`,
      });
      // Mock Email to Customer
      console.log(`[EMAIL MOCK] To: ${user.claims.email}, Subject: Booking Confirmed, Body: You booked a slot at ${slot.startTime}`);

      // 2. Notify Owner (if slot has an owner)
      if (slot.ownerId) {
        await storage.createNotification({
          userId: slot.ownerId,
          message: `Your slot on ${slot.startTime.toLocaleString()} has been booked!`,
        });
        // Mock Email to Owner
        console.log(`[EMAIL MOCK] To: Owner (ID: ${slot.ownerId}), Subject: New Booking, Body: Slot at ${slot.startTime} booked.`);
      }

      res.status(201).json(booking);
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

  app.get(api.bookings.list.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    // We need to know the role to filter correctly.
    // Fetch user from DB to get role
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) return res.status(401).json({ message: "User not found" });

    const bookings = await storage.getBookings(user.claims.sub, dbUser.role);
    res.json(bookings);
  });

  // Notifications API
  app.get(api.notifications.list.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const notifications = await storage.getNotifications(user.claims.sub);
    res.json(notifications);
  });

  app.patch(api.notifications.markRead.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const updated = await storage.markNotificationRead(id);
    if (!updated) return res.status(404).json({ message: "Notification not found" });
    res.json(updated);
  });

  // Clinics API
  app.get(api.clinics.list.path, async (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    const clinics = await storage.getClinics(includeArchived);
    // Remove passwordHash from response for security
    const safeClinics = clinics.map(({ passwordHash, ...clinic }) => clinic);
    res.json(safeClinics);
  });

  app.post(api.clinics.create.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    
    // For env auth, admin is always superuser
    const isSuperuser = USE_ENV_AUTH 
      ? user.claims.sub === 'admin'
      : (await storage.getUser(user.claims.sub))?.role === 'superuser';
    
    if (!isSuperuser) {
      return res.status(403).json({ message: "Only super users can add clinics" });
    }

    try {
      const input = api.clinics.create.input.parse(req.body);
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
    
    if (!isSuperuser) {
      return res.status(403).json({ message: "Only super users can archive clinics" });
    }

    const clinicId = parseInt(req.params.id);
    try {
      const clinic = await storage.archiveClinic(clinicId);
      res.json(clinic);
    } catch {
      return res.status(404).json({ message: "Clinic not found" });
    }
  });

  app.patch(api.clinics.unarchive.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    
    const isSuperuser = USE_ENV_AUTH 
      ? user.claims.sub === 'admin'
      : (await storage.getUser(user.claims.sub))?.role === 'superuser';
    
    if (!isSuperuser) {
      return res.status(403).json({ message: "Only super users can unarchive clinics" });
    }

    const clinicId = parseInt(req.params.id);
    try {
      const clinic = await storage.unarchiveClinic(clinicId);
      res.json(clinic);
    } catch {
      return res.status(404).json({ message: "Clinic not found" });
    }
  });

  // Seed data endpoint (dev only)
  app.post("/api/seed", async (req, res) => {
    // Basic seed data
    // Assuming user is already logged in as someone to create slots for
    // This is just a helper, in reality we'd need valid user IDs
    res.json({ message: "Seed endpoint hit. Create users via Auth UI first." });
  });

  // Clinic Authentication
  app.post("/api/clinic/login", async (req, res) => {
    const { username, password } = req.body;
    
    // Bypass for demo clinic
    if (username === "demo_clinic" && password === "demo_password123") {
      const demoClinic = await storage.getClinicByUsername("demo_clinic");
      if (demoClinic) {
        (req.session as any).clinicId = demoClinic.id;
        (req.session as any).clinicName = demoClinic.name;
        (req.session as any).authType = 'clinic';
        return res.json({
          id: demoClinic.id,
          name: demoClinic.name,
          username: demoClinic.username,
        });
      }
    }
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const clinic = await storage.getClinicByUsername(username);
    if (!clinic) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (!clinic.passwordHash) {
      return res.status(401).json({ message: "Clinic account not set up. Contact administrator." });
    }

    const isValid = await bcrypt.compare(password, clinic.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (clinic.isArchived) {
      return res.status(401).json({ message: "This clinic account is deactivated" });
    }

    // Store clinic session
    if (!req.session) {
      return res.status(500).json({ message: "Session not available" });
    }
    (req.session as any).clinicId = clinic.id;
    (req.session as any).clinicName = clinic.name;
    (req.session as any).authType = 'clinic';

    res.json({
      id: clinic.id,
      name: clinic.name,
      username: clinic.username,
    });
  });

  app.post("/api/clinic/logout", (req, res) => {
    delete (req.session as any).clinicId;
    delete (req.session as any).clinicName;
    delete (req.session as any).authType;
    res.json({ message: "Logged out" });
  });

  app.get("/api/clinic/me", (req, res) => {
    if (!req.session) {
      return res.status(401).json({ message: "Not authenticated as clinic" });
    }
    const clinicId = (req.session as any).clinicId;
    const clinicName = (req.session as any).clinicName;
    const authType = (req.session as any).authType;

    if (authType === 'clinic' && clinicId) {
      return res.json({ id: clinicId, name: clinicName });
    }
    return res.status(401).json({ message: "Not authenticated as clinic" });
  });

  // Clinic bookings (filtered by clinic)
  app.get("/api/clinic/bookings", async (req, res) => {
    const clinicId = (req.session as any).clinicId;
    const authType = (req.session as any).authType;

    if (authType !== 'clinic' || !clinicId) {
      return res.status(401).json({ message: "Not authenticated as clinic" });
    }

    const bookings = await storage.getBookingsByClinicId(clinicId);
    res.json(bookings);
  });

  // Cancel a booking (clinic admin only)
  app.delete("/api/clinic/bookings/:id", async (req, res) => {
    const clinicId = (req.session as any).clinicId;
    const authType = (req.session as any).authType;

    if (authType !== 'clinic' || !clinicId) {
      return res.status(401).json({ message: "Not authenticated as clinic" });
    }

    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    // Verify the booking belongs to this clinic
    const booking = await storage.getBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const slot = await storage.getSlot(booking.slotId);
    if (!slot || (slot.clinicId !== clinicId)) {
      return res.status(403).json({ message: "Not authorized to cancel this booking" });
    }

    // Get clinic name for the email
    const clinic = await storage.getClinic(clinicId);
    const clinicName = clinic?.name || 'the clinic';

    // Store booking details before cancelling
    const customerEmail = booking.customerEmail;
    const customerName = booking.customerName;
    const appointmentTime = slot.startTime;

    await storage.cancelBooking(bookingId);

    // Send cancellation email
    if (customerEmail) {
      await sendCancellationEmail(customerEmail, customerName, appointmentTime, clinicName);
    }

    res.json({ message: "Booking cancelled successfully" });
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
      
      const MAX_BOOKINGS_PER_SLOT = 3; // Maximum bookings per time slot per clinic
      if (existingBookings >= MAX_BOOKINGS_PER_SLOT) {
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
      } as any);

      // Create confirmed booking directly (no OTP verification)
      const booking = await storage.createPublicBooking({
        slotId: slot.id,
        customerName,
        customerPhone,
        customerEmail,
        verificationCode: null,
        verificationExpiresAt: null,
        verificationStatus: 'verified',
      });

      // Log confirmation (email can be added later)
      console.log(`[EMAIL] To: ${customerEmail}, Subject: Booking Confirmed!, Body: Your appointment on ${requestedStart.toLocaleString()} at ${clinic.name} is confirmed.`);

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
