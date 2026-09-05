import type { CommunicationSendResult } from "./communication-usage";

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

const BOOKING_TEMPLATE = (process.env.WHATSAPP_BOOKING_TEMPLATE || "booking_received").trim();
const CONFIRM_TEMPLATE = (process.env.WHATSAPP_CONFIRM_TEMPLATE || "booking_confirmed").trim();
const CONSENT_TEMPLATE = (process.env.WHATSAPP_CONSENT_TEMPLATE || "consent_request").trim();

export const isMetaConfigured = !!(accessToken && phoneNumberId);

if (isMetaConfigured) {
  console.log("[WHATSAPP-META] Meta Cloud API client ready.");
} else {
  console.log("[WHATSAPP-META] Meta credentials not set — Meta provider unavailable.");
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

interface TemplateParam {
  type: "text";
  text: string;
}

async function sendTemplateMessage(
  toPhone: string,
  templateName: string,
  params: TemplateParam[],
  label: string
): Promise<CommunicationSendResult> {
  if (!isMetaConfigured) {
    throw new Error("Meta credentials not configured");
  }

  const formattedPhone = toE164(toPhone);
  console.log(`[WHATSAPP-META] (${label}) Sending template "${templateName}" to ${formattedPhone}`);

  const body = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: params,
        },
      ],
    },
  };

  const response = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as any;

  if (!response.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Meta API error (${response.status}): ${errMsg}`);
  }

  const msgId = data?.messages?.[0]?.id ?? "unknown";
  console.log(`[WHATSAPP-META] (${label}) Sent. Message ID: ${msgId} → ${formattedPhone}`);
  return { status: "accepted", provider: "meta", providerMessageId: msgId };
}

export async function sendMetaWhatsAppBookingNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date
): Promise<CommunicationSendResult> {
  return sendTemplateMessage(
    toPhone,
    BOOKING_TEMPLATE,
    [
      { type: "text", text: patientName },
      { type: "text", text: clinicName },
      { type: "text", text: formatDate(appointmentTime) },
      { type: "text", text: formatTime(appointmentTime) },
    ],
    "booking-received"
  );
}

export async function sendMetaWhatsAppConfirmationNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date,
  doctorName?: string | null,
  clinicAddress?: string | null,
  _clinicPhone?: string | null,
  _mapsLink?: string | null,
  bookingRef?: string | null
): Promise<CommunicationSendResult> {
  const params: TemplateParam[] = [
    { type: "text", text: patientName },
    { type: "text", text: clinicName },
    { type: "text", text: formatDate(appointmentTime) },
    { type: "text", text: formatTime(appointmentTime) },
  ];

  if (doctorName) params.push({ type: "text", text: doctorName });
  if (clinicAddress) params.push({ type: "text", text: clinicAddress });
  if (bookingRef) params.push({ type: "text", text: bookingRef });

  return sendTemplateMessage(toPhone, CONFIRM_TEMPLATE, params, "booking-confirmed");
}

export async function sendMetaWhatsAppConsentLink(
  toPhone: string,
  patientName: string,
  clinicName: string,
  consentUrl: string
): Promise<CommunicationSendResult> {
  return sendTemplateMessage(
    toPhone,
    CONSENT_TEMPLATE,
    [
      { type: "text", text: patientName },
      { type: "text", text: clinicName },
      { type: "text", text: consentUrl },
    ],
    "consent-request"
  );
}
