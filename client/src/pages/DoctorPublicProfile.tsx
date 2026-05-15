import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, Stethoscope, GraduationCap, Building2, Phone, Award, BookOpen, Star, Play, ChevronLeft, TrendingUp, Globe } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com");
}

function MediaThumb({ url, onClick }: { url: string; onClick: () => void }) {
  if (isVideo(url)) {
    return (
      <div onClick={onClick} className="relative rounded-xl overflow-hidden bg-black/50 border border-border cursor-pointer flex items-center justify-center aspect-video">
        <div className="absolute inset-0 bg-primary/5" />
        <Play className="w-8 h-8 text-primary relative z-10" />
        <span className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-black/60 rounded px-1.5 py-0.5">Video</span>
      </div>
    );
  }
  return (
    <div onClick={onClick} className="rounded-xl overflow-hidden border border-border cursor-pointer aspect-video">
      <img src={url} alt="Case" className="w-full h-full object-cover block" />
    </div>
  );
}

export default function DoctorPublicProfile() {
  const params = useParams<{ id: string }>();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ doctor: any; certifications: any[]; cases: any[] }>({
    queryKey: [`/api/public/doctor/${params.id}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-9 h-9 text-primary animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-bold text-foreground">Doctor not found</p>
        <Link href="/">
          <button className="text-primary text-sm border border-border rounded-lg px-5 py-2 bg-transparent cursor-pointer hover:bg-primary/5 transition-colors">
            ← Back to Home
          </button>
        </Link>
      </div>
    );
  }

  const { doctor, certifications, cases } = data;
  const initials = doctor.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "DR";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6">
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
      <div className="px-8 sm:px-12 pt-4">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-muted-foreground text-xs bg-transparent border-none cursor-pointer hover:text-foreground transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />Back
          </button>
        </Link>
      </div>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 sm:px-12 pt-10 pb-8">
        <div className="flex items-start gap-8 flex-wrap">

          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-full bg-primary/20 blur-xl pointer-events-none" />
            {doctor.imageUrl ? (
              <img
                src={doctor.imageUrl}
                alt={doctor.name}
                className="relative w-[120px] h-[120px] rounded-full object-cover border-2 border-primary/30"
              />
            ) : (
              <div className="relative w-[120px] h-[120px] rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center text-4xl font-extrabold text-primary">
                {initials}
              </div>
            )}
            <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-background">
              <Stethoscope className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-[200px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-1.5">Doctor Profile</p>
            <h1 className="text-3xl font-black tracking-tight leading-tight text-foreground mb-2">Dr. {doctor.name}</h1>

            {/* Specialization + Degree — always shown */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 border ${
                doctor.specialization
                  ? "text-primary bg-primary/10 border-primary/25"
                  : "text-foreground/25 bg-foreground/[0.03] border-dashed border-foreground/10 italic"
              }`}>
                <Stethoscope className="w-[11px] h-[11px] shrink-0" />
                {doctor.specialization || "Specialization not set"}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 border ${
                doctor.degree
                  ? "text-muted-foreground bg-foreground/5 border-border"
                  : "text-foreground/25 bg-foreground/[0.03] border-dashed border-foreground/10 italic"
              }`}>
                <GraduationCap className="w-[11px] h-[11px] shrink-0" />
                {doctor.degree || "Degree not set"}
              </span>
            </div>

            {/* College — always shown */}
            <p className={`flex items-center gap-1.5 text-sm mb-2 ${
              doctor.college ? "text-muted-foreground" : "text-foreground/25 italic"
            }`}>
              <Building2 className="w-[13px] h-[13px] shrink-0" />
              {doctor.college || "University / College not specified"}
            </p>

            {/* Phone — only if filled */}
            {doctor.phone && (
              <a href={`tel:${doctor.phone}`} className="inline-flex items-center gap-1.5 text-sm text-primary no-underline mr-4 hover:underline">
                <Phone className="w-[13px] h-[13px]" />{doctor.phone}
              </a>
            )}

            {/* Experience + Languages — always shown */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 border ${
                (doctor as any).yearsOfExperience != null
                  ? "text-primary bg-primary/10 border-primary/25"
                  : "text-foreground/25 bg-foreground/[0.03] border-dashed border-foreground/10 italic"
              }`}>
                <TrendingUp className="w-[11px] h-[11px] shrink-0" />
                {(doctor as any).yearsOfExperience != null
                  ? `${(doctor as any).yearsOfExperience} yrs experience`
                  : "Experience not set"}
              </span>
              {Array.isArray((doctor as any).languages) && (doctor as any).languages.length > 0 ? (
                (doctor as any).languages.map((lang: string) => (
                  <span key={lang} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 text-muted-foreground bg-foreground/5 border border-border">
                    <Globe className="w-[11px] h-[11px]" />{lang}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 text-foreground/25 bg-foreground/[0.03] border border-dashed border-foreground/10 italic">
                  <Globe className="w-[11px] h-[11px]" />Languages not specified
                </span>
              )}
            </div>

            {/* Bio — always shown */}
            <p className={`text-sm leading-relaxed mt-4 max-w-lg ${
              doctor.bio ? "text-muted-foreground" : "text-foreground/25 italic"
            }`}>
              {doctor.bio || "Professional bio not added yet."}
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-8 sm:px-12 pb-20 space-y-14">

        {/* Certifications */}
        <section>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">Certifications & Achievements</h2>
          </div>

          {certifications.length > 0 ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {certifications.map((cert) => (
                <div key={cert.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  {cert.imageUrl && (
                    <img src={cert.imageUrl} alt={cert.title} className="w-full aspect-video object-cover block" />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                          <Star className="w-3 h-3 text-primary" />
                        </div>
                        <p className="font-bold text-sm text-foreground">{cert.title}</p>
                      </div>
                      {cert.year && (
                        <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
                          {cert.year}
                        </span>
                      )}
                    </div>
                    {cert.issuer && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-[11px] h-[11px] shrink-0" />{cert.issuer}
                      </p>
                    )}
                    {cert.description && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{cert.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/5 border border-dashed border-primary/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-primary/30" />
              </div>
              <p className="text-sm font-bold text-foreground/30">Certifications & achievements will appear here</p>
              <p className="text-xs text-muted-foreground/50 italic">This doctor hasn't added any certifications yet</p>
            </div>
          )}
        </section>

        {/* Case Studies */}
        <section>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">Case Studies</h2>
          </div>

          {cases.length > 0 ? (
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {cases.map((c) => {
                const media: string[] = c.mediaUrls || [];
                const tags: string[] = c.tags || [];
                const hasAnyMedia = media[0] || media[1];
                return (
                  <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                    {hasAnyMedia && (
                      <div className="p-3 bg-black/10 dark:bg-black/30 grid grid-cols-2 gap-2">
                        {(["Before", "After"] as const).map((label, i) =>
                          media[i] ? (
                            <div key={i} className="relative">
                              <MediaThumb url={media[i]} onClick={() => setLightboxUrl(media[i])} />
                              <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider text-white bg-black/65 backdrop-blur-sm rounded px-1.5 py-0.5">
                                {label}
                              </span>
                            </div>
                          ) : (
                            <div key={i} className="aspect-video rounded-xl border border-dashed border-border flex items-center justify-center">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">{label}</span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                          <BookOpen className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                        </div>
                        <p className="font-bold text-sm text-foreground">{c.title}</p>
                      </div>
                      {c.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{c.description}</p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag: string, i: number) => (
                            <span key={i} className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/15 rounded-full px-2 py-0.5">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-violet-500/25 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-violet-500/5 border border-dashed border-violet-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-violet-400/40" />
              </div>
              <p className="text-sm font-bold text-foreground/30">Clinical case studies will appear here</p>
              <p className="text-xs text-muted-foreground/50 italic">This doctor hasn't published any case studies yet</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
