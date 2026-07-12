import { useState, useEffect } from "react";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Building2,
  ArrowLeft,
  Info,
  Stethoscope,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CalendarCheck,
  Package,
  FileText,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";

const scrollIntoView = (e: React.FocusEvent<HTMLInputElement>) =>
  e.target.scrollIntoView({ behavior: "smooth", block: "center" });

export default function ClinicLogin() {
  const [clinicUsername, setClinicUsername] = useState("");
  const [clinicPassword, setClinicPassword] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorPassword, setDoctorPassword] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useLocation();
  const initialTab = ((): "clinic" | "doctor" => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("tab") === "doctor" ? "doctor" : "clinic";
    } catch {
      return "clinic";
    }
  })();
  const [activeTab, setActiveTab] = useState<"clinic" | "doctor">(initialTab);
  const [showClinicPassword, setShowClinicPassword] = useState(false);
  const [showDoctorPassword, setShowDoctorPassword] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const [forgotModal, setForgotModal] = useState<"clinic" | "doctor" | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [forgotError, setForgotError] = useState("");

  const { login: clinicLogin, isLoggingIn: isClinicLoggingIn, isAuthenticated: isClinicAuthenticated } = useClinicAuth();
  const { login: doctorLogin, isLoggingIn: isDoctorLoggingIn, isAuthenticated: isDoctorAuthenticated } = useDoctorAuth();
  const { isAuthenticated: isAdminAuthenticated } = useAuth();

  useEffect(() => {
    if (isClinicAuthenticated) setLocation("/clinic-dashboard");
  }, [isClinicAuthenticated, setLocation]);

  useEffect(() => {
    if (isDoctorAuthenticated) setLocation("/doctor-dashboard");
  }, [isDoctorAuthenticated, setLocation]);

  const humaniseError = (raw: string): string => {
    if (!raw) return "Something went wrong. Please try again.";
    const lower = raw.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network"))
      return "Unable to connect to the server. Please check your internet connection and try again.";
    if (lower.includes("invalid credentials") || lower.includes("401"))
      return "Incorrect username or password. Please try again.";
    if (lower.includes("too many"))
      return "Too many login attempts. Please wait a moment and try again.";
    return raw;
  };

  const handleClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await clinicLogin({ username: clinicUsername, password: clinicPassword });
      setLocation("/clinic-dashboard");
    } catch (err: any) {
      setError(humaniseError(err.message || "Login failed"));
    }
  };

  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await doctorLogin({ email: doctorEmail, password: doctorPassword });
      setLocation("/doctor-dashboard");
    } catch (err: any) {
      setError(humaniseError(err.message || "Login failed"));
    }
  };

  const handleDemo = async () => {
    setError("");
    setActiveTab("clinic");
    setClinicUsername("demo_clinic");
    setClinicPassword("demo_password123");
    setIsDemoLoading(true);
    try {
      await clinicLogin({ username: "demo_clinic", password: "demo_password123" });
      setLocation("/clinic-dashboard");
    } catch (err: any) {
      setError(humaniseError(err.message || "Demo login failed"));
    } finally {
      setIsDemoLoading(false);
    }
  };

  const openForgot = (type: "clinic" | "doctor") => {
    setForgotEmail("");
    setForgotStatus("idle");
    setForgotError("");
    setForgotModal(type);
  };

  const closeForgot = () => {
    setForgotModal(null);
    setForgotStatus("idle");
    setForgotEmail("");
    setForgotError("");
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotModal) return;
    setForgotError("");
    setForgotStatus("sending");
    try {
      const endpoint = forgotModal === "clinic"
        ? "/api/auth/clinic/forgot-password"
        : "/api/auth/doctor/forgot-password";
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotStatus("sent");
    } catch {
      setForgotError("Unable to connect. Please check your connection.");
      setForgotStatus("idle");
    }
  };

  const handleDoctorDemo = async () => {
    setError("");
    setDoctorEmail("demo.doctor@bookmyslot.in");
    setDoctorPassword("demo_doctor123");
    setIsDemoLoading(true);
    try {
      await doctorLogin({ email: "demo.doctor@bookmyslot.in", password: "demo_doctor123" });
      setLocation("/doctor-dashboard");
    } catch (err: any) {
      setError(humaniseError(err.message || "Demo login failed"));
    } finally {
      setIsDemoLoading(false);
    }
  };

  const featureTiles = [
    {
      icon: <CalendarCheck className="h-4 w-4 text-primary" />,
      title: "Smart Appointment Management",
      desc: "Real-time booking, doctor approval flow, instant patient notifications",
      badge: "Live",
      badgeNew: false,
    },
    {
      icon: <Package className="h-4 w-4 text-primary" />,
      title: "Inventory with Expiry Alerts",
      desc: "Track consumables and equipment — auto-alerts before stock runs out",
      badge: "New",
      badgeNew: true,
    },
    {
      icon: <FileText className="h-4 w-4 text-primary" />,
      title: "Clinical Records & Reports",
      desc: "Patient history, diagnoses, prescriptions, PDF export — audit-safe",
      badge: "Live",
      badgeNew: false,
    },
  ];

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-background">

        {/* ═══════════════ LEFT PANEL ═══════════════ */}
        <div className="hidden lg:flex w-[52%] flex-shrink-0 flex-col relative overflow-hidden bg-foreground dark:bg-zinc-900">

          {/* Ambient glow blobs */}
          <div className="absolute -top-40 -left-20 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-20 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

          {/* Subtle grid texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative z-10 flex flex-col h-full px-12 py-10">

            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-auto">
              <img src="/icons/favicon.svg" alt="bookMySlot logo" className="h-8 w-8 rounded-xl object-contain" />
              <div className="flex flex-col leading-none">
                <span className="text-[15px] font-bold text-white tracking-tight" style={{ letterSpacing: "-.02em" }}>
                  book<span className="text-primary">My</span>Slot
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/40 mt-[2px]">
                  Dental
                </span>
              </div>
            </div>

            {/* Center content */}
            <div className="flex-1 flex flex-col justify-center py-8">

              {/* Live badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 w-fit mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-semibold text-primary tracking-wider uppercase">
                  Live · Trusted by dental clinics
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-[clamp(30px,3vw,46px)] font-extrabold text-white leading-[1.1] tracking-tight mb-4">
                Your clinic,<br />
                running <span className="text-primary">smoothly</span>
              </h1>

              <p className="text-sm text-white/55 leading-relaxed max-w-[380px] mb-10">
                Everything your dental practice needs — appointments, doctors, patients, and records — in one place. Welcome back.
              </p>

              {/* Stats strip */}
              <div className="flex w-fit mb-10 rounded-xl overflow-hidden border border-white/10">
                {[
                  { value: "8 sec", label: "Avg booking time" },
                  { value: "99.9%", label: "System uptime" },
                  { value: "35+", label: "Slots per clinic/week" },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-0.5 px-5 py-3.5 border-r border-white/10 last:border-r-0"
                  >
                    <span className="text-xl font-extrabold text-primary tracking-tight">{stat.value}</span>
                    <span className="text-xs text-white/35 font-medium tracking-wide uppercase">{stat.label}</span>
                  </div>
                ))}
              </div>

              {/* Feature tiles */}
              <div className="flex flex-col gap-2.5">
                {featureTiles.map((tile, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3.5 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-primary/30 hover:bg-primary/[0.06] active:bg-primary/[0.10] active:scale-[0.99] transition-all duration-200"
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                      {tile.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white/90">{tile.title}</div>
                      <div className="text-xs text-white/40 mt-0.5 leading-snug">{tile.desc}</div>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${
                        tile.badgeNew
                          ? "bg-amber-400/10 text-amber-400 border-amber-400/25"
                          : "bg-primary/15 text-primary border-primary/30"
                      }`}
                    >
                      {tile.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom strip */}
            <div className="pt-6 border-t border-white/[0.08] flex items-center justify-between">
              <span className="text-xs text-white/25">© 2026 BookMySlot · Kerala, India</span>
              <span className="text-xs text-primary/70 cursor-pointer hover:text-primary active:opacity-70 transition-colors">Privacy Policy</span>
            </div>
          </div>
        </div>

        {/* ═══════════════ RIGHT PANEL ═══════════════ */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto bg-background relative">

          {/* Back link */}
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
            className="absolute top-4 left-4 flex items-center gap-1.5 min-h-[44px] px-3 text-xs font-semibold text-muted-foreground hover:text-primary active:opacity-70 transition-colors rounded-lg"
            data-testid="button-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="w-full max-w-[380px]">

            {/* Form header */}
            <div className="text-center mb-7">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight mb-1.5">Welcome back</h2>
              <p className="text-sm text-muted-foreground">Sign in to your BookMySlot account</p>
            </div>

            {/* Role toggle */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/60 mb-6">
              <button
                onClick={() => { setActiveTab("clinic"); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-lg text-sm font-semibold transition-all active:scale-[0.98] ${
                  activeTab === "clinic"
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground active:text-foreground"
                }`}
                data-testid="tab-clinic-login"
              >
                <Building2 className="h-3.5 w-3.5" />
                Clinic Admin
              </button>
              <button
                onClick={() => { setActiveTab("doctor"); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-lg text-sm font-semibold transition-all active:scale-[0.98] ${
                  activeTab === "doctor"
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground active:text-foreground"
                }`}
                data-testid="tab-doctor-login"
              >
                <Stethoscope className="h-3.5 w-3.5" />
                Doctor
              </button>
            </div>

            {/* ── CLINIC FORM ── */}
            {activeTab === "clinic" && (
              <form onSubmit={handleClinicSubmit} className="space-y-3.5">

                {/* Username */}
                <div className="space-y-1.5">
                  <label htmlFor="clinic-username" className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Username
                  </label>
                  <div className="flex items-center rounded-xl border border-border/70 bg-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                    <div className="flex items-center justify-center min-h-[44px] w-11 shrink-0 border-r border-border/50 bg-muted/40">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <Input
                      id="clinic-username"
                      type="text"
                      value={clinicUsername}
                      onChange={(e) => setClinicUsername(e.target.value)}
                      onFocus={scrollIntoView}
                      placeholder="your_clinic_username"
                      required
                      autoComplete="username"
                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] rounded-none pl-3 text-sm"
                      data-testid="input-clinic-username"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="clinic-password" className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Password
                  </label>
                  <div className="flex items-center rounded-xl border border-border/70 bg-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                    <div className="flex items-center justify-center min-h-[44px] w-11 shrink-0 border-r border-border/50 bg-muted/40">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <Input
                      id="clinic-password"
                      type={showClinicPassword ? "text" : "password"}
                      value={clinicPassword}
                      onChange={(e) => setClinicPassword(e.target.value)}
                      onFocus={scrollIntoView}
                      placeholder="••••••••••"
                      required
                      autoComplete="current-password"
                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] rounded-none pl-3 text-sm flex-1"
                      data-testid="input-clinic-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClinicPassword(v => !v)}
                      className="min-h-[44px] w-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary active:opacity-70 transition-colors"
                      tabIndex={-1}
                      data-testid="button-toggle-clinic-password"
                    >
                      {showClinicPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => openForgot("clinic")}
                    className="text-xs font-semibold text-primary hover:opacity-75 active:opacity-50 transition-opacity min-h-[44px] px-1"
                    data-testid="link-clinic-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/8 border border-destructive/20" data-testid="text-login-error">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                    <span className="text-xs text-destructive leading-snug">{error}</span>
                  </div>
                )}

                {/* Admin notice */}
                {isAdminAuthenticated && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/8 border border-primary/20">
                    <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      As <strong className="text-foreground">Admin</strong>, enter any clinic's username — no password needed.
                    </p>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full min-h-[44px] font-bold text-sm bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25 rounded-xl border-0 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                  disabled={isClinicLoggingIn}
                  data-testid="button-clinic-login"
                >
                  {isClinicLoggingIn ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                  ) : "Sign In"}
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or try the demo</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Demo button */}
                <button
                  type="button"
                  onClick={handleDemo}
                  disabled={isDemoLoading || isClinicLoggingIn}
                  className="w-full min-h-[44px] rounded-xl border border-primary/40 bg-transparent text-primary text-sm font-semibold hover:bg-primary/6 hover:border-primary/70 active:scale-[0.98] active:bg-primary/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-try-demo"
                >
                  {isDemoLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Loading demo…</>
                  ) : (
                    <>Try Demo &nbsp;→</>
                  )}
                </button>

              </form>
            )}

            {/* ── DOCTOR FORM ── */}
            {activeTab === "doctor" && (
              <form onSubmit={handleDoctorSubmit} className="space-y-3.5">

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="doctor-email" className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Email
                  </label>
                  <div className="flex items-center rounded-xl border border-border/70 bg-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                    <div className="flex items-center justify-center min-h-[44px] w-11 shrink-0 border-r border-border/50 bg-muted/40">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <Input
                      id="doctor-email"
                      type="email"
                      value={doctorEmail}
                      onChange={(e) => setDoctorEmail(e.target.value)}
                      onFocus={scrollIntoView}
                      placeholder="doctor@clinic.com"
                      required
                      autoComplete="email"
                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] rounded-none pl-3 text-sm"
                      data-testid="input-doctor-email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="doctor-password" className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Password
                  </label>
                  <div className="flex items-center rounded-xl border border-border/70 bg-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                    <div className="flex items-center justify-center min-h-[44px] w-11 shrink-0 border-r border-border/50 bg-muted/40">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <Input
                      id="doctor-password"
                      type={showDoctorPassword ? "text" : "password"}
                      value={doctorPassword}
                      onChange={(e) => setDoctorPassword(e.target.value)}
                      onFocus={scrollIntoView}
                      placeholder="••••••••••"
                      required
                      autoComplete="current-password"
                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] rounded-none pl-3 text-sm flex-1"
                      data-testid="input-doctor-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDoctorPassword(v => !v)}
                      className="min-h-[44px] w-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary active:opacity-70 transition-colors"
                      tabIndex={-1}
                      data-testid="button-toggle-doctor-password"
                    >
                      {showDoctorPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => openForgot("doctor")}
                    className="text-xs font-semibold text-primary hover:opacity-75 active:opacity-50 transition-opacity min-h-[44px] px-1"
                    data-testid="link-doctor-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/8 border border-destructive/20" data-testid="text-login-error">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                    <span className="text-xs text-destructive leading-snug">{error}</span>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full min-h-[44px] font-bold text-sm bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25 rounded-xl border-0 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                  disabled={isDoctorLoggingIn}
                  data-testid="button-doctor-login"
                >
                  {isDoctorLoggingIn ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                  ) : "Sign In"}
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or try the demo</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Doctor demo button */}
                <button
                  type="button"
                  onClick={handleDoctorDemo}
                  disabled={isDemoLoading || isDoctorLoggingIn}
                  className="w-full min-h-[44px] rounded-xl border border-primary/40 bg-transparent text-primary text-sm font-semibold hover:bg-primary/6 hover:border-primary/70 active:scale-[0.98] active:bg-primary/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-try-doctor-demo"
                >
                  {isDemoLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Loading demo…</>
                  ) : (
                    <>Try Demo &nbsp;→</>
                  )}
                </button>

                {/* Doctor info panel */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border/70">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Don't have an account? Ask your{" "}
                    <strong className="text-foreground">clinic administrator</strong> to send you an invitation email.
                  </p>
                </div>

              </form>
            )}

            {/* Footer */}
            <p className="text-center mt-6 text-xs text-muted-foreground">
              New clinic?{" "}
              <Link href="/register-clinic" className="text-primary font-semibold hover:underline active:opacity-70">
                Register your practice →
              </Link>
            </p>

          </div>
        </div>
      </div>

      {/* ── FORGOT PASSWORD MODAL (shadcn Dialog) ── */}
      <Dialog open={!!forgotModal} onOpenChange={(open) => { if (!open) closeForgot(); }}>
        <DialogContent className="w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {forgotStatus === "sent"
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  : <KeyRound className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <DialogTitle className="text-sm font-bold leading-none mb-0.5">
                  {forgotStatus === "sent" ? "Check your inbox" : "Forgot password?"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground leading-snug">
                  {forgotModal === "clinic" ? "Clinic account recovery" : "Doctor account recovery"}
                </p>
              </div>
            </div>
          </DialogHeader>

          {forgotStatus === "sent" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                If <strong className="text-foreground">{forgotEmail}</strong> is registered, you'll receive a reset link within a few minutes. Check your spam folder if you don't see it.
              </p>
              <Button
                className="w-full min-h-[44px] font-semibold"
                onClick={closeForgot}
                data-testid="button-done-forgot"
              >
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enter your registered email address and we'll send you a link to reset your password.
              </p>

              {/* Email field */}
              <div className="flex items-center rounded-xl border border-border/70 bg-background focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                <div className="flex items-center justify-center min-h-[44px] w-11 shrink-0 border-r border-border/50 bg-muted/40">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onFocus={scrollIntoView}
                  placeholder="your@email.com"
                  required
                  autoFocus
                  className="flex-1 min-h-[44px] bg-transparent border-0 outline-none pl-3 pr-3 text-sm text-foreground"
                  data-testid="input-forgot-email"
                />
              </div>

              {/* Error */}
              {forgotError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/8 border border-destructive/20">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                  <span className="text-xs text-destructive leading-snug">{forgotError}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full min-h-[44px] font-semibold"
                disabled={forgotStatus === "sending"}
                data-testid="button-send-reset-link"
              >
                {forgotStatus === "sending"
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                  : "Send Reset Link"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
