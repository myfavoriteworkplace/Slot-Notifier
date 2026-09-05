import { db } from "./db";
import { communicationUsage } from "@shared/schema";

export type CommunicationChannel = "sms" | "whatsapp" | "email";
export type CommunicationStatus = "accepted" | "failed" | "skipped";
export type CommunicationRecipient = "patient" | "clinic" | "doctor";

export type CommunicationSendResult = {
  status: CommunicationStatus;
  provider?: string;
  providerMessageId?: string;
  error?: string;
};

export type CommunicationUsageInput = {
  clinicId?: number | null;
  bookingId?: number | null;
  channel: CommunicationChannel;
  eventType: string;
  recipientType: CommunicationRecipient;
  billable?: boolean;
  isTest?: boolean;
};

export async function recordCommunicationUsage(
  input: CommunicationUsageInput & Omit<CommunicationSendResult, "status" | "error"> & {
    status: CommunicationStatus;
  },
): Promise<void> {
  if (!input.clinicId) return;
  try {
    await db.insert(communicationUsage).values({
      clinicId: input.clinicId,
      bookingId: input.bookingId ?? null,
      channel: input.channel,
      eventType: input.eventType,
      recipientType: input.recipientType,
      status: input.status,
      provider: input.provider ?? null,
      providerMessageId: input.providerMessageId ?? null,
      billable: input.billable ?? input.status === "accepted",
      isTest: input.isTest ?? false,
      units: 1,
    });
  } catch (error) {
    // Usage tracking must never block or change the outcome of a notification.
    console.error("[COMMUNICATION USAGE] Failed to record usage:", error instanceof Error ? error.message : String(error));
  }
}

export async function trackCommunication<T>(
  input: CommunicationUsageInput,
  send: () => Promise<CommunicationSendResult | boolean | void>,
): Promise<CommunicationSendResult> {
  let result: CommunicationSendResult;

  try {
    const response = await send();
    if (typeof response === "boolean") {
      result = { status: response ? "accepted" : "failed" };
    } else if (response && typeof response === "object" && "status" in response) {
      result = response;
    } else {
      result = { status: "accepted" };
    }
  } catch (error) {
    result = {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  await recordCommunicationUsage({
    ...input,
    ...result,
    billable: input.billable ?? result.status === "accepted",
  });
  return result;
}