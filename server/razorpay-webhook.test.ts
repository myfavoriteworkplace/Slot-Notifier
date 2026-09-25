import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  isRazorpayProviderEventTerminal,
  verifyRazorpayWebhookSignature,
} from "./razorpay-webhook";

const secret = "webhook-test-secret";

function sign(body: Buffer): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

test("verifies the exact raw Razorpay request bytes", () => {
  const rawBody = Buffer.from(
    '{ "payload": { "subscription": { "entity": { "id": "sub_123" } } }, "event": "subscription.charged" }',
    "utf8",
  );

  assert.equal(
    verifyRazorpayWebhookSignature({
      secret,
      signature: sign(rawBody),
      rawBody,
    }),
    true,
  );
});

test("does not verify a signature against a reserialized body", () => {
  const rawBody = Buffer.from('{\n  "payload": { "subscription": { "entity": { "id": "sub_123" } } },\n  "event": "subscription.charged"\n}', "utf8");
  const reserializedBody = Buffer.from(JSON.stringify(JSON.parse(rawBody.toString("utf8"))), "utf8");

  assert.equal(
    verifyRazorpayWebhookSignature({
      secret,
      signature: sign(rawBody),
      rawBody: reserializedBody,
    }),
    false,
  );
});

test("fails closed when the secret, signature, or raw body is missing", () => {
  const rawBody = Buffer.from('{"event":"subscription.charged"}', "utf8");

  assert.equal(verifyRazorpayWebhookSignature({ secret: undefined, signature: sign(rawBody), rawBody }), false);
  assert.equal(verifyRazorpayWebhookSignature({ secret, signature: undefined, rawBody }), false);
  assert.equal(verifyRazorpayWebhookSignature({ secret, signature: sign(rawBody), rawBody: null }), false);
});

test("rejects altered and malformed signatures", () => {
  const rawBody = Buffer.from('{"event":"subscription.charged"}', "utf8");
  const validSignature = sign(rawBody);

  assert.equal(
    verifyRazorpayWebhookSignature({
      secret,
      signature: `${validSignature.slice(0, -1)}0`,
      rawBody,
    }),
    false,
  );
  assert.equal(
    verifyRazorpayWebhookSignature({
      secret,
      signature: "not-a-valid-signature",
      rawBody,
    }),
    false,
  );
});

test("treats applied, ignored, and unmatched events as terminal but retries received events", () => {
  assert.equal(isRazorpayProviderEventTerminal("applied"), true);
  assert.equal(isRazorpayProviderEventTerminal("ignored"), true);
  assert.equal(isRazorpayProviderEventTerminal("unmatched"), true);
  assert.equal(isRazorpayProviderEventTerminal("received"), false);
  assert.equal(isRazorpayProviderEventTerminal("failed"), false);
});