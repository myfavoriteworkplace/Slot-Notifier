import twilio from "twilio";
import type { CommunicationSendResult } from "./communication-usage";

const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
const whatsappFrom = (process.env.TWILIO_WHATSAPP_NUMBER || "+14155238886").trim();

const client =
  accountSid && authToken ? twilio(accountSid, authToken) : null;

if (client) {
  console.log("[WHATSAPP] Twilio client initialized successfully.");
} else {
  console.warn("[WHATSAPP] Twilio credentials missing — WhatsApp notifications disabled.");
}

function toE164(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "").trim();

  if (cleaned.startsWith("+")) return cleaned;

  // 10-digit Indian mobile number → prepend +91
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;

  // Already has 91 country code (12 digits starting with 91)
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;

  // Fallback: just prepend +
  return `+${cleaned}`;
}

async function sendWhatsApp(toPhone: string, message: string, label: string): Promise<CommunicationSendResult> {
  if (!client) {
    console.log(`[WHATSAPP MOCK] Twilio not configured — ${label} skipped.`);
    return { status: "skipped", provider: "twilio" };
  }

  const formattedPhone = toE164(toPhone);
  console.log(`[WHATSAPP] (${label}) Attempting to send to ${formattedPhone} (raw: ${toPhone})`);

  try {
    const result = await client.messages.create({
      from: `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${formattedPhone}`,
      body: message,
    });
    console.log(`[WHATSAPP] (${label}) Sent. SID: ${result.sid} → ${formattedPhone}`);
    return { status: "accepted", provider: "twilio", providerMessageId: result.sid };
  } catch (err: any) {
    console.error(`[WHATSAPP ERROR] (${label}) Failed to send to ${formattedPhone}: ${err.message}`);
    if (err.code) console.error(`[WHATSAPP ERROR] Twilio error code: ${err.code}`);
    return { status: "failed", provider: "twilio", error: err.message };
  }
}

export async function sendWhatsAppMessage(toPhone: string, message: string, label = 'generic'): Promise<CommunicationSendResult> {
  return sendWhatsApp(toPhone, message, label);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export async function sendWhatsAppBookingNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date
): Promise<CommunicationSendResult> {
  const message =
    `Hello ${patientName}! 👋\n\n` +
    `Your appointment request at *${clinicName}* has been received.\n\n` +
    `📅 Date: ${formatDate(appointmentTime)}\n` +
    `🕐 Time: ${formatTime(appointmentTime)}\n\n` +
    `We will send you another message once the clinic confirms your slot. ` +
    `Please wait for the confirmation before visiting.\n\n` +
    `— BookMySlot 🦷`;

  return sendWhatsApp(toPhone, message, "booking-received");
}

export async function sendWhatsAppConsentLink(
  toPhone: string,
  patientName: string,
  clinicName: string,
  consentUrl: string,
): Promise<CommunicationSendResult> {
  const message =
    `Hello ${patientName}! 📋\n\n` +
    `*${clinicName}* has sent you a digital consent form for your upcoming dental appointment.\n\n` +
    `Please review and sign the consent form by clicking the link below:\n` +
    `🔗 ${consentUrl}\n\n` +
    `This link is valid for 72 hours. Please do not share it with others.\n\n` +
    `— BookMySlot 🦷`;

  return sendWhatsApp(toPhone, message, "consent-request");
}

export async function sendWhatsAppConfirmationNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date,
  doctorName?: string | null,
  clinicAddress?: string | null,
  clinicPhone?: string | null,
  mapsLink?: string | null,
  bookingRef?: string | null,
): Promise<CommunicationSendResult> {
  const doctorLine = doctorName ? `👨‍⚕️ Doctor: ${doctorName}\n` : "";
  const addressLine = clinicAddress ? `📍 Address: ${clinicAddress}\n` : "";
  const mapsLine = mapsLink ? `🗺 Directions: ${mapsLink}\n` : "";
  const phoneLine = clinicPhone ? `📞 Clinic: ${clinicPhone}\n` : "";
  const refLine = bookingRef ? `🔖 Ref: ${bookingRef}\n` : "";

  const message =
    `Hello ${patientName}! ✅\n\n` +
    `Great news — your appointment at *${clinicName}* has been *confirmed*.\n\n` +
    `📅 Date: ${formatDate(appointmentTime)}\n` +
    `🕐 Time: ${formatTime(appointmentTime)}\n` +
    `${doctorLine}` +
    `${addressLine}` +
    `${mapsLine}` +
    `${phoneLine}` +
    `${refLine}\n` +
    `Please arrive 10 minutes early. Reply to this message if you need to reschedule.\n\n` +
    `— BookMySlot 🦷`;

  return sendWhatsApp(toPhone, message, "booking-confirmed");
}
