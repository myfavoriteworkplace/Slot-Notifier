import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticatedImageUploadSchema,
  clinicPublicProfileSchema,
  isSafePlainText,
  isSafePublicUrl,
  isValidClinicSlug,
  publicClinicDocumentUploadSchema,
  websiteConfigSchema,
} from "./website-security";
import { canRequestImageFolder } from "./upload-policy";

test("plain-text policy accepts normal copy and rejects executable content", () => {
  assert.equal(isSafePlainText("Comfortable, modern dental care.\nOpen Monday–Saturday."), true);
  assert.equal(isSafePlainText("<script>alert(1)</script>"), false);
  assert.equal(isSafePlainText('Click <a href="javascript:alert(1)">here</a>'), false);
  assert.equal(isSafePlainText("{{ patient.name }}"), false);
  assert.equal(isSafePlainText("unsafe\u0000value"), false);
});

test("public URL policy rejects dangerous schemes and credentialed URLs", () => {
  assert.equal(isSafePublicUrl("https://example.com/clinic", false), true);
  assert.equal(isSafePublicUrl("/images/clinic.webp", true), true);
  assert.equal(isSafePublicUrl("javascript:alert(1)", false), false);
  assert.equal(isSafePublicUrl("data:text/html,<script>alert(1)</script>", false), false);
  assert.equal(isSafePublicUrl("https://user:password@example.com", false), false);
  assert.equal(isSafePublicUrl("//attacker.example/image.png", true), false);
});

test("clinic slugs are bounded and cannot use ambiguous underscore runs", () => {
  assert.equal(isValidClinicSlug("bright-smile_2"), true);
  assert.equal(isValidClinicSlug("bright smile"), false);
  assert.equal(isValidClinicSlug("__admin"), false);
  assert.equal(isValidClinicSlug("bright__smile"), true);
  assert.equal(isValidClinicSlug("a".repeat(101)), false);
});

test("website configuration is strict and rejects dangerous content", () => {
  const valid = websiteConfigSchema.safeParse({
    theme: "classic",
    heroDescription: "Thoughtful dental care for your family.",
    gallery: [{ url: "https://cdn.example.com/clinic.webp", caption: "Reception" }],
  });
  assert.equal(valid.success, true);

  const unsafe = websiteConfigSchema.safeParse({
    theme: "classic",
    heroDescription: "<script>alert(1)</script>",
  });
  assert.equal(unsafe.success, false);

  const unknownField = websiteConfigSchema.safeParse({
    theme: "classic",
    subscriptionStatus: "active",
  });
  assert.equal(unknownField.success, false);
});

test("profile and upload request schemas reject unsupported fields", () => {
  assert.equal(
    clinicPublicProfileSchema.safeParse({ phone: "+91 98765 43210", city: "Pune" }).success,
    true,
  );
  assert.equal(
    clinicPublicProfileSchema.safeParse({ phone: "+91 98765 43210", passwordHash: "secret" }).success,
    false,
  );
  assert.equal(
    authenticatedImageUploadSchema.safeParse({
      fileName: "clinic.png",
      contentType: "image/png",
      fileSize: 1024,
      folder: "clinics",
    }).success,
    true,
  );
  assert.equal(
    authenticatedImageUploadSchema.safeParse({
      fileName: "clinic.svg",
      contentType: "image/svg+xml",
      fileSize: 1024,
      folder: "clinics",
    }).success,
    false,
  );
  assert.equal(
    publicClinicDocumentUploadSchema.safeParse({
      fileName: "registration.pdf",
      contentType: "application/pdf",
      fileSize: 1024,
      folder: "doctors",
    }).success,
    false,
  );
});

test("authenticated upload folders follow session role boundaries", () => {
  assert.equal(canRequestImageFolder({ role: "owner", adminLoggedIn: true }, "clinics"), true);
  assert.equal(canRequestImageFolder({ role: "owner", adminLoggedIn: true }, "case-media"), false);
  assert.equal(canRequestImageFolder({ role: "doctor", doctorLoggedIn: true }, "case-media"), true);
  assert.equal(canRequestImageFolder({ role: "doctor", doctorLoggedIn: true }, "clinics"), false);
  assert.equal(canRequestImageFolder({ role: "superuser", adminLoggedIn: true }, "smile-deals"), true);
  assert.equal(canRequestImageFolder({ role: "owner" }, "clinics"), false);
});