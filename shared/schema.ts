import { pgTable, text, serial, timestamp, boolean, varchar, integer, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";
import { relations, sql } from "drizzle-orm";

// Export auth models so they are picked up
export * from "./models/auth";

export type ClinicWebsiteConfig = {
  theme: "classic" | "warm" | "modern";
  taglineL1?: string;
  taglineL2?: string;
  heroDescription?: string;
  aboutDescription?: string;
  vision?: string;
  values?: string;
  heroImageUrl?: string;
  gallery?: { url: string; caption: string }[];
  services?: { name: string; description: string; imageUrl?: string }[];
  testimonials?: { quote: string; patientName: string; rating: number }[];
  hours?: { day: string; open: string; close: string; closed: boolean }[];
  socialLinks?: { instagram?: string; facebook?: string; youtube?: string };
  showMap?: boolean;
  stats?: { value: string; label: string }[];
  features?: { icon: string; title: string }[];
  featuresImageUrl?: string;
};

export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 255 }),
  pincode: varchar("pincode", { length: 20 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  username: varchar("username", { length: 100 }).unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  website: varchar("website", { length: 255 }),
  doctorName: varchar("doctor_name", { length: 255 }),
  doctorSpecialization: varchar("doctor_specialization", { length: 255 }),
  doctorDegree: varchar("doctor_degree", { length: 255 }),
  doctors: jsonb("doctors").$type<{ name: string; specialization: string; degree: string; imageUrl?: string | null }[]>().default([]),
  logoUrl: varchar("logo_url", { length: 1000 }),
  status: varchar("status", { length: 20 }).default("approved").notNull(), // pending, approved, rejected
  registeredBy: varchar("registered_by", { length: 255 }), // user id if registered by user
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  googleBusinessUrl: varchar("google_business_url", { length: 1000 }),
  gstNumber: varchar("gst_number", { length: 50 }),
  medicalLicenseUrl: varchar("medical_license_url", { length: 1000 }),
  clinicRegCertUrl: varchar("clinic_reg_cert_url", { length: 1000 }),
  trustScore: integer("trust_score").default(0),
  plan: varchar("plan", { length: 20 }).default("starter"),
  subscriptionStatus: varchar("subscription_status", { length: 20 }).default("unpaid"), // unpaid, active, expired
  billingCycle: varchar("billing_cycle", { length: 10 }).default("monthly"), // monthly, annual
  razorpaySubscriptionId: varchar("razorpay_subscription_id", { length: 255 }),
  websiteConfig: jsonb("website_config").$type<ClinicWebsiteConfig>(),
});

export const slots = pgTable("slots", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").references(() => users.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isBooked: boolean("is_booked").default(false).notNull(),
  clinicName: varchar("clinic_name", { length: 255 }),
  clinicId: integer("clinic_id").references(() => clinics.id),
  maxBookings: integer("max_bookings").default(3).notNull(),
  isCancelled: boolean("is_cancelled").default(false).notNull(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").notNull().references(() => slots.id),
  customerId: varchar("customer_id").references(() => users.id),
  patientId: integer("patient_id"),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }),
  verificationCode: varchar("verification_code", { length: 10 }),
  verificationStatus: varchar("verification_status", { length: 20 }).default("pending").notNull(),
  verificationExpiresAt: timestamp("verification_expires_at"),
  description: text("description"),
  assignedDoctor: varchar("assigned_doctor", { length: 255 }),
  assignedDoctorEmail: varchar("assigned_doctor_email", { length: 255 }),
  doctorApprovalStatus: varchar("doctor_approval_status", { length: 20 }),
  doctorNotes: text("doctor_notes"),
  clinicalStatus: varchar("clinical_status", { length: 50 }),
  confirmedBy: varchar("confirmed_by", { length: 20 }),
  paymentStatus: varchar("payment_status", { length: 20 }),
  razorpayOrderId: varchar("razorpay_order_id", { length: 255 }),
  razorpayPaymentId: varchar("razorpay_payment_id", { length: 255 }),
  consentSignature: text("consent_signature"),
  consentSignedAt: timestamp("consent_signed_at"),
  consentIp: varchar("consent_ip", { length: 45 }),
  consentToken: varchar("consent_token", { length: 255 }),
  paymentAmount: integer("payment_amount"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Session table for express-session (PostgreSQL backend)
// This definition prevents Drizzle from trying to delete the table created by connect-pg-simple
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const doctorInvites = pgTable("doctor_invites", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, accepted, expired
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isTemporaryPassword: boolean("is_temporary_password").default(true).notNull(),
  username: varchar("username", { length: 100 }).unique(),
  specialization: varchar("specialization", { length: 255 }),
  degree: varchar("degree", { length: 255 }),
  college: varchar("college", { length: 255 }),
  bio: text("bio"),
  phone: varchar("phone", { length: 50 }),
  imageUrl: varchar("image_url", { length: 1000 }),
  yearsOfExperience: integer("years_of_experience"),
  languages: text("languages").array(),
  treatments: text("treatments").array(),
  introVideoUrl: varchar("intro_video_url", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctorCertifications = pgTable("doctor_certifications", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  title: varchar("title", { length: 255 }).notNull(),
  issuer: varchar("issuer", { length: 255 }),
  year: varchar("year", { length: 10 }),
  description: text("description"),
  imageUrl: varchar("image_url", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctorCases = pgTable("doctor_cases", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>().default([]),
  mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clinicDoctors = pgTable("clinic_doctors", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  doctorId: integer("doctor_id").references(() => doctors.id),
  clinicId: integer("clinic_id").references(() => clinics.id),
  patientCode: varchar("patient_code", { length: 20 }),
  visitCount: integer("visit_count").default(0).notNull(),
  lastVisitAt: timestamp("last_visit_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDoctorSchema = createInsertSchema(doctors).omit({
  id: true,
  createdAt: true,
});

export const insertDoctorCertificationSchema = createInsertSchema(doctorCertifications).omit({
  id: true,
  createdAt: true,
});

export const insertDoctorCaseSchema = createInsertSchema(doctorCases).omit({
  id: true,
  createdAt: true,
});

export const insertClinicDoctorSchema = createInsertSchema(clinicDoctors).omit({
  id: true,
  createdAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  patientCode: true,
  visitCount: true,
  lastVisitAt: true,
});

export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type DoctorCertification = typeof doctorCertifications.$inferSelect;
export type InsertDoctorCertification = z.infer<typeof insertDoctorCertificationSchema>;
export type DoctorCase = typeof doctorCases.$inferSelect;
export type InsertDoctorCase = z.infer<typeof insertDoctorCaseSchema>;
export type ClinicDoctor = typeof clinicDoctors.$inferSelect;
export type InsertClinicDoctor = z.infer<typeof insertClinicDoctorSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;

export const insertDoctorInviteSchema = createInsertSchema(doctorInvites).omit({
  id: true,
  createdAt: true,
  status: true
});

export const doctorLeaves = pgTable("doctor_leaves", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  leaveDate: varchar("leave_date", { length: 10 }).notNull(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDoctorLeaveSchema = createInsertSchema(doctorLeaves).omit({
  id: true,
  createdAt: true,
});

export type DoctorLeave = typeof doctorLeaves.$inferSelect;
export type InsertDoctorLeave = z.infer<typeof insertDoctorLeaveSchema>;

export type DoctorInvite = typeof doctorInvites.$inferSelect;
export type InsertDoctorInvite = z.infer<typeof insertDoctorInviteSchema>;
export const slotsRelations = relations(slots, ({ one, many }) => ({
  owner: one(users, {
    fields: [slots.ownerId],
    references: [users.id],
  }),
  booking: one(bookings, {
    fields: [slots.id],
    references: [bookings.slotId],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  slot: one(slots, {
    fields: [bookings.slotId],
    references: [slots.id],
  }),
  customer: one(users, {
    fields: [bookings.customerId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertSlotSchema = createInsertSchema(slots).omit({ 
  id: true, 
  ownerId: true, 
  isBooked: true 
});

export const insertBookingSchema = createInsertSchema(bookings).omit({ 
  id: true, 
  customerId: true, 
  createdAt: true,
  verificationCode: true,
  verificationStatus: true,
  verificationExpiresAt: true
});

export const publicBookingSchema = createInsertSchema(bookings).omit({ 
  id: true, 
  customerId: true, 
  createdAt: true,
  slotId: true,
  verificationCode: true,
  verificationStatus: true,
  verificationExpiresAt: true
}).extend({
  clinicId: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  customerEmail: z.string().email()
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ 
  id: true, 
  createdAt: true,
  read: true
});

export const insertClinicSchema = createInsertSchema(clinics).omit({ 
  id: true, 
  createdAt: true,
  isArchived: true
});

// Types
export type Slot = typeof slots.$inferSelect;
export type InsertSlot = z.infer<typeof insertSlotSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type PublicBooking = z.infer<typeof publicBookingSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Clinic = typeof clinics.$inferSelect;
export type InsertClinic = z.infer<typeof insertClinicSchema>;

export const bookingNotes = pgTable("booking_notes", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  authorType: varchar("author_type", { length: 20 }).notNull(),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBookingNoteSchema = createInsertSchema(bookingNotes).omit({
  id: true,
  createdAt: true,
});

export type BookingNote = typeof bookingNotes.$inferSelect;
export type InsertBookingNote = z.infer<typeof insertBookingNoteSchema>;

export const consentTokens = pgTable("consent_tokens", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activationTokens = pgTable("activation_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  plan: varchar("plan", { length: 20 }).notNull(),
  billingCycle: varchar("billing_cycle", { length: 10 }).notNull(),
  razorpaySubscriptionId: varchar("razorpay_subscription_id", { length: 255 }),
  shortUrl: varchar("short_url", { length: 1000 }),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivationTokenSchema = createInsertSchema(activationTokens).omit({
  id: true,
  createdAt: true,
});

export type ActivationToken = typeof activationTokens.$inferSelect;
export type InsertActivationToken = z.infer<typeof insertActivationTokenSchema>;

export const emailOtps = pgTable("email_otps", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  otpHash: varchar("otp_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  verifiedToken: varchar("verified_token", { length: 64 }),
  purpose: varchar("purpose", { length: 50 }).notNull().default("booking"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type EmailOtp = typeof emailOtps.$inferSelect;

export const insertConsentTokenSchema = createInsertSchema(consentTokens).omit({
  id: true,
  createdAt: true,
});

export type ConsentToken = typeof consentTokens.$inferSelect;
export type InsertConsentToken = z.infer<typeof insertConsentTokenSchema>;

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const smileDeals = pgTable("smile_deals", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  imageUrl: varchar("image_url", { length: 1000 }).notNull(),
  bookingLink: varchar("booking_link", { length: 1000 }).notNull(),
  price: varchar("price", { length: 50 }),
  originalPrice: varchar("original_price", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  videoUrl: varchar("video_url", { length: 1000 }),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isFlash: boolean("is_flash").default(false).notNull(),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  viewCount: integer("view_count").default(0).notNull(),
  clickCount: integer("click_count").default(0).notNull(),
  clinicId: integer("clinic_id").references(() => clinics.id),
  contactInfo: jsonb("contact_info").$type<{ sponsorName?: string; phone?: string; email?: string; website?: string } | null>(),
  targetAudience: varchar("target_audience", { length: 20 }).default("patient").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSmileDealSchema = createInsertSchema(smileDeals).omit({
  id: true,
  createdAt: true,
  viewCount: true,
  clickCount: true,
});

export type SmileDeal = typeof smileDeals.$inferSelect;
export type InsertSmileDeal = z.infer<typeof insertSmileDealSchema>;

export const insertSiteSettingsSchema = createInsertSchema(siteSettings).omit({
  id: true,
  updatedAt: true,
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingsSchema>;

export const clinicalRecords = pgTable("clinical_records", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  patientId: integer("patient_id").references(() => patients.id),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  patientPhone: varchar("patient_phone", { length: 50 }),
  doctorName: varchar("doctor_name", { length: 255 }),
  diagnosis: jsonb("diagnosis").$type<string[]>().default([]),
  prescription: text("prescription"),
  notes: text("notes"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicalRecordSchema = createInsertSchema(clinicalRecords).omit({
  id: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
});

export type ClinicalRecord = typeof clinicalRecords.$inferSelect;
export type InsertClinicalRecord = z.infer<typeof insertClinicalRecordSchema>;

export const exportHistory = pgTable("export_history", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  format: varchar("format", { length: 10 }).notNull(),
  scope: text("scope").array().notNull(),
  recordCount: integer("record_count").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExportHistorySchema = createInsertSchema(exportHistory).omit({
  id: true,
  createdAt: true,
});

export type ExportHistory = typeof exportHistory.$inferSelect;
export type InsertExportHistory = z.infer<typeof insertExportHistorySchema>;

// ── INVENTORY ──────────────────────────────────────────────────────────────

export const inventoryCategories = pgTable("inventory_categories", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  name: varchar("name", { length: 255 }).notNull(),
  department: varchar("department", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  categoryId: integer("category_id").references(() => inventoryCategories.id),
  name: varchar("name", { length: 255 }).notNull(),
  trackingType: varchar("tracking_type", { length: 20 }).notNull().default("consumable"),
  unit: varchar("unit", { length: 50 }),
  currentQty: integer("current_qty").notNull().default(0),
  reorderLevel: integer("reorder_level"),
  criticalLevel: integer("critical_level"),
  expiryDate: timestamp("expiry_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  nextServiceDate: timestamp("next_service_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockTransactions = pgTable("stock_transactions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => inventoryItems.id),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  type: varchar("type", { length: 20 }).notNull(),
  qtyBefore: integer("qty_before").notNull(),
  qtyChange: integer("qty_change").notNull(),
  qtyAfter: integer("qty_after").notNull(),
  reason: varchar("reason", { length: 500 }),
  performedBy: varchar("performed_by", { length: 255 }),
  performedAt: timestamp("performed_at").defaultNow(),
});

export const stockAlerts = pgTable("stock_alerts", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => inventoryItems.id),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  alertType: varchar("alert_type", { length: 20 }).notNull(),
  isDismissed: boolean("is_dismissed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryCategorySchema = createInsertSchema(inventoryCategories).omit({ id: true, createdAt: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, createdAt: true });
export const insertStockTransactionSchema = createInsertSchema(stockTransactions).omit({ id: true, performedAt: true });
export const insertStockAlertSchema = createInsertSchema(stockAlerts).omit({ id: true, createdAt: true });

export type InventoryCategory = typeof inventoryCategories.$inferSelect;
export type InsertInventoryCategory = z.infer<typeof insertInventoryCategorySchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type InsertStockTransaction = z.infer<typeof insertStockTransactionSchema>;
export type StockAlert = typeof stockAlerts.$inferSelect;
export type InsertStockAlert = z.infer<typeof insertStockAlertSchema>;

// ─── Login audit log ─────────────────────────────────────────────────────────

export const loginEvents = pgTable("login_events", {
  id:         serial("id").primaryKey(),
  role:       varchar("role", { length: 20 }).notNull(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  ipAddress:  varchar("ip_address", { length: 64 }),
  userAgent:  text("user_agent"),
  success:    boolean("success").notNull().default(true),
  createdAt:  timestamp("created_at").defaultNow(),
});

export type LoginEvent = typeof loginEvents.$inferSelect;
export type InsertLoginEvent = typeof loginEvents.$inferInsert;

// ── PATIENT BILLS ──────────────────────────────────────────────────────────

export const patientBills = pgTable("patient_bills", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinics.id),
  bookingId: integer("booking_id").references(() => bookings.id),
  patientId: integer("patient_id").references(() => patients.id),
  billNumber: varchar("bill_number", { length: 50 }).notNull(),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  patientPhone: varchar("patient_phone", { length: 50 }),
  patientEmail: varchar("patient_email", { length: 255 }),
  services: jsonb("services").$type<{ description: string; category: string; amount: number }[]>().default([]),
  subtotal: real("subtotal").notNull().default(0),
  discountPct: real("discount_pct").notNull().default(0),
  taxPct: real("tax_pct").notNull().default(0),
  total: real("total").notNull().default(0),
  paymentMethod: varchar("payment_method", { length: 50 }).default("Cash"),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("paid"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPatientBillSchema = createInsertSchema(patientBills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PatientBill = typeof patientBills.$inferSelect;
export type InsertPatientBill = z.infer<typeof insertPatientBillSchema>;

// ────────────────────────────────────────────────────────────────────────────

export interface ClinicSession {
  adminLoggedIn?: boolean;
  adminEmail?: string;
  doctorLoggedIn?: boolean;
  doctorEmail?: string;
  doctorId?: number;
  clinicId?: number;
  role?: 'superuser' | 'owner' | 'doctor' | 'customer';
}
