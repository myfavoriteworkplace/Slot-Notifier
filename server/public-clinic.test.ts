import assert from "node:assert/strict";
import test from "node:test";
import { toPublicClinic } from "./public-clinic";

test("public clinic mapper returns only patient-facing fields", () => {
  const result = toPublicClinic({
    id: 7,
    name: "Bright Smile",
    username: "bright-smile",
    address: "1 Main Road",
    city: "Pune",
    pincode: "411001",
    email: "hello@example.com",
    phone: "+91 98765 43210",
    website: "example.com",
    logoUrl: "https://cdn.example.com/logo.png",
    latitude: 18.52,
    longitude: 73.85,
    doctorName: "Dr. A",
    doctorSpecialization: "Orthodontics",
    doctorDegree: "BDS",
    doctors: [{
      name: "Dr. A",
      specialization: "Orthodontics",
      degree: "BDS",
      imageUrl: "https://cdn.example.com/doctor.png",
      bio: "Specialist",
      yearsOfExperience: 10,
      passwordHash: "must-not-leak",
    } as any],
    websiteConfig: { theme: "classic", heroDescription: "Care for every smile." },
    passwordHash: "must-not-leak",
    registeredBy: "internal-user",
    status: "approved",
    isArchived: false,
    trustScore: 99,
    subscriptionStatus: "active",
    storageLimitBytes: 123,
  } as any);

  assert.deepEqual(Object.keys(result).sort(), [
    "address", "city", "doctorDegree", "doctorName", "doctorSpecialization",
    "doctors", "email", "id", "latitude", "logoUrl", "longitude", "name",
    "phone", "pincode", "username", "website", "websiteConfig",
  ]);
  assert.equal("passwordHash" in result, false);
  assert.equal("subscriptionStatus" in result, false);
  assert.equal((result.doctors[0] as Record<string, unknown>).passwordHash, undefined);
  assert.equal(result.website, "https://example.com");
});