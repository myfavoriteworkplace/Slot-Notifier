import { useState, useRef, useEffect } from "react";
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
  Shield, CheckCircle2,
} from "lucide-react";
import { z } from "zod";

function FieldRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
      <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

export default function RegisterClinic() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const otpDigits = Array.from({ length: 6 }, (_, i) => otpCode[i] || "");
  const isOtpComplete = otpCode.length === 6;

  const form = useForm<InsertClinic>({
    resolver: zodResolver(insertClinicSchema.extend({
      email: z.string().email("Valid email is required"),
      phone: z.string().min(10, "Valid phone number is required"),
      address: z.string().optional().or(z.literal("")),
      city: z.string().optional().or(z.literal("")),
      pincode: z.string().optional().or(z.literal("")),
    })),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      pincode: "",
      email: "",
      phone: "",
      status: "pending",
      doctors: [],
    },
  });

  const watchedEmail = form.watch("email");
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchedEmail || "");

  const resetOtpState = () => {
    setOtpSent(false);
    setOtpCode("");
    setEmailVerified(false);
    setVerifiedToken("");
    setOtpError("");
    setResendCountdown(0);
  };

  useEffect(() => {
    resetOtpState();
  }, [watchedEmail]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (otpCode.length === 6 && otpSent && !emailVerified && !verifyOtpMutation.isPending) {
      const code = otpCode.trim();
      if (/^\d{6}$/.test(code)) {
        verifyOtpMutation.mutate({ email: watchedEmail.trim().toLowerCase(), code });
      }
    }
  }, [otpCode]);

  const sendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/public/otp/send", { email, purpose: "clinic_registration" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send verification code");
      }
      return response.json();
    },
    onSuccess: () => {
      setOtpSent(true);
      setOtpError("");
      setResendCountdown(60);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      toast({ title: "Code Sent!", description: "Check your email for the 6-digit verification code." });
    },
    onError: (error: any) => {
      setOtpError(error.message || "Failed to send verification code. Please try again.");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await apiRequest("POST", "/api/public/otp/verify", { email, code, purpose: "clinic_registration" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Invalid or expired code");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setEmailVerified(true);
      setVerifiedToken(data.verifiedToken);
      setOtpError("");
      toast({ title: "Email Verified!", description: "You can now complete your registration." });
    },
    onError: (error: any) => {
      setOtpError(error.message || "Invalid code. Please try again.");
    },
  });

  const handleSendOtp = () => {
    if (!isEmailValid) {
      setOtpError("Please enter a valid email address first.");
      return;
    }
    sendOtpMutation.mutate(watchedEmail.trim().toLowerCase());
  };

  const handleVerifyOtp = () => {
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setOtpError("Please enter the 6-digit code from your email.");
      return;
    }
    verifyOtpMutation.mutate({ email: watchedEmail.trim().toLowerCase(), code });
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    const nextCode = nextDigits.join("").slice(0, 6);
    setOtpCode(nextCode);
    setOtpError("");
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: any) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event: any) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setOtpCode(pasted);
    setOtpError("");
    otpInputRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  async function onSubmit(data: InsertClinic) {
    if (!emailVerified || !verifiedToken) {
      toast({
        title: "Email Verification Required",
        description: "Please verify your email before submitting.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/clinics/register", { ...data, verifiedToken });
      toast({
        title: "Registration Submitted",
        description: "Your clinic registration is pending approval by the system administrator.",
      });
      setLocation("/getting-started");
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Something went wrong during registration.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-background">

      {/* Ambient glow blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[380px] h-[380px] bg-accent/5 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="relative w-full max-w-xl rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">

        {/* 3px neon top bar */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Gradient hero header */}
        <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 pt-6 pb-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />

          <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 h-32 w-32 text-white opacity-[0.06] pointer-events-none select-none" />

          <button
            type="button"
            onClick={() => setLocation("/getting-started")}
            className="absolute top-4 left-4 flex items-center gap-1 text-white/60 hover:text-white text-[11px] font-medium transition-colors"
            data-testid="link-back-getting-started"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
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

            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5">
              Register Your Clinic
            </h1>
            <p className="text-sm text-white/55 max-w-sm">
              Join our network of healthcare providers. Fill in your details and we'll get you set up.
            </p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
        </div>

        {/* Form body */}
        <div className="px-6 pt-6 pb-7 space-y-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* ── Section: Clinic Info ── */}
              <SectionLabel>Clinic Information</SectionLabel>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FieldRow icon={Building2}>
                        <Input
                          placeholder="City Dental Clinic"
                          {...field}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                          data-testid="input-clinic-name"
                        />
                      </FieldRow>
                    </FormControl>
                    <FormMessage className="text-xs pl-1" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Mail}>
                          <Input
                            type="email"
                            placeholder="contact@clinic.com"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-email"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Phone}>
                          <Input
                            placeholder="+91 9876543210"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-phone"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Email OTP verification block ── */}
              {isEmailValid && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">

                  {!emailVerified && !otpSent && (
                    <div className="flex items-center gap-2 px-1">
                      <Shield className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                      <p className="text-[11px] text-muted-foreground">
                        Email verification is required to complete registration
                      </p>
                    </div>
                  )}

                  <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                    emailVerified
                      ? "border-emerald-400/30 bg-emerald-500/10 shadow-sm shadow-emerald-500/10"
                      : otpSent
                      ? "border-primary/20 bg-card shadow-lg shadow-primary/10"
                      : "border-border/60 bg-muted/20"
                  }`}>
                    {emailVerified ? (
                      <div className="flex items-center gap-3 p-3 text-emerald-600 animate-in fade-in slide-in-from-top-1 duration-300" data-testid="status-email-verified">
                        <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Email verified</p>
                          <p className="text-[11px] text-emerald-700/80">You can now complete your clinic registration.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!otpSent && (
                          <div className="p-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Shield className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0 pt-0.5">
                                <p className="text-sm font-bold text-foreground">Verify your email</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">We'll send a 6-digit code to confirm</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              onClick={handleSendOtp}
                              disabled={!isEmailValid || sendOtpMutation.isPending}
                              className="w-full h-10 text-xs font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 rounded-xl shadow-md shadow-primary/15"
                              data-testid="button-send-otp"
                            >
                              {sendOtpMutation.isPending ? (
                                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending Code…</>
                              ) : (
                                "Send Verification Code"
                              )}
                            </Button>
                          </div>
                        )}

                        {otpSent && (
                          <div className="p-4 animate-in fade-in slide-in-from-top-2 duration-300" data-testid="section-otp-verification">
                            <div className="flex items-center justify-between gap-3 mb-4">
                              <div>
                                <p className="text-sm font-bold text-foreground">Verify your email</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Enter the code we sent to your email</p>
                              </div>
                              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                {verifyOtpMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                ) : (
                                  <Shield className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              {otpDigits.map((digit, index) => (
                                <input
                                  key={index}
                                  ref={node => { otpInputRefs.current[index] = node; }}
                                  value={digit}
                                  onChange={e => handleOtpDigitChange(index, e.target.value)}
                                  onKeyDown={e => handleOtpKeyDown(index, e)}
                                  onPaste={handleOtpPaste}
                                  inputMode="numeric"
                                  maxLength={1}
                                  disabled={verifyOtpMutation.isPending}
                                  className={`h-12 w-10 sm:w-12 rounded-xl border text-center text-xl font-bold outline-none transition-all duration-200 shadow-sm ${
                                    digit
                                      ? "border-primary/35 bg-primary/8 text-foreground shadow-primary/10"
                                      : "border-border/60 bg-background text-foreground"
                                  } focus:border-primary/70 focus:bg-white focus:ring-4 focus:ring-primary/15 focus:shadow-lg focus:shadow-primary/15 disabled:opacity-60`}
                                  data-testid={`input-otp-digit-${index}`}
                                  aria-label={`OTP digit ${index + 1}`}
                                />
                              ))}
                              <button
                                type="button"
                                onClick={handleVerifyOtp}
                                disabled={!isOtpComplete || verifyOtpMutation.isPending}
                                className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all duration-200 shrink-0 ${
                                  isOtpComplete
                                    ? "border-emerald-400/50 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
                                    : "border-border/60 bg-muted/40 text-muted-foreground"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                data-testid="button-verify-otp"
                                aria-label="Verify OTP code"
                              >
                                {verifyOtpMutation.isPending ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                              {resendCountdown > 0 ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                  <span data-testid="text-resend-countdown">Resend code in 0:{resendCountdown.toString().padStart(2, "0")}</span>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleSendOtp}
                                  disabled={sendOtpMutation.isPending}
                                  className="font-bold text-primary hover:text-accent transition-colors disabled:opacity-60"
                                  data-testid="button-resend-otp"
                                >
                                  {sendOtpMutation.isPending ? "Sending…" : "Resend code"}
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {otpError && (
                          <p className="px-4 pb-3 text-[11px] text-destructive animate-in fade-in duration-200" data-testid="text-otp-error">{otpError}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Section: Location ── */}
              <SectionLabel>Location</SectionLabel>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FieldRow icon={MapPin}>
                        <Input
                          placeholder="Street / Building"
                          {...field}
                          value={field.value || ""}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                          data-testid="input-clinic-address"
                        />
                      </FieldRow>
                    </FormControl>
                    <FormMessage className="text-xs pl-1" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={MapPin}>
                          <Input
                            placeholder="e.g. Kochi"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-city"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Hash}>
                          <Input
                            placeholder="e.g. 682001"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-pincode"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Approval info panel */}
              <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your registration will be reviewed by our admin team. Once approved, your login credentials will be automatically generated and sent to your registered email address.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-1">
                <Button
                  type="submit"
                  className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl disabled:opacity-50"
                  disabled={isSubmitting || !emailVerified}
                  data-testid="button-submit-registration"
                >
                  {isSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                    : !emailVerified
                    ? "Verify Email to Continue"
                    : "Submit Registration"
                  }
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
