import { useState } from "react";
import { Link } from "wouter";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ClinicWebsiteConfig } from "@shared/schema";
import {
  Star, Phone, Mail, MapPin, Globe, Clock, Navigation,
  Instagram, Facebook, Youtube, ExternalLink,
  ChevronLeft, ChevronRight,
  Users2, ShieldCheck, Heart, Award, Activity, Zap, Stethoscope, CheckCircle2,
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
  doctors?: { name: string; specialization: string; degree: string; imageUrl?: string | null }[] | null;
  doctorName?: string | null;
  doctorSpecialization?: string | null;
  doctorDegree?: string | null;
};

interface ThemeProps {
  clinic: ThemeClinic;
  cfg: ClinicWebsiteConfig;
  bookingHref: string;
}

const DEFAULT_SERVICES = [
  { name: "Dental Check-ups & Cleaning", description: "Comprehensive oral examination and professional cleaning." },
  { name: "Root Canal Treatment", description: "Pain-free root canal therapy using modern techniques." },
  { name: "Dental Implants", description: "Permanent tooth replacement with titanium implants." },
  { name: "Teeth Whitening", description: "Professional whitening for a brighter, confident smile." },
  { name: "Cosmetic Dentistry", description: "Smile makeovers tailored to your aesthetic goals." },
  { name: "Pediatric Dentistry", description: "Gentle, child-friendly care from an early age." },
];

const DEFAULT_HOURS = [
  { day: "Mon – Fri", open: "9:00 AM", close: "7:00 PM", closed: false },
  { day: "Saturday", open: "9:00 AM", close: "4:00 PM", closed: false },
  { day: "Sunday", open: "", close: "", closed: true },
];

const DEFAULT_FEATURES = [
  { icon: "users", title: "Expert and Passionate Team" },
  { icon: "stethoscope", title: "Comprehensive Dental Care Services" },
  { icon: "heart", title: "Focus on Patient Comfort and Confidence" },
  { icon: "zap", title: "Advanced Technology and Continuous Learning" },
];

const STAT_ICONS = [Stethoscope, Users2, Award, Heart];

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

function StatsBar({ stats, bg, numColor, labelColor }: {
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

function WhyChooseUs({ features, imageUrl, bg, cardBg, border, titleColor, accentColor, serif }: {
  features: { icon: string; title: string }[];
  imageUrl?: string;
  bg: string;
  cardBg: string;
  border: string;
  titleColor: string;
  accentColor: string;
  serif?: boolean;
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
            <div className="grid grid-cols-2 gap-4">
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
              <div className={`rounded-2xl w-full h-[420px] ${cardBg} border-2 border-dashed ${border} flex items-center justify-center`}>
                <div className={`text-center ${titleColor} opacity-30`}>
                  <div className="text-6xl mb-3">🏥</div>
                  <p className="text-sm font-medium">Add a clinic photo in the website builder</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── NEW: Services carousel ───────────────────────────── */

function ServicesCarousel({ services, sectionId, titleLabel, title, bg, cardBg, border, titleColor, accentColor, textColor, serif, numStyle }: {
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

function DoctorsCarousel({ clinic, sectionId, titleLabel, title, bg, cardBg, border, titleColor, accentColor, serif }: {
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
  const ipp = 4;
  const pages = doctors ? Math.ceil(doctors.length / ipp) : 0;
  const visible = doctors ? doctors.slice(page * ipp, (page + 1) * ipp) : [];

  if (!doctors) return null;

  return (
    <section id={sectionId} className={`px-6 py-20 ${bg}`}>
      <div className="max-w-6xl mx-auto">
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
          {pages > 1 && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className={`h-10 w-10 rounded-xl border ${border} flex items-center justify-center ${titleColor} hover:bg-[#0F9B6E] hover:text-white hover:border-[#0F9B6E] transition-all disabled:opacity-30`}
                data-testid="button-doctors-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
                disabled={page === pages - 1}
                className={`h-10 w-10 rounded-xl border ${border} flex items-center justify-center ${titleColor} hover:bg-[#0F9B6E] hover:text-white hover:border-[#0F9B6E] transition-all disabled:opacity-30`}
                data-testid="button-doctors-next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {visible.map((doc, i) => (
            <div key={`${page}-${i}`} className={`${cardBg} rounded-2xl border ${border} overflow-hidden text-center hover:-translate-y-1 hover:shadow-lg transition-all`}>
              <div className="h-52 bg-gray-100 flex items-center justify-center overflow-hidden">
                {doc.imageUrl ? (
                  <img src={doc.imageUrl} alt={doc.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-[#0F9B6E]/10 border-2 border-[#0F9B6E]/20 flex items-center justify-center">
                    <span className="text-3xl font-bold text-[#0F9B6E]">
                      {doc.name.replace(/^Dr\.\s*/i, "").charAt(0)}
                    </span>
                  </div>
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
      </div>
    </section>
  );
}

/* ─── NEW: Gallery carousel ────────────────────────────── */

function GallerySection({ gallery, bg, titleColor, serif }: {
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

function RichFooter({ clinic, cfg, bookingHref, darkBg, accentSuffix, serif }: {
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

/* ══════════════════════════════════════════════════════════
   THEME 1 — CLASSIC
   Playfair serif headings · deep forest green · elegant cards
══════════════════════════════════════════════════════════ */
export function ThemeClassic({ clinic, cfg, bookingHref }: ThemeProps) {
  const services = cfg.services?.length ? cfg.services : DEFAULT_SERVICES;
  const hours = cfg.hours?.length ? cfg.hours : DEFAULT_HOURS;
  const testimonials = cfg.testimonials;
  const gallery = cfg.gallery?.filter(g => g.url);
  const features = cfg.features?.length ? cfg.features : DEFAULT_FEATURES;

  return (
    <div className="min-h-screen bg-[#F4F8F6] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DCE9E3] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinic.logoUrl && <img src={clinic.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
            <span className="text-[#0A3D2E] font-bold text-lg" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{clinic.name}</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <a href="#theme-about" className="hover:text-[#0A3D2E] transition-colors">About</a>
            <a href="#theme-services" className="hover:text-[#0A3D2E] transition-colors">Services</a>
            <a href="#theme-doctors" className="hover:text-[#0A3D2E] transition-colors">Doctors</a>
            <a href="#theme-contact" className="hover:text-[#0A3D2E] transition-colors">Contact</a>
          </div>
          <Link href={bookingHref}>
            <button className="bg-[#0F9B6E] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#085041] transition-colors shadow-sm" data-testid="button-theme-book">
              Book Appointment
            </button>
          </Link>
        </div>
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
              <p className="text-[#6DCFAC] tracking-[0.2em] text-sm font-semibold uppercase mb-4">
                {clinic.city ? `${clinic.city} · ` : ""}Advanced Dental Care
              </p>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {cfg.taglineL1 || "Your Smile,"}<br />
                <span className="text-[#6DCFAC]">{cfg.taglineL2 || "Our Passion."}</span>
              </h1>
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
              {cfg.heroImageUrl ? (
                <img src={cfg.heroImageUrl} alt="Clinic" className="rounded-2xl w-full h-80 object-cover shadow-2xl" />
              ) : (
                <div className="rounded-2xl w-full h-80 bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="text-center text-white/40">
                    <div className="text-6xl mb-3">🦷</div>
                    <p className="text-sm">Clinic Image</p>
                  </div>
                </div>
              )}
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
      />

      {/* Stats bar — only if clinic has configured stats */}
      {cfg.stats && cfg.stats.length > 0 && (
        <StatsBar
          stats={cfg.stats}
          bg="bg-[#0A3D2E]"
          numColor="text-white"
          labelColor="text-white/70"
        />
      )}

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
        title="Meet Our Doctors"
        bg="bg-[#F4F8F6]"
        cardBg="bg-white"
        border="border-[#DCE9E3]"
        titleColor="text-[#0A3D2E]"
        accentColor="text-[#0F9B6E]"
        serif
      />

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <section className="px-6 py-20 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-[#0A3D2E] mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>What Our Patients Say</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <div key={i} className="p-6 rounded-2xl border border-[#DCE9E3]">
                  <StarRating rating={t.rating} />
                  <p className="text-gray-700 mt-3 mb-4 italic leading-relaxed">"{t.quote}"</p>
                  <p className="text-sm font-semibold text-[#0A3D2E]">— {t.patientName}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
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
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Visit Us</h2>
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
export function ThemeWarm({ clinic, cfg, bookingHref }: ThemeProps) {
  const services = cfg.services?.length ? cfg.services : DEFAULT_SERVICES;
  const hours = cfg.hours?.length ? cfg.hours : DEFAULT_HOURS;
  const testimonials = cfg.testimonials;
  const gallery = cfg.gallery?.filter(g => g.url);
  const features = cfg.features?.length ? cfg.features : DEFAULT_FEATURES;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-0 z-40 bg-white shadow-sm px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinic.logoUrl && <img src={clinic.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
            <span className="text-[#1E3A2F] font-bold text-xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{clinic.name}</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <a href="#theme-about-w" className="hover:text-[#1E3A2F] transition-colors">About</a>
            <a href="#theme-services-w" className="hover:text-[#1E3A2F] transition-colors">Services</a>
            <a href="#theme-doctors-w" className="hover:text-[#1E3A2F] transition-colors">Team</a>
            <a href="#theme-contact-w" className="hover:text-[#1E3A2F] transition-colors">Contact</a>
          </div>
          <Link href={bookingHref}>
            <button className="bg-[#0F9B6E] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#085041] transition-colors shadow-sm" data-testid="button-theme-warm-book">
              Book Now
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero — full-width bg photo */}
      <section
        className="relative min-h-[90vh] flex items-center justify-center text-white text-center px-6"
        style={{
          background: cfg.heroImageUrl
            ? `linear-gradient(rgba(30,58,47,0.82), rgba(30,58,47,0.88)), url(${cfg.heroImageUrl}) center/cover`
            : "linear-gradient(135deg, #085041 0%, #0F9B6E 100%)",
        }}
      >
        <div className="max-w-3xl">
          <p className="text-[#6DCFAC] font-semibold tracking-widest text-sm uppercase mb-4">{clinic.city || "Dental Care"}</p>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {cfg.taglineL1 || "Caring for Your Smile"}<br />
            <span className="text-[#6DCFAC]">{cfg.taglineL2 || "Like Family"}</span>
          </h1>
          <p className="text-white/80 text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            {cfg.heroDescription || `Welcome to ${clinic.name} — where every patient is treated with the warmth of family and the expertise of modern dentistry.`}
          </p>
          <Link href={bookingHref}>
            <button className="bg-[#0F9B6E] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#1A9E75] transition-all hover:-translate-y-1 shadow-2xl shadow-black/30">
              Book Appointment Online
            </button>
          </Link>
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
                <div className="rounded-2xl w-full h-96 bg-[#1E3A2F]/10 border-2 border-dashed border-[#1E3A2F]/20 flex items-center justify-center">
                  <div className="text-center text-[#1E3A2F]/40">
                    <div className="text-5xl mb-3">🏥</div>
                    <p className="text-sm font-medium">Add a clinic photo</p>
                  </div>
                </div>
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
      />

      {/* Stats bar */}
      {cfg.stats && cfg.stats.length > 0 && (
        <StatsBar
          stats={cfg.stats}
          bg="bg-[#1E3A2F]"
          numColor="text-white"
          labelColor="text-white/70"
        />
      )}

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
        title="Our Team"
        bg="bg-[#F8EDE3]"
        cardBg="bg-white"
        border="border-[#E8D5C4]"
        titleColor="text-[#1E3A2F]"
        accentColor="text-[#0F9B6E]"
        serif
      />

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <section className="px-6 py-20 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-[#1E3A2F] mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Patient Stories</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="p-7 rounded-2xl bg-[#F8EDE3] border border-[#E8D5C4]">
                  <StarRating rating={t.rating} />
                  <p className="text-gray-700 mt-4 mb-5 italic leading-relaxed">"{t.quote}"</p>
                  <p className="text-sm font-bold text-[#1E3A2F]">— {t.patientName}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
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
export function ThemeModern({ clinic, cfg, bookingHref }: ThemeProps) {
  const services = cfg.services?.length ? cfg.services : DEFAULT_SERVICES;
  const hours = cfg.hours?.length ? cfg.hours : DEFAULT_HOURS;
  const testimonials = cfg.testimonials;
  const gallery = cfg.gallery?.filter(g => g.url);
  const features = cfg.features?.length ? cfg.features : DEFAULT_FEATURES;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinic.logoUrl && <img src={clinic.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
            <span className="text-[#0F172A] font-bold text-xl tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>{clinic.name}</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <a href="#theme-about-m" className="hover:text-[#0F172A] transition-colors">About</a>
            <a href="#theme-services-m" className="hover:text-[#0F172A] transition-colors">Services</a>
            <a href="#theme-doctors-m" className="hover:text-[#0F172A] transition-colors">Team</a>
            <a href="#theme-contact-m" className="hover:text-[#0F172A] transition-colors">Contact</a>
          </div>
          <Link href={bookingHref}>
            <button className="bg-[#0F9B6E] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#085041] transition-colors shadow-sm" data-testid="button-theme-modern-book">
              Book Now
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero — dark with large typography */}
      <section className="bg-[#0F172A] text-white px-6 py-32 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-[#0F9B6E]/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-[#0F9B6E]/8 blur-2xl" />
        </div>
        <div className="max-w-5xl mx-auto relative">
          {clinic.city && <span className="inline-block px-4 py-1.5 rounded-full border border-[#0F9B6E]/30 text-[#0F9B6E] text-sm font-semibold tracking-widest uppercase mb-8">{clinic.city}</span>}
          <h1
            className="font-black leading-none mb-8"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.03em", fontSize: "clamp(3rem, 8vw, 5.5rem)" }}
          >
            {cfg.taglineL1 || "Advanced Dental"}<br />
            <span className="text-[#0F9B6E]">{cfg.taglineL2 || "Care, Redefined."}</span>
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            {cfg.heroDescription || `${clinic.name} offers cutting-edge dental treatments in a modern, comfortable environment. Precision, technology, and care — all in one place.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
          {cfg.heroImageUrl && (
            <div className="mt-16">
              <img src={cfg.heroImageUrl} alt="Clinic" className="w-full max-w-4xl mx-auto rounded-2xl object-cover h-80 shadow-2xl" />
            </div>
          )}
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
                <div className="rounded-2xl w-full h-80 bg-[#0F172A]/5 border-2 border-dashed border-[#0F172A]/10 flex items-center justify-center">
                  <div className="text-center text-[#0F172A]/30">
                    <div className="text-5xl mb-3">🦷</div>
                    <p className="text-sm font-medium">Add clinic photos</p>
                  </div>
                </div>
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
      />

      {/* Stats bar */}
      {cfg.stats && cfg.stats.length > 0 && (
        <StatsBar
          stats={cfg.stats}
          bg="bg-[#0F172A]"
          numColor="text-white"
          labelColor="text-white/60"
        />
      )}

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
        title="Meet the Team"
        bg="bg-white"
        cardBg="bg-[#F8FAFC]"
        border="border-gray-100"
        titleColor="text-[#0F172A]"
        accentColor="text-[#0F9B6E]"
      />

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <section className="px-6 py-20 bg-[#0F172A] text-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-[#0F9B6E] font-bold text-sm uppercase tracking-widest">Patient Reviews</span>
              <h2 className="text-4xl font-black mt-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
                What They Say
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <StarRating rating={t.rating} />
                  <p className="text-white/80 mt-4 mb-5 leading-relaxed italic">"{t.quote}"</p>
                  <p className="text-sm font-bold text-[#0F9B6E]">— {t.patientName}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
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
          <h2 className="text-5xl font-black mb-6" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>{clinic.name}</h2>
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
