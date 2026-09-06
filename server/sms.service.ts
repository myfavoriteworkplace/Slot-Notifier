import twilio from "twilio";
import type { CommunicationSendResult } from "./communication-usage";

const SMS_ENABLED = process.env.SMS_NOTIFICATIONS_ENABLED?.trim().toLowerCase() === "true";
const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

const client =
  SMS_ENABLED && accountSid && authToken ? twilio(accountSid, authToken) : null;

if (!SMS_ENABLED) {
  console.log("[SMS] SMS notifications disabled by SMS_NOTIFICATIONS_ENABLED.");
} else if (!client || !messagingServiceSid) {
  console.warn(
    "[SMS] SMS enabled but Twilio credentials or TWILIO_MESSAGING_SERVICE_SID is missing — SMS notifications disabled.",
  );
} else {
  console.log("[SMS] Twilio SMS client initialized successfully.");
}

function toE164(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return null;

  const formatted = cleaned.startsWith("+")
    ? cleaned
    : /^[6-9]\d{9}$/.test(cleaned)
      ? `+91${cleaned}`
      : /^91[6-9]\d{9}$/.test(cleaned)
        ? `+${cleaned}`
        : `+${cleaned}`;

  return /^\+[1-9]\d{7,14}$/.test(formatted) ? formatted : null;
}

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 3)}••••${phone.slice(-2)}` : "redacted";
}

async function sendSms(toPhone: string, body: string, label: string): Promise<CommunicationSendResult> {
  if (!SMS_ENABLED || !client || !messagingServiceSid) {
    return { status: "skipped", provider: "twilio" };
  }

  const formattedPhone = toE164(toPhone);
  if (!formattedPhone) {
    console.warn(`[SMS] (${label}) Skipped invalid phone number.`);
    return { status: "skipped", provider: "twilio" };
  }

  try {
    const result = await client.messages.create({
      body,
      messagingServiceSid,
      to: formattedPhone,
    });
    console.log(`[SMS] (${label}) Sent. SID: ${result.sid} → ${maskPhone(formattedPhone)}`);
    return { status: "accepted", provider: "twilio", providerMessageId: result.sid };
  } catch (err: any) {
    console.error(`[SMS ERROR] (${label}) Failed for ${maskPhone(formattedPhone)}: ${err.message}`);
    if (err.code) console.error(`[SMS ERROR] (${label}) Twilio error code: ${err.code}`);
    return { status: "failed", provider: "twilio", error: err.message };
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export async function sendBookingReceivedSms(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date,
): Promise<CommunicationSendResult> {
  const message =
    `Hello ${patientName}, your appointment request at ${clinicName} has been received. ` +
    `Date: ${formatDate(appointmentTime)}. Time: ${formatTime(appointmentTime)}. ` +
    `We will send another SMS once the clinic confirms your appointment. - BookMySlot`;

  return sendSms(toPhone, message, "booking-received");
}

export async function sendBookingConfirmationSms(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date,
  doctorName?: string | null,
  clinicPhone?: string | null,
  bookingRef?: string | null,
): Promise<CommunicationSendResult> {
  const doctorLine = doctorName ? ` Doctor: ${doctorName}.` : "";
  const phoneLine = clinicPhone ? ` Clinic: ${clinicPhone}.` : "";
  const refLine = bookingRef ? ` Ref: ${bookingRef}.` : "";
  const message =
    `Hello ${patientName}, your appointment at ${clinicName} is confirmed. ` +
    `Date: ${formatDate(appointmentTime)}. Time: ${formatTime(appointmentTime)}.` +
    `${doctorLine}${phoneLine}${refLine} Please arrive 10 minutes early. - BookMySlot`;

  return sendSms(toPhone, message, "booking-confirmed");
}