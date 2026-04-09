import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2, MapPin, Mail, Phone, Globe, Award, Clock, User,
  ShieldCheck, ExternalLink, Sun, Sunset, MoonStar, Navigation,
  CalendarDays, ArrowRight, Stethoscope,
} from "lucide-react";
import type { Clinic } from "@shared/schema";

type PublicClinic = Omit<Clinic, "passwordHash" | "registeredBy">;

interface ClinicInfoSheetProps {
  clinic: PublicClinic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueBooking: () => void;
}

export default function ClinicInfoSheet({
  clinic,
  open,
  onOpenChange,
  onContinueBooking,
}: ClinicInfoSheetProps) {
  if (!clinic) return null;

  const doctors =
    clinic.doctors && Array.isArray(clinic.doctors) && clinic.doctors.length > 0
      ? (clinic.doctors as { name: string; specialization: string; degree: string; imageUrl?: string | null }[])
      : null;

  const lat = (clinic as any).latitude;
  const lng = (clinic as any).longitude;
  const mapsUrl = lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : clinic.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
        data-testid="sheet-clinic-info"
      >
        {/* ── Header ── */}
        <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 pt-6 pb-5 shrink-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
          <div className="relative">
            <SheetHeader className="text-left mb-0">
              <SheetDescription className="sr-only">
                Details about {clinic.name}
              </SheetDescription>
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 shrink-0 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center ring-1 ring-white/10">
                  <span className="text-2xl font-black text-white">{clinic.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <Badge
                    variant="outline"
                    className="gap-1 mb-1.5 rounded-full border-white/30 bg-white/10 text-white/80 text-[10px] font-semibold px-2 py-0.5"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Verified Clinic
                  </Badge>
                  <SheetTitle className="text-white font-extrabold text-xl leading-tight truncate">
                    {clinic.name}
                  </SheetTitle>
                  {clinic.address && (
                    <p className="text-white/60 text-xs mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {clinic.address}
                    </p>
                  )}
                </div>
              </div>
            </SheetHeader>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
        </div>

        {/* ── Scrollable content ── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-5 space-y-4">

            {/* Contact */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="rounded-xl bg-primary/10 p-2 ring-1 ring-primary/20">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-bold text-sm">Contact</h3>
              </div>
              <div className="space-y-3">
                {clinic.phone && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Phone</span>
                    <a
                      href={`tel:${clinic.phone}`}
                      className="flex items-center gap-2 font-semibold text-sm hover:text-primary transition-colors"
                      data-testid="sheet-link-clinic-phone"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {clinic.phone}
                    </a>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Email</span>
                  <p className="font-semibold text-sm break-all">{clinic.email || "Not available"}</p>
                </div>
                {clinic.website && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Website</span>
                    <a
                      href={clinic.website.startsWith("http") ? clinic.website : `https://${clinic.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 font-semibold text-sm text-primary hover:underline"
                      data-testid="sheet-link-clinic-website"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Visit Website
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-primary/10 p-2 ring-1 ring-primary/20">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm">Location</h3>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="sheet-link-get-directions"
                  >
                    <Button size="sm" variant="outline" className="h-7 rounded-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
                      <Navigation className="h-3 w-3" />
                      Directions
                    </Button>
                  </a>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {clinic.address || "Address not provided"}
              </p>
              {(clinic.city || clinic.pincode) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {[clinic.city, clinic.pincode].filter(Boolean).join(" — ")}
                </p>
              )}
            </div>

            {/* Doctors */}
            {(doctors || clinic.doctorName) && (
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="rounded-xl bg-primary/10 p-2 ring-1 ring-primary/20">
                    <Award className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm">
                    {doctors ? "Medical Experts" : "Medical Lead"}
                  </h3>
                </div>

                {doctors ? (
                  <div className="space-y-3">
                    {doctors.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/40"
                        data-testid={`sheet-card-doctor-${idx}`}
                      >
                        <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                          {doc.imageUrl ? (
                            <img src={doc.imageUrl} alt={doc.name} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{doc.name}</p>
                          <p className="text-primary text-[10px] font-bold uppercase tracking-wider">{doc.specialization}</p>
                          <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full bg-background border border-primary/20 text-primary text-[10px] font-bold">
                            {doc.degree}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{clinic.doctorName}</p>
                      {clinic.doctorSpecialization && (
                        <p className="text-primary text-[10px] font-bold uppercase tracking-wider">{clinic.doctorSpecialization}</p>
                      )}
                      {clinic.doctorDegree && (
                        <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full bg-background border border-primary/20 text-primary text-[10px] font-bold">
                          {clinic.doctorDegree}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Typical Hours */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="rounded-xl bg-primary/10 p-2 ring-1 ring-primary/20">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-bold text-sm">Typical Hours</h3>
              </div>
              <p className="text-[10px] text-muted-foreground mb-4 ml-0.5">
                Contact the clinic to confirm current availability.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <div className="rounded-lg bg-amber-500/10 p-1.5 ring-1 ring-amber-400/20 shrink-0">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground w-20 shrink-0">Weekdays</span>
                  <span className="font-bold text-sm">9:00 AM – 7:00 PM</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <div className="rounded-lg bg-sky-500/10 p-1.5 ring-1 ring-sky-400/20 shrink-0">
                    <Sunset className="h-3.5 w-3.5 text-sky-500" />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground w-20 shrink-0">Saturdays</span>
                  <span className="font-bold text-sm">9:00 AM – 4:00 PM</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <div className="rounded-lg bg-destructive/10 p-1.5 ring-1 ring-destructive/20 shrink-0">
                    <MoonStar className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground w-20 shrink-0">Sundays</span>
                  <span className="font-bold text-sm text-destructive">Closed</span>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* ── Footer CTA ── */}
        <div className="shrink-0 px-5 py-4 border-t border-border/60 bg-card">
          <Button
            className="w-full rounded-full h-11 text-sm font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all gap-2"
            onClick={() => {
              onOpenChange(false);
              onContinueBooking();
            }}
            data-testid="button-continue-booking"
          >
            <CalendarDays className="h-4 w-4" />
            Continue Booking
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
