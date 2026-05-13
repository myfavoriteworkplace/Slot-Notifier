import { Button } from "@/components/ui/button";
import { CalendarPlus, Building2, ArrowRight, CalendarDays, Sparkles, Check } from "lucide-react";
import { useLocation } from "wouter";

export default function GettingStarted() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-background">

      {/* Ambient glow blobs */}
      <div className="absolute top-0 right-0 w-[520px] h-[520px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="relative w-full max-w-4xl rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">

        {/* 3px neon top bar */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Gradient hero header */}
        <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 pt-8 pb-8 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
          <CalendarDays className="absolute right-6 top-1/2 -translate-y-1/2 h-36 w-36 text-white opacity-[0.06] pointer-events-none select-none" />

          <div className="relative flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-white/60" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Smart Practice Management for Dental Care</span>
            </div>

            <div className="relative mb-4">
              <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-accent/30 to-primary/20 blur-lg" />
              <div className="relative h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center ring-2 ring-white/10">
                <CalendarDays className="h-8 w-8 text-white drop-shadow" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              Welcome to BookMySlot
            </h1>
            <p className="text-sm text-white/55 max-w-md">
              Choose how you'd like to get started — book an appointment in seconds, or manage your entire clinic from slots to billing.
            </p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
        </div>

        {/* "I am a…" role framing */}
        <div className="pt-7 pb-1 px-6 sm:px-8 flex flex-col items-center gap-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">I am a…</p>
          <div className="flex items-center gap-3 mt-0.5">
            <div className="h-px w-16 bg-border/60" />
            <span className="text-xs text-muted-foreground/40">choose your path</span>
            <div className="h-px w-16 bg-border/60" />
          </div>
        </div>

        {/* Cards grid */}
        <div className="p-6 sm:p-8 pt-4 grid md:grid-cols-2 gap-5">

          {/* ── PATIENT CARD — light, warm, consumer ── */}
          <div className="rounded-2xl border border-primary/25 bg-background shadow-md shadow-primary/8 overflow-hidden flex flex-col hover:shadow-xl hover:shadow-primary/15 hover:-translate-y-1 transition-all duration-300">
            <div className="relative bg-gradient-to-br from-primary via-primary to-accent px-5 pt-5 pb-5 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.12)_0%,transparent_60%)] pointer-events-none" />
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative flex items-start gap-3">
                <div className="relative shrink-0 mt-0.5">
                  <div className="absolute -inset-1.5 rounded-xl bg-white/20 blur-md" />
                  <div className="relative h-11 w-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                    <CalendarPlus className="h-5 w-5 text-white drop-shadow" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 mb-0.5">Patient</p>
                  <h2 className="text-xl font-extrabold text-white tracking-tight leading-none">Book a Slot</h2>
                  <p className="text-[11px] text-white/55 mt-1">No account needed</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 flex flex-col flex-1 gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Find a dental clinic near you and secure your appointment in minutes. No registration, no hassle — just pick a time and you're set.
              </p>
              <ul className="space-y-2">
                {[
                  "Browse verified dental clinics",
                  "See real-time slot availability",
                  "Book instantly — no account needed",
                  "Email confirmation sent automatically",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                <Button
                  className="w-full gap-2 group h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/25 rounded-xl text-white"
                  onClick={() => setLocation("/book")}
                  data-testid="button-get-started-book"
                >
                  Find Clinics
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── CLINIC CARD — dark, professional, business ── */}
          <div className="rounded-2xl border border-white/10 bg-[#0A1A12] shadow-lg overflow-hidden flex flex-col hover:shadow-xl hover:shadow-black/30 hover:-translate-y-1 transition-all duration-300">
            <div className="relative bg-[#0D2218] px-5 pt-5 pb-5 overflow-hidden border-b border-white/8">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(15,155,110,0.15)_0%,transparent_65%)] pointer-events-none" />
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-primary/5 pointer-events-none" />
              <div className="relative flex items-start gap-3">
                <div className="relative shrink-0 mt-0.5">
                  <div className="absolute -inset-1.5 rounded-xl bg-primary/20 blur-md" />
                  <div className="relative h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary drop-shadow" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 mb-0.5">Clinic Owner</p>
                  <h2 className="text-xl font-extrabold text-white tracking-tight leading-none">Register Clinic</h2>
                  <p className="text-[11px] text-white/40 mt-1">Full practice management</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 flex flex-col flex-1 gap-4">
              <p className="text-sm text-white/55 leading-relaxed">
                Everything your dental practice needs — scheduling, billing, staff, inventory, and patient records — all in one platform.
              </p>
              <ul className="space-y-2">
                {[
                  "Slot scheduling & capacity control",
                  "Doctor invitations & assignments",
                  "PDF billing & clinical records",
                  "Inventory tracking & data exports",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-white/55">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2 space-y-2.5">
                <Button
                  className="w-full gap-2 group h-11 font-bold bg-primary hover:bg-primary/90 border-0 shadow-md shadow-primary/30 rounded-xl text-white"
                  onClick={() => setLocation("/register-clinic")}
                  data-testid="button-get-started-register"
                >
                  Start Registration
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <p className="text-center text-[11px] text-white/30">
                  Reviewed & approved by our team — usually within 24 hours
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer sign-in */}
        <div className="px-6 sm:px-8 pb-7 text-center">
          <p className="text-xs text-muted-foreground">
            Already have a clinic account?{" "}
            <button
              className="text-primary font-semibold hover:underline underline-offset-4 transition-colors"
              onClick={() => setLocation("/clinic-login")}
              data-testid="link-clinic-signin"
            >
              Sign in here
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
