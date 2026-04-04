import twilio from "twilio";

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

export async function sendWhatsAppBookingNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date
): Promise<void> {
  if (!client) {
    console.log("[WHATSAPP MOCK] Twilio not configured — WhatsApp notification skipped.");
    return;
  }

  const formattedPhone = toE164(toPhone);
  console.log(`[WHATSAPP] Attempting to send to ${formattedPhone} (raw input: ${toPhone})`);

  const dateStr = appointmentTime.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeStr = appointmentTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const message = `Hello ${patientName}! 👋\n\nYour appointment at *${clinicName}* has been booked successfully.\n\n📅 Date: ${dateStr}\n🕐 Time: ${timeStr}\n\nPlease arrive 10 minutes early. Reply to this message if you need to reschedule.\n\n— BookMySlot 🦷`;

  try {
    const result = await client.messages.create({
      from: `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${formattedPhone}`,
      body: message,
    });
    console.log(`[WHATSAPP] Message sent successfully. SID: ${result.sid} → ${formattedPhone}`);
  } catch (err: any) {
    console.error(`[WHATSAPP ERROR] Failed to send to ${formattedPhone}: ${err.message}`);
    if (err.code) console.error(`[WHATSAPP ERROR] Twilio error code: ${err.code}`);
  }
}
