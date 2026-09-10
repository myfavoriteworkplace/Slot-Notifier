import { resolvePlanPolicy } from "./plan-catalog";

export const BASELINE_MESSAGE_CHANNELS = ["sms", "whatsapp", "email"] as const;
export type BaselineMessageChannel = (typeof BASELINE_MESSAGE_CHANNELS)[number];

export type BaselineMessageUsage = Record<BaselineMessageChannel, number | null>;

export type BaselineUsage = {
  bookingsAllTime: number | null;
  bookingsCurrentLocalMonth: number | null;
  activeDoctors: number | null;
  liveSmileDeals: number | null;
  storageBytes: number | null;
  allTimeMessages: BaselineMessageUsage;
  currentLocalMonthMessages: BaselineMessageUsage;
};

export type BaselinePlanLimits = {
  bookingsMonthly: number | null;
  bookingsTrialTotal: number | null;
  doctors: number | null;
  smileDeals: number | null;
  storageBytes: number | null;
  messaging: Record<BaselineMessageChannel, number | null>;
};

function usageForPeriod(
  value: { value: number | null; period: string },
  period: "trial_lifetime" | "calendar_month",
): number | null {
  return value.period === period ? value.value : null;
}

export function getBaselinePlanLimits(rawPlan: string | null | undefined): BaselinePlanLimits | null {
  const policy = resolvePlanPolicy(rawPlan).policy;
  if (!policy) return null;

  return {
    bookingsMonthly: usageForPeriod(policy.limits.bookings, "calendar_month"),
    bookingsTrialTotal: usageForPeriod(policy.limits.bookings, "trial_lifetime"),
    doctors: policy.limits.activeDoctors.value,
    smileDeals: policy.limits.smileDeals.value,
    storageBytes: policy.limits.storageBytes,
    messaging: {
      sms: policy.limits.messaging.sms,
      whatsapp: policy.limits.messaging.whatsapp,
      email: policy.limits.messaging.email,
    },
  };
}

export function compareBaselineImpact(
  usage: BaselineUsage,
  rawPlan: string | null | undefined,
  isTrial: boolean,
): string[] {
  const limits = getBaselinePlanLimits(rawPlan);
  if (!limits) return [];

  const impact: string[] = [];
  const bookings = isTrial ? usage.bookingsAllTime : usage.bookingsCurrentLocalMonth;
  const bookingLimit = isTrial ? limits.bookingsTrialTotal : limits.bookingsMonthly;
  if (bookings !== null && bookingLimit !== null && bookings > bookingLimit) {
    impact.push(`bookings ${bookings}/${bookingLimit}`);
  }

  if (usage.activeDoctors !== null && limits.doctors !== null && usage.activeDoctors > limits.doctors) {
    impact.push(`active doctors ${usage.activeDoctors}/${limits.doctors}`);
  }

  if (usage.liveSmileDeals !== null && limits.smileDeals !== null && usage.liveSmileDeals > limits.smileDeals) {
    impact.push(`live Smile Deals ${usage.liveSmileDeals}/${limits.smileDeals}`);
  }

  if (usage.storageBytes !== null && limits.storageBytes !== null && usage.storageBytes > limits.storageBytes) {
    impact.push(`storage ${usage.storageBytes}/${limits.storageBytes} bytes`);
  }

  const messages = isTrial ? usage.allTimeMessages : usage.currentLocalMonthMessages;
  for (const channel of BASELINE_MESSAGE_CHANNELS) {
    const used = messages[channel];
    const limit = limits.messaging[channel];
    if (used !== null && limit !== null && used > limit) {
      impact.push(`${channel} ${used}/${limit}`);
    }
  }

  if (rawPlan?.trim().toLowerCase() === "pro") {
    const review = [
      [usage.bookingsCurrentLocalMonth, 1000, "monthly bookings"],
      [usage.activeDoctors, 25, "active doctors"],
      [usage.liveSmileDeals, 100, "live Smile Deals"],
    ] as const;
    for (const [used, threshold, label] of review) {
      if (used !== null && used > threshold) {
        impact.push(`${label} above Pro review threshold ${threshold}`);
      }
    }
  }

  return impact;
}