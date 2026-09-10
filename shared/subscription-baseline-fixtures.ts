import type { BaselineMessageUsage, BaselineUsage } from "./subscription-baseline-policy";

export type SubscriptionBaselineFixture = {
  name: string;
  plan: string;
  subscriptionStatus: "active" | "unpaid" | "expired" | "unknown";
  usage: BaselineUsage;
  expectedTrialImpact: string[];
  expectedAssignedPlanImpact: string[];
};

const noMessages = (): BaselineMessageUsage => ({
  sms: 0,
  whatsapp: 0,
  email: 0,
});

const messages = (sms: number | null, whatsapp: number | null, email: number | null): BaselineMessageUsage => ({
  sms,
  whatsapp,
  email,
});

const usage = (overrides: Partial<BaselineUsage> = {}): BaselineUsage => ({
  bookingsAllTime: 0,
  bookingsCurrentLocalMonth: 0,
  activeDoctors: 0,
  liveSmileDeals: 0,
  storageBytes: 0,
  allTimeMessages: noMessages(),
  currentLocalMonthMessages: noMessages(),
  ...overrides,
});

export const SUBSCRIPTION_BASELINE_FIXTURES: SubscriptionBaselineFixture[] = [
  {
    name: "trial-at-every-limit",
    plan: "trial",
    subscriptionStatus: "unpaid",
    usage: usage({
      bookingsAllTime: 10,
      activeDoctors: 1,
      liveSmileDeals: 1,
      storageBytes: 50 * 1024 * 1024,
      allTimeMessages: messages(25, 25, 50),
    }),
    expectedTrialImpact: [],
    expectedAssignedPlanImpact: [],
  },
  {
    name: "starter-over-monthly-limits",
    plan: "starter",
    subscriptionStatus: "active",
    usage: usage({
      bookingsCurrentLocalMonth: 31,
      activeDoctors: 2,
      liveSmileDeals: 2,
      storageBytes: 100 * 1024 * 1024 + 1,
      currentLocalMonthMessages: messages(101, 101, 301),
    }),
    expectedTrialImpact: [],
    expectedAssignedPlanImpact: [
      "bookings 31/30",
      "active doctors 2/1",
      "live Smile Deals 2/1",
      `storage ${100 * 1024 * 1024 + 1}/${100 * 1024 * 1024} bytes`,
      "sms 101/100",
      "whatsapp 101/100",
      "email 301/300",
    ],
  },
  {
    name: "growth-at-every-limit",
    plan: "growth",
    subscriptionStatus: "active",
    usage: usage({
      bookingsCurrentLocalMonth: 150,
      activeDoctors: 3,
      liveSmileDeals: 3,
      storageBytes: 500 * 1024 * 1024,
      currentLocalMonthMessages: messages(500, 500, 1500),
    }),
    expectedTrialImpact: [],
    expectedAssignedPlanImpact: [],
  },
  {
    name: "pro-fair-use-review",
    plan: "pro",
    subscriptionStatus: "active",
    usage: usage({
      bookingsCurrentLocalMonth: 1001,
      activeDoctors: 26,
      liveSmileDeals: 101,
      currentLocalMonthMessages: messages(2000, 2000, 6000),
    }),
    expectedTrialImpact: [],
    expectedAssignedPlanImpact: [
      "monthly bookings above Pro review threshold 1000",
      "active doctors above Pro review threshold 25",
      "live Smile Deals above Pro review threshold 100",
    ],
  },
  {
    name: "legacy-unpaid-starter",
    plan: "starter",
    subscriptionStatus: "unpaid",
    usage: usage({ bookingsCurrentLocalMonth: 1 }),
    expectedTrialImpact: [],
    expectedAssignedPlanImpact: [],
  },
  {
    name: "unknown-plan-remains-unresolved",
    plan: "future_plan",
    subscriptionStatus: "unknown",
    usage: usage({
      bookingsCurrentLocalMonth: 999,
      activeDoctors: 99,
      currentLocalMonthMessages: messages(999, 999, 999),
    }),
    expectedTrialImpact: [],
    expectedAssignedPlanImpact: [],
  },
  {
    name: "unavailable-usage-is-not-zero",
    plan: "growth",
    subscriptionStatus: "expired",
    usage: usage({
      bookingsAllTime: null,
      bookingsCurrentLocalMonth: null,
      activeDoctors: null,
      liveSmileDeals: null,
      storageBytes: null,
      allTimeMessages: messages(null, null, null),
      currentLocalMonthMessages: messages(null, null, null),
    }),
    expectedTrialImpact: [],
    expectedAssignedPlanImpact: [],
  },
];