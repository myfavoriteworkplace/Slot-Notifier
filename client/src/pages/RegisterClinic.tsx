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
  Info, ArrowLeft, Sparkles,
  Shield, CheckCircle2, ChevronDown, ChevronUp,
  FileText, Link2, Receipt, Upload, X,
} from "lucide-react";
import { z } from "zod";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function SectionLabel({ children, badge }: { children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground whitespace-nowrap">{children}</span>
      {badge}
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

function PtsBadge({ pts, dim }: { pts: string; dim?: boolean }) {
  return (
    <span className={`text-[11px] font-bold tabular-nums ${dim ? "text-muted-foreground/50" : "text-primary"}`}>
      {pts}
    </span>
  );
}

// ─── Live trust score (mirrors server logic) ──────────────────────────────────

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
  if (score >= 75) return { label: "Verified", color: "text-emerald-500" };
  if (score >= 50) return { label: "Strong", color: "text-blue-500" };
  if (score >= 25) return { label: "Moderate", color: "text-amber-500" };
  return { label: "Basic", color: "text-muted-foreground" };
}

// ─── Trust Strength widget ────────────────────────────────────────────────────

function TrustMeter({ score }: { score: number }) {
  const band = trustBand(score);
  const pct = score;

  const barColor =
    score >= 75 ? "from-emerald-400 to-emerald-500" :
    score >= 50 ? "from-blue-400 to-blue-500" :
    score >= 25 ? "from-amber-400 to-amber-500" :
    "from-muted-foreground/30 to-muted-foreground/40";

  const hint =
    score === 0 ? "Fill in the required fields below to begin" :
    score < 25 ? "Add your phone and location to increase trust" :
    score < 50 ? "Verify your email to continue boosting your score" :
    score < 75 ? "Add optional documents to reach Verified status" :
    "Excellent — your clinic profile is fully trusted";

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Trust Strength</span>
        <div className="flex items-baseline gap-0.5">
          <span className={`text-xl font-extrabold tabular-nums ${band.color}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>

      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
        {[25, 50, 75].map(tick => (
          <div
            key={tick}
            className="absolute top-0 h-full w-px bg-background/60"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>

      <div className="flex justify-between text-[9px] text-muted-foreground/70 font-medium uppercase tracking-wide">
        <span>Basic</span>
        <span>Moderate</span>
        <span>Strong</span>
        <span>Verified</span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
    </div>
  );
}

// ─── Doc upload zone ──────────────────────────────────────────────────────────

function DocUpload({
  label, pts, value, onChange, testId,
}: {
  label: string; pts: string; value: string;
  onChange: (url: string) => void;
  testId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const sigRes = await apiRequest("POST", "/api/public/uploads/signed-url", {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        folder: "clinic-docs",
      });
      if (!sigRes.ok) {
        const body = await sigRes.json().catch(() => ({}));
        throw new Error(body.message || "Upload service unavailable");
      }
      const { uploadUrl, publicUrl } = await sigRes.json();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");
      onChange(publicUrl);
      toast({ title: "File uploaded", description: file.name });
    } catch (err: any) {
      toast({
        title: "Upload unavailable",
        description: err.message?.includes("not configured") || err.message?.includes("unavailable")
          ? "File storage is not set up yet. You can upload this from your dashboard after approval."
          : err.message || "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [onChange, toast]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-700 dark:text-emerald-400 flex-1 truncate">{label} uploaded</span>
        <button
          type="button"
          onClick={() => onChange("")}
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => fileRef.current?.click()}
      className="relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/50 bg-muted/10 py-5 px-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group"
      data-testid={testId}
    >
      <input ref={fileRef} type="file" className="hidden" onChange={onFileChange}
        accept=".pdf,.jpg,.jpeg,.png,.webp" />
      {uploading ? (
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
      ) : (
        <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      )}
      <p className="text-xs text-muted-foreground text-center leading-snug">
        {uploading ? "Uploading…" : <><span className="font-semibold text-foreground">{label}</span><br />Drag & drop or click to browse</>}
      </p>
      <span className="text-[10px] text-primary font-bold">{pts}</span>
    </div>
  );
}

// ─── Boost card (collapsible accordion) ──────────────────────────────────────

function BoostCard({
  icon: Icon, title, subtitle, pts, earned, children, testId,
}: {
  icon: React.ElementType;
  title: string; subtitle: string; pts: string;
  earned: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
        data-testid={testId}
      >
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${earned ? "bg-emerald-500/10" : "bg-muted/40"}`}>
          {earned
            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            : <Icon className="h-4 w-4 text-muted-foreground" />
          }
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className={`text-sm font-bold ${earned ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PtsBadge pts={pts} dim={!earned} />
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border/40 bg-muted/10 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
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

  // OTP state
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // Optional boost field state (outside form — not part of InsertClinic schema)
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

  const watchedName = form.watch("name") || "";
  const watchedAddress = form.watch("address") || "";
  const watchedCity = form.watch("city") || "";
  const watchedPincode = form.watch("pincode") || "";
  const watchedPhone = form.watch("phone") || "";
  const watchedEmail = form.watch("email") || "";
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchedEmail);

  const trustScore = computeLiveTrustScore({
    name: watchedName, address: watchedAddress, city: watchedCity,
    pincode: watchedPincode, phone: watchedPhone,
    emailVerified, email: watchedEmail,
    medicalLicenseUrl, clinicRegCertUrl, googleBusinessUrl, gstNumber,
  });

  // Email points for display
  const isGenericEmail = /gmail\.|yahoo\.|hotmail\.|outlook\.|rediffmail\./.test(watchedEmail.toLowerCase());
  const emailPts = isGenericEmail ? "+10" : "+15";

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
      toast({ title: "Code Sent!", description: "Check your email for the 6-digit verification code." });
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
      toast({ title: "Email Verified!", description: "You can now complete your registration." });
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
      toast({ title: "Email Verification Required", description: "Please verify your email before submitting.", variant: "destructive" });
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
      toast({ title: "Registration Submitted", description: "Your clinic is pending approval. We'll email your login credentials once approved." });
      setLocation("/getting-started");
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Derived booleans for card earned state ──
  const clinicInfoEarned = !!(watchedName.trim() && (watchedAddress.trim() || watchedCity.trim()) && watchedPincode.trim());
  const phoneEarned = watchedPhone.replace(/\D/g, "").length >= 10;
  const medDocsEarned = !!(medicalLicenseUrl || clinicRegCertUrl);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-background">

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[380px] h-[380px] bg-accent/5 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="relative w-full max-w-xl rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">

        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 pt-6 pb-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
          <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 h-32 w-32 text-white opacity-[0.06] pointer-events-none select-none" />

          <button
            type="button"
            onClick={() => setLocation("/getting-started")}
            className="absolute top-4 left-4 flex items-center gap-1 text-white/60 hover:text-white text-[11px] font-medium transition-colors"
            data-testid="link-back-getting-started"
          >
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
            <p className="text-sm text-white/55 max-w-sm">Join our network of healthcare providers. Build trust with patients from day one.</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
        </div>

        {/* Body */}
        <div className="px-6 pt-6 pb-7 space-y-5">

          {/* Trust meter */}
          <TrustMeter score={trustScore} />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* ── REQUIRED FIELDS ── */}
              <SectionLabel badge={
                <span className="text-[9px] font-bold uppercase tracking-wide border border-primary/30 text-primary bg-primary/8 rounded-full px-2 py-0.5 shrink-0">
                  Must Complete
                </span>
              }>Required Fields</SectionLabel>

              {/* Card 1 — Clinic name & area */}
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/10">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${clinicInfoEarned ? "bg-emerald-500/10" : "bg-muted/40"}`}>
                    {clinicInfoEarned
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <MapPin className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Clinic name &amp; area</p>
                    <p className="text-[11px] text-muted-foreground">Name, area/locality, and PIN code</p>
                  </div>
                  <PtsBadge pts="+20 pts" dim={!clinicInfoEarned} />
                </div>
                <div className="p-3 space-y-2">
                  <FormField
                    control={form.control} name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <FieldRow icon={Building2}>
                            <Input placeholder="City Dental Clinic" {...field}
                              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                              data-testid="input-clinic-name" />
                          </FieldRow>
                        </FormControl>
                        <FormMessage className="text-xs pl-1" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control} name="address"
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
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control} name="city"
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
                    <FormField
                      control={form.control} name="pincode"
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
                </div>
              </div>

              {/* Card 2 — Phone */}
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/10">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${phoneEarned ? "bg-emerald-500/10" : "bg-muted/40"}`}>
                    {phoneEarned
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <Phone className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Phone number</p>
                    <p className="text-[11px] text-muted-foreground">Valid 10-digit mobile number</p>
                  </div>
                  <PtsBadge pts="+30 pts" dim={!phoneEarned} />
                </div>
                <div className="p-3">
                  <FormField
                    control={form.control} name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <FieldRow icon={Phone}>
                            <Input placeholder="+91 98765 43210" {...field} value={field.value || ""}
                              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                              data-testid="input-clinic-phone" />
                          </FieldRow>
                        </FormControl>
                        <FormMessage className="text-xs pl-1" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Card 3 — Email with OTP */}
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/10">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${emailVerified ? "bg-emerald-500/10" : "bg-muted/40"}`}>
                    {emailVerified
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <Mail className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Email address</p>
                    <p className="text-[11px] text-muted-foreground">
                      {isEmailValid && !isGenericEmail
                        ? "Professional domain — earns +15 pts"
                        : "Domain email earns more than Gmail"}
                    </p>
                  </div>
                  <PtsBadge pts={`${emailPts} pts`} dim={!emailVerified} />
                </div>
                <div className="p-3 space-y-3">
                  <FormField
                    control={form.control} name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <FieldRow icon={Mail}>
                            <Input type="email" placeholder="clinic@yourdomain.com" {...field} value={field.value || ""}
                              disabled={emailVerified}
                              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm disabled:opacity-60"
                              data-testid="input-clinic-email" />
                          </FieldRow>
                        </FormControl>
                        <FormMessage className="text-xs pl-1" />
                      </FormItem>
                    )}
                  />

                  {/* OTP block */}
                  {isEmailValid && (
                    <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                      emailVerified
                        ? "border-emerald-400/30 bg-emerald-500/10"
                        : otpSent
                        ? "border-primary/20 bg-card shadow-md shadow-primary/10"
                        : "border-border/40 bg-muted/10"
                    }`}>
                      {emailVerified ? (
                        <div className="flex items-center gap-3 p-3 text-emerald-600 animate-in fade-in duration-300" data-testid="status-email-verified">
                          <div className="h-8 w-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">Email verified</p>
                            <p className="text-[11px] text-emerald-700/80">Verification complete — ready to submit.</p>
                          </div>
                        </div>
                      ) : !otpSent ? (
                        <div className="p-3 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-primary/60" />
                            <p className="text-[11px] text-muted-foreground">OTP verification required to complete registration</p>
                          </div>
                          <Button
                            type="button" onClick={handleSendOtp}
                            disabled={!isEmailValid || sendOtpMutation.isPending}
                            className="w-full h-9 text-xs font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 rounded-xl"
                            data-testid="button-send-otp"
                          >
                            {sendOtpMutation.isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</> : "Send Verification Code"}
                          </Button>
                        </div>
                      ) : (
                        <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300" data-testid="section-otp-verification">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold">Enter verification code</p>
                              <p className="text-[11px] text-muted-foreground">Sent to your email</p>
                            </div>
                            {verifyOtpMutation.isPending
                              ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              : <Shield className="h-4 w-4 text-primary/60" />}
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {otpDigits.map((digit, i) => (
                              <input
                                key={i}
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
                                aria-label={`OTP digit ${i + 1}`}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={handleVerifyOtp}
                              disabled={!isOtpComplete || verifyOtpMutation.isPending}
                              className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                                isOtpComplete
                                  ? "border-emerald-400/50 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
                                  : "border-border/60 bg-muted/40 text-muted-foreground"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                              data-testid="button-verify-otp"
                            >
                              {verifyOtpMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                            </button>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                            {resendCountdown > 0 ? (
                              <><Loader2 className="h-3 w-3 animate-spin text-primary" />
                              <span data-testid="text-resend-countdown">Resend in 0:{resendCountdown.toString().padStart(2, "0")}</span></>
                            ) : (
                              <button type="button" onClick={handleSendOtp} disabled={sendOtpMutation.isPending}
                                className="font-bold text-primary hover:text-accent transition-colors disabled:opacity-60"
                                data-testid="button-resend-otp">
                                {sendOtpMutation.isPending ? "Sending…" : "Resend code"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {otpError && (
                        <p className="px-3 pb-3 text-[11px] text-destructive" data-testid="text-otp-error">{otpError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── BOOST YOUR TRUST SCORE ── */}
              <SectionLabel badge={
                <span className="text-[9px] font-bold uppercase tracking-wide border border-border/50 text-muted-foreground rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                  Optional · Do Later Too
                </span>
              }>Boost Your Trust Score</SectionLabel>

              <div className="rounded-xl border border-border/40 bg-muted/10 p-3 text-xs text-muted-foreground leading-relaxed">
                These are not required to register. Complete them now or from your dashboard anytime — each one raises your <span className="font-bold text-foreground">Trust Score</span> shown to patients and improves admin approval speed.
              </div>

              {/* Boost card 1 — Medical docs */}
              <BoostCard
                icon={FileText}
                title="Medical license &amp; registration cert"
                subtitle="Strongest trust documents"
                pts="+25 pts"
                earned={medDocsEarned}
                testId="boost-card-medical"
              >
                <div className="space-y-2">
                  <DocUpload
                    label="Doctor's medical / MCI license"
                    pts="+15 pts"
                    value={medicalLicenseUrl}
                    onChange={setMedicalLicenseUrl}
                    testId="upload-medical-license"
                  />
                  <DocUpload
                    label="Clinic registration certificate"
                    pts="+10 pts"
                    value={clinicRegCertUrl}
                    onChange={setClinicRegCertUrl}
                    testId="upload-clinic-reg-cert"
                  />
                  <p className="text-[11px] text-muted-foreground leading-snug pt-1">
                    You can upload these later from your dashboard — required before your first patient booking goes live.
                  </p>
                </div>
              </BoostCard>

              {/* Boost card 2 — Google Business */}
              <BoostCard
                icon={Link2}
                title="Google Business Profile link"
                subtitle="We pull your rating &amp; reviews automatically"
                pts="+15 pts"
                earned={!!googleBusinessUrl}
                testId="boost-card-google"
              >
                <div className="space-y-2">
                  <FieldRow icon={Link2}>
                    <Input
                      placeholder="Paste your Google Maps listing URL"
                      value={googleBusinessUrl}
                      onChange={e => setGoogleBusinessUrl(e.target.value)}
                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                      data-testid="input-google-business-url"
                    />
                  </FieldRow>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Once linked, we auto-pull your star rating, review count, and 3 recent reviews. These appear on your clinic profile and in the admin approval panel.
                  </p>
                </div>
              </BoostCard>

              {/* Boost card 3 — GST */}
              <BoostCard
                icon={Receipt}
                title="GST registration number"
                subtitle="Only needed for tax invoicing"
                pts="+10 pts"
                earned={!!gstNumber.trim()}
                testId="boost-card-gst"
              >
                <FieldRow icon={Receipt}>
                  <Input
                    placeholder="GSTIN number"
                    value={gstNumber}
                    onChange={e => setGstNumber(e.target.value.toUpperCase())}
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm font-mono"
                    data-testid="input-gst-number"
                  />
                </FieldRow>
                <p className="text-[11px] text-muted-foreground leading-snug pt-1">
                  Not required unless you want to issue GST-compliant invoices through the platform.
                </p>
              </BoostCard>

              {/* Info panel */}
              <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Once approved, your login credentials will be automatically generated and sent to your registered email address.
                  </p>
                </div>
              </div>

              {/* Submit */}
              <div className="flex flex-col gap-3 pt-1">
                <Button
                  type="submit"
                  className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl disabled:opacity-50"
                  disabled={isSubmitting || !emailVerified}
                  data-testid="button-submit-registration"
                >
                  {isSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                    : !emailVerified
                    ? "Verify Email to Continue"
                    : `Submit Registration · Trust Score ${trustScore}/100`}
                </Button>
                <button
                  type="button"
                  onClick={() => setLocation("/getting-started")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
                  data-testid="button-cancel-registration"
                >
                  Cancel and go back
                </button>
              </div>

            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
