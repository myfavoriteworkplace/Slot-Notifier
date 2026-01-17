import { pgTable, text, serial, timestamp, boolean, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";
import { relations } from "drizzle-orm";

// Export auth models so they are picked up
export * from "./models/auth";

export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  email: varchar("email", { length: 255 }),
  username: varchar("username", { length: 100 }).unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
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
