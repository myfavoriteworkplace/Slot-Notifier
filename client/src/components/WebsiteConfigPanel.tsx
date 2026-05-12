import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ImageUpload";
import {
  Globe, Palette, Image, Layers, Star, Clock, Share2,
  Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, Save, Eye,
  BarChart2, Sparkles, Instagram, Facebook, Youtube,
  Users, ChevronRight, Layout, MousePointerClick,
} from "lucide-react";
import type { ClinicWebsiteConfig } from "@shared/schema";

interface WebsiteConfigPanelProps {
  clinic: any;
}

const THEME_OPTIONS: { id: ClinicWebsiteConfig["theme"]; label: string; description: string; preview: string }[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Elegant serif headings, deep forest green, timeless card layout. Best for established practices.",
    preview: "bg-[#0A3D2E]",
  },
  {
    id: "warm",
    label: "Warm",
    description: "Photo-hero, warm tones, story-first layout. Great for family-friendly clinics.",
    preview: "bg-gradient-to-br from-[#1E3A2F] to-[#0F9B6E]",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Bold typography, dark hero, clean grid. Perfect for cosmetic or premium clinics.",
    preview: "bg-[#0F172A]",
  },
];

const DEFAULT_HOURS = [
  { day: "Mon – Fri", open: "9:00 AM", close: "7:00 PM", closed: false },
  { day: "Saturday", open: "9:00 AM", close: "4:00 PM", closed: false },
  { day: "Sunday", open: "", close: "", closed: true },
];

const FEATURE_ICON_OPTIONS = [
  { value: "users", label: "👥 Expert Team" },
  { value: "stethoscope", label: "🩺 Medical Care" },
  { value: "heart", label: "❤️ Patient Comfort" },
  { value: "shield", label: "🛡️ Safety & Trust" },
  { value: "award", label: "🏆 Award Winning" },
  { value: "zap", label: "⚡ Advanced Technology" },
  { value: "activity", label: "📈 Excellence" },
  { value: "check", label: "✅ Quality Assured" },
];

const FEATURE_EMOJI: Record<string, string> = {
  users: "👥", stethoscope: "🩺", heart: "❤️", shield: "🛡️",
  award: "🏆", zap: "⚡", activity: "📈", check: "✅",
};

type Section = "theme" | "hero" | "about" | "features" | "stats" | "services" | "gallery" | "testimonials" | "hours" | "social";

export default function WebsiteConfigPanel({ clinic }: WebsiteConfigPanelProps) {
  const { toast } = useToast();
  const existing: ClinicWebsiteConfig = (clinic as any)?.websiteConfig ?? { theme: "classic" };

  const [theme, setTheme] = useState<ClinicWebsiteConfig["theme"]>(existing.theme ?? "classic");
  const [taglineL1, setTaglineL1] = useState(existing.taglineL1 ?? "");
  const [taglineL2, setTaglineL2] = useState(existing.taglineL2 ?? "");
  const [heroDescription, setHeroDescription] = useState(existing.heroDescription ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(existing.heroImageUrl ?? "");
  const [aboutDescription, setAboutDescription] = useState(existing.aboutDescription ?? "");
  const [vision, setVision] = useState(existing.vision ?? "");
  const [values, setValues] = useState(existing.values ?? "");
  const [features, setFeatures] = useState<{ icon: string; title: string }[]>(
    existing.features?.length ? existing.features : [
      { icon: "users", title: "Expert and Passionate Team" },
      { icon: "stethoscope", title: "Comprehensive Dental Care Services" },
      { icon: "heart", title: "Focus on Patient Comfort and Confidence" },
      { icon: "zap", title: "Advanced Technology and Continuous Learning" },
    ]
  );
  const [featuresImageUrl, setFeaturesImageUrl] = useState(existing.featuresImageUrl ?? "");
  const [stats, setStats] = useState<{ value: string; label: string }[]>(
    existing.stats?.length ? existing.stats : []
  );
  const [services, setServices] = useState<{ name: string; description: string; imageUrl?: string }[]>(
    existing.services?.length ? existing.services : [{ name: "", description: "" }]
  );
  const [gallery, setGallery] = useState<{ url: string; caption: string }[]>(
    existing.gallery?.length ? existing.gallery : []
  );
  const [testimonials, setTestimonials] = useState<{ quote: string; patientName: string; rating: number }[]>(
    existing.testimonials?.length ? existing.testimonials : []
  );
  const [hours, setHours] = useState<{ day: string; open: string; close: string; closed: boolean }[]>(
    existing.hours?.length ? existing.hours : DEFAULT_HOURS
  );
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; facebook?: string; youtube?: string }>(
    existing.socialLinks ?? {}
  );
  const [showMap, setShowMap] = useState(existing.showMap !== false);
  const [openSection, setOpenSection] = useState<Section>("hero");
  const [mapOpen, setMapOpen] = useState(true);

  useEffect(() => {
    const e: ClinicWebsiteConfig = (clinic as any)?.websiteConfig ?? { theme: "classic" };
    setTheme(e.theme ?? "classic");
    setTaglineL1(e.taglineL1 ?? "");
    setTaglineL2(e.taglineL2 ?? "");
    setHeroDescription(e.heroDescription ?? "");
    setHeroImageUrl(e.heroImageUrl ?? "");
    setAboutDescription(e.aboutDescription ?? "");
    setVision(e.vision ?? "");
    setValues(e.values ?? "");
    setFeatures(e.features?.length ? e.features : [
      { icon: "users", title: "Expert and Passionate Team" },
      { icon: "stethoscope", title: "Comprehensive Dental Care Services" },
      { icon: "heart", title: "Focus on Patient Comfort and Confidence" },
      { icon: "zap", title: "Advanced Technology and Continuous Learning" },
    ]);
    setFeaturesImageUrl(e.featuresImageUrl ?? "");
    setStats(e.stats?.length ? e.stats : []);
    setServices(e.services?.length ? e.services : [{ name: "", description: "" }]);
    setGallery(e.gallery?.length ? e.gallery : []);
    setTestimonials(e.testimonials?.length ? e.testimonials : []);
    setHours(e.hours?.length ? e.hours : DEFAULT_HOURS);
    setSocialLinks(e.socialLinks ?? {});
    setShowMap(e.showMap !== false);
  }, [clinic]);

  const saveMutation = useMutation({
    mutationFn: async (config: ClinicWebsiteConfig) => {
      const res = await apiRequest("PATCH", "/api/auth/clinic/website-config", config);
      if (!res.ok) throw new Error("Failed to save website config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/me"] });
      toast({ title: "Website saved", description: "Your clinic website has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const config: ClinicWebsiteConfig = {
      theme,
      taglineL1: taglineL1 || undefined,
      taglineL2: taglineL2 || undefined,
      heroDescription: heroDescription || undefined,
      heroImageUrl: heroImageUrl || undefined,
      aboutDescription: aboutDescription || undefined,
      vision: vision || undefined,
      values: values || undefined,
      features: features.filter(f => f.title),
      featuresImageUrl: featuresImageUrl || undefined,
      stats: stats.filter(s => s.value && s.label),
      services: services.filter(s => s.name),
      gallery: gallery.filter(g => g.url),
      testimonials: testimonials.filter(t => t.quote && t.patientName),
      hours,
      socialLinks: Object.values(socialLinks).some(Boolean) ? socialLinks : undefined,
      showMap,
    };
    saveMutation.mutate(config);
  };

  const previewUrl = clinic?.username ? `/clinic/${clinic.username}` : clinic?.id ? `/about?clinicId=${clinic.id}` : null;
  const toggle = (s: Section) => setOpenSection(prev => prev === s ? "hero" : s);

  /* ── Derived status helpers ───────────────────────── */
  const liveServices = services.filter(s => s.name);
  const liveGallery = gallery.filter(g => g.url);
  const liveTestimonials = testimonials.filter(t => t.quote && t.patientName);
  const liveStats = stats.filter(s => s.value && s.label);
  const liveFeatures = features.filter(f => f.title);
  const socialCount = [socialLinks.instagram, socialLinks.facebook, socialLinks.youtube].filter(Boolean).length;
  const themeLabel = THEME_OPTIONS.find(t => t.id === theme)?.label ?? "Classic";

  /* ── Map rows config ──────────────────────────────── */
  const MAP_ROWS: {
    id: Section | "doctors" | "footer";
    icon: React.ElementType;
    label: string;
    status: string;
    dot: "green" | "gray" | "amber";
    editable: boolean;
    accent: string;
  }[] = [
    {
      id: "hero", icon: Image, label: "Hero Section",
      status: taglineL1 ? `"${taglineL1.slice(0, 24)}${taglineL1.length > 24 ? "…" : ""}"` : "Using default tagline",
      dot: taglineL1 ? "green" : "gray", editable: true, accent: "bg-[#085041]",
    },
    {
      id: "about", icon: Layers, label: "About & Values",
      status: aboutDescription ? "Story configured" : "Using default copy",
      dot: aboutDescription ? "green" : "gray", editable: true, accent: "bg-blue-400",
    },
    {
      id: "features", icon: Sparkles, label: "Why Choose Us",
      status: `${liveFeatures.length} feature${liveFeatures.length !== 1 ? "s" : ""} shown`,
      dot: "green", editable: true, accent: "bg-violet-400",
    },
    {
      id: "stats", icon: BarChart2, label: "Stats Bar",
      status: liveStats.length > 0 ? `${liveStats.length} stat${liveStats.length !== 1 ? "s" : ""} showing` : "Hidden — add stats to show",
      dot: liveStats.length > 0 ? "green" : "amber", editable: true, accent: "bg-amber-500",
    },
    {
      id: "services", icon: Layers, label: "Services",
      status: liveServices.length > 0 ? `${liveServices.length} service${liveServices.length !== 1 ? "s" : ""}` : "No services added",
      dot: liveServices.length > 0 ? "green" : "gray", editable: true, accent: "bg-teal-500",
    },
    {
      id: "doctors", icon: Users, label: "Doctors",
      status: "Auto-pulled from clinic profile",
      dot: "green", editable: false, accent: "bg-sky-400",
    },
    {
      id: "gallery", icon: Image, label: "Photo Gallery",
      status: liveGallery.length > 0 ? `${liveGallery.length} photo${liveGallery.length !== 1 ? "s" : ""}` : "Hidden — upload photos to show",
      dot: liveGallery.length > 0 ? "green" : "amber", editable: true, accent: "bg-rose-400",
    },
    {
      id: "testimonials", icon: Star, label: "Patient Reviews",
      status: liveTestimonials.length > 0 ? `${liveTestimonials.length} review${liveTestimonials.length !== 1 ? "s" : ""}` : "Hidden — add reviews to show",
      dot: liveTestimonials.length > 0 ? "green" : "amber", editable: true, accent: "bg-amber-400",
    },
    {
      id: "hours", icon: Clock, label: "Clinic Hours",
      status: `${hours.length} time slot${hours.length !== 1 ? "s" : ""}`,
      dot: "green", editable: true, accent: "bg-slate-400",
    },
    {
      id: "social", icon: Share2, label: "Social Links",
      status: socialCount > 0 ? `${socialCount} link${socialCount !== 1 ? "s" : ""} set` : "No links added",
      dot: socialCount > 0 ? "green" : "gray", editable: true, accent: "bg-pink-400",
    },
    {
      id: "footer", icon: Globe, label: "Footer",
      status: "Auto-generated from clinic data",
      dot: "green", editable: false, accent: "bg-[#08281f]",
    },
  ];

  /* ── Centralised preview renderer (right pane) ────── */
  const activeRow = MAP_ROWS.find(r => r.id === openSection);

  const PreviewPane = () => {
    switch (openSection) {
      case "theme":
        return (
          <div className="p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Theme options</p>
            {THEME_OPTIONS.map(t => (
              <div key={t.id} className={`rounded-xl overflow-hidden border-2 transition-all ${theme === t.id ? "border-primary shadow-md" : "border-border/40"}`}>
                <div className={`h-14 w-full ${t.preview} flex items-end p-2`}>
                  <div className="bg-white/10 rounded px-2 py-1 backdrop-blur-sm flex gap-1">
                    <div className="h-1.5 w-10 bg-white/60 rounded" />
                    <div className="h-1.5 w-6 bg-white/40 rounded" />
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-between bg-background">
                  <span className="text-xs font-bold">{t.label}</span>
                  {theme === t.id && <span className="text-[10px] text-primary font-semibold">Active</span>}
                </div>
              </div>
            ))}
          </div>
        );

      case "hero":
        return (
          <div className="h-full flex flex-col">
            <div className="bg-[#0A3D2E] flex-1 p-5 flex flex-col justify-between min-h-[200px]">
              <div>
                <p className="text-white/40 text-[9px] uppercase tracking-widest mb-2">{clinic?.city || "Dental Care"}</p>
                <p className="text-white font-bold leading-tight text-base" style={{ fontFamily: "Georgia, serif" }}>
                  {taglineL1 || "Your Smile,"}
                </p>
                <p className="text-[#6DCFAC] font-bold leading-tight text-base mb-3" style={{ fontFamily: "Georgia, serif" }}>
                  {taglineL2 || "Our Passion."}
                </p>
                <p className="text-white/50 text-[11px] leading-relaxed line-clamp-3">
                  {heroDescription || `At ${clinic?.name || "your clinic"}, we combine modern dentistry with compassionate care to give you and your family the best experience.`}
                </p>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="inline-block bg-[#0F9B6E] text-white text-[10px] font-bold px-4 py-1.5 rounded-full">
                  Book Appointment
                </div>
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt="" className="h-16 w-20 object-cover rounded-xl shadow-lg" />
                ) : (
                  <div className="h-16 w-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-2xl opacity-20">🦷</span>
                  </div>
                )}
              </div>
            </div>
            {!taglineL1 && (
              <div className="px-4 py-2.5 bg-muted/40 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground">Showing defaults — set your tagline below to personalise.</p>
              </div>
            )}
          </div>
        );

      case "about":
        return (
          <div className="p-5 space-y-3 bg-white h-full">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">About your clinic</p>
            <p className="text-[11px] text-gray-700 leading-relaxed line-clamp-4">
              {aboutDescription || `At ${clinic?.name || "your clinic"}, we believe great dental care is about more than just teeth — it's about building trust and creating lasting relationships with every patient.`}
            </p>
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-[#F4F8F6] border border-[#DCE9E3]">
                <p className="text-[9px] font-bold text-[#0A3D2E] uppercase tracking-wider mb-1.5">Our Vision</p>
                <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">
                  {vision || "Add your vision statement to inspire patients with your long-term goals…"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F4F8F6] border border-[#DCE9E3]">
                <p className="text-[9px] font-bold text-[#0A3D2E] uppercase tracking-wider mb-1.5">Our Values</p>
                <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">
                  {values || "Add the values that guide every interaction at your practice…"}
                </p>
              </div>
            </div>
          </div>
        );

      case "features":
        return (
          <div className="p-5 bg-[#F4F8F6] h-full">
            <p className="text-[9px] font-bold text-[#0A3D2E] uppercase tracking-wider mb-3">Why Choose Us</p>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {features.slice(0, 4).map((f, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-[#DCE9E3] flex flex-col items-center text-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-[#0F9B6E]/10 border border-[#0F9B6E]/20 flex items-center justify-center text-base">
                    {FEATURE_EMOJI[f.icon] || "✦"}
                  </div>
                  <p className="text-[10px] font-semibold text-[#0A3D2E] leading-tight">
                    {f.title || "Feature title…"}
                  </p>
                </div>
              ))}
            </div>
            {(featuresImageUrl || heroImageUrl) && (
              <img
                src={featuresImageUrl || heroImageUrl}
                alt=""
                className="w-full h-20 object-cover rounded-xl shadow-sm"
              />
            )}
          </div>
        );

      case "stats":
        if (liveStats.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <BarChart2 className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">Stats section is hidden</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This section only appears when you add at least one stat. Use the form below to add numbers like "2800+ Dental Fillings".
              </p>
            </div>
          );
        }
        return (
          <div className="h-full bg-[#0A3D2E] p-5">
            <p className="text-white/40 text-[9px] uppercase tracking-widest mb-4">Our Achievements</p>
            <div className="grid grid-cols-2 gap-3">
              {liveStats.map((s, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
                  <div className="h-8 w-8 rounded-full bg-[#0F9B6E] mx-auto mb-2 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-white/30" />
                  </div>
                  <p className="text-white font-black text-sm leading-none">{s.value}</p>
                  <p className="text-white/50 text-[10px] mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case "services":
        if (liveServices.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
                <Layers className="h-6 w-6 text-teal-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">No services added yet</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add your dental services below. They appear as a carousel on your clinic page.
              </p>
            </div>
          );
        }
        return (
          <div className="p-5 bg-white h-full">
            <p className="text-[9px] font-bold text-[#0A3D2E] uppercase tracking-wider mb-3">Our Services</p>
            <div className="grid grid-cols-2 gap-2.5">
              {liveServices.slice(0, 4).map((s, i) => (
                <div key={i} className="rounded-xl bg-[#F4F8F6] border border-[#DCE9E3] overflow-hidden">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt="" className="w-full h-16 object-cover" />
                  ) : (
                    <div className="w-full h-1.5 bg-[#0F9B6E]" />
                  )}
                  <div className="p-2.5">
                    <p className="text-[10px] font-bold text-[#0A3D2E] leading-tight line-clamp-2">{s.name}</p>
                    {s.description && (
                      <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{s.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {liveServices.length > 4 && (
              <p className="text-[10px] text-muted-foreground mt-2.5 text-center">
                +{liveServices.length - 4} more · carousel arrows on live page
              </p>
            )}
          </div>
        );

      case "gallery":
        if (liveGallery.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center">
                <Image className="h-6 w-6 text-rose-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Gallery section is hidden</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload clinic photos below. The gallery appears on your page once you add at least one photo.
              </p>
            </div>
          );
        }
        return (
          <div className="bg-[#0A3D2E] h-full p-5">
            <p className="text-white/40 text-[9px] uppercase tracking-widest mb-3">Photo Gallery</p>
            <div className="grid grid-cols-2 gap-2">
              {liveGallery.slice(0, 4).map((g, i) => (
                <div key={i} className="rounded-xl overflow-hidden aspect-video shadow-md">
                  <img src={g.url} alt={g.caption || ""} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            {liveGallery.length > 4 && (
              <p className="text-white/40 text-[10px] mt-2.5 text-center">+{liveGallery.length - 4} more photos</p>
            )}
          </div>
        );

      case "testimonials":
        if (liveTestimonials.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">Reviews section is hidden</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Patient testimonials build trust. Add at least one review below to make this section visible.
              </p>
            </div>
          );
        }
        return (
          <div className="p-5 bg-white h-full space-y-2.5">
            <p className="text-[9px] font-bold text-[#0A3D2E] uppercase tracking-wider mb-3">Patient Reviews</p>
            {liveTestimonials.slice(0, 2).map((t, i) => (
              <div key={i} className="p-3 rounded-xl bg-[#F4F8F6] border border-[#DCE9E3]">
                <div className="flex gap-0.5 mb-1.5">
                  {[1,2,3,4,5].map(n => (
                    <span key={n} className={`text-xs ${n <= t.rating ? "text-amber-400" : "text-gray-200"}`}>★</span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-600 italic leading-relaxed line-clamp-2">"{t.quote}"</p>
                <p className="text-[10px] font-bold text-[#0A3D2E] mt-1.5">— {t.patientName}</p>
              </div>
            ))}
            {liveTestimonials.length > 2 && (
              <p className="text-[10px] text-muted-foreground text-center">+{liveTestimonials.length - 2} more</p>
            )}
          </div>
        );

      case "hours":
        return (
          <div className="p-5 bg-white h-full">
            <p className="text-[9px] font-bold text-[#0A3D2E] uppercase tracking-wider mb-3">Clinic Hours</p>
            <div className="divide-y divide-gray-50 rounded-xl border border-[#DCE9E3] overflow-hidden">
              {hours.map((h, i) => (
                <div key={i} className="flex justify-between items-center px-3 py-2.5 bg-[#F4F8F6]">
                  <span className="text-[11px] font-semibold text-gray-700">{h.day || "—"}</span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${h.closed ? "bg-red-50 text-red-500" : "bg-[#0F9B6E]/10 text-[#0F9B6E]"}`}>
                    {h.closed ? "Closed" : h.open && h.close ? `${h.open} – ${h.close}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case "social":
        return (
          <div className="p-5 bg-white h-full">
            <p className="text-[9px] font-bold text-[#0A3D2E] uppercase tracking-wider mb-4">Social Links</p>
            {socialCount > 0 ? (
              <div className="flex flex-col gap-2.5">
                {socialLinks.instagram && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200/70">
                    <Instagram className="h-4 w-4 text-purple-600 shrink-0" />
                    <span className="text-[11px] text-purple-700 font-semibold truncate">{socialLinks.instagram}</span>
                  </div>
                )}
                {socialLinks.facebook && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200/70">
                    <Facebook className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-[11px] text-blue-700 font-semibold truncate">{socialLinks.facebook}</span>
                  </div>
                )}
                {socialLinks.youtube && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200/70">
                    <Youtube className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-[11px] text-red-700 font-semibold truncate">{socialLinks.youtube}</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">These icons appear in the footer of your clinic page.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-pink-400" />
                </div>
                <p className="text-xs text-muted-foreground">No social links added yet.<br />Add URLs below to show icons in the footer.</p>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
            <MousePointerClick className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Select a section on the left to see its preview here.</p>
          </div>
        );
    }
  };

  /* ── Section header accordion button ─────────────── */
  const SectionHeader = ({ id, icon: Icon, label, badge }: { id: Section; icon: any; label: string; badge?: string }) => (
    <button
      onClick={() => toggle(id)}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-all text-left ${
        openSection === id ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/50 hover:bg-muted/50"
      }`}
      data-testid={`website-section-${id}`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${openSection === id ? "bg-primary/10" : "bg-muted"}`}>
          <Icon className={`h-4 w-4 ${openSection === id ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <span className={`font-semibold text-sm ${openSection === id ? "text-primary" : "text-foreground"}`}>{label}</span>
        {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{badge}</span>}
      </div>
      {openSection === id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Top header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Clinic Website
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your public clinic page. Patients can browse it before booking.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                <Eye className="h-3.5 w-3.5" />
                Preview
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
          <Button
            size="sm"
            className="gap-2 rounded-xl"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-website"
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving…" : "Save Website"}
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          WEBSITE STRUCTURE MAP  (2-pane)
      ══════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm">

        {/* Map header bar */}
        <button
          onClick={() => setMapOpen(p => !p)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border/50"
          data-testid="button-toggle-site-map"
        >
          <div className="flex items-center gap-2.5">
            <Layout className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Website Structure</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {themeLabel} theme · {liveServices.length} services · {liveGallery.length} photos
            </span>
          </div>
          <div className="flex items-center gap-3">
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-primary font-semibold flex items-center gap-1 hover:underline"
              >
                Open live page <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {mapOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {/* 2-pane body */}
        {mapOpen && (
          <div className="flex bg-background" style={{ minHeight: 380 }}>

            {/* ── Left: section list ── */}
            <div className="w-52 shrink-0 border-r border-border/40 divide-y divide-border/30 overflow-y-auto">
              {MAP_ROWS.map((row) => {
                const Icon = row.icon;
                const isActive = openSection === row.id;
                const dotCls =
                  row.dot === "green" ? "bg-emerald-500" :
                  row.dot === "amber" ? "bg-amber-400" :
                  "bg-muted-foreground/25";

                if (!row.editable) {
                  return (
                    <div
                      key={row.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 opacity-50"
                    >
                      <div className={`w-0.5 h-5 rounded-full shrink-0 ${row.accent}`} />
                      <div className="h-5 w-5 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground leading-none truncate">{row.label}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 italic">auto</p>
                      </div>
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotCls}`} />
                    </div>
                  );
                }

                return (
                  <button
                    key={row.id}
                    onClick={() => setOpenSection(row.id as Section)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all group ${
                      isActive
                        ? "bg-primary/8 border-l-2 border-primary"
                        : "hover:bg-muted/50 border-l-2 border-transparent"
                    }`}
                    data-testid={`map-row-${row.id}`}
                  >
                    <div className={`w-0.5 h-5 rounded-full shrink-0 ${row.accent} ${isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`} />
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${isActive ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-2.5 w-2.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold leading-none truncate ${isActive ? "text-primary" : "text-foreground"}`}>{row.label}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{row.status}</p>
                    </div>
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotCls}`} />
                  </button>
                );
              })}
            </div>

            {/* ── Right: live preview pane ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Preview pane header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/20 shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {activeRow?.label ?? "Preview"}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/60 italic">updates as you type</span>
              </div>
              {/* Preview content */}
              <div className="flex-1 overflow-y-auto">
                <PreviewPane />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          SECTION EDITORS  (form fields only)
      ══════════════════════════════════════════════ */}

      {/* ── Theme picker ── */}
      <div className="space-y-3">
        <SectionHeader id="theme" icon={Palette} label="Choose Theme" />
        {openSection === "theme" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-1">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`group relative rounded-2xl border-2 overflow-hidden text-left transition-all ${
                  theme === t.id ? "border-primary shadow-md shadow-primary/20" : "border-border/60 hover:border-primary/40"
                }`}
                data-testid={`theme-option-${t.id}`}
              >
                <div className={`h-28 w-full ${t.preview} flex items-end p-3`}>
                  <div className="bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    <div className="h-2 w-16 bg-white/60 rounded mb-1.5" />
                    <div className="h-1.5 w-10 bg-white/40 rounded" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm">{t.label}</span>
                    {theme === t.id && <Badge className="text-[10px] px-2 py-0 rounded-full">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Hero Section ── */}
      <div className="space-y-3">
        <SectionHeader id="hero" icon={Image} label="Hero Section" />
        {openSection === "hero" && (
          <div className="px-1 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Tagline Line 1</Label>
                <Input value={taglineL1} onChange={e => setTaglineL1(e.target.value)} placeholder="e.g. Your Smile," className="rounded-xl" data-testid="input-tagline-l1" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Tagline Line 2 (highlighted)</Label>
                <Input value={taglineL2} onChange={e => setTaglineL2(e.target.value)} placeholder="e.g. Our Passion." className="rounded-xl" data-testid="input-tagline-l2" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Hero Description</Label>
              <Textarea value={heroDescription} onChange={e => setHeroDescription(e.target.value)} placeholder="Short paragraph shown below the tagline..." rows={3} className="rounded-xl resize-none" data-testid="input-hero-description" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Hero / Clinic Photo</Label>
              <p className="text-xs text-muted-foreground mb-2">Used as the background (Warm theme) or side image (Classic & Modern themes).</p>
              <ImageUpload currentImageUrl={heroImageUrl || null} onUploadComplete={(url) => setHeroImageUrl(url)} folder="clinic-photos" label="Upload Clinic Photo" />
            </div>
          </div>
        )}
      </div>

      {/* ── About & Values ── */}
      <div className="space-y-3">
        <SectionHeader id="about" icon={Layers} label="About & Values" />
        {openSection === "about" && (
          <div className="px-1 space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">About / Our Story</Label>
              <Textarea value={aboutDescription} onChange={e => setAboutDescription(e.target.value)} placeholder="Tell patients about your clinic, your background, and what makes you different..." rows={4} className="rounded-xl resize-none" data-testid="input-about-description" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Our Vision</Label>
              <Textarea value={vision} onChange={e => setVision(e.target.value)} placeholder="e.g. Exceptional dental care delivered with precision, compassion, and modern technology." rows={2} className="rounded-xl resize-none" data-testid="input-vision" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Our Values</Label>
              <Textarea value={values} onChange={e => setValues(e.target.value)} placeholder="e.g. Patient-first · Pain-free dentistry · Transparency · Continuous excellence." rows={2} className="rounded-xl resize-none" data-testid="input-values" />
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
              <input type="checkbox" id="show-map" checked={showMap} onChange={e => setShowMap(e.target.checked)} className="h-4 w-4 accent-primary" data-testid="checkbox-show-map" />
              <Label htmlFor="show-map" className="text-sm font-medium cursor-pointer">Show interactive map on your clinic page</Label>
            </div>
          </div>
        )}
      </div>

      {/* ── Why Choose Us ── */}
      <div className="space-y-3">
        <SectionHeader id="features" icon={Sparkles} label="Why Choose Us" badge="New" />
        {openSection === "features" && (
          <div className="px-1 space-y-4">
            <p className="text-xs text-muted-foreground">Up to 4 reasons shown as icon cards with a side photo. Always visible on every theme.</p>
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <select
                  value={f.icon}
                  onChange={e => setFeatures(prev => prev.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm w-52 shrink-0"
                  data-testid={`select-feature-icon-${i}`}
                >
                  {FEATURE_ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <Input
                  value={f.title}
                  onChange={e => setFeatures(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                  placeholder="e.g. Expert and Passionate Team"
                  className="rounded-xl"
                  data-testid={`input-feature-title-${i}`}
                />
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setFeatures(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-feature-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {features.length < 4 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setFeatures(prev => [...prev, { icon: "check", title: "" }])} data-testid="button-add-feature">
                <Plus className="h-3.5 w-3.5" />Add Feature
              </Button>
            )}
            <div className="pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Side Photo (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Shown next to the feature grid. Falls back to Hero photo if not set.</p>
              <ImageUpload currentImageUrl={featuresImageUrl || null} onUploadComplete={(url) => setFeaturesImageUrl(url)} folder="clinic-photos" label="Upload Features Section Photo" />
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Bar ── */}
      <div className="space-y-3">
        <SectionHeader id="stats" icon={BarChart2} label="Stats & Numbers" badge="New" />
        {openSection === "stats" && (
          <div className="px-1 space-y-3">
            <p className="text-xs text-muted-foreground">Your clinic's achievements — e.g. "2800+ Dental Fillings". This section is <strong>only shown</strong> when you add at least one stat.</p>
            {stats.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center">
                <Input value={s.value} onChange={e => setStats(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="e.g. 2800+" className="rounded-xl font-bold" data-testid={`input-stat-value-${i}`} />
                <Input value={s.label} onChange={e => setStats(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="e.g. Dental Fillings Completed" className="rounded-xl" data-testid={`input-stat-label-${i}`} />
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setStats(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-stat-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {stats.length < 4 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setStats(prev => [...prev, { value: "", label: "" }])} data-testid="button-add-stat">
                <Plus className="h-3.5 w-3.5" />Add Stat
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Services ── */}
      <div className="space-y-3">
        <SectionHeader id="services" icon={Layers} label="Services" />
        {openSection === "services" && (
          <div className="px-1 space-y-4">
            <p className="text-xs text-muted-foreground">Add a photo to each service to show image cards in the carousel. Without photos, cards show with a colour accent instead.</p>
            {services.map((s, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Service {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setServices(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-service-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input value={s.name} onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Service name" className="rounded-xl" data-testid={`input-service-name-${i}`} />
                  <Input value={s.description} onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Short description" className="rounded-xl" data-testid={`input-service-desc-${i}`} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Service Photo (optional)</Label>
                  <ImageUpload currentImageUrl={s.imageUrl || null} onUploadComplete={(url) => setServices(prev => prev.map((x, j) => j === i ? { ...x, imageUrl: url } : x))} folder="clinic-photos" label="Add service photo" />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setServices(prev => [...prev, { name: "", description: "" }])} data-testid="button-add-service">
              <Plus className="h-3.5 w-3.5" />Add Service
            </Button>
          </div>
        )}
      </div>

      {/* ── Gallery ── */}
      <div className="space-y-3">
        <SectionHeader id="gallery" icon={Image} label="Photo Gallery" />
        {openSection === "gallery" && (
          <div className="px-1 space-y-4">
            <p className="text-xs text-muted-foreground">Upload up to 6 clinic photos. Gallery section is <strong>hidden</strong> until at least one photo is added.</p>
            {gallery.map((g, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-1">
                  <ImageUpload currentImageUrl={g.url || null} onUploadComplete={(url) => setGallery(prev => prev.map((x, j) => j === i ? { ...x, url } : x))} folder="clinic-photos" label={`Photo ${i + 1}`} />
                </div>
                <div className="flex-1">
                  <Input value={g.caption} onChange={e => setGallery(prev => prev.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))} placeholder="Caption (optional)" className="rounded-xl" data-testid={`input-gallery-caption-${i}`} />
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 shrink-0 mt-1" onClick={() => setGallery(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-gallery-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {gallery.length < 6 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setGallery(prev => [...prev, { url: "", caption: "" }])} data-testid="button-add-gallery">
                <Plus className="h-3.5 w-3.5" />Add Photo
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Testimonials ── */}
      <div className="space-y-3">
        <SectionHeader id="testimonials" icon={Star} label="Patient Testimonials" />
        {openSection === "testimonials" && (
          <div className="px-1 space-y-4">
            <p className="text-xs text-muted-foreground">Testimonials section is <strong>hidden</strong> until you add at least one review.</p>
            {testimonials.map((t, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Testimonial {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setTestimonials(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-testimonial-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea value={t.quote} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, quote: e.target.value } : x))} placeholder="Patient quote..." rows={2} className="rounded-xl resize-none" data-testid={`input-testimonial-quote-${i}`} />
                <div className="flex gap-3">
                  <Input value={t.patientName} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, patientName: e.target.value } : x))} placeholder="Patient first name" className="rounded-xl" data-testid={`input-testimonial-name-${i}`} />
                  <select value={t.rating} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, rating: Number(e.target.value) } : x))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm" data-testid={`select-testimonial-rating-${i}`}>
                    {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{"★".repeat(r)} {r}/5</option>)}
                  </select>
                </div>
              </div>
            ))}
            {testimonials.length < 5 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setTestimonials(prev => [...prev, { quote: "", patientName: "", rating: 5 }])} data-testid="button-add-testimonial">
                <Plus className="h-3.5 w-3.5" />Add Testimonial
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Hours ── */}
      <div className="space-y-3">
        <SectionHeader id="hours" icon={Clock} label="Clinic Hours" />
        {openSection === "hours" && (
          <div className="px-1 space-y-3">
            {hours.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
                <Input value={h.day} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, day: e.target.value } : x))} placeholder="e.g. Mon – Fri" className="rounded-xl" data-testid={`input-hours-day-${i}`} />
                <Input value={h.open} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, open: e.target.value } : x))} placeholder="9:00 AM" className="rounded-xl w-28" disabled={h.closed} data-testid={`input-hours-open-${i}`} />
                <Input value={h.close} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, close: e.target.value } : x))} placeholder="7:00 PM" className="rounded-xl w-28" disabled={h.closed} data-testid={`input-hours-close-${i}`} />
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  <input type="checkbox" checked={h.closed} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, closed: e.target.checked } : x))} className="accent-primary" data-testid={`checkbox-hours-closed-${i}`} />
                  Closed
                </label>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setHours(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-hours-${i}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setHours(prev => [...prev, { day: "", open: "", close: "", closed: false }])} data-testid="button-add-hours">
              <Plus className="h-3.5 w-3.5" />Add Row
            </Button>
          </div>
        )}
      </div>

      {/* ── Social Links ── */}
      <div className="space-y-3">
        <SectionHeader id="social" icon={Share2} label="Social Links" />
        {openSection === "social" && (
          <div className="px-1 space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Instagram URL</Label>
              <Input value={socialLinks.instagram ?? ""} onChange={e => setSocialLinks(p => ({ ...p, instagram: e.target.value }))} placeholder="https://instagram.com/yourclinic" className="rounded-xl" data-testid="input-social-instagram" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Facebook URL</Label>
              <Input value={socialLinks.facebook ?? ""} onChange={e => setSocialLinks(p => ({ ...p, facebook: e.target.value }))} placeholder="https://facebook.com/yourclinic" className="rounded-xl" data-testid="input-social-facebook" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">YouTube URL</Label>
              <Input value={socialLinks.youtube ?? ""} onChange={e => setSocialLinks(p => ({ ...p, youtube: e.target.value }))} placeholder="https://youtube.com/@yourclinic" className="rounded-xl" data-testid="input-social-youtube" />
            </div>
          </div>
        )}
      </div>

      {/* ── Save bar ── */}
      <div className="pt-4 border-t border-border/50 flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 rounded-xl px-8" data-testid="button-save-website-bottom">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save Website"}
        </Button>
      </div>
    </div>
  );
}
