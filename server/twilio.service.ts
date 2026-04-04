import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER || "+14155238886";

const client =
  accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendWhatsAppBookingNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date
): Promise<void> {
  if (!client) {
    console.log(
      "[WHATSAPP MOCK] Twilio not configured — WhatsApp notification skipped."
    );
    return;
  }

  const formattedPhone = toPhone.startsWith("+") ? toPhone : `+${toPhone}`;

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
    await client.messages.create({
      from: `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${formattedPhone}`,
      body: message,
    });
    console.log(
      `[WHATSAPP] Notification sent to ${formattedPhone} for booking at ${clinicName}`
    );
  } catch (err: any) {
    console.error("[WHATSAPP ERROR] Failed to send WhatsApp notification:", err.message);
  }
}
