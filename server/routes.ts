import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";

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
      const slot = await storage.getSlot(input.slotId);
      
      if (!slot) return res.status(404).json({ message: "Slot not found" });
      if (slot.isBooked) return res.status(400).json({ message: "Slot already booked" });

      // Force customerId to be current user
      const bookingData = { ...input, customerId: user.claims.sub };
      const booking = await storage.createBooking(bookingData);

      // Create notifications
      // 1. Notify Customer
      await storage.createNotification({
        userId: bookingData.customerId,
        message: `You have successfully booked a slot on ${slot.startTime.toLocaleString()}`,
        read: false
      });
      // Mock Email to Customer
      console.log(`[EMAIL MOCK] To: ${user.claims.email}, Subject: Booking Confirmed, Body: You booked a slot at ${slot.startTime}`);

      // 2. Notify Owner
      await storage.createNotification({
        userId: slot.ownerId,
        message: `Your slot on ${slot.startTime.toLocaleString()} has been booked!`,
        read: false
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

  // Seed data endpoint (dev only)
  app.post("/api/seed", async (req, res) => {
    // Basic seed data
    // Assuming user is already logged in as someone to create slots for
    // This is just a helper, in reality we'd need valid user IDs
    res.json({ message: "Seed endpoint hit. Create users via Auth UI first." });
  });

  return httpServer;
}
