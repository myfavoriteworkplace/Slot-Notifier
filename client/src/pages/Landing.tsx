import { useAuth } from "@/hooks/use-auth";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { ArrowRight, Clock, Shield, Users, Star, Download, UserCheck, Check } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const T     = "#0F9B6E";
const T_D   = "#0A7A56";
const T_L   = "#E8F5F0";
const T_B   = "rgba(15,155,110,.13)";
const T_B2  = "rgba(15,155,110,.24)";
const TXT   = "#0A1F16";
const TXT2  = "#3D6B55";
const MUTED = "#7A9E8E";
const BDR   = "rgba(15,155,110,.12)";
const BDR2  = "rgba(15,155,110,.22)";
const WHITE = "#FFFFFF";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay },
});

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const { isAuthenticated: isClinicAuthenticated } = useClinicAuth();
  const [_, setLocation] = useLocation();
  const [toastVisible, setToastVisible] = useState(false);

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

  const features = [
    { icon: Clock,     title: "Real-time Availability", desc: "See open slots live. Updates happen instantly so double-bookings are impossible." },
    { icon: Shield,    title: "Secure & Private",       desc: "Patient data is encrypted and protected. Privacy-first design for clinics and patients alike." },
    { icon: Users,     title: "Role-based Access",      desc: "Tailored dashboards for clinic admins, doctors, and patients — everyone sees what they need." },
    { icon: Star,      title: "Smile DEALS",            desc: "Exclusive dental packages from partner clinics — patients save, clinics fill slots faster." },
    { icon: UserCheck, title: "Doctor Profiles",        desc: "Certifications, case studies, and verified credentials — build trust before patients walk in." },
    { icon: Download,  title: "Data & Exports",         desc: "Export patient data in Excel, CSV, or PDF anytime. Automated monthly backup reminders included." },
  ];

  return (
    <div style={{ background: "#F5FAF7", color: TXT, fontFamily: "'Sora', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes lndDrift  { from { transform:translate(0,0) scale(1); } to { transform:translate(30px,40px) scale(1.08); } }
        @keyframes lndPulse  { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:.5} }
        @keyframes lndFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes lndFloat2 { 0%,100%{transform:translateY(0) rotate(1.5deg)} 50%{transform:translateY(-7px) rotate(1.5deg)} }
        @keyframes lndFloat3 { 0%,100%{transform:translateY(0) rotate(-1.5deg)} 50%{transform:translateY(-6px) rotate(-1.5deg)} }
        @media (max-width: 900px) { .lnd-hero-right { display: none !important; } .lnd-hero { grid-template-columns: 1fr !important; min-height: auto !important; padding: 80px 24px 60px !important; } .lnd-features-grid { grid-template-columns: 1fr !important; } .lnd-steps { grid-template-columns: 1fr !important; gap: 28px !important; } .lnd-steps::before { display: none !important; } .lnd-how-inner { padding: 40px 24px !important; } .lnd-cta-inner { padding: 48px 24px !important; } .lnd-section { padding-left: 24px !important; padding-right: 24px !important; } }
      `}</style>

      {/* Ambient background blobs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -120, right: -100, width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(15,155,110,.09) 0%, transparent 65%)", filter: "blur(80px)", animation: "lndDrift 14s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(15,155,110,.06) 0%, transparent 65%)", filter: "blur(80px)", animation: "lndDrift 18s ease-in-out infinite alternate-reverse" }} />
      </div>

      <div style={{ position: "relative", zIndex: 2 }}>

        {/* ── HERO ── */}
        <section
          className="lnd-hero"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", minHeight: "calc(100vh - 62px)", padding: "80px 64px 60px", gap: 48 }}
        >
          {/* Left */}
          <div>
            {/* Live badge */}
            <motion.div {...fadeUp(0)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 100, background: T_L, border: `1px solid ${BDR2}`, fontSize: 12, fontWeight: 600, color: T, letterSpacing: ".04em", marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: T, flexShrink: 0, animation: "lndPulse 1.4s ease-in-out infinite", display: "inline-block" }} />
              Live — trusted by dental clinics
            </motion.div>

            {/* Headline */}
            <motion.h1 {...fadeUp(0.08)} style={{ fontSize: "clamp(38px, 4.5vw, 62px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.03em", color: TXT, marginBottom: 22 }}>
              Booking made{" "}
              <span style={{ color: T, position: "relative", display: "inline-block" }}>
                effortless
                <span style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T}, transparent)`, borderRadius: 2 }} />
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p {...fadeUp(0.16)} style={{ fontSize: 16, color: MUTED, lineHeight: 1.75, maxWidth: 420, marginBottom: 36 }}>
              Streamline your clinic's scheduling in minutes. Doctors manage availability, patients book slots instantly — no more back-and-forth calls.
            </motion.p>

            {/* Buttons */}
            <motion.div {...fadeUp(0.22)} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <Link href="/getting-started">
                <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 100, background: T, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Sora', sans-serif", border: "none", cursor: "pointer", boxShadow: `0 4px 20px rgba(15,155,110,.3)`, transition: "all .25s", letterSpacing: ".01em" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T_D; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px rgba(15,155,110,.4)`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(15,155,110,.3)`; }}
                  data-testid="button-get-started"
                >
                  Get Started <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
              </Link>
              <a href="#how-it-works" style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 100, background: "transparent", color: TXT2, fontSize: 14, fontWeight: 600, fontFamily: "'Sora', sans-serif", border: `1.5px solid ${BDR2}`, cursor: "pointer", textDecoration: "none", transition: "all .25s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T_L; (e.currentTarget as HTMLElement).style.color = T; (e.currentTarget as HTMLElement).style.borderColor = T; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = TXT2; (e.currentTarget as HTMLElement).style.borderColor = BDR2; }}
                data-testid="link-see-how-it-works"
              >
                See how it works
              </a>
            </motion.div>

            {/* Trust row */}
            <motion.div {...fadeUp(0.3)} style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 36, flexWrap: "wrap" }}>
              {["Free to get started", "No setup fees", "Works on any device"].map((item, i) => (
                <span key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}>
                  {i > 0 && <span style={{ width: 1, height: 14, background: BDR2, marginRight: 14, display: "inline-block" }} />}
                  <Check style={{ width: 13, height: 13, color: T, flexShrink: 0 }} />
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right — Product visual */}
          <motion.div className="lnd-hero-right" {...fadeUp(0.18)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 460 }}>

              {/* Floating badge — top right */}
              <div style={{ position: "absolute", right: -20, top: 48, background: WHITE, border: `1px solid ${BDR2}`, borderRadius: 14, padding: "10px 16px", boxShadow: "0 8px 24px rgba(10,31,22,.1)", animation: "lndFloat2 5s ease-in-out infinite", minWidth: 140, zIndex: 10 }}>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>This month</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T, letterSpacing: "-.02em" }}>850+</div>
                <div style={{ fontSize: 10, color: MUTED }}>slots booked</div>
              </div>

              {/* Floating badge — bottom left */}
              <div style={{ position: "absolute", left: -20, bottom: 72, background: WHITE, border: `1px solid ${BDR2}`, borderRadius: 14, padding: "10px 16px", boxShadow: "0 8px 24px rgba(10,31,22,.1)", animation: "lndFloat3 6s ease-in-out 1s infinite", minWidth: 130, zIndex: 10 }}>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>Avg booking time</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T, letterSpacing: "-.02em" }}>12 sec</div>
                <div style={{ fontSize: 10, color: MUTED }}>to confirm a slot</div>
              </div>

              {/* Product frame */}
              <div style={{ background: WHITE, borderRadius: 24, border: `1px solid ${BDR2}`, boxShadow: "0 24px 80px rgba(10,31,22,.1), 0 2px 8px rgba(15,155,110,.08)", overflow: "hidden" }}>
                {/* Frame title bar */}
                <div style={{ background: T, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,.3)" }} />)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.9)" }}>Doctor Portal</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>2:00 PM</div>
                </div>

                {/* Greeting */}
                <div style={{ background: `linear-gradient(135deg, ${T_D}, ${T})`, padding: "18px 20px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "rgba(255,255,255,.55)", textTransform: "uppercase", marginBottom: 4 }}>Your Schedule</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Good afternoon, Dr. Priya</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ n: "3", l: "Total" }, { n: "1", l: "Today", hi: true }, { n: "2", l: "Upcoming" }].map(s => (
                      <div key={s.l} style={{ flex: 1, background: s.hi ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.14)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(255,255,255,.18)", backdropFilter: "blur(8px)" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{s.n}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 1 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: ".06em", textTransform: "uppercase" }}>Upcoming appointment</div>

                  {/* Appointment card */}
                  <div style={{ border: `1px solid ${BDR2}`, borderRadius: 12, overflow: "hidden", animation: "lndFloat 4s ease-in-out infinite" }}>
                    <div style={{ background: T, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,.25)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>A</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Anand K.</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>#REF-0041</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,.2)", padding: "2px 8px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                        <Check style={{ width: 9, height: 9 }} /> Confirmed
                      </div>
                    </div>
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5, background: WHITE }}>
                      {[
                        { icon: "📅", text: "Today · 2:00 – 4:00 PM" },
                        { icon: "🏥", text: "Sunrise Dental Clinic" },
                        { icon: "📋", text: "Routine Checkup" },
                      ].map(r => (
                        <div key={r.text} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
                          <span style={{ fontSize: 10 }}>{r.icon}</span> {r.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Toast notification */}
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 10, background: T_L, border: `1px solid ${BDR2}`, opacity: toastVisible ? 1 : 0, transform: toastVisible ? "translateX(0)" : "translateX(16px)", transition: "opacity .4s ease, transform .4s ease" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: T, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 12 }}>🔔</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T }}>New slot booked</div>
                      <div style={{ fontSize: 10, color: MUTED }}>Meera R. · Tomorrow · 10:00 AM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="lnd-section" style={{ padding: "80px 64px 90px" }}>
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T, marginBottom: 14 }}>
              <span style={{ width: 18, height: 1, background: T, display: "inline-block" }} />
              Everything you need
              <span style={{ width: 18, height: 1, background: T, display: "inline-block" }} />
            </div>
            <h2 style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: TXT, letterSpacing: "-.03em", lineHeight: 1.15, marginBottom: 14 }}>
              Built for clinics,<br />loved by <span style={{ color: T }}>doctors & patients</span>
            </h2>
            <p style={{ fontSize: 15, color: MUTED, maxWidth: 460, margin: "0 auto", lineHeight: 1.65 }}>
              Every feature is designed around how a real dental clinic actually works — not how a generic SaaS thinks it should.
            </p>
          </motion.div>

          <div className="lnd-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {features.map((f, i) => (
              <motion.div key={f.title} {...fadeUp(i * 0.07)} style={{ background: WHITE, border: `1px solid ${BDR}`, borderRadius: 20, padding: "26px 26px 28px", position: "relative", overflow: "hidden", transition: "all .3s cubic-bezier(.16,1,.3,1)", cursor: "default" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = BDR2; el.style.transform = "translateY(-5px)"; el.style.boxShadow = "0 20px 50px rgba(15,155,110,.1)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = BDR; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}
              >
                {/* Top accent bar on hover — done via inline group */}
                <div style={{ width: 46, height: 46, borderRadius: 14, background: T_L, border: `1px solid ${BDR2}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                  <f.icon style={{ width: 22, height: 22, color: T }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TXT, marginBottom: 8, letterSpacing: "-.01em" }}>{f.title}</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="lnd-section" style={{ padding: "0 64px 90px" }}>
          <div className="lnd-how-inner" style={{ background: "linear-gradient(135deg, #0A2018, #0D1F16)", borderRadius: 28, padding: "60px 56px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(15,155,110,.15), transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -80, left: -60, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(15,155,110,.08), transparent 70%)", pointerEvents: "none" }} />

            <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 48, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(93,202,165,.8)", marginBottom: 12 }}>Simple by design</div>
              <h2 style={{ fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 800, color: "#fff", letterSpacing: "-.03em" }}>Up and running in three steps</h2>
            </motion.div>

            <div className="lnd-steps" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, position: "relative", zIndex: 1 }}>
              {/* connector line */}
              <div style={{ position: "absolute", top: 28, left: "calc(16.5% + 16px)", right: "calc(16.5% + 16px)", height: 1, background: "rgba(255,255,255,.08)" }} />
              {[
                { n: "1", title: "Register your clinic", desc: "Create an account, add clinic details, and invite your doctors — takes under five minutes." },
                { n: "2", title: "Set up availability",  desc: "Doctors configure their slots. The system handles conflicts and double-bookings automatically." },
                { n: "3", title: "Patients start booking", desc: "Share your clinic link. Patients book, confirm, and get reminders — all without a phone call." },
              ].map((step, i) => (
                <motion.div key={step.n} {...fadeUp(i * 0.1)} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 24px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(15,155,110,.18)", border: "1px solid rgba(15,155,110,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "rgba(93,202,165,.9)", marginBottom: 18, position: "relative", zIndex: 1, transition: "all .3s", cursor: "default" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = T; el.style.color = "#fff"; el.style.borderColor = T; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(15,155,110,.18)"; el.style.color = "rgba(93,202,165,.9)"; el.style.borderColor = "rgba(15,155,110,.3)"; }}
                  >{step.n}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", lineHeight: 1.65 }}>{step.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="lnd-section" style={{ padding: "0 64px 90px" }}>
          <motion.div {...fadeUp(0)} className="lnd-cta-inner" style={{ background: WHITE, border: `1px solid ${BDR2}`, borderRadius: 24, padding: "60px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(15,155,110,.05) 0%, transparent 65%)", pointerEvents: "none" }} />
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 800, color: TXT, letterSpacing: "-.03em", marginBottom: 14, position: "relative", zIndex: 1 }}>
              Ready to simplify your<br /><span style={{ color: T }}>clinic scheduling?</span>
            </h2>
            <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.65, maxWidth: 420, margin: "0 auto 32px", position: "relative", zIndex: 1 }}>
              Join clinics already using BookMySlot to save time, reduce no-shows, and serve more patients every day.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
              <Link href="/getting-started">
                <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 36px", borderRadius: 100, background: T, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'Sora', sans-serif", border: "none", cursor: "pointer", boxShadow: `0 4px 20px rgba(15,155,110,.3)`, transition: "all .25s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = T_D; el.style.transform = "translateY(-2px)"; el.style.boxShadow = `0 8px 28px rgba(15,155,110,.4)`; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = T; el.style.transform = "translateY(0)"; el.style.boxShadow = `0 4px 20px rgba(15,155,110,.3)`; }}
                  data-testid="button-cta-get-started"
                >
                  Get Started Free <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
              </Link>
              <Link href="/book">
                <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 100, background: "transparent", color: TXT2, fontSize: 15, fontWeight: 600, fontFamily: "'Sora', sans-serif", border: `1.5px solid ${BDR2}`, cursor: "pointer", transition: "all .25s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = T_L; el.style.color = T; el.style.borderColor = T; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = TXT2; el.style.borderColor = BDR2; }}
                  data-testid="button-cta-book-slot"
                >
                  Book a slot instead
                </button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: `1px solid ${BDR}`, padding: "22px 64px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: MUTED, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, color: TXT, fontSize: 14 }}>Book<span style={{ color: T }}>My</span>Slot</div>
          <div>Built for dental clinics</div>
          <div>© 2026 BookMySlot. All rights reserved.</div>
        </footer>

      </div>
    </div>
  );
}
