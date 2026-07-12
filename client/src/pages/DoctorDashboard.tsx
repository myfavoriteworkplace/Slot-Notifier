import { useEffect, useMemo, useState, useRef } from "react";
import QRCode from "react-qr-code";
import { BookingNotesThread } from "@/components/BookingNotesThread";
import ClinicalRecordsTab from "@/components/ClinicalRecordsTab";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, LogOut, Stethoscope, Building2, Calendar, ShieldAlert, Clock, UserX, ShieldCheck, Activity,
  ClipboardList, CheckCircle2, AlertCircle, Hash, CalendarDays, TrendingUp, ArrowRight,
  Info, X, Filter, BadgeCheck, RotateCcw, User, Award, BookOpen, Plus, Pencil, Trash2,
  Copy, Check, Link as LinkIcon, Image as ImageIcon, Tag, GraduationCap, Star, Eye,
  Upload, Play, Globe, Share2, FileText, ChevronDown, ChevronUp, ChevronRight, BriefcaseMedical, KeyRound,
  MoreHorizontal, CalendarOff, Phone, Pill, Repeat2, PenLine, ClipboardCheck, Microscope, RefreshCw,
  SlidersHorizontal, Maximize2, Minimize2, Layers, Search, Menu, Bell, LayoutList
} from "lucide-react";
import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Clinic, DoctorCertification, DoctorCase, DoctorLeave } from "@shared/schema";
import { format, differenceInCalendarDays, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, addDays } from "date-fns";
import { compressImage } from "@/lib/imageCompression";
import { type BookingsPagedResponse } from "@/lib/booking-list";
import { AppointmentCard } from "@/components/AppointmentCard";
import XrayAnalysisTab from "@/components/XrayAnalysisTab";
import OdontogramTab from "@/components/OdontogramTab";

type QuickFilter = "all" | "owned" | "today" | "upcoming" | "awaiting" | "pending-7days" | "confirmed-7days" | "this-week" | "next-week";
type Tab = "appointments" | "profile" | "certifications" | "cases" | "leaves" | "xray";

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com");
}

function MediaThumb({ url }: { url: string }) {
  if (isVideo(url)) {
    return (
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted/40 flex items-center justify-center border border-border/40 group">
        <Play className="h-8 w-8 text-primary/60 group-hover:text-primary transition-colors" />
        <span className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/70 rounded px-1">Video</span>
      </div>
    );
  }
  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-muted/40 border border-border/40">
      <img src={url} alt="Case media" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
}

const DR_VISIT_TYPE_LABELS: Record<string, string> = {
  first_visit: "First Visit",
  follow_up: "Follow Up",
  emergency: "Emergency",
  routine_checkup: "Routine Checkup",
  consultation: "Consultation",
  review: "Review",
  booked_by_patient: "Booked by Patient",
};

const DR_CLINICAL_STATUS: Record<string, { label: string; cls: string }> = {
  first_visit:        { label: "First Visit",        cls: "bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800" },
  revisit:            { label: "Revisit",            cls: "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800" },
  follow_up_required: { label: "Follow-up Required", cls: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  case_closed:        { label: "Case Closed",        cls: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
};

const DR_CHIEF_COMPLAINTS = [
  "Toothache", "Tooth sensitivity", "Sensitivity to hot/cold/sweet",
  "Sharp or throbbing pain", "Jaw pain", "Bleeding gums", "Swollen or red gums",
  "Receding gums", "Bad breath", "Broken or chipped tooth", "Loose tooth",
  "Dry mouth", "Mouth sores", "Difficulty chewing", "Difficulty swallowing",
  "Teeth grinding", "Clicking jaw", "Facial swelling", "Gum recession",
];

export default function DoctorDashboard() {
  const { doctor, isLoading, isAuthenticated, logout, isLoggingOut } = useDoctorAuth();
  const [_, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>("appointments");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [filterRowOpen, setFilterRowOpen] = useState(false);
  const [chipsCollapsed, setChipsCollapsed] = useState(() => window.innerWidth < 640);
  const [appointmentClinicFilter, setAppointmentClinicFilter] = useState<string>("all");
  const [appointmentDateFilter, setAppointmentDateFilter] = useState<string>("");
  const [apptSearch, setApptSearch] = useState("");
  const [apptSearchInput, setApptSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(true);
  const apptSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (apptSearchDebounceRef.current) clearTimeout(apptSearchDebounceRef.current);
    apptSearchDebounceRef.current = setTimeout(() => {
      setApptSearch(apptSearchInput.trim());
    }, 300);
    return () => {
      if (apptSearchDebounceRef.current) clearTimeout(apptSearchDebounceRef.current);
    };
  }, [apptSearchInput]);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNotifOpen, setMobileNotifOpen] = useState(false);
  const [heroStatsCollapsed, setHeroStatsCollapsed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const appointmentsSectionRef = useRef<HTMLDivElement>(null);

  const [profName, setProfName] = useState("");
  const [profSpecialization, setProfSpecialization] = useState("");
  const [profDegree, setProfDegree] = useState("");
  const [profCollege, setProfCollege] = useState("");
  const [profBio, setProfBio] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profImageUrl, setProfImageUrl] = useState("");
  const [profYearsExp, setProfYearsExp] = useState<string>("");
  const [profLanguages, setProfLanguages] = useState<string[]>([]);
  const [profUsername, setProfUsername] = useState("");
  const [profileUrlCopied, setProfileUrlCopied] = useState(false);
  const [profUploading, setProfUploading] = useState(false);
  const [profOptimising, setProfOptimising] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [linkCopied, setLinkCopied] = useState(false);
  const [patientModalId, setPatientModalId] = useState<number | null>(null);
  const [dialogExpanded, setDialogExpanded] = useState(false);
  const [patientModalTab, setPatientModalTab] = useState<'overview' | 'notes' | 'diagnosis' | 'prescription' | 'chart'>('overview');
  const [statusDraft, setStatusDraft] = useState("");
  const [pendingNotifNav, setPendingNotifNav] = useState<{ bookingId?: number; notifType?: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const pending = sessionStorage.getItem("pendingNotifNav");
    if (!pending) return null;
    try {
      const detail = JSON.parse(pending);
      if (detail?.bookingId != null) {
        detail.bookingId = Number(detail.bookingId);
      }
      sessionStorage.removeItem("pendingNotifNav");
      return detail;
    } catch {
      sessionStorage.removeItem("pendingNotifNav");
      return null;
    }
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [openedBooking, setOpenedBooking] = useState<any>(null);

  const [certSheetOpen, setCertSheetOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<DoctorCertification | null>(null);
  const [certTitle, setCertTitle] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certYear, setCertYear] = useState("");
  const [certDesc, setCertDesc] = useState("");
  const [certImageUrl, setCertImageUrl] = useState("");

  const [caseSheetOpen, setCaseSheetOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<DoctorCase | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseDesc, setCaseDesc] = useState("");
  const [caseTags, setCaseTags] = useState("");
  const [caseBeforeUrl, setCaseBeforeUrl] = useState("");
  const [caseAfterUrl, setCaseAfterUrl] = useState("");
  const [caseBeforeUploading, setCaseBeforeUploading] = useState(false);
  const [caseAfterUploading, setCaseAfterUploading] = useState(false);
  const [caseBeforeOptimising, setCaseBeforeOptimising] = useState(false);
  const [caseAfterOptimising, setCaseAfterOptimising] = useState(false);
  const caseBeforeInputRef = useRef<HTMLInputElement>(null);
  const caseAfterInputRef = useRef<HTMLInputElement>(null);

  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [changePwdCurrent, setChangePwdCurrent] = useState("");
  const [changePwdNew, setChangePwdNew] = useState("");
  const [changePwdConfirm, setChangePwdConfirm] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/clinic-login?tab=doctor");
  }, [isLoading, isAuthenticated, setLocation]);

  // ── Notification deep-link helpers ────────────────────────────────────────
  const notifTabMap: Record<string, "overview" | "notes" | "diagnosis" | "prescription" | "chart"> = {
    doctor_assigned: "overview",
    patient_checked_in: "overview",
    admin_confirmed: "overview",
    booking_rescheduled: "overview",
    booking_cancelled: "overview",
    patient_no_show: "overview",
    visit_override_completed: "overview",
    patient_left_early: "overview",
    consent_requested: "overview",
    booking_note_added: "notes",
  };

  const applyDoctorNotifNav = (detail: { bookingId?: number; notifType?: string }) => {
    if (detail.bookingId) {
      // The patient modal is at the top level of DoctorDashboard so it opens
      // regardless of which tab is active — no tab switch needed.
      setPatientModalId(detail.bookingId);
      const tab = detail.notifType ? notifTabMap[detail.notifType] : undefined;
      setPatientModalTab(tab ?? "overview");
    }
  };

  // Case A: user already on /doctor-dashboard — custom event fires directly
  useEffect(() => {
    const handler = (e: Event) => {
      applyDoctorNotifNav((e as CustomEvent).detail);
    };
    window.addEventListener("notif-navigate", handler);
    return () => window.removeEventListener("notif-navigate", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Case B: user navigated from a different page — pick up from sessionStorage on mount
  useEffect(() => {
    if (!isAuthenticated || !pendingNotifNav) return;
    applyDoctorNotifNav(pendingNotifNav);
    setPendingNotifNav(null);
  }, [isAuthenticated, pendingNotifNav]);
  // ──────────────────────────────────────────────────────────────────────────

  function slugify(name: string) {
    return "dr-" + name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  useEffect(() => {
    if (doctor) {
      setProfName((doctor as any).name || "");
      setProfSpecialization((doctor as any).specialization || "");
      setProfDegree((doctor as any).degree || "");
      setProfCollege((doctor as any).college || "");
      setProfBio((doctor as any).bio || "");
      setProfPhone((doctor as any).phone || "");
      setProfImageUrl((doctor as any).imageUrl || "");
      setProfYearsExp((doctor as any).yearsOfExperience != null ? String((doctor as any).yearsOfExperience) : "");
      setProfLanguages(Array.isArray((doctor as any).languages) ? (doctor as any).languages : []);
      setProfUsername((doctor as any).username || "");
    }
  }, [doctor]);

  const { data: doctorClinics = [] } = useQuery<Clinic[]>({
    queryKey: ["/api/doctor/clinics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/doctor/clinics");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return [];
        throw new Error("Failed to load doctor clinics");
      }
      return res.json();
    },
    enabled: isAuthenticated && activeTab === "appointments",
    refetchOnMount: "always",
    staleTime: 30_000,
  });

  const bookingsQueryKey = ["/api/auth/clinic/bookings", {
    filter: quickFilter,
    clinicId: appointmentClinicFilter !== "all" ? appointmentClinicFilter : undefined,
    dateFrom: filterDate ? format(filterDate, "yyyy-MM-dd") : undefined,
    dateTo: filterEndDate ? format(filterEndDate, "yyyy-MM-dd") : undefined,
    search: apptSearch || undefined,
  }];

  const {
    data: bookingsInfiniteData,
    isLoading: isBookingsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<BookingsPagedResponse>({
    queryKey: bookingsQueryKey,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ filter: quickFilter, page: String(pageParam), pageSize: '20' });
      if (appointmentClinicFilter !== "all") params.set("clinicId", appointmentClinicFilter);
      if (filterDate) params.set("dateFrom", format(filterDate, "yyyy-MM-dd"));
      if (filterEndDate) params.set("dateTo", format(filterEndDate, "yyyy-MM-dd"));
      if (apptSearch) params.set("search", apptSearch);
      const res = await apiRequest("GET", `/api/auth/clinic/bookings?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1, stats: { todayCount: 0, todayConfirmedCount: 0, upcomingCount: 0, pastCount: 0, thisWeekCount: 0, nextWeekCount: 0, pendingNext7Count: 0, confirmedNext7Count: 0, totalPendingCount: 0, totalAllCount: 0, awaitingApprovalCount: 0 } };
        throw new Error("Failed to fetch bookings");
      }
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: isAuthenticated && activeTab === "appointments",
    refetchOnMount: "always",
    staleTime: 30_000,
  });

  const { data: certifications = [], isLoading: isCertsLoading, isError: isCertsError, refetch: refetchCerts } = useQuery<DoctorCertification[]>({
    queryKey: ["/api/doctor/certifications"],
    enabled: isAuthenticated && activeTab === "certifications",
  });

  const { data: cases = [], isLoading: isCasesLoading, isError: isCasesError, refetch: refetchCases } = useQuery<DoctorCase[]>({
    queryKey: ["/api/doctor/cases"],
    enabled: isAuthenticated && activeTab === "cases",
  });

  const { data: leaves = [], isLoading: isLeavesLoading } = useQuery<DoctorLeave[]>({
    queryKey: ["/api/doctor/leaves"],
    enabled: isAuthenticated && activeTab === "leaves",
  });

  const [leavePickerDate, setLeavePickerDate] = useState<Date | undefined>(undefined);
  const [leaveReason, setLeaveReason] = useState("");
  const [multiMode, setMultiMode] = useState(false);
  const [pendingDates, setPendingDates] = useState<Date[]>([]);
  const [openLeaveMonth, setOpenLeaveMonth] = useState<string | null>(null);
  const [chipsExpanded, setChipsExpanded] = useState(false);

  const changePwdMutation = useMutation({
    mutationFn: async (data: { currentPassword?: string; newPassword: string; confirmPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/doctor/change-password", data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      notify.success("Password changed", { description: "Your password has been updated successfully." });
      setChangePwdOpen(false);
      setChangePwdCurrent("");
      setChangePwdNew("");
      setChangePwdConfirm("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/doctor/me"] });
    },
    onError: (e: any) => notify.apiError(e, "Failed to change password"),
  });

  const addLeaveMutation = useMutation({
    mutationFn: (data: { leaveDate: string; reason?: string }) =>
      apiRequest("POST", "/api/doctor/leaves", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/leaves"] });
      setLeavePickerDate(undefined);
      setLeaveReason("");
      notify.success("Leave marked", { description: "You are marked out of office for that date." });
    },
    onError: () => notify.error("Failed to mark leave"),
  });

  const addLeavesBatchMutation = useMutation({
    mutationFn: async (data: { dates: string[]; reason?: string }) => {
      await Promise.all(
        data.dates.map(leaveDate =>
          apiRequest("POST", "/api/doctor/leaves", { leaveDate, reason: data.reason || undefined })
        )
      );
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/leaves"] });
      setPendingDates([]);
      setLeaveReason("");
      notify.success(`${vars.dates.length} ${vars.dates.length === 1 ? "day" : "days"} marked`, { description: "You are marked out of office for those dates." });
    },
    onError: () => notify.error("Failed to mark some leaves"),
  });

  const removeLeaveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/doctor/leaves/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/leaves"] });
      notify.success("Leave removed");
    },
    onError: () => notify.error("Failed to remove leave"),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/doctor/profile", data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/me"] });
      notify.success("Profile updated", { description: "Your profile has been saved." });
    },
    onError: () => notify.error("Failed to update profile"),
  });

  const createCertMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/doctor/certifications", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/doctor/certifications"] }); closeCertSheet(); },
    onError: () => notify.error("Failed to add certification"),
  });

  const updateCertMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/doctor/certifications/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/doctor/certifications"] }); closeCertSheet(); },
    onError: () => notify.error("Failed to update certification"),
  });

  const deleteCertMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/doctor/certifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/doctor/certifications"] }),
    onError: () => notify.error("Failed to delete certification"),
  });

  const createCaseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/doctor/cases", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/doctor/cases"] }); closeCaseSheet(); },
    onError: () => notify.error("Failed to add case"),
  });

  const updateCaseMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/doctor/cases/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/doctor/cases"] }); closeCaseSheet(); },
    onError: () => notify.error("Failed to update case"),
  });

  const deleteCaseMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/doctor/cases/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/doctor/cases"] }),
    onError: () => notify.error("Failed to delete case"),
  });

  const saveNotesMutation = useMutation({
    mutationFn: ({ id, clinicalStatus }: { id: number; clinicalStatus: string }) =>
      apiRequest("PATCH", `/api/doctor/bookings/${id}/clinical-status`, { clinicalStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      notify.success("Status saved");
    },
    onError: () => notify.error("Failed to save status"),
  });

  const startConsultationMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/doctor/bookings/${id}/start-consultation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      notify.success("Consultation started", { description: "Clinic admin has been notified." });
    },
    onError: () => notify.error("Failed to start consultation"),
  });

  const completeVisitMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/doctor/bookings/${id}/complete-visit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      notify.success("Treatment completed", { description: "Clinic admin has been notified to close the visit." });
    },
    onError: () => notify.error("Failed to mark treatment as complete"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/doctor/bookings/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      notify.success("Appointment accepted", { description: "The appointment is now in your schedule." });
    },
    onError: () => notify.error("Failed to accept appointment"),
  });

  const declineMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/doctor/bookings/${id}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      notify.success("Appointment declined", { description: "The clinic admin has been notified." });
    },
    onError: () => notify.error("Failed to decline appointment"),
  });

  const requestConsentMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/doctor/bookings/${id}/request-consent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      notify.success("Consent link sent", { description: "The patient will receive a WhatsApp message with the consent form link." });
    },
    onError: () => notify.error("Failed to send consent link"),
  });

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      notify.error("Invalid file type", { description: "Please upload a JPG, PNG or WebP image." });
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }
    let fileToUpload = file;
    if (file.size > 1 * 1024 * 1024) {
      setProfOptimising(true);
      try {
        fileToUpload = await compressImage(file, 1 * 1024 * 1024, 1200);
        if (fileToUpload.size > 1 * 1024 * 1024) {
          notify.error("File too large", { description: "Could not compress this image below 1 MB. Please use a smaller photo." });
          if (photoInputRef.current) photoInputRef.current.value = "";
          setProfOptimising(false);
          return;
        }
      } catch {
        notify.error("File too large", { description: "Profile photo must be under 1 MB. Please resize or compress the image." });
        if (photoInputRef.current) photoInputRef.current.value = "";
        setProfOptimising(false);
        return;
      }
      setProfOptimising(false);
    }
    setProfUploading(true);
    try {
      const signedRes = await apiRequest("POST", "/api/uploads/signed-url", { fileName: fileToUpload.name, contentType: fileToUpload.type, fileSize: fileToUpload.size, folder: "doctors" });
      if (!signedRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await signedRes.json();
      const uploadRes = await fetch(uploadUrl, { method: "PUT", body: fileToUpload });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setProfImageUrl(publicUrl);
      // Auto-save the new photo URL to the database immediately
      const saveRes = await apiRequest("PATCH", "/api/doctor/profile", { imageUrl: publicUrl });
      if (saveRes.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/me"] });
        notify.success("Photo saved", { description: "Your profile photo has been updated." });
      } else {
        notify.warning("Photo uploaded", { description: "Click Save Profile to keep this photo." });
      }
    } catch {
      notify.error("Upload failed", { description: "Could not upload photo." });
    } finally {
      setProfUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function toggleLanguage(lang: string) {
    setProfLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  }

  function openNewCert() { setEditingCert(null); setCertTitle(""); setCertIssuer(""); setCertYear(""); setCertDesc(""); setCertImageUrl(""); setCertSheetOpen(true); }
  function openEditCert(c: DoctorCertification) { setEditingCert(c); setCertTitle(c.title); setCertIssuer(c.issuer || ""); setCertYear(c.year || ""); setCertDesc(c.description || ""); setCertImageUrl(c.imageUrl || ""); setCertSheetOpen(true); }
  function closeCertSheet() { setCertSheetOpen(false); setEditingCert(null); }

  function openNewCase() { setEditingCase(null); setCaseTitle(""); setCaseDesc(""); setCaseTags(""); setCaseBeforeUrl(""); setCaseAfterUrl(""); setCaseSheetOpen(true); }
  function openEditCase(c: DoctorCase) {
    setEditingCase(c); setCaseTitle(c.title); setCaseDesc(c.description || "");
    setCaseTags(((c.tags as string[]) || []).join(", "));
    const media = (c.mediaUrls as string[]) || [];
    setCaseBeforeUrl(media[0] || ""); setCaseAfterUrl(media[1] || "");
    setCaseSheetOpen(true);
  }
  function closeCaseSheet() { setCaseSheetOpen(false); setEditingCase(null); }

  async function handleCaseMediaUpload(slot: "before" | "after", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const setUploading = slot === "before" ? setCaseBeforeUploading : setCaseAfterUploading;
    const setUrl = slot === "before" ? setCaseBeforeUrl : setCaseAfterUrl;
    const ref = slot === "before" ? caseBeforeInputRef : caseAfterInputRef;
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      notify.error("Invalid file type", { description: "Please upload a JPG, PNG or WebP image." });
      if (ref.current) ref.current.value = "";
      return;
    }
    const setOptimising = slot === "before" ? setCaseBeforeOptimising : setCaseAfterOptimising;
    let fileToUpload = file;
    if (file.size > 3 * 1024 * 1024) {
      setOptimising(true);
      try {
        fileToUpload = await compressImage(file, 3 * 1024 * 1024, 2000);
        if (fileToUpload.size > 3 * 1024 * 1024) {
          notify.error("File too large", { description: "Could not compress this image below 3 MB. Please use a smaller photo." });
          if (ref.current) ref.current.value = "";
          setOptimising(false);
          return;
        }
      } catch {
        notify.error("File too large", { description: "Case photo must be under 3 MB. Please resize or compress the image." });
        if (ref.current) ref.current.value = "";
        setOptimising(false);
        return;
      }
      setOptimising(false);
    }
    setUploading(true);
    try {
      const signedRes = await apiRequest("POST", "/api/uploads/signed-url", { fileName: fileToUpload.name, contentType: fileToUpload.type, fileSize: fileToUpload.size, folder: "case-media" });
      if (!signedRes.ok) throw new Error();
      const { uploadUrl, publicUrl } = await signedRes.json();
      const uploadRes = await fetch(uploadUrl, { method: "PUT", body: fileToUpload });
      if (!uploadRes.ok) throw new Error();
      setUrl(publicUrl);
      notify.success(`${slot === "before" ? "Before" : "After"} photo uploaded`);
    } catch {
      notify.error("Upload failed", { description: "Could not upload photo." });
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  function saveCert() {
    const payload = { title: certTitle, issuer: certIssuer || null, year: certYear || null, description: certDesc || null, imageUrl: certImageUrl || null };
    if (editingCert) updateCertMutation.mutate({ id: editingCert.id, ...payload });
    else createCertMutation.mutate(payload);
  }

  function saveCase() {
    const tags = caseTags.split(",").map(t => t.trim()).filter(Boolean);
    const mediaUrls = [caseBeforeUrl, caseAfterUrl].filter(Boolean);
    const payload = { title: caseTitle, description: caseDesc || null, tags, mediaUrls };
    if (editingCase) updateCaseMutation.mutate({ id: editingCase.id, ...payload });
    else createCaseMutation.mutate(payload);
  }

  function copyProfileLink() {
    if (!doctor) return;
    const url = `${window.location.origin}/doctor/${(doctor as any).username || (doctor as any).id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      notify.success("Copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2500);
    });
  }

  const displayBookings = useMemo(() => bookingsInfiniteData?.pages.flatMap(p => p.data) ?? [], [bookingsInfiniteData]);

  // ── Focus-fetch: load the specific booking from a notification when it isn't
  //    in the currently-filtered displayBookings list (e.g. doctor is on "Today"
  //    filter but notification is for a past/upcoming booking).
  const isDoctorFocusInList = useMemo(
    () => displayBookings.some((b: any) => b.id === patientModalId),
    [displayBookings, patientModalId],
  );
  const { data: doctorFocusBooking = null } = useQuery<any>({
    queryKey: ["/api/auth/clinic/bookings", patientModalId, "doctor-focus"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/auth/clinic/bookings/${patientModalId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!patientModalId && isAuthenticated && !isDoctorFocusInList,
    staleTime: 60_000,
  });

  const bookingStats = bookingsInfiniteData?.pages[0]?.stats;

  const awaitingApprovalCount = bookingStats?.awaitingApprovalCount ?? 0;
  const todayBookingsCount    = bookingStats?.todayCount ?? 0;
  const upcomingBookingsCount = bookingStats?.upcomingCount ?? 0;
  const confirmedAllCount     = bookingStats?.totalAllCount ?? 0;
  const ownedCount            = bookingStats?.totalOwnedCount ?? 0;

  const todayStr    = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayStart  = useMemo(() => startOfDay(new Date()), []);
  const statNext7DaysEnd = useMemo(() => addDays(todayStart, 7), [todayStart]);

  const pendingNext7Count    = bookingStats?.pendingNext7Count    ?? 0;
  const confirmedNext7Count  = bookingStats?.confirmedNext7Count  ?? 0;
  const thisWeekCount        = bookingStats?.thisWeekCount        ?? 0;
  const nextWeekCount        = bookingStats?.nextWeekCount        ?? 0;

  const thisWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const thisWeekEnd   = useMemo(() => endOfWeek(new Date(),   { weekStartsOn: 1 }), []);
  const nextWeekStart = useMemo(() => startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), []);
  const nextWeekEnd   = useMemo(() => endOfWeek(addWeeks(new Date(), 1),   { weekStartsOn: 1 }), []);

  const handleQuickFilter = (f: QuickFilter) => { setQuickFilter(f); setFilterDate(undefined); setFilterEndDate(undefined); };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b border-border/50 bg-card px-6 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-xl border border-border/50 p-4 space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-28 rounded-lg" />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="rounded-xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3.5 w-32" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-7 flex-1 rounded-md" />
                    <Skeleton className="h-7 flex-1 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!doctor) return null;

  const greet = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";

  const NAV_ITEMS = [
    { key: "appointments"  as Tab, label: "Appointments",     subtitle: "Today's schedule",       icon: Calendar,    activeClass: "bg-primary/10 border-primary/20 text-primary",                                    iconClass: "bg-primary/10 border-primary/20 text-primary",              dotClass: "bg-primary" },
    { key: "leaves"        as Tab, label: "Leave Management", subtitle: "Time off & availability", icon: CalendarOff, activeClass: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",         iconClass: "bg-amber-500/10 border-amber-500/20 text-amber-600",        dotClass: "bg-amber-500" },
    { key: "profile"       as Tab, label: "My Profile",       subtitle: "Edit your details",      icon: User,        activeClass: "bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-400",     iconClass: "bg-violet-500/10 border-violet-500/20 text-violet-600",     dotClass: "bg-violet-500" },
    { key: "cases"         as Tab, label: "Case Studies",     subtitle: "Patient cases",          icon: BookOpen,    activeClass: "bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-400",             iconClass: "bg-teal-500/10 border-teal-500/20 text-teal-600",          dotClass: "bg-teal-500" },
    { key: "certifications"as Tab, label: "Certifications",   subtitle: "Degrees & awards",       icon: Award,       activeClass: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",             iconClass: "bg-blue-500/10 border-blue-500/20 text-blue-600",           dotClass: "bg-blue-500" },
    { key: "xray"          as Tab, label: "Analyse X-Ray",    subtitle: "AI dental findings",     icon: Microscope,  activeClass: "bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-400",     iconClass: "bg-violet-500/10 border-violet-500/20 text-violet-600",     dotClass: "bg-violet-500" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">


      {/* ═══ MOBILE STICKY TOP BAR ═══ */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-2 gap-1 bg-background/90 backdrop-blur-[18px] border-b border-black/[0.06] dark:border-white/[0.06] shadow-sm">
        {/* Hamburger */}
        <button
          onClick={() => setMobileNavOpen(true)}
          className="h-11 w-11 flex items-center justify-center rounded-xl text-foreground hover:bg-muted/60 active:scale-95 transition-all"
          aria-label="Open navigation"
          data-testid="btn-mobile-hamburger"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* App branding */}
        <div className="flex-1 min-w-0 pl-1">
          <p className="text-[18px] font-bold text-foreground leading-none tracking-tight">
            book<span className="text-primary">My</span>Slot
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary leading-none mt-px">
            Dental
          </p>
        </div>

        {/* Notification bell */}
        <button
          onClick={() => setMobileNotifOpen(true)}
          className="h-11 w-11 flex items-center justify-center rounded-xl text-foreground hover:bg-muted/60 active:scale-95 transition-all relative"
          aria-label="Notifications"
          data-testid="btn-mobile-notifications"
        >
          <Bell className="h-5 w-5" />
          {awaitingApprovalCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {awaitingApprovalCount > 99 ? '99+' : awaitingApprovalCount}
            </span>
          )}
        </button>

        {/* Profile avatar */}
        <button
          onClick={() => setActiveTab("profile")}
          className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-muted/60 active:scale-95 transition-all"
          aria-label="Profile"
          data-testid="btn-mobile-profile"
        >
          <Avatar className="h-7 w-7 ring-2 ring-primary/20">
            <AvatarImage src={(doctor as any).imageUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {(doctor as any).name?.charAt(0) || "D"}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>

      {/* ═══ PAGE CONTAINER ═══ */}
      <div className="w-full px-4 pt-14 pb-6 sm:px-6 lg:px-8 2xl:px-16 lg:pt-6 lg:pb-0">

      {/* ═══ TEMPORARY PASSWORD BANNER ═══ */}
      {(doctor as any).isDefaultPassword && !bannerDismissed && (
        <div className="mb-3 bg-amber-500 text-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p className="text-xs font-medium flex-1 min-w-0 leading-snug">
            <span className="hidden sm:inline">You are using a temporary password. Please change it to keep your account secure.</span>
            <span className="sm:hidden">Using a temporary password — update it.</span>
          </p>
          <button
            onClick={() => setChangePwdOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 active:bg-white/40 border border-white/40 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
            data-testid="btn-banner-change-password"
          >
            <KeyRound className="h-3 w-3" />
            <span className="hidden sm:inline">Change Password</span>
            <span className="sm:hidden">Update</span>
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss banner"
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 active:bg-white/30 transition-colors"
            data-testid="btn-banner-dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ═══ COMPACT HERO + STATS ═══ */}

      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden shadow-2xl mb-4 sm:mb-8 border border-white/10">
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />
        <div className="relative bg-gradient-to-br from-[#052B22] via-[#085041] to-[#0A5540] px-4 py-2.5 sm:px-7 sm:py-6 overflow-hidden">

          {/* Grid texture — reduced on mobile */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.02] sm:opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/20 blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-16 -right-8 w-60 h-60 rounded-full bg-accent/15 blur-[80px] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.07)_0%,transparent_60%)] pointer-events-none" />

          {/* Mobile: row, left-aligned. Desktop: row, space-between. */}
          <div className="relative flex flex-row items-start justify-between gap-3 sm:gap-4">

            {/* Identity: avatar + name + badges */}
            <div className="flex items-center gap-2.5 sm:gap-5 min-w-0 flex-1">
              {/* Avatar — slightly smaller on mobile */}
              <Avatar className="h-10 w-10 sm:h-16 sm:w-16 ring-2 ring-white/30 shadow-md shrink-0">
                <AvatarImage src={(doctor as any).imageUrl || undefined} />
                <AvatarFallback className="bg-white/20 text-white font-bold text-sm sm:text-xl">
                  {(doctor as any).name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {/* Hide greeting on mobile, show on sm+ */}
                <p className="hidden sm:block text-xs text-white/50 font-medium mb-0.5">Good {greet},</p>
                <h1 className="text-sm sm:text-3xl font-extrabold text-white tracking-tight leading-tight truncate">
                  Dr. {(doctor as any).name}
                </h1>
                {/* Compact metadata row on mobile */}
                <div className="flex items-center gap-1.5 mt-1 sm:mt-2.5 flex-wrap">
                  {(doctor as any).specialization && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full">
                      <Stethoscope className="h-3 w-3" />
                      {(doctor as any).specialization}
                    </span>
                  )}
                  <span className="sm:hidden inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 bg-white/10 border border-white/20 px-1.5 py-px rounded-full">
                    <Stethoscope className="h-2.5 w-2.5" />
                    {(doctor as any).specialization || "Doctor"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-400/10 border border-emerald-400/25 px-1.5 sm:px-2.5 py-px sm:py-1 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Live
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-white/50 bg-white/[0.06] border border-white/15 px-2.5 py-1 rounded-full">
                    <Building2 className="h-3 w-3" />
                    {(doctor as any).clinicName}
                  </span>
                </div>
              </div>
            </div>

            {/* Sign out — desktop only inside hero */}
            <button
              onClick={async () => { await logout(); setLocation("/clinic-login?tab=doctor"); }}
              disabled={isLoggingOut}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white/90 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all active:scale-[0.97] shrink-0"
            >
              {isLoggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Sign Out
            </button>
          </div>

          {/* ── Desktop embedded stats (hidden on mobile) ── */}
          <div className="hidden sm:block relative mt-5">
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
            <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: "Confirmed Appointments Today",                    shortLabel: "Confirmed Appointments",  subTag: "Today",                                    filter: "today" as QuickFilter,           tooltip: "Appointments assigned to you today that have been confirmed.",                                                   count: todayBookingsCount,    Icon: Calendar,      text: "text-sky-300",     bg: "bg-sky-400/10",     border: "border-sky-400/20" },
              { label: "Confirmed Appointments (Next 7 Days)",            shortLabel: "Confirmed Appointments",  subTag: "Coming in Next 7 Days",             filter: "confirmed-7days" as QuickFilter, tooltip: "Appointments assigned to you in the next 7 days that are confirmed and locked in.",                               count: confirmedNext7Count,   Icon: CheckCircle2,  text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
              { label: "Pending Appointment Confirmation (Next 7 Days)",  shortLabel: "Pending Confirmation",    subTag: "Next 7 Days · Awaiting Confirmation", filter: "pending-7days" as QuickFilter,   tooltip: "Appointments in the next 7 days that are still waiting for your approval. These need your attention.",          count: pendingNext7Count,     Icon: Clock,         text: "text-amber-300",   bg: "bg-amber-400/10",   border: "border-amber-400/20" },
              { label: "All Pending Appointment Confirmations",           shortLabel: "Pending Confirmations",   subTag: "All · Awaiting Confirmation",       filter: "awaiting" as QuickFilter,        tooltip: "Total appointments assigned to you that are still awaiting your approval — across all dates.",                 count: awaitingApprovalCount, Icon: TrendingUp,    text: "text-rose-300",    bg: "bg-rose-400/10",    border: "border-rose-400/20" },
            ].map(({ label, shortLabel, subTag, filter, tooltip, count, Icon, text, bg, border }) => (
              <TooltipProvider key={label} delayDuration={700}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-start gap-2 px-2.5 py-3 rounded-xl border bg-white/[0.04] ${border} cursor-pointer transition-all hover:bg-white/[0.09] hover:scale-[1.02] active:scale-[0.98] min-h-[44px] ${quickFilter === filter ? 'ring-1 ring-white/50 bg-white/[0.09]' : ''}`}
                      onClick={() => {
                        setActiveTab("appointments");
                        handleQuickFilter(filter);
                        setTimeout(() => appointmentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
                      }}
                      data-testid={`stat-card-${filter}`}
                    >
                      <div className={`shrink-0 ${text} ${bg} p-1.5 rounded-lg mt-0.5`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-extrabold text-white leading-none tabular-nums">{count}</p>
                        <p className={`text-xs font-semibold mt-1 ${text} leading-snug`}>{shortLabel}</p>
                        {subTag && (
                          <span className={`block text-xs font-medium ${text} opacity-60 mt-0.5 leading-none truncate`}>{subTag}</span>
                        )}
                      </div>
                      <Info className={`h-3 w-3 ${text} ${quickFilter === filter ? 'opacity-80' : 'opacity-50'} shrink-0 mt-1`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            </div>
            )}
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-accent via-primary to-accent opacity-60" />
      </div>

      {/* ═══ APPOINTMENTS SECTION HEADER + STATS (mobile-only, appointments tab) ═══ */}
      {activeTab === "appointments" && (
        <>
          {/* Mobile panel header */}
          <div className="sm:hidden mb-3">
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-primary/60 shrink-0" />
                <div className="flex-1 px-4 py-3 bg-gradient-to-r from-primary/[0.06] to-transparent flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Calendar className="h-[16px] w-[16px] text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight">Appointments</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Your confirmed appointments across all clinics.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile quick stats */}
          <div className="sm:hidden mb-5">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Stats</p>
                <p className="text-[10px] text-muted-foreground/70 leading-none mt-0.5">Appointment Confirmation Status</p>
              </div>
              <button
                onClick={() => setHeroStatsCollapsed(s => !s)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-all active:scale-[0.97] shrink-0 motion-reduce:transition-none"
                title={heroStatsCollapsed ? "Show stats" : "Hide stats"}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${heroStatsCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </div>
            {!heroStatsCollapsed && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Confirmed",  subTag: "Today",                  filter: "today" as QuickFilter,           tooltip: "Appointments assigned to you today that have been confirmed.",                                        count: todayBookingsCount,    Icon: Calendar,     text: "text-sky-600",     bg: "bg-sky-50",     border: "border-sky-200",     darkText: "dark:text-sky-400",     darkBg: "dark:bg-sky-950/20",     darkBorder: "dark:border-sky-800" },
                  { label: "Confirmed",  subTag: "In Coming 7 Days",       filter: "confirmed-7days" as QuickFilter, tooltip: "Appointments assigned to you in the next 7 days that are confirmed and locked in.",               count: confirmedNext7Count,   Icon: CheckCircle2, text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", darkText: "dark:text-emerald-400", darkBg: "dark:bg-emerald-950/20", darkBorder: "dark:border-emerald-800" },
                  { label: "Pending",    subTag: "Next 7 Days · Awaiting", filter: "pending-7days" as QuickFilter,   tooltip: "Appointments in the next 7 days that are still waiting for your approval. These need your attention.", count: pendingNext7Count,     Icon: Clock,        text: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   darkText: "dark:text-amber-400",   darkBg: "dark:bg-amber-950/20",   darkBorder: "dark:border-amber-800" },
                  { label: "Pending",    subTag: "All",                    filter: "awaiting" as QuickFilter,        tooltip: "Total appointments assigned to you that are still awaiting your approval — across all dates.",    count: awaitingApprovalCount, Icon: TrendingUp,   text: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200",    darkText: "dark:text-rose-400",    darkBg: "dark:bg-rose-950/20",    darkBorder: "dark:border-rose-800" },
                ].map(({ label, subTag, filter, tooltip, count, Icon, text, bg, border, darkText, darkBg, darkBorder }) => (
                  <TooltipProvider key={label} delayDuration={700}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex flex-col gap-1 px-3 py-2 rounded-xl border bg-card ${border} ${darkBorder} cursor-pointer transition-all hover:bg-muted/40 hover:scale-[1.02] active:scale-[0.98] ${quickFilter === filter ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}
                          onClick={() => {
                            setActiveTab("appointments");
                            handleQuickFilter(filter);
                            setTimeout(() => appointmentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
                          }}
                          data-testid={`stat-card-${filter}`}
                        >
                          {/* Single row: icon + label (ellipsis) + count + info */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`shrink-0 ${text} ${darkText} ${bg} ${darkBg} p-1 rounded-md`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <p className={`text-xs font-semibold ${text} ${darkText} min-w-0 truncate`}>{label}</p>
                            <p className="text-lg font-extrabold text-foreground leading-none tabular-nums ml-auto shrink-0">
                              {count}
                            </p>
                            <Info className={`h-3 w-3 ${text} ${darkText} ${quickFilter === filter ? 'opacity-80' : 'opacity-40'} shrink-0`} />
                          </div>
                          {subTag && (
                            <span className="text-[10px] font-medium text-muted-foreground leading-none truncate block">{subTag}</span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs">
                        {tooltip}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

        {/* ── LEFT SIDEBAR (desktop only) ── */}
        <aside className="hidden lg:flex lg:flex-col lg:w-60 shrink-0 lg:sticky lg:top-[70px] space-y-3">

          {/* Navigation */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="p-2 space-y-0.5">
            {NAV_ITEMS.map(({ key, label, subtitle, icon: Icon, activeClass, iconClass, dotClass }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${isActive ? `${activeClass} border border-current/20` : "border border-transparent hover:bg-muted/50"}`}
                  data-testid={`nav-${key}`}
                >
                  <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${isActive ? iconClass : "bg-muted/50 border-border/50"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                  </div>
                  {isActive && <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />}
                  {key === "appointments" && awaitingApprovalCount > 0 && !isActive && (
                    <span className="text-xs font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none shrink-0">{awaitingApprovalCount}</span>
                  )}
                </button>
              );
            })}
            </div>
          </div>

          {/* Scan & Share */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-3 pt-3 pb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scan &amp; Share</p>
            </div>
            <div className="px-3 pb-3 flex flex-col items-center gap-3">
              {/* QR Code */}
              <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-muted/20 p-3 border border-border/40 shadow-inner w-full flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none rounded-2xl" />
                <QRCode
                  value={`${window.location.origin}/doctor/${(doctor as any).username || (doctor as any).id}`}
                  size={120}
                  level="M"
                  fgColor="#085041"
                  bgColor="#ffffff"
                  style={{ display: "block" }}
                />
              </div>
              {/* Label */}
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                Patients scan to view your profile
              </p>
              {/* URL row */}
              <div className="w-full rounded-xl border border-border/50 bg-muted/30 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Profile URL</p>
                    <p className="text-xs text-foreground truncate font-mono mt-0.5">/doctor/{(doctor as any).username || (doctor as any).id}</p>
                  </div>
                  <button
                    onClick={copyProfileLink}
                    data-testid="button-share-profile"
                    title="Copy profile URL"
                    className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200
                      ${linkCopied
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5'}`}
                  >
                    {linkCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0">

          {/* ─────────────── APPOINTMENTS ─────────────── */}
          {activeTab === "appointments" && (
            <>
              <div className="space-y-5" ref={appointmentsSectionRef}>

              {/* Panel header — desktop only (mobile header lives above stats) */}
              <div className="hidden sm:block rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <div className="flex">
                  <div className="w-1.5 bg-primary/60 shrink-0" />
                  <div className="flex-1 px-5 py-4 bg-gradient-to-r from-primary/[0.06] to-transparent flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Calendar className="h-[18px] w-[18px] text-primary" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">Appointments</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Your confirmed appointments across all clinics.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Awaiting approval banner — shown above stat cards so it's the first thing seen */}
              {awaitingApprovalCount > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/40 px-4 py-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 leading-tight">
                      {awaitingApprovalCount} appointment{awaitingApprovalCount !== 1 ? "s" : ""} awaiting your approval
                    </p>
                    <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-0.5">Review and accept or decline before they expire.</p>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                    onClick={() => handleQuickFilter("awaiting")}
                    data-testid="button-view-awaiting"
                  >
                    Review <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}

              {/* Quick-filter chips */}
              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2">
                {!chipsCollapsed && (
                <div className="flex flex-wrap gap-1.5 w-full order-2 sm:contents">
                {/* Today */}
                <button
                  onClick={() => { setActiveTab("appointments"); handleQuickFilter("today"); }}
                  className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
                    quickFilter === "today"
                      ? "bg-sky-500/10 border-sky-400/50 text-sky-700 dark:text-sky-400"
                      : "bg-transparent border-sky-400/30 text-muted-foreground hover:bg-sky-500/8 hover:text-sky-700 dark:hover:text-sky-400"
                  }`}
                  data-testid="chip-filter-today"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Today</span>
                  </span>
                  <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
                    quickFilter === "today" ? "bg-sky-500/15 text-sky-700 dark:text-sky-400" : "bg-muted text-muted-foreground"
                  }`}>{todayBookingsCount}</span>
                </button>

                {/* Upcoming */}
                <button
                  onClick={() => { setActiveTab("appointments"); handleQuickFilter("upcoming"); }}
                  className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
                    quickFilter === "upcoming"
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-transparent border-primary/30 text-muted-foreground hover:bg-primary/8 hover:text-primary"
                  }`}
                  data-testid="chip-filter-upcoming"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Upcoming</span>
                  </span>
                  <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
                    quickFilter === "upcoming" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}>{upcomingBookingsCount}</span>
                </button>

                {/* Awaiting */}
                <button
                  onClick={() => { setActiveTab("appointments"); handleQuickFilter("awaiting"); }}
                  className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
                    quickFilter === "awaiting"
                      ? "bg-amber-500/10 border-amber-400/50 text-amber-700 dark:text-amber-400"
                      : "bg-transparent border-amber-400/30 text-muted-foreground hover:bg-amber-500/8 hover:text-amber-700 dark:hover:text-amber-400"
                  }`}
                  data-testid="chip-filter-awaiting"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Awaiting</span>
                  </span>
                  <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
                    quickFilter === "awaiting" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"
                  }`}>{awaitingApprovalCount}</span>
                </button>

                {/* All Appointments */}
                <button
                  onClick={() => { setActiveTab("appointments"); handleQuickFilter("all"); }}
                  className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
                    quickFilter === "all"
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-transparent border-primary/30 text-muted-foreground hover:bg-primary/8 hover:text-primary"
                  }`}
                  data-testid="chip-filter-all"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">All Appointments</span>
                  </span>
                  <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
                    quickFilter === "all" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}>{confirmedAllCount}</span>
                </button>

                {/* All Owned */}
                <button
                  onClick={() => { setActiveTab("appointments"); handleQuickFilter("owned"); }}
                  className={`w-[calc(50%-3px)] sm:w-auto flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${
                    quickFilter === "owned"
                      ? "bg-teal-500/10 border-teal-400/50 text-teal-700 dark:text-teal-400"
                      : "bg-transparent border-teal-400/30 text-muted-foreground hover:bg-teal-500/8 hover:text-teal-700 dark:hover:text-teal-400"
                  }`}
                  data-testid="chip-filter-owned"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">All Owned</span>
                  </span>
                  <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center shrink-0 ${
                    quickFilter === "owned" ? "bg-teal-500/15 text-teal-700 dark:text-teal-400" : "bg-muted text-muted-foreground"
                  }`}>{ownedCount}</span>
                </button>
                </div>)}

                {/* Patient search — collapsed magnifier or expanded input */}
                {searchOpen ? (
                  <div className="flex items-center gap-2 bg-card border border-border/50 hover:border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 rounded-xl px-3 min-h-[44px] shadow-sm transition-all flex-1 min-w-[160px]">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={apptSearchInput}
                      onChange={(e) => setApptSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setApptSearchInput("");
                          setApptSearch("");
                          setSearchOpen(false);
                          searchInputRef.current?.blur();
                        }
                      }}
                      placeholder="Search by patient name, phone or email…"
                      className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/55 outline-none border-none focus:ring-0 h-5 leading-none"
                      data-testid="input-appointment-search"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setApptSearchInput("");
                        setApptSearch("");
                        setSearchOpen(false);
                      }}
                      className="shrink-0 -mr-1 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      title="Close search"
                      data-testid="button-clear-appointment-search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                    className="h-11 w-11 rounded-xl border bg-muted/50 border-border flex items-center justify-center hover:border-primary/40 hover:text-primary transition-all active:scale-[0.97] shrink-0"
                    data-testid="button-open-appointment-search"
                    title="Search patient"
                  >
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}

                {/* Filter row toggle — only visible when row is collapsed */}
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

                {/* Chip visibility toggle */}
                <button
                  onClick={() => setChipsCollapsed(c => !c)}
                  className={`h-11 w-11 rounded-xl border flex items-center justify-center transition-all active:scale-[0.97] shrink-0 ${
                    chipsCollapsed
                      ? 'bg-muted/50 border-border hover:border-primary/40 hover:text-primary'
                      : 'bg-primary/10 border-primary/40 text-primary'
                  }`}
                  data-testid="button-toggle-chips"
                  title={chipsCollapsed ? "Show filter chips" : "Hide filter chips"}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>

              {/* Date range + Quick week — collapsible filter row */}
              {filterRowOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 bg-card border border-border/50 rounded-xl px-3 py-3 shadow-sm">

                  {/* Desktop-only: icon + label */}
                  <div className="hidden sm:flex sm:flex-none items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground shrink-0">Date range:</span>
                  </div>

                  {/* Mobile row 1: Start + End + × inline | Desktop: flow naturally via sm:contents */}
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
                          <Calendar className="h-3 w-3 mr-1.5 shrink-0" />
                          {filterDate ? format(filterDate, "MMM d") : "Start"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                        <CalendarPicker mode="single" selected={filterDate} onSelect={(d) => { setQuickFilter('all'); setFilterDate(d); }} initialFocus />
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
                          <Calendar className="h-3 w-3 mr-1.5 shrink-0" />
                          {filterEndDate ? format(filterEndDate, "MMM d") : "End"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                        <CalendarPicker mode="single" selected={filterEndDate} onSelect={(d) => { setQuickFilter('all'); setFilterEndDate(d); }} initialFocus />
                      </PopoverContent>
                    </Popover>

                    {/* Close × — mobile only, inline after End picker */}
                    <button
                      onClick={() => setFilterRowOpen(false)}
                      className="sm:hidden h-11 w-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-all active:scale-[0.97] shrink-0"
                      data-testid="button-close-filter-row"
                      title="Hide filters"
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

                  {/* Mobile row 2: This Week + Next Week side-by-side | Desktop: inline */}
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
                            <Calendar className="h-3 w-3 shrink-0" />
                            This Week
                            <span className={`text-xs font-bold px-1 py-0.5 rounded-full ${quickFilter === 'this-week' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-400' : 'bg-violet-500/10 text-violet-600'}`}>
                              {thisWeekCount}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                          Appointments within the current Mon–Sun week
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
                          Appointments within next Mon–Sun week
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

                  {/* Desktop-only divider before clinic select */}
                  <div className="hidden sm:block w-px h-4 bg-border/40 mx-0.5 shrink-0" />

                  {/* All Clinics — full-width on mobile, fixed-width on desktop */}
                  <Select value={appointmentClinicFilter} onValueChange={setAppointmentClinicFilter}>
                    <SelectTrigger className="h-11 w-full sm:w-[170px] text-xs rounded-xl" data-testid="select-clinic-filter"><SelectValue placeholder="All Clinics" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clinics</SelectItem>
                      {doctorClinics.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* Close — desktop only, far right */}
                  <div className="hidden sm:flex sm:ml-auto">
                    <button
                      onClick={() => setFilterRowOpen(false)}
                      className="h-11 w-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-all active:scale-[0.97] shrink-0"
                      title="Hide filters"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic section heading — dark green gradient, attached to cards (BookingsPanel style) */}
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-primary to-accent px-5 py-4 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {quickFilter === "today"             ? "Today's Appointments"
                       : quickFilter === "upcoming"        ? "Upcoming Appointments"
                       : quickFilter === "owned"           ? "All Owned Appointments"
                       : quickFilter === "awaiting"        ? "All Pending Bookings"
                       : quickFilter === "confirmed-7days" ? "Confirmed Bookings (Next 7 Days)"
                       : quickFilter === "pending-7days"   ? "Pending Confirmations (Next 7 Days)"
                       : quickFilter === "this-week"       ? "This Week's Appointments"
                       : quickFilter === "next-week"       ? "Next Week's Appointments"
                       : filterDate                        ? "Filtered Appointments"
                       : "All Appointments"}
                    </h2>
                    <p className="text-white/70 text-xs mt-0.5">
                      <span className="tabular-nums font-semibold">{bookingsInfiniteData?.pages[0]?.total ?? 0}</span>{" "}
                      {(bookingsInfiniteData?.pages[0]?.total ?? 0) === 1 ? "appointment" : "appointments"}{" · "}
                      {quickFilter === "today"             ? "Appointments assigned to you today"
                       : quickFilter === "upcoming"        ? "Future appointments beyond today"
                       : quickFilter === "owned"           ? "Only appointments you've confirmed or accepted"
                       : quickFilter === "awaiting"        ? "All unconfirmed bookings across all dates"
                       : quickFilter === "confirmed-7days" ? "Confirmed appointments in the next 7 days"
                       : quickFilter === "pending-7days"   ? "Pending confirmations in the next 7 days"
                       : quickFilter === "this-week"       ? "Appointments within the current Mon–Sun week"
                       : quickFilter === "next-week"       ? "Appointments within next Mon–Sun week"
                       : filterDate                        ? "Showing custom date range"
                       : "All your patient appointments"}
                    </p>
                  </div>
                </div>
                <div className="p-5 space-y-5">
                {isBookingsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="rounded-xl border border-border/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-36" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Skeleton className="h-7 flex-1 rounded-md" />
                          <Skeleton className="h-7 flex-1 rounded-md" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayBookings.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {displayBookings.map((booking: any) => {
                      const startTime = booking.slot?.startTime ? new Date(booking.slot.startTime) : null;
                      const endTime = booking.slot?.endTime ? new Date(booking.slot.endTime) : null;
                      const durationMin = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null;
                      const clinicName = booking.clinic?.name || booking.clinicName || doctorClinics.find((c: any) => c.id === booking.clinicId)?.name || "Clinic";
                      const clinicAddress = booking.clinic?.address || (doctorClinics.find((c: any) => c.id === booking.clinicId) as any)?.address;
                      const bookingDateStr = startTime ? startTime.toISOString().split("T")[0] : "";
                      const isApptToday = bookingDateStr === todayStr;
                      const isApptPast = startTime ? startTime < new Date(new Date().setHours(0, 0, 0, 0)) && !isApptToday : false;
                      const isApptConfirmed = booking.doctorApprovalStatus === 'approved' || booking.doctorApprovalStatus === 'admin_confirmed';
                      const isApptCancelled = booking.verificationStatus === 'cancelled';
                      const clinicCity = clinicAddress ? clinicAddress.split(',').at(-1)?.trim() : null;

                      const apptAccentBar = isApptToday
                        ? "bg-gradient-to-r from-sky-400 to-cyan-400"
                        : isApptPast
                        ? "bg-gradient-to-r from-slate-400 to-slate-300"
                        : "bg-gradient-to-r from-primary to-accent";
                      const apptHeaderBg = isApptToday
                        ? "bg-gradient-to-r from-sky-500/8 to-cyan-500/5"
                        : isApptPast
                        ? "bg-muted/30"
                        : "bg-gradient-to-r from-primary/5 to-accent/5";
                      const apptLeftBorder = isApptCancelled
                        ? "border-l-2 border-l-rose-400 dark:border-l-rose-500"
                        : isApptConfirmed
                        ? "border-l-2 border-l-emerald-400 dark:border-l-emerald-500"
                        : "border-l-2 border-l-amber-400 dark:border-l-amber-500";
                      const apptTimeLabel = isApptToday ? "Today" : isApptPast ? "Past" : "Upcoming";
                      const apptTimeClass = isApptToday
                        ? "text-sky-600 bg-sky-500/10 border-sky-500/25 dark:text-sky-400 dark:bg-sky-400/10 dark:border-sky-500/30"
                        : isApptPast
                        ? "text-muted-foreground bg-muted/50 border-border/50"
                        : "text-primary bg-primary/10 border-primary/25";
                      const apptStatusLabel = isApptCancelled ? "Cancelled" : isApptConfirmed ? "Confirmed" : "Pending";
                      const apptStatusClass = isApptCancelled
                        ? "text-rose-600 bg-rose-500/10 border-rose-500/25 dark:text-rose-400 dark:bg-rose-400/10 dark:border-rose-500/30"
                        : isApptConfirmed
                        ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-500/30"
                        : "text-amber-600 bg-amber-500/10 border-amber-500/25 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-500/30";
                      return (
                        <AppointmentCard
                          key={booking.id}
                          role="doctor"
                          booking={booking}
                          bookingNumber={String(booking.id).padStart(4, '0')}
                          complaints={(() => {
                            const raw = booking.description ?? "";
                            const stripped = raw.replace(/Category:\s*[^|]+(\|)?/gi, "").replace(/Visit:\s*[^|]+(\|)?/gi, "").trim();
                            return stripped ? stripped.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean) : [];
                          })()}
                          clinicName={clinicName}
                          clinicCity={clinicCity ?? undefined}
                          onCardClick={() => { setOpenedBooking(booking); setPatientModalId(booking.id); setPatientModalTab('overview'); setStatusDraft(booking.clinicalStatus || ""); }}
                          onApprove={() => approveMutation.mutate(booking.id)}
                          onDecline={() => declineMutation.mutate(booking.id)}
                          onOpenNotes={() => { setPatientModalId(booking.id); setPatientModalTab('notes'); setStatusDraft(booking.clinicalStatus || ""); }}
                          onOpenRecords={() => { setPatientModalId(booking.id); setPatientModalTab('notes'); setStatusDraft(booking.clinicalStatus || ""); }}
                          approvePending={approveMutation.isPending && (approveMutation.variables as number) === booking.id}
                          declinePending={declineMutation.isPending && (declineMutation.variables as number) === booking.id}
                          onStartConsultation={() => startConsultationMutation.mutate(booking.id)}
                          startConsultPending={startConsultationMutation.isPending}
                          onDoctorCompleteVisit={() => completeVisitMutation.mutate(booking.id)}
                          completeVisitPending={completeVisitMutation.isPending}
                          onRequestConsent={() => requestConsentMutation.mutate(booking.id)}
                          consentRequestPending={requestConsentMutation.isPending}
                        />
                      );
                    })}
                    </div>
                    {isFetchingNextPage && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                        {[1,2,3].map(i => (
                          <div key={i} className="rounded-xl border border-border/50 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-4 w-28" />
                              <Skeleton className="h-5 w-16 rounded-full" />
                            </div>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3.5 w-36" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Skeleton className="h-7 flex-1 rounded-md" />
                              <Skeleton className="h-7 flex-1 rounded-md" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!hasNextPage && displayBookings.length > 0 && (
                      <p className="text-center text-xs text-muted-foreground/60 py-3 tabular-nums">
                        All {bookingsInfiniteData?.pages[0]?.total ?? displayBookings.length} appointments loaded
                      </p>
                    )}
                    <div ref={sentinelRef} className="h-2" />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${quickFilter === "awaiting" ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/60"}`}>
                      {quickFilter === "awaiting" ? <CheckCircle2 className="h-7 w-7 text-amber-500/60" /> : <Calendar className="h-7 w-7 text-muted-foreground/40" />}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {quickFilter === "awaiting" ? "No appointments awaiting approval" : "No appointments found"}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {quickFilter === "awaiting" ? "You're all caught up — nothing waiting for your review." : "Try adjusting your filters"}
                    </p>
                  </div>
                )}
                </div>
              </div>
            </div>
          </>
          )}

          {/* ─────────────── PROFILE ─────────────── */}
          {activeTab === "profile" && (() => {
            const LANGUAGES = ["English", "Malayalam", "Tamil", "Hindi", "Kannada"];
            const completenessFields = [profName, profSpecialization, profDegree, profCollege, profBio, profPhone, profImageUrl, profYearsExp, profLanguages.length > 0 ? "yes" : ""];
            const filled = completenessFields.filter(Boolean).length;
            const pct = Math.round((filled / completenessFields.length) * 100);
            const isComplete = pct === 100;
            return (
              <div className="space-y-5 animate-in fade-in duration-200">

                {/* Panel header */}
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                  <div className="flex">
                    <div className="w-1.5 bg-violet-500/60 shrink-0" />
                    <div className="flex-1 px-5 py-4 bg-gradient-to-r from-violet-500/[0.06] to-transparent flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <User className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold tracking-tight">My Profile</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Manage your public profile visible to patients and clinics.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Live Preview Banner ── */}
                <div className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
                  <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-5 pt-5 pb-4 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                    <div className="relative flex items-start gap-3">
                      <div className="relative shrink-0 mt-0.5">
                        <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-br from-accent/40 to-primary/30 blur-md" />
                        <Avatar className="relative h-14 w-14 rounded-2xl border-2 border-white/20 ring-1 ring-white/10">
                          <AvatarImage src={profImageUrl || undefined} />
                          <AvatarFallback className="rounded-2xl bg-white/15 text-white font-bold text-xl">{profName?.charAt(0) || "?"}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-0.5">Doctor Profile</p>
                        <h2 className="text-lg font-extrabold text-white leading-tight">{profName || "Your Name"}</h2>
                        <p className="text-xs text-white/55 mb-2">{profSpecialization || "Specialization"} · {profDegree || "Degree"}</p>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profCollege ? "bg-white/15 text-white/80" : "bg-white/5 text-white/25 border border-white/10 border-dashed italic"}`}>
                            {profCollege || "College / University"}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profYearsExp ? "bg-white/15 text-white/80" : "bg-white/5 text-white/25 border border-white/10 border-dashed italic"}`}>
                            {profYearsExp ? `${profYearsExp} yrs experience` : "Years of experience"}
                          </span>
                          {profLanguages.length > 0 ? profLanguages.map(lang => (
                            <span key={lang} className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/15 text-white/80">{lang}</span>
                          )) : (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/5 text-white/25 border border-white/10 border-dashed italic">Languages spoken</span>
                          )}
                        </div>
                        <p className={`text-xs leading-relaxed line-clamp-2 ${profBio ? "text-white/50" : "text-white/20 italic"}`}>
                          {profBio || "No professional bio added yet — describe your expertise and approach for patients to see."}
                        </p>
                      </div>
                    </div>
                    {/* Completeness bar */}
                    <div className="relative mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-white/60 font-medium">Profile completeness</span>
                        <span className={`text-xs font-bold ${isComplete ? "text-green-300" : "text-white/80"}`}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-green-400" : "bg-white/70"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
                  </div>
                </div>

                {/* ── Section 1: Identity ── */}
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/40 bg-muted/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Identity
                    </p>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Photo upload */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 ring-2 ring-primary/20 shrink-0">
                        <AvatarImage src={profImageUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{profName?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2">
                        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                        <Button
                          variant="outline" size="sm"
                          className="min-h-[44px] text-xs active:scale-[0.98] transition-all"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={profUploading || profOptimising}
                          data-testid="button-upload-photo"
                        >
                          {profOptimising
                            ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-amber-500" />Optimising…</>
                            : profUploading
                              ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Uploading…</>
                              : <><Upload className="h-3.5 w-3.5 mr-2" />Upload Photo</>}
                        </Button>
                        {profImageUrl && (
                          <button
                            onClick={() => setProfImageUrl("")}
                            className="text-xs text-muted-foreground hover:text-destructive active:opacity-70 transition-colors min-h-[44px] px-2"
                            data-testid="button-remove-photo"
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Name + Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</Label>
                        <Input
                          data-testid="input-prof-name"
                          value={profName}
                          onChange={e => setProfName(e.target.value)}
                          placeholder="e.g. Dr. Ananya Krishnan"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Phone</Label>
                        <Input
                          data-testid="input-prof-phone"
                          type="tel"
                          value={profPhone}
                          onChange={e => setProfPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Credentials ── */}
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/40 bg-muted/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5" /> Credentials
                    </p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Stethoscope className="h-3 w-3" />Specialization
                        </Label>
                        <Input
                          data-testid="input-prof-specialization"
                          value={profSpecialization}
                          onChange={e => setProfSpecialization(e.target.value)}
                          placeholder="Orthodontist"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <GraduationCap className="h-3 w-3" />Degree
                        </Label>
                        <Input
                          data-testid="input-prof-degree"
                          value={profDegree}
                          onChange={e => setProfDegree(e.target.value)}
                          placeholder="BDS, MDS"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" />College / University
                        </Label>
                        <Input
                          data-testid="input-prof-college"
                          value={profCollege}
                          onChange={e => setProfCollege(e.target.value)}
                          placeholder="e.g. Apollo Hospital, Chennai"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <TrendingUp className="h-3 w-3" />Years of Experience
                        </Label>
                        <Input
                          data-testid="input-prof-experience"
                          type="number"
                          min="0"
                          max="70"
                          inputMode="numeric"
                          value={profYearsExp}
                          onChange={e => setProfYearsExp(e.target.value)}
                          placeholder="e.g. 10"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Public Profile ── */}
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/40 bg-muted/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Public Profile
                    </p>
                  </div>
                  <div className="p-5 space-y-5">
                    {/* Languages */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Globe className="h-3 w-3" />Languages Spoken
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang}
                            type="button"
                            data-testid={`toggle-lang-${lang.toLowerCase()}`}
                            onClick={() => toggleLanguage(lang)}
                            className={`min-h-[44px] px-4 rounded-full text-xs font-semibold border transition-all active:scale-[0.97] ${
                              profLanguages.includes(lang)
                                ? "bg-primary text-white border-primary shadow-sm shadow-primary/20"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground active:bg-muted/60"
                            }`}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Bio */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Professional Bio</Label>
                      <Textarea
                        data-testid="input-prof-bio"
                        value={profBio}
                        onChange={e => setProfBio(e.target.value)}
                        placeholder="Brief professional summary visible on your public profile…"
                        className="resize-none h-24"
                        onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      />
                    </div>
                    {/* Profile Handle */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <LinkIcon className="h-3 w-3" />Profile Handle
                      </Label>
                      <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono select-none">/doctor/</span>
                          <Input
                            data-testid="input-prof-username"
                            value={profUsername}
                            onChange={e => setProfUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            placeholder="e.g. dr-ananya-krishnan"
                            className="pl-[70px] font-mono text-sm"
                            onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                          />
                        </div>
                        {!profUsername && profName && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 min-h-[44px] text-xs border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.97]"
                            onClick={() => setProfUsername(slugify(profName))}
                            data-testid="button-suggest-username"
                          >
                            Suggest
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only. Leave blank to use your numeric ID.</p>
                    </div>
                  </div>
                </div>

                {/* ── Section 4: Scan & Share ── */}
                {doctor && (
                  <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-border/40 bg-muted/20">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Share2 className="h-3.5 w-3.5" /> Scan &amp; Share
                      </p>
                    </div>
                    <div className="px-5 py-4 flex flex-col sm:flex-row gap-4 items-center">
                      <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-muted/20 p-3 border border-border/40 shadow-inner shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none rounded-2xl" />
                        <QRCode
                          value={`${window.location.origin}/doctor/${(doctor as any).username || (doctor as any).id}`}
                          size={110}
                          level="M"
                          fgColor="#085041"
                          bgColor="#ffffff"
                          style={{ display: "block" }}
                        />
                      </div>
                      <div className="flex-1 w-full space-y-2">
                        <p className="text-xs text-muted-foreground leading-relaxed">Patients can scan this QR or tap the link below to view your public profile.</p>
                        <div className="w-full rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profile URL</p>
                              <p className="text-xs text-foreground truncate font-mono mt-0.5">
                                /doctor/{(doctor as any).username || (doctor as any).id}
                              </p>
                            </div>
                            <button
                              data-testid="button-copy-profile-url"
                              title="Copy profile URL"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/doctor/${(doctor as any).username || (doctor as any).id}`);
                                setProfileUrlCopied(true);
                                setTimeout(() => setProfileUrlCopied(false), 2000);
                              }}
                              className={`min-h-[44px] min-w-[44px] rounded-lg border flex items-center justify-center shrink-0 transition-all active:scale-[0.95]
                                ${profileUrlCopied
                                  ? 'bg-primary/10 border-primary/30 text-primary'
                                  : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5'}`}
                            >
                              {profileUrlCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                        {!(doctor as any).username && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">Set a Profile Handle above to get a memorable URL instead of a number.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Sticky Save Footer ── */}
                <div className="sticky bottom-0 pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-sm pt-3 border-t border-border/40">
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold shadow-md shadow-primary/20 active:scale-[0.98] transition-all min-h-[44px]"
                      onClick={() => updateProfileMutation.mutate({
                        name: profName,
                        specialization: profSpecialization,
                        degree: profDegree,
                        college: profCollege,
                        bio: profBio,
                        phone: profPhone,
                        imageUrl: profImageUrl,
                        yearsOfExperience: profYearsExp !== "" ? parseInt(profYearsExp, 10) : null,
                        languages: profLanguages,
                        username: profUsername.trim() || null,
                      })}
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Save Profile
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px] border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.97] transition-all"
                      onClick={() => window.open(`/doctor/${(doctor as any).username || (doctor as any).id}`, "_blank")}
                      data-testid="button-preview-profile"
                    >
                      <Eye className="h-4 w-4 mr-2" />Preview
                    </Button>
                  </div>
                </div>

                {/* ── Leave nav shortcut ── */}
                <button
                  onClick={() => setActiveTab("leaves")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 hover:bg-amber-100/60 dark:hover:bg-amber-500/10 active:scale-[0.99] transition-all text-left"
                  data-testid="button-go-to-leaves"
                >
                  <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center shrink-0">
                    <CalendarOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Leave Management</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-0.5">Mark your out-of-office dates from the Leaves tab</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                </button>

              </div>
            );
          })()}

          {/* ─────────────── LEAVE MANAGEMENT ─────────────── */}
          {activeTab === "leaves" && (
            <div className="space-y-4">
              {/* Panel header — compact */}
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <div className="flex">
                  <div className="w-1.5 bg-amber-500/60 shrink-0" />
                  <div className="flex-1 px-5 py-3 bg-gradient-to-r from-amber-500/[0.06] to-transparent flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <CalendarOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">Leave Management</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Mark dates when you are unavailable. Clinic admins will see a warning when trying to assign you on these dates.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
                {/* Sub-header — compact with richer subtitle */}
                <div className="px-5 py-3 bg-amber-100/60 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 flex items-center justify-between rounded-t-2xl">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-amber-200/70 dark:bg-amber-500/20 flex items-center justify-center">
                      <BriefcaseMedical className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Out of Office / Leave</p>
                      {!isLeavesLoading && (() => {
                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                        const upcoming = leaves.filter(l => l.leaveDate >= todayStr).sort((a, b) => a.leaveDate.localeCompare(b.leaveDate));
                        if (upcoming.length === 0) return null;
                        const nextLeave = upcoming[0];
                        return (
                          <p className="text-xs text-amber-600/80 dark:text-amber-400/60">
                            {upcoming.length} upcoming {upcoming.length === 1 ? "day" : "days"} · Next: {format(new Date(nextLeave.leaveDate + 'T00:00:00'), 'EEE, MMM d')}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                  {/* Single / Multi toggle */}
                  <div className="flex items-center rounded-lg border border-amber-200 dark:border-amber-500/30 overflow-hidden text-xs font-semibold">
                    <button
                      data-testid="button-single-mode"
                      onClick={() => { setMultiMode(false); setPendingDates([]); setChipsExpanded(false); }}
                      className={`min-h-[36px] px-3 py-1.5 transition-colors ${!multiMode ? "bg-amber-500 text-white" : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/10"}`}
                    >Single</button>
                    <button
                      data-testid="button-multi-mode"
                      onClick={() => { setMultiMode(true); setLeavePickerDate(undefined); }}
                      className={`min-h-[36px] px-3 py-1.5 transition-colors ${multiMode ? "bg-amber-500 text-white" : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/10"}`}
                    >Multi</button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Instruction text — reduced padding */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {multiMode
                      ? <><span className="font-medium text-amber-700 dark:text-amber-400">Multi-select:</span> tap several dates, add an optional reason, then submit them all at once — great for holidays or planned leave blocks.</>
                      : <>Mark dates when you are unavailable. <span className="font-medium text-amber-700 dark:text-amber-400">Tap an amber date to remove it.</span> Clinic admins will see a warning when trying to assign you on these dates.</>
                    }
                  </p>

                  {/* Calendar + reason/submit side by side */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start">

                    {/* Calendar — compact */}
                    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-background shadow-sm shrink-0">
                      {isLeavesLoading ? (
                        <div className="w-full h-[250px] p-2 space-y-2">
                          <div className="flex justify-between px-1 pb-1">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-4 rounded" />
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({length: 7}).map((_, i) => <Skeleton key={i} className="h-5 w-7 rounded" />)}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({length: 35}).map((_, i) => <Skeleton key={i} className="h-7 w-7 rounded-full" />)}
                          </div>
                        </div>
                      ) : multiMode ? (
                        <CalendarPicker
                          mode="multiple"
                          selected={pendingDates}
                          onSelect={(dates) => {
                            const newDates = dates || [];
                            const added = newDates.find(d =>
                              !pendingDates.some(p => format(p, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'))
                            );
                            if (added) {
                              const dateStr = format(added, 'yyyy-MM-dd');
                              const existing = leaves.find(l => l.leaveDate === dateStr);
                              if (existing) { removeLeaveMutation.mutate(existing.id); return; }
                            }
                            setPendingDates(newDates.filter(d =>
                              !leaves.some(l => l.leaveDate === format(d, 'yyyy-MM-dd'))
                            ));
                          }}
                          disabled={(date) => { const t = new Date(); t.setHours(0,0,0,0); return date < t; }}
                          modifiers={{ leave: leaves.map(l => new Date(l.leaveDate + 'T00:00:00')) }}
                          modifiersStyles={{ leave: { backgroundColor: 'rgb(251 191 36 / 0.25)', color: '#92400e', fontWeight: '700', borderRadius: '6px', border: '1.5px solid rgb(251 191 36 / 0.6)' } }}
                          classNames={{ month: "space-y-2", row: "flex w-full mt-1" }}
                          className="p-2"
                          data-testid="calendar-leave-picker-multi"
                        />
                      ) : (
                        <CalendarPicker
                          mode="single"
                          selected={leavePickerDate}
                          onSelect={(date) => {
                            if (!date) return;
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const existing = leaves.find(l => l.leaveDate === dateStr);
                            if (existing) { removeLeaveMutation.mutate(existing.id); }
                            else { setLeavePickerDate(date); }
                          }}
                          disabled={(date) => { const t = new Date(); t.setHours(0,0,0,0); return date < t; }}
                          modifiers={{ leave: leaves.map(l => new Date(l.leaveDate + 'T00:00:00')) }}
                          modifiersStyles={{ leave: { backgroundColor: 'rgb(251 191 36 / 0.25)', color: '#92400e', fontWeight: '700', borderRadius: '6px', border: '1.5px solid rgb(251 191 36 / 0.6)' } }}
                          classNames={{ month: "space-y-2", row: "flex w-full mt-1" }}
                          className="p-2"
                          data-testid="calendar-leave-picker"
                        />
                      )}
                      {/* Legend — reduced padding */}
                      <div className="flex items-center gap-4 px-3 pb-2.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-3 w-3 rounded-sm bg-primary/80" />
                          <span className="text-xs text-muted-foreground">{multiMode && pendingDates.length > 0 ? `${pendingDates.length} selected` : "Selected"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'rgb(251 191 36 / 0.3)', border: '1.5px solid rgb(251 191 36 / 0.6)' }} />
                          <span className="text-xs text-muted-foreground">Leave (tap to remove)</span>
                        </div>
                      </div>
                    </div>

                    {/* Reason + queued chips + CTA */}
                    <div className="flex flex-col gap-3 flex-1 w-full">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason (optional)</Label>
                        <Input
                          data-testid="input-leave-reason"
                          value={leaveReason}
                          onChange={e => setLeaveReason(e.target.value)}
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                          placeholder="e.g. Medical appointment, Personal leave"
                          className="mt-1.5 text-sm"
                          maxLength={80}
                          type="text"
                        />
                        {leaveReason.length > 0 && (
                          <p className="text-xs text-muted-foreground text-right mt-1">{leaveReason.length}/80</p>
                        )}
                      </div>

                      {multiMode ? (
                        <div className="flex flex-col gap-2.5">
                          {pendingDates.length > 0 && (() => {
                            const sorted = [...pendingDates].sort((a, b) => a.getTime() - b.getTime());
                            const CHIP_LIMIT = 5;
                            const visible = chipsExpanded ? sorted : sorted.slice(0, CHIP_LIMIT);
                            const overflow = sorted.length - CHIP_LIMIT;
                            return (
                              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 space-y-1.5">
                                <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                                  {sorted.length} {sorted.length === 1 ? "date" : "dates"} queued:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {visible.map(d => {
                                    const ds = format(d, 'yyyy-MM-dd');
                                    return (
                                      <span key={ds} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                        {format(d, 'MMM d')}
                                        <button
                                          data-testid={`button-deselect-${ds}`}
                                          onClick={() => setPendingDates(prev => prev.filter(p => format(p, 'yyyy-MM-dd') !== ds))}
                                          className="hover:text-red-500 active:scale-95 transition-colors ml-0.5 min-h-[20px]"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    );
                                  })}
                                  {!chipsExpanded && overflow > 0 && (
                                    <button
                                      data-testid="button-expand-chips"
                                      onClick={() => setChipsExpanded(true)}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 active:scale-95 transition-all"
                                    >
                                      +{overflow} more
                                    </button>
                                  )}
                                  {chipsExpanded && overflow > 0 && (
                                    <button
                                      data-testid="button-collapse-chips"
                                      onClick={() => setChipsExpanded(false)}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 active:scale-95 transition-all"
                                    >
                                      show less
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* CTA + Clear in one row */}
                          <div className="flex items-center gap-2">
                            <Button
                              data-testid="button-mark-leave-multi"
                              variant="outline"
                              className={`flex-1 min-h-[44px] font-semibold transition-all active:scale-[0.98] ${
                                pendingDates.length > 0
                                  ? "border-amber-400 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 shadow-sm"
                                  : "border-border text-muted-foreground"
                              }`}
                              disabled={pendingDates.length === 0 || addLeavesBatchMutation.isPending}
                              onClick={() => {
                                if (pendingDates.length === 0) return;
                                addLeavesBatchMutation.mutate({ dates: pendingDates.map(d => format(d, 'yyyy-MM-dd')), reason: leaveReason || undefined });
                              }}
                            >
                              {addLeavesBatchMutation.isPending
                                ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                : <CalendarDays className="h-3.5 w-3.5 mr-2" />}
                              {pendingDates.length > 0
                                ? `Mark ${pendingDates.length} ${pendingDates.length === 1 ? "day" : "days"} as Out of Office`
                                : "Select dates on the calendar"}
                            </Button>
                            {pendingDates.length > 0 && (
                              <button
                                data-testid="button-clear-pending"
                                onClick={() => { setPendingDates([]); setChipsExpanded(false); }}
                                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 whitespace-nowrap transition-colors px-1"
                              >
                                Clear All
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <Button
                            data-testid="button-mark-leave"
                            variant="outline"
                            className={`min-h-[44px] font-semibold transition-all active:scale-[0.98] ${
                              leavePickerDate
                                ? "border-amber-400 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 shadow-sm"
                                : "border-border text-muted-foreground"
                            }`}
                            disabled={!leavePickerDate || addLeaveMutation.isPending}
                            onClick={() => {
                              if (!leavePickerDate) return;
                              addLeaveMutation.mutate({ leaveDate: format(leavePickerDate, 'yyyy-MM-dd'), reason: leaveReason || undefined });
                            }}
                          >
                            {addLeaveMutation.isPending
                              ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              : <CalendarDays className="h-3.5 w-3.5 mr-2" />}
                            {leavePickerDate
                              ? `Mark ${format(leavePickerDate, 'EEE, MMM d')} as Out of Office`
                              : "Select a date on the calendar"}
                          </Button>
                          {removeLeaveMutation.isPending && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Removing leave…
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Marked dates — accordion by month, no gap before */}
                  {isLeavesLoading ? (
                    <div className="space-y-2 pt-3 border-t border-amber-200 dark:border-amber-500/20">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-2">
                          <Skeleton className="h-4 w-4 rounded shrink-0" />
                          <Skeleton className="h-3.5 w-36" />
                          <Skeleton className="h-5 w-14 rounded-full ml-auto" />
                        </div>
                      ))}
                    </div>
                  ) : leaves.length > 0 ? (() => {
                    const grouped = leaves.reduce((acc, l) => {
                      const key = format(new Date(l.leaveDate + 'T00:00:00'), 'MMMM yyyy');
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(l);
                      return acc;
                    }, {} as Record<string, DoctorLeave[]>);
                    const monthKeys = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                    const activeMonth = openLeaveMonth ?? monthKeys[0];
                    return (
                      <div className="pt-3 border-t border-amber-200 dark:border-amber-500/20 space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Marked Dates</p>
                        {monthKeys.map(month => {
                          const monthLeaves = grouped[month];
                          const isOpen = month === activeMonth;
                          return (
                            <div key={month} className="rounded-xl border border-amber-200 dark:border-amber-500/20 overflow-hidden">
                              <button
                                data-testid={`button-accordion-${month.replace(/\s/g, '-')}`}
                                onClick={() => setOpenLeaveMonth(month)}
                                className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] bg-amber-100/60 dark:bg-amber-500/10 hover:bg-amber-100/90 dark:hover:bg-amber-500/15 transition-colors text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">{month}</span>
                                  <span className="text-xs bg-amber-200/70 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full px-1.5 font-semibold">{monthLeaves.length}</span>
                                </div>
                                <ChevronDown className={`h-3.5 w-3.5 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`} />
                              </button>
                              <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                                <div className="min-h-0 overflow-hidden">
                                  <div className="space-y-0.5 p-1.5">
                                    {monthLeaves.map(leave => (
                                      <div
                                        key={leave.id}
                                        data-testid={`leave-item-${leave.id}`}
                                        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-amber-100/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 group hover:bg-amber-200/50 dark:hover:bg-amber-500/15 transition-colors"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <div className="h-6 w-6 rounded-md bg-amber-200/80 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                                            <CalendarDays className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                                          </div>
                                          <div>
                                            <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                              {format(new Date(leave.leaveDate + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                                            </span>
                                            {leave.reason
                                              ? <p className="text-xs text-amber-600/80 dark:text-amber-400/70">{leave.reason}</p>
                                              : <p className="text-xs text-muted-foreground/50 italic">No reason given</p>
                                            }
                                          </div>
                                        </div>
                                        <button
                                          data-testid={`button-remove-leave-${leave.id}`}
                                          onClick={() => removeLeaveMutation.mutate(leave.id)}
                                          disabled={removeLeaveMutation.isPending}
                                          aria-label="Remove this leave"
                                          className="opacity-0 group-hover:opacity-100 min-h-[36px] px-2 rounded-md text-amber-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 dark:text-amber-400 dark:hover:text-red-400 active:scale-95 transition-all"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })() : (
                    <div className="flex items-center gap-2.5 py-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-dashed border-amber-200 dark:border-amber-500/20 mt-1">
                      <CalendarDays className="h-4 w-4 text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/60 italic">No leaves marked yet. Select a date on the calendar above.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─────────────── X-RAY ANALYSIS ─────────────── */}
          {activeTab === "xray" && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-violet-500/60 shrink-0" />
                <div className="flex-1 px-5 py-5 bg-gradient-to-r from-violet-500/[0.06] to-transparent">
                  <XrayAnalysisTab />
                </div>
              </div>
            </div>
          )}

          {/* ─────────────── CERTIFICATIONS ─────────────── */}
          {activeTab === "certifications" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <div className="flex">
                  <div className="w-1.5 bg-blue-500/60 shrink-0" />
                  <div className="flex-1 px-5 py-4 bg-gradient-to-r from-blue-500/[0.06] to-transparent flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Award className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold tracking-tight">Certifications & Achievements</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Highlight your credentials — these appear on your public profile.</p>
                      </div>
                    </div>
                    <Button onClick={openNewCert} size="sm" className="bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/20 shrink-0 h-9 px-3">
                      <Plus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Add Certification</span>
                    </Button>
                  </div>
                </div>
              </div>
              {isCertsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
                      <Skeleton className="aspect-video w-full" />
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-8 w-full mt-3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isCertsError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20">
                  <p className="text-sm text-muted-foreground">Could not load certifications.</p>
                  <Button variant="outline" onClick={() => refetchCerts()} className="border-primary/30 text-primary hover:bg-primary/5">Try again</Button>
                </div>
              ) : certifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center"><Award className="h-8 w-8 text-primary/50" /></div>
                  <div className="text-center">
                    <p className="font-semibold text-muted-foreground">No certifications yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Add your first certification to showcase your expertise</p>
                  </div>
                  <Button variant="outline" onClick={openNewCert} className="border-primary/30 text-primary hover:bg-primary/5"><Plus className="h-4 w-4 mr-2" />Add your first certification</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
                      {cert.imageUrl && <div className="aspect-video overflow-hidden bg-muted"><img src={cert.imageUrl} alt={cert.title} className="w-full h-full object-cover" /></div>}
                      <div className="p-4 flex flex-col gap-2 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0"><Star className="h-3 w-3 text-white" /></div>
                              <h3 className="font-bold text-sm leading-tight">{cert.title}</h3>
                            </div>
                            {cert.issuer && <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{cert.issuer}</p>}
                          </div>
                          {cert.year && <span className="shrink-0 text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{cert.year}</span>}
                        </div>
                        {cert.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{cert.description}</p>}
                        <div className="flex gap-2 mt-auto pt-3 border-t border-border/40">
                          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEditCert(cert)}><Pencil className="h-3 w-3 mr-1.5" />Edit</Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteCertMutation.mutate(cert.id)} disabled={deleteCertMutation.isPending}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────────── CASES ─────────────── */}
          {activeTab === "cases" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <div className="flex">
                  <div className="w-1.5 bg-teal-500/60 shrink-0" />
                  <div className="flex-1 px-5 py-4 bg-gradient-to-r from-teal-500/[0.06] to-transparent flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                        <BookOpen className="h-[18px] w-[18px] text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold tracking-tight">Case Studies</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Share your clinical cases with descriptions and media. Visible on your public profile.</p>
                      </div>
                    </div>
                    <Button onClick={openNewCase} size="sm" className="bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/20 shrink-0 h-9 px-3">
                      <Plus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Add Case</span>
                    </Button>
                  </div>
                </div>
              </div>
              {isCasesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
                      <div className="grid grid-cols-2 gap-1 p-2">
                        <Skeleton className="aspect-video rounded-xl" />
                        <Skeleton className="aspect-video rounded-xl" />
                      </div>
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-8 w-full mt-3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isCasesError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20">
                  <p className="text-sm text-muted-foreground">Could not load case studies.</p>
                  <Button variant="outline" onClick={() => refetchCases()} className="border-primary/30 text-primary hover:bg-primary/5">Try again</Button>
                </div>
              ) : cases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center"><BookOpen className="h-8 w-8 text-primary/50" /></div>
                  <div className="text-center">
                    <p className="font-semibold text-muted-foreground">No case studies yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Document your clinical work to build patient trust</p>
                  </div>
                  <Button variant="outline" onClick={openNewCase} className="border-primary/30 text-primary hover:bg-primary/5"><Plus className="h-4 w-4 mr-2" />Add your first case</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {cases.map((c) => {
                    const media = (c.mediaUrls as string[]) || [];
                    const tags = (c.tags as string[]) || [];
                    return (
                      <div key={c.id} className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
                        {media.length > 0 && (
                          <div className="grid grid-cols-2 gap-1 p-2 bg-muted/30">
                            {(["Before", "After"] as const).map((label, i) =>
                              media[i] ? (
                                <div key={i} className="relative">
                                  <MediaThumb url={media[i]} />
                                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/60 text-white/90 backdrop-blur-sm">{label}</span>
                                </div>
                              ) : (
                                <div key={i} className="aspect-video rounded-xl bg-muted/40 border border-dashed border-border/40 flex items-center justify-center">
                                  <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{label}</span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                        <div className="p-4 flex flex-col gap-2 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center shrink-0"><BookOpen className="h-3 w-3 text-white" /></div>
                            <h3 className="font-bold text-sm leading-tight line-clamp-1">{c.title}</h3>
                          </div>
                          {c.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{c.description}</p>}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.map((tag, i) => <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15">{tag}</span>)}
                            </div>
                          )}
                          <div className="flex gap-2 mt-auto pt-3 border-t border-border/40">
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEditCase(c)}><Pencil className="h-3 w-3 mr-1.5" />Edit</Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteCaseMutation.mutate(c.id)} disabled={deleteCaseMutation.isPending}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      </div>

            {/* ═══ MOBILE LEFT NAVIGATION DRAWER ═══ */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Doctor Menu</SheetTitle>
          </SheetHeader>

          {/* Doctor identity header */}
          <div className="px-4 pt-5 pb-4 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3">
              {(doctor as any)?.photoUrl ? (
                <img
                  src={(doctor as any).photoUrl}
                  alt={(doctor as any)?.name || "Doctor"}
                  className="h-10 w-10 rounded-full object-cover shrink-0 border border-border/40"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {(doctor as any)?.name?.charAt(0)?.toUpperCase() || "D"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {(doctor as any)?.name || "Doctor"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {(doctor as any)?.specialty || "Doctor Portal"}
                </p>
              </div>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {([
                { key: "appointments" as Tab, label: "Appointments", desc: "View your schedule", Icon: Calendar, color: "primary" },
                { key: "leaves"       as Tab, label: "Leave",        desc: "Apply for time off", Icon: CalendarOff, color: "orange" },
                { key: "profile"      as Tab, label: "Profile",      desc: "Edit your details",  Icon: User, color: "teal" },
                { key: "cases"        as Tab, label: "Cases",        desc: "Patient case studies", Icon: BookOpen, color: "emerald" },
                { key: "certifications" as Tab, label: "Certifications", desc: "Degrees & awards", Icon: Award, color: "blue" },
                { key: "xray"         as Tab, label: "Analyse X-Ray",  desc: "AI dental findings", Icon: Microscope, color: "violet" },
              ] as { key: Tab; label: string; desc: string; Icon: any; color: string }[]).map(({ key, label, desc, Icon, color }) => {
                const isActive = activeTab === key;
                const bgActive = color === "primary" ? "bg-primary/10 border-primary/25" :
                                  color === "orange" ? "bg-orange-500/10 border-orange-500/25" :
                                  color === "teal" ? "bg-teal-500/10 border-teal-500/25" :
                                  color === "emerald" ? "bg-emerald-500/10 border-emerald-500/25" :
                                  color === "blue" ? "bg-blue-500/10 border-blue-500/25" :
                                  "bg-violet-500/10 border-violet-500/25";
                const iconColor = color === "primary" ? "text-primary" :
                                   color === "orange" ? "text-orange-600 dark:text-orange-400" :
                                   color === "teal" ? "text-teal-600 dark:text-teal-400" :
                                   color === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
                                   color === "blue" ? "text-blue-600 dark:text-blue-400" :
                                   "text-violet-600 dark:text-violet-400";
                return (
                  <button
                    key={key}
                    onClick={() => { setActiveTab(key); setMobileNavOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all active:scale-[0.98] text-left ${isActive ? bgActive : "border-transparent hover:bg-muted/40"}`}
                    data-testid={`drawer-nav-${key}`}
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-white/60 dark:bg-white/10" : "bg-muted/60"}`}>
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    {isActive && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-2">
              <div className="h-px bg-border/50" />
            </div>
            <div className="p-3 space-y-1">
              <button
                onClick={() => { setChangePwdOpen(true); setMobileNavOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-transparent hover:bg-muted/40 transition-all active:scale-[0.98] text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Change Password</p>
                  <p className="text-xs text-muted-foreground">Update your account password</p>
                </div>
              </button>
              {doctor && (
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-border/50 bg-muted/20">
                  <div className="rounded-xl overflow-hidden bg-white dark:bg-muted/20 p-2 border border-border/40 shadow-inner shrink-0">
                    <QRCode
                      value={`${window.location.origin}/doctor/${(doctor as any).username || (doctor as any).id}`}
                      size={64}
                      level="M"
                      fgColor="#085041"
                      bgColor="#ffffff"
                      style={{ display: "block" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Your QR Code</p>
                    <p className="text-xs text-muted-foreground mb-2">Scan to view public profile</p>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { copyProfileLink(); setMobileNavOpen(false); }}>
                      {linkCopied ? <Check className="h-3 w-3 mr-1.5 text-primary" /> : <Copy className="h-3 w-3 mr-1.5" />}
                      {linkCopied ? "Copied!" : "Copy Profile Link"}
                    </Button>
                  </div>
                </div>
              )}
              <button
                onClick={() => { logout(); setMobileNavOpen(false); }}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all active:scale-[0.98] text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <LogOut className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-red-600 dark:text-red-400">{isLoggingOut ? "Logging out…" : "Log Out"}</p>
                  <p className="text-xs text-muted-foreground">Sign out of the doctor portal</p>
                </div>
              </button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ═══ MOBILE NOTIFICATIONS BOTTOM SHEET ═══ */}
      <Sheet open={mobileNotifOpen} onOpenChange={setMobileNotifOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl h-[70vh] p-0 flex flex-col">
          <SheetHeader className="px-5 py-4 border-b border-border/40 shrink-0">
            <SheetTitle className="text-left text-base">Notifications</SheetTitle>
            <SheetDescription className="text-left">
              {awaitingApprovalCount > 0 ? `${awaitingApprovalCount} booking${awaitingApprovalCount === 1 ? "" : "s"} awaiting your approval` : "No pending notifications"}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {awaitingApprovalCount > 0 ? (
                displayBookings
                  .filter((b: any) => b.status === "awaitingApproval")
                  .slice(0, 20)
                  .map((b: any) => (
                    <button
                      key={b.id}
                      onClick={() => { setPatientModalId(b.id); setMobileNotifOpen(false); }}
                      className="w-full flex items-start gap-3 px-3 py-3 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20 text-left transition-colors hover:bg-amber-100 dark:hover:bg-amber-950/30"
                    >
                      <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{b.patientName || "Patient"}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.appointmentDate ? new Date(b.appointmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                          {b.slotTime ? ` \u2022 ${b.slotTime}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </button>
                  ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Bell className="h-5 w-5 opacity-40" />
                  </div>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs mt-1">No notifications right now</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ── Patient Detail Dialog ── */}
      <Dialog open={patientModalId !== null} onOpenChange={(o) => { if (!o) { setPatientModalId(null); setDialogExpanded(false); } }}>
        <DialogContent className={`w-[95vw] ${dialogExpanded ? 'sm:max-w-[88vw]' : 'sm:max-w-[640px]'} p-0 gap-0 overflow-hidden h-[90vh] flex flex-col rounded-2xl transition-[max-width] duration-200`}>

          {/* Maximize / minimize toggle — tablet+ only, sits left of the auto-rendered close X */}
          <button
            onClick={() => setDialogExpanded(v => !v)}
            className="hidden sm:flex absolute right-11 top-3.5 z-10 h-6 w-6 items-center justify-center rounded-md bg-white/15 hover:bg-white/25 border border-white/20 transition-colors"
            aria-label={dialogExpanded ? "Minimize dialog" : "Maximize dialog"}
            data-testid="button-doctor-dialog-expand"
          >
            {dialogExpanded
              ? <Minimize2 className="h-3.5 w-3.5 text-white" />
              : <Maximize2 className="h-3.5 w-3.5 text-white" />}
          </button>

          {patientModalId !== null && (() => {
            const b = openedBooking?.id === patientModalId
              ? openedBooking
              : (displayBookings.find((bk: any) => bk.id === patientModalId) ?? doctorFocusBooking ?? null);
            if (!b) return (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 p-8 text-muted-foreground">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-5 w-5 opacity-40" />
                </div>
                <p className="text-sm font-medium">Loading patient details…</p>
              </div>
            );
            const startTime = b.slot?.startTime ? new Date(b.slot.startTime) : null;
            const modalClinicName = b.clinic?.name || b.clinicName || doctorClinics.find((c: any) => c.id === b.clinicId)?.name || "Clinic";
            return (
              <>
                {/* Header */}
                <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-5 pt-5 pb-4 shrink-0 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                  <div className="relative flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white font-bold text-base ring-1 ring-white/10 shrink-0">
                      {b.customerName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-white text-base leading-tight">{b.customerName}</p>
                        {(b.customerAge || b.customerGender) && (
                          <span className="text-xs text-white/55 shrink-0">
                            {b.customerAge ? `${b.customerAge}y` : ""}
                            {b.customerAge && b.customerGender ? " · " : ""}
                            {b.customerGender ? (b.customerGender as string).charAt(0).toUpperCase() + (b.customerGender as string).slice(1) : ""}
                          </span>
                        )}
                        {b.doctorApprovalStatus === 'declined' && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700 px-2 py-0.5 rounded-full">
                            <X className="h-3 w-3" /> Declined
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-white/60 text-xs flex-wrap">
                        <span className="flex items-center gap-1"><Hash className="h-3 w-3" />REF-{String(b.id).padStart(4, "0")}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 truncate"><Building2 className="h-3 w-3 shrink-0" />{modalClinicName}</span>
                      </div>
                      {startTime && (
                        <p className="text-white/50 text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{startTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          {(() => {
                            const now = new Date(); now.setHours(0, 0, 0, 0);
                            const apptDay = new Date(startTime); apptDay.setHours(0, 0, 0, 0);
                            const diff = Math.round((apptDay.getTime() - now.getTime()) / 86400000);
                            if (diff === 0) return <span className="text-xs font-semibold text-sky-300 bg-sky-500/20 border border-sky-400/30 px-1.5 py-px rounded-full">Today</span>;
                            if (diff === 1) return <span className="text-xs font-semibold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-1.5 py-px rounded-full">Tomorrow</span>;
                            return null;
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
                </div>

                {/* Tab strip — Overview | Notes | Diagnosis | Prescription | Chart */}
                <div className="shrink-0 flex border-b border-border/60 bg-card">
                  {([
                    { key: 'overview'     as const, label: 'Overview',    icon: <User className="h-3.5 w-3.5" /> },
                    { key: 'notes'        as const, label: 'Notes',       icon: <FileText className="h-3.5 w-3.5" /> },
                    { key: 'diagnosis'    as const, label: 'Diagnosis',   icon: <ClipboardList className="h-3.5 w-3.5" /> },
                    { key: 'prescription' as const, label: 'Rx',          icon: <Pill className="h-3.5 w-3.5" /> },
                    { key: 'chart'        as const, label: 'Chart',       icon: <Layers className="h-3.5 w-3.5" /> },
                  ]).map(({ key, label, icon }) => {
                    const isActive = patientModalTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setPatientModalTab(key)}
                        className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-2.5 min-h-[44px] text-xs font-semibold transition-all border-b-2 focus-visible:outline-none active:bg-muted/30 ${
                          isActive
                            ? 'text-primary border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30'
                        }`}
                        data-testid={`modal-tab-${key}-${b.id}`}
                      >
                        {icon}
                        <span className="text-xs leading-none">{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab panels */}
                <div className="overflow-y-auto flex-1">

                  {/* OVERVIEW TAB */}
                  {patientModalTab === 'overview' && (() => {
                    const drVisitType = (b as any).visitType || null;
                    const drTreatment = (b as any).treatmentCategory || null;
                    const drComplaints = b.description
                      ? DR_CHIEF_COMPLAINTS.filter(c => b.description!.toLowerCase().includes(c.toLowerCase()))
                      : [];
                    return (
                      <div className="px-4 pt-3 pb-4">
                        <div className="rounded-xl border border-green-800/30 bg-white dark:bg-card shadow-sm px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">

                          {/* Phone */}
                          <div className="flex items-center gap-1.5 text-xs min-w-0">
                            <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="text-muted-foreground shrink-0">Phone:</span>
                            {b.customerPhone ? (
                              <>
                                <a href={`tel:${b.customerPhone}`} className="font-semibold text-foreground truncate hover:text-primary transition-colors min-w-0">
                                  {b.customerPhone}
                                </a>
                                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(b.customerPhone!); notify.success("Phone copied!"); }} className="shrink-0 ml-auto h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors" title="Copy phone">
                                  <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                </button>
                                <a href={`tel:${b.customerPhone}`} className="shrink-0 h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors" title="Call patient">
                                  <Phone className="h-2.5 w-2.5 text-primary" />
                                </a>
                              </>
                            ) : (
                              <span className="text-muted-foreground/50">–</span>
                            )}
                          </div>

                          {/* Visit Type */}
                          <div className="flex items-center gap-1.5 text-xs min-w-0">
                            <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                              <Repeat2 className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="text-muted-foreground shrink-0">Visit Type:</span>
                            {drVisitType ? (
                              <span className="inline-flex items-center font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 px-1.5 py-0.5 rounded-md truncate">
                                {DR_VISIT_TYPE_LABELS[drVisitType] ?? drVisitType}
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
                            {b.consentSignedAt ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                                <CheckCircle2 className="h-2.5 w-2.5" />Signed ✓
                              </span>
                            ) : (b.consentToken || (b as any).consentUrl) ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md">
                                  <Clock className="h-2.5 w-2.5" />Sent
                                </span>
                                <button
                                  onClick={() => requestConsentMutation.mutate(b.id)}
                                  disabled={requestConsentMutation.isPending}
                                  className="h-[22px] w-[22px] inline-flex items-center justify-center rounded-md text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all disabled:opacity-50"
                                  title="Resend consent link"
                                >
                                  {requestConsentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={() => {
                                    const url = (b as any).consentUrl || `${window.location.origin}/consent/${b.consentToken}`;
                                    navigator.clipboard.writeText(url);
                                    notify.success("Consent link copied!");
                                  }}
                                  className="h-[22px] w-[22px] inline-flex items-center justify-center rounded-md text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all"
                                  title="Copy consent link"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => requestConsentMutation.mutate(b.id)}
                                disabled={requestConsentMutation.isPending}
                                className="inline-flex items-center gap-1 font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/15 active:scale-95 px-1.5 py-0.5 rounded-md transition-all disabled:opacity-50"
                              >
                                {requestConsentMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <PenLine className="h-2.5 w-2.5" />}
                                Send Link →
                              </button>
                            )}
                          </div>

                          {/* Treatment */}
                          <div className="flex items-center gap-1.5 text-xs min-w-0">
                            <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                              <Tag className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="text-muted-foreground shrink-0">Treatment:</span>
                            {drTreatment ? (
                              <span className="inline-flex items-center font-semibold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 rounded-md truncate">
                                {drTreatment}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">–</span>
                            )}
                          </div>

                          {/* Complaints — full width */}
                          <div className="col-span-2 flex items-start gap-1.5 text-xs min-w-0">
                            <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                              <ClipboardList className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="text-muted-foreground shrink-0 pt-0.5">Complaints:</span>
                            {drComplaints.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {drComplaints.map((c, idx) => (
                                  <span key={idx} className="inline-flex items-center font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50 pt-0.5">–</span>
                            )}
                          </div>

                          {/* Clinical Status — full width, conditional */}
                          {b.clinicalStatus && DR_CLINICAL_STATUS[b.clinicalStatus] && (
                            <div className="col-span-2 flex items-center gap-1.5 text-xs min-w-0">
                              <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                <ClipboardCheck className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <span className="text-muted-foreground shrink-0">Clinical:</span>
                              <span className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-md border ${DR_CLINICAL_STATUS[b.clinicalStatus].cls}`}>
                                {DR_CLINICAL_STATUS[b.clinicalStatus].label}
                              </span>
                            </div>
                          )}

                          {/* Confirmed by — full width, conditional */}
                          {(() => {
                            const cb = (b as any).confirmedBy;
                            const das = b.doctorApprovalStatus;
                            const confirmedByLabel =
                              cb === 'doctor' ? `Dr. ${b.assignedDoctor?.split(' ')[0] || 'Doctor'}` :
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

                      </div>
                    );
                  })()}

                  {/* NOTES TAB */}
                  {patientModalTab === 'notes' && (
                    <div className="p-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clinical Status</Label>
                        <div className="flex gap-2">
                          <Select value={statusDraft} onValueChange={setStatusDraft}>
                            <SelectTrigger className="h-9 text-sm flex-1" data-testid="select-clinical-status">
                              <SelectValue placeholder="Select status…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="follow_up_required">Follow-up Required</SelectItem>
                              <SelectItem value="case_closed">Case Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            className="h-9 px-4 text-sm shrink-0"
                            onClick={() => {
                              saveNotesMutation.mutate({ id: b.id, clinicalStatus: statusDraft });
                            }}
                            disabled={saveNotesMutation.isPending}
                            data-testid="button-save-clinical-status"
                          >
                            {saveNotesMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                          </Button>
                          {b.visitStatus === 'in_consultation' && (
                            <Button
                              size="sm"
                              className="h-9 px-4 text-sm shrink-0 bg-teal-600 hover:bg-teal-700 text-white"
                              onClick={() => completeVisitMutation.mutate(b.id)}
                              disabled={completeVisitMutation.isPending}
                              data-testid="button-mark-visit-done-notes"
                            >
                              {completeVisitMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Mark Visit Done"}
                            </Button>
                          )}
                        </div>
                      </div>
                      <BookingNotesThread bookingId={b.id} authorType="doctor" />
                    </div>
                  )}

                  {/* DIAGNOSIS TAB */}
                  {patientModalTab === 'diagnosis' && (
                    <div className="p-4">
                      <ClinicalRecordsTab
                        bookingId={b.id}
                        clinicId={b.clinicId}
                        patientName={b.customerName}
                        patientPhone={b.customerPhone}
                        doctorName={profName || b.assignedDoctor}
                        mode="doctor"
                        clinicName={modalClinicName}
                        hideTabBar
                        defaultTab="diagnosis"
                      />
                    </div>
                  )}

                  {/* PRESCRIPTION TAB */}
                  {patientModalTab === 'prescription' && (
                    <div className="p-4">
                      <ClinicalRecordsTab
                        bookingId={b.id}
                        clinicId={b.clinicId}
                        patientName={b.customerName}
                        patientPhone={b.customerPhone}
                        doctorName={profName || b.assignedDoctor}
                        mode="doctor"
                        clinicName={modalClinicName}
                        hideTabBar
                        defaultTab="prescription"
                      />
                    </div>
                  )}

                  {/* CHART TAB — Odontogram */}
                  {patientModalTab === 'chart' && (() => {
                    const bIsTerminal = b.verificationStatus === 'cancelled' || b.verificationStatus === 'no_show' || (b as any).visitStatus === 'patient_left_early';
                    const bIsVisitCompleted = (b as any).visitStatus === 'completed';
                    const chartEditable = !bIsTerminal && !bIsVisitCompleted;
                    const bRef = `REF-${String(b.id).padStart(4, '0')}`;
                    const bDoctorName = profName || b.assignedDoctor || 'Doctor';
                    return (
                      <OdontogramTab
                        bookingId={b.id}
                        bookingRef={bRef}
                        doctorName={bDoctorName}
                        isEditable={chartEditable}
                      />
                    );
                  })()}
                </div>

                {/* ── STICKY FOOTER — lifecycle action buttons ── */}
                <div className="shrink-0 px-4 py-2.5 border-t border-border/50 bg-muted/10 space-y-2">
                  {(() => {
                    const bIsTerminal = b.verificationStatus === 'cancelled' || b.verificationStatus === 'no_show' || (b as any).visitStatus === 'patient_left_early';
                    const bIsNoShow = b.verificationStatus === 'no_show';
                    const bIsCancelled = b.verificationStatus === 'cancelled';
                    const bIsVisitCompleted = (b as any).visitStatus === 'completed';
                    const bIsTreatmentCompleted = (b as any).visitStatus === 'treatment_completed';
                    const bIsInConsultation = (b as any).visitStatus === 'in_consultation';
                    const bIsCheckedIn = (b as any).visitStatus === 'checked_in';
                    const bIsPending = b.doctorApprovalStatus === 'pending';
                    const bIsDeclined = b.doctorApprovalStatus === 'declined';

                    return (
                      <>
                        {bIsDeclined && (
                          <div className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Appointment Declined</span>
                          </div>
                        )}

                        {bIsPending && !bIsVisitCompleted && !bIsTreatmentCompleted && !bIsTerminal && (
                          <div className="flex gap-2">
                            <Button size="sm"
                              className="flex-1 h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-white gap-1.5 active:scale-[0.98]"
                              onClick={() => approveMutation.mutate(b.id)} disabled={approveMutation.isPending || declineMutation.isPending}
                              data-testid={`modal-button-approve-${b.id}`}>
                              {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Accept
                            </Button>
                            <Button size="sm" variant="outline"
                              className="flex-1 h-11 text-sm font-semibold border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 dark:hover:bg-rose-950/20 gap-1.5 active:scale-[0.98]"
                              onClick={() => declineMutation.mutate(b.id)} disabled={approveMutation.isPending || declineMutation.isPending}
                              data-testid={`modal-button-decline-${b.id}`}>
                              {declineMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                              Decline
                            </Button>
                          </div>
                        )}

                        {bIsTerminal && (
                          <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-muted/40 border border-border/40">
                            <span className="text-xs text-muted-foreground">
                              {bIsNoShow ? "Patient did not arrive" : bIsCancelled ? "Appointment cancelled" : "Patient left before completion"}
                            </span>
                          </div>
                        )}

                        {!bIsPending && !bIsTerminal && !bIsCheckedIn && !bIsInConsultation && !bIsTreatmentCompleted && !bIsVisitCompleted && (
                          <TooltipProvider delayDuration={700}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-full cursor-not-allowed">
                                  <Button
                                    variant="outline"
                                    className="w-full h-11 text-sm font-medium text-muted-foreground border-border/60 bg-muted/20 gap-2 pointer-events-none"
                                    disabled tabIndex={-1}
                                    data-testid={`modal-button-booked-${b.id}`}
                                  >
                                    <CalendarDays className="h-3.5 w-3.5" />Booked — Waiting for Arrival
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                                Waiting for patient to arrive — no action required
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {bIsCheckedIn && (
                          <>
                            <Button
                              className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-2 active:scale-[0.98] transition-all"
                              onClick={() => startConsultationMutation.mutate(b.id)}
                              disabled={startConsultationMutation.isPending}
                              data-testid={`modal-button-start-consultation-${b.id}`}
                            >
                              {startConsultationMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                              Start Consultation
                            </Button>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm"
                                className="flex-1 h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                                onClick={() => { setPatientModalTab('notes'); setStatusDraft(b.clinicalStatus || ""); }}
                                data-testid={`modal-button-notes-arrived-${b.id}`}>
                                <FileText className="h-3 w-3" />View Notes
                              </Button>
                              <Button variant="outline" size="sm"
                                className="flex-1 h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                                onClick={() => setPatientModalTab('diagnosis')}
                                data-testid={`modal-button-add-observation-${b.id}`}>
                                <ClipboardList className="h-3 w-3" />Add Observation
                              </Button>
                            </div>
                          </>
                        )}

                        {bIsInConsultation && (
                          <>
                            <Button
                              className="w-full h-11 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white gap-2 active:scale-[0.98] transition-all"
                              onClick={() => completeVisitMutation.mutate(b.id)}
                              disabled={completeVisitMutation.isPending}
                              data-testid={`modal-button-done-patient-${b.id}`}
                            >
                              {completeVisitMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Done with Patient
                            </Button>
                            <div className="flex gap-1.5">
                              <Button variant="outline" size="sm"
                                className="flex-1 h-9 text-xs font-medium gap-1 active:scale-[0.98]"
                                onClick={() => setPatientModalTab('diagnosis')}
                                data-testid={`modal-button-add-obs-${b.id}`}>
                                <ClipboardList className="h-3 w-3" />Add Obs.
                              </Button>
                              <Button variant="outline" size="sm"
                                className="flex-1 h-9 text-xs font-medium gap-1 active:scale-[0.98]"
                                onClick={() => { setPatientModalTab('notes'); setStatusDraft(b.clinicalStatus || ""); }}
                                data-testid={`modal-button-notes-consult-${b.id}`}>
                                <FileText className="h-3 w-3" />Notes
                              </Button>
                              <Button size="sm"
                                className="flex-1 h-9 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 gap-1 active:scale-[0.98]"
                                onClick={() => setPatientModalTab('prescription')}
                                data-testid={`modal-button-issue-rx-${b.id}`}>
                                <Stethoscope className="h-3 w-3" />Issue Rx
                              </Button>
                            </div>
                          </>
                        )}

                        {bIsTreatmentCompleted && !bIsVisitCompleted && (
                          <>
                            <TooltipProvider delayDuration={700}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full cursor-not-allowed">
                                    <Button
                                      variant="outline"
                                      className="w-full h-11 text-sm font-medium text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/10 gap-2 pointer-events-none"
                                      disabled tabIndex={-1}
                                      data-testid={`modal-button-consult-complete-${b.id}`}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />Consultation Completed
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
                                  Your consultation is done — waiting for the clinic to close the visit
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm"
                                className="flex-1 h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                                onClick={() => { setPatientModalTab('notes'); setStatusDraft(b.clinicalStatus || ""); }}
                                data-testid={`modal-button-notes-tmt-${b.id}`}>
                                <FileText className="h-3 w-3" />View Notes
                              </Button>
                              <Button variant="outline" size="sm"
                                className="flex-1 h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                                onClick={() => setPatientModalTab('diagnosis')}
                                data-testid={`modal-button-view-rx-${b.id}`}>
                                <ClipboardList className="h-3 w-3" />View Rx / Rec
                              </Button>
                            </div>
                          </>
                        )}

                        {bIsVisitCompleted && (
                          <>
                            <TooltipProvider delayDuration={700}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full cursor-not-allowed">
                                    <Button
                                      variant="outline"
                                      className="w-full h-11 text-sm font-medium text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/10 gap-2 pointer-events-none"
                                      disabled tabIndex={-1}
                                      data-testid={`modal-button-visit-complete-${b.id}`}
                                    >
                                      <ShieldCheck className="h-3.5 w-3.5" />Visit Completed
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                                  Visit complete — managed by the clinic
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button variant="outline" size="sm"
                              className="w-full h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                              onClick={() => setPatientModalTab('notes')}
                              data-testid={`modal-button-view-summary-${b.id}`}>
                              <ClipboardList className="h-3 w-3" />View Summary
                            </Button>
                          </>
                        )}

                        {!bIsPending && !bIsCheckedIn && !bIsInConsultation && !bIsTreatmentCompleted && !bIsVisitCompleted && !bIsTerminal && !bIsDeclined && (
                          <Button variant="outline" size="sm"
                            className="w-full h-9 text-xs font-medium gap-1.5 active:scale-[0.98]"
                            onClick={() => { setPatientModalTab('notes'); setStatusDraft(b.clinicalStatus || ""); }}
                            data-testid={`modal-button-notes-${b.id}`}>
                            <FileText className="h-3 w-3" />View Notes
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Certification Sheet ── */}
      <Sheet open={certSheetOpen} onOpenChange={(o) => { if (!o) closeCertSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" />{editingCert ? "Edit Certification" : "Add Certification"}</SheetTitle>
            <SheetDescription>Certifications appear on your public profile under your credentials.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={certTitle} onChange={e => setCertTitle(e.target.value)} placeholder="e.g. Fellowship in Implantology" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Issuing Body</Label><Input value={certIssuer} onChange={e => setCertIssuer(e.target.value)} placeholder="e.g. IDA" /></div>
              <div className="space-y-2"><Label>Year</Label><Input value={certYear} onChange={e => setCertYear(e.target.value)} placeholder="2022" maxLength={4} /></div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={certDesc} onChange={e => setCertDesc(e.target.value)} placeholder="Brief description of the certification..." className="resize-none h-20" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />Certificate Image URL</Label>
              <Input value={certImageUrl} onChange={e => setCertImageUrl(e.target.value)} placeholder="https://..." />
              {certImageUrl && <img src={certImageUrl} alt="Preview" className="w-full rounded-xl aspect-video object-cover border border-border/40" />}
            </div>
            <Button className="w-full bg-gradient-to-r from-primary to-accent text-white font-semibold" onClick={saveCert} disabled={!certTitle || createCertMutation.isPending || updateCertMutation.isPending}>
              {(createCertMutation.isPending || updateCertMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {editingCert ? "Save Changes" : "Add Certification"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Case Sheet ── */}
      <Sheet open={caseSheetOpen} onOpenChange={(o) => { if (!o) closeCaseSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />{editingCase ? "Edit Case Study" : "Add Case Study"}</SheetTitle>
            <SheetDescription>Document your clinical cases with media. Visible on your public profile.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Case Title <span className="text-destructive">*</span></Label>
              <Input value={caseTitle} onChange={e => setCaseTitle(e.target.value)} placeholder="e.g. Full Mouth Rehabilitation" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={caseDesc} onChange={e => setCaseDesc(e.target.value)} placeholder="Describe the case, treatment approach, and outcome..." className="resize-none h-28" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-muted-foreground" />Tags <span className="text-muted-foreground font-normal text-xs">(comma separated)</span></Label>
              <Input value={caseTags} onChange={e => setCaseTags(e.target.value)} placeholder="Implants, Surgery, Before-After" />
              {caseTags && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {caseTags.split(",").map(t => t.trim()).filter(Boolean).map((t, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{t}</span>)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />Before &amp; After Photos</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["before", "after"] as const).map((slot) => {
                  const url = slot === "before" ? caseBeforeUrl : caseAfterUrl;
                  const setUrl = slot === "before" ? setCaseBeforeUrl : setCaseAfterUrl;
                  const uploading = slot === "before" ? caseBeforeUploading : caseAfterUploading;
                  const optimising = slot === "before" ? caseBeforeOptimising : caseAfterOptimising;
                  const ref = slot === "before" ? caseBeforeInputRef : caseAfterInputRef;
                  return (
                    <div key={slot} className="space-y-1.5">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{slot === "before" ? "Before" : "After"}</span>
                      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleCaseMediaUpload(slot, e)} />
                      {url ? (
                        <div className="relative rounded-xl overflow-hidden border border-border/40 aspect-video bg-muted/30 group">
                          {isVideo(url) ? <div className="w-full h-full flex items-center justify-center"><Play className="h-7 w-7 text-primary/60" /></div> : <img src={url} alt={slot} className="w-full h-full object-cover" />}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button onClick={() => ref.current?.click()} className="text-white text-xs bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/30 transition-colors">Replace</button>
                            <button onClick={() => setUrl("")} className="text-white text-xs bg-destructive/60 border border-white/20 rounded-lg px-3 py-1.5 hover:bg-destructive/80 transition-colors">Remove</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => ref.current?.click()} disabled={uploading || optimising} className="w-full aspect-video rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          {optimising ? <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> : uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                          <span className="text-xs">{optimising ? <span className="text-amber-600 dark:text-amber-400 font-medium">Optimising…</span> : uploading ? "Uploading…" : <>Upload {slot === "before" ? "Before" : "After"}<br />photo</>}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <Button className="w-full bg-gradient-to-r from-primary to-accent text-white font-semibold" onClick={saveCase} disabled={!caseTitle || createCaseMutation.isPending || updateCaseMutation.isPending}>
              {(createCaseMutation.isPending || updateCaseMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {editingCase ? "Save Changes" : "Add Case Study"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Change Password Dialog */}
      <Dialog open={changePwdOpen} onOpenChange={setChangePwdOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              {(doctor as any).isDefaultPassword
                ? "You're using a temporary password. Set a new secure password below."
                : "Enter your current password and choose a new one."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!(doctor as any).isDefaultPassword && (
              <div className="space-y-1.5">
                <Label htmlFor="cp-current">Current Password</Label>
                <Input
                  id="cp-current"
                  type="password"
                  placeholder="Current password"
                  value={changePwdCurrent}
                  onChange={e => setChangePwdCurrent(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cp-new">New Password</Label>
              <Input
                id="cp-new"
                type="password"
                placeholder="Min. 8 characters"
                value={changePwdNew}
                onChange={e => setChangePwdNew(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm">Confirm New Password</Label>
              <Input
                id="cp-confirm"
                type="password"
                placeholder="Re-enter new password"
                value={changePwdConfirm}
                onChange={e => setChangePwdConfirm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePwdOpen(false)} disabled={changePwdMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => changePwdMutation.mutate({
                currentPassword: changePwdCurrent || undefined,
                newPassword: changePwdNew,
                confirmPassword: changePwdConfirm,
              })}
              disabled={changePwdMutation.isPending || !changePwdNew || !changePwdConfirm}
              className="bg-primary text-white"
            >
              {changePwdMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
