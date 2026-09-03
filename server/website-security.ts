import { z } from "zod";

const UNSAFE_WEBSITE_VALUE = /(?:<\s*\/?\s*[a-z][^>]*>|(?:^|[\s"'`])on[a-z]+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*(?:text\/html|application\/javascript)|\{\{|\}\}|<%|%>)/i;
const SAFE_ICON_NAME = /^[a-z0-9_-]+$/i;

export function isSafePlainText(value: string): boolean {
  return !UNSAFE_WEBSITE_VALUE.test(value);
}

export function isSafePublicUrl(value: string, allowRelative = true): boolean {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return false;

  if (trimmed.startsWith("/")) {
    return allowRelative && !trimmed.startsWith("//");
  }

  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const textField = (max: number) =>
  z.string().max(max).refine(isSafePlainText, {
    message: "HTML, scripts, event handlers, and template expressions are not allowed",
  });

const publicUrlField = (max = 1200, allowRelative = true) =>
  z.string().max(max).refine(value => isSafePublicUrl(value, allowRelative), {
    message: "Use an HTTPS URL or a safe relative path",
  });

const optionalPublicUrlField = (max = 1200, allowRelative = true) =>
  z.union([z.literal(""), publicUrlField(max, allowRelative)]);

const iconField = () =>
  z.string().max(60).regex(SAFE_ICON_NAME, "Icon names may contain only letters, numbers, hyphens, and underscores");

export const websiteConfigSchema = z.object({
  theme: z.enum(["classic", "warm", "modern", "red-clinical"]),
  taglineL1: textField(180).optional(),
  taglineL2: textField(180).optional(),
  heroDescription: textField(1200).optional(),
  announcementText: textField(240).optional(),
  aboutDescription: textField(2400).optional(),
  aboutImageUrl: optionalPublicUrlField().optional(),
  vision: textField(1200).optional(),
  values: textField(1200).optional(),
  heroImageUrl: optionalPublicUrlField().optional(),
  heroForegroundImageUrl: optionalPublicUrlField().optional(),
  featuresImageUrl: optionalPublicUrlField().optional(),
  gallery: z.array(z.object({
    url: publicUrlField(),
    caption: textField(240),
  }).strict()).max(6).optional(),
  services: z.array(z.object({
    name: textField(180),
    description: textField(1200),
    imageUrl: optionalPublicUrlField().optional(),
  }).strict()).max(20).optional(),
  trustPoints: z.array(z.object({
    title: textField(180),
    description: textField(600),
    icon: iconField().optional(),
    category: textField(80).optional(),
  }).strict()).max(6).optional(),
  specialties: z.array(z.object({
    title: textField(180),
    description: textField(1200),
    icon: iconField().optional(),
  }).strict()).max(6).optional(),
  treatmentGroups: z.array(z.object({
    name: textField(180),
    description: textField(1200).optional(),
    items: z.array(textField(240)).max(10),
    imageUrl: optionalPublicUrlField().optional(),
  }).strict()).max(8).optional(),
  testimonials: z.array(z.object({
    quote: textField(1200),
    patientName: textField(180),
    rating: z.number().int().min(1).max(5),
  }).strict()).max(5).optional(),
  faq: z.array(z.object({
    question: textField(240),
    answer: textField(1200),
  }).strict()).max(12).optional(),
  socialPosts: z.array(z.object({
    imageUrl: publicUrlField(),
    caption: textField(240).optional(),
    link: optionalPublicUrlField(1200, false).optional(),
  }).strict()).max(6).optional(),
  hours: z.array(z.object({
    day: textField(80),
    open: textField(40),
    close: textField(40),
    closed: z.boolean(),
  }).strict()).max(14).optional(),
  socialLinks: z.object({
    instagram: optionalPublicUrlField(1200, false).optional(),
    facebook: optionalPublicUrlField(1200, false).optional(),
    youtube: optionalPublicUrlField(1200, false).optional(),
  }).strict().optional(),
  showMap: z.boolean().optional(),
  stats: z.array(z.object({
    value: textField(80),
    label: textField(180),
  }).strict()).max(4).optional(),
  features: z.array(z.object({
    icon: iconField(),
    title: textField(180),
  }).strict()).max(4).optional(),
}).strict();

export const clinicPublicProfileSchema = z.object({
  phone: z.string().min(1).max(50).regex(/^[0-9+().\-\s]+$/, "Enter a valid phone number").optional(),
  email: z.string().email().max(255).optional(),
  website: z.string().max(1000).refine(value => value === "" || isSafePublicUrl(value, false), {
    message: "Use a valid HTTPS website URL",
  }).optional(),
  address: textField(500).optional(),
  city: textField(255).optional(),
  pincode: z.string().max(20).regex(/^[a-z0-9 -]+$/i, "Enter a valid pincode").optional(),
  doctorName: textField(255).optional(),
  logoUrl: publicUrlField(1000).optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
}).strict();

export function normalizeExternalUrl(value: string): string {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}