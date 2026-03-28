import { useQuery, useMutation } from "@tanstack/react-query";
import { SmileDeal } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Loader2, ExternalLink, Sparkles, Play, Eye, Timer, Star,
  ChevronRight, Tag
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

const DEAL_CATEGORIES = ["All", "Whitening", "Scaling", "Braces", "Implants", "Root Canal", "Extraction", "Consultation", "Orthodontics", "Other"];

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

function getWatchUrl(url: string): string {
  return url;
}

function useCountdown(expiresAt: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
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

function CountdownDisplay({ expiresAt }: { expiresAt: string | null | undefined }) {
  const timeLeft = useCountdown(expiresAt);
  if (!timeLeft || !expiresAt) return null;
  const units = [
    { label: "Days", value: timeLeft.days },
    { label: "Hrs", value: timeLeft.hours },
    { label: "Min", value: timeLeft.minutes },
    { label: "Sec", value: timeLeft.seconds },
  ];
  return (
    <div className="flex items-center gap-2">
      <Timer className="h-4 w-4 text-amber-400" />
      <span className="text-xs text-amber-300 font-medium uppercase tracking-wider">Ends in</span>
      <div className="flex gap-1">
        {units.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1 min-w-[44px]">
            <span className="text-white font-bold text-sm tabular-nums leading-none">
              {String(value).padStart(2, "0")}
            </span>
            <span className="text-white/50 text-[9px] uppercase tracking-widest leading-none mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroFeaturedDeal({ deal, onBookClick }: { deal: SmileDeal; onBookClick: (deal: SmileDeal) => void }) {
  const videoType = deal.videoUrl ? getVideoType(deal.videoUrl) : null;
  const embedUrl = deal.videoUrl ? getEmbedUrl(deal.videoUrl) : null;
  const isExpired = deal.expiresAt ? new Date(deal.expiresAt) <= new Date() : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full overflow-hidden rounded-2xl mb-12"
      style={{ minHeight: "520px" }}
    >
      {/* Background video / image */}
      <div className="absolute inset-0 bg-black">
        {videoType === "mp4" && deal.videoUrl ? (
          <video
            src={deal.videoUrl}
            autoPlay muted loop playsInline
            className="w-full h-full object-cover opacity-60"
          />
        ) : videoType && embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full scale-110 opacity-60"
            allow="autoplay; fullscreen"
            style={{ border: "none", pointerEvents: "none" }}
          />
        ) : (
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="w-full h-full object-cover opacity-50"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=1600";
            }}
          />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/60"
            style={{ left: `${10 + i * 8}%`, top: `${20 + (i % 4) * 20}%` }}
            animate={{ y: [-20, 20, -20], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end h-full p-8 md:p-12 min-h-[520px]">
        <div className="max-w-2xl">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-1.5 bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-primary/30"
            >
              <Star className="h-3 w-3 fill-white" />
              Featured Offer
            </motion.div>
            {deal.category && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full"
              >
                <Tag className="h-3 w-3" />
                {deal.category}
              </motion.div>
            )}
            {isExpired && (
              <span className="bg-red-500/80 text-white text-xs font-bold px-3 py-1.5 rounded-full">Expired</span>
            )}
          </div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight mb-3"
          >
            {deal.title}
          </motion.h2>

          {/* Price */}
          {deal.price && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="text-3xl font-black text-primary mb-3"
            >
              ₹{deal.price}
            </motion.div>
          )}

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/75 text-base leading-relaxed mb-5 max-w-lg line-clamp-2"
          >
            {deal.description}
          </motion.p>

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mb-6"
          >
            <CountdownDisplay expiresAt={deal.expiresAt ? String(deal.expiresAt) : null} />
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap gap-3"
          >
            <Link href={deal.bookingLink}>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white font-bold shadow-xl shadow-primary/40 px-8 group"
                onClick={() => onBookClick(deal)}
              >
                Book Now
                <ChevronRight className="ml-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            {deal.videoUrl && videoType !== "mp4" && (
              <a href={getWatchUrl(deal.videoUrl)} target="_blank" rel="noreferrer">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white/10 backdrop-blur border-white/25 text-white hover:bg-white/20 font-semibold"
                >
                  <Play className="mr-2 h-4 w-4 fill-white" />
                  Watch Video
                </Button>
              </a>
            )}
          </motion.div>
        </div>

        {/* Stats pill */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute top-6 right-6 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5"
        >
          <Eye className="h-3.5 w-3.5 text-white/60" />
          <span className="text-white/60 text-xs">{deal.viewCount ?? 0} views</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-7, 7]);

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() {
    x.set(0);
    y.set(0);
  }

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

function DealCard({
  deal,
  index,
  onBookClick,
  onVideoOpen,
}: {
  deal: SmileDeal;
  index: number;
  onBookClick: (deal: SmileDeal) => void;
  onVideoOpen: (deal: SmileDeal) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const videoType = deal.videoUrl ? getVideoType(deal.videoUrl) : null;
  const isExpired = deal.expiresAt ? new Date(deal.expiresAt) <= new Date() : false;

  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1, y: 0, scale: 1,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: index * 0.07 },
    },
  };

  function handleMouseEnter() {
    setIsHovered(true);
    if (videoType === "mp4" && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }
  function handleMouseLeave() {
    setIsHovered(false);
    if (videoType === "mp4" && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible">
      <TiltCard className="h-full">
        <div
          className={`group relative flex flex-col h-full rounded-2xl overflow-hidden border bg-card shadow-md hover:shadow-2xl transition-shadow duration-300 ${isExpired ? "opacity-60" : ""}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Media area */}
          <div className="relative aspect-video overflow-hidden bg-muted">
            {/* Still image */}
            <img
              src={deal.imageUrl}
              alt={deal.title}
              className={`w-full h-full object-cover transition-all duration-500 ${isHovered && videoType === "mp4" ? "opacity-0" : "opacity-100"} group-hover:scale-105`}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800";
              }}
            />

            {/* mp4 hover video */}
            {videoType === "mp4" && deal.videoUrl && (
              <video
                ref={videoRef}
                src={deal.videoUrl}
                muted loop playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isHovered ? "opacity-100" : "opacity-0"}`}
              />
            )}

            {/* YouTube/Vimeo play button overlay */}
            {videoType && videoType !== "mp4" && (
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 cursor-pointer"
                onClick={() => onVideoOpen(deal)}
              >
                <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-colors">
                  <Play className="h-8 w-8 text-white fill-white" />
                </div>
              </div>
            )}

            {/* Top badges */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {deal.isFeatured && (
                <span className="inline-flex items-center gap-1 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                  <Star className="h-2.5 w-2.5 fill-white" /> Featured
                </span>
              )}
              {deal.category && (
                <span className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/20">
                  {deal.category}
                </span>
              )}
              {isExpired && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Expired</span>
              )}
            </div>

            {/* Price badge */}
            {deal.price && (
              <div className="absolute top-3 right-3 bg-primary text-white font-black text-sm px-3 py-1 rounded-xl shadow-lg shadow-primary/30">
                ₹{deal.price}
              </div>
            )}
          </div>

          {/* Card body */}
          <div className="flex flex-col flex-1 p-5 gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-base leading-snug mb-1.5 line-clamp-2">{deal.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{deal.description}</p>
            </div>

            {/* Countdown */}
            {deal.expiresAt && !isExpired && (
              <div className="text-xs">
                <CountdownDisplay expiresAt={deal.expiresAt ? String(deal.expiresAt) : null} />
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Eye className="h-3 w-3" />
                <span>{deal.viewCount ?? 0}</span>
              </div>
              <Link href={deal.bookingLink}>
                <Button
                  size="sm"
                  className="text-xs font-semibold shadow-md shadow-primary/20 group/btn"
                  onClick={() => onBookClick(deal)}
                >
                  Book Now
                  <ExternalLink className="ml-1.5 h-3 w-3 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </TiltCard>
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
            <iframe
              src={embedUrl.replace("&controls=0", "&controls=1").replace("background=1", "background=0")}
              className="w-full h-full"
              allow="autoplay; fullscreen"
              style={{ border: "none" }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SmileDeals() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [videoModalDeal, setVideoModalDeal] = useState<SmileDeal | null>(null);
  const trackingRef = useRef(new Set<number>());

  const { data: deals = [], isLoading } = useQuery<SmileDeal[]>({
    queryKey: ["/api/smile-deals?active=true"],
  });

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

  const featuredDeal = deals.find((d) => d.isFeatured);
  const categories = ["All", ...Array.from(new Set(deals.map((d) => d.category).filter(Boolean) as string[]))];

  const filteredDeals = deals.filter((d) => {
    if (d.isFeatured) return false;
    if (activeCategory === "All") return true;
    return d.category === activeCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          <Sparkles className="h-4 w-4" />
          Exclusive Offers
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
          Smile <span className="text-primary">DEALS</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Exclusive dental offers and packages from our partner clinics. Book your appointment today and save!
        </p>
      </motion.div>

      {/* Featured Hero */}
      <AnimatePresence>
        {featuredDeal && (
          <HeroFeaturedDeal
            deal={featuredDeal}
            onBookClick={(d) => trackClick(d.id)}
          />
        )}
      </AnimatePresence>

      {/* Category filter pills */}
      {categories.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                activeCategory === cat
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>
      )}

      {/* Deals grid */}
      {filteredDeals.length > 0 ? (
        <motion.div
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
        >
          {filteredDeals.map((deal, i) => (
            <DealCard
              key={deal.id}
              deal={deal}
              index={i}
              onBookClick={(d) => trackClick(d.id)}
              onVideoOpen={(d) => setVideoModalDeal(d)}
            />
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-muted/30 rounded-xl border-2 border-dashed"
        >
          <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {deals.length === 0 ? "No active deals at the moment. Check back soon!" : `No deals in "${activeCategory}" yet.`}
          </p>
        </motion.div>
      )}

      {/* Partner section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-20 bg-primary/5 border border-primary/10 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8"
      >
        <div>
          <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Partner with us?
          </h2>
          <p className="text-muted-foreground max-w-md">
            Are you a clinic owner? Register your clinic and list your special offers on Smile DEALS to reach more patients.
          </p>
        </div>
        <Link href="/register-clinic">
          <Button size="lg" className="whitespace-nowrap">
            Register Your Clinic
          </Button>
        </Link>
      </motion.div>

      {/* Video modal */}
      <VideoModal
        deal={videoModalDeal}
        open={!!videoModalDeal}
        onClose={() => setVideoModalDeal(null)}
      />
    </div>
  );
}
