import { useEffect, useState, useRef } from "react";
import { BookingNotesThread } from "@/components/BookingNotesThread";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Loader2, LogOut, Stethoscope, Building2, Calendar, ShieldAlert, Clock, Phone, Mail,
  ClipboardList, CheckCircle2, AlertCircle, Hash, CalendarDays, TrendingUp, ArrowRight,
  Info, X, Filter, BadgeCheck, RotateCcw, User, Award, BookOpen, Plus, Pencil, Trash2,
  Copy, Check, Link as LinkIcon, Image as ImageIcon, Tag, GraduationCap, Star, Eye,
  Upload, Play, Globe, Share2, FileText, ChevronDown, ChevronUp
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Clinic, DoctorCertification, DoctorCase } from "@shared/schema";

type QuickFilter = "all" | "today" | "upcoming" | "awaiting";
type Tab = "appointments" | "profile" | "certifications" | "cases";

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
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("appointments");

  // Appointments state
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [appointmentDateFilter, setAppointmentDateFilter] = useState<string>("");
  const [appointmentClinicFilter, setAppointmentClinicFilter] = useState<string>("all");
  const [showHelp, setShowHelp] = useState(false);

  // Profile state
  const [profName, setProfName] = useState("");
  const [profSpecialization, setProfSpecialization] = useState("");
  const [profDegree, setProfDegree] = useState("");
  const [profCollege, setProfCollege] = useState("");
  const [profBio, setProfBio] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profImageUrl, setProfImageUrl] = useState("");
  const [profYearsExp, setProfYearsExp] = useState<string>("");
  const [profLanguages, setProfLanguages] = useState<string[]>([]);
  const [profUploading, setProfUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Share profile copied state
  const [linkCopied, setLinkCopied] = useState(false);

  // Notes panel state (keyed by booking id)
  const [notesOpenId, setNotesOpenId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");

  // Certification sheet state
  const [certSheetOpen, setCertSheetOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<DoctorCertification | null>(null);
  const [certTitle, setCertTitle] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certYear, setCertYear] = useState("");
  const [certDesc, setCertDesc] = useState("");
  const [certImageUrl, setCertImageUrl] = useState("");

  // Case sheet state
  const [caseSheetOpen, setCaseSheetOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<DoctorCase | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseDesc, setCaseDesc] = useState("");
  const [caseTags, setCaseTags] = useState("");
  const [caseBeforeUrl, setCaseBeforeUrl] = useState("");
  const [caseAfterUrl, setCaseAfterUrl] = useState("");
  const [caseBeforeUploading, setCaseBeforeUploading] = useState(false);
  const [caseAfterUploading, setCaseAfterUploading] = useState(false);
  const caseBeforeInputRef = useRef<HTMLInputElement>(null);
  const caseAfterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/clinic-login");
  }, [isLoading, isAuthenticated, setLocation]);

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

  const { data: certifications = [], isLoading: isCertsLoading } = useQuery<DoctorCertification[]>({
    queryKey: ["/api/doctor/certifications"],
    enabled: isAuthenticated && activeTab === "certifications",
  });

  const { data: cases = [], isLoading: isCasesLoading } = useQuery<DoctorCase[]>({
    queryKey: ["/api/doctor/cases"],
    enabled: isAuthenticated && activeTab === "cases",
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/doctor/profile", data),
    onSuccess: async (res) => {
      const updated = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/me"] });
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    },
    onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
  });

  const createCertMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/doctor/certifications", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/doctor/certifications"] }); closeCertSheet(); },
    onError: () => toast({ title: "Failed to add certification", variant: "destructive" }),
  });

  const updateCertMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/doctor/certifications/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/doctor/certifications"] }); closeCertSheet(); },
    onError: () => toast({ title: "Failed to update certification", variant: "destructive" }),
  });

  const deleteCertMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/doctor/certifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/doctor/certifications"] }),
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const createCaseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/doctor/cases", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/doctor/cases"] }); closeCaseSheet(); },
    onError: () => toast({ title: "Failed to add case", variant: "destructive" }),
  });

  const updateCaseMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/doctor/cases/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/doctor/cases"] }); closeCaseSheet(); },
    onError: () => toast({ title: "Failed to update case", variant: "destructive" }),
  });

  const deleteCaseMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/doctor/cases/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/doctor/cases"] }),
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const saveNotesMutation = useMutation({
    mutationFn: ({ id, clinicalStatus }: { id: number; clinicalStatus: string }) =>
      apiRequest("PATCH", `/api/doctor/bookings/${id}/clinical-status`, { clinicalStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      toast({ title: "Status saved" });
    },
    onError: () => toast({ title: "Failed to save status", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/doctor/bookings/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      toast({ title: "Appointment accepted", description: "The appointment is now in your schedule." });
    },
    onError: () => toast({ title: "Failed to accept appointment", variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/doctor/bookings/${id}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
      toast({ title: "Appointment declined", description: "The clinic admin has been notified." });
    },
    onError: () => toast({ title: "Failed to decline appointment", variant: "destructive" }),
  });

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfUploading(true);
    try {
      const signedRes = await apiRequest("POST", "/api/uploads/signed-url", {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        folder: "doctor-photos",
      });
      if (!signedRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await signedRes.json();
      const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setProfImageUrl(publicUrl);
      toast({ title: "Photo uploaded", description: "Click Save Profile to apply." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload photo.", variant: "destructive" });
    } finally {
      setProfUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function toggleLanguage(lang: string) {
    setProfLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  }

  function openNewCert() {
    setEditingCert(null);
    setCertTitle(""); setCertIssuer(""); setCertYear(""); setCertDesc(""); setCertImageUrl("");
    setCertSheetOpen(true);
  }
  function openEditCert(c: DoctorCertification) {
    setEditingCert(c);
    setCertTitle(c.title); setCertIssuer(c.issuer || ""); setCertYear(c.year || ""); setCertDesc(c.description || ""); setCertImageUrl(c.imageUrl || "");
    setCertSheetOpen(true);
  }
  function closeCertSheet() { setCertSheetOpen(false); setEditingCert(null); }

  function openNewCase() {
    setEditingCase(null);
    setCaseTitle(""); setCaseDesc(""); setCaseTags(""); setCaseBeforeUrl(""); setCaseAfterUrl("");
    setCaseSheetOpen(true);
  }
  function openEditCase(c: DoctorCase) {
    setEditingCase(c);
    setCaseTitle(c.title); setCaseDesc(c.description || "");
    setCaseTags(((c.tags as string[]) || []).join(", "));
    const media = (c.mediaUrls as string[]) || [];
    setCaseBeforeUrl(media[0] || "");
    setCaseAfterUrl(media[1] || "");
    setCaseSheetOpen(true);
  }
  function closeCaseSheet() { setCaseSheetOpen(false); setEditingCase(null); }

  async function handleCaseMediaUpload(slot: "before" | "after", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const setUploading = slot === "before" ? setCaseBeforeUploading : setCaseAfterUploading;
    const setUrl = slot === "before" ? setCaseBeforeUrl : setCaseAfterUrl;
    const ref = slot === "before" ? caseBeforeInputRef : caseAfterInputRef;
    setUploading(true);
    try {
      const signedRes = await apiRequest("POST", "/api/uploads/signed-url", {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        folder: "case-media",
      });
      if (!signedRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await signedRes.json();
      const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setUrl(publicUrl);
      toast({ title: `${slot === "before" ? "Before" : "After"} photo uploaded` });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload photo.", variant: "destructive" });
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
    const url = `${window.location.origin}/doctor/${(doctor as any).id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      toast({ title: "Link copied!", description: url });
      setTimeout(() => setLinkCopied(false), 2500);
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!doctor) return null;

  const allBookings = Array.isArray(bookings) ? bookings : [];
  const myBookings = allBookings.filter((b: any) => b.assignedDoctorEmail === (doctor as any).email);
  // Awaiting approval: assigned to this doctor, pending their approval
  const awaitingBookings = myBookings.filter((b: any) => b.doctorApprovalStatus === 'pending');
  // Confirmed appointments: everything else (null = pre-feature, approved, admin_confirmed)
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
  const handleQuickFilter = (f: QuickFilter) => { setQuickFilter(f); setAppointmentDateFilter(""); };
  const filteredBookings = (quickFilter === "awaiting" ? awaitingBookings : confirmedBookings).filter((b: any) => {
    const matchesClinic = appointmentClinicFilter === "all" || b.clinicId === parseInt(appointmentClinicFilter);
    const bd = b.slot?.startTime ? new Date(b.slot.startTime).toISOString().split("T")[0] : "";
    const bdt = b.slot?.startTime ? new Date(b.slot.startTime) : null;
    let matchesDate = true;
    if (quickFilter === "today") matchesDate = bd === todayStr;
    else if (quickFilter === "upcoming") matchesDate = bdt ? bdt >= new Date() : false;
    else matchesDate = !appointmentDateFilter || bd === appointmentDateFilter;
    return matchesClinic && matchesDate;
  });

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "appointments", label: "Appointments", icon: Calendar },
    { key: "profile", label: "My Profile", icon: User },
    { key: "certifications", label: "Certifications", icon: Award },
    { key: "cases", label: "Case Studies", icon: BookOpen },
  ];

  const greet = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";

  return (
    <div className="min-h-screen bg-muted/30">

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div className="relative w-full max-w-lg rounded-3xl border border-border/60 bg-background shadow-2xl shadow-primary/15 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />
            <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 pt-6 pb-5 overflow-hidden">
              <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/25 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55 mb-1">Doctor Portal Guide</p>
              <h2 className="text-xl font-extrabold text-white tracking-tight">How this page works</h2>
              <p className="text-xs text-white/55 mt-1">Use the tabs to navigate between your appointments, profile, certifications, and case studies.</p>
            </div>
            <div className="px-6 py-5">
              <Button className="w-full h-10 font-semibold bg-gradient-to-r from-primary to-accent text-white rounded-xl" onClick={() => setShowHelp(false)}>Got it</Button>
            </div>
          </div>
        </div>
      )}

      {/* 3px neon top bar */}
      <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

      {/* Default password warning */}
      {(doctor as any).isDefaultPassword && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/90 via-yellow-500/90 to-amber-500/90 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          You are using the default password. For security, please reset via email.
        </div>
      )}

      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-gradient-to-r from-background via-background to-primary/5 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="h-11 w-11 ring-2 ring-primary/40 shadow-[0_0_14px_hsl(var(--primary)/0.2)]">
                <AvatarImage src={(doctor as any).imageUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">{(doctor as any).name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center shadow-md">
                <Stethoscope className="h-2.5 w-2.5 text-white" />
              </span>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Dr. {(doctor as any).name}</h1>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge className="text-[10px] py-0 px-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10">{(doctor as any).specialization}</Badge>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Building2 className="h-3 w-3" />{(doctor as any).clinicName}</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Stethoscope className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary tracking-wide">Doctor Portal</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyProfileLink}
              title="Copy shareable profile link"
              className="h-9 w-9 rounded-full border border-border/60 bg-background flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all duration-200 shadow-sm"
            >
              {linkCopied ? <Check className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4" />}
            </button>
            <button onClick={() => setShowHelp(true)} className="h-9 w-9 rounded-full border border-border/60 bg-background flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all duration-200 shadow-sm">
              <Info className="h-4 w-4" />
            </button>
            <Button variant="outline" size="sm" onClick={() => logout()} disabled={isLoggingOut} className="border-border/50 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive transition-colors duration-200">
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 mr-1.5" />}
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_60%)] pointer-events-none" />
        <CalendarDays className="absolute right-8 top-1/2 -translate-y-1/2 h-40 w-40 text-white opacity-[0.05] pointer-events-none select-none" />
        <div className="relative container mx-auto px-4 py-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/55 mb-1">Doctor Portal</p>
          <h2 className="text-xl font-extrabold text-white tracking-tight mb-1">Good {greet}, Dr. {(doctor as any).name.split(" ")[0]}</h2>
          <p className="text-[11px] text-white/45 mb-5">Manage your appointments, profile, certifications, and case studies below.</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Total", count: confirmedBookings.length, icon: Calendar, filter: "all" as QuickFilter },
              { label: "Today", count: todayBookings.length, icon: Clock, filter: "today" as QuickFilter },
              { label: "Upcoming", count: upcomingBookings.length, icon: TrendingUp, filter: "upcoming" as QuickFilter },
            ].map(({ label, count, icon: Icon, filter }) => (
              <button key={filter} onClick={() => { setActiveTab("appointments"); handleQuickFilter(filter); }}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 border backdrop-blur-sm transition-all duration-200 ${quickFilter === filter && activeTab === "appointments" ? "bg-white/20 border-white/50 ring-2 ring-white/40 shadow-lg" : "bg-white/10 border-white/15 hover:bg-white/15 hover:border-white/30"}`}
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${quickFilter === filter && activeTab === "appointments" ? "bg-white/25" : "bg-white/15"}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-white/55 font-medium uppercase tracking-wide leading-none mb-0.5">{label}</p>
                  <p className="text-lg font-extrabold text-white leading-none">{count}</p>
                </div>
                {quickFilter === filter && activeTab === "appointments" && <ArrowRight className="h-3.5 w-3.5 text-white/60 ml-1" />}
              </button>
            ))}
            {/* Amber awaiting approval card — only shown if there are pending items */}
            {awaitingBookings.length > 0 && (
              <button onClick={() => { setActiveTab("appointments"); handleQuickFilter("awaiting"); }}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 border backdrop-blur-sm transition-all duration-200 ${quickFilter === "awaiting" && activeTab === "appointments" ? "bg-amber-400/30 border-amber-300/70 ring-2 ring-amber-300/50 shadow-lg" : "bg-amber-400/15 border-amber-300/25 hover:bg-amber-400/25 hover:border-amber-300/45"}`}
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${quickFilter === "awaiting" && activeTab === "appointments" ? "bg-amber-300/30" : "bg-amber-300/20"}`}>
                  <AlertCircle className="h-4 w-4 text-amber-200" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-amber-200/80 font-medium uppercase tracking-wide leading-none mb-0.5">Awaiting</p>
                  <p className="text-lg font-extrabold text-amber-100 leading-none">{awaitingBookings.length}</p>
                </div>
                {quickFilter === "awaiting" && activeTab === "appointments" && <ArrowRight className="h-3.5 w-3.5 text-amber-200/60 ml-1" />}
              </button>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-[73px] z-[9]">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${activeTab === key ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">

        {/* ─────────────── APPOINTMENTS TAB ─────────────── */}
        {activeTab === "appointments" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex items-center gap-2 flex-wrap">
                {([{ key: "all", label: "All", count: confirmedBookings.length }, { key: "today", label: "Today", count: todayBookings.length }, { key: "upcoming", label: "Upcoming", count: upcomingBookings.length }] as { key: QuickFilter; label: string; count: number }[]).map(chip => (
                  <button key={chip.key} onClick={() => handleQuickFilter(chip.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${quickFilter === chip.key ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20" : "bg-background text-muted-foreground border-border/60 hover:border-primary/40 hover:text-primary"}`}
                  >
                    {chip.label}
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none ${quickFilter === chip.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>{chip.count}</span>
                  </button>
                ))}
                <button onClick={() => handleQuickFilter("awaiting")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${quickFilter === "awaiting" ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20" : "bg-background text-amber-600 border-amber-300 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"}`}
                >
                  Awaiting
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none ${quickFilter === "awaiting" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}>{awaitingBookings.length}</span>
                </button>
              </div>
              <div className="flex gap-2 flex-1 sm:justify-end flex-wrap">
                {quickFilter === "all" && (
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="date" className="pl-9 h-9 w-44" value={appointmentDateFilter} onChange={(e) => setAppointmentDateFilter(e.target.value)} />
                  </div>
                )}
                <Select value={appointmentClinicFilter} onValueChange={setAppointmentClinicFilter}>
                  <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="All Clinics" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clinics</SelectItem>
                    {doctorClinics.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(appointmentDateFilter || appointmentClinicFilter !== "all" || quickFilter !== "all") && (
                  <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground" onClick={() => { setQuickFilter("all"); setAppointmentDateFilter(""); setAppointmentClinicFilter("all"); }}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Clear all
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground px-1">
              Showing <span className="font-semibold text-foreground">{filteredBookings.length}</span> appointment{filteredBookings.length !== 1 ? "s" : ""}
              {quickFilter === "awaiting" && <span className="ml-1 text-amber-600 font-medium">· Awaiting your approval</span>}
              {quickFilter === "today" && <span className="ml-1 text-primary font-medium">· Today</span>}
              {quickFilter === "upcoming" && <span className="ml-1 text-primary font-medium">· Upcoming</span>}
              {appointmentDateFilter && quickFilter === "all" && <span className="ml-1 text-primary font-medium">· {new Date(appointmentDateFilter + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
            </p>

            {isBookingsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" /></div>
            ) : filteredBookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredBookings.slice(0, 50).map((booking: any) => {
                  const startTime = booking.slot?.startTime ? new Date(booking.slot.startTime) : null;
                  const endTime = booking.slot?.endTime ? new Date(booking.slot.endTime) : null;
                  const durationMin = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null;
                  const clinicName = booking.clinic?.name || booking.clinicName || doctorClinics.find((c: any) => c.id === booking.clinicId)?.name || "Clinic";
                  const clinicAddress = booking.clinic?.address || (doctorClinics.find((c: any) => c.id === booking.clinicId) as any)?.address;
                  const isVerified = booking.verificationStatus === "verified";
                  return (
                    <div key={booking.id} className="rounded-2xl border border-border/50 bg-background shadow-sm shadow-primary/5 overflow-hidden flex flex-col hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300">
                      <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-4 pt-4 pb-3 overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                        <div className="relative flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-accent/40 to-primary/30 blur-sm" />
                              <div className="relative h-9 w-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white font-bold text-sm ring-1 ring-white/10">
                                {booking.customerName?.[0]?.toUpperCase() ?? "?"}
                              </div>
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm leading-tight">{booking.customerName}</p>
                              <div className="flex items-center gap-1 mt-0.5 text-white/55 text-[10px]">
                                <Hash className="h-2.5 w-2.5" />
                                <span>REF-{String(booking.id).padStart(4, "0")}</span>
                              </div>
                            </div>
                          </div>
                          {booking.verificationStatus && (
                            <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${isVerified ? "bg-green-500/25 text-green-100" : "bg-amber-400/25 text-amber-100"}`}>
                              {isVerified ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                              {isVerified ? "Verified" : "Pending"}
                            </div>
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
                      </div>
                      <div className="px-4 py-3 flex flex-col gap-2.5 flex-1">
                        <div className="flex items-start gap-2">
                          <Calendar className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold leading-tight">{startTime ? startTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—"}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{startTime ? startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}{endTime ? ` – ${endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
                              {durationMin && <span className="text-[10px] bg-primary/8 text-primary px-1.5 py-0.5 rounded-full font-medium">{durationMin} min</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="text-xs">
                            <p className="font-medium text-foreground leading-tight">{clinicName}</p>
                            {clinicAddress && <p className="text-muted-foreground mt-0.5 leading-tight">{clinicAddress}</p>}
                          </div>
                        </div>
                        {booking.description && (
                          <div className="flex items-start gap-2">
                            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{booking.description}</p>
                          </div>
                        )}

                        {/* Clinical status badge preview */}
                        {booking.clinicalStatus && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10">
                            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                              ${booking.clinicalStatus === "case_closed" ? "bg-green-500/15 text-green-600 dark:text-green-400" :
                                booking.clinicalStatus === "follow_up_required" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                                booking.clinicalStatus === "revisit" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
                                "bg-primary/15 text-primary"}`}>
                              {booking.clinicalStatus === "first_visit" ? "First Visit" :
                               booking.clinicalStatus === "revisit" ? "Revisit" :
                               booking.clinicalStatus === "follow_up_required" ? "Follow-up Required" :
                               booking.clinicalStatus === "case_closed" ? "Case Closed" :
                               booking.clinicalStatus}
                            </span>
                          </div>
                        )}

                        <div className="pt-1 border-t border-border/40 mt-auto space-y-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {booking.customerPhone && (
                              <a href={`tel:${booking.customerPhone}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                                <Phone className="h-3 w-3" />{booking.customerPhone}
                              </a>
                            )}
                            {booking.customerEmail && (
                              <a href={`mailto:${booking.customerEmail}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                                <Mail className="h-3 w-3" />{booking.customerEmail}
                              </a>
                            )}
                          </div>

                          {/* Accept / Decline buttons — only shown in awaiting filter */}
                          {quickFilter === "awaiting" && booking.doctorApprovalStatus === 'pending' && (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold"
                                onClick={() => approveMutation.mutate(booking.id)}
                                disabled={approveMutation.isPending || declineMutation.isPending}
                                data-testid={`button-approve-${booking.id}`}
                              >
                                {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:hover:bg-red-950/20 font-semibold"
                                onClick={() => declineMutation.mutate(booking.id)}
                                disabled={approveMutation.isPending || declineMutation.isPending}
                                data-testid={`button-decline-${booking.id}`}
                              >
                                {declineMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1.5" />}
                                Decline
                              </Button>
                            </div>
                          )}

                          {/* Confirmation notice */}
                          {booking.doctorApprovalStatus === 'admin_confirmed' && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              Confirmed by clinic admin on your behalf
                            </div>
                          )}
                          {booking.doctorApprovalStatus === 'approved' && (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              You confirmed this appointment
                            </div>
                          )}

                          {/* Notes toggle button — hidden in awaiting view */}
                          {quickFilter !== "awaiting" && (
                            <>
                              <button
                                onClick={() => {
                                  if (notesOpenId === booking.id) {
                                    setNotesOpenId(null);
                                  } else {
                                    setNotesOpenId(booking.id);
                                    setStatusDraft(booking.clinicalStatus || "");
                                  }
                                }}
                                className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                              >
                                <FileText className="h-3 w-3" />
                                Notes &amp; Messages
                                {notesOpenId === booking.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>

                              {/* Inline notes panel */}
                              {notesOpenId === booking.id && (
                                <div className="space-y-2.5 pt-2 border-t border-border/30 animate-in slide-in-from-top-1 duration-150">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Clinical Status</Label>
                                    <div className="flex gap-2">
                                      <Select value={statusDraft} onValueChange={setStatusDraft}>
                                        <SelectTrigger className="h-8 text-xs flex-1">
                                          <SelectValue placeholder="Select status..." />
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
                                        className="h-8 px-3 text-xs shrink-0"
                                        onClick={() => saveNotesMutation.mutate({ id: booking.id, clinicalStatus: statusDraft })}
                                        disabled={saveNotesMutation.isPending}
                                      >
                                        {saveNotesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                      </Button>
                                    </div>
                                  </div>
                                  <BookingNotesThread bookingId={booking.id} authorType="doctor" />
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground w-full" onClick={() => setNotesOpenId(null)}>
                                    Close
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${quickFilter === "awaiting" ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/60"}`}>
                  {quickFilter === "awaiting"
                    ? <CheckCircle2 className="h-7 w-7 text-amber-500/60" />
                    : <Calendar className="h-7 w-7 text-muted-foreground/40" />
                  }
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
        )}

        {/* ─────────────── PROFILE TAB ─────────────── */}
        {activeTab === "profile" && (() => {
          const LANGUAGES = ["English", "Malayalam", "Tamil", "Hindi", "Kannada"];
          const completenessFields = [profName, profSpecialization, profDegree, profCollege, profBio, profPhone, profImageUrl, profYearsExp, profLanguages.length > 0 ? "yes" : ""];
          const filled = completenessFields.filter(Boolean).length;
          const pct = Math.round((filled / completenessFields.length) * 100);
          const isComplete = pct === 100;
          return (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Profile card */}
              <div className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
                {/* Banner */}
                <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 py-5 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                  <User className="absolute right-5 top-1/2 -translate-y-1/2 h-20 w-20 text-white opacity-[0.06] pointer-events-none" />
                  <div className="relative flex items-center gap-4">
                    <Avatar className="h-16 w-16 ring-2 ring-white/30 shadow-lg">
                      <AvatarImage src={profImageUrl || undefined} />
                      <AvatarFallback className="bg-white/20 text-white font-bold text-xl">{profName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55 mb-0.5">Your Identity</p>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-extrabold text-white">Dr. {profName}</h3>
                        {isComplete && (
                          <span className="flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <BadgeCheck className="h-3 w-3" />Complete Profile
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60 mt-0.5">{profSpecialization}</p>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
                </div>

                {/* Completeness bar */}
                <div className="px-6 pt-4 pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">Profile completeness</span>
                    <span className={`text-[11px] font-bold ${isComplete ? "text-primary" : "text-muted-foreground"}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {!isComplete && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                      Fill in all fields to earn a Complete Profile badge visible to patients.
                    </p>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  {/* Hidden file input */}
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="input-doctor-photo" />

                  {/* Photo upload */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profile Photo</Label>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 ring-1 ring-border shrink-0">
                        <AvatarImage src={profImageUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{profName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-dashed"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={profUploading}
                        data-testid="button-upload-photo"
                      >
                        {profUploading
                          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
                          : <><Upload className="h-4 w-4 mr-2" />Upload Photo</>
                        }
                      </Button>
                      {profImageUrl && (
                        <button
                          onClick={() => setProfImageUrl("")}
                          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                          data-testid="button-remove-photo"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Name + Phone */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</Label>
                      <Input data-testid="input-prof-name" value={profName} onChange={e => setProfName(e.target.value)} placeholder="John Smith" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input data-testid="input-prof-phone" value={profPhone} onChange={e => setProfPhone(e.target.value)} placeholder="+91 98765 43210" className="pl-9" />
                      </div>
                    </div>
                  </div>

                  {/* Specialization + Degree */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Stethoscope className="h-3 w-3" />Specialization</Label>
                      <Input data-testid="input-prof-specialization" value={profSpecialization} onChange={e => setProfSpecialization(e.target.value)} placeholder="Orthodontist" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><GraduationCap className="h-3 w-3" />Degree</Label>
                      <Input data-testid="input-prof-degree" value={profDegree} onChange={e => setProfDegree(e.target.value)} placeholder="BDS, MDS" />
                    </div>
                  </div>

                  {/* College + Years of experience */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Building2 className="h-3 w-3" />College / University</Label>
                      <Input data-testid="input-prof-college" value={profCollege} onChange={e => setProfCollege(e.target.value)} placeholder="AIIMS New Delhi" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><TrendingUp className="h-3 w-3" />Years of Experience</Label>
                      <Input
                        data-testid="input-prof-experience"
                        type="number"
                        min="0"
                        max="70"
                        value={profYearsExp}
                        onChange={e => setProfYearsExp(e.target.value)}
                        placeholder="e.g. 10"
                      />
                    </div>
                  </div>

                  {/* Languages spoken */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Globe className="h-3 w-3" />Languages Spoken</Label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang}
                          type="button"
                          data-testid={`toggle-lang-${lang.toLowerCase()}`}
                          onClick={() => toggleLanguage(lang)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            profLanguages.includes(lang)
                              ? "bg-primary text-white border-primary shadow-sm shadow-primary/20"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
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
                    <Textarea data-testid="input-prof-bio" value={profBio} onChange={e => setProfBio(e.target.value)} placeholder="Brief professional summary visible on your public profile..." className="resize-none h-24" />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold shadow-md shadow-primary/20"
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
                      })}
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Save Profile
                    </Button>
                    <Button
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/5"
                      onClick={() => window.open(`/doctor/${(doctor as any).id}`, "_blank")}
                      data-testid="button-preview-profile"
                    >
                      <Eye className="h-4 w-4 mr-2" />Preview
                    </Button>
                  </div>
                </div>
              </div>

              {/* Share profile card */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Share2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Shareable Profile Link</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{window.location.origin}/doctor/{(doctor as any).id}</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyProfileLink} className="shrink-0 border-primary/30 text-primary hover:bg-primary/10">
                  {linkCopied ? <><Check className="h-3.5 w-3.5 mr-1.5" />Copied!</> : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</>}
                </Button>
              </div>
            </div>
          );
        })()}

        {/* ─────────────── CERTIFICATIONS TAB ─────────────── */}
        {activeTab === "certifications" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Certifications & Achievements</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Highlight your credentials — these appear on your public profile.</p>
              </div>
              <Button onClick={openNewCert} className="bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" />Add Certification
              </Button>
            </div>

            {isCertsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" /></div>
            ) : certifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Award className="h-8 w-8 text-primary/50" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-muted-foreground">No certifications yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Add your first certification to showcase your expertise</p>
                </div>
                <Button variant="outline" onClick={openNewCert} className="border-primary/30 text-primary hover:bg-primary/5">
                  <Plus className="h-4 w-4 mr-2" />Add your first certification
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {certifications.map((cert) => (
                  <div key={cert.id} className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
                    {cert.imageUrl && (
                      <div className="aspect-video overflow-hidden bg-muted">
                        <img src={cert.imageUrl} alt={cert.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                              <Star className="h-3 w-3 text-white" />
                            </div>
                            <h3 className="font-bold text-sm leading-tight">{cert.title}</h3>
                          </div>
                          {cert.issuer && <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{cert.issuer}</p>}
                        </div>
                        {cert.year && (
                          <span className="shrink-0 text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{cert.year}</span>
                        )}
                      </div>
                      {cert.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{cert.description}</p>}
                      <div className="flex gap-2 mt-auto pt-3 border-t border-border/40">
                        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEditCert(cert)}>
                          <Pencil className="h-3 w-3 mr-1.5" />Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteCertMutation.mutate(cert.id)} disabled={deleteCertMutation.isPending}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─────────────── CASES TAB ─────────────── */}
        {activeTab === "cases" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Case Studies</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Share your clinical cases with descriptions and media. Visible on your public profile.</p>
              </div>
              <Button onClick={openNewCase} className="bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" />Add Case
              </Button>
            </div>

            {isCasesLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" /></div>
            ) : cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-primary/50" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-muted-foreground">No case studies yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Document your clinical work to build patient trust</p>
                </div>
                <Button variant="outline" onClick={openNewCase} className="border-primary/30 text-primary hover:bg-primary/5">
                  <Plus className="h-4 w-4 mr-2" />Add your first case
                </Button>
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
                          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center shrink-0">
                            <BookOpen className="h-3 w-3 text-white" />
                          </div>
                          <h3 className="font-bold text-sm leading-tight line-clamp-1">{c.title}</h3>
                        </div>
                        {c.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{c.description}</p>}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tags.map((tag, i) => (
                              <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15">{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-auto pt-3 border-t border-border/40">
                          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEditCase(c)}>
                            <Pencil className="h-3 w-3 mr-1.5" />Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteCaseMutation.mutate(c.id)} disabled={deleteCaseMutation.isPending}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
              <div className="space-y-2">
                <Label>Issuing Body</Label>
                <Input value={certIssuer} onChange={e => setCertIssuer(e.target.value)} placeholder="e.g. IDA" />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input value={certYear} onChange={e => setCertYear(e.target.value)} placeholder="2022" maxLength={4} />
              </div>
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
                  {caseTags.split(",").map(t => t.trim()).filter(Boolean).map((t, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />Before &amp; After Photos</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Before slot */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Before</span>
                  <input ref={caseBeforeInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => handleCaseMediaUpload("before", e)} />
                  {caseBeforeUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-border/40 aspect-video bg-muted/30 group">
                      {isVideo(caseBeforeUrl) ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="h-7 w-7 text-primary/60" />
                        </div>
                      ) : (
                        <img src={caseBeforeUrl} alt="Before" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => caseBeforeInputRef.current?.click()} className="text-white text-xs bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/30 transition-colors">Replace</button>
                        <button onClick={() => setCaseBeforeUrl("")} className="text-white text-xs bg-destructive/60 border border-white/20 rounded-lg px-3 py-1.5 hover:bg-destructive/80 transition-colors">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => caseBeforeInputRef.current?.click()} disabled={caseBeforeUploading} className="w-full aspect-video rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      {caseBeforeUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                      <span className="text-xs">Upload Before<br />photo or video</span>
                    </button>
                  )}
                </div>
                {/* After slot */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">After</span>
                  <input ref={caseAfterInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => handleCaseMediaUpload("after", e)} />
                  {caseAfterUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-border/40 aspect-video bg-muted/30 group">
                      {isVideo(caseAfterUrl) ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="h-7 w-7 text-primary/60" />
                        </div>
                      ) : (
                        <img src={caseAfterUrl} alt="After" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => caseAfterInputRef.current?.click()} className="text-white text-xs bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/30 transition-colors">Replace</button>
                        <button onClick={() => setCaseAfterUrl("")} className="text-white text-xs bg-destructive/60 border border-white/20 rounded-lg px-3 py-1.5 hover:bg-destructive/80 transition-colors">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => caseAfterInputRef.current?.click()} disabled={caseAfterUploading} className="w-full aspect-video rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      {caseAfterUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                      <span className="text-xs">Upload After<br />photo or video</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <Button className="w-full bg-gradient-to-r from-primary to-accent text-white font-semibold" onClick={saveCase} disabled={!caseTitle || createCaseMutation.isPending || updateCaseMutation.isPending}>
              {(createCaseMutation.isPending || updateCaseMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {editingCase ? "Save Changes" : "Add Case Study"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
