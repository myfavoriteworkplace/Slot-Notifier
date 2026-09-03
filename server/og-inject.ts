import fs from "fs";
import path from "path";
import type { Express, Request } from "express";
import { storage } from "./storage";
import { isSafePublicUrl, normalizeExternalUrl } from "./website-security";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] ?? character));
}

function buildClinicOgTags(
  clinic: { name: string; logoUrl?: string | null; city?: string | null; address?: string | null },
  req: Request,
  clinicId: number,
): string {
  const host = `${req.protocol}://${req.get("host")}`;
  const title = `Book a dental appointment at ${clinic.name}`;
  const location = (clinic as any).city || clinic.address || "";
  const description = location
    ? `Secure your slot at ${clinic.name}, ${location}. Pick a time that works and get confirmed instantly — no account needed.`
    : `Secure your slot at ${clinic.name}. Pick a time that works and get confirmed instantly — no account needed.`;
  const imageUrl = clinic.logoUrl && isSafePublicUrl(clinic.logoUrl, false)
    ? normalizeExternalUrl(clinic.logoUrl)
    : `${host}/icons/og-image.png`;
  const pageUrl = `${host}/book/${clinicId}`;

  return [
    `  <title>${escapeHtml(title)}</title>`,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `  <meta property="og:title" content="${escapeHtml(title)}" />`,
    `  <meta property="og:description" content="${escapeHtml(description)}" />`,
    `  <meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
  ].join("\n");
}

export function injectOgTags(html: string, ogTagsHtml: string): string {
  return html
    .replace(/<title>[^<]*<\/title>/, "")
    .replace(/<meta\s+property="og:image"[^>]*>/g, "")
    .replace(/<meta\s+property="og:image:width"[^>]*>/g, "")
    .replace(/<meta\s+property="og:image:height"[^>]*>/g, "")
    .replace(/<meta\s+name="twitter:card"[^>]*>/g, "")
    .replace(/<meta\s+name="twitter:image"[^>]*>/g, "")
    .replace("</head>", `${ogTagsHtml}\n  </head>`);
}

export async function resolveClinicOgTags(clinicId: number, req: Request): Promise<string | null> {
  try {
    const clinic = await storage.getClinic(clinicId);
    if (!clinic || clinic.isArchived || clinic.status !== "approved") return null;
    return buildClinicOgTags(clinic, req, clinicId);
  } catch {
    return null;
  }
}

const PROD_HTML_PATHS = [
  path.resolve(process.cwd(), "dist", "public", "index.html"),
  "/home/runner/workspace/dist/public/index.html",
];

export function registerOgRouteProduction(app: Express): void {
  app.get("/book/:clinicId", async (req, res, next) => {
    try {
      const clinicId = parseInt(req.params.clinicId, 10);
      if (isNaN(clinicId)) return next();

      const ogTags = await resolveClinicOgTags(clinicId, req);
      if (!ogTags) return next();

      let indexHtml = "";
      for (const p of PROD_HTML_PATHS) {
        if (fs.existsSync(p)) { indexHtml = fs.readFileSync(p, "utf-8"); break; }
      }
      if (!indexHtml) return next();

      const modified = injectOgTags(indexHtml, ogTags);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(modified);
    } catch {
      next();
    }
  });
}
