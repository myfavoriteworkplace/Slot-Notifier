import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Stethoscope, GraduationCap, Building2, Phone, Award, BookOpen,
  Star, Play, ChevronLeft, TrendingUp, Globe, AlertCircle, RefreshCw
} from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com");
}

function MediaThumb({ url, onClick }: { url: string; onClick: () => void }) {
  if (isVideo(url)) {
    return (
      <div
        onClick={onClick}
        className="relative rounded-xl overflow-hidden bg-black/50 border border-border cursor-pointer flex items-center justify-center aspect-video active:scale-[0.98] transition-transform"
      >
        <div className="absolute inset-0 bg-primary/5" />
        <Play className="w-8 h-8 text-primary relative z-10" />
        <span className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-black/70 rounded px-1.5 py-0.5">Video</span>
      </div>
    );
  }
  return (
    <div
      onClick={onClick}
      className="rounded-xl overflow-hidden border border-border cursor-pointer aspect-video active:scale-[0.98] transition-transform"
    >
      <img src={url} alt="Case" className="w-full h-full object-cover block" />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-10 space-y-10">
      {/* Hero skeleton */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <Skeleton className="w-[120px] h-[120px] rounded-full shrink-0" />
        <div className="flex-1 w-full space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-7 w-32 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <div className="space-y-1.5 mt-2">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-3/4 max-w-sm" />
          </div>
        </div>
      </div>

      {/* Section skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card shadow-sm p-5 space-y-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      {/* Second section skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <Skeleton className="w-full aspect-video" />
              <div className="p-5 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DoctorPublicProfile() {
  const params = useParams<{ id: string }>();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ doctor: any; certifications: any[]; cases: any[] }>({
    queryKey: [`/api/public/doctor/${params.id}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="h-[3px] bg-gradient-to-r from-primary via-accent to-primary" />
        <ProfileSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground text-center">Couldn't load this doctor's profile</p>
        <p className="text-sm text-muted-foreground text-center">This doctor may not exist or there was a connection problem.</p>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2 min-h-[44px] active:scale-[0.98] transition-transform"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
          <Link href="/">
            <Button variant="ghost" className="min-h-[44px] active:scale-[0.98] transition-transform">
              ← Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { doctor, certifications, cases } = data;
  const initials = doctor.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "DR";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-6"
        >
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
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </Link>
      </div>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 pt-6 pb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">

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
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1.5">Doctor Profile</p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight text-foreground mb-3">
              {/^dr\./i.test(doctor.name?.trim()) ? doctor.name : `Dr. ${doctor.name}`}
            </h1>

            {/* Specialization + Degree */}
            <div className="flex flex-wrap gap-2 mb-4 justify-center sm:justify-start">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border ${
                doctor.specialization
                  ? "text-primary bg-primary/10 border-primary/25"
                  : "text-foreground/25 bg-foreground/[0.03] border-dashed border-foreground/10 italic"
              }`}>
                <Stethoscope className="w-3 h-3 shrink-0" />
                {doctor.specialization || "Specialization not set"}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border ${
                doctor.degree
                  ? "text-muted-foreground bg-foreground/5 border-border"
                  : "text-foreground/25 bg-foreground/[0.03] border-dashed border-foreground/10 italic"
              }`}>
                <GraduationCap className="w-3 h-3 shrink-0" />
                {doctor.degree || "Degree not set"}
              </span>
            </div>

            {/* College */}
            <p className={`flex items-center gap-1.5 text-sm mb-2 justify-center sm:justify-start ${
              doctor.college ? "text-muted-foreground" : "text-foreground/25 italic"
            }`}>
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              {doctor.college || "University / College not specified"}
            </p>

            {/* Phone */}
            {doctor.phone && (
              <a
                href={`tel:${doctor.phone}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary no-underline min-h-[44px] px-1 hover:underline active:opacity-70 transition-opacity"
              >
                <Phone className="w-3.5 h-3.5" />{doctor.phone}
              </a>
            )}

            {/* Experience + Languages */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border ${
                (doctor as any).yearsOfExperience != null
                  ? "text-primary bg-primary/10 border-primary/25"
                  : "text-foreground/25 bg-foreground/[0.03] border-dashed border-foreground/10 italic"
              }`}>
                <TrendingUp className="w-3 h-3 shrink-0" />
                {(doctor as any).yearsOfExperience != null
                  ? `${(doctor as any).yearsOfExperience} yrs experience`
                  : "Experience not set"}
              </span>
              {Array.isArray((doctor as any).languages) && (doctor as any).languages.length > 0 ? (
                (doctor as any).languages.map((lang: string) => (
                  <span key={lang} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 text-muted-foreground bg-foreground/5 border border-border">
                    <Globe className="w-3 h-3" />{lang}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 text-foreground/25 bg-foreground/[0.03] border border-dashed border-foreground/10 italic">
                  <Globe className="w-3 h-3" />Languages not specified
                </span>
              )}
            </div>

            {/* Bio */}
            <p className={`text-sm leading-relaxed mt-4 max-w-lg mx-auto sm:mx-0 ${
              doctor.bio ? "text-muted-foreground" : "text-foreground/25 italic"
            }`}>
              {doctor.bio || "Professional bio not added yet."}
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 pb-20 space-y-14">

        {/* Certifications */}
        <section>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Certifications & Achievements</h2>
          </div>

          {certifications.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {certifications.map((cert) => (
                <div key={cert.id} className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
                  {cert.imageUrl && (
                    <img src={cert.imageUrl} alt={cert.title} className="w-full aspect-video object-cover block" />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                          <Star className="w-3 h-3 text-primary" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">{cert.title}</p>
                      </div>
                      {cert.year && (
                        <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
                          {cert.year}
                        </span>
                      )}
                    </div>
                    {cert.issuer && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3 shrink-0" />{cert.issuer}
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
            <div className="bg-card border border-dashed border-border/50 rounded-2xl shadow-sm p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/5 border border-dashed border-primary/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-primary/30" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Certifications & achievements will appear here</p>
              <p className="text-xs text-muted-foreground/70">This doctor hasn't added any certifications yet</p>
            </div>
          )}
        </section>

        {/* Case Studies */}
        <section>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Case Studies</h2>
          </div>

          {cases.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {cases.map((c) => {
                const media: string[] = c.mediaUrls || [];
                const tags: string[] = c.tags || [];
                const hasAnyMedia = media[0] || media[1];
                return (
                  <div key={c.id} className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
                    {hasAnyMedia && (
                      <div className="p-3 bg-muted/40 grid grid-cols-2 gap-2">
                        {(["Before", "After"] as const).map((label, i) =>
                          media[i] ? (
                            <div key={i} className="relative">
                              <MediaThumb url={media[i]} onClick={() => setLightboxUrl(media[i])} />
                              <span className="absolute top-1.5 left-1.5 text-xs font-bold uppercase tracking-wide text-white bg-black/75 rounded px-1.5 py-0.5">
                                {label}
                              </span>
                            </div>
                          ) : (
                            <div key={i} className="aspect-video rounded-xl border border-dashed border-border flex items-center justify-center">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/50">{label}</span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                          <BookOpen className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">{c.title}</p>
                      </div>
                      {c.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{c.description}</p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag: string, i: number) => (
                            <span key={i} className="text-xs font-semibold text-primary bg-primary/10 border border-primary/15 rounded-full px-2 py-0.5">
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
            <div className="bg-card border border-dashed border-violet-500/20 rounded-2xl shadow-sm p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-violet-500/5 border border-dashed border-violet-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-violet-400/40" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Clinical case studies will appear here</p>
              <p className="text-xs text-muted-foreground/70">This doctor hasn't published any case studies yet</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
