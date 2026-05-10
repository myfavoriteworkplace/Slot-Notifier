import { useQuery } from "@tanstack/react-query";
import { SmileDeal, Clinic } from "@shared/schema";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Play, Eye, Star, ChevronRight, Maximize2, ExternalLink, Phone, Mail, Globe, MapPin, Building2, CheckCircle2, Search, X } from "lucide-react";
import { Link } from "wouter";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "next-themes";

const GOLD = "#F0C060";
const RED  = "#FF5757";

// ── Unified palette — matches the rest of the application ──────────────────
const LIGHT = {
  bg:           "#F8F8F6",
  card:         "#FFFFFF",
  cardHover:    "#F0FAF5",
  surface:      "#EFF9F5",
  txt:          "#0A1F16",
  muted:        "#5A7A6A",
  bdr:          "rgba(0,0,0,.07)",
  bdr2:         "rgba(15,155,110,.25)",
  tL:           "#E1F5EE",
  T:            "#0F9B6E",
  T_D:          "#085041",
  shimmer:      "rgba(0,0,0,.02)",
  shine:        "rgba(255,255,255,.6)",
  ambientOrb1:  "rgba(15,155,110,.07)",
  ambientOrb2:  "rgba(15,155,110,.05)",
  ambientOrb3:  "rgba(240,192,96,.04)",
  countdownBg:  "linear-gradient(135deg,#E8F5EE 0%,#D8EFEA 100%)",
  promoClinicBg:  "linear-gradient(135deg,#E8F5EE,#D4EDE5)",
  promoLoyaltyBg: "linear-gradient(135deg,#FDF6E3,#FAF0CC)",
};

const DARK = {
  bg:           "#0A1512",
  card:         "#111C17",
  cardHover:    "#162019",
  surface:      "#0D1A14",
  txt:          "#E8F5F0",
  muted:        "#6B8F7E",
  bdr:          "rgba(255,255,255,.07)",
  bdr2:         "rgba(15,155,110,.3)",
  tL:           "rgba(15,155,110,.08)",
  T:            "#0F9B6E",
  T_D:          "#1DB887",
  shimmer:      "rgba(255,255,255,.04)",
  shine:        "rgba(255,255,255,.04)",
  ambientOrb1:  "rgba(15,155,110,.10)",
  ambientOrb2:  "rgba(15,155,110,.07)",
  ambientOrb3:  "rgba(240,192,96,.05)",
  countdownBg:  "linear-gradient(135deg,#0E1F17 0%,#091409 100%)",
  promoClinicBg:  "linear-gradient(135deg,#0A2018,#081510)",
  promoLoyaltyBg: "linear-gradient(135deg,#1A1408,#100D05)",
};

type Palette = typeof LIGHT;

// ── Helpers ────────────────────────────────────────────────────────────────
function getVideoType(url: string): "youtube" | "vimeo" | "mp4" | null {
  if (!url) return null;
  if (url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)/)) return "youtube";
  if (url.match(/vimeo\.com\/\d+/)) return "vimeo";
  if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) return "mp4";
  return null;
}

function getEmbedUrl(url: string): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}&controls=0&showinfo=0&rel=0&modestbranding=1`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1&background=1`;
  return url;
}

function useCountdown(expiresAt: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return timeLeft;
}

// ── TiltCard (patient tab only) ────────────────────────────────────────────
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [6, -6]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-6, 6]);
  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() { x.set(0); y.set(0); }
  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 1000 }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── VideoModal ─────────────────────────────────────────────────────────────
function VideoModal({ deal, open, onClose }: { deal: SmileDeal | null; open: boolean; onClose: () => void }) {
  if (!deal?.videoUrl) return null;
  const videoType = getVideoType(deal.videoUrl);
  const embedUrl = getEmbedUrl(deal.videoUrl);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-0">
        <div className="aspect-video w-full">
          {videoType === "mp4" ? (
            <video src={deal.videoUrl} controls autoPlay className="w-full h-full" />
          ) : (
            <iframe src={embedUrl.replace("&controls=0", "&controls=1").replace("background=1", "background=0")} className="w-full h-full" allow="autoplay; fullscreen" style={{ border: "none" }} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── SupplierStrip — shown at top of clinic-tab cards ──────────────────────
function SupplierStrip({ deal, c }: { deal: SmileDeal; c: Palette }) {
  const name = (deal as any).contactInfo?.sponsorName;
  if (!name) return null;
  const initial = name.charAt(0).toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${c.bdr}`, background: c.surface }}>
      <div style={{ width: 24, height: 24, borderRadius: 7, background: c.T, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{initial}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: c.txt, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 3, background: c.tL, border: `1px solid ${c.bdr2}`, borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>
        <CheckCircle2 style={{ width: 9, height: 9, color: c.T }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: c.T, letterSpacing: ".04em" }}>Verified</span>
      </div>
    </div>
  );
}

// ── FeaturedCard ──────────────────────────────────────────────────────────
function FeaturedCard({ deal, onBookClick, c, isClinic, onHoverChange }: { deal: SmileDeal; onBookClick: () => void; c: Palette; isClinic?: boolean; onHoverChange?: (h: boolean) => void }) {
  const [hovered, setHovered] = useState(false);
  function handleEnter() { setHovered(true); onHoverChange?.(true); }
  function handleLeave() { setHovered(false); onHoverChange?.(false); }
  const videoType = deal.videoUrl ? getVideoType(deal.videoUrl) : null;
  const embedUrl = deal.videoUrl ? getEmbedUrl(deal.videoUrl) : null;
  const isExpired = deal.expiresAt ? new Date(deal.expiresAt) <= new Date() : false;
  const save = (deal as any).originalPrice && deal.price
    ? parseInt((deal as any).originalPrice) - parseInt(deal.price)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        background: c.card,
        border: `1px solid ${hovered ? c.bdr2 : c.bdr}`,
        borderRadius: 24,
        overflow: "hidden",
        cursor: "pointer",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "border-color .3s, transform .4s cubic-bezier(.16,1,.3,1), box-shadow .3s",
        boxShadow: hovered ? `0 20px 60px rgba(15,155,110,.12)` : `0 2px 12px rgba(0,0,0,.06)`,
      }}
    >
      {isClinic && <SupplierStrip deal={deal} c={c} />}
      <div className="featured-inner" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
        <style>{`@media (min-width: 640px) { .featured-inner { grid-template-columns: 1fr 1fr !important; } }`}</style>
        {/* Image side */}
        <div style={{ position: "relative", overflow: "hidden", minHeight: 240 }}>
          {videoType && videoType !== "mp4" && hovered && embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen" style={{ border: "none", pointerEvents: "none", position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          ) : videoType === "mp4" && deal.videoUrl ? (
            <video src={deal.videoUrl} autoPlay={hovered} muted loop playsInline className="w-full h-full object-cover" style={{ transition: "transform .7s cubic-bezier(.16,1,.3,1)", transform: hovered ? "scale(1.05)" : "scale(1)" }} />
          ) : (
            <img
              src={deal.imageUrl} alt={deal.title}
              className="w-full h-full object-cover"
              style={{ transition: "transform .7s cubic-bezier(.16,1,.3,1)", transform: hovered ? "scale(1.05)" : "scale(1)" }}
              onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=1200"; }}
            />
          )}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg,transparent 60%,${c.card} 100%)` }} />
          {isExpired && (
            <div style={{ position: "absolute", top: 16, left: 16, background: `${RED}CC`, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>Expired</div>
          )}
        </div>

        {/* Content side */}
        <div style={{ padding: "32px 32px 32px 24px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", background: c.tL, color: c.T, border: `1px solid ${c.bdr2}` }}>
              <Star style={{ width: 10, height: 10, fill: c.T }} /> {isClinic ? "Top Supplier" : "Featured Offer"}
            </span>
            {(deal as any).subcategory && (
              <span style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", background: c.surface, color: c.muted, border: `1px solid ${c.bdr}` }}>
                {(deal as any).subcategory}
              </span>
            )}
          </div>

          <div style={{ fontSize: 26, fontWeight: 700, color: c.txt, lineHeight: 1.2, letterSpacing: "-.02em" }}>{deal.title}</div>

          {deal.description && (
            <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deal.description}</div>
          )}

          {(deal.price || (deal as any).originalPrice) && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              {deal.price && <span style={{ fontSize: 36, fontWeight: 800, color: c.T, letterSpacing: "-.03em" }}>₹{deal.price}</span>}
              {(deal as any).originalPrice && <span style={{ fontSize: 17, color: c.muted, textDecoration: "line-through" }}>₹{(deal as any).originalPrice}</span>}
              {save && save > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: RED, background: `rgba(255,87,87,.1)`, padding: "3px 8px", borderRadius: 4 }}>Save ₹{save.toLocaleString()}</span>}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isClinic ? (
              <a
                href={(deal as any).contactInfo?.website || deal.bookingLink || "#"}
                target="_blank" rel="noreferrer"
                onClick={onBookClick}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 12, background: hovered ? c.T_D : c.T, color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", transition: "background .2s" }}
              >
                {(deal as any).contactInfo?.website ? "Visit Website" : "Contact Supplier"}
                <ChevronRight style={{ width: 16, height: 16 }} />
              </a>
            ) : (
              <Link href={deal.bookingLink}>
                <button
                  onClick={onBookClick}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 12, background: hovered ? c.T_D : c.T, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", transition: "background .2s" }}
                >
                  Book Now <ChevronRight style={{ width: 16, height: 16 }} />
                </button>
              </Link>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: c.muted, fontSize: 13 }}>
              <Eye style={{ width: 14, height: 14 }} />
              {deal.viewCount ?? 0} views
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── FlashCard ──────────────────────────────────────────────────────────────
function FlashCard({ deal, gridMode, c, isClinic }: { deal: SmileDeal; gridMode?: boolean; c: Palette; isClinic?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const save = (deal as any).originalPrice && deal.price
    ? parseInt((deal as any).originalPrice) - parseInt(deal.price)
    : null;

  const inner = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...(gridMode ? {} : { flex: "0 0 260px", scrollSnapAlign: "start" }),
        background: hovered ? c.cardHover : c.card,
        border: `1px solid ${hovered ? c.bdr2 : c.bdr}`,
        borderRadius: 16,
        padding: 20,
        cursor: "pointer",
        transition: "border-color .3s, transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered ? `0 16px 40px rgba(15,155,110,.10)` : "none",
        position: "relative",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: gridMode ? 16 : 0, flexDirection: gridMode ? "row" : "column" }}>
        <div style={{ width: gridMode ? 80 : 48, height: gridMode ? 80 : 48, flexShrink: 0, borderRadius: 12, overflow: "hidden", marginBottom: gridMode ? 0 : 14, background: c.surface }}>
          <img src={deal.imageUrl} alt={deal.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=200"; }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: gridMode ? 15 : 14, fontWeight: 700, color: c.txt, marginBottom: 5 }}>{deal.title}</div>
          {deal.description && <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: gridMode ? 3 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deal.description}</div>}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            {deal.price && <span style={{ fontSize: gridMode ? 22 : 20, fontWeight: 800, color: c.T }}>₹{deal.price}</span>}
            {(deal as any).originalPrice && <span style={{ fontSize: 13, color: c.muted, textDecoration: "line-through" }}>₹{(deal as any).originalPrice}</span>}
            {save && save > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: RED, background: `rgba(255,87,87,.1)`, padding: "2px 6px", borderRadius: 4, marginLeft: 2 }}>-₹{save}</span>}
          </div>
        </div>
      </div>
      <span style={{ position: "absolute", top: 12, right: 12, fontSize: 11, fontWeight: 700, color: GOLD, background: `rgba(240,192,96,.12)`, border: `1px solid rgba(240,192,96,.25)`, padding: "2px 7px", borderRadius: 6 }}>
        {isClinic ? "⏱ Limited" : "⚡ Flash"}
      </span>
    </div>
  );

  if (isClinic) {
    return (
      <a href={(deal as any).contactInfo?.website || deal.bookingLink || "#"} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
        {inner}
      </a>
    );
  }
  return <Link href={deal.bookingLink}>{inner}</Link>;
}

// ── PlaceholderCard ────────────────────────────────────────────────────────
function PlaceholderCard({ c }: { c: Palette }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} style={{ height: "100%" }}>
      <div style={{ background: c.card, border: `1px dashed ${c.bdr}`, borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", minHeight: 300, opacity: 0.5 }}>
        <div style={{ height: 196, background: c.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 40, opacity: 0.25 }}>🦷</span>
        </div>
        <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
          <div style={{ height: 14, background: c.shimmer, borderRadius: 6, width: "65%" }} />
          <div style={{ height: 11, background: c.shimmer, borderRadius: 6, width: "85%" }} />
          <div style={{ height: 11, background: c.shimmer, borderRadius: 6, width: "55%" }} />
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: `1px solid ${c.bdr}`, display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: c.muted, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.5 }}>More deals coming soon</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── CountdownCard ──────────────────────────────────────────────────────────
function CountdownCard({ deal, c }: { deal: SmileDeal; c: Palette }) {
  const timeLeft = useCountdown(deal.expiresAt ? String(deal.expiresAt) : null);
  const [colonVisible, setColonVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setColonVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, []);
  if (!timeLeft) return null;
  const units = [
    { label: "Hours", value: timeLeft.hours },
    { label: "Mins",  value: timeLeft.minutes },
    { label: "Secs",  value: timeLeft.seconds },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      style={{ background: c.countdownBg, border: `1px solid ${c.bdr2}`, borderRadius: 20, padding: "36px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24, position: "relative", overflow: "hidden", marginBottom: 48 }}
    >
      <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle,${c.ambientOrb1},transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: RED, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: RED, display: "inline-block", animation: "dealpulse 1.2s ease-in-out infinite" }} />
          Limited Time Offer
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: c.txt, marginBottom: 6, letterSpacing: "-.02em" }}>{deal.title}</div>
        {deal.description && <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.5 }}>{deal.description}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {units.map((unit, i) => (
          <div key={unit.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ display: "block", fontSize: 36, fontWeight: 800, color: c.T, letterSpacing: "-.04em", background: c.surface, border: `1px solid ${c.bdr}`, borderRadius: 10, padding: "6px 14px", minWidth: 64, textAlign: "center" }}>
                {String(unit.value).padStart(2, "0")}
              </span>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 5, letterSpacing: ".06em" }}>{unit.label}</div>
            </div>
            {i < 2 && <span style={{ fontSize: 28, fontWeight: 700, color: c.muted, marginBottom: 14, opacity: colonVisible ? 1 : 0.2, transition: "opacity .1s" }}>:</span>}
          </div>
        ))}
      </div>
      <Link href={deal.bookingLink}>
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: c.T, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
          Grab Deal <ChevronRight style={{ width: 16, height: 16 }} />
        </button>
      </Link>
    </motion.div>
  );
}

// ── DealCard ───────────────────────────────────────────────────────────────
function DealCard({ deal, index, onVideoOpen, c, isClinic }: { deal: SmileDeal; index: number; onVideoOpen: (d: SmileDeal) => void; c: Palette; isClinic?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoType = deal.videoUrl ? getVideoType(deal.videoUrl) : null;
  const embedUrl = (deal.videoUrl && videoType && videoType !== "mp4") ? getEmbedUrl(deal.videoUrl) : null;
  const isExpired = deal.expiresAt ? new Date(deal.expiresAt) <= new Date() : false;
  const save = (deal as any).originalPrice && deal.price
    ? parseInt((deal as any).originalPrice) - parseInt(deal.price)
    : null;

  function handleEnter() {
    setHovered(true);
    if (!isClinic && videoType === "mp4" && videoRef.current) videoRef.current.play().catch(() => {});
  }
  function handleLeave() {
    setHovered(false);
    if (!isClinic && videoType === "mp4" && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }

  const cardInner = (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        background: hovered ? c.cardHover : c.card,
        border: `1px solid ${hovered ? c.bdr2 : c.bdr}`,
        borderRadius: 20,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color .3s, transform .35s cubic-bezier(.16,1,.3,1), box-shadow .3s",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered ? `0 16px 40px rgba(15,155,110,.10)` : `0 1px 4px rgba(0,0,0,.04)`,
        display: "flex", flexDirection: "column",
        height: "100%",
        opacity: isExpired ? 0.55 : 1,
        position: "relative",
      }}
    >
      {/* Shine overlay — patient tab only */}
      {!isClinic && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 20, background: `linear-gradient(135deg,${c.shine} 0%,transparent 50%)`, opacity: hovered ? 1 : 0, transition: "opacity .3s" }} />
      )}

      {/* Supplier strip — clinic tab: above image */}
      {isClinic && <SupplierStrip deal={deal} c={c} />}

      {/* Media */}
      <div style={{ position: "relative", height: 180, overflow: "hidden", flexShrink: 0 }}>
        <img
          src={deal.imageUrl} alt={deal.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.92)", transition: "transform .6s cubic-bezier(.16,1,.3,1), opacity .5s", transform: hovered && !isClinic && videoType ? "scale(1)" : hovered ? "scale(1.06)" : "scale(1)", opacity: hovered && !isClinic && videoType ? 0 : 1 }}
          onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800"; }}
        />
        {!isClinic && videoType === "mp4" && deal.videoUrl && (
          <video ref={videoRef} src={deal.videoUrl} muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: hovered ? 1 : 0, transition: "opacity .5s" }} />
        )}
        {!isClinic && videoType && videoType !== "mp4" && embedUrl && hovered && (
          <div style={{ position: "absolute", inset: 0 }}>
            <iframe src={embedUrl} style={{ width: "100%", height: "100%", border: "none", pointerEvents: "none" }} allow="autoplay; fullscreen" />
            <button onClick={() => onVideoOpen(deal)} style={{ position: "absolute", bottom: 8, right: 8, padding: 6, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.2)", cursor: "pointer" }}>
              <Maximize2 style={{ width: 13, height: 13, color: "#fff" }} />
            </button>
          </div>
        )}

        {/* Subcategory badge */}
        {(deal as any).subcategory && (
          <span style={{ position: "absolute", top: 10, left: 10, zIndex: 3, background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,.9)", fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 5 }}>
            {(deal as any).subcategory}
          </span>
        )}
        {deal.isFeatured && (
          <span style={{ position: "absolute", top: 10, left: (deal as any).subcategory ? 108 : 10, zIndex: 3, display: "inline-flex", alignItems: "center", gap: 3, background: c.T, color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 9999 }}>
            <Star style={{ width: 8, height: 8, fill: "#fff" }} /> Featured
          </span>
        )}
        {isExpired && (
          <span style={{ position: "absolute", top: 10, right: 10, zIndex: 3, background: `${RED}CC`, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5 }}>Expired</span>
        )}
        {deal.price && !isClinic && (
          <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 3, background: c.T, color: "#fff", fontSize: 13, fontWeight: 800, padding: "4px 10px", borderRadius: 7 }}>
            ₹{deal.price}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", flex: 1, gap: 9 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.txt, letterSpacing: "-.01em", marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deal.title}</div>
          {deal.description && (
            <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deal.description}</div>
          )}
        </div>

        {/* Price row — clinic tab shows price here */}
        {isClinic && (deal.price || (deal as any).originalPrice) && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            {deal.price && <span style={{ fontSize: 20, fontWeight: 800, color: c.T, letterSpacing: "-.02em" }}>₹{deal.price}</span>}
            {(deal as any).originalPrice && <span style={{ fontSize: 13, color: c.muted, textDecoration: "line-through" }}>₹{(deal as any).originalPrice}</span>}
          </div>
        )}

        {save && save > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: `rgba(255,87,87,.1)`, color: RED, width: "fit-content" }}>
            Save ₹{save.toLocaleString()}
          </div>
        )}

        {/* Clinic contact links */}
        {isClinic && (deal as any).contactInfo && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 4 }}>
            {(deal as any).contactInfo.phone && (
              <a href={`tel:${(deal as any).contactInfo.phone}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.T, textDecoration: "none" }}>
                <Phone style={{ width: 10, height: 10 }} />{(deal as any).contactInfo.phone}
              </a>
            )}
            {(deal as any).contactInfo.email && (
              <a href={`mailto:${(deal as any).contactInfo.email}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.T, textDecoration: "none" }}>
                <Mail style={{ width: 10, height: 10 }} />{(deal as any).contactInfo.email}
              </a>
            )}
            {(deal as any).contactInfo.website && (
              <a href={(deal as any).contactInfo.website} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.T, textDecoration: "none" }}>
                <Globe style={{ width: 10, height: 10 }} />Website
              </a>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${c.bdr}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: c.muted }}>
            <Eye style={{ width: 12, height: 12 }} />
            {deal.viewCount ?? 0}
          </div>
          {isClinic ? (
            <a
              href={(deal as any).contactInfo?.website || deal.bookingLink || "#"}
              target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 9, background: hovered ? c.T_D : c.T, color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", transition: "background .2s" }}
            >
              {(deal as any).contactInfo?.website ? "Visit" : (deal as any).contactInfo?.phone ? "Contact" : "Enquire"}
              <ExternalLink style={{ width: 11, height: 11 }} />
            </a>
          ) : (
            <Link href={deal.bookingLink}>
              <button
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 9, background: hovered ? c.T_D : c.T, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", transition: "background .2s" }}
              >
                Book <ExternalLink style={{ width: 11, height: 11 }} />
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: index * 0.07 }}
      style={{ height: "100%" }}
    >
      {isClinic ? cardInner : <TiltCard className="h-full">{cardInner}</TiltCard>}
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SmileDeals() {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "dark" ? DARK : LIGHT;

  const [activeTab, setActiveTab] = useState<"clinic" | "patient">("clinic");
  const [activeSubcategory, setActiveSubcategory] = useState("All");
  const [selectedCity, setSelectedCity] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [videoModalDeal, setVideoModalDeal] = useState<SmileDeal | null>(null);
  const trackingRef = useRef(new Set<number>());
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: deals = [], isLoading } = useQuery<SmileDeal[]>({
    queryKey: ["/api/smile-deals?active=true"],
  });

  const { data: clinics = [] } = useQuery<Clinic[]>({
    queryKey: ["/api/clinics"],
  });

  const clinicCityMap = Object.fromEntries(clinics.map(cl => [cl.id, (cl as any).city as string | undefined]));

  const tabDeals = deals.filter((d) => {
    const ta = (d as any).targetAudience || "patient";
    return ta === activeTab || ta === "both";
  });

  const availableCities = Array.from(new Set(
    tabDeals
      .filter(d => (d as any).clinicId && clinicCityMap[(d as any).clinicId])
      .map(d => clinicCityMap[(d as any).clinicId] as string)
  )).sort();

  const trackView = useCallback(async (id: number) => {
    if (trackingRef.current.has(id)) return;
    trackingRef.current.add(id);
    try { await apiRequest("POST", `/api/smile-deals/${id}/view`); } catch {}
  }, []);

  const trackClick = useCallback(async (id: number) => {
    try { await apiRequest("POST", `/api/smile-deals/${id}/click`); } catch {}
  }, []);

  useEffect(() => {
    deals.forEach((d) => trackView(d.id));
  }, [deals, trackView]);

  const featuredDeals = tabDeals.filter((d) => d.isFeatured && !(d as any).isFlash);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredPaused = useRef(false);

  useEffect(() => {
    setFeaturedIndex(0);
  }, [activeTab]);

  useEffect(() => {
    if (featuredDeals.length <= 1) return;
    const id = setInterval(() => {
      if (!featuredPaused.current) {
        setFeaturedIndex((i) => (i + 1) % featuredDeals.length);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [featuredDeals.length, activeTab]);
  const flashDeals    = tabDeals.filter((d) => (d as any).isFlash);
  const subcategories = ["All", ...Array.from(new Set(tabDeals.map((d) => (d as any).subcategory).filter(Boolean) as string[]))];

  const q = searchQuery.trim().toLowerCase();

  const filteredDeals = tabDeals.filter((d) => {
    if (d.isFeatured) return false;
    if ((d as any).isFlash) return false;
    if (activeSubcategory !== "All" && (d as any).subcategory !== activeSubcategory) return false;
    if (selectedCity !== "All") {
      const clinicId = (d as any).clinicId;
      if (clinicId) {
        const city = clinicCityMap[clinicId];
        if (city !== selectedCity) return false;
      }
    }
    if (q) {
      const haystack = [
        d.title,
        d.description,
        (d as any).subcategory,
        (d as any).category,
        (d as any).contactInfo?.sponsorName,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const countdownDeal = tabDeals.find((d) => {
    if (!d.expiresAt) return false;
    if (d.isFeatured || (d as any).isFlash) return false;
    const exp = new Date(d.expiresAt).getTime();
    return exp > Date.now() && exp - Date.now() < 72 * 3600 * 1000;
  });

  const activeCount = tabDeals.filter((d) => !d.expiresAt || new Date(d.expiresAt) > new Date()).length;
  const totalViews  = tabDeals.reduce((sum, d) => sum + (d.viewCount ?? 0), 0);
  const dealsWithSavings = tabDeals.filter((d) => (d as any).originalPrice && d.price && parseInt((d as any).originalPrice) > parseInt(d.price ?? "0"));
  const avgSaving = dealsWithSavings.length > 0
    ? Math.round(dealsWithSavings.reduce((sum, d) => sum + (parseInt((d as any).originalPrice) - parseInt(d.price ?? "0")), 0) / dealsWithSavings.length)
    : null;

  if (isLoading) {
    return (
      <div style={{ background: c.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 40, height: 40, color: c.T, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ background: c.bg, color: c.txt, minHeight: "100vh", position: "relative", overflow: "hidden", transition: "background .3s, color .3s" }}>
      <style>{`
        @keyframes drift      { from{transform:translate(0,0) scale(1)} to{transform:translate(40px,60px) scale(1.1)} }
        @keyframes dealpulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.6)} }
        @keyframes dealfadeup { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dealspin   { to{transform:rotate(360deg)} }
        .deals-pad   { padding: 0 20px; }
        @media (min-width: 640px) { .deals-pad { padding: 0 48px; } }
        .deals-hero  { padding: 48px 20px 36px; }
        @media (min-width: 640px) { .deals-hero { padding: 72px 48px 52px; } }
        .deals-promo { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 80px; }
        @media (min-width: 640px) { .deals-promo { grid-template-columns: 1fr 1fr; } }
      `}</style>

      {/* Ambient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 600, height: 600, background: `radial-gradient(circle,${c.ambientOrb1} 0%,transparent 70%)`, top: -200, left: -100, borderRadius: "50%", filter: "blur(90px)", animation: "drift 18s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", width: 500, height: 500, background: `radial-gradient(circle,${c.ambientOrb2} 0%,transparent 70%)`, bottom: -100, right: -150, borderRadius: "50%", filter: "blur(90px)", animation: "drift 18s ease-in-out infinite alternate", animationDelay: "-6s" }} />
        <div style={{ position: "absolute", width: 300, height: 300, background: `radial-gradient(circle,${c.ambientOrb3} 0%,transparent 70%)`, top: "40%", left: "50%", borderRadius: "50%", filter: "blur(90px)", animation: "drift 18s ease-in-out infinite alternate", animationDelay: "-12s" }} />
      </div>

      <div style={{ position: "relative", zIndex: 2 }}>

        {/* ── Compact hero ─────────────────────────────────────────────── */}
        <section style={{ padding: "32px 20px 0" }}>
          <style>{`@media (min-width: 640px) { .deals-hero-inner { padding: 0 28px; } }`}</style>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

            {/* Headline + inline stats */}
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "8px 20px", marginBottom: 18 }}>
              <h1 style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, letterSpacing: "-.02em", color: c.txt, margin: 0 }}>
                {activeTab === "clinic"
                  ? <><span style={{ color: c.T }}>Dental Marketplace</span> — supplies, equipment & services</>
                  : <>Smile <span style={{ color: c.T }}>DEALS</span> — exclusive dental offers</>}
              </h1>
              {/* Inline stat chips */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: c.T, background: c.tL, border: `1px solid ${c.bdr2}`, borderRadius: 20, padding: "3px 10px" }}>
                  {activeCount} {activeTab === "clinic" ? "listings" : "deals"}
                </span>
                {avgSaving && avgSaving > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.muted, background: c.surface, border: `1px solid ${c.bdr}`, borderRadius: 20, padding: "3px 10px" }}>
                    Avg save ₹{avgSaving.toLocaleString()}
                  </span>
                )}
                {totalViews > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.muted, background: c.surface, border: `1px solid ${c.bdr}`, borderRadius: 20, padding: "3px 10px" }}>
                    {totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews} views
                  </span>
                )}
              </div>
            </div>

            {/* Search + tab switcher toolbar */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>

              {/* Search input */}
              <div style={{ flex: "1 1 260px", position: "relative", minWidth: 200 }}>
                <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: c.muted, pointerEvents: "none" }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === "clinic" ? "Search products, suppliers..." : "Search deals, procedures..."}
                  style={{
                    width: "100%",
                    padding: "11px 40px 11px 40px",
                    borderRadius: 12,
                    border: `1.5px solid ${searchQuery ? c.bdr2 : c.bdr}`,
                    background: c.card,
                    color: c.txt,
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color .2s",
                    boxSizing: "border-box",
                    boxShadow: searchQuery ? `0 0 0 3px rgba(15,155,110,.08)` : "none",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = c.T; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = searchQuery ? c.bdr2 : c.bdr; }}
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", color: c.muted }}
                  >
                    <X style={{ width: 15, height: 15 }} />
                  </button>
                )}
              </div>

              {/* Tab switcher */}
              <div style={{ display: "inline-flex", borderRadius: 12, border: `1px solid ${c.bdr}`, background: c.surface, padding: 3, gap: 3, flexShrink: 0 }}>
                {([
                  { key: "clinic",  label: "🏥 For Clinics" },
                  { key: "patient", label: "🧑 For Patients" },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setActiveSubcategory("All"); setSelectedCity("All"); setSearchQuery(""); }}
                    style={{
                      padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                      border: "none", cursor: "pointer",
                      background: activeTab === tab.key ? c.T : "transparent",
                      color: activeTab === tab.key ? "#fff" : c.muted,
                      transition: "all .25s cubic-bezier(.16,1,.3,1)",
                      boxShadow: activeTab === tab.key ? `0 3px 12px rgba(15,155,110,.25)` : "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

            </div>

          </motion.div>
        </section>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className="deals-pad">

          {/* Filter pills — subcategory */}
          {subcategories.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: availableCities.length > 0 ? 16 : 40, alignItems: "center" }}
            >
              <span style={{ fontSize: 12, color: c.muted, fontWeight: 500, marginRight: 4 }}>{activeTab === "clinic" ? "Type:" : "Procedure:"}</span>
              {subcategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveSubcategory(cat)}
                  style={{
                    padding: "8px 20px", borderRadius: 100, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${activeSubcategory === cat ? c.T : c.bdr}`,
                    background: activeSubcategory === cat ? c.T : "transparent",
                    color: activeSubcategory === cat ? "#fff" : c.muted,
                    cursor: "pointer", transition: "all .25s", letterSpacing: ".02em",
                  }}
                >
                  {cat}
                </button>
              ))}
            </motion.div>
          )}

          {/* City filter pills */}
          {availableCities.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 40, alignItems: "center" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: c.muted, fontWeight: 500, marginRight: 4 }}>
                <MapPin style={{ width: 12, height: 12 }} /> City:
              </span>
              {["All", ...availableCities].map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  style={{
                    padding: "7px 18px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${selectedCity === city ? c.bdr2 : c.bdr}`,
                    background: selectedCity === city ? c.tL : "transparent",
                    color: selectedCity === city ? c.T : c.muted,
                    cursor: "pointer", transition: "all .25s", letterSpacing: ".02em",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {city !== "All" && <MapPin style={{ width: 10, height: 10 }} />}
                  {city}
                </button>
              ))}
            </motion.div>
          )}

          {/* Featured cards carousel */}
          {featuredDeals.length > 0 && (
            <div style={{ marginBottom: 48 }}>
              <div style={{ position: "relative" }}>
                <AnimatePresence mode="wait">
                  {(() => {
                    const safeIdx = featuredIndex % featuredDeals.length;
                    const deal = featuredDeals[safeIdx];
                    return (
                      <motion.div
                        key={deal.id}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <FeaturedCard
                          deal={deal}
                          onBookClick={() => trackClick(deal.id)}
                          c={c}
                          isClinic={activeTab === "clinic"}
                          onHoverChange={(h) => { featuredPaused.current = h; }}
                        />
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                {/* Dot indicators — only when more than one featured deal */}
                {featuredDeals.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                    {featuredDeals.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setFeaturedIndex(i); featuredPaused.current = false; }}
                        style={{
                          width: i === featuredIndex % featuredDeals.length ? 24 : 8,
                          height: 8,
                          borderRadius: 4,
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          background: i === featuredIndex % featuredDeals.length ? c.T : c.bdr2,
                          transition: "width .3s cubic-bezier(.16,1,.3,1), background .3s",
                        }}
                        aria-label={`Go to featured deal ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flash / Limited-Time strip */}
          {flashDeals.length > 0 && (
            <div style={{ marginBottom: 52 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c.txt, letterSpacing: "-.02em" }}>
                  {activeTab === "clinic"
                    ? <><span style={{ color: GOLD }}>⏱</span> Limited-Time Offers</>
                    : <><span style={{ color: GOLD }}>⚡</span> Flash Deals</>}
                </div>
              </div>
              {flashDeals.length >= 3 ? (
                <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12, scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
                  {flashDeals.map((d) => <FlashCard key={d.id} deal={d} c={c} isClinic={activeTab === "clinic"} />)}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${flashDeals.length}, 1fr)`, gap: 16 }}>
                  {flashDeals.map((d) => <FlashCard key={d.id} deal={d} gridMode c={c} isClinic={activeTab === "clinic"} />)}
                </div>
              )}
            </div>
          )}

          {/* Countdown — patient tab only */}
          {activeTab === "patient" && countdownDeal && <CountdownCard deal={countdownDeal} c={c} />}

          {/* Deals grid */}
          {tabDeals.length === 0 ? (
            activeTab === "clinic" ? (
              /* Clinic empty state — supplier CTA */
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", padding: "64px 0 80px" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: c.tL, border: `1px solid ${c.bdr2}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <Building2 style={{ width: 32, height: 32, color: c.T }} />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: c.txt, marginBottom: 10, letterSpacing: "-.01em" }}>No supplier listings yet</h3>
                <p style={{ fontSize: 15, color: c.muted, maxWidth: 440, margin: "0 auto 28px", lineHeight: 1.65 }}>
                  Equipment, consumables, software, and training deals from verified dental suppliers will appear here.
                </p>
                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                    {["Equipment & Chairs", "Consumables", "Software", "Training & CPD", "Lab Services"].map(cat => (
                      <span key={cat} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.tL, color: c.T, border: `1px solid ${c.bdr2}` }}>{cat}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: c.muted }}>Are you a dental supplier?</p>
                  <a
                    href="mailto:hello@bookmyslot.in?subject=List my product on Smile Deals"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", borderRadius: 100, background: c.T, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: `0 4px 18px rgba(15,155,110,.25)` }}
                  >
                    <Mail style={{ width: 14, height: 14 }} />
                    Get Listed →
                  </a>
                </div>
              </motion.div>
            ) : (
              /* Patient empty state */
              <div style={{ textAlign: "center", padding: "80px 0", color: c.muted }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🦷</div>
                <p style={{ fontSize: 18, fontWeight: 600, color: c.txt, marginBottom: 8 }}>No patient deals yet</p>
                <p style={{ fontSize: 14 }}>Check back soon for exclusive offers.</p>
              </div>
            )
          ) : (
            <>
              {filteredDeals.length > 0 && (() => {
                const count = filteredDeals.length;
                const noFilters = activeSubcategory === "All" && selectedCity === "All";
                const placeholderCount = noFilters && count < 3 ? 3 - count : 0;
                const gridCols = count === 1
                  ? "minmax(0, 480px)"
                  : count === 2 && placeholderCount === 0
                  ? "repeat(2, minmax(0, 1fr))"
                  : "repeat(auto-fill, minmax(280px, 1fr))";
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: c.txt, letterSpacing: "-.02em" }}>
                        All <span style={{ color: c.T }}>{activeTab === "clinic" ? "Listings" : "Deals"}</span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: gridCols, justifyContent: count < 3 ? "center" : "start", gap: 20, marginBottom: 60 }}>
                      {filteredDeals.map((deal, i) => (
                        <DealCard key={deal.id} deal={deal} index={i} onVideoOpen={(d) => setVideoModalDeal(d)} c={c} isClinic={activeTab === "clinic"} />
                      ))}
                      {Array.from({ length: placeholderCount }).map((_, i) => (
                        <PlaceholderCard key={`ph-${i}`} c={c} />
                      ))}
                    </div>
                  </>
                );
              })()}
              {filteredDeals.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: c.muted }}>
                  <p style={{ fontSize: 16 }}>
                    {activeSubcategory !== "All"
                      ? `No ${activeSubcategory} ${activeTab === "clinic" ? "listings" : "deals"} right now.`
                      : selectedCity !== "All"
                      ? `No ${activeTab === "clinic" ? "listings" : "deals"} available in ${selectedCity} right now.`
                      : "No items match your current filters."}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Bottom promo — per tab ──────────────────────────────── */}
          <div className="deals-promo">
            {activeTab === "clinic" ? (
              <>
                {/* Get Listed */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  style={{ background: `linear-gradient(135deg,#085041 0%,#0F9B6E 100%)`, border: `1px solid ${c.bdr2}`, borderRadius: 18, padding: 32, position: "relative", overflow: "hidden", cursor: "pointer" }}
                  whileHover={{ y: -6 }}
                >
                  <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.05)", pointerEvents: "none" }} />
                  <div style={{ fontSize: 38, marginBottom: 14 }}>📦</div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.65)", marginBottom: 10 }}>For Suppliers</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-.01em" }}>List Your Product,<br />Reach 50+ Clinics</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,.65)", lineHeight: 1.6, marginBottom: 20 }}>Are you a dental supplier, equipment vendor, or training provider? Get listed on bookMySlot and reach verified dental practices across Kerala.</div>
                  <a
                    href="mailto:hello@bookmyslot.in?subject=List my product on Smile Deals"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#fff", color: "#085041", textDecoration: "none", transition: "opacity .15s" }}
                  >
                    <Mail style={{ width: 13, height: 13 }} />
                    Get Listed →
                  </a>
                </motion.div>

                {/* Verified suppliers placeholder */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  style={{ background: c.card, border: `1px solid ${c.bdr}`, borderRadius: 18, padding: 32, position: "relative", overflow: "hidden", boxShadow: `0 2px 12px rgba(0,0,0,.04)` }}
                >
                  <div style={{ fontSize: 38, marginBottom: 14 }}>✅</div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: c.T, marginBottom: 10 }}>Verified Suppliers</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.txt, marginBottom: 8, letterSpacing: "-.01em" }}>Only Vetted,<br />Trusted Suppliers</div>
                  <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6, marginBottom: 20 }}>Every supplier listed on Smile Deals goes through a verification process. Clinic owners can contact and transact with confidence.</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {["Equipment", "Consumables", "Software", "Training"].map(tag => (
                      <span key={tag} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.tL, color: c.T, border: `1px solid ${c.bdr2}` }}>{tag}</span>
                    ))}
                  </div>
                </motion.div>
              </>
            ) : (
              <>
                {/* Refer a Clinic */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  style={{ background: c.promoClinicBg, border: `1px solid ${c.bdr2}`, borderRadius: 18, padding: 32, position: "relative", overflow: "hidden", cursor: "pointer" }}
                  whileHover={{ y: -6 }}
                >
                  <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${c.ambientOrb1},transparent 70%)`, pointerEvents: "none" }} />
                  <div style={{ fontSize: 38, marginBottom: 14 }}>🏥</div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: c.T, marginBottom: 10 }}>Partner Clinics</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.txt, marginBottom: 8, letterSpacing: "-.01em" }}>Refer a Clinic,<br />Unlock Exclusive Deals</div>
                  <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6, marginBottom: 20 }}>Know a great dental clinic? Refer them to bookMySlot and unlock exclusive deal access for both of you.</div>
                  <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: c.T, color: "#fff", border: "none", cursor: "pointer" }}>
                    Refer Now →
                  </button>
                </motion.div>

                {/* Loyalty Rewards */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  style={{ background: c.promoLoyaltyBg, border: `1px solid rgba(240,192,96,.25)`, borderRadius: 18, padding: 32, position: "relative", overflow: "hidden" }}
                >
                  <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,${c.ambientOrb3},transparent 70%)`, pointerEvents: "none" }} />
                  <div style={{ fontSize: 38, marginBottom: 14 }}>🎁</div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: GOLD, marginBottom: 10 }}>Loyalty Rewards</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.txt, marginBottom: 8, letterSpacing: "-.01em" }}>Book 3, Get 1<br />Completely Free</div>
                  <div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6, marginBottom: 20 }}>Book any 3 deals this month and your 4th appointment is on us. No catches, no fine print.</div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700, background: "rgba(240,192,96,.12)", color: GOLD, border: "1px solid rgba(240,192,96,.25)" }}>
                    ✦ Coming Soon
                  </span>
                </motion.div>
              </>
            )}
          </div>

        </div>
      </div>

      <VideoModal deal={videoModalDeal} open={!!videoModalDeal} onClose={() => setVideoModalDeal(null)} />
    </div>
  );
}
