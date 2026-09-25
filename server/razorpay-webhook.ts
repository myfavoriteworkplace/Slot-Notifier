import crypto from "crypto";

export type RazorpayWebhookVerificationInput = {
  secret: string | undefined;
  signature: string | undefined;
  rawBody: unknown;
};

export const RAZORPAY_TERMINAL_PROVIDER_EVENT_STATUSES = [
  "applied",
  "ignored",
  "unmatched",
] as const;

export function isRazorpayProviderEventTerminal(status: string): boolean {
  return (RAZORPAY_TERMINAL_PROVIDER_EVENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Razorpay signs the exact request bytes. The parsed JSON object must never be
 * serialized again before verification because whitespace and key ordering are
 * part of the signed payload.
 */
export function verifyRazorpayWebhookSignature(
  input: RazorpayWebhookVerificationInput,
): boolean {
  if (!input.secret || !input.signature || !Buffer.isBuffer(input.rawBody)) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest("hex");
  const provided = Buffer.from(input.signature.trim(), "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");

  return provided.length === expectedBytes.length &&
    crypto.timingSafeEqual(provided, expectedBytes);
}