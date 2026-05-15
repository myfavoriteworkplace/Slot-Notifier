import { 
  users, slots, bookings, notifications, clinics, doctors, clinicDoctors, patients, smileDeals, exportHistory,
  doctorCertifications, doctorCases, bookingNotes, doctorLeaves, consentTokens, clinicalRecords,
  inventoryCategories, inventoryItems, stockTransactions, stockAlerts,
  type User,
  type Slot, type InsertSlot,
  type Booking, type InsertBooking,
  type Notification, type InsertNotification,
  type Clinic, type InsertClinic,
  type Doctor, type InsertDoctor,
  type DoctorCertification, type InsertDoctorCertification,
  type DoctorCase, type InsertDoctorCase,
  type ClinicDoctor, type InsertClinicDoctor,
  type Patient, type InsertPatient,
  type SmileDeal, type InsertSmileDeal,
  type ExportHistory, type InsertExportHistory,
  type BookingNote, type InsertBookingNote,
  type DoctorLeave, type InsertDoctorLeave,
  type ConsentToken,
  type ClinicalRecord, type InsertClinicalRecord,
  type InventoryCategory, type InsertInventoryCategory,
  type InventoryItem, type InsertInventoryItem,
  type StockTransaction, type InsertStockTransaction,
  type StockAlert, type InsertStockAlert,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, or, isNull, gt, sql, getTableColumns } from "drizzle-orm";

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
    description?: string | null;
    verificationCode?: string | null;
    verificationExpiresAt?: Date | null;
    verificationStatus?: 'pending' | 'verified';
  }): Promise<Booking>;
  verifyBooking(id: number): Promise<Booking>;
  deletePendingBooking(id: number): Promise<void>;
  cancelBooking(id: number): Promise<void>;
  updateBookingVerification(id: number, code: string, expiresAt: Date): Promise<Booking>;
  countBookingsForClinicTime(clinicId: number, clinicName: string, startTime: Date): Promise<number>;
  countVerifiedBookingsForClinicTime(clinicId: number, clinicName: string, startTime: Date): Promise<number>;
  
  // Missing methods for routes.ts
  configureClinicSlots(clinicId: number, date: string, slots: any[]): Promise<Slot[]>;
  getClinicSlots(clinicId: number, date?: string): Promise<Slot[]>;
  getClinicBookings(clinicId: number): Promise<(Booking & { slot: Slot })[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  updateBookingStatus(id: number, status: string): Promise<Booking>;
  updateBookingAssignment(id: number, doctorName: string, doctorEmail?: string | null, doctorApprovalStatus?: string | null): Promise<Booking>;
  updateBookingDoctorApproval(id: number, doctorEmail: string, status: 'approved' | 'declined'): Promise<Booking>;
  rescheduleBooking(id: number, newSlotId: number): Promise<Booking>;
  updateBookingDoctorNotes(id: number, doctorEmail: string, notes: string | null, clinicalStatus: string | null): Promise<Booking>;
  updateClinicCredentials(id: number, username: string, passwordHash: string): Promise<void>;
  
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

  // Doctors
  getDoctorByEmail(email: string): Promise<Doctor | undefined>;
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  linkDoctorToClinic(clinicId: number, doctorId: number): Promise<ClinicDoctor>;
  getClinicDoctors(clinicId: number): Promise<Doctor[]>;

  // Patients
  getPatientsByDoctor(doctorId: number): Promise<(Patient & { clinic: Clinic })[]>;
  createPatient(patient: InsertPatient): Promise<Patient>;

  // Doctor Profile
  updateDoctorProfile(id: number, updates: Partial<Doctor>): Promise<Doctor>;
  getDoctorById(id: number): Promise<Doctor | null>;
  getDoctorByUsername(username: string): Promise<Doctor | null>;

  // Doctor Certifications
  getCertificationsByDoctor(doctorId: number): Promise<DoctorCertification[]>;
  createCertification(cert: InsertDoctorCertification): Promise<DoctorCertification>;
  updateCertification(id: number, doctorId: number, updates: Partial<DoctorCertification>): Promise<DoctorCertification>;
  deleteCertification(id: number, doctorId: number): Promise<void>;

  // Doctor Cases
  getCasesByDoctor(doctorId: number): Promise<DoctorCase[]>;
  createCase(c: InsertDoctorCase): Promise<DoctorCase>;
  updateCase(id: number, doctorId: number, updates: Partial<DoctorCase>): Promise<DoctorCase>;
  deleteCase(id: number, doctorId: number): Promise<void>;

  // Smile Deals
  getSmileDeals(onlyActive?: boolean): Promise<SmileDeal[]>;
  createSmileDeal(deal: InsertSmileDeal): Promise<SmileDeal>;
  updateSmileDeal(id: number, updates: Partial<SmileDeal>): Promise<SmileDeal>;
  deleteSmileDeal(id: number): Promise<void>;
  incrementDealView(id: number): Promise<void>;
  incrementDealClick(id: number): Promise<void>;

  // Export History
  createExportRecord(data: InsertExportHistory): Promise<ExportHistory>;
  getExportHistory(clinicId: number): Promise<ExportHistory[]>;

  // Booking Notes (shared conversation thread)
  getBookingNotes(bookingId: number): Promise<BookingNote[]>;
  createBookingNote(data: InsertBookingNote): Promise<BookingNote>;

  // Doctor Leaves
  getDoctorLeaves(doctorId: number): Promise<DoctorLeave[]>;
  addDoctorLeave(data: InsertDoctorLeave): Promise<DoctorLeave>;
  removeDoctorLeave(id: number, doctorId: number): Promise<void>;
  getDoctorLeavesOnDate(date: string, doctorIds: number[]): Promise<DoctorLeave[]>;
  getAllDoctorLeavesForClinic(doctorIds: number[]): Promise<(DoctorLeave & { doctorEmail?: string; doctorName?: string })[]>;

  // Consent Tokens
  createConsentToken(bookingId: number, clinicId: number, token: string, expiresAt: Date): Promise<ConsentToken>;
  getConsentByToken(token: string): Promise<(ConsentToken & { booking: Booking; clinic: Clinic }) | undefined>;
  markConsentSigned(token: string, signature: string, ip: string): Promise<void>;

  // Clinical Records
  createClinicalRecord(data: InsertClinicalRecord): Promise<ClinicalRecord>;
  getClinicalRecordsByBookingId(bookingId: number): Promise<ClinicalRecord[]>;
  getClinicalRecordsByClinicId(clinicId: number): Promise<ClinicalRecord[]>;
  updateClinicalRecord(id: number, updates: Partial<Pick<ClinicalRecord, 'diagnosis' | 'prescription' | 'notes' | 'doctorName'>>): Promise<ClinicalRecord>;
  softDeleteClinicalRecord(id: number): Promise<void>;

  // Inventory
  getInventoryCategories(clinicId: number): Promise<InventoryCategory[]>;
  createInventoryCategory(data: InsertInventoryCategory): Promise<InventoryCategory>;
  getInventoryItems(clinicId: number): Promise<InventoryItem[]>;
  createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, clinicId: number, updates: Partial<InventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: number, clinicId: number): Promise<void>;
  getStockTransactions(clinicId: number): Promise<(StockTransaction & { itemName: string })[]>;
  createStockTransaction(data: InsertStockTransaction): Promise<StockTransaction>;
  getStockAlerts(clinicId: number): Promise<(StockAlert & { itemName: string })[]>;
  createStockAlert(data: InsertStockAlert): Promise<StockAlert>;
  dismissStockAlert(id: number, clinicId: number): Promise<void>;
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
      customerEmail: insertBooking.customerEmail,
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

  // Implementation for missing methods identified by LSP errors
  async configureClinicSlots(clinicId: number, date: string, slotsData: any[]): Promise<Slot[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Delete existing unbooked slots for this clinic on this date
    await db.delete(slots)
      .where(
        and(
          eq(slots.clinicId, clinicId),
          eq(slots.isBooked, false),
          gte(slots.startTime, startOfDay),
          lte(slots.startTime, endOfDay)
        )
      );

    const createdSlots = [];
    for (const slotData of slotsData) {
      const [slot] = await db.insert(slots).values({
        clinicId,
        clinicName: slotData.clinicName,
        startTime: new Date(slotData.startTime),
        endTime: new Date(slotData.endTime),
        isBooked: false,
        ownerId: 'admin' // Default for clinic-managed slots
      }).returning();
      createdSlots.push(slot);
    }
    return createdSlots;
  }

  async getClinicSlots(clinicId: number, date?: string): Promise<Slot[]> {
    let query = db.select().from(slots).where(eq(slots.clinicId, clinicId));
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = db.select().from(slots).where(
        and(
          eq(slots.clinicId, clinicId),
          gte(slots.startTime, startOfDay),
          lte(slots.startTime, endOfDay)
        )
      );
    }
    
    return await (query as any).orderBy(slots.startTime);
  }

  async getClinicBookings(clinicId: number): Promise<(Booking & { slot: Slot; clinic: Clinic })[]> {
    const results = await db.select({
      booking: bookings,
      slot: slots,
      clinic: clinics
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .leftJoin(clinics, eq(slots.clinicId, clinics.id))
    .where(eq(slots.clinicId, Number(clinicId)));
    
    return results.map(r => ({ ...r.booking, slot: r.slot, clinic: r.clinic! }));
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    return this.getBookingById(id);
  }

  async updateBookingStatus(id: number, status: string, confirmedBy?: 'admin' | 'doctor'): Promise<Booking> {
    const [updated] = await db.update(bookings)
      .set({ verificationStatus: status as any, ...(confirmedBy ? { confirmedBy } : {}) })
      .where(eq(bookings.id, id))
      .returning();
    
    if (status === 'cancelled') {
      const booking = await this.getBookingById(id);
      if (booking) {
        await this.updateSlot(booking.slotId, { isBooked: false });
      }
    }
    
    return updated;
  }

  async updateBookingAssignment(id: number, doctorName: string, doctorEmail?: string | null, doctorApprovalStatus?: string | null): Promise<Booking> {
    const [updated] = await db.update(bookings)
      .set({ 
        assignedDoctor: doctorName,
        assignedDoctorEmail: doctorEmail || null,
        doctorApprovalStatus: doctorApprovalStatus !== undefined ? doctorApprovalStatus : 'pending',
      })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async updateBookingDoctorApproval(id: number, doctorEmail: string, status: 'approved' | 'declined'): Promise<Booking> {
    const booking = await this.getBookingById(id);
    if (!booking) throw new Error("Booking not found");
    if (booking.assignedDoctorEmail !== doctorEmail) throw new Error("Forbidden");
    const extraFields = status === 'approved'
      ? { verificationStatus: 'confirmed' as const, confirmedBy: 'doctor' as const }
      : {};
    const [updated] = await db.update(bookings)
      .set({ doctorApprovalStatus: status, ...extraFields })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async rescheduleBooking(id: number, newSlotId: number): Promise<Booking> {
    const [updated] = await db.update(bookings)
      .set({ slotId: newSlotId })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async updateBookingDoctorNotes(id: number, doctorEmail: string, notes: string | null, clinicalStatus: string | null): Promise<Booking> {
    // Verify the booking is assigned to this doctor before allowing update
    const booking = await this.getBookingById(id);
    if (!booking) throw new Error("Booking not found");
    if (booking.assignedDoctorEmail !== doctorEmail) throw new Error("Forbidden: booking not assigned to this doctor");
    const [updated] = await db.update(bookings)
      .set({ doctorNotes: notes, clinicalStatus })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async updateClinicCredentials(id: number, username: string, passwordHash: string): Promise<void> {
    await db.update(clinics)
      .set({ username, passwordHash })
      .where(eq(clinics.id, id));
  }

  async createPublicBooking(data: {
    slotId: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    description?: string | null;
    verificationCode?: string | null;
    verificationExpiresAt?: Date | null;
    verificationStatus?: 'pending' | 'verified' | 'confirmed';
    paymentStatus?: string | null;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
  }): Promise<Booking> {
    const [booking] = await db.insert(bookings).values({
      slotId: data.slotId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      description: data.description || null,
      verificationCode: data.verificationCode || null,
      verificationStatus: data.verificationStatus || 'verified',
      verificationExpiresAt: data.verificationExpiresAt || null,
      paymentStatus: data.paymentStatus || null,
      razorpayOrderId: data.razorpayOrderId || null,
      razorpayPaymentId: data.razorpayPaymentId || null,
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

  async cancelBooking(id: number): Promise<void> {
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
        lte(slots.startTime, endWindow),
        eq(slots.isCancelled, false)
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

  async getSlotByTime(clinicId: number, startTime: Date): Promise<Slot | undefined> {
    const startWindow = new Date(startTime.getTime() - 60000);
    const endWindow = new Date(startTime.getTime() + 60000);

    const [slot] = await db.select()
      .from(slots)
      .where(
        and(
          eq(slots.clinicId, clinicId),
          gte(slots.startTime, startWindow),
          lte(slots.startTime, endWindow)
        )
      )
      .limit(1);
    return slot;
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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Clinics
  async createClinic(insertClinic: InsertClinic): Promise<Clinic> {
    const doctors = insertClinic.doctors as any[];
    const [clinic] = await db.insert(clinics).values([{
      ...insertClinic,
      doctors: doctors || []
    }]).returning();
    return clinic;
  }

  async getClinics(includeArchived: boolean = false): Promise<Clinic[]> {
    try {
      if (includeArchived) {
        return await db.select().from(clinics).orderBy(clinics.name);
      }
      return await db.select().from(clinics)
        .where(eq(clinics.isArchived, false))
        .orderBy(clinics.name);
    } catch (err: any) {
      console.error("[STORAGE ERROR] getClinics failed:", err);
      throw err;
    }
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
    // Filter out logoUrl if it's undefined to avoid issues with older schema versions
    // though db:push should have fixed it.
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

  // Doctors
  async getDoctorByEmail(email: string): Promise<Doctor | undefined> {
    const [doctor] = await db.select().from(doctors).where(eq(doctors.email, email));
    return doctor;
  }

  async createDoctor(insertDoctor: InsertDoctor): Promise<Doctor> {
    const [doctor] = await db.insert(doctors).values(insertDoctor).returning();
    return doctor;
  }

  async linkDoctorToClinic(clinicId: number, doctorId: number): Promise<ClinicDoctor> {
    const [link] = await db.insert(clinicDoctors).values({ clinicId, doctorId }).returning();
    return link;
  }

  async getClinicDoctors(clinicId: number): Promise<Doctor[]> {
    const results = await db.select({
      doctor: doctors
    })
    .from(doctors)
    .innerJoin(clinicDoctors, eq(doctors.id, clinicDoctors.doctorId))
    .where(eq(clinicDoctors.clinicId, clinicId));
    
    return results.map(r => r.doctor);
  }

  async getPatientsByDoctor(doctorId: number): Promise<(Patient & { clinic: Clinic })[]> {
    const results = await db.select({
      patient: patients,
      clinic: clinics
    })
    .from(patients)
    .innerJoin(clinics, eq(patients.clinicId, clinics.id))
    .where(eq(patients.doctorId, doctorId));
    
    return results.map(r => ({ ...r.patient, clinic: r.clinic }));
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const [patient] = await db.insert(patients).values(insertPatient).returning();
    return patient;
  }

  // Doctor Profile
  async getDoctorById(id: number): Promise<Doctor | null> {
    const [doc] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
    return doc ?? null;
  }

  async updateDoctorProfile(id: number, updates: Partial<Doctor>): Promise<Doctor> {
    const allowed = { name: updates.name, specialization: updates.specialization, degree: updates.degree, college: (updates as any).college, bio: (updates as any).bio, phone: (updates as any).phone, imageUrl: updates.imageUrl, yearsOfExperience: (updates as any).yearsOfExperience, languages: (updates as any).languages, username: (updates as any).username ?? null };
    const clean = Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
    const [updated] = await db.update(doctors).set(clean).where(eq(doctors.id, id)).returning();
    return updated;
  }

  async getDoctorByUsername(username: string): Promise<Doctor | null> {
    const [doc] = await db.select().from(doctors).where(eq(doctors.username, username)).limit(1);
    return doc ?? null;
  }

  // Doctor Certifications
  async getCertificationsByDoctor(doctorId: number): Promise<DoctorCertification[]> {
    return await db.select().from(doctorCertifications).where(eq(doctorCertifications.doctorId, doctorId)).orderBy(desc(doctorCertifications.createdAt));
  }

  async createCertification(cert: InsertDoctorCertification): Promise<DoctorCertification> {
    const [c] = await db.insert(doctorCertifications).values(cert).returning();
    return c;
  }

  async updateCertification(id: number, doctorId: number, updates: Partial<DoctorCertification>): Promise<DoctorCertification> {
    const [c] = await db.update(doctorCertifications).set(updates).where(and(eq(doctorCertifications.id, id), eq(doctorCertifications.doctorId, doctorId))).returning();
    return c;
  }

  async deleteCertification(id: number, doctorId: number): Promise<void> {
    await db.delete(doctorCertifications).where(and(eq(doctorCertifications.id, id), eq(doctorCertifications.doctorId, doctorId)));
  }

  // Doctor Cases
  async getCasesByDoctor(doctorId: number): Promise<DoctorCase[]> {
    return await db.select().from(doctorCases).where(eq(doctorCases.doctorId, doctorId)).orderBy(desc(doctorCases.createdAt));
  }

  async createCase(c: InsertDoctorCase): Promise<DoctorCase> {
    const [created] = await db.insert(doctorCases).values(c).returning();
    return created;
  }

  async updateCase(id: number, doctorId: number, updates: Partial<DoctorCase>): Promise<DoctorCase> {
    const [updated] = await db.update(doctorCases).set(updates).where(and(eq(doctorCases.id, id), eq(doctorCases.doctorId, doctorId))).returning();
    return updated;
  }

  async deleteCase(id: number, doctorId: number): Promise<void> {
    await db.delete(doctorCases).where(and(eq(doctorCases.id, id), eq(doctorCases.doctorId, doctorId)));
  }

  // Smile Deals
  async getSmileDeals(onlyActive: boolean = false): Promise<(SmileDeal & { clinicCity: string | null })[]> {
    const now = new Date();
    const cols = { ...getTableColumns(smileDeals), clinicCity: clinics.city };
    if (onlyActive) {
      return await db.select(cols).from(smileDeals)
        .leftJoin(clinics, eq(smileDeals.clinicId, clinics.id))
        .where(
          and(
            eq(smileDeals.isActive, true),
            or(isNull(smileDeals.expiresAt), gt(smileDeals.expiresAt, now))
          )
        )
        .orderBy(desc(smileDeals.isFeatured), desc(smileDeals.createdAt));
    }
    return await db.select(cols).from(smileDeals)
      .leftJoin(clinics, eq(smileDeals.clinicId, clinics.id))
      .orderBy(desc(smileDeals.isFeatured), desc(smileDeals.createdAt));
  }

  async createSmileDeal(insertDeal: InsertSmileDeal): Promise<SmileDeal> {
    const [deal] = await db.insert(smileDeals).values(insertDeal).returning();
    return deal;
  }

  async updateSmileDeal(id: number, updates: Partial<SmileDeal>): Promise<SmileDeal> {
    const [updated] = await db.update(smileDeals)
      .set(updates)
      .where(eq(smileDeals.id, id))
      .returning();
    return updated;
  }

  async deleteSmileDeal(id: number): Promise<void> {
    await db.delete(smileDeals).where(eq(smileDeals.id, id));
  }

  async incrementDealView(id: number): Promise<void> {
    await db.update(smileDeals)
      .set({ viewCount: sql`${smileDeals.viewCount} + 1` })
      .where(eq(smileDeals.id, id));
  }

  async incrementDealClick(id: number): Promise<void> {
    await db.update(smileDeals)
      .set({ clickCount: sql`${smileDeals.clickCount} + 1` })
      .where(eq(smileDeals.id, id));
  }

  async createExportRecord(data: InsertExportHistory): Promise<ExportHistory> {
    const [record] = await db.insert(exportHistory).values(data).returning();
    return record;
  }

  async getExportHistory(clinicId: number): Promise<ExportHistory[]> {
    return await db.select().from(exportHistory)
      .where(eq(exportHistory.clinicId, clinicId))
      .orderBy(desc(exportHistory.createdAt));
  }

  async getBookingNotes(bookingId: number): Promise<BookingNote[]> {
    return await db.select().from(bookingNotes)
      .where(eq(bookingNotes.bookingId, bookingId))
      .orderBy(bookingNotes.createdAt);
  }

  async createBookingNote(data: InsertBookingNote): Promise<BookingNote> {
    const [note] = await db.insert(bookingNotes).values(data).returning();
    return note;
  }

  // Doctor Leaves
  async getDoctorLeaves(doctorId: number): Promise<DoctorLeave[]> {
    return await db.select().from(doctorLeaves)
      .where(eq(doctorLeaves.doctorId, doctorId))
      .orderBy(doctorLeaves.leaveDate);
  }

  async addDoctorLeave(data: InsertDoctorLeave): Promise<DoctorLeave> {
    const [leave] = await db.insert(doctorLeaves).values(data).returning();
    return leave;
  }

  async removeDoctorLeave(id: number, doctorId: number): Promise<void> {
    await db.delete(doctorLeaves)
      .where(and(eq(doctorLeaves.id, id), eq(doctorLeaves.doctorId, doctorId)));
  }

  async getDoctorLeavesOnDate(date: string, doctorIds: number[]): Promise<DoctorLeave[]> {
    if (doctorIds.length === 0) return [];
    return await db.select().from(doctorLeaves)
      .where(and(
        eq(doctorLeaves.leaveDate, date),
        sql`${doctorLeaves.doctorId} = ANY(${sql.raw(`ARRAY[${doctorIds.join(",")}]::integer[]`)})`,
      ));
  }

  async getAllDoctorLeavesForClinic(doctorIds: number[]): Promise<(DoctorLeave & { doctorEmail?: string; doctorName?: string })[]> {
    if (doctorIds.length === 0) return [];
    const leaves = await db.select({ leave: doctorLeaves, doctor: doctors })
      .from(doctorLeaves)
      .innerJoin(doctors, eq(doctorLeaves.doctorId, doctors.id))
      .where(sql`${doctorLeaves.doctorId} = ANY(${sql.raw(`ARRAY[${doctorIds.join(",")}]::integer[]`)})`);
    return leaves.map(row => ({ ...row.leave, doctorEmail: row.doctor.email, doctorName: row.doctor.name }));
  }

  // Consent Tokens
  async createConsentToken(bookingId: number, clinicId: number, token: string, expiresAt: Date): Promise<ConsentToken> {
    const [ct] = await db.insert(consentTokens).values({ bookingId, clinicId, token, status: 'pending', expiresAt }).returning();
    return ct;
  }

  async getConsentByToken(token: string): Promise<(ConsentToken & { booking: Booking; clinic: Clinic }) | undefined> {
    const rows = await db.select({ ct: consentTokens, booking: bookings, clinic: clinics })
      .from(consentTokens)
      .innerJoin(bookings, eq(consentTokens.bookingId, bookings.id))
      .innerJoin(clinics, eq(consentTokens.clinicId, clinics.id))
      .where(eq(consentTokens.token, token))
      .limit(1);
    if (!rows[0]) return undefined;
    return { ...rows[0].ct, booking: rows[0].booking, clinic: rows[0].clinic };
  }

  async markConsentSigned(token: string, signature: string, ip: string): Promise<void> {
    const [ct] = await db.select().from(consentTokens).where(eq(consentTokens.token, token)).limit(1);
    if (!ct) throw new Error("Consent token not found");
    await db.update(consentTokens).set({ status: 'signed' }).where(eq(consentTokens.token, token));
    await db.update(bookings).set({
      consentSignature: signature,
      consentSignedAt: new Date(),
      consentIp: ip,
    }).where(eq(bookings.id, ct.bookingId));
  }

  // Clinical Records
  async createClinicalRecord(data: InsertClinicalRecord): Promise<ClinicalRecord> {
    const [record] = await db.insert(clinicalRecords).values({
      ...data,
      updatedAt: new Date(),
    }).returning();
    return record;
  }

  async getClinicalRecordsByBookingId(bookingId: number): Promise<ClinicalRecord[]> {
    return db.select().from(clinicalRecords)
      .where(and(eq(clinicalRecords.bookingId, bookingId), eq(clinicalRecords.isDeleted, false)))
      .orderBy(desc(clinicalRecords.createdAt));
  }

  async getClinicalRecordsByClinicId(clinicId: number): Promise<ClinicalRecord[]> {
    return db.select().from(clinicalRecords)
      .where(and(eq(clinicalRecords.clinicId, clinicId), eq(clinicalRecords.isDeleted, false)))
      .orderBy(desc(clinicalRecords.createdAt));
  }

  async updateClinicalRecord(id: number, updates: Partial<Pick<ClinicalRecord, 'diagnosis' | 'prescription' | 'notes' | 'doctorName'>>): Promise<ClinicalRecord> {
    const [record] = await db.update(clinicalRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clinicalRecords.id, id))
      .returning();
    if (!record) throw new Error("Clinical record not found");
    return record;
  }

  async softDeleteClinicalRecord(id: number): Promise<void> {
    await db.update(clinicalRecords)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(clinicalRecords.id, id));
  }

  // ── Inventory ──────────────────────────────────────────────────────────────

  async getInventoryCategories(clinicId: number): Promise<InventoryCategory[]> {
    return db.select().from(inventoryCategories)
      .where(eq(inventoryCategories.clinicId, clinicId))
      .orderBy(inventoryCategories.name);
  }

  async createInventoryCategory(data: InsertInventoryCategory): Promise<InventoryCategory> {
    const [cat] = await db.insert(inventoryCategories).values(data).returning();
    return cat;
  }

  async getInventoryItems(clinicId: number): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems)
      .where(eq(inventoryItems.clinicId, clinicId))
      .orderBy(inventoryItems.name);
  }

  async createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem> {
    const [item] = await db.insert(inventoryItems).values(data).returning();
    return item;
  }

  async updateInventoryItem(id: number, clinicId: number, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const [item] = await db.update(inventoryItems)
      .set(updates)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.clinicId, clinicId)))
      .returning();
    if (!item) throw new Error("Item not found");
    return item;
  }

  async deleteInventoryItem(id: number, clinicId: number): Promise<void> {
    await db.delete(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.clinicId, clinicId)));
  }

  async getStockTransactions(clinicId: number): Promise<(StockTransaction & { itemName: string })[]> {
    const rows = await db
      .select({ tx: stockTransactions, itemName: inventoryItems.name })
      .from(stockTransactions)
      .innerJoin(inventoryItems, eq(stockTransactions.itemId, inventoryItems.id))
      .where(eq(stockTransactions.clinicId, clinicId))
      .orderBy(desc(stockTransactions.performedAt));
    return rows.map(r => ({ ...r.tx, itemName: r.itemName }));
  }

  async createStockTransaction(data: InsertStockTransaction): Promise<StockTransaction> {
    const [tx] = await db.insert(stockTransactions).values(data).returning();
    return tx;
  }

  async getStockAlerts(clinicId: number): Promise<(StockAlert & { itemName: string })[]> {
    const rows = await db
      .select({ alert: stockAlerts, itemName: inventoryItems.name })
      .from(stockAlerts)
      .innerJoin(inventoryItems, eq(stockAlerts.itemId, inventoryItems.id))
      .where(and(eq(stockAlerts.clinicId, clinicId), eq(stockAlerts.isDismissed, false)))
      .orderBy(desc(stockAlerts.createdAt));
    return rows.map(r => ({ ...r.alert, itemName: r.itemName }));
  }

  async createStockAlert(data: InsertStockAlert): Promise<StockAlert> {
    const [alert] = await db.insert(stockAlerts).values(data).returning();
    return alert;
  }

  async dismissStockAlert(id: number, clinicId: number): Promise<void> {
    await db.update(stockAlerts)
      .set({ isDismissed: true })
      .where(and(eq(stockAlerts.id, id), eq(stockAlerts.clinicId, clinicId)));
  }
}

export const storage = new DatabaseStorage();
