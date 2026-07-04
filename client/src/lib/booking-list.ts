import { format, startOfDay, endOfDay } from "date-fns";
import type { BookingWithSlot } from "@/lib/clinic-constants";

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
  const d = new Date(booking.slot.startTime);
  const isPast = d < todayStart && format(d, "yyyy-MM-dd") !== todayStr;
  if (isPast) return 2;
  if (booking.verificationStatus === "confirmed" || !!booking.confirmedBy) return 1;
  return 0;
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
  const bookingDateTime = new Date(booking.slot.startTime);
  const bookingDateStr = format(bookingDateTime, "yyyy-MM-dd");
  const isBookingToday = bookingDateStr === todayStr;
  const isBookingPast = bookingDateTime < todayStart && !isBookingToday;
  const isConfirmed = booking.verificationStatus === "confirmed" || !!booking.confirmedBy;
  const isCancelled = booking.verificationStatus === "cancelled";
  const isPending = !isConfirmed && !isBookingPast;

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
  const isCancelled = booking.verificationStatus === "cancelled";
  const isNoShow = booking.verificationStatus === "no_show";
  const isLeftEarly = booking.visitStatus === "patient_left_early";
  const isCompleted = booking.visitStatus === "completed";
  const isTreatmentCompleted = booking.visitStatus === "treatment_completed";
  const isInConsultation = booking.visitStatus === "in_consultation";
  const isCheckedIn = booking.visitStatus === "checked_in";
  const isTerminal = isCancelled || isNoShow || isLeftEarly;
  const isAlreadyConfirmed = booking.verificationStatus === "confirmed" || !!booking.confirmedBy;

  return {
    canConfirm: !isTerminal && !isCompleted && !isTreatmentCompleted && !isInConsultation && !isCheckedIn && !isAlreadyConfirmed,
    canCancel: !isTerminal && !isCompleted,
    canCheckIn: !isTerminal && !isCompleted && !isTreatmentCompleted && !isInConsultation && !isCheckedIn,
    canCompleteVisit: !isTerminal && !isCompleted && (isTreatmentCompleted || isInConsultation || isCheckedIn),
    canNoShow: !isTerminal && !isCompleted && !isTreatmentCompleted && !isInConsultation && !isCheckedIn,
    canSendReminder: !isTerminal && !isCompleted,
    canOverrideComplete: !isTerminal && !isCompleted && !isTreatmentCompleted,
    canPatientLeftEarly: !isTerminal && !isCompleted && (isInConsultation || isCheckedIn),
    canAssignDoctor: !isTerminal && !isCompleted,
    canRequestConsent: !isTerminal && !isCompleted,
    canReschedule: !isTerminal && !isCompleted,
    canUpdateClinicalStatus: !isTerminal && !isCompleted,
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
}: {
  activePatientFilter?: { id: number; name: string; patientCode?: string | null } | null;
  activePatientBookingsCount: number;
  quickFilter: string;
  filterDate?: Date;
  filterEndDate?: Date;
}) {
  if (activePatientFilter) {
    return {
      title: activePatientBookingsCount === 0
        ? `${activePatientFilter.name.split(" ")[0]} has no bookings here`
        : "No matching appointments",
      detail: activePatientBookingsCount === 0
        ? "This patient is registered but hasn't booked here yet."
        : "Their appointments exist — the active filter is hiding them.",
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
    : filterDate || filterEndDate
    ? "No appointments in this range"
    : "No bookings yet";

  const detail = quickFilter === "today"
    ? "No slots are booked for today. Check Upcoming for future appointments."
    : quickFilter === "upcoming"
    ? "There are no future appointments. Past bookings may be in the Past filter."
    : quickFilter === "past"
    ? "No appointment history yet — your clinic is just getting started!"
    : quickFilter === "this-week"
    ? "No appointments fall within Mon–Sun of this week. Try Next Week or All Bookings."
    : quickFilter === "next-week"
    ? "No appointments are scheduled for next week yet."
    : filterDate || filterEndDate
    ? "No bookings fall in the selected date range. Clear the date filter to see all."
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

  const sorted = [...filtered].sort((a, b) => {
    if (quickFilter === "all" && !filterDate) {
      const groupA = getStatusGroup(a, todayStart, todayStr);
      const groupB = getStatusGroup(b, todayStart, todayStr);
      if (groupA !== groupB) return groupA - groupB;
    }

    return new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime();
  });

  if (!activePatientFilter) {
    return sorted;
  }

  return sorted.filter((booking) => booking.patientId === activePatientFilter.id);
}
