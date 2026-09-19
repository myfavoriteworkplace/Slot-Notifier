import { addDays, differenceInCalendarDays } from "date-fns";
import {
  DEFAULT_CLINIC_TIMEZONE,
  getCalendarDateInTimezone,
  getUtcInstantForCalendarDate,
  normalizeConfirmationStatus,
  resolveClinicTimezone,
} from "@shared/booking-status";
import type {
  ClinicMonitoringClinicRow,
  ClinicMonitoringResponse,
  ClinicMonitoringSummary,
  ClinicMonitoringTrendPoint,
} from "@shared/clinic-monitoring";

export interface ClinicMonitoringClinicInput {
  id: number;
  name: string;
  plan: string | null;
  subscriptionStatus: string | null;
  timezone: string | null;
}

/**
 * This is deliberately an operational-only projection. It contains no patient,
 * doctor, clinical, billing, or free-text fields and is never returned directly.
 */
export interface ClinicMonitoringBookingRow {
  clinicId: number | null;
  slotId: number | null;
  bookingId: number | null;
  slotStart: Date | string | null;
  slotEnd: Date | string | null;
  slotCancelled: boolean | null;
  bookedBy: string | null;
  verificationStatus: string | null;
  checkedInAt: Date | string | null;
  completedAt: Date | string | null;
}

export interface ClinicMonitoringDateRange {
  from: string;
  to: string;
}

export const MAX_CLINIC_MONITORING_DAYS = 366;
const MAX_OBSERVED_VISIT_MINUTES = 24 * 60;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidClinicMonitoringDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function shiftClinicMonitoringDate(date: string, days: number): string {
  const shifted = addDays(new Date(`${date}T00:00:00.000Z`), days);
  return shifted.toISOString().slice(0, 10);
}

export function getDefaultClinicMonitoringDateRange(now = new Date()): ClinicMonitoringDateRange {
  const to = getCalendarDateInTimezone(now, DEFAULT_CLINIC_TIMEZONE);
  return { from: shiftClinicMonitoringDate(to, -29), to };
}

export function validateClinicMonitoringDateRange(
  range: ClinicMonitoringDateRange,
): string | null {
  if (!isValidClinicMonitoringDate(range.from) || !isValidClinicMonitoringDate(range.to)) {
    return "Dates must use YYYY-MM-DD format";
  }
  if (range.from > range.to) return "The start date must be before the end date";
  if (differenceInCalendarDays(
    new Date(`${range.to}T00:00:00.000Z`),
    new Date(`${range.from}T00:00:00.000Z`),
  ) + 1 > MAX_CLINIC_MONITORING_DAYS) {
    return `The reporting period cannot exceed ${MAX_CLINIC_MONITORING_DAYS} days`;
  }
  return null;
}

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createEmptyMetrics() {
  return {
    activeDates: new Set<string>(),
    externalBookings: 0,
    internalBookings: 0,
    unclassifiedBookings: 0,
    totalBookings: 0,
    cancelledBookings: 0,
    noShowBookings: 0,
    scheduledHours: 0,
    observedVisitMinutes: 0,
    observedVisitCount: 0,
    anomalousVisitDurationCount: 0,
    lastActiveDate: null as string | null,
    trend: new Map<string, { external: number; internal: number; unclassified: number; total: number }>(),
  };
}

type ClinicMetrics = ReturnType<typeof createEmptyMetrics>;

function calculateMetrics(
  clinic: ClinicMonitoringClinicInput,
  rows: ClinicMonitoringBookingRow[],
  start: Date,
  endExclusive: Date,
): ClinicMetrics {
  const metrics = createEmptyMetrics();
  const timezone = resolveClinicTimezone(clinic.timezone);
  const countedSlots = new Set<number>();
  const clinicRows = rows.filter(row => row.clinicId === clinic.id);

  for (const row of clinicRows) {
    const slotStart = toDate(row.slotStart);
    if (!slotStart || slotStart < start || slotStart >= endExclusive) continue;

    if (
      row.slotId !== null &&
      !countedSlots.has(row.slotId) &&
      !row.slotCancelled
    ) {
      const slotEnd = toDate(row.slotEnd);
      if (slotEnd && slotEnd > slotStart) {
        metrics.scheduledHours += (slotEnd.getTime() - slotStart.getTime()) / 3_600_000;
      }
      countedSlots.add(row.slotId);
    }

    if (row.bookingId === null) continue;

    const localDate = getCalendarDateInTimezone(slotStart, timezone);
    const trend = metrics.trend.get(localDate) ?? {
      external: 0,
      internal: 0,
      unclassified: 0,
      total: 0,
    };
    trend.total += 1;
    metrics.totalBookings += 1;

    if (row.bookedBy === "patient") {
      metrics.externalBookings += 1;
      trend.external += 1;
    } else if (row.bookedBy === "admin") {
      metrics.internalBookings += 1;
      trend.internal += 1;
    } else {
      metrics.unclassifiedBookings += 1;
      trend.unclassified += 1;
    }
    metrics.trend.set(localDate, trend);
    metrics.activeDates.add(localDate);
    if (!metrics.lastActiveDate || localDate > metrics.lastActiveDate) {
      metrics.lastActiveDate = localDate;
    }

    const confirmationStatus = normalizeConfirmationStatus(row.verificationStatus).value;
    if (confirmationStatus === "cancelled") metrics.cancelledBookings += 1;
    if (confirmationStatus === "no_show") metrics.noShowBookings += 1;

    const checkedInAt = toDate(row.checkedInAt);
    const completedAt = toDate(row.completedAt);
    if (checkedInAt && completedAt) {
      const durationMinutes = (completedAt.getTime() - checkedInAt.getTime()) / 60_000;
      if (durationMinutes > 0 && durationMinutes <= MAX_OBSERVED_VISIT_MINUTES) {
        metrics.observedVisitMinutes += durationMinutes;
        metrics.observedVisitCount += 1;
      } else {
        metrics.anomalousVisitDurationCount += 1;
      }
    }
  }

  return metrics;
}

function toClinicRow(
  clinic: ClinicMonitoringClinicInput,
  current: ClinicMetrics,
  previous: ClinicMetrics,
): ClinicMonitoringClinicRow {
  const changePercent = previous.totalBookings === 0
    ? (current.totalBookings === 0 ? 0 : null)
    : Math.round(((current.totalBookings - previous.totalBookings) / previous.totalBookings) * 1000) / 10;

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    plan: clinic.plan,
    subscriptionStatus: clinic.subscriptionStatus,
    timezone: resolveClinicTimezone(clinic.timezone),
    activeDays: current.activeDates.size,
    externalBookings: current.externalBookings,
    internalBookings: current.internalBookings,
    unclassifiedBookings: current.unclassifiedBookings,
    totalBookings: current.totalBookings,
    scheduledHours: Math.round(current.scheduledHours * 100) / 100,
    observedVisitHours: Math.round((current.observedVisitMinutes / 60) * 100) / 100,
    averageObservedVisitMinutes: current.observedVisitCount > 0
      ? Math.round((current.observedVisitMinutes / current.observedVisitCount) * 10) / 10
      : null,
    cancellationRate: current.totalBookings > 0
      ? Math.round((current.cancelledBookings / current.totalBookings) * 1000) / 10
      : null,
    noShowRate: current.totalBookings > 0
      ? Math.round((current.noShowBookings / current.totalBookings) * 1000) / 10
      : null,
    lastActiveDate: current.lastActiveDate,
    changePercent,
    anomalousVisitDurationCount: current.anomalousVisitDurationCount,
  };
}

function emptySummary(): ClinicMonitoringSummary {
  return {
    activeClinicCount: 0,
    externalBookingCount: 0,
    internalBookingCount: 0,
    unclassifiedBookingCount: 0,
    totalBookingCount: 0,
    scheduledHours: 0,
    observedVisitHours: 0,
    averageObservedVisitMinutes: null,
  };
}

export function buildClinicMonitoringReport(
  clinics: ClinicMonitoringClinicInput[],
  rows: ClinicMonitoringBookingRow[],
  range: ClinicMonitoringDateRange,
): ClinicMonitoringResponse {
  const periodDays = differenceInCalendarDays(
    new Date(`${range.to}T00:00:00.000Z`),
    new Date(`${range.from}T00:00:00.000Z`),
  ) + 1;
  const previousRange = {
    from: shiftClinicMonitoringDate(range.from, -periodDays),
    to: shiftClinicMonitoringDate(range.from, -1),
  };

  const trendByDate = new Map<string, {
    activeClinics: Set<number>;
    external: number;
    internal: number;
    unclassified: number;
    total: number;
  }>();
  const summary = emptySummary();
  let totalObservedVisitMinutes = 0;
  let totalObservedVisitCount = 0;
  const clinicRows = clinics.map(clinic => {
    const timezone = resolveClinicTimezone(clinic.timezone);
    const current = calculateMetrics(
      clinic,
      rows,
      getUtcInstantForCalendarDate(range.from, timezone),
      getUtcInstantForCalendarDate(shiftClinicMonitoringDate(range.to, 1), timezone),
    );
    const previous = calculateMetrics(
      clinic,
      rows,
      getUtcInstantForCalendarDate(previousRange.from, timezone),
      getUtcInstantForCalendarDate(shiftClinicMonitoringDate(previousRange.to, 1), timezone),
    );

    if (current.totalBookings > 0) summary.activeClinicCount += 1;
    summary.externalBookingCount += current.externalBookings;
    summary.internalBookingCount += current.internalBookings;
    summary.unclassifiedBookingCount += current.unclassifiedBookings;
    summary.totalBookingCount += current.totalBookings;
    summary.scheduledHours += current.scheduledHours;
    summary.observedVisitHours += current.observedVisitMinutes / 60;
    totalObservedVisitMinutes += current.observedVisitMinutes;
    totalObservedVisitCount += current.observedVisitCount;

    for (const [date, values] of current.trend) {
      const trend = trendByDate.get(date) ?? {
        activeClinics: new Set<number>(),
        external: 0,
        internal: 0,
        unclassified: 0,
        total: 0,
      };
      trend.activeClinics.add(clinic.id);
      trend.external += values.external;
      trend.internal += values.internal;
      trend.unclassified += values.unclassified;
      trend.total += values.total;
      trendByDate.set(date, trend);
    }

    return toClinicRow(clinic, current, previous);
  });

  summary.scheduledHours = Math.round(summary.scheduledHours * 100) / 100;
  summary.observedVisitHours = Math.round(summary.observedVisitHours * 100) / 100;
  summary.averageObservedVisitMinutes = totalObservedVisitCount > 0
    ? Math.round((totalObservedVisitMinutes / totalObservedVisitCount) * 10) / 10
    : null;

  const trend: ClinicMonitoringTrendPoint[] = [...trendByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      activeClinicCount: values.activeClinics.size,
      externalBookings: values.external,
      internalBookings: values.internal,
      unclassifiedBookings: values.unclassified,
      totalBookings: values.total,
    }));

  return {
    period: { ...range, timezone: "clinic-local" },
    summary,
    trend,
    clinics: clinicRows.sort((a, b) => b.totalBookings - a.totalBookings || a.clinicName.localeCompare(b.clinicName)),
  };
}
