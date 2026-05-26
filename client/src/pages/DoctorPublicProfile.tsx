import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Stethoscope, GraduationCap, Building2, Phone, Award, BookOpen,
  Star, Play, ChevronLeft, TrendingUp, Globe, AlertCircle, RefreshCw,
  Share2, CalendarPlus, MapPin, Quote, ImageIcon, Video, ShieldCheck,
  ExternalLink
} from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { notify } from "@/lib/notify";

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com");
}

function getVideoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function MediaThumb({ url, onClick }: { url: string; onClick: () => void }) {
  if (isVideo(url)) {
    return (
      <div onClick={onClick} className="relative rounded-xl overflow-hidden bg-black/50 border border-border cursor-pointer flex items-center justify-center aspect-video active:scale-[0.98] transition-transform">
        <div className="absolute inset-0 bg-primary/5" />
        <Play className="w-8 h-8 text-primary relative z-10" />
        <span className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-black/70 rounded px-1.5 py-0.5">Video</span>
      </div>
    );
  }
  return (
    <div onClick={onClick} className="rounded-xl overflow-hidden border border-border cursor-pointer aspect-video active:scale-[0.98] transition-transform">
      <img src={url} alt="Case" className="w-full h-full object-cover block" />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-10">
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
        <Skeleton className="w-[120px] h-[120px] rounded-full shrink-0 self-center sm:self-start" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-52" />
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-44" />
          <div className="flex gap-2 flex-wrap mt-1">
            <Skeleton className="h-7 w-36 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:w-44 shrink-0">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-2xl border border-border/50 p-5 space-y-2 bg-card">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
    </div>
  );
}

export default function DoctorPublicProfile() {
  const params = useParams<{ id: string }>();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{
    doctor: any;
    certifications: any[];
    cases: any[];
    clinic: any | null;
  }>({ queryKey: [`/api/public/doctor/${params.id}`] });

  const handleShare = async () => {
    const url = window.location.href;
    const title = data?.doctor?.name ? `Dr. ${data.doctor.name} — BookMySlot` : "Doctor Profile";
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url);
      notify.success("Link copied!", { description: "Profile link copied to clipboard." });
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="h-[3px] bg-gradient-to-r from-primary via-accent to-primary" />
      <ProfileSkeleton />
    </div>
  );

  if (isError || !data) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold text-foreground text-center">Couldn't load this doctor's profile</p>
      <p className="text-sm text-muted-foreground text-center">This doctor may not exist or there was a connection problem.</p>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Button variant="outline" onClick={() => refetch()} className="gap-2 min-h-[44px] active:scale-[0.98] transition-transform">
          <RefreshCw className="w-4 h-4" />Try again
        </Button>
        <Link href="/"><Button variant="ghost" className="min-h-[44px] active:scale-[0.98] transition-transform">← Back to Home</Button></Link>
      </div>
    </div>
  );

  const { doctor, certifications, cases, clinic } = data;
  const initials = doctor.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "DR";
  const displayName = /^dr\./i.test(doctor.name?.trim()) ? doctor.name : `Dr. ${doctor.name}`;
  const treatments: string[] = doctor.treatments || [];
  const allSpecialties = [doctor.specialization, ...treatments].filter(Boolean) as string[];
  const testimonials: { quote: string; patientName: string; rating: number }[] = clinic?.websiteConfig?.testimonials || [];
  const gallery: { url: string; caption?: string }[] = clinic?.websiteConfig?.gallery || [];
  const mapsUrl = clinic
    ? (clinic.latitude && clinic.longitude
        ? `https://www.google.com/maps?q=${clinic.latitude},${clinic.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([clinic.name, clinic.address, clinic.city].filter(Boolean).join(", "))}`)
    : null;

  const SectionHeading = ({ icon: Icon, label, color = "primary" }: { icon: any; label: string; color?: string }) => (
    <div className="flex items-center gap-2.5 mb-5">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
        color === "primary" ? "bg-gradient-to-br from-primary to-accent" :
        color === "violet" ? "bg-violet-500/15 border border-violet-500/20" :
        "bg-primary/10 border border-primary/20"
      }`}>
        <Icon className={`w-4 h-4 ${color === "primary" ? "text-primary-foreground" : color === "violet" ? "text-violet-600 dark:text-violet-400" : "text-primary"}`} />
      </div>
      <h2 className="text-base md:text-lg font-semibold text-foreground">{label}</h2>
    </div>
  );

  const AboutContent = () => (
    <p className={`text-sm leading-relaxed ${doctor.bio ? "text-muted-foreground" : "text-foreground/30 italic"}`}>
      {doctor.bio || "This doctor hasn't added a bio yet."}
    </p>
  );

  const SpecialtiesContent = () => (
    allSpecialties.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {allSpecialties.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 text-primary bg-primary/10 border border-primary/20">
            <Stethoscope className="w-3 h-3 shrink-0" />{s}
          </span>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground/50 italic">No specialties listed yet.</p>
    )
  );

  const CertsContent = () => (
    certifications.length > 0 ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {certifications.map((cert) => (
          <div key={cert.id} className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
            {cert.imageUrl && <img src={cert.imageUrl} alt={cert.title} className="w-full aspect-video object-cover block" />}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Star className="w-3 h-3 text-primary" />
                  </div>
                  <p className="font-semibold text-sm text-foreground leading-tight">{cert.title}</p>
                </div>
                {cert.year && (
                  <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">{cert.year}</span>
                )}
              </div>
              {cert.issuer && <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3 shrink-0" />{cert.issuer}</p>}
              {cert.description && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{cert.description}</p>}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="bg-card border border-dashed border-border/50 rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
        <Award className="w-8 h-8 text-primary/20" />
        <p className="text-sm font-semibold text-muted-foreground">No certifications added yet</p>
      </div>
    )
  );

  const CasesContent = () => (
    cases.length > 0 ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {cases.map((c) => {
          const media: string[] = c.mediaUrls || [];
          const tags: string[] = c.tags || [];
          const hasMedia = media[0] || media[1];
          return (
            <div key={c.id} className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              {hasMedia && (
                <div className="p-3 bg-muted/40 grid grid-cols-2 gap-2">
                  {(["Before", "After"] as const).map((label, i) =>
                    media[i] ? (
                      <div key={i} className="relative">
                        <MediaThumb url={media[i]} onClick={() => setLightboxUrl(media[i])} />
                        <span className="absolute top-1.5 left-1.5 text-xs font-bold uppercase tracking-wide text-white bg-black/75 rounded px-1.5 py-0.5">{label}</span>
                      </div>
                    ) : (
                      <div key={i} className="aspect-video rounded-xl border border-dashed border-border flex items-center justify-center">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/40">{label}</span>
                      </div>
                    )
                  )}
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                    <BookOpen className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                  </div>
                  <p className="font-semibold text-sm text-foreground">{c.title}</p>
                </div>
                {c.description && <p className="text-xs text-muted-foreground leading-relaxed mb-3">{c.description}</p>}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag: string, i: number) => (
                      <span key={i} className="text-xs font-semibold text-primary bg-primary/10 border border-primary/15 rounded-full px-2 py-0.5">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="bg-card border border-dashed border-violet-500/20 rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
        <BookOpen className="w-8 h-8 text-violet-400/30" />
        <p className="text-sm font-semibold text-muted-foreground">No case studies published yet</p>
      </div>
    )
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-6">
          {isVideo(lightboxUrl) ? (
            <video src={lightboxUrl} controls autoPlay className="max-w-[90vw] max-h-[85vh] rounded-2xl" />
          ) : (
            <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain" />
          )}
        </div>
      )}

      {/* Top accent bar */}
      <div className="h-[3px] bg-gradient-to-r from-primary via-accent to-primary" />

      {/* Back link */}
      <div className="px-4 sm:px-8 lg:px-12 pt-3">
        <Link href="/">
          <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground min-h-[44px] px-2 rounded-lg hover:text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98] transition-all cursor-pointer bg-transparent border-none">
            <ChevronLeft className="w-4 h-4" />Back
          </button>
        </Link>
      </div>

      {/* ── HERO ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 pt-4 pb-8">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-8">

          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-full bg-primary/20 blur-xl pointer-events-none" />
            {doctor.imageUrl ? (
              <img src={doctor.imageUrl} alt={doctor.name} className="relative w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] rounded-full object-cover border-2 border-primary/30" />
            ) : (
              <div className="relative w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center text-4xl font-extrabold text-primary">
                {initials}
              </div>
            )}
            <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-background">
              <Stethoscope className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1">Doctor Profile</p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight text-foreground mb-3">{displayName}</h1>

            {/* Specialization + Degree */}
            <div className="flex flex-wrap gap-2 mb-3 justify-center lg:justify-start">
              {doctor.specialization && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 text-primary bg-primary/10 border border-primary/25">
                  <Stethoscope className="w-3 h-3 shrink-0" />{doctor.specialization}
                </span>
              )}
              {doctor.degree && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 text-muted-foreground bg-foreground/5 border border-border">
                  <GraduationCap className="w-3 h-3 shrink-0" />{doctor.degree}
                </span>
              )}
              {doctor.yearsOfExperience != null && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 text-primary bg-primary/10 border border-primary/25">
                  <TrendingUp className="w-3 h-3 shrink-0" />{doctor.yearsOfExperience} yrs experience
                </span>
              )}
            </div>

            {/* College */}
            {doctor.college && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2 justify-center lg:justify-start">
                <Building2 className="w-3.5 h-3.5 shrink-0" />{doctor.college}
              </p>
            )}

            {/* Phone */}
            {doctor.phone && (
              <a href={`tel:${doctor.phone}`} className="inline-flex items-center gap-1.5 text-sm text-primary no-underline min-h-[44px] px-1 hover:underline active:opacity-70 transition-opacity">
                <Phone className="w-3.5 h-3.5" />{doctor.phone}
              </a>
            )}

            {/* Languages */}
            {Array.isArray(doctor.languages) && doctor.languages.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 justify-center lg:justify-start">
                {doctor.languages.map((lang: string) => (
                  <span key={lang} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 text-muted-foreground bg-foreground/5 border border-border">
                    <Globe className="w-3 h-3" />{lang}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-row lg:flex-col gap-2 w-full sm:w-auto lg:w-44 shrink-0">
            <Link href="/book" className="flex-1 lg:flex-none">
              <Button className="w-full min-h-[44px] gap-2 active:scale-[0.98] transition-transform font-semibold">
                <CalendarPlus className="w-4 h-4" />Book Appointment
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={handleShare}
              className="flex-1 lg:flex-none min-h-[44px] gap-2 active:scale-[0.98] transition-transform"
            >
              <Share2 className="w-4 h-4" />Share Profile
            </Button>
          </div>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 pb-16 space-y-10">

        {/* Desktop: all sections expanded */}
        <div className="hidden lg:block space-y-10">

          {/* About Me */}
          <section>
            <SectionHeading icon={BookOpen} label="About Me" color="muted" />
            <AboutContent />
          </section>

          {/* Specialties & Treatments */}
          {allSpecialties.length > 0 && (
            <section>
              <SectionHeading icon={Stethoscope} label="Specialties & Treatments" color="muted" />
              <SpecialtiesContent />
            </section>
          )}

          {/* Certifications */}
          <section>
            <SectionHeading icon={Award} label="Certifications & Achievements" />
            <CertsContent />
          </section>

          {/* Case Studies */}
          <section>
            <SectionHeading icon={BookOpen} label="Case Studies" color="violet" />
            <CasesContent />
          </section>
        </div>

        {/* Mobile: accordion for collapsible sections */}
        <div className="lg:hidden">
          <Accordion type="multiple" defaultValue={["about", "specialties"]}>
            <AccordionItem value="about">
              <AccordionTrigger className="min-h-[44px] text-sm font-semibold">About Me</AccordionTrigger>
              <AccordionContent><AboutContent /></AccordionContent>
            </AccordionItem>
            {allSpecialties.length > 0 && (
              <AccordionItem value="specialties">
                <AccordionTrigger className="min-h-[44px] text-sm font-semibold">Specialties & Treatments</AccordionTrigger>
                <AccordionContent><SpecialtiesContent /></AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="certs">
              <AccordionTrigger className="min-h-[44px] text-sm font-semibold">Certifications & Achievements</AccordionTrigger>
              <AccordionContent><CertsContent /></AccordionContent>
            </AccordionItem>
            {cases.length > 0 && (
              <AccordionItem value="cases">
                <AccordionTrigger className="min-h-[44px] text-sm font-semibold">Case Studies</AccordionTrigger>
                <AccordionContent><CasesContent /></AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* ── BOTTOM ROW: Clinic · Testimonials · Photos ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Clinic Info */}
          <div className="bg-card border border-border/50 rounded-2xl shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground">Clinic Location</p>
            </div>
            {clinic ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-foreground">{clinic.name}</p>
                  {(clinic.address || clinic.city) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{[clinic.address, clinic.city].filter(Boolean).join(", ")}</p>
                  )}
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline active:opacity-70 transition-opacity min-h-[44px] py-2"
                  >
                    <ExternalLink className="w-3 h-3" />Open in Maps
                  </a>
                )}
                <Link href={`/clinic/${clinic.id}`}>
                  <Button variant="outline" size="sm" className="w-full min-h-[40px] active:scale-[0.98] transition-transform text-xs">
                    View Clinic
                  </Button>
                </Link>
              </>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">No clinic linked yet.</p>
            )}
          </div>

          {/* Patient Testimonials */}
          <div className="bg-card border border-border/50 rounded-2xl shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Quote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="font-semibold text-sm text-foreground">Patient Reviews</p>
            </div>
            {testimonials.length > 0 ? (
              <div className="space-y-4">
                {testimonials.slice(0, 3).map((t, i) => (
                  <div key={i} className="border-b border-border/40 last:border-0 pb-3 last:pb-0">
                    <StarRow rating={t.rating} />
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed italic">"{t.quote}"</p>
                    <p className="text-xs font-semibold text-foreground/60 mt-1">— {t.patientName}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3 text-center">
                <Star className="w-7 h-7 text-amber-300/30" />
                <p className="text-xs text-muted-foreground/50 italic">No reviews yet</p>
              </div>
            )}
          </div>

          {/* Clinic Photos */}
          <div className="bg-card border border-border/50 rounded-2xl shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                <ImageIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              </div>
              <p className="font-semibold text-sm text-foreground">Clinic Photos</p>
            </div>
            {gallery.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {gallery.slice(0, 6).map((g, i) => (
                  <div
                    key={i}
                    onClick={() => setLightboxUrl(g.url)}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer border border-border/50 active:scale-[0.97] transition-transform"
                  >
                    <img src={g.url} alt={g.caption || "Clinic photo"} className="w-full h-full object-cover block" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3 text-center">
                <ImageIcon className="w-7 h-7 text-sky-400/20" />
                <p className="text-xs text-muted-foreground/50 italic">No clinic photos yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── INTRO VIDEO ── */}
        {doctor.introVideoUrl && (() => {
          const embedUrl = getVideoEmbedUrl(doctor.introVideoUrl);
          return (
            <section className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 p-5 border-b border-border/40">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">Intro Video</h2>
              </div>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="w-full aspect-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Doctor intro video"
                />
              ) : /\.(mp4|webm|ogg|mov)$/i.test(doctor.introVideoUrl) ? (
                <video src={doctor.introVideoUrl} controls className="w-full aspect-video bg-black" />
              ) : null}
            </section>
          );
        })()}

      </div>

      {/* ── FOOTER BADGE ── */}
      <div className="border-t border-border/40 py-4 px-4 sm:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-primary/60" />
          <span className="font-semibold">DISHA / HIPAA Compliant</span>
          <span className="text-muted-foreground/40">·</span>
          <span>Your health data is secure and private</span>
        </div>
      </div>
    </div>
  );
}
