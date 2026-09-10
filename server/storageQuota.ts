import { db } from "./db";
import { patientDocuments, clinics } from "@shared/schema";
import { eq } from "drizzle-orm";
import { PLAN_KEYS, PUBLISHED_PLAN_POLICY, resolvePlanPolicy } from "@shared/plan-catalog";

export const DEFAULT_STORAGE_LIMIT_BYTES = PUBLISHED_PLAN_POLICY.plans.starter.limits.storageBytes;
export const PLAN_STORAGE_LIMITS: Record<string, number> = Object.fromEntries(
  PLAN_KEYS.map((planKey) => [planKey, PUBLISHED_PLAN_POLICY.plans[planKey].limits.storageBytes]),
);

export function getPlanStorageLimitBytes(rawPlan: string | null | undefined) {
  return resolvePlanPolicy(rawPlan).policy?.limits.storageBytes ?? null;
}

const issuedUploads = new Map<string, { clinicId: number; fileSize: number; expiresAt: number }>();

export function registerIssuedUpload(key: string, clinicId: number, fileSize: number) {
  issuedUploads.set(key, { clinicId, fileSize, expiresAt: Date.now() + 10 * 60_000 });
}

export function consumeIssuedUpload(key: string, clinicId: number) {
  const upload = issuedUploads.get(key);
  issuedUploads.delete(key);
  if (!upload || upload.expiresAt < Date.now() || upload.clinicId !== clinicId) {
    throw new Error("Upload authorization is missing or expired");
  }
  return upload.fileSize;
}

export async function getClinicStorageQuota(clinicId: number) {
  const [clinic] = await db.select({
    plan: clinics.plan,
    overrideBytes: clinics.storageLimitBytes,
  }).from(clinics).where(eq(clinics.id, clinicId));
  const planLimitBytes = getPlanStorageLimitBytes(clinic?.plan);
  const limitBytes = Number(clinic?.overrideBytes || planLimitBytes || DEFAULT_STORAGE_LIMIT_BYTES);
  const rows = await db.select({ fileSize: patientDocuments.fileSize })
    .from(patientDocuments).where(eq(patientDocuments.clinicId, clinicId));
  const usedBytes = rows.reduce((sum, row) => sum + Number(row.fileSize ?? 0), 0);
  return {
    usedBytes,
    limitBytes,
    remainingBytes: Math.max(0, limitBytes - usedBytes),
    usagePercent: limitBytes ? Math.min(100, (usedBytes / limitBytes) * 100) : 100,
    source: clinic?.overrideBytes ? "clinic_override" : planLimitBytes ? "plan" : "default",
    plan: clinic?.plan || "starter",
  };
}

export async function assertClinicStorageAvailable(clinicId: number, requestedBytes: number) {
  const quota = await getClinicStorageQuota(clinicId);
  if (!Number.isFinite(requestedBytes) || requestedBytes < 0) throw new Error("Invalid file size");
  if (requestedBytes > quota.remainingBytes) {
    throw new Error(`Storage limit reached. ${formatQuotaBytes(quota.remainingBytes)} remaining of ${formatQuotaBytes(quota.limitBytes)}.`);
  }
  return quota;
}

export function formatQuotaBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 2 : 0)} ${units[index]}`;
}