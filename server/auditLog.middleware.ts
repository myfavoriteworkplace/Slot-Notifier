import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { auditLogs } from "@shared/schema";

export type AuditAction   = "view" | "create" | "update" | "delete" | "export" | "sign";
export type AuditResource = "booking" | "patient" | "clinical_record" | "booking_note" | "consent" | "bill" | "export" | "doctor" | "xray" | "website_config" | "clinic_profile";

function inferAction(method: string, path: string): AuditAction {
  if (path.includes("/export"))  return "export";
  if (path.includes("/sign"))    return "sign";
  switch (method.toUpperCase()) {
    case "GET":    return "view";
    case "POST":   return "create";
    case "PATCH":
    case "PUT":    return "update";
    case "DELETE": return "delete";
    default:       return "view";
  }
}

function inferResource(path: string): AuditResource {
  if (path.includes("/clinical-records")) return "clinical_record";
  if (path.includes("/booking-notes"))    return "booking_note";
  if (path.includes("/consent"))          return "consent";
  if (path.includes("/bills"))            return "bill";
  if (path.includes("/export"))           return "export";
  if (path.includes("/xray"))             return "xray";
  if (path.includes("/patients"))         return "patient";
  if (path.includes("/doctors"))          return "doctor";
  return "booking";
}

function extractResourceId(req: Request): number | null {
  const raw = req.params?.id ?? req.params?.bookingId ?? req.params?.patientId ?? req.params?.recordId;
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.ip ?? "unknown";
}

/**
 * auditLog() — fire-and-forget PII access logger.
 *
 * Place it after isAuthenticated (or rate-limiter) on any route that touches
 * patient data. It attaches a `res.on("finish")` listener and writes one row
 * to audit_logs after the response is sent — the request handler is never
 * slowed down.  Failed writes are logged to console but never throw.
 *
 * Examples:
 *   app.get("/api/auth/clinic/bookings",  isAuthenticated, auditLog(), handler)
 *   app.post("/api/clinical-records",     isAuthenticated, auditLog({ resource: "clinical_record" }), handler)
 *   app.use("/api/auth/clinic/bookings",  auditLog({ resource: "booking" }))   // covers all sub-routes
 */
export function auditLog(options?: { action?: AuditAction; resource?: AuditResource }) {
  return function _auditLog(req: Request, res: Response, next: NextFunction) {
    res.on("finish", () => {
      if (res.statusCode >= 400) return;

      const sess = (req.session as any) ?? {};

      const actorType: string =
        sess.role ??
        (sess.adminLoggedIn  ? (sess.clinicId ? "owner" : "superuser") :
         sess.doctorLoggedIn ? "doctor" : "public");

      const actorId: string = String(
        sess.clinicId ?? sess.doctorId ?? sess.userId ?? "public"
      );

      const actorLabel: string | null =
        sess.adminEmail ?? sess.doctorEmail ?? null;

      const clinicId: number | null =
        sess.clinicId ? Number(sess.clinicId) : null;

      const action       = options?.action   ?? inferAction(req.method, req.path);
      const resourceType = options?.resource ?? inferResource(req.path);
      const resourceId   = extractResourceId(req);

      db.insert(auditLogs).values({
        actorType,
        actorId,
        actorLabel,
        clinicId,
        action,
        resourceType,
        resourceId,
        ipAddress: getIp(req),
        userAgent: req.headers["user-agent"] ?? "unknown",
      }).catch((err: unknown) => {
        console.error("[AuditLog] Write failed — request was not affected:", err);
      });
    });

    next();
  };
}
