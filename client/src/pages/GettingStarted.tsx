import { Button } from "@/components/ui/button";
import { CalendarPlus, Building2, ArrowRight, CalendarDays, Sparkles, Stethoscope, LogIn, Check, BadgeIndianRupee } from "lucide-react";
import { useLocation } from "wouter";

export default function GettingStarted() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-background">

      {/* Ambient glow blobs */}
      <div className="absolute top-0 right-0 w-[520px] h-[520px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="relative w-full max-w-5xl rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">

        {/* 3px neon top bar */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Gradient hero header */}
        <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 pt-8 pb-8 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />

          {/* Decorative large icon in corner */}
          <CalendarDays className="absolute right-6 top-1/2 -translate-y-1/2 h-36 w-36 text-white opacity-[0.06] pointer-events-none select-none" />

          <div className="relative flex flex-col items-center text-center">
            {/* Eyebrow label */}
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-white/60" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">BookMySlot</span>
            </div>

            {/* Icon avatar with glow */}
            <div className="relative mb-4">
              <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-accent/30 to-primary/20 blur-lg" />
              <div className="relative h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center ring-2 ring-white/10">
                <CalendarDays className="h-8 w-8 text-white drop-shadow" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              Welcome to BookMySlot
            </h1>
            <p className="text-sm text-white/55 max-w-lg">
              Choose your path — book a slot at a trusted clinic, bring your practice online, or sign in to your dashboard.
            </p>
          </div>

          {/* Bottom neon divider */}
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
        </div>

        {/* Cards grid — 1 col mobile, 2 col md, 3 col lg */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* ── Card 1: For Patients ── */}
          <div className="rounded-2xl border border-primary/25 bg-background shadow-md shadow-primary/8 overflow-hidden flex flex-col hover:shadow-lg hover:shadow-primary/12 hover:-translate-y-0.5 transition-all duration-300">
            {/* Gradient card header */}
            <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-5 pt-5 pb-4 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-br from-accent/40 to-primary/30 blur-md" />
                  <div className="relative h-11 w-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center ring-1 ring-white/10">
                    <CalendarPlus className="h-5 w-5 text-white drop-shadow" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-0.5">For Patients</p>
                  <h2 className="text-lg font-extrabold text-white tracking-tight">Book a Slot</h2>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
            </div>

            {/* Card body */}
            <div className="px-5 py-5 flex flex-col flex-1 gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Browse verified dental clinics near you and confirm your slot in seconds. No account needed.
              </p>
              {/* Trust signals */}
              <ul className="flex flex-col gap-1.5">
                {["50+ verified clinics", "No sign-up required", "Instant confirmation"].map((point) => (
                  <li key={point} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Button
                  className="w-full gap-2 group h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                  onClick={() => setLocation("/book")}
                  data-testid="button-get-started-book"
                >
                  Find Clinics
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── Card 2: For Clinics ── */}
          <div className="rounded-2xl border border-primary/25 bg-background shadow-md shadow-primary/8 overflow-hidden flex flex-col hover:shadow-lg hover:shadow-primary/12 hover:-translate-y-0.5 transition-all duration-300">
            <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-5 pt-5 pb-4 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.06)_0%,transparent_65%)] pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-br from-accent/30 to-primary/20 blur-md" />
                  <div className="relative h-11 w-11 rounded-xl bg-white/12 border border-white/20 flex items-center justify-center ring-1 ring-white/8">
                    <Building2 className="h-5 w-5 text-white drop-shadow" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-0.5">For Clinics</p>
                  <h2 className="text-lg font-extrabold text-white tracking-tight">Register Clinic</h2>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/20 via-primary/40 to-accent/20" />
            </div>

            {/* Card body */}
            <div className="px-5 py-5 flex flex-col flex-1 gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Manage bookings, clinical records, doctor schedules, and more — all from one powerful dashboard.
              </p>
              {/* Trust signals */}
              <ul className="flex flex-col gap-1.5">
                {["Free to get started", "5-minute setup", "Full dashboard included"].map((point) => (
                  <li key={point} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-2">
                <Button
                  className="w-full gap-2 group h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                  onClick={() => setLocation("/register-clinic")}
                  data-testid="button-get-started-register"
                >
                  Start Registration
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 group h-9 text-sm font-semibold border-primary/25 text-primary hover:bg-primary/5 hover:border-primary/40 rounded-xl"
                  onClick={() => setLocation("/pricing")}
                  data-testid="button-view-pricing"
                >
                  <BadgeIndianRupee className="h-3.5 w-3.5" />
                  View Pricing Plans
                </Button>
              </div>
            </div>
          </div>

          {/* ── Card 3: Existing Users (lighter visual weight) ── */}
          <div className="rounded-2xl border border-border/70 bg-background shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 md:col-span-2 lg:col-span-1">
            {/* Softer header using secondary palette */}
            <div className="relative bg-secondary/60 dark:bg-secondary/30 border-b border-border/60 px-5 pt-5 pb-4 overflow-hidden">
              <div className="relative flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <LogIn className="h-5 w-5 text-primary drop-shadow-sm" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-0.5">Already on BookMySlot?</p>
                  <h2 className="text-lg font-extrabold text-foreground tracking-tight">Sign In</h2>
                </div>
              </div>
            </div>

            {/* Card body */}
            <div className="px-5 py-5 flex flex-col flex-1 gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Access your existing account — manage your clinic, schedule, and patients right where you left off.
              </p>
              <div className="mt-auto flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="w-full gap-2 group h-11 font-semibold border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 rounded-xl"
                  onClick={() => setLocation("/clinic-login")}
                  data-testid="button-clinic-admin-login"
                >
                  <Building2 className="h-4 w-4" />
                  Clinic Admin Login
                  <ArrowRight className="h-4 w-4 ml-auto group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 group h-11 font-semibold border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 rounded-xl"
                  onClick={() => setLocation("/clinic-login")}
                  data-testid="button-doctor-login"
                >
                  <Stethoscope className="h-4 w-4" />
                  Doctor Login
                  <ArrowRight className="h-4 w-4 ml-auto group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
