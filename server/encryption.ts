import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = "ENC:";

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    console.error("[encryption] ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded). Encryption disabled.");
    return null;
  }
  return buf;
}

export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, encrypted, tag]);
  return PREFIX + payload.toString("base64");
}

export function decryptField(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored;

  const key = getKey();
  if (!key) {
    console.warn("[encryption] ENCRYPTION_KEY not set — cannot decrypt field. Returning raw value.");
    return stored;
  }

  try {
    const payload = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(payload.length - TAG_LENGTH);
    const ciphertext = payload.subarray(IV_LENGTH, payload.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch (err) {
    console.error("[encryption] Decryption failed — returning null to avoid exposing corrupt data.", err);
    return null;
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}
