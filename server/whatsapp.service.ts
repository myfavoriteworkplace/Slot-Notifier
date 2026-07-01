import {
  isMetaConfigured,
  sendMetaWhatsAppBookingNotification,
  sendMetaWhatsAppConfirmationNotification,
  sendMetaWhatsAppConsentLink,
} from "./meta-whatsapp.service";

import {
  sendWhatsAppBookingNotification as twilioBooking,
  sendWhatsAppConfirmationNotification as twilioConfirmation,
  sendWhatsAppConsentLink as twilioConsent,
  sendWhatsAppMessage as twilioSendMessage,
} from "./twilio.service";

import {
  isZavuConfigured,
  sendZavuWhatsAppBookingNotification,
  sendZavuWhatsAppConfirmationNotification,
  sendZavuWhatsAppConsentLink,
} from "./zavu-whatsapp.service";

const PROVIDER = (process.env.WHATSAPP_PROVIDER || "twilio").toLowerCase().trim();

console.log(
  `[WHATSAPP] Active provider: ${PROVIDER}` +
  (PROVIDER === "meta" && !isMetaConfigured ? " (Meta credentials missing — will fall back to Twilio)" : "") +
  (PROVIDER === "zavu" && !isZavuConfigured ? " (ZAVUDEV_API_KEY missing — will fall back to Twilio)" : "")
);

async function withFallback(
  label: string,
  primary: () => Promise<void>,
  fallback: () => Promise<void>
): Promise<void> {
  try {
    await primary();
  } catch (err: any) {
    console.warn(`[WHATSAPP] Primary provider failed for "${label}": ${err.message}. Falling back to Twilio.`);
    try {
      await fallback();
    } catch (fallbackErr: any) {
      console.error(`[WHATSAPP] Fallback also failed for "${label}": ${fallbackErr.message}`);
    }
  }
}

export async function sendWhatsAppBookingNotification(
  toPhone: string,
  patientName: string,
  clinicName: string,
  appointmentTime: Date
): Promise<void> {
  if (PROVIDER === "zavu" && isZavuConfigured) {
    return withFallback(
      "booking-received",
      () => sendZavuWhatsAppBookingNotification(toPhone, patientName, clinicName, appointmentTime),
      () => twilioBooking(toPhone, patientName, clinicName, appointmentTime)
    );
  }
  if (PROVIDER === "meta" && isMetaConfigured) {
    return withFallback(
      "booking-received",
      () => sendMetaWhatsAppBookingNotification(toPhone, patientName, clinicName, appointmentTime),
      () => twilioBooking(toPhone, patientName, clinicName, appointmentTime)
    );
  }
  return twilioBooking(toPhone, patientName, clinicName, appointmentTime);
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
  bookingRef?: string | null
): Promise<void> {
  if (PROVIDER === "zavu" && isZavuConfigured) {
    return withFallback(
      "booking-confirmed",
      () => sendZavuWhatsAppConfirmationNotification(toPhone, patientName, clinicName, appointmentTime, doctorName, clinicAddress, clinicPhone, mapsLink, bookingRef),
      () => twilioConfirmation(toPhone, patientName, clinicName, appointmentTime, doctorName, clinicAddress, clinicPhone, mapsLink, bookingRef)
    );
  }
  if (PROVIDER === "meta" && isMetaConfigured) {
    return withFallback(
      "booking-confirmed",
      () => sendMetaWhatsAppConfirmationNotification(toPhone, patientName, clinicName, appointmentTime, doctorName, clinicAddress, clinicPhone, mapsLink, bookingRef),
      () => twilioConfirmation(toPhone, patientName, clinicName, appointmentTime, doctorName, clinicAddress, clinicPhone, mapsLink, bookingRef)
    );
  }
  return twilioConfirmation(toPhone, patientName, clinicName, appointmentTime, doctorName, clinicAddress, clinicPhone, mapsLink, bookingRef);
}

export async function sendWhatsAppConsentLink(
  toPhone: string,
  patientName: string,
  clinicName: string,
  consentUrl: string
): Promise<void> {
  if (PROVIDER === "zavu" && isZavuConfigured) {
    return withFallback(
      "consent-request",
      () => sendZavuWhatsAppConsentLink(toPhone, patientName, clinicName, consentUrl),
      () => twilioConsent(toPhone, patientName, clinicName, consentUrl)
    );
  }
  if (PROVIDER === "meta" && isMetaConfigured) {
    return withFallback(
      "consent-request",
      () => sendMetaWhatsAppConsentLink(toPhone, patientName, clinicName, consentUrl),
      () => twilioConsent(toPhone, patientName, clinicName, consentUrl)
    );
  }
  return twilioConsent(toPhone, patientName, clinicName, consentUrl);
}

export async function sendWhatsAppMessage(toPhone: string, message: string): Promise<void> {
  if (PROVIDER === "zavu" && isZavuConfigured) {
    return withFallback(
      "generic-message",
      async () => {
        throw new Error("Generic WhatsApp messages are not supported for the Zavu provider");
      },
      async () => twilioSendMessage(toPhone, message, "generic")
    );
  }
  if (PROVIDER === "meta" && isMetaConfigured) {
    return withFallback(
      "generic-message",
      async () => {
        throw new Error("Generic WhatsApp messages are not supported for the Meta provider");
      },
      async () => twilioSendMessage(toPhone, message, "generic")
    );
  }
  return twilioSendMessage(toPhone, message, "generic");
}
