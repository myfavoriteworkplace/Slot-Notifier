import { 
  users, slots, bookings, notifications, clinics,
  type User,
  type Slot, type InsertSlot,
  type Booking, type InsertBooking,
  type Notification, type InsertNotification,
  type Clinic, type InsertClinic
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { authStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  // Slots
  createSlot(slot: InsertSlot): Promise<Slot>;
  getSlots(ownerId?: string, date?: string): Promise<Slot[]>;
  getSlot(id: number): Promise<Slot | undefined>;
  updateSlot(id: number, updates: Partial<Slot>): Promise<Slot>;
  deleteSlot(id: number): Promise<void>;

  // Bookings
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookings(userId: string, role: string): Promise<(Booking & { slot: Slot })[]>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<Notification | undefined>;

  // Users (from auth storage)
  getUser(id: string): Promise<User | undefined>;
  
  // Clinics
  createClinic(clinic: InsertClinic): Promise<Clinic>;
  getClinics(includeArchived?: boolean): Promise<Clinic[]>;
  archiveClinic(id: number): Promise<Clinic>;
  unarchiveClinic(id: number): Promise<Clinic>;
}

export class DatabaseStorage implements IStorage {
  // Slots
  async createSlot(insertSlot: any): Promise<Slot> {
    const [slot] = await db.insert(slots).values(insertSlot).returning();
    return slot;
  }

  async getSlots(ownerId?: string, date?: string): Promise<Slot[]> {
    let query = db.select().from(slots);
    
    const conditions = [];
    if (ownerId) {
      conditions.push(eq(slots.ownerId, ownerId));
    }
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      conditions.push(
        and(
          gte(slots.startTime, startOfDay),
          lte(slots.startTime, endOfDay)
        )
      );
    }

    if (conditions.length > 0) {
      // @ts-ignore
      query.where(and(...conditions));
    }
    
    return await query.orderBy(slots.startTime);
  }

  async getSlot(id: number): Promise<Slot | undefined> {
    const [slot] = await db.select().from(slots).where(eq(slots.id, id));
    return slot;
  }

  async updateSlot(id: number, updates: Partial<Slot>): Promise<Slot> {
    const [updated] = await db.update(slots)
      .set(updates)
      .where(eq(slots.id, id))
      .returning();
    return updated;
  }

  async deleteSlot(id: number): Promise<void> {
    await db.delete(slots).where(eq(slots.id, id));
  }

  // Bookings
  async createBooking(insertBooking: any): Promise<Booking> {
    const [booking] = await db.insert(bookings).values({
      slotId: insertBooking.slotId,
      customerId: insertBooking.customerId,
      customerName: insertBooking.customerName,
      customerPhone: insertBooking.customerPhone,
    }).returning();
    
    // Mark slot as booked
    await this.updateSlot(booking.slotId, { isBooked: true });

    return booking;
  }

  async getBookings(userId: string, role: string): Promise<(Booking & { slot: Slot })[]> {
    if (role === 'owner') {
      // Get bookings for slots owned by this user
      // Join bookings with slots where slots.ownerId = userId
      const results = await db.select({
        booking: bookings,
        slot: slots
      })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(eq(slots.ownerId, userId));
      
      return results.map(r => ({ ...r.booking, slot: r.slot }));
    } else {
      // Get bookings made by this customer
      const results = await db.select({
        booking: bookings,
        slot: slots
      })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(eq(bookings.customerId, userId));
      
      return results.map(r => ({ ...r.booking, slot: r.slot }));
    }
  }

  // Notifications
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  // Auth User wrapper
  async getUser(id: string): Promise<User | undefined> {
    return authStorage.getUser(id);
  }

  // Clinics
  async createClinic(insertClinic: InsertClinic): Promise<Clinic> {
    const [clinic] = await db.insert(clinics).values(insertClinic).returning();
    return clinic;
  }

  async getClinics(includeArchived: boolean = false): Promise<Clinic[]> {
    if (includeArchived) {
      return await db.select().from(clinics).orderBy(clinics.name);
    }
    return await db.select().from(clinics)
      .where(eq(clinics.isArchived, false))
      .orderBy(clinics.name);
  }

  async archiveClinic(id: number): Promise<Clinic> {
    const [updated] = await db.update(clinics)
      .set({ isArchived: true })
      .where(eq(clinics.id, id))
      .returning();
    return updated;
  }

  async unarchiveClinic(id: number): Promise<Clinic> {
    const [updated] = await db.update(clinics)
      .set({ isArchived: false })
      .where(eq(clinics.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
