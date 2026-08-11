import {
  and,
  eq,
  gte,
  isNotNull,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import {
  createBusinessDateContext,
  normalizeConfirmationStatus,
  normalizeDoctorApprovalStatus,
  normalizeVisitStatus,
  type BusinessDateContext,
} from "@shared/booking-status";
import { format, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { bookings } from "@shared/schema";

/**
 * SQL predicates and in-memory equivalents for the shared booking lifecycle.
 *
 * Role visibility (clinic ownership and doctor assignment) remains in the
 * calling query. These helpers only define what a booking means.
 */

export interface BookingPolicyRow {
  startTime: Date | string | number;
  verificationStatus?: string | null;
  confirmedBy?: string | null;
  doctorApprovalStatus?: string | null;
  visitStatus?: string | null;
}

export interface BookingDateBoundaries {
  now: Date;
  todayStr: string;
  todayStart: Date;
  todayEnd: Date;
  tomorrowStart: Date;
  thisWeekStart: Date;
  thisWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
  next7DaysEnd: Date;
  context: BusinessDateContext;
}

export interface BookingStatsSnapshot {
  todayCount: number;
  todayConfirmedCount: number;
  upcomingCount: number;
  pastCount: number;
  thisWeekCount: number;
  nextWeekCount: number;
  pendingNext7Count: number;
  confirmedNext7Count: number;
  totalPendingCount: number;
  totalAllCount: number;
  totalOwnedCount?: number;
  awaitingApprovalCount?: number;
  patientTotalCount?: number;
}

export function createBookingDateBoundaries(now = new Date()): BookingDateBoundaries {
  const contextNow = new Date(now.getTime());
  const todayStart = startOfDay(contextNow);

  return {
    now: contextNow,
    todayStr: format(contextNow, "yyyy-MM-dd"),
    todayStart,
    todayEnd: endOfDay(contextNow),
    tomorrowStart: startOfDay(addDays(contextNow, 1)),
    thisWeekStart: startOfWeek(contextNow, { weekStartsOn: 1 }),
    thisWeekEnd: endOfWeek(contextNow, { weekStartsOn: 1 }),
    nextWeekStart: startOfWeek(addWeeks(contextNow, 1), { weekStartsOn: 1 }),
    nextWeekEnd: endOfWeek(addWeeks(contextNow, 1), { weekStartsOn: 1 }),
    next7DaysEnd: addDays(todayStart, 7),
    context: createBusinessDateContext(contextNow),
  };
}

function statusDate(row: BookingPolicyRow): Date {
  return new Date(row.startTime);
}

function normalizedVisit(row: BookingPolicyRow) {
  return normalizeVisitStatus(row.visitStatus);
}

export function isConfirmedBooking(row: BookingPolicyRow): boolean {
  const confirmation = normalizeConfirmationStatus(row.verificationStatus);
  return confirmation.value === "confirmed" || !!row.confirmedBy;
}

export function isTerminalBooking(row: BookingPolicyRow): boolean {
  const confirmation = normalizeConfirmationStatus(row.verificationStatus);
  const visit = normalizedVisit(row);
  return (
    confirmation.value === "cancelled" ||
    confirmation.value === "no_show" ||
    visit.value === "patient_left_early"
  );
}

export function isCompletedPatientVisit(row: BookingPolicyRow): boolean {
  const visit = normalizedVisit(row);
  return visit.value === "completed" || visit.value === "treatment_completed";
}

export function isActiveVisit(row: BookingPolicyRow): boolean {
  const visit = normalizedVisit(row);
  return visit.value === "checked_in" || visit.value === "in_consultation";
}

/**
 * "Pending" means not effectively confirmed and not terminal. Legacy or
 * unknown confirmation values remain unresolved rather than being discarded.
 */
export function isPendingBooking(row: BookingPolicyRow): boolean {
  return (
    !isConfirmedBooking(row) &&
    !isTerminalBooking(row) &&
    !isCompletedPatientVisit(row)
  );
}

/**
 * Null approval is normalized to "unassigned", which is not pending/declined.
 * This matches the shared classifier and prevents SQL NULL comparisons from
 * silently excluding assigned bookings.
 */
export function isDoctorApprovedBooking(row: BookingPolicyRow): boolean {
  const approval = normalizeDoctorApprovalStatus(row.doctorApprovalStatus);
  return approval.value !== "pending" && approval.value !== "declined";
}

export function isAwaitingDoctorApproval(
  row: BookingPolicyRow,
  boundaries: BookingDateBoundaries,
): boolean {
  const approval = normalizeDoctorApprovalStatus(row.doctorApprovalStatus);
  const date = statusDate(row);
  return (
    approval.value === "pending" &&
    !isTerminalBooking(row) &&
    !isCompletedPatientVisit(row) &&
    date >= boundaries.todayStart
  );
}

export function confirmedBookingCondition(): SQL {
  return or(eq(bookings.verificationStatus, "confirmed"), isNotNull(bookings.confirmedBy))!;
}

export function nonTerminalBookingCondition(): SQL {
  return and(
    ne(bookings.verificationStatus, "cancelled"),
    ne(bookings.verificationStatus, "no_show"),
    or(isNull(bookings.visitStatus), ne(bookings.visitStatus, "patient_left_early")),
  )!;
}

export function completedPatientVisitCondition(): SQL {
  return or(
    eq(bookings.visitStatus, "completed"),
    eq(bookings.visitStatus, "treatment_completed"),
  )!;
}

export function notCompletedPatientVisitCondition(): SQL {
  return or(
    isNull(bookings.visitStatus),
    and(
      ne(bookings.visitStatus, "completed"),
      ne(bookings.visitStatus, "treatment_completed"),
    ),
  )!;
}

export function pendingBookingCondition(): SQL {
  return and(
    ne(bookings.verificationStatus, "confirmed"),
    isNull(bookings.confirmedBy),
    ne(bookings.verificationStatus, "cancelled"),
    ne(bookings.verificationStatus, "no_show"),
    or(isNull(bookings.visitStatus), ne(bookings.visitStatus, "patient_left_early")),
    notCompletedPatientVisitCondition(),
  )!;
}

export function doctorApprovedBookingCondition(): SQL {
  return or(
    isNull(bookings.doctorApprovalStatus),
    and(
      ne(bookings.doctorApprovalStatus, "pending"),
      ne(bookings.doctorApprovalStatus, "declined"),
    ),
  )!;
}

export function awaitingDoctorApprovalCondition(): SQL {
  return and(
    eq(bookings.doctorApprovalStatus, "pending"),
    nonTerminalBookingCondition(),
    notCompletedPatientVisitCondition(),
  )!;
}

export function activeVisitCondition(): SQL {
  return and(
    or(
      eq(bookings.visitStatus, "checked_in"),
      eq(bookings.visitStatus, "in_consultation"),
    ),
    nonTerminalBookingCondition(),
  )!;
}

export function calculateClinicBookingStats(
  rows: BookingPolicyRow[],
  boundaries: BookingDateBoundaries,
): BookingStatsSnapshot {
  const stats: BookingStatsSnapshot = {
    todayCount: 0,
    todayConfirmedCount: 0,
    upcomingCount: 0,
    pastCount: 0,
    thisWeekCount: 0,
    nextWeekCount: 0,
    pendingNext7Count: 0,
    confirmedNext7Count: 0,
    totalPendingCount: 0,
    totalAllCount: rows.length,
  };

  for (const row of rows) {
    const date = statusDate(row);
    const dateStr = format(date, "yyyy-MM-dd");
    const confirmed = isConfirmedBooking(row);
    const pending = isPendingBooking(row);
    const nonTerminal = !isTerminalBooking(row);
    const completed = isCompletedPatientVisit(row);

    if (dateStr === boundaries.todayStr) {
      stats.todayCount++;
      if (confirmed) stats.todayConfirmedCount++;
    }
    if (date >= boundaries.tomorrowStart && confirmed && nonTerminal && !completed) {
      stats.upcomingCount++;
    }
    if (date < boundaries.todayStart) stats.pastCount++;
    if (date >= boundaries.thisWeekStart && date <= boundaries.thisWeekEnd) {
      stats.thisWeekCount++;
    }
    if (date >= boundaries.nextWeekStart && date <= boundaries.nextWeekEnd) {
      stats.nextWeekCount++;
    }
    if (date >= boundaries.todayStart && date < boundaries.next7DaysEnd) {
      if (pending) stats.pendingNext7Count++;
      if (confirmed && nonTerminal) stats.confirmedNext7Count++;
    }
    if (pending) stats.totalPendingCount++;
  }

  return stats;
}

export function calculateDoctorBookingStats(
  rows: BookingPolicyRow[],
  boundaries: BookingDateBoundaries,
): BookingStatsSnapshot {
  const stats: BookingStatsSnapshot = {
    todayCount: 0,
    todayConfirmedCount: 0,
    upcomingCount: 0,
    pastCount: 0,
    thisWeekCount: 0,
    nextWeekCount: 0,
    pendingNext7Count: 0,
    confirmedNext7Count: 0,
    totalPendingCount: 0,
    totalAllCount: rows.length,
    totalOwnedCount: 0,
    awaitingApprovalCount: 0,
  };

  for (const row of rows) {
    const date = statusDate(row);
    const dateStr = format(date, "yyyy-MM-dd");
    const approved = isDoctorApprovedBooking(row);
    const awaiting = isAwaitingDoctorApproval(row, boundaries);
    const confirmed = isConfirmedBooking(row);
    const pending = isPendingBooking(row);
    const nonTerminal = !isTerminalBooking(row);
    const completed = isCompletedPatientVisit(row);

    if (awaiting) stats.awaitingApprovalCount!++;
    if (approved) {
      stats.totalOwnedCount!++;
      if (dateStr === boundaries.todayStr) {
        stats.todayCount++;
        if (confirmed) stats.todayConfirmedCount++;
      }
      if (date >= boundaries.tomorrowStart && nonTerminal && !completed) {
        stats.upcomingCount++;
      }
      if (date < boundaries.todayStart) stats.pastCount++;
      if (date >= boundaries.thisWeekStart && date <= boundaries.thisWeekEnd) {
        stats.thisWeekCount++;
      }
      if (date >= boundaries.nextWeekStart && date <= boundaries.nextWeekEnd) {
        stats.nextWeekCount++;
      }
    }
    if (date >= boundaries.todayStart && date < boundaries.next7DaysEnd) {
      if (awaiting) stats.pendingNext7Count++;
      if (approved && confirmed && nonTerminal) stats.confirmedNext7Count++;
    }
    if (pending) stats.totalPendingCount++;
  }

  return stats;
}