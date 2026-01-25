import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "./r2Client";
import { v4 as uuidv4 } from "uuid";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const URL_EXPIRY_SECONDS = 60;
const ALLOWED_FOLDERS = ["clinics", "doctors", "users"];

interface SignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  folder: string;
}

interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function generateSignedUploadUrl(
  request: SignedUrlRequest
): Promise<SignedUrlResponse> {
  const { fileName, fileType, fileSize, folder } = request;

  if (!ALLOWED_TYPES.includes(fileType)) {
    throw new Error(
      `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`
    );
  }

  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  if (!ALLOWED_FOLDERS.includes(folder)) {
    throw new Error(
      `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(", ")}`
    );
  }

  const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const uniqueFileName = `${uuidv4()}.${extension}`;
  const key = `${folder}/${uniqueFileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: fileType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: URL_EXPIRY_SECONDS,
  });

  // Ensure R2_PUBLIC_URL is present
  if (!R2_PUBLIC_URL) {
    throw new Error("R2_PUBLIC_URL is not configured. Please add it to your environment variables.");
  }

  // Ensure R2_PUBLIC_URL doesn't end with a slash to avoid double slashes
  const baseUrl = R2_PUBLIC_URL.endsWith("/")
    ? R2_PUBLIC_URL.slice(0, -1)
    : R2_PUBLIC_URL;

  const publicUrl = `${baseUrl}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
  };
}
