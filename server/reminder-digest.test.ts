import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/reminder-tests";

const {
  digestContentHash,
  filterReminderResultByClinic,
  normalizeRecipientEmail,
  renderReminderDigestEmail,
  runClinicManualDigestJob,
  selectClinicDoctorDigestRecipients,
} = await import("./reminder-digest");
const { storage } = await import("./storage");

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

test("filters digest bookings to the authenticated clinic", () => {
  const reminders = {
    nextThreeDays: [
      { bookingId: 1, clinicId: 7 },
      { bookingId: 2, clinicId: 8 },
    ],
    comingWeek: [
      { bookingId: 3, clinicId: 7 },
    ],
    totalCount: 3,
    generatedAt: "2026-08-22T06:00:00.000Z",
  } as any;

  const filtered = filterReminderResultByClinic(reminders, 7);
  assert.deepEqual(filtered.nextThreeDays.map(booking => booking.bookingId), [1]);
  assert.deepEqual(filtered.comingWeek.map(booking => booking.bookingId), [3]);
  assert.equal(filtered.totalCount, 2);
});

test("selects each clinic doctor with only their own appointments", async () => {
  const originalGetClinic = storage.getClinic;
  const originalGetClinicDoctors = storage.getClinicDoctors;
  const originalGetDoctorReminders = storage.getDoctorReminders;
  storage.getClinic = async () => ({ timezone: "UTC" } as any);
  storage.getClinicDoctors = async () => [
    { id: 11, email: "one@example.com" },
    { id: 12, email: "two@example.com" },
  ] as any;
  storage.getDoctorReminders = async (email: string) => ({
    nextThreeDays: email === "one@example.com" ? [{ bookingId: 1, clinicId: 7 }] : [{ bookingId: 2, clinicId: 7 }],
    comingWeek: [],
    totalCount: 1,
    generatedAt: "2026-08-22T06:00:00.000Z",
  } as any);

  try {
    const recipients = await selectClinicDoctorDigestRecipients(7, new Date("2026-08-22T06:00:00.000Z"));
    assert.deepEqual(recipients.map(recipient => recipient.email), ["one@example.com", "two@example.com"]);
    assert.deepEqual(recipients.map(recipient => recipient.reminders.nextThreeDays[0].bookingId), [1, 2]);
  } finally {
    storage.getClinic = originalGetClinic;
    storage.getClinicDoctors = originalGetClinicDoctors;
    storage.getDoctorReminders = originalGetDoctorReminders;
  }
});

test("includes an empty digest for a clinic doctor with no appointments", async () => {
  const originalGetClinic = storage.getClinic;
  const originalGetClinicDoctors = storage.getClinicDoctors;
  const originalGetDoctorReminders = storage.getDoctorReminders;
  storage.getClinic = async () => ({ timezone: "UTC" } as any);
  storage.getClinicDoctors = async () => [{ id: 11, email: "empty@example.com" }] as any;
  storage.getDoctorReminders = async () => ({ nextThreeDays: [], comingWeek: [], totalCount: 0, generatedAt: "" });

  try {
    const recipients = await selectClinicDoctorDigestRecipients(7);
    assert.equal(recipients.length, 1);
    assert.equal(recipients[0].reminders.totalCount, 0);
    assert.match(renderReminderDigestEmail(recipients[0], "https://app.example.com"), /no upcoming appointments/i);
  } finally {
    storage.getClinic = originalGetClinic;
    storage.getClinicDoctors = originalGetClinicDoctors;
    storage.getDoctorReminders = originalGetDoctorReminders;
  }
});

test("repeated manual jobs do not create scheduled digest claims", async () => {
  const originalGetClinic = storage.getClinic;
  const originalGetClinicDoctors = storage.getClinicDoctors;
  const originalGetDoctorReminders = storage.getDoctorReminders;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalResendKey = process.env.RESEND_API_KEY;
  storage.getClinic = async () => ({ timezone: "UTC" } as any);
  storage.getClinicDoctors = async () => [{ id: 11, email: "empty@example.com" }] as any;
  storage.getDoctorReminders = async () => ({ nextThreeDays: [], comingWeek: [], totalCount: 0, generatedAt: "" });
  delete process.env.RESEND_API_KEY;
  process.env.NODE_ENV = "test";

  try {
    const first = await runClinicManualDigestJob(7);
    const second = await runClinicManualDigestJob(7);
    assert.equal(first.recipients.length, 1);
    assert.equal(second.recipients.length, 1);
    assert.equal(first.skipped, 0);
    assert.equal(second.skipped, 0);
  } finally {
    storage.getClinic = originalGetClinic;
    storage.getClinicDoctors = originalGetClinicDoctors;
    storage.getDoctorReminders = originalGetDoctorReminders;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
  }
});