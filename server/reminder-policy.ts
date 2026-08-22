import { addDays } from "date-fns";
import {
  getCalendarDateInTimezone,
  type BusinessDateContext,
} from "@shared/booking-status";
import {
  isCompletedPatientVisit,
  isConfirmedBooking,
  isTerminalBooking,
  type BookingPolicyRow,
  type BookingDateBoundaries,
} from "./booking-predicates";

export type ReminderPolicyRow = BookingPolicyRow & {
  slotExists?: boolean;
  slotCancelled?: boolean;
  assignedDoctorEmail?: string | null;
};

export type ReminderDateGroup = "nextThreeDays" | "comingWeek" | null;

export interface ReminderClinicRow {
  status?: string | null;
  isArchived?: boolean | null;
  subscriptionStatus?: string | null;
}

function hasActiveVisit(row: ReminderPolicyRow): boolean {
  return !isTerminalBooking(row) && !isCompletedPatientVisit(row);
}

function hasValidSlot(row: ReminderPolicyRow): boolean {
  return row.slotExists !== false && row.slotCancelled !== true;
}

function localDateOffset(
  startTime: ReminderPolicyRow["startTime"],
  context: BusinessDateContext,
): number {
  const localDate = getCalendarDateInTimezone(new Date(startTime), context.timezone);
  const currentCivilDate = new Date(`${context.currentDate}T00:00:00.000Z`);
  const appointmentCivilDate = new Date(`${localDate}T00:00:00.000Z`);
  return Math.round(
    (appointmentCivilDate.getTime() - currentCivilDate.getTime()) / (24 * 60 * 60 * 1000),
  );
}

export function isClinicReminderEligible(
  row: ReminderPolicyRow,
  boundaries: BookingDateBoundaries,
): boolean {
  const offset = localDateOffset(row.startTime, boundaries.context);
  return (
    hasValidSlot(row) &&
    hasActiveVisit(row) &&
    isConfirmedBooking(row) &&
    offset >= 0 &&
    offset <= 6
  );
}

export function isDoctorReminderEligible(
  row: ReminderPolicyRow,
  boundaries: BookingDateBoundaries,
): boolean {
  const approval = row.doctorApprovalStatus;
  const hasExplicitApproval = approval === "approved" || approval === "admin_confirmed";
  const hasAssignedDoctor = Boolean(row.assignedDoctorEmail?.trim());
  const offset = localDateOffset(row.startTime, boundaries.context);

  return (
    hasValidSlot(row) &&
    hasActiveVisit(row) &&
    hasAssignedDoctor &&
    hasExplicitApproval &&
    offset >= 0 &&
    offset <= 6
  );
}

export function getReminderDateGroup(
  row: ReminderPolicyRow,
  context: BusinessDateContext,
): ReminderDateGroup {
  const offset = localDateOffset(row.startTime, context);
  if (offset >= 0 && offset <= 2) return "nextThreeDays";
  if (offset >= 3 && offset <= 6) return "comingWeek";
  return null;
}

export function isDigestEligibleClinic(clinic: ReminderClinicRow): boolean {
  return (
    clinic.status === "approved" &&
    clinic.isArchived !== true &&
    clinic.subscriptionStatus === "active"
  );
}

export function getReminderWindowDates(today: string): {
  nextThreeDays: string[];
  comingWeek: string[];
} {
  const todayCivilDate = new Date(`${today}T00:00:00.000Z`);
  const dateAtOffset = (offset: number) => formatDate(addDays(todayCivilDate, offset));
  return {
    nextThreeDays: [0, 1, 2].map(dateAtOffset),
    comingWeek: [3, 4, 5, 6].map(dateAtOffset),
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}