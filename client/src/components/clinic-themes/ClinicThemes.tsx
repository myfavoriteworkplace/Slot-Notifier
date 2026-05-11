import { Link } from "wouter";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ClinicWebsiteConfig } from "@shared/schema";
import { Star, Phone, Mail, MapPin, Globe, Clock, Navigation, Instagram, Facebook, Youtube, ExternalLink } from "lucide-react";

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

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

function DoctorsGrid({ clinic }: { clinic: ThemeClinic }) {
  const doctors =
    clinic.doctors && Array.isArray(clinic.doctors) && clinic.doctors.length > 0
      ? clinic.doctors
      : clinic.doctorName
      ? [{ name: clinic.doctorName, specialization: clinic.doctorSpecialization ?? "", degree: clinic.doctorDegree ?? "", imageUrl: null }]
      : null;
  if (!doctors) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {doctors.map((doc, i) => (
        <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="h-20 w-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-4 overflow-hidden">
            {doc.imageUrl ? (
              <img src={doc.imageUrl} alt={doc.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary">{doc.name.replace(/^Dr\.\s*/i, "").charAt(0)}</span>
            )}
          </div>
          <h3 className="font-bold text-lg mb-1">{doc.name}</h3>
          <p className="text-primary text-sm font-semibold mb-2">{doc.specialization}</p>
          <span className="text-xs px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary font-medium">{doc.degree}</span>
        </div>
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

function SocialLinks({ links }: { links?: ClinicWebsiteConfig["socialLinks"] }) {
  if (!links) return null;
  return (
    <div className="flex items-center gap-4">
      {links.instagram && (
        <a href={links.instagram} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
          <Instagram className="h-5 w-5" />
        </a>
      )}
      {links.facebook && (
        <a href={links.facebook} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
          <Facebook className="h-5 w-5" />
        </a>
      )}
      {links.youtube && (
        <a href={links.youtube} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
          <Youtube className="h-5 w-5" />
        </a>
      )}
    </div>
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

  return (
    <div className="min-h-screen bg-[#F4F8F6] font-sans" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-[#DCE9E3] px-6 py-3">
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

      {/* Gallery */}
      {gallery && gallery.length > 0 && (
        <section className="px-6 py-16 bg-[#F4F8F6]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#0A3D2E] text-center mb-10" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Our Clinic</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {gallery.map((img, i) => (
                <div key={i} className="rounded-xl overflow-hidden aspect-video">
                  <img src={img.url} alt={img.caption || `Gallery ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  {img.caption && <p className="text-center text-xs text-gray-500 mt-1">{img.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      <section id="theme-services" className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0A3D2E] mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Our Services</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <div key={i} className="p-6 rounded-2xl border border-[#DCE9E3] hover:-translate-y-2 hover:shadow-lg transition-all duration-300">
                <h3 className="font-bold text-[#0A3D2E] mb-2">{s.name}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctors */}
      <section id="theme-doctors" className="px-6 py-20 bg-[#F4F8F6]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0A3D2E] mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Meet Our Doctors</h2>
          </div>
          <DoctorsGrid clinic={clinic} />
        </div>
      </section>

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

      {/* Footer */}
      <footer className="bg-[#08281f] text-white/50 text-center py-8 px-6">
        <div className="flex items-center justify-center gap-4 mb-3">
          <SocialLinks links={cfg.socialLinks} />
        </div>
        <p className="text-sm">© {new Date().getFullYear()} {clinic.name} · Powered by <span className="text-[#0F9B6E] font-semibold">bookMySlot</span></p>
      </footer>
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

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-16 z-40 bg-white shadow-sm px-6 py-4">
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

      {/* Gallery */}
      {gallery && gallery.length > 0 && (
        <section className="px-6 py-16 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#1E3A2F] text-center mb-10" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Our Clinic</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {gallery.map((img, i) => (
                <div key={i} className="rounded-2xl overflow-hidden aspect-video">
                  <img src={img.url} alt={img.caption || `Gallery ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      <section id="theme-services-w" className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#1E3A2F] mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>What We Offer</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <div key={i} className="p-6 rounded-2xl shadow-md hover:shadow-xl transition-shadow bg-white border border-gray-100">
                <div className="h-10 w-10 rounded-xl bg-[#0F9B6E]/10 flex items-center justify-center mb-4">
                  <span className="text-[#0F9B6E] text-lg">✦</span>
                </div>
                <h3 className="font-bold text-[#1E3A2F] mb-2">{s.name}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctors */}
      <section id="theme-doctors-w" className="px-6 py-20 bg-[#F8EDE3]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#1E3A2F] mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Our Team</h2>
          </div>
          <DoctorsGrid clinic={clinic} />
        </div>
      </section>

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
              <div className="mt-6"><SocialLinks links={cfg.socialLinks} /></div>
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

      {/* Footer */}
      <footer className="bg-[#0D2B22] text-white/40 text-center py-6 px-6">
        <p className="text-sm">© {new Date().getFullYear()} {clinic.name} · {clinic.city} · Powered by <span className="text-[#0F9B6E] font-semibold">bookMySlot</span></p>
      </footer>
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

  return (
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Mini-nav */}
      <nav className="sticky top-16 z-40 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
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

      {/* Services */}
      <section id="theme-services-m" className="px-6 py-20 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#0F9B6E] font-bold text-sm uppercase tracking-widest">What We Do</span>
            <h2 className="text-4xl font-black text-[#0F172A] mt-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
              Our Services
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300">
                <div className="h-10 w-10 rounded-xl bg-[#0F9B6E]/10 flex items-center justify-center mb-4">
                  <span className="text-[#0F9B6E] font-black">0{i + 1}</span>
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{s.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctors */}
      <section id="theme-doctors-m" className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#0F9B6E] font-bold text-sm uppercase tracking-widest">Our Experts</span>
            <h2 className="text-4xl font-black text-[#0F172A] mt-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
              Meet the Team
            </h2>
          </div>
          <DoctorsGrid clinic={clinic} />
        </div>
      </section>

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
          <div className="flex justify-center mb-8"><SocialLinks links={cfg.socialLinks} /></div>
          <Link href={bookingHref}>
            <button className="bg-[#0F9B6E] text-white px-12 py-4 rounded-full font-bold text-lg hover:bg-[#1A9E75] transition-all hover:-translate-y-1 shadow-lg shadow-[#0F9B6E]/25">
              Book Your Visit
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#080D14] text-white/30 text-center py-6 px-6">
        <p className="text-sm">© {new Date().getFullYear()} {clinic.name} · {clinic.city} · Powered by <span className="text-[#0F9B6E] font-semibold">bookMySlot</span></p>
      </footer>
    </div>
  );
}
