import { useQuery } from "@tanstack/react-query";
import { SmileDeal, Clinic } from "@shared/schema";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Play, Eye, Timer, Star, ChevronRight, Maximize2, ExternalLink, Phone, Mail, Globe, MapPin } from "lucide-react";
import { Link } from "wouter";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

const TEAL = "#0FCE8A";
const TEAL_DIM = "#0A9E6A";
const BG = "#080D0B";
const CARD = "#111A16";
const CARD_HOVER = "#162019";
const SURFACE = "#0E1512";
const BORDER = "rgba(15,206,138,.12)";
const BORDER_H = "rgba(15,206,138,.35)";
const TEXT = "#E8F5F0";
const MUTED = "#6B8F7E";
const GOLD = "#F0C060";
const RED = "#FF5757";

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

function FeaturedCard({ deal, onBookClick }: { deal: SmileDeal; onBookClick: () => void }) {
  const [hovered, setHovered] = useState(false);
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: CARD,
        border: `1px solid ${hovered ? BORDER_H : BORDER}`,
        borderRadius: 24,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: 380,
        cursor: "pointer",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "border-color .3s, transform .4s cubic-bezier(.16,1,.3,1)",
      }}
    >
      {/* Image side */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {videoType && videoType !== "mp4" && hovered && embedUrl ? (
          <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen" style={{ border: "none", pointerEvents: "none", position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        ) : videoType === "mp4" && deal.videoUrl ? (
          <video src={deal.videoUrl} autoPlay={hovered} muted loop playsInline className="w-full h-full object-cover" style={{ transition: "transform .7s cubic-bezier(.16,1,.3,1)", transform: hovered ? "scale(1.05)" : "scale(1)" }} />
        ) : (
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="w-full h-full object-cover"
            style={{ transition: "transform .7s cubic-bezier(.16,1,.3,1)", transform: hovered ? "scale(1.05)" : "scale(1)" }}
            onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=1200"; }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 60%, ${CARD} 100%)` }} />
        {isExpired && (
          <div style={{ position: "absolute", top: 16, left: 16, background: `${RED}CC`, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
            Expired
          </div>
        )}
      </div>

      {/* Content side */}
      <div style={{ padding: "44px 44px 44px 36px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", background: `rgba(15,206,138,.12)`, color: TEAL, border: `1px solid ${BORDER_H}` }}>
            <Star style={{ width: 10, height: 10, fill: TEAL }} /> Featured Offer
          </span>
          {(deal as any).subcategory && (
            <span style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", background: `rgba(8,13,11,.8)`, color: MUTED, border: `1px solid ${BORDER}` }}>
              {(deal as any).subcategory}
            </span>
          )}
        </div>

        <div style={{ fontSize: 30, fontWeight: 700, color: TEXT, lineHeight: 1.2, letterSpacing: "-.02em" }}>{deal.title}</div>

        {deal.description && <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deal.description}</div>}

        {(deal.price || (deal as any).originalPrice) && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            {deal.price && <span style={{ fontSize: 38, fontWeight: 800, color: TEAL, letterSpacing: "-.03em" }}>₹{deal.price}</span>}
            {(deal as any).originalPrice && <span style={{ fontSize: 17, color: MUTED, textDecoration: "line-through" }}>₹{(deal as any).originalPrice}</span>}
            {save && save > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: RED, background: `rgba(255,87,87,.1)`, padding: "3px 8px", borderRadius: 4 }}>Save ₹{save.toLocaleString()}</span>}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href={deal.bookingLink}>
            <button
              onClick={onBookClick}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "13px 26px", borderRadius: 12,
                background: hovered ? TEAL_DIM : TEAL,
                color: "#050E09", fontWeight: 700, fontSize: 14,
                border: "none", cursor: "pointer",
                fontFamily: "'Sora', sans-serif",
                transition: "background .2s, transform .15s",
              }}
            >
              Book Now
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: 13 }}>
            <Eye style={{ width: 14, height: 14 }} />
            {deal.viewCount ?? 0} views
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FlashCard({ deal, gridMode }: { deal: SmileDeal; gridMode?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const save = (deal as any).originalPrice && deal.price
    ? parseInt((deal as any).originalPrice) - parseInt(deal.price)
    : null;
  return (
    <Link href={deal.bookingLink}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...(gridMode ? {} : { flex: "0 0 260px", scrollSnapAlign: "start" }),
          background: hovered ? `linear-gradient(135deg, rgba(15,206,138,.08) 0%, transparent 60%), ${CARD}` : CARD,
          border: `1px solid ${hovered ? BORDER_H : BORDER}`,
          borderRadius: 16,
          padding: 20,
          cursor: "pointer",
          transition: "border-color .3s, transform .3s cubic-bezier(.16,1,.3,1)",
          transform: hovered ? "translateY(-6px)" : "translateY(0)",
          position: "relative",
          overflow: "hidden",
          height: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: gridMode ? 16 : 0, flexDirection: gridMode ? "row" : "column" }}>
          <div style={{ width: gridMode ? 80 : 48, height: gridMode ? 80 : 48, flexShrink: 0, borderRadius: 12, overflow: "hidden", marginBottom: gridMode ? 0 : 14, background: SURFACE }}>
            <img src={deal.imageUrl} alt={deal.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=200"; }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: gridMode ? 15 : 14, fontWeight: 700, color: TEXT, marginBottom: 5 }}>{deal.title}</div>
            {deal.description && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: gridMode ? 3 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deal.description}</div>}
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              {deal.price && <span style={{ fontSize: gridMode ? 22 : 20, fontWeight: 800, color: TEAL }}>₹{deal.price}</span>}
              {(deal as any).originalPrice && <span style={{ fontSize: 13, color: MUTED, textDecoration: "line-through" }}>₹{(deal as any).originalPrice}</span>}
              {save && save > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: RED, background: `rgba(255,87,87,.1)`, padding: "2px 6px", borderRadius: 4, marginLeft: 2 }}>-₹{save}</span>}
            </div>
          </div>
        </div>
        {/* ⚡ badge */}
        <span style={{ position: "absolute", top: 12, right: 12, fontSize: 11, fontWeight: 700, color: GOLD, background: `rgba(240,192,96,.12)`, border: `1px solid rgba(240,192,96,.25)`, padding: "2px 7px", borderRadius: 6 }}>⚡ Flash</span>
      </div>
    </Link>
  );
}

function PlaceholderCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      style={{ height: "100%" }}
    >
      <div style={{
        background: "rgba(17,26,22,0.35)",
        border: "1px dashed rgba(15,206,138,.1)",
        borderRadius: 20,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 300,
      }}>
        <div style={{ height: 196, background: "rgba(15,206,138,.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 40, opacity: 0.2 }}>🦷</span>
        </div>
        <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
          <div style={{ height: 14, background: "rgba(255,255,255,.04)", borderRadius: 6, width: "65%" }} />
          <div style={{ height: 11, background: "rgba(255,255,255,.03)", borderRadius: 6, width: "85%" }} />
          <div style={{ height: 11, background: "rgba(255,255,255,.03)", borderRadius: 6, width: "55%" }} />
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(15,206,138,.06)", display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(107,143,126,.35)", letterSpacing: ".1em", textTransform: "uppercase" }}>
              More deals coming soon
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CountdownCard({ deal }: { deal: SmileDeal }) {
  const timeLeft = useCountdown(deal.expiresAt ? String(deal.expiresAt) : null);
  const [colonVisible, setColonVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setColonVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  if (!timeLeft) return null;
  const units = [
    { label: "Hours", value: timeLeft.hours },
    { label: "Mins", value: timeLeft.minutes },
    { label: "Secs", value: timeLeft.seconds },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{
        background: `linear-gradient(135deg, #0E1F17 0%, #091409 100%)`,
        border: `1px solid rgba(15,206,138,.2)`,
        borderRadius: 20,
        padding: "36px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 24,
        position: "relative", overflow: "hidden",
        marginBottom: 48,
      }}
    >
      <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(15,206,138,.1), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: RED, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: RED, display: "inline-block", animation: "dealpulse 1.2s ease-in-out infinite" }} />
          Limited Time Offer
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 6, letterSpacing: "-.02em" }}>{deal.title}</div>
        {deal.description && <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{deal.description}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {units.map((unit, i) => (
          <div key={unit.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ display: "block", fontSize: 38, fontWeight: 800, color: TEAL, letterSpacing: "-.04em", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "6px 16px", minWidth: 68, textAlign: "center" }}>
                {String(unit.value).padStart(2, "0")}
              </span>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 5, letterSpacing: ".06em" }}>{unit.label}</div>
            </div>
            {i < 2 && <span style={{ fontSize: 30, fontWeight: 700, color: MUTED, marginBottom: 14, opacity: colonVisible ? 1 : 0.2, transition: "opacity .1s" }}>:</span>}
          </div>
        ))}
      </div>
      <Link href={deal.bookingLink}>
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: TEAL, color: "#050E09", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>
          Grab Deal <ChevronRight style={{ width: 16, height: 16 }} />
        </button>
      </Link>
    </motion.div>
  );
}

function DealCard({ deal, index, onVideoOpen }: { deal: SmileDeal; index: number; onVideoOpen: (d: SmileDeal) => void }) {
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
    if (videoType === "mp4" && videoRef.current) videoRef.current.play().catch(() => {});
  }
  function handleLeave() {
    setHovered(false);
    if (videoType === "mp4" && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: index * 0.07 }}
    >
      <TiltCard className="h-full">
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            background: hovered ? CARD_HOVER : CARD,
            border: `1px solid ${hovered ? BORDER_H : BORDER}`,
            borderRadius: 20,
            overflow: "hidden",
            cursor: "pointer",
            transition: "border-color .3s, transform .4s cubic-bezier(.16,1,.3,1), box-shadow .3s",
            transform: hovered ? "translateY(-8px)" : "translateY(0)",
            boxShadow: hovered ? `0 24px 60px rgba(0,0,0,.5), 0 0 0 1px ${BORDER_H}, inset 0 1px 0 rgba(15,206,138,.08)` : "none",
            display: "flex", flexDirection: "column",
            height: "100%",
            opacity: isExpired ? 0.55 : 1,
          }}
        >
          {/* Shine overlay */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 20, background: "linear-gradient(135deg, rgba(255,255,255,.04) 0%, transparent 50%)", opacity: hovered ? 1 : 0, transition: "opacity .3s" }} />

          {/* Media */}
          <div style={{ position: "relative", height: 196, overflow: "hidden" }}>
            <img
              src={deal.imageUrl}
              alt={deal.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.9)", transition: "transform .6s cubic-bezier(.16,1,.3,1), opacity .5s", transform: hovered && videoType ? "scale(1)" : hovered ? "scale(1.08)" : "scale(1)", opacity: hovered && videoType ? 0 : 1 }}
              onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800"; }}
            />
            {videoType === "mp4" && deal.videoUrl && (
              <video ref={videoRef} src={deal.videoUrl} muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: hovered ? 1 : 0, transition: "opacity .5s" }} />
            )}
            {videoType && videoType !== "mp4" && (
              <>
                {!hovered && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 cursor-pointer" onClick={() => onVideoOpen(deal)}>
                    <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                      <Play className="h-7 w-7 text-white fill-white" />
                    </div>
                  </div>
                )}
                {hovered && embedUrl && (
                  <div style={{ position: "absolute", inset: 0 }}>
                    <iframe src={embedUrl} style={{ width: "100%", height: "100%", border: "none", pointerEvents: "none" }} allow="autoplay; fullscreen" />
                    <button onClick={() => onVideoOpen(deal)} style={{ position: "absolute", bottom: 8, right: 8, padding: 6, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.2)", cursor: "pointer" }}>
                      <Maximize2 style={{ width: 13, height: 13, color: "#fff" }} />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Category badge */}
            {(deal as any).subcategory && (
              <span style={{ position: "absolute", top: 12, left: 12, zIndex: 3, background: "rgba(8,13,11,.8)", backdropFilter: "blur(8px)", border: `1px solid ${BORDER}`, color: MUTED, fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 6 }}>
                {(deal as any).subcategory}
              </span>
            )}
            {/* Sponsored badge — YouTube-style */}
            {(deal as any).category === "Advertisements / Sponsored" && (
              <span style={{ position: "absolute", bottom: 10, left: 10, zIndex: 3, background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)", color: "rgba(255,255,255,.55)", fontSize: 9, fontWeight: 500, letterSpacing: ".06em", padding: "3px 7px", borderRadius: 4 }}>
                Sponsored
              </span>
            )}
            {deal.isFeatured && (
              <span style={{ position: "absolute", top: 12, left: (deal as any).subcategory ? 110 : 12, zIndex: 3, display: "inline-flex", alignItems: "center", gap: 4, background: "#0F9B6E", color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 9999 }}>
                <Star style={{ width: 9, height: 9, fill: "#fff" }} /> Featured
              </span>
            )}
            {isExpired && (
              <span style={{ position: "absolute", top: 12, right: 12, zIndex: 3, background: `${RED}CC`, color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 6 }}>Expired</span>
            )}

            {/* Price badge */}
            {deal.price && (
              <div style={{ position: "absolute", top: 12, right: isExpired ? 74 : 12, zIndex: 3, background: TEAL, color: "#050E09", fontSize: 13, fontWeight: 800, letterSpacing: "-.01em", padding: "5px 11px", borderRadius: 8, boxShadow: `0 4px 16px rgba(15,206,138,.4)` }}>
                ₹{deal.price}
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, letterSpacing: "-.01em", marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deal.title}</div>
              {deal.description && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deal.description}</div>}
            </div>

            {save && save > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: `rgba(255,87,87,.1)`, color: RED, width: "fit-content" }}>
                Save ₹{save.toLocaleString()}
              </div>
            )}

            {/* Sponsor contact info for Ad deals */}
            {(deal as any).category === "Advertisements / Sponsored" && (deal as any).contactInfo && (
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, display: "flex", flexDirection: "column", gap: 5 }}>
                {(deal as any).contactInfo.sponsorName && (
                  <div style={{ fontWeight: 600, color: TEXT, fontSize: 12 }}>{(deal as any).contactInfo.sponsorName}</div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {(deal as any).contactInfo.phone && (
                    <a href={`tel:${(deal as any).contactInfo.phone}`} style={{ display: "flex", alignItems: "center", gap: 4, color: TEAL, textDecoration: "none" }}>
                      <Phone style={{ width: 10, height: 10 }} />{(deal as any).contactInfo.phone}
                    </a>
                  )}
                  {(deal as any).contactInfo.email && (
                    <a href={`mailto:${(deal as any).contactInfo.email}`} style={{ display: "flex", alignItems: "center", gap: 4, color: TEAL, textDecoration: "none" }}>
                      <Mail style={{ width: 10, height: 10 }} />{(deal as any).contactInfo.email}
                    </a>
                  )}
                  {(deal as any).contactInfo.website && (
                    <a href={(deal as any).contactInfo.website} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, color: TEAL, textDecoration: "none" }}>
                      <Globe style={{ width: 10, height: 10 }} />Website
                    </a>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED }}>
                <Eye style={{ width: 12, height: 12 }} />
                {deal.viewCount ?? 0}
              </div>
              <Link href={deal.bookingLink}>
                <button
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "8px 16px", borderRadius: 9,
                    background: hovered ? TEAL_DIM : TEAL,
                    color: "#050E09", fontSize: 12, fontWeight: 700,
                    border: "none", cursor: "pointer",
                    fontFamily: "'Sora', sans-serif",
                    transition: "background .2s, box-shadow .2s",
                    boxShadow: hovered ? `0 4px 16px rgba(15,206,138,.3)` : "none",
                  }}
                >
                  Book
                  <ExternalLink style={{ width: 11, height: 11 }} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
}

export default function SmileDeals() {
  const [activeSubcategory, setActiveSubcategory] = useState("All");
  const [selectedCity, setSelectedCity] = useState("All");
  const [videoModalDeal, setVideoModalDeal] = useState<SmileDeal | null>(null);
  const trackingRef = useRef(new Set<number>());

  const { data: deals = [], isLoading } = useQuery<SmileDeal[]>({
    queryKey: ["/api/smile-deals?active=true"],
  });

  const { data: clinics = [] } = useQuery<Clinic[]>({
    queryKey: ["/api/clinics"],
  });

  const clinicCityMap = Object.fromEntries(clinics.map(c => [c.id, (c as any).city as string | undefined]));

  const availableCities = Array.from(new Set(
    deals
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

  const featuredDeal = deals.find((d) => d.isFeatured && !(d as any).isFlash);
  const flashDeals = deals.filter((d) => (d as any).isFlash);
  const subcategories = ["All", ...Array.from(new Set(deals.map((d) => (d as any).subcategory).filter(Boolean) as string[]))];

  const filteredDeals = deals.filter((d) => {
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
    return true;
  });

  const countdownDeal = deals.find((d) => {
    if (!d.expiresAt) return false;
    if (d.isFeatured || (d as any).isFlash) return false;
    const exp = new Date(d.expiresAt).getTime();
    return exp > Date.now() && exp - Date.now() < 72 * 3600 * 1000;
  });

  const activeCount = deals.filter((d) => !d.expiresAt || new Date(d.expiresAt) > new Date()).length;
  const totalViews = deals.reduce((sum, d) => sum + (d.viewCount ?? 0), 0);
  const dealsWithSavings = deals.filter((d) => (d as any).originalPrice && d.price && parseInt((d as any).originalPrice) > parseInt(d.price ?? "0"));
  const avgSaving = dealsWithSavings.length > 0
    ? Math.round(dealsWithSavings.reduce((sum, d) => sum + (parseInt((d as any).originalPrice) - parseInt(d.price ?? "0")), 0) / dealsWithSavings.length)
    : null;

  if (isLoading) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 40, height: 40, color: TEAL, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", fontFamily: "'Sora', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes drift { from { transform: translate(0,0) scale(1); } to { transform: translate(40px,60px) scale(1.1); } }
        @keyframes dealpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.6)} }
        @keyframes dealfadeup { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dealspin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Ambient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 600, height: 600, background: "radial-gradient(circle, rgba(15,206,138,.1) 0%, transparent 70%)", top: -200, left: -100, borderRadius: "50%", filter: "blur(90px)", animation: "drift 18s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle, rgba(15,206,138,.07) 0%, transparent 70%)", bottom: -100, right: -150, borderRadius: "50%", filter: "blur(90px)", animation: "drift 18s ease-in-out infinite alternate", animationDelay: "-6s" }} />
        <div style={{ position: "absolute", width: 300, height: 300, background: "radial-gradient(circle, rgba(240,192,96,.05) 0%, transparent 70%)", top: "40%", left: "50%", borderRadius: "50%", filter: "blur(90px)", animation: "drift 18s ease-in-out infinite alternate", animationDelay: "-12s" }} />
      </div>

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Hero */}
        <section style={{ padding: "72px 48px 52px", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, border: `1px solid ${BORDER_H}`, background: "rgba(15,206,138,.08)", fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: TEAL, textTransform: "uppercase", marginBottom: 28 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "dealspin 8s linear infinite" }}>
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              Exclusive Offers
            </div>
            <h1 style={{ fontSize: "clamp(48px, 7vw, 88px)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "-.03em", color: "#fff", marginBottom: 20 }}>
              Smile <span style={{ color: TEAL }}>DEALS</span>
            </h1>
            <p style={{ fontSize: 16, color: MUTED, maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}>
              Premium dental care packages from our partner clinics — curated, priced lower, and bookable in seconds.
            </p>

            {/* Stats row */}
            <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: TEAL, letterSpacing: "-.02em" }}>{activeCount}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Active Deals</div>
              </div>
              {avgSaving && avgSaving > 0 && (
                <>
                  <div style={{ width: 1, background: BORDER }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: TEAL, letterSpacing: "-.02em" }}>₹{avgSaving.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Avg Saving</div>
                  </div>
                </>
              )}
              {totalViews > 0 && (
                <>
                  <div style={{ width: 1, background: BORDER }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: TEAL, letterSpacing: "-.02em" }}>{totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Total Views</div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </section>

        <div style={{ padding: "0 48px" }}>
          {/* Filter pills — subcategory */}
          {subcategories.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: availableCities.length > 0 ? 16 : 40, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: MUTED, fontWeight: 500, marginRight: 4 }}>Procedure:</span>
              {subcategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveSubcategory(cat)}
                  style={{
                    padding: "8px 20px", borderRadius: 100, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${activeSubcategory === cat ? TEAL : BORDER}`,
                    background: activeSubcategory === cat ? TEAL : "transparent",
                    color: activeSubcategory === cat ? "#050E09" : MUTED,
                    cursor: "pointer", transition: "all .25s", letterSpacing: ".02em",
                    fontFamily: "'Sora', sans-serif",
                  }}
                >
                  {cat}
                </button>
              ))}
            </motion.div>
          )}

          {/* City filter pills — dynamic from linked clinics */}
          {availableCities.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 40, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: MUTED, fontWeight: 500, marginRight: 4 }}>
                <MapPin style={{ width: 12, height: 12 }} /> City:
              </span>
              {["All", ...availableCities].map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  style={{
                    padding: "7px 18px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${selectedCity === city ? TEAL : BORDER}`,
                    background: selectedCity === city ? `rgba(15,206,138,.12)` : "transparent",
                    color: selectedCity === city ? TEAL : MUTED,
                    cursor: "pointer", transition: "all .25s", letterSpacing: ".02em",
                    fontFamily: "'Sora', sans-serif",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {city !== "All" && <MapPin style={{ width: 10, height: 10 }} />}
                  {city}
                </button>
              ))}
            </motion.div>
          )}

          {/* Featured card */}
          <AnimatePresence>
            {featuredDeal && (
              <div style={{ marginBottom: 48 }}>
                <FeaturedCard deal={featuredDeal} onBookClick={() => trackClick(featuredDeal.id)} />
              </div>
            )}
          </AnimatePresence>

          {/* Flash Deals — scroll strip for 3+, grid for 1–2 */}
          {flashDeals.length > 0 && (
            <div style={{ marginBottom: 52 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-.02em" }}>
                  <span style={{ color: GOLD }}>⚡</span> Flash Deals
                </div>
              </div>
              {flashDeals.length >= 3 ? (
                <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12, scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
                  {flashDeals.map((d) => (
                    <FlashCard key={d.id} deal={d} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${flashDeals.length}, 1fr)`, gap: 16 }}>
                  {flashDeals.map((d) => (
                    <FlashCard key={d.id} deal={d} gridMode />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Countdown timer card */}
          {countdownDeal && <CountdownCard deal={countdownDeal} />}

          {/* Deals grid */}
          {deals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: MUTED }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🦷</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: TEXT, marginBottom: 8 }}>No deals yet</p>
              <p style={{ fontSize: 14 }}>Check back soon for exclusive offers.</p>
            </div>
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
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-.02em" }}>
                        All <span style={{ color: TEAL }}>Deals</span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: gridCols, justifyContent: count < 3 ? "center" : "start", gap: 20, marginBottom: 60 }}>
                      {filteredDeals.map((deal, i) => (
                        <DealCard key={deal.id} deal={deal} index={i} onVideoOpen={(d) => setVideoModalDeal(d)} />
                      ))}
                      {Array.from({ length: placeholderCount }).map((_, i) => (
                        <PlaceholderCard key={`ph-${i}`} />
                      ))}
                    </div>
                  </>
                );
              })()}
              {filteredDeals.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
                  <p style={{ fontSize: 16 }}>
                    {activeSubcategory !== "All"
                      ? `No ${activeSubcategory} deals right now.`
                      : selectedCity !== "All"
                      ? `No deals available in ${selectedCity} right now.`
                      : "No deals match your current filters."}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Bottom promo section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 80 }}>
            {/* Refer a Clinic */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ background: "linear-gradient(135deg, #0A2018, #081510)", border: "1px solid rgba(15,206,138,.2)", borderRadius: 18, padding: 32, position: "relative", overflow: "hidden", cursor: "pointer", transition: "transform .35s cubic-bezier(.16,1,.3,1)" }}
              whileHover={{ y: -6 }}
            >
              <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(15,206,138,.1), transparent 70%)", pointerEvents: "none" }} />
              <div style={{ fontSize: 38, marginBottom: 14 }}>🏥</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: TEAL, marginBottom: 10 }}>Partner Clinics</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8, letterSpacing: "-.01em" }}>Refer a Clinic,<br />Unlock Exclusive Deals</div>
              <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, marginBottom: 20 }}>Know a great dental clinic? Refer them to bookMySlot and unlock exclusive deal access for both of you.</div>
              <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: TEAL, color: "#050E09", border: "none", cursor: "pointer", fontFamily: "'Sora', sans-serif", transition: "transform .15s" }}>
                Refer Now →
              </button>
            </motion.div>

            {/* Loyalty Rewards - Coming Soon */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              style={{ background: "linear-gradient(135deg, #1A1408, #100D05)", border: "1px solid rgba(240,192,96,.15)", borderRadius: 18, padding: 32, position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(240,192,96,.1), transparent 70%)", pointerEvents: "none" }} />
              <div style={{ fontSize: 38, marginBottom: 14 }}>🎁</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: GOLD, marginBottom: 10 }}>Loyalty Rewards</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8, letterSpacing: "-.01em" }}>Book 3, Get 1<br />Completely Free</div>
              <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, marginBottom: 20 }}>Book any 3 deals this month and your 4th appointment is on us. No catches, no fine print.</div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700, background: "rgba(240,192,96,.12)", color: GOLD, border: "1px solid rgba(240,192,96,.25)" }}>
                ✦ Coming Soon
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      <VideoModal deal={videoModalDeal} open={!!videoModalDeal} onClose={() => setVideoModalDeal(null)} />
    </div>
  );
}
