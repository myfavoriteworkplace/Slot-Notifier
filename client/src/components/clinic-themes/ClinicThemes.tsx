import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import defaultHeroImg from "@assets/WhatsApp_Image_2026-05-13_at_9.00.41_PM_1778687930285.jpeg";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ClinicWebsiteConfig } from "@shared/schema";
import {
  Star, Phone, Mail, MapPin, Globe, Clock, Navigation,
  Instagram, Facebook, Youtube, ExternalLink,
  ChevronLeft, ChevronRight, Menu, X,
  Users2, ShieldCheck, Heart, Award, Activity, Zap, Stethoscope, CheckCircle2,
  HelpCircle, MessageCircle, Quote,
} from "lucide-react";

const PIN_ICON = L.divIcon({
  html: `<div style="width:32px;height:40px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))"><div style="width:28px;height:28px;background:#0F9B6E;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)"></div><div style="width:4px;height:12px;background:#0F9B6E;border-radius:0 0 2px 2px;margin-top:-2px"></div></div>`,
  className: "",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

export type ThemeClinic = {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  doctors?: { name: string; specialization: string; degree: string; imageUrl?: string | null; bio?: string | null; yearsOfExperience?: number | null }[] | null;
  doctorName?: string | null;
  doctorSpecialization?: string | null;
  doctorDegree?: string | null;
};

interface ThemeProps {
  clinic: ThemeClinic;
  cfg: ClinicWebsiteConfig;
  bookingHref: string;
  isOwner?: boolean;
}

export const DEFAULT_SERVICES = [
  { name: "Dental Check-ups & Cleaning", description: "Comprehensive oral examination and professional cleaning." },
  { name: "Root Canal Treatment", description: "Pain-free root canal therapy using modern techniques." },
  { name: "Dental Implants", description: "Permanent tooth replacement with titanium implants." },
  { name: "Teeth Whitening", description: "Professional whitening for a brighter, confident smile." },
  { name: "Cosmetic Dentistry", description: "Smile makeovers tailored to your aesthetic goals." },
  { name: "Pediatric Dentistry", description: "Gentle, child-friendly care from an early age." },
];

export const DEFAULT_HOURS = [
  { day: "Mon – Fri", open: "9:00 AM", close: "7:00 PM", closed: false },
  { day: "Saturday", open: "9:00 AM", close: "4:00 PM", closed: false },
  { day: "Sunday", open: "", close: "", closed: true },
];

export const DEFAULT_FEATURES = [
  { icon: "users", title: "Expert and Passionate Team" },
  { icon: "stethoscope", title: "Comprehensive Dental Care Services" },
  { icon: "heart", title: "Focus on Patient Comfort and Confidence" },
  { icon: "zap", title: "Advanced Technology and Continuous Learning" },
];

export const DEFAULT_STATS = [
  { value: "2800+", label: "Dental Fillings" },
  { value: "1200+", label: "Tooth Extraction" },
  { value: "3K+",   label: "Root Canal" },
  { value: "2100+", label: "Implants Placed" },
];

const STAT_ICONS = [Users2, Stethoscope, Award, Heart];

const FEATURE_ICON_MAP: Record<string, React.ElementType> = {
  users: Users2,
  shield: ShieldCheck,
  heart: Heart,
  award: Award,
  activity: Activity,
  zap: Zap,
  stethoscope: Stethoscope,
  check: CheckCircle2,
};

/* ─── Placeholder SVG components ──────────────────────── */

/** Clinic interior line-art — replaces the 🏥 emoji placeholder */
function ClinicPhotoPlaceholder({ cardBg, border, height = "h-[420px]", isOwner = false }: {
  cardBg: string;
  border: string;
  height?: string;
  isOwner?: boolean;
}) {
  return (
    <div className={`rounded-2xl w-full ${height} relative overflow-hidden border-2 border-dashed ${border} ${cardBg} flex flex-col items-center justify-center`}>
      {/* Line-art dental clinic scene */}
      <svg
        viewBox="0 0 380 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[85%] h-[85%] opacity-[0.38]"
        aria-label="Clinic photo placeholder"
      >
        {/* Floor line */}
        <line x1="18" y1="245" x2="362" y2="245" stroke="#0F9B6E" strokeWidth="1.5" strokeLinecap="round" />

        {/* Left wall — window */}
        <rect x="28" y="52" width="58" height="82" rx="3" stroke="#0F9B6E" strokeWidth="1.5" />
        <line x1="57" y1="52" x2="57" y2="134" stroke="#0F9B6E" strokeWidth="1" strokeOpacity="0.55" />
        <line x1="28" y1="93" x2="86" y2="93" stroke="#0F9B6E" strokeWidth="1" strokeOpacity="0.55" />

        {/* Wall plant */}
        <line x1="82" y1="245" x2="82" y2="212" stroke="#0F9B6E" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="82" cy="201" rx="14" ry="16" stroke="#0F9B6E" strokeWidth="1.5" />
        <ellipse cx="72" cy="211" rx="10" ry="12" stroke="#0F9B6E" strokeWidth="1.5" strokeOpacity="0.5" />

        {/* ── DENTAL CHAIR ── */}
        {/* Hydraulic base */}
        <rect x="172" y="218" width="58" height="27" rx="4" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.06" />
        {/* Seat */}
        <rect x="118" y="180" width="166" height="40" rx="9" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.06" />
        {/* Seatback */}
        <rect x="152" y="92" width="80" height="91" rx="9" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.06" />
        {/* Headrest */}
        <rect x="164" y="72" width="56" height="24" rx="9" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.08" />
        {/* Left armrest */}
        <rect x="118" y="172" width="22" height="50" rx="5" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.06" />
        {/* Right armrest */}
        <rect x="262" y="172" width="22" height="50" rx="5" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.06" />
        {/* Footrest */}
        <path d="M118 215 L98 215 L98 231 L118 231" stroke="#0F9B6E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* ── OVERHEAD LAMP ── */}
        <rect x="295" y="16" width="52" height="9" rx="3" stroke="#0F9B6E" strokeWidth="1.5" />
        <path d="M321 25 L321 82 L279 102" stroke="#0F9B6E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx="267" cy="108" rx="21" ry="13" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.08" />
        <ellipse cx="267" cy="108" rx="9" ry="5.5" stroke="#0F9B6E" strokeWidth="1" strokeOpacity="0.5" />

        {/* ── EQUIPMENT TRAY ── */}
        <path d="M118 200 L93 200 L93 186" stroke="#0F9B6E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="78" y="175" width="30" height="13" rx="3" stroke="#0F9B6E" strokeWidth="1.5" />

        {/* ── WALL CABINET (right) ── */}
        <rect x="316" y="148" width="50" height="92" rx="4" stroke="#0F9B6E" strokeWidth="1.5" />
        <line x1="316" y1="194" x2="366" y2="194" stroke="#0F9B6E" strokeWidth="1" strokeOpacity="0.55" />
        <circle cx="341" cy="193" r="3.5" stroke="#0F9B6E" strokeWidth="1.5" />

        {/* Medical cross accent */}
        <path d="M344 68 L344 84 M336 76 L352 76" stroke="#0F9B6E" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.45" />
      </svg>

      {/* Admin-only hint badge */}
      {isOwner && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 bg-[#0F9B6E] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md cursor-default select-none z-10"
          title="Upload a clinic photo from your dashboard → Website → Clinic Photo"
        >
          <span>ℹ</span>
          <span>Add photo</span>
        </div>
      )}

      {/* Subtle shimmer */}
      <div className="absolute inset-0 animate-pulse bg-[#0F9B6E]/[0.015] rounded-2xl pointer-events-none" />
    </div>
  );
}

/** Doctor white-coat silhouette — replaces the letter-initial grey circle */
function DoctorAvatarPlaceholder() {
  return (
    <div className="w-full h-full bg-gradient-to-b from-[#0F9B6E]/10 to-[#0F9B6E]/5 flex items-end justify-center overflow-hidden">
      <svg
        viewBox="0 0 160 172"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-36"
        aria-label="Doctor placeholder"
      >
        {/* Head */}
        <circle cx="80" cy="52" r="30" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.08" />

        {/* Neck */}
        <path d="M70 80 L70 94 Q80 98 90 94 L90 80" stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.06" strokeLinejoin="round" />

        {/* White coat body */}
        <path d="M2 172 L2 142 C2 122 28 110 52 106 L63 126 L80 131 L97 126 L108 106 C132 110 158 122 158 142 L158 172 Z"
          stroke="#0F9B6E" strokeWidth="1.5" fill="#0F9B6E" fillOpacity="0.07" strokeLinejoin="round" />

        {/* Coat collar / lapels */}
        <path d="M63 126 L70 148 L80 152 L90 148 L97 126"
          stroke="#0F9B6E" strokeWidth="1.5" fill="none" strokeLinejoin="round" />

        {/* Stethoscope — left drape */}
        <path d="M62 120 C54 130 50 143 55 155 C59 164 68 166 76 162"
          stroke="#0F9B6E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Stethoscope chest piece */}
        <circle cx="76" cy="162" r="5" stroke="#0F9B6E" strokeWidth="1.5" />

        {/* Breast pocket */}
        <rect x="104" y="134" width="22" height="15" rx="2" stroke="#0F9B6E" strokeWidth="1" strokeOpacity="0.5" />
        {/* Pen in pocket */}
        <line x1="110" y1="134" x2="110" y2="149" stroke="#0F9B6E" strokeWidth="1" strokeOpacity="0.45" strokeLinecap="round" />
        <line x1="116" y1="134" x2="116" y2="149" stroke="#0F9B6E" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ─── Shared helpers ───────────────────────────────────── */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

function MapSection({ clinic, cfg }: { clinic: ThemeClinic; cfg: ClinicWebsiteConfig }) {
  if (cfg.showMap === false || !clinic.latitude || !clinic.longitude) return null;
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="font-semibold text-gray-800">{clinic.address}{clinic.city ? `, ${clinic.city}` : ""}</span>
        </div>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${clinic.latitude},${clinic.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <Navigation className="h-4 w-4" />
          Get Directions
        </a>
      </div>
      <div style={{ height: 280 }}>
        <MapContainer center={[clinic.latitude, clinic.longitude]} zoom={16} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl={true} attributionControl={true}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
          <Marker position={[clinic.latitude, clinic.longitude]} icon={PIN_ICON} />
        </MapContainer>
      </div>
    </div>
  );
}

function SocialLinks({ links, light }: { links?: ClinicWebsiteConfig["socialLinks"]; light?: boolean }) {
  if (!links) return null;
  const cls = `hover:opacity-70 transition-opacity ${light ? "text-white" : ""}`;
  return (
    <div className="flex items-center gap-4">
      {links.instagram && (
        <a href={links.instagram} target="_blank" rel="noopener noreferrer" className={cls}>
          <Instagram className="h-5 w-5" />
        </a>
      )}
      {links.facebook && (
        <a href={links.facebook} target="_blank" rel="noopener noreferrer" className={cls}>
          <Facebook className="h-5 w-5" />
        </a>
      )}
      {links.youtube && (
        <a href={links.youtube} target="_blank" rel="noopener noreferrer" className={cls}>
          <Youtube className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}

/* ─── NEW: Stats bar ───────────────────────────────────── */

export function StatsBar({ stats, bg, numColor, labelColor }: {
  stats: { value: string; label: string }[];
  bg: string;
  numColor: string;
  labelColor: string;
}) {
  return (
    <section className={`px-6 py-16 ${bg}`}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => {
            const Icon = STAT_ICONS[i % STAT_ICONS.length];
            return (
              <div key={i} className="text-center">
                <div className="h-16 w-16 rounded-full bg-[#0F9B6E] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#0F9B6E]/30">
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <p className={`text-4xl font-black ${numColor} mb-1`}>{s.value}</p>
                <p className={`text-sm font-semibold ${labelColor} mt-1`}>{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── NEW: Why Choose Us ───────────────────────────────── */

export function WhyChooseUs({ features, imageUrl, bg, cardBg, border, titleColor, accentColor, serif, isOwner }: {
  features: { icon: string; title: string }[];
  imageUrl?: string;
  bg: string;
  cardBg: string;
  border: string;
  titleColor: string;
  accentColor: string;
  serif?: boolean;
  isOwner?: boolean;
}) {
  return (
    <section className={`px-6 py-20 ${bg}`}>
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className={`text-sm font-bold uppercase tracking-widest ${accentColor} mb-3`}>Why Choose Us</p>
            <h2
              className={`text-3xl font-bold ${titleColor} mb-8`}
              style={serif
                ? { fontFamily: "'Playfair Display', Georgia, serif" }
                : { fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em", fontWeight: 900 }}
            >
              Our Commitment to You
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((f, i) => {
                const Icon = FEATURE_ICON_MAP[f.icon] ?? Heart;
                return (
                  <div key={i} className={`flex flex-col items-center text-center p-5 rounded-2xl ${cardBg} border ${border}`}>
                    <div className="h-14 w-14 rounded-full bg-[#0F9B6E]/10 border-2 border-[#0F9B6E]/20 flex items-center justify-center mb-3">
                      <Icon className="h-6 w-6 text-[#0F9B6E]" />
                    </div>
                    <p className={`font-semibold text-sm ${titleColor} leading-snug`}>{f.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            {imageUrl ? (
              <img src={imageUrl} alt="Clinic" className="rounded-2xl w-full h-[420px] object-cover shadow-xl" />
            ) : (
              <ClinicPhotoPlaceholder cardBg={cardBg} border={border} isOwner={isOwner} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── NEW: Services carousel ───────────────────────────── */

export function ServicesCarousel({ services, sectionId, titleLabel, title, bg, cardBg, border, titleColor, accentColor, textColor, serif, numStyle }: {
  services: { name: string; description: string; imageUrl?: string }[];
  sectionId: string;
  titleLabel?: string;
  title: string;
  bg: string;
  cardBg: string;
  border: string;
  titleColor: string;
  accentColor: string;
  textColor: string;
  serif?: boolean;
  numStyle?: boolean;
}) {
  const [page, setPage] = useState(0);
  const ipp = 3;
  const pages = Math.ceil(services.length / ipp);
  const visible = services.slice(page * ipp, (page + 1) * ipp);
  const hasImages = services.some(s => s.imageUrl);

  return (
    <section id={sectionId} className={`px-6 py-20 ${bg}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            {titleLabel && (
              <p className={`text-sm font-bold uppercase tracking-widest ${accentColor} mb-2`}>{titleLabel}</p>
            )}
            <h2
              className={`text-4xl font-bold ${titleColor}`}
              style={serif
                ? { fontFamily: "'Playfair Display', Georgia, serif" }
                : { fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em", fontWeight: 900 }}
            >
              {title}
            </h2>
          </div>
          {pages > 1 && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className={`h-10 w-10 rounded-xl border ${border} flex items-center justify-center ${titleColor} hover:bg-[#0F9B6E] hover:text-white hover:border-[#0F9B6E] transition-all disabled:opacity-30`}
                data-testid="button-services-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
                disabled={page === pages - 1}
                className={`h-10 w-10 rounded-xl border ${border} flex items-center justify-center ${titleColor} hover:bg-[#0F9B6E] hover:text-white hover:border-[#0F9B6E] transition-all disabled:opacity-30`}
                data-testid="button-services-next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((s, i) => (
            <div key={`${page}-${i}`} className={`rounded-2xl ${cardBg} border ${border} overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}>
              {s.imageUrl ? (
                <img src={s.imageUrl} alt={s.name} className="w-full h-44 object-cover" />
              ) : (
                <div className="w-full h-1.5 bg-[#0F9B6E]" />
              )}
              <div className="p-6">
                {numStyle && !s.imageUrl ? (
                  <p className={`text-3xl font-black ${accentColor} mb-3`}>0{(page * ipp) + i + 1}</p>
                ) : !s.imageUrl ? (
                  <div className="h-9 w-9 rounded-xl bg-[#0F9B6E]/10 flex items-center justify-center mb-4">
                    <span className="text-[#0F9B6E] font-bold text-lg">✦</span>
                  </div>
                ) : null}
                <h3
                  className={`font-bold ${titleColor} mb-2`}
                  style={serif ? { fontFamily: "'Playfair Display', Georgia, serif" } : { fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}
                >{s.name}</h3>
                <p className={`${textColor} text-sm leading-relaxed`}>{s.description}</p>
              </div>
            </div>
          ))}
        </div>
        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-2 rounded-full transition-all ${i === page ? "w-8 bg-[#0F9B6E]" : "w-2 bg-gray-300"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── NEW: Doctors carousel ────────────────────────────── */

export function DoctorsCarousel({ clinic, sectionId, titleLabel, title, bg, cardBg, border, titleColor, accentColor, serif }: {
  clinic: ThemeClinic;
  sectionId: string;
  titleLabel?: string;
  title: string;
  bg: string;
  cardBg: string;
  border: string;
  titleColor: string;
  accentColor: string;
  serif?: boolean;
}) {
  const doctors =
    clinic.doctors && Array.isArray(clinic.doctors) && clinic.doctors.length > 0
      ? clinic.doctors
      : clinic.doctorName
      ? [{ name: clinic.doctorName, specialization: clinic.doctorSpecialization ?? "", degree: clinic.doctorDegree ?? "", imageUrl: null }]
      : null;

  const [page, setPage] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [exitDir, setExitDir] = useState<'left' | 'right'>('left');
  const [paused, setPaused] = useState(false);
  const pendingPage = useRef<number | null>(null);

  const ipp = 4;
  const pages = doctors ? Math.ceil(doctors.length / ipp) : 0;
  const visible = doctors ? doctors.slice(page * ipp, (page + 1) * ipp) : [];
  const multiPage = pages > 1;

  const changePage = (next: number, dir: 'left' | 'right' = 'left') => {
    if (exiting) return;
    setExitDir(dir);
    setExiting(true);
    pendingPage.current = next;
  };

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => {
      if (pendingPage.current !== null) setPage(pendingPage.current);
      setExiting(false);
      pendingPage.current = null;
    }, 280);
    return () => clearTimeout(t);
  }, [exiting]);

  useEffect(() => {
    if (!multiPage || paused) return;
    const id = setInterval(() => {
      setPage(p => {
        const next = (p + 1) % pages;
        setExitDir('left');
        setExiting(true);
        pendingPage.current = next;
        return p;
      });
    }, 3500);
    return () => clearInterval(id);
  }, [multiPage, pages, paused]);

  if (!doctors) return null;

  const count = visible.length;
  const containerCls = count === 1
    ? "flex justify-center"
    : count <= 3
    ? "flex justify-center flex-wrap gap-5"
    : "grid grid-cols-2 lg:grid-cols-4 gap-5";
  const cardWidthCls = count <= 3 ? "w-full sm:w-64" : "";

  const slideCls = exiting
    ? exitDir === 'left'
      ? "opacity-0 -translate-x-6"
      : "opacity-0 translate-x-6"
    : "opacity-100 translate-x-0";

  return (
    <section id={sectionId} className={`px-6 py-20 ${bg}`}>
      <div
        className="max-w-6xl mx-auto"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="flex items-end justify-between mb-12">
          <div className="flex-1 text-center">
            {titleLabel && (
              <p className={`text-sm font-bold uppercase tracking-widest ${accentColor} mb-2`}>{titleLabel}</p>
            )}
            <h2
              className={`text-4xl font-bold ${titleColor}`}
              style={serif
                ? { fontFamily: "'Playfair Display', Georgia, serif" }
                : { fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em", fontWeight: 900 }}
            >
              {title}
            </h2>
          </div>
          {multiPage && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => changePage((page - 1 + pages) % pages, 'right')}
                className={`h-10 w-10 rounded-xl border ${border} flex items-center justify-center ${titleColor} hover:bg-[#0F9B6E] hover:text-white hover:border-[#0F9B6E] transition-all`}
                data-testid="button-doctors-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => changePage((page + 1) % pages, 'left')}
                className={`h-10 w-10 rounded-xl border ${border} flex items-center justify-center ${titleColor} hover:bg-[#0F9B6E] hover:text-white hover:border-[#0F9B6E] transition-all`}
                data-testid="button-doctors-next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className={`${containerCls} transition-all duration-300 ease-in-out ${slideCls}`}>
          {visible.map((doc, i) => (
            <div key={`${page}-${i}`} className={`${cardBg} rounded-2xl border ${border} overflow-hidden text-center hover:-translate-y-1 hover:shadow-lg transition-all ${cardWidthCls}`}>
              <div className="h-52 overflow-hidden">
                {doc.imageUrl ? (
                  <img src={doc.imageUrl} alt={doc.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <DoctorAvatarPlaceholder />
                )}
              </div>
              <div className="p-4">
                <h3
                  className={`font-bold ${titleColor} mb-1 text-sm`}
                  style={serif ? { fontFamily: "'Playfair Display', Georgia, serif" } : { fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}
                >{doc.name}</h3>
                <p className="text-[#0F9B6E] text-xs font-semibold mb-2">{doc.specialization}</p>
                {doc.degree && (
                  <span className={`text-xs px-2 py-1 rounded-full ${cardBg} border ${border} text-gray-500`}>
                    {doc.degree}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {multiPage && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                onClick={() => changePage(i, i > page ? 'left' : 'right')}
                className={`h-2 rounded-full transition-all duration-300 ${i === page ? "w-8 bg-[#0F9B6E]" : "w-2 bg-gray-300 hover:bg-gray-400"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── NEW: Gallery carousel ────────────────────────────── */

export function GallerySection({ gallery, bg, titleColor, serif }: {
  gallery: { url: string; caption?: string }[];
  bg: string;
  titleColor: string;
  serif?: boolean;
}) {
  const [page, setPage] = useState(0);
  const ipp = 3;
  const pages = Math.ceil(gallery.length / ipp);
  const visible = gallery.slice(page * ipp, (page + 1) * ipp);

  return (
    <section className={`px-6 py-20 ${bg}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <h2
          className={`text-3xl font-bold ${titleColor}`}
          style={serif ? { fontFamily: "'Playfair Display', Georgia, serif" } : { fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}
        >Our Clinic</h2>
          {pages > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-9 w-9 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center text-white hover:bg-white/25 transition-all disabled:opacity-30"
                data-testid="button-gallery-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
                disabled={page === pages - 1}
                className="h-9 w-9 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center text-white hover:bg-white/25 transition-all disabled:opacity-30"
                data-testid="button-gallery-next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {visible.map((img, i) => (
            <div key={`${page}-${i}`} className="rounded-2xl overflow-hidden aspect-video shadow-md">
              <img
                src={img.url}
                alt={img.caption || `Gallery ${(page * ipp) + i + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-2 rounded-full transition-all ${i === page ? "w-8 bg-[#0F9B6E]" : "w-2 bg-white/30"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── NEW: Rich multi-column footer ───────────────────── */

export function RichFooter({ clinic, cfg, bookingHref, darkBg, accentSuffix, serif }: {
  clinic: ThemeClinic;
  cfg: ClinicWebsiteConfig;
  bookingHref: string;
  darkBg: string;
  accentSuffix: string;
  serif?: boolean;
}) {
  const about = cfg.aboutDescription
    ? cfg.aboutDescription.slice(0, 120) + (cfg.aboutDescription.length > 120 ? "…" : "")
    : `${clinic.name} — providing quality dental care with a patient-first approach.`;

  return (
    <footer className={`${darkBg} text-white`}>
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 pb-12 border-b border-white/10">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              {clinic.logoUrl ? (
                <img src={clinic.logoUrl} alt={clinic.name} className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-[#0F9B6E] flex items-center justify-center font-bold text-lg">
                  {clinic.name.charAt(0)}
                </div>
              )}
              <span
                className="font-bold text-lg text-white"
                style={serif ? { fontFamily: "'Playfair Display', Georgia, serif" } : { fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}
              >{clinic.name}</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-5">{about}</p>
            <SocialLinks links={cfg.socialLinks} light />
          </div>

          {/* Quick links column */}
          <div>
            <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-5">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { label: "About Us", href: `#theme-about${accentSuffix}` },
                { label: "Our Services", href: `#theme-services${accentSuffix}` },
                { label: "Our Doctors", href: `#theme-doctors${accentSuffix}` },
                { label: "Contact", href: `#theme-contact${accentSuffix}` },
              ].map(l => (
                <li key={l.label}>
                  <a href={l.href} className="text-white/50 hover:text-[#0F9B6E] text-sm transition-colors flex items-center gap-2">
                    <span className="text-[#0F9B6E]">›</span>{l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href={bookingHref}>
                  <span className="text-[#0F9B6E] font-semibold text-sm hover:underline cursor-pointer flex items-center gap-2">
                    <span>›</span>Book Appointment
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact column */}
          <div>
            <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-5">Contact Us</h4>
            <div className="space-y-3">
              {clinic.address && (
                <div className="flex items-start gap-3 text-white/50 text-sm">
                  <MapPin className="h-4 w-4 text-[#0F9B6E] shrink-0 mt-0.5" />
                  <span>{clinic.address}{clinic.city ? `, ${clinic.city}` : ""}</span>
                </div>
              )}
              {clinic.phone && (
                <a href={`tel:${clinic.phone}`} className="flex items-center gap-3 text-white/50 text-sm hover:text-white transition-colors">
                  <Phone className="h-4 w-4 text-[#0F9B6E] shrink-0" />
                  {clinic.phone}
                </a>
              )}
              {clinic.email && (
                <div className="flex items-center gap-3 text-white/50 text-sm">
                  <Mail className="h-4 w-4 text-[#0F9B6E] shrink-0" />
                  {clinic.email}
                </div>
              )}
              {clinic.website && (
                <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/50 text-sm hover:text-white transition-colors">
                  <Globe className="h-4 w-4 text-[#0F9B6E] shrink-0" />
                  {clinic.website}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} {clinic.name}{clinic.city ? ` · ${clinic.city}` : ""}
          </p>
          <p className="text-white/30 text-xs">
            Powered by{" "}
            <span className="text-[#0F9B6E] font-semibold">bookMySlot</span>
            {" "}· Dental Booking Platform
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── TestimonialsCarousel ─────────────────────────────── */

export function TestimonialsCarousel({
  testimonials, bg, heading, eyebrow, headingColor, quoteColor,
  textColor, nameColor, dividerColor, avatarBg, dotActive, dotInactive, serif,
}: {
  testimonials: NonNullable<ClinicWebsiteConfig["testimonials"]>;
  bg: string;
  heading: string;
  eyebrow?: string;
  headingColor: string;
  quoteColor: string;
  textColor: string;
  nameColor: string;
  dividerColor: string;
  avatarBg: string;
  dotActive: string;
  dotInactive: string;
  serif?: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  const goTo = (idx: number) => {
    setVisible(false);
    setTimeout(() => { setCurrent(idx); setVisible(true); }, 220);
  };

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const id = setInterval(() => goTo((current + 1) % testimonials.length), 5500);
    return () => clearInterval(id);
  }, [current, testimonials.length]);

  const t = testimonials[current];
  const initials = (t.patientName?.trim()[0] ?? "P").toUpperCase();

  return (
    <section className={`px-6 py-20 ${bg}`}>
      <div className="max-w-2xl mx-auto text-center">
        {eyebrow && (
          <p className={`text-sm font-bold uppercase tracking-widest ${quoteColor} mb-2`}>{eyebrow}</p>
        )}
        <h2
          className={`text-3xl font-bold ${headingColor} mb-14`}
          style={serif
            ? { fontFamily: "'Playfair Display', Georgia, serif" }
            : { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 900, letterSpacing: "-0.02em" }}
        >
          {heading}
        </h2>

        <div className={`transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
          {/* Initials avatar */}
          <div className={`w-16 h-16 rounded-full ${avatarBg} flex items-center justify-center mx-auto mb-5 shadow-md`}>
            <span className="text-white text-xl font-bold select-none">{initials}</span>
          </div>

          {/* Decorative open-quote */}
          <div className={`text-6xl font-serif leading-none ${quoteColor} mb-3 select-none`} aria-hidden="true">"</div>

          {/* Review text */}
          <p className={`text-base sm:text-lg leading-relaxed ${textColor} mb-8`}>{t.quote}</p>

          {/* Divider + name */}
          <div className={`w-10 h-0.5 ${dividerColor} mx-auto mb-4 rounded-full`} />
          <p className={`font-bold ${nameColor}`}>{t.patientName}</p>
        </div>

        {/* Dot navigation */}
        {testimonials.length > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Review ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${i === current ? `w-5 h-2 ${dotActive}` : `w-2 h-2 ${dotInactive}`}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   THEME 1 — CLASSIC
   Playfair serif headings · deep forest green · elegant cards
══════════════════════════════════════════════════════════ */
export function ThemeClassic({ clinic, cfg, bookingHref, isOwner = false }: ThemeProps) {
  const services = cfg.services?.length ? cfg.services : DEFAULT_SERVICES;
  const hours = cfg.hours?.length ? cfg.hours : DEFAULT_HOURS;
  const testimonials = cfg.testimonials;
  const gallery = cfg.gallery?.filter(g => g.url);
  const features = cfg.features?.length ? cfg.features : DEFAULT_FEATURES;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F8F6] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DCE9E3]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {clinic.logoUrl && <img src={clinic.logoUrl} alt={clinic.name} className="h-9 w-auto max-w-[120px] object-contain shrink-0" />}
            <span className="text-[#0A3D2E] font-bold text-lg truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{clinic.name}</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <a href="#theme-about" className="hover:text-[#0A3D2E] transition-colors">About</a>
            <a href="#theme-services" className="hover:text-[#0A3D2E] transition-colors">Services</a>
            <a href="#theme-doctors" className="hover:text-[#0A3D2E] transition-colors">Doctors</a>
            <a href="#theme-contact" className="hover:text-[#0A3D2E] transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={bookingHref}>
              <button className="bg-[#0F9B6E] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#085041] transition-colors shadow-sm" data-testid="button-theme-book">
                Book Now
              </button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(m => !m)}
              className="sm:hidden p-2 rounded-lg text-[#0A3D2E] hover:bg-[#F4F8F6] transition-colors"
              data-testid="button-mobile-menu-classic"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-[#DCE9E3] bg-white/95 backdrop-blur-md">
            <div className="px-6 py-2 flex flex-col">
              {[
                { label: "About", href: "#theme-about" },
                { label: "Services", href: "#theme-services" },
                { label: "Doctors", href: "#theme-doctors" },
                { label: "Contact", href: "#theme-contact" },
              ].map(l => (
                <a key={l.label} href={l.href} onClick={() => setMobileMenuOpen(false)} className="py-3 text-sm font-medium text-gray-700 hover:text-[#0A3D2E] border-b border-[#DCE9E3] last:border-0 transition-colors">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="bg-[#0A3D2E] text-white px-6 py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#1A9E75] blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#6DCFAC] blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-3" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                {cfg.taglineL1 || "Your Smile,"}<br />
                <span className="text-[#6DCFAC]">{cfg.taglineL2 || "Our Passion."}</span>
              </h1>
              {(clinic.name || clinic.city) && (
                <p className="text-white/50 text-sm font-medium tracking-wide mb-6">
                  {[clinic.name, clinic.city].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="text-white/80 text-lg max-w-md mb-8 leading-relaxed">
                {cfg.heroDescription || `At ${clinic.name}, we combine modern dentistry with compassionate care to give you the smile you deserve.`}
              </p>
              <Link href={bookingHref}>
                <button className="bg-[#0F9B6E] text-white px-8 py-3.5 rounded-full font-semibold text-base hover:bg-[#1A9E75] transition-all hover:-translate-y-0.5 shadow-lg shadow-black/20" data-testid="button-theme-hero-book">
                  Book Your Appointment Now
                </button>
              </Link>
            </div>
            <div className="hidden lg:block">
              <img
                src={cfg.heroImageUrl || defaultHeroImg}
                alt="Clinic"
                className="rounded-2xl w-full h-[420px] object-cover shadow-2xl ring-1 ring-white/10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="theme-about" className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0A3D2E] mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>About Our Clinic</h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
              {cfg.aboutDescription || `${clinic.name} is dedicated to delivering exceptional dental care with a patient-first approach, modern technology, and a warm, welcoming environment.`}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-8 rounded-2xl border border-[#DCE9E3] hover:border-[#0F9B6E]/30 hover:-translate-y-1 transition-all">
              <h3 className="text-xl font-bold text-[#0A3D2E] mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Our Vision</h3>
              <p className="text-gray-600 leading-relaxed">{cfg.vision || "Exceptional dental care delivered with precision, compassion, and modern technology — making every visit comfortable and every smile radiant."}</p>
            </div>
            <div className="p-8 rounded-2xl border border-[#DCE9E3] hover:border-[#0F9B6E]/30 hover:-translate-y-1 transition-all">
              <h3 className="text-xl font-bold text-[#0A3D2E] mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Our Values</h3>
              <p className="text-gray-600 leading-relaxed">{cfg.values || "Patient-first approach · Pain-free dentistry · Transparency in treatment · Continuous clinical excellence."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <WhyChooseUs
        features={features}
        imageUrl={cfg.featuresImageUrl || cfg.heroImageUrl}
        bg="bg-[#F4F8F6]"
        cardBg="bg-white"
        border="border-[#DCE9E3]"
        titleColor="text-[#0A3D2E]"
        accentColor="text-[#0F9B6E]"
        serif
        isOwner={isOwner}
      />

      {/* Stats bar */}
      <StatsBar
        stats={cfg.stats?.length ? cfg.stats : DEFAULT_STATS}
        bg="bg-[#0A3D2E]"
        numColor="text-white"
        labelColor="text-white/70"
      />

      {/* Services carousel */}
      <ServicesCarousel
        services={services}
        sectionId="theme-services"
        title="Our Services"
        bg="bg-white"
        cardBg="bg-[#F4F8F6]"
        border="border-[#DCE9E3]"
        titleColor="text-[#0A3D2E]"
        accentColor="text-[#0F9B6E]"
        textColor="text-gray-600"
        serif
      />

      {/* Doctors carousel */}
      <DoctorsCarousel
        clinic={clinic}
        sectionId="theme-doctors"
        title="Our Team of Experts"
        bg="bg-[#F4F8F6]"
        cardBg="bg-white"
        border="border-[#DCE9E3]"
        titleColor="text-[#0A3D2E]"
        accentColor="text-[#0F9B6E]"
        serif
      />

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <TestimonialsCarousel
          testimonials={testimonials}
          bg="bg-white"
          heading="What Our Patients Say"
          headingColor="text-[#0A3D2E]"
          quoteColor="text-[#0F9B6E]"
          textColor="text-gray-600"
          nameColor="text-[#0A3D2E]"
          dividerColor="bg-[#0F9B6E]"
          avatarBg="bg-[#0F9B6E]"
          dotActive="bg-[#0F9B6E]"
          dotInactive="bg-[#DCE9E3]"
          serif
        />
      )}

      {/* Gallery carousel */}
      {gallery && gallery.length > 0 && (
        <GallerySection
          gallery={gallery}
          bg="bg-[#0A3D2E]"
          titleColor="text-white"
          serif
        />
      )}

      {/* Hours + Map */}
      <section className="px-6 py-20 bg-[#F4F8F6]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-3xl font-bold text-[#0A3D2E] mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                <Clock className="inline h-6 w-6 mr-2 mb-1" />Clinic Hours
              </h2>
              <div className="space-y-3">
                {hours.map((h, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b border-[#DCE9E3]">
                    <span className="font-semibold text-gray-700">{h.day}</span>
                    <span className={`text-sm font-medium ${h.closed ? "text-red-500" : "text-[#0F9B6E]"}`}>
                      {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <MapSection clinic={clinic} cfg={cfg} />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="theme-contact" className="px-6 py-20 bg-[#0A3D2E] text-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Visit Us</h2>
          <div className="flex flex-wrap justify-center gap-8 text-white/80 mb-8">
            {clinic.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{clinic.address}{clinic.city ? `, ${clinic.city}` : ""}</div>}
            {clinic.phone && <a href={`tel:${clinic.phone}`} className="flex items-center gap-2 hover:text-white transition-colors"><Phone className="h-4 w-4" />{clinic.phone}</a>}
            {clinic.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4" />{clinic.email}</div>}
            {clinic.website && <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors"><Globe className="h-4 w-4" />{clinic.website}</a>}
          </div>
          <Link href={bookingHref}>
            <button className="bg-[#0F9B6E] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#1A9E75] transition-all hover:-translate-y-1 shadow-xl shadow-black/30">
              Book an Appointment
            </button>
          </Link>
        </div>
      </section>

      <RichFooter clinic={clinic} cfg={cfg} bookingHref={bookingHref} darkBg="bg-[#08281f]" accentSuffix="" serif />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   THEME 2 — WARM
   Background photo hero · warm tones · family clinic feel
══════════════════════════════════════════════════════════ */
export function ThemeWarm({ clinic, cfg, bookingHref, isOwner = false }: ThemeProps) {
  const services = cfg.services?.length ? cfg.services : DEFAULT_SERVICES;
  const hours = cfg.hours?.length ? cfg.hours : DEFAULT_HOURS;
  const testimonials = cfg.testimonials;
  const gallery = cfg.gallery?.filter(g => g.url);
  const features = cfg.features?.length ? cfg.features : DEFAULT_FEATURES;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {clinic.logoUrl && <img src={clinic.logoUrl} alt={clinic.name} className="h-9 w-auto max-w-[120px] object-contain shrink-0" />}
            <span className="text-[#1E3A2F] font-bold text-xl truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{clinic.name}</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <a href="#theme-about-w" className="hover:text-[#1E3A2F] transition-colors">About</a>
            <a href="#theme-services-w" className="hover:text-[#1E3A2F] transition-colors">Services</a>
            <a href="#theme-doctors-w" className="hover:text-[#1E3A2F] transition-colors">Team</a>
            <a href="#theme-contact-w" className="hover:text-[#1E3A2F] transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={bookingHref}>
              <button className="bg-[#0F9B6E] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#085041] transition-colors shadow-sm" data-testid="button-theme-warm-book">
                Book Now
              </button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(m => !m)}
              className="sm:hidden p-2 rounded-lg text-[#1E3A2F] hover:bg-[#F8EDE3] transition-colors"
              data-testid="button-mobile-menu-warm"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white">
            <div className="px-6 py-2 flex flex-col">
              {[
                { label: "About", href: "#theme-about-w" },
                { label: "Services", href: "#theme-services-w" },
                { label: "Team", href: "#theme-doctors-w" },
                { label: "Contact", href: "#theme-contact-w" },
              ].map(l => (
                <a key={l.label} href={l.href} onClick={() => setMobileMenuOpen(false)} className="py-3 text-sm font-medium text-gray-700 hover:text-[#1E3A2F] border-b border-gray-100 last:border-0 transition-colors">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero — split layout, warm cream background */}
      <section className="bg-[#FDF6EE] px-6 py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#0F9B6E]/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-amber-100/80 blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-3 text-[#1E3A2F]"
                style={{ fontFamily: "'Bricolage Grotesque', 'Inter', system-ui, sans-serif" }}
              >
                {cfg.taglineL1 || "Caring for Your Smile"}<br />
                <span className="text-[#0F9B6E]">{cfg.taglineL2 || "Like Family"}</span>
              </h1>
              {(clinic.name || clinic.city) && (
                <p className="text-[#1E3A2F]/50 text-sm font-medium tracking-wide mb-6">
                  {[clinic.name, clinic.city].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="text-gray-600 text-lg max-w-md mb-8 leading-relaxed">
                {cfg.heroDescription || `Welcome to ${clinic.name} — where every patient is treated with the warmth of family and the expertise of modern dentistry.`}
              </p>
              <Link href={bookingHref}>
                <button className="bg-[#0F9B6E] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#1A9E75] transition-all hover:-translate-y-1 shadow-lg shadow-[#0F9B6E]/20">
                  Book Appointment Online
                </button>
              </Link>
            </div>
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-full max-w-lg">
                <div className="absolute inset-0 rounded-3xl bg-amber-200/50 translate-x-4 translate-y-4" />
                <img
                  src={cfg.heroImageUrl || defaultHeroImg}
                  alt="Clinic"
                  className="relative rounded-3xl w-full h-[420px] object-cover shadow-xl rotate-1"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About — story with image */}
      <section id="theme-about-w" className="px-6 py-24 bg-[#F8EDE3]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#0F9B6E] font-bold text-sm uppercase tracking-widest mb-3">Our Story</p>
              <h2 className="text-4xl font-bold text-[#1E3A2F] mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                About {clinic.name}
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {cfg.aboutDescription || `At ${clinic.name}, we believe great dental care is about more than just teeth — it's about building trust, easing anxiety, and creating lasting relationships with every patient we serve.`}
              </p>
              {(cfg.vision || cfg.values) && (
                <div className="space-y-4">
                  {cfg.vision && (
                    <div className="flex gap-3">
                      <div className="h-6 w-1 bg-[#0F9B6E] rounded-full shrink-0 mt-1" />
                      <p className="text-gray-700">{cfg.vision}</p>
                    </div>
                  )}
                  {cfg.values && (
                    <div className="flex gap-3">
                      <div className="h-6 w-1 bg-[#0F9B6E] rounded-full shrink-0 mt-1" />
                      <p className="text-gray-700">{cfg.values}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              {cfg.heroImageUrl ? (
                <img src={cfg.heroImageUrl} alt="Clinic" className="rounded-2xl w-full h-96 object-cover shadow-xl" />
              ) : (
                <ClinicPhotoPlaceholder cardBg="bg-[#1E3A2F]/10" border="border-[#1E3A2F]/20" height="h-96" isOwner={isOwner} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <WhyChooseUs
        features={features}
        imageUrl={cfg.featuresImageUrl || cfg.heroImageUrl}
        bg="bg-white"
        cardBg="bg-[#F8EDE3]"
        border="border-[#E8D5C4]"
        titleColor="text-[#1E3A2F]"
        accentColor="text-[#0F9B6E]"
        serif
        isOwner={isOwner}
      />

      {/* Stats bar */}
      <StatsBar
        stats={cfg.stats?.length ? cfg.stats : DEFAULT_STATS}
        bg="bg-[#1E3A2F]"
        numColor="text-white"
        labelColor="text-white/70"
      />

      {/* Services */}
      <ServicesCarousel
        services={services}
        sectionId="theme-services-w"
        title="What We Offer"
        bg="bg-white"
        cardBg="bg-white"
        border="border-gray-100"
        titleColor="text-[#1E3A2F]"
        accentColor="text-[#0F9B6E]"
        textColor="text-gray-600"
        serif
      />

      {/* Doctors */}
      <DoctorsCarousel
        clinic={clinic}
        sectionId="theme-doctors-w"
        title="Our Team of Experts"
        bg="bg-[#F8EDE3]"
        cardBg="bg-white"
        border="border-[#E8D5C4]"
        titleColor="text-[#1E3A2F]"
        accentColor="text-[#0F9B6E]"
        serif
      />

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <TestimonialsCarousel
          testimonials={testimonials}
          bg="bg-[#FAFAF8]"
          heading="Patient Stories"
          headingColor="text-[#1E3A2F]"
          quoteColor="text-[#0F9B6E]"
          textColor="text-gray-600"
          nameColor="text-[#1E3A2F]"
          dividerColor="bg-[#0F9B6E]"
          avatarBg="bg-[#0F9B6E]"
          dotActive="bg-[#0F9B6E]"
          dotInactive="bg-[#E8D5C4]"
          serif
        />
      )}

      {/* Gallery carousel */}
      {gallery && gallery.length > 0 && (
        <GallerySection
          gallery={gallery}
          bg="bg-[#1E3A2F]"
          titleColor="text-white"
          serif
        />
      )}

      {/* Hours + Map */}
      <section className="px-6 py-20 bg-[#F8EDE3]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-3xl font-bold text-[#1E3A2F] mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                <Clock className="inline h-6 w-6 mr-2 mb-1 text-[#0F9B6E]" />Clinic Hours
              </h2>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                {hours.map((h, i) => (
                  <div key={i} className={`flex justify-between items-center py-3 ${i < hours.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <span className="font-semibold text-gray-700">{h.day}</span>
                    <span className={`text-sm font-medium ${h.closed ? "text-red-500" : "text-[#0F9B6E]"}`}>
                      {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <MapSection clinic={clinic} cfg={cfg} />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="theme-contact-w" className="px-6 py-20 bg-[#1E3A2F] text-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{clinic.name}</h2>
              <p className="text-white/70 mb-8">{clinic.city}</p>
              <div className="space-y-4 text-white/80">
                {clinic.address && <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-[#0F9B6E] shrink-0" />{clinic.address}</div>}
                {clinic.phone && <a href={`tel:${clinic.phone}`} className="flex items-center gap-3 hover:text-white transition-colors"><Phone className="h-4 w-4 text-[#0F9B6E] shrink-0" />{clinic.phone}</a>}
                {clinic.email && <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-[#0F9B6E] shrink-0" />{clinic.email}</div>}
                {clinic.website && <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-white transition-colors"><ExternalLink className="h-4 w-4 text-[#0F9B6E] shrink-0" />{clinic.website}</a>}
              </div>
              <div className="mt-6"><SocialLinks links={cfg.socialLinks} light /></div>
            </div>
            <div className="text-center lg:text-right">
              <Link href={bookingHref}>
                <button className="bg-[#0F9B6E] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#1A9E75] transition-all hover:-translate-y-1 shadow-xl">
                  Book Your Appointment
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <RichFooter clinic={clinic} cfg={cfg} bookingHref={bookingHref} darkBg="bg-[#0D2B22]" accentSuffix="-w" serif />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   THEME 3 — MODERN
   Space Grotesk · dark hero · teal accent · bold typography
══════════════════════════════════════════════════════════ */
export function ThemeModern({ clinic, cfg, bookingHref, isOwner = false }: ThemeProps) {
  const services = cfg.services?.length ? cfg.services : DEFAULT_SERVICES;
  const hours = cfg.hours?.length ? cfg.hours : DEFAULT_HOURS;
  const testimonials = cfg.testimonials;
  const gallery = cfg.gallery?.filter(g => g.url);
  const features = cfg.features?.length ? cfg.features : DEFAULT_FEATURES;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {clinic.logoUrl && <img src={clinic.logoUrl} alt={clinic.name} className="h-9 w-auto max-w-[120px] object-contain shrink-0" />}
            <span className="text-[#0F172A] font-bold text-xl truncate" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>{clinic.name}</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <a href="#theme-about-m" className="hover:text-[#0F172A] transition-colors">About</a>
            <a href="#theme-services-m" className="hover:text-[#0F172A] transition-colors">Services</a>
            <a href="#theme-doctors-m" className="hover:text-[#0F172A] transition-colors">Team</a>
            <a href="#theme-contact-m" className="hover:text-[#0F172A] transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={bookingHref}>
              <button className="bg-[#0F9B6E] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#085041] transition-colors shadow-sm" data-testid="button-theme-modern-book">
                Book Now
              </button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(m => !m)}
              className="sm:hidden p-2 rounded-lg text-[#0F172A] hover:bg-gray-100 transition-colors"
              data-testid="button-mobile-menu-modern"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white">
            <div className="px-6 py-2 flex flex-col">
              {[
                { label: "About", href: "#theme-about-m" },
                { label: "Services", href: "#theme-services-m" },
                { label: "Team", href: "#theme-doctors-m" },
                { label: "Contact", href: "#theme-contact-m" },
              ].map(l => (
                <a key={l.label} href={l.href} onClick={() => setMobileMenuOpen(false)} className="py-3 text-sm font-medium text-gray-600 hover:text-[#0F172A] border-b border-gray-100 last:border-0 transition-colors">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero — dark split layout */}
      <section className="bg-[#0F172A] text-white px-6 py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-0 h-80 w-80 rounded-full bg-[#0F9B6E]/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-0 h-64 w-64 rounded-full bg-[#0F9B6E]/8 blur-2xl" />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1
                className="font-black leading-none mb-3 text-white"
                style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.03em", fontSize: "clamp(2.8rem, 5vw, 4.5rem)" }}
              >
                {cfg.taglineL1 || "Advanced Dental"}<br />
                <span className="text-[#0F9B6E]">{cfg.taglineL2 || "Care, Redefined."}</span>
              </h1>
              {(clinic.name || clinic.city) && (
                <p className="text-white/40 text-sm font-medium tracking-wide mb-8">
                  {[clinic.name, clinic.city].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="text-white/70 text-lg max-w-md mb-10 leading-relaxed">
                {cfg.heroDescription || `${clinic.name} offers cutting-edge dental treatments in a modern, comfortable environment. Precision, technology, and care — all in one place.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href={bookingHref}>
                  <button className="bg-[#0F9B6E] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#1A9E75] transition-all hover:-translate-y-1 shadow-lg shadow-[#0F9B6E]/25">
                    Book Your Visit
                  </button>
                </Link>
                <a href="#theme-about-m">
                  <button className="border border-white/20 text-white px-10 py-4 rounded-full font-semibold text-lg hover:bg-white/10 transition-all">
                    Learn More
                  </button>
                </a>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-[#0F9B6E]/30 via-[#0F9B6E]/10 to-transparent blur-lg" />
                <img
                  src={cfg.heroImageUrl || defaultHeroImg}
                  alt="Clinic"
                  className="relative rounded-2xl w-full h-[420px] object-cover ring-1 ring-[#0F9B6E]/30 shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="theme-about-m" className="px-6 py-24 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-[#0F9B6E] font-bold text-sm uppercase tracking-widest">About Us</span>
              <h2 className="text-4xl font-black text-[#0F172A] mt-3 mb-6" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
                {clinic.name}
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">
                {cfg.aboutDescription || `${clinic.name} is a modern dental practice built around patient comfort and clinical excellence. We use the latest technology to deliver precise, pain-free treatments.`}
              </p>
              <div className="grid grid-cols-1 gap-4">
                {cfg.vision && (
                  <div className="flex gap-4 p-5 rounded-2xl bg-[#F8FAFC] border border-gray-100">
                    <div className="h-10 w-10 rounded-xl bg-[#0F9B6E]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#0F9B6E] font-bold text-lg">✦</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{cfg.vision}</p>
                  </div>
                )}
                {cfg.values && (
                  <div className="flex gap-4 p-5 rounded-2xl bg-[#F8FAFC] border border-gray-100">
                    <div className="h-10 w-10 rounded-xl bg-[#0F9B6E]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#0F9B6E] font-bold text-lg">✧</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{cfg.values}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {gallery && gallery.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {gallery.slice(0, 4).map((img, i) => (
                    <img key={i} src={img.url} alt={img.caption || ""} className="rounded-2xl w-full h-40 object-cover" />
                  ))}
                </div>
              ) : (
                <ClinicPhotoPlaceholder cardBg="bg-[#0F172A]/5" border="border-[#0F172A]/10" height="h-80" isOwner={isOwner} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <WhyChooseUs
        features={features}
        imageUrl={cfg.featuresImageUrl || cfg.heroImageUrl}
        bg="bg-[#F8FAFC]"
        cardBg="bg-white"
        border="border-gray-100"
        titleColor="text-[#0F172A]"
        accentColor="text-[#0F9B6E]"
        isOwner={isOwner}
      />

      {/* Stats bar */}
      <StatsBar
        stats={cfg.stats?.length ? cfg.stats : DEFAULT_STATS}
        bg="bg-[#0F172A]"
        numColor="text-white"
        labelColor="text-white/60"
      />

      {/* Services */}
      <ServicesCarousel
        services={services}
        sectionId="theme-services-m"
        titleLabel="What We Do"
        title="Our Services"
        bg="bg-[#F8FAFC]"
        cardBg="bg-white"
        border="border-gray-100"
        titleColor="text-[#0F172A]"
        accentColor="text-[#0F9B6E]"
        textColor="text-gray-500"
        numStyle
      />

      {/* Doctors */}
      <DoctorsCarousel
        clinic={clinic}
        sectionId="theme-doctors-m"
        titleLabel="Our Experts"
        title="Our Team of Experts"
        bg="bg-white"
        cardBg="bg-[#F8FAFC]"
        border="border-gray-100"
        titleColor="text-[#0F172A]"
        accentColor="text-[#0F9B6E]"
      />

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <TestimonialsCarousel
          testimonials={testimonials}
          bg="bg-[#0F172A]"
          heading="What They Say"
          eyebrow="Patient Reviews"
          headingColor="text-white"
          quoteColor="text-[#0F9B6E]"
          textColor="text-white/75"
          nameColor="text-white"
          dividerColor="bg-[#0F9B6E]"
          avatarBg="bg-[#0F9B6E]"
          dotActive="bg-[#0F9B6E]"
          dotInactive="bg-white/20"
        />
      )}

      {/* Gallery carousel */}
      {gallery && gallery.length > 0 && (
        <GallerySection
          gallery={gallery}
          bg="bg-[#0F172A]"
          titleColor="text-white"
        />
      )}

      {/* Hours + Map */}
      <section className="px-6 py-20 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <span className="text-[#0F9B6E] font-bold text-sm uppercase tracking-widest">Hours</span>
              <h2 className="text-3xl font-black text-[#0F172A] mt-2 mb-6" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
                When We're Open
              </h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {hours.map((h, i) => (
                  <div key={i} className={`flex justify-between items-center px-6 py-4 ${i < hours.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <span className="font-semibold text-gray-800">{h.day}</span>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${h.closed ? "bg-red-50 text-red-600" : "bg-[#0F9B6E]/10 text-[#0F9B6E]"}`}>
                      {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <MapSection clinic={clinic} cfg={cfg} />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="theme-contact-m" className="px-6 py-20 bg-[#0F172A] text-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-5xl font-black mb-6 text-white" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>{clinic.name}</h2>
          <div className="flex flex-wrap justify-center gap-8 text-white/60 mb-10">
            {clinic.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#0F9B6E]" />{clinic.address}{clinic.city ? `, ${clinic.city}` : ""}</div>}
            {clinic.phone && <a href={`tel:${clinic.phone}`} className="flex items-center gap-2 hover:text-white transition-colors"><Phone className="h-4 w-4 text-[#0F9B6E]" />{clinic.phone}</a>}
            {clinic.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#0F9B6E]" />{clinic.email}</div>}
          </div>
          <div className="flex justify-center mb-8"><SocialLinks links={cfg.socialLinks} light /></div>
          <Link href={bookingHref}>
            <button className="bg-[#0F9B6E] text-white px-12 py-4 rounded-full font-bold text-lg hover:bg-[#1A9E75] transition-all hover:-translate-y-1 shadow-lg shadow-[#0F9B6E]/25">
              Book Your Visit
            </button>
          </Link>
        </div>
      </section>

      <RichFooter clinic={clinic} cfg={cfg} bookingHref={bookingHref} darkBg="bg-[#080D14]" accentSuffix="-m" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   THEME 4 — RED CLINICAL
   Charcoal surfaces · vivid red accents · specialist-clinic energy
══════════════════════════════════════════════════════════ */

const RED_SPECIALTIES = [
  { title: "Microscope-Assisted Dentistry", description: "Precise, gentle treatment supported by advanced magnification." },
  { title: "Advanced Endodontics", description: "Specialist root canal care designed around comfort and long-term results." },
  { title: "Conservative Dentistry", description: "Preserving natural tooth structure with minimally invasive techniques." },
];

const RED_TREATMENT_GROUPS = [
  { name: "Pediatric Dentistry", description: "Gentle care for growing smiles.", items: ["Pulpotomy and crowns", "Fluoride therapy", "Child-friendly environment"] },
  { name: "Aesthetic & Conservative Dentistry", description: "Natural-looking results with thoughtful planning.", items: ["Composite bonding", "Ceramic veneers", "Smile designing"] },
  { name: "General Dentistry", description: "Reliable care for everyday oral health.", items: ["Tooth-coloured fillings", "Scaling and polishing", "Preventive check-ups"] },
];

const RED_FAQ = [
  { question: "How often should I visit the dentist?", answer: "A dental check-up every six months helps maintain healthy teeth and gums." },
  { question: "What should I do in a dental emergency?", answer: "Call the clinic as soon as possible so the team can guide you to quick relief and expert care." },
  { question: "Is root canal treatment painful?", answer: "Treatment is performed under local anaesthesia and is designed to keep you comfortable." },
  { question: "Do you offer customised smile makeovers?", answer: "Yes. Smile plans can be tailored to your goals, facial features, and oral health." },
  { question: "How long does teeth whitening last?", answer: "Results vary, but good oral hygiene and proper care help maintain the improvement for longer." },
  { question: "How can I book an appointment?", answer: "Use the booking button to choose an available appointment time or contact the clinic directly." },
];

export function RedDoctorProfile({ clinic, titleColor }: { clinic: ThemeClinic; titleColor: string }) {
  const doctor = clinic.doctors?.[0];
  if (!doctor) return null;

  return (
    <section className="px-6 py-20 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[300px_1fr] gap-10 items-center">
          <div className="rounded-3xl overflow-hidden bg-[#130506] aspect-[4/3]">
            {doctor.imageUrl ? (
              <img src={doctor.imageUrl} alt={doctor.name} className="w-full h-full object-cover object-top" />
            ) : (
              <DoctorAvatarPlaceholder />
            )}
          </div>
          <div>
            <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">About the specialist</p>
            <h2 className={`text-3xl sm:text-4xl font-black ${titleColor} mb-4`} style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.03em" }}>
              About {doctor.name}
            </h2>
            <p className="text-gray-600 leading-relaxed max-w-3xl">
              {doctor.bio || `${doctor.name} combines specialist knowledge, careful treatment planning, and a patient-first approach to make every visit feel clear and comfortable.`}
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {doctor.degree && <span className="px-3 py-1.5 rounded-full bg-red-50 text-[#B91C1C] text-xs font-bold">{doctor.degree}</span>}
              {doctor.specialization && <span className="px-3 py-1.5 rounded-full border border-red-200 text-[#B91C1C] text-xs font-bold">{doctor.specialization}</span>}
              {doctor.yearsOfExperience && <span className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 text-xs font-bold">{doctor.yearsOfExperience}+ years of experience</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RedTeamSection({ clinic, bookingHref }: { clinic: ThemeClinic; bookingHref: string }) {
  const doctors = clinic.doctors?.filter(doctor => doctor.name) ?? [];
  if (doctors.length <= 1) return null;

  return (
    <section id="red-doctors" className="px-6 py-20 bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">Our team</p>
          <h2 className="text-4xl sm:text-5xl font-black text-[#171717]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.04em" }}>Meet your dental specialists</h2>
          <p className="text-gray-600 mt-3 max-w-2xl mx-auto">A skilled, compassionate team working together to make your care clear and comfortable.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {doctors.map((doctor, index) => (
            <article key={`${doctor.name}-${index}`} className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
              <div className="h-28 w-28 mx-auto rounded-full overflow-hidden bg-[#130506] mb-5">
                {doctor.imageUrl ? <img src={doctor.imageUrl} alt={doctor.name} className="w-full h-full object-cover object-top" /> : <DoctorAvatarPlaceholder />}
              </div>
              <h3 className="text-lg font-bold text-[#171717]">{doctor.name}</h3>
              {doctor.specialization && <p className="text-[#D9090D] text-xs font-bold uppercase tracking-wider mt-2">{doctor.specialization}</p>}
              {doctor.degree && <p className="text-gray-500 text-xs mt-2">{doctor.degree}</p>}
              {doctor.yearsOfExperience && <p className="text-gray-500 text-xs mt-1">{doctor.yearsOfExperience}+ years of experience</p>}
              <Link href={bookingHref}><button className="mt-5 text-[#D9090D] text-sm font-bold hover:underline">Book with our team</button></Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RedSpecialtiesSection({ specialties }: { specialties: { title: string; description: string; icon?: string }[] }) {
  return (
    <section id="red-specialties" className="px-6 py-20 bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">Specialities</p>
          <h2 className="text-4xl sm:text-5xl font-black text-[#171717]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.04em" }}>Focused expertise for confident care</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {specialties.map((item, index) => (
            <article key={`${item.title}-${index}`} className="bg-white border border-gray-200 p-7 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all">
              <div className="h-11 w-11 rounded-xl bg-[#E11D24] text-white flex items-center justify-center mb-5">
                <Stethoscope className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-[#171717] mb-3">{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RedTreatmentGroups({ groups }: { groups: { name: string; description?: string; items: string[]; imageUrl?: string }[] }) {
  return (
    <section id="red-treatments" className="px-6 py-20 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">Our Treatments</p>
          <h2 className="text-4xl sm:text-5xl font-black text-[#171717]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.04em" }}>Care designed around you</h2>
          <p className="text-gray-600 mt-3">Explore specialist and everyday treatments delivered with precision.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {groups.map((group, index) => (
            <article key={`${group.name}-${index}`} className="relative overflow-hidden rounded-2xl bg-[#D9090D] text-white min-h-[265px] p-7 shadow-lg shadow-red-900/10">
              {group.imageUrl && <img src={group.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
              <div className="relative">
                <h3 className="text-xl font-bold mb-2">{group.name}</h3>
                {group.description && <p className="text-white/75 text-sm leading-relaxed mb-5">{group.description}</p>}
                <ul className="space-y-2.5">
                  {group.items.filter(Boolean).map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`} className="flex items-start gap-2 text-sm text-white/95">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RedSocialGallery({ posts }: { posts: { imageUrl: string; caption?: string; link?: string }[] }) {
  if (!posts.length) return null;
  return (
    <section className="px-6 py-20 bg-[#260708]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-red-300 text-sm font-bold uppercase tracking-[0.22em] mb-3">Follow our work</p>
            <h2 className="text-4xl font-black text-white" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.04em" }}>Inside the clinic</h2>
          </div>
          <Instagram className="h-8 w-8 text-red-300 shrink-0" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {posts.map((post, index) => {
            const content = (
              <div className="group relative aspect-square overflow-hidden rounded-2xl bg-white/10">
                <img src={post.imageUrl} alt={post.caption || `Clinic social post ${index + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {post.caption && <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent pt-10"><p className="text-white text-xs line-clamp-2">{post.caption}</p></div>}
              </div>
            );
            return post.link ? (
              <a key={index} href={post.link} target="_blank" rel="noopener noreferrer">{content}</a>
            ) : <div key={index}>{content}</div>;
          })}
        </div>
      </div>
    </section>
  );
}

export function RedReviews({ testimonials }: { testimonials: { quote: string; patientName: string; rating: number }[] }) {
  if (!testimonials.length) return null;
  return (
    <section className="px-6 py-20 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">Testimonials</p>
          <h2 className="text-4xl font-black text-[#171717]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.04em" }}>What people say</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((item, index) => (
            <article key={`${item.patientName}-${index}`} className="rounded-2xl bg-[#F7F7F7] border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="h-10 w-10 rounded-full bg-[#E11D24] text-white flex items-center justify-center font-bold">{item.patientName.trim().charAt(0).toUpperCase()}</div>
                <StarRating rating={item.rating} />
              </div>
              <Quote className="h-5 w-5 text-red-300 mb-2" />
              <p className="text-gray-700 leading-relaxed text-sm">“{item.quote}”</p>
              <p className="mt-5 text-sm font-bold text-[#171717]">{item.patientName}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RedFaqSection({ faq }: { faq: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (!faq.length) return null;
  return (
    <section id="red-faq" className="px-6 py-20 bg-[#FAFAFA]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">FAQ</p>
          <h2 className="text-4xl font-black text-[#171717]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.04em" }}>Frequently asked questions</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {faq.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={`${item.question}-${index}`} className="border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-semibold text-sm text-white bg-[#D9090D]"
                >
                  <span>{item.question}</span>
                  <HelpCircle className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && <p className="px-5 py-5 text-sm leading-relaxed text-gray-600">{item.answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RedWhatsApp({ phone }: { phone?: string | null }) {
  const digits = phone?.replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with the clinic on WhatsApp"
      className="hidden md:flex fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-[#25D366] text-white items-center justify-center shadow-xl shadow-black/20 hover:scale-105 transition-transform"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

function RedMobileActionBar({ phone, bookingHref }: { phone?: string | null; bookingHref: string }) {
  const digits = phone?.replace(/\D/g, "");
  const whatsappHref = digits && digits.length >= 8 ? `https://wa.me/${digits}` : null;
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-black/95 backdrop-blur border-t border-white/10 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto">
        {phone ? <a href={`tel:${phone}`} className="min-h-11 rounded-lg bg-white/10 text-white flex items-center justify-center gap-1.5 text-xs font-bold" aria-label={`Call ${phone}`}><Phone className="h-4 w-4" />Call</a> : <span className="min-h-11 rounded-lg bg-white/5 text-white/40 flex items-center justify-center text-xs font-bold">Call unavailable</span>}
        {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-lg bg-[#25D366] text-white flex items-center justify-center gap-1.5 text-xs font-bold" aria-label="Chat with the clinic on WhatsApp"><MessageCircle className="h-4 w-4" />WhatsApp</a> : <span className="min-h-11 rounded-lg bg-white/5 text-white/40 flex items-center justify-center text-xs font-bold">WhatsApp unavailable</span>}
        <Link href={bookingHref}><span className="min-h-11 rounded-lg bg-[#E11D24] text-white flex items-center justify-center gap-1.5 text-xs font-bold">Book</span></Link>
      </div>
    </div>
  );
}

export function ThemeRedClinical({ clinic, cfg, bookingHref }: ThemeProps) {
  const services = cfg.services?.length ? cfg.services : DEFAULT_SERVICES;
  const hours = cfg.hours?.length ? cfg.hours : DEFAULT_HOURS;
  const features = cfg.features?.length ? cfg.features : DEFAULT_FEATURES;
  const stats = cfg.stats?.length ? cfg.stats : DEFAULT_STATS;
  const trustPoints: NonNullable<ClinicWebsiteConfig["trustPoints"]> = cfg.trustPoints?.filter(point => point.title && point.description).length
    ? cfg.trustPoints!.filter(point => point.title && point.description)
    : features.slice(0, 4).map((feature, index) => ({
      title: feature.title,
      description: index === 0 ? "Care built around your comfort." : "Thoughtful treatment, every visit.",
    }));
  const specialties = cfg.specialties?.filter(item => item.title && item.description).length ? cfg.specialties!.filter(item => item.title && item.description) : RED_SPECIALTIES;
  const treatmentGroups = cfg.treatmentGroups?.filter(group => group.name && group.items.some(Boolean)).length ? cfg.treatmentGroups!.filter(group => group.name && group.items.some(Boolean)) : RED_TREATMENT_GROUPS;
  const faq = cfg.faq?.filter(item => item.question && item.answer).length ? cfg.faq!.filter(item => item.question && item.answer) : RED_FAQ;
  const testimonials = cfg.testimonials?.filter(item => item.quote && item.patientName) ?? [];
  const gallery = cfg.gallery?.filter(item => item.url) ?? [];
  const socialPosts = cfg.socialPosts?.filter(post => post.imageUrl) ?? [];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroImage = cfg.heroImageUrl || defaultHeroImg;
  const foregroundImage = cfg.heroForegroundImageUrl || clinic.doctors?.[0]?.imageUrl;

  return (
    <div className="min-h-screen bg-white text-[#171717] pb-16 md:pb-0" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="bg-[#D9090D] text-white text-xs">
        <div className="max-w-7xl mx-auto px-5 py-2 flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
          <span className="font-semibold">{cfg.announcementText || "Advanced care. Gentle touch. Confident smiles."}</span>
          <div className="flex items-center gap-4">
            {clinic.email && <a href={`mailto:${clinic.email}`} className="hover:text-white/80">{clinic.email}</a>}
            {clinic.phone && <a href={`tel:${clinic.phone}`} className="hover:text-white/80">{clinic.phone}</a>}
            <SocialLinks links={cfg.socialLinks} light />
          </div>
        </div>
      </div>

      <nav className="sticky top-0 z-40 bg-black text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-5">
          <a href="#" className="flex items-center gap-3 min-w-0">
            {clinic.logoUrl ? (
              <img src={clinic.logoUrl} alt={clinic.name} className="h-11 w-14 rounded-xl bg-white object-contain p-1 shrink-0" />
            ) : (
              <div className="h-11 w-14 rounded-xl bg-white text-[#D9090D] flex items-center justify-center font-black text-lg shrink-0">{clinic.name.charAt(0)}</div>
            )}
            <span className="font-bold truncate">{clinic.name}</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-sm text-white/75">
            <a href="#red-about" className="hover:text-white transition-colors">About Us</a>
            <a href="#red-doctors" className="hover:text-white transition-colors">Our Team</a>
            <a href="#red-specialties" className="hover:text-white transition-colors">Specialities</a>
            <a href="#red-treatments" className="hover:text-white transition-colors">Treatments</a>
            <a href="#red-faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="#red-contact" className="hover:text-white transition-colors">Contact Us</a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={bookingHref}>
              <button className="bg-[#E11D24] hover:bg-[#B91C1C] text-white px-5 py-2.5 rounded-full text-sm font-bold transition-colors">Book Now</button>
            </Link>
            <button type="button" onClick={() => setMobileMenuOpen(open => !open)} className="md:hidden p-2 rounded-lg hover:bg-white/10" aria-label="Toggle navigation menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 px-5 py-2">
            {[
              ["About Us", "#red-about"],
              ["Our Team", "#red-doctors"],
              ["Specialities", "#red-specialties"],
              ["Treatments", "#red-treatments"],
              ["FAQ", "#red-faq"],
              ["Contact Us", "#red-contact"],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="block py-3 text-sm text-white/80 border-b border-white/10 last:border-0">{label}</a>
            ))}
          </div>
        )}
      </nav>

      <section className="relative min-h-[620px] overflow-hidden bg-[#130506] text-white">
        <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
        <div className="absolute -right-40 top-1/2 -translate-y-1/2 h-[680px] w-[680px] rounded-full bg-[#D9090D]/80" />
        <div className="absolute right-0 bottom-0 h-[520px] w-[520px] rounded-full border-[70px] border-red-300/10" />
        <div className="max-w-7xl mx-auto px-5 py-24 relative grid lg:grid-cols-2 gap-12 items-center min-h-[620px]">
          <div className="max-w-xl">
            <p className="text-red-300 text-sm font-bold uppercase tracking-[0.24em] mb-5">{clinic.city || "Specialist dental care"}</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] mb-6" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.05em" }}>
              {cfg.taglineL1 || "Precision care"}<br />
              <span className="text-red-300">{cfg.taglineL2 || "for confident smiles"}</span>
            </h1>
            <p className="text-white/75 text-lg leading-relaxed max-w-lg mb-8">
              {cfg.heroDescription || `Trusted dental care from ${clinic.name}, combining specialist expertise, modern technology, and a calm patient experience.`}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={bookingHref}>
                <button className="bg-[#E11D24] hover:bg-[#B91C1C] text-white px-7 py-3.5 rounded-full font-bold transition-all hover:-translate-y-0.5">Book an Appointment</button>
              </Link>
              <a href="#red-about" className="border border-white/40 hover:bg-white/10 text-white px-7 py-3.5 rounded-full font-semibold transition-colors">Meet the clinic</a>
            </div>
          </div>
          <div className="relative hidden lg:flex justify-center items-center min-h-[420px]">
            <div className="relative h-[410px] w-[350px] rounded-[48%] overflow-hidden border-8 border-white/15 shadow-2xl">
              <img src={foregroundImage || heroImage} alt={foregroundImage ? "Dental specialist" : "Clinic"} className="w-full h-full object-cover object-top" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-8 px-5 border-b border-gray-100">
        <div className={`max-w-7xl mx-auto grid grid-cols-2 ${trustPoints.length > 4 ? "lg:grid-cols-6" : "lg:grid-cols-4"} gap-3`}>
          {trustPoints.slice(0, 6).map((point, index) => (
            <div key={`${point.title}-${index}`} className="flex items-start gap-3 p-4">
              <div className="h-10 w-10 rounded-full bg-red-50 text-[#D9090D] flex items-center justify-center shrink-0"><CheckCircle2 className="h-5 w-5" /></div>
              <div><p className="font-bold text-sm leading-snug">{point.title}</p><p className="text-xs text-gray-500 mt-1">{point.description}</p>{point.category && <span className="text-[10px] text-[#D9090D] font-bold uppercase tracking-wider">{point.category}</span>}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="red-about" className="px-5 py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <div className="rounded-3xl overflow-hidden aspect-[4/3] bg-[#130506]">
            <img src={cfg.aboutImageUrl || cfg.heroImageUrl || heroImage} alt={`Inside ${clinic.name}`} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">About us</p>
            <h2 className="text-4xl sm:text-5xl font-black text-[#171717] mb-6" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.04em" }}>Redefining dental care in {clinic.city || "your community"}</h2>
            <p className="text-gray-600 leading-relaxed text-lg mb-6">{cfg.aboutDescription || `${clinic.name} is committed to precise, compassionate dental care in a comfortable environment. We take time to understand your goals and explain every step clearly.`}</p>
            <div className="space-y-3">
              {[cfg.vision || "Compassionate and personalised treatment", cfg.values || "Modern technology with conservative, thoughtful care", "Clear guidance, strict safety protocols, and long-term support"].map((item, index) => (
                <div key={index} className="flex gap-3 items-start"><CheckCircle2 className="h-5 w-5 text-[#E11D24] shrink-0 mt-0.5" /><span className="text-gray-700">{item}</span></div>
              ))}
            </div>
            <Link href={bookingHref}><button className="mt-8 bg-[#E11D24] text-white px-6 py-3 rounded-full font-bold hover:bg-[#B91C1C] transition-colors">Talk to our team</button></Link>
          </div>
        </div>
      </section>

      <RedDoctorProfile clinic={clinic} titleColor="text-[#171717]" />
      <RedTeamSection clinic={clinic} bookingHref={bookingHref} />

      <section className="px-5 py-14 bg-[#130506] text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={`${stat.label}-${index}`} className="text-center"><p className="text-4xl font-black text-red-300">{stat.value}</p><p className="text-white/60 text-sm mt-2">{stat.label}</p></div>
          ))}
        </div>
      </section>

      <RedSpecialtiesSection specialties={specialties} />
      <RedTreatmentGroups groups={treatmentGroups} />

      <ServicesCarousel
        services={services}
        sectionId="red-service-cards"
        titleLabel="Treatments"
        title="Choose the right care for you"
        bg="bg-white"
        cardBg="bg-white"
        border="border-gray-200"
        titleColor="text-[#171717]"
        accentColor="text-[#E11D24]"
        textColor="text-gray-600"
        numStyle
      />

      {gallery.length > 0 && <GallerySection gallery={gallery} bg="bg-[#130506]" titleColor="text-white" />}
      <RedSocialGallery posts={socialPosts} />

      <section className="px-5 py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">Connect with us</p>
            <h2 className="text-4xl sm:text-5xl font-black text-[#171717] mb-5" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.04em" }}>Make your dental journey smooth and stress-free</h2>
            <p className="text-gray-600 leading-relaxed max-w-xl">Whether you need expert advice, want to schedule a visit, or have a question about treatment, our team is ready to help.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 items-stretch">
            <div className="rounded-3xl bg-[#D9090D] text-white p-6">
              <h3 className="text-xl font-bold mb-5">Opening hours</h3>
              <div className="space-y-3">
                {hours.map((hour, index) => <div key={index} className="flex justify-between gap-3 text-sm border-b border-white/20 pb-2 last:border-0"><span>{hour.day}</span><span className="font-semibold">{hour.closed ? "Closed" : `${hour.open} – ${hour.close}`}</span></div>)}
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden min-h-[240px] bg-[#130506]">
              <img src={cfg.featuresImageUrl || cfg.aboutImageUrl || heroImage} alt="Clinic interior" className="w-full h-full object-cover opacity-90" />
            </div>
          </div>
        </div>
      </section>

      <RedReviews testimonials={testimonials} />
      <RedFaqSection faq={faq} />

      <section id="red-contact" className="px-5 py-8 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 rounded-3xl overflow-hidden border border-gray-200">
          <div className="bg-[#D9090D] text-white p-9 sm:p-12">
            <p className="text-white/70 text-sm font-bold uppercase tracking-[0.22em] mb-3">Schedule a visit</p>
            <h2 className="text-3xl font-black mb-4">Ready for a healthier, more confident smile?</h2>
            <p className="text-white/80 leading-relaxed mb-7">Choose a convenient time and let our team take care of the rest.</p>
            <Link href={bookingHref}><button className="bg-white text-[#D9090D] px-6 py-3 rounded-full font-bold hover:bg-red-50 transition-colors">Schedule now</button></Link>
          </div>
          <div className="bg-[#F5F5F5] p-9 sm:p-12">
            <p className="text-[#E11D24] text-sm font-bold uppercase tracking-[0.22em] mb-3">Talk to us</p>
            <h2 className="text-3xl font-black mb-4">Questions before you book?</h2>
            <p className="text-gray-600 leading-relaxed mb-7">Reach out to {clinic.name} for clear guidance on your treatment options.</p>
            {clinic.phone ? <a href={`tel:${clinic.phone}`} className="inline-flex bg-[#E11D24] text-white px-6 py-3 rounded-full font-bold hover:bg-[#B91C1C] transition-colors">{clinic.phone}</a> : <Link href={bookingHref}><button className="bg-[#E11D24] text-white px-6 py-3 rounded-full font-bold">Contact us</button></Link>}
          </div>
        </div>
      </section>

      {cfg.showMap !== false && clinic.latitude && clinic.longitude && (
        <section className="px-5 pb-20 bg-white">
          <div className="max-w-7xl mx-auto">
            <MapSection clinic={clinic} cfg={cfg} />
          </div>
        </section>
      )}

      <RichFooter clinic={clinic} cfg={cfg} bookingHref={bookingHref} darkBg="bg-[#130506]" accentSuffix="-red" />
      <RedWhatsApp phone={clinic.phone} />
      <RedMobileActionBar phone={clinic.phone} bookingHref={bookingHref} />
    </div>
  );
}
