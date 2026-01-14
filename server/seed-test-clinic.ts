import { storage } from "./storage";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding test clinic...");
  
  const demoUsername = "demo_clinic";
  const demoPassword = "demo_password123";
  const hashedPassword = await bcrypt.hash(demoPassword, 10);
  
  // Check if clinic already exists
  const existingClinic = await storage.getClinicByUsername(demoUsername);
  if (existingClinic) {
    console.log("Demo clinic already exists. Updating password...");
    await storage.updateClinic(existingClinic.id, { passwordHash: hashedPassword });
  } else {
    const clinic = await storage.createClinic({
      name: "Demo Smile Clinic",
      address: "123 Demo St, Dental City",
      username: demoUsername,
      passwordHash: hashedPassword,
    });
    console.log(`Created demo clinic: ${clinic.name}`);
    
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
    console.log("Created 5 test slots for today.");
  }
  
  console.log("Seeding completed successfully.");
  console.log(`Login: ${demoUsername} / ${demoPassword}`);
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
