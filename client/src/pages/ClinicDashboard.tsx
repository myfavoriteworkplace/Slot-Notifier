import QRCode from "react-qr-code";
// @ts-ignore — qr.js is a CJS dep of react-qr-code; Vite handles interop
import QRLib from 'qr.js';
import { ImageUpload } from "@/components/ImageUpload";
import MapLocationPicker from "@/components/MapLocationPicker";
import ExportDataPanel from "@/components/ExportDataPanel";
import { BookingNotesThread } from "@/components/BookingNotesThread";
import ClinicalRecordsTab from "@/components/ClinicalRecordsTab";
import { InventoryPanel } from "@/components/InventoryPanel";
import PharmacyStockPanel from "@/components/PharmacyStockPanel";
import WebsiteConfigPanel from "@/components/WebsiteConfigPanel";
import { BillingHistoryPanel } from "@/components/BillingHistoryPanel";
import ClinicAnalyticsPanel from "@/components/ClinicAnalyticsPanel";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import {
  Loader2, Calendar as CalendarIcon, Phone, Clock, Building2, LogOut, X,
  Download, Plus, ChevronDown, ChevronUp, CheckCircle2, IndianRupee, FileText,
  User, Mail, CalendarDays, FlaskConical, Settings, TrendingUp, History, Filter, Copy, Check,
  Globe, Lock, ExternalLink, MapPin, Info, ClipboardCheck, PenLine, Link2, ClipboardList, Package, AlertTriangle, CreditCard,
  Users, Search, ArrowUpDown, BadgeCheck, MoreHorizontal, Sun, Moon,
  ChevronLeft, ChevronRight, Save, Hash, Pill, Printer
} from "lucide-react";
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
import { SpecializationInput } from "@/components/SpecializationInput";
import { Label } from "@/components/ui/label";
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
import type { Slot, Booking, PatientBill, ClinicalRecord, Patient } from "@shared/schema";
import { Stethoscope, Trash2, GraduationCap, UserPlus, Upload, KeyRound, CalendarOff } from "lucide-react";
import { AppointmentCard } from "@/components/AppointmentCard";
import noBookingsImg from "@assets/Copilot_20260603_191746_1780494897553.png";

interface SlotTiming {
  id: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

const DEFAULT_SLOT_TIMINGS: SlotTiming[] = [
  { id: "1", label: "Early Morning", startHour: 8,  startMinute: 0,  endHour: 10, endMinute: 0  },
  { id: "2", label: "Late Morning",  startHour: 10, startMinute: 0,  endHour: 12, endMinute: 30 },
  { id: "3", label: "Midday",        startHour: 12, startMinute: 30, endHour: 14, endMinute: 0  },
  { id: "4", label: "Afternoon",     startHour: 14, startMinute: 0,  endHour: 17, endMinute: 0  },
  { id: "5", label: "Evening",       startHour: 17, startMinute: 0,  endHour: 19, endMinute: 30 },
];

const DEFAULT_SECTION_CAPACITY: Record<string, number> = { "1": 6, "2": 6, "3": 4, "4": 4, "5": 2 };

type SectionConfig = { maxBookings: number; isCancelled: boolean };
type DayConfig    = { isClosed: boolean; sections: Record<string, SectionConfig> };

type BookingWithSlot = Booking & { 
  slot: Slot; 
  description?: string | null;
  assignedDoctor?: string | null;
  assignedDoctorEmail?: string | null;
  doctorApprovalStatus?: string | null;
  doctorNotes?: string | null;
  clinicalStatus?: string | null;
  clinicDoctors?: { name: string; specialization: string; degree: string; email?: string }[];
  patientCode?: string | null;
};

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
    <div className="container mx-auto px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
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

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { phone?: string; email?: string; website?: string; address?: string; city?: string; pincode?: string; doctorName?: string }) => {
      const response = await apiRequest('PATCH', '/api/auth/clinic/me', data);
      if (!response.ok) throw new Error('Failed to update clinic profile');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinic) refetchClinic();
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/me'] });
      notify.success("Profile updated", { description: "Your clinic profile has been saved." });
    },
    onError: (err: any) => {
      notify.apiError(err, "Update failed");
    },
  });

  useEffect(() => {
    if (clinic) {
      setProfilePhone(clinic.phone ?? "");
      setProfileEmail(clinic.email ?? "");
      setProfileWebsite(clinic.website ?? "");
      setProfileAddress(clinic.address ?? "");
      setProfileCity(clinic.city ?? "");
      setProfilePincode(clinic.pincode ?? "");
      setProfileDoctorName((clinic as any).doctorName ?? "");
      setProfileLatitude((clinic as any).latitude ?? null);
      setProfileLongitude((clinic as any).longitude ?? null);
    }
  }, [clinic]);

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
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'bookings' | 'configure-slots' | 'manage-doctors' | 'clinic-profile' | 'book-a-slot' | 'export-data' | 'inventory' | 'pharmacy-stock' | 'website' | 'accounts' | 'patients' | 'analytics'>('bookings');
  const [accountsSearch, setAccountsSearch] = useState("");
  const [accountsStatusFilter, setAccountsStatusFilter] = useState<'all' | 'paid' | 'pending' | 'partial' | 'overdue'>('all');
  const [accountsView, setAccountsView] = useState<'ledger' | 'register'>('ledger');
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [expandedLeaves, setExpandedLeaves] = useState<Set<string>>(new Set());
  const [clinicMoreDrawerOpen, setClinicMoreDrawerOpen] = useState(false);

  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileWebsite, setProfileWebsite] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profilePincode, setProfilePincode] = useState("");
  const [profileDoctorName, setProfileDoctorName] = useState("");
  const [profileLatitude, setProfileLatitude] = useState<number | null>(null);
  const [profileLongitude, setProfileLongitude] = useState<number | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingAge, setBookingAge] = useState("");
  const [bookingGender, setBookingGender] = useState("");
  const [patientSuggestions, setPatientSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bookingDescription, setBookingDescription] = useState("");
  const [bookingDate, setBookingDate] = useState<Date>(startOfToday());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingShowReview, setBookingShowReview] = useState(false);
  const [bookingSlotPanelOpen, setBookingSlotPanelOpen] = useState(false);
  const [bookingOpenCategory, setBookingOpenCategory] = useState<string | null>(null);
  const [complaintsExpanded, setComplaintsExpanded] = useState(false);
  const COMPLAINTS_INITIAL_VISIBLE = 4;
  const [slotTimings] = useState<SlotTiming[]>(DEFAULT_SLOT_TIMINGS);

  const DENTAL_CATEGORIES = [
    { category: "Tooth Pain or Sensitivity",        emoji: "🦷", subIssues: ["Sensitivity to hot/cold/sweet", "Sharp or throbbing pain", "Pain while chewing", "Pain at night"],                     specialists: ["Endodontist", "General Dentist"] },
    { category: "Gum Problems",                     emoji: "🩸", subIssues: ["Bleeding gums", "Swollen or red gums", "Receding gums", "Bad breath or bad taste"],                                  specialists: ["Periodontist", "General Dentist"] },
    { category: "Tooth Decay / Cavities",           emoji: "🕳️", subIssues: ["Visible hole or black spot", "Pain when eating or drinking", "Food getting stuck"],                                   specialists: ["General Dentist", "Endodontist"] },
    { category: "Broken, Chipped or Cracked Tooth", emoji: "💔", subIssues: ["Chipped or broken tooth", "Cracked tooth", "Worn down teeth"],                                                        specialists: ["Prosthodontist", "General Dentist"] },
    { category: "Alignment or Bite Issues",         emoji: "🔀", subIssues: ["Crooked or crowded teeth", "Gaps between teeth", "Bite feels off or jaw discomfort"],                                 specialists: ["Orthodontist"] },
    { category: "Missing Teeth",                    emoji: "🫥", subIssues: ["One tooth missing", "Multiple teeth missing", "Want replacement options"],                                            specialists: ["Prosthodontist", "Oral Surgeon"] },
    { category: "Cosmetic / Smile Concerns",        emoji: "✨", subIssues: ["Yellow or stained teeth", "Want a whiter smile", "Uneven teeth shape", "Gaps I want closed"],                        specialists: ["Cosmetic Dentist", "Prosthodontist"] },
    { category: "Swelling or Infection",            emoji: "🤒", subIssues: ["Swollen face or gum", "Pus or abscess", "Severe pain with swelling"],                                                specialists: ["Endodontist", "Oral Surgeon", "General Dentist"] },
    { category: "Child's Dental Issues",            emoji: "👶", subIssues: ["Tooth decay in baby teeth", "Child complains of pain", "Thumb sucking habits", "Delayed tooth eruption"],           specialists: ["Pedodontist"] },
    { category: "Jaw Pain or Other",                emoji: "🦴", subIssues: ["Jaw pain or clicking (TMJ)", "Dry mouth", "Mouth ulcers", "Suspicious growth or lump"],                             specialists: ["Oral Medicine Specialist", "Oral Surgeon", "General Dentist"] },
    { category: "Wisdom Tooth Problems",            emoji: "😬", subIssues: ["Pain from wisdom tooth", "Swelling near wisdom tooth", "Difficulty opening mouth"],                                 specialists: ["Oral Surgeon", "General Dentist"] },
    { category: "Preventive / Routine Care",        emoji: "🧹", subIssues: ["Regular checkup", "Cleaning or scaling", "Fluoride treatment"],                                                      specialists: ["General Dentist", "Dental Hygienist"] },
  ];

  const getRecommendedSpecialists = (descriptionText: string): string[] => {
    if (!descriptionText) return [];
    const selectedIssues = descriptionText.split(", ").map(s => s.trim().toLowerCase());
    const matched = new Set<string>();
    DENTAL_CATEGORIES.forEach(cat => {
      const hasMatch = cat.subIssues.some(s => selectedIssues.includes(s.toLowerCase()));
      if (hasMatch) cat.specialists.forEach(sp => matched.add(sp));
    });
    return Array.from(matched);
  };

  const CHIEF_COMPLAINTS = DENTAL_CATEGORIES.flatMap(c => c.subIssues);

  const handleComplaintClick = (complaint: string) => {
    const currentComplaints = bookingDescription ? bookingDescription.split(", ").filter(Boolean) : [];
    let newDescription = "";

    if (currentComplaints.includes(complaint)) {
      newDescription = currentComplaints.filter(c => c !== complaint).join(", ");
    } else {
      newDescription = [...currentComplaints, complaint].join(", ");
    }
    setBookingDescription(newDescription);
  };

  // Slot Configuration state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configDate, setConfigDate] = useState<Date>(startOfToday());
  const [dayConfigCache, setDayConfigCache] = useState<Record<string, DayConfig>>({});
  const [calendarWeekStart, setCalendarWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isBulkApplying, setIsBulkApplying] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<'future-days' | 'sundays-this-month' | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showSaveRangeConfirm, setShowSaveRangeConfirm] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(startOfToday());
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  // Doctor Management state
  const [isDoctorsOpen, setIsDoctorsOpen] = useState(false);
  const [showAddDoctorForm, setShowAddDoctorForm] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialization, setNewDoctorSpecialization] = useState("");
  const [newDoctorDegree, setNewDoctorDegree] = useState("");
  const [newDoctorEmail, setNewDoctorEmail] = useState("");
  const [newDoctorImageUrl, setNewDoctorImageUrl] = useState<string | null>(null);

  // Reset Doctor Password state
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdDoctorId, setResetPwdDoctorId] = useState<number | null>(null);
  const [resetPwdDoctorName, setResetPwdDoctorName] = useState("");
  const [resetPwdDoctorEmail, setResetPwdDoctorEmail] = useState("");
  const [resetPwdNew, setResetPwdNew] = useState("");
  const [resetPwdConfirm, setResetPwdConfirm] = useState("");

  // Fetch clinic doctors
  const { data: clinicData, refetch: refetchClinicData } = useQuery<{ doctors: { name: string; specialization: string; degree: string; email?: string; imageUrl?: string | null }[] }>({
    queryKey: ['/api/auth/clinic/me'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/me');
      if (!res.ok) throw new Error('Failed to fetch clinic');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Auto-open add-doctor form when there are no doctors yet
  useEffect(() => {
    if (activePanel === 'manage-doctors' && clinicData && (!clinicData.doctors || clinicData.doctors.length === 0)) {
      setShowAddDoctorForm(true);
    }
  }, [activePanel, clinicData]);

  // Fetch real linked doctor accounts (for reset password key icon)
  const { data: linkedDoctors = [] } = useQuery<{ id: number; name: string; email: string }[]>({
    queryKey: ['/api/auth/clinic/linked-doctors'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/linked-doctors');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Slot configs from DB — populates the calendar grid on load
  const { data: savedSlotConfigs } = useQuery<{ startTime: string; maxBookings: number; isCancelled: boolean }[]>({
    queryKey: ['/api/auth/clinic/slots/configs'],
    queryFn: async () => {
      const from = format(addDays(startOfToday(), -1), 'yyyy-MM-dd');
      const to = format(addDays(startOfToday(), 31), 'yyyy-MM-dd');
      const res = await apiRequest('GET', `/api/auth/clinic/slots/configs?from=${from}&to=${to}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: defaultConfigData } = useQuery<{ defaultSlotConfig: object | null }>({
    queryKey: ['/api/auth/clinic/default-config'],
    enabled: isAuthenticated,
  });
  const hasDefaultConfig = !!defaultConfigData?.defaultSlotConfig;

  useEffect(() => {
    if (!savedSlotConfigs?.length) return;
    const newEntries: Record<string, { isClosed: boolean; sections: Record<string, { maxBookings: number; isCancelled: boolean }> }> = {};
    for (const slot of savedSlotConfigs) {
      const dt = new Date(slot.startTime);
      const dateStr = format(dt, 'yyyy-MM-dd');
      const matchedTiming = DEFAULT_SLOT_TIMINGS.find(st =>
        st.startHour === dt.getHours() && st.startMinute === dt.getMinutes()
      );
      if (!matchedTiming) continue;
      if (!newEntries[dateStr]) newEntries[dateStr] = { isClosed: dt.getDay() === 0, sections: {} };
      newEntries[dateStr].sections[matchedTiming.id] = { maxBookings: slot.maxBookings, isCancelled: slot.isCancelled };
    }
    for (const [dateStr, cfg] of Object.entries(newEntries)) {
      const allCancelled = Object.values(cfg.sections).length === DEFAULT_SLOT_TIMINGS.length &&
        Object.values(cfg.sections).every(s => s.isCancelled);
      if (allCancelled) newEntries[dateStr].isClosed = true;
    }
    // Merge: any unsaved local edits already in prev take precedence
    setDayConfigCache(prev => ({ ...newEntries, ...prev }));
  }, [savedSlotConfigs]);

  // All clinic bills — loaded on demand only when the Accounts panel is open
  const { data: allBills = [] } = useQuery<PatientBill[]>({
    queryKey: ['/api/auth/clinic/bills'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/bills');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activePanel === 'accounts',
  });

  // Patient directory
  const { data: patientDirectory = [], isLoading: patientsLoading } = useQuery<(Patient & { totalBilled: number })[]>({
    queryKey: ['/api/auth/clinic/patients'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/patients');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && activePanel === 'patients',
  });
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSort, setPatientSort] = useState<'recent' | 'visits' | 'billed'>('recent');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  type PatientHistory = { bookings: (Booking & { slot: Slot })[]; bills: PatientBill[]; clinicalRecords: ClinicalRecord[] };
  const { data: patientHistory, isLoading: historyLoading } = useQuery<PatientHistory>({
    queryKey: ['/api/auth/clinic/patients', selectedPatientId, 'history'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/auth/clinic/patients/${selectedPatientId}/history`);
      if (!res.ok) throw new Error('Failed to load history');
      return res.json();
    },
    enabled: !!selectedPatientId,
  });

  const updateBillStatusMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: number; paymentStatus: string }) =>
      apiRequest('PATCH', `/api/auth/clinic/bills/${id}`, { paymentStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bills'] });
      notify.success("Status updated", { description: "Bill payment status has been saved." });
    },
    onError: () => notify.error("Failed to update bill status"),
  });

  const deleteBillMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/auth/clinic/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bills'] });
      notify.success("Receipt deleted", { description: "The bill record has been removed." });
    },
    onError: () => notify.error("Failed to delete bill"),
  });

  const [billDeleteConfirm, setBillDeleteConfirm] = useState<number | null>(null);

  const addDoctorMutation = useMutation({
    mutationFn: async (data: { name: string; specialization: string; degree: string; email?: string; imageUrl?: string | null }) => {
      const response = await apiRequest('POST', '/api/auth/clinic/doctors', data);
      if (!response.ok) throw new Error('Failed to add doctor');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinicData) refetchClinicData();
      if (refetchClinic) refetchClinic();
      setNewDoctorName("");
      setNewDoctorSpecialization("");
      setNewDoctorDegree("");
      setNewDoctorEmail("");
      setNewDoctorImageUrl(null);
      setShowAddDoctorForm(false);
      notify.success("Doctor added", { description: "A welcome email with login credentials has been sent." });
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to add doctor");
    },
  });

  const resetDoctorPasswordMutation = useMutation({
    mutationFn: async ({ doctorId, newPassword }: { doctorId: number; newPassword: string }) => {
      const res = await apiRequest('POST', `/api/auth/clinic/doctors/${doctorId}/reset-password`, { newPassword });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      notify.success("Password reset", { description: "The doctor's password has been updated." });
      setResetPwdOpen(false);
      setResetPwdNew("");
      setResetPwdConfirm("");
    },
    onError: (e: any) => notify.apiError(e, "Failed to reset password"),
  });

  const removeDoctorMutation = useMutation({
    mutationFn: async (index: number) => {
      const response = await apiRequest('DELETE', `/api/auth/clinic/doctors/${index}`);
      if (!response.ok) throw new Error('Failed to remove doctor');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinicData) refetchClinicData();
      if (refetchClinic) refetchClinic();
      notify.success("Doctor removed");
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to remove doctor");
    },
  });

  const handleAddDoctor = () => {
    if (!newDoctorName || !newDoctorSpecialization || !newDoctorEmail) {
      notify.warning("Please fill in name, specialization and email");
      return;
    }
    const existingDoctors = clinicData?.doctors || [];
    const emailLower = newDoctorEmail.trim().toLowerCase();
    const emailDuplicate = existingDoctors.find(
      (d) => d.email && d.email.trim().toLowerCase() === emailLower
    );
    if (emailDuplicate) {
      notify.warning("Doctor already in your clinic", { description: "A doctor with this email is already part of your clinic." });
      return;
    }
    addDoctorMutation.mutate({
      name: newDoctorName,
      specialization: newDoctorSpecialization,
      degree: newDoctorDegree,
      email: newDoctorEmail,
      imageUrl: newDoctorImageUrl
    });
  };

  const getDefaultSectionsForDate = (date: Date) => Object.fromEntries(
    slotTimings.map(s => {
      const slotTime = new Date(date);
      slotTime.setHours(s.startHour, s.startMinute, 0, 0);
      const isoStr = slotTime.toISOString();
      const match = bookings?.find(b => new Date(b.slot.startTime).toISOString() === isoStr);
      return [s.id, {
        maxBookings: match?.slot.maxBookings ?? DEFAULT_SECTION_CAPACITY[s.id] ?? 3,
        isCancelled: match?.slot.isCancelled ?? false,
      }];
    })
  );

  const getConfigForDate = (date: Date): DayConfig => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dayConfigCache[dateStr] ?? {
      isClosed: date.getDay() === 0,
      sections: getDefaultSectionsForDate(date),
    };
  };

  const updateDayClosedState = (date: Date, isClosed: boolean) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setDayConfigCache(prev => {
      const existing = prev[dateStr] ?? { isClosed: date.getDay() === 0, sections: getDefaultSectionsForDate(date) };
      return { ...prev, [dateStr]: { ...existing, isClosed } };
    });
  };

  const updateSectionCapacity = (date: Date, slotId: string, value: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setDayConfigCache(prev => {
      const existing = prev[dateStr] ?? { isClosed: date.getDay() === 0, sections: getDefaultSectionsForDate(date) };
      return {
        ...prev,
        [dateStr]: {
          ...existing,
          sections: {
            ...existing.sections,
            [slotId]: { ...(existing.sections[slotId] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slotId] ?? 3, isCancelled: false }), maxBookings: value }
          }
        }
      };
    });
  };

  const updateSectionCancelled = (date: Date, slotId: string, isCancelled: boolean) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setDayConfigCache(prev => {
      const existing = prev[dateStr] ?? { isClosed: date.getDay() === 0, sections: getDefaultSectionsForDate(date) };
      return {
        ...prev,
        [dateStr]: {
          ...existing,
          sections: {
            ...existing.sections,
            [slotId]: { ...(existing.sections[slotId] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slotId] ?? 3, isCancelled: false }), isCancelled }
          }
        }
      };
    });
  };

  const getDatesInRange = (start: Date, end: Date): Date[] => {
    const dates: Date[] = [];
    let cur = startOfDay(start);
    const last = startOfDay(end);
    while (cur <= last) { dates.push(new Date(cur)); cur = addDays(cur, 1); }
    return dates;
  };

  const getActiveDates = (): Date[] =>
    rangeStart && rangeEnd ? getDatesInRange(rangeStart, rangeEnd) : [configDate];

  const handleSlotDateClick = (day: Date) => {
    setConfigDate(day);
    setRangeStart(day);
    setRangeEnd(null);
  };

  const isDateInSelection = (day: Date): boolean => {
    if (!rangeStart) return isSameDay(day, configDate);
    if (!rangeEnd) return isSameDay(day, rangeStart);
    const d = startOfDay(day);
    return d >= startOfDay(rangeStart) && d <= startOfDay(rangeEnd);
  };

  const saveDayConfiguration = async () => {
    if (!clinic) return;
    setIsSavingConfig(true);
    try {
      const datesToSave = rangeStart && rangeEnd
        ? getDatesInRange(rangeStart, rangeEnd)
        : [configDate];
      const cfg = getConfigForDate(configDate);
      const slotsPayload = datesToSave.flatMap(date =>
        slotTimings.map(slot => {
          const startTime = new Date(date);
          startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
          const secCfg = cfg.sections[slot.id] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slot.id] ?? 3, isCancelled: false };
          return { startTime: startTime.toISOString(), maxBookings: secCfg.maxBookings, isCancelled: cfg.isClosed || secCfg.isCancelled };
        })
      );
      const response = await apiRequest('POST', '/api/auth/clinic/slots/configure-bulk', { slots: slotsPayload });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save slot');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/slots/configs'] });
      const label = rangeStart && rangeEnd
        ? `Range ${format(rangeStart, 'd MMM')} – ${format(rangeEnd, 'd MMM')} saved`
        : `${format(configDate, 'd MMM')} configuration saved`;
      notify.success(label);
    } catch (e: any) {
      notify.apiError(e, "Failed to save configuration");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const applyBulkConfig = async (type: 'future-days' | 'sundays-this-month') => {
    if (!clinic) return;
    setIsBulkApplying(true);
    try {
      const sourceCfg = getConfigForDate(configDate);
      const today = startOfToday();

      if (type === 'future-days') {
        // Save as the clinic-level default — 1 DB write, works forever, no row generation
        const response = await apiRequest('PATCH', '/api/auth/clinic/default-config', {
          isClosed: sourceCfg.isClosed,
          sections: sourceCfg.sections,
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to save default config');
        }
        queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/default-config'] });
        notify.success('Default schedule saved — applies to all future dates automatically');
        return;
      }

      // sundays-this-month — still uses bulk row upsert (targeted, bounded set)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const targetDates = getDatesInRange(monthStart, monthEnd).filter(d => d.getDay() === 0);
      setDayConfigCache(prev => {
        const updates: Record<string, typeof sourceCfg> = {};
        for (const date of targetDates) updates[format(date, 'yyyy-MM-dd')] = { ...sourceCfg };
        return { ...prev, ...updates };
      });
      const slotsPayload = targetDates.flatMap(date =>
        slotTimings.map(slot => {
          const startTime = new Date(date);
          startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
          const secCfg = sourceCfg.sections[slot.id] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slot.id] ?? 3, isCancelled: false };
          return { startTime: startTime.toISOString(), maxBookings: secCfg.maxBookings, isCancelled: sourceCfg.isClosed || secCfg.isCancelled };
        })
      );
      const response = await apiRequest('POST', '/api/auth/clinic/slots/configure-bulk', { slots: slotsPayload });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to apply bulk config');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/slots/configs'] });
      notify.success(`Applied to all Sundays in ${format(today, 'MMMM yyyy')}`);
    } catch (e: any) {
      notify.apiError(e, "Failed to apply bulk configuration");
    } finally {
      setIsBulkApplying(false);
    }
  };

  const validateIndianPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    const indiaRegex = /^(\+91|91)?[6-9]\d{9}$/;
    return indiaRegex.test(cleaned);
  };

  const handleBookingPhoneChange = (value: string) => {
    setBookingPhone(value);
    if (value && !validateIndianPhone(value)) {
      setPhoneError("Please enter a valid Indian mobile number (10 digits starting with 6-9)");
    } else {
      setPhoneError("");
    }
  };

  const isPhoneValid = bookingPhone && validateIndianPhone(bookingPhone);

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')}${period}`;
  };

  const resetBookingForm = () => {
    setBookingName("");
    setBookingPhone("");
    setBookingEmail("");
    setBookingAge("");
    setBookingGender("");
    setBookingDescription("");
    setBookingDate(startOfToday());
    setSelectedSlot(null);
    setPhoneError("");
    setBookingSuccess(false);
    setBookingShowReview(false);
    setBookingSlotPanelOpen(false);
    setBookingOpenCategory(null);
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

  const fetchPatientSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setPatientSuggestions([]); setShowSuggestions(false); return; }
    setSuggestionsLoading(true);
    try {
      const res = await apiRequest('GET', `/api/auth/clinic/patients/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setPatientSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
    } catch { /* non-fatal */ }
    finally { setSuggestionsLoading(false); }
  }, []);

  const handleBookingNameChange = (val: string) => {
    setBookingName(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchPatientSuggestions(val), 300);
  };

  const applyPatientSuggestion = (p: any) => {
    setBookingName(p.name || "");
    setBookingPhone(p.phone || "");
    setBookingEmail(p.email || "");
    setBookingAge(p.age ? String(p.age) : "");
    setBookingGender(p.gender || "");
    setPatientSuggestions([]);
    setShowSuggestions(false);
  };

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/auth/clinic/bookings', data);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Failed to create booking (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      setBookingSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      notify.success("Booking Created!", { description: "The appointment has been successfully booked." });
    },
    onError: (error: any) => {
      notify.apiError(error, "Booking Failed");
    },
  });

  const handleCreateBooking = () => {
    if (!selectedSlot || !bookingName || !bookingPhone || !clinic) return;
    const slotInfo = slotTimings.find(s => s.id === selectedSlot);
    if (!slotInfo) return;

    const startTime = new Date(bookingDate);
    startTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
    const endTime = new Date(bookingDate);
    endTime.setHours(slotInfo.endHour, slotInfo.endMinute, 0, 0);

    const descParts: string[] = [];
    if (bookingAge) descParts.push(`Age: ${bookingAge}`);
    if (bookingGender) descParts.push(`Gender: ${bookingGender}`);
    if (bookingDescription) descParts.push(bookingDescription);

    createBookingMutation.mutate({
      customerName: bookingName,
      customerPhone: bookingPhone,
      customerEmail: bookingEmail,
      clinicId: clinic.id,
      clinicName: clinic.name,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      description: descParts.join(' | ')
    } as any);
  };

  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  type AdminSlotAvailRow = { slotIndex: number; label: string; startTimeISO: string; count: number; max: number; isCancelled: boolean; spotsLeft: number };
  const { data: adminSlotAvailability, isFetching: adminSlotFetching } = useQuery<AdminSlotAvailRow[]>({
    queryKey: ['admin-slot-availability', clinic?.id, format(bookingDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!clinic) return [];
      const payload = {
        clinicId: clinic.id,
        slots: slotTimings.map((slot, idx) => {
          const t = new Date(bookingDate);
          t.setHours(slot.startHour, slot.startMinute, 0, 0);
          return { slotIndex: idx, label: slot.label, startTimeISO: t.toISOString() };
        }),
      };
      const res = await apiRequest('POST', '/api/public/slot-availability', payload);
      if (!res.ok) throw new Error('Failed to fetch slot availability');
      return res.json();
    },
    enabled: !!clinic && bookingSlotPanelOpen,
    staleTime: 30_000,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithSlot[]>({
    queryKey: ['/api/auth/clinic/bookings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/bookings');
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
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
  type BillingService = {
    description: string;
    amount: string;
    category?: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    qty?: number;
    unitPrice?: number;
  };

  const [billingDetails, setBillingDetails] = useState<{
    patientName: string; patientPhone: string; patientEmail: string;
    clinicName: string; clinicAddress: string; clinicPhone: string; clinicEmail: string;
    receiptNumber: string; date: string; discount: string; tax: string;
    paymentMethod: string; transactionId: string; remarks: string;
    paymentStatus: "paid" | "pending" | "partial";
    existingBillId: number | undefined; printOnly: boolean;
    visitId: string; doctorName: string;
    services: BillingService[];
  }>({
    patientName: "", patientPhone: "", patientEmail: "",
    clinicName: "", clinicAddress: "", clinicPhone: "", clinicEmail: "",
    receiptNumber: "", date: "", discount: "0", tax: "0",
    paymentMethod: "Cash", transactionId: "", remarks: "",
    paymentStatus: "paid",
    existingBillId: undefined, printOnly: false,
    visitId: "", doctorName: "",
    services: [{ description: "Dental Consultation", amount: "500", category: "Consultation" }],
  });

  // Count today's bookings using the same timezone-safe comparison
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayStart = startOfDay(new Date());
  const statNext7DaysEnd = addDays(todayStart, 7);

  const todaysBookingsCount = bookings?.filter(b => {
    const bookingDateStr = format(new Date(b.slot.startTime), 'yyyy-MM-dd');
    return bookingDateStr === todayStr;
  }).length || 0;

  // Count future bookings (including today)
  const futureBookingsCount = bookings?.filter(b => {
    const bookingDate = new Date(b.slot.startTime);
    return bookingDate >= todayStart;
  }).length || 0;

  // Count past bookings (before today)
  const pastBookingsCount = bookings?.filter(b => {
    const bookingDate = new Date(b.slot.startTime);
    return bookingDate < todayStart;
  }).length || 0;

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });

  const thisWeekCount = bookings?.filter(b => {
    const d = new Date(b.slot.startTime);
    return d >= thisWeekStart && d <= thisWeekEnd;
  }).length || 0;

  const nextWeekCount = bookings?.filter(b => {
    const d = new Date(b.slot.startTime);
    return d >= nextWeekStart && d <= nextWeekEnd;
  }).length || 0;

  // Calculate booking numbers based on appointment time
  const getBookingNumber = (booking: BookingWithSlot) => {
    if (!bookings) return "0";
    // Get all bookings for the same date
    const bookingDateStr = format(new Date(booking.slot.startTime), 'yyyy-MM-dd');
    const dayBookings = bookings
      .filter(b => format(new Date(b.slot.startTime), 'yyyy-MM-dd') === bookingDateStr)
      .sort((a, b) => new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime());
    
    const index = dayBookings.findIndex(b => b.id === booking.id);
    return (index + 1).toString();
  };

  const getStatusGroup = (booking: BookingWithSlot) => {
    const d = new Date(booking.slot.startTime);
    const isPast = d < todayStart && format(d, 'yyyy-MM-dd') !== todayStr;
    if (isPast) return 2;
    if (booking.verificationStatus === 'confirmed' || !!booking.confirmedBy) return 1;
    return 0;
  };

  const filteredBookings = bookings?.filter(booking => {
    const bookingDate = new Date(booking.slot.startTime);

    // Quick filter takes precedence over date picker
    if (quickFilter === 'today') {
      return format(bookingDate, 'yyyy-MM-dd') === todayStr;
    }
    if (quickFilter === 'upcoming') {
      return bookingDate >= todayStart && format(bookingDate, 'yyyy-MM-dd') !== todayStr;
    }
    if (quickFilter === 'past') {
      return bookingDate < todayStart;
    }
    if (quickFilter === 'this-week') {
      return bookingDate >= thisWeekStart && bookingDate <= thisWeekEnd;
    }
    if (quickFilter === 'next-week') {
      return bookingDate >= nextWeekStart && bookingDate <= nextWeekEnd;
    }
    if (quickFilter === 'today-confirmed') {
      return format(bookingDate, 'yyyy-MM-dd') === todayStr &&
        (booking.verificationStatus === 'confirmed' || !!booking.confirmedBy);
    }
    if (quickFilter === 'pending-7days') {
      return bookingDate >= todayStart && bookingDate <= statNext7DaysEnd &&
        booking.verificationStatus !== 'confirmed' && !booking.confirmedBy;
    }
    if (quickFilter === 'all-pending') {
      return booking.verificationStatus !== 'confirmed' && !booking.confirmedBy;
    }
    if (quickFilter === 'confirmed-7days') {
      return bookingDate >= todayStart && bookingDate <= statNext7DaysEnd &&
        (booking.verificationStatus === 'confirmed' || !!booking.confirmedBy);
    }

    if (filterDate && filterEndDate) {
      return bookingDate >= startOfDay(filterDate) && bookingDate <= endOfDay(filterEndDate);
    } else if (filterDate) {
      // Compare using local date strings to avoid timezone issues
      const bookingDateStr = format(bookingDate, 'yyyy-MM-dd');
      const filterDateStr = format(filterDate, 'yyyy-MM-dd');
      return bookingDateStr === filterDateStr;
    }

    return true;
  })?.sort((a, b) => {
    if (quickFilter === 'all' && !filterDate) {
      const groupA = getStatusGroup(a);
      const groupB = getStatusGroup(b);
      if (groupA !== groupB) return groupA - groupB;
    }
    return new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime();
  });

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

    setBillingDetails({
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
    });
    setIsBillingOpen(true);
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

  if (authLoading) {
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

  // ── QR code helper ─────────────────────────────────────────────
  const buildQRDataUrl = (text: string): string => {
    try {
      const qr = (QRLib as any)(text);
      const cells: boolean[][] = qr.modules;
      const sz = 3; const pad = sz * 2;
      const dim = cells.length * sz + pad * 2;
      const canvas = document.createElement('canvas');
      canvas.width = dim; canvas.height = dim;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, dim, dim);
      ctx.fillStyle = '#085041';
      cells.forEach((row, r) => row.forEach((on, c) => {
        if (on) ctx.fillRect(pad + c * sz, pad + r * sz, sz, sz);
      }));
      return canvas.toDataURL('image/png');
    } catch { return ''; }
  };

  const generatePDF = () => {
    if (!billingBooking) return;

    const doc = new jsPDF();
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ── Palette ───────────────────────────────────────────────────
    const indigoDark: [number, number, number]  = [8,   80,  65];
    const magenta: [number, number, number]     = [29,  158, 117];
    const indigoMid: [number, number, number]   = [15,  155, 110];
    const lightBg: [number, number, number]     = [225, 245, 238];
    const metaBg: [number, number, number]      = [209, 237, 226];
    const totalRowBg: [number, number, number]  = [193, 229, 215];
    const textDark: [number, number, number]    = [8,   40,  32];
    const textMid: [number, number, number]     = [50,  100, 80];
    const textLight: [number, number, number]   = [150, 148, 180];
    const white: [number, number, number]       = [255, 255, 255];

    // ── Top gradient bar (7 px) ──────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, 0, pageWidth * 0.55, 7, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, 7, "F");

    // ── Medical cross icon (left of clinic name) ─────────────────
    const iconX = margin;
    const iconY = 12;
    const cs    = 4.5;                       // cross arm size
    const cw    = 1.4;                       // cross arm width
    doc.setFillColor(...indigoMid);
    doc.rect(iconX + (cs - cw) / 2, iconY,        cw, cs, "F"); // vertical
    doc.rect(iconX,                  iconY + (cs - cw) / 2, cs, cw, "F"); // horizontal

    // ── Header left: clinic name + subtitle ─────────────────────
    const nameX = iconX + cs + 3;
    doc.setFontSize(19);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(billingDetails.clinicName || "Clinic", nameX, 20);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...indigoMid);
    doc.text("Medical Services Receipt", nameX, 27);

    // ── Header right: address (wrapped) + phone + email ─────────
    const rightX        = pageWidth - margin;
    const rightColWidth = pageWidth * 0.42;   // max width for right column text
    let   contactY      = 11;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);

    if (billingDetails.clinicAddress) {
      const addrLines: string[] = doc.splitTextToSize(billingDetails.clinicAddress, rightColWidth);
      addrLines.forEach((line: string) => {
        doc.text(line, rightX, contactY, { align: "right" });
        contactY += 4.2;
      });
    }
    if (billingDetails.clinicPhone) {
      doc.text(`Tel: ${billingDetails.clinicPhone}`, rightX, contactY, { align: "right" });
      contactY += 4.2;
    }
    if (billingDetails.clinicEmail) {
      doc.text(billingDetails.clinicEmail, rightX, contactY, { align: "right" });
    }

    // ── Divider ──────────────────────────────────────────────────
    doc.setDrawColor(...indigoDark);
    doc.setLineWidth(0.5);
    doc.line(margin, 33, pageWidth - margin, 33);

    // ── 2-row Meta band ───────────────────────────────────────────
    const metaY = 34;
    const metaH = 17;
    doc.setFillColor(...metaBg);
    doc.rect(margin, metaY, pageWidth - margin * 2, metaH, "F");

    // Row 1: Receipt # | Visit ID + Doctor | Date
    const metaRow1Y = metaY + 5.5;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);
    doc.text(`Receipt #  ${billingDetails.receiptNumber}`, margin + 4, metaRow1Y);
    const midParts = [
      billingDetails.visitId ? `Visit ID: ${billingDetails.visitId}` : "",
      billingDetails.doctorName ? `Dr. ${billingDetails.doctorName}` : "",
    ].filter(Boolean);
    if (midParts.length) doc.text(midParts.join("   |   "), pageWidth / 2, metaRow1Y, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoDark);
    doc.text(`Date: ${billingDetails.date}`, rightX - 4, metaRow1Y, { align: "right" });

    // Row 2: Payment Mode | Status badge
    const metaRow2Y = metaY + 12.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);
    doc.text(`Payment Mode:  ${billingDetails.paymentMethod || "Cash"}`, margin + 4, metaRow2Y);
    const statusRgb: [number,number,number] =
      billingDetails.paymentStatus === "paid"    ? [22, 163, 74]  :
      billingDetails.paymentStatus === "partial" ? [37,  99, 235] : [217, 119, 6];
    const statusLabel =
      billingDetails.paymentStatus === "paid"    ? "Paid"    :
      billingDetails.paymentStatus === "partial" ? "Partial" : "Pending";
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...statusRgb);
    doc.text(`Status: ${statusLabel}`, rightX - 4, metaRow2Y, { align: "right" });

    // ── Patient Information table ─────────────────────────────────
    const patientBody: string[][] = [
      ["Name",             billingDetails.patientName],
      ["Phone",            billingDetails.patientPhone],
      ["Email",            billingDetails.patientEmail || "—"],
      ["Appointment Date", billingDetails.date],
    ];
    if (billingDetails.doctorName) patientBody.push(["Doctor", billingDetails.doctorName]);

    autoTable(doc, {
      startY: metaY + metaH + 4,
      head: [["Patient Information", ""]],
      body: patientBody,
      theme: "grid",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 9, halign: "left",
                    cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 48, textColor: textDark, fillColor: lightBg, fontSize: 8,
             cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        1: { textColor: textMid, fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      },
      bodyStyles: { cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });

    // ── Split services: pharmacy vs. others ───────────────────────
    const pharmItems  = billingDetails.services.filter(s => s.category === "Pharmacy");
    const serviceItems = billingDetails.services.filter(s => s.category !== "Pharmacy");
    let currentY = (doc as any).lastAutoTable.finalY + 5;

    // ── Prescription Summary (pharmacy) ──────────────────────────
    if (pharmItems.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [["Prescription Summary", "Dosage", "Qty", "Freq.", "Duration", "Price"]],
        body: pharmItems.map(s => [
          s.description,
          s.dosage || "—",
          String(s.qty ?? 1),
          s.frequency || "—",
          s.duration || "—",
          `₹${parseFloat(s.amount || "0").toFixed(2)}`,
        ]),
        theme: "grid",
        headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 8.5,
                      cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 } },
        columnStyles: {
          0: { textColor: textDark, fontSize: 8 },
          1: { textColor: textMid, fontSize: 8, cellWidth: 20 },
          2: { textColor: textMid, fontSize: 8, cellWidth: 12, halign: "center" },
          3: { textColor: textMid, fontSize: 8, cellWidth: 16, halign: "center" },
          4: { textColor: textMid, fontSize: 8, cellWidth: 18, halign: "center" },
          5: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 22 },
        },
        alternateRowStyles: { fillColor: [240, 250, 246] as [number,number,number] },
        bodyStyles: { cellPadding: { top: 2, bottom: 2, left: 4, right: 4 } },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Service Summary (non-pharmacy) ────────────────────────────
    if (serviceItems.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [["Service Summary", "Category", "Amount"]],
        body: serviceItems.map(s => [
          s.description,
          s.category || "Consultation",
          `₹${parseFloat(s.amount || "0").toFixed(2)}`,
        ]),
        theme: "striped",
        headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 8.5,
                      cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        columnStyles: {
          0: { textColor: textDark, fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
          1: { textColor: textMid, fontSize: 8, cellWidth: 38, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
          2: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 32,
               cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        },
        alternateRowStyles: { fillColor: [248, 251, 249] as [number,number,number] },
        bodyStyles: { cellPadding: 2.5 },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Totals (right-aligned) ────────────────────────────────────
    const subtotal    = billingDetails.services.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const discountPct = parseFloat(billingDetails.discount) || 0;
    const taxPct      = parseFloat(billingDetails.tax) || 0;
    const discountAmt = subtotal * (discountPct / 100);
    const taxAmt      = (subtotal - discountAmt) * (taxPct / 100);
    const total       = subtotal - discountAmt + taxAmt;

    const afterServicesY = currentY;
    autoTable(doc, {
      startY: afterServicesY,
      head: [],
      body: [
        ["Subtotal",                    `₹${subtotal.toFixed(2)}`],
        [`Discount (${discountPct}%)`,  `− ₹${discountAmt.toFixed(2)}`],
        [`Tax / GST (${taxPct}%)`,      `+ ₹${taxAmt.toFixed(2)}`],
        ["Total Amount Due",            `₹${total.toFixed(2)}`],
      ],
      theme: "grid",
      columnStyles: {
        0: { halign: "right", textColor: textMid, fontSize: 8, cellWidth: 50,
             cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        1: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 36,
             cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      },
      bodyStyles: { cellPadding: 2.5 },
      willDrawCell: (data: any) => { if (data.row.index === 3 && data.section === "body") doc.setFillColor(...totalRowBg); },
      didDrawCell:  (data: any) => { if (data.row.index === 3 && data.section === "body") { doc.setFont("helvetica","bold"); doc.setTextColor(...indigoDark); } },
      margin: { left: pageWidth / 2 + 3, right: margin },
    });

    // ── Payment Details box (full width) ──────────────────────────
    const totalsEndY = (doc as any).lastAutoTable.finalY;
    const pmtBoxY  = totalsEndY + 6;
    const pmtBoxW  = pageWidth - margin * 2;
    const pmtBoxH  = billingDetails.remarks ? 30 : 26;
    const qrSize   = pmtBoxH - 4;

    const qrPayload = `Receipt:${billingDetails.receiptNumber}|Clinic:${billingDetails.clinicName}|Patient:${billingDetails.patientName}|Total:${total.toFixed(2)}`;
    const qrDataUrl = buildQRDataUrl(qrPayload);

    doc.setFillColor(...lightBg);
    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, pmtBoxY, pmtBoxW, pmtBoxH, 2.5, 2.5, "FD");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoMid);
    doc.text("PAYMENT DETAILS", margin + 5, pmtBoxY + 6);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(billingDetails.paymentMethod || "Cash", margin + 5, pmtBoxY + 14);

    if (billingDetails.transactionId) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textMid);
      doc.text(`TXN: ${billingDetails.transactionId}`, margin + 5, pmtBoxY + 21);
    }

    if (billingDetails.remarks) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textMid);
      const rl: string[] = doc.splitTextToSize(`Note: ${billingDetails.remarks}`, pmtBoxW - qrSize - 16);
      doc.text(rl, margin + 5, pmtBoxY + (billingDetails.transactionId ? 26 : 21));
    }

    // Status badge
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...statusRgb);
    doc.text(`✓ ${statusLabel}`, pageWidth / 2, pmtBoxY + 14, { align: "center" });

    // QR code (right of payment box)
    if (qrDataUrl) {
      const qrX = margin + pmtBoxW - qrSize - 2;
      const qrY = pmtBoxY + (pmtBoxH - qrSize) / 2;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    }

    // ── Thank-you + fine print ────────────────────────────────────
    const finalY = pmtBoxY + pmtBoxH + 10;

    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY - 4, pageWidth - margin, finalY - 4);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoMid);
    doc.text(`Thank you for choosing ${billingDetails.clinicName || "us"}!`, pageWidth / 2, finalY, { align: "center" });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textLight);
    doc.text(
      "This is a computer generated receipt and does not require a physical signature.",
      pageWidth / 2, finalY + 6, { align: "center" }
    );

    // ── Bottom gradient bar ───────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, pageHeight - 8, pageWidth * 0.55, 8, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, pageHeight - 8, pageWidth * 0.45, 8, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...white);
    doc.text("Powered by BookMySlot", pageWidth / 2, pageHeight - 3, { align: "center" });

    doc.save(`receipt_${billingDetails.patientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);

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

  const printBillFromRecord = (bill: PatientBill) => {
    const doc = new jsPDF();
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const indigoDark: [number,number,number] = [8,80,65];
    const magenta: [number,number,number]    = [29,158,117];
    const indigoMid: [number,number,number]  = [15,155,110];
    const lightBg: [number,number,number]    = [225,245,238];
    const metaBg: [number,number,number]     = [209,237,226];
    const totalRowBg: [number,number,number] = [193,229,215];
    const textDark: [number,number,number]   = [8,40,32];
    const textMid: [number,number,number]    = [50,100,80];
    const textLight: [number,number,number]  = [150,148,180];
    const white: [number,number,number]      = [255,255,255];

    const clinicName = (clinic as any)?.name || "Clinic";
    const rightX = pageWidth - margin;
    const rightColWidth = pageWidth * 0.42;
    const billDate = bill.createdAt ? format(new Date(bill.createdAt), "PPP") : format(new Date(), "PPP");

    // Find booking for doctor info
    const linkedBooking = bookings?.find(b => b.id === (bill as any).bookingId);
    const doctorName = (linkedBooking as any)?.assignedDoctor || "";

    // ── Top gradient bar ──────────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, 0, pageWidth * 0.55, 7, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, 7, "F");

    // ── Medical cross icon ────────────────────────────────────────
    const cs = 4.5; const cw = 1.4;
    doc.setFillColor(...indigoMid);
    doc.rect(margin + (cs - cw) / 2, 12, cw, cs, "F");
    doc.rect(margin, 12 + (cs - cw) / 2, cs, cw, "F");

    // ── Clinic name + tagline ─────────────────────────────────────
    const nameX = margin + cs + 3;
    doc.setFontSize(19); doc.setFont("helvetica","bold"); doc.setTextColor(...textDark);
    doc.text(clinicName, nameX, 20);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(...indigoMid);
    doc.text("Caring for Your Smile", nameX, 27);

    // ── Header right: phone, email, address ──────────────────────
    let contactY = 11;
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(...textMid);
    if ((clinic as any)?.phone) { doc.text((clinic as any).phone, rightX, contactY, {align:"right"}); contactY += 4.2; }
    if ((clinic as any)?.email) { doc.text((clinic as any).email, rightX, contactY, {align:"right"}); contactY += 4.2; }
    if ((clinic as any)?.address) {
      doc.splitTextToSize((clinic as any).address, rightColWidth)
        .forEach((l: string) => { doc.text(l, rightX, contactY, {align:"right"}); contactY += 4.2; });
    }

    // ── Divider ───────────────────────────────────────────────────
    doc.setDrawColor(...indigoDark); doc.setLineWidth(0.5);
    doc.line(margin, 33, pageWidth - margin, 33);

    // ── 2-row Meta band ───────────────────────────────────────────
    const metaY = 34; const metaH = 17;
    doc.setFillColor(...metaBg);
    doc.rect(margin, metaY, pageWidth - margin * 2, metaH, "F");

    const metaRow1Y = metaY + 5.5;
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(...textMid);
    doc.text(`Receipt #  ${bill.billNumber}`, margin + 4, metaRow1Y);
    const bMidParts = [
      `Visit ID: ${(bill as any).bookingId || "—"}`,
      doctorName ? `Dr. ${doctorName}` : "",
    ].filter(Boolean);
    doc.text(bMidParts.join("   |   "), pageWidth / 2, metaRow1Y, { align: "center" });
    doc.setFont("helvetica","bold"); doc.setTextColor(...indigoDark);
    doc.text(`Date: ${billDate}`, rightX - 4, metaRow1Y, { align: "right" });

    const metaRow2Y = metaY + 12.5;
    doc.setFont("helvetica","normal"); doc.setTextColor(...textMid);
    doc.text(`Payment Mode:  ${bill.paymentMethod || "Cash"}`, margin + 4, metaRow2Y);
    const bStatusRgb: [number,number,number] =
      bill.paymentStatus === "paid"    ? [22, 163, 74]  :
      bill.paymentStatus === "partial" ? [37,  99, 235] : [217, 119, 6];
    const bStatusLabel = bill.paymentStatus === "paid" ? "Paid" : bill.paymentStatus === "partial" ? "Partial" : "Pending";
    doc.setFont("helvetica","bold"); doc.setTextColor(...bStatusRgb);
    doc.text(`Status: ${bStatusLabel}`, rightX - 4, metaRow2Y, { align: "right" });

    // ── Patient Information table ─────────────────────────────────
    const patientRows: string[][] = [
      ["Name",  bill.patientName],
      ["Phone", bill.patientPhone || "—"],
      ["Email", bill.patientEmail || "—"],
      ["Date",  billDate],
    ];
    if (doctorName) patientRows.push(["Doctor", doctorName]);

    autoTable(doc, {
      startY: metaY + metaH + 4,
      head: [["Patient Information",""]],
      body: patientRows,
      theme: "grid",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle:"bold", fontSize:9, halign:"left",
                    cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
      columnStyles: {
        0: { fontStyle:"bold", cellWidth:48, textColor:textDark, fillColor:lightBg, fontSize:8,
             cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
        1: { textColor:textMid, fontSize:8, cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
      },
      bodyStyles: { cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });

    // ── Split services: pharmacy vs. others ───────────────────────
    const allSvcs = (bill.services as any[]) || [];
    const bPharmItems   = allSvcs.filter(s => s.category === "Pharmacy");
    const bServiceItems = allSvcs.filter(s => s.category !== "Pharmacy");
    let currentY = (doc as any).lastAutoTable.finalY + 5;

    // ── Prescription Summary ──────────────────────────────────────
    if (bPharmItems.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [["Prescription Summary","Dosage","Qty","Freq.","Duration","Price"]],
        body: bPharmItems.map((s: any) => [
          s.medicine || s.description || "—",
          s.dosage || "—",
          String(s.qty ?? 1),
          s.frequency || "—",
          s.duration || "—",
          `₹${(s.amount || 0).toFixed(2)}`,
        ]),
        theme: "grid",
        headStyles: { fillColor: indigoDark, textColor: white, fontStyle:"bold", fontSize:8.5,
                      cellPadding:{top:2.5,bottom:2.5,left:4,right:4} },
        columnStyles: {
          0: { textColor:textDark, fontSize:8 },
          1: { textColor:textMid, fontSize:8, cellWidth:20 },
          2: { textColor:textMid, fontSize:8, cellWidth:12, halign:"center" },
          3: { textColor:textMid, fontSize:8, cellWidth:16, halign:"center" },
          4: { textColor:textMid, fontSize:8, cellWidth:18, halign:"center" },
          5: { halign:"right", textColor:textDark, fontSize:8, cellWidth:22 },
        },
        alternateRowStyles: { fillColor: [240,250,246] as [number,number,number] },
        bodyStyles: { cellPadding:{top:2,bottom:2,left:4,right:4} },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Service Summary ───────────────────────────────────────────
    if (bServiceItems.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [["Service Summary","Category","Amount"]],
        body: bServiceItems.map((s: any) => [
          s.description || "—",
          s.category || "Consultation",
          `₹${(s.amount || 0).toFixed(2)}`,
        ]),
        theme: "striped",
        headStyles: { fillColor: indigoDark, textColor: white, fontStyle:"bold", fontSize:8.5,
                      cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
        columnStyles: {
          0: { textColor:textDark, fontSize:8, cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
          1: { textColor:textMid,  fontSize:8, cellWidth:38, cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
          2: { halign:"right", textColor:textDark, fontSize:8, cellWidth:32,
               cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
        },
        alternateRowStyles: { fillColor: [248,251,249] as [number,number,number] },
        bodyStyles: { cellPadding: 2.5 },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // Fallback if no items at all
    if (allSvcs.length === 0) {
      autoTable(doc, {
        startY: currentY,
        head: [["Service Summary","Amount"]],
        body: [["—","₹0.00"]],
        theme: "striped",
        headStyles: { fillColor: indigoDark, textColor: white, fontStyle:"bold", fontSize:9 },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Totals ────────────────────────────────────────────────────
    const discountAmt = (bill.subtotal || 0) * ((bill.discountPct || 0) / 100);
    const taxAmt = ((bill.subtotal || 0) - discountAmt) * ((bill.taxPct || 0) / 100);

    autoTable(doc, {
      startY: currentY,
      head: [],
      body: [
        ["Subtotal",                        `₹${(bill.subtotal||0).toFixed(2)}`],
        [`Discount (${bill.discountPct||0}%)`, `− ₹${discountAmt.toFixed(2)}`],
        [`Tax / GST (${bill.taxPct||0}%)`,    `+ ₹${taxAmt.toFixed(2)}`],
        ["Total Amount Due",               `₹${(bill.total||0).toFixed(2)}`],
      ],
      theme: "grid",
      columnStyles: {
        0: { halign:"right", textColor:textMid, fontSize:8, cellWidth:50,
             cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
        1: { halign:"right", textColor:textDark, fontSize:8, cellWidth:36,
             cellPadding:{top:2.5,bottom:2.5,left:5,right:5} },
      },
      bodyStyles: { cellPadding: 2.5 },
      willDrawCell: (data: any) => { if (data.row.index === 3 && data.section === "body") doc.setFillColor(...totalRowBg); },
      didDrawCell:  (data: any) => { if (data.row.index === 3 && data.section === "body") { doc.setFont("helvetica","bold"); doc.setTextColor(...indigoDark); } },
      margin: { left: pageWidth / 2 + 3, right: margin },
    });

    // ── Payment Details box (full width) ──────────────────────────
    const totalsEndY = (doc as any).lastAutoTable.finalY;
    const pmtBoxY  = totalsEndY + 6;
    const pmtBoxW  = pageWidth - margin * 2;
    const pmtBoxH  = 26;
    const qrSize   = pmtBoxH - 4;

    const qrPayload = `Receipt:${bill.billNumber}|Clinic:${clinicName}|Patient:${bill.patientName}|Total:${(bill.total||0).toFixed(2)}`;
    const qrDataUrl = buildQRDataUrl(qrPayload);

    doc.setFillColor(...lightBg);
    doc.setDrawColor(...indigoMid); doc.setLineWidth(0.3);
    doc.roundedRect(margin, pmtBoxY, pmtBoxW, pmtBoxH, 2.5, 2.5, "FD");

    doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...indigoMid);
    doc.text("PAYMENT DETAILS", margin + 5, pmtBoxY + 6);

    doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...textDark);
    doc.text(bill.paymentMethod || "Cash", margin + 5, pmtBoxY + 14);

    // Status badge (centre)
    doc.setFontSize(8.5); doc.setFont("helvetica","bold"); doc.setTextColor(...bStatusRgb);
    doc.text(`✓ ${bStatusLabel}`, pageWidth / 2, pmtBoxY + 14, { align: "center" });

    // QR code
    if (qrDataUrl) {
      const qrX = margin + pmtBoxW - qrSize - 2;
      const qrY = pmtBoxY + (pmtBoxH - qrSize) / 2;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    }

    // ── Thank-you + fine print ────────────────────────────────────
    const finalY = pmtBoxY + pmtBoxH + 10;
    doc.setDrawColor(...indigoMid); doc.setLineWidth(0.3);
    doc.line(margin, finalY - 4, pageWidth - margin, finalY - 4);

    doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...indigoMid);
    doc.text(`Thank you for choosing ${clinicName}!`, pageWidth / 2, finalY, {align:"center"});
    doc.setFontSize(6.5); doc.setFont("helvetica","normal"); doc.setTextColor(...textLight);
    doc.text("This is a computer generated receipt and does not require a physical signature.", pageWidth / 2, finalY + 6, {align:"center"});

    // ── Bottom gradient bar ───────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, pageHeight - 8, pageWidth * 0.55, 8, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, pageHeight - 8, pageWidth * 0.45, 8, "F");
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(...white);
    doc.text("Powered by BookMySlot", pageWidth / 2, pageHeight - 3, {align:"center"});

    doc.save(`receipt_${bill.patientName.replace(/\s+/g,"_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
    notify.success("Receipt Printed", { description: `${bill.billNumber} downloaded.` });
  };

  const generateConsentPdf = (booking: BookingWithSlot) => {
    const doc = new jsPDF();
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // ── Colour palette (matches billing PDF) ─────────────────────
    const indigoDark: [number, number, number]  = [8,   80,  65];
    const magenta: [number, number, number]     = [29,  158, 117];
    const indigoMid: [number, number, number]   = [15,  155, 110];
    const lightBg: [number, number, number]     = [225, 245, 238];
    const metaBg: [number, number, number]      = [209, 237, 226];
    const textDark: [number, number, number]    = [8,   40,  32];
    const textMid: [number, number, number]     = [50,  100, 80];
    const textLight: [number, number, number]   = [150, 148, 180];
    const white: [number, number, number]       = [255, 255, 255];

    // ── Top gradient bar ─────────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, 0, pageWidth * 0.55, 7, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, 7, "F");

    // ── Medical cross icon ───────────────────────────────────────
    const iconX = margin;
    const iconY = 12;
    const cs    = 4.5;
    const cw    = 1.4;
    doc.setFillColor(...indigoMid);
    doc.rect(iconX + (cs - cw) / 2, iconY,                   cw, cs, "F");
    doc.rect(iconX,                  iconY + (cs - cw) / 2,  cs, cw, "F");

    // ── Header left: clinic name + subtitle ──────────────────────
    const nameX = iconX + cs + 3;
    doc.setFontSize(19);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(clinic?.name || "Clinic", nameX, 20);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...indigoMid);
    doc.text("Digital Informed Consent Form", nameX, 27);

    // ── Header right: address / phone ────────────────────────────
    const rightX        = pageWidth - margin;
    const rightColWidth = pageWidth * 0.42;
    let   contactY      = 11;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);

    if (clinic?.address) {
      const addrLines: string[] = doc.splitTextToSize(clinic.address, rightColWidth);
      addrLines.forEach((line: string) => {
        doc.text(line, rightX, contactY, { align: "right" });
        contactY += 4.2;
      });
    }
    if (clinic?.phone) {
      doc.text(`Tel: ${clinic.phone}`, rightX, contactY, { align: "right" });
      contactY += 4.2;
    }
    if (clinic?.email) {
      doc.text(clinic.email, rightX, contactY, { align: "right" });
    }

    // ── Divider ──────────────────────────────────────────────────
    doc.setDrawColor(...indigoDark);
    doc.setLineWidth(0.5);
    doc.line(margin, 33, pageWidth - margin, 33);

    // ── Meta band ────────────────────────────────────────────────
    const metaY = 34;
    const metaH = 10;
    doc.setFillColor(...metaBg);
    doc.rect(margin, metaY, pageWidth - margin * 2, metaH, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoMid);
    doc.text("DIGITAL CONSENT RECORD", pageWidth / 2, metaY + 6.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);
    doc.text(
      `Generated: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`,
      rightX - 4, metaY + 6.5, { align: "right" }
    );

    // ── Patient details table ────────────────────────────────────
    autoTable(doc, {
      startY: metaY + metaH + 5,
      head: [["Patient & Appointment Details", ""]],
      body: [
        ["Patient Name",   booking.customerName],
        ["Phone",          booking.customerPhone],
        ["Appointment",    format(new Date(booking.slot.startTime), "dd MMM yyyy, hh:mm a")],
        ["Clinic",         clinic?.name || ""],
      ],
      theme: "grid",
      headStyles: {
        fillColor: indigoDark, textColor: white, fontStyle: "bold",
        fontSize: 9, halign: "left",
        cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 48, textColor: textDark, fillColor: lightBg,
             fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
        1: { textColor: textMid, fontSize: 8.5,
             cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      },
      bodyStyles: { cellPadding: 3 },
      margin: { left: margin, right: margin },
    });

    let curY = (doc as any).lastAutoTable.finalY + 9;

    // ── Consent Declaration heading ──────────────────────────────
    doc.setFillColor(...lightBg);
    doc.rect(margin, curY, pageWidth - margin * 2, 7, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoDark);
    doc.text("CONSENT DECLARATION", margin + 4, curY + 4.8);
    curY += 11;

    // ── Consent body text ────────────────────────────────────────
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);

    const textW = pageWidth - margin * 2;

    const para1 = `I, ${booking.customerName}, hereby give my informed consent to ${clinic?.name || "the clinic"} to perform dental examination and any necessary dental treatment deemed appropriate by the treating dentist.`;
    const p1Lines: string[] = doc.splitTextToSize(para1, textW);
    doc.text(p1Lines, margin, curY);
    curY += p1Lines.length * 5 + 4;

    doc.text("I understand and acknowledge the following:", margin, curY);
    curY += 6;

    const bullets = [
      "The nature of the proposed treatment and its alternatives have been explained to me.",
      "All dental procedures carry certain risks including pain, swelling, and infection.",
      "I am responsible for informing the clinic of any allergies or medical conditions.",
      "My personal and health information will be kept confidential.",
      "I have the right to withdraw consent at any time before treatment begins.",
    ];
    doc.setTextColor(...textMid);
    bullets.forEach(b => {
      const bLines: string[] = doc.splitTextToSize(`\u2022  ${b}`, textW - 6);
      doc.text(bLines, margin + 4, curY);
      curY += bLines.length * 5 + 1.5;
    });

    curY += 2;
    doc.setTextColor(...textDark);
    const para3 = `By signing below, I confirm that I have read and understood the above and voluntarily consent to the dental care at ${clinic?.name || "the clinic"}.`;
    const p3Lines: string[] = doc.splitTextToSize(para3, textW);
    doc.text(p3Lines, margin, curY);
    curY += p3Lines.length * 5 + 10;

    // ── Signature section ────────────────────────────────────────
    doc.setFillColor(...lightBg);
    doc.rect(margin, curY, pageWidth - margin * 2, 7, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoDark);
    doc.text("PATIENT SIGNATURE", margin + 4, curY + 4.8);
    curY += 10;

    // signature image box
    const sigBoxW = 90;
    const sigBoxH = 40;
    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, curY, sigBoxW, sigBoxH, 2, 2, "D");

    if (booking.consentSignature) {
      try {
        doc.addImage(booking.consentSignature, "PNG", margin + 2, curY + 2, sigBoxW - 4, sigBoxH - 4);
      } catch (_) {}
    }
    curY += sigBoxH + 5;

    // signed on + audit line
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);
    if (booking.consentSignedAt) {
      doc.text(
        `Signed digitally on: ${format(new Date(booking.consentSignedAt), "dd MMMM yyyy 'at' hh:mm a")}`,
        margin, curY
      );
      curY += 5;
    }
    doc.text("IP address recorded for audit purposes. This is a legally binding digital consent.", margin, curY);
    curY += 12;

    // ── Footer ───────────────────────────────────────────────────
    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.3);
    doc.line(margin, curY - 4, pageWidth - margin, curY - 4);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoMid);
    doc.text(`Thank you for choosing ${clinic?.name || "us"}!`, pageWidth / 2, curY, { align: "center" });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textLight);
    doc.text(
      "This document was generated by BookMySlot and serves as the official digital consent record.",
      pageWidth / 2, curY + 6, { align: "center" }
    );

    // ── Bottom gradient bar ───────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, pageHeight - 8, pageWidth * 0.55, 8, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, pageHeight - 8, pageWidth * 0.45, 8, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...white);
    doc.text("Powered by BookMySlot", pageWidth / 2, pageHeight - 3, { align: "center" });

    const fileName = `consent_${booking.customerName.replace(/\s+/g, "_")}_${format(new Date(booking.slot.startTime), "yyyyMMdd")}.pdf`;
    doc.save(fileName);
    notify.success("Consent PDF Downloaded", { description: `${fileName} saved successfully.` });
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

  const downloadExcel = () => {
    if (!filteredBookings || filteredBookings.length === 0) {
      notify.warning("No bookings to download");
      return;
    }

    const headers = ["Name", "Phone Number", "Booking Date", "Time Slot"];
    const rows = filteredBookings.map(booking => [
      booking.customerName,
      booking.customerPhone,
      format(new Date(booking.slot.startTime), "yyyy-MM-dd"),
      `${format(new Date(booking.slot.startTime), "h:mm a")} - ${format(new Date(booking.slot.endTime), "h:mm a")}`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bookings_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isUserAuthenticated) {
    return null;
  }

  const next7DaysEnd = addDays(todayStart, 7);
  const todayConfirmedCount = bookings?.filter(b =>
    format(new Date(b.slot.startTime), 'yyyy-MM-dd') === todayStr &&
    (b.verificationStatus === 'confirmed' || !!b.confirmedBy)
  ).length ?? 0;
  const pendingNext7Count = bookings?.filter(b => {
    const d = new Date(b.slot.startTime);
    return d >= todayStart && d <= next7DaysEnd &&
      b.verificationStatus !== 'confirmed' && !b.confirmedBy;
  }).length ?? 0;
  const totalPendingCount = bookings?.filter(b =>
    b.verificationStatus !== 'confirmed' && !b.confirmedBy
  ).length ?? 0;
  const confirmedNext7Count = bookings?.filter(b => {
    const d = new Date(b.slot.startTime);
    return d >= todayStart && d <= next7DaysEnd &&
      (b.verificationStatus === 'confirmed' || !!b.confirmedBy);
  }).length ?? 0;

  return (
    <div className="container mx-auto px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">

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

          <div className="relative flex items-start justify-between gap-4">

            {/* Left: avatar + identity */}
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">

              {/* Logo with glow ring */}
              <div className="shrink-0 relative mt-1">
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

              {/* Name + status badges */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-3xl font-extrabold text-white tracking-tight truncate">
                    {clinic?.name}
                  </h1>
                  {clinic?.id && clinic.id >= 999 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2.5 py-1 rounded-full">
                      <FlaskConical className="h-3 w-3" />
                      Demo
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full">
                    <Building2 className="h-3 w-3" />
                    <span className="sm:hidden">Admin</span>
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

            {/* Sign out */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="shrink-0 min-h-[44px] px-3 text-white/70 hover:text-white hover:bg-white/15 active:bg-white/25 active:scale-[0.97] border border-white/20 gap-2 text-xs transition-all"
              data-testid="button-sign-out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline font-semibold">Sign Out</span>
            </Button>
          </div>

          {/* ── Live stats row ── */}
          <div className="relative mt-5 pt-4 border-t border-white/[0.10] grid grid-cols-2 sm:grid-cols-4 gap-2">
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
        </div>

        {/* Bottom accent line */}
        <div className="h-[2px] bg-gradient-to-r from-accent via-primary to-accent opacity-60" />
      </div>

      {/* Two-column layout: left sidebar + main content */}
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

        {/* ===== LEFT SIDEBAR NAV ===== */}
        <div className="hidden lg:block lg:w-56 shrink-0">
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="p-2 space-y-0.5">

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
                    <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{allBills.length}</span>
                  )}
                  {activePanel === 'accounts' && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
              </button>

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
                  {patientDirectory.length > 0 && (
                    <span className="text-[9px] font-bold bg-rose-500/15 text-rose-600 px-1.5 py-0.5 rounded-full">{patientDirectory.length}</span>
                  )}
                  {activePanel === 'patients' && <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                </div>
              </button>

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
                <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
                  Patients scan to visit your clinic page
                </p>
                {/* URL row */}
                <div className="w-full rounded-xl border border-border/50 bg-muted/30 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Clinic Page URL</p>
                      <p className="text-[10px] text-foreground truncate font-mono mt-0.5">/clinic/{clinic.username || clinic.id}</p>
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
          {/* Stats Cards — click to filter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* Today */}
            <TooltipProvider delayDuration={700}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${quickFilter === 'today' ? 'ring-2 ring-sky-400 border-sky-400/60' : 'border-border/50'}`}
                    onClick={() => setQuickFilter(q => q === 'today' ? 'all' : 'today')}
                    data-testid="card-filter-today"
                  >
                    <div className="h-1 bg-gradient-to-r from-sky-400 to-cyan-400" />
                    <CardContent className="p-3 sm:p-4 text-left flex flex-row items-start gap-2 sm:gap-3">
                      <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${quickFilter === 'today' ? 'bg-sky-400/20' : 'bg-sky-400/10'}`}>
                        <CalendarIcon className="h-3.5 w-3.5 text-sky-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base sm:text-xl font-bold text-sky-600 dark:text-sky-400 leading-tight">{todaysBookingsCount}</p>
                        <p className="text-xs font-medium text-muted-foreground leading-tight">All Bookings Today</p>
                      </div>
                      {quickFilter === 'today' && (
                        <span className="hidden sm:inline ml-auto text-xs font-bold uppercase tracking-wider text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded-full shrink-0">Active</span>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  All appointments scheduled for today
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Upcoming */}
            <TooltipProvider delayDuration={700}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${quickFilter === 'upcoming' ? 'ring-2 ring-primary border-primary/60' : 'border-border/50'}`}
                    onClick={() => setQuickFilter(q => q === 'upcoming' ? 'all' : 'upcoming')}
                    data-testid="card-filter-upcoming"
                  >
                    <div className="h-1 bg-gradient-to-r from-primary to-accent" />
                    <CardContent className="p-3 sm:p-4 text-left flex flex-row items-start gap-2 sm:gap-3">
                      <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${quickFilter === 'upcoming' ? 'bg-primary/20' : 'bg-primary/10'}`}>
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base sm:text-xl font-bold text-primary leading-tight">{futureBookingsCount}</p>
                        <p className="text-xs font-medium text-muted-foreground leading-tight">All Upcoming Bookings</p>
                      </div>
                      {quickFilter === 'upcoming' && (
                        <span className="hidden sm:inline ml-auto text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">Active</span>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  Confirmed & pending appointments from tomorrow onwards
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Past */}
            <TooltipProvider delayDuration={700}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${quickFilter === 'past' ? 'ring-2 ring-slate-400 border-slate-400' : 'border-border/50'}`}
                    onClick={() => setQuickFilter(q => q === 'past' ? 'all' : 'past')}
                    data-testid="card-filter-past"
                  >
                    <div className="h-1 bg-gradient-to-r from-slate-400 to-slate-300" />
                    <CardContent className="p-3 sm:p-4 text-left flex flex-row items-start gap-2 sm:gap-3">
                      <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${quickFilter === 'past' ? 'bg-muted' : 'bg-muted'}`}>
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base sm:text-xl font-bold text-muted-foreground leading-tight">{pastBookingsCount}</p>
                        <p className="text-xs font-medium text-muted-foreground leading-tight">All Past Bookings</p>
                      </div>
                      {quickFilter === 'past' && (
                        <span className="hidden sm:inline ml-auto text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded-full shrink-0">Active</span>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  All appointments that have already passed
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* All — resets all filters */}
            <TooltipProvider delayDuration={700}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                      quickFilter === 'all' && !filterDate
                        ? 'ring-2 ring-violet-500 border-violet-400'
                        : 'border-border/50'
                    }`}
                    onClick={() => { setQuickFilter('all'); setFilterDate(undefined); setFilterEndDate(undefined); }}
                    data-testid="card-filter-all"
                  >
                    <div className={`h-1 bg-gradient-to-r ${quickFilter === 'all' && !filterDate ? 'from-violet-500 to-purple-400' : 'from-amber-500 to-orange-400'}`} />
                    <CardContent className="p-3 sm:p-4 text-left flex flex-row items-start gap-2 sm:gap-3">
                      <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${quickFilter === 'all' && !filterDate ? 'bg-violet-500/20' : 'bg-amber-500/10'}`}>
                        <Filter className={`h-3.5 w-3.5 ${quickFilter === 'all' && !filterDate ? 'text-violet-500' : 'text-amber-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-base sm:text-xl font-bold leading-tight ${quickFilter === 'all' && !filterDate ? 'text-violet-600' : 'text-amber-600'}`}>
                          {bookings?.length || 0}
                        </p>
                        <p className="text-xs font-medium text-muted-foreground leading-tight">All Bookings</p>
                      </div>
                      {quickFilter === 'all' && !filterDate && (
                        <span className="hidden sm:inline ml-auto text-xs font-bold uppercase tracking-wider text-violet-500 bg-violet-500/10 px-1.5 py-0.5 rounded-full shrink-0">Active</span>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  {quickFilter === 'all' && !filterDate
                    ? 'Showing all bookings — click a filter above to narrow down'
                    : `${filteredBookings?.length || 0} bookings match your current filter — click to reset all`
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Compact single-line date range filter */}
          <div className="flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3 py-2 shadow-sm">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="hidden sm:inline text-xs font-medium text-muted-foreground shrink-0">Date range:</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-9 px-2.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${
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
                <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} initialFocus />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground/40 text-xs shrink-0">→</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!filterDate}
                  className={`h-9 px-2.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${
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
                <Calendar mode="single" selected={filterEndDate} onSelect={setFilterEndDate} initialFocus />
              </PopoverContent>
            </Popover>

            {(filterDate || filterEndDate) && (
              <>
                <div className="w-px h-4 bg-border/50 mx-0.5 shrink-0" />
                <button
                  onClick={() => { setFilterDate(undefined); setFilterEndDate(undefined); }}
                  className="inline-flex items-center gap-1 h-9 px-2.5 text-xs font-semibold text-muted-foreground hover:text-destructive active:text-destructive rounded-lg border border-transparent hover:border-destructive/30 active:border-destructive/40 bg-background transition-all active:scale-[0.97]"
                  data-testid="button-clear-date-filter"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </>
            )}
          </div>

          {/* Week filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Quick week:</span>
            <TooltipProvider delayDuration={700}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setQuickFilter(q => q === 'this-week' ? 'all' : 'this-week')}
                    data-testid="chip-filter-this-week"
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-[0.97] ${
                      quickFilter === 'this-week'
                        ? 'bg-violet-500 text-white border-violet-500 shadow-sm'
                        : 'bg-background text-muted-foreground border-border/60 hover:border-violet-400 hover:text-violet-600 active:bg-violet-500/10'
                    }`}
                  >
                    <CalendarIcon className="h-3 w-3" />
                    This Week
                    <span className={`text-xs font-bold px-1 py-0.5 rounded-full ${quickFilter === 'this-week' ? 'bg-white/20 text-white' : 'bg-violet-500/10 text-violet-600'}`}>
                      {thisWeekCount}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  Bookings falling within the current Mon–Sun week
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={700}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setQuickFilter(q => q === 'next-week' ? 'all' : 'next-week')}
                    data-testid="chip-filter-next-week"
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-[0.97] ${
                      quickFilter === 'next-week'
                        ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                        : 'bg-background text-muted-foreground border-border/60 hover:border-indigo-400 hover:text-indigo-600 active:bg-indigo-500/10'
                    }`}
                  >
                    <CalendarDays className="h-3 w-3" />
                    Next Week
                    <span className={`text-xs font-bold px-1 py-0.5 rounded-full ${quickFilter === 'next-week' ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-600'}`}>
                      {nextWeekCount}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  Bookings falling within next Mon–Sun week
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {(quickFilter === 'this-week' || quickFilter === 'next-week') && (
              <button
                onClick={() => setQuickFilter('all')}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Bookings Section */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">

            {/* Bookings header */}
            <div className="bg-gradient-to-r from-primary to-accent px-5 py-4 flex items-center justify-between">
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
                onClick={downloadExcel}
                className="gap-2 text-white/80 hover:text-white hover:bg-white/15 border border-white/20 text-xs"
                disabled={!filteredBookings || filteredBookings.length === 0}
                data-testid="button-download-excel"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </Button>
            </div>

          <div className="p-5 space-y-5">
          {/* Colour key — single-row on desktop, two-row on mobile; hidden for time-specific filters */}
          {!bookingsLoading && (filteredBookings?.length ?? 0) > 0 && quickFilter === 'all' && !filterDate && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border border-border/40 rounded-lg bg-muted/20 px-3 py-2">
              {/* WHEN group */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 w-10 shrink-0">When</span>
                {([
                  { color: "bg-sky-400",                     label: "Today"    },
                  { color: "bg-primary",                     label: "Upcoming" },
                  { color: "bg-slate-300 dark:bg-slate-500", label: "Past"     },
                ] as const).map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`h-[3px] w-4 rounded-full shrink-0 ${color}`} />
                    <span className="text-xs text-muted-foreground/70">{label}</span>
                  </div>
                ))}
              </div>
              {/* divider — visible on desktop only */}
              <span className="hidden sm:block h-3.5 w-px bg-border/60 shrink-0" />
              {/* STATUS group */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 w-10 shrink-0">Status</span>
                {([
                  { color: "bg-emerald-400", label: "Confirmed" },
                  { color: "bg-amber-400",   label: "Pending"   },
                  { color: "bg-rose-400",    label: "Cancelled" },
                ] as const).map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`h-3.5 w-[3px] rounded-full shrink-0 ${color}`} />
                    <span className="text-xs text-muted-foreground/70">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bookingsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <BookingCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBookings?.length === 0 ? (
                <div className="col-span-full py-14 flex flex-col items-center gap-5 text-center bg-muted/10 rounded-2xl border border-dashed border-border/60">
                  <div className="rounded-2xl overflow-hidden bg-white/70 dark:bg-muted/20 p-2 shadow-sm">
                    <img
                      src={noBookingsImg}
                      alt="No bookings found"
                      className="w-36 h-36 object-contain dark:opacity-75"
                      draggable={false}
                    />
                  </div>
                  <div className="space-y-1.5 max-w-[260px]">
                    <p className="text-base font-semibold text-foreground">
                      {quickFilter !== 'all' || filterDate || filterEndDate
                        ? "No bookings match this filter"
                        : "No bookings yet"}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {quickFilter !== 'all' || filterDate || filterEndDate
                        ? "Try adjusting the date range or filter to find what you're looking for."
                        : "Once patients book a slot, their appointments will appear here."}
                    </p>
                  </div>
                  {quickFilter !== 'all' || filterDate || filterEndDate ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-9"
                      onClick={() => { setQuickFilter('all'); setFilterDate(undefined); setFilterEndDate(undefined); }}
                      data-testid="button-clear-filters-empty"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs h-9 bg-primary hover:bg-primary/90"
                      onClick={() => setActivePanel('configure-slots')}
                      data-testid="button-configure-slots-empty"
                    >
                      Configure Slots →
                    </Button>
                  )}
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
                        booking.description!.split(/[,.\s]+/).map(p => p.trim().toLowerCase()).includes(c.toLowerCase())
                      )
                    : [];

                  const isPending = !isConfirmed && !isBookingPast;
                  const group = isGrouped ? getStatusGroup(booking) : -1;
                  const showDivider = isGrouped && group !== lastGroup;
                  if (isGrouped) lastGroup = group;
                  const groupCfg = groupConfig[Math.max(0, group)];
                  return [
                    showDivider ? (
                      <div key={`divider-group-${group}`} className="col-span-full flex items-center gap-3 mt-2 mb-1">
                        <div className="h-px flex-1 bg-border/50" />
                        <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${groupCfg.textColor} ${groupCfg.bg} ${groupCfg.border}`}>
                          {groupCfg.label}
                          <span className="font-black opacity-70">— {filteredBookings?.filter(b => getStatusGroup(b) === group).length ?? 0}</span>
                        </span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                    ) : null,
                    (
                  <Dialog
                    key={booking.id}
                    open={openBookingId === booking.id}
                    onOpenChange={(open) => { if (!open) setOpenBookingId(null); }}
                  >
                    <AppointmentCard
                      role="clinic"
                      booking={booking}
                      bookingNumber={getBookingNumber(booking)}
                      complaints={complaints}
                      onCardClick={() => setOpenBookingId(booking.id)}
                      onConfirm={() => confirmBookingMutation.mutate(booking.id)}
                      onCancel={(reason) => cancelBookingMutation.mutate({ id: booking.id, reason })}
                      onBill={() => handleOpenBilling(booking)}
                      onAssignDoctor={(name, email) => assignDoctorMutation.mutate({ bookingId: booking.id, doctorName: name, doctorEmail: email })}
                      assignDoctorPending={assignDoctorMutation.isPending}
                      confirmPending={confirmBookingMutation.isPending}
                    />
                      <DialogContent className="w-[95vw] sm:max-w-[640px] rounded-2xl p-0 overflow-hidden h-[90vh] flex flex-col">

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
                                  REF-{getBookingNumber(booking).padStart(4, '0')}
                                </span>
                              </div>
                              {/* Status text row — smart states, no pill backgrounds */}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {isCancelled ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
                                      <X className="h-2.5 w-2.5" />
                                      Cancelled
                                    </span>
                                    {booking.cancellationReason && (
                                      <span className="text-xs italic text-white/50">
                                        {booking.cancellationReason}
                                      </span>
                                    )}
                                  </div>
                                ) : isConfirmed ? (
                                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                    {booking.confirmedBy === 'doctor'
                                      ? <Stethoscope className="h-2.5 w-2.5" />
                                      : <CheckCircle2 className="h-2.5 w-2.5" />}
                                    {booking.confirmedBy === 'doctor'
                                      ? `Confirmed by Dr. ${booking.assignedDoctor?.split(' ')[0] || 'Doctor'}`
                                      : booking.confirmedBy === 'admin'
                                      ? 'Confirmed by Admin'
                                      : 'Payment Confirmed'}
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
                                    <PenLine className="h-2.5 w-2.5" />
                                    Consent Signed
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
                            return (
                              <button
                                key={key}
                                onClick={() => setModalTab(booking.id, key)}
                                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-2.5 min-h-[44px] text-xs font-semibold transition-all border-b-2 focus-visible:outline-none active:bg-muted/40 ${
                                  isActive
                                    ? 'text-primary border-primary'
                                    : 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30 active:text-foreground'
                                }`}
                                data-testid={`modal-tab-${key}-${booking.id}`}
                              >
                                {icon}
                                <span className="text-xs leading-none">{label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* ── TAB PANELS ── */}
                        <div className="overflow-y-auto flex-1">

                          {/* OVERVIEW TAB */}
                          {getModalTab(booking.id) === 'overview' && (
                            <div className="p-4 space-y-3">

                              {/* Appointment details */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                  <CalendarDays className="h-3 w-3 text-primary" />
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appointment</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-border/50">
                                  <div className="px-3 py-2.5">
                                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Date</p>
                                    <p className="text-sm font-bold text-foreground">{format(bookingDateTime, "MMM d, yyyy")}</p>
                                    <p className="text-xs text-muted-foreground">{format(bookingDateTime, "EEEE")}</p>
                                  </div>
                                  <div className="px-3 py-2.5">
                                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Time</p>
                                    <p className="text-sm font-bold text-foreground">{format(bookingDateTime, "h:mm a")}</p>
                                    <p className="text-xs text-muted-foreground">→ {format(new Date(booking.slot.endTime), "h:mm a")}</p>
                                  </div>
                                  {booking.assignedDoctor && (
                                    <div className="px-3 py-2.5 col-span-2 sm:col-span-1 border-t border-border/50 sm:border-t-0">
                                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Doctor</p>
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                                          <span className="text-xs font-bold text-primary">{booking.assignedDoctor.charAt(0)}</span>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground truncate">Dr. {booking.assignedDoctor}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {booking.createdAt && (
                                  <div className="px-3 py-1.5 bg-muted/20 border-t border-border/40">
                                    <span className="text-xs text-muted-foreground">Booked on {format(new Date(booking.createdAt), "MMM d, yyyy · h:mm a")}</span>
                                  </div>
                                )}
                              </div>

                              {/* Contact / Patient Info */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                  <User className="h-3 w-3 text-primary" />
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</span>
                                </div>
                                <div className="divide-y divide-border/40">
                                  {((booking as any).customerAge || (booking as any).customerGender) && (
                                    <div className="px-3 py-2.5 grid grid-cols-2 gap-3">
                                      {(booking as any).customerAge && (
                                        <div className="flex items-center gap-2">
                                          <div className="h-6 w-6 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                            <CalendarDays className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                          </div>
                                          <span className="text-sm font-medium text-foreground">{(booking as any).customerAge} years</span>
                                        </div>
                                      )}
                                      {(booking as any).customerGender && (
                                        <div className="flex items-center gap-2">
                                          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <User className="h-3 w-3 text-primary" />
                                          </div>
                                          <span className="text-sm font-medium text-foreground capitalize">{(booking as any).customerGender}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="px-3 py-2.5 flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                      <Phone className="h-3 w-3 text-primary" />
                                    </div>
                                    <span className="text-sm font-medium text-foreground">{booking.customerPhone}</span>
                                  </div>
                                  <div className="px-3 py-2.5 flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                      <Mail className="h-3 w-3 text-blue-500" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">{booking.customerEmail || "No email provided"}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Chief Complaints */}
                              {(complaints.length > 0 || booking.description) && (
                                <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                  <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                    <FlaskConical className="h-3 w-3 text-primary" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chief Complaint</span>
                                  </div>
                                  {complaints.length > 0 && (
                                    <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
                                      {complaints.map((c, i) => (
                                        <span key={i} className="inline-flex items-center text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 border border-primary/25 px-2 py-1 rounded-lg">
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {booking.description && complaints.length === 0 && (
                                    <p className="px-3 py-2.5 text-sm text-muted-foreground italic leading-relaxed">"{booking.description}"</p>
                                  )}
                                </div>
                              )}

                              {/* Consent Status */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <ClipboardCheck className="h-3 w-3 text-primary" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Digital Consent</span>
                                  </div>
                                  {booking.consentSignedAt ? (
                                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="h-3 w-3" /> Signed
                                    </span>
                                  ) : null}
                                </div>
                                {booking.consentSignedAt ? (
                                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      Signed on {format(new Date(booking.consentSignedAt), "dd MMM yyyy, hh:mm a")}
                                    </span>
                                    {booking.consentSignature && (
                                      <button
                                        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 active:text-primary/60 transition-colors min-h-[36px] px-1"
                                        onClick={() => generateConsentPdf(booking)}
                                        data-testid={`button-download-consent-${booking.id}`}
                                      >
                                        <Download className="h-3 w-3" />
                                        Download PDF
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                                    <span className="text-xs text-muted-foreground">Not yet signed</span>
                                    <button
                                      className="text-xs font-semibold text-primary hover:text-primary/80 active:text-primary/60 transition-colors disabled:opacity-50 min-h-[36px] px-1"
                                      onClick={() => { requestConsentMutation.mutate(booking.id); setModalTab(booking.id, 'actions'); }}
                                      disabled={requestConsentMutation.isPending && requestConsentMutation.variables === booking.id}
                                      data-testid={`button-request-consent-overview-${booking.id}`}
                                    >
                                      Request Consent →
                                    </button>
                                  </div>
                                )}
                                {!booking.consentSignedAt && consentUrls[booking.id] && (
                                  <div className="px-3 pb-2.5 space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                      Link sent to <strong>{booking.customerPhone}</strong>. Share manually:
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex-1 bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground font-mono truncate">
                                        {consentUrls[booking.id]}
                                      </div>
                                      <button
                                        className="shrink-0 p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 active:bg-muted/60 transition-colors"
                                        onClick={() => { navigator.clipboard.writeText(consentUrls[booking.id]); setCopiedConsentId(booking.id); setTimeout(() => setCopiedConsentId(null), 2000); }}
                                        data-testid={`button-copy-consent-${booking.id}`}
                                      >
                                        {copiedConsentId === booking.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                                      </button>
                                      <a href={consentUrls[booking.id]} target="_blank" rel="noopener noreferrer" className="shrink-0 p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 active:bg-muted/60 transition-colors" data-testid={`link-open-consent-${booking.id}`}>
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>

                            </div>
                          )}

                          {/* CLINICAL TAB */}
                          {getModalTab(booking.id) === 'clinical' && (
                            <div className="p-4 space-y-3">

                              {/* Clinical Status — now interactive for admin */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                  <ClipboardCheck className="h-3 w-3 text-primary" />
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinical Status</span>
                                </div>
                                <div className="px-3 py-3 flex flex-wrap gap-2">
                                  {([
                                    { value: 'first_visit', label: 'First Visit' },
                                    { value: 'revisit', label: 'Revisit' },
                                    { value: 'follow_up_required', label: 'Follow-up Required' },
                                    { value: 'case_closed', label: 'Case Closed' },
                                  ] as const).map(({ value, label }) => {
                                    const isActive = booking.clinicalStatus === value;
                                    return (
                                      <button
                                        key={value}
                                        onClick={() => updateClinicalStatusMutation.mutate({ bookingId: booking.id, clinicalStatus: value })}
                                        disabled={updateClinicalStatusMutation.isPending}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                          isActive
                                            ? value === 'case_closed'
                                              ? 'bg-green-500 text-white border-green-500'
                                              : value === 'follow_up_required'
                                              ? 'bg-amber-500 text-white border-amber-500'
                                              : value === 'revisit'
                                              ? 'bg-blue-500 text-white border-blue-500'
                                              : 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                        }`}
                                        data-testid={`clinical-status-${value}-${booking.id}`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Clinical Records */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                  <ClipboardList className="h-3 w-3 text-primary" />
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinical Records</span>
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
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <CalendarDays className="h-3 w-3 text-primary" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reschedule Appointment</span>
                                  </div>
                                  {rescheduleBookingId === booking.id ? (
                                    <button
                                      className="text-xs font-semibold text-muted-foreground hover:text-foreground active:text-foreground transition-colors min-h-[36px] px-1"
                                      onClick={() => { setRescheduleBookingId(null); setRescheduleSlot(null); }}
                                      data-testid="button-cancel-reschedule"
                                    >
                                      Collapse ↑
                                    </button>
                                  ) : (
                                    <button
                                      className="text-xs font-semibold text-primary hover:text-primary/80 active:text-primary/60 transition-colors min-h-[36px] px-1"
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
                                      <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider block">Select Slot</span>
                                      <div className="grid grid-cols-5 gap-1.5">
                                        {slotTimings.map((slot) => {
                                          const slotTime = new Date(rescheduleDate);
                                          slotTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                                          const isoString = slotTime.toISOString();
                                          const currentBookings = bookings?.filter(b =>
                                            new Date(b.slot.startTime).toISOString() === isoString && b.id !== booking.id
                                          ).length || 0;
                                          const slotMaxBookings = bookings?.find(b => new Date(b.slot.startTime).toISOString() === isoString)?.slot.maxBookings ?? DEFAULT_SECTION_CAPACITY[slot.id] ?? 3;
                                          const isFull = currentBookings >= slotMaxBookings;
                                          const isSelected = rescheduleSlot === slot.id;
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
                                              <span className="text-[10px] font-bold leading-tight px-1 text-center">{slot.label}</span>
                                              <span className="text-[9px] opacity-60 leading-tight mt-0.5">{formatTime(slot.startHour, slot.startMinute)}</span>
                                              {isFull && (
                                                <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-destructive text-destructive-foreground px-1 rounded-full">FULL</span>
                                              )}
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
                                          const configResponse = await apiRequest('POST', '/api/auth/clinic/slots/configure', {
                                            startTime: newSlotTime.toISOString(), maxBookings: 3, isCancelled: false
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
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <ClipboardCheck className="h-3 w-3 text-primary" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request Digital Consent</span>
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
                                        onClick={() => generateConsentPdf(booking)}
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
                              {(clinic?.doctorName || (clinic?.doctors && (clinic.doctors as any[]).length > 0)) && (() => {
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
                                  <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                    <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <Stethoscope className="h-3 w-3 text-primary" />
                                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assign Doctor</span>
                                      </div>
                                      <span className="text-xs text-muted-foreground">{format(new Date(booking.slot.startTime), "MMM d · h:mm a")}</span>
                                    </div>

                                    {/* Specialist suggestion banner */}
                                    {(() => {
                                      const suggested = getRecommendedSpecialists(booking.description || "");
                                      if (!suggested.length) return null;
                                      return (
                                        <div className="mx-2.5 mt-2.5 px-3 py-2 rounded-lg bg-primary/6 border border-primary/20 flex items-start gap-2">
                                          <span className="text-base shrink-0 mt-0.5">💡</span>
                                          <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-1">Suggested specialization</p>
                                            <div className="flex flex-wrap gap-1">
                                              {suggested.map(sp => (
                                                <span key={sp} className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
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
                                                {outOfOffice ? '⚠ Out of office' : (clinic.doctorSpecialization || 'Lead Doctor')}
                                              </p>
                                            </div>
                                            {isAssigned && <CheckCircle2 className="h-4 w-4 text-white shrink-0" />}
                                            {!isAssigned && isBestMatch && (
                                              <span className="shrink-0 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-full">
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
                                                {outOfOffice ? '⚠ Out of office' : `${doctor.specialization}${doctor.degree ? ` · ${doctor.degree}` : ''}`}
                                              </p>
                                            </div>
                                            {isAssigned && <CheckCircle2 className="h-4 w-4 text-white shrink-0" />}
                                            {!isAssigned && isBestMatchDoc && (
                                              <span className="shrink-0 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-full">
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
                                patientPhone={booking.customerPhone}
                                patientEmail={booking.customerEmail || ""}
                                patientCode={(booking as any).patientCode || undefined}
                                onGenerateReceipt={(existingBill) => handleOpenBilling(booking, existingBill)}
                                onPrintBill={printBillFromRecord}
                                onConsolidatedReceipt={(bills) => handleConsolidatedBilling(booking, bills)}
                              />
                            </div>
                          )}

                        </div>

                        {/* ── PERSISTENT FOOTER ── */}
                        <div className="shrink-0 px-4 py-2.5 border-t border-border/50 bg-muted/10 flex gap-2">
                          {/* Confirm / Confirmed status */}
                          {!isBookingPast && booking.verificationStatus !== 'confirmed' && (
                            <Button
                              className="flex-1 gap-1.5 h-11 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:from-emerald-700 active:to-teal-700 active:scale-[0.98] border-0 shadow-md shadow-emerald-500/20 text-white transition-all"
                              onClick={() => confirmBookingMutation.mutate(booking.id)}
                              disabled={confirmBookingMutation.isPending}
                              data-testid={`button-dialog-confirm-${booking.id}`}
                            >
                              {confirmBookingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Confirm
                            </Button>
                          )}
                          {booking.verificationStatus === 'confirmed' && (
                            <div className="flex-1 flex items-center gap-1.5 px-3 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs font-semibold">Confirmed</span>
                              {booking.confirmedBy && (
                                <span className="text-xs font-normal opacity-75">· by {booking.confirmedBy === 'doctor' ? `Dr. ${booking.assignedDoctor || 'Doctor'}` : 'Admin'}</span>
                              )}
                            </div>
                          )}
                          {/* Cancel Booking */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="flex-1 gap-1.5 h-11 text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50 active:bg-destructive/10 active:scale-[0.98] transition-all"
                                data-testid={`button-dialog-cancel-${booking.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </Button>
                            </AlertDialogTrigger>
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
                        </div>

                      </DialogContent>
                  </Dialog>
                    )
                  ].filter(Boolean) as React.ReactNode[];
                  });
                })()
              )}
            </div>
          )}
          </div>
            </div>
            </div>
          )}

          {/* CONFIGURE SLOTS PANEL */}
          {activePanel === 'configure-slots' && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex border-b border-border/40">
                <div className="w-1.5 bg-blue-500/60 shrink-0" />
                <div className="flex-1 px-5 py-4 bg-gradient-to-r from-blue-500/[0.06] to-transparent flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Clock className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">Configure Slots</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Set capacity per slot, close days, and apply bulk schedules</p>
                  </div>
                </div>
              </div>
              {/* No default config warning — shown only until the clinic saves one via "All Future Days" */}
              {defaultConfigData !== undefined && !hasDefaultConfig && (
                <div className="flex items-start gap-3 px-5 py-3.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/25">
                  <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-tight">No default schedule set</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                      Your booking page currently shows only <span className="font-semibold">3 slots</span> per session as a fallback. Configure your capacity below, then click <span className="font-semibold">All Future Days</span> to apply it as your clinic's default.
                    </p>
                  </div>
                </div>
              )}
              <div className="p-3 sm:p-5">
                <div className="flex flex-col lg:flex-row gap-5 lg:items-start">

                  {/* LEFT: Grid & Selection */}
                  <div className="w-full flex-1 min-w-0 space-y-3 sm:space-y-4">

                {/* Date Range Selection */}
                <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date range</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                  {/* Start Date */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From</span>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline" size="sm"
                          className="h-11 gap-2 text-sm font-normal w-full sm:min-w-[155px] justify-start"
                          data-testid="button-start-date"
                        >
                          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          {rangeStart ? format(rangeStart, 'd MMM yyyy') : <span className="text-muted-foreground">Start date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={rangeStart ?? undefined}
                          onSelect={(day) => {
                            if (!day) return;
                            setRangeStart(day);
                            setConfigDate(day);
                            if (rangeEnd && day > rangeEnd) setRangeEnd(null);
                            setDatePickerOpen(false);
                          }}
                          disabled={{ before: startOfToday() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground mb-2 hidden sm:block shrink-0" />

                  {/* End Date */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To <span className="normal-case font-normal">(optional)</span></span>
                    <div className="flex items-center gap-1">
                      <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline" size="sm"
                            className={`h-11 gap-2 text-sm font-normal w-full sm:min-w-[155px] justify-start ${rangeEnd ? 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-500/5' : ''}`}
                            data-testid="button-end-date"
                          >
                            <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                            {rangeEnd ? format(rangeEnd, 'd MMM yyyy') : <span className="text-muted-foreground">End date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={rangeEnd ?? undefined}
                            onSelect={(day) => {
                              if (!day) return;
                              setRangeEnd(day);
                              setEndDatePickerOpen(false);
                            }}
                            disabled={{ before: rangeStart ?? startOfToday() }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {rangeEnd && (
                        <button
                          onClick={() => setRangeEnd(null)}
                          className="h-11 w-11 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95 transition-all"
                          data-testid="button-clear-end-date"
                          aria-label="Clear end date"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Range badge */}
                  {rangeStart && rangeEnd && (
                    <div className="col-span-2 sm:col-span-1 mb-0.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 sm:self-end">
                      <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {differenceInCalendarDays(rangeEnd, rangeStart) + 1} days selected
                      </span>
                    </div>
                  )}
                </div>
                </div>

                {/* Week Navigation */}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setCalendarWeekStart(prev => addDays(prev, -7))}
                    className="h-11 w-11 p-0 shrink-0"
                    disabled={!isAfter(calendarWeekStart, startOfWeek(startOfToday(), { weekStartsOn: 1 }))}
                    data-testid="button-prev-week"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-0 text-sm font-semibold text-center tabular-nums flex flex-col items-center leading-tight">
                    <span className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Viewing week</span>
                    <span className="truncate w-full text-center">{format(calendarWeekStart, "d MMM")} – {format(addDays(calendarWeekStart, 6), "d MMM yyyy")}</span>
                  </span>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setCalendarWeekStart(prev => addDays(prev, 7))}
                    className="h-11 w-11 p-0 shrink-0"
                    data-testid="button-next-week"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Grid legend */}
                <div className="flex items-center justify-between gap-3 px-1 py-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                      <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/30 border border-blue-400/60 inline-block" />
                      Selected
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-rose-500">
                      <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/20 border border-rose-400/40 inline-block" />
                      Closed
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded text-[9px] font-bold bg-muted border border-border/60 text-foreground leading-none">3</span>
                      max bookings
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground/50">
                      <span className="h-2.5 w-2.5 rounded-sm bg-muted/60 border border-border/30 inline-block" />
                      Past — locked
                    </span>
                  </div>
                  <span className="hidden sm:block text-xs font-medium text-primary/70 whitespace-nowrap shrink-0">Click a date header below to configure, then Save to apply</span>
                </div>

                {/* Calendar Grid */}
                {(() => {
                  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(calendarWeekStart, i));
                  return (
                    <div className="w-full overflow-x-auto rounded-xl border border-border/40">
                      <div className="min-w-[580px]">
                        {/* Day header row */}
                        <div className="grid border-b-2 border-border/60 bg-muted/60" style={{ gridTemplateColumns: '100px repeat(7, 1fr)' }}>
                          <div className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-r border-border/40 flex items-center">Slots</div>
                          {weekDays.map((day, i) => {
                            const isSun = day.getDay() === 0;
                            const isSat = day.getDay() === 6;
                            const isToday = isSameDay(day, new Date());
                            const isPast = !isToday && startOfDay(day) < startOfToday();
                            const isSelected = !isPast && isDateInSelection(day);
                            const isEdge = !isPast && (isSameDay(day, rangeStart ?? configDate) || (rangeEnd !== null && isSameDay(day, rangeEnd)));
                            const dayCfg = getConfigForDate(day);
                            return (
                              <button
                                key={i}
                                onClick={isPast ? undefined : () => handleSlotDateClick(day)}
                                disabled={isPast}
                                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                                className={`relative px-1 py-2.5 text-center border-l border-border/40 transition-all ${
                                  isPast
                                    ? 'opacity-40 cursor-not-allowed bg-muted/40'
                                    : isEdge
                                    ? 'bg-blue-500/30 ring-1 ring-inset ring-blue-400/60'
                                    : isSelected
                                    ? 'bg-blue-500/15'
                                    : 'hover:bg-primary/5 cursor-pointer'
                                }`}
                              >
                                {!isPast && (isEdge || isSelected) && (
                                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500/70 rounded-b-sm" />
                                )}
                                <div className={`text-xs uppercase tracking-wide font-bold ${
                                  isPast ? 'text-muted-foreground/40' : isSun || isSat ? 'text-rose-500' : isToday ? 'text-primary' : 'text-foreground/70'
                                }`}>{format(day, 'EEE')}</div>
                                <div className={`text-base font-black mt-0.5 leading-none ${
                                  isPast
                                    ? 'text-muted-foreground/40'
                                    : isToday
                                    ? 'h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-[13px] font-bold'
                                    : isSun || isSat ? 'text-rose-500' : 'text-foreground'
                                }`}>
                                  {format(day, 'd')}
                                </div>
                                {!isPast && dayCfg.isClosed && (
                                  <div className="text-[9px] font-bold uppercase text-rose-500 mt-0.5 leading-none">closed</div>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Section rows */}
                        {slotTimings.map((slot) => (
                          <div
                            key={slot.id}
                            className="grid border-b border-border/20 last:border-0"
                            style={{ gridTemplateColumns: '100px repeat(7, 1fr)' }}
                          >
                            <div className="px-3 py-2.5 bg-muted/10 border-r border-border/20 flex flex-col justify-center">
                              <span className="text-xs font-semibold leading-tight">{slot.label}</span>
                              <span className="text-xs text-muted-foreground leading-tight mt-0.5">
                                {formatTime(slot.startHour, slot.startMinute)}–{formatTime(slot.endHour, slot.endMinute)}
                              </span>
                            </div>
                            {weekDays.map((day, di) => {
                              const cfg = getConfigForDate(day);
                              const secCfg = cfg.sections[slot.id] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slot.id] ?? 3, isCancelled: false };
                              const isClosed = cfg.isClosed || secCfg.isCancelled;
                              const isSelected = isDateInSelection(day);
                              const isToday = isSameDay(day, new Date());
                              const isPast = !isToday && startOfDay(day) < startOfToday();
                              return (
                                <button
                                  key={di}
                                  onClick={isPast ? undefined : () => handleSlotDateClick(day)}
                                  disabled={isPast}
                                  className={`px-1 py-2 border-l border-border/20 flex flex-col items-center justify-center min-h-[44px] transition-all ${
                                    isPast
                                      ? 'opacity-35 cursor-not-allowed bg-muted/20'
                                      : isSelected ? 'bg-blue-500/15 active:bg-blue-500/25' : isToday ? 'bg-primary/5 active:bg-primary/10' : 'hover:bg-muted/25 active:bg-muted/40'
                                  }`}
                                >
                                  {isClosed ? (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                                      isPast
                                        ? 'text-muted-foreground/60 bg-muted border border-border/30'
                                        : 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25'
                                    }`}>Closed</span>
                                  ) : (
                                    <>
                                      <span className={`text-sm font-bold leading-none ${isPast ? 'text-muted-foreground/50' : 'text-foreground'}`}>{secCfg.maxBookings}</span>
                                      <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">slots</span>
                                    </>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Close Bookings for Selected Date(s) ── */}
                {(() => {
                  const cbCfg = getConfigForDate(configDate);
                  return (
                    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      cbCfg.isClosed
                        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                        : 'bg-muted/20 border-border/40'
                    }`}>
                      <Switch
                        checked={cbCfg.isClosed}
                        onCheckedChange={(val) => getActiveDates().forEach(d => updateDayClosedState(d, val))}
                        data-testid="toggle-day-closed"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold leading-tight">Close Bookings for Selected Date(s)</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Prevents patients from booking any slot on the selected date(s)</p>
                      </div>
                      {cbCfg.isClosed && <Badge className="text-xs bg-rose-500 text-white border-0 shrink-0">Closed</Badge>}
                    </div>
                  );
                })()}

                  </div>{/* end left col */}

                  {/* RIGHT: Day Editor */}
                  <div className="w-full lg:w-72 shrink-0">
                    <div className="sticky top-[70px]">

                {/* Day Editor */}
                {(() => {
                  const cfg = getConfigForDate(configDate);
                  const isSunday = configDate.getDay() === 0;
                  return (
                    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                      {/* Header band */}
                      <div className={`px-4 py-3 border-b transition-colors ${
                        cfg.isClosed
                          ? 'bg-gradient-to-r from-rose-500/[0.08] to-transparent border-rose-200/50 dark:border-rose-500/20'
                          : 'bg-gradient-to-r from-blue-500/[0.08] to-transparent border-blue-200/40 dark:border-blue-500/25'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold leading-tight">
                              {rangeStart && rangeEnd
                                ? `${format(rangeStart, 'EEE d MMM')} – ${format(rangeEnd, 'EEE d MMM yyyy')}`
                                : format(configDate, 'EEEE, d MMMM yyyy')}
                            </p>
                          </div>
                          {isSunday && (
                            <Badge variant="outline" className="text-[10px] border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 shrink-0">
                              Sunday
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* Slots configuration */}
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-bold text-foreground leading-tight">Slots configuration</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Adjust values below, then click Save to apply</p>
                          </div>
                          {cfg.isClosed ? (
                            <div className="py-4 px-3 text-center rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10">
                              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 leading-relaxed">All bookings closed for selected date(s)</p>
                              <p className="text-[11px] text-rose-500/70 mt-1">Toggle "Close Bookings" below the grid to re-enable slots</p>
                            </div>
                          ) : (
                            <>
                              {/* Column header row — sits directly above the slot cards */}
                              <div className="flex items-center px-3 pb-0.5">
                                <div className="flex-1" />
                                <span className="w-12 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Max</span>
                                <span className="w-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Close</span>
                              </div>
                              {slotTimings.map((slot) => {
                                const secCfg = cfg.sections[slot.id] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slot.id] ?? 3, isCancelled: false };
                                return (
                                  <div
                                    key={slot.id}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                                      secCfg.isCancelled
                                        ? 'bg-muted/20 border-border/20 opacity-60'
                                        : 'bg-background border-border/40 hover:border-blue-300/50 dark:hover:border-blue-500/30'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold leading-tight truncate">{slot.label}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{formatTime(slot.startHour, slot.startMinute)}–{formatTime(slot.endHour, slot.endMinute)}</p>
                                    </div>
                                    <div className="flex items-center shrink-0">
                                      <Input
                                        type="number"
                                        min={0}
                                        max={30}
                                        value={secCfg.maxBookings}
                                        onChange={(e) => { const v = parseInt(e.target.value) || 0; getActiveDates().forEach(d => updateSectionCapacity(d, slot.id, v)); }}
                                        className="w-12 h-8 text-center text-sm px-1 font-semibold"
                                        inputMode="numeric"
                                        onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                        disabled={secCfg.isCancelled}
                                        data-testid={`input-capacity-${slot.id}`}
                                      />
                                    </div>
                                    <div className="flex items-center justify-center w-10 shrink-0 border-l border-border/30">
                                      <Switch
                                        checked={secCfg.isCancelled}
                                        onCheckedChange={(val) => getActiveDates().forEach(d => updateSectionCancelled(d, slot.id, val))}
                                        className="scale-[0.80] data-[state=checked]:bg-rose-500"
                                        data-testid={`switch-close-${slot.id}`}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>

                        {/* Save Button */}
                        <Button
                          className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white border-0 shadow-md shadow-blue-500/20 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all"
                          onClick={() => rangeStart && rangeEnd ? setShowSaveRangeConfirm(true) : saveDayConfiguration()}
                          disabled={isSavingConfig}
                          data-testid="button-save-day-config"
                        >
                          {isSavingConfig ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                          ) : (
                            <><Save className="h-4 w-4 mr-2" /> Save Slot Configuration</>
                          )}
                        </Button>

                        {/* ── Apply slot configuration to ── */}
                        <div className="border-t border-border/30 pt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            Apply to <ChevronRight className="h-3.5 w-3.5 inline-block" />
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setPendingBulkAction('future-days')}
                              disabled={isBulkApplying}
                              className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.10] hover:border-primary/50 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              data-testid="button-apply-all-future"
                            >
                              {isBulkApplying
                                ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                : <CalendarDays className="h-4 w-4 text-primary" />}
                              <span className="text-xs font-bold text-primary text-center leading-tight">All Future Days</span>
                              <span className="text-xs text-primary/60 text-center leading-tight">Default for all dates</span>
                            </button>
                            <button
                              onClick={() => setPendingBulkAction('sundays-this-month')}
                              disabled={isBulkApplying}
                              className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/[0.04] hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-500/50 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              data-testid="button-apply-sundays"
                            >
                              {isBulkApplying
                                ? <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                                : <Sun className="h-4 w-4 text-amber-500" />}
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 text-center leading-tight">All Sundays</span>
                              <span className="text-xs text-amber-600/60 dark:text-amber-400/60 text-center leading-tight">This month</span>
                            </button>
                          </div>
                        </div>

                        {/* ── How to configure slots ── */}
                        <div className="rounded-xl border border-border/40 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowHowItWorks(h => !h)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
                            data-testid="button-toggle-how-it-works"
                          >
                            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-semibold text-muted-foreground flex-1">How to configure slots</span>
                            {showHowItWorks
                              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                          {showHowItWorks && (
                            <div className="px-4 pb-4 pt-2.5 grid grid-cols-1 gap-y-2.5 border-t border-border/30 bg-muted/10">
                              {([
                                { icon: "📅", node: <>Tap any column in the grid above to load that day's config here.</> },
                                { icon: "↔️", node: <>For a date range: use the <strong className="text-foreground">From</strong> and <strong className="text-foreground">To</strong> pickers above the grid.</> },
                                { icon: "🔴", node: <><strong className="text-foreground font-bold">Close Bookings</strong> blocks all slots on the selected date(s).</> },
                                { icon: "🔢", node: <>Adjust <strong className="text-foreground">Max</strong> to control how many patients can book each session.</> },
                                { icon: "🔕", node: <>The <strong className="text-foreground">Close</strong> switch cancels a single session without closing the whole day.</> },
                                { icon: "💾", node: <><strong className="text-foreground">Save</strong> writes the config to the selected date(s).</> },
                                { icon: "📋", node: <><strong className="text-primary font-bold">All Future Days</strong> sets this as your clinic's default schedule.</> },
                                { icon: "☀️", node: <><strong className="text-amber-600 dark:text-amber-400 font-bold">All Sundays</strong> writes this config to every Sunday this month.</> },
                              ] as { icon: string; node: React.ReactNode }[]).map(({ icon, node }, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className="text-sm shrink-0 leading-5 mt-0.5">{icon}</span>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{node}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* ── Bulk Apply Confirmation Dialog ── */}
                        {(() => {
                          const today = new Date();
                          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                          const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                          const sundaysThisMonth = getDatesInRange(monthStart, monthEnd).filter((d: Date) => d.getDay() === 0);
                          const isDefaultAction  = pendingBulkAction === 'future-days';

                          return (
                            <Dialog open={!!pendingBulkAction} onOpenChange={(open) => { if (!open) setPendingBulkAction(null); }}>
                              <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden gap-0">
                                {/* Header */}
                                <div className={`px-5 pt-5 pb-4 border-b border-border/40 ${cfg.isClosed ? 'bg-rose-50/60 dark:bg-rose-500/10' : 'bg-primary/[0.03]'}`}>
                                  <DialogTitle className="text-base font-bold leading-tight">
                                    {isDefaultAction ? 'Apply to All Future Days?' : `Apply to All Sundays in ${format(today, 'MMMM yyyy')}?`}
                                  </DialogTitle>
                                  <DialogDescription className="text-xs text-muted-foreground mt-1">
                                    {isDefaultAction
                                      ? "This updates your clinic's default template for future dates."
                                      : `This overwrites slot config for every Sunday in ${format(today, 'MMMM yyyy')}.`}
                                  </DialogDescription>
                                </div>

                                <div className="px-5 py-4 space-y-3">
                                  {/* What will be applied */}
                                  <div className={`rounded-xl border p-3 space-y-1.5 ${
                                    cfg.isClosed
                                      ? 'border-rose-300/60 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                                      : 'border-primary/25 bg-primary/[0.04]'
                                  }`}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What will be applied</p>
                                    {cfg.isClosed ? (
                                      <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                                        <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Day Closed — no bookings accepted</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                          <p className="text-sm font-semibold text-primary">Day Open — bookings accepted</p>
                                        </div>
                                        {slotTimings.map(slot => {
                                          const secCfg = cfg.sections[slot.id] ?? { maxBookings: 3, isCancelled: false };
                                          return (
                                            <p key={slot.id} className="text-xs text-muted-foreground pl-4">
                                              {secCfg.isCancelled
                                                ? `${slot.label}: Closed`
                                                : `${slot.label}: up to ${secCfg.maxBookings} patient${secCfg.maxBookings !== 1 ? 's' : ''}`}
                                            </p>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Scope */}
                                  <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Applies to</p>
                                    {isDefaultAction ? (
                                      <p className="text-sm text-foreground leading-relaxed">
                                        All future dates that <span className="font-semibold">haven't been individually configured</span>. Dates you've already saved separately will not be changed.
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        <p className="text-sm text-foreground">
                                          {sundaysThisMonth.length} Sunday{sundaysThisMonth.length !== 1 ? 's' : ''} in {format(today, 'MMMM yyyy')}:
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {sundaysThisMonth.map(d => (
                                            <span key={d.toISOString()} className="text-[11px] font-medium bg-background border border-border/60 px-2 py-0.5 rounded-full">
                                              {format(d, 'EEE d MMM')}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Safety note */}
                                  <div className="flex items-start gap-2 px-0.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground">
                                      Bookings already confirmed on those dates will <span className="font-semibold">not</span> be cancelled automatically.
                                    </p>
                                  </div>
                                </div>

                                {/* Footer */}
                                <div className="px-5 pb-5 flex gap-2.5">
                                  <Button
                                    variant="outline"
                                    onClick={() => setPendingBulkAction(null)}
                                    className="flex-1"
                                    data-testid="button-bulk-cancel"
                                  >
                                    Go Back
                                  </Button>
                                  <Button
                                    onClick={() => { if (pendingBulkAction) { applyBulkConfig(pendingBulkAction); setPendingBulkAction(null); } }}
                                    disabled={isBulkApplying}
                                    className={`flex-1 border-0 shadow-sm ${
                                      cfg.isClosed
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                                        : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                                    }`}
                                    data-testid="button-bulk-confirm"
                                  >
                                    {isBulkApplying
                                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Applying…</>
                                      : isDefaultAction
                                        ? 'Yes, Set as Default'
                                        : `Yes, Apply to ${sundaysThisMonth.length} Sunday${sundaysThisMonth.length !== 1 ? 's' : ''}`}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          );
                        })()}

                        {/* ── Save Range Confirmation Dialog ── */}
                        {(() => {
                          if (!rangeStart || !rangeEnd) return null;
                          const rangeDays = getDatesInRange(rangeStart, rangeEnd);
                          const n = rangeDays.length;
                          return (
                            <Dialog open={showSaveRangeConfirm} onOpenChange={(open) => { if (!open) setShowSaveRangeConfirm(false); }}>
                              <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden gap-0">
                                {/* Header */}
                                <div className={`px-5 pt-5 pb-4 border-b border-border/40 ${cfg.isClosed ? 'bg-rose-50/60 dark:bg-rose-500/10' : 'bg-blue-50/60 dark:bg-blue-500/10'}`}>
                                  <DialogTitle className="text-base font-bold leading-tight">
                                    Save Range — {format(rangeStart, 'd MMM')} to {format(rangeEnd, 'd MMM yyyy')}
                                  </DialogTitle>
                                  <DialogDescription className="text-xs text-muted-foreground mt-1">
                                    This will overwrite slot configuration for {n} day{n !== 1 ? 's' : ''}. Review what will be saved.
                                  </DialogDescription>
                                </div>

                                <div className="px-5 py-4 space-y-3">
                                  {/* What will be applied */}
                                  <div className={`rounded-xl border p-3 space-y-1.5 ${
                                    cfg.isClosed
                                      ? 'border-rose-300/60 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                                      : 'border-blue-300/40 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/[0.04]'
                                  }`}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What will be saved to each day</p>
                                    {cfg.isClosed ? (
                                      <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                                        <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Day Closed — no bookings accepted</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                          <p className="text-sm font-semibold text-primary">Day Open — bookings accepted</p>
                                        </div>
                                        {slotTimings.map(slot => {
                                          const secCfg = cfg.sections[slot.id] ?? { maxBookings: 3, isCancelled: false };
                                          return (
                                            <p key={slot.id} className="text-xs text-muted-foreground pl-4">
                                              {secCfg.isCancelled
                                                ? `${slot.label}: Closed`
                                                : `${slot.label}: up to ${secCfg.maxBookings} patient${secCfg.maxBookings !== 1 ? 's' : ''}`}
                                            </p>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Date list */}
                                  <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                      Applies to {n} day{n !== 1 ? 's' : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                      {rangeDays.map(d => (
                                        <span key={d.toISOString()} className={`text-[11px] font-medium border px-2 py-0.5 rounded-full ${
                                          d.getDay() === 0 || d.getDay() === 6
                                            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-600 dark:text-rose-400'
                                            : 'bg-background border-border/60'
                                        }`}>
                                          {format(d, 'EEE d MMM')}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Safety note */}
                                  <div className="flex items-start gap-2 px-0.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground">
                                      Bookings already confirmed on those dates will <span className="font-semibold">not</span> be cancelled automatically.
                                    </p>
                                  </div>
                                </div>

                                {/* Footer */}
                                <div className="px-5 pb-5 flex gap-2.5">
                                  <Button
                                    variant="outline"
                                    onClick={() => setShowSaveRangeConfirm(false)}
                                    className="flex-1"
                                    data-testid="button-save-range-cancel"
                                  >
                                    Go Back
                                  </Button>
                                  <Button
                                    onClick={() => { setShowSaveRangeConfirm(false); saveDayConfiguration(); }}
                                    disabled={isSavingConfig}
                                    className={`flex-1 border-0 shadow-sm ${
                                      cfg.isClosed
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                                    }`}
                                    data-testid="button-save-range-confirm"
                                  >
                                    {isSavingConfig
                                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…</>
                                      : `Yes, Save ${n} Day${n !== 1 ? 's' : ''}`}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          );
                        })()}

                      </div>
                    </div>
                  );
                })()}

                    </div>{/* end sticky */}
                  </div>{/* end right col */}
                </div>{/* end flex row */}
              </div>
            </div>
          )}

          {/* MANAGE DOCTORS PANEL */}
          {activePanel === 'manage-doctors' && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex border-b border-border/40">
                <div className="w-1.5 bg-teal-500/60 shrink-0" />
                <div className="flex-1 px-5 py-4 bg-gradient-to-r from-teal-500/[0.06] to-transparent flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                      <Stethoscope className="h-[18px] w-[18px] text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">Manage Doctors</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Add and manage practitioners</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-700 dark:text-teal-400 bg-teal-500/[0.08] shrink-0">
                    {clinicData?.doctors?.length || 0} {(clinicData?.doctors?.length || 0) === 1 ? 'doctor' : 'doctors'}
                  </Badge>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="border-t border-border/30">
                  <div className="space-y-4">

                  {/* Add New Doctor — toggle (shown at top) */}
                  <div className="rounded-xl overflow-hidden border border-border/60 shadow-sm">
                    <button
                      onClick={() => setShowAddDoctorForm(v => !v)}
                      className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-accent px-5 py-3.5 min-h-[52px] active:opacity-90 transition-opacity"
                      data-testid="button-toggle-add-doctor-form"
                      aria-expanded={showAddDoctorForm}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <UserPlus className="h-4 w-4 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-white font-semibold text-sm leading-tight">Add a New Doctor</p>
                          <p className="text-white/70 text-xs">Register a new practitioner</p>
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-white/80 transition-transform duration-200 ${showAddDoctorForm ? 'rotate-180' : ''}`} />
                    </button>

                    {showAddDoctorForm && (
                      <div className="p-5 bg-card">
                        <div className="grid gap-5 lg:grid-cols-2">

                          {/* Left: Photo upload */}
                          <div className="space-y-2 flex flex-col items-center lg:items-start">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doctor Photo</Label>
                            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 w-fit">
                              <ImageUpload
                                currentImage={newDoctorImageUrl || undefined}
                                onImageUploaded={(url) => setNewDoctorImageUrl(url)}
                                folder="doctors"
                                fallbackText={newDoctorName ? newDoctorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : "Dr"}
                              />
                              <p className="text-xs text-muted-foreground text-center">Click photo to upload</p>
                            </div>
                          </div>

                          {/* Right: Form fields */}
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="doctor-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</Label>
                              <Input
                                id="doctor-name"
                                value={newDoctorName}
                                onChange={(e) => setNewDoctorName(e.target.value)}
                                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                placeholder="e.g. Dr. Priya Sharma"
                                data-testid="input-doctor-name"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="doctor-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</Label>
                              <Input
                                id="doctor-email"
                                type="email"
                                value={newDoctorEmail}
                                onChange={(e) => setNewDoctorEmail(e.target.value)}
                                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                placeholder="doctor@example.com"
                                data-testid="input-doctor-email"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="doctor-specialization" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialization</Label>
                                <SpecializationInput
                                  id="doctor-specialization"
                                  value={newDoctorSpecialization}
                                  onChange={setNewDoctorSpecialization}
                                  placeholder="General Dentist"
                                  data-testid="input-doctor-specialization"
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="doctor-degree" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Degree (Optional)</Label>
                                <Input
                                  id="doctor-degree"
                                  value={newDoctorDegree}
                                  onChange={(e) => setNewDoctorDegree(e.target.value)}
                                  onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                  placeholder="e.g. BDS, MDS"
                                  data-testid="input-doctor-degree"
                                />
                              </div>
                            </div>
                            <Button
                              onClick={handleAddDoctor}
                              disabled={!newDoctorName || !newDoctorSpecialization || !newDoctorEmail || addDoctorMutation.isPending}
                              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium shadow-md shadow-primary/20 mt-1"
                              data-testid="button-add-doctor"
                            >
                              {addDoctorMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <UserPlus className="h-4 w-4 mr-2" />
                              )}
                              Add Doctor
                            </Button>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>

                  {/* Current Doctors List */}
                  {clinicData?.doctors && clinicData.doctors.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Practice Team</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                          <Stethoscope className="h-3 w-3" />
                          {clinicData.doctors.length} {clinicData.doctors.length === 1 ? "doctor" : "doctors"}
                        </span>
                      </div>
                      <div className="grid gap-3">
                        {clinicData.doctors.map((doctor, index) => {
                          const doctorUpcomingLeaves = allDoctorLeaves
                            .filter(l => l.doctorEmail === doctor.email && l.leaveDate >= todayStr)
                            .sort((a, b) => a.leaveDate.localeCompare(b.leaveDate));
                          const isOnLeaveToday = doctorUpcomingLeaves.some(l => l.leaveDate === todayStr);
                          const leavesExpanded = expandedLeaves.has(doctor.email);
                          return (
                          <div
                            key={index}
                            className="relative rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group"
                            data-testid={`doctor-card-${index}`}
                          >
                            {/* Gradient left accent bar */}
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-accent via-primary to-accent" />

                            {/* Subtle tinted background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent pointer-events-none" />

                            <div className="relative flex items-center gap-4 px-5 py-4 pl-5">
                              {/* Avatar with index badge */}
                              <div className="relative shrink-0">
                                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/25 ring-2 ring-primary/10 group-hover:ring-primary/25 transition-all duration-300 flex items-center justify-center overflow-hidden shadow-sm">
                                  {doctor.imageUrl ? (
                                    <img src={doctor.imageUrl} alt={doctor.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-sm font-bold bg-gradient-to-br from-accent to-primary bg-clip-text text-transparent">
                                      {doctor.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span className="absolute -bottom-1 -right-1 font-mono text-[9px] font-bold bg-muted border border-border/60 text-muted-foreground px-1 py-px rounded-full leading-none">
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                              </div>

                              {/* Doctor info */}
                              <div className="flex-1 text-left min-w-0">
                                {/* Name + active pill */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-sm tracking-tight">Dr. {doctor.name}</p>
                                  {isOnLeaveToday ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-px rounded-full">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                      On Leave
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-px rounded-full">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Active
                                    </span>
                                  )}
                                </div>

                                {/* Specialization + degree badges */}
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <span className="inline-flex items-center text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                                    {doctor.specialization}
                                  </span>
                                  {doctor.degree && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted border border-border/60 px-2 py-0.5 rounded-full">
                                      <GraduationCap className="h-2.5 w-2.5" />
                                      {doctor.degree}
                                    </span>
                                  )}
                                </div>

                                {/* Email */}
                                {doctor.email && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                    <span className="text-xs font-mono text-muted-foreground truncate">{doctor.email}</span>
                                  </div>
                                )}
                              </div>

                              {/* Action buttons — inline on md+, dropdown on mobile */}
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Desktop: inline buttons */}
                                <div className="hidden sm:flex items-center gap-1">
                                  {(() => {
                                    const linked = linkedDoctors.find(d => d.email === doctor.email);
                                    if (!linked) return null;
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-10 w-10 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 active:scale-[0.98] transition-all"
                                              onClick={() => {
                                                setResetPwdDoctorId(linked.id);
                                                setResetPwdDoctorName(linked.name);
                                                setResetPwdDoctorEmail(linked.email);
                                                setResetPwdNew("");
                                                setResetPwdConfirm("");
                                                setResetPwdOpen(true);
                                              }}
                                              data-testid={`button-reset-password-${index}`}
                                            >
                                              <KeyRound className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Reset password</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })()}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all"
                                        data-testid={`button-remove-doctor-${index}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Doctor?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove {doctor.name} from your clinic? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => removeDoctorMutation.mutate(index)}
                                          className="bg-destructive text-destructive-foreground"
                                        >
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>

                                {/* Mobile: MoreHorizontal dropdown */}
                                <div className="sm:hidden">
                                  <AlertDialog>
                                    {({ open: alertOpen, onOpenChange: setAlertOpen } = {} as any) => null}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-10 w-10 text-muted-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
                                          data-testid={`button-more-doctor-${index}`}
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-44">
                                        {(() => {
                                          const linked = linkedDoctors.find(d => d.email === doctor.email);
                                          if (!linked) return null;
                                          return (
                                            <>
                                              <DropdownMenuItem
                                                className="gap-2 text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-500/10"
                                                onSelect={() => {
                                                  setResetPwdDoctorId(linked.id);
                                                  setResetPwdDoctorName(linked.name);
                                                  setResetPwdDoctorEmail(linked.email);
                                                  setResetPwdNew("");
                                                  setResetPwdConfirm("");
                                                  setResetPwdOpen(true);
                                                }}
                                                data-testid={`menu-reset-password-${index}`}
                                              >
                                                <KeyRound className="h-4 w-4" />
                                                Reset Password
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                            </>
                                          );
                                        })()}
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <DropdownMenuItem
                                              className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                              onSelect={(e) => e.preventDefault()}
                                              data-testid={`menu-remove-doctor-${index}`}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                              Remove Doctor
                                            </DropdownMenuItem>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Remove Doctor?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Are you sure you want to remove {doctor.name} from your clinic? This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => removeDoctorMutation.mutate(index)}
                                                className="bg-destructive text-destructive-foreground"
                                              >
                                                Remove
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </AlertDialog>
                                </div>
                              </div>
                          </div>
                          {/* Leaves section */}
                          {doctorUpcomingLeaves.length > 0 && (
                            <div className="border-t border-border/30">
                              <button
                                onClick={() => setExpandedLeaves(prev => {
                                  const next = new Set(prev);
                                  if (next.has(doctor.email)) next.delete(doctor.email);
                                  else next.add(doctor.email);
                                  return next;
                                })}
                                className="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors min-h-[44px]"
                                data-testid={`button-toggle-leaves-${index}`}
                              >
                                <div className="flex items-center gap-2">
                                  <CalendarOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                    {doctorUpcomingLeaves.length} upcoming {doctorUpcomingLeaves.length === 1 ? 'leave' : 'leaves'}
                                  </span>
                                </div>
                                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${leavesExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {leavesExpanded && (
                                <div className="px-5 pb-3 space-y-1.5">
                                  {doctorUpcomingLeaves.map(leave => (
                                    <div key={leave.leaveDate} className="flex items-center gap-2 flex-wrap">
                                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${
                                        leave.leaveDate === todayStr
                                          ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                                          : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
                                      }`}>
                                        <CalendarOff className="h-3 w-3" />
                                        {format(new Date(leave.leaveDate + 'T00:00:00'), 'EEE, MMM d yyyy')}
                                        {leave.leaveDate === todayStr && <span className="font-bold ml-0.5">(Today)</span>}
                                      </span>
                                      {leave.reason && (
                                        <span className="text-xs text-muted-foreground truncate">— {leave.reason}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-muted/20 rounded-xl border border-dashed">
                      <div className="p-3 bg-muted/50 rounded-full w-fit mx-auto mb-3">
                        <Stethoscope className="h-7 w-7 text-muted-foreground/60" />
                      </div>
                      <p className="font-medium text-muted-foreground">No doctors added yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Add your first doctor using the form above</p>
                    </div>
                  )}


              </div>
            </div>
          </div>
        </div>
          )}

          {/* CLINIC PROFILE PANEL */}
          {activePanel === 'clinic-profile' && (
            <div className="space-y-5">

              {/* Panel header */}
              <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
                <div className="flex border-b border-border/40">
                  <div className="w-1.5 bg-violet-500/60 shrink-0" />
                  <div className="flex-1 px-5 py-4 bg-gradient-to-r from-violet-500/[0.06] to-transparent flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <Building2 className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold tracking-tight">Clinic Profile</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Update your public About page details</p>
                      </div>
                    </div>
                    <a
                      href={`/clinic/${clinic?.username || clinic?.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-preview-about"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-colors text-violet-700 dark:text-violet-400 text-xs font-semibold min-h-[36px]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Preview
                    </a>
                  </div>
                </div>

                {/* Locked identity row */}
                <div className="px-5 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-3">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clinic Name</span>
                    <p className="text-sm font-semibold text-foreground truncate">{clinic?.name}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground shrink-0">
                    Managed by platform
                  </Badge>
                </div>

                {/* Editable fields — compact grid */}
                <div className="p-4 bg-card space-y-4">

                  {/* All text fields in one tight grid */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="profile-phone" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          id="profile-phone"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="pl-8 h-9 text-sm"
                          data-testid="input-profile-phone"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-email" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          id="profile-email"
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          placeholder="clinic@example.com"
                          className="pl-8 h-9 text-sm"
                          data-testid="input-profile-email"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-website" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Website</Label>
                      <div className="relative">
                        <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          id="profile-website"
                          value={profileWebsite}
                          onChange={(e) => setProfileWebsite(e.target.value)}
                          placeholder="https://yourclinic.com"
                          className="pl-8 h-9 text-sm"
                          data-testid="input-profile-website"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="profile-address" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Street Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          id="profile-address"
                          value={profileAddress}
                          onChange={(e) => setProfileAddress(e.target.value)}
                          placeholder="123 Main Street, Area"
                          className="pl-8 h-9 text-sm"
                          data-testid="input-profile-address"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-city" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">City</Label>
                      <Input
                        id="profile-city"
                        value={profileCity}
                        onChange={(e) => setProfileCity(e.target.value)}
                        placeholder="Mumbai"
                        className="h-9 text-sm"
                        data-testid="input-profile-city"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-pincode" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pincode</Label>
                      <Input
                        id="profile-pincode"
                        value={profilePincode}
                        onChange={(e) => setProfilePincode(e.target.value)}
                        placeholder="400001"
                        className="h-9 text-sm"
                        data-testid="input-profile-pincode"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-doctor-name" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lead Doctor</Label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          id="profile-doctor-name"
                          value={profileDoctorName}
                          onChange={(e) => setProfileDoctorName(e.target.value)}
                          placeholder="e.g. Dr. Arun Menon"
                          className="pl-8 h-9 text-sm"
                          data-testid="input-profile-doctor-name"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Map location */}
                  <div className="border border-border/40 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/40">
                      <MapPin className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Map Location</span>
                      {profileLatitude && profileLongitude && (
                        <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
                          Pin saved
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Search your clinic or click on the map to set a pin. Patients see this on your public profile.
                      </p>
                      <MapLocationPicker
                        latitude={profileLatitude}
                        longitude={profileLongitude}
                        onChange={(lat, lng) => { setProfileLatitude(lat); setProfileLongitude(lng); }}
                      />
                    </div>
                  </div>

                </div>

                {/* Save footer */}
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-end">
                  <Button
                    onClick={() => updateProfileMutation.mutate({
                      phone: profilePhone,
                      email: profileEmail,
                      website: profileWebsite,
                      address: profileAddress,
                      city: profileCity,
                      pincode: profilePincode,
                      doctorName: profileDoctorName,
                      latitude: profileLatitude,
                      longitude: profileLongitude,
                    })}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                    className="rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25 hover:-translate-y-0.5 transition-all px-6"
                  >
                    {updateProfileMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                </div>
              </div>

            </div>
          )}

          {/* BOOK A SLOT PANEL */}
          {activePanel === 'book-a-slot' && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex border-b border-border/40">
                <div className="w-1.5 bg-primary/60 shrink-0" />
                <div className="flex-1 px-5 py-4 bg-gradient-to-r from-primary/[0.06] to-transparent flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Plus className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">Book a Slot</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Create a new patient appointment</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {bookingSuccess ? (
                  <div className="py-10 flex flex-col items-center gap-5 text-center">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-emerald-400/20 to-primary/20 blur-xl animate-pulse" />
                      <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <CheckCircle2 className="h-10 w-10 text-white" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-extrabold tracking-tight">Booking Confirmed!</h3>
                      <p className="text-sm text-muted-foreground">The appointment has been created successfully.</p>
                    </div>
                    <div className="w-full rounded-2xl border border-border/60 bg-muted/20 overflow-hidden text-left">
                      <div className="px-4 py-2.5 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking Summary</span>
                      </div>
                      <div className="divide-y divide-border/40">
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm font-medium">{bookingName}</span>
                        </div>
                        {bookingPhone && (
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Phone className="h-3 w-3 text-primary" />
                            </div>
                            <span className="text-sm font-medium">{bookingPhone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <div className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <CalendarDays className="h-3 w-3 text-emerald-500" />
                          </div>
                          <span className="text-sm font-medium">{format(bookingDate, "EEEE, MMM d, yyyy")}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => resetBookingForm()}
                      className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                      data-testid="button-book-another"
                    >
                      Book Another Appointment
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row gap-6">

                    {/* ── LEFT: Patient Details ── */}
                    <div className="flex-1 min-w-0 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient Details</span>
                      </div>

                      {/* Name — with patient autocomplete */}
                      <div className="space-y-1.5">
                        <Label htmlFor="booking-name" className="block">Patient Name <span className="text-destructive">*</span></Label>
                        <div className="relative">
                          <Input
                            id="booking-name"
                            value={bookingName}
                            onChange={(e) => handleBookingNameChange(e.target.value)}
                            placeholder="e.g. Rahul Verma"
                            onFocus={(e) => {
                              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              if (bookingName.length >= 2) fetchPatientSuggestions(bookingName);
                            }}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                            autoComplete="off"
                            data-testid="input-booking-name"
                          />
                          {suggestionsLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          {showSuggestions && patientSuggestions.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                              <div className="px-3 py-1.5 border-b border-border/40 bg-muted/30">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing patients</p>
                              </div>
                              {patientSuggestions.map((p: any) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={() => applyPatientSuggestion(p)}
                                  className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-primary/5 active:bg-primary/10 transition-colors min-h-[44px] border-b border-border/30 last:border-0"
                                  data-testid={`suggestion-patient-${p.id}`}
                                >
                                  <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 font-bold text-primary text-xs">
                                    {(p.name || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold leading-tight truncate">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {p.patientCode && <span className="font-mono">{p.patientCode}</span>}
                                      {p.age && <span> · {p.age}y</span>}
                                      {p.gender && <span> · {p.gender}</span>}
                                      {p.phone && <span> · {p.phone}</span>}
                                    </p>
                                  </div>
                                  <span className="text-xs text-primary shrink-0 font-medium">Fill →</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Mobile + Email */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="booking-phone" className="block">Mobile <span className="text-destructive">*</span></Label>
                          <Input
                            id="booking-phone"
                            type="tel"
                            value={bookingPhone}
                            onChange={(e) => handleBookingPhoneChange(e.target.value)}
                            className={phoneError ? "border-destructive" : ""}
                            placeholder="+91 98765 43210"
                            onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            data-testid="input-booking-phone"
                          />
                          {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="booking-email" className="block">Email <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                          <Input
                            id="booking-email"
                            type="email"
                            value={bookingEmail}
                            onChange={(e) => setBookingEmail(e.target.value)}
                            placeholder="e.g. patient@example.com"
                            onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            data-testid="input-booking-email"
                          />
                          <p className="text-xs text-muted-foreground">Confirmation will be sent if provided</p>
                        </div>
                      </div>

                      {/* Age + Gender */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="booking-age" className="block">Age <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                          <Input
                            id="booking-age"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={120}
                            value={bookingAge}
                            onChange={(e) => setBookingAge(e.target.value)}
                            placeholder="e.g. 32"
                            onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            data-testid="input-booking-age"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="booking-gender" className="block">Gender <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                          <select
                            id="booking-gender"
                            value={bookingGender}
                            onChange={(e) => setBookingGender(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            data-testid="select-booking-gender"
                          >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      {/* Chief Complaints */}
                      <div className="space-y-2">
                        <div>
                          <Label className="block">Chief Complaints <span className="text-xs font-normal text-muted-foreground">(select all that apply)</span></Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Tap a category to expand and select specific issues</p>
                        </div>

                        {/* Selected chips — shown at top when any are picked */}
                        {bookingDescription && (
                          <div className="flex flex-wrap gap-1 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                            <p className="w-full text-xs font-semibold text-primary mb-1">Selected complaints:</p>
                            {bookingDescription.split(", ").filter(Boolean).map(issue => (
                              <span key={issue} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full flex items-center gap-1 min-h-[28px]">
                                {issue}
                                <button
                                  type="button"
                                  onClick={() => handleComplaintClick(issue)}
                                  className="hover:text-destructive active:text-destructive transition-colors ml-0.5"
                                  data-testid={`remove-complaint-${issue.replace(/[^\w]+/g, '-').toLowerCase()}`}
                                  aria-label={`Remove ${issue}`}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Category accordion — first COMPLAINTS_INITIAL_VISIBLE shown by default */}
                        <div className="rounded-xl border border-border/40 divide-y divide-border/30">
                          {DENTAL_CATEGORIES.slice(0, complaintsExpanded ? DENTAL_CATEGORIES.length : COMPLAINTS_INITIAL_VISIBLE).map((cat) => {
                            const isOpen = bookingOpenCategory === cat.category;
                            const hasSelected = cat.subIssues.some(s => bookingDescription.split(", ").includes(s));
                            return (
                              <div key={cat.category}>
                                <button
                                  type="button"
                                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[44px]"
                                  onClick={() => setBookingOpenCategory(isOpen ? null : cat.category)}
                                  data-testid={`complaint-cat-${cat.category.replace(/[^\w]+/g, '-').toLowerCase()}`}
                                >
                                  <span className="flex items-center gap-2 text-sm font-medium">
                                    <span className="text-base leading-none">{cat.emoji}</span>
                                    <span className="text-left leading-snug">{cat.category}</span>
                                    {hasSelected && (
                                      <span className="inline-flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 text-xs px-1.5 py-0.5 rounded-full leading-none font-semibold">
                                        {cat.subIssues.filter(s => bookingDescription.split(", ").includes(s)).length} selected
                                      </span>
                                    )}
                                  </span>
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isOpen && (
                                  <div className="px-3 pb-3 pt-2 bg-muted/10 border-t border-border/20">
                                    <p className="text-xs text-muted-foreground mb-2">Tap to select all that apply</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {cat.subIssues.map((complaint) => {
                                        const isSelected = bookingDescription.split(", ").includes(complaint);
                                        return (
                                          <button
                                            key={complaint}
                                            type="button"
                                            onClick={() => handleComplaintClick(complaint)}
                                            data-testid={`complaint-${complaint.replace(/[^\w]+/g, '-').toLowerCase()}`}
                                            className={`text-xs px-2.5 py-1.5 rounded-full border transition-all min-h-[32px] font-medium ${
                                              isSelected
                                                ? 'bg-primary text-primary-foreground border-primary shadow-sm active:scale-95'
                                                : 'bg-background text-foreground border-border/60 hover:border-primary/40 hover:bg-primary/5 active:scale-95'
                                            }`}
                                          >
                                            {isSelected && <span className="mr-1">✓</span>}{complaint}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Show more / fewer toggle */}
                        <button
                          type="button"
                          onClick={() => setComplaintsExpanded(v => !v)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 active:bg-muted/60 active:scale-[0.99] transition-all text-xs font-semibold text-muted-foreground min-h-[44px]"
                          data-testid="button-complaints-expand"
                        >
                          {complaintsExpanded
                            ? <><ChevronUp className="h-3.5 w-3.5" /> Show fewer categories</>
                            : <><ChevronDown className="h-3.5 w-3.5" /> Show {DENTAL_CATEGORIES.length - COMPLAINTS_INITIAL_VISIBLE} more categories</>
                          }
                        </button>
                      </div>
                    </div>

                    {/* ── Dividers ── */}
                    <div className="hidden lg:block w-px bg-border/40 self-stretch" />
                    <div className="lg:hidden h-px w-full bg-border/40" />

                    {/* ── RIGHT: Date & Slot Selection ── */}
                    <div className="lg:w-[320px] shrink-0 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Select Appointment</span>
                      </div>

                      {/* Date strip */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">{format(bookingDate, "EEE, d MMM yyyy")}</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" data-testid="button-booking-calendar">
                                <CalendarIcon className="h-3.5 w-3.5" /> Pick date
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-xl shadow-2xl border-border/50" align="end">
                              <Calendar
                                mode="single"
                                selected={bookingDate}
                                onSelect={(date) => {
                                  if (date) { setBookingDate(date); setSelectedSlot(null); setBookingSlotPanelOpen(true); }
                                }}
                                disabled={(date) => date < startOfToday()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <ScrollArea className="w-full whitespace-nowrap pb-2">
                          <div className="flex space-x-2 px-0.5">
                            {dates.map((date) => {
                              const isSelected = isSameDay(date, bookingDate);
                              return (
                                <button
                                  key={date.toISOString()}
                                  onClick={() => { setBookingDate(date); setSelectedSlot(null); setBookingSlotPanelOpen(true); }}
                                  data-testid={`booking-date-${format(date, 'yyyy-MM-dd')}`}
                                  className={`flex flex-col items-center justify-center min-w-[3.25rem] h-14 rounded-xl border transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                                      : 'bg-card border-border/50 hover:border-primary/50 hover:bg-primary/5'
                                  }`}
                                >
                                  <span className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{format(date, "EEE")}</span>
                                  <span className="text-sm font-bold leading-none mt-0.5">{format(date, "d")}</span>
                                </button>
                              );
                            })}
                          </div>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      </div>

                      {/* Slot reveal — shown after first date tap */}
                      {!bookingSlotPanelOpen ? (
                        <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-border/50 gap-2 text-center">
                          <CalendarDays className="h-6 w-6 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">Tap a date above to see available slots</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Available Time Slots</span>
                          {adminSlotFetching ? (
                            <div className="space-y-2">
                              {[0, 1, 2].map(i => (
                                <div key={i} className="h-[60px] rounded-xl border border-border/40 bg-muted/30 animate-pulse" />
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {slotTimings.map((slot, slotIdx) => {
                                const avail = adminSlotAvailability?.find(a => a.slotIndex === slotIdx);
                                const isSlotCancelled = avail?.isCancelled ?? false;
                                if (isSlotCancelled) return null;
                                const spotsLeft = avail?.spotsLeft ?? DEFAULT_SECTION_CAPACITY[slot.id] ?? 3;
                                const isFull = avail ? avail.spotsLeft === 0 : false;
                                const isSelected = selectedSlot === slot.id;
                                const slotIcon = slot.startHour < 12
                                  ? { Icon: Sun, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-400/30" }
                                  : slot.startHour < 16
                                  ? { Icon: Clock, color: "text-sky-500", bg: "bg-sky-500/10", border: "border-sky-400/30" }
                                  : { Icon: Moon, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" };
                                const { Icon, color, bg, border } = slotIcon;
                                return (
                                  <button
                                    key={slot.id}
                                    onClick={() => !isFull && setSelectedSlot(slot.id)}
                                    disabled={isFull}
                                    data-testid={`booking-slot-${slot.id}`}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                      isSelected
                                        ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20 shadow-sm"
                                        : isFull
                                        ? "bg-muted/20 border-border/30 opacity-50 cursor-not-allowed"
                                        : "bg-card border-border/50 hover:border-primary/30 hover:bg-primary/5"
                                    }`}
                                  >
                                    <div className={`h-9 w-9 rounded-lg ${bg} border ${border} flex items-center justify-center shrink-0`}>
                                      <Icon className={`h-4 w-4 ${color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold leading-tight">{slot.label}</p>
                                      <p className="text-xs text-muted-foreground">{formatTime(slot.startHour, slot.startMinute)} – {formatTime(slot.endHour, slot.endMinute)}</p>
                                    </div>
                                    <div className="shrink-0">
                                      {isFull ? (
                                        <span className="text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-lg">Full</span>
                                      ) : (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${spotsLeft <= 1 ? "bg-amber-500/10 text-amber-600 border-amber-400/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-400/20"}`}>
                                          {spotsLeft} left
                                        </span>
                                      )}
                                    </div>
                                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Selected slot summary strip */}
                      {selectedSlot && (() => {
                        const info = slotTimings.find(s => s.id === selectedSlot);
                        return info ? (
                          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary/8 border border-primary/20">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-primary">{format(bookingDate, 'd MMM')} · {info.label}</p>
                              <p className="text-xs text-muted-foreground">{formatTime(info.startHour, info.startMinute)} – {formatTime(info.endHour, info.endMinute)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedSlot(null)}
                              className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              data-testid="button-clear-slot"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : null;
                      })()}

                      {/* Review / Confirm */}
                      {bookingShowReview ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                            <div className="px-3 py-2.5 bg-muted/20">
                              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Patient</p>
                              <p className="text-sm font-bold mt-0.5">{bookingName}</p>
                              <p className="text-xs text-muted-foreground">
                                {bookingPhone}
                                {bookingAge ? ` · Age ${bookingAge}` : ""}
                                {bookingGender ? ` · ${bookingGender}` : ""}
                                {bookingEmail ? ` · ${bookingEmail}` : ""}
                              </p>
                            </div>
                            {(() => {
                              const reviewSlot = slotTimings.find(s => s.id === selectedSlot);
                              return reviewSlot ? (
                                <div className="px-3 py-2.5">
                                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Appointment</p>
                                  <p className="text-sm font-bold mt-0.5">{format(bookingDate, "EEE, d MMM yyyy")}</p>
                                  <p className="text-xs text-muted-foreground">{reviewSlot.label} · {formatTime(reviewSlot.startHour, reviewSlot.startMinute)}–{formatTime(reviewSlot.endHour, reviewSlot.endMinute)}</p>
                                </div>
                              ) : null;
                            })()}
                            {bookingDescription && (
                              <div className="px-3 py-2.5">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Complaints</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {bookingDescription.split(", ").filter(Boolean).map(issue => (
                                    <span key={issue} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">{issue}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setBookingShowReview(false)} className="flex-1 h-10 rounded-xl border border-border/60 bg-muted/20 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all" data-testid="button-admin-review-back">← Back</button>
                            <button type="button" onClick={handleCreateBooking} disabled={createBookingMutation.isPending} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-bold shadow-md shadow-primary/20 hover:from-primary/90 hover:to-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed" data-testid="button-create-booking">
                              {createBookingMutation.isPending
                                ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating…</span>
                                : "Confirm & Book →"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setBookingShowReview(true)}
                          disabled={!bookingName || !isPhoneValid || !selectedSlot}
                          className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                          data-testid="button-review-booking"
                        >
                          Review Booking →
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
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

          {/* WEBSITE PANEL */}
          {activePanel === 'website' && (
            <WebsiteConfigPanel clinic={clinic} />
          )}

          {/* ACCOUNTS PANEL */}
          {activePanel === 'accounts' && (() => {
            const OVERDUE_DAYS = 3;
            const nowMs = Date.now();
            const isOverdue = (bill: PatientBill) =>
              (bill.paymentStatus === 'pending' || bill.paymentStatus === 'partial') &&
              !!bill.createdAt &&
              (nowMs - new Date(bill.createdAt).getTime()) > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
            const daysSince = (bill: PatientBill) =>
              Math.floor((nowMs - new Date(bill.createdAt!).getTime()) / (24 * 60 * 60 * 1000));

            // ── Global stats (same in both views) ──────────────────────
            const totalRevenue = allBills.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
            const pendingAmt   = allBills.filter(b => b.paymentStatus !== 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
            const paidCount    = allBills.filter(b => b.paymentStatus === 'paid').length;
            const overdueList  = allBills.filter(isOverdue);
            const overdueAmt   = overdueList.reduce((s, b) => s + (b.total ?? 0), 0);

            // ── Patient grouping (email → phone → name) ─────────────────
            type PatientGroup = {
              key: string; name: string; email: string; phone: string;
              bills: PatientBill[];
              totalBilled: number; totalCollected: number; outstanding: number;
              oldestUnpaidDays: number; hasOverdue: boolean;
            };
            const groupMap = new Map<string, PatientGroup>();
            for (const bill of allBills) {
              const key = bill.patientEmail?.toLowerCase().trim()
                || bill.patientPhone?.trim()
                || bill.patientName.toLowerCase().trim();
              if (!groupMap.has(key)) {
                groupMap.set(key, {
                  key,
                  name: bill.patientName,
                  email: bill.patientEmail ?? "",
                  phone: bill.patientPhone ?? "",
                  bills: [],
                  totalBilled: 0, totalCollected: 0, outstanding: 0,
                  oldestUnpaidDays: 0, hasOverdue: false,
                });
              }
              const g = groupMap.get(key)!;
              g.bills.push(bill);
              // Keep most complete name/contact (prefer longer strings)
              if ((bill.patientEmail ?? "").length > g.email.length) g.email = bill.patientEmail!;
              if ((bill.patientPhone ?? "").length > g.phone.length) g.phone = bill.patientPhone!;
              if (bill.patientName.length > g.name.length) g.name = bill.patientName;
            }
            const patientGroups: PatientGroup[] = [...groupMap.values()].map(g => {
              const totalBilled = g.bills.reduce((s, b) => s + (b.total ?? 0), 0);
              const totalCollected = g.bills.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
              const outstanding = totalBilled - totalCollected;
              const unpaidBills = g.bills.filter(b => b.paymentStatus !== 'paid' && b.createdAt);
              const oldestUnpaidDays = unpaidBills.length > 0
                ? Math.max(...unpaidBills.map(b => daysSince(b)))
                : 0;
              const hasOverdue = unpaidBills.some(b => isOverdue(b));
              return { ...g, totalBilled, totalCollected, outstanding, oldestUnpaidDays, hasOverdue };
            }).sort((a, b) => b.outstanding - a.outstanding || b.totalBilled - a.totalBilled);

            const uniquePatients = patientGroups.length;

            // ── Search filtering ─────────────────────────────────────────
            const q = accountsSearch.toLowerCase();
            const filteredGroups = q
              ? patientGroups.filter(g =>
                  g.name.toLowerCase().includes(q) ||
                  g.email.toLowerCase().includes(q) ||
                  g.phone.includes(accountsSearch) ||
                  g.bills.some(b => (b.billNumber ?? "").toLowerCase().includes(q))
                )
              : patientGroups;

            // ── Register (flat) filter ───────────────────────────────────
            const filteredRegister = allBills.filter(bill => {
              const matchesSearch = !accountsSearch ||
                bill.patientName.toLowerCase().includes(q) ||
                (bill.patientEmail ?? "").toLowerCase().includes(q) ||
                (bill.patientPhone ?? "").includes(accountsSearch) ||
                (bill.billNumber ?? "").toLowerCase().includes(q);
              const matchesStatus =
                accountsStatusFilter === 'all' ? true :
                accountsStatusFilter === 'overdue' ? isOverdue(bill) :
                bill.paymentStatus === accountsStatusFilter;
              return matchesSearch && matchesStatus;
            });

            // ── CSV export ───────────────────────────────────────────────
            const exportAccountsCSV = (rows: PatientBill[]) => {
              const escape = (val: string | null | undefined) => `"${(val ?? "").replace(/"/g, '""')}"`;
              const headers = ["Receipt #","Patient Name","Phone","Email","Date","Services","Subtotal (INR)","Discount %","Tax %","Total (INR)","Payment Method","Status","Notes"];
              const bodyRows = rows.map(b => {
                const svcs = ((b.services ?? []) as { description: string; amount: number }[])
                  .map(s => `${s.description} (${s.amount.toFixed(2)})`).join("; ");
                return [
                  escape(b.billNumber), escape(b.patientName), escape(b.patientPhone), escape(b.patientEmail),
                  escape(b.createdAt ? format(new Date(b.createdAt), "dd MMM yyyy") : ""),
                  escape(svcs),
                  String((b.subtotal ?? 0).toFixed(2)), String(b.discountPct ?? 0), String(b.taxPct ?? 0),
                  String((b.total ?? 0).toFixed(2)), escape(b.paymentMethod), escape(b.paymentStatus), escape(b.notes),
                ].join(",");
              });
              const csv = [headers.join(","), ...bodyRows].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url;
              a.download = `billing_history_${format(new Date(), "yyyyMMdd")}.csv`;
              a.click(); URL.revokeObjectURL(url);
              notify.success("CSV exported", { description: `${rows.length} record${rows.length !== 1 ? "s" : ""} downloaded.` });
            };

            // ── Aging label helper ───────────────────────────────────────
            const agingLabel = (days: number) => {
              if (days === 0) return null;
              if (days <= 30) return { label: `${days}d`, cls: 'bg-amber-100 text-amber-700 border-amber-300/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40' };
              if (days <= 60) return { label: `${days}d`, cls: 'bg-orange-100 text-orange-700 border-orange-300/60 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40' };
              return { label: `${days}d`, cls: 'bg-red-100 text-red-700 border-red-300/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40' };
            };

            return (
              <div className="space-y-5">

                {/* ── Panel header ── */}
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                  <div className="flex">
                    <div className="w-1.5 bg-primary/60 shrink-0" />
                    <div className="flex-1 px-5 py-4 bg-gradient-to-r from-primary/[0.06] to-transparent flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <IndianRupee className="h-[18px] w-[18px] text-primary" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold tracking-tight">Accounts</h2>
                          <p className="text-xs text-muted-foreground mt-0.5">Billing &amp; payment records</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* View toggle */}
                        <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5 gap-0.5">
                          {(['ledger', 'register'] as const).map(v => (
                            <button
                              key={v}
                              onClick={() => setAccountsView(v)}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                                accountsView === v
                                  ? 'bg-background shadow-sm text-foreground border border-border/60'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              data-testid={`accounts-view-${v}`}
                            >
                              {v === 'ledger' ? 'Patient Ledger' : 'Transaction Register'}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => exportAccountsCSV(accountsView === 'register' ? filteredRegister : allBills)}
                          disabled={allBills.length === 0}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/60 bg-background text-sm font-semibold text-foreground hover:bg-muted/50 hover:border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Export as CSV"
                          data-testid="button-export-csv"
                        >
                          <Download className="h-3.5 w-3.5 text-primary" />
                          Export CSV
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">

                {/* ── Stats (shared) ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Patients</p>
                    <p className="text-2xl font-black text-foreground">{uniquePatients}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{paidCount} receipts paid</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Collected</p>
                    <p className="text-2xl font-black text-primary">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">from paid bills</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Outstanding</p>
                    <p className="text-2xl font-black text-amber-600">₹{pendingAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">pending + partial</p>
                  </div>
                  <button
                    onClick={() => { setAccountsView('register'); setAccountsStatusFilter(accountsStatusFilter === 'overdue' ? 'all' : 'overdue'); }}
                    data-testid="stat-overdue"
                    className={`rounded-xl border p-4 text-left transition-all ${
                      overdueList.length > 0
                        ? 'border-red-300/60 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40 hover:bg-red-100/60 dark:hover:bg-red-950/30'
                        : 'border-border/60 bg-card'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/80 dark:text-red-400/80 mb-1">Overdue</p>
                    <p className={`text-2xl font-black ${overdueList.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {overdueList.length > 0 ? `₹${overdueAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {overdueList.length > 0 ? `${overdueList.length} bill${overdueList.length !== 1 ? 's' : ''} · 3+ days` : 'no overdue bills'}
                    </p>
                  </button>
                </div>

                {/* ── Overdue banner (shared) ── */}
                {overdueList.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-300/60 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40" data-testid="banner-overdue">
                    <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-950/50 border border-red-300/60 dark:border-red-800/40 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                        {overdueList.length} bill{overdueList.length !== 1 ? 's are' : ' is'} overdue (3+ days unpaid)
                      </p>
                      <p className="text-xs text-red-600/70 dark:text-red-400/70">
                        Total outstanding: ₹{overdueAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })} — consider sending a payment reminder
                      </p>
                    </div>
                    <button
                      onClick={() => { setAccountsView('register'); setAccountsStatusFilter('overdue'); }}
                      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-950/50 border border-red-300/60 dark:border-red-800/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-950 transition-colors"
                      data-testid="button-view-overdue"
                    >
                      View overdue
                    </button>
                  </div>
                )}

                {/* ── Search (shared) ── */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={accountsSearch}
                    onChange={e => setAccountsSearch(e.target.value)}
                    placeholder={accountsView === 'ledger'
                      ? "Search by patient name, email or phone…"
                      : "Search by patient name, email, phone or receipt #…"}
                    className="pl-8 h-9 text-sm"
                    data-testid="input-accounts-search"
                  />
                </div>

                {/* ════════════════════════════════════════════════════
                    PATIENT LEDGER VIEW
                    ════════════════════════════════════════════════════ */}
                {accountsView === 'ledger' && (
                  <div className="space-y-2">
                    {filteredGroups.length === 0 ? (
                      <div className="py-16 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
                        <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
                          <IndianRupee className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="font-medium text-muted-foreground">
                          {allBills.length === 0 ? "No bills yet" : "No patients match your search"}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {allBills.length === 0
                            ? "Open any booking and add a charge to get started"
                            : "Try a different name, email or phone"}
                        </p>
                      </div>
                    ) : filteredGroups.map(group => {
                      const isExpanded = expandedPatients.has(group.key);
                      const aging = agingLabel(group.oldestUnpaidDays);
                      const sortedBills = [...group.bills].sort(
                        (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
                      );
                      return (
                        <div
                          key={group.key}
                          className={`rounded-xl border overflow-hidden transition-colors ${
                            group.hasOverdue
                              ? 'border-red-300/50 dark:border-red-800/40'
                              : 'border-border/60'
                          }`}
                          data-testid={`ledger-patient-${group.key}`}
                        >
                          {/* Patient header row */}
                          <button
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${
                              group.hasOverdue ? 'bg-red-50/40 dark:bg-red-950/10' : 'bg-card'
                            }`}
                            onClick={() => setExpandedPatients(prev => {
                              const next = new Set(prev);
                              if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                              return next;
                            })}
                            data-testid={`ledger-expand-${group.key}`}
                          >
                            {/* Left stripe for overdue */}
                            {group.hasOverdue && (
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500/70 rounded-r" />
                            )}

                            {/* Avatar initials */}
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                              group.outstanding > 0
                                ? group.hasOverdue
                                  ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                                  : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {group.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>

                            {/* Name + contact */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-foreground truncate">{group.name}</p>
                                {aging && (
                                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${aging.cls}`}>
                                    <Clock className="h-2 w-2" />{aging.label} overdue
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {group.email && (
                                  <span className="text-[10px] text-muted-foreground truncate">{group.email}</span>
                                )}
                                {group.email && group.phone && (
                                  <span className="text-[10px] text-muted-foreground/40">·</span>
                                )}
                                {group.phone && (
                                  <span className="text-[10px] text-muted-foreground">{group.phone}</span>
                                )}
                              </div>
                            </div>

                            {/* Financial summary */}
                            <div className="hidden sm:flex items-center gap-4 shrink-0 text-right">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Billed</p>
                                <p className="text-xs font-bold text-foreground">₹{group.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Collected</p>
                                <p className="text-xs font-bold text-emerald-600">₹{group.totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Balance</p>
                                <p className={`text-xs font-bold ${group.outstanding > 0 ? (group.hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600') : 'text-muted-foreground'}`}>
                                  {group.outstanding > 0 ? `₹${group.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Visits</p>
                                <p className="text-xs font-bold text-foreground">{group.bills.length}</p>
                              </div>
                            </div>

                            {/* Mobile summary */}
                            <div className="sm:hidden flex flex-col items-end shrink-0">
                              <p className={`text-sm font-bold ${group.outstanding > 0 ? (group.hasOverdue ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600'}`}>
                                {group.outstanding > 0 ? `₹${group.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })} due` : '✓ Settled'}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{group.bills.length} visit{group.bills.length !== 1 ? 's' : ''}</p>
                            </div>

                            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Expanded bill rows */}
                          {isExpanded && (
                            <div className="border-t border-border/40 bg-muted/5 divide-y divide-border/30">
                              {/* Column header */}
                              <div className="hidden sm:grid grid-cols-[1fr_110px_90px_1fr] gap-3 px-4 py-1.5 bg-muted/30">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Receipt #</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-right">Status / Actions</span>
                              </div>
                              {sortedBills.map(bill => {
                                const od = isOverdue(bill);
                                const isUpd = updateBillStatusMutation.isPending && updateBillStatusMutation.variables?.id === bill.id;
                                const sc: Record<string, string> = { pending: 'paid', partial: 'paid', paid: 'pending' };
                                const nxt = sc[bill.paymentStatus ?? 'pending'] ?? 'paid';
                                const svcs = (bill.services ?? []) as { description: string; amount: number }[];
                                return (
                                  <div
                                    key={bill.id}
                                    className={`grid grid-cols-1 sm:grid-cols-[1fr_110px_90px_1fr] gap-2 sm:gap-3 px-4 py-2.5 items-center group transition-colors hover:bg-muted/20 ${od ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}
                                    data-testid={`ledger-bill-${bill.id}`}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-mono font-semibold text-foreground truncate">{bill.billNumber}</p>
                                      {svcs.length > 0 && (
                                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                          {svcs.slice(0, 2).map(s => s.description).join(', ')}{svcs.length > 2 ? ` +${svcs.length - 2} more` : ''}
                                        </p>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : "—"}
                                    </p>
                                    <p className={`text-xs font-bold text-right ${od ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>
                                      ₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </p>
                                    <div className="flex items-center justify-end gap-1.5">
                                      {bill.paymentStatus === 'paid' && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                          <CheckCircle2 className="h-2.5 w-2.5" /> Paid
                                        </span>
                                      )}
                                      {bill.paymentStatus === 'pending' && (
                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${od ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-800/40' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                                          <Clock className="h-2.5 w-2.5" /> Pending
                                        </span>
                                      )}
                                      {bill.paymentStatus === 'partial' && (
                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${od ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-800/40' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'}`}>
                                          Partial
                                        </span>
                                      )}
                                      <button
                                        className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg border ${nxt === 'paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-400' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'}`}
                                        onClick={() => updateBillStatusMutation.mutate({ id: bill.id, paymentStatus: nxt })}
                                        disabled={isUpd}
                                        data-testid={`ledger-status-toggle-${bill.id}`}
                                      >
                                        {isUpd ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : nxt === 'paid' ? <><CheckCircle2 className="h-2.5 w-2.5" /> Mark Paid</> : <><Clock className="h-2.5 w-2.5" /> Unpaid</>}
                                      </button>
                                      <button
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                        onClick={() => printBillFromRecord(bill)}
                                        title="Download PDF"
                                        data-testid={`ledger-print-${bill.id}`}
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Patient total footer */}
                              <div className="px-4 py-2 bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-[10px] text-muted-foreground">{group.bills.length} visit{group.bills.length !== 1 ? 's' : ''} total</p>
                                <div className="flex items-center gap-4">
                                  <span className="text-[10px] text-muted-foreground">Billed <span className="font-bold text-foreground">₹{group.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                                  <span className="text-[10px] text-muted-foreground">Collected <span className="font-bold text-emerald-600">₹{group.totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                                  {group.outstanding > 0 && (
                                    <span className="text-[10px] text-muted-foreground">Balance <span className={`font-bold ${group.hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600'}`}>₹{group.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ════════════════════════════════════════════════════
                    TRANSACTION REGISTER VIEW
                    ════════════════════════════════════════════════════ */}
                {accountsView === 'register' && (
                  <div className="space-y-4">
                    {/* Status filter pills */}
                    <div className="flex gap-1.5 flex-wrap">
                      {(['all', 'paid', 'pending', 'partial', 'overdue'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setAccountsStatusFilter(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                            s === 'overdue'
                              ? accountsStatusFilter === 'overdue'
                                ? 'bg-red-600 text-white border-red-600'
                                : overdueList.length > 0
                                ? 'bg-red-50 border-red-300/60 text-red-700 dark:bg-red-950/20 dark:border-red-800/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/30'
                                : 'bg-background border-border/60 text-muted-foreground'
                              : accountsStatusFilter === s
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          }`}
                          data-testid={`filter-accounts-${s}`}
                        >
                          {s === 'all' ? `All (${allBills.length})` : s === 'overdue' ? `Overdue${overdueList.length > 0 ? ` (${overdueList.length})` : ''}` : s}
                        </button>
                      ))}
                    </div>

                    {/* Flat bill list */}
                    {filteredRegister.length === 0 ? (
                      <div className="py-16 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
                        <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
                          <IndianRupee className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="font-medium text-muted-foreground">
                          {allBills.length === 0 ? "No receipts yet" : "No results match your filter"}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {allBills.length === 0 ? "Generate your first receipt from any booking" : "Try adjusting the search or status filter"}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border/60 overflow-hidden">
                        <div className="hidden sm:grid grid-cols-[1fr_130px_100px_90px_1fr] gap-4 px-4 py-2 bg-muted/40 border-b border-border/50">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Patient</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receipt #</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Status</span>
                        </div>
                        <div className="divide-y divide-border/40">
                          {filteredRegister.map(bill => {
                            const isUpdating = updateBillStatusMutation.isPending && updateBillStatusMutation.variables?.id === bill.id;
                            const sc: Record<string, string> = { pending: 'paid', partial: 'paid', paid: 'pending' };
                            const nextStatus = sc[bill.paymentStatus ?? 'pending'] ?? 'paid';
                            const overdue = isOverdue(bill);
                            const daysAgo = overdue ? daysSince(bill) : 0;
                            return (
                              <div
                                key={bill.id}
                                className={`relative grid grid-cols-1 sm:grid-cols-[1fr_130px_100px_90px_1fr] gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/20 transition-colors items-center group ${overdue ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}
                                data-testid={`accounts-row-${bill.id}`}
                              >
                                {overdue && <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r bg-red-500/70" />}
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{bill.patientName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {bill.patientEmail && <p className="text-[10px] text-muted-foreground truncate">{bill.patientEmail}</p>}
                                    {bill.patientEmail && bill.patientPhone && <span className="text-[10px] text-muted-foreground/40">·</span>}
                                    {bill.patientPhone && <p className="text-[10px] text-muted-foreground">{bill.patientPhone}</p>}
                                    {overdue && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300/60 dark:border-red-800/40 shrink-0" data-testid={`accounts-overdue-badge-${bill.id}`}>
                                        <Clock className="h-2 w-2" />{daysAgo}d overdue
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs font-mono text-muted-foreground truncate">{bill.billNumber}</p>
                                <p className="text-xs text-muted-foreground">{bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : "—"}</p>
                                <p className={`text-sm font-bold text-right ${overdue ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>
                                  ₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                                <div className="flex items-center justify-end gap-1.5">
                                  {bill.paymentStatus === 'paid' && <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0"><CheckCircle2 className="h-2.5 w-2.5" /> Paid</span>}
                                  {bill.paymentStatus === 'pending' && <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${overdue ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300/60 dark:border-red-800/40' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}><Clock className="h-2.5 w-2.5" /> Pending</span>}
                                  {bill.paymentStatus === 'partial' && <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${overdue ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300/60 dark:border-red-800/40' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>Partial</span>}
                                  <button
                                    className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg border ${nextStatus === 'paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-400' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'}`}
                                    onClick={() => updateBillStatusMutation.mutate({ id: bill.id, paymentStatus: nextStatus })}
                                    disabled={isUpdating}
                                    data-testid={`accounts-status-toggle-${bill.id}`}
                                  >
                                    {isUpdating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : nextStatus === 'paid' ? <><CheckCircle2 className="h-2.5 w-2.5" /> Mark Paid</> : <><Clock className="h-2.5 w-2.5" /> Unpaid</>}
                                  </button>
                                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground" onClick={() => printBillFromRecord(bill)} title="Download PDF" data-testid={`accounts-print-${bill.id}`}>
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                  {billDeleteConfirm === bill.id ? (
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                      <button className="text-[9px] font-bold px-2 py-1 rounded-lg bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-700 dark:text-red-400" onClick={() => { deleteBillMutation.mutate(bill.id); setBillDeleteConfirm(null); }} disabled={deleteBillMutation.isPending} data-testid={`accounts-delete-confirm-${bill.id}`}>
                                        {deleteBillMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin inline" /> : "Yes, delete"}
                                      </button>
                                      <button className="text-[9px] font-bold px-2 py-1 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground" onClick={() => setBillDeleteConfirm(null)} data-testid={`accounts-delete-cancel-${bill.id}`}>Cancel</button>
                                    </div>
                                  ) : (
                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 dark:hover:text-red-400" onClick={() => setBillDeleteConfirm(bill.id)} title="Delete" data-testid={`accounts-delete-${bill.id}`}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Register totals row */}
                        <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-4 flex-wrap">
                          <p className="text-[10px] text-muted-foreground">{filteredRegister.length} record{filteredRegister.length !== 1 ? 's' : ''} shown</p>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] text-muted-foreground">Total <span className="font-bold text-foreground">₹{filteredRegister.reduce((s, b) => s + (b.total ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                            <span className="text-[10px] text-muted-foreground">Collected <span className="font-bold text-emerald-600">₹{filteredRegister.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.total ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                            <span className="text-[10px] text-muted-foreground">Outstanding <span className="font-bold text-amber-600">₹{filteredRegister.filter(b => b.paymentStatus !== 'paid').reduce((s, b) => s + (b.total ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
            );
          })()}

          {/* PATIENT DIRECTORY PANEL */}
          {activePanel === 'patients' && (() => {
            const q = patientSearch.toLowerCase().trim();
            const filtered = patientDirectory.filter(p =>
              !q ||
              (p.patientCode ?? '').toLowerCase().includes(q) ||
              (p.name ?? '').toLowerCase().includes(q) ||
              (p.email ?? '').toLowerCase().includes(q) ||
              (p.phone ?? '').toLowerCase().includes(q)
            );
            const sorted = [...filtered].sort((a, b) => {
              if (patientSort === 'visits') return b.visitCount - a.visitCount;
              if (patientSort === 'billed') return b.totalBilled - a.totalBilled;
              return new Date(b.lastVisitAt ?? 0).getTime() - new Date(a.lastVisitAt ?? 0).getTime();
            });

            const totalPatients = patientDirectory.length;
            const nowMs = Date.now();
            const activeThisMonth = patientDirectory.filter(p =>
              p.lastVisitAt && (nowMs - new Date(p.lastVisitAt).getTime()) < 30 * 24 * 60 * 60 * 1000
            ).length;
            const newThisMonth = patientDirectory.filter(p =>
              p.createdAt && (nowMs - new Date(p.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000
            ).length;
            const totalRevenue = patientDirectory.reduce((s, p) => s + p.totalBilled, 0);

            const exportCSV = () => {
              const header = ['PAT Code', 'Name', 'Email', 'Phone', 'Visits', 'Last Visit', 'Total Billed (₹)'];
              const rows = patientDirectory.map(p => [
                p.patientCode ?? '',
                p.name ?? '',
                p.email ?? '',
                p.phone ?? '',
                String(p.visitCount),
                p.lastVisitAt ? format(new Date(p.lastVisitAt), 'dd MMM yyyy') : '',
                String(p.totalBilled),
              ]);
              const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              const a = document.createElement('a'); a.href = url; a.download = 'patients.csv'; a.click();
              URL.revokeObjectURL(url);
            };

            return (
              <>
              <div className="space-y-5">
                {/* Panel header */}
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                  <div className="flex">
                    <div className="w-1.5 bg-rose-500/60 shrink-0" />
                    <div className="flex-1 px-5 py-4 bg-gradient-to-r from-rose-500/[0.06] to-transparent flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                          <Users className="h-[18px] w-[18px] text-rose-500" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold tracking-tight">Patient Directory</h2>
                          <p className="text-xs text-muted-foreground mt-0.5">All patients who booked via verified email</p>
                        </div>
                      </div>
                      <button
                        onClick={exportCSV}
                        data-testid="button-export-patients"
                        disabled={patientDirectory.length === 0}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border border-border/60 bg-background hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Patients', value: totalPatients, icon: Users, color: 'rose' },
                    { label: 'Active This Month', value: activeThisMonth, icon: TrendingUp, color: 'emerald' },
                    { label: 'New This Month', value: newThisMonth, icon: BadgeCheck, color: 'blue' },
                    { label: 'Revenue Collected', value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: IndianRupee, color: 'amber' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl border border-border/50 bg-card p-4">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${
                        color === 'rose' ? 'bg-rose-500/10' :
                        color === 'emerald' ? 'bg-emerald-500/10' :
                        color === 'blue' ? 'bg-blue-500/10' : 'bg-amber-500/10'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          color === 'rose' ? 'text-rose-500' :
                          color === 'emerald' ? 'text-emerald-600' :
                          color === 'blue' ? 'text-blue-500' : 'text-amber-600'
                        }`} />
                      </div>
                      <p className="text-xl font-bold text-foreground">{value}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Search + Sort bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      placeholder="Search by name, email, phone or PAT code…"
                      data-testid="input-patient-search"
                      className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-border/60 bg-card focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 transition-all placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
                    {(['recent', 'visits', 'billed'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setPatientSort(s)}
                        data-testid={`button-sort-${s}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${patientSort === s ? 'bg-rose-500/10 text-rose-600' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        {s === 'recent' ? 'Recent' : s === 'visits' ? 'Most Visits' : 'Highest Billed'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Patient list */}
                {patientsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sorted.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {patientSearch ? 'No patients match your search' : 'No patients yet'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {patientSearch ? 'Try a different name, email, or PAT code' : 'Patients appear here once they book with email OTP verification'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                    {/* Table header */}
                    <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 bg-muted/30 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span className="w-20">PAT Code</span>
                      <span>Name</span>
                      <span>Email</span>
                      <span>Phone</span>
                      <span className="w-14 text-right">Visits</span>
                      <span className="w-24 text-right">Last Visit</span>
                      <span className="w-24 text-right">Billed</span>
                    </div>

                    <div className="divide-y divide-border/50">
                      {sorted.map((patient) => (
                        <div
                          key={patient.id}
                          data-testid={`row-patient-${patient.id}`}
                          onClick={() => setSelectedPatientId(patient.id)}
                          className="px-4 py-3 hover:bg-rose-500/5 cursor-pointer transition-colors group"
                        >
                          {/* Desktop row */}
                          <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-3 items-center">
                            <span className="w-20 font-mono text-[11px] font-bold bg-rose-500/10 text-rose-600 px-2 py-1 rounded-md">
                              {patient.patientCode ?? '—'}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate group-hover:text-rose-600 transition-colors">{patient.name ?? '—'}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{patient.email ?? '—'}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{patient.phone ?? '—'}</span>
                            <span className="w-14 text-right">
                              <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary/10 text-primary text-[11px] font-bold px-1.5">
                                {patient.visitCount}
                              </span>
                            </span>
                            <span className="w-24 text-right text-[11px] text-muted-foreground">
                              {patient.lastVisitAt ? format(new Date(patient.lastVisitAt), 'dd MMM yyyy') : '—'}
                            </span>
                            <span className="w-24 text-right text-sm font-semibold text-emerald-600">
                              {patient.totalBilled > 0 ? `₹${patient.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                            </span>
                          </div>

                          {/* Mobile card */}
                          <div className="sm:hidden flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-rose-500" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-foreground truncate">{patient.name ?? '—'}</p>
                                  <span className="font-mono text-[9px] font-bold bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded-md shrink-0">
                                    {patient.patientCode ?? '—'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">{patient.email ?? '—'}</p>
                                <p className="text-[11px] text-muted-foreground">{patient.phone ?? '—'}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-emerald-600">
                                {patient.totalBilled > 0 ? `₹${patient.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{patient.visitCount} visit{patient.visitCount !== 1 ? 's' : ''}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {patient.lastVisitAt ? format(new Date(patient.lastVisitAt), 'dd MMM') : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-[10px] text-muted-foreground">
                        Showing {sorted.length} of {totalPatients} patient{totalPatients !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Total billed <span className="font-bold text-emerald-600">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* "Click a row to view history" hint */}
                {sorted.length > 0 && (
                  <p className="text-center text-[11px] text-muted-foreground mt-2">
                    Click any patient row to view their full visit history
                  </p>
                )}
              </div>

              {/* ── PATIENT HISTORY SLIDE-OVER ── */}
              {selectedPatientId && (() => {
                const selPatient = patientDirectory.find(p => p.id === selectedPatientId);
                const visitBookings = patientHistory?.bookings ?? [];
                const visitBills = patientHistory?.bills ?? [];
                const visitRecords = patientHistory?.clinicalRecords ?? [];

                return (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
                      onClick={() => setSelectedPatientId(null)}
                    />
                    {/* Drawer */}
                    <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                      {/* Drawer header */}
                      <div className="flex items-start gap-3 px-5 py-4 border-b border-border/60 bg-card shrink-0">
                        <div className="h-11 w-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-rose-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-bold text-foreground">{selPatient?.name ?? 'Patient'}</p>
                            {selPatient?.patientCode && (
                              <span className="font-mono text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 px-2 py-0.5 rounded-md">
                                {selPatient.patientCode}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{selPatient?.email ?? '—'}</p>
                          <p className="text-[11px] text-muted-foreground">{selPatient?.phone ?? '—'}</p>
                        </div>
                        <button
                          onClick={() => setSelectedPatientId(null)}
                          data-testid="button-close-patient-history"
                          className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Quick stats bar */}
                      <div className="grid grid-cols-3 divide-x divide-border/50 border-b border-border/60 shrink-0">
                        {[
                          { label: 'Total Visits', value: selPatient?.visitCount ?? 0 },
                          { label: 'Bills Raised', value: visitBills.length },
                          { label: 'Total Billed', value: `₹${(selPatient?.totalBilled ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
                        ].map(({ label, value }) => (
                          <div key={label} className="px-4 py-3 text-center">
                            <p className="text-base font-bold text-foreground">{value}</p>
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Scrollable content */}
                      <div className="flex-1 overflow-y-auto">
                        {historyLoading ? (
                          <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="p-5 space-y-6">

                            {/* Visit Timeline */}
                            <section>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                Visit Timeline ({visitBookings.length})
                              </p>
                              {visitBookings.length === 0 ? (
                                <p className="text-[12px] text-muted-foreground italic">No bookings linked yet</p>
                              ) : (
                                <div className="space-y-2">
                                  {visitBookings.map((bk) => {
                                    const slotBills = visitBills.filter(b => b.bookingId === bk.id);
                                    const slotRecord = visitRecords.find(r => r.bookingId === bk.id);
                                    const statusColor =
                                      bk.verificationStatus === 'confirmed' ? 'text-emerald-600 bg-emerald-500/10' :
                                      bk.verificationStatus === 'cancelled' ? 'text-rose-500 bg-rose-500/10' :
                                      'text-amber-600 bg-amber-500/10';
                                    return (
                                      <div key={bk.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                                        {/* Visit header */}
                                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-muted/30 border-b border-border/40">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-[12px] font-semibold text-foreground">
                                              {format(new Date(bk.slot.startTime), 'dd MMM yyyy')}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground">
                                              {format(new Date(bk.slot.startTime), 'h:mm a')} – {format(new Date(bk.slot.endTime), 'h:mm a')}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
                                              {bk.verificationStatus}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">#{bk.id}</span>
                                          </div>
                                        </div>

                                        <div className="px-3 py-2.5 space-y-2">
                                          {/* Doctor */}
                                          {bk.assignedDoctor && (
                                            <div className="flex items-center gap-2">
                                              <Stethoscope className="h-3 w-3 text-muted-foreground shrink-0" />
                                              <span className="text-[11px] text-muted-foreground">Dr. {bk.assignedDoctor}</span>
                                            </div>
                                          )}

                                          {/* Clinical record */}
                                          {slotRecord && (
                                            <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 p-2.5 space-y-1">
                                              {(slotRecord.diagnosis as string[])?.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                  {(slotRecord.diagnosis as string[]).map((d, i) => (
                                                    <span key={i} className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-md font-medium">{d}</span>
                                                  ))}
                                                </div>
                                              )}
                                              {slotRecord.prescription && (() => {
                                                let rxText = slotRecord.prescription;
                                                try {
                                                  const rxRows = JSON.parse(slotRecord.prescription);
                                                  if (Array.isArray(rxRows) && rxRows[0]?.name) {
                                                    rxText = rxRows.map((r: any) => `${r.name}${r.dosage ? ` ${r.dosage}` : ''}${r.frequency ? ` ${r.frequency}` : ''}`).join(', ');
                                                  }
                                                } catch { /* use raw text */ }
                                                return (
                                                  <p className="text-[11px] text-muted-foreground">
                                                    <span className="font-semibold text-foreground">Rx: </span>{rxText}
                                                  </p>
                                                );
                                              })()}
                                              {slotRecord.notes && (
                                                <p className="text-[11px] text-muted-foreground">
                                                  <span className="font-semibold text-foreground">Notes: </span>{slotRecord.notes}
                                                </p>
                                              )}
                                            </div>
                                          )}

                                          {/* Bills */}
                                          {slotBills.length > 0 && (
                                            <div className="space-y-1">
                                              {slotBills.map(bill => (
                                                <div key={bill.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <span className="text-[11px] text-muted-foreground font-mono truncate">{bill.billNumber}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${bill.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                                      {bill.paymentStatus}
                                                    </span>
                                                    <span className="text-[12px] font-bold text-foreground">₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </section>

                            {/* Unlinked bills (no bookingId match) */}
                            {(() => {
                              const linkedBillIds = new Set(visitBookings.map(b => b.id));
                              const unlinked = visitBills.filter(b => !b.bookingId || !linkedBillIds.has(b.bookingId));
                              if (unlinked.length === 0) return null;
                              return (
                                <section>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                    Other Bills ({unlinked.length})
                                  </p>
                                  <div className="space-y-1.5">
                                    {unlinked.map(bill => (
                                      <div key={bill.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-3 py-2.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                          <div className="min-w-0">
                                            <p className="text-[12px] font-semibold text-foreground font-mono">{bill.billNumber}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                              {bill.createdAt ? format(new Date(bill.createdAt), 'dd MMM yyyy') : '—'}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${bill.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                            {bill.paymentStatus}
                                          </span>
                                          <span className="text-sm font-bold text-foreground">₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </section>
                              );
                            })()}

                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              </>
            );
          })()}

        </div>
        {/* ===== END MAIN CONTENT ===== */}
        {/* ===== END BOOKINGS SECTION ===== */}

      </div>
      {/* ===== END TWO-COLUMN LAYOUT ===== */}

      {/* Billing Modal */}
      <Dialog open={isBillingOpen} onOpenChange={setIsBillingOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[520px] rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              {billingDetails.printOnly ? "Print Consolidated Receipt" : "Print Receipt"}
            </DialogTitle>
            <DialogDescription>
              Review and edit details before downloading the PDF receipt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">

            {/* Clinic Information — compact 2-col grid */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinic Information</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={billingDetails.clinicName}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicName: e.target.value }))}
                  placeholder="e.g. Bright Smiles Dental"
                  className="h-8 text-sm"
                />
                <Input
                  value={billingDetails.clinicPhone}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicPhone: e.target.value }))}
                  placeholder="e.g. +91 98765 43210"
                  className="h-8 text-sm"
                />
                <Input
                  value={billingDetails.clinicEmail}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicEmail: e.target.value }))}
                  placeholder="e.g. clinic@example.com"
                  className="h-8 text-sm"
                />
                <Input
                  value={billingDetails.clinicAddress}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicAddress: e.target.value }))}
                  placeholder="e.g. 12 MG Road, Ernakulam"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Receipt + Date — always 2-col */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt Details</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={billingDetails.receiptNumber}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, receiptNumber: e.target.value }))}
                  placeholder="e.g. RCP-001"
                  className="h-8 text-sm"
                />
                <Input
                  value={billingDetails.date}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, date: e.target.value }))}
                  placeholder="e.g. 27 May 2026"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Patient Information — compact 2-col */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient Information</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={billingDetails.patientName}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, patientName: e.target.value }))}
                  placeholder="e.g. Rahul Verma"
                  className="h-8 text-sm"
                />
                <Input
                  value={billingDetails.patientPhone}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, patientPhone: e.target.value }))}
                  placeholder="e.g. +91 98765 43210"
                  className="h-8 text-sm"
                />
                <Input
                  value={billingDetails.patientEmail}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, patientEmail: e.target.value }))}
                  placeholder="e.g. patient@example.com"
                  className="h-8 text-sm col-span-2"
                />
              </div>
            </div>

            {/* Services */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</Label>
                <Button variant="ghost" size="sm" onClick={addServiceRow} className="h-7 px-2 text-primary gap-1">
                  <Plus className="h-3 w-3" />
                  <span className="text-[10px]">Add Row</span>
                </Button>
              </div>
              <div className="space-y-2">
                {billingDetails.services.map((service, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        value={service.description}
                        onChange={(e) => updateService(index, "description", e.target.value)}
                        placeholder="e.g. Scaling & Polishing"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={service.amount}
                        onChange={(e) => updateService(index, "amount", e.target.value)}
                        placeholder="e.g. 800"
                        className="h-9 text-sm"
                      />
                    </div>
                    {billingDetails.services.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeServiceRow(index)}
                        className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Discount, Tax, Payment */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment & Summary</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={billingDetails.discount}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, discount: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tax / GST %</Label>
                  <Input
                    type="number"
                    min="0"
                    value={billingDetails.tax}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, tax: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Payment Method</Label>
                  <Input
                    value={billingDetails.paymentMethod}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    placeholder="e.g. UPI / Cash"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Transaction ID <span className="text-muted-foreground/60">(optional)</span></Label>
                  <Input
                    value={billingDetails.transactionId}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, transactionId: e.target.value }))}
                    placeholder="UPI ref / card txn"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <Input
                value={billingDetails.remarks}
                onChange={(e) => setBillingDetails(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Remarks (optional)"
                className="h-8 text-sm"
              />
            </div>

            {/* Live total preview */}
            {(() => {
              const sub = billingDetails.services.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
              const disc = sub * ((parseFloat(billingDetails.discount) || 0) / 100);
              const tax = (sub - disc) * ((parseFloat(billingDetails.tax) || 0) / 100);
              const total = sub - disc + tax;
              return (
                <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>₹{sub.toFixed(2)}</span>
                  </div>
                  {disc > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Discount</span><span>- ₹{disc.toFixed(2)}</span>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax / GST</span><span>+ ₹{tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-primary border-t border-primary/15 pt-1 mt-1">
                    <span>Total Amount Due</span><span>₹{total.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Payment Status */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Status</Label>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBillingOpen(false)}>Cancel</Button>
            <Button onClick={generatePDF} className="gap-2">
              <Printer className="h-4 w-4" />
              {billingDetails.printOnly ? "Print & Download" : billingDetails.existingBillId ? "Update & Print" : "Print & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Doctor Password Dialog */}
      <Dialog open={resetPwdOpen} onOpenChange={(open) => { setResetPwdOpen(open); if (!open) { setResetPwdNew(""); setResetPwdConfirm(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Reset Doctor Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-semibold">{resetPwdDoctorName}</span>
              {resetPwdDoctorEmail && <span className="text-muted-foreground"> ({resetPwdDoctorEmail})</span>}.
              They will be prompted to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pwd-new">New Password</Label>
              <Input
                id="reset-pwd-new"
                type="password"
                placeholder="Min. 8 characters"
                value={resetPwdNew}
                onChange={e => setResetPwdNew(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-pwd-confirm">Confirm Password</Label>
              <Input
                id="reset-pwd-confirm"
                type="password"
                placeholder="Re-enter to confirm"
                value={resetPwdConfirm}
                onChange={e => setResetPwdConfirm(e.target.value)}
              />
              {resetPwdConfirm && resetPwdNew !== resetPwdConfirm && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetPwdOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (resetPwdDoctorId && resetPwdNew && resetPwdNew === resetPwdConfirm) {
                  resetDoctorPasswordMutation.mutate({ doctorId: resetPwdDoctorId, newPassword: resetPwdNew });
                }
              }}
              disabled={!resetPwdNew || resetPwdNew !== resetPwdConfirm || resetDoctorPasswordMutation.isPending}
              className="gap-2"
            >
              {resetDoctorPasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CLINIC MOBILE BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-stretch">
          {([
            { key: 'bookings'        as const, label: 'Bookings', Icon: CalendarIcon },
            { key: 'configure-slots' as const, label: 'Slots',    Icon: Clock },
            { key: 'manage-doctors'  as const, label: 'Doctors',  Icon: Stethoscope },
            { key: 'accounts'        as const, label: 'Accounts', Icon: IndianRupee },
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
              ['clinic-profile','book-a-slot','inventory','website','export-data','patients','analytics'].includes(activePanel)
                ? 'text-primary' : 'text-muted-foreground'
            }`}
            data-testid="bottom-nav-clinic-more"
          >
            {['clinic-profile','book-a-slot','inventory','website','export-data','patients','analytics'].includes(activePanel) && (
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
          <div className="grid grid-cols-2 gap-2 pb-6">
            {([
              { key: 'clinic-profile' as const, label: 'Clinic Profile', desc: 'Edit public about page',   Icon: Building2,   cls: 'bg-violet-500/10 border-violet-500/20 text-violet-600' },
              { key: 'book-a-slot'    as const, label: 'Book a Slot',    desc: 'New patient appointment',  Icon: Plus,        cls: 'bg-primary/10 border-primary/20 text-primary' },
              { key: 'inventory'      as const, label: 'Inventory',      desc: 'Stock, assets & alerts',   Icon: Package,     cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' },
              { key: 'website'        as const, label: 'Website',        desc: 'Theme & content',           Icon: Globe,       cls: 'bg-sky-500/10 border-sky-500/20 text-sky-600' },
              { key: 'export-data'   as const, label: 'Export Data',    desc: 'Download patient records',  Icon: Download,    cls: 'bg-amber-500/10 border-amber-500/20 text-amber-600' },
              { key: 'patients'       as const, label: 'Patients',       desc: 'Patient directory',         Icon: Users,       cls: 'bg-rose-500/10 border-rose-500/20 text-rose-600' },
              { key: 'analytics'     as const, label: 'Analytics',      desc: 'Clinic performance',        Icon: TrendingUp,  cls: 'bg-violet-500/10 border-violet-500/20 text-violet-600' },
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
        </SheetContent>
      </Sheet>

    </div>
  );
}
