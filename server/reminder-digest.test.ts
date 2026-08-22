import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/reminder-tests";

const {
  digestContentHash,
  normalizeRecipientEmail,
  renderReminderDigestEmail,
} = await import("./reminder-digest");

const baseRecipient = {
  email: "clinic@example.com",
  role: "clinic" as const,
  clinicId: 7,
  doctorId: null,
  localDigestDate: "2026-08-22",
  reminders: {
    nextThreeDays: [],
    comingWeek: [],
    totalCount: 0,
    generatedAt: "2026-08-22T06:00:00.000Z",
  },
};

test("normalizes recipient email for deduplication", () => {
  assert.equal(normalizeRecipientEmail("  Clinic@Example.COM "), "clinic@example.com");
});

test("renders a safe zero-appointment clinic digest", () => {
  const html = renderReminderDigestEmail(baseRecipient, "https://app.example.com/dashboard");
  assert.match(html, /no upcoming appointments/i);
  assert.match(html, /Open dashboard/);
  assert.doesNotMatch(html, /description|customerPhone|doctorNotes|consentSignature/i);
});

test("renders grouped appointments and escapes user-controlled fields", () => {
  const recipient = {
    ...baseRecipient,
    reminders: {
      ...baseRecipient.reminders,
      totalCount: 1,
      nextThreeDays: [{
        bookingId: 12,
        customerName: "A <Patient>",
        startTime: "2026-08-22T04:30:00.000Z",
        endTime: "2026-08-22T05:00:00.000Z",
        visitType: "consultation",
        treatmentCategory: null,
        assignedDoctor: "Dr. Example",
        assignedDoctorEmail: "doctor@example.com",
        clinicId: 7,
        clinicName: "Clinic",
        clinicTimezone: "Asia/Kolkata",
        localDate: "2026-08-22",
        dateGroup: "nextThreeDays" as const,
      }],
    },
  };
  const html = renderReminderDigestEmail(recipient, "https://app.example.com/dashboard?a=1&b=2");
  assert.match(html, /Next 3 Days/);
  assert.match(html, /A &lt;Patient&gt;/);
  assert.doesNotMatch(html, /A <Patient>/);
});

test("content hash is stable for the same recipient and digest", () => {
  const html = renderReminderDigestEmail(baseRecipient, "https://app.example.com/dashboard");
  assert.equal(digestContentHash(baseRecipient, html), digestContentHash(baseRecipient, html));
  assert.notEqual(
    digestContentHash(baseRecipient, html),
    digestContentHash({ ...baseRecipient, localDigestDate: "2026-08-23" }, html),
  );
});