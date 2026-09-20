import { useState } from "react";
import {
  CalendarClock,
  CreditCard,
  Gauge,
  HardDrive,
  MessageSquare,
} from "lucide-react";
import ClinicEntitlementSettingsPanel from "@/components/ClinicEntitlementSettingsPanel";
import ClinicMessagingUsagePanel from "@/components/ClinicMessagingUsagePanel";
import ClinicReminderDigestPanel from "@/components/ClinicReminderDigestPanel";
import ClinicStorageSettingsPanel from "@/components/ClinicStorageSettingsPanel";

type SettingsSection = "plan" | "usage" | "messaging" | "storage" | "reminders";

const sections: {
  key: SettingsSection;
  label: string;
  description: string;
  Icon: typeof CreditCard;
}[] = [
  {
    key: "plan",
    label: "Plan & access",
    description: "Current plan and access status",
    Icon: CreditCard,
  },
  {
    key: "usage",
    label: "Usage & quotas",
    description: "Limits and measured usage",
    Icon: Gauge,
  },
  {
    key: "messaging",
    label: "Messaging",
    description: "Channel usage and trends",
    Icon: MessageSquare,
  },
  {
    key: "storage",
    label: "Storage & files",
    description: "Storage allowance and checks",
    Icon: HardDrive,
  },
  {
    key: "reminders",
    label: "Reminder digest",
    description: "Doctor appointment reminders",
    Icon: CalendarClock,
  },
];

export default function ClinicSettingsWorkspace() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("plan");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-background to-sky-50/70 p-5 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/30 dark:via-background dark:to-sky-950/20 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-400/5" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-400/5" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Clinic settings
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Manage your clinic workspace</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Review access, usage, storage, messaging, and doctor reminders from one place.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Settings workspace</span>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm">
        <div
          className="flex gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Clinic settings sections"
        >
          {sections.map(({ key, label, description, Icon }) => {
            const isActive = activeSection === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`settings-section-${key}`}
                onClick={() => setActiveSection(key)}
                className={`group flex min-w-max items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors sm:px-4 ${
                  isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  isActive
                    ? "border-emerald-200 bg-background/70 text-emerald-600 dark:border-emerald-800 dark:text-emerald-300"
                    : "border-border/60 bg-muted/40 text-muted-foreground group-hover:text-foreground"
                }`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="hidden text-[11px] text-muted-foreground sm:block">{description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`settings-section-${activeSection}`}
        role="tabpanel"
        aria-label={sections.find(section => section.key === activeSection)?.label}
        tabIndex={-1}
      >
        {activeSection === "plan" && <ClinicEntitlementSettingsPanel mode="plan" />}
        {activeSection === "usage" && <ClinicEntitlementSettingsPanel mode="usage" />}
        {activeSection === "messaging" && <ClinicMessagingUsagePanel />}
        {activeSection === "storage" && <ClinicStorageSettingsPanel />}
        {activeSection === "reminders" && <ClinicReminderDigestPanel />}
      </div>
    </div>
  );
}