import { format, startOfDay, endOfDay } from "date-fns";
import type { BookingWithSlot } from "@/lib/clinic-constants";
import {
  classifyClientBooking,
  createClientBookingDateContext,
} from "@/lib/booking-classification";

export interface BookingStats {
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

export interface BookingsPagedResponse {
  data: BookingWithSlot[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: BookingStats;
}

export type BookingListFilters = {
  bookings: BookingWithSlot[];
  quickFilter: string;
  activePatientFilter?: { id: number; name: string } | null;
  filterDate?: Date;
  filterEndDate?: Date;
  todayStart: Date;
  todayStr: string;
  thisWeekStart: Date;
  thisWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
  statNext7DaysEnd: Date;
};

function getStatusGroup(booking: BookingWithSlot, todayStart: Date, todayStr: string): number {
  const classification = classifyClientBooking(booking, "clinic", {
    ...createClientBookingDateContext(todayStart),
    currentDate: todayStr,
  });
  if (classification.isOld) return 2;
  if (classification.isConfirmed) return 1;
  return 0;
}

/**
 * Returns 0 for appointments that have not started yet and 1 for appointments
 * whose start timestamp has passed.
 *
 * Used to split mixed booking lists (All, All Pending, Owned) into a future
 * group above and a past group below, matching the server-side CASE WHEN sort
 * order. The timestamp comparison intentionally uses the current instant, not
 * the start of the calendar day, so an earlier appointment today is treated as
 * past for ordering.
 */
export function getTimeGroup(booking: BookingWithSlot, now: Date = new Date()): number {
  const startTime = new Date(booking.slot.startTime).getTime();
  return Number.isFinite(startTime) && startTime < now.getTime() ? 1 : 0;
}

export function getBookingDisplayMeta({
  booking,
  todayStart,
  todayStr,
}: {
  booking: BookingWithSlot;
  todayStart: Date;
  todayStr: string;
}) {
  const classification = classifyClientBooking(booking, "clinic", {
    ...createClientBookingDateContext(todayStart),
    currentDate: todayStr,
  });
  const isBookingToday = classification.isToday;
  const isBookingPast = classification.isOld;
  const isConfirmed = classification.isConfirmed;
  const isCancelled = classification.normalizedLifecycle === "cancelled";
  const isPending = classification.normalizedLifecycle === "pending_not_started" && !isBookingPast;

  return {
    group: getStatusGroup(booking, todayStart, todayStr),
    isBookingToday,
    isBookingPast,
    isConfirmed,
    isCancelled,
    isPending,
    timeLabel: isBookingToday ? "Today" : isBookingPast ? "Past" : "Upcoming",
    statusLabel: isCancelled ? "Cancelled" : isConfirmed ? "Confirmed" : "Pending",
  };
}

export type BookingActionState = {
  canConfirm: boolean;
  canCancel: boolean;
  canCheckIn: boolean;
  canCompleteVisit: boolean;
  canNoShow: boolean;
  canSendReminder: boolean;
  canOverrideComplete: boolean;
  canPatientLeftEarly: boolean;
  canAssignDoctor: boolean;
  canRequestConsent: boolean;
  canReschedule: boolean;
  canUpdateClinicalStatus: boolean;
};

export function getBookingActionState({ booking }: { booking: BookingWithSlot }): BookingActionState {
  const actions = classifyClientBooking(booking, "clinic").actions;

  return {
    canConfirm: actions.canConfirm,
    canCancel: actions.canCancel,
    canCheckIn: actions.canCheckIn,
    canCompleteVisit: actions.canCompleteVisit,
    canNoShow: actions.canNoShow,
    canSendReminder: actions.canSendReminder,
    canOverrideComplete: actions.canOverride,
    canPatientLeftEarly: actions.canContinueVisit,
    canAssignDoctor: actions.canAssignDoctor,
    canRequestConsent: actions.canRequestConsent,
    canReschedule: actions.canReschedule,
    canUpdateClinicalStatus: actions.canUpdateClinicalStatus,
  };
}

export function getBookingNumber({
  booking,
  bookings,
}: {
  booking: BookingWithSlot;
  bookings: BookingWithSlot[];
}): string {
  const bookingDateStr = format(new Date(booking.slot.startTime), "yyyy-MM-dd");
  const dayBookings = bookings
    .filter((item) => format(new Date(item.slot.startTime), "yyyy-MM-dd") === bookingDateStr)
    .sort((a, b) => new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime());

  const index = dayBookings.findIndex((item) => item.id === booking.id);
  return (index + 1).toString();
}

export function getBookingEmptyStateMeta({
  activePatientFilter,
  activePatientBookingsCount,
  quickFilter,
  filterDate,
  filterEndDate,
  clinicName,
}: {
  activePatientFilter?: { id: number; name: string; patientCode?: string | null } | null;
  activePatientBookingsCount: number;
  quickFilter: string;
  filterDate?: Date;
  filterEndDate?: Date;
  clinicName?: string;
}) {
  const patientName = activePatientFilter?.name.split(" ")[0];
  const dateRangeText = filterDate && filterEndDate
    ? `between ${format(filterDate, "MMM d")} and ${format(filterEndDate, "MMM d")}`
    : filterDate
    ? `on ${format(filterDate, "MMM d")}`
    : filterEndDate
    ? `before ${format(filterEndDate, "MMM d")}`
    : "";
  const clinicSuffix = clinicName ? ` at ${clinicName}` : "";
  const allBookingsHint = clinicName
    ? "Try clearing the clinic filter or switching to All Bookings."
    : "Try switching to All Bookings.";

  // Patient + tab + date combinations
  if (activePatientFilter) {
    const hasDate = !!(filterDate || filterEndDate);
    const tabHint = quickFilter === "all"
      ? ""
      : ` Switching to All Bookings will show ${patientName}'s complete schedule${clinicSuffix}.`;
    if (activePatientBookingsCount === 0) {
      const detail = hasDate
        ? `${patientName} has no bookings ${dateRangeText}${clinicSuffix}. Clear the date filter or switch to All Bookings.`
        : `${patientName} has no bookings${clinicSuffix} matching the active tab.${tabHint}`;
      return {
        title: `No bookings found for ${patientName}`,
        detail,
      };
    }
    const detail = hasDate
      ? `${patientName} has ${activePatientBookingsCount} booking${activePatientBookingsCount === 1 ? "" : "s"}${clinicSuffix}, but none ${dateRangeText}. Try adjusting the date range or tab.`
      : `${patientName} has ${activePatientBookingsCount} booking${activePatientBookingsCount === 1 ? "" : "s"}${clinicSuffix}, but the active tab filter is hiding them.${tabHint}`;
    return {
      title: `No matching appointments for ${patientName}`,
      detail,
    };
  }

  const title = quickFilter === "today"
    ? "No bookings today"
    : quickFilter === "upcoming"
    ? "No upcoming appointments"
    : quickFilter === "past"
    ? "No past appointments"
    : quickFilter === "this-week"
    ? "Nothing scheduled this week"
    : quickFilter === "next-week"
    ? "Nothing booked next week"
    : quickFilter === "awaiting"
    ? "No appointments awaiting approval"
    : quickFilter === "pending-7days"
    ? "No pending appointments in the next 7 days"
    : quickFilter === "confirmed-7days"
    ? "No confirmed appointments in the next 7 days"
    : quickFilter === "owned"
    ? "No owned appointments"
    : filterDate || filterEndDate
    ? "No appointments in this range"
    : "No bookings yet";

  const detail = quickFilter === "today"
    ? (filterDate || filterEndDate
        ? `The Today tab only shows today's bookings${clinicSuffix}. The selected date range ${dateRangeText} doesn't overlap with today. ${allBookingsHint}`
        : `No slots are booked for today${clinicSuffix}. Check Upcoming for future appointments.`)
    : quickFilter === "upcoming"
    ? (filterDate || filterEndDate
        ? `No upcoming appointments ${dateRangeText}${clinicSuffix}. ${allBookingsHint}`
        : `There are no future appointments${clinicSuffix}. Past bookings may be in the Past filter.`)
    : quickFilter === "past"
    ? (filterDate || filterEndDate
        ? `No past appointments ${dateRangeText}${clinicSuffix}. ${allBookingsHint}`
        : `No appointment history yet${clinicSuffix} — your clinic is just getting started!`)
    : quickFilter === "this-week"
    ? `No appointments fall within Mon–Sun of this week${clinicSuffix}. Try Next Week or All Bookings.`
    : quickFilter === "next-week"
    ? `No appointments are scheduled for next week${clinicSuffix} yet.`
    : quickFilter === "awaiting"
    ? (filterDate || filterEndDate
        ? `Nothing is awaiting your approval ${dateRangeText}${clinicSuffix}. ${allBookingsHint}`
        : `You're all caught up${clinicSuffix} — nothing is waiting for your review.`)
    : quickFilter === "pending-7days"
    ? `No pending appointments in the next 7 days${clinicSuffix}. Switch to All Bookings to see every pending request.`
    : quickFilter === "confirmed-7days"
    ? `No confirmed appointments in the next 7 days${clinicSuffix}. Try Upcoming or All Bookings.`
    : quickFilter === "owned"
    ? `No appointments you have accepted${clinicSuffix}. The Awaiting tab shows requests still needing your approval.`
    : filterDate || filterEndDate
    ? `No bookings fall in the selected date range${clinicSuffix}. Clear the date filter to see all.`
    : "Once patients book a slot, their appointments will appear here.";

  return { title, detail };
}

export function filterAndSortBookings({
  bookings,
  quickFilter,
  activePatientFilter,
  filterDate,
  filterEndDate,
  todayStart,
  todayStr,
  thisWeekStart,
  thisWeekEnd,
  nextWeekStart,
  nextWeekEnd,
  statNext7DaysEnd,
}: BookingListFilters): BookingWithSlot[] {
  const filtered = bookings.filter((booking) => {
    const bookingDate = new Date(booking.slot.startTime);

    if (quickFilter === "today") {
      return format(bookingDate, "yyyy-MM-dd") === todayStr;
    }
    if (quickFilter === "upcoming") {
      return bookingDate >= todayStart
        && format(bookingDate, "yyyy-MM-dd") !== todayStr
        && booking.visitStatus !== "completed";
    }
    if (quickFilter === "past") {
      return bookingDate < todayStart;
    }
    if (quickFilter === "this-week") {
      return bookingDate >= thisWeekStart && bookingDate <= thisWeekEnd;
    }
    if (quickFilter === "next-week") {
      return bookingDate >= nextWeekStart && bookingDate <= nextWeekEnd;
    }
    if (quickFilter === "today-confirmed") {
      return format(bookingDate, "yyyy-MM-dd") === todayStr
        && (booking.verificationStatus === "confirmed" || !!booking.confirmedBy);
    }
    if (quickFilter === "pending-7days") {
      return bookingDate >= todayStart && bookingDate <= statNext7DaysEnd
        && booking.verificationStatus !== "confirmed" && !booking.confirmedBy;
    }
    if (quickFilter === "all-pending") {
      return booking.verificationStatus !== "confirmed" && !booking.confirmedBy;
    }
    if (quickFilter === "confirmed-7days") {
      return bookingDate >= todayStart && bookingDate <= statNext7DaysEnd
        && (booking.verificationStatus === "confirmed" || !!booking.confirmedBy);
    }

    if (filterDate && filterEndDate) {
      return bookingDate >= startOfDay(filterDate) && bookingDate <= endOfDay(filterEndDate);
    }
    if (filterDate) {
      const bookingDateStr = format(bookingDate, "yyyy-MM-dd");
      const filterDateStr = format(filterDate, "yyyy-MM-dd");
      return bookingDateStr === filterDateStr;
    }

    return true;
  });

  const sortNow = new Date();
  const sorted = [...filtered].sort((a, b) => {
    const aTime = new Date(a.slot.startTime).getTime();
    const bTime = new Date(b.slot.startTime).getTime();

    if ((quickFilter === "all" || quickFilter === "all-pending") && !filterDate) {
      const groupA = getTimeGroup(a, sortNow);
      const groupB = getTimeGroup(b, sortNow);
      if (groupA !== groupB) return groupA - groupB;
      return groupA === 0 ? aTime - bTime : bTime - aTime;
    }

    if (quickFilter === "past") {
      return bTime - aTime || b.id - a.id;
    }

    return aTime - bTime || b.id - a.id;
  });

  if (!activePatientFilter) {
    return sorted;
  }

  return sorted.filter((booking) => booking.patientId === activePatientFilter.id);
}
