import { encryptField, decryptField } from "./encryption.js";
import { 
  users, slots, bookings, notifications, clinics, doctors, clinicDoctors, patients, smileDeals, exportHistory,
  doctorCertifications, doctorCases, bookingNotes, doctorLeaves, consentTokens, consentTextVersions, clinicalRecords,
  inventoryCategories, inventoryItems, stockTransactions, stockAlerts, loginEvents, patientBills, pharmacyStock, patientCharts,
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
  type ConsentTextVersion, type InsertConsentTextVersion,
  type ClinicalRecord, type InsertClinicalRecord,
  type InventoryCategory, type InsertInventoryCategory,
  type InventoryItem, type InsertInventoryItem,
  type StockTransaction, type InsertStockTransaction,
  type PharmacyStockItem, type InsertPharmacyStockItem,
  type StockAlert, type InsertStockAlert,
  type LoginEvent, type InsertLoginEvent,
  type PatientBill, type InsertPatientBill,
  type PatientChart,
  type ClinicAnalyticsResult,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, or, isNull, gt, sql, getTableColumns, count, asc, ilike, isNotNull, lt, ne } from "drizzle-orm";
import { format, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, addWeeks } from "date-fns";

export interface BookingQueryParams {
  filter?: string;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  patientId?: number;
  clinicId?: number;
}

export interface BookingStats {
  todayCount: number;
  todayConfirmedCount: number;
  upcomingCount: number;
  pastCount: number;
  thisWeekCount: number;
  nextWeekCount: number;
  pendingNext7Count: number;
  confirmedNext7Count: number;
  totalPendingCount: number;
  totalAllCount: number;
  totalOwnedCount?: number;
  awaitingApprovalCount?: number;
}

export interface BookingsPagedResult {
  data: (Booking & { slot: Slot; patientCode?: string | null })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: BookingStats;
}

export interface IStorage {
  // Login audit
  createLoginEvent(data: InsertLoginEvent): Promise<LoginEvent>;
  getLoginEvents(limit?: number): Promise<LoginEvent[]>;

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
  getClinicBookingByIdWithSlot(id: number, clinicId: number): Promise<(Booking & { slot: Slot }) | undefined>;
  getDoctorBookingByIdWithSlot(id: number, doctorEmail: string): Promise<(Booking & { slot: Slot }) | undefined>;
  createPublicBooking(data: {
    slotId: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    description?: string | null;
    verificationCode?: string | null;
    verificationExpiresAt?: Date | null;
    verificationStatus?: 'pending' | 'verified' | 'admin_booked';
  }): Promise<Booking>;
  verifyBooking(id: number): Promise<Booking>;
  deletePendingBooking(id: number): Promise<void>;
  cancelBooking(id: number, reason?: string): Promise<void>;
  updateBookingVerification(id: number, code: string, expiresAt: Date): Promise<Booking>;
  countBookingsForClinicTime(clinicId: number, clinicName: string, startTime: Date): Promise<number>;
  countVerifiedBookingsForClinicTime(clinicId: number, clinicName: string, startTime: Date): Promise<number>;
  
  // Missing methods for routes.ts
  configureClinicSlots(clinicId: number, date: string, slots: any[]): Promise<Slot[]>;
  getClinicSlots(clinicId: number, date?: string): Promise<Slot[]>;
  getClinicBookings(clinicId: number): Promise<(Booking & { slot: Slot })[]>;
  getClinicBookingsPaged(clinicId: number, params: BookingQueryParams): Promise<BookingsPagedResult>;
  getDoctorBookingsPaged(doctorEmail: string, params: BookingQueryParams): Promise<BookingsPagedResult>;
  getClinicBookingStats(clinicId: number): Promise<BookingStats>;
  getBooking(id: number): Promise<Booking | undefined>;
  updateBookingStatus(id: number, status: string): Promise<Booking>;
  updateBookingAssignment(id: number, doctorName: string, doctorEmail?: string | null, doctorApprovalStatus?: string | null): Promise<Booking>;
  updateBookingDoctorApproval(id: number, doctorEmail: string, status: 'approved' | 'declined'): Promise<Booking>;
  rescheduleBooking(id: number, newSlotId: number): Promise<Booking>;
  updateBookingDoctorNotes(id: number, doctorEmail: string, notes: string | null, clinicalStatus: string | null): Promise<Booking>;
  updateVisitStatus(id: number, visitStatus: string | null, checkedInAt?: Date | null, completedAt?: Date | null): Promise<Booking>;
  updateClinicCredentials(id: number, username: string, passwordHash: string): Promise<void>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;

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
  upsertPatientByEmail(clinicId: number, email: string, name: string, phone: string): Promise<Patient>;
  upsertPatientByPhone(clinicId: number, phone: string, name: string): Promise<Patient>;
  getPatientByEmail(clinicId: number, email: string): Promise<Patient | null>;
  getPatientsByEmail(clinicId: number, email: string): Promise<Patient[]>;
  getPatientById(clinicId: number, patientId: number): Promise<Patient | null>;
  createNewPatient(clinicId: number, email: string, name: string, phone: string): Promise<Patient>;
  incrementPatientVisit(patientId: number): Promise<Patient>;
  searchPatients(clinicId: number, query: string): Promise<Patient[]>;
  getPatientsByClinic(clinicId: number): Promise<(Patient & { totalBilled: number })[]>;
  getPatientsByClinicPaged(clinicId: number, opts: { q?: string; sort?: string; lastVisitFrom?: string; lastVisitTo?: string; page?: number; pageSize?: number; exportAll?: boolean; }): Promise<{ data: (Patient & { totalBilled: number })[]; total: number; page: number; totalPages: number; stats: { totalAll: number; activeThisMonth: number; newThisMonth: number; totalRevenue: number; }; }>;
  getPatientHistory(clinicId: number, patientId: number): Promise<{ bookings: (Booking & { slot: Slot })[]; bills: PatientBill[]; clinicalRecords: ClinicalRecord[] }>;

  // Doctor Profile
  updateDoctorProfile(id: number, updates: Partial<Doctor>): Promise<Doctor>;
  getDoctorById(id: number): Promise<Doctor | null>;
  getDoctorByUsername(username: string): Promise<Doctor | null>;
  getClinicByDoctorId(doctorId: number): Promise<Clinic | null>;

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
  createConsentToken(bookingId: number, clinicId: number, token: string, expiresAt: Date, consentTextVersionId?: number): Promise<ConsentToken>;
  getConsentByToken(token: string): Promise<(ConsentToken & { booking: Booking; clinic: Clinic }) | undefined>;
  markConsentSigned(token: string, signature: string, ip: string): Promise<void>;

  // Consent Text Versions
  getCurrentConsentVersion(clinicId: number): Promise<ConsentTextVersion | undefined>;
  getClinicConsentVersions(clinicId: number): Promise<ConsentTextVersion[]>;
  createConsentVersion(clinicId: number, data: { title: string; textEn: string; textHash: string; version: string; createdByEmail: string }): Promise<ConsentTextVersion>;

  // Clinical Records
  createClinicalRecord(data: InsertClinicalRecord): Promise<ClinicalRecord>;
  getClinicalRecordsByBookingId(bookingId: number): Promise<ClinicalRecord[]>;
  getClinicalRecordsByClinicId(clinicId: number): Promise<ClinicalRecord[]>;
  updateClinicalRecord(id: number, updates: Partial<Pick<ClinicalRecord, 'diagnosis' | 'prescription' | 'notes' | 'doctorName'>>): Promise<ClinicalRecord>;
  softDeleteClinicalRecord(id: number): Promise<void>;

  // Inventory
  getInventoryCategories(clinicId: number): Promise<InventoryCategory[]>;
  createInventoryCategory(data: InsertInventoryCategory): Promise<InventoryCategory>;
  updateInventoryCategory(id: number, clinicId: number, name: string): Promise<InventoryCategory>;
  deleteInventoryCategory(id: number, clinicId: number): Promise<void>;
  getInventoryItems(clinicId: number): Promise<InventoryItem[]>;
  createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, clinicId: number, updates: Partial<InventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: number, clinicId: number): Promise<void>;
  getStockTransactions(clinicId: number): Promise<(StockTransaction & { itemName: string })[]>;
  createStockTransaction(data: InsertStockTransaction): Promise<StockTransaction>;
  getStockAlerts(clinicId: number): Promise<(StockAlert & { itemName: string })[]>;
  createStockAlert(data: InsertStockAlert): Promise<StockAlert>;
  dismissStockAlert(id: number, clinicId: number): Promise<void>;

  // Patient Bills
  createPatientBill(data: InsertPatientBill): Promise<PatientBill>;
  getPatientBillById(id: number, clinicId: number): Promise<PatientBill | null>;
  getPatientBillsByClinicId(clinicId: number): Promise<(PatientBill & { patientCode?: string | null })[]>;
  getPatientBillsByBookingId(bookingId: number, clinicId: number): Promise<PatientBill[]>;
  getPatientBillsByPatientId(clinicId: number, patientId: number): Promise<PatientBill[]>;
  getPatientBillsByPhone(clinicId: number, phone: string): Promise<PatientBill[]>;
  getPatientBillsByEmail(clinicId: number, email: string): Promise<PatientBill[]>;
  updatePatientBill(id: number, clinicId: number, updates: Partial<PatientBill>): Promise<PatientBill>;
  deletePatientBill(id: number, clinicId: number): Promise<void>;
  // Paginated bill listing for Accounts panel (Register view)
  getPatientBillsByClinicIdPaged(clinicId: number, opts: {
    q?: string; status?: string; dateFrom?: string; dateTo?: string; sort?: string;
    page?: number; pageSize?: number; exportAll?: boolean;
  }): Promise<{
    data: (PatientBill & { patientCode?: string | null })[];
    total: number; page: number; totalPages: number;
    stats: { totalRevenue: number; pendingAmt: number; paidCount: number; overdueCount: number; overdueAmt: number; };
  }>;
  // Paginated patient-group listing for Accounts panel (Ledger view)
  getPatientBillGroupsByClinicIdPaged(clinicId: number, opts: {
    q?: string; status?: string; dateFrom?: string; dateTo?: string; sort?: string;
    page?: number; pageSize?: number; exportAll?: boolean;
  }): Promise<{
    data: {
      key: string; patientId: number | null; patientCode: string | null;
      name: string; email: string; phone: string;
      bills: (PatientBill & { patientCode?: string | null })[];
      totalBilled: number; totalCollected: number; outstanding: number;
      oldestUnpaidDays: number; hasOverdue: boolean;
    }[];
    total: number; page: number; totalPages: number;
    stats: { totalRevenue: number; pendingAmt: number; paidCount: number; overdueCount: number; overdueAmt: number; };
  }>;

  // Pharmacy Stock
  getPharmacyStock(clinicId: number): Promise<PharmacyStockItem[]>;
  getPharmacyStockPaged(clinicId: number, opts: {
    q?: string; sort?: string; page?: number; pageSize?: number;
  }): Promise<{
    data: PharmacyStockItem[]; total: number; page: number; totalPages: number;
    stats: { total: number; expiringSoon: number; expired: number; lowStock: number };
  }>;
  createPharmacyItem(data: InsertPharmacyStockItem): Promise<PharmacyStockItem>;
  updatePharmacyItem(id: number, clinicId: number, updates: Partial<PharmacyStockItem>): Promise<PharmacyStockItem>;
  deletePharmacyItem(id: number, clinicId: number): Promise<void>;

  // Analytics
  getClinicAnalytics(clinicId: number, range: string): Promise<ClinicAnalyticsResult>;

  // Patient Charts (Odontogram)
  getPatientChart(patientId: number, clinicId: number): Promise<PatientChart | null>;
  upsertPatientChart(patientId: number, clinicId: number, chartData: string): Promise<PatientChart>;
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
    return await db.transaction(async (tx) => {
      const [booking] = await tx.insert(bookings).values({
        slotId: insertBooking.slotId,
        customerId: insertBooking.customerId,
        customerName: insertBooking.customerName,
        customerPhone: insertBooking.customerPhone,
        customerEmail: insertBooking.customerEmail,
      }).returning();

      // Mark slot as booked — atomic with booking insert; rolls back if this fails
      await tx.update(slots).set({ isBooked: true }).where(eq(slots.id, booking.slotId));

      return booking;
    });
  }

  private decryptBooking<T extends Partial<Booking>>(b: T): T {
    return {
      ...b,
      doctorNotes: decryptField(b.doctorNotes as string | null) as any,
      consentSignature: decryptField(b.consentSignature as string | null) as any,
    };
  }

  private decryptClinicalRecord<T extends Partial<ClinicalRecord>>(r: T): T {
    return {
      ...r,
      prescription: decryptField(r.prescription as string | null) as any,
      notes: decryptField(r.notes as string | null) as any,
    };
  }

  async getBookings(userId: string, role: string): Promise<(Booking & { slot: Slot })[]> {
    if (role === 'owner') {
      const results = await db.select({
        booking: bookings,
        slot: slots
      })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(eq(slots.ownerId, userId));
      
      return results.map(r => ({ ...this.decryptBooking(r.booking), slot: r.slot }));
    } else {
      const results = await db.select({
        booking: bookings,
        slot: slots
      })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(eq(bookings.customerId, userId));
      
      return results.map(r => ({ ...this.decryptBooking(r.booking), slot: r.slot }));
    }
  }

  async getBookingsByClinicId(clinicId: number): Promise<(Booking & { slot: Slot })[]> {
    const clinic = await this.getClinic(clinicId);
    
    const results = await db.select({
      booking: bookings,
      slot: slots
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id));
    
    const filtered = results.filter(r => 
      r.slot.clinicId === clinicId || 
      (r.slot.clinicId === null && clinic && r.slot.clinicName === clinic.name)
    );
    
    return filtered.map(r => ({ ...this.decryptBooking(r.booking), slot: r.slot }));
  }

  async getBookingById(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking ? this.decryptBooking(booking) : undefined;
  }

  async getClinicBookingByIdWithSlot(id: number, clinicId: number): Promise<(Booking & { slot: Slot }) | undefined> {
    const [result] = await db.select({
      booking: bookings,
      slot: slots
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(eq(bookings.id, id));

    if (!result) return undefined;

    const clinic = await this.getClinic(clinicId);
    const belongsToClinic = result.slot.clinicId === clinicId ||
      (result.slot.clinicId === null && clinic && result.slot.clinicName === clinic.name);
    if (!belongsToClinic) return undefined;

    return { ...this.decryptBooking(result.booking), slot: result.slot };
  }

  async getDoctorBookingByIdWithSlot(id: number, doctorEmail: string): Promise<(Booking & { slot: Slot }) | undefined> {
    const [result] = await db.select({
      booking: bookings,
      slot: slots
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(and(eq(bookings.id, id), eq(bookings.assignedDoctorEmail, doctorEmail)));

    if (!result) return undefined;
    return { ...this.decryptBooking(result.booking), slot: result.slot };
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

  async getClinicBookings(clinicId: number): Promise<(Booking & { slot: Slot; patientCode?: string | null })[]> {
    const results = await db.select({
      booking: bookings,
      slot: slots,
      patientCode: patients.patientCode,
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .leftJoin(patients, eq(bookings.patientId, patients.id))
    .where(eq(slots.clinicId, Number(clinicId)));
    
    return results.map(r => ({ ...this.decryptBooking(r.booking), slot: r.slot, patientCode: r.patientCode }));
  }

  async getClinicBookingStats(clinicId: number): Promise<BookingStats> {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayStart = startOfDay(now);
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const next7DaysEnd = addDays(todayStart, 7);

    const statRows = await db.select({
      startTime: slots.startTime,
      verificationStatus: bookings.verificationStatus,
      confirmedBy: bookings.confirmedBy,
      visitStatus: bookings.visitStatus,
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(eq(slots.clinicId, Number(clinicId)));

    const stats: BookingStats = {
      todayCount: 0, todayConfirmedCount: 0, upcomingCount: 0, pastCount: 0,
      thisWeekCount: 0, nextWeekCount: 0, pendingNext7Count: 0, confirmedNext7Count: 0,
      totalPendingCount: 0, totalAllCount: statRows.length,
    };
    for (const r of statRows) {
      const d = new Date(r.startTime);
      const dateStr = format(d, 'yyyy-MM-dd');
      const isConfirmed = r.verificationStatus === 'confirmed' || !!r.confirmedBy;
      const isPending = !isConfirmed && r.verificationStatus !== 'cancelled';
      if (dateStr === todayStr) { stats.todayCount++; if (isConfirmed) stats.todayConfirmedCount++; }
      if (d >= new Date() && r.visitStatus !== 'completed' && r.visitStatus !== 'patient_left_early') stats.upcomingCount++;
      if (d < todayStart) stats.pastCount++;
      if (d >= thisWeekStart && d <= thisWeekEnd) stats.thisWeekCount++;
      if (d >= nextWeekStart && d <= nextWeekEnd) stats.nextWeekCount++;
      if (d >= todayStart && d <= next7DaysEnd) {
        if (isPending) stats.pendingNext7Count++;
        if (isConfirmed) stats.confirmedNext7Count++;
      }
      if (isPending) stats.totalPendingCount++;
    }
    return stats;
  }

  async getClinicBookingsPaged(clinicId: number, params: BookingQueryParams): Promise<BookingsPagedResult> {
    const { filter = 'all', page = 1, pageSize = 20, dateFrom, dateTo, search, patientId } = params;

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const tomorrowStart = startOfDay(addDays(now, 1));
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const next7DaysEnd = addDays(todayStart, 7);

    const clinicCondition = eq(slots.clinicId, Number(clinicId));

    // Build filter condition based on quick filter or date range
    let filterCond;
    if (dateFrom || dateTo) {
      const from = dateFrom ? startOfDay(new Date(dateFrom)) : undefined;
      const to = dateTo ? endOfDay(new Date(dateTo)) : undefined;
      if (from && to) filterCond = and(gte(slots.startTime, from), lte(slots.startTime, to));
      else if (from) filterCond = gte(slots.startTime, from);
      else if (to) filterCond = lte(slots.startTime, to);
    } else {
      switch (filter) {
        case 'today':
          filterCond = and(gte(slots.startTime, todayStart), lte(slots.startTime, todayEnd));
          break;
        case 'upcoming':
          filterCond = and(gte(slots.startTime, tomorrowStart), ne(bookings.visitStatus, 'completed'), ne(bookings.visitStatus, 'patient_left_early'));
          break;
        case 'past':
          filterCond = lt(slots.startTime, todayStart);
          break;
        case 'this-week':
          filterCond = and(gte(slots.startTime, thisWeekStart), lte(slots.startTime, thisWeekEnd));
          break;
        case 'next-week':
          filterCond = and(gte(slots.startTime, nextWeekStart), lte(slots.startTime, nextWeekEnd));
          break;
        case 'today-confirmed':
          filterCond = and(
            gte(slots.startTime, todayStart), lte(slots.startTime, todayEnd),
            or(eq(bookings.verificationStatus, 'confirmed'), isNotNull(bookings.confirmedBy)),
          );
          break;
        case 'pending-7days':
          filterCond = and(
            gte(slots.startTime, todayStart), lt(slots.startTime, next7DaysEnd),
            ne(bookings.verificationStatus, 'confirmed'), isNull(bookings.confirmedBy),
            ne(bookings.verificationStatus, 'cancelled'),
          );
          break;
        case 'all-pending':
          filterCond = and(ne(bookings.verificationStatus, 'confirmed'), isNull(bookings.confirmedBy), ne(bookings.verificationStatus, 'cancelled'));
          break;
        case 'confirmed-7days':
          filterCond = and(
            gte(slots.startTime, todayStart), lt(slots.startTime, next7DaysEnd),
            or(eq(bookings.verificationStatus, 'confirmed'), isNotNull(bookings.confirmedBy)),
          );
          break;
        default:
          filterCond = undefined;
      }
    }

    // Search condition (patient name, phone, email)
    let searchCond;
    if (search && search.trim().length >= 1) {
      const term = `%${search.trim()}%`;
      searchCond = or(ilike(bookings.customerName, term), ilike(bookings.customerPhone, term));
    }

    // Patient filter
    const patientCond = patientId ? eq(bookings.patientId, patientId) : undefined;

    const whereClause = and(clinicCondition, filterCond, searchCond, patientCond);

    // Count total matching rows
    const [countRow] = await db.select({ total: count() })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(whereClause);
    const total = Number(countRow?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    // Fetch paginated data
    const results = await db.select({
      booking: bookings,
      slot: slots,
      patientCode: patients.patientCode,
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .leftJoin(patients, eq(bookings.patientId, patients.id))
    .where(whereClause)
    .orderBy(asc(slots.startTime), asc(bookings.id))
    .limit(pageSize)
    .offset(offset);

    // Lightweight stats across ALL clinic bookings (independent of current filter)
    const statRows = await db.select({
      startTime: slots.startTime,
      verificationStatus: bookings.verificationStatus,
      confirmedBy: bookings.confirmedBy,
      visitStatus: bookings.visitStatus,
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(clinicCondition);

    const stats: BookingStats = {
      todayCount: 0, todayConfirmedCount: 0, upcomingCount: 0, pastCount: 0,
      thisWeekCount: 0, nextWeekCount: 0, pendingNext7Count: 0, confirmedNext7Count: 0,
      totalPendingCount: 0, totalAllCount: statRows.length,
    };
    for (const r of statRows) {
      const d = new Date(r.startTime);
      const dateStr = format(d, 'yyyy-MM-dd');
      const isConfirmed = r.verificationStatus === 'confirmed' || !!r.confirmedBy;
      const isPending = !isConfirmed && r.verificationStatus !== 'cancelled';
      if (dateStr === todayStr) { stats.todayCount++; if (isConfirmed) stats.todayConfirmedCount++; }
      if (d >= now && r.visitStatus !== 'completed' && r.visitStatus !== 'patient_left_early') stats.upcomingCount++;
      if (d < todayStart) stats.pastCount++;
      if (d >= thisWeekStart && d <= thisWeekEnd) stats.thisWeekCount++;
      if (d >= nextWeekStart && d <= nextWeekEnd) stats.nextWeekCount++;
      if (d >= todayStart && d <= next7DaysEnd) {
        if (isPending) stats.pendingNext7Count++;
        if (isConfirmed) stats.confirmedNext7Count++;
      }
      if (isPending) stats.totalPendingCount++;
    }

    const data = results.map(r => ({ ...this.decryptBooking(r.booking), slot: r.slot, patientCode: r.patientCode }));
    return { data, total, page: safePage, pageSize, totalPages, stats };
  }

  async getDoctorBookingsPaged(doctorEmail: string, params: BookingQueryParams): Promise<BookingsPagedResult> {
    const { filter = 'all', page = 1, pageSize = 20, dateFrom, dateTo, clinicId, search } = params;

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const tomorrowStart = startOfDay(addDays(now, 1));
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const next7DaysEnd = addDays(todayStart, 7);

    const emailCond = eq(bookings.assignedDoctorEmail, doctorEmail);
    const clinicCond = clinicId ? eq(slots.clinicId, clinicId) : undefined;

    // "approved" = not pending AND not declined doctor approval
    const approvedCond = and(
      ne(bookings.doctorApprovalStatus, 'pending'),
      ne(bookings.doctorApprovalStatus, 'declined'),
    );
    // "awaiting" = pending doctor approval, slot is today or future, not cancelled/terminal
    const awaitingCond = and(
      eq(bookings.doctorApprovalStatus, 'pending'),
      ne(bookings.verificationStatus, 'cancelled'),
      ne(bookings.verificationStatus, 'no_show'),
      ne(bookings.visitStatus, 'completed'),
      ne(bookings.visitStatus, 'patient_left_early'),
      ne(bookings.visitStatus, 'treatment_completed'),
      gte(slots.startTime, todayStart),
    );
    // Patient name/phone/email search (plain text columns — no encryption)
    const searchCond = search
      ? or(
          ilike(bookings.customerName, `%${search}%`),
          ilike(bookings.customerPhone, `%${search}%`),
          ilike(bookings.customerEmail, `%${search}%`),
        )
      : undefined;

    let filterCond;
    if (dateFrom || dateTo) {
      // Date-range: show ALL assigned bookings in range (no approval filter)
      const from = dateFrom ? startOfDay(new Date(dateFrom)) : undefined;
      const to   = dateTo   ? endOfDay(new Date(dateTo))     : undefined;
      if (from && to) filterCond = and(gte(slots.startTime, from), lte(slots.startTime, to));
      else if (from)  filterCond = and(gte(slots.startTime, from));
      else            filterCond = and(lte(slots.startTime, to!));
    } else {
      switch (filter) {
        case 'today':
          filterCond = and(approvedCond, gte(slots.startTime, todayStart), lte(slots.startTime, todayEnd));
          break;
        case 'upcoming':
          filterCond = and(approvedCond, gte(slots.startTime, tomorrowStart), ne(bookings.visitStatus, 'completed'), ne(bookings.visitStatus, 'patient_left_early'));
          break;
        case 'past':
          filterCond = and(approvedCond, lt(slots.startTime, todayStart));
          break;
        case 'this-week':
          filterCond = and(approvedCond, gte(slots.startTime, thisWeekStart), lte(slots.startTime, thisWeekEnd));
          break;
        case 'next-week':
          filterCond = and(approvedCond, gte(slots.startTime, nextWeekStart), lte(slots.startTime, nextWeekEnd));
          break;
        case 'confirmed-7days':
          filterCond = and(approvedCond, gte(slots.startTime, todayStart), lt(slots.startTime, next7DaysEnd));
          break;
        case 'awaiting':
          filterCond = awaitingCond;
          break;
        case 'pending-7days':
          filterCond = and(awaitingCond, lt(slots.startTime, next7DaysEnd));
          break;
        case 'owned':
          // "All Owned" = appointments the doctor has accepted (approved/admin_confirmed), all dates
          filterCond = approvedCond;
          break;
        case 'all':
          // "All Bookings" = every booking assigned to this doctor, any approval status
          filterCond = undefined;
          break;
        default:
          filterCond = approvedCond;
      }
    }

    const whereClause = and(emailCond, clinicCond, filterCond, searchCond);

    const [countRow] = await db.select({ total: count() })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(whereClause);
    const total = Number(countRow?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const results = await db.select({
      booking: bookings,
      slot: slots,
      clinic: clinics,
      patientCode: patients.patientCode,
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .leftJoin(clinics, eq(slots.clinicId, clinics.id))
    .leftJoin(patients, eq(bookings.patientId, patients.id))
    .where(whereClause)
    .orderBy(asc(slots.startTime), asc(bookings.id))
    .limit(pageSize)
    .offset(offset);

    // Stats across ALL bookings assigned to this doctor (independent of filter)
    const statRows = await db.select({
      startTime: slots.startTime,
      verificationStatus: bookings.verificationStatus,
      confirmedBy: bookings.confirmedBy,
      visitStatus: bookings.visitStatus,
      doctorApprovalStatus: bookings.doctorApprovalStatus,
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(and(emailCond, clinicCond));

    const stats: BookingStats = {
      todayCount: 0, todayConfirmedCount: 0, upcomingCount: 0, pastCount: 0,
      thisWeekCount: 0, nextWeekCount: 0, pendingNext7Count: 0, confirmedNext7Count: 0,
      totalPendingCount: 0, totalAllCount: statRows.length, totalOwnedCount: 0, awaitingApprovalCount: 0,
    };
    for (const r of statRows) {
      const d = new Date(r.startTime);
      const dateStr = format(d, 'yyyy-MM-dd');
      const isApproved = r.doctorApprovalStatus !== 'pending' && r.doctorApprovalStatus !== 'declined';
      const isAwaiting = r.doctorApprovalStatus === 'pending'
        && r.verificationStatus !== 'cancelled'
        && r.verificationStatus !== 'no_show'
        && r.visitStatus !== 'completed'
        && r.visitStatus !== 'patient_left_early'
        && r.visitStatus !== 'treatment_completed'
        && d >= todayStart;
      const isConfirmed = r.verificationStatus === 'confirmed' || !!r.confirmedBy;
      const isPending = !isConfirmed && r.verificationStatus !== 'cancelled';
      if (isAwaiting) stats.awaitingApprovalCount!++;
      if (isApproved) {
        stats.totalOwnedCount!++;
        if (dateStr === todayStr) { stats.todayCount++; if (isConfirmed) stats.todayConfirmedCount++; }
        // "upcoming" boundary matches the server filter: tomorrowStart (not now), so today's slots don't inflate the count
        if (d >= tomorrowStart && r.visitStatus !== 'completed' && r.visitStatus !== 'patient_left_early') stats.upcomingCount++;
        if (d < todayStart) stats.pastCount++;
        if (d >= thisWeekStart && d <= thisWeekEnd) stats.thisWeekCount++;
        if (d >= nextWeekStart && d <= nextWeekEnd) stats.nextWeekCount++;
      }
      if (d >= todayStart && d < next7DaysEnd) {
        if (isAwaiting) stats.pendingNext7Count++;
        if (isApproved && isConfirmed) stats.confirmedNext7Count++;
      }
      if (isPending) stats.totalPendingCount++;
    }

    const data = results.map(r => ({
      ...this.decryptBooking(r.booking),
      slot: r.slot,
      clinic: (r as any).clinic,
      clinicId: r.slot.clinicId,
      patientCode: r.patientCode,
    }));
    return { data, total, page: safePage, pageSize, totalPages, stats };
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    return this.getBookingById(id);
  }

  async updateBookingStatus(id: number, status: string, confirmedBy?: 'admin' | 'doctor'): Promise<Booking> {
    return await db.transaction(async (tx) => {
      const [updated] = await tx.update(bookings)
        .set({ verificationStatus: status as any, ...(confirmedBy ? { confirmedBy } : {}) })
        .where(eq(bookings.id, id))
        .returning();

      if (status === 'cancelled' && updated) {
        // Release the slot atomically — .returning() already gives us slotId, no extra query needed
        await tx.update(slots).set({ isBooked: false }).where(eq(slots.id, updated.slotId));
      }

      return updated;
    });
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
    const booking = await this.getBookingById(id);
    if (!booking) throw new Error("Booking not found");
    if (booking.assignedDoctorEmail !== doctorEmail) throw new Error("Forbidden: booking not assigned to this doctor");
    const [updated] = await db.update(bookings)
      .set({ doctorNotes: encryptField(notes), clinicalStatus })
      .where(eq(bookings.id, id))
      .returning();
    return this.decryptBooking(updated);
  }

  async updateVisitStatus(id: number, visitStatus: string | null, checkedInAt?: Date | null, completedAt?: Date | null, visitCompletionNote?: string | null): Promise<Booking> {
    const setFields: Record<string, any> = { visitStatus };
    if (checkedInAt !== undefined) setFields.checkedInAt = checkedInAt;
    if (completedAt !== undefined) setFields.completedAt = completedAt;
    if (visitCompletionNote !== undefined) setFields.visitCompletionNote = visitCompletionNote;
    const [updated] = await db.update(bookings)
      .set(setFields)
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
    customerAge?: number | null;
    customerGender?: string | null;
    description?: string | null;
    verificationCode?: string | null;
    verificationExpiresAt?: Date | null;
    verificationStatus?: 'pending' | 'verified' | 'confirmed' | 'admin_booked';
    paymentStatus?: string | null;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
  }): Promise<Booking> {
    const [booking] = await db.insert(bookings).values({
      slotId: data.slotId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      customerAge: data.customerAge || null,
      customerGender: data.customerGender || null,
      description: data.description || null,
      verificationCode: data.verificationCode || null,
      verificationStatus: data.verificationStatus || 'verified',
      verificationExpiresAt: data.verificationExpiresAt || null,
      paymentStatus: data.paymentStatus || null,
      razorpayOrderId: data.razorpayOrderId || null,
      razorpayPaymentId: data.razorpayPaymentId || null,
    } as any).returning();
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
      await db.transaction(async (tx) => {
        // Delete booking then slot atomically — orphan slot impossible if server crashes mid-way
        await tx.delete(bookings).where(eq(bookings.id, id));
        await tx.delete(slots).where(eq(slots.id, booking.slotId));
      });
    }
  }

  async cancelBooking(id: number, reason?: string): Promise<void> {
    await db.update(bookings)
      .set({ verificationStatus: 'cancelled', ...(reason ? { cancellationReason: reason } : {}) })
      .where(eq(bookings.id, id));
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

    // Sum slot_cost for all active bookings (COALESCE to 1 for legacy rows without slot_cost)
    const verifiedBookings = results.filter(r => {
      const isMatchingClinic = r.slot.clinicId === clinicId || r.slot.clinicName === clinicName;
      const isActive = !['cancelled', 'pending'].includes(r.booking.verificationStatus ?? '');
      return isMatchingClinic && isActive;
    });

    return verifiedBookings.reduce((sum, r) => sum + ((r.booking as any).slotCost ?? 1), 0);
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

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  }

  // Auth User wrapper
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Clinics
  async createClinic(insertClinic: InsertClinic): Promise<Clinic> {
    const doctors = insertClinic.doctors as any[];
    const [clinic] = await db.insert(clinics).values({
      ...insertClinic,
      doctors: doctors || []
    } as any).returning();
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
    const allowed = { name: updates.name, specialization: updates.specialization, degree: updates.degree, college: (updates as any).college, bio: (updates as any).bio, phone: (updates as any).phone, imageUrl: updates.imageUrl, yearsOfExperience: (updates as any).yearsOfExperience, languages: (updates as any).languages, username: (updates as any).username ?? null, treatments: (updates as any).treatments, introVideoUrl: (updates as any).introVideoUrl };
    const clean = Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
    const [updated] = await db.update(doctors).set(clean).where(eq(doctors.id, id)).returning();
    return updated;
  }

  async getDoctorByUsername(username: string): Promise<Doctor | null> {
    const [doc] = await db.select().from(doctors).where(eq(doctors.username, username)).limit(1);
    return doc ?? null;
  }

  async getClinicByDoctorId(doctorId: number): Promise<Clinic | null> {
    const [row] = await db
      .select({ clinic: clinics })
      .from(clinicDoctors)
      .innerJoin(clinics, eq(clinicDoctors.clinicId, clinics.id))
      .where(eq(clinicDoctors.doctorId, doctorId))
      .limit(1);
    return row?.clinic ?? null;
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
    const [created] = await db.insert(doctorCases).values(c as any).returning();
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
    const [deal] = await db.insert(smileDeals).values(insertDeal as any).returning();
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
  async createConsentToken(bookingId: number, clinicId: number, token: string, expiresAt: Date, consentTextVersionId?: number): Promise<ConsentToken> {
    const [ct] = await db.insert(consentTokens).values({ bookingId, clinicId, token, status: 'pending', expiresAt, consentTextVersionId: consentTextVersionId ?? null } as any).returning();
    return ct;
  }

  // Consent Text Versions
  async getCurrentConsentVersion(clinicId: number): Promise<ConsentTextVersion | undefined> {
    // First try clinic-specific current version
    const clinicRows = await db.select().from(consentTextVersions)
      .where(and(eq(consentTextVersions.clinicId, clinicId), eq(consentTextVersions.isCurrent, true)))
      .limit(1);
    if (clinicRows[0]) return clinicRows[0];
    // Fall back to global default (clinic_id IS NULL)
    const globalRows = await db.select().from(consentTextVersions)
      .where(and(isNull(consentTextVersions.clinicId), eq(consentTextVersions.isCurrent, true)))
      .limit(1);
    return globalRows[0];
  }

  async getClinicConsentVersions(clinicId: number): Promise<ConsentTextVersion[]> {
    // Return clinic-specific + global default versions ordered newest first
    const rows = await db.select().from(consentTextVersions)
      .where(or(eq(consentTextVersions.clinicId, clinicId), isNull(consentTextVersions.clinicId)))
      .orderBy(desc(consentTextVersions.createdAt));
    return rows;
  }

  async createConsentVersion(clinicId: number, data: { title: string; textEn: string; textHash: string; version: string; createdByEmail: string }): Promise<ConsentTextVersion> {
    // Mark any existing clinic-specific current as not-current
    await db.update(consentTextVersions)
      .set({ isCurrent: false })
      .where(and(eq(consentTextVersions.clinicId, clinicId), eq(consentTextVersions.isCurrent, true)));
    const [v] = await db.insert(consentTextVersions).values({
      clinicId,
      version: data.version,
      title: data.title,
      textEn: data.textEn,
      textHash: data.textHash,
      isCurrent: true,
      createdByEmail: data.createdByEmail,
      effectiveFrom: new Date(),
    } as any).returning();
    return v;
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
      consentSignature: encryptField(signature),
      consentSignedAt: new Date(),
      consentIp: ip,
    }).where(eq(bookings.id, ct.bookingId));
  }

  // Clinical Records
  async createClinicalRecord(data: InsertClinicalRecord): Promise<ClinicalRecord> {
    const encryptedData = {
      ...data,
      prescription: encryptField(data.prescription ?? null),
      notes: encryptField(data.notes ?? null),
    };
    const [record] = await db.insert(clinicalRecords).values(encryptedData as any).returning();
    return this.decryptClinicalRecord(record);
  }

  async getClinicalRecordsByBookingId(bookingId: number): Promise<ClinicalRecord[]> {
    const rows = await db.select().from(clinicalRecords)
      .where(and(eq(clinicalRecords.bookingId, bookingId), eq(clinicalRecords.isDeleted, false)))
      .orderBy(desc(clinicalRecords.createdAt));
    return rows.map(r => this.decryptClinicalRecord(r));
  }

  async getClinicalRecordsByClinicId(clinicId: number): Promise<ClinicalRecord[]> {
    const rows = await db.select().from(clinicalRecords)
      .where(and(eq(clinicalRecords.clinicId, clinicId), eq(clinicalRecords.isDeleted, false)))
      .orderBy(desc(clinicalRecords.createdAt));
    return rows.map(r => this.decryptClinicalRecord(r));
  }

  async updateClinicalRecord(id: number, updates: Partial<Pick<ClinicalRecord, 'diagnosis' | 'prescription' | 'notes' | 'doctorName'>>): Promise<ClinicalRecord> {
    const encryptedUpdates = {
      ...updates,
      ...(updates.prescription !== undefined ? { prescription: encryptField(updates.prescription) } : {}),
      ...(updates.notes !== undefined ? { notes: encryptField(updates.notes) } : {}),
    };
    const [record] = await db.update(clinicalRecords)
      .set({ ...encryptedUpdates, updatedAt: new Date() })
      .where(eq(clinicalRecords.id, id))
      .returning();
    if (!record) throw new Error("Clinical record not found");
    return this.decryptClinicalRecord(record);
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

  async updateInventoryCategory(id: number, clinicId: number, name: string): Promise<InventoryCategory> {
    const [cat] = await db.update(inventoryCategories)
      .set({ name })
      .where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.clinicId, clinicId)))
      .returning();
    if (!cat) throw new Error("Category not found");
    return cat;
  }

  async deleteInventoryCategory(id: number, clinicId: number): Promise<void> {
    await db.delete(inventoryCategories)
      .where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.clinicId, clinicId)));
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

  async createLoginEvent(data: InsertLoginEvent): Promise<LoginEvent> {
    const [event] = await db.insert(loginEvents).values(data).returning();
    return event;
  }

  async getLoginEvents(limit = 200): Promise<LoginEvent[]> {
    return db.select().from(loginEvents).orderBy(desc(loginEvents.createdAt)).limit(limit);
  }

  // Patient Bills
  async createPatientBill(data: InsertPatientBill): Promise<PatientBill> {
    const [bill] = await db.insert(patientBills).values(data as any).returning();
    return bill;
  }

  async getPatientBillById(id: number, clinicId: number): Promise<PatientBill | null> {
    const [bill] = await db.select().from(patientBills)
      .where(and(eq(patientBills.id, id), eq(patientBills.clinicId, clinicId)))
      .limit(1);
    return bill ?? null;
  }

  async getPatientBillsByClinicId(clinicId: number): Promise<(PatientBill & { patientCode?: string | null })[]> {
    const rows = await db.select({
      bill: patientBills,
      patientCode: patients.patientCode,
    })
    .from(patientBills)
    .leftJoin(patients, eq(patientBills.patientId, patients.id))
    .where(eq(patientBills.clinicId, clinicId))
    .orderBy(desc(patientBills.createdAt));
    return rows.map(r => ({ ...r.bill, patientCode: r.patientCode ?? null }));
  }

  async getPatientBillsByBookingId(bookingId: number, clinicId: number): Promise<PatientBill[]> {
    return db.select().from(patientBills)
      .where(and(eq(patientBills.bookingId, bookingId), eq(patientBills.clinicId, clinicId)))
      .orderBy(desc(patientBills.createdAt));
  }

  async getPatientBillsByPatientId(clinicId: number, patientId: number): Promise<PatientBill[]> {
    return db.select().from(patientBills)
      .where(and(eq(patientBills.clinicId, clinicId), eq(patientBills.patientId, patientId)))
      .orderBy(desc(patientBills.createdAt));
  }

  async getPatientBillsByPhone(clinicId: number, phone: string): Promise<PatientBill[]> {
    return db.select().from(patientBills)
      .where(and(eq(patientBills.clinicId, clinicId), eq(patientBills.patientPhone, phone)))
      .orderBy(desc(patientBills.createdAt));
  }

  async getPatientBillsByEmail(clinicId: number, email: string): Promise<PatientBill[]> {
    return db.select().from(patientBills)
      .where(and(eq(patientBills.clinicId, clinicId), eq(patientBills.patientEmail, email.toLowerCase().trim())))
      .orderBy(desc(patientBills.createdAt));
  }

  // ── PAGINATED REGISTER VIEW ──
  async getPatientBillsByClinicIdPaged(clinicId: number, opts: {
    q?: string; status?: string; dateFrom?: string; dateTo?: string; sort?: string;
    page?: number; pageSize?: number; exportAll?: boolean;
  }): Promise<{
    data: (PatientBill & { patientCode?: string | null })[];
    total: number; page: number; totalPages: number;
    stats: { totalRevenue: number; pendingAmt: number; paidCount: number; overdueCount: number; overdueAmt: number; };
  }> {
    const { q = '', status = 'all', dateFrom, dateTo, sort = 'date', page = 1, pageSize = 25, exportAll = false } = opts;
    const OVERDUE_DAYS = 3;
    const nowMs = Date.now();
    const isBillOverdue = (b: PatientBill) =>
      (b.paymentStatus === 'pending' || b.paymentStatus === 'partial') &&
      !!b.createdAt && (nowMs - new Date(b.createdAt).getTime()) > OVERDUE_DAYS * 24 * 60 * 60 * 1000;

    // Base where
    let whereClause = eq(patientBills.clinicId, clinicId) as any;

    // Search filter
    if (q.trim()) {
      const qLike = `%${q.toLowerCase().trim()}%`;
      whereClause = and(whereClause, sql`(
        LOWER(${patientBills.patientName}) LIKE ${qLike}
        OR LOWER(COALESCE(${patientBills.patientEmail}, '')) LIKE ${qLike}
        OR COALESCE(${patientBills.patientPhone}, '') LIKE ${qLike}
        OR LOWER(COALESCE(${patientBills.billNumber}, '')) LIKE ${qLike}
      )`);
    }

    // Date range
    if (dateFrom) {
      whereClause = and(whereClause, gte(patientBills.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      whereClause = and(whereClause, lte(patientBills.createdAt, new Date(dateTo)));
    }

    // Status filter
    if (status !== 'all') {
      if (status === 'overdue') {
        const cutoff = new Date(nowMs - OVERDUE_DAYS * 24 * 60 * 60 * 1000);
        whereClause = and(whereClause,
          or(eq(patientBills.paymentStatus, 'pending'), eq(patientBills.paymentStatus, 'partial')),
          lte(patientBills.createdAt, cutoff)
        );
      } else {
        whereClause = and(whereClause, eq(patientBills.paymentStatus, status));
      }
    }

    // Total count
    const [countRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(patientBills).where(whereClause);
    const total = Number(countRow?.c ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const actualPage = exportAll ? 1 : Math.max(1, Math.min(page, totalPages));
    const offset = exportAll ? 0 : (actualPage - 1) * pageSize;
    const lim = exportAll ? 10000 : pageSize;

    // Sort
    const order =
      sort === 'amount' ? desc(patientBills.total) :
      sort === 'patient' ? asc(patientBills.patientName) :
      desc(patientBills.createdAt);

    const rows = await db.select({
      bill: patientBills,
      patientCode: patients.patientCode,
    })
    .from(patientBills)
    .leftJoin(patients, eq(patientBills.patientId, patients.id))
    .where(whereClause)
    .orderBy(order)
    .limit(lim)
    .offset(offset);

    const data = rows.map(r => ({ ...r.bill, patientCode: r.patientCode ?? null }));

    // Stats from ALL clinic bills (unfiltered, for the stat cards)
    const allBills = await db.select().from(patientBills).where(eq(patientBills.clinicId, clinicId));
    const totalRevenue = allBills.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
    const pendingAmt = allBills.filter(b => b.paymentStatus !== 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
    const paidCount = allBills.filter(b => b.paymentStatus === 'paid').length;
    const overdueList = allBills.filter(isBillOverdue);
    const overdueCount = overdueList.length;
    const overdueAmt = overdueList.reduce((s, b) => s + (b.total ?? 0), 0);

    return {
      data,
      total,
      page: actualPage,
      totalPages,
      stats: { totalRevenue, pendingAmt, paidCount, overdueCount, overdueAmt },
    };
  }

  // ── PAGINATED LEDGER VIEW ──
  async getPatientBillGroupsByClinicIdPaged(clinicId: number, opts: {
    q?: string; status?: string; dateFrom?: string; dateTo?: string; sort?: string;
    page?: number; pageSize?: number; exportAll?: boolean;
  }): Promise<{
    data: {
      key: string; patientId: number | null; patientCode: string | null;
      name: string; email: string; phone: string;
      bills: (PatientBill & { patientCode?: string | null })[];
      totalBilled: number; totalCollected: number; outstanding: number;
      oldestUnpaidDays: number; hasOverdue: boolean;
    }[];
    total: number; page: number; totalPages: number;
    stats: { totalRevenue: number; pendingAmt: number; paidCount: number; overdueCount: number; overdueAmt: number; };
  }> {
    const { q = '', status = 'all', dateFrom, dateTo, sort = 'outstanding', page = 1, pageSize = 25, exportAll = false } = opts;
    const OVERDUE_DAYS = 3;
    const nowMs = Date.now();
    const isBillOverdue = (b: PatientBill) =>
      (b.paymentStatus === 'pending' || b.paymentStatus === 'partial') &&
      !!b.createdAt && (nowMs - new Date(b.createdAt).getTime()) > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
    const daysSince = (bill: PatientBill) =>
      Math.floor((nowMs - new Date(bill.createdAt!).getTime()) / (24 * 60 * 60 * 1000));

    // Fetch all bills for this clinic, with patientCode join
    let whereClause = eq(patientBills.clinicId, clinicId) as any;
    if (dateFrom) {
      whereClause = and(whereClause, gte(patientBills.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      whereClause = and(whereClause, lte(patientBills.createdAt, new Date(dateTo)));
    }

    const billRows = await db.select({
      bill: patientBills,
      patientCode: patients.patientCode,
    })
    .from(patientBills)
    .leftJoin(patients, eq(patientBills.patientId, patients.id))
    .where(whereClause)
    .orderBy(desc(patientBills.createdAt));

    let allBills = billRows.map(r => ({ ...r.bill, patientCode: r.patientCode ?? null }));

    // Build patient groups (same logic as frontend)
    type RawGroup = {
      key: string; patientId: number | null; patientCode: string | null;
      name: string; email: string; phone: string;
      bills: (PatientBill & { patientCode?: string | null })[];
      totalBilled: number; totalCollected: number; outstanding: number;
      oldestUnpaidDays: number; hasOverdue: boolean;
    };
    const groupMap = new Map<string, RawGroup>();
    for (const bill of allBills) {
      const key = bill.patientId
        ? `pid:${bill.patientId}`
        : (bill.patientEmail?.toLowerCase().trim()
            || bill.patientPhone?.trim()
            || bill.patientName.toLowerCase().trim());
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          patientId: bill.patientId ?? null,
          patientCode: (bill as any).patientCode ?? null,
          name: bill.patientName,
          email: bill.patientEmail ?? '',
          phone: bill.patientPhone ?? '',
          bills: [],
          totalBilled: 0, totalCollected: 0, outstanding: 0,
          oldestUnpaidDays: 0, hasOverdue: false,
        });
      }
      const g = groupMap.get(key)!;
      g.bills.push(bill);
      if ((bill.patientEmail ?? '').length > g.email.length) g.email = bill.patientEmail!;
      if ((bill.patientPhone ?? '').length > g.phone.length) g.phone = bill.patientPhone!;
      if (bill.patientName.length > g.name.length) g.name = bill.patientName;
      if (!g.patientCode && (bill as any).patientCode) g.patientCode = (bill as any).patientCode;
    }

    let patientGroups = [...groupMap.values()].map(g => {
      const totalBilled = g.bills.reduce((s, b) => s + (b.total ?? 0), 0);
      const totalCollected = g.bills.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
      const outstanding = totalBilled - totalCollected;
      const unpaidBills = g.bills.filter(b => b.paymentStatus !== 'paid' && b.createdAt);
      const oldestUnpaidDays = unpaidBills.length > 0 ? Math.max(...unpaidBills.map(b => daysSince(b))) : 0;
      const hasOverdue = unpaidBills.some(b => isBillOverdue(b));
      return { ...g, totalBilled, totalCollected, outstanding, oldestUnpaidDays, hasOverdue };
    });

    // Search filter (on groups)
    if (q.trim()) {
      const ql = q.toLowerCase().trim();
      patientGroups = patientGroups.filter(g =>
        g.name.toLowerCase().includes(ql) ||
        g.email.toLowerCase().includes(ql) ||
        g.phone.includes(q) ||
        (g.patientCode ?? '').toLowerCase().includes(ql)
      );
    }

    // Status filter (on groups)
    if (status !== 'all') {
      if (status === 'overdue') {
        patientGroups = patientGroups.filter(g => g.hasOverdue);
      } else if (status === 'paid') {
        patientGroups = patientGroups.filter(g => g.outstanding === 0 && g.totalBilled > 0);
      } else if (status === 'pending' || status === 'partial') {
        patientGroups = patientGroups.filter(g => g.outstanding > 0);
      }
    }

    // Sort
    const sorted = patientGroups.sort((a, b) => {
      if (sort === 'outstanding') return b.outstanding - a.outstanding || b.totalBilled - a.totalBilled;
      if (sort === 'billed') return b.totalBilled - a.totalBilled || b.outstanding - a.outstanding;
      if (sort === 'patient') return a.name.localeCompare(b.name);
      if (sort === 'oldest') return b.oldestUnpaidDays - a.oldestUnpaidDays;
      return b.outstanding - a.outstanding || b.totalBilled - a.totalBilled;
    });

    // Pagination
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const actualPage = exportAll ? 1 : Math.max(1, Math.min(page, totalPages));
    const offset = exportAll ? 0 : (actualPage - 1) * pageSize;
    const lim = exportAll ? 10000 : pageSize;
    const data = sorted.slice(offset, offset + lim);

    // Stats from ALL clinic bills (unfiltered)
    const fullBillRows = await db.select({ bill: patientBills }).from(patientBills).where(eq(patientBills.clinicId, clinicId));
    const fullBills = fullBillRows.map(r => r.bill);
    const totalRevenue = fullBills.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
    const pendingAmt = fullBills.filter(b => b.paymentStatus !== 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
    const paidCount = fullBills.filter(b => b.paymentStatus === 'paid').length;
    const overdueList = fullBills.filter(isBillOverdue);
    const overdueCount = overdueList.length;
    const overdueAmt = overdueList.reduce((s, b) => s + (b.total ?? 0), 0);

    return {
      data,
      total,
      page: actualPage,
      totalPages,
      stats: { totalRevenue, pendingAmt, paidCount, overdueCount, overdueAmt },
    };
  }

  async upsertPatientByEmail(clinicId: number, email: string, name: string, phone: string): Promise<Patient> {
    const normalizedEmail = email.toLowerCase().trim();
    const [existing] = await db.select().from(patients)
      .where(and(eq(patients.clinicId, clinicId), eq(patients.email, normalizedEmail)))
      .limit(1);

    if (existing) {
      const updates: any = {
        visitCount: (existing.visitCount ?? 0) + 1,
        lastVisitAt: new Date(),
      };
      if (name && name.length > (existing.name ?? "").length) updates.name = name;
      if (phone && (!existing.phone || phone.length > (existing.phone ?? "").length)) updates.phone = phone;
      const [updated] = await db.update(patients).set(updates).where(eq(patients.id, existing.id)).returning();
      return updated;
    }

    const countRows = await db.select({ count: sql<number>`COUNT(*)::int` }).from(patients).where(eq(patients.clinicId, clinicId));
    const seq = (Number(countRows[0]?.count) ?? 0) + 1;
    const patientCode = `PAT-${String(seq).padStart(4, '0')}`;

    const [newPatient] = await db.insert(patients).values({
      clinicId,
      email: normalizedEmail,
      name,
      phone: phone || null,
      patientCode,
      visitCount: 1,
      lastVisitAt: new Date(),
    } as any).returning();
    return newPatient;
  }

  async upsertPatientByPhone(clinicId: number, phone: string, name: string): Promise<Patient> {
    const normalizedPhone = phone.trim();
    const [existing] = await db.select().from(patients)
      .where(and(eq(patients.clinicId, clinicId), eq(patients.phone, normalizedPhone)))
      .limit(1);

    if (existing) {
      const updates: any = {
        visitCount: (existing.visitCount ?? 0) + 1,
        lastVisitAt: new Date(),
      };
      if (name && name.length > (existing.name ?? "").length) updates.name = name;
      const [updated] = await db.update(patients).set(updates).where(eq(patients.id, existing.id)).returning();
      return updated;
    }

    const countRows = await db.select({ count: sql<number>`COUNT(*)::int` }).from(patients).where(eq(patients.clinicId, clinicId));
    const seq = (Number(countRows[0]?.count) ?? 0) + 1;
    const patientCode = `PAT-${String(seq).padStart(4, '0')}`;

    const [newPatient] = await db.insert(patients).values({
      clinicId,
      email: null,
      name,
      phone: normalizedPhone,
      patientCode,
      visitCount: 1,
      lastVisitAt: new Date(),
    } as any).returning();
    return newPatient;
  }

  async getPatientByEmail(clinicId: number, email: string): Promise<Patient | null> {
    const [patient] = await db.select().from(patients)
      .where(and(eq(patients.clinicId, clinicId), eq(patients.email, email.toLowerCase().trim())))
      .limit(1);
    return patient ?? null;
  }

  async getPatientById(clinicId: number, patientId: number): Promise<Patient | null> {
    const [patient] = await db.select().from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
      .limit(1);
    return patient ?? null;
  }

  async incrementPatientVisit(patientId: number): Promise<Patient> {
    const [updated] = await db.update(patients)
      .set({ visitCount: sql`${patients.visitCount} + 1`, lastVisitAt: new Date() })
      .where(eq(patients.id, patientId))
      .returning();
    return updated;
  }

  async createNewPatient(clinicId: number, email: string, name: string, phone: string): Promise<Patient> {
    const normalizedEmail = email.toLowerCase().trim();
    const countRows = await db.select({ count: sql<number>`COUNT(*)::int` }).from(patients).where(eq(patients.clinicId, clinicId));
    const seq = (Number(countRows[0]?.count) ?? 0) + 1;
    const patientCode = `PAT-${String(seq).padStart(4, '0')}`;
    const [newPatient] = await db.insert(patients).values({
      clinicId,
      email: normalizedEmail,
      name,
      phone: phone || null,
      patientCode,
      visitCount: 1,
      lastVisitAt: new Date(),
    } as any).returning();
    return newPatient;
  }

  async getPatientsByEmail(clinicId: number, email: string): Promise<Patient[]> {
    return db.select().from(patients)
      .where(and(eq(patients.clinicId, clinicId), eq(patients.email, email.toLowerCase().trim())))
      .orderBy(desc(patients.lastVisitAt));
  }

  async searchPatients(clinicId: number, query: string): Promise<Patient[]> {
    const q = query.toLowerCase().trim();
    const qLike  = `%${q}%`;
    const qStart = `${q}%`;
    return db.select().from(patients)
      .where(and(
        eq(patients.clinicId, clinicId),
        sql`${patients.patientCode} IS NOT NULL`,
        sql`(
          LOWER(${patients.name}) LIKE ${qLike}
          OR LOWER(COALESCE(${patients.email}, '')) LIKE ${qLike}
          OR COALESCE(${patients.phone}, '') LIKE ${qLike}
          OR LOWER(COALESCE(${patients.patientCode}, '')) LIKE ${qLike}
        )`
      ))
      .orderBy(
        sql`CASE
          WHEN LOWER(COALESCE(${patients.patientCode}, '')) = ${q}     THEN 0
          WHEN LOWER(COALESCE(${patients.patientCode}, '')) LIKE ${qStart} THEN 1
          WHEN LOWER(${patients.name}) LIKE ${qStart}                  THEN 2
          WHEN COALESCE(${patients.phone}, '') LIKE ${qStart}          THEN 3
          ELSE 4
        END`,
        desc(patients.lastVisitAt)
      )
      .limit(8);
  }

  async getPatientsByClinic(clinicId: number): Promise<(Patient & { totalBilled: number })[]> {
    const rows = await db.select({
      patient: patients,
      totalBilled: sql<number>`COALESCE(SUM(CASE WHEN ${patientBills.paymentStatus} = 'paid' THEN ${patientBills.total} ELSE 0 END), 0)`,
    })
    .from(patients)
    .leftJoin(patientBills, eq(patientBills.patientId, patients.id))
    .where(and(eq(patients.clinicId, clinicId), sql`${patients.patientCode} IS NOT NULL`))
    .groupBy(patients.id)
    .orderBy(desc(patients.lastVisitAt));
    return rows.map(r => ({ ...r.patient, totalBilled: Number(r.totalBilled) }));
  }

  async getPatientsByClinicPaged(clinicId: number, opts: {
    q?: string;
    sort?: string;
    lastVisitFrom?: string;
    lastVisitTo?: string;
    page?: number;
    pageSize?: number;
    exportAll?: boolean;
  }): Promise<{
    data: (Patient & { totalBilled: number })[];
    total: number;
    page: number;
    totalPages: number;
    stats: { totalAll: number; activeThisMonth: number; newThisMonth: number; totalRevenue: number };
  }> {
    const { q = '', sort = 'recent', lastVisitFrom, lastVisitTo, page = 1, pageSize = 25, exportAll = false } = opts;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Stats — always unfiltered, clinic-wide totals
    const [statsRow] = await db.select({
      totalAll: sql<number>`COUNT(DISTINCT ${patients.id})`,
      activeThisMonth: sql<number>`COUNT(DISTINCT CASE WHEN ${patients.lastVisitAt} >= ${thirtyDaysAgo} THEN ${patients.id} END)`,
      newThisMonth: sql<number>`COUNT(DISTINCT CASE WHEN ${patients.createdAt} >= ${thirtyDaysAgo} THEN ${patients.id} END)`,
      totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${patientBills.paymentStatus} = 'paid' THEN ${patientBills.total} ELSE 0 END), 0)`,
    })
    .from(patients)
    .leftJoin(patientBills, eq(patientBills.patientId, patients.id))
    .where(and(eq(patients.clinicId, clinicId), sql`${patients.patientCode} IS NOT NULL`));

    // Build dynamic WHERE
    let whereClause = and(eq(patients.clinicId, clinicId), sql`${patients.patientCode} IS NOT NULL`);
    if (q.trim()) {
      const qLike = `%${q.toLowerCase().trim()}%`;
      whereClause = and(whereClause, sql`(
        LOWER(${patients.name}) LIKE ${qLike}
        OR LOWER(COALESCE(${patients.email}, '')) LIKE ${qLike}
        OR COALESCE(${patients.phone}, '') LIKE ${qLike}
        OR LOWER(COALESCE(${patients.patientCode}, '')) LIKE ${qLike}
      )`);
    }
    if (lastVisitFrom) whereClause = and(whereClause, gte(patients.lastVisitAt, new Date(lastVisitFrom)));
    if (lastVisitTo)   whereClause = and(whereClause, lte(patients.lastVisitAt, new Date(lastVisitTo)));

    // Total count (no join needed — filters are on patients columns only)
    const [countRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(patients).where(whereClause);
    const total = Number(countRow?.c ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const actualPage = exportAll ? 1 : Math.max(1, Math.min(page, totalPages));
    const offset = exportAll ? 0 : (actualPage - 1) * pageSize;
    const lim = exportAll ? 10000 : pageSize;

    // Data rows — branched by sort to keep Drizzle types clean
    const base = () => db.select({
      patient: patients,
      totalBilled: sql<number>`COALESCE(SUM(CASE WHEN ${patientBills.paymentStatus} = 'paid' THEN ${patientBills.total} ELSE 0 END), 0)`,
    })
    .from(patients)
    .leftJoin(patientBills, eq(patientBills.patientId, patients.id))
    .where(whereClause)
    .groupBy(patients.id);

    const rows = await (
      sort === 'visits' ? base().orderBy(desc(patients.visitCount), desc(patients.lastVisitAt)) :
      sort === 'billed' ? base().orderBy(sql`COALESCE(SUM(CASE WHEN ${patientBills.paymentStatus} = 'paid' THEN ${patientBills.total} ELSE 0 END), 0) DESC`, desc(patients.lastVisitAt)) :
      base().orderBy(desc(patients.lastVisitAt))
    ).limit(lim).offset(offset);

    return {
      data: rows.map(r => ({ ...r.patient, totalBilled: Number(r.totalBilled) })),
      total,
      page: actualPage,
      totalPages,
      stats: {
        totalAll:       Number(statsRow?.totalAll ?? 0),
        activeThisMonth: Number(statsRow?.activeThisMonth ?? 0),
        newThisMonth:   Number(statsRow?.newThisMonth ?? 0),
        totalRevenue:   Number(statsRow?.totalRevenue ?? 0),
      },
    };
  }

  async getPatientHistory(clinicId: number, patientId: number): Promise<{ bookings: (Booking & { slot: Slot })[]; bills: PatientBill[]; clinicalRecords: ClinicalRecord[] }> {
    const [bookingRows, bills, records] = await Promise.all([
      db.select({ booking: bookings, slot: slots })
        .from(bookings)
        .innerJoin(slots, eq(bookings.slotId, slots.id))
        .where(and(eq(bookings.patientId, patientId), eq(slots.clinicId, clinicId)))
        .orderBy(desc(slots.startTime)),
      db.select().from(patientBills)
        .where(and(eq(patientBills.clinicId, clinicId), eq(patientBills.patientId, patientId)))
        .orderBy(desc(patientBills.createdAt)),
      db.select().from(clinicalRecords)
        .where(and(eq(clinicalRecords.clinicId, clinicId), eq(clinicalRecords.patientId, patientId), eq(clinicalRecords.isDeleted, false)))
        .orderBy(desc(clinicalRecords.createdAt)),
    ]);
    return {
      bookings: bookingRows.map(r => ({ ...r.booking, slot: r.slot })),
      bills,
      clinicalRecords: records,
    };
  }

  async updatePatientBill(id: number, clinicId: number, updates: Partial<PatientBill>): Promise<PatientBill> {
    const [bill] = await db.update(patientBills)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(patientBills.id, id), eq(patientBills.clinicId, clinicId)))
      .returning();
    return bill;
  }

  async deletePatientBill(id: number, clinicId: number): Promise<void> {
    await db.delete(patientBills)
      .where(and(eq(patientBills.id, id), eq(patientBills.clinicId, clinicId)));
  }

  // ── Pharmacy Stock ────────────────────────────────────────────────────────

  async getPharmacyStock(clinicId: number): Promise<PharmacyStockItem[]> {
    return db.select().from(pharmacyStock)
      .where(eq(pharmacyStock.clinicId, clinicId))
      .orderBy(pharmacyStock.medicineName);
  }

  async getPharmacyStockPaged(clinicId: number, opts: {
    q?: string; sort?: string; page?: number; pageSize?: number;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? 10));
    const q = opts.q?.trim();
    const sort = opts.sort ?? 'name';

    // Search filter
    const searchCond = q
      ? or(
          ilike(pharmacyStock.medicineName, `%${q}%`),
          ilike(pharmacyStock.dosage, `%${q}%`)
        )
      : undefined;

    const whereClause = and(
      eq(pharmacyStock.clinicId, clinicId),
      searchCond
    );

    // Total count
    const [{ total }] = await db.select({ total: sql<number>`count(*)` })
      .from(pharmacyStock)
      .where(whereClause);

    // Stats from ALL clinic items (unfiltered)
    const allItems = await db.select().from(pharmacyStock)
      .where(eq(pharmacyStock.clinicId, clinicId));
    const now = Date.now();
    const stats = {
      total: allItems.length,
      expiringSoon: allItems.filter(i => {
        if (!i.expiryDate) return false;
        const d = new Date(i.expiryDate).getTime();
        const diff = (d - now) / (1000 * 60 * 60 * 24);
        return diff < 30 && diff >= 0;
      }).length,
      expired: allItems.filter(i => {
        if (!i.expiryDate) return false;
        return new Date(i.expiryDate).getTime() < now;
      }).length,
      lowStock: allItems.filter(i => i.availableQty <= 5).length,
    };

    // Sorting
    const orderByClause =
      sort === 'price-asc' ? asc(pharmacyStock.unitPrice) :
      sort === 'price-desc' ? desc(pharmacyStock.unitPrice) :
      sort === 'qty-asc' ? asc(pharmacyStock.availableQty) :
      sort === 'qty-desc' ? desc(pharmacyStock.availableQty) :
      sort === 'expiry' ? asc(pharmacyStock.expiryDate) :
      asc(pharmacyStock.medicineName);

    // Data
    const data = await db.select().from(pharmacyStock)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return { data, total, page, totalPages, stats };
  }

  async createPharmacyItem(data: InsertPharmacyStockItem): Promise<PharmacyStockItem> {
    const [item] = await db.insert(pharmacyStock).values(data).returning();
    return item;
  }

  async updatePharmacyItem(id: number, clinicId: number, updates: Partial<PharmacyStockItem>): Promise<PharmacyStockItem> {
    const [item] = await db.update(pharmacyStock)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(pharmacyStock.id, id), eq(pharmacyStock.clinicId, clinicId)))
      .returning();
    return item;
  }

  async deletePharmacyItem(id: number, clinicId: number): Promise<void> {
    await db.delete(pharmacyStock)
      .where(and(eq(pharmacyStock.id, id), eq(pharmacyStock.clinicId, clinicId)));
  }

  async getClinicAnalytics(clinicId: number, range: string): Promise<ClinicAnalyticsResult> {
    const now = new Date();
    let startDate: Date;
    let prevStartDate: Date; // for period-over-period comparison
    if (range === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
    } else {
      const days = range === '60d' ? 60 : range === '90d' ? 90 : 30;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    function dateKey(d: Date) { return d.toISOString().substring(0, 10); }
    function weekKey(d: Date) {
      const c = new Date(d); c.setDate(c.getDate() - c.getDay());
      return c.toISOString().substring(0, 10);
    }
    function monthLabel(d: Date) {
      const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${mo[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    }

    // Fetch both current and previous period data for comparisons
    const [bookingRows, prevBookingRows, slotRows, billRows, prevBillRows, patientRows, clinicalRows, alertRows, itemRows] =
      await Promise.all([
        db.select({ booking: bookings, slot: slots })
          .from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id))
          .where(and(eq(slots.clinicId, clinicId), gte(slots.startTime, startDate))),

        db.select({ booking: bookings, slot: slots })
          .from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id))
          .where(and(eq(slots.clinicId, clinicId), gte(slots.startTime, prevStartDate), lt(slots.startTime, startDate))),

        db.select().from(slots)
          .where(and(eq(slots.clinicId, clinicId), gte(slots.startTime, startDate))),

        db.select().from(patientBills)
          .where(and(eq(patientBills.clinicId, clinicId), gte(patientBills.createdAt as any, startDate))),

        db.select().from(patientBills)
          .where(and(eq(patientBills.clinicId, clinicId), gte(patientBills.createdAt as any, prevStartDate), lt(patientBills.createdAt as any, startDate))),

        db.select().from(patients).where(eq(patients.clinicId, clinicId)),

        db.select({ diagnosis: clinicalRecords.diagnosis, doctorName: clinicalRecords.doctorName })
          .from(clinicalRecords)
          .where(and(
            eq(clinicalRecords.clinicId, clinicId),
            eq(clinicalRecords.isDeleted, false),
            gte(clinicalRecords.createdAt as any, startDate)
          )),

        db.select().from(stockAlerts)
          .where(and(eq(stockAlerts.clinicId, clinicId), eq(stockAlerts.isDismissed, false))),

        db.select().from(inventoryItems).where(eq(inventoryItems.clinicId, clinicId)),
      ]);

    // ── Overview ──────────────────────────────────────────────────────────────
    const totalBookings   = bookingRows.length;
    const todayBookings   = bookingRows.filter(r => r.slot.startTime >= todayStart && r.slot.startTime <= todayEnd).length;
    const cancelledSlots  = slotRows.filter(s => s.isCancelled).length;
    const availableSlots  = slotRows.filter(s => !s.isCancelled).length;
    const bookedSlots     = slotRows.filter(s => s.isBooked).length;
    const utilizationPct  = availableSlots > 0 ? Math.round((bookedSlots / availableSlots) * 100) : 0;

    // Booking cancellations (not slot cancellations)
    const bookingCancellations = bookingRows.filter(r =>
      r.booking.verificationStatus === 'cancelled' || r.booking.verificationStatus === 'no_show'
    ).length;

    // No-shows
    const noShowCount = bookingRows.filter(r => r.booking.verificationStatus === 'no_show').length;
    const noShowRate  = totalBookings > 0 ? Math.round((noShowCount / totalBookings) * 100) : 0;

    const trendMap = new Map<string, number>();
    for (const r of bookingRows) {
      const k = dateKey(r.slot.startTime);
      trendMap.set(k, (trendMap.get(k) ?? 0) + 1);
    }
    const trendByDay = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Period-over-period helpers
    const prevTotalBookings = prevBookingRows.length;
    const prevNoShowCount   = prevBookingRows.filter(r => r.booking.verificationStatus === 'no_show').length;

    function pctChange(curr: number, prev: number): number {
      return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
    }

    // ── Financial ─────────────────────────────────────────────────────────────
    const paidBills       = billRows.filter(b => b.paymentStatus === 'paid');
    const totalRevenue    = paidBills.reduce((s, b) => s + (b.total ?? 0), 0);
    const outstanding     = billRows.filter(b => b.paymentStatus !== 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
    const uniquePtIds     = new Set(billRows.map(b => b.patientId).filter(Boolean));
    const avgRevPerPt     = uniquePtIds.size > 0 ? Math.round(totalRevenue / uniquePtIds.size) : 0;

    const prevPaidBills   = prevBillRows.filter(b => b.paymentStatus === 'paid');
    const prevRevenue     = prevPaidBills.reduce((s, b) => s + (b.total ?? 0), 0);

    const payMap = new Map<string, { amount: number; count: number }>();
    for (const b of billRows) {
      const m = b.paymentMethod ?? 'Cash';
      const e = payMap.get(m) ?? { amount: 0, count: 0 };
      payMap.set(m, { amount: e.amount + (b.total ?? 0), count: e.count + 1 });
    }
    const paymentBreakdown = Array.from(payMap.entries())
      .map(([method, d]) => ({ method, ...d }))
      .sort((a, b) => b.amount - a.amount);

    const revMap = new Map<string, number>();
    for (const b of billRows) {
      if (!b.createdAt) continue;
      const k = weekKey(b.createdAt);
      revMap.set(k, (revMap.get(k) ?? 0) + (b.total ?? 0));
    }
    const revenueTrend = Array.from(revMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, amount]) => ({ week, amount: Math.round(amount) }));

    // Revenue by doctor
    const docRevMap = new Map<string, number>();
    for (const b of billRows) {
      if (b.paymentStatus !== 'paid') continue;
      const doc = b.patientName; // closest proxy: patient name is who the bill is for
      // Better: use assignedDoctor from booking — but bill doesn't link to booking doctor directly
      // We can use a join but for simplicity, skip if not critical
      const key = doc ?? 'Unassigned';
      docRevMap.set(key, (docRevMap.get(key) ?? 0) + (b.total ?? 0));
    }
    const revenueByDoctor = Array.from(docRevMap.entries())
      .map(([doctor, amount]) => ({ doctor, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // ── Appointments ──────────────────────────────────────────────────────────
    const statusMap = new Map<string, number>();
    for (const r of bookingRows) {
      const s = r.booking.clinicalStatus ?? 'Awaiting';
      statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
    }
    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const docMap = new Map<string, number>();
    for (const r of bookingRows) {
      const d = r.booking.assignedDoctor ?? 'Unassigned';
      docMap.set(d, (docMap.get(d) ?? 0) + 1);
    }
    const doctorWorkload = Array.from(docMap.entries())
      .map(([doctor, count]) => ({ doctor, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);

    // Procedures
    const procMap = new Map<string, number>();
    for (const r of clinicalRows) {
      for (const d of ((r.diagnosis ?? []) as string[])) {
        if (d) procMap.set(d, (procMap.get(d) ?? 0) + 1);
      }
    }
    const topProcedures = Array.from(procMap.entries())
      .map(([procedure, count]) => ({ procedure, count }))
      .sort((a, b) => b.count - a.count).slice(0, 6);

    // Conversion funnel counts
    const confirmedCount     = bookingRows.filter(r => r.booking.verificationStatus === 'verified' || r.booking.verificationStatus === 'confirmed').length;
    const checkedInCount       = bookingRows.filter(r => r.booking.visitStatus === 'checked_in' || r.booking.checkedInAt !== null).length;
    const treatmentDoneCount   = bookingRows.filter(r => r.booking.visitStatus === 'treatment_completed').length;
    const visitCompletedCount  = bookingRows.filter(r => r.booking.visitStatus === 'completed').length;
    const billsPaidCount     = paidBills.length;

    // ── Patients ──────────────────────────────────────────────────────────────
    const totalPatients  = patientRows.length;
    const newPatients    = patientRows.filter(p => p.visitCount <= 1).length;
    const repeatPatients = patientRows.filter(p => p.visitCount > 1).length;

    const growthMap = new Map<string, number>();
    for (const p of patientRows) {
      if (!p.createdAt) continue;
      const k = monthLabel(p.createdAt);
      growthMap.set(k, (growthMap.get(k) ?? 0) + 1);
    }
    const growthByMonth = Array.from(growthMap.entries())
      .map(([month, count]) => ({ month, count }));

    // Demographics
    const genderMap = new Map<string, number>();
    const ageBuckets: Record<string, number> = { '0-18': 0, '19-35': 0, '36-50': 0, '51-65': 0, '65+': 0 };
    for (const p of patientRows) {
      if (p.gender) genderMap.set(p.gender, (genderMap.get(p.gender) ?? 0) + 1);
      if (p.age != null) {
        if (p.age <= 18) ageBuckets['0-18']++;
        else if (p.age <= 35) ageBuckets['19-35']++;
        else if (p.age <= 50) ageBuckets['36-50']++;
        else if (p.age <= 65) ageBuckets['51-65']++;
        else ageBuckets['65+']++;
      }
    }
    const genderBreakdown = Array.from(genderMap.entries())
      .map(([gender, count]) => ({ gender, count }))
      .sort((a, b) => b.count - a.count);
    const ageBreakdown = Object.entries(ageBuckets)
      .map(([bucket, count]) => ({ bucket, count }))
      .filter(d => d.count > 0);

    // ── Compliance ────────────────────────────────────────────────────────────
    const signedCount    = bookingRows.filter(r => r.booking.consentSignedAt !== null).length;
    const consentRate    = totalBookings > 0 ? Math.round((signedCount / totalBookings) * 100) : 0;
    const lowStockItems  = itemRows.filter(i => i.reorderLevel !== null && i.currentQty <= (i.reorderLevel ?? Infinity)).length;
    const expiringItems  = itemRows.filter(i => i.expiryDate && new Date(i.expiryDate) <= thirtyDaysOut).length;

    // Alerts / thresholds
    const alerts: string[] = [];
    if (utilizationPct < 50) alerts.push('Low slot utilization (< 50%)');
    if (noShowRate > 15) alerts.push('High no-show rate (> 15%)');
    if (consentRate < 80) alerts.push('Consent compliance below 80%');
    if (lowStockItems > 0) alerts.push(`${lowStockItems} items low on stock`);
    if (expiringItems > 0) alerts.push(`${expiringItems} items expiring soon`);

    return {
      range,
      overview: {
        totalBookings,
        todayBookings,
        utilizationPct,
        cancellations: bookingCancellations,
        noShowCount,
        noShowRate,
        trendByDay,
        prevTotalBookings,
        changeTotalBookings: pctChange(totalBookings, prevTotalBookings),
        changeNoShowRate: pctChange(noShowRate, prevNoShowCount > 0 ? Math.round((prevNoShowCount / prevTotalBookings) * 100) : 0),
      },
      financial: {
        totalRevenue: Math.round(totalRevenue),
        outstanding: Math.round(outstanding),
        avgRevenuePerPatient: avgRevPerPt,
        paymentBreakdown,
        revenueTrend,
        revenueByDoctor,
        prevRevenue: Math.round(prevRevenue),
        changeRevenue: pctChange(Math.round(totalRevenue), Math.round(prevRevenue)),
      },
      appointments: {
        statusBreakdown,
        doctorWorkload,
        topProcedures,
        categoryBreakdown: [],
        funnel: {
          booked: totalBookings,
          confirmed: confirmedCount,
          checkedIn: checkedInCount,
          treatmentDone: treatmentDoneCount,
          visitCompleted: visitCompletedCount,
          billsPaid: billsPaidCount,
        },
      },
      patients: {
        total: totalPatients,
        newPatients,
        repeatPatients,
        growthByMonth,
        genderBreakdown,
        ageBreakdown,
      },
      compliance: {
        consentRate,
        signedCount,
        totalWithConsent: totalBookings,
        inventoryAlerts: alertRows.length,
        lowStockItems,
        expiringItems,
        alerts,
      },
    };
  }

  // ── Patient Charts (Odontogram) ─────────────────────────────────────────────

  async getPatientChart(patientId: number, clinicId: number): Promise<PatientChart | null> {
    const [chart] = await db
      .select()
      .from(patientCharts)
      .where(and(eq(patientCharts.patientId, patientId), eq(patientCharts.clinicId, clinicId)))
      .limit(1);
    return chart ?? null;
  }

  async upsertPatientChart(patientId: number, clinicId: number, chartData: string): Promise<PatientChart> {
    const existing = await this.getPatientChart(patientId, clinicId);
    if (existing) {
      const [updated] = await db
        .update(patientCharts)
        .set({ chartData, updatedAt: new Date() })
        .where(and(eq(patientCharts.patientId, patientId), eq(patientCharts.clinicId, clinicId)))
        .returning();
      return updated;
    }
    const [chart] = await db
      .insert(patientCharts)
      .values({ patientId, clinicId, chartData })
      .returning();
    return chart;
  }
}

export const storage = new DatabaseStorage();
