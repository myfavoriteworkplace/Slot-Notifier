import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Building2, MapPin, Mail, Clock, ArrowLeft,
  Globe, Phone, Award, ExternalLink, User, ShieldCheck,
  CalendarDays, ArrowRight, Sun, Sunset, MoonStar, Navigation,
} from "lucide-react";
import type { Clinic } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/queryClient";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ThemeClassic, ThemeWarm, ThemeModern } from "@/components/clinic-themes/ClinicThemes";
import type { ClinicWebsiteConfig } from "@shared/schema";

const PIN_ICON = L.divIcon({
  html: `<div style="width:32px;height:40px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))">
    <div style="width:28px;height:28px;background:hsl(258 90% 56%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)"></div>
    <div style="width:4px;height:12px;background:hsl(258 90% 56%);border-radius:0 0 2px 2px;margin-top:-2px"></div>
  </div>`,
  className: "",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

type PublicClinic = Omit<Clinic, "passwordHash" | "registeredBy"> & {
  websiteConfig?: ClinicWebsiteConfig | null;
};

export default function ClinicAbout() {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const clinicIdFromUrl =
    params.get("clinicId") ||
    (location.startsWith("/book/") ? location.split("/").pop() : null) ||
    sessionStorage.getItem("lastClinicId");

  const finalClinicId = clinicIdFromUrl === "null" ? null : clinicIdFromUrl;

  const { data: clinic, isLoading } = useQuery<PublicClinic>({
    queryKey: ["/api/clinics", finalClinicId, "public"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/clinics/${finalClinicId}/public`);
      if (!res.ok) throw new Error("Clinic not found");
      return res.json();
    },
    enabled: !!finalClinicId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="rounded-2xl bg-primary/10 p-5 ring-1 ring-primary/20 mb-2">
          <Building2 className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-display font-bold">Clinic Not Found</h1>
        <p className="text-muted-foreground max-w-sm">
          We couldn't find the clinic you're looking for. It may have moved or been removed.
        </p>
        <Link href="/book">
          <Button className="mt-2 rounded-full px-8 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all">
            Browse Clinics
          </Button>
        </Link>
      </div>
    );
  }

  const bookingHref = finalClinicId ? `/book/${finalClinicId}` : "/book";
  const cfg = clinic.websiteConfig;

  /* ── Themed experience ── */
  if (cfg?.theme) {
    const themeClinic = {
      id: clinic.id,
      name: clinic.name,
      address: clinic.address,
      city: clinic.city,
      phone: clinic.phone,
      email: clinic.email,
      website: clinic.website,
      logoUrl: clinic.logoUrl,
      latitude: (clinic as any).latitude,
      longitude: (clinic as any).longitude,
      doctors: clinic.doctors as any,
      doctorName: clinic.doctorName,
      doctorSpecialization: clinic.doctorSpecialization,
      doctorDegree: clinic.doctorDegree,
    };
    if (cfg.theme === "warm") return <ThemeWarm clinic={themeClinic} cfg={cfg} bookingHref={bookingHref} />;
    if (cfg.theme === "modern") return <ThemeModern clinic={themeClinic} cfg={cfg} bookingHref={bookingHref} />;
    return <ThemeClassic clinic={themeClinic} cfg={cfg} bookingHref={bookingHref} />;
  }

  /* ── Default layout (no theme configured) ── */
  const doctors =
    clinic.doctors && Array.isArray(clinic.doctors) && clinic.doctors.length > 0
      ? (clinic.doctors as { name: string; specialization: string; degree: string; imageUrl?: string | null }[])
      : null;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        >
          <div
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-accent opacity-15 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          />
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-14 sm:pb-20">
          <Link href={bookingHref}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 mb-10 rounded-full hover:bg-primary/10 transition-colors"
              data-testid="button-back-to-booking"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Booking
            </Button>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6 animate-fade-in-up">
            <div className="h-20 w-20 shrink-0 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary shadow-inner">
              {clinic.logoUrl ? (
                <img src={clinic.logoUrl} alt={clinic.name} className="h-full w-full object-cover rounded-2xl" />
              ) : (
                <Building2 className="h-10 w-10" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-full border-primary/30 bg-primary/10 text-primary text-xs font-semibold px-3 py-1"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified Clinic
                </Badge>
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight">
                <span className="text-gradient">{clinic.name}</span>
              </h1>
              {clinic.address && (
                <p className="mt-2 flex items-center gap-2 text-muted-foreground text-base">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  {clinic.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-20">

        {/* Info cards row */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in-up delay-100">

          <Card className="bg-card border shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden">
            <CardContent className="p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/20">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display font-bold text-lg">Contact</h2>
              </div>
              <div className="space-y-4">
                {clinic.phone && (
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Phone</span>
                    <a
                      href={`tel:${clinic.phone}`}
                      className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
                      data-testid="link-clinic-phone"
                    >
                      <Phone className="h-4 w-4" />
                      {clinic.phone}
                    </a>
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Email</span>
                  <p className="font-semibold text-sm break-all">{clinic.email || "Not available"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden">
            <CardContent className="p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/20">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display font-bold text-lg">Location</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {clinic.address || "Address not provided"}
              </p>
              {(clinic.city || clinic.pincode) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {[clinic.city, clinic.pincode].filter(Boolean).join(" — ")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden sm:col-span-2 lg:col-span-1">
            <CardContent className="p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/20">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display font-bold text-lg">Online</h2>
              </div>
              {clinic.website ? (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Website</span>
                  <a
                    href={clinic.website.startsWith("http") ? clinic.website : `https://${clinic.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 font-semibold text-primary hover:underline"
                    data-testid="link-clinic-website"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit Website
                  </a>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No website listed yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        {(clinic as any).latitude && (clinic as any).longitude && (
          <Card className="mt-5 bg-card border shadow-sm rounded-2xl overflow-hidden animate-fade-in-up delay-150">
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-3 px-7 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/20">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg leading-tight">Find Us</h2>
                    {clinic.address && (
                      <p className="text-sm text-muted-foreground mt-0.5">{clinic.address}{clinic.city ? `, ${clinic.city}` : ""}</p>
                    )}
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${(clinic as any).latitude},${(clinic as any).longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-get-directions"
                >
                  <Button size="sm" className="rounded-full shadow-sm gap-2 bg-primary hover:bg-primary/90">
                    <Navigation className="h-4 w-4" />
                    Get Directions
                  </Button>
                </a>
              </div>
              <div style={{ height: 320 }}>
                <MapContainer
                  center={[(clinic as any).latitude, (clinic as any).longitude]}
                  zoom={16}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={false}
                  zoomControl={true}
                  dragging={true}
                  attributionControl={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <Marker position={[(clinic as any).latitude, (clinic as any).longitude]} icon={PIN_ICON} />
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Doctors */}
        {(doctors || clinic.doctorName) && (
          <Card className="mt-5 bg-card border shadow-sm rounded-2xl overflow-hidden animate-fade-in-up delay-200">
            <CardContent className="p-7 sm:p-8">
              <div className="flex items-center gap-3 mb-7">
                <div className="rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/20">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display font-bold text-xl">
                  {doctors ? "Our Medical Experts" : "Medical Lead"}
                </h2>
              </div>

              {doctors ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {doctors.map((doc, idx) => (
                    <div
                      key={idx}
                      className="group flex flex-col items-start p-5 rounded-2xl bg-muted/40 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all duration-300"
                      data-testid={`card-doctor-${idx}`}
                    >
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center text-primary mb-4 overflow-hidden">
                        {doc.imageUrl ? (
                          <img src={doc.imageUrl} alt={doc.name} className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-8 w-8" />
                        )}
                      </div>
                      <h3 className="font-display font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                        {doc.name}
                      </h3>
                      <p className="text-primary text-xs font-bold uppercase tracking-wider mb-3">
                        {doc.specialization}
                      </p>
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-background border border-primary/20 text-primary text-xs font-bold">
                        {doc.degree}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-5 rounded-2xl bg-muted/40 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all duration-300">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center text-primary shrink-0">
                    <User className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg mb-1">{clinic.doctorName}</h3>
                    {clinic.doctorSpecialization && (
                      <p className="text-primary text-xs font-bold uppercase tracking-wider mb-2">
                        {clinic.doctorSpecialization}
                      </p>
                    )}
                    {clinic.doctorDegree && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-background border border-primary/20 text-primary text-xs font-bold">
                        {clinic.doctorDegree}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Typical Hours */}
        <Card className="mt-5 bg-card border shadow-sm rounded-2xl overflow-hidden animate-fade-in-up delay-200">
          <CardContent className="p-7 sm:p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/20">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-display font-bold text-xl">Typical Hours</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-6 ml-1">
              Contact the clinic directly to confirm current availability.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-5 rounded-2xl bg-muted/40 border border-transparent hover:border-amber-400/30 hover:bg-amber-500/5 transition-all">
                <div className="rounded-lg bg-amber-500/10 p-2 ring-1 ring-amber-400/20 shrink-0">
                  <Sun className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Weekdays</span>
                  <span className="font-bold text-sm">9:00 AM – 7:00 PM</span>
                </div>
              </div>
              <div className="flex items-start gap-3 p-5 rounded-2xl bg-muted/40 border border-transparent hover:border-sky-400/30 hover:bg-sky-500/5 transition-all">
                <div className="rounded-lg bg-sky-500/10 p-2 ring-1 ring-sky-400/20 shrink-0">
                  <Sunset className="h-4 w-4 text-sky-500" />
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Saturdays</span>
                  <span className="font-bold text-sm">9:00 AM – 4:00 PM</span>
                </div>
              </div>
              <div className="flex items-start gap-3 p-5 rounded-2xl bg-muted/40 border border-destructive/10 hover:bg-destructive/5 transition-all">
                <div className="rounded-lg bg-destructive/10 p-2 ring-1 ring-destructive/20 shrink-0">
                  <MoonStar className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Sundays</span>
                  <span className="font-bold text-sm text-destructive">Closed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Book CTA */}
        <div className="mt-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-background border border-primary/15 p-8 sm:p-10 animate-fade-in-up delay-300">
          <div aria-hidden="true" className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Accepting Bookings</span>
              </div>
              <h3 className="font-display font-bold text-2xl sm:text-3xl mb-2">
                Ready to visit {clinic.name}?
              </h3>
              <p className="text-muted-foreground text-base max-w-md">
                Book your appointment in seconds — no phone tag, no waiting. Pick a slot that works for you.
              </p>
            </div>
            <Link href={bookingHref}>
              <Button
                size="lg"
                className="rounded-full px-8 h-12 text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all shrink-0 gap-2"
                data-testid="button-book-appointment"
              >
                <CalendarDays className="h-5 w-5" />
                Book Appointment
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
