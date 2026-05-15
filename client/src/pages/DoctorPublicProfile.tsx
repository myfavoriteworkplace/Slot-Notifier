import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, Stethoscope, GraduationCap, Building2, Phone, Mail, Award, BookOpen, Star, Tag, Play, ExternalLink, ChevronLeft, TrendingUp, Globe } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const TEAL = "#0FCE8A";
const BG = "#080D0B";
const CARD = "#0E1612";
const BORDER = "rgba(15,206,138,0.12)";
const TEXT = "#E8F5F0";
const MUTED = "rgba(232,245,240,0.45)";

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com");
}

function MediaThumb({ url, onClick }: { url: string; onClick: () => void }) {
  if (isVideo(url)) {
    return (
      <div onClick={onClick} style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,.5)", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "16/9" }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(15,206,138,.06)" }} />
        <Play style={{ width: 32, height: 32, color: TEAL }} />
        <span style={{ position: "absolute", bottom: 8, left: 8, fontSize: 10, color: MUTED, background: "rgba(0,0,0,.6)", borderRadius: 4, padding: "2px 6px" }}>Video</span>
      </div>
    );
  }
  return (
    <div onClick={onClick} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDER}`, cursor: "pointer", aspectRatio: "16/9" }}>
      <img src={url} alt="Case" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 36, height: 36, color: TEAL, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>Doctor not found</p>
        <Link href="/">
          <button style={{ color: TEAL, fontSize: 13, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 20px", background: "transparent", cursor: "pointer" }}>
            ← Back to Home
          </button>
        </Link>
      </div>
    );
  }

  const { doctor, certifications, cases } = data;
  const initials = doctor.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "DR";

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Sora', sans-serif", color: TEXT }}>
      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {isVideo(lightboxUrl) ? (
            <video src={lightboxUrl} controls autoPlay style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 16 }} />
          ) : (
            <img src={lightboxUrl} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 16, objectFit: "contain" }} />
          )}
        </div>
      )}

      {/* Top neon bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${TEAL}, #0A9E6A, ${TEAL})` }} />

      {/* Back link */}
      <div style={{ padding: "16px 48px 0" }}>
        <Link href="/">
          <button style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 12, background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>
            <ChevronLeft style={{ width: 14, height: 14 }} />Back
          </button>
        </Link>
      </div>

      {/* Hero */}
      <section style={{ padding: "48px 48px 40px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 32, flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: -4, borderRadius: "50%", background: `radial-gradient(circle, ${TEAL}55, transparent 70%)`, filter: "blur(12px)" }} />
            {doctor.imageUrl ? (
              <img src={doctor.imageUrl} alt={doctor.name} style={{ position: "relative", width: 120, height: 120, borderRadius: "50%", objectFit: "cover", border: `2px solid ${TEAL}55` }} />
            ) : (
              <div style={{ position: "relative", width: 120, height: 120, borderRadius: "50%", background: `linear-gradient(135deg, ${TEAL}33, #0A9E6A22)`, border: `2px solid ${TEAL}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 800, color: TEAL }}>
                {initials}
              </div>
            )}
            <div style={{ position: "absolute", bottom: 4, right: 4, width: 28, height: 28, borderRadius: "50%", background: TEAL, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${BG}` }}>
              <Stethoscope style={{ width: 14, height: 14, color: "#050E09" }} />
            </div>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: TEAL, marginBottom: 6 }}>Doctor Profile</p>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 8, lineHeight: 1.1 }}>Dr. {doctor.name}</h1>

            {/* Specialization + Degree badges — always shown */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: doctor.specialization ? TEAL : "rgba(232,245,240,0.2)", background: doctor.specialization ? `${TEAL}18` : "rgba(255,255,255,.03)", border: `1px ${doctor.specialization ? "solid" : "dashed"} ${doctor.specialization ? `${TEAL}33` : "rgba(232,245,240,0.12)"}`, borderRadius: 100, padding: "4px 12px", fontStyle: doctor.specialization ? "normal" : "italic" }}>
                <Stethoscope style={{ width: 11, height: 11 }} />{doctor.specialization || "Specialization not set"}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: doctor.degree ? MUTED : "rgba(232,245,240,0.2)", background: "rgba(255,255,255,.05)", border: `1px ${doctor.degree ? "solid" : "dashed"} ${doctor.degree ? BORDER : "rgba(232,245,240,0.12)"}`, borderRadius: 100, padding: "4px 12px", fontStyle: doctor.degree ? "normal" : "italic" }}>
                <GraduationCap style={{ width: 11, height: 11 }} />{doctor.degree || "Degree not set"}
              </span>
            </div>

            {/* College — always shown */}
            <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: doctor.college ? MUTED : "rgba(232,245,240,0.2)", marginBottom: 8, fontStyle: doctor.college ? "normal" : "italic" }}>
              <Building2 style={{ width: 13, height: 13 }} />{doctor.college || "University / College not specified"}
            </p>

            {/* Phone — only shown if filled */}
            {doctor.phone && (
              <a href={`tel:${doctor.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: TEAL, textDecoration: "none", marginRight: 16 }}>
                <Phone style={{ width: 13, height: 13 }} />{doctor.phone}
              </a>
            )}

            {/* Years of experience + languages — always shown */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: (doctor as any).yearsOfExperience != null ? TEAL : "rgba(232,245,240,0.2)", background: (doctor as any).yearsOfExperience != null ? `${TEAL}18` : "rgba(255,255,255,.03)", border: `1px ${(doctor as any).yearsOfExperience != null ? "solid" : "dashed"} ${(doctor as any).yearsOfExperience != null ? `${TEAL}33` : "rgba(232,245,240,0.12)"}`, borderRadius: 100, padding: "4px 12px", fontStyle: (doctor as any).yearsOfExperience != null ? "normal" : "italic" }}>
                <TrendingUp style={{ width: 11, height: 11 }} />{(doctor as any).yearsOfExperience != null ? `${(doctor as any).yearsOfExperience} yrs experience` : "Experience not set"}
              </span>
              {Array.isArray((doctor as any).languages) && (doctor as any).languages.length > 0 ? (doctor as any).languages.map((lang: string) => (
                <span key={lang} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: MUTED, background: "rgba(255,255,255,.05)", border: `1px solid ${BORDER}`, borderRadius: 100, padding: "4px 12px" }}>
                  <Globe style={{ width: 11, height: 11 }} />{lang}
                </span>
              )) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "rgba(232,245,240,0.2)", background: "rgba(255,255,255,.03)", border: "1px dashed rgba(232,245,240,0.12)", borderRadius: 100, padding: "4px 12px", fontStyle: "italic" }}>
                  <Globe style={{ width: 11, height: 11 }} />Languages not specified
                </span>
              )}
            </div>

            {/* Bio — always shown */}
            <p style={{ fontSize: 14, lineHeight: 1.65, marginTop: 16, maxWidth: 520, color: doctor.bio ? MUTED : "rgba(232,245,240,0.2)", fontStyle: doctor.bio ? "normal" : "italic" }}>
              {doctor.bio || "Professional bio not added yet."}
            </p>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 48px 80px" }}>

        {/* Certifications — always shown */}
        <section style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${TEAL}, #0A9E6A)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Award style={{ width: 16, height: 16, color: "#050E09" }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>Certifications & Achievements</h2>
          </div>

          {certifications.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {certifications.map((cert) => (
                <div key={cert.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden" }}>
                  {cert.imageUrl && (
                    <img src={cert.imageUrl} alt={cert.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                  )}
                  <div style={{ padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 7, background: `linear-gradient(135deg, ${TEAL}44, #0A9E6A33)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Star style={{ width: 12, height: 12, color: TEAL }} />
                        </div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{cert.title}</p>
                      </div>
                      {cert.year && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: TEAL, background: `${TEAL}18`, border: `1px solid ${TEAL}33`, borderRadius: 100, padding: "2px 8px", whiteSpace: "nowrap" }}>{cert.year}</span>
                      )}
                    </div>
                    {cert.issuer && <p style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 4 }}><Building2 style={{ width: 11, height: 11 }} />{cert.issuer}</p>}
                    {cert.description && <p style={{ fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.55 }}>{cert.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 20, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${TEAL}10`, border: `1px dashed ${TEAL}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award style={{ width: 20, height: 20, color: `${TEAL}55` }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(232,245,240,0.25)" }}>Certifications & achievements will appear here</p>
              <p style={{ fontSize: 12, color: "rgba(232,245,240,0.15)", fontStyle: "italic" }}>This doctor hasn't added any certifications yet</p>
            </div>
          )}
        </section>

        {/* Case Studies — always shown */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, #7C3AED, #4F46E5)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen style={{ width: 16, height: 16, color: "#fff" }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>Case Studies</h2>
          </div>

          {cases.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              {cases.map((c) => {
                const media: string[] = c.mediaUrls || [];
                const tags: string[] = c.tags || [];
                const hasAnyMedia = media[0] || media[1];
                return (
                  <div key={c.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden" }}>
                    {hasAnyMedia && (
                      <div style={{ padding: 12, background: "rgba(0,0,0,.3)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {(["Before", "After"] as const).map((label, i) =>
                          media[i] ? (
                            <div key={i} style={{ position: "relative" }}>
                              <MediaThumb url={media[i]} onClick={() => setLightboxUrl(media[i])} />
                              <span style={{ position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)", borderRadius: 5, padding: "2px 7px" }}>{label}</span>
                            </div>
                          ) : (
                            <div key={i} style={{ aspectRatio: "16/9", borderRadius: 12, border: `1px dashed ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, opacity: 0.5 }}>{label}</span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                    <div style={{ padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <BookOpen style={{ width: 12, height: 12, color: "#A78BFA" }} />
                        </div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</p>
                      </div>
                      {c.description && <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: tags.length ? 12 : 0 }}>{c.description}</p>}
                      {tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {tags.map((tag: string, i: number) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 600, color: TEAL, background: `${TEAL}18`, border: `1px solid ${TEAL}22`, borderRadius: 100, padding: "2px 8px" }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: CARD, border: "1px dashed rgba(124,58,237,0.2)", borderRadius: 20, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(124,58,237,0.08)", border: "1px dashed rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen style={{ width: 20, height: 20, color: "rgba(167,139,250,0.4)" }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(232,245,240,0.25)" }}>Clinical case studies will appear here</p>
              <p style={{ fontSize: 12, color: "rgba(232,245,240,0.15)", fontStyle: "italic" }}>This doctor hasn't published any case studies yet</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
