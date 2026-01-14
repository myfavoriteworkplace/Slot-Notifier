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
  } else {
    const clinic = await storage.createClinic({
      name: "Demo Smile Clinic",
      address: "123 Demo St, Dental City",
      username: demoUsername,
      passwordHash: hashedPassword,
    });
    console.log(`[SEED] Created demo clinic: ${clinic.name}`);
    
    // Create some test slots
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    
    for (let i = 0; i < 5; i++) {
      const startTime = new Date(today);
      startTime.setHours(today.getHours() + i);
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
    console.log("[SEED] Created 5 test slots for today.");
    console.log(`[SEED] Demo credentials: ${demoUsername} / ${demoPassword}`);
  }
}

// Only run immediately if this file is executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.env.NODE_ENV === "production" || process.env.FORCE_SEED === "true") {
  seed().catch(err => {
    console.error("Seeding failed:", err);
    // Don't exit in production/startup to prevent boot loops
    if (import.meta.url.endsWith(process.argv[1])) process.exit(1);
  });
}
