import QRCode from "react-qr-code";
import ClinicProfilePanel from "@/components/ClinicProfilePanel";
import ManageDoctorsPanel from "@/components/ManageDoctorsPanel";
import AccountsPanel from "@/components/AccountsPanel";
import PatientDirectoryPanel from "@/components/PatientDirectoryPanel";
import { ImageUpload } from "@/components/ImageUpload";
import ExportDataPanel from "@/components/ExportDataPanel";
import { BookingNotesThread } from "@/components/BookingNotesThread";
import ClinicalRecordsTab from "@/components/ClinicalRecordsTab";
import { InventoryPanel } from "@/components/InventoryPanel";
import PharmacyStockPanel from "@/components/PharmacyStockPanel";
import WebsiteConfigPanel from "@/components/WebsiteConfigPanel";
import { BillingHistoryPanel } from "@/components/BillingHistoryPanel";
import ClinicAnalyticsPanel from "@/components/ClinicAnalyticsPanel";
import ConsentFormPanel from "@/components/ConsentFormPanel";
import ConfigureSlotsPanel from "@/components/ConfigureSlotsPanel";
import BookASlotPanel from "@/components/BookASlotPanel";
import BookingsPanel from "@/components/BookingsPanel";
import {
  type BillingService, type BillingDetails, type ClinicInfo,
  generateReceiptPDF, printBillFromRecord, generateConsentPdf,
} from "@/lib/clinic-pdf";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import {
  Loader2, Calendar as CalendarIcon, Phone, Clock, Building2, LogOut, X, UserCheck,
  Download, Plus, ChevronDown, ChevronUp, CheckCircle2, IndianRupee, FileText, ScrollText,
  User, Mail, CalendarDays, FlaskConical, Settings, TrendingUp, History, Filter, Copy, Check,
  Globe, Lock, ExternalLink, MapPin, Info, ClipboardCheck, PenLine, Link2, ClipboardList, Package, AlertTriangle, AlertCircle, CreditCard,
  Users, Search, ArrowUpDown, BadgeCheck, MoreHorizontal, Sun, Moon,
  ChevronLeft, ChevronRight, Save, Hash, Pill, Printer, ArrowLeft, ArrowRight,
  Stethoscope, Trash2, Upload, Repeat2, Tag, UserX, ShieldCheck, Activity, CalendarPlus, RefreshCw, Lightbulb,
} from "lucide-react";
import {
  ToothIcon, SlotTiming, SectionConfig, DayConfig, BookingWithSlot,
  OVERVIEW_VISIT_TYPE_LABELS, OVERVIEW_CLINICAL_STATUS,
  DEFAULT_SLOT_TIMINGS, DEFAULT_SECTION_CAPACITY, PROCEDURE_SLOT_COST,
  DENTAL_CATEGORIES, CHIEF_COMPLAINTS, getRecommendedSpecialists,
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
import { format, startOfDay, endOfDay, startOfToday, addDays, isSameDay, differenceInCalendarDays, startOfWeek, endOfWeek, addWeeks, isAfter } from "date-fns";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ElementType } from "react";
import type { Slot, Booking, PatientBill, ClinicalRecord, Patient } from "@shared/schema";
import { BookingProgressStrip, type LifecycleStage } from "@/components/BookingProgressStrip";
import { AppointmentCard } from "@/components/AppointmentCard";
import { filterAndSortBookings, getBookingDisplayMeta, getBookingNumber } from "@/lib/booking-list";

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

function ClinicDashboardSkeleton() {
  return (
    <div className="w-full px-4 py-6 pb-24 sm:px-6 lg:px-8 2xl:px-16 lg:pb-0">
      {/* Header skeleton — mirrors dark gradient hero */}
      <div className="rounded-2xl overflow-hidden shadow-2xl mb-6 sm:mb-8 border border-white/10">
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />
        <div className="bg-gradient-to-br from-[#052B22] via-[#085041] to-[#0A5540] px-5 py-3 sm:px-7 sm:py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5">
              <Skeleton className="h-16 w-16 rounded-2xl bg-white/10 shrink-0" />
              <div className="space-y-2.5">
                <Skeleton className="h-7 w-40 rounded-lg bg-white/10" />
                <div className="flex gap-2 flex-wrap">
                  <Skeleton className="h-6 w-28 rounded-full bg-white/10" />
                  <Skeleton className="h-6 w-14 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-lg bg-white/10 shrink-0" />
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.10] grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl bg-white/10" />
            ))}
          </div>
        </div>
      </div>

      {/* Tab nav skeleton */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2 mb-5">
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      {/* Booking cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <BookingCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function ClinicDashboard() {
  const { clinic, isLoading: authLoading, isAuthenticated, logout, isLoggingOut, refetch: refetchClinic } = useClinicAuth();
  const [_, setLocation] = useLocation();

  const updateLogoMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      const response = await apiRequest('PATCH', '/api/auth/clinic/me', { logoUrl });
      if (!response.ok) throw new Error('Failed to update logo');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinic) refetchClinic();
      notify.success("Logo updated");
    },
  });

  // ── Tab badge dots + notification highlight (Issues 3 & 4) ───────────────
  const [tabBadges, setTabBadges] = useState<Record<number, string[]>>({});
  const [notifHighlight, setNotifHighlight] = useState<{ bookingId: number; tab: string; ts: number } | null>(null);

  // ── Notification deep-link helpers ────────────────────────────────────────
  const applyClinicNotifNav = (detail: { bookingId?: number; notifType?: string; panel?: string }) => {
    const tabMap: Record<string, "overview" | "clinical" | "notes" | "actions" | "billing"> = {
      clinical_record_created: "clinical",
      clinical_record_updated: "clinical",
      case_closed_by_doctor: "clinical",
      booking_note_added: "notes",
      consent_requested: "actions",
      consent_signed: "actions",
    };
    if (detail.panel) {
      setActivePanel(detail.panel as any);
    } else if (detail.bookingId) {
      setActivePanel("bookings");
      setOpenBookingId(detail.bookingId);
      if (detail.notifType && tabMap[detail.notifType]) {
        const tab = tabMap[detail.notifType];
        setModalTab(detail.bookingId, tab);
        // Issue 3: highlight the panel briefly
        const ts = Date.now();
        setNotifHighlight({ bookingId: detail.bookingId, tab, ts });
        setTimeout(() => setNotifHighlight(prev => prev?.ts === ts ? null : prev), 2500);
        // Issue 4: add badge dot on the tab
        setTabBadges(prev => {
          const current = prev[detail.bookingId!] || [];
          if (current.includes(tab)) return prev;
          return { ...prev, [detail.bookingId!]: [...current, tab] };
        });
      }
    }
  };

  // Case A: user already on /clinic-dashboard — custom event fires directly
  useEffect(() => {
    const handler = (e: Event) => {
      applyClinicNotifNav((e as CustomEvent).detail);
    };
    window.addEventListener("notif-navigate", handler);
    return () => window.removeEventListener("notif-navigate", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Case B: user navigated from a different page — pick up from sessionStorage on mount
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingNotifNav");
    if (!pending) return;
    sessionStorage.removeItem("pendingNotifNav");
    try {
      applyClinicNotifNav(JSON.parse(pending));
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ──────────────────────────────────────────────────────────────────────────

  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'upcoming' | 'past' | 'this-week' | 'next-week' | 'today-confirmed' | 'pending-7days' | 'all-pending' | 'confirmed-7days'>('today');
  const bookingsSectionRef = useRef<HTMLDivElement>(null);
  const [copiedUrlType, setCopiedUrlType] = useState<'booking' | 'about' | null>(null);

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
  const [heroStatsCollapsed, setHeroStatsCollapsed] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOther, setCancelReasonOther] = useState("");

  // Modal tab state — keyed by booking id
  const [modalTabs, setModalTabs] = useState<Record<number, 'overview' | 'clinical' | 'notes' | 'actions' | 'billing'>>({});
  const getModalTab = (id: number) => modalTabs[id] ?? 'overview';
  const setModalTab = (id: number, tab: 'overview' | 'clinical' | 'notes' | 'actions' | 'billing') =>
    setModalTabs(prev => ({ ...prev, [id]: tab }));
  // Controls which booking's detail dialog is open (state-driven, replaces DialogTrigger)
  const [openBookingId, setOpenBookingId] = useState<number | null>(null);

  // Reschedule state
  const [rescheduleBookingId, setRescheduleBookingId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(startOfToday());
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [consentUrls, setConsentUrls] = useState<Record<number, string>>({});
  const [copiedConsentId, setCopiedConsentId] = useState<number | null>(null);

  // Booking form state
  const [activePanel, setActivePanel] = useState<'bookings' | 'configure-slots' | 'manage-doctors' | 'clinic-profile' | 'book-a-slot' | 'export-data' | 'inventory' | 'pharmacy-stock' | 'website' | 'accounts' | 'patients' | 'analytics' | 'consent-form'>('bookings');
  const [clinicMoreDrawerOpen, setClinicMoreDrawerOpen] = useState(false);


  // Bookings patient search
  const [bookingPatientSearch, setBookingPatientSearch] = useState("");
  const [bookingPatientResults, setBookingPatientResults] = useState<Patient[]>([]);
  const [bookingPatientResultsLoading, setBookingPatientResultsLoading] = useState(false);
  const [activePatientFilter, setActivePatientFilter] = useState<{ id: number; name: string; patientCode: string | null } | null>(null);
  const [patientSearchFocused, setPatientSearchFocused] = useState(false);
  const [patientSearchHighlightIdx, setPatientSearchHighlightIdx] = useState(-1);
  const patientSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patientSearchInputRef = useRef<HTMLInputElement>(null);

  const [slotTimings] = useState<SlotTiming[]>(DEFAULT_SLOT_TIMINGS);


  // All clinic bills — loaded on demand only when the Accounts panel is open
  const { data: allBills = [] } = useQuery<(PatientBill & { patientCode?: string | null })[]>({
    queryKey: ['/api/auth/clinic/bills'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/bills');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && (activePanel === 'accounts' || activePanel === 'bookings'),
  });

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const handleViewPatient = useCallback((patientId: number) => {
    setActivePanel('patients');
    setSelectedPatientId(patientId);
  }, []);


  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')}${period}`;
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

  // Lightweight stats for hero stat cards — fetched independently of the paginated BookingsPanel query
  const { data: bookingHeroStats, isLoading: bookingsLoading } = useQuery<{
    todayCount: number; todayConfirmedCount: number; upcomingCount: number; pastCount: number;
    thisWeekCount: number; nextWeekCount: number; pendingNext7Count: number;
    confirmedNext7Count: number; totalPendingCount: number;
  }>({
    queryKey: ['/api/auth/clinic/bookings/stats'],
    enabled: isAuthenticated && activePanel === 'bookings',
    refetchOnMount: true,
    refetchInterval: activePanel === 'bookings' ? 30_000 : false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/clinic-login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Moved the isAuthenticated check to after all hooks
  const isUserAuthenticated = isAuthenticated;

  // Billing State
  const [isBillingOpen, setIsBillingOpen] = useState(false);
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

  // Derived counts for the hero stat cards — sourced from the server stats endpoint
  const todaysBookingsCount = bookingHeroStats?.todayCount ?? 0;
  const futureBookingsCount = bookingHeroStats?.upcomingCount ?? 0;
  const pastBookingsCount   = bookingHeroStats?.pastCount ?? 0;
  const thisWeekCount       = bookingHeroStats?.thisWeekCount ?? 0;
  const nextWeekCount       = bookingHeroStats?.nextWeekCount ?? 0;

  const handleOpenBilling = async (booking: BookingWithSlot, existingBill?: PatientBill) => {
    setBillingBooking(booking);
    const receiptDate = format(new Date(), "yyyyMMdd");

    // If no bill was explicitly passed (e.g. quick-action button), fetch this
    // booking's bills on demand — avoids any dependency on the eager allBills list.
    let resolvedBill: PatientBill | undefined = existingBill;
    if (!resolvedBill) {
      try {
        const billsRes = await apiRequest("GET", `/api/auth/clinic/bills/booking/${booking.id}`);
        const bookingBills: PatientBill[] = billsRes.ok ? await billsRes.json() : [];
        resolvedBill =
          bookingBills.find(b => b.paymentStatus !== "paid")
          ?? bookingBills[0];
      } catch {
        // fetch failed — proceed with a blank new bill
      }
    }

    let loadedServices: { description: string; amount: string }[];
    let loadedRemarks = resolvedBill?.notes || "";

    if (resolvedBill?.services) {
      // Existing saved bill — load its line items preserving all fields
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
      // No saved bill — fetch the clinical record for this booking and
      // map its diagnosis[] entries into pre-filled service lines.
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

        // Build remarks from clinical prescription + doctor notes on the booking
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
        // Fetch failed — fall back silently
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
    const dateLabel = firstBill?.createdAt
      ? format(new Date(firstBill.createdAt), "yyyyMMdd")
      : format(new Date(), "yyyyMMdd");

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

  const assignDoctorMutation = useMutation({
    mutationFn: async ({ bookingId, doctorName, doctorEmail }: { bookingId: number; doctorName: string; doctorEmail?: string }) => {
      const response = await apiRequest('PATCH', `/api/clinic/bookings/${bookingId}/assign-doctor`, { doctorName, doctorEmail });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      notify.success("Doctor assigned");
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to assign doctor");
    },
  });

  const { data: allDoctorLeaves = [] } = useQuery<{ doctorEmail?: string; doctorName?: string; leaveDate: string; reason?: string | null }[]>({
    queryKey: ['/api/clinic/doctor-leaves/all'],
    enabled: isAuthenticated,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ bookingId, newSlotId }: { bookingId: number; newSlotId: number }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/reschedule`, { newSlotId });
      if (!response.ok) throw new Error('Failed to reschedule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      setRescheduleBookingId(null);
      setRescheduleSlot(null);
      notify.success("Booking rescheduled");
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to reschedule booking");
    },
  });

  const updateClinicalStatusMutation = useMutation({
    mutationFn: async ({ bookingId, clinicalStatus }: { bookingId: number; clinicalStatus: string }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/clinical-status`, { clinicalStatus });
      if (!response.ok) throw new Error('Failed to update clinical status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      notify.success("Clinical status updated");
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to update clinical status");
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ bookingId, undo }: { bookingId: number; undo?: boolean }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/checkin`, { undo: !!undo });
      if (!response.ok) throw new Error('Failed to update check-in status');
      return response.json();
    },
    onSuccess: (_data, { undo }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
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
    onSuccess: () => {
      notify.success("Reminder sent", { description: "WhatsApp message sent to patient." });
    },
    onError: (error: any) => notify.apiError(error, "Failed to send reminder"),
  });

  const overrideCompleteMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: number; reason: string }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/override-complete`, { reason });
      if (!response.ok) throw new Error('Failed to override complete');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      notify.success("Consent request sent", { description: "WhatsApp link sent to the patient." });
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to send consent request");
    },
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
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      notify.success("Booking Confirmed", { description: "A confirmation email has been sent to the patient." });
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to confirm booking");
    },
  });

  if (authLoading || !clinic) {
    return <ClinicDashboardSkeleton />;
  }

  const addServiceRow = () => {
    setBillingDetails(prev => ({
      ...prev,
      services: [...prev.services, { description: "", amount: "" }]
    }));
  };

  const removeServiceRow = (index: number) => {
    if (billingDetails.services.length <= 1) return;
    setBillingDetails(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };

  const updateService = (index: number, field: "description" | "amount", value: string) => {
    setBillingDetails(prev => ({
      ...prev,
      services: prev.services.map((s, i) => i === index ? { ...s, [field]: value } : s)
    }));
  };

  const generatePDF = () => {
    if (!billingBooking) return;
    generateReceiptPDF(billingDetails);
    if (!billingDetails.printOnly) {
      // Save / update bill in database
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

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/clinic-login");
      notify.success("Logged out");
    } catch (error: any) {
      console.error("[CLINIC-DASHBOARD] Logout error:", error);
      // Even if API fails, clear local state and redirect
      setLocation("/clinic-login");
    }
  };


  if (!isUserAuthenticated) {
    return null;
  }

  const todayConfirmedCount = bookingHeroStats?.todayConfirmedCount ?? 0;
  const pendingNext7Count   = bookingHeroStats?.pendingNext7Count ?? 0;
  const totalPendingCount   = bookingHeroStats?.totalPendingCount ?? 0;
  const confirmedNext7Count = bookingHeroStats?.confirmedNext7Count ?? 0;

  return (
    <div className="w-full px-4 py-6 pb-24 sm:px-6 lg:px-8 2xl:px-16 lg:pb-0">

      {/* Subscription payment pending banner */}
      {(clinic as any)?.subscriptionStatus === "pending_payment" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3.5">
          <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-amber-400/20 flex items-center justify-center">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Subscription payment pending</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Your clinic is approved but your subscription is not yet active. Check your email for an activation link to complete payment, or contact support.
            </p>
          </div>
          <a
            href="mailto:bookmyslot@mail.mossaic.in"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors mt-0.5"
            data-testid="link-subscription-support"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Contact support
          </a>
        </div>
      )}

      {/* ═══════════════ PAGE HEADER ═══════════════ */}
      <div className="rounded-2xl overflow-hidden shadow-2xl mb-6 sm:mb-8 border border-white/10">

        {/* Top neon accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Main hero band */}
        <div className="relative bg-gradient-to-br from-[#052B22] via-[#085041] to-[#0A5540] px-5 py-3 sm:px-7 sm:py-6 overflow-hidden">

          {/* Grid texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* Ambient glow orbs — decorative only */}
          <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/20 blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-16 -right-8 w-60 h-60 rounded-full bg-accent/15 blur-[80px] pointer-events-none" />
          {/* Radial highlight */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.07)_0%,transparent_60%)] pointer-events-none" />

          {/*
           * Mobile: column, centred — avatar stacks above title, no side compression.
           * Desktop (sm+): row, space-between — avatar left, sign-out right.
           */}
          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">

            {/* Identity block */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-5 min-w-0 w-full sm:w-auto">

              {/*
               * Logo with glow ring.
               * pointer-events-none on mobile prevents accidental upload triggers
               * when the user taps the hero card. Editable only on sm+ screens.
               */}
              <div className="shrink-0 relative sm:mt-1 pointer-events-none sm:pointer-events-auto">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-accent/35 via-primary/20 to-transparent blur-md pointer-events-none" />
                <div className="relative ring-2 ring-white/25 rounded-2xl">
                  <ImageUpload
                    currentImage={clinic?.logoUrl || undefined}
                    onImageUploaded={(url: string) => updateLogoMutation.mutate(url)}
                    folder="clinics"
                    fallbackText={clinic?.name || "Clinic"}
                    allowedTypes={["image/png", "image/jpeg"]}
                    maxSizeKb={500}
                  />
                </div>
              </div>

              {/* Name + status badges — centred on mobile, left-aligned on sm+ */}
              <div className="min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                    {clinic?.name}
                  </h1>
                  {clinic?.id && clinic.id >= 999 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2.5 py-1 rounded-full">
                      <FlaskConical className="h-3 w-3" />
                      Demo
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full">
                    <Building2 className="h-3 w-3" />
                    {/* Shorter label on mobile to save space */}
                    <span className="sm:hidden">Clinic Admin</span>
                    <span className="hidden sm:inline">Clinic Administration</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Live
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-white/50 bg-white/[0.06] border border-white/15 px-2.5 py-1 rounded-full">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Live stats row ── */}
          <div className="relative mt-5">
            <div className="flex items-center gap-2 pt-4">
              <div className="flex-1 h-px bg-white/10" />
              <button
                onClick={() => setHeroStatsCollapsed(s => !s)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 active:bg-white/15 transition-all active:scale-[0.97] shrink-0 motion-reduce:transition-none"
                title={heroStatsCollapsed ? "Show stats" : "Hide stats"}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${heroStatsCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </div>
            {!heroStatsCollapsed && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Confirmed Bookings Today",            shortLabel: "Confirmed Today",       subTag: null,          filter: 'today-confirmed' as const,  tooltip: "Appointments scheduled for today that have been confirmed by the clinic.",                                             value: todayConfirmedCount, Icon: CalendarIcon, text: "text-sky-300",      bg: "bg-sky-400/10",     border: "border-sky-400/20" },
              { label: "Confirmed Bookings (Next 7 Days)",    shortLabel: "Confirmed Bookings",    subTag: "Next 7 Days", filter: 'confirmed-7days' as const,  tooltip: "Confirmed appointments scheduled within the next 7 days. These are locked in.",                                        value: confirmedNext7Count, Icon: CheckCircle2, text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
              { label: "Pending Confirmations (Next 7 Days)", shortLabel: "Pending Confirmations", subTag: "Next 7 Days", filter: 'pending-7days' as const,    tooltip: "Bookings in the next 7 days that are still waiting for clinic confirmation. These need your attention.",               value: pendingNext7Count,   Icon: Clock,        text: "text-amber-300",   bg: "bg-amber-400/10",   border: "border-amber-400/20" },
              { label: "All Pending Bookings",                shortLabel: "All Pending",           subTag: null,          filter: 'all-pending' as const,      tooltip: "Total bookings across all dates that have not yet been confirmed — includes past and future appointments.",             value: totalPendingCount,   Icon: TrendingUp,   text: "text-rose-300",    bg: "bg-rose-400/10",    border: "border-rose-400/20" },
            ].map(({ label, shortLabel, subTag, filter, tooltip, value, Icon, text, bg, border }, i) => (
              <TooltipProvider key={i} delayDuration={700}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-start gap-2 px-2.5 py-3 rounded-xl border bg-white/[0.04] ${border} cursor-pointer transition-all hover:bg-white/[0.09] hover:scale-[1.02] active:scale-[0.98] min-h-[44px] ${quickFilter === filter ? 'ring-1 ring-white/50 bg-white/[0.09]' : ''}`}
                      onClick={() => {
                        setFilterDate(undefined);
                        setFilterEndDate(undefined);
                        setActivePanel('bookings');
                        setQuickFilter(filter);
                        setTimeout(() => bookingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
                      }}
                      data-testid={`stat-card-${filter}`}
                    >
                      <div className={`shrink-0 ${text} ${bg} p-1.5 rounded-lg mt-0.5`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-2xl sm:text-lg font-extrabold text-white leading-none tabular-nums">
                          {bookingsLoading ? "—" : value}
                        </p>
                        <p className={`text-xs font-semibold mt-1 ${text} leading-snug`}>{shortLabel}</p>
                        {subTag && (
                          <span className={`inline-block text-xs font-medium ${text} opacity-60 mt-0.5 leading-none`}>{subTag}</span>
                        )}
                      </div>
                      <Info className={`h-3 w-3 ${text} ${quickFilter === filter ? 'opacity-80' : 'opacity-50'} shrink-0 mt-1`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            </div>
            )}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="h-[2px] bg-gradient-to-r from-accent via-primary to-accent opacity-60" />
      </div>

      {/* Two-column layout: left sidebar + main content */}
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

        {/* ===== LEFT SIDEBAR NAV ===== */}
        <div className="hidden lg:block lg:w-60 shrink-0">
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="p-2 space-y-0.5">

              {/* 1 — Bookings */}
              <button
                onClick={() => setActivePanel('bookings')}
                data-testid="nav-bookings"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'bookings' ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'bookings' ? 'bg-primary/10 border-primary/20' : 'bg-muted/50 border-border/50'}`}>
                  <CalendarIcon className={`h-4 w-4 ${activePanel === 'bookings' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'bookings' ? 'text-primary' : 'text-foreground'}`}>Bookings</p>
                  <p className="text-xs text-muted-foreground">All appointments</p>
                </div>
                {activePanel === 'bookings' && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
              </button>

              {/* 2 — Book a Slot */}
              <button
                onClick={() => setActivePanel('book-a-slot')}
                data-testid="nav-book-a-slot"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'book-a-slot' ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'book-a-slot' ? 'bg-primary/10 border-primary/20' : 'bg-muted/50 border-border/50'}`}>
                  <Plus className={`h-4 w-4 ${activePanel === 'book-a-slot' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'book-a-slot' ? 'text-primary' : 'text-foreground'}`}>Book a Slot</p>
                  <p className="text-xs text-muted-foreground">New patient appointment</p>
                </div>
                {activePanel === 'book-a-slot' && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
              </button>

              {/* 3 — Patients */}
              <button
                onClick={() => setActivePanel('patients')}
                data-testid="nav-patients"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'patients' ? 'bg-rose-500/10 border border-rose-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'patients' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Users className={`h-4 w-4 ${activePanel === 'patients' ? 'text-rose-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'patients' ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>Patients</p>
                  <p className="text-xs text-muted-foreground">Patient directory</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {activePanel === 'patients' && <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                </div>
              </button>

              {/* 4 — Accounts */}
              <button
                onClick={() => setActivePanel('accounts')}
                data-testid="nav-accounts"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'accounts' ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'accounts' ? 'bg-primary/10 border-primary/20' : 'bg-muted/50 border-border/50'}`}>
                  <IndianRupee className={`h-4 w-4 ${activePanel === 'accounts' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'accounts' ? 'text-primary' : 'text-foreground'}`}>Accounts</p>
                  <p className="text-xs text-muted-foreground">All patient billing history</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {allBills.length > 0 && (
                    <span className="text-xs font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{allBills.length}</span>
                  )}
                  {activePanel === 'accounts' && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
              </button>

              {/* 5 — Configure Slots */}
              <button
                onClick={() => setActivePanel('configure-slots')}
                data-testid="nav-configure-slots"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'configure-slots' ? 'bg-blue-500/10 border border-blue-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'configure-slots' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Clock className={`h-4 w-4 ${activePanel === 'configure-slots' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'configure-slots' ? 'text-blue-600' : 'text-foreground'}`}>Configure Slots</p>
                  <p className="text-xs text-muted-foreground">Capacity &amp; cancellation</p>
                </div>
                {activePanel === 'configure-slots' && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
              </button>

              {/* 6 — Manage Doctors */}
              <button
                onClick={() => setActivePanel('manage-doctors')}
                data-testid="nav-manage-doctors"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'manage-doctors' ? 'bg-teal-500/10 border border-teal-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'manage-doctors' ? 'bg-teal-500/10 border-teal-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Stethoscope className={`h-4 w-4 ${activePanel === 'manage-doctors' ? 'text-teal-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'manage-doctors' ? 'text-teal-700 dark:text-teal-400' : 'text-foreground'}`}>Manage Doctors</p>
                  <p className="text-xs text-muted-foreground">Add or remove doctors</p>
                </div>
                {activePanel === 'manage-doctors' && <div className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />}
              </button>

              {/* 7 — Inventory */}
              <button
                onClick={() => setActivePanel('inventory')}
                data-testid="nav-inventory"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'inventory' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'inventory' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Package className={`h-4 w-4 ${activePanel === 'inventory' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'inventory' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>Inventory</p>
                  <p className="text-xs text-muted-foreground">Stock, assets & alerts</p>
                </div>
                {activePanel === 'inventory' && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
              </button>

              {/* 8 — Pharmacy Stock */}
              <button
                onClick={() => setActivePanel('pharmacy-stock')}
                data-testid="nav-pharmacy-stock"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'pharmacy-stock' ? 'bg-orange-500/10 border border-orange-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'pharmacy-stock' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Pill className={`h-4 w-4 ${activePanel === 'pharmacy-stock' ? 'text-orange-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'pharmacy-stock' ? 'text-orange-700 dark:text-orange-400' : 'text-foreground'}`}>Pharmacy Stock</p>
                  <p className="text-xs text-muted-foreground">Medicine catalog & pricing</p>
                </div>
                {activePanel === 'pharmacy-stock' && <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />}
              </button>

              {/* 9 — Clinic Profile */}
              <button
                onClick={() => setActivePanel('clinic-profile')}
                data-testid="nav-clinic-profile"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'clinic-profile' ? 'bg-violet-500/10 border border-violet-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'clinic-profile' ? 'bg-violet-500/10 border-violet-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Building2 className={`h-4 w-4 ${activePanel === 'clinic-profile' ? 'text-violet-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'clinic-profile' ? 'text-violet-700 dark:text-violet-400' : 'text-foreground'}`}>Clinic Profile</p>
                  <p className="text-xs text-muted-foreground">Edit public about page</p>
                </div>
                {activePanel === 'clinic-profile' && <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />}
              </button>

              {/* 10 — Clinic Website */}
              <button
                onClick={() => setActivePanel('website')}
                data-testid="nav-website"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'website' ? 'bg-sky-500/10 border border-sky-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'website' ? 'bg-sky-500/10 border-sky-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Globe className={`h-4 w-4 ${activePanel === 'website' ? 'text-sky-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'website' ? 'text-sky-700 dark:text-sky-400' : 'text-foreground'}`}>Clinic Website</p>
                  <p className="text-xs text-muted-foreground">Theme & content</p>
                </div>
                {activePanel === 'website' && <div className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />}
              </button>

              {/* 11 — Analytics */}
              <button
                onClick={() => setActivePanel('analytics')}
                data-testid="nav-analytics"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'analytics' ? 'bg-violet-500/10 border border-violet-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'analytics' ? 'bg-violet-500/10 border-violet-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <TrendingUp className={`h-4 w-4 ${activePanel === 'analytics' ? 'text-violet-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'analytics' ? 'text-violet-700 dark:text-violet-400' : 'text-foreground'}`}>Analytics</p>
                  <p className="text-xs text-muted-foreground">Clinic performance</p>
                </div>
                {activePanel === 'analytics' && <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />}
              </button>

              {/* 12 — Export Data */}
              <button
                onClick={() => setActivePanel('export-data')}
                data-testid="nav-export-data"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'export-data' ? 'bg-amber-500/10 border border-amber-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'export-data' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Download className={`h-4 w-4 ${activePanel === 'export-data' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'export-data' ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>Export Data</p>
                  <p className="text-xs text-muted-foreground">Download patient records</p>
                </div>
                {activePanel === 'export-data' && <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
              </button>

              {/* 13 — Consent Form */}
              <button
                onClick={() => setActivePanel('consent-form')}
                data-testid="nav-consent-form"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'consent-form' ? 'bg-indigo-500/10 border border-indigo-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'consent-form' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <ScrollText className={`h-4 w-4 ${activePanel === 'consent-form' ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'consent-form' ? 'text-indigo-700 dark:text-indigo-400' : 'text-foreground'}`}>Consent Form</p>
                  <p className="text-xs text-muted-foreground">Edit patient wording</p>
                </div>
                {activePanel === 'consent-form' && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />}
              </button>

            </div>
          </div>

          {/* Scan & Share Card */}
          {clinic && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden mt-3">
              <div className="px-3 pt-3 pb-1.5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scan &amp; Share</p>
              </div>
              <div className="px-3 pb-3 flex flex-col items-center gap-3">
                {/* QR Code */}
                <div className="relative rounded-2xl overflow-hidden bg-white p-3 border border-border/40 shadow-inner w-full flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none rounded-2xl" />
                  <QRCode
                    value={`${window.location.origin}/clinic/${clinic.username || clinic.id}`}
                    size={120}
                    level="M"
                    fgColor="#085041"
                    bgColor="#ffffff"
                    style={{ display: "block" }}
                  />
                </div>
                {/* Label */}
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Patients scan to visit your clinic page
                </p>
                {/* URL row */}
                <div className="w-full rounded-xl border border-border/50 bg-muted/30 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clinic Page URL</p>
                      <p className="text-xs text-foreground truncate font-mono mt-0.5">/clinic/{clinic.username || clinic.id}</p>
                    </div>
                    <button
                      onClick={() => copyClinicUrl('about')}
                      data-testid="button-copy-about-url"
                      title="Copy clinic page URL"
                      className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200
                        ${copiedUrlType === 'about'
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5'}`}
                    >
                      {copiedUrlType === 'about' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
        {/* ===== END LEFT SIDEBAR NAV ===== */}

        {/* ===== MAIN CONTENT ===== */}
        <div className="flex-1 min-w-0">

          {/* BOOKINGS PANEL */}
          {activePanel === 'bookings' && (
            <BookingsPanel
              clinic={clinic}
              isAuthenticated={isAuthenticated}
              slotTimings={slotTimings}
              formatTime={formatTime}
              allBills={allBills}
              notifHighlight={notifHighlight}
              tabBadges={tabBadges}
              setTabBadges={setTabBadges}
              onNavigate={(panel) => setActivePanel(panel as any)}
              onViewPatient={handleViewPatient}
              quickFilter={quickFilter}
              setQuickFilter={setQuickFilter}
              filterDate={filterDate}
              setFilterDate={setFilterDate}
              filterEndDate={filterEndDate}
              setFilterEndDate={setFilterEndDate}
              bookingsSectionRef={bookingsSectionRef}
              openBookingId={openBookingId}
              setOpenBookingId={setOpenBookingId}
              modalTabs={modalTabs}
              setModalTabs={setModalTabs}
            />
          )}
          {/* CONFIGURE SLOTS PANEL */}
          {activePanel === 'configure-slots' && (
            <ConfigureSlotsPanel clinic={clinic} isAuthenticated={isAuthenticated} />
          )}

                    {/* MANAGE DOCTORS PANEL */}
          {activePanel === 'manage-doctors' && (
            <ManageDoctorsPanel
              clinic={clinic}
              isAuthenticated={isAuthenticated}
              allDoctorLeaves={allDoctorLeaves}
              refetchClinic={refetchClinic}
            />
          )}

          {/* CLINIC PROFILE PANEL */}
          {activePanel === 'clinic-profile' && (
            <ClinicProfilePanel clinic={clinic} refetchClinic={refetchClinic} />
          )}

          {/* BOOK A SLOT PANEL */}
          {activePanel === 'book-a-slot' && (
            <BookASlotPanel clinic={clinic} isAuthenticated={isAuthenticated} />
          )}

                    {/* EXPORT DATA PANEL */}
          {activePanel === 'export-data' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <div className="flex">
                  <div className="w-1.5 bg-amber-500/60 shrink-0" />
                  <div className="flex-1 px-5 py-4 bg-gradient-to-r from-amber-500/[0.06] to-transparent flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Download className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">Export Data</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Download patient records and reports</p>
                    </div>
                  </div>
                </div>
              </div>
              <ExportDataPanel clinic={clinic} bookings={bookings} />
            </div>
          )}

          {/* INVENTORY PANEL */}
          {activePanel === 'inventory' && (
            <InventoryPanel clinicId={clinic.id} />
          )}

          {/* PHARMACY STOCK PANEL */}
          {activePanel === 'pharmacy-stock' && (
            <PharmacyStockPanel clinicId={clinic.id} />
          )}

          {/* ANALYTICS PANEL */}
          {activePanel === 'analytics' && (
            <ClinicAnalyticsPanel />
          )}

          {/* CONSENT FORM PANEL */}
          {activePanel === 'consent-form' && (
            <ConsentFormPanel />
          )}

          {/* WEBSITE PANEL */}
          {activePanel === 'website' && (
            <WebsiteConfigPanel clinic={clinic} />
          )}

          {/* ACCOUNTS PANEL */}
          {activePanel === 'accounts' && (
            <AccountsPanel
              clinic={clinic}
              allBills={allBills}
              bookings={undefined}
              onViewPatient={handleViewPatient}
            />
          )}


          {/* PATIENT DIRECTORY PANEL */}
          {activePanel === 'patients' && (
            <PatientDirectoryPanel
              isAuthenticated={isAuthenticated}
              selectedPatientId={selectedPatientId}
              onSelectPatient={setSelectedPatientId}
            />
          )}


        </div>
        {/* ===== END MAIN CONTENT ===== */}
        {/* ===== END BOOKINGS SECTION ===== */}

      </div>
      {/* ===== END TWO-COLUMN LAYOUT ===== */}

      {/* Billing Modal */}
      <Dialog open={isBillingOpen} onOpenChange={setIsBillingOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[560px] rounded-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">

          {/* ── Header ── */}
          <div className="shrink-0 px-5 pt-5 pb-4 pr-12 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Printer className="h-4 w-4 text-primary" />
              </div>
              {billingDetails.printOnly ? "Print Consolidated Receipt" : "Print Receipt"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1 ml-10">
              Review details before downloading the PDF receipt.
            </DialogDescription>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* CLINIC INFORMATION */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Clinic Information</p>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 grid grid-cols-2 gap-x-4 gap-y-3">
                {([
                  { icon: Building2, label: "Clinic Name",  key: "clinicName",    placeholder: "e.g. Bright Smiles Dental" },
                  { icon: Phone,     label: "Phone",        key: "clinicPhone",   placeholder: "e.g. +91 98765 43210" },
                  { icon: Mail,      label: "Email",        key: "clinicEmail",   placeholder: "e.g. clinic@example.com" },
                  { icon: MapPin,    label: "Location",     key: "clinicAddress", placeholder: "e.g. Kochi" },
                ] as { icon: ElementType; label: string; key: string; placeholder: string }[]).map(({ icon: Icon, label, key, placeholder }) => (
                  <div key={key} className="flex items-start gap-2">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      <Input
                        value={(billingDetails as any)[key]}
                        onChange={(e) => setBillingDetails(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="h-6 text-xs border-0 bg-transparent p-0 font-medium focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RECEIPT DETAILS + PATIENT INFO — side by side */}
            <div className="grid grid-cols-2 gap-3">

              {/* Receipt Details */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Receipt Details</p>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Receipt No.</p>
                      <Input
                        value={billingDetails.receiptNumber}
                        onChange={(e) => setBillingDetails(prev => ({ ...prev, receiptNumber: e.target.value }))}
                        placeholder="RCP-001"
                        className="h-6 text-xs border-0 bg-transparent p-0 font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Date</p>
                      <Input
                        value={billingDetails.date}
                        onChange={(e) => setBillingDetails(prev => ({ ...prev, date: e.target.value }))}
                        placeholder="27 May 2026"
                        className="h-6 text-xs border-0 bg-transparent p-0 font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient Information */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Patient Information</p>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Patient Name</p>
                      <Input
                        value={billingDetails.patientName}
                        onChange={(e) => setBillingDetails(prev => ({ ...prev, patientName: e.target.value }))}
                        placeholder="Rahul Verma"
                        className="h-6 text-xs border-0 bg-transparent p-0 font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                      <Input
                        value={billingDetails.patientPhone}
                        onChange={(e) => setBillingDetails(prev => ({ ...prev, patientPhone: e.target.value }))}
                        placeholder="+91 98765 43210"
                        className="h-6 text-xs border-0 bg-transparent p-0 font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                      <Input
                        value={billingDetails.patientEmail}
                        onChange={(e) => setBillingDetails(prev => ({ ...prev, patientEmail: e.target.value }))}
                        placeholder="patient@example.com"
                        className="h-6 text-xs border-0 bg-transparent p-0 font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SERVICES TABLE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Services</p>
                <button
                  type="button"
                  onClick={addServiceRow}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/70 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add Service
                </button>
              </div>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_88px_32px] gap-2 px-3 py-2 bg-muted/40 border-b border-border/50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service / Item</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Amount (₹)</span>
                  <span />
                </div>
                {/* Rows */}
                {billingDetails.services.map((service, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_88px_32px] gap-2 px-3 py-2 items-center border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <Input
                      value={service.description}
                      onChange={(e) => updateService(index, "description", e.target.value)}
                      placeholder="e.g. Scaling & Polishing"
                      className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Input
                      type="number"
                      value={service.amount}
                      onChange={(e) => updateService(index, "amount", e.target.value)}
                      placeholder="0"
                      className="h-7 text-sm border-0 bg-transparent p-0 text-right focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {billingDetails.services.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeServiceRow(index)}
                        className="flex items-center justify-center text-destructive/40 hover:text-destructive transition-colors"
                        data-testid={`button-remove-service-${index}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : <span />}
                  </div>
                ))}
                {/* Footer count */}
                <div className="px-3 py-1.5 bg-muted/20 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">
                    Total Items: {billingDetails.services.length}
                  </span>
                </div>
              </div>
            </div>

            {/* PAYMENT & SUMMARY — form left, totals card right */}
            {(() => {
              const sub   = billingDetails.services.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
              const disc  = sub * ((parseFloat(billingDetails.discount) || 0) / 100);
              const taxAmt = (sub - disc) * ((parseFloat(billingDetails.tax) || 0) / 100);
              const total = sub - disc + taxAmt;
              const fmt   = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Payment &amp; Summary</p>
                  <div className="grid grid-cols-2 gap-3">

                    {/* Left: payment fields */}
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
                      <div>
                        <Label className="text-xs text-muted-foreground">Discount %</Label>
                        <Input
                          type="number" min="0" max="100"
                          value={billingDetails.discount}
                          onChange={(e) => setBillingDetails(prev => ({ ...prev, discount: e.target.value }))}
                          className="h-7 text-sm mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Tax / GST %</Label>
                        <Input
                          type="number" min="0"
                          value={billingDetails.tax}
                          onChange={(e) => setBillingDetails(prev => ({ ...prev, tax: e.target.value }))}
                          className="h-7 text-sm mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Payment Method</Label>
                        <Input
                          value={billingDetails.paymentMethod}
                          onChange={(e) => setBillingDetails(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          placeholder="Cash / UPI / Card"
                          className="h-7 text-sm mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Transaction ID <span className="text-muted-foreground/50">(optional)</span>
                        </Label>
                        <Input
                          value={billingDetails.transactionId}
                          onChange={(e) => setBillingDetails(prev => ({ ...prev, transactionId: e.target.value }))}
                          placeholder="UPI ref / card txn"
                          className="h-7 text-sm mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Remarks <span className="text-muted-foreground/50">(optional)</span>
                        </Label>
                        <Input
                          value={billingDetails.remarks}
                          onChange={(e) => setBillingDetails(prev => ({ ...prev, remarks: e.target.value }))}
                          placeholder="Additional notes"
                          className="h-7 text-sm mt-0.5"
                        />
                      </div>
                    </div>

                    {/* Right: live totals card */}
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-muted-foreground">Subtotal</span>
                          <span className="text-sm font-medium">₹{fmt(sub)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-muted-foreground">Total Tax</span>
                          <span className="text-sm font-medium">₹{fmt(taxAmt)}</span>
                        </div>
                        {disc > 0 && (
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-muted-foreground">Discount</span>
                            <span className="text-sm font-medium text-emerald-600">− ₹{fmt(disc)}</span>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-primary/20 pt-2.5 mt-2.5">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Total Amount Due</p>
                        <p className="text-2xl font-bold text-primary leading-none">₹{fmt(total)}</p>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* PAYMENT STATUS */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Payment Status</p>
              <div className="flex gap-2">
                {(["paid", "pending", "partial"] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBillingDetails(prev => ({ ...prev, paymentStatus: s }))}
                    className={`flex-1 h-9 rounded-lg border text-xs font-semibold capitalize transition-all ${
                      billingDetails.paymentStatus === s
                        ? s === "paid"
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600"
                          : s === "partial"
                          ? "bg-blue-500/10 border-blue-500/40 text-blue-600"
                          : "bg-amber-500/10 border-amber-500/40 text-amber-600"
                        : "bg-background border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                    data-testid={`billing-status-${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 px-5 py-3 border-t border-border/60 flex justify-end gap-2 bg-muted/20">
            <Button variant="outline" onClick={() => setIsBillingOpen(false)}>Cancel</Button>
            <Button onClick={generatePDF} className="gap-2">
              <Printer className="h-4 w-4" />
              {billingDetails.printOnly ? "Print & Download" : billingDetails.existingBillId ? "Update & Print" : "Print & Save"}
            </Button>
          </div>

        </DialogContent>
      </Dialog>


      {/* ── CLINIC MOBILE BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-stretch">
          {([
            { key: 'bookings'   as const, label: 'Bookings', Icon: CalendarIcon },
            { key: 'book-a-slot'as const, label: 'Book',     Icon: Plus },
            { key: 'patients'   as const, label: 'Patients', Icon: Users },
            { key: 'accounts'   as const, label: 'Accounts', Icon: IndianRupee },
          ]).map(({ key, label, Icon }) => {
            const isActive = activePanel === key;
            return (
              <button
                key={key}
                onClick={() => setActivePanel(key)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors relative ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
                data-testid={`bottom-nav-clinic-${key}`}
              >
                {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setClinicMoreDrawerOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors relative ${
              ['configure-slots','manage-doctors','inventory','pharmacy-stock','clinic-profile','website','analytics','export-data','consent-form'].includes(activePanel)
                ? 'text-primary' : 'text-muted-foreground'
            }`}
            data-testid="bottom-nav-clinic-more"
          >
            {['configure-slots','manage-doctors','inventory','pharmacy-stock','clinic-profile','website','analytics','export-data','consent-form'].includes(activePanel) && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
            )}
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* ── CLINIC MORE DRAWER (mobile) ── */}
      <Sheet open={clinicMoreDrawerOpen} onOpenChange={setClinicMoreDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'configure-slots' as const, label: 'Configure Slots', desc: 'Capacity & cancellation',  Icon: Clock,       cls: 'bg-blue-500/10 border-blue-500/20 text-blue-600' },
              { key: 'manage-doctors'  as const, label: 'Manage Doctors',  desc: 'Add or remove doctors',    Icon: Stethoscope, cls: 'bg-teal-500/10 border-teal-500/20 text-teal-600' },
              { key: 'inventory'       as const, label: 'Inventory',        desc: 'Stock, assets & alerts',   Icon: Package,     cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' },
              { key: 'pharmacy-stock'  as const, label: 'Pharmacy Stock',   desc: 'Medicines & supplies',     Icon: Pill,        cls: 'bg-orange-500/10 border-orange-500/20 text-orange-600' },
              { key: 'clinic-profile'  as const, label: 'Clinic Profile',   desc: 'Edit public about page',   Icon: Building2,   cls: 'bg-violet-500/10 border-violet-500/20 text-violet-600' },
              { key: 'website'         as const, label: 'Clinic Website',   desc: 'Theme & content',          Icon: Globe,       cls: 'bg-sky-500/10 border-sky-500/20 text-sky-600' },
              { key: 'analytics'       as const, label: 'Analytics',        desc: 'Clinic performance',       Icon: TrendingUp,  cls: 'bg-violet-500/10 border-violet-500/20 text-violet-600' },
              { key: 'export-data'     as const, label: 'Export Data',      desc: 'Download patient records', Icon: Download,    cls: 'bg-amber-500/10 border-amber-500/20 text-amber-600' },
              { key: 'consent-form'   as const, label: 'Consent Form',     desc: 'Edit patient wording',     Icon: ScrollText,  cls: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600' },
            ]).map(({ key, label, desc, Icon, cls }) => (
              <button
                key={key}
                onClick={() => { setActivePanel(key); setClinicMoreDrawerOpen(false); }}
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl border border-border/50 bg-background text-left hover:bg-muted/30 transition-colors active:scale-[0.98] ${
                  activePanel === key ? 'ring-2 ring-primary/30' : ''
                }`}
                data-testid={`drawer-clinic-${key}`}
              >
                <div className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 ${cls}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Sign Out — lives here on mobile; hidden from the green hero on small screens */}
          <div className="mt-3 pt-3 border-t border-border/50 pb-4">
            <button
              onClick={() => { setClinicMoreDrawerOpen(false); handleLogout(); }}
              disabled={isLoggingOut}
              className="flex items-center gap-3 px-3 py-3 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 w-full text-left hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition-colors active:scale-[0.98] disabled:opacity-60"
              data-testid="drawer-sign-out"
            >
              <div className="h-8 w-8 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center shrink-0 text-rose-500">
                {isLoggingOut
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <LogOut className="h-4 w-4" />
                }
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight text-rose-600 dark:text-rose-400">Sign Out</p>
                <p className="text-xs text-muted-foreground truncate">Exit clinic dashboard</p>
              </div>
            </button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
