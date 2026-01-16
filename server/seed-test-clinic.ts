import { storage } from "./storage";
import bcrypt from "bcryptjs";

export async function seed() {
  console.log("[SEED] Checking for demo clinic...");
  
  const demoUsername = "demo_clinic";
  const demoPassword = "demo_password123";
  const hashedPassword = await bcrypt.hash(demoPassword, 10);
  
  // Check if clinic already exists
  const existingClinic = await storage.getClinicByUsername(demoUsername);
  if (existingClinic) {
    console.log("[SEED] Demo clinic already exists.");
    // Update email if missing
    if (!existingClinic.email) {
      await storage.updateClinic(existingClinic.id, { email: "demo@example.com" });
      console.log("[SEED] Updated demo clinic email.");
    }
  } else {
    const clinic = await storage.createClinic({
      name: "Demo Smile Clinic",
      address: "123 Demo St, Dental City",
      email: "demo@example.com",
      username: demoUsername,
      passwordHash: hashedPassword,
    });
    console.log(`[SEED] Created demo clinic: ${clinic.name}`);
    
    // Create some test slots
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    
    // Seed for the next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDay = new Date(today);
      currentDay.setDate(today.getDate() + dayOffset);
      
      for (let i = 0; i < 5; i++) {
        const startTime = new Date(currentDay);
        startTime.setHours(currentDay.getHours() + i);
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + 1);
        
        await storage.createSlot({
          ownerId: null,
          clinicId: clinic.id,
          clinicName: clinic.name,
          startTime,
          endTime,
          isBooked: false,
        } as any);
      }
    }
    console.log("[SEED] Created 35 test slots for the next week.");
    console.log(`[SEED] Demo credentials: ${demoUsername} / ${demoPassword}`);
  }
}

// Only run immediately if this file is executed directly
if (process.env.FORCE_SEED === "true") {
  seed().catch(err => {
    console.error("Seeding failed:", err);
  });
}
