import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertClinicSchema, type InsertClinic } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Building2, Mail, Phone, MapPin, Hash,
  ArrowLeft, Sparkles, Shield, CheckCircle2,
  ChevronDown, ChevronUp, FileText, Link2, Receipt,
  Upload, X, Star,
} from "lucide-react";
import { z } from "zod";

// ─── Small reusables ──────────────────────────────────────────────────────────

function FieldRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-xl border border-border/60 bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
      <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

// ─── Trust score logic (mirrors server) ───────────────────────────────────────

function computeLiveTrustScore({
  name, address, city, pincode, phone, emailVerified, email,
  medicalLicenseUrl, clinicRegCertUrl, googleBusinessUrl, gstNumber,
}: {
  name: string; address: string; city: string; pincode: string;
  phone: string; emailVerified: boolean; email: string;
  medicalLicenseUrl: string; clinicRegCertUrl: string;
  googleBusinessUrl: string; gstNumber: string;
}): number {
  let score = 0;
  if (name.trim()) score += 7;
  if (address.trim() || city.trim()) score += 7;
  if (pincode.trim()) score += 6;
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) score += 30;
  if (emailVerified) {
    const isGeneric = /gmail\.|yahoo\.|hotmail\.|outlook\.|rediffmail\./.test(email.toLowerCase());
    score += isGeneric ? 10 : 15;
  }
  if (medicalLicenseUrl) score += 15;
  if (clinicRegCertUrl) score += 10;
  if (googleBusinessUrl) score += 15;
  if (gstNumber.trim()) score += 10;
  return Math.min(score, 100);
}

function trustBand(score: number) {
  if (score >= 75) return { label: "Verified", color: "text-emerald-500", barColor: "from-emerald-400 to-emerald-500" };
  if (score >= 50) return { label: "Strong", color: "text-blue-500", barColor: "from-blue-400 to-blue-500" };
  if (score >= 25) return { label: "Moderate", color: "text-amber-500", barColor: "from-amber-400 to-amber-500" };
  return { label: "Basic", color: "text-muted-foreground", barColor: "from-muted-foreground/30 to-muted-foreground/40" };
}

// ─── Trust score summary (bottom of form) ─────────────────────────────────────

function TrustSummary({ score }: { score: number }) {
  const band = trustBand(score);
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Your Trust Score</span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className={`text-2xl font-extrabold tabular-nums ${band.color}`}>{score}</span>
          <span className="text-sm text-muted-foreground">/100 · {band.label}</span>
        </div>
      </div>

      <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r transition-all duration-500 ${band.barColor}`}
          style={{ width: `${score}%` }}
        />
        {[25, 50, 75].map(t => (
          <div key={t} className="absolute top-0 h-full w-px bg-background/60" style={{ left: `${t}%` }} />
        ))}
      </div>

      <div className="flex justify-between text-[9px] text-muted-foreground/70 font-medium uppercase tracking-wide">
        <span>Basic</span><span>Moderate</span><span>Strong</span><span>Verified</span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">
        {score === 0
          ? "Fill in the required fields above to build your trust score."
          : score < 50
          ? "Complete optional fields below to boost your score before submitting."
          : score < 75
          ? "Great start — add more details to reach Verified status."
          : "Excellent profile! You're set for fast admin approval."}
      </p>
    </div>
  );
}

// ─── Doc upload zone ──────────────────────────────────────────────────────────

function DocUpload({ label, value, onChange, testId }: {
  label: string; value: string;
  onChange: (url: string) => void; testId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const sigRes = await apiRequest("POST", "/api/public/uploads/signed-url", {
        fileName: file.name, contentType: file.type, fileSize: file.size, folder: "clinic-docs",
      });
      if (!sigRes.ok) {
        const b = await sigRes.json().catch(() => ({}));
        throw new Error(b.message || "Upload service unavailable");
      }
      const { uploadUrl, publicUrl } = await sigRes.json();
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putRes.ok) throw new Error("Upload failed");
      onChange(publicUrl);
      toast({ title: "File uploaded", description: file.name });
    } catch (err: any) {
      toast({
        title: "Upload unavailable",
        description: "File storage isn't configured yet — you can upload this from your dashboard after approval.",
        variant: "destructive",
      });
    } finally {
      setUploading(false); }
  }, [onChange, toast]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = "";
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) handleFile(file);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-700 dark:text-emerald-400 flex-1 truncate">{label} uploaded</span>
        <button type="button" onClick={() => onChange("")}
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div onDrop={onDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}
      className="relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/40 bg-muted/10 py-4 px-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group"
      data-testid={testId}>
      <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} accept=".pdf,.jpg,.jpeg,.png,.webp" />
      {uploading
        ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
        : <Upload className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />}
      <p className="text-xs text-muted-foreground text-center leading-snug">
        {uploading ? "Uploading…" : <><span className="font-medium text-foreground">{label}</span><br /><span className="text-[11px]">Drag &amp; drop or click to upload</span></>}
      </p>
    </div>
  );
}

// ─── Optional boost accordion card ───────────────────────────────────────────

function BoostCard({ icon: Icon, title, subtitle, earned, children, testId }: {
  icon: React.ElementType; title: string; subtitle: string;
  earned: boolean; children: React.ReactNode; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border transition-colors ${earned ? "border-emerald-400/30 bg-emerald-500/5" : "border-border/40 bg-muted/10"}`}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors rounded-xl"
        data-testid={testId}>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${earned ? "bg-emerald-500/15" : "bg-background border border-border/50"}`}>
          {earned ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className={`text-sm font-semibold ${earned ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 space-y-2 border-t border-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Step progress bar ────────────────────────────────────────────────────────

function StepProgress({ steps }: {
  steps: { label: string; done: boolean; active: boolean }[];
}) {
  return (
    <div className="flex items-start w-full pt-1 pb-0.5">
      {steps.map((step, i) => (
        <div key={i} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center gap-1">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${
              step.done
                ? "bg-primary text-white shadow-sm shadow-primary/25"
                : step.active
                ? "bg-background border-2 border-primary text-primary ring-3 ring-primary/10"
                : "bg-muted/40 border border-border/50 text-muted-foreground/40"
            }`}>
              {step.done
                ? <CheckCircle2 className="h-3.5 w-3.5" />
                : <span className="text-[10px] font-bold">{i + 1}</span>}
            </div>
            <span className={`text-[9px] font-semibold whitespace-nowrap tracking-wide transition-colors duration-300 ${
              step.done ? "text-primary" : step.active ? "text-foreground" : "text-muted-foreground/40"
            }`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-1.5 mb-4 transition-all duration-500 ${
              step.done ? "bg-primary/40" : "bg-border/40"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Locked field wrapper ──────────────────────────────────────────────────────

function LockedField({ locked, nudgeMessage, onLockedClick, children }: {
  locked: boolean;
  nudgeMessage: string;
  onLockedClick: () => void;
  children: React.ReactNode;
}) {
  const [showNudge, setShowNudge] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    if (!locked) return;
    onLockedClick();
    setShowNudge(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowNudge(false), 2500);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="opacity-40 select-none pointer-events-none" aria-disabled="true">
        {children}
      </div>
      <div className="absolute inset-0 cursor-not-allowed z-10" onClick={handleClick} />
      {showNudge && (
        <div className="mt-1.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="h-4 w-4 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-amber-600">↑</span>
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">{nudgeMessage}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RegisterClinic() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // Optional boost fields (outside RHF — not in InsertClinic)
  const [medicalLicenseUrl, setMedicalLicenseUrl] = useState("");
  const [clinicRegCertUrl, setClinicRegCertUrl] = useState("");
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  const otpDigits = Array.from({ length: 6 }, (_, i) => otpCode[i] || "");
  const isOtpComplete = otpCode.length === 6;

  const form = useForm<InsertClinic>({
    resolver: zodResolver(insertClinicSchema.extend({
      email: z.string().email("Valid email is required"),
      phone: z.string().min(10, "Valid phone number is required"),
      name: z.string().min(2, "Clinic name is required"),
      address: z.string().optional().or(z.literal("")),
      city: z.string().optional().or(z.literal("")),
      pincode: z.string().optional().or(z.literal("")),
    })),
    defaultValues: {
      name: "", address: "", city: "", pincode: "",
      email: "", phone: "", status: "pending", doctors: [],
    },
  });

  const watchedName    = form.watch("name") || "";
  const watchedAddress = form.watch("address") || "";
  const watchedCity    = form.watch("city") || "";
  const watchedPincode = form.watch("pincode") || "";
  const watchedPhone   = form.watch("phone") || "";
  const watchedEmail   = form.watch("email") || "";
  const isEmailValid   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchedEmail);
  const isGenericEmail = /gmail\.|yahoo\.|hotmail\.|outlook\.|rediffmail\./.test(watchedEmail.toLowerCase());

  const trustScore = computeLiveTrustScore({
    name: watchedName, address: watchedAddress, city: watchedCity,
    pincode: watchedPincode, phone: watchedPhone,
    emailVerified, email: watchedEmail,
    medicalLicenseUrl, clinicRegCertUrl, googleBusinessUrl, gstNumber,
  });

  // Reset OTP on email change
  const resetOtpState = () => {
    setOtpSent(false); setOtpCode(""); setEmailVerified(false);
    setVerifiedToken(""); setOtpError(""); setResendCountdown(0);
  };
  useEffect(() => { resetOtpState(); }, [watchedEmail]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  useEffect(() => {
    if (otpCode.length === 6 && otpSent && !emailVerified && !verifyOtpMutation.isPending) {
      if (/^\d{6}$/.test(otpCode)) {
        verifyOtpMutation.mutate({ email: watchedEmail.trim().toLowerCase(), code: otpCode });
      }
    }
  }, [otpCode]);

  const sendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const r = await apiRequest("POST", "/api/public/otp/send", { email, purpose: "clinic_registration" });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Failed to send code"); }
      return r.json();
    },
    onSuccess: () => {
      setOtpSent(true); setOtpError(""); setResendCountdown(60);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      toast({ title: "Code sent", description: "Check your email for the 6-digit code." });
    },
    onError: (e: any) => setOtpError(e.message || "Failed to send code. Please try again."),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const r = await apiRequest("POST", "/api/public/otp/verify", { email, code, purpose: "clinic_registration" });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Invalid or expired code"); }
      return r.json();
    },
    onSuccess: (data) => {
      setEmailVerified(true); setVerifiedToken(data.verifiedToken); setOtpError("");
      toast({ title: "Email verified", description: "You can now complete your registration." });
    },
    onError: (e: any) => setOtpError(e.message || "Invalid code. Please try again."),
  });

  const handleSendOtp = () => {
    if (!isEmailValid) { setOtpError("Please enter a valid email first."); return; }
    sendOtpMutation.mutate(watchedEmail.trim().toLowerCase());
  };
  const handleVerifyOtp = () => {
    if (!/^\d{6}$/.test(otpCode)) { setOtpError("Please enter the 6-digit code from your email."); return; }
    verifyOtpMutation.mutate({ email: watchedEmail.trim().toLowerCase(), code: otpCode });
  };
  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits]; next[index] = digit;
    setOtpCode(next.join("").slice(0, 6)); setOtpError("");
    if (digit && index < 5) otpInputRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (index: number, e: any) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };
  const handleOtpPaste = (e: any) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return; e.preventDefault();
    setOtpCode(pasted); setOtpError("");
    otpInputRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  async function onSubmit(data: InsertClinic) {
    if (!emailVerified || !verifiedToken) {
      toast({ title: "Email verification required", description: "Please verify your email before submitting.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/clinics/register", {
        ...data, verifiedToken,
        googleBusinessUrl: googleBusinessUrl || undefined,
        gstNumber: gstNumber || undefined,
        medicalLicenseUrl: medicalLicenseUrl || undefined,
        clinicRegCertUrl: clinicRegCertUrl || undefined,
      });
      toast({ title: "Registration submitted", description: "We'll review your details and email your login credentials once approved." });
      setLocation("/getting-started");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Derived booleans for required section checkmarks
  const clinicInfoComplete = !!(watchedName.trim() && (watchedAddress.trim() || watchedCity.trim()) && watchedPincode.trim());
  const phoneComplete = watchedPhone.replace(/\D/g, "").length >= 10;
  const medDocsEarned = !!(medicalLicenseUrl || clinicRegCertUrl);

  // Sequential unlock gates
  const nameReady    = watchedName.trim().length >= 2;
  const addressReady = watchedAddress.trim().length >= 1;
  const addressUnlocked  = nameReady;
  const cityPinUnlocked  = nameReady && addressReady;
  const phoneUnlocked    = nameReady && addressReady;
  const emailUnlocked    = phoneComplete;

  // Progress steps
  const progressSteps = [
    { label: "Clinic name", done: nameReady,    active: !nameReady },
    { label: "Location",    done: nameReady && addressReady, active: nameReady && !addressReady },
    { label: "Phone",       done: phoneComplete, active: nameReady && addressReady && !phoneComplete },
    { label: "Verified",    done: emailVerified, active: phoneComplete && !emailVerified },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-background">

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[380px] h-[380px] bg-accent/5 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="relative w-full max-w-xl lg:max-w-4xl rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">

        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 pt-6 pb-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
          <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 h-32 w-32 text-white opacity-[0.06] pointer-events-none select-none" />

          <button type="button" onClick={() => setLocation("/getting-started")}
            className="absolute top-4 left-4 flex items-center gap-1 text-white/60 hover:text-white text-[11px] font-medium transition-colors"
            data-testid="link-back-getting-started">
            <ArrowLeft className="h-3 w-3" />Back
          </button>

          <div className="relative flex flex-col items-center text-center pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-white/60" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">For Clinic Owners</span>
            </div>
            <div className="relative mb-4">
              <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-accent/30 to-primary/20 blur-lg" />
              <div className="relative h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center ring-2 ring-white/10">
                <Building2 className="h-8 w-8 text-white drop-shadow" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5">Register Your Clinic</h1>
            <p className="text-sm text-white/65 max-w-sm">
              Takes 2 minutes. Fill in what you have — you can always add the rest from your dashboard.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
        </div>

        {/* Form body */}
        <div className="px-6 pt-6 pb-7">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>

              {/* Two-column grid on lg+, single column on mobile */}
              <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

              {/* ── LEFT COLUMN — required fields ── */}
              <div className="space-y-4">

              {/* Mobile: centered divider / Desktop: column heading */}
              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex-1 h-px bg-border/40" />
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-foreground/70 tracking-wide">To get started</p>
                  <p className="text-[10px] text-muted-foreground">We only need a few basics</p>
                </div>
                <div className="flex-1 h-px bg-border/40" />
              </div>
              <div className="hidden lg:block pb-1 border-b border-border/40">
                <p className="text-sm font-bold text-foreground">To get started</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">We only need a few basics</p>
              </div>

              {/* Step progress */}
              <StepProgress steps={progressSteps} />

              {/* Field group: Clinic name & location */}
              <div className="space-y-2.5">
                <FormField control={form.control} name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Building2}>
                          <Input placeholder="Clinic name" {...field}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-name" />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />

                <LockedField
                  locked={!addressUnlocked}
                  nudgeMessage="Enter your clinic name first"
                  onLockedClick={() => form.setFocus("name")}
                >
                  <FormField control={form.control} name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <FieldRow icon={MapPin}>
                            <Input placeholder="Area / locality" {...field} value={field.value || ""}
                              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                              data-testid="input-clinic-address" />
                          </FieldRow>
                        </FormControl>
                        <FormMessage className="text-xs pl-1" />
                      </FormItem>
                    )}
                  />
                </LockedField>

                <LockedField
                  locked={!cityPinUnlocked}
                  nudgeMessage="Fill in your area / locality first"
                  onLockedClick={() => form.setFocus("address")}
                >
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    <FormField control={form.control} name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <FieldRow icon={MapPin}>
                              <Input placeholder="City" {...field} value={field.value || ""}
                                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                                data-testid="input-clinic-city" />
                            </FieldRow>
                          </FormControl>
                          <FormMessage className="text-xs pl-1" />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="pincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <FieldRow icon={Hash}>
                              <Input placeholder="PIN code" {...field} value={field.value || ""}
                                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                                data-testid="input-clinic-pincode" />
                            </FieldRow>
                          </FormControl>
                          <FormMessage className="text-xs pl-1" />
                        </FormItem>
                      )}
                    />
                  </div>
                </LockedField>
              </div>

              {/* Field: Phone */}
              <LockedField
                locked={!phoneUnlocked}
                nudgeMessage="Fill in your location details first"
                onLockedClick={() => form.setFocus("address")}
              >
                <FormField control={form.control} name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Phone}>
                          <Input placeholder="Phone number  (+91 98765 43210)" {...field} value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-phone" />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
              </LockedField>

              {/* Field: Email + OTP */}
              <LockedField
                locked={!emailUnlocked}
                nudgeMessage="Enter a valid phone number first"
                onLockedClick={() => form.setFocus("phone")}
              >
              <div className="space-y-2">
                <FormField control={form.control} name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Mail}>
                          <Input type="email" placeholder="Email address" {...field} value={field.value || ""}
                            disabled={emailVerified}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm disabled:opacity-60"
                            data-testid="input-clinic-email" />
                          {emailVerified && (
                            <div className="pr-3 shrink-0">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </div>
                          )}
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />

                {/* OTP block */}
                {isEmailValid && (
                  <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                    emailVerified
                      ? "border-emerald-400/30 bg-emerald-500/8"
                      : otpSent
                      ? "border-primary/20 bg-card shadow-md shadow-primary/10"
                      : "border-border/40 bg-muted/10"
                  }`}>
                    {emailVerified ? (
                      <div className="flex items-center gap-3 p-3" data-testid="status-email-verified">
                        <div className="h-8 w-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Email verified</p>
                          <p className="text-[11px] text-muted-foreground">
                            {!isGenericEmail ? "Professional domain — earns bonus trust points" : "Verification complete"}
                          </p>
                        </div>
                      </div>
                    ) : !otpSent ? (
                      <div className="p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-primary/50 shrink-0" />
                          <p className="text-[11px] text-muted-foreground">Email verification required to complete registration</p>
                        </div>
                        <Button type="button" onClick={handleSendOtp}
                          disabled={!isEmailValid || sendOtpMutation.isPending}
                          className="w-full h-9 text-xs font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 rounded-xl"
                          data-testid="button-send-otp">
                          {sendOtpMutation.isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</> : "Send Verification Code"}
                        </Button>
                      </div>
                    ) : (
                      <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300" data-testid="section-otp-verification">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">Enter the code</p>
                            <p className="text-[11px] text-muted-foreground">Sent to your email</p>
                          </div>
                          {verifyOtpMutation.isPending
                            ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                            : <Shield className="h-4 w-4 text-primary/50" />}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {otpDigits.map((digit, i) => (
                            <input key={i}
                              ref={n => { otpInputRefs.current[i] = n; }}
                              value={digit}
                              onChange={e => handleOtpDigitChange(i, e.target.value)}
                              onKeyDown={e => handleOtpKeyDown(i, e)}
                              onPaste={handleOtpPaste}
                              inputMode="numeric" maxLength={1}
                              disabled={verifyOtpMutation.isPending}
                              className={`h-12 w-10 sm:w-12 rounded-xl border text-center text-xl font-bold outline-none transition-all shadow-sm ${
                                digit ? "border-primary/35 bg-primary/5 text-foreground" : "border-border/60 bg-background text-foreground"
                              } focus:border-primary/70 focus:ring-4 focus:ring-primary/15 disabled:opacity-60`}
                              data-testid={`input-otp-digit-${i}`}
                              aria-label={`OTP digit ${i + 1}`} />
                          ))}
                          <button type="button" onClick={handleVerifyOtp}
                            disabled={!isOtpComplete || verifyOtpMutation.isPending}
                            className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                              isOtpComplete
                                ? "border-emerald-400/50 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
                                : "border-border/60 bg-muted/40 text-muted-foreground"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                            data-testid="button-verify-otp">
                            {verifyOtpMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                          </button>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                          {resendCountdown > 0
                            ? <><Loader2 className="h-3 w-3 animate-spin text-primary" /><span data-testid="text-resend-countdown">Resend in 0:{resendCountdown.toString().padStart(2, "0")}</span></>
                            : <button type="button" onClick={handleSendOtp} disabled={sendOtpMutation.isPending}
                                className="font-bold text-primary hover:text-accent transition-colors disabled:opacity-60"
                                data-testid="button-resend-otp">
                                {sendOtpMutation.isPending ? "Sending…" : "Resend code"}
                              </button>}
                        </div>
                      </div>
                    )}
                    {otpError && <p className="px-3 pb-3 text-[11px] text-destructive" data-testid="text-otp-error">{otpError}</p>}
                  </div>
                )}
              </div>
              </LockedField>

              </div>{/* end left column */}

              {/* ── RIGHT COLUMN — optional boost ── */}
              <div className="space-y-4 mt-6 lg:mt-0">

                {/* Mobile: centered pill divider / Desktop: column heading */}
                <div className="flex items-center gap-3 pt-2 lg:hidden">
                  <div className="flex-1 h-px bg-border/40" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Optional</span>
                  </div>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <div className="hidden lg:block pb-1 border-b border-border/40">
                  <p className="text-sm font-bold text-foreground">Optional</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Boost your Trust Score &amp; speed up approval</p>
                </div>

                {/* Optional intro */}
                <p className="text-xs text-muted-foreground leading-relaxed lg:text-left text-center">
                  Want to boost your visibility? These raise your <span className="font-semibold text-foreground">Trust Score</span> shown to patients and help speed up admin approval. You can also add them from your dashboard later.
                </p>

                {/* ── BOOST CARDS ── */}
                <div className="space-y-2">
                  <BoostCard icon={FileText} title="Medical license & registration cert"
                    subtitle="Helps verify your clinic's credentials"
                    earned={medDocsEarned} testId="boost-card-medical">
                    <div className="space-y-2">
                      <DocUpload label="Doctor's medical / MCI license"
                        value={medicalLicenseUrl} onChange={setMedicalLicenseUrl} testId="upload-medical-license" />
                      <DocUpload label="Clinic registration certificate"
                        value={clinicRegCertUrl} onChange={setClinicRegCertUrl} testId="upload-clinic-reg-cert" />
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        You can upload these later from your dashboard.
                      </p>
                    </div>
                  </BoostCard>

                  <BoostCard icon={Link2} title="Google Business Profile"
                    subtitle="We pull your rating & reviews for patients"
                    earned={!!googleBusinessUrl} testId="boost-card-google">
                    <div className="space-y-2">
                      <FieldRow icon={Link2}>
                        <Input placeholder="Paste your Google Maps listing URL"
                          value={googleBusinessUrl} onChange={e => setGoogleBusinessUrl(e.target.value)}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                          data-testid="input-google-business-url" />
                      </FieldRow>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Once linked, we auto-pull your star rating, review count, and recent reviews — visible to patients.
                      </p>
                    </div>
                  </BoostCard>

                  <BoostCard icon={Receipt} title="GST registration number"
                    subtitle="For clinics that issue tax invoices"
                    earned={!!gstNumber.trim()} testId="boost-card-gst">
                    <div className="space-y-2">
                      <FieldRow icon={Receipt}>
                        <Input placeholder="GSTIN number"
                          value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm font-mono"
                          data-testid="input-gst-number" />
                      </FieldRow>
                      <p className="text-[11px] text-muted-foreground">Not required unless you want to issue GST-compliant invoices.</p>
                    </div>
                  </BoostCard>
                </div>

              </div>{/* end right column */}

              </div>{/* end two-column grid */}

              {/* ── FULL-WIDTH FOOTER — trust score + review notice + submit ── */}
              <div className="space-y-4 mt-6">

                {emailVerified && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <TrustSummary score={trustScore} />
                  </div>
                )}

                {/* Review notice */}
                <div className="rounded-xl border border-amber-400/40 bg-amber-500/5 px-4 py-3 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Your application is subject to review.</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    We'll send our decision to your registered email address. Clinics with a higher Trust Score are typically reviewed and approved faster — the optional fields above make a real difference.
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This process also ensures that every clinic listed on BookMySlot is verified — so patients can book with confidence, and your listing stands among genuinely trusted providers.
                  </p>
                </div>

                {/* Submit */}
                <div className="flex flex-col gap-3 pt-1">
                  <Button type="submit"
                    className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl disabled:opacity-50"
                    disabled={isSubmitting || !emailVerified}
                    data-testid="button-submit-registration">
                    {isSubmitting
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                      : !emailVerified
                      ? "Verify your email to continue"
                      : "Submit Registration"}
                  </Button>
                  <button type="button" onClick={() => setLocation("/getting-started")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
                    data-testid="button-cancel-registration">
                    Cancel and go back
                  </button>
                </div>

              </div>{/* end full-width footer */}

            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
