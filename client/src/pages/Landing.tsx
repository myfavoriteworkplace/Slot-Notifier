import { useAuth } from "@/hooks/use-auth";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { ArrowRight, Clock, Shield, Users, Star, Download, UserCheck, Check, ChevronDown, FileText, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

const BRAND   = "#0F9B6E";
const BRAND_D = "#0A7A56";
const BRAND_M = "#1DB887";

const LIGHT = {
  bg:   "#FFFFFF",
  card: "#FFFFFF",
  txt:  "#0A1F16",
  txt2: "#3D6B55",
  muted:"#7A9E8E",
  bdr:  "rgba(15,155,110,.12)",
  bdr2: "rgba(15,155,110,.22)",
  tL:   "#E8F5F0",
  T:    BRAND,
  T_D:  BRAND_D,
};

const DARK = {
  bg:   "#0B1810",
  card: "#0F1E14",
  txt:  "#E8F5F0",
  txt2: "#9DBFB0",
  muted:"#7A9E8E",
  bdr:  "rgba(15,155,110,.18)",
  bdr2: "rgba(15,155,110,.30)",
  tL:   "rgba(15,155,110,.10)",
  T:    BRAND_M,
  T_D:  BRAND,
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay },
});

const clinicFeatures = [
  { icon: Users,    title: "Role-based Access",  desc: "Separate dashboards for clinic admins, doctors, and patients — everyone sees exactly what they need." },
  { icon: FileText, title: "Clinical Records",    desc: "Prescriptions, diagnoses, and patient history recorded against every booking, all in one place." },
  { icon: UserCheck,title: "Doctor Profiles",    desc: "Certifications, case studies, and verified credentials — build patient trust before they walk in." },
  { icon: Download, title: "Data & Exports",      desc: "Export patient lists and booking history in Excel, CSV, or PDF. Monthly backup reminders included." },
];

const patientFeatures = [
  { icon: Clock,  title: "Real-time Availability", desc: "See open slots live. Updates happen instantly so double-bookings are impossible." },
  { icon: Star,   title: "Smile Deals",            desc: "Exclusive dental packages from partner clinics — patients save, you fill seats faster." },
  { icon: Shield, title: "Secure & Private",        desc: "Patient data is encrypted and protected. Privacy-first design, end to end." },
];

const CLINIC_SCREENS = 4;
const PATIENT_SCREENS = 4;

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const { isAuthenticated: isClinicAuthenticated } = useClinicAuth();
  const [_, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "dark" ? DARK : LIGHT;

  const [toastVisible, setToastVisible] = useState(false);
  const [clinicStep, setClinicStep] = useState(0);
  const [patientStep, setPatientStep] = useState(0);
  const clinicStepRef = useRef(0);
  const patientStepRef = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      clinicStepRef.current = (clinicStepRef.current + 1) % CLINIC_SCREENS;
      setClinicStep(clinicStepRef.current);
    }, 2600);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        patientStepRef.current = (patientStepRef.current + 1) % PATIENT_SCREENS;
        setPatientStep(patientStepRef.current);
      }, 2600);
      return () => clearInterval(iv);
    }, 1300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isClinicAuthenticated) setLocation("/clinic-dashboard");
    else if (isAuthenticated) {
      if (user?.role === "superuser") setLocation("/admin");
      else setLocation("/book");
    }
  }, [isAuthenticated, isClinicAuthenticated, user, setLocation]);

  useEffect(() => {
    const show = () => {
      setToastVisible(true);
      const t = setTimeout(() => setToastVisible(false), 3200);
      return t;
    };
    const init = setTimeout(() => {
      show();
      const iv = setInterval(show, 5500);
      return () => clearInterval(iv);
    }, 1800);
    return () => clearTimeout(init);
  }, []);

  if (isAuthenticated || isClinicAuthenticated) return null;

  return (
    <div style={{ background: c.bg, color: c.txt, fontFamily: "'Sora', sans-serif", overflowX: "hidden", transition: "background .3s, color .3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        @keyframes lndDrift  { from{transform:translate(0,0) scale(1)} to{transform:translate(30px,40px) scale(1.08)} }
        @keyframes lndPulse  { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:.5} }
        @keyframes lndFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes lndFloat2 { 0%,100%{transform:translateY(0) rotate(1.5deg)} 50%{transform:translateY(-7px) rotate(1.5deg)} }
        @keyframes lndFloat3 { 0%,100%{transform:translateY(0) rotate(-1.5deg)} 50%{transform:translateY(-6px) rotate(-1.5deg)} }
        @keyframes lndBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(4px)} }
        .lnd-scroll-arrow { animation: lndBounce 1.8s ease-in-out infinite; }

        @keyframes wfPulse { 0%,100%{box-shadow:0 0 0 0 rgba(15,155,110,.5)} 60%{box-shadow:0 0 0 8px rgba(15,155,110,0)} }
        @keyframes wfLineGrow { from{width:0} to{width:100%} }
        @keyframes screenIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        @media (max-width: 900px) {
          .lnd-hero          { grid-template-columns: 1fr !important; min-height: auto !important; padding: 40px 24px 60px !important; }
          .lnd-float-badge-1 { right: -8px  !important; top: 12px    !important; }
          .lnd-float-badge-2 { left:  -8px  !important; bottom: 40px !important; }
          .lnd-feat-4        { grid-template-columns: 1fr 1fr !important; }
          .lnd-feat-3        { grid-template-columns: 1fr 1fr !important; }
          .lnd-steps         { grid-template-columns: 1fr !important; gap: 28px !important; }
          .lnd-steps::before { display: none !important; }
          .lnd-how-inner     { padding: 40px 24px !important; }
          .lnd-cta-inner     { padding: 40px 24px !important; }
          .lnd-section       { padding-left: 24px !important; padding-right: 24px !important; }
          .lnd-footer        { padding: 18px 24px !important; }
          .lnd-deals-inner   { grid-template-columns: 1fr !important; }
          .lnd-wf-steps      { flex-wrap: wrap !important; }
          .lnd-wf-connector  { display: none !important; }
        }
        @media (max-width: 540px) {
          .lnd-hero          { padding: 24px 18px 48px !important; }
          .lnd-hero-actions  { flex-direction: column !important; align-items: stretch !important; }
          .lnd-hero-actions > * { width: 100% !important; justify-content: center !important; }
          .lnd-float-badge   { display: none !important; }
          .lnd-feat-4        { grid-template-columns: 1fr !important; }
          .lnd-feat-3        { grid-template-columns: 1fr !important; }
          .lnd-how-inner     { border-radius: 16px !important; padding: 32px 18px !important; }
          .lnd-cta-inner     { border-radius: 16px !important; padding: 32px 18px !important; }
          .lnd-cta-btns      { flex-direction: column !important; align-items: stretch !important; }
          .lnd-cta-btns > *  { width: 100% !important; justify-content: center !important; }
          .lnd-footer        { flex-direction: column !important; text-align: center !important; gap: 6px !important; padding: 18px !important; }
          .lnd-trust-divider { display: none !important; }
          .lnd-deals-inner   { grid-template-columns: 1fr !important; }
          .lnd-wf-steps      { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .lnd-wf-step       { flex-direction: row !important; text-align: left !important; gap: 12px !important; width: 100% !important; }
        }
      `}</style>

      {/* Ambient blobs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -120, right: -100, width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(15,155,110,.09) 0%,transparent 65%)", filter: "blur(80px)", animation: "lndDrift 14s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(15,155,110,.06) 0%,transparent 65%)", filter: "blur(80px)", animation: "lndDrift 18s ease-in-out infinite alternate-reverse" }} />
      </div>

      <div style={{ position: "relative", zIndex: 2 }}>

        {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
        <section className="lnd-hero" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", minHeight: "100vh", padding: "60px max(48px,4vw) 60px", gap: 48 }}>

          {/* Left copy */}
          <div>
            <motion.div {...fadeUp(0)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 100, background: c.tL, border: `1px solid ${c.bdr2}`, fontSize: 12, fontWeight: 600, color: c.T, letterSpacing: ".04em", marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.T, flexShrink: 0, animation: "lndPulse 1.4s ease-in-out infinite", display: "inline-block" }} />
              Live — 50+ dental clinics trust us
            </motion.div>

            <motion.h1 {...fadeUp(0.08)} style={{ fontSize: "clamp(34px,4.5vw,60px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.03em", color: c.txt, marginBottom: 22 }}>
              Run your dental{" "}
              <span style={{ color: c.T, position: "relative", display: "inline-block" }}>
                practice.
                <span style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${c.T},transparent)`, borderRadius: 2 }} />
              </span>
              {" "}Let patients book themselves.
            </motion.h1>

            <motion.div {...fadeUp(0.16)} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420, marginBottom: 36 }}>
              {[
                "Book appointments at verified dental clinics",
                "Register and manage your practice online",
                "Access your clinic or doctor dashboard",
              ].map((line) => (
                <div key={line} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: c.muted, lineHeight: 1.5 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: c.tL, border: `1.5px solid ${c.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check style={{ width: 10, height: 10, color: c.T, strokeWidth: 3 }} />
                  </span>
                  {line}
                </div>
              ))}
            </motion.div>

            <motion.div {...fadeUp(0.22)} className="lnd-hero-actions" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 36 }}>
              <Link href="/getting-started">
                <button
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 100, background: c.T, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", border: "none", cursor: "pointer", boxShadow: `0 4px 20px rgba(15,155,110,.3)`, transition: "all .25s", letterSpacing: ".01em" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = c.T_D; el.style.transform = "translateY(-2px)"; el.style.boxShadow = `0 8px 28px rgba(15,155,110,.4)`; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = c.T; el.style.transform = "translateY(0)"; el.style.boxShadow = `0 4px 20px rgba(15,155,110,.3)`; }}
                  data-testid="button-get-started"
                >
                  Get Started Free <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
              </Link>
              <a href="#how-it-works"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 100, background: "transparent", color: c.txt2, fontSize: 14, fontWeight: 600, fontFamily: "'Sora',sans-serif", border: `1.5px solid ${c.bdr2}`, cursor: "pointer", textDecoration: "none", transition: "all .25s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = c.tL; el.style.color = c.T; el.style.borderColor = c.T; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = c.txt2; el.style.borderColor = c.bdr2; }}
                data-testid="link-see-how-it-works"
              >
                See how it works
              </a>
            </motion.div>

            <motion.div {...fadeUp(0.3)} style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {["Free to get started", "No setup fees", "Works on any device"].map((item, i) => (
                <span key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.muted }}>
                  {i > 0 && <span className="lnd-trust-divider" style={{ width: 1, height: 14, background: c.bdr2, marginRight: 14, display: "inline-block" }} />}
                  <Check style={{ width: 13, height: 13, color: c.T, flexShrink: 0 }} />
                  {item}
                </span>
              ))}
            </motion.div>

            <motion.div {...fadeUp(0.38)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 32, fontSize: 11, color: c.muted, cursor: "pointer" }}
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              <ChevronDown className="lnd-scroll-arrow" style={{ width: 16, height: 16 }} />
              Scroll to explore
            </motion.div>
          </div>

          {/* Right — product visual */}
          <motion.div {...fadeUp(0.18)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 460 }}>

              {/* Floating stat badge — top right */}
              <div className="lnd-float-badge lnd-float-badge-1" style={{ position: "absolute", right: -20, top: 48, background: c.card, border: `1px solid ${c.bdr2}`, borderRadius: 14, padding: "10px 16px", boxShadow: `0 8px 24px rgba(10,31,22,.15)`, animation: "lndFloat2 5s ease-in-out infinite", minWidth: 140, zIndex: 10 }}>
                <div style={{ fontSize: 10, color: c.muted, marginBottom: 2 }}>This month</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.T, letterSpacing: "-.02em" }}>850+</div>
                <div style={{ fontSize: 10, color: c.muted }}>slots booked</div>
              </div>

              {/* Floating stat badge — bottom left */}
              <div className="lnd-float-badge lnd-float-badge-2" style={{ position: "absolute", left: -20, bottom: 120, background: c.card, border: `1px solid ${c.bdr2}`, borderRadius: 14, padding: "10px 16px", boxShadow: `0 8px 24px rgba(10,31,22,.15)`, animation: "lndFloat3 6s ease-in-out 1s infinite", minWidth: 130, zIndex: 10 }}>
                <div style={{ fontSize: 10, color: c.muted, marginBottom: 2 }}>Avg booking time</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.T, letterSpacing: "-.02em" }}>12 sec</div>
                <div style={{ fontSize: 10, color: c.muted }}>to confirm a slot</div>
              </div>

              {/* Doctor Portal card */}
              <div style={{ background: c.card, borderRadius: 24, border: `1px solid ${c.bdr2}`, boxShadow: `0 24px 80px rgba(10,31,22,.12),0 2px 8px rgba(15,155,110,.08)`, overflow: "hidden" }}>
                <div style={{ background: c.T, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 5 }}>{[0,1,2].map(i=><div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,.3)" }}/>)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.9)" }}>Doctor Portal</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>2:00 PM</div>
                </div>

                <div style={{ background: `linear-gradient(135deg,${BRAND_D},${c.T})`, padding: "18px 20px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "rgba(255,255,255,.55)", textTransform: "uppercase", marginBottom: 4 }}>Your Schedule</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Good afternoon, Dr. Priya</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{n:"3",l:"Total"},{n:"1",l:"Today",hi:true},{n:"2",l:"Upcoming"}].map(s=>(
                      <div key={s.l} style={{ flex: 1, background: s.hi ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.14)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(255,255,255,.18)", backdropFilter: "blur(8px)" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{s.n}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 1 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: c.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>Upcoming appointment</div>

                  <div style={{ border: `1px solid ${c.bdr2}`, borderRadius: 12, overflow: "hidden", animation: "lndFloat 4s ease-in-out infinite" }}>
                    <div style={{ background: c.T, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,.25)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>A</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Anand K.</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>#REF-0041</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,.2)", padding: "2px 8px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                        <Check style={{ width: 9, height: 9 }}/> Confirmed
                      </div>
                    </div>
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5, background: c.card }}>
                      {[{icon:"📅",text:"Today · 2:00 – 4:00 PM"},{icon:"🏥",text:"Sunrise Dental Clinic"},{icon:"📋",text:"Routine Checkup"}].map(r=>(
                        <div key={r.text} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: c.muted }}>
                          <span style={{ fontSize: 10 }}>{r.icon}</span> {r.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 10, background: c.tL, border: `1px solid ${c.bdr2}`, opacity: toastVisible ? 1 : 0, transform: toastVisible ? "translateX(0)" : "translateX(16px)", transition: "opacity .4s ease,transform .4s ease" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: c.T, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 12 }}>🔔</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.T }}>New slot booked</div>
                      <div style={{ fontSize: 10, color: c.muted }}>Meera R. · Tomorrow · 10:00 AM</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Practice Overview panel */}
              <div style={{ marginTop: 14, background: c.card, borderRadius: 18, border: `1px solid ${c.bdr}`, padding: "14px 16px", display: "flex", gap: 16, alignItems: "center", boxShadow: `0 8px 28px rgba(10,31,22,.08)` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.muted, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Practice overview</div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                    {[{label:"Patients",n:"128"},{label:"This week",n:"24"},{label:"Revenue",n:"₹38k"}].map(s=>(
                      <div key={s.label}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: c.txt, letterSpacing: "-.02em" }}>{s.n}</div>
                        <div style={{ fontSize: 9, color: c.muted }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 26 }}>
                    {[40,65,45,80,55,90,70].map((h,i)=>(
                      <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 3, background: i===5 ? c.T : `${c.T}40` }}/>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: c.muted, marginTop: 4 }}>Bookings · Mon – Sun</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
                  {[{label:"Clinical records",color:c.T},{label:"Inventory tracked",color:BRAND_M},{label:"Data exports",color:c.muted}].map(item=>(
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }}/>
                      <span style={{ fontSize: 10, color: c.muted }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        </section>

        {/* ══ FEATURES ═════════════════════════════════════════════════════════ */}
        <section id="features" className="lnd-section" style={{ padding: "80px 64px 60px" }}>
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: c.T, marginBottom: 14 }}>
              <span style={{ width: 18, height: 1, background: c.T, display: "inline-block" }} />
              Everything you need
              <span style={{ width: 18, height: 1, background: c.T, display: "inline-block" }} />
            </div>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,40px)", fontWeight: 800, color: c.txt, letterSpacing: "-.03em", lineHeight: 1.15, marginBottom: 14 }}>
              Built for clinics,<br />loved by <span style={{ color: c.T }}>doctors & patients</span>
            </h2>
            <p style={{ fontSize: 15, color: c.muted, maxWidth: 460, margin: "0 auto", lineHeight: 1.65 }}>
              Every feature is designed around how a real dental clinic actually works — not how a generic SaaS thinks it should.
            </p>
          </motion.div>

          {/* For your clinic */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ height: 1, flex: 1, background: c.bdr }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: c.T, padding: "4px 16px", borderRadius: 100, background: c.tL, border: `1px solid ${c.bdr2}`, flexShrink: 0 }}>
                For your clinic
              </span>
              <div style={{ height: 1, flex: 1, background: c.bdr }} />
            </div>
            <div className="lnd-feat-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
              {clinicFeatures.map((f, i) => (
                <motion.div key={f.title} {...fadeUp(i * 0.07)}
                  style={{ background: c.card, border: `1px solid ${c.bdr}`, borderRadius: 20, padding: "24px 22px 26px", transition: "all .3s cubic-bezier(.16,1,.3,1)", cursor: "default" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = c.bdr2; el.style.transform = "translateY(-5px)"; el.style.boxShadow = "0 20px 50px rgba(15,155,110,.1)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = c.bdr; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: c.tL, border: `1px solid ${c.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <f.icon style={{ width: 20, height: 20, color: c.T }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.txt, marginBottom: 7, letterSpacing: "-.01em" }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.65 }}>{f.desc}</div>
                </motion.div>
              ))}
            </div>

            {/* Clinic Dashboard Mockup */}
            <motion.div {...fadeUp(0.1)} style={{ background: "linear-gradient(135deg,#071510,#0D1F16)", borderRadius: 20, border: "1px solid rgba(15,155,110,.2)", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(15,155,110,.1),transparent 70%)", pointerEvents: "none" }} />
              {/* App chrome */}
              <div style={{ background: "rgba(15,155,110,.18)", borderBottom: "1px solid rgba(15,155,110,.15)", padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", gap: 5 }}>{[0,1,2].map(i=><div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i===0?"#ff5f5780":i===1?"#ffbd2e80":"rgba(255,255,255,.18)" }}/>)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.8)", letterSpacing: ".01em" }}>Clinic Dashboard</div>
                <div style={{ fontSize: 10, color: "#1DB887", fontWeight: 700 }}>● Live</div>
              </div>

              {/* Screen content */}
              <div style={{ padding: "18px 20px 10px", minHeight: 188, position: "relative", zIndex: 1 }}>

                {clinicStep === 0 && (
                  <div key="cl-0" style={{ animation: "screenIn .35s ease forwards" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(93,202,165,.65)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>Today's Bookings · 3</div>
                    {[
                      { name: "Anand K.",  time: "2:00 PM", doc: "Dr. Priya",   status: "Confirmed", c: "#0F9B6E" },
                      { name: "Meera R.",  time: "3:30 PM", doc: "Unassigned",  status: "Pending",   c: "#F0A050" },
                      { name: "Ravi S.",   time: "4:00 PM", doc: "Dr. Priya",   status: "Confirmed", c: "#0F9B6E" },
                    ].map(b => (
                      <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", marginBottom: 7 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${b.c}28`, color: b.c, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{b.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(232,245,240,.9)" }}>{b.name}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,.32)" }}>{b.time} · {b.doc}</div>
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: b.c, background: `${b.c}18`, border: `1px solid ${b.c}40`, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{b.status}</div>
                      </div>
                    ))}
                  </div>
                )}

                {clinicStep === 1 && (
                  <div key="cl-1" style={{ animation: "screenIn .35s ease forwards" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(93,202,165,.65)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>Assign Doctor · #REF-0041</div>
                    <div style={{ background: "rgba(15,155,110,.08)", border: "1px solid rgba(15,155,110,.18)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(15,155,110,.22)", color: "#1DB887", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>A</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(232,245,240,.9)" }}>Anand K.</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,.38)" }}>Today · 2:00 PM · Routine Checkup</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.38)", marginBottom: 6 }}>Assigned to</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(15,155,110,.16)", border: "1px solid rgba(15,155,110,.38)", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: BRAND, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>P</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1DB887" }}>Dr. Priya Menon</div>
                          <div style={{ fontSize: 10, color: "rgba(93,202,165,.55)" }}>General Dentistry</div>
                        </div>
                        <Check style={{ width: 14, height: 14, color: "#1DB887" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: BRAND, color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center" }}>Save Assignment</div>
                      <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.35)", fontSize: 11, textAlign: "center" }}>Cancel</div>
                    </div>
                  </div>
                )}

                {clinicStep === 2 && (
                  <div key="cl-2" style={{ animation: "screenIn .35s ease forwards" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(93,202,165,.65)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>Configure Slots · Tuesday</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
                      {[
                        { t: "9:00 AM",  s: "booked" }, { t: "10:00 AM", s: "open" }, { t: "11:00 AM", s: "open" },
                        { t: "12:00 PM", s: "leave"  }, { t: "2:00 PM",  s: "booked" }, { t: "3:00 PM", s: "open" },
                        { t: "4:00 PM",  s: "booked" }, { t: "5:00 PM",  s: "open"  }, { t: "6:00 PM",  s: "open" },
                      ].map(sl => {
                        const bg = sl.s==="booked" ? "rgba(15,155,110,.22)" : sl.s==="leave" ? "rgba(255,80,80,.08)" : "rgba(255,255,255,.05)";
                        const bd = sl.s==="booked" ? "1px solid rgba(15,155,110,.4)" : sl.s==="leave" ? "1px solid rgba(255,80,80,.15)" : "1px solid rgba(255,255,255,.09)";
                        const cl = sl.s==="booked" ? "#1DB887" : sl.s==="leave" ? "rgba(255,110,90,.6)" : "rgba(255,255,255,.35)";
                        return (
                          <div key={sl.t} style={{ background: bg, border: bd, borderRadius: 8, padding: "7px 0", textAlign: "center" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: cl }}>{sl.t}</div>
                            <div style={{ fontSize: 8, color: "rgba(255,255,255,.22)", marginTop: 2, textTransform: "capitalize" }}>{sl.s}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {clinicStep === 3 && (
                  <div key="cl-3" style={{ animation: "screenIn .35s ease forwards" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(93,202,165,.65)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>Practice Summary · April</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                      {[{n:"128",l:"Patients"},{n:"24",l:"This week"},{n:"₹38k",l:"Revenue"}].map(s=>(
                        <div key={s.l} style={{ background: "rgba(15,155,110,.08)", border: "1px solid rgba(15,155,110,.15)", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#1DB887", letterSpacing: "-.02em" }}>{s.n}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,.32)", marginTop: 2 }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 28, marginBottom: 10 }}>
                      {[40,65,45,80,55,90,70].map((h,i)=>(
                        <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 3, background: i===5 ? BRAND : "rgba(15,155,110,.22)" }}/>
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,.22)", marginBottom: 12 }}>Bookings · Mon – Sun</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["Export PDF", "Export Excel"].map(label=>(
                        <div key={label} style={{ flex: 1, padding: "7px 0", borderRadius: 8, background: "rgba(15,155,110,.12)", border: "1px solid rgba(15,155,110,.25)", color: "rgba(93,202,165,.8)", fontSize: 10, fontWeight: 600, textAlign: "center" }}>{label}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Screen indicator */}
              <div style={{ padding: "6px 20px 16px", display: "flex", gap: 6, justifyContent: "center", position: "relative", zIndex: 1 }}>
                {[0,1,2,3].map(i=>(
                  <div key={i} onClick={() => { clinicStepRef.current = i; setClinicStep(i); }} style={{ width: i===clinicStep ? 18 : 5, height: 5, borderRadius: 3, background: i===clinicStep ? BRAND_M : "rgba(255,255,255,.15)", transition: "all .35s", cursor: "pointer" }} />
                ))}
              </div>
            </motion.div>
          </div>

          {/* For your patients */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ height: 1, flex: 1, background: c.bdr }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: c.txt2, padding: "4px 16px", borderRadius: 100, background: "transparent", border: `1px solid ${c.bdr2}`, flexShrink: 0 }}>
                For your patients
              </span>
              <div style={{ height: 1, flex: 1, background: c.bdr }} />
            </div>
            <div className="lnd-feat-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
              {patientFeatures.map((f, i) => (
                <motion.div key={f.title} {...fadeUp(i * 0.07)}
                  style={{ background: c.card, border: `1px solid ${c.bdr}`, borderRadius: 20, padding: "24px 22px 26px", transition: "all .3s cubic-bezier(.16,1,.3,1)", cursor: "default" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = c.bdr2; el.style.transform = "translateY(-5px)"; el.style.boxShadow = "0 20px 50px rgba(15,155,110,.1)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = c.bdr; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: c.tL, border: `1px solid ${c.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <f.icon style={{ width: 20, height: 20, color: c.T }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.txt, marginBottom: 7, letterSpacing: "-.01em" }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.65 }}>{f.desc}</div>
                </motion.div>
              ))}
            </div>

            {/* Patient Journey Mockup */}
            <motion.div {...fadeUp(0.1)} style={{ background: `linear-gradient(135deg,${c.card},${c.tL})`, borderRadius: 20, border: `1px solid ${c.bdr2}`, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", bottom: -50, left: -50, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${c.T}14,transparent 70%)`, pointerEvents: "none" }} />
              {/* App chrome */}
              <div style={{ background: c.T, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", gap: 5 }}>{[0,1,2].map(i=><div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.3)" }}/>)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.92)", letterSpacing: ".01em" }}>BookMySlot</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)", fontWeight: 600 }}>Patient</div>
              </div>

              {/* Screen content */}
              <div style={{ padding: "18px 20px 10px", minHeight: 188, position: "relative", zIndex: 1 }}>

                {patientStep === 0 && (
                  <div key="pt-0" style={{ animation: "screenIn .35s ease forwards" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>Find a clinic near you</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: c.bg, border: `1px solid ${c.bdr2}`, borderRadius: 10, padding: "8px 14px", marginBottom: 12 }}>
                      <Search style={{ width: 13, height: 13, color: c.muted, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: c.muted, flex: 1 }}>Dental clinic...</div>
                      <div style={{ fontSize: 10, color: c.T, fontWeight: 700 }}>Filter</div>
                    </div>
                    <div style={{ background: c.card, border: `1px solid ${c.bdr2}`, borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: c.tL, border: `1px solid ${c.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🦷</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: c.txt, marginBottom: 2 }}>Sunrise Dental Clinic</div>
                          <div style={{ fontSize: 10, color: c.muted }}>Koramangala, Bengaluru · 1.2 km</div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#F0A050", flexShrink: 0 }}>⭐ 4.8</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        {["Cleaning","Braces","Whitening"].map(tag=>(
                          <div key={tag} style={{ fontSize: 9, fontWeight: 600, color: c.T, background: c.tL, border: `1px solid ${c.bdr2}`, padding: "3px 8px", borderRadius: 6 }}>{tag}</div>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 10, color: c.muted }}>Next slot: Today 3:30 PM</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: c.T, padding: "4px 12px", borderRadius: 20 }}>Book →</div>
                      </div>
                    </div>
                  </div>
                )}

                {patientStep === 1 && (
                  <div key="pt-1" style={{ animation: "screenIn .35s ease forwards" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Available Slots</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.txt2, marginBottom: 12 }}>Tuesday, Apr 22</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 12 }}>
                      {[
                        { t: "9:00 AM",  s: "booked" }, { t: "10:00 AM", s: "open" }, { t: "11:00 AM", s: "open" },
                        { t: "2:00 PM",  s: "booked" }, { t: "3:30 PM",  s: "pick"  }, { t: "4:00 PM",  s: "open" },
                      ].map(sl => {
                        const bg = sl.s==="pick" ? c.T : sl.s==="booked" ? c.tL : c.card;
                        const bd = sl.s==="pick" ? `1.5px solid ${c.T}` : `1px solid ${c.bdr2}`;
                        const cl = sl.s==="pick" ? "#fff" : sl.s==="booked" ? c.muted : c.txt2;
                        return (
                          <div key={sl.t} style={{ background: bg, border: bd, borderRadius: 9, padding: "9px 0", textAlign: "center" }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: cl, textDecoration: sl.s==="booked"?"line-through":"none" }}>{sl.t}</div>
                            <div style={{ fontSize: 8, marginTop: 2, color: sl.s==="pick"?"rgba(255,255,255,.7)":c.muted }}>{sl.s==="booked"?"Full":sl.s==="pick"?"Selected":""}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ padding: "8px 0", borderRadius: 8, background: c.T, color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center" }}>Confirm Slot →</div>
                  </div>
                )}

                {patientStep === 2 && (
                  <div key="pt-2" style={{ animation: "screenIn .35s ease forwards", textAlign: "center", paddingTop: 4 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: c.tL, border: `1px solid ${c.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22 }}>📧</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.txt, marginBottom: 6 }}>Verify your email</div>
                    <div style={{ fontSize: 11, color: c.muted, marginBottom: 16 }}>Code sent to m***@gmail.com</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
                      {["4","8","3","·","·","·"].map((d,i)=>(
                        <div key={i} style={{ width: 34, height: 38, borderRadius: 8, border: i<3 ? `1.5px solid ${c.T}` : `1.5px solid ${c.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: i<3 ? c.T : c.muted, background: i<3 ? c.tL : "transparent" }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ padding: "8px 0", borderRadius: 8, background: c.T, color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center" }}>Verify →</div>
                  </div>
                )}

                {patientStep === 3 && (
                  <div key="pt-3" style={{ animation: "screenIn .35s ease forwards", textAlign: "center", paddingTop: 4 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: c.tL, border: `2px solid ${c.T}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 24 }}>✅</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: c.T, marginBottom: 4 }}>Booking Confirmed!</div>
                    <div style={{ fontSize: 10, color: c.muted, marginBottom: 14 }}>Reference #REF-0042</div>
                    <div style={{ background: c.card, border: `1px solid ${c.bdr2}`, borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
                      {[{icon:"🏥",text:"Sunrise Dental Clinic"},{icon:"📅",text:"Tue, Apr 22 · 3:30 PM"},{icon:"👩‍⚕️",text:"Dr. Priya Menon"}].map(r=>(
                        <div key={r.text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: c.txt2, marginBottom: 6 }}>
                          <span style={{ fontSize: 12 }}>{r.icon}</span> {r.text}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 11, color: c.T, fontWeight: 600 }}>📩 Reminder sent to your email</div>
                  </div>
                )}
              </div>

              {/* Screen indicator */}
              <div style={{ padding: "6px 20px 16px", display: "flex", gap: 6, justifyContent: "center", position: "relative", zIndex: 1 }}>
                {[0,1,2,3].map(i=>(
                  <div key={i} onClick={() => { patientStepRef.current = i; setPatientStep(i); }} style={{ width: i===patientStep ? 18 : 5, height: 5, borderRadius: 3, background: i===patientStep ? c.T : c.bdr2, transition: "all .35s", cursor: "pointer" }} />
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══ SMILE DEALS CALLOUT ══════════════════════════════════════════════ */}
        <section className="lnd-section" style={{ padding: "0 64px 60px" }}>
          <div style={{ background: "linear-gradient(135deg,#0A2018,#0D1F16)", borderRadius: 28, padding: "48px 56px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -80, right: -80, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(15,155,110,.18),transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -60, left: -40, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle,rgba(15,155,110,.08),transparent 70%)", pointerEvents: "none" }} />

            <div className="lnd-deals-inner" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 48, alignItems: "center", position: "relative", zIndex: 1 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: BRAND_M, marginBottom: 16, padding: "4px 14px", borderRadius: 100, background: "rgba(15,155,110,.12)", border: "1px solid rgba(15,155,110,.25)" }}>
                  ✦ Smile Deals — Exclusive to BookMySlot
                </div>
                <h2 style={{ fontSize: "clamp(22px,2.8vw,34px)", fontWeight: 800, color: "#fff", letterSpacing: "-.03em", lineHeight: 1.2, marginBottom: 14 }}>
                  Give patients a reason to choose your clinic
                </h2>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,.48)", lineHeight: 1.72, maxWidth: 480, marginBottom: 28 }}>
                  Post exclusive dental packages directly on BookMySlot. Patients discover your offers, book instantly, and you fill seats that would otherwise go empty — no ad spend required.
                </p>
                <Link href="/deals">
                  <button
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", borderRadius: 100, background: BRAND_M, color: "#051209", fontWeight: 700, fontSize: 14, fontFamily: "'Sora',sans-serif", border: "none", cursor: "pointer", transition: "all .25s" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = BRAND; el.style.color = "#fff"; el.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = BRAND_M; el.style.color = "#051209"; el.style.transform = "translateY(0)"; }}
                    data-testid="button-browse-deals"
                  >
                    Browse Smile Deals <ArrowRight style={{ width: 15, height: 15 }} />
                  </button>
                </Link>
              </div>

              {/* Mini deal card previews */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 230 }}>
                {[
                  { emoji: "🦷", title: "Full Checkup",       price: "₹299",   original: "₹799",   tag: "⚡ Flash"  },
                  { emoji: "✨", title: "Teeth Whitening",    price: "₹1,499", original: "₹3,000", tag: "Featured" },
                  { emoji: "🛡️", title: "Cavity Shield Pack", price: "₹499",   original: "₹1,200", tag: "⚡ Flash"  },
                ].map((deal, i) => (
                  <div key={deal.title} style={{ background: "rgba(15,30,22,.8)", border: "1px solid rgba(15,155,110,.2)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, backdropFilter: "blur(8px)", animation: `lndFloat ${4+i}s ease-in-out ${i*0.8}s infinite` }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{deal.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#E8F5F0", marginBottom: 2 }}>{deal.title}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: BRAND_M }}>{deal.price}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,.3)", textDecoration: "line-through" }}>{deal.original}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#F0C060", background: "rgba(240,192,96,.1)", border: "1px solid rgba(240,192,96,.2)", padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>{deal.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ═════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="lnd-section" style={{ padding: "0 64px 90px" }}>
          <div className="lnd-how-inner" style={{ background: "linear-gradient(135deg,#0A2018,#0D1F16)", borderRadius: 28, padding: "60px 56px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(15,155,110,.15),transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -80, left: -60, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(15,155,110,.08),transparent 70%)", pointerEvents: "none" }} />

            <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 48, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(93,202,165,.8)", marginBottom: 12 }}>Simple by design</div>
              <h2 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 800, color: "#fff", letterSpacing: "-.03em" }}>Up and running in three steps</h2>
            </motion.div>

            <div className="lnd-steps" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, position: "relative", zIndex: 1 }}>
              <div style={{ position: "absolute", top: 28, left: "calc(16.5% + 16px)", right: "calc(16.5% + 16px)", height: 1, background: "rgba(255,255,255,.08)" }} />
              {[
                { n: "1", title: "Register your clinic",   desc: "Create an account, add clinic details, and invite your doctors — takes under five minutes." },
                { n: "2", title: "Set up availability",    desc: "Doctors configure their slots. The system handles conflicts and double-bookings automatically." },
                { n: "3", title: "Patients start booking", desc: "Share your clinic link. Patients book, confirm, and get reminders — all without a phone call." },
              ].map((step, i) => (
                <motion.div key={step.n} {...fadeUp(i * 0.1)} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 24px" }}>
                  <div
                    style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(15,155,110,.18)", border: "1px solid rgba(15,155,110,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "rgba(93,202,165,.9)", marginBottom: 18, position: "relative", zIndex: 1, transition: "all .3s", cursor: "default" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = BRAND; el.style.color = "#fff"; el.style.borderColor = BRAND; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(15,155,110,.18)"; el.style.color = "rgba(93,202,165,.9)"; el.style.borderColor = "rgba(15,155,110,.3)"; }}
                  >{step.n}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", lineHeight: 1.65 }}>{step.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
        <section className="lnd-section" style={{ padding: "0 64px 90px" }}>
          <motion.div {...fadeUp(0)} className="lnd-cta-inner" style={{ background: c.card, border: `1px solid ${c.bdr2}`, borderRadius: 24, padding: "60px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%,rgba(15,155,110,.05) 0%,transparent 65%)", pointerEvents: "none" }} />
            <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, color: c.txt, letterSpacing: "-.03em", marginBottom: 14, position: "relative", zIndex: 1 }}>
              Ready to simplify your<br /><span style={{ color: c.T }}>clinic scheduling?</span>
            </h2>
            <p style={{ fontSize: 15, color: c.muted, lineHeight: 1.65, maxWidth: 420, margin: "0 auto 32px", position: "relative", zIndex: 1 }}>
              Join clinics already using BookMySlot to save time, reduce no-shows, and serve more patients every day.
            </p>
            <div className="lnd-cta-btns" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
              <Link href="/getting-started">
                <button
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 36px", borderRadius: 100, background: c.T, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'Sora',sans-serif", border: "none", cursor: "pointer", boxShadow: `0 4px 20px rgba(15,155,110,.3)`, transition: "all .25s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = c.T_D; el.style.transform = "translateY(-2px)"; el.style.boxShadow = `0 8px 28px rgba(15,155,110,.4)`; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = c.T; el.style.transform = "translateY(0)"; el.style.boxShadow = `0 4px 20px rgba(15,155,110,.3)`; }}
                  data-testid="button-cta-get-started"
                >
                  Get Started Free <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
              </Link>
              <Link href="/book">
                <button
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 100, background: "transparent", color: c.txt2, fontSize: 15, fontWeight: 600, fontFamily: "'Sora',sans-serif", border: `1.5px solid ${c.bdr2}`, cursor: "pointer", transition: "all .25s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = c.tL; el.style.color = c.T; el.style.borderColor = c.T; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = c.txt2; el.style.borderColor = c.bdr2; }}
                  data-testid="button-cta-book-slot"
                >
                  Book a slot instead
                </button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
        <footer className="lnd-footer" style={{ borderTop: `1px solid ${c.bdr}`, padding: "22px 64px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: c.muted, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, color: c.txt, fontSize: 14 }}>book<span style={{ color: c.T }}>My</span>Slot</div>
          <div>Built for dental clinics</div>
          <div>© 2026 BookMySlot. All rights reserved.</div>
        </footer>

      </div>
    </div>
  );
}
