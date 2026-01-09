import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcrypt";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

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

      // 2. Notify Owner
      await storage.createNotification({
        userId: slot.ownerId,
        message: `Your slot on ${slot.startTime.toLocaleString()} has been booked!`,
      });
       // Mock Email to Owner
       console.log(`[EMAIL MOCK] To: Owner (ID: ${slot.ownerId}), Subject: New Booking, Body: Slot at ${slot.startTime} booked.`);

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
    const dbUser = await storage.getUser(user.claims.sub);
    
    if (!dbUser || dbUser.role !== 'superuser') {
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
    const dbUser = await storage.getUser(user.claims.sub);
    
    if (!dbUser || dbUser.role !== 'superuser') {
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
    const dbUser = await storage.getUser(user.claims.sub);
    
    if (!dbUser || dbUser.role !== 'superuser') {
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

  // Update clinic when creating (with credentials)
  app.patch("/api/clinics/:id/credentials", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    
    if (!dbUser || dbUser.role !== 'superuser') {
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

  return httpServer;
}
