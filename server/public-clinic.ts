import type { Clinic } from "@shared/schema";
import { websiteConfigSchema, isSafePublicUrl, normalizeExternalUrl } from "./website-security";

function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value || !isSafePublicUrl(value, false)) return null;
  return normalizeExternalUrl(value);
}

function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const isRelativeImagePath = trimmed.startsWith("/") && !trimmed.startsWith("//");
  const isHttpsImageUrl = /^https:\/\//i.test(trimmed);
  if ((!isRelativeImagePath && !isHttpsImageUrl) || !isSafePublicUrl(trimmed, true)) return null;
  return trimmed;
}

function toPublicWebsiteConfig(config: Clinic["websiteConfig"]) {
  const parsed = websiteConfigSchema.safeParse(config);
  return parsed.success ? parsed.data : null;
}

function toPublicDoctors(doctors: Clinic["doctors"]) {
  if (!Array.isArray(doctors)) return [];

  return (doctors as unknown[])
    .filter((doctor): doctor is Record<string, unknown> => Boolean(doctor) && typeof doctor === "object")
    .map(doctor => ({
      name: typeof doctor.name === "string" ? doctor.name : "",
      specialization: typeof doctor.specialization === "string" ? doctor.specialization : "",
      degree: typeof doctor.degree === "string" ? doctor.degree : "",
      imageUrl: safeImageUrl(typeof doctor.imageUrl === "string" ? doctor.imageUrl : null),
      bio: typeof doctor.bio === "string" ? doctor.bio : null,
      yearsOfExperience: typeof doctor.yearsOfExperience === "number" && Number.isFinite(doctor.yearsOfExperience)
        ? doctor.yearsOfExperience
        : null,
    }))
    .filter(doctor => doctor.name);
}

export function toPublicClinic(clinic: Clinic) {
  return {
    id: clinic.id,
    username: clinic.username,
    name: clinic.name,
    address: clinic.address,
    city: clinic.city,
    pincode: clinic.pincode,
    email: clinic.email,
    phone: clinic.phone,
    website: safeExternalUrl(clinic.website),
    logoUrl: safeImageUrl(clinic.logoUrl),
    latitude: clinic.latitude,
    longitude: clinic.longitude,
    doctorName: clinic.doctorName,
    doctorSpecialization: clinic.doctorSpecialization,
    doctorDegree: clinic.doctorDegree,
    doctors: toPublicDoctors(clinic.doctors),
    websiteConfig: toPublicWebsiteConfig(clinic.websiteConfig),
  };
}

export function toPublicClinicListItem(clinic: Clinic) {
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address,
    username: clinic.username,
    city: clinic.city,
    pincode: clinic.pincode,
  };
}