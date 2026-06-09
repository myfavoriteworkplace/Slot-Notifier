import { useEffect, useState, useRef } from "react";
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
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, LogOut, Stethoscope, Building2, Calendar, ShieldAlert, Clock,
  ClipboardList, CheckCircle2, AlertCircle, Hash, CalendarDays, TrendingUp, ArrowRight,
  Info, X, Filter, BadgeCheck, RotateCcw, User, Award, BookOpen, Plus, Pencil, Trash2,
  Copy, Check, Link as LinkIcon, Image as ImageIcon, Tag, GraduationCap, Star, Eye,
  Upload, Play, Globe, Share2, FileText, ChevronDown, ChevronUp, BriefcaseMedical, KeyRound,
  MoreHorizontal, CalendarOff, Phone, Pill
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Clinic, DoctorCertification, DoctorCase, DoctorLeave } from "@shared/schema";
import { format, differenceInCalendarDays } from "date-fns";
import { compressImage } from "@/lib/imageCompression";
import { AppointmentCard } from "@/components/AppointmentCard";

type QuickFilter = "all" | "today" | "upcoming" | "awaiting" | "pending-7days" | "confirmed-7days";
type Tab = "appointments" | "profile" | "certifications" | "cases" | "leaves";

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com");
}

function MediaThumb({ url }: { url: string }) {
  if (isVideo(url)) {
    return (
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted/40 flex items-center justify-center border border-border/40 group">
        <Play className="h-8 w-8 text-primary/60 group-hover:text-primary transition-colors" />
        <span className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/70 rounded px-1">Video</span>
      </div>
    );
  }
  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-muted/40 border border-border/40">
      <img src={url} alt="Case media" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
}

export default function DoctorDashboard() {
  const { doctor, isLoading, isAuthenticated, logout, isLoggingOut } = useDoctorAuth();
  const [_, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>("appointments");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [appointmentDateFilter, setAppointmentDateFilter] = useState<string>("");
  const [appointmentClinicFilter, setAppointmentClinicFilter] = useState<string>("all");
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
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
  const [patientModalTab, setPatientModalTab] = useState<'notes' | 'diagnosis' | 'prescription'>('notes');
  const [statusDraft, setStatusDraft] = useState("");

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
    if (!isLoading && !isAuthenticated) setLocation("/clinic-login");
  }, [isLoading, isAuthenticated, setLocation]);

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
    enabled: isAuthenticated,
  });

  const { data: bookings = [], isLoading: isBookingsLoading } = useQuery({
    queryKey: ["/api/auth/clinic/bookings"],
    enabled: isAuthenticated,
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

  const allBookings = Array.isArray(bookings) ? bookings : [];
  const myBookings = allBookings.filter((b: any) => b.assignedDoctorEmail === (doctor as any).email);
  const awaitingBookings = myBookings.filter((b: any) => b.doctorApprovalStatus === 'pending');
  const confirmedBookings = myBookings.filter((b: any) => b.doctorApprovalStatus !== 'pending' && b.doctorApprovalStatus !== 'declined');
  const todayStr = new Date().toISOString().split("T")[0];
  const todayBookings = confirmedBookings.filter((b: any) => {
    const d = b.slot?.startTime ? new Date(b.slot.startTime).toISOString().split("T")[0] : "";
    return d === todayStr;
  });
  const upcomingBookings = confirmedBookings.filter((b: any) => {
    const d = b.slot?.startTime ? new Date(b.slot.startTime) : null;
    return d && d >= new Date();
  });

  const now = new Date();
  const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pendingNext7Count = awaitingBookings.filter((b: any) => {
    const d = b.slot?.startTime ? new Date(b.slot.startTime) : null;
    return d && d >= now && d <= next7;
  }).length;
  const confirmedNext7Count = confirmedBookings.filter((b: any) => {
    const d = b.slot?.startTime ? new Date(b.slot.startTime) : null;
    return d && d >= now && d <= next7;
  }).length;

  const handleQuickFilter = (f: QuickFilter) => { setQuickFilter(f); setAppointmentDateFilter(""); };

  const filteredBookings = (quickFilter === "awaiting" || quickFilter === "pending-7days" ? awaitingBookings : confirmedBookings).filter((b: any) => {
    const matchesClinic = appointmentClinicFilter === "all" || b.clinicId === parseInt(appointmentClinicFilter);
    const bd = b.slot?.startTime ? new Date(b.slot.startTime).toISOString().split("T")[0] : "";
    const bdt = b.slot?.startTime ? new Date(b.slot.startTime) : null;
    let matchesDate = true;
    if (quickFilter === "today") matchesDate = bd === todayStr;
    else if (quickFilter === "upcoming") matchesDate = bdt ? bdt >= new Date() : false;
    else if (quickFilter === "pending-7days") matchesDate = bdt ? bdt >= now && bdt <= next7 : false;
    else if (quickFilter === "confirmed-7days") matchesDate = bdt ? bdt >= now && bdt <= next7 : false;
    else matchesDate = !appointmentDateFilter || bd === appointmentDateFilter;
    return matchesClinic && matchesDate;
  });

  const greet = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";

  const NAV_ITEMS = [
    { key: "appointments"  as Tab, label: "Appointments",     subtitle: "Today's schedule",      icon: Calendar,    activeClass: "bg-primary/10 border-primary/20 text-primary",                                    iconClass: "bg-primary/10 border-primary/20 text-primary",              dotClass: "bg-primary" },
    { key: "profile"       as Tab, label: "My Profile",       subtitle: "Edit your details",     icon: User,        activeClass: "bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-400",     iconClass: "bg-violet-500/10 border-violet-500/20 text-violet-600",     dotClass: "bg-violet-500" },
    { key: "certifications"as Tab, label: "Certifications",   subtitle: "Degrees & awards",      icon: Award,       activeClass: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",             iconClass: "bg-blue-500/10 border-blue-500/20 text-blue-600",           dotClass: "bg-blue-500" },
    { key: "cases"         as Tab, label: "Case Studies",     subtitle: "Patient cases",         icon: BookOpen,    activeClass: "bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-400",             iconClass: "bg-teal-500/10 border-teal-500/20 text-teal-600",           dotClass: "bg-teal-500" },
    { key: "leaves"        as Tab, label: "Leave Management", subtitle: "Time off & availability",icon: CalendarOff, activeClass: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",         iconClass: "bg-amber-500/10 border-amber-500/20 text-amber-600",        dotClass: "bg-amber-500" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">

      {/* Temporary password warning */}
      {(doctor as any).isDefaultPassword && (
        <div className="bg-gradient-to-r from-amber-500/90 via-yellow-500/90 to-amber-500/90 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 flex-wrap">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">You are using a temporary password. Please change it to keep your account secure.</span>
          <span className="sm:hidden">Temporary password in use — please update it.</span>
          <button
            onClick={() => setChangePwdOpen(true)}
            className="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 border border-white/40 text-white text-xs font-semibold px-3 py-1 rounded-full transition-colors"
          >
            <KeyRound className="h-3 w-3" />
            Change Password →
          </button>
        </div>
      )}

      {/* ═══ PAGE CONTAINER — single wrapper for hero + content (matches ClinicDashboard) ═══ */}
      <div className="container mx-auto px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">

      {/* ═══ DOCTOR HERO BAR ═══ */}
      <div className="rounded-2xl overflow-hidden shadow-2xl mb-6 sm:mb-8 border border-white/10">

        {/* Top neon accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Main hero band */}
        <div className="relative bg-gradient-to-br from-[#052B22] via-[#085041] to-[#0A5540] px-4 py-4 sm:px-7 sm:py-6 overflow-hidden">

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

          {/* ── Row 1: Identity + Sign Out ── */}
          <div className="relative flex items-start justify-between gap-4">

            {/* Left: avatar + identity */}
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <Avatar className="h-12 w-12 sm:h-16 sm:w-16 ring-2 ring-white/30 shadow-md shrink-0">
                <AvatarImage src={(doctor as any).imageUrl || undefined} />
                <AvatarFallback className="bg-white/20 text-white font-bold text-lg sm:text-xl">
                  {(doctor as any).name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs text-white/50 font-medium mb-0.5">Good {greet},</p>
                <h1 className="text-base sm:text-3xl font-extrabold text-white tracking-tight leading-tight truncate">
                  Dr. {(doctor as any).name}
                </h1>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {(doctor as any).specialization && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full">
                      <Stethoscope className="h-3 w-3" />
                      {(doctor as any).specialization}
                    </span>
                  )}
                  {(doctor as any).degree && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-white/50 bg-white/[0.06] border border-white/15 px-2.5 py-1 rounded-full">
                      {(doctor as any).degree}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50 bg-white/[0.06] border border-white/15 px-2.5 py-1 rounded-full">
                    <Building2 className="h-3 w-3" />
                    {(doctor as any).clinicName}
                  </span>
                </div>
              </div>
            </div>

            {/* Sign Out */}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="shrink-0 min-h-[44px] px-3 text-white/70 hover:text-white hover:bg-white/15 active:bg-white/25 active:scale-[0.97] border border-white/20 gap-2 text-xs transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline font-semibold">Sign Out</span>
            </Button>
          </div>

          {/* ── Row 2: Live stats ── */}
          <div className="relative mt-5 pt-4 border-t border-white/[0.10] grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Confirmed Bookings Today",            shortLabel: "Confirmed Today",       subTag: null,          filter: "today" as QuickFilter,           tooltip: "Appointments assigned to you today that have been confirmed.",                                          count: todayBookings.length,    Icon: Calendar,      text: "text-sky-300",     bg: "bg-sky-400/10",     border: "border-sky-400/20" },
              { label: "Confirmed Bookings (Next 7 Days)",    shortLabel: "Confirmed Bookings",    subTag: "Next 7 Days", filter: "confirmed-7days" as QuickFilter, tooltip: "Appointments assigned to you in the next 7 days that are confirmed and locked in.",                    count: confirmedNext7Count,     Icon: CheckCircle2,  text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
              { label: "Pending Confirmations (Next 7 Days)", shortLabel: "Pending Confirmations", subTag: "Next 7 Days", filter: "pending-7days" as QuickFilter, tooltip: "Bookings in the next 7 days that are still waiting for your approval. These need your attention.",       count: pendingNext7Count,       Icon: Clock,         text: "text-amber-300",   bg: "bg-amber-400/10",   border: "border-amber-400/20" },
              { label: "All Pending Bookings",                shortLabel: "All Pending",           subTag: null,          filter: "awaiting" as QuickFilter,        tooltip: "Total bookings assigned to you that are still awaiting your approval — across all dates.",             count: awaitingBookings.length, Icon: TrendingUp,    text: "text-rose-300",    bg: "bg-rose-400/10",    border: "border-rose-400/20" },
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
                        <p className="text-2xl sm:text-lg font-extrabold text-white leading-none tabular-nums">{count}</p>
                        <p className={`text-xs font-semibold mt-1 ${text} leading-snug`}>{shortLabel}</p>
                        {subTag && (
                          <span className={`inline-block text-xs font-medium ${text} opacity-60 mt-0.5 leading-none`}>{subTag}</span>
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
        </div>

        {/* Bottom accent line */}
        <div className="h-[2px] bg-gradient-to-r from-accent via-primary to-accent opacity-60" />
      </div>

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
                    <p className="text-[10px] text-muted-foreground">{subtitle}</p>
                  </div>
                  {isActive && <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />}
                  {key === "appointments" && awaitingBookings.length > 0 && !isActive && (
                    <span className="text-[10px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none shrink-0">{awaitingBookings.length}</span>
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
              <div className="relative rounded-2xl overflow-hidden bg-white p-3 border border-border/40 shadow-inner w-full flex items-center justify-center">
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
              <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
                Patients scan to view your profile
              </p>
              {/* URL row */}
              <div className="w-full rounded-xl border border-border/50 bg-muted/30 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Profile URL</p>
                    <p className="text-[10px] text-foreground truncate font-mono mt-0.5">/doctor/{(doctor as any).username || (doctor as any).id}</p>
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
              {/* Mobile sticky filter bar — must live OUTSIDE space-y-5 to avoid phantom top margin */}
              <div className="flex items-center gap-2 overflow-x-auto sm:hidden -mx-4 px-4 py-2.5 sticky top-0 z-10 bg-muted/60 backdrop-blur-md border-b border-border/30" style={{ scrollbarWidth: "none" }}>
                {([
                  { filter: "today"    as QuickFilter, label: "All Bookings Today" },
                  { filter: "upcoming" as QuickFilter, label: "All Upcoming Bookings" },
                  { filter: "awaiting" as QuickFilter, label: "Awaiting", badge: awaitingBookings.length },
                  { filter: "all"      as QuickFilter, label: "All Bookings" },
                ] as { filter: QuickFilter; label: string; badge?: number }[]).map(({ filter, label, badge }) => {
                  const isActive = quickFilter === filter;
                  return (
                    <button
                      key={filter}
                      onClick={() => { setActiveTab("appointments"); handleQuickFilter(filter); }}
                      className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all active:scale-[0.97] min-h-[44px] whitespace-nowrap ${
                        isActive
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-background border-border/50 text-muted-foreground"
                      }`}
                      data-testid={`filter-btn-${filter}`}
                    >
                      {label}
                      {badge !== undefined && badge > 0 && (
                        <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center ${isActive ? "bg-white/25 text-white" : "bg-amber-500 text-white"}`}>{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-5" ref={appointmentsSectionRef}>

              {/* Panel header */}
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
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
              {awaitingBookings.length > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/40 px-4 py-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 leading-tight">
                      {awaitingBookings.length} appointment{awaitingBookings.length !== 1 ? "s" : ""} awaiting your approval
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

              {/* Desktop card grid */}
              <div className="hidden sm:grid sm:grid-cols-4 gap-2 sm:gap-3 min-w-0">
                {/* Today */}
                <TooltipProvider delayDuration={700}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card
                        className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${quickFilter === 'today' ? 'ring-2 ring-sky-400 border-sky-400/60' : 'border-border/50'}`}
                        onClick={() => { setActiveTab("appointments"); handleQuickFilter("today"); }}
                        data-testid="stat-today"
                      >
                        <div className="h-1 bg-gradient-to-r from-sky-400 to-cyan-400" />
                        <CardContent className="p-3 sm:p-4 text-left flex items-start gap-2 sm:gap-3 min-h-[64px]">
                          <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${quickFilter === 'today' ? 'bg-sky-400/20' : 'bg-sky-400/10'}`}>
                            <Calendar className="h-3.5 w-3.5 text-sky-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-base sm:text-xl font-bold text-sky-600 dark:text-sky-400 leading-tight">{todayBookings.length}</p>
                            <p className="text-xs font-medium text-muted-foreground leading-tight">All Bookings Today</p>
                          </div>
                          <div className="shrink-0 w-14 flex justify-end">
                            {quickFilter === 'today' && (
                              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded-full">Active</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>Today's appointments</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Upcoming */}
                <TooltipProvider delayDuration={700}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card
                        className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${quickFilter === 'upcoming' ? 'ring-2 ring-primary border-primary/60' : 'border-border/50'}`}
                        onClick={() => { setActiveTab("appointments"); handleQuickFilter("upcoming"); }}
                        data-testid="stat-upcoming"
                      >
                        <div className="h-1 bg-gradient-to-r from-primary to-accent" />
                        <CardContent className="p-3 sm:p-4 text-left flex items-start gap-2 sm:gap-3 min-h-[64px]">
                          <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${quickFilter === 'upcoming' ? 'bg-primary/20' : 'bg-primary/10'}`}>
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-base sm:text-xl font-bold text-primary leading-tight">{upcomingBookings.length}</p>
                            <p className="text-xs font-medium text-muted-foreground leading-tight">All Upcoming Bookings</p>
                          </div>
                          <div className="shrink-0 w-14 flex justify-end">
                            {quickFilter === 'upcoming' && (
                              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Active</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>Future appointments beyond today</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Awaiting */}
                <TooltipProvider delayDuration={700}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card
                        className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${quickFilter === 'awaiting' ? 'ring-2 ring-amber-400 border-amber-400/60' : 'border-border/50'}`}
                        onClick={() => { setActiveTab("appointments"); handleQuickFilter("awaiting"); }}
                        data-testid="stat-awaiting"
                      >
                        <div className={`h-1 bg-gradient-to-r ${awaitingBookings.length > 0 ? 'from-amber-400 to-yellow-400' : 'from-slate-300 to-slate-200'}`} />
                        <CardContent className="p-3 sm:p-4 text-left flex items-start gap-2 sm:gap-3 min-h-[64px]">
                          <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${quickFilter === 'awaiting' ? 'bg-amber-400/20' : awaitingBookings.length > 0 ? 'bg-amber-400/10' : 'bg-muted'}`}>
                            <AlertCircle className={`h-3.5 w-3.5 ${awaitingBookings.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-base sm:text-xl font-bold leading-tight ${awaitingBookings.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>{awaitingBookings.length}</p>
                            <p className="text-xs font-medium text-muted-foreground leading-tight">Awaiting Approval</p>
                          </div>
                          <div className="shrink-0 w-14 flex justify-end">
                            {quickFilter === 'awaiting' ? (
                              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Active</span>
                            ) : awaitingBookings.length > 0 ? (
                              <span className="text-[9px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none">{awaitingBookings.length}</span>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>Appointments needing your approval</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Total */}
                <TooltipProvider delayDuration={700}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card
                        className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${quickFilter === 'all' ? 'ring-2 ring-slate-400 border-slate-400/60' : 'border-border/50'}`}
                        onClick={() => { setActiveTab("appointments"); handleQuickFilter("all"); }}
                        data-testid="stat-all"
                      >
                        <div className="h-1 bg-gradient-to-r from-slate-400 to-slate-300" />
                        <CardContent className="p-3 sm:p-4 text-left flex items-start gap-2 sm:gap-3 min-h-[64px]">
                          <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${quickFilter === 'all' ? 'bg-slate-400/20' : 'bg-slate-400/10'}`}>
                            <ClipboardList className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-base sm:text-xl font-bold text-slate-600 dark:text-slate-400 leading-tight">{confirmedBookings.length}</p>
                            <p className="text-xs font-medium text-muted-foreground leading-tight">All Bookings</p>
                          </div>
                          <div className="shrink-0 w-14 flex justify-end">
                            {quickFilter === 'all' && (
                              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded-full">Active</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>All confirmed appointments</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Filters — date + clinic side-by-side */}
              <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                {quickFilter === "all" && (
                  <div className="relative flex-1 min-w-[130px] sm:flex-none sm:w-44">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input type="date" className="pl-9 h-9 w-full" value={appointmentDateFilter} onChange={(e) => setAppointmentDateFilter(e.target.value)} />
                  </div>
                )}
                <div className={quickFilter === "all" ? "flex-1 min-w-[130px] sm:flex-none" : "w-full sm:w-auto"}>
                  <Select value={appointmentClinicFilter} onValueChange={setAppointmentClinicFilter}>
                    <SelectTrigger className="h-9 w-full sm:w-[170px]"><SelectValue placeholder="All Clinics" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clinics</SelectItem>
                      {doctorClinics.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {(appointmentDateFilter || appointmentClinicFilter !== "all" || quickFilter !== "all") && (
                  <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground shrink-0" onClick={() => { setQuickFilter("all"); setAppointmentDateFilter(""); setAppointmentClinicFilter("all"); }}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Clear
                  </Button>
                )}
              </div>

              {/* Dynamic section heading — matches clinic dashboard booking header style */}
              <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
                <div className="bg-gradient-to-r from-primary to-accent px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {quickFilter === "today"          ? "Today's Appointments"
                       : quickFilter === "upcoming"     ? "Upcoming Appointments"
                       : quickFilter === "awaiting"     ? "All Pending Bookings"
                       : quickFilter === "confirmed-7days" ? "Confirmed Bookings (Next 7 Days)"
                       : quickFilter === "pending-7days"   ? "Pending Confirmations (Next 7 Days)"
                       : appointmentDateFilter          ? "Filtered Appointments"
                       : "All Appointments"}
                    </h2>
                    <p className="text-white/70 text-xs mt-0.5">
                      {quickFilter === "today"          ? "Appointments assigned to you today"
                       : quickFilter === "upcoming"     ? "Future appointments beyond today"
                       : quickFilter === "awaiting"     ? "All unconfirmed bookings across all dates"
                       : quickFilter === "confirmed-7days" ? "Confirmed appointments in the next 7 days"
                       : quickFilter === "pending-7days"   ? "Pending confirmations in the next 7 days"
                       : appointmentDateFilter          ? "Showing custom date range"
                       : "All your patient appointments"}
                    </p>
                  </div>
                  <span className="text-white/60 text-sm font-semibold tabular-nums">
                    {filteredBookings.length} {filteredBookings.length === 1 ? "appointment" : "appointments"}
                  </span>
                </div>
              </div>

              {isBookingsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
              ) : filteredBookings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredBookings.slice(0, 50).map((booking: any) => {
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
                        bookingNumber={String(booking.id).padStart(2, '0')}
                        complaints={(() => {
                          const raw = booking.description ?? "";
                          const stripped = raw.replace(/Category:\s*[^|]+(\|)?/gi, "").replace(/Visit:\s*[^|]+(\|)?/gi, "").trim();
                          return stripped ? stripped.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean) : [];
                        })()}
                        clinicName={clinicName}
                        clinicCity={clinicCity ?? undefined}
                        onCardClick={() => { setPatientModalId(booking.id); setPatientModalTab('notes'); setStatusDraft(booking.clinicalStatus || ""); }}
                        onApprove={() => approveMutation.mutate(booking.id)}
                        onDecline={() => declineMutation.mutate(booking.id)}
                        onOpenNotes={() => { setPatientModalId(booking.id); setPatientModalTab('notes'); setStatusDraft(booking.clinicalStatus || ""); }}
                        onOpenRecords={() => { setPatientModalId(booking.id); setPatientModalTab('records'); setStatusDraft(booking.clinicalStatus || ""); }}
                        approvePending={approveMutation.isPending}
                        declinePending={declineMutation.isPending}
                        onStartConsultation={() => startConsultationMutation.mutate(booking.id)}
                        startConsultPending={startConsultationMutation.isPending}
                        onCompleteVisit={() => completeVisitMutation.mutate(booking.id)}
                        completeVisitPending={completeVisitMutation.isPending}
                      />
                    );
                  })}
                </div>
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
                      <div className="relative rounded-2xl overflow-hidden bg-white p-3 border border-border/40 shadow-inner shrink-0 flex items-center justify-center">
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
            <div className="space-y-5">
              {/* Panel header */}
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <div className="flex">
                  <div className="w-1.5 bg-amber-500/60 shrink-0" />
                  <div className="flex-1 px-5 py-4 bg-gradient-to-r from-amber-500/[0.06] to-transparent flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <CalendarOff className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">Leave Management</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Mark dates when you are unavailable. Clinic admins will see a warning when trying to assign you on these dates.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
                {/* Panel header */}
                <div className="px-5 py-4 bg-amber-100/60 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 flex items-center justify-between rounded-t-2xl">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-amber-200/70 dark:bg-amber-500/20 flex items-center justify-center">
                      <BriefcaseMedical className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Out of Office / Leave</p>
                      {!isLeavesLoading && leaves.length > 0 && (
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/60">{leaves.length} {leaves.length === 1 ? "day" : "days"} marked upcoming</p>
                      )}
                    </div>
                  </div>
                  {/* Single / Multi toggle */}
                  <div className="flex items-center rounded-lg border border-amber-200 dark:border-amber-500/30 overflow-hidden text-xs font-semibold">
                    <button
                      data-testid="button-single-mode"
                      onClick={() => { setMultiMode(false); setPendingDates([]); }}
                      className={`min-h-[36px] px-3 py-1.5 transition-colors ${!multiMode ? "bg-amber-500 text-white" : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/10"}`}
                    >Single</button>
                    <button
                      data-testid="button-multi-mode"
                      onClick={() => { setMultiMode(true); setLeavePickerDate(undefined); }}
                      className={`min-h-[36px] px-3 py-1.5 transition-colors ${multiMode ? "bg-amber-500 text-white" : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/10"}`}
                    >Multi</button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {multiMode
                      ? <><span className="font-medium text-amber-700 dark:text-amber-400">Multi-select:</span> tap several dates, add an optional reason, then submit them all at once — great for holidays or planned leave blocks.</>
                      : <>Mark dates when you are unavailable. <span className="font-medium text-amber-700 dark:text-amber-400">Tap an amber date to remove it.</span> Clinic admins will see a warning when trying to assign you on these dates.</>
                    }
                  </p>

                  {/* Calendar + reason/submit side by side */}
                  <div className="flex flex-col sm:flex-row gap-5 items-start">

                    {/* Calendar */}
                    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-background shadow-sm pt-1 shrink-0">
                      {isLeavesLoading ? (
                        <div className="w-[280px] h-[280px] p-3 space-y-2">
                          <div className="flex justify-between px-1 pb-1">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-4 rounded" />
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({length: 7}).map((_, i) => (
                              <Skeleton key={i} className="h-6 w-6 rounded" />
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({length: 35}).map((_, i) => (
                              <Skeleton key={i} className="h-8 w-8 rounded-full" />
                            ))}
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
                          className="p-3"
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
                          className="p-3"
                          data-testid="calendar-leave-picker"
                        />
                      )}
                      {/* Legend */}
                      <div className="flex items-center gap-4 px-4 pb-4 flex-wrap">
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

                    {/* Reason + submit */}
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
                          {pendingDates.length > 0 && (
                            <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 space-y-1.5">
                              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                                {pendingDates.length} {pendingDates.length === 1 ? "date" : "dates"} queued:
                              </p>
                              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                                {[...pendingDates]
                                  .sort((a, b) => a.getTime() - b.getTime())
                                  .map(d => {
                                    const ds = format(d, 'yyyy-MM-dd');
                                    return (
                                      <span key={ds} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                        {format(d, 'EEE, MMM d')}
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
                              </div>
                            </div>
                          )}
                          <Button
                            data-testid="button-mark-leave-multi"
                            variant="outline"
                            className={`min-h-[44px] font-semibold transition-all active:scale-[0.98] ${
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
                              onClick={() => setPendingDates([])}
                              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 text-center transition-colors"
                            >
                              Clear all selected dates
                            </button>
                          )}
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

                  {/* Marked dates list — grouped by month */}
                  {isLeavesLoading ? (
                    <div className="space-y-2 py-1">
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
                      const month = format(new Date(l.leaveDate + 'T00:00:00'), 'MMMM yyyy');
                      if (!acc[month]) acc[month] = [];
                      acc[month].push(l);
                      return acc;
                    }, {} as Record<string, DoctorLeave[]>);
                    return (
                      <div className="space-y-3 pt-2 border-t border-amber-200 dark:border-amber-500/20">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Marked Dates</p>
                        {Object.entries(grouped).map(([month, monthLeaves]) => (
                          <div key={month} className="space-y-1.5">
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">{month}</p>
                            {monthLeaves.map(leave => (
                              <div
                                key={leave.id}
                                data-testid={`leave-item-${leave.id}`}
                                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 group hover:bg-amber-200/50 dark:hover:bg-amber-500/15 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-md bg-amber-200/80 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                                    <CalendarDays className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                      {format(new Date(leave.leaveDate + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                                    </span>
                                    {leave.reason
                                      ? <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">{leave.reason}</p>
                                      : <p className="text-xs text-muted-foreground/50 mt-0.5 italic">No reason given</p>
                                    }
                                  </div>
                                </div>
                                <button
                                  data-testid={`button-remove-leave-${leave.id}`}
                                  onClick={() => removeLeaveMutation.mutate(leave.id)}
                                  disabled={removeLeaveMutation.isPending}
                                  className="opacity-0 group-hover:opacity-100 min-h-[36px] px-2 rounded-md text-amber-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 dark:text-amber-400 dark:hover:text-red-400 active:scale-95 transition-all"
                                  title="Remove this leave"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })() : (
                    <div className="flex items-center gap-2.5 py-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-dashed border-amber-200 dark:border-amber-500/20">
                      <CalendarDays className="h-4 w-4 text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/60 italic">No leaves marked yet. Select a date on the calendar above.</p>
                    </div>
                  )}
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
                    <Button onClick={openNewCert} className="bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/20 shrink-0">
                      <Plus className="h-4 w-4 mr-2" />Add Certification
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
                          {cert.year && <span className="shrink-0 text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{cert.year}</span>}
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
                    <Button onClick={openNewCase} className="bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/20 shrink-0">
                      <Plus className="h-4 w-4 mr-2" />Add Case
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

      {/* ── MOBILE BOTTOM NAV BAR ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-stretch">
          {([
            { key: "appointments" as Tab, label: "Appointments", Icon: Calendar },
            { key: "profile"       as Tab, label: "Profile",      Icon: User },
            { key: "certifications" as Tab, label: "Certs",       Icon: Award },
          ] as { key: Tab; label: string; Icon: any }[]).map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors relative ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`bottom-nav-${key}`}
              >
                {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold">{label}</span>
                {key === "appointments" && awaitingBookings.length > 0 && (
                  <span className="absolute top-2 right-[22%] h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">{awaitingBookings.length}</span>
                )}
              </button>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreDrawerOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors relative ${
              activeTab === "cases" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="bottom-nav-more"
          >
            {activeTab === "cases" && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />}
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* ── MORE DRAWER (mobile) ── */}
      <Sheet open={moreDrawerOpen} onOpenChange={setMoreDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pb-6">
            <button
              onClick={() => { setActiveTab("cases"); setMoreDrawerOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/50 bg-background text-left hover:bg-muted/30 transition-colors active:scale-[0.98]"
            >
              <div className="h-9 w-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Case Studies</p>
                <p className="text-xs text-muted-foreground">Manage your clinical cases</p>
              </div>
            </button>
            <button
              onClick={() => { setChangePwdOpen(true); setMoreDrawerOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/50 bg-background text-left hover:bg-muted/30 transition-colors active:scale-[0.98]"
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
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/50 bg-muted/20">
                <div className="rounded-xl overflow-hidden bg-white p-2 border border-border/40 shadow-inner shrink-0">
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
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={copyProfileLink}>
                    {linkCopied ? <Check className="h-3 w-3 mr-1.5 text-primary" /> : <Copy className="h-3 w-3 mr-1.5" />}
                    {linkCopied ? "Copied!" : "Copy Profile Link"}
                  </Button>
                </div>
              </div>
            )}
            <button
              onClick={() => { logout(); setMoreDrawerOpen(false); }}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-red-200 dark:border-red-900/40 bg-background text-left hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors active:scale-[0.98]"
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
        </SheetContent>
      </Sheet>

      {/* ── Patient Detail Dialog ── */}
      <Dialog open={patientModalId !== null} onOpenChange={(o) => { if (!o) setPatientModalId(null); }}>
        <DialogContent className="w-[95vw] sm:max-w-[640px] p-0 gap-0 overflow-hidden h-[90vh] flex flex-col rounded-2xl">
          {patientModalId !== null && (() => {
            const b = myBookings.find((bk: any) => bk.id === patientModalId);
            if (!b) return null;
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
                      <p className="font-bold text-white text-base leading-tight">{b.customerName}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-white/60 text-xs flex-wrap">
                        <span className="flex items-center gap-1"><Hash className="h-2.5 w-2.5" />REF-{String(b.id).padStart(4, "0")}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 truncate"><Building2 className="h-2.5 w-2.5 shrink-0" />{modalClinicName}</span>
                      </div>
                      {startTime && (
                        <p className="text-white/50 text-xs mt-0.5">
                          {startTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
                </div>

                {/* Tab strip — Notes | Diagnosis | Prescription */}
                <div className="shrink-0 flex border-b border-border/60 bg-card">
                  {([
                    { key: 'notes'        as const, label: 'Notes',       icon: <FileText className="h-3.5 w-3.5" /> },
                    { key: 'diagnosis'    as const, label: 'Diagnosis',   icon: <ClipboardList className="h-3.5 w-3.5" /> },
                    { key: 'prescription' as const, label: 'Prescription',icon: <Pill className="h-3.5 w-3.5" /> },
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

                  {/* NOTES TAB */}
                  {patientModalTab === 'notes' && (
                    <div className="p-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clinical Status</Label>
                        <div className="flex gap-2">
                          <Select value={statusDraft} onValueChange={setStatusDraft}>
                            <SelectTrigger className="h-9 text-sm flex-1" data-testid="select-clinical-status">
                              <SelectValue placeholder="Select status…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="first_visit">First Visit</SelectItem>
                              <SelectItem value="revisit">Revisit</SelectItem>
                              <SelectItem value="follow_up_required">Follow-up Required</SelectItem>
                              <SelectItem value="case_closed">Case Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            className="h-9 px-4 text-sm shrink-0"
                            onClick={() => {
                              saveNotesMutation.mutate({ id: b.id, clinicalStatus: statusDraft });
                              if (b.visitStatus === 'in_consultation') {
                                completeVisitMutation.mutate(b.id);
                              }
                            }}
                            disabled={saveNotesMutation.isPending || completeVisitMutation.isPending}
                            data-testid="button-save-clinical-status"
                          >
                            {(saveNotesMutation.isPending || completeVisitMutation.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                          </Button>
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
