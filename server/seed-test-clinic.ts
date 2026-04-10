import { storage } from "./storage";
import { db } from "./db";
import { clinicDoctors, bookings, slots, clinicalRecords } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function daysFromNow(offset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysAgo(offset: number, hour: number, minute = 0): Date {
  return daysFromNow(-offset, hour, minute);
}

// ─────────────────────────────────────────────
//  Main seed
// ─────────────────────────────────────────────
export async function seed() {
  console.log("[SEED] Checking for demo clinic...");

  const CLINIC_USERNAME = "demo_clinic";
  const CLINIC_PASSWORD = "demo_password123";
  const DOCTOR_EMAIL    = "demo.doctor@bookmyslot.in";
  const DOCTOR_PASSWORD = "demo_doctor123";

  // ── 1. Demo Clinic ──────────────────────────
  let clinic = await storage.getClinicByUsername(CLINIC_USERNAME);
  if (!clinic) {
    const hashedPwd = await bcrypt.hash(CLINIC_PASSWORD, 10);
    clinic = await storage.createClinic({
      name:                 "Demo Smile Clinic",
      address:              "12 Dental Avenue, MG Road",
      city:                 "Kochi",
      pincode:              "682001",
      email:                "demo@bookmyslot.in",
      phone:                "9876543210",
      username:             CLINIC_USERNAME,
      passwordHash:         hashedPwd,
      website:              "https://bookmyslot.dental.mossaic.in",
      doctorName:           "Dr. Priya Menon",
      doctorSpecialization: "Orthodontics",
      doctorDegree:         "BDS, MDS",
      status:               "approved",
      doctors: [
        { name: "Dr. Priya Menon",  specialization: "Orthodontics",     degree: "BDS, MDS",  imageUrl: null },
        { name: "Dr. Arjun Nair",   specialization: "Dental Surgery",   degree: "BDS",       imageUrl: null },
      ],
    } as any);
    console.log(`[SEED] Created demo clinic: ${clinic.name}`);
  } else {
    console.log("[SEED] Demo clinic already exists.");
  }

  // ── 2. Demo Doctor ───────────────────────────
  let doctor = await storage.getDoctorByEmail(DOCTOR_EMAIL);
  if (!doctor) {
    const hashedPwd = await bcrypt.hash(DOCTOR_PASSWORD, 10);
    doctor = await storage.createDoctor({
      name:              "Dr. Priya Menon",
      email:             DOCTOR_EMAIL,
      passwordHash:      hashedPwd,
      specialization:    "Orthodontics",
      degree:            "BDS, MDS",
      college:           "Government Dental College, Kochi",
      bio:               "Experienced orthodontist with 8+ years of practice in smile correction, braces, and dental alignment. Passionate about patient-centred care.",
      phone:             "9876500001",
      yearsOfExperience: 8,
      languages:         ["English", "Malayalam", "Hindi"],
      imageUrl:          null,
    });
    console.log(`[SEED] Created demo doctor: ${doctor.name}`);
  } else {
    console.log("[SEED] Demo doctor already exists.");
  }

  // ── 3. Link doctor to clinic ─────────────────
  const existingLink = await db
    .select()
    .from(clinicDoctors)
    .where(and(eq(clinicDoctors.clinicId, clinic.id), eq(clinicDoctors.doctorId, doctor.id)));
  if (existingLink.length === 0) {
    await storage.linkDoctorToClinic(clinic.id, doctor.id);
    console.log("[SEED] Linked demo doctor to demo clinic.");
  }

  // ── 4. Doctor certifications ─────────────────
  const existingCerts = await storage.getCertificationsByDoctor(doctor.id);
  if (existingCerts.length === 0) {
    await storage.createCertification({ doctorId: doctor.id, title: "Advanced Orthodontics",         issuer: "Indian Orthodontic Society",    year: "2019", description: "Post-graduate certification in fixed orthodontic appliances." });
    await storage.createCertification({ doctorId: doctor.id, title: "Invisalign Certified Provider", issuer: "Align Technology",             year: "2021", description: "Certified to plan and deliver Invisalign clear aligner treatment." });
    await storage.createCertification({ doctorId: doctor.id, title: "Dental Implant Basics",         issuer: "IDA Continuing Education",     year: "2020", description: "Foundation course in implant planning and placement." });
    console.log("[SEED] Created demo doctor certifications.");
  }

  // ── 5. Doctor cases ───────────────────────────
  const existingCases = await storage.getCasesByDoctor(doctor.id);
  if (existingCases.length === 0) {
    await storage.createCase({ doctorId: doctor.id, title: "Crowding Correction with Braces", description: "18-month treatment for moderate crowding in a 17-year-old. Full fixed metal brackets, IPR at 6 months, excellent result.", tags: ["orthodontics", "braces", "crowding"], mediaUrls: [] });
    await storage.createCase({ doctorId: doctor.id, title: "Invisalign for Adult Patient",   description: "Clear aligner treatment for mild spacing and midline shift. 14 aligners, completed in 9 months.", tags: ["invisalign", "spacing", "adult"], mediaUrls: [] });
    console.log("[SEED] Created demo doctor cases.");
  }

  // ── 6. Slots + Bookings ───────────────────────
  const existingBookings = await storage.getBookingsByClinicId(clinic.id);
  if (existingBookings.length > 0) {
    console.log("[SEED] Demo bookings already exist — skipping slot/booking seeding.");
    return;
  }

  console.log("[SEED] Creating demo slots and bookings...");

  // Helper — create a slot and return it
  async function makeSlot(startTime: Date, endTime: Date): Promise<typeof slots.$inferSelect> {
    return storage.createSlot({
      ownerId:    null,
      clinicId:   clinic!.id,
      clinicName: clinic!.name,
      startTime,
      endTime,
      isBooked:   false,
    } as any);
  }

  // Helper — create a booking against a slot and mark the slot booked
  async function makeBooking(
    slot: typeof slots.$inferSelect,
    name: string,
    phone: string,
    email: string,
    description: string,
    status: "pending" | "verified",
    extras: Partial<typeof bookings.$inferSelect> = {}
  ): Promise<typeof bookings.$inferSelect> {
    const booking = await storage.createPublicBooking({
      slotId: slot.id, customerName: name, customerPhone: phone,
      customerEmail: email, description, verificationStatus: status,
    });
    await db.update(slots).set({ isBooked: true }).where(eq(slots.id, slot.id));
    if (Object.keys(extras).length) {
      await db.update(bookings).set(extras as any).where(eq(bookings.id, booking.id));
    }
    return booking;
  }

  // ── Past bookings (show history) ─────────────
  const p1Slot = await makeSlot(daysAgo(6, 10), daysAgo(6, 11));
  await makeBooking(p1Slot, "Ananya Krishnan", "9745001001", "ananya@example.com", "Routine checkup and scaling", "verified", {
    assignedDoctor: "Dr. Priya Menon", assignedDoctorEmail: DOCTOR_EMAIL,
    doctorApprovalStatus: "approved", clinicalStatus: "completed", confirmedBy: "clinic",
  });

  const p2Slot = await makeSlot(daysAgo(5, 14), daysAgo(5, 15));
  await makeBooking(p2Slot, "Rohan Das", "9745002002", "rohan@example.com", "Tooth extraction — lower left molar", "verified", {
    assignedDoctor: "Dr. Arjun Nair", clinicalStatus: "completed", confirmedBy: "clinic",
  });

  const p3Slot = await makeSlot(daysAgo(4, 11), daysAgo(4, 12));
  const pb3 = await makeBooking(p3Slot, "Meera Pillai", "9745003003", "meera@example.com", "Braces consultation", "verified", {
    assignedDoctor: "Dr. Priya Menon", assignedDoctorEmail: DOCTOR_EMAIL,
    doctorApprovalStatus: "approved", clinicalStatus: "completed", confirmedBy: "clinic",
  });

  const p4Slot = await makeSlot(daysAgo(3, 9), daysAgo(3, 10));
  await makeBooking(p4Slot, "Suresh Nambiar", "9745004004", "suresh@example.com", "Root canal treatment", "verified", {
    assignedDoctor: "Dr. Arjun Nair", clinicalStatus: "in_progress", confirmedBy: "clinic",
  });

  const p5Slot = await makeSlot(daysAgo(2, 16), daysAgo(2, 17));
  await makeBooking(p5Slot, "Divya Thomas", "9745005005", "divya@example.com", "Whitening consultation", "verified", {
    clinicalStatus: "cancelled", confirmedBy: "clinic",
  });

  const p6Slot = await makeSlot(daysAgo(1, 13), daysAgo(1, 14));
  await makeBooking(p6Slot, "Kiran Menon", "9745006006", "kiran@example.com", "Crown fitting follow-up", "verified", {
    assignedDoctor: "Dr. Priya Menon", assignedDoctorEmail: DOCTOR_EMAIL,
    doctorApprovalStatus: "approved", clinicalStatus: "completed", confirmedBy: "clinic",
  });

  // ── Today's bookings ─────────────────────────
  const t1Slot = await makeSlot(daysFromNow(0, 9),  daysFromNow(0, 10));
  await makeBooking(t1Slot, "Anand Kumar", "9745007007", "anand@example.com", "Cavity filling — upper right", "verified", {
    assignedDoctor: "Dr. Priya Menon", assignedDoctorEmail: DOCTOR_EMAIL,
    doctorApprovalStatus: "approved", confirmedBy: "clinic",
  });

  const t2Slot = await makeSlot(daysFromNow(0, 11), daysFromNow(0, 12));
  await makeBooking(t2Slot, "Lakshmi Iyer", "9745008008", "lakshmi@example.com", "Orthodontic adjustment", "verified", {
    assignedDoctor: "Dr. Priya Menon", assignedDoctorEmail: DOCTOR_EMAIL,
    doctorApprovalStatus: "pending",
  });

  const t3Slot = await makeSlot(daysFromNow(0, 14), daysFromNow(0, 15));
  await makeBooking(t3Slot, "Rahul Varma", "9745009009", "rahul@example.com", "Denture fitting", "pending");

  // ── Upcoming bookings ────────────────────────
  const u1Slot = await makeSlot(daysFromNow(1, 10), daysFromNow(1, 11));
  await makeBooking(u1Slot, "Nisha Raj", "9745010010", "nisha@example.com", "Invisalign consultation", "verified", {
    assignedDoctor: "Dr. Priya Menon", assignedDoctorEmail: DOCTOR_EMAIL,
    doctorApprovalStatus: "approved", confirmedBy: "clinic",
  });

  const u2Slot = await makeSlot(daysFromNow(1, 15), daysFromNow(1, 16));
  await makeBooking(u2Slot, "Vijay Shankar", "9745011011", "vijay@example.com", "Wisdom tooth removal consult", "verified", {
    confirmedBy: "clinic",
  });

  const u3Slot = await makeSlot(daysFromNow(2, 9),  daysFromNow(2, 10));
  await makeBooking(u3Slot, "Preethi Nair", "9745012012", "preethi@example.com", "Braces tightening", "verified", {
    assignedDoctor: "Dr. Priya Menon", assignedDoctorEmail: DOCTOR_EMAIL,
    doctorApprovalStatus: "approved", confirmedBy: "clinic",
  });

  const u4Slot = await makeSlot(daysFromNow(2, 13), daysFromNow(2, 14));
  await makeBooking(u4Slot, "Arun Jose",   "9745013013", "arun@example.com",   "Scaling and polishing", "pending");

  const u5Slot = await makeSlot(daysFromNow(3, 10), daysFromNow(3, 11));
  await makeBooking(u5Slot, "Sneha Pillai", "9745014014", "sneha@example.com", "Fluoride treatment — child", "verified", {
    confirmedBy: "clinic",
  });

  const u6Slot = await makeSlot(daysFromNow(4, 11), daysFromNow(4, 12));
  await makeBooking(u6Slot, "Deepak Mohan", "9745015015", "deepak@example.com", "Dental X-Ray + consultation", "verified", {
    assignedDoctor: "Dr. Arjun Nair", confirmedBy: "clinic",
  });

  const u7Slot = await makeSlot(daysFromNow(5, 14), daysFromNow(5, 15));
  await makeBooking(u7Slot, "Amrita Sinha", "9745016016", "amrita@example.com", "Second opinion on implant", "pending");

  const u8Slot = await makeSlot(daysFromNow(6, 9),  daysFromNow(6, 10));
  await makeBooking(u8Slot, "Manoj Pillai", "9745017017", "manoj@example.com", "Post-surgery review", "verified", {
    assignedDoctor: "Dr. Priya Menon", assignedDoctorEmail: DOCTOR_EMAIL,
    doctorApprovalStatus: "approved", confirmedBy: "clinic",
  });

  // Free upcoming slots (not booked) for realistic availability display
  for (let day = 1; day <= 7; day++) {
    for (const hour of [9, 11, 14, 16]) {
      await makeSlot(daysFromNow(day, hour), daysFromNow(day, hour + 1));
    }
  }

  // ── 7. Clinical records ───────────────────────
  try {
    await storage.createClinicalRecord({
      bookingId:    pb3.id,
      clinicId:     clinic.id,
      patientName:  "Meera Pillai",
      patientPhone: "9745003003",
      doctorName:   "Dr. Priya Menon",
      diagnosis:    ["Mild dental crowding", "Class I malocclusion"],
      prescription: "Commence fixed orthodontic treatment with MBT 0.022 slot brackets. Review in 4 weeks.",
      notes:        "Patient is motivated and well-informed about treatment duration (~18 months). Pre-treatment photos taken.",
      isDeleted:    false,
    } as any);
    console.log("[SEED] Created demo clinical records.");
  } catch (e) {
    console.log("[SEED] Clinical records skipped (may already exist).");
  }

  console.log("[SEED] ✓ Demo data seeded successfully.");
  console.log(`[SEED]   Clinic login  → ${CLINIC_USERNAME} / ${CLINIC_PASSWORD}`);
  console.log(`[SEED]   Doctor login  → ${DOCTOR_EMAIL} / ${DOCTOR_PASSWORD}`);
}

// Only run immediately if this file is executed directly
if (process.env.FORCE_SEED === "true") {
  seed().catch(err => {
    console.error("Seeding failed:", err);
  });
}
