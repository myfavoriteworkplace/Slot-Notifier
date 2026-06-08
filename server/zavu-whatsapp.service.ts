import Zavudev from "@zavudev/sdk";

const apiKey = process.env.ZAVUDEV_API_KEY?.trim();

export const isZavuConfigured = !!apiKey;

const zavu = isZavuConfigured ? new Zavudev(apiKey!) : null;

if (isZavuConfigured) {
  console.log("[WHATSAPP-ZAVU] Zavu client initialized successfully.");
} else {
  console.warn("[WHATSAPP-ZAVU] ZAVUDEV_API_KEY not set — Zavu provider unavailable.");
}

function toE164(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "").trim();
  if (cleaned.startsWith("+")) return cleaned;
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;
  return `+${cleaned}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

async function sendZavuMessage(toPhone: string, text: string, label: string): Promise<void> {
  if (!zavu) {
    throw new Error("Zavu client not initialized");
  }

  const formattedPhone = toE164(toPhone);
  console.log(`[WHATSAPP-ZAVU] (${label}) Sending to ${formattedPhone}`);

  await zavu.messages.send({
    to: formattedPhone,
    channel: "whatsapp",
    text,
  });

  console.log(`[WHATSAPP-ZAVU] (${label}) Sent → ${formattedPhone}`);
}

export async function sendZavuWhatsAppBookingNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date
): Promise<void> {
  const message =
    `Hello ${patientName}! 👋\n\n` +
    `Your appointment request at *${clinicName}* has been received.\n\n` +
    `📅 Date: ${formatDate(appointmentTime)}\n` +
    `🕐 Time: ${formatTime(appointmentTime)}\n\n` +
    `We will send you another message once the clinic confirms your slot. ` +
    `Please wait for the confirmation before visiting.\n\n` +
    `— BookMySlot 🦷`;

  await sendZavuMessage(toPhone, message, "booking-received");
}

export async function sendZavuWhatsAppConfirmationNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date,
  doctorName?: string | null,
  clinicAddress?: string | null,
  clinicPhone?: string | null,
  mapsLink?: string | null,
  bookingRef?: string | null
): Promise<void> {
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

  await sendZavuMessage(toPhone, message, "booking-confirmed");
}

export async function sendZavuWhatsAppConsentLink(
  toPhone: string,
  patientName: string,
  clinicName: string,
  consentUrl: string
): Promise<void> {
  const message =
    `Hello ${patientName}! 📋\n\n` +
    `*${clinicName}* has sent you a digital consent form for your upcoming dental appointment.\n\n` +
    `Please review and sign the consent form by clicking the link below:\n` +
    `🔗 ${consentUrl}\n\n` +
    `This link is valid for 72 hours. Please do not share it with others.\n\n` +
    `— BookMySlot 🦷`;

  await sendZavuMessage(toPhone, message, "consent-request");
}
