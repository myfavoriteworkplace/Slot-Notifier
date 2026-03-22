import { useState, useEffect } from "react";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Building2, ArrowLeft, Info, Stethoscope, Lock, Mail, Eye, EyeOff, CalendarCheck } from "lucide-react";
import { Link } from "wouter";

export default function ClinicLogin() {
  const [clinicUsername, setClinicUsername] = useState("");
  const [clinicPassword, setClinicPassword] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorPassword, setDoctorPassword] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"clinic" | "doctor">("clinic");
  const [showClinicPassword, setShowClinicPassword] = useState(false);
  const [showDoctorPassword, setShowDoctorPassword] = useState(false);

  const { login: clinicLogin, isLoggingIn: isClinicLoggingIn, isAuthenticated: isClinicAuthenticated } = useClinicAuth();
  const { login: doctorLogin, isLoggingIn: isDoctorLoggingIn, isAuthenticated: isDoctorAuthenticated } = useDoctorAuth();
  const { isAuthenticated: isAdminAuthenticated } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (isClinicAuthenticated) setLocation("/clinic-dashboard");
  }, [isClinicAuthenticated, setLocation]);

  useEffect(() => {
    if (isDoctorAuthenticated) setLocation("/doctor-dashboard");
  }, [isDoctorAuthenticated, setLocation]);

  const handleClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await clinicLogin({ username: clinicUsername, password: clinicPassword });
      setLocation("/clinic-dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await doctorLogin({ email: doctorEmail, password: doctorPassword });
      setLocation("/doctor-dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const fillDemo = () => {
    setClinicUsername("demo_clinic");
    setClinicPassword("demo_password123");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-background">

      {/* Background glow blobs */}
      <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-violet-500/8 rounded-full blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[360px] h-[360px] bg-cyan-500/6 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[300px] bg-primary/4 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-2xl shadow-violet-500/10 overflow-hidden">

        {/* 3px neon accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500" />

        {/* Gradient hero header */}
        <div className="relative bg-gradient-to-r from-violet-700 via-violet-600 to-primary px-6 pt-5 pb-5 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />

          {/* Back link */}
          <Link href="/">
            <button className="absolute top-4 left-4 flex items-center gap-1 text-white/60 hover:text-white text-[11px] font-medium transition-colors" data-testid="link-back-home">
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
          </Link>

          <div className="relative flex flex-col items-center text-center pt-4">
            {/* Brand mark */}
            <div className="flex items-center gap-2 mb-4">
              <CalendarCheck className="h-4 w-4 text-white/70" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">BookMySlot</span>
            </div>

            {/* Icon avatar with glow */}
            <div className="relative mb-3">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-cyan-400/35 to-fuchsia-500/25 blur-md" />
              <div className="relative h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center ring-2 ring-white/10">
                {activeTab === "clinic"
                  ? <Building2 className="h-8 w-8 text-white drop-shadow" />
                  : <Stethoscope className="h-8 w-8 text-white drop-shadow" />
                }
              </div>
            </div>

            <h1 className="text-xl font-extrabold text-white tracking-tight">
              {activeTab === "clinic" ? "Clinic Portal" : "Doctor Portal"}
            </h1>
            <p className="text-[12px] text-white/55 mt-1">
              {activeTab === "clinic"
                ? "Sign in to manage appointments & bookings"
                : "Sign in to access your patient dashboard"}
            </p>
          </div>

          {/* Bottom neon line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-cyan-400/40 via-violet-400/60 to-fuchsia-400/40" />
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-6 space-y-5">

          {/* Custom tab switcher */}
          <div className="flex gap-2 p-1 rounded-xl bg-muted/50 border border-border/50">
            <button
              onClick={() => { setActiveTab("clinic"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "clinic"
                  ? "bg-gradient-to-r from-violet-600 to-primary text-white shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-clinic-login"
            >
              <Building2 className="h-3.5 w-3.5" />
              Clinic
            </button>
            <button
              onClick={() => { setActiveTab("doctor"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "doctor"
                  ? "bg-gradient-to-r from-violet-600 to-primary text-white shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-doctor-login"
            >
              <Stethoscope className="h-3.5 w-3.5" />
              Doctor
            </button>
          </div>

          {/* ── CLINIC FORM ── */}
          {activeTab === "clinic" && (
            <form onSubmit={handleClinicSubmit} className="space-y-3">

              {/* Username field */}
              <div className="space-y-1.5">
                <label htmlFor="clinic-username" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
                <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                  <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Input
                    id="clinic-username"
                    type="text"
                    value={clinicUsername}
                    onChange={(e) => setClinicUsername(e.target.value)}
                    placeholder="your_clinic_username"
                    required
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                    data-testid="input-clinic-username"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="clinic-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                  <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Input
                    id="clinic-password"
                    type={showClinicPassword ? "text" : "password"}
                    value={clinicPassword}
                    onChange={(e) => setClinicPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm flex-1"
                    data-testid="input-clinic-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClinicPassword(v => !v)}
                    className="h-10 w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showClinicPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/8 rounded-xl border border-destructive/20" data-testid="text-login-error">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  {error}
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
                className="w-full h-11 font-bold text-sm bg-gradient-to-r from-violet-600 to-primary hover:from-violet-500 hover:to-primary/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                disabled={isClinicLoggingIn}
                data-testid="button-clinic-login"
              >
                {isClinicLoggingIn ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
                ) : "Sign In"}
              </Button>

              {/* Demo quick-fill */}
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Demo Account</p>
                  <p className="text-[11px] font-mono text-foreground/70">demo_clinic · demo_password123</p>
                </div>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="shrink-0 text-[11px] font-bold text-primary border border-primary/30 bg-primary/8 hover:bg-primary/15 px-3 py-1.5 rounded-lg transition-colors"
                  data-testid="button-use-demo"
                >
                  Use Demo
                </button>
              </div>
            </form>
          )}

          {/* ── DOCTOR FORM ── */}
          {activeTab === "doctor" && (
            <form onSubmit={handleDoctorSubmit} className="space-y-3">

              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="doctor-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
                <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                  <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Input
                    id="doctor-email"
                    type="email"
                    value={doctorEmail}
                    onChange={(e) => setDoctorEmail(e.target.value)}
                    placeholder="doctor@clinic.com"
                    required
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                    data-testid="input-doctor-email"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="doctor-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                  <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Input
                    id="doctor-password"
                    type={showDoctorPassword ? "text" : "password"}
                    value={doctorPassword}
                    onChange={(e) => setDoctorPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm flex-1"
                    data-testid="input-doctor-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDoctorPassword(v => !v)}
                    className="h-10 w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showDoctorPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/8 rounded-xl border border-destructive/20" data-testid="text-login-error">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 font-bold text-sm bg-gradient-to-r from-violet-600 to-primary hover:from-violet-500 hover:to-primary/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                disabled={isDoctorLoggingIn}
                data-testid="button-doctor-login"
              >
                {isDoctorLoggingIn ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
                ) : "Sign In"}
              </Button>

              {/* Info panel */}
              <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-violet-500" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Don't have an account? Ask your <strong className="text-foreground">clinic administrator</strong> to send you an invitation email.
                  </p>
                </div>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
