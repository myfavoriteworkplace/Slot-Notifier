import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { communicationUsage, clinics } from "@shared/schema";
import { trackCommunication } from "./communication-usage";
import { withFallback } from "./whatsapp.service";

test("records accepted, failed, and skipped communication outcomes", async () => {
  const [clinic] = await db.select({ id: clinics.id }).from(clinics).limit(1);
  if (!clinic) return;

  const eventType = `test_usage_${randomUUID()}`;
  try {
    const accepted = await trackCommunication(
      { clinicId: clinic.id, channel: "sms", eventType, recipientType: "patient" },
      async () => ({ status: "accepted", provider: "test", providerMessageId: "accepted-1" }),
    );
    const failed = await trackCommunication(
      { clinicId: clinic.id, channel: "email", eventType, recipientType: "clinic" },
      async () => ({ status: "failed", provider: "test", error: "provider rejected" }),
    );
    const skipped = await trackCommunication(
      { clinicId: clinic.id, channel: "whatsapp", eventType, recipientType: "patient" },
      async () => ({ status: "skipped", provider: "test" }),
    );

    assert.equal(accepted.status, "accepted");
    assert.equal(failed.status, "failed");
    assert.equal(skipped.status, "skipped");

    const rows = await db.select({
      channel: communicationUsage.channel,
      status: communicationUsage.status,
      providerMessageId: communicationUsage.providerMessageId,
    }).from(communicationUsage).where(and(
      eq(communicationUsage.clinicId, clinic.id),
      eq(communicationUsage.eventType, eventType),
    ));
    assert.deepEqual(rows
      .map(row => [row.channel, row.status, row.providerMessageId])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))), [
      ["email", "failed", null],
      ["sms", "accepted", "accepted-1"],
      ["whatsapp", "skipped", null],
    ]);
  } finally {
    await db.delete(communicationUsage).where(eq(communicationUsage.eventType, eventType));
  }
});

test("WhatsApp fallback is one logical tracked communication", async () => {
  const [clinic] = await db.select({ id: clinics.id }).from(clinics).limit(1);
  if (!clinic) return;

  const eventType = `test_fallback_${randomUUID()}`;
  let primaryCalls = 0;
  let fallbackCalls = 0;
  try {
    const result = await trackCommunication(
      { clinicId: clinic.id, channel: "whatsapp", eventType, recipientType: "patient" },
      () => withFallback(
        "test",
        async () => {
          primaryCalls++;
          return { status: "failed", provider: "meta", error: "temporary failure" };
        },
        async () => {
          fallbackCalls++;
          return { status: "accepted", provider: "twilio", providerMessageId: "fallback-1" };
        },
      ),
    );

    assert.equal(result.status, "accepted");
    assert.equal(primaryCalls, 1);
    assert.equal(fallbackCalls, 1);
    const rows = await db.select({ status: communicationUsage.status }).from(communicationUsage).where(and(
      eq(communicationUsage.clinicId, clinic.id),
      eq(communicationUsage.eventType, eventType),
    ));
    assert.deepEqual(rows, [{ status: "accepted" }]);
  } finally {
    await db.delete(communicationUsage).where(eq(communicationUsage.eventType, eventType));
  }
});

test("notification result survives usage database failures", async () => {
  const result = await trackCommunication(
    { clinicId: 999999999, channel: "email", eventType: `test_failure_${randomUUID()}`, recipientType: "clinic" },
    async () => ({ status: "accepted", provider: "test" }),
  );
  assert.equal(result.status, "accepted");
});