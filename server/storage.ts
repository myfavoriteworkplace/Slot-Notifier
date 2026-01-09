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
  // Users
  hasSuperuser(): Promise<boolean>;
  setUserRole(userId: string, role: string): Promise<void>;

  // Slots
  createSlot(slot: InsertSlot): Promise<Slot>;
  getSlots(ownerId?: string, date?: string): Promise<Slot[]>;
  getSlot(id: number): Promise<Slot | undefined>;
  updateSlot(id: number, updates: Partial<Slot>): Promise<Slot>;
  deleteSlot(id: number): Promise<void>;
  markSlotBooked(id: number): Promise<Slot>;

  // Bookings
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookings(userId: string, role: string): Promise<(Booking & { slot: Slot })[]>;
  getBookingsByClinicId(clinicId: number): Promise<(Booking & { slot: Slot })[]>;
  getBookingById(id: number): Promise<Booking | undefined>;
  createPublicBooking(data: {
    slotId: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    verificationCode?: string | null;
    verificationExpiresAt?: Date | null;
    verificationStatus?: 'pending' | 'verified';
  }): Promise<Booking>;
  verifyBooking(id: number): Promise<Booking>;
  deletePendingBooking(id: number): Promise<void>;
  updateBookingVerification(id: number, code: string, expiresAt: Date): Promise<Booking>;
  countBookingsForClinicTime(clinicId: number, clinicName: string, startTime: Date): Promise<number>;
  countVerifiedBookingsForClinicTime(clinicId: number, clinicName: string, startTime: Date): Promise<number>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<Notification | undefined>;

  // Users (from auth storage)
  getUser(id: string): Promise<User | undefined>;
  
  // Clinics
  createClinic(clinic: InsertClinic): Promise<Clinic>;
  getClinics(includeArchived?: boolean): Promise<Clinic[]>;
  getClinic(id: number): Promise<Clinic | undefined>;
  getClinicByUsername(username: string): Promise<Clinic | undefined>;
  updateClinic(id: number, updates: Partial<Clinic>): Promise<Clinic>;
  archiveClinic(id: number): Promise<Clinic>;
  unarchiveClinic(id: number): Promise<Clinic>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async hasSuperuser(): Promise<boolean> {
    const result = await db.select().from(users).where(eq(users.role, 'superuser')).limit(1);
    return result.length > 0;
  }

  async setUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  }

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

  async markSlotBooked(id: number): Promise<Slot> {
    const [updated] = await db.update(slots)
      .set({ isBooked: true })
      .where(eq(slots.id, id))
      .returning();
    return updated;
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

  async getBookingsByClinicId(clinicId: number): Promise<(Booking & { slot: Slot })[]> {
    // First get the clinic to also match by name for legacy data
    const clinic = await this.getClinic(clinicId);
    
    const results = await db.select({
      booking: bookings,
      slot: slots
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id));
    
    // Filter results to include slots with matching clinicId OR clinicName (for legacy data)
    const filtered = results.filter(r => 
      r.slot.clinicId === clinicId || 
      (r.slot.clinicId === null && clinic && r.slot.clinicName === clinic.name)
    );
    
    return filtered.map(r => ({ ...r.booking, slot: r.slot }));
  }

  async getBookingById(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async createPublicBooking(data: {
    slotId: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    verificationCode?: string | null;
    verificationExpiresAt?: Date | null;
    verificationStatus?: 'pending' | 'verified';
  }): Promise<Booking> {
    const [booking] = await db.insert(bookings).values({
      slotId: data.slotId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      verificationCode: data.verificationCode || null,
      verificationStatus: data.verificationStatus || 'verified',
      verificationExpiresAt: data.verificationExpiresAt || null,
    }).returning();
    return booking;
  }

  async verifyBooking(id: number): Promise<Booking> {
    const [updated] = await db.update(bookings)
      .set({ 
        verificationStatus: 'verified',
        verificationCode: null,
        verificationExpiresAt: null
      })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async deletePendingBooking(id: number): Promise<void> {
    const booking = await this.getBookingById(id);
    if (booking) {
      await db.delete(bookings).where(eq(bookings.id, id));
      // Also delete the associated slot
      await this.deleteSlot(booking.slotId);
    }
  }

  async updateBookingVerification(id: number, code: string, expiresAt: Date): Promise<Booking> {
    const [updated] = await db.update(bookings)
      .set({ 
        verificationCode: code,
        verificationExpiresAt: expiresAt
      })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async countBookingsForClinicTime(clinicId: number, clinicName: string, startTime: Date): Promise<number> {
    // Create a time window: match slots that start within 1 minute of the requested time
    const startWindow = new Date(startTime.getTime() - 60000); // 1 minute before
    const endWindow = new Date(startTime.getTime() + 60000);   // 1 minute after

    // Get all slots that match the time window
    const results = await db.select({
      booking: bookings,
      slot: slots
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(
      and(
        gte(slots.startTime, startWindow),
        lte(slots.startTime, endWindow)
      )
    );

    // Filter by clinic (by clinicId or clinicName)
    // Only count non-expired pending or verified bookings
    const matchingBookings = results.filter(r => {
      const isMatchingClinic = r.slot.clinicId === clinicId || r.slot.clinicName === clinicName;
      const isNotExpired = r.booking.verificationStatus === 'verified' || 
        (r.booking.verificationStatus === 'pending' && 
         r.booking.verificationExpiresAt && 
         new Date() < r.booking.verificationExpiresAt);
      
      return isMatchingClinic && isNotExpired;
    });

    return matchingBookings.length;
  }

  async countVerifiedBookingsForClinicTime(clinicId: number, clinicName: string, startTime: Date): Promise<number> {
    // Create a time window: match slots that start within 1 minute of the requested time
    const startWindow = new Date(startTime.getTime() - 60000);
    const endWindow = new Date(startTime.getTime() + 60000);

    const results = await db.select({
      booking: bookings,
      slot: slots
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(
      and(
        gte(slots.startTime, startWindow),
        lte(slots.startTime, endWindow)
      )
    );

    // Filter by clinic and count only verified bookings
    const verifiedBookings = results.filter(r => {
      const isMatchingClinic = r.slot.clinicId === clinicId || r.slot.clinicName === clinicName;
      const isVerified = r.booking.verificationStatus === 'verified';
      return isMatchingClinic && isVerified;
    });

    return verifiedBookings.length;
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

  async getClinic(id: number): Promise<Clinic | undefined> {
    const [clinic] = await db.select().from(clinics).where(eq(clinics.id, id));
    return clinic;
  }

  async getClinicByUsername(username: string): Promise<Clinic | undefined> {
    const [clinic] = await db.select().from(clinics).where(eq(clinics.username, username));
    return clinic;
  }

  async updateClinic(id: number, updates: Partial<Clinic>): Promise<Clinic> {
    const [updated] = await db.update(clinics)
      .set(updates)
      .where(eq(clinics.id, id))
      .returning();
    return updated;
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
