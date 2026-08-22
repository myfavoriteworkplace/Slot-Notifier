import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "./r2Client";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES   = [...ALLOWED_IMAGE_TYPES, "application/pdf"];

const ALLOWED_FOLDERS = ["clinics", "doctors", "users", "smile-deals", "case-media", "clinic-docs", "patient-docs"];

const FOLDER_MAX_BYTES: Record<string, number> = {
  "doctors":     1 * 1024 * 1024,  // 1 MB  — profile photos
  "clinics":     1 * 1024 * 1024,  // 1 MB  — clinic logos
  "users":       1 * 1024 * 1024,  // 1 MB  — user avatars
  "case-media":  3 * 1024 * 1024,  // 3 MB  — before/after clinical photos
  "smile-deals": 2 * 1024 * 1024,  // 2 MB  — marketing images
  "clinic-docs": 5 * 1024 * 1024,  // 5 MB  — registration documents / PDFs
  "patient-docs": 10 * 1024 * 1024, // 10 MB — patient medical documents and images
};
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

const URL_EXPIRY_SECONDS = 60;

interface SignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  folder: string;
  keyPrefix?: string;
}

interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function generateSignedUploadUrl(
  request: SignedUrlRequest
): Promise<SignedUrlResponse> {
  const { fileName, fileType, fileSize, folder, keyPrefix } = request;
  const normalizedType = fileType?.toLowerCase();

  if (!ALLOWED_FOLDERS.includes(folder)) {
    throw new Error(
      `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(", ")}`
    );
  }

  const allowedTypes = ["clinic-docs", "patient-docs"].includes(folder)
    ? ALLOWED_DOC_TYPES
    : ALLOWED_IMAGE_TYPES;
  if (!normalizedType || !allowedTypes.includes(normalizedType)) {
    throw new Error(
      `Invalid file type: ${fileType}. Allowed: ${allowedTypes.join(", ")}`
    );
  }

  const maxBytes = FOLDER_MAX_BYTES[folder] ?? DEFAULT_MAX_BYTES;
  const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
  if (fileSize > maxBytes) {
    throw new Error(
      `File too large. Maximum size for this upload is ${maxMB} MB`
    );
  }

  const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const uniqueFileName = `${uuidv4()}.${extension}`;
  const safePrefix = keyPrefix
    ? keyPrefix.split("/").filter(part => /^[a-zA-Z0-9_-]+$/.test(part)).join("/")
    : folder;
  const key = `${safePrefix}/${uniqueFileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: fileType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: URL_EXPIRY_SECONDS,
  });

  if (!R2_PUBLIC_URL) {
    throw new Error("R2_PUBLIC_URL is not configured. Please add it to your environment variables.");
  }

  const baseUrl = R2_PUBLIC_URL.endsWith("/")
    ? R2_PUBLIC_URL.slice(0, -1)
    : R2_PUBLIC_URL;

  const publicUrl = `${baseUrl}/${key}`;

  return { uploadUrl, publicUrl, key };
}
