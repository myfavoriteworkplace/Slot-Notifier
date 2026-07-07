import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import noBookingsImg from "@assets/Copilot_20260603_191746_1780494897553.png";
import {
  type BillingService, type BillingDetails, type ClinicInfo,
  generateReceiptPDF, generateConsentPdf, printBillFromRecord,
} from "@/lib/clinic-pdf";
import { BillingHistoryPanel } from "@/components/BillingHistoryPanel";
import { BookingNotesThread } from "@/components/BookingNotesThread";
import ClinicalRecordsTab from "@/components/ClinicalRecordsTab";
import {
  SlotTiming, BookingWithSlot,
  OVERVIEW_VISIT_TYPE_LABELS, OVERVIEW_CLINICAL_STATUS,
  DEFAULT_SECTION_CAPACITY, CHIEF_COMPLAINTS,
  getRecommendedSpecialists,
} from "@/lib/clinic-constants";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  format, startOfDay, endOfDay, startOfToday, addDays, isSameDay,
  differenceInCalendarDays, startOfWeek, endOfWeek, addWeeks, isAfter
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, Calendar as CalendarIcon, Phone, Clock, X,
  Download, Plus, ChevronDown, ChevronUp, CheckCircle2, IndianRupee, FileText,
  User, Mail, CalendarDays, FlaskConical, TrendingUp, History, Filter, Copy, Check,
  Info, ClipboardCheck, PenLine, Link2, ClipboardList, AlertTriangle, AlertCircle, CreditCard,
  Users, Search, ArrowUpDown, BadgeCheck, MoreHorizontal,
  ChevronLeft, ChevronRight, Save, Hash, Printer, ArrowLeft, ArrowRight,
  Building2, ExternalLink, LogOut, Settings, SlidersHorizontal,
} from "lucide-react";
import { Stethoscope, Trash2, Upload, Repeat2, Tag, UserX, ShieldCheck, Activity, CalendarPlus, RefreshCw, Lightbulb, Maximize2, Minimize2 } from "lucide-react";
import { BookingProgressStrip, type LifecycleStage } from "@/components/BookingProgressStrip";
import { AppointmentCard } from "@/components/AppointmentCard";
import { filterAndSortBookings, getBookingActionState, getBookingDisplayMeta, getBookingEmptyStateMeta, getBookingNumber, type BookingsPagedResponse } from "@/lib/booking-list";
import type { PatientBill, Patient } from "@shared/schema";

function BookingCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <div className="h-1 bg-muted/40 rounded-t-2xl" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-sm shrink-0" />
          <Skeleton className="h-3.5 w-44 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-sm shrink-0" />
          <Skeleton className="h-3.5 w-24 rounded-md" />
        </div>
        <div className="pt-2 border-t border-border/40 flex gap-3">
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

type QuickFilterType = 'all' | 'today' | 'upcoming' | 'past' | 'this-week' | 'next-week' | 'today-confirmed' | 'pending-7days' | 'all-pending' | 'confirmed-7days';

type RescheduleSlotAvailRow = {
  slotIndex: number; label: string; startTimeISO: string;
  count: number; max: number; isCancelled: boolean; spotsLeft: number;
};
type ModalTabType = 'overview' | 'clinical' | 'notes' | 'actions' | 'billing';

interface BookingsPanelProps {
  clinic: any;
  isAuthenticated: boolean;
  slotTimings: SlotTiming[];
  formatTime: (hour: number, minute: number) => string;
  allBills: (PatientBill & { patientCode?: string | null })[];
  notifHighlight: { bookingId: number; tab: string; ts: number } | null;
  tabBadges: Record<number, string[]>;
  onNavigate: (panel: string) => void;
  onViewPatient: (patientId: number) => void;
  quickFilter: QuickFilterType;
  setQuickFilter: (f: QuickFilterType | ((p: QuickFilterType) => QuickFilterType)) => void;
  filterDate: Date | undefined;
  setFilterDate: (f: Date | undefined | ((p: Date | undefined) => Date | undefined)) => void;
  filterEndDate: Date | undefined;
  setFilterEndDate: (f: Date | undefined | ((p: Date | undefined) => Date | undefined)) => void;
  setTabBadges: (f: Record<number, string[]> | ((p: Record<number, string[]>) => Record<number, string[]>)) => void;
  bookingsSectionRef: { current: HTMLDivElement | null };
  openBookingId: number | null;
  setOpenBookingId: (f: number | null | ((p: number | null) => number | null)) => void;
  modalTabs: Record<number, ModalTabType>;
  setModalTabs: (f: Record<number, ModalTabType> | ((p: Record<number, ModalTabType>) => Record<number, ModalTabType>)) => void;
}

export default function BookingsPanel({
  clinic,
  isAuthenticated,
  slotTimings,
  formatTime,
  allBills,
  notifHighlight,
  tabBadges,
  onNavigate,
  onViewPatient,
  quickFilter,
  setQuickFilter,
  filterDate,
  setFilterDate,
  filterEndDate,
  setFilterEndDate,
  bookingsSectionRef,
  openBookingId,
  setOpenBookingId,
  modalTabs,
  setModalTabs,
  setTabBadges,
}: BookingsPanelProps) {
  const [copiedUrlType, setCopiedUrlType] = useState<'booking' | 'about' | null>(null);
  const [searchOpen, setSearchOpen] = useState(true);
  const [filterRowOpen, setFilterRowOpen] = useState(false);

  const copyClinicUrl = (type: 'booking' | 'about') => {
    if (!clinic?.id) return;
    const url = type === 'booking'
      ? `${window.location.origin}/book/${clinic.id}`
      : `${window.location.origin}/clinic/${clinic.username || clinic.id}`;
    navigator.clipboard.writeText(url);
    setCopiedUrlType(type);
    notify.success("Copied to clipboard");
    setTimeout(() => setCopiedUrlType(null), 2000);
  };

  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOther, setCancelReasonOther] = useState("");

  const getModalTab = (id: number) => modalTabs[id] ?? 'overview';
  const setModalTab = (id: number, tab: 'overview' | 'clinical' | 'notes' | 'actions' | 'billing') =>
    setModalTabs(prev => ({ ...prev, [id]: tab }));

  const persistRebookValues = (data: {
    bookingName: string;
    bookingPhone: string;
    bookingEmail: string;
    bookingAge: string;
    bookingGender: string;
    bookingDescription: string;
    bookingVisitType: string;
    bookingAppointmentCategory: string;
  }) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('clinic_rebook_data', JSON.stringify(data));
    } catch {
      // ignore
    }
  };

  const [rescheduleBookingId, setRescheduleBookingId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(startOfToday());
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [consentUrls, setConsentUrls] = useState<Record<number, string>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<number, boolean>>({});
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [copiedConsentId, setCopiedConsentId] = useState<number | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const [bookingPatientSearch, setBookingPatientSearch] = useState("");
  const [bookingPatientResults, setBookingPatientResults] = useState<Patient[]>([]);
  const [bookingPatientResultsLoading, setBookingPatientResultsLoading] = useState(false);
  const [activePatientFilter, setActivePatientFilter] = useState<{ id: number; name: string; patientCode: string | null } | null>(null);
  const [patientSearchFocused, setPatientSearchFocused] = useState(false);
  const [patientSearchHighlightIdx, setPatientSearchHighlightIdx] = useState(-1);
  const patientSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patientSearchInputRef = useRef<HTMLInputElement>(null);

  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [dialogExpanded, setDialogExpanded] = useState(false);
  const [billingBooking, setBillingBooking] = useState<BookingWithSlot | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingDetails>({
    patientName: "", patientPhone: "", patientEmail: "",
    clinicName: "", clinicAddress: "", clinicPhone: "", clinicEmail: "",
    receiptNumber: "", date: "", discount: "0", tax: "0",
    paymentMethod: "Cash", transactionId: "", remarks: "",
    paymentStatus: "paid",
    existingBillId: undefined, printOnly: false,
    visitId: "", doctorName: "",
    services: [{ description: "Dental Consultation", amount: "500", category: "Consultation" }],
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayStart = startOfDay(new Date());
  const statNext7DaysEnd = addDays(todayStart, 7);
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
  const dates = useMemo(() => Array.from({ length: 14 }, (_, idx) => addDays(startOfToday(), idx)), []);

  const bookingsQueryKey = ['/api/auth/clinic/bookings', {
    filter: quickFilter,
    dateFrom: filterDate ? format(filterDate, 'yyyy-MM-dd') : undefined,
    dateTo: filterEndDate ? format(filterEndDate, 'yyyy-MM-dd') : undefined,
    patientId: activePatientFilter?.id,
  }];

  const {
    data: bookingsInfiniteData,
    isLoading: bookingsLoading,
    isError: bookingsError,
    error: bookingsErrorDetails,
    refetch: refetchBookings,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<BookingsPagedResponse>({
    queryKey: bookingsQueryKey,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ filter: quickFilter, page: String(pageParam), pageSize: '20' });
      if (filterDate) params.set('dateFrom', format(filterDate, 'yyyy-MM-dd'));
      if (filterEndDate) params.set('dateTo', format(filterEndDate, 'yyyy-MM-dd'));
      if (activePatientFilter) params.set('patientId', String(activePatientFilter.id));
      const res = await apiRequest('GET', `/api/auth/clinic/bookings?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: isAuthenticated,
    refetchOnMount: true,
    refetchInterval: quickFilter === 'today' ? 30_000 : false,
    staleTime: quickFilter === 'today' ? 30_000 : 5 * 60_000,
  });

  const bookings = useMemo(() => bookingsInfiniteData?.pages.flatMap(p => p.data) ?? [], [bookingsInfiniteData]);
  const bookingStats = bookingsInfiniteData?.pages[0]?.stats;
  const bookingsTotal = bookingsInfiniteData?.pages[0]?.total ?? 0;

  const { data: allDoctorLeaves = [] } = useQuery<{ doctorEmail?: string; doctorName?: string; leaveDate: string; reason?: string | null }[]>({
    queryKey: ['/api/clinic/doctor-leaves/all'],
    enabled: isAuthenticated,
  });

  const { data: rescheduleSlotAvailability, isFetching: rescheduleAvailFetching } = useQuery<RescheduleSlotAvailRow[]>({
    queryKey: ['reschedule-slot-availability', clinic?.id, format(rescheduleDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const payload = {
        clinicId: clinic.id,
        slots: slotTimings.map((slot, idx) => {
          const t = new Date(rescheduleDate);
          t.setHours(slot.startHour, slot.startMinute, 0, 0);
          return { slotIndex: idx, label: slot.label, startTimeISO: t.toISOString() };
        }),
      };
      const res = await apiRequest('POST', '/api/public/slot-availability', payload);
      if (!res.ok) throw new Error('Failed to fetch slot availability');
      return res.json();
    },
    enabled: !!clinic?.id && rescheduleBookingId !== null,
    staleTime: 30_000,
  });

  // Chip badge counts come from the server stats (across all pages)
  const todaysBookingsCount = bookingStats?.todayCount ?? 0;
  const futureBookingsCount = bookingStats?.upcomingCount ?? 0;
  const pastBookingsCount   = bookingStats?.pastCount ?? 0;
  const thisWeekCount       = bookingStats?.thisWeekCount ?? 0;
  const nextWeekCount       = bookingStats?.nextWeekCount ?? 0;

  // Patient-context bookings for smart empty-state hints
  // When a patient filter is active, `bookings` already only contains that patient's bookings
  const activePatientBookings = activePatientFilter && bookings ? bookings : [];

  const patientPastBk = activePatientBookings.filter(booking => {
    const bookingDate = new Date(booking.slot.startTime);
    return bookingDate < todayStart;
  });

  const patientUpcomingBk = activePatientBookings.filter(booking => {
    const bookingDate = new Date(booking.slot.startTime);
    return bookingDate >= todayStart && format(bookingDate, 'yyyy-MM-dd') !== todayStr && booking.visitStatus !== 'completed' && booking.visitStatus !== 'patient_left_early';
  });

  const patientTodayBk = activePatientBookings.filter(booking => format(new Date(booking.slot.startTime), 'yyyy-MM-dd') === todayStr);
  const patientLatestPast = [...patientPastBk].sort((a, b) => new Date(b.slot.startTime).getTime() - new Date(a.slot.startTime).getTime())[0];
  const patientNearestNext = [...patientUpcomingBk].sort((a, b) => new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime())[0];
  const patientNextWeekBk = activePatientBookings.filter(booking => {
    const bookingDate = new Date(booking.slot.startTime);
    return bookingDate >= nextWeekStart && bookingDate <= nextWeekEnd;
  });
  const patientThisWeekBk = activePatientBookings.filter(booking => {
    const bookingDate = new Date(booking.slot.startTime);
    return bookingDate >= thisWeekStart && bookingDate <= thisWeekEnd;
  });

  const filteredBookings = bookings;

  const emptyStateMeta = useMemo(() => getBookingEmptyStateMeta({
    activePatientFilter,
    activePatientBookingsCount: activePatientBookings.length,
    quickFilter,
    filterDate,
    filterEndDate,
  }), [activePatientFilter, activePatientBookings.length, quickFilter, filterDate, filterEndDate]);

  const patientHint: {
    color: 'amber' | 'blue' | 'slate';
    headline: string;
    detail: string;
    actions: { label: string; onClick: () => void }[];
  } | null = (() => {
    if (!activePatientFilter) return null;
    if ((filteredBookings?.length ?? 0) > 0) return null;

    const first = activePatientFilter.name.split(' ')[0];
    const clearAll = () => { setQuickFilter('all'); setFilterDate(undefined); setFilterEndDate(undefined); };
    const bookingCount = activePatientBookings.length;

    if (bookingCount === 0) {
      return {
        color: 'slate',
        headline: `${first} hasn't booked at this clinic yet`,
        detail: 'This patient is registered but has no appointment history here.',
        actions: [],
      };
    }

    if (quickFilter === 'today') {
      const actions: { label: string; onClick: () => void }[] = [];
      if (patientPastBk.length > 0) actions.push({ label: 'View Past Bookings', onClick: () => setQuickFilter('past') });
      if (patientUpcomingBk.length > 0) actions.push({ label: 'View Upcoming', onClick: () => setQuickFilter('upcoming') });
      if (actions.length === 0) actions.push({ label: 'View All Bookings', onClick: clearAll });
      const detail = patientLatestPast && patientNearestNext
        ? `Last visit: ${format(new Date(patientLatestPast.slot.startTime), 'MMM d')} · Next: ${format(new Date(patientNearestNext.slot.startTime), 'MMM d')}`
        : patientLatestPast
        ? `Last visit was ${format(new Date(patientLatestPast.slot.startTime), 'MMM d, yyyy')}`
        : `Next appointment: ${format(new Date(patientNearestNext!.slot.startTime), 'MMM d, yyyy')}`;
      return { color: 'amber', headline: `${first} has no booking today`, detail, actions };
    }

    if (quickFilter === 'upcoming') {
      const actions: { label: string; onClick: () => void }[] = [];
      if (patientTodayBk.length > 0) actions.push({ label: 'View Today', onClick: () => setQuickFilter('today') });
      if (patientPastBk.length > 0) actions.push({ label: 'View Past Bookings', onClick: () => setQuickFilter('past') });
      if (actions.length === 0) actions.push({ label: 'View All Bookings', onClick: clearAll });
      const detail = patientLatestPast
        ? `Last visit was ${format(new Date(patientLatestPast.slot.startTime), 'MMM d, yyyy')}`
        : 'All their appointments have been completed or cancelled.';
      return { color: 'amber', headline: `${first} has no upcoming appointments`, detail, actions };
    }

    if (quickFilter === 'past') {
      const actions: { label: string; onClick: () => void }[] = [];
      if (patientTodayBk.length > 0) actions.push({ label: 'View Today', onClick: () => setQuickFilter('today') });
      if (patientUpcomingBk.length > 0) actions.push({ label: 'View Upcoming', onClick: () => setQuickFilter('upcoming') });
      if (actions.length === 0) actions.push({ label: 'View All Bookings', onClick: clearAll });
      const detail = patientNearestNext
        ? `Next appointment: ${format(new Date(patientNearestNext.slot.startTime), 'MMM d, yyyy')}`
        : `${first} has ${bookingCount} booking(s) but none in the past.`;
      return { color: 'amber', headline: `${first} has no past appointments`, detail, actions };
    }

    if (quickFilter === 'this-week') {
      const actions: { label: string; onClick: () => void }[] = [];
      if (patientNextWeekBk.length > 0) actions.push({ label: 'Check Next Week', onClick: () => setQuickFilter('next-week') });
      if (patientUpcomingBk.length > 0) actions.push({ label: 'View Upcoming', onClick: () => setQuickFilter('upcoming') });
      else if (patientPastBk.length > 0) actions.push({ label: 'View Past', onClick: () => setQuickFilter('past') });
      if (actions.length === 0) actions.push({ label: 'View All Bookings', onClick: clearAll });
      const detail = patientNextWeekBk.length > 0
        ? `${first} has ${patientNextWeekBk.length} appointment(s) next week`
        : patientNearestNext
        ? `Next appointment: ${format(new Date(patientNearestNext.slot.startTime), 'MMM d, yyyy')}`
        : patientLatestPast
        ? `Last visit: ${format(new Date(patientLatestPast.slot.startTime), 'MMM d, yyyy')}`
        : `${bookingCount} total booking(s) — none fall this week`;
      return { color: 'amber', headline: `${first} has no appointment this week`, detail, actions };
    }

    if (quickFilter === 'next-week') {
      const actions: { label: string; onClick: () => void }[] = [];
      if (patientThisWeekBk.length > 0) actions.push({ label: 'Check This Week', onClick: () => setQuickFilter('this-week') });
      if (patientUpcomingBk.length > 0) actions.push({ label: 'View Upcoming', onClick: () => setQuickFilter('upcoming') });
      else if (patientPastBk.length > 0) actions.push({ label: 'View Past', onClick: () => setQuickFilter('past') });
      if (actions.length === 0) actions.push({ label: 'View All Bookings', onClick: clearAll });
      const detail = patientThisWeekBk.length > 0
        ? `${first} has ${patientThisWeekBk.length} appointment(s) this week`
        : patientNearestNext
        ? `Next appointment: ${format(new Date(patientNearestNext.slot.startTime), 'MMM d, yyyy')}`
        : `${bookingCount} total booking(s) — none fall next week`;
      return { color: 'amber', headline: `${first} has no appointment next week`, detail, actions };
    }

    if (filterDate) {
      const rangeLabel = filterEndDate
        ? `${format(filterDate, 'MMM d')} – ${format(filterEndDate, 'MMM d')}`
        : format(filterDate, 'MMM d, yyyy');
      return {
        color: 'amber',
        headline: `No appointment for ${first} on ${rangeLabel}`,
        detail: `${first} has ${bookingCount} total booking(s) at this clinic, but none fall in the selected range.`,
        actions: [{ label: 'Clear date filter', onClick: () => { setFilterDate(undefined); setFilterEndDate(undefined); } }],
      };
    }

    if (quickFilter === 'today-confirmed' && patientTodayBk.length > 0) {
      return {
        color: 'blue',
        headline: `${first} has a booking today but it's not yet confirmed`,
        detail: 'This view only shows confirmed appointments for today.',
        actions: [{ label: 'View Today (all statuses)', onClick: () => setQuickFilter('today') }],
      };
    }

    if (quickFilter === 'pending-7days') {
      const hasConfirmedUpcoming = patientUpcomingBk.some(b => b.verificationStatus === 'confirmed' || !!(b as any).confirmedBy);
      if (hasConfirmedUpcoming) {
        return {
          color: 'blue',
          headline: `${first}'s upcoming bookings are already confirmed`,
          detail: 'This view shows only unconfirmed bookings in the next 7 days.',
          actions: [{ label: 'View Upcoming', onClick: () => setQuickFilter('upcoming') }],
        };
      }
    }

    if (quickFilter === 'confirmed-7days') {
      return {
        color: 'blue',
        headline: `${first} has no confirmed bookings in the next 7 days`,
        detail: `They have ${bookingCount} booking(s) total. Some may still be awaiting confirmation.`,
        actions: [
          { label: 'View Upcoming', onClick: () => setQuickFilter('upcoming') },
          { label: 'View All Bookings', onClick: clearAll },
        ],
      };
    }

    if (quickFilter === 'all-pending') {
      return {
        color: 'blue',
        headline: `${first}'s bookings are all confirmed`,
        detail: 'This view only shows unconfirmed bookings.',
        actions: [{ label: 'View All Bookings', onClick: clearAll }],
      };
    }

    return {
      color: 'amber',
      headline: `${first} has ${bookingCount} booking(s) but none match this filter`,
      detail: 'Clear all filters to see their full appointment history.',
      actions: [{ label: 'View All Bookings', onClick: clearAll }],
    };
  })();
  // ─────────────────────────────────────────────────────────────────────────

  const bookingNumber = (booking: BookingWithSlot) => {
    if (!filteredBookings.length) return "0";
    return getBookingNumber({ booking, bookings: filteredBookings });
  };

  const statusGroup = (booking: BookingWithSlot) => {
    return getBookingDisplayMeta({ booking, todayStart, todayStr }).group;
  };

  const getActionState = (booking: BookingWithSlot) => getBookingActionState({ booking });

  const handleOpenBilling = async (booking: BookingWithSlot, existingBill?: PatientBill) => {
    setBillingBooking(booking);
    const receiptDate = format(new Date(), "yyyyMMdd");
    let resolvedBill: PatientBill | undefined = existingBill;
    if (!resolvedBill) {
      try {
        const billsRes = await apiRequest("GET", `/api/auth/clinic/bills/booking/${booking.id}`);
        const bookingBills: PatientBill[] = billsRes.ok ? await billsRes.json() : [];
        resolvedBill = bookingBills.find(b => b.paymentStatus !== "paid") ?? bookingBills[0];
      } catch {}
    }
    let loadedServices: { description: string; amount: string }[];
    let loadedRemarks = resolvedBill?.notes || "";
    if (resolvedBill?.services) {
      loadedServices = (resolvedBill.services as any[]).map(s => ({
        description: (s.medicine || s.description || ""),
        amount: String(s.amount ?? 0),
        category: s.category,
        dosage: s.dosage || "",
        frequency: s.frequency || "",
        duration: s.duration || "",
        qty: s.qty ?? 1,
        unitPrice: s.unitPrice,
      }));
    } else {
      try {
        const res = await apiRequest("GET", `/api/clinical-records/booking/${booking.id}`);
        const records: { diagnosis: string[]; prescription?: string; notes?: string }[] = await res.json();
        const record = records?.[0];
        const diagnoses: string[] = record?.diagnosis ?? [];
        if (diagnoses.length > 0) {
          loadedServices = diagnoses.map(d => ({ description: d, amount: "0" }));
        } else {
          loadedServices = [{ description: "Dental Consultation", amount: "500" }];
        }
        const parts: string[] = [];
        if (record?.prescription) {
          try {
            const rxRows = JSON.parse(record.prescription);
            if (Array.isArray(rxRows) && rxRows[0]?.name) {
              parts.push(`Rx: ${rxRows.map((r: any) => `${r.name} ${r.dosage} ${r.qty} ${r.frequency} × ${r.duration}`.trim()).join('; ')}`);
            } else {
              parts.push(`Rx: ${record.prescription}`);
            }
          } catch { parts.push(`Rx: ${record.prescription}`); }
        }
        if ((booking as any).doctorNotes) parts.push(`Notes: ${(booking as any).doctorNotes}`);
        if (parts.length > 0) loadedRemarks = parts.join(" | ");
      } catch {
        loadedServices = [{ description: "Dental Consultation", amount: "500" }];
      }
    }
    setBillingDetails({
      patientName: booking.customerName,
      patientPhone: booking.customerPhone,
      patientEmail: booking.customerEmail || "",
      clinicName: clinic?.name || "",
      clinicAddress: (clinic as any)?.address || "",
      clinicPhone: (clinic as any)?.phone || "",
      clinicEmail: (clinic as any)?.email || "",
      receiptNumber: resolvedBill?.billNumber || `RCP-${booking.id}-${receiptDate}`,
      services: loadedServices,
      date: format(new Date(booking.slot.startTime), "PPP"),
      discount: String(resolvedBill?.discountPct ?? 0),
      tax: String(resolvedBill?.taxPct ?? 0),
      paymentMethod: resolvedBill?.paymentMethod || "Cash",
      transactionId: "",
      remarks: loadedRemarks,
      paymentStatus: (resolvedBill?.paymentStatus as "paid" | "pending" | "partial") || "paid",
      existingBillId: resolvedBill?.id,
      printOnly: false,
      visitId: String(booking.id),
      doctorName: (booking as any).assignedDoctor || "",
    });
    setIsBillingOpen(true);
  };

  const handleConsolidatedBilling = (booking: BookingWithSlot, bills: PatientBill[]) => {
    setBillingBooking(booking);
    const firstBill = bills[0];
    const dateLabel = firstBill?.createdAt ? format(new Date(firstBill.createdAt), "yyyyMMdd") : format(new Date(), "yyyyMMdd");
    const mergedServices = bills.flatMap(bill =>
      ((bill.services ?? []) as any[]).map(s => ({
        description: (s.medicine || s.description || ""),
        amount: String(s.amount ?? 0),
        category: s.category,
        dosage: s.dosage || "",
        frequency: s.frequency || "",
        duration: s.duration || "",
        qty: s.qty ?? 1,
        unitPrice: s.unitPrice,
      }))
    );
    const allPaid = bills.every(b => b.paymentStatus === "paid");
    const anyPartial = bills.some(b => b.paymentStatus === "partial");
    const details: BillingDetails = {
      patientName: booking.customerName,
      patientPhone: booking.customerPhone,
      patientEmail: booking.customerEmail || "",
      clinicName: (clinic as any)?.name || "",
      clinicAddress: (clinic as any)?.address || "",
      clinicPhone: (clinic as any)?.phone || "",
      clinicEmail: (clinic as any)?.email || "",
      receiptNumber: `CONSOL-${booking.id}-${dateLabel}`,
      services: mergedServices.length > 0 ? mergedServices : [{ description: "Dental Consultation", amount: "500", category: "Consultation" }],
      date: firstBill?.createdAt ? format(new Date(firstBill.createdAt), "PPP") : format(new Date(booking.slot.startTime), "PPP"),
      discount: String(firstBill?.discountPct ?? 0),
      tax: String(firstBill?.taxPct ?? 0),
      paymentMethod: firstBill?.paymentMethod || "Cash",
      transactionId: "",
      remarks: bills.map(b => b.notes).filter(Boolean).join(" | ") || "",
      paymentStatus: allPaid ? "paid" : anyPartial ? "partial" : "pending",
      existingBillId: undefined,
      printOnly: true,
      visitId: String(booking.id),
      doctorName: (booking as any).assignedDoctor || "",
    };
    generateReceiptPDF(details);
  };

  const addServiceRow = () => {
    setBillingDetails(prev => ({ ...prev, services: [...prev.services, { description: "", amount: "" }] }));
  };

  const removeServiceRow = (index: number) => {
    if (billingDetails.services.length <= 1) return;
    setBillingDetails(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== index) }));
  };

  const updateService = (index: number, field: "description" | "amount", value: string) => {
    setBillingDetails(prev => ({ ...prev, services: prev.services.map((s, i) => i === index ? { ...s, [field]: value } : s) }));
  };

  const generatePDF = () => {
    if (!billingBooking) return;
    generateReceiptPDF(billingDetails);
    if (!billingDetails.printOnly) {
      const _saveSub = billingDetails.services.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const _saveDiscPct = parseFloat(billingDetails.discount) || 0;
      const _saveTaxPct = parseFloat(billingDetails.tax) || 0;
      const _saveDiscAmt = _saveSub * (_saveDiscPct / 100);
      const _saveTaxAmt = (_saveSub - _saveDiscAmt) * (_saveTaxPct / 100);
      const _saveTot = _saveSub - _saveDiscAmt + _saveTaxAmt;
      const _billPayload = {
        bookingId: billingBooking.id,
        patientId: (billingBooking as any).patientId ?? null,
        billNumber: billingDetails.receiptNumber,
        patientName: billingDetails.patientName,
        patientPhone: billingDetails.patientPhone,
        patientEmail: billingDetails.patientEmail,
        services: billingDetails.services.map(s => ({
          description: s.description,
          category: s.category || "General",
          amount: parseFloat(s.amount) || 0,
          paid: billingDetails.paymentStatus === "paid",
          dosage: s.dosage,
          frequency: s.frequency,
          duration: s.duration,
          qty: s.qty,
          unitPrice: s.unitPrice,
        })),
        subtotal: _saveSub,
        discountPct: _saveDiscPct,
        taxPct: _saveTaxPct,
        total: _saveTot,
        paymentMethod: billingDetails.paymentMethod || "Cash",
        paymentStatus: billingDetails.paymentStatus || "paid",
        notes: billingDetails.remarks || null,
      };
      const _saveReq = billingDetails.existingBillId
        ? apiRequest("PATCH", `/api/auth/clinic/bills/${billingDetails.existingBillId}`, _billPayload)
        : apiRequest("POST", "/api/auth/clinic/bills", _billPayload);
      _saveReq.then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills/booking", billingBooking.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills"] });
      });
    }
    setIsBillingOpen(false);
    notify.success("Receipt Downloaded", { description: billingDetails.printOnly ? "Consolidated PDF downloaded." : "PDF downloaded and saved to billing history." });
  };

  const fetchBookingPatientSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setBookingPatientResults([]); return; }
    setBookingPatientResultsLoading(true);
    try {
      const res = await apiRequest('GET', `/api/auth/clinic/patients/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setBookingPatientResults(await res.json());
      else setBookingPatientResults([]);
    } catch { setBookingPatientResults([]); }
    finally { setBookingPatientResultsLoading(false); }
  }, []);

  const handleBookingPatientSearchInput = (val: string) => {
    setBookingPatientSearch(val);
    setPatientSearchHighlightIdx(-1);
    if (!val.trim()) { setBookingPatientResults([]); return; }
    if (patientSearchDebounceRef.current) clearTimeout(patientSearchDebounceRef.current);
    patientSearchDebounceRef.current = setTimeout(() => fetchBookingPatientSearch(val.trim()), 250);
  };

  const applyBookingPatientFilter = (p: Patient) => {
    setActivePatientFilter({ id: p.id, name: p.name, patientCode: p.patientCode ?? null });
    setBookingPatientSearch("");
    setBookingPatientResults([]);
    setPatientSearchFocused(false);
    setPatientSearchHighlightIdx(-1);
  };

  const clearBookingPatientFilter = () => {
    setActivePatientFilter(null);
    setBookingPatientSearch("");
    setBookingPatientResults([]);
    setPatientSearchHighlightIdx(-1);
  };

  const cancelBookingMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      setCancellingBookingId(id);
      const res = await apiRequest('DELETE', `/api/auth/clinic/bookings/${id}`, { reason });
      if (!res.ok) throw new Error('Failed to cancel booking');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinic/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Booking cancelled");
      setCancellingBookingId(null);
      setCancelReason("");
      setCancelReasonOther("");
    },
    onError: () => {
      notify.error("Failed to cancel booking");
      setCancellingBookingId(null);
    },
  });

  const assignDoctorMutation = useMutation({
    mutationFn: async ({ bookingId, doctorName, doctorEmail }: { bookingId: number; doctorName: string; doctorEmail?: string }) => {
      const response = await apiRequest('PATCH', `/api/clinic/bookings/${bookingId}/assign-doctor`, { doctorName, doctorEmail });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Doctor assigned");
    },
    onError: (error: any) => { notify.apiError(error, "Failed to assign doctor"); },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ bookingId, newSlotId }: { bookingId: number; newSlotId: number }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/reschedule`, { newSlotId });
      if (!response.ok) throw new Error('Failed to reschedule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      setRescheduleBookingId(null);
      setRescheduleSlot(null);
      notify.success("Booking rescheduled");
    },
    onError: (error: any) => { notify.apiError(error, "Failed to reschedule booking"); },
  });

  const updateClinicalStatusMutation = useMutation({
    mutationFn: async ({ bookingId, clinicalStatus }: { bookingId: number; clinicalStatus: string | null }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/clinical-status`, { clinicalStatus });
      if (!response.ok) throw new Error('Failed to update clinical status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Clinical status updated");
    },
    onError: (error: any) => { notify.apiError(error, "Failed to update clinical status"); },
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ bookingId, undo }: { bookingId: number; undo?: boolean }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/checkin`, { undo: !!undo });
      if (!response.ok) throw new Error('Failed to update check-in status');
      return response.json();
    },
    onSuccess: (_data, { undo }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success(undo ? "Check-in undone" : "Patient marked as arrived");
    },
    onError: (error: any) => notify.apiError(error, "Failed to update check-in"),
  });

  const completeVisitMutation = useMutation({
    mutationFn: async ({ bookingId, note }: { bookingId: number; note?: string }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/complete-visit`, { note });
      if (!response.ok) throw new Error('Failed to complete visit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Visit marked as complete");
    },
    onError: (error: any) => notify.apiError(error, "Failed to complete visit"),
  });

  const noShowMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: number; reason?: string }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/no-show`, { reason });
      if (!response.ok) throw new Error('Failed to mark no-show');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Marked as no-show");
    },
    onError: (error: any) => notify.apiError(error, "Failed to mark no-show"),
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/send-reminder`, {});
      if (!response.ok) throw new Error('Failed to send reminder');
      return response.json();
    },
    onSuccess: () => { notify.success("Reminder sent", { description: "WhatsApp message sent to patient." }); },
    onError: (error: any) => notify.apiError(error, "Failed to send reminder"),
  });

  const overrideCompleteMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: number; reason: string }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/override-complete`, { reason });
      if (!response.ok) throw new Error('Failed to override complete');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Visit marked as complete (override)");
    },
    onError: (error: any) => notify.apiError(error, "Failed to override complete"),
  });

  const patientLeftEarlyMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: number; reason: string }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/patient-left-early`, { reason });
      if (!response.ok) throw new Error('Failed to mark patient left early');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Recorded — patient left before completion");
    },
    onError: (error: any) => notify.apiError(error, "Failed to record early departure"),
  });

  const requestConsentMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('POST', `/api/auth/clinic/bookings/${bookingId}/request-consent`, {});
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to send consent request');
      }
      return response.json() as Promise<{ consentUrl: string }>;
    },
    onSuccess: (data, bookingId) => {
      setConsentUrls(prev => ({ ...prev, [bookingId]: data.consentUrl }));
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Consent request sent", { description: "WhatsApp link sent to the patient." });
    },
    onError: (error: any) => { notify.apiError(error, "Failed to send consent request"); },
  });

  const confirmBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/confirm`, {});
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to confirm booking');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'], exact: false });
      notify.success("Booking Confirmed", { description: "A confirmation email has been sent to the patient." });
    },
    onError: (error: any) => { notify.apiError(error, "Failed to confirm booking"); },
  });

  const todayConfirmedCount = bookingStats?.todayConfirmedCount ?? 0;
  const pendingNext7Count   = bookingStats?.pendingNext7Count ?? 0;
  const totalPendingCount   = bookingStats?.totalPendingCount ?? 0;
  const confirmedNext7Count = bookingStats?.confirmedNext7Count ?? 0;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
          <div className="space-y-5" ref={bookingsSectionRef}>
        {/* Panel header */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex">
            <div className="w-1.5 bg-sky-500/60 shrink-0" />
            <div className="flex-1 px-5 py-4 bg-gradient-to-r from-sky-500/[0.06] to-transparent flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <CalendarIcon className="h-[18px] w-[18px] text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Bookings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage all patient appointments</p>
              </div>
            </div>
          </div>
        </div>
        {/* Quick-filter chips + inline search — single unified row */}
        <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2">
          {/* Today */}
          <button
            onClick={() => { setFilterDate(undefined); setFilterEndDate(undefined); setQuickFilter(q => q === 'today' ? 'all' : 'today'); }}
            className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
              quickFilter === 'today'
                ? 'bg-sky-500/10 border-sky-400/50 text-sky-700 dark:text-sky-400'
                : 'bg-transparent border-sky-400/30 text-muted-foreground hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-400'
            }`}
            data-testid="chip-filter-today"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Today</span>
            </span>
            <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
              quickFilter === 'today' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400' : 'bg-muted text-muted-foreground'
            }`}>{todaysBookingsCount}</span>
          </button>

          {/* Upcoming */}
          <button
            onClick={() => { setFilterDate(undefined); setFilterEndDate(undefined); setQuickFilter(q => q === 'upcoming' ? 'all' : 'upcoming'); }}
            className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
              quickFilter === 'upcoming'
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-transparent border-primary/30 text-muted-foreground hover:bg-primary/10 hover:text-primary'
            }`}
            data-testid="chip-filter-upcoming"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Upcoming</span>
            </span>
            <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
              quickFilter === 'upcoming' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}>{futureBookingsCount}</span>
          </button>

          {/* Past */}
          <button
            onClick={() => { setFilterDate(undefined); setFilterEndDate(undefined); setQuickFilter(q => q === 'past' ? 'all' : 'past'); }}
            className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
              quickFilter === 'past'
                ? 'bg-slate-500/10 border-slate-400/40 text-slate-600 dark:text-slate-400'
                : 'bg-transparent border-slate-400/30 text-muted-foreground hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-slate-400'
            }`}
            data-testid="chip-filter-past"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Past</span>
            </span>
            <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
              quickFilter === 'past' ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400' : 'bg-muted text-muted-foreground'
            }`}>{pastBookingsCount}</span>
          </button>

          {/* All Bookings */}
          <button
            onClick={() => { setQuickFilter('all'); setFilterDate(undefined); setFilterEndDate(undefined); }}
            className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
              quickFilter === 'all'
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-transparent border-primary/30 text-muted-foreground hover:bg-primary/10 hover:text-primary'
            }`}
            data-testid="chip-filter-all"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">All Bookings</span>
            </span>
            <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
              quickFilter === 'all' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}>{bookingStats?.totalAllCount ?? 0}</span>
          </button>

          {/* Search slot — magnifier, expanded input, or active-patient chip */}
          <div className="relative w-full sm:flex-1">
            {activePatientFilter ? (
              /* Active patient filter chip */
              <div className="flex items-center gap-2.5 bg-card border border-primary/40 rounded-xl px-3 min-h-[44px] shadow-sm ring-1 ring-primary/10">
                <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-primary" />
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">{activePatientFilter.name}</span>
                  {activePatientFilter.patientCode && (
                    <span className="font-mono text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1.5 py-0.5 rounded-md shrink-0">
                      {activePatientFilter.patientCode}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/70 shrink-0">
                    · {filteredBookings?.length ?? 0} booking{(filteredBookings?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={clearBookingPatientFilter}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 active:scale-[0.97]"
                  data-testid="button-clear-patient-filter"
                  title="Clear patient filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : searchOpen ? (
              /* Expanded search input + filter/legend icons when collapsed */
              <div className="flex items-center gap-1.5">
                <div className={`flex-1 flex items-center gap-2.5 bg-card border rounded-xl px-3 min-h-[44px] shadow-sm transition-all duration-150 ${
                  patientSearchFocused
                    ? 'border-primary/50 ring-1 ring-primary/20 shadow-md'
                    : 'border-border/50 hover:border-border'
                }`}>
                  {bookingPatientResultsLoading
                    ? <Loader2 className="h-3.5 w-3.5 text-primary shrink-0 animate-spin" />
                    : <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  }
                  <input
                    ref={patientSearchInputRef}
                    type="text"
                    value={bookingPatientSearch}
                    onChange={e => handleBookingPatientSearchInput(e.target.value)}
                    onFocus={() => setPatientSearchFocused(true)}
                    onBlur={() => setTimeout(() => { setPatientSearchFocused(false); setPatientSearchHighlightIdx(-1); }, 160)}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setPatientSearchHighlightIdx(i => Math.min(i + 1, bookingPatientResults.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setPatientSearchHighlightIdx(i => Math.max(i - 1, -1));
                      } else if (e.key === 'Enter' && patientSearchHighlightIdx >= 0 && bookingPatientResults[patientSearchHighlightIdx]) {
                        e.preventDefault();
                        applyBookingPatientFilter(bookingPatientResults[patientSearchHighlightIdx]);
                      } else if (e.key === 'Escape') {
                        setBookingPatientSearch("");
                        setBookingPatientResults([]);
                        setPatientSearchFocused(false);
                        setSearchOpen(false);
                        patientSearchInputRef.current?.blur();
                      }
                    }}
                    placeholder="Search patient — name, PAT code, phone or email…"
                    className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/55 outline-none border-none focus:ring-0 h-5 leading-none"
                    data-testid="input-booking-patient-search"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    onMouseDown={e => {
                      e.preventDefault();
                      setBookingPatientSearch("");
                      setBookingPatientResults([]);
                      setSearchOpen(false);
                    }}
                    className="shrink-0 -mr-1 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    title="Close search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {!filterRowOpen && (
                  <button
                    onClick={() => setFilterRowOpen(true)}
                    className="h-11 w-11 rounded-xl border bg-muted/50 border-border flex items-center justify-center hover:border-primary/40 hover:text-primary transition-all active:scale-[0.97] shrink-0"
                    data-testid="button-open-filter-row"
                    title="Show date & week filters"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {legendCollapsed && (
                  <button
                    onClick={() => setLegendCollapsed(false)}
                    title="Show colour legend"
                    className="h-11 w-11 rounded-xl border bg-muted/50 border-border flex flex-col items-center justify-center gap-[5px] hover:border-primary/40 hover:bg-muted/80 transition-all active:scale-[0.97] shrink-0"
                  >
                    <div className="flex items-center gap-[3px]">
                      <span className="h-[2.5px] w-[5px] rounded-full bg-sky-400 shrink-0" />
                      <span className="h-[2.5px] w-[5px] rounded-full bg-primary shrink-0" />
                      <span className="h-[2.5px] w-[5px] rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                    </div>
                    <div className="flex items-end gap-[3px]">
                      <span className="h-[9px] w-[5px] rounded-sm bg-emerald-400 shrink-0" />
                      <span className="h-[9px] w-[5px] rounded-sm bg-amber-400 shrink-0" />
                      <span className="h-[9px] w-[5px] rounded-sm bg-rose-400 shrink-0" />
                    </div>
                  </button>
                )}
              </div>
            ) : (
              /* Collapsed — magnifier + optional filter icon + legend toggle */
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setSearchOpen(true); setTimeout(() => patientSearchInputRef.current?.focus(), 50); }}
                  className="h-11 w-11 rounded-xl border bg-muted/50 border-border flex items-center justify-center hover:border-primary/40 hover:text-primary transition-all active:scale-[0.97]"
                  data-testid="button-open-patient-search"
                  title="Search patient"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                </button>
                {!filterRowOpen && (
                  <button
                    onClick={() => setFilterRowOpen(true)}
                    className="h-11 w-11 rounded-xl border bg-muted/50 border-border flex items-center justify-center hover:border-primary/40 hover:text-primary transition-all active:scale-[0.97]"
                    data-testid="button-open-filter-row"
                    title="Show date & week filters"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {/* Legend toggle — mini coloured-lines icon; only when legend is hidden */}
                {legendCollapsed && (
                  <button
                    onClick={() => setLegendCollapsed(false)}
                    title="Show colour legend"
                    className="h-11 w-11 rounded-xl border bg-muted/50 border-border flex flex-col items-center justify-center gap-[5px] hover:border-primary/40 hover:bg-muted/80 transition-all active:scale-[0.97]"
                  >
                    {/* Row 1: WHEN — horizontal dashes (3 × 5px = 21px total) */}
                    <div className="flex items-center gap-[3px]">
                      <span className="h-[2.5px] w-[5px] rounded-full bg-sky-400 shrink-0" />
                      <span className="h-[2.5px] w-[5px] rounded-full bg-primary shrink-0" />
                      <span className="h-[2.5px] w-[5px] rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                    </div>
                    {/* Row 2: STATUS — vertical bars (3 × 5px = 21px total) */}
                    <div className="flex items-end gap-[3px]">
                      <span className="h-[9px] w-[5px] rounded-sm bg-emerald-400 shrink-0" />
                      <span className="h-[9px] w-[5px] rounded-sm bg-amber-400 shrink-0" />
                      <span className="h-[9px] w-[5px] rounded-sm bg-rose-400 shrink-0" />
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Dropdown results */}
            {patientSearchFocused && !activePatientFilter && (
              <>
                {bookingPatientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-border/70 rounded-xl shadow-2xl overflow-hidden">
                    {bookingPatientResults.map((p, i) => (
                      <button
                        key={p.id}
                        onMouseDown={e => { e.preventDefault(); applyBookingPatientFilter(p); }}
                        onMouseEnter={() => setPatientSearchHighlightIdx(i)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors border-b border-border/30 last:border-0 ${
                          i === patientSearchHighlightIdx ? 'bg-primary/10' : 'hover:bg-muted/60'
                        }`}
                        data-testid={`result-patient-${p.id}`}
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-xs text-primary">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">{p.name}</span>
                            {p.patientCode && (
                              <span className="font-mono text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1 py-0.5 rounded-md leading-none">
                                {p.patientCode}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.phone && (
                              <span className="text-xs text-muted-foreground">
                                ••••• {p.phone.slice(-4)}
                              </span>
                            )}
                            {p.phone && p.email && <span className="text-muted-foreground/30">·</span>}
                            {p.email && (
                              <span className="text-xs text-muted-foreground truncate max-w-[160px]">{p.email}</span>
                            )}
                          </div>
                        </div>
                        {(p.visitCount ?? 0) > 0 && (
                          <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0 tabular-nums">
                            {p.visitCount}v
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {bookingPatientSearch.length >= 2 && !bookingPatientResultsLoading && bookingPatientResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-border/70 rounded-xl shadow-2xl px-4 py-3.5 text-center">
                    <p className="text-xs text-muted-foreground">
                      No patients found for{" "}
                      <span className="font-semibold text-foreground">"{bookingPatientSearch}"</span>
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Try a different name, phone, email or PAT code</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Date range + Quick week — collapsible filter row */}
        {filterRowOpen && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 bg-card border border-border/50 rounded-xl px-3 py-3 shadow-sm">

            {/* Desktop-only: icon + label */}
            <div className="hidden sm:flex sm:flex-none items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground shrink-0">Date range:</span>
            </div>

            {/* Mobile row 1: Start + End + × all inline | Desktop: Start → End flow naturally */}
            <div className="flex items-center gap-2 sm:contents">

              {/* Start picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 sm:flex-none h-11 sm:h-auto min-h-[44px] px-2.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${
                      filterDate
                        ? 'border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 active:bg-primary/15'
                        : 'border-border/60 text-muted-foreground bg-background hover:border-primary/40 hover:text-foreground active:bg-muted/50'
                    }`}
                  >
                    <CalendarIcon className="h-3 w-3 mr-1.5 shrink-0" />
                    {filterDate ? format(filterDate, "MMM d") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                  <Calendar mode="single" selected={filterDate} onSelect={(d) => { setQuickFilter('all'); setFilterDate(d); }} initialFocus />
                </PopoverContent>
              </Popover>

              {/* Desktop-only: → arrow */}
              <span className="hidden sm:inline text-muted-foreground/40 text-xs shrink-0">→</span>

              {/* End picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!filterDate}
                    className={`flex-1 sm:flex-none h-11 sm:h-auto min-h-[44px] px-2.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${
                      filterEndDate
                        ? 'border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 active:bg-primary/15'
                        : 'border-border/60 text-muted-foreground bg-background hover:border-primary/40 hover:text-foreground active:bg-muted/50'
                    }`}
                  >
                    <CalendarIcon className="h-3 w-3 mr-1.5 shrink-0" />
                    {filterEndDate ? format(filterEndDate, "MMM d") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                  <Calendar mode="single" selected={filterEndDate} onSelect={(d) => { setQuickFilter('all'); setFilterEndDate(d); }} initialFocus />
                </PopoverContent>
              </Popover>

              {/* Close × — mobile: right of End picker | desktop: hidden here (rendered below at ml-auto) */}
              <button
                onClick={() => setFilterRowOpen(false)}
                className="sm:hidden h-11 w-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-all active:scale-[0.97] shrink-0"
                data-testid="button-close-filter-row"
                title="Hide date & week filters"
              >
                <X className="h-4 w-4" />
              </button>

            </div>

            {/* Clear dates — full-width on mobile, inline on desktop */}
            {(filterDate || filterEndDate) && (
              <div className="flex items-center gap-1.5 sm:contents">
                <div className="w-px h-4 bg-border/50 shrink-0 hidden sm:block" />
                <button
                  onClick={() => { setFilterDate(undefined); setFilterEndDate(undefined); }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1 h-11 sm:h-auto min-h-[44px] px-2.5 text-xs font-semibold text-muted-foreground hover:text-destructive active:text-destructive rounded-lg border border-transparent hover:border-destructive/30 active:border-destructive/40 bg-background transition-all active:scale-[0.97]"
                  data-testid="button-clear-date-filter"
                >
                  <X className="h-3 w-3" />
                  Clear dates
                </button>
              </div>
            )}

            {/* Desktop-only divider */}
            <div className="hidden sm:block w-px h-4 bg-border/40 mx-0.5 shrink-0" />

            {/* Mobile row 2: This Week + Next Week | Desktop: inline */}
            <div className="grid grid-cols-2 gap-2 sm:contents">

              {/* This Week */}
              <TooltipProvider delayDuration={700}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setFilterDate(undefined); setFilterEndDate(undefined); setQuickFilter(q => q === 'this-week' ? 'all' : 'this-week'); }}
                      data-testid="chip-filter-this-week"
                      className={`w-full h-11 sm:w-auto sm:h-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 min-h-[44px] rounded-full border transition-all active:scale-[0.97] ${
                        quickFilter === 'this-week'
                          ? 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-400/50'
                          : 'bg-background text-muted-foreground border-violet-400/30 hover:text-violet-600 active:bg-violet-500/10'
                      }`}
                    >
                      <CalendarIcon className="h-3 w-3 shrink-0" />
                      This Week
                      <span className={`text-xs font-bold px-1 py-0.5 rounded-full ${quickFilter === 'this-week' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-400' : 'bg-violet-500/10 text-violet-600'}`}>
                        {thisWeekCount}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                    Bookings falling within the current Mon–Sun week
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Next Week */}
              <TooltipProvider delayDuration={700}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setFilterDate(undefined); setFilterEndDate(undefined); setQuickFilter(q => q === 'next-week' ? 'all' : 'next-week'); }}
                      data-testid="chip-filter-next-week"
                      className={`w-full h-11 sm:w-auto sm:h-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 min-h-[44px] rounded-full border transition-all active:scale-[0.97] ${
                        quickFilter === 'next-week'
                          ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-400/50'
                          : 'bg-background text-muted-foreground border-indigo-400/30 hover:text-indigo-600 active:bg-indigo-500/10'
                      }`}
                    >
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      Next Week
                      <span className={`text-xs font-bold px-1 py-0.5 rounded-full ${quickFilter === 'next-week' ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400' : 'bg-indigo-500/10 text-indigo-600'}`}>
                        {nextWeekCount}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                    Bookings falling within next Mon–Sun week
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

            </div>

            {/* Clear week — full-width on mobile, inline on desktop */}
            {(quickFilter === 'this-week' || quickFilter === 'next-week') && (
              <button
                onClick={() => setQuickFilter('all')}
                className="w-full sm:w-auto h-11 sm:h-auto inline-flex items-center justify-center gap-1 min-h-[44px] px-2.5 text-xs font-semibold text-muted-foreground hover:text-destructive active:text-destructive rounded-lg border border-transparent hover:border-destructive/30 active:border-destructive/40 bg-background transition-all active:scale-[0.97]"
                data-testid="button-clear-week-filter"
              >
                <X className="h-3 w-3" />
                Clear week
              </button>
            )}

            {/* Desktop-only close × at far right */}
            <div className="hidden sm:flex sm:ml-auto">
              <button
                onClick={() => setFilterRowOpen(false)}
                className="h-11 w-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-all active:scale-[0.97] shrink-0"
                title="Hide date & week filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

          </div>
        )}

        {/* Bookings Section */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden flex flex-col">

          {/* Bookings header */}
          <div className="bg-gradient-to-r from-primary to-accent px-5 py-4 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {quickFilter === 'today' ? "Today's Bookings"
                  : quickFilter === 'upcoming' ? "Upcoming Bookings"
                  : quickFilter === 'past' ? "Past Bookings"
                  : quickFilter === 'this-week' ? "This Week"
                  : quickFilter === 'next-week' ? "Next Week"
                  : quickFilter === 'today-confirmed' ? "Confirmed Bookings Today"
                  : quickFilter === 'pending-7days' ? "Pending Confirmations (Next 7 Days)"
                  : quickFilter === 'all-pending' ? "All Pending Bookings"
                  : quickFilter === 'confirmed-7days' ? "Confirmed Bookings (Next 7 Days)"
                  : filterDate ? "Filtered Bookings"
                  : "Bookings"}
              </h2>
              <p className="text-white/70 text-xs mt-0.5">
                {quickFilter === 'today' ? "Appointments for today"
                  : quickFilter === 'upcoming' ? "Future appointments"
                  : quickFilter === 'past' ? "Previous appointments"
                  : quickFilter === 'this-week' ? "Appointments Mon – Sun"
                  : quickFilter === 'next-week' ? "Appointments for next week"
                  : quickFilter === 'today-confirmed' ? "Confirmed appointments scheduled for today"
                  : quickFilter === 'pending-7days' ? "Pending confirmations in the next 7 days"
                  : quickFilter === 'all-pending' ? "All unconfirmed bookings across all dates"
                  : quickFilter === 'confirmed-7days' ? "Confirmed appointments in the next 7 days"
                  : filterDate ? "Showing custom date range"
                  : "All patient appointments"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("export-data")}
              className="gap-2 text-white/80 hover:text-white hover:bg-white/15 border border-white/20 text-xs"
              data-testid="button-go-to-export"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </Button>
          </div>

        <div className="p-5 space-y-5">
        {/* ── Colour key: ─ horizontal dash = accentBar (top header strip)  │ vertical bar = left border ── */}
        {!bookingsLoading && (filteredBookings?.length ?? 0) > 0 && !legendCollapsed && (
          <div className="border border-border/40 rounded-lg bg-muted/20 px-3 py-2">

            {/* ── Mobile layout: 4-col grid for exact vertical alignment ── */}
            <div className="grid grid-cols-[46px_1fr_1fr_1fr] gap-x-2 gap-y-1.5 items-center sm:hidden">
              {/* STATUS row 1: label | Confirmed | Pending | Cancelled */}
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/50">Status</span>
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 min-w-0 cursor-default">
                      <span className="h-4 w-[4px] rounded-sm shrink-0 bg-emerald-400" />
                      <span className="text-xs font-medium text-emerald-500 truncate">Confirmed</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[160px] text-center">Confirmed · Visit Completed</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="flex items-center gap-1 min-w-0">
                <span className="h-4 w-[4px] rounded-sm shrink-0 bg-amber-400" />
                <span className="text-xs font-medium text-amber-500 truncate">Pending</span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="h-4 w-[4px] rounded-sm shrink-0 bg-rose-400" />
                <span className="text-xs font-medium text-rose-500 truncate">Cancelled</span>
              </div>
              {/* STATUS row 2: empty | No Show | In Consult | empty */}
              <span />
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 min-w-0 cursor-default">
                      <span className="h-4 w-[4px] rounded-sm shrink-0 bg-slate-400" />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">No Show</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[160px] text-center">No Show · Left Early</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 min-w-0 cursor-default">
                      {/* Ring swatch — matches full-border card treatment for active visit states */}
                      <span className="h-4 w-4 rounded-sm shrink-0 border-2 border-violet-500 bg-transparent" />
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-400 truncate">In Consult</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">Checked In · In Consult · Treatment in Progress</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span />
              {/* WHEN row — always visible so top-bar colour is explained on every filter */}
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/50">When</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="h-[5px] w-5 rounded-sm shrink-0 bg-sky-400" />
                <span className="text-xs font-medium text-sky-500 truncate">Today</span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="h-[5px] w-5 rounded-sm shrink-0 bg-primary" />
                <span className="text-xs font-medium text-primary truncate">Upcoming</span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="h-[5px] w-5 rounded-sm shrink-0 bg-slate-300 dark:bg-slate-500" />
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate">Past</span>
              </div>
            </div>

            {/* ── Desktop layout: single flex row ── */}
            <div className="hidden sm:flex sm:items-center sm:gap-x-3 group">
              <div className="flex items-center gap-x-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/50 shrink-0">Status</span>
                {/* Confirmed — merges Visit Completed */}
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 shrink-0 cursor-default">
                        <span className="h-4 w-[4px] rounded-sm shrink-0 bg-emerald-400" />
                        <span className="text-xs font-medium text-emerald-500">Confirmed</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[160px] text-center">Confirmed · Visit Completed</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Pending */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="h-4 w-[4px] rounded-sm shrink-0 bg-amber-400" />
                  <span className="text-xs font-medium text-amber-500">Pending</span>
                </div>
                {/* Cancelled */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="h-4 w-[4px] rounded-sm shrink-0 bg-rose-400" />
                  <span className="text-xs font-medium text-rose-500">Cancelled</span>
                </div>
                {/* No Show — merges Left Early */}
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 shrink-0 cursor-default">
                        <span className="h-4 w-[4px] rounded-sm shrink-0 bg-slate-400" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">No Show</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[160px] text-center">No Show · Left Early</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* In Consult — ring swatch, merges Checked In + Treatment Completed */}
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 shrink-0 cursor-default">
                        <span className="h-4 w-4 rounded-sm shrink-0 border-2 border-violet-500 bg-transparent" />
                        <span className="text-xs font-medium text-violet-600 dark:text-violet-400">In Consult</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">Checked In · In Consult · Treatment in Progress</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {/* WHEN — always visible so the top-bar colour is explained on every filter */}
              <>
                <span className="h-3.5 w-px bg-border/60 shrink-0" />
                <div className="flex items-center gap-x-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/50 shrink-0">When</span>
                  {([
                    { color: "bg-sky-400",                     label: "Today",    text: "text-sky-500"                       },
                    { color: "bg-primary",                     label: "Upcoming", text: "text-primary"                       },
                    { color: "bg-slate-300 dark:bg-slate-500", label: "Past",     text: "text-slate-400 dark:text-slate-500" },
                  ] as const).map(({ color, label, text }) => (
                    <div key={label} className="flex items-center gap-1 shrink-0">
                      <span className={`h-[5px] w-5 rounded-sm shrink-0 ${color}`} />
                      <span className={`text-xs font-medium ${text}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </>
              <button
                onClick={() => setLegendCollapsed(true)}
                title="Hide legend"
                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150 motion-reduce:transition-none p-1 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-muted-foreground shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

          </div>
        )}

        {bookingsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <BookingCardSkeleton key={i} />
            ))}
          </div>
        ) : bookingsError ? (
          <div className="col-span-full py-12 flex flex-col items-center gap-5 text-center bg-muted/10 rounded-2xl border border-dashed border-border/60">
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 p-3 text-rose-600 dark:text-rose-400 shadow-sm">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-[320px]">
              <p className="text-base font-semibold text-foreground">We couldn’t load your bookings</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {bookingsErrorDetails instanceof Error ? bookingsErrorDetails.message : "The booking service is temporarily unavailable. Please try again in a moment."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9"
              onClick={() => refetchBookings()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBookings.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center gap-5 text-center bg-muted/10 rounded-2xl border border-dashed border-border/60">
                <div className="rounded-2xl overflow-hidden bg-white/70 dark:bg-muted/20 p-2 shadow-sm">
                  <img
                    src={noBookingsImg}
                    alt="No bookings found"
                    className="w-32 h-32 object-contain dark:opacity-75"
                    draggable={false}
                  />
                </div>

                {/* ── Headline + detail — context-aware per filter ── */}
                <div className="space-y-1.5 max-w-[280px]">
                  <p className="text-base font-semibold text-foreground">
                    {emptyStateMeta.title}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {emptyStateMeta.detail}
                  </p>
                </div>

                {/* ── Smart patient hint panel ── */}
                {patientHint && (
                  <div className={`w-full max-w-sm mx-auto rounded-xl border px-4 py-3 text-left ${
                    patientHint.color === 'amber'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                      : patientHint.color === 'blue'
                      ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700'
                      : 'bg-muted/40 border-border/60'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`shrink-0 mt-0.5 ${
                        patientHint.color === 'amber' ? 'text-amber-600 dark:text-amber-400'
                        : patientHint.color === 'blue' ? 'text-sky-600 dark:text-sky-400'
                        : 'text-muted-foreground'
                      }`}>
                        <Info className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${
                          patientHint.color === 'amber' ? 'text-amber-800 dark:text-amber-200'
                          : patientHint.color === 'blue' ? 'text-sky-800 dark:text-sky-200'
                          : 'text-foreground'
                        }`}>
                          {patientHint.headline}
                        </p>
                        <p className={`text-xs mt-1 leading-relaxed ${
                          patientHint.color === 'amber' ? 'text-amber-700 dark:text-amber-300'
                          : patientHint.color === 'blue' ? 'text-sky-700 dark:text-sky-300'
                          : 'text-muted-foreground'
                        }`}>
                          {patientHint.detail}
                        </p>
                        {patientHint.actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {patientHint.actions.map(a => (
                              <button
                                key={a.label}
                                onClick={a.onClick}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  patientHint.color === 'amber'
                                    ? 'bg-amber-200/80 dark:bg-amber-800/50 text-amber-900 dark:text-amber-100 hover:bg-amber-300/80 dark:hover:bg-amber-700/60'
                                    : patientHint.color === 'blue'
                                    ? 'bg-sky-200/80 dark:bg-sky-800/50 text-sky-900 dark:text-sky-100 hover:bg-sky-300/80 dark:hover:bg-sky-700/60'
                                    : 'bg-muted text-foreground hover:bg-muted/80'
                                }`}
                                data-testid={`button-patient-hint-${a.label.replace(/\s+/g, '-').toLowerCase()}`}
                              >
                                {a.label} →
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Bottom action buttons ── */}
                <div className="flex flex-wrap justify-center gap-2">
                  {(quickFilter !== 'all' || filterDate || filterEndDate) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-9"
                      onClick={() => { setQuickFilter('all'); setFilterDate(undefined); setFilterEndDate(undefined); clearBookingPatientFilter(); }}
                      data-testid="button-clear-filters-empty"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear all filters
                    </Button>
                  )}
                  {!activePatientFilter && quickFilter === 'all' && !filterDate && (
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs h-9 bg-primary hover:bg-primary/90"
                      onClick={() => onNavigate('configure-slots')}
                      data-testid="button-configure-slots-empty"
                    >
                      Configure Slots →
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              (() => {
                const isGrouped = quickFilter === 'all' && !filterDate;
                const groupConfig = [
                  { label: 'Pending', textColor: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
                  { label: 'Upcoming', textColor: 'text-primary', bg: 'bg-primary/5 dark:bg-primary/10', border: 'border-primary/20' },
                  { label: 'Past', textColor: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border/40' },
                ];
                let lastGroup = -1;
                return filteredBookings?.flatMap((booking) => {
                const bookingDateTime = new Date(booking.slot.startTime);
                const bookingDateStr = format(bookingDateTime, 'yyyy-MM-dd');
                const isBookingToday = bookingDateStr === todayStr;
                const isBookingPast = bookingDateTime < startOfDay(new Date()) && !isBookingToday;

                const isConfirmed = booking.verificationStatus === 'confirmed' || !!booking.confirmedBy;
                const isCancelled = booking.verificationStatus === 'cancelled';

                // Visit lifecycle states
                const modalIsVisitCompleted     = (booking as any).visitStatus === 'completed';
                const modalIsTreatmentCompleted = (booking as any).visitStatus === 'treatment_completed';
                const modalIsInConsultation     = (booking as any).visitStatus === 'in_consultation';
                const modalIsCheckedIn          = (booking as any).visitStatus === 'checked_in';
                const modalIsNoShow             = booking.verificationStatus === 'no_show';
                const modalIsLeftEarly          = (booking as any).visitStatus === 'patient_left_early';
                const modalIsTerminal           = isCancelled || modalIsNoShow || modalIsLeftEarly;

                // Top accent bar — TIME dimension (when is the appointment?)
                const accentBar = isBookingToday
                  ? "bg-gradient-to-r from-sky-400 to-cyan-400"
                  : isBookingPast
                  ? "bg-gradient-to-r from-slate-400 to-slate-300"
                  : "bg-gradient-to-r from-primary to-accent";

                // Card header tint — follows time dimension
                const headerBg = isBookingToday
                  ? "bg-gradient-to-r from-sky-500/8 to-cyan-500/5"
                  : isBookingPast
                  ? "bg-muted/30"
                  : "bg-gradient-to-r from-primary/5 to-accent/5";

                // Time pill — WHEN is the appointment
                const timeLabel = isBookingToday ? "Today" : isBookingPast ? "Past" : "Upcoming";
                const timeClass = isBookingToday
                  ? "text-sky-600 bg-sky-500/10 border-sky-500/25 dark:text-sky-400 dark:bg-sky-400/10 dark:border-sky-500/30"
                  : isBookingPast
                  ? "text-muted-foreground bg-muted/50 border-border/50"
                  : "text-primary bg-primary/10 border-primary/25";

                // Status pill — WHAT is the verification state
                const statusLabel = isCancelled ? "Cancelled" : isConfirmed ? "Confirmed" : "Pending";
                const statusClass = isCancelled
                  ? "text-rose-600 bg-rose-500/10 border-rose-500/25 dark:text-rose-400 dark:bg-rose-400/10 dark:border-rose-500/30"
                  : isConfirmed
                  ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-500/30"
                  : "text-amber-600 bg-amber-500/10 border-amber-500/25 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-500/30";

                // Left border — STATUS dimension (confirmation state at a glance)
                const cardOpacity = isBookingPast ? "opacity-75" : "";
                const leftBorder = isCancelled
                  ? "border-l-2 border-l-rose-400 dark:border-l-rose-500"
                  : isConfirmed
                  ? "border-l-2 border-l-emerald-400 dark:border-l-emerald-500"
                  : "border-l-2 border-l-amber-400 dark:border-l-amber-500";

                const complaints = booking.description
                  ? CHIEF_COMPLAINTS.filter(c =>
                      booking.description!.toLowerCase().includes(c.toLowerCase())
                    )
                  : [];

                const isPending = !isConfirmed && !isBookingPast;
                const group = isGrouped ? statusGroup(booking) : -1;
                const showDivider = isGrouped && group !== lastGroup;
                const actionState = getActionState(booking);
                if (isGrouped) lastGroup = group;
                const groupCfg = groupConfig[Math.max(0, group)];
                return [
                  showDivider ? (
                    <div key={`divider-group-${group}`} className="col-span-full flex items-center gap-2 mb-1">
                      <div className="h-px flex-1 bg-border/50" />
                      <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${groupCfg.textColor} ${groupCfg.bg} ${groupCfg.border}`}>
                        {groupCfg.label}
                        <span className="font-black opacity-70">— {filteredBookings?.filter(b => statusGroup(b) === group).length ?? 0}</span>
                      </span>
                      <div className="h-px flex-1 bg-border/50" />
                      <button
                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }))}
                        aria-label={collapsedGroups[group] ? `Expand ${groupCfg.label}` : `Collapse ${groupCfg.label}`}
                        className={`h-11 w-11 flex items-center justify-center rounded-xl border border-border/50 bg-background hover:bg-muted/60 active:bg-muted/80 active:scale-[0.95] transition-all shrink-0`}
                      >
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${collapsedGroups[group] ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  ) : null,
                  collapsedGroups[group] ? null : (
                <Dialog
                  key={booking.id}
                  open={openBookingId === booking.id}
                  onOpenChange={(open) => { if (!open) { setOpenBookingId(null); setDialogExpanded(false); } }}
                >
                  <AppointmentCard
                    role="clinic"
                    booking={booking}
                    bookingNumber={bookingNumber(booking)}
                    complaints={complaints}
                    onCardClick={() => setOpenBookingId(booking.id)}
                    onConfirm={() => actionState.canConfirm && confirmBookingMutation.mutate(booking.id)}
                    onCancel={(reason) => actionState.canCancel && cancelBookingMutation.mutate({ id: booking.id, reason })}
                    onBill={() => handleOpenBilling(booking)}
                    onAssignDoctor={(name, email) => actionState.canAssignDoctor && assignDoctorMutation.mutate({ bookingId: booking.id, doctorName: name, doctorEmail: email })}
                    assignDoctorPending={assignDoctorMutation.isPending}
                    confirmPending={confirmBookingMutation.isPending}
                    onCheckIn={() => actionState.canCheckIn && checkInMutation.mutate({ bookingId: booking.id })}
                    onUndoCheckIn={() => actionState.canCheckIn && checkInMutation.mutate({ bookingId: booking.id, undo: true })}
                    onCompleteVisit={(note) => actionState.canCompleteVisit && completeVisitMutation.mutate({ bookingId: booking.id, note })}
                    onNoShow={(reason) => actionState.canNoShow && noShowMutation.mutate({ bookingId: booking.id, reason })}
                    noShowPending={noShowMutation.isPending}
                    onSendReminder={() => actionState.canSendReminder && sendReminderMutation.mutate(booking.id)}
                    sendReminderPending={sendReminderMutation.isPending}
                    onOverrideComplete={(reason) => actionState.canOverrideComplete && overrideCompleteMutation.mutate({ bookingId: booking.id, reason })}
                    overridePending={overrideCompleteMutation.isPending}
                    onPatientLeftEarly={(reason) => actionState.canPatientLeftEarly && patientLeftEarlyMutation.mutate({ bookingId: booking.id, reason })}
                    leftEarlyPending={patientLeftEarlyMutation.isPending}
                    totalBillsCount={allBills.filter(b => b.bookingId === booking.id).length}
                    onBookAgain={() => {
                      const _desc = booking.description ?? "";
                      const _rebookDesc = _desc.split(/\s*\|\s*/).filter((p: string) => !p.startsWith("Category:") && !p.startsWith("Visit:") && !p.startsWith("Age:") && !p.startsWith("Gender:")).join(", ").trim();
                      const _rebookVisit = (_desc.match(/Visit:\s*([^|]+)/)?.[1] ?? "").trim();
                      const _rebookCategory = (_desc.match(/Category:\s*([^|]+)/)?.[1] ?? "").trim();
                      persistRebookValues({
                        bookingName: booking.customerName,
                        bookingPhone: booking.customerPhone,
                        bookingEmail: booking.customerEmail || "",
                        bookingAge: String((booking as any).customerAge || ""),
                        bookingGender: (booking as any).customerGender || "",
                        bookingDescription: _rebookDesc,
                        bookingVisitType: _rebookVisit,
                        bookingAppointmentCategory: _rebookCategory,
                      });
                      onNavigate('book-a-slot');
                      setOpenBookingId(null);
                    }}
                    onRequestConsent={() => requestConsentMutation.mutate(booking.id)}
                    consentRequestPending={requestConsentMutation.isPending && requestConsentMutation.variables === booking.id}
                    onOpenActionTab={() => { setOpenBookingId(booking.id); setModalTab(booking.id, 'actions'); }}
                    openBillsCount={allBills.filter(b => b.bookingId === booking.id && b.paymentStatus !== 'paid').length}
                    checkInPending={checkInMutation.isPending}
                    completeVisitPending={completeVisitMutation.isPending}
                    cancelPending={cancelBookingMutation.isPending}
                  />
                    <DialogContent className={`w-[95vw] ${dialogExpanded ? 'sm:max-w-[88vw]' : 'sm:max-w-[640px]'} rounded-2xl p-0 overflow-hidden h-[90vh] flex flex-col transition-[max-width] duration-200`}>

                      {/* Maximize / minimize toggle — tablet+ only, sits left of the auto-rendered close X */}
                      <button
                        onClick={() => setDialogExpanded(v => !v)}
                        className="hidden sm:flex absolute right-11 top-3.5 z-10 h-6 w-6 items-center justify-center rounded-md bg-white/15 hover:bg-white/25 border border-white/20 transition-colors"
                        aria-label={dialogExpanded ? "Minimize dialog" : "Maximize dialog"}
                        data-testid="button-dialog-expand"
                      >
                        {dialogExpanded
                          ? <Minimize2 className="h-3.5 w-3.5 text-white" />
                          : <Maximize2 className="h-3.5 w-3.5 text-white" />}
                      </button>

                      {/* ── HEADER ── */}
                      <div className="shrink-0 bg-gradient-to-br from-primary/90 via-primary to-accent/80 px-4 pt-4 pb-0 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                        {/* Top row: avatar + name + close */}
                        <div className="relative flex items-start gap-3 mb-2">
                          <div className="shrink-0">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center ring-2 ring-white/10">
                              <span className="text-lg sm:text-xl font-black text-white leading-none">
                                {booking.customerName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <DialogTitle className="text-white font-extrabold text-base sm:text-xl leading-tight tracking-tight">
                                {booking.customerName}
                              </DialogTitle>
                              <span className="font-mono text-xs uppercase tracking-widest text-white/60 bg-white/10 border border-white/20 px-1.5 py-0.5 rounded-md shrink-0">
                                REF-{bookingNumber(booking).padStart(4, '0')}
                              </span>
                              {((booking as any).customerAge || (booking as any).customerGender) && (
                                <span className="text-xs text-white/55 shrink-0">
                                  {(booking as any).customerAge ? `${(booking as any).customerAge}y` : ""}
                                  {(booking as any).customerAge && (booking as any).customerGender ? " · " : ""}
                                  {(booking as any).customerGender ? ((booking as any).customerGender as string).charAt(0).toUpperCase() + ((booking as any).customerGender as string).slice(1) : ""}
                                </span>
                              )}
                            </div>
                            {/* Status text row — full lifecycle priority chain */}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {isCancelled ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
                                    <X className="h-2.5 w-2.5" />Cancelled
                                  </span>
                                  {booking.cancellationReason && (
                                    <span className="text-xs italic text-white/50">{booking.cancellationReason}</span>
                                  )}
                                </div>
                              ) : modalIsNoShow ? (
                                <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                  <UserX className="h-2.5 w-2.5" />No Show
                                </span>
                              ) : modalIsLeftEarly ? (
                                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                                  <LogOut className="h-2.5 w-2.5" />Left Early
                                </span>
                              ) : modalIsVisitCompleted ? (
                                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                  <ShieldCheck className="h-2.5 w-2.5" />Visit Done
                                </span>
                              ) : modalIsTreatmentCompleted ? (
                                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" />Tmt. Done
                                </span>
                              ) : modalIsInConsultation ? (
                                <span className="text-xs font-bold text-teal-300 flex items-center gap-1">
                                  <Stethoscope className="h-2.5 w-2.5" />With Doctor
                                </span>
                              ) : modalIsCheckedIn ? (
                                <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" />Arrived
                                </span>
                              ) : isConfirmed ? (
                                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                  {booking.confirmedBy === 'doctor'
                                    ? <Stethoscope className="h-2.5 w-2.5" />
                                    : <CheckCircle2 className="h-2.5 w-2.5" />}
                                  {booking.confirmedBy === 'doctor'
                                    ? `Confirmed by Dr. ${booking.assignedDoctor?.split(' ')[0] || 'Doctor'}`
                                    : booking.confirmedBy === 'admin'
                                    ? 'Confirmed by Admin'
                                    : 'Confirmed'}
                                </span>
                              ) : booking.assignedDoctor && booking.doctorApprovalStatus === 'pending' ? (
                                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  Awaiting Dr. {booking.assignedDoctor.split(' ')[0]}
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-white/60 flex items-center gap-1.5">
                                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                                  </span>
                                  Awaiting Confirmation
                                </span>
                              )}
                              {booking.consentSignedAt && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/70">
                                  <PenLine className="h-2.5 w-2.5" />Consent Signed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Appointment strip — 2-col grid on mobile, flex row on sm+ */}
                        <div className="relative pb-3">
                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-3">
                            <div className="flex items-center gap-1.5 text-xs text-white/75">
                              <CalendarDays className="h-3 w-3 opacity-80 shrink-0" />
                              <strong className="text-white font-semibold">{format(bookingDateTime, "EEE, d MMM yyyy")}</strong>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-white/75">
                              <Clock className="h-3 w-3 opacity-80 shrink-0" />
                              <strong className="text-white font-semibold">{format(bookingDateTime, "h:mm a")}</strong>
                              <span>→ {format(new Date(booking.slot.endTime), "h:mm a")}</span>
                            </div>
                            {clinic?.name && (
                              <div className="flex items-center gap-1.5 text-xs text-white/75">
                                <Building2 className="h-3 w-3 opacity-80 shrink-0" />
                                <span className="truncate">{clinic.name}</span>
                              </div>
                            )}
                            {!isBookingPast && (() => {
                              const daysAway = differenceInCalendarDays(bookingDateTime, new Date());
                              const label = isBookingToday ? "Today" : daysAway === 1 ? "Tomorrow" : `in ${daysAway} days`;
                              return (
                                <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 w-fit">
                                  {label}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                      </div>

                      {/* Tab strip — neutral bar below header */}
                      <div className="shrink-0 flex border-b border-border/60 bg-card">
                        {([
                          { key: 'overview', label: 'Overview', icon: <User className="h-3.5 w-3.5" /> },
                          { key: 'clinical', label: 'Clinical', icon: <ClipboardList className="h-3.5 w-3.5" /> },
                          { key: 'notes',    label: 'Notes',    icon: <FileText className="h-3.5 w-3.5" /> },
                          { key: 'actions',  label: 'Actions',  icon: <Settings className="h-3.5 w-3.5" /> },
                          { key: 'billing',  label: 'Billing',  icon: <IndianRupee className="h-3.5 w-3.5" /> },
                        ] as const).map(({ key, label, icon }) => {
                          const isActive = getModalTab(booking.id) === key;
                          const hasBadge = (tabBadges[booking.id] || []).includes(key);
                          return (
                            <button
                              key={key}
                              onClick={() => {
                                setModalTab(booking.id, key);
                                if (hasBadge) setTabBadges(prev => ({ ...prev, [booking.id]: (prev[booking.id] || []).filter(t => t !== key) }));
                              }}
                              className={`relative flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-2.5 min-h-[44px] text-xs font-semibold transition-all border-b-2 focus-visible:outline-none active:bg-muted/40 ${
                                isActive
                                  ? 'text-primary border-primary'
                                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30 active:text-foreground'
                              }`}
                              data-testid={`modal-tab-${key}-${booking.id}`}
                            >
                              {icon}
                              <span className="text-xs leading-none">{label}</span>
                              {hasBadge && (
                                <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-card animate-pulse" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* ── TAB PANELS ── */}
                      <div className={`overflow-y-auto flex-1 transition-[box-shadow] duration-500 ${notifHighlight?.bookingId === booking.id ? "ring-2 ring-inset ring-primary/40" : ""}`}>

                        {/* OVERVIEW TAB — enlarged patient card, same row style as AppointmentCard */}
                        {getModalTab(booking.id) === 'overview' && (() => {
                          const ovSlotAgeMs = Date.now() - bookingDateTime.getTime();
                          const ovIsPastDue = ovSlotAgeMs > 2 * 60 * 60 * 1000
                            && !isCancelled
                            && booking.verificationStatus !== 'no_show'
                            && !['completed', 'visit_completed', 'checked_in', 'in_consultation', 'treatment_completed'].includes((booking as any).visitStatus ?? '');
                          const ovDaysAway = differenceInCalendarDays(bookingDateTime, new Date());
                          const ovRelBadge = !isBookingPast && !isCancelled ? (
                            isBookingToday
                              ? <span className="shrink-0 text-xs font-semibold border px-1.5 py-px rounded-full text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20">Today</span>
                              : ovDaysAway === 1
                              ? <span className="shrink-0 text-xs font-semibold border px-1.5 py-px rounded-full text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20">Tomorrow</span>
                              : ovDaysAway > 1
                              ? <span className="shrink-0 text-xs font-semibold border px-1.5 py-px rounded-full text-muted-foreground bg-muted/50 border-border/50">in {ovDaysAway}d</span>
                              : null
                          ) : null;

                          const ovProgressStage: LifecycleStage =
                            booking.verificationStatus === 'no_show' ? 'no_show'
                            : (booking as any).visitStatus === 'patient_left_early' ? 'left_early'
                            : isCancelled ? 'cancelled'
                            : (booking as any).visitStatus === 'completed' ? 'visit_completed'
                            : (booking as any).visitStatus === 'treatment_completed' ? 'treatment_completed'
                            : (booking as any).visitStatus === 'in_consultation' ? 'in_consultation'
                            : (booking as any).visitStatus === 'checked_in' ? 'checked_in'
                            : isConfirmed ? 'confirmed'
                            : 'booked';

                          // Parse visitType + treatmentCategory from description
                          // (same logic as AppointmentCard — no dedicated DB columns)
                          const rawOverviewDesc = booking.description ?? "";
                          const ovVisitType = (booking as any).visitType
                            || rawOverviewDesc.match(/Visit:\s*([^|,\n]+)/)?.[1]?.trim()
                            || null;
                          const ovTreatmentCategory = (booking as any).treatmentCategory
                            || rawOverviewDesc.match(/Category:\s*([^|,\n]+)/)?.[1]?.trim()
                            || null;

                          return (
                            <div className="px-4 pt-3 pb-4 space-y-2.5">

                              {/* ── Patient info card — matches info grid row pattern ── */}
                              <div className="rounded-xl border border-green-800/30 bg-white shadow-sm px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">

                                {/* Patient ID */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <User className="h-3 w-3 text-primary" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Patient ID:</span>
                                  {(booking as any).patientCode ? (
                                    <>
                                      <span className="font-mono font-bold text-primary truncate">{(booking as any).patientCode}</span>
                                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText((booking as any).patientCode); notify.success("Patient ID copied!"); }} className="shrink-0 ml-auto h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors" title="Copy Patient ID">
                                        <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground/50">–</span>
                                  )}
                                </div>

                                {/* Phone */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Phone:</span>
                                  {booking.customerPhone ? (
                                    <>
                                      <a href={`tel:${booking.customerPhone}`} className="font-semibold text-foreground truncate hover:text-primary transition-colors min-w-0">
                                        {booking.customerPhone}
                                      </a>
                                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(booking.customerPhone!); notify.success("Phone copied!"); }} className="shrink-0 ml-auto h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors" title="Copy phone">
                                        <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                      </button>
                                      <a href={`tel:${booking.customerPhone}`} className="shrink-0 h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors" title="Call patient">
                                        <Phone className="h-2.5 w-2.5 text-primary" />
                                      </a>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground/50">–</span>
                                  )}
                                </div>

                                {/* Email — full width */}
                                <div className="col-span-2 flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <Mail className="h-3 w-3 text-blue-500" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Email:</span>
                                  {booking.customerEmail ? (
                                    <>
                                      <span className="font-semibold text-foreground truncate min-w-0">{booking.customerEmail}</span>
                                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(booking.customerEmail!); notify.success("Email copied!"); }} className="shrink-0 ml-auto h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors" title="Copy email">
                                        <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground/50">–</span>
                                  )}
                                </div>

                                {/* Age */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                    <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Age:</span>
                                  <span className={(booking as any).customerAge ? "font-semibold text-foreground" : "text-muted-foreground/50"}>
                                    {(booking as any).customerAge ? `${(booking as any).customerAge}y` : "–"}
                                  </span>
                                </div>

                                {/* Gender */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                    <Users className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Gender:</span>
                                  <span className={(booking as any).customerGender ? "font-semibold text-foreground capitalize" : "text-muted-foreground/50"}>
                                    {(booking as any).customerGender || "–"}
                                  </span>
                                </div>

                                {/* ── Zone B divider ── */}
                                <div className="col-span-2 border-t border-border/50 my-0.5" />

                                {/* Visit Type */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                    <Repeat2 className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Visit Type:</span>
                                  {ovVisitType ? (
                                    <span className="inline-flex items-center font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 px-1.5 py-0.5 rounded-md truncate">
                                      {OVERVIEW_VISIT_TYPE_LABELS[ovVisitType] ?? ovVisitType}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/50">–</span>
                                  )}
                                </div>

                                {/* Assigned Doctor */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <Stethoscope className="h-3 w-3 text-primary" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Assigned:</span>
                                  {booking.assignedDoctor ? (
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className="font-semibold text-primary truncate">Dr. {booking.assignedDoctor}</span>
                                      {booking.doctorApprovalStatus === 'pending' && <span className="text-amber-600 dark:text-amber-400 shrink-0">· Awaiting</span>}
                                      {booking.doctorApprovalStatus === 'approved' && <span className="text-emerald-600 dark:text-emerald-400 shrink-0">· ✓</span>}
                                      {booking.doctorApprovalStatus === 'admin_confirmed' && <span className="text-emerald-600 dark:text-emerald-400 shrink-0">· ✓</span>}
                                      {booking.doctorApprovalStatus === 'declined' && <span className="text-rose-600 dark:text-rose-400 shrink-0">· ✗</span>}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/50">–</span>
                                  )}
                                </div>

                                {/* Treatment */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                    <Tag className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Treatment:</span>
                                  {ovTreatmentCategory ? (
                                    <span className="inline-flex items-center font-semibold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 rounded-md truncate">
                                      {ovTreatmentCategory}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/50">–</span>
                                  )}
                                </div>

                                {/* Consent */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                    <PenLine className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Consent:</span>
                                  {booking.consentSignedAt ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                                      <CheckCircle2 className="h-2.5 w-2.5" />Signed ✓
                                    </span>
                                  ) : (consentUrls[booking.id] || (booking as any).consentToken) ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md">
                                        <Clock className="h-2.5 w-2.5" />Sent
                                      </span>
                                      <button
                                        onClick={() => requestConsentMutation.mutate(booking.id)}
                                        disabled={requestConsentMutation.isPending}
                                        className="h-[22px] w-[22px] inline-flex items-center justify-center rounded-md text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all disabled:opacity-50"
                                        title="Resend consent link"
                                      >
                                        {requestConsentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                      </button>
                                      <button
                                        onClick={() => {
                                          const url = consentUrls[booking.id] || `${window.location.origin}/consent/${(booking as any).consentToken}`;
                                          navigator.clipboard.writeText(url);
                                          setCopiedConsentId(booking.id);
                                          setTimeout(() => setCopiedConsentId(null), 2000);
                                          notify.success("Consent link copied!");
                                        }}
                                        className="h-[22px] w-[22px] inline-flex items-center justify-center rounded-md text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all"
                                        title="Copy consent link"
                                      >
                                        {copiedConsentId === booking.id ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => requestConsentMutation.mutate(booking.id)}
                                      disabled={requestConsentMutation.isPending}
                                      className="inline-flex items-center gap-1 font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/15 active:scale-95 px-1.5 py-0.5 rounded-md transition-all disabled:opacity-50"
                                    >
                                      {requestConsentMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <PenLine className="h-2.5 w-2.5" />}
                                      Send Link →
                                    </button>
                                  )}
                                </div>

                                {/* Slot Units */}
                                <div className="flex items-center gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0">Slots:</span>
                                  {(booking as any).slotCost > 0 ? (
                                    <span className="font-semibold text-foreground">{(booking as any).slotCost} slot{(booking as any).slotCost !== 1 ? 's' : ''}</span>
                                  ) : (
                                    <span className="text-muted-foreground/50">–</span>
                                  )}
                                </div>

                                {/* Booked — paired with Cost */}
                                {booking.createdAt ? (
                                  <div className="flex items-center gap-1.5 text-xs min-w-0">
                                    <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                      <Clock className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <span className="text-muted-foreground shrink-0">Booked:</span>
                                    <span className="font-semibold text-foreground truncate">{format(new Date(booking.createdAt), "MMM d · h:mm a")}</span>
                                  </div>
                                ) : <div />}

                                {/* Complaints — full width */}
                                <div className="col-span-2 flex items-start gap-1.5 text-xs min-w-0">
                                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                                    <ClipboardList className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground shrink-0 pt-0.5">Complaints:</span>
                                  {complaints.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {complaints.map((c, idx) => (
                                        <span key={idx} className="inline-flex items-center font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/50 pt-0.5">–</span>
                                  )}
                                </div>

                                {/* Clinical — full width, conditional */}
                                {booking.clinicalStatus && OVERVIEW_CLINICAL_STATUS[booking.clinicalStatus] && (
                                  <div className="col-span-2 flex items-center gap-1.5 text-xs min-w-0">
                                    <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                      <ClipboardCheck className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <span className="text-muted-foreground shrink-0">Clinical:</span>
                                    <span className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-md border ${OVERVIEW_CLINICAL_STATUS[booking.clinicalStatus].cls}`}>
                                      {OVERVIEW_CLINICAL_STATUS[booking.clinicalStatus].label}
                                    </span>
                                  </div>
                                )}

                                {/* Confirmed by — full width, conditional */}
                                {(() => {
                                  const cb = (booking as any).confirmedBy;
                                  const das = booking.doctorApprovalStatus;
                                  const confirmedByLabel =
                                    cb === 'doctor' ? `Dr. ${booking.assignedDoctor?.split(' ')[0] || 'Doctor'}` :
                                    cb === 'admin' ? 'Clinic Admin' :
                                    das === 'admin_confirmed' ? 'Clinic Admin' :
                                    null;
                                  if (!confirmedByLabel) return null;
                                  return (
                                    <div className="col-span-2 flex items-center gap-1.5 text-xs min-w-0">
                                      <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="h-3 w-3 text-primary" />
                                      </div>
                                      <span className="text-muted-foreground shrink-0">Confirmed by:</span>
                                      <span className="font-semibold text-foreground">{confirmedByLabel}</span>
                                    </div>
                                  );
                                })()}

                              </div>

                              {/* ── Past-due banner ── */}
                              {ovIsPastDue && (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  <span className="min-w-0 flex-1">Slot time has passed — please action this booking</span>
                                  <button
                                    onClick={() => setModalTab(booking.id, 'actions')}
                                    className="shrink-0 text-xs underline underline-offset-2 hover:no-underline"
                                  >
                                    Reschedule
                                  </button>
                                </div>
                              )}

                              {/* ── Terminal reason banner ── */}
                              {booking.cancellationReason && (
                                <div className={`flex items-start gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 border ${
                                  booking.verificationStatus === 'no_show'
                                    ? "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-700"
                                    : (booking as any).visitStatus === 'patient_left_early'
                                    ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                                    : "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
                                }`}>
                                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                                  <span className="leading-snug">{booking.cancellationReason}</span>
                                </div>
                              )}

                              {/* ── Visit completion note banner ── */}
                              {(booking as any).visitCompletionNote && (booking as any).visitStatus === 'completed' && (
                                <div className="flex items-start gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 border text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                                  <span className="leading-snug">{(booking as any).visitCompletionNote}</span>
                                </div>
                              )}

                              {/* ── Unpaid bills banner (visit complete) ── */}
                              {(() => {
                                const ovBills = allBills.filter(b => b.bookingId === booking.id);
                                const ovOpen = ovBills.filter(b => b.paymentStatus !== 'paid').length;
                                return (booking as any).visitStatus === 'completed' && ovOpen > 0 ? (
                                  <div
                                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-950/30 transition-colors"
                                    onClick={() => setModalTab(booking.id, 'billing')}
                                  >
                                    <IndianRupee className="h-3 w-3 shrink-0" />
                                    <span className="flex-1">{ovOpen} unpaid bill{ovOpen > 1 ? 's' : ''} — tap to settle</span>
                                  </div>
                                ) : null;
                              })()}

                              {/* ── Progress strip ── */}
                              <div className="pt-1">
                                <BookingProgressStrip
                                  stage={ovProgressStage}
                                  isCancelled={isCancelled}
                                  isNoShow={booking.verificationStatus === 'no_show'}
                                  isLeftEarly={(booking as any).visitStatus === 'patient_left_early'}
                                  isOverride={
                                    (booking as any).visitStatus === 'completed' &&
                                    !(booking as any).checkedInAt &&
                                    (booking as any).visitStatus !== 'patient_left_early'
                                  }
                                  checkedInAt={booking.checkedInAt ?? undefined}
                                  completedAt={(booking as any).completedAt ?? undefined}
                                  cancellationReason={booking.cancellationReason ?? null}
                                  confirmedBy={(booking as any).confirmedBy ?? null}
                                  visitCompletionNote={(booking as any).visitCompletionNote ?? null}
                                  hasUnpaidBill={(() => {
                                    const bills = allBills.filter(b => b.bookingId === booking.id);
                                    return (booking as any).visitStatus === 'completed' && bills.filter(b => b.paymentStatus !== 'paid').length > 0;
                                  })()}
                                  noBill={(() => {
                                    return (booking as any).visitStatus === 'completed' && allBills.filter(b => b.bookingId === booking.id).length === 0;
                                  })()}
                                  stageBeforeCancel={
                                    (isCancelled || booking.verificationStatus === 'no_show' || (booking as any).visitStatus === 'patient_left_early') ? (
                                      (booking as any).visitStatus === 'completed' ? 4 :
                                      ((booking as any).visitStatus === 'treatment_completed' || (booking as any).visitStatus === 'in_consultation') ? 3 :
                                      (!!(booking as any).checkedInAt || (booking as any).visitStatus === 'checked_in') ? 2 :
                                      !!(booking as any).confirmedBy ? 1 :
                                      0
                                    ) : 0
                                  }
                                />
                              </div>

                            </div>
                          );
                        })()}


                        {/* CLINICAL TAB */}
                        {getModalTab(booking.id) === 'clinical' && (
                          <div className="p-4 space-y-3">

                            {/* Clinical Status — single chip + dropdown, editable by admin */}
                            <div className="rounded-xl border border-green-800/30 bg-white shadow-sm overflow-hidden">
                              <div className="px-3 py-2.5 bg-green-800 border-b border-green-900/20 flex items-center gap-1.5">
                                <ClipboardCheck className="h-3 w-3 text-white" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-white">Clinical Status</span>
                              </div>
                              <div className="px-3 py-3">
                                {(() => {
                                  const CLINICAL_STATUS_OPTIONS = [
                                    { value: 'follow_up_required', label: 'Follow-up Required', dotClass: 'bg-amber-500' },
                                    { value: 'case_closed',        label: 'Case Closed',        dotClass: 'bg-emerald-500' },
                                  ] as const;
                                  const current = CLINICAL_STATUS_OPTIONS.find(o => o.value === booking.clinicalStatus);
                                  const chipCls = current
                                    ? (OVERVIEW_CLINICAL_STATUS[current.value]?.cls ?? '')
                                    : 'bg-green-50 text-green-800 border-green-800/30';
                                  return (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          disabled={updateClinicalStatusMutation.isPending}
                                          className={`inline-flex items-center gap-2 pl-3 pr-2.5 min-h-[44px] rounded-full text-sm font-semibold border transition-all active:scale-[0.97] ${chipCls}`}
                                          data-testid={`clinical-status-trigger-${booking.id}`}
                                        >
                                          <span className={`h-2 w-2 rounded-full shrink-0 ${current ? current.dotClass : 'bg-muted-foreground/40'}`} />
                                          {current ? current.label : 'Not set'}
                                          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="w-56">
                                        {CLINICAL_STATUS_OPTIONS.map(({ value, label, dotClass }) => (
                                          <DropdownMenuItem
                                            key={value}
                                            onClick={() => updateClinicalStatusMutation.mutate({ bookingId: booking.id, clinicalStatus: value })}
                                            className="gap-2 min-h-[44px]"
                                            data-testid={`clinical-status-${value}-${booking.id}`}
                                          >
                                            <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
                                            {label}
                                            {booking.clinicalStatus === value && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => updateClinicalStatusMutation.mutate({ bookingId: booking.id, clinicalStatus: null })}
                                          disabled={!booking.clinicalStatus}
                                          className="gap-2 min-h-[44px] text-muted-foreground"
                                          data-testid={`clinical-status-clear-${booking.id}`}
                                        >
                                          <X className="h-3.5 w-3.5 shrink-0" />
                                          Clear status
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Clinical Records */}
                            <div className="rounded-xl border border-green-800/30 bg-white shadow-sm overflow-hidden">
                              <div className="px-3 py-2.5 bg-green-50 border-b border-green-800/30 flex items-center gap-1.5">
                                <ClipboardList className="h-3 w-3 text-green-800" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-green-800">Clinical Records</span>
                              </div>
                              <div className="p-3">
                                <ClinicalRecordsTab
                                  bookingId={booking.id}
                                  clinicId={clinic?.id ?? (booking.slot as any)?.clinicId}
                                  patientName={booking.customerName}
                                  patientPhone={booking.customerPhone}
                                  doctorName={booking.assignedDoctor}
                                  mode="admin"
                                  clinicName={clinic?.name}
                                />
                              </div>
                            </div>

                          </div>
                        )}

                        {/* NOTES TAB */}
                        {getModalTab(booking.id) === 'notes' && (
                          <div className="p-4">
                            <BookingNotesThread bookingId={booking.id} authorType="clinic_admin" />
                          </div>
                        )}

                        {/* ACTIONS TAB */}
                        {getModalTab(booking.id) === 'actions' && (
                          <div className="p-4 space-y-3">

                            {/* Reschedule */}
                            <div className="rounded-xl border border-green-800/30 bg-white shadow-sm overflow-hidden">
                              <div className="px-3 py-2 bg-green-50 border-b border-green-800/30 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <CalendarDays className="h-3 w-3 text-green-800" />
                                  <span className="text-xs font-semibold uppercase tracking-wide text-green-800">Reschedule Appointment</span>
                                </div>
                                {rescheduleBookingId === booking.id ? (
                                  <button
                                    className="text-xs font-semibold text-muted-foreground hover:text-foreground active:text-foreground transition-colors min-h-[44px] px-2"
                                    onClick={() => { setRescheduleBookingId(null); setRescheduleSlot(null); }}
                                    data-testid="button-cancel-reschedule"
                                  >
                                    Collapse ↑
                                  </button>
                                ) : (
                                  <button
                                    className="text-xs font-semibold text-primary hover:text-primary/80 active:text-primary/60 transition-colors min-h-[44px] px-2"
                                    onClick={() => { setRescheduleBookingId(booking.id); setRescheduleDate(new Date(booking.slot.startTime)); }}
                                    data-testid="button-start-reschedule"
                                  >
                                    Change →
                                  </button>
                                )}
                              </div>
                              {rescheduleBookingId !== booking.id && (
                                <div className="px-3 py-2.5">
                                  <p className="text-xs text-muted-foreground">Current: <span className="font-medium text-foreground">{format(bookingDateTime, "EEE, MMM d")} · {format(bookingDateTime, "h:mm a")} → {format(new Date(booking.slot.endTime), "h:mm a")}</span></p>
                                </div>
                              )}
                              {rescheduleBookingId === booking.id && (
                                <div className="px-3 py-3 space-y-3">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Select Date</span>
                                      <span className="text-xs text-muted-foreground">{format(rescheduleDate, "MMMM yyyy")}</span>
                                    </div>
                                    <ScrollArea className="w-full whitespace-nowrap pb-1">
                                      <div className="flex space-x-1.5 w-max pb-1">
                                        {dates.map((date) => (
                                          <button
                                            key={date.toISOString()}
                                            onClick={() => { setRescheduleDate(date); setRescheduleSlot(null); }}
                                            className={`flex flex-col items-center justify-center min-w-[2.75rem] h-11 rounded-xl border transition-all text-center active:scale-[0.96] ${
                                              isSameDay(date, rescheduleDate)
                                                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                                                : 'bg-background border-border/60 hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10'
                                            }`}
                                            data-testid={`reschedule-date-${format(date, 'yyyy-MM-dd')}`}
                                          >
                                            <span className="text-xs uppercase font-bold opacity-70 leading-none">{format(date, "EEE")}</span>
                                            <span className="text-sm font-black leading-tight">{format(date, "d")}</span>
                                          </button>
                                        ))}
                                      </div>
                                      <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider block">Select Slot</span>
                                      {rescheduleAvailFetching && (
                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                      )}
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                                      {slotTimings.map((slot, slotIdx) => {
                                        const avail = rescheduleSlotAvailability?.find(a => a.slotIndex === slotIdx);
                                        const isSlotCancelled = avail?.isCancelled ?? false;
                                        const spotsLeft = avail ? avail.spotsLeft : (DEFAULT_SECTION_CAPACITY[slot.id] ?? 3);
                                        const isFull = avail ? avail.spotsLeft === 0 : false;
                                        const isSelected = rescheduleSlot === slot.id;
                                        if (isSlotCancelled) return null;
                                        return (
                                          <button
                                            key={slot.id}
                                            onClick={() => !isFull && setRescheduleSlot(slot.id)}
                                            disabled={isFull}
                                            className={`relative flex flex-col items-center justify-center h-14 rounded-xl border text-center transition-all active:scale-[0.96] ${
                                              isSelected
                                                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                                                : isFull
                                                ? 'bg-muted/30 border-border/40 opacity-50 cursor-not-allowed'
                                                : 'bg-background border-border/60 hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10'
                                            }`}
                                            data-testid={`reschedule-slot-${slot.id}`}
                                          >
                                            <span className="text-xs font-bold leading-tight px-1 text-center">{slot.label}</span>
                                            <span className="text-xs opacity-60 leading-tight mt-0.5">{formatTime(slot.startHour, slot.startMinute)}</span>
                                            {isFull ? (
                                              <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold bg-destructive text-destructive-foreground px-1 rounded-full">FULL</span>
                                            ) : avail && spotsLeft <= 2 ? (
                                              <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold bg-amber-500 text-white px-1 rounded-full">{spotsLeft} left</span>
                                            ) : null}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <Button
                                    className="w-full h-9 text-xs font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0"
                                    disabled={!rescheduleSlot || rescheduleMutation.isPending}
                                    onClick={async () => {
                                      if (!rescheduleSlot) return;
                                      const slotInfo = slotTimings.find(s => s.id === rescheduleSlot);
                                      if (!slotInfo) return;
                                      const newSlotTime = new Date(rescheduleDate);
                                      newSlotTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
                                      try {
                                        const rescheduleBracket = slotTimings.find(s => s.id === rescheduleSlot);
                                        const rescheduleDefaultMax = rescheduleBracket ? (DEFAULT_SECTION_CAPACITY[rescheduleBracket.id] ?? 4) : 4;
                                        const configResponse = await apiRequest('POST', '/api/auth/clinic/slots/configure', {
                                          startTime: newSlotTime.toISOString(), maxBookings: rescheduleDefaultMax, isCancelled: false
                                        });
                                        if (!configResponse.ok) throw new Error('Failed to ensure slot exists');
                                        const configResult = await configResponse.json();
                                        const newSlotId = configResult.id;
                                        if (newSlotId) {
                                          rescheduleMutation.mutate({ bookingId: booking.id, newSlotId });
                                        } else {
                                          throw new Error("Invalid slot ID received from server");
                                        }
                                      } catch (error: any) {
                                        notify.apiError(error, "Failed to reschedule");
                                      }
                                    }}
                                    data-testid="button-confirm-reschedule"
                                  >
                                    {rescheduleMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                    Confirm Reschedule
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Digital Consent */}
                            <div className="rounded-xl border border-green-800/30 bg-white shadow-sm overflow-hidden">
                              <div className="px-3 py-2 bg-green-50 border-b border-green-800/30 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <ClipboardCheck className="h-3 w-3 text-green-800" />
                                  <span className="text-xs font-semibold uppercase tracking-wide text-green-800">Request Digital Consent</span>
                                </div>
                                {booking.consentSignedAt ? (
                                  <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="h-3 w-3" /> Signed
                                  </span>
                                ) : (
                                  <button
                                    className="text-xs font-semibold text-primary hover:text-primary/80 active:text-primary/60 transition-colors disabled:opacity-50 min-h-[36px] px-1"
                                    onClick={() => requestConsentMutation.mutate(booking.id)}
                                    disabled={requestConsentMutation.isPending && requestConsentMutation.variables === booking.id}
                                    data-testid={`button-request-consent-${booking.id}`}
                                  >
                                    {requestConsentMutation.isPending && requestConsentMutation.variables === booking.id
                                      ? "Sending…"
                                      : consentUrls[booking.id] ? "Resend →" : "Send Link →"}
                                  </button>
                                )}
                              </div>
                              {!booking.consentSignedAt && (
                                <div className="px-3 py-2.5">
                                  {consentUrls[booking.id] ? (
                                    <div className="space-y-2">
                                      <p className="text-xs text-muted-foreground">
                                        WhatsApp link sent to <strong>{booking.customerPhone}</strong>. Share manually if needed:
                                      </p>
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1 bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground font-mono truncate">
                                          {consentUrls[booking.id]}
                                        </div>
                                        <button
                                          className="shrink-0 p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 active:bg-muted/60 transition-colors"
                                          onClick={() => { navigator.clipboard.writeText(consentUrls[booking.id]); setCopiedConsentId(booking.id); setTimeout(() => setCopiedConsentId(null), 2000); }}
                                          data-testid={`button-copy-consent-actions-${booking.id}`}
                                        >
                                          {copiedConsentId === booking.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                                        </button>
                                        <a href={consentUrls[booking.id]} target="_blank" rel="noopener noreferrer" className="shrink-0 p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 active:bg-muted/60 transition-colors" data-testid={`link-open-consent-actions-${booking.id}`}>
                                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                        </a>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Send a digital consent form to the patient via WhatsApp or SMS.</p>
                                  )}
                                </div>
                              )}
                              {booking.consentSignedAt && (
                                <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Signed on {format(new Date(booking.consentSignedAt), "dd MMM yyyy, hh:mm a")}
                                  </span>
                                  {booking.consentSignature && (
                                    <button
                                      className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 active:text-primary/60 transition-colors min-h-[36px] px-1"
                                      onClick={() => generateConsentPdf(booking, clinic as ClinicInfo)}
                                      data-testid={`button-download-consent-actions-${booking.id}`}
                                    >
                                      <Download className="h-3 w-3" />
                                      Download PDF
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Assign Doctor */}
                            {booking.visitStatus !== 'completed' && (clinic?.doctorName || (clinic?.doctors && (clinic.doctors as any[]).length > 0)) && (() => {
                              const bookingDateStr = format(new Date(booking.slot.startTime), 'yyyy-MM-dd');
                              const isOOO = (email?: string, name?: string) =>
                                allDoctorLeaves.some(l =>
                                  l.leaveDate === bookingDateStr &&
                                  ((email && l.doctorEmail === email) || (name && l.doctorName === name))
                                );
                              const oooReason = (email?: string, name?: string) =>
                                allDoctorLeaves.find(l =>
                                  l.leaveDate === bookingDateStr &&
                                  ((email && l.doctorEmail === email) || (name && l.doctorName === name))
                                )?.reason;
                              return (
                                <div className="rounded-xl border border-green-800/30 bg-white shadow-sm overflow-hidden">
                                  <div className="px-3 py-2 bg-green-50 border-b border-green-800/30 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <Stethoscope className="h-3 w-3 text-green-800" />
                                      <span className="text-xs font-semibold uppercase tracking-wide text-green-800">Assign Doctor</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{format(new Date(booking.slot.startTime), "MMM d · h:mm a")}</span>
                                  </div>

                                  {/* Specialist suggestion banner */}
                                  {(() => {
                                    const suggested = getRecommendedSpecialists(booking.description || "");
                                    if (!suggested.length) return null;
                                    return (
                                      <div className="mx-2.5 mt-2.5 px-3 py-2 rounded-lg bg-primary/6 border border-primary/20 flex items-start gap-2">
                                        <Lightbulb className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold uppercase tracking-wider text-primary/70 mb-1">Suggested specialization</p>
                                          <div className="flex flex-wrap gap-1">
                                            {suggested.map(sp => (
                                              <span key={sp} className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                                                {sp}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  <div className="p-2.5 space-y-1.5">
                                    {clinic?.doctorName && (() => {
                                      const isAssigned = booking.assignedDoctor === clinic.doctorName;
                                      const outOfOffice = isOOO(undefined, clinic.doctorName);
                                      const reason = oooReason(undefined, clinic.doctorName);
                                      const suggested = getRecommendedSpecialists(booking.description || "");
                                      const isBestMatch = suggested.length > 0 && suggested.some(sp =>
                                        (clinic.doctorSpecialization || "").toLowerCase().includes(sp.toLowerCase()) ||
                                        sp.toLowerCase().includes((clinic.doctorSpecialization || "").toLowerCase())
                                      );
                                      const btn = (
                                        <button
                                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                            isAssigned
                                              ? 'bg-primary border-primary shadow-md shadow-primary/20'
                                              : outOfOffice
                                              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 opacity-80 hover:opacity-100'
                                              : isBestMatch
                                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-400 hover:shadow-sm'
                                              : 'bg-background border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm'
                                          }`}
                                          onClick={(e) => { e.stopPropagation(); assignDoctorMutation.mutate({ bookingId: booking.id, doctorName: clinic.doctorName!, doctorEmail: undefined }); }}
                                          disabled={assignDoctorMutation.isPending}
                                        >
                                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isAssigned ? 'bg-white/20 border border-white/30' : 'bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20'}`}>
                                            <span className={`text-xs font-bold ${isAssigned ? 'text-white' : 'text-primary'}`}>{clinic.doctorName.charAt(0)}</span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-semibold leading-tight truncate ${isAssigned ? 'text-white' : 'text-foreground'}`}>{clinic.doctorName}</p>
                                            <p className={`text-xs ${isAssigned ? 'text-white/70' : outOfOffice ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                              {outOfOffice ? <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />Out of office</span> : (clinic.doctorSpecialization || 'Lead Doctor')}
                                            </p>
                                          </div>
                                          {isAssigned && <CheckCircle2 className="h-4 w-4 text-white shrink-0" />}
                                          {!isAssigned && isBestMatch && (
                                            <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                                              Best match
                                            </span>
                                          )}
                                        </button>
                                      );
                                      return outOfOffice ? (
                                        <TooltipProvider key="lead" delayDuration={500}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs max-w-[200px] bg-amber-900 text-amber-100 border-amber-700">
                                              <p className="font-semibold">Out of office on {format(new Date(booking.slot.startTime), 'MMM d')}</p>
                                              {reason && <p className="text-amber-300 mt-0.5">{reason}</p>}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : btn;
                                    })()}
                                    {clinic?.doctors && Array.isArray(clinic.doctors) && (clinic.doctors as any[]).map((doctor, idx) => {
                                      const isAssigned = booking.assignedDoctor === doctor.name;
                                      const outOfOffice = isOOO(doctor.email, doctor.name);
                                      const reason = oooReason(doctor.email, doctor.name);
                                      const suggestedForDoc = getRecommendedSpecialists(booking.description || "");
                                      const isBestMatchDoc = suggestedForDoc.length > 0 && suggestedForDoc.some(sp =>
                                        (doctor.specialization || "").toLowerCase().includes(sp.toLowerCase()) ||
                                        sp.toLowerCase().includes((doctor.specialization || "").toLowerCase())
                                      );
                                      const btn = (
                                        <button
                                          key={idx}
                                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                            isAssigned
                                              ? 'bg-primary border-primary shadow-md shadow-primary/20'
                                              : outOfOffice
                                              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 opacity-80 hover:opacity-100'
                                              : isBestMatchDoc
                                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-400 hover:shadow-sm'
                                              : 'bg-background border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm'
                                          }`}
                                          onClick={(e) => { e.stopPropagation(); assignDoctorMutation.mutate({ bookingId: booking.id, doctorName: doctor.name, doctorEmail: doctor.email }); }}
                                          disabled={assignDoctorMutation.isPending}
                                        >
                                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isAssigned ? 'bg-white/20 border border-white/30' : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-300/30'}`}>
                                            <span className={`text-xs font-bold ${isAssigned ? 'text-white' : 'text-emerald-600'}`}>{doctor.name.charAt(0)}</span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-semibold leading-tight truncate ${isAssigned ? 'text-white' : 'text-foreground'}`}>Dr. {doctor.name}</p>
                                            <p className={`text-xs ${isAssigned ? 'text-white/70' : outOfOffice ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                              {outOfOffice ? <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />Out of office</span> : `${doctor.specialization}${doctor.degree ? ` · ${doctor.degree}` : ''}`}
                                            </p>
                                          </div>
                                          {isAssigned && <CheckCircle2 className="h-4 w-4 text-white shrink-0" />}
                                          {!isAssigned && isBestMatchDoc && (
                                            <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                                              Best match
                                            </span>
                                          )}
                                        </button>
                                      );
                                      return outOfOffice ? (
                                        <TooltipProvider key={idx} delayDuration={500}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs max-w-[200px] bg-amber-900 text-amber-100 border-amber-700">
                                              <p className="font-semibold">Out of office on {format(new Date(booking.slot.startTime), 'MMM d')}</p>
                                              {reason && <p className="text-amber-300 mt-0.5">{reason}</p>}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : btn;
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                          </div>
                        )}

                        {/* BILLING TAB */}
                        {getModalTab(booking.id) === 'billing' && (
                          <div className="p-4">
                            <BillingHistoryPanel
                              bookingId={booking.id}
                              clinicId={clinic.id}
                              patientName={booking.customerName}
                              patientId={(booking as any).patientId || undefined}
                              patientPhone={booking.customerPhone}
                              patientEmail={booking.customerEmail || ""}
                              patientCode={(booking as any).patientCode || undefined}
                              onGenerateReceipt={(existingBill) => handleOpenBilling(booking, existingBill)}
                              onPrintBill={(bill) => printBillFromRecord(bill, clinic as ClinicInfo, bookings ?? [])}
                              onConsolidatedReceipt={(bills) => handleConsolidatedBilling(booking, bills)}
                            />
                          </div>
                        )}

                      </div>

                      {/* ── PERSISTENT FOOTER — lifecycle-aware ── */}
                      <div className="shrink-0 px-4 py-2.5 border-t border-border/50 bg-muted/10 space-y-2">

                        {/* Cancel dialog (shared, single instance) */}
                        {(() => {
                          const CancelDialog = ({ trigger }: { trigger: React.ReactNode }) => (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will cancel {booking.customerName}'s appointment and send them a cancellation email.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="px-1 py-2 space-y-3">
                                  <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Reason for cancellation</label>
                                    <select
                                      value={cancelReason}
                                      onChange={e => { setCancelReason(e.target.value); setCancelReasonOther(""); }}
                                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                      <option value="">Select a reason…</option>
                                      <option value="Patient requested cancellation">Patient requested cancellation</option>
                                      <option value="Doctor unavailable">Doctor unavailable</option>
                                      <option value="Clinic closure / emergency">Clinic closure / emergency</option>
                                      <option value="Patient no-show">Patient no-show</option>
                                      <option value="Rescheduled to another slot">Rescheduled to another slot</option>
                                      <option value="Other">Other</option>
                                    </select>
                                  </div>
                                  {cancelReason === "Other" && (
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium text-foreground">Please specify</label>
                                      <Input
                                        value={cancelReasonOther}
                                        onChange={e => setCancelReasonOther(e.target.value)}
                                        placeholder="e.g. Patient requested cancellation"
                                        autoFocus
                                      />
                                    </div>
                                  )}
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => { setCancelReason(""); setCancelReasonOther(""); }}>Back</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => cancelBookingMutation.mutate({ id: booking.id, reason: cancelReason === "Other" ? cancelReasonOther.trim() : cancelReason })}
                                    className="bg-destructive text-destructive-foreground"
                                    disabled={!cancelReason || (cancelReason === "Other" && !cancelReasonOther.trim())}
                                  >
                                    Cancel Booking
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          );

                          /* ── Stage 5: Visit Completed ── */
                          if (modalIsVisitCompleted) {
                            const modalBookingBills = allBills.filter(b => b.bookingId === booking.id);
                            const modalNoBill = modalBookingBills.length === 0;
                            const modalOpenBills = modalBookingBills.filter(b => b.paymentStatus !== 'paid').length;
                            return (
                            <>
                              {modalNoBill ? (
                                <Button
                                  variant="outline"
                                  className="w-full gap-1.5 h-11 text-sm font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/10 cursor-default pointer-events-none border-0"
                                  disabled
                                  data-testid={`button-dialog-no-dues-${booking.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4" />No Dues
                                </Button>
                              ) : modalOpenBills > 0 ? (
                                <Button
                                  className="w-full gap-1.5 h-11 text-sm font-semibold border border-amber-400 bg-amber-50/60 text-amber-700 hover:bg-amber-100/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/40 active:scale-[0.98] transition-all"
                                  variant="outline"
                                  onClick={() => handleOpenBilling(booking)}
                                  title="Payment outstanding — tap to settle"
                                  data-testid={`button-dialog-settle-bill-${booking.id}`}
                                >
                                  Payment Pending
                                </Button>
                              ) : (
                                <Button
                                  className="w-full gap-1.5 h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-all border-0"
                                  onClick={() => handleOpenBilling(booking)}
                                  title="Preview or download invoice"
                                  data-testid={`button-dialog-bill-done-${booking.id}`}
                                >
                                  <Download className="h-4 w-4" />Paid
                                </Button>
                              )}
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm"
                                  className="flex-1 h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                                  onClick={() => setOpenBookingId(null)}
                                  data-testid={`button-dialog-summary-${booking.id}`}>
                                  <ClipboardList className="h-3 w-3" />View Summary
                                </Button>
                                <Button variant="outline" size="sm"
                                  className="flex-1 h-9 text-xs font-medium text-primary hover:text-primary hover:bg-primary/5 gap-1.5 active:scale-[0.98]"
                                  onClick={() => {
                                    const _d = booking.description ?? "";
                                    const _rd = _d.split(/\s*\|\s*/).filter((p: string) => !p.startsWith("Category:") && !p.startsWith("Visit:") && !p.startsWith("Age:") && !p.startsWith("Gender:")).join(", ").trim();
                                    const _rv = (_d.match(/Visit:\s*([^|]+)/)?.[1] ?? "").trim();
                                    const _rc = (_d.match(/Category:\s*([^|]+)/)?.[1] ?? "").trim();
                                    persistRebookValues({
                                      bookingName: booking.customerName,
                                      bookingPhone: booking.customerPhone,
                                      bookingEmail: booking.customerEmail || "",
                                      bookingAge: String((booking as any).customerAge || ""),
                                      bookingGender: (booking as any).customerGender || "",
                                      bookingDescription: _rd,
                                      bookingVisitType: _rv,
                                      bookingAppointmentCategory: _rc,
                                    });
                                    onNavigate('book-a-slot'); setOpenBookingId(null);
                                  }}
                                  data-testid={`button-dialog-rebook-${booking.id}`}>
                                  <CalendarPlus className="h-3 w-3" />Rebook
                                </Button>
                              </div>
                            </>
                          );
                          }

                          /* ── Stage 4: Treatment Completed → Mark Visit Done ── */
                          if (modalIsTreatmentCompleted) return (
                            <>
                              <Button
                                className="w-full gap-1.5 h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-all border-0"
                                onClick={() => completeVisitMutation.mutate({ bookingId: booking.id })}
                                disabled={completeVisitMutation.isPending}
                                data-testid={`button-dialog-visit-done-${booking.id}`}
                              >
                                {completeVisitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                Mark Visit Done
                              </Button>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm"
                                  className="flex-1 h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                                  onClick={() => handleOpenBilling(booking)}
                                  data-testid={`button-dialog-bill-tmt-${booking.id}`}>
                                  <IndianRupee className="h-3 w-3" />₹ Bill
                                </Button>
                                <CancelDialog trigger={
                                  <Button variant="ghost" size="sm"
                                    className="flex-1 h-9 text-xs font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/5 gap-1.5 active:scale-[0.98]"
                                    data-testid={`button-dialog-cancel-tmt-${booking.id}`}>
                                    <X className="h-3 w-3" />Cancel
                                  </Button>
                                } />
                              </div>
                            </>
                          );

                          /* ── Stage 3: In Consultation ── */
                          if (modalIsInConsultation) return (
                            <>
                              <Button variant="outline"
                                className="w-full h-11 text-sm font-medium text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-950/10 cursor-not-allowed gap-2 pointer-events-none"
                                disabled data-testid={`button-dialog-in-tmt-${booking.id}`}>
                                <Activity className="h-4 w-4" />In Treatment
                              </Button>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm"
                                  className="flex-1 h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                                  onClick={() => handleOpenBilling(booking)}
                                  data-testid={`button-dialog-bill-consult-${booking.id}`}>
                                  <IndianRupee className="h-3 w-3" />₹ Bill
                                </Button>
                                <CancelDialog trigger={
                                  <Button variant="ghost" size="sm"
                                    className="flex-1 h-9 text-xs font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/5 gap-1.5 active:scale-[0.98]"
                                    data-testid={`button-dialog-cancel-consult-${booking.id}`}>
                                    <X className="h-3 w-3" />Cancel
                                  </Button>
                                } />
                              </div>
                            </>
                          );

                          /* ── Stage 2: Checked In / Arrived ── */
                          if (modalIsCheckedIn) return (
                            <>
                              <Button variant="outline"
                                className="w-full h-11 text-sm font-medium text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 cursor-not-allowed gap-2 pointer-events-none"
                                disabled data-testid={`button-dialog-waiting-${booking.id}`}>
                                <Clock className="h-4 w-4" />Waiting for Doctor
                              </Button>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm"
                                  className="flex-1 h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                                  onClick={() => handleOpenBilling(booking)}
                                  data-testid={`button-dialog-bill-checkin-${booking.id}`}>
                                  <IndianRupee className="h-3 w-3" />₹ Bill
                                </Button>
                                <CancelDialog trigger={
                                  <Button variant="ghost" size="sm"
                                    className="flex-1 h-9 text-xs font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/5 gap-1.5 active:scale-[0.98]"
                                    data-testid={`button-dialog-cancel-checkin-${booking.id}`}>
                                    <X className="h-3 w-3" />Cancel
                                  </Button>
                                } />
                              </div>
                            </>
                          );

                          /* ── Terminal: Cancelled / No-show / Left Early ── */
                          if (modalIsTerminal) return (
                            <Button variant="outline"
                              className="w-full h-11 text-sm font-medium text-primary hover:text-primary hover:bg-primary/5 gap-2 active:scale-[0.98] transition-all"
                              onClick={() => {
                                const _d = booking.description ?? "";
                                const _rd = _d.split(/\s*\|\s*/).filter((p: string) => !p.startsWith("Category:") && !p.startsWith("Visit:") && !p.startsWith("Age:") && !p.startsWith("Gender:")).join(", ").trim();
                                const _rv = (_d.match(/Visit:\s*([^|]+)/)?.[1] ?? "").trim();
                                const _rc = (_d.match(/Category:\s*([^|]+)/)?.[1] ?? "").trim();
                                persistRebookValues({
                                  bookingName: booking.customerName,
                                  bookingPhone: booking.customerPhone,
                                  bookingEmail: booking.customerEmail || "",
                                  bookingAge: String((booking as any).customerAge || ""),
                                  bookingGender: (booking as any).customerGender || "",
                                  bookingDescription: _rd,
                                  bookingVisitType: _rv,
                                  bookingAppointmentCategory: _rc,
                                });
                                onNavigate('book-a-slot'); setOpenBookingId(null);
                              }}
                              data-testid={`button-dialog-rebook-terminal-${booking.id}`}>
                              <Repeat2 className="h-4 w-4" />Rebook
                            </Button>
                          );

                          /* ── Stage 0/1: Pre-arrival (unconfirmed or confirmed) ── */
                          return (
                            <>
                              {!isBookingPast && !isConfirmed && (
                                <Button
                                  className="w-full gap-1.5 h-11 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] border-0 shadow-md shadow-emerald-500/20 text-white transition-all"
                                  onClick={() => confirmBookingMutation.mutate(booking.id)}
                                  disabled={confirmBookingMutation.isPending}
                                  data-testid={`button-dialog-confirm-${booking.id}`}
                                >
                                  {confirmBookingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                  Confirm
                                </Button>
                              )}
                              {isConfirmed && (
                                <div className="flex items-center gap-1.5 px-3 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  <span className="text-xs font-semibold">Confirmed</span>
                                  {booking.confirmedBy && (
                                    <span className="text-xs font-normal opacity-75">· by {booking.confirmedBy === 'doctor' ? `Dr. ${booking.assignedDoctor || 'Doctor'}` : 'Admin'}</span>
                                  )}
                                </div>
                              )}
                              <CancelDialog trigger={
                                <Button
                                  variant="outline"
                                  className="w-full gap-1.5 h-11 text-sm font-bold text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50 active:bg-destructive/10 active:scale-[0.98] transition-all"
                                  data-testid={`button-dialog-cancel-${booking.id}`}
                                >
                                  <X className="h-3.5 w-3.5" />Cancel
                                </Button>
                              } />
                            </>
                          );
                        })()}
                      </div>

                    </DialogContent>
                </Dialog>
                  )
                ].filter(Boolean) as React.ReactNode[];
                });
              })()
            )}

          </div>
          {isFetchingNextPage && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {[1,2,3].map(i => <BookingCardSkeleton key={i} />)}
            </div>
          )}
          {!hasNextPage && !bookingsLoading && filteredBookings.length > 0 && (
            <p className="text-center text-xs text-muted-foreground/60 py-3 tabular-nums">
              All {bookingsTotal} bookings loaded
            </p>
          )}
          <div ref={sentinelRef} className="h-2" />
          </>
        )}
        </div>
        </div>
          </div>
  );
}
