import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "./r2Client";
import { v4 as uuidv4 } from "uuid";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
const ALLOWED_DOC_TYPES   = [...ALLOWED_IMAGE_TYPES, "application/pdf"];

const ALLOWED_FOLDERS = ["clinics", "doctors", "users", "smile-deals", "case-media", "clinic-docs", "patient-docs"];
export const IMAGE_UPLOAD_FOLDERS = ["clinics", "doctors", "users", "case-media"] as const;

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
export const MAX_IMAGE_DIMENSION = 8000;
export const MAX_IMAGE_PIXELS = 40_000_000;

const URL_EXPIRY_SECONDS = 60;
const MIME_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/jpg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

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

export type ImageDimensions = { width: number; height: number };

export function getUploadMaxBytes(folder: string): number {
  return FOLDER_MAX_BYTES[folder] ?? DEFAULT_MAX_BYTES;
}

function assertImageDimensions(width: number, height: number): ImageDimensions {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error(`Image dimensions exceed the allowed maximum of ${MAX_IMAGE_DIMENSION}px per side and ${MAX_IMAGE_PIXELS} pixels`);
  }
  return { width, height };
}

function imageTypeMatches(buffer: Uint8Array, fileType: string): boolean {
  if (fileType === "image/png") {
    return buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e &&
      buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a &&
      buffer[6] === 0x1a && buffer[7] === 0x0a;
  }
  if (fileType === "image/jpeg" || fileType === "image/jpg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (fileType === "image/webp") {
    return buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  }
  return false;
}

function pngDimensions(buffer: Uint8Array): ImageDimensions {
  if (buffer.length < 24) throw new Error("PNG header is incomplete");
  const width = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(16);
  const height = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(20);
  return assertImageDimensions(width, height);
}

function jpegDimensions(buffer: Uint8Array): ImageDimensions {
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 1 >= buffer.length) break;
    const segmentLength = (buffer[offset] << 8) | buffer[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && segmentLength >= 7) {
      const height = (buffer[offset + 3] << 8) | buffer[offset + 4];
      const width = (buffer[offset + 5] << 8) | buffer[offset + 6];
      return assertImageDimensions(width, height);
    }
    offset += segmentLength;
  }
  throw new Error("JPEG dimensions could not be read");
}

function webpDimensions(buffer: Uint8Array): ImageDimensions {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = String.fromCharCode(
      buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3],
    );
    const chunkSize =
      buffer[offset + 4] |
      (buffer[offset + 5] << 8) |
      (buffer[offset + 6] << 16) |
      (buffer[offset + 7] << 24);
    const data = offset + 8;
    if (data + chunkSize > buffer.length) break;

    if (chunkType === "VP8X" && chunkSize >= 10) {
      const width = 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16);
      const height = 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16);
      return assertImageDimensions(width, height);
    }
    if (chunkType === "VP8 " && chunkSize >= 10 &&
      buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      const width = buffer[data + 6] | (buffer[data + 7] << 8);
      const height = buffer[data + 8] | (buffer[data + 9] << 8);
      return assertImageDimensions(width & 0x3fff, height & 0x3fff);
    }
    if (chunkType === "VP8L" && chunkSize >= 5 && buffer[data] === 0x2f) {
      const bits = buffer[data + 1] | (buffer[data + 2] << 8) | (buffer[data + 3] << 16) | (buffer[data + 4] << 24);
      const width = 1 + (bits & 0x3fff);
      const height = 1 + ((bits >>> 14) & 0x3fff);
      return assertImageDimensions(width, height);
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error("WebP dimensions could not be read");
}

export function validateImageBytes(buffer: Uint8Array, fileType: string): ImageDimensions {
  const normalizedType = fileType.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(normalizedType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Only JPEG, PNG, and WebP images are accepted");
  }
  if (!imageTypeMatches(buffer, normalizedType)) {
    throw new Error("The uploaded file content does not match its declared image type");
  }
  if (normalizedType === "image/png") return pngDimensions(buffer);
  if (normalizedType === "image/jpeg" || normalizedType === "image/jpg") return jpegDimensions(buffer);
  return webpDimensions(buffer);
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

  const allowedTypes: readonly string[] = ["clinic-docs", "patient-docs"].includes(folder)
    ? ALLOWED_DOC_TYPES
    : ALLOWED_IMAGE_TYPES;
  if (!normalizedType || !allowedTypes.includes(normalizedType)) {
    throw new Error(
      `Invalid file type: ${fileType}. Allowed: ${allowedTypes.join(", ")}`
    );
  }

  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    throw new Error("File size must be a positive whole number");
  }

  const maxBytes = getUploadMaxBytes(folder);
  const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
  if (fileSize > maxBytes) {
    throw new Error(
      `File too large. Maximum size for this upload is ${maxMB} MB`
    );
  }

  const extension = MIME_EXTENSIONS[normalizedType]?.[0] || "bin";
  const submittedExtension = fileName.split(".").pop()?.toLowerCase() || "";
  if (submittedExtension && !MIME_EXTENSIONS[normalizedType]?.includes(submittedExtension)) {
    throw new Error("File extension does not match the declared content type");
  }
  const uniqueFileName = `${uuidv4()}.${extension}`;
  const keyParts = keyPrefix ? keyPrefix.split("/") : [folder];
  if (keyParts.some(part => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    throw new Error("Upload path contains invalid characters");
  }
  const safePrefix = keyParts.join("/");
  const key = `${safePrefix}/${uniqueFileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: normalizedType,
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
