import { pgTable, text, serial, timestamp, boolean, varchar, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";
import { relations, sql } from "drizzle-orm";

// Export auth models so they are picked up
export * from "./models/auth";

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
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }),
  verificationCode: varchar("verification_code", { length: 10 }),
  verificationStatus: varchar("verification_status", { length: 20 }).default("pending").notNull(),
  verificationExpiresAt: timestamp("verification_expires_at"),
  description: text("description"),
  assignedDoctor: varchar("assigned_doctor", { length: 255 }),
  assignedDoctorEmail: varchar("assigned_doctor_email", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
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
  specialization: varchar("specialization", { length: 255 }),
  degree: varchar("degree", { length: 255 }),
  college: varchar("college", { length: 255 }),
  bio: text("bio"),
  phone: varchar("phone", { length: 50 }),
  imageUrl: varchar("image_url", { length: 1000 }),
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

export interface ClinicSession {
  adminLoggedIn?: boolean;
  adminEmail?: string;
  doctorLoggedIn?: boolean;
  doctorEmail?: string;
  doctorId?: number;
  clinicId?: number;
  role?: 'superuser' | 'owner' | 'doctor' | 'customer';
}
