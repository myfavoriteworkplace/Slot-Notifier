import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ImageUpload";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Globe, Palette, Image, Layers, Star, Clock, Share2,
  Plus, Trash2, ExternalLink, Save, Eye, Smartphone,
  BarChart2, Sparkles, Instagram, Facebook, Youtube,
  Users, Layout, Lock, X, RefreshCw, HelpCircle, ListChecks,
  ShieldCheck,
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
  {
    id: "red-clinical",
    label: "Red Clinical",
    description: "High-contrast red and charcoal presentation with bold treatment cards. Inspired by premium specialist clinics.",
    preview: "bg-gradient-to-br from-[#130506] via-[#8f1717] to-[#e11d24]",
  },
];

const DEFAULT_THEME: ClinicWebsiteConfig["theme"] = "red-clinical";

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

type Section =
  | "theme" | "hero" | "about" | "features" | "stats" | "services"
  | "trust" | "specialties" | "treatments" | "gallery" | "testimonials"
  | "faq" | "hours" | "social" | "social-posts";

export default function WebsiteConfigPanel({ clinic }: WebsiteConfigPanelProps) {
  const existing: ClinicWebsiteConfig = (clinic as any)?.websiteConfig ?? { theme: DEFAULT_THEME };

  const [theme, setTheme] = useState<ClinicWebsiteConfig["theme"]>(existing.theme ?? DEFAULT_THEME);
  const [taglineL1, setTaglineL1] = useState(existing.taglineL1 ?? "");
  const [taglineL2, setTaglineL2] = useState(existing.taglineL2 ?? "");
  const [heroDescription, setHeroDescription] = useState(existing.heroDescription ?? "");
  const [announcementText, setAnnouncementText] = useState(existing.announcementText ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(existing.heroImageUrl ?? "");
  const [heroForegroundImageUrl, setHeroForegroundImageUrl] = useState(existing.heroForegroundImageUrl ?? "");
  const [aboutDescription, setAboutDescription] = useState(existing.aboutDescription ?? "");
  const [aboutImageUrl, setAboutImageUrl] = useState(existing.aboutImageUrl ?? "");
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
  const DEFAULT_STATS_PREFILL = [
    { value: "2800+", label: "Dental Fillings" },
    { value: "1200+", label: "Tooth Extraction" },
    { value: "3K+",   label: "Root Canal" },
    { value: "2100+", label: "Implants Placed" },
  ];
  const [stats, setStats] = useState<{ value: string; label: string }[]>(
    existing.stats?.length ? existing.stats : DEFAULT_STATS_PREFILL
  );
  const [services, setServices] = useState<{ name: string; description: string; imageUrl?: string }[]>(
    existing.services?.length ? existing.services : [{ name: "", description: "" }]
  );
  const [trustPoints, setTrustPoints] = useState<{ title: string; description: string; icon?: string; category?: string }[]>(
    existing.trustPoints ?? []
  );
  const [specialties, setSpecialties] = useState<{ title: string; description: string; icon?: string }[]>(
    existing.specialties ?? []
  );
  const [treatmentGroups, setTreatmentGroups] = useState<{ name: string; description?: string; items: string[]; imageUrl?: string }[]>(
    existing.treatmentGroups ?? []
  );
  const [gallery, setGallery] = useState<{ url: string; caption: string }[]>(
    existing.gallery?.length ? existing.gallery : []
  );
  const [testimonials, setTestimonials] = useState<{ quote: string; patientName: string; rating: number }[]>(
    existing.testimonials?.length ? existing.testimonials : []
  );
  const [faq, setFaq] = useState<{ question: string; answer: string }[]>(existing.faq ?? []);
  const [socialPosts, setSocialPosts] = useState<{ imageUrl: string; caption?: string; link?: string }[]>(existing.socialPosts ?? []);
  const [hours, setHours] = useState<{ day: string; open: string; close: string; closed: boolean }[]>(
    existing.hours?.length ? existing.hours : DEFAULT_HOURS
  );
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; facebook?: string; youtube?: string }>(
    existing.socialLinks ?? {}
  );
  const [showMap, setShowMap] = useState(existing.showMap !== false);
  const [openSection, setOpenSection] = useState<Section>("theme");
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    const e: ClinicWebsiteConfig = (clinic as any)?.websiteConfig ?? { theme: DEFAULT_THEME };
    setTheme(e.theme ?? DEFAULT_THEME);
    setTaglineL1(e.taglineL1 ?? "");
    setTaglineL2(e.taglineL2 ?? "");
    setHeroDescription(e.heroDescription ?? "");
    setAnnouncementText(e.announcementText ?? "");
    setHeroImageUrl(e.heroImageUrl ?? "");
    setHeroForegroundImageUrl(e.heroForegroundImageUrl ?? "");
    setAboutDescription(e.aboutDescription ?? "");
    setAboutImageUrl(e.aboutImageUrl ?? "");
    setVision(e.vision ?? "");
    setValues(e.values ?? "");
    setFeatures(e.features?.length ? e.features : [
      { icon: "users", title: "Expert and Passionate Team" },
      { icon: "stethoscope", title: "Comprehensive Dental Care Services" },
      { icon: "heart", title: "Focus on Patient Comfort and Confidence" },
      { icon: "zap", title: "Advanced Technology and Continuous Learning" },
    ]);
    setFeaturesImageUrl(e.featuresImageUrl ?? "");
    setStats(e.stats?.length ? e.stats : DEFAULT_STATS_PREFILL);
    setServices(e.services?.length ? e.services : [{ name: "", description: "" }]);
    setTrustPoints(e.trustPoints ?? []);
    setSpecialties(e.specialties ?? []);
    setTreatmentGroups(e.treatmentGroups ?? []);
    setGallery(e.gallery?.length ? e.gallery : []);
    setTestimonials(e.testimonials?.length ? e.testimonials : []);
    setFaq(e.faq ?? []);
    setSocialPosts(e.socialPosts ?? []);
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
      notify.success("Website saved", { description: "Your clinic website has been updated." });
    },
    onError: (err: any) => {
      notify.apiError(err, "Save failed");
    },
  });

  const handleSave = () => {
    const config: ClinicWebsiteConfig = {
      theme,
      taglineL1: taglineL1 || undefined,
      taglineL2: taglineL2 || undefined,
      heroDescription: heroDescription || undefined,
      announcementText: announcementText || undefined,
      heroImageUrl: heroImageUrl || undefined,
      heroForegroundImageUrl: heroForegroundImageUrl || undefined,
      aboutDescription: aboutDescription || undefined,
      aboutImageUrl: aboutImageUrl || undefined,
      vision: vision || undefined,
      values: values || undefined,
      features: features.filter(f => f.title),
      featuresImageUrl: featuresImageUrl || undefined,
      stats: stats.filter(s => s.value && s.label),
      services: services.filter(s => s.name),
      trustPoints: trustPoints.filter(point => point.title && point.description),
      specialties: specialties.filter(s => s.title && s.description),
      treatmentGroups: treatmentGroups
        .map(group => ({ ...group, items: group.items.filter(Boolean) }))
        .filter(group => group.name && group.items.length > 0),
      gallery: gallery.filter(g => g.url),
      testimonials: testimonials.filter(t => t.quote && t.patientName),
      faq: faq.filter(item => item.question && item.answer),
      socialPosts: socialPosts.filter(post => post.imageUrl),
      hours,
      socialLinks: Object.values(socialLinks).some(Boolean) ? socialLinks : undefined,
      showMap,
    };
    saveMutation.mutate(config);
  };

  const previewUrl = clinic?.username ? `/clinic/${clinic.username}` : clinic?.id ? `/about?clinicId=${clinic.id}` : null;

  /* ── Derived status helpers ───────────────────────── */
  const liveServices = services.filter(s => s.name);
  const liveGallery = gallery.filter(g => g.url);
  const liveTestimonials = testimonials.filter(t => t.quote && t.patientName);
  const liveStats = stats.filter(s => s.value && s.label);
  const liveFeatures = features.filter(f => f.title);
  const liveTrustPoints = trustPoints.filter(point => point.title && point.description);
  const liveSpecialties = specialties.filter(s => s.title && s.description);
  const liveTreatmentGroups = treatmentGroups.filter(g => g.name && g.items.some(Boolean));
  const liveFaq = faq.filter(item => item.question && item.answer);
  const liveSocialPosts = socialPosts.filter(post => post.imageUrl);
  const socialCount = [socialLinks.instagram, socialLinks.facebook, socialLinks.youtube].filter(Boolean).length;
  const themeLabel = THEME_OPTIONS.find(t => t.id === theme)?.label ?? "Red Clinical";

  /* ── Sidebar row config ──────────────────────────── */
  const MAP_ROWS: {
    id: Section | "doctors" | "footer";
    icon: React.ElementType;
    label: string;
    status: string;
    dot: "green" | "gray" | "amber";
    editable: boolean;
    accent: string;
    autoNote?: string;
  }[] = [
    {
      id: "theme", icon: Palette, label: "Theme",
      status: `${themeLabel} style · active`,
      dot: "green", editable: true, accent: "bg-primary",
    },
    {
      id: "hero", icon: Image, label: "Hero",
      status: taglineL1 ? `"${taglineL1.slice(0, 18)}${taglineL1.length > 18 ? "…" : ""}" · ready` : "Add your tagline",
      dot: taglineL1 ? "green" : "gray", editable: true, accent: "bg-primary",
    },
    {
      id: "about", icon: Layers, label: "About & Values",
      status: aboutDescription ? "Story written · ready" : "Add your clinic story",
      dot: aboutDescription ? "green" : "gray", editable: true, accent: "bg-blue-400",
    },
    {
      id: "features", icon: Sparkles, label: "Why Choose Us",
      status: `${liveFeatures.length} highlight${liveFeatures.length !== 1 ? "s" : ""} · live`,
      dot: "green", editable: true, accent: "bg-violet-400",
    },
    {
      id: "stats", icon: BarChart2, label: "Stats Bar",
      status: liveStats.length > 0 ? `${liveStats.length} stat${liveStats.length !== 1 ? "s" : ""} · showing` : "Add stats to activate",
      dot: liveStats.length > 0 ? "green" : "amber", editable: true, accent: "bg-amber-500",
    },
    {
      id: "services", icon: Layers, label: "Services",
      status: liveServices.length > 0 ? `${liveServices.length} service${liveServices.length !== 1 ? "s" : ""} listed` : "No services yet",
      dot: liveServices.length > 0 ? "green" : "gray", editable: true, accent: "bg-teal-500",
    },
    {
      id: "trust", icon: ShieldCheck, label: "Trust & Facilities",
      status: liveTrustPoints.length > 0
        ? `${liveTrustPoints.length} point${liveTrustPoints.length !== 1 ? "s" : ""} · showing`
        : "Add patient benefits",
      dot: liveTrustPoints.length > 0 ? "green" : "gray",
      editable: true, accent: "bg-red-500",
    },
    {
      id: "specialties", icon: Sparkles, label: "Specialities",
      status: specialties.filter(s => s.title && s.description).length > 0
        ? `${specialties.filter(s => s.title && s.description).length} cards · showing`
        : "Add speciality cards",
      dot: specialties.some(s => s.title && s.description) ? "green" : "gray",
      editable: true, accent: "bg-red-500",
    },
    {
      id: "treatments", icon: ListChecks, label: "Treatment Groups",
      status: treatmentGroups.filter(g => g.name && g.items.some(Boolean)).length > 0
        ? `${treatmentGroups.filter(g => g.name && g.items.some(Boolean)).length} groups · showing`
        : "Add treatment groups",
      dot: treatmentGroups.some(g => g.name && g.items.some(Boolean)) ? "green" : "gray",
      editable: true, accent: "bg-red-600",
    },
    {
      id: "doctors", icon: Users, label: "Doctors",
      status: "Auto from Manage Doctors",
      dot: "green", editable: false, accent: "bg-sky-400",
      autoNote: "Cards built automatically from doctors you've added in Manage Doctors.",
    },
    {
      id: "gallery", icon: Image, label: "Photo Gallery",
      status: liveGallery.length > 0 ? `${liveGallery.length} photo${liveGallery.length !== 1 ? "s" : ""} · gallery live` : "Upload photos to activate",
      dot: liveGallery.length > 0 ? "green" : "amber", editable: true, accent: "bg-rose-400",
    },
    {
      id: "testimonials", icon: Star, label: "Patient Reviews",
      status: liveTestimonials.length > 0 ? `${liveTestimonials.length} review${liveTestimonials.length !== 1 ? "s" : ""} · showing` : "Add reviews to activate",
      dot: liveTestimonials.length > 0 ? "green" : "amber", editable: true, accent: "bg-amber-400",
    },
    {
      id: "faq", icon: HelpCircle, label: "FAQ",
      status: faq.filter(item => item.question && item.answer).length > 0
        ? `${faq.filter(item => item.question && item.answer).length} answers · showing`
        : "Add answers to activate",
      dot: faq.some(item => item.question && item.answer) ? "green" : "amber",
      editable: true, accent: "bg-red-400",
    },
    {
      id: "hours", icon: Clock, label: "Clinic Hours",
      status: `${hours.length} time slot${hours.length !== 1 ? "s" : ""} · visible`,
      dot: "green", editable: true, accent: "bg-slate-400",
    },
    {
      id: "social", icon: Share2, label: "Social Links",
      status: socialCount > 0 ? `${socialCount} link${socialCount !== 1 ? "s" : ""} connected` : "No links added yet",
      dot: socialCount > 0 ? "green" : "gray", editable: true, accent: "bg-pink-400",
    },
    {
      id: "social-posts", icon: Instagram, label: "Social Gallery",
      status: socialPosts.filter(post => post.imageUrl).length > 0
        ? `${socialPosts.filter(post => post.imageUrl).length} posts · showing`
        : "Add social cards",
      dot: socialPosts.some(post => post.imageUrl) ? "green" : "gray",
      editable: true, accent: "bg-fuchsia-400",
    },
    {
      id: "footer", icon: Globe, label: "Footer",
      status: "Auto from clinic profile",
      dot: "green", editable: false, accent: "bg-primary/60",
      autoNote: "Built automatically from your clinic name, address, and contact details.",
    },
  ];

  const configuredCount = MAP_ROWS.filter(r => r.dot === "green").length;
  const needsAttentionCount = MAP_ROWS.filter(r => r.dot === "amber").length;

  const activeRow = MAP_ROWS.find(r => r.id === openSection);

  /* ── Content preview pane (top of right panel) ──────── */
  const PreviewPane = () => {
    const activeRowIdx = MAP_ROWS.findIndex(r => r.id === openSection);

    const SectionHeader = ({
      icon: Icon, title, status, statusCls = "text-muted-foreground",
    }: { icon: React.ElementType; title: string; status: string; statusCls?: string }) => (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/30 shrink-0">
        <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground truncate min-w-0">
          {title} · Section {activeRowIdx + 1} of {MAP_ROWS.length}
        </span>
        <span className={`ml-auto text-xs font-semibold shrink-0 ${statusCls}`}>{status}</span>
      </div>
    );

    switch (openSection) {
      case "theme":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Palette} title="Visual Style" status={`${themeLabel} active`} statusCls="text-primary" />
            <div className="flex-1 p-3 flex gap-2 items-center bg-muted/10 overflow-hidden">
              {THEME_OPTIONS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                    className={`flex-1 rounded-xl overflow-hidden border-2 transition-colors text-left ${theme === t.id ? "border-primary bg-primary/[0.03]" : "border-border/40 hover:border-primary/40"}`}
                  data-testid={`theme-preview-${t.id}`}
                >
                  <div className={`h-12 w-full ${t.preview} flex items-end p-1.5`}>
                    <div className="bg-white/10 rounded px-1.5 py-0.5 backdrop-blur-sm flex gap-1">
                      <div className="h-1 w-6 bg-white/60 rounded" />
                      <div className="h-1 w-4 bg-white/40 rounded" />
                    </div>
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-between bg-background">
                    <span className="text-xs font-bold">{t.label}</span>
                    {theme === t.id && <span className="text-xs text-primary font-semibold">Active</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case "hero":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Image} title="Hero — First Impression" status={taglineL1 ? "Tagline set" : "Using placeholder"} statusCls={taglineL1 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
            <div className="flex-1 bg-[#0A3D2E] p-4 flex flex-col justify-between overflow-hidden">
              <div>
                <p className="text-white/50 text-xs uppercase tracking-widest mb-1">{clinic?.city || "Your City"}</p>
                <p className="text-white font-bold text-sm leading-snug" style={{ fontFamily: "Georgia, serif" }}>
                  {taglineL1 || <span className="opacity-30 italic">Your tagline line 1…</span>}
                </p>
                <p className="text-[#6DCFAC] font-bold text-sm leading-snug mb-1.5" style={{ fontFamily: "Georgia, serif" }}>
                  {taglineL2 || <span className="text-white/20 italic">Your tagline line 2…</span>}
                </p>
                {heroDescription && (
                  <p className="text-white/50 text-xs leading-relaxed line-clamp-2">{heroDescription}</p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="bg-[#0F9B6E] text-white text-xs font-bold px-3 py-1.5 rounded-full shrink-0">Book Appointment</div>
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt="" className="h-10 w-12 object-cover rounded-lg shadow-lg ml-auto" />
                ) : (
                  <div className="h-10 w-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center ml-auto">
                    <span className="text-lg opacity-20">🦷</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "about":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Layers} title="About & Values" status={aboutDescription ? "Story written" : "Using placeholder"} statusCls={aboutDescription ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden">
              <p className="text-xs text-gray-600 dark:text-muted-foreground leading-relaxed line-clamp-3 mb-2">
                {aboutDescription || `At ${clinic?.name || "your clinic"}, we believe great dental care is about more than just teeth — it's about building trust.`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-[#F4F8F6] dark:bg-muted/30 border border-[#DCE9E3] dark:border-border/50">
                  <p className="text-xs font-bold text-[#0A3D2E] dark:text-primary uppercase tracking-wider mb-1">Vision</p>
                  <p className="text-xs text-gray-600 dark:text-muted-foreground leading-relaxed line-clamp-2">{vision || "Add your vision…"}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#F4F8F6] dark:bg-muted/30 border border-[#DCE9E3] dark:border-border/50">
                  <p className="text-xs font-bold text-[#0A3D2E] dark:text-primary uppercase tracking-wider mb-1">Values</p>
                  <p className="text-xs text-gray-600 dark:text-muted-foreground leading-relaxed line-clamp-2">{values || "Add your values…"}</p>
                </div>
              </div>
            </div>
          </div>
        );

      case "features":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Sparkles} title="Why Choose Us" status={`${liveFeatures.length} of 4 set`} statusCls="text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 p-4 bg-[#F4F8F6] dark:bg-muted/20 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(liveFeatures.length > 0 ? liveFeatures : features).slice(0, 4).map((f, i) => (
                  <div key={i} className="bg-white dark:bg-card rounded-lg p-2 border border-[#DCE9E3] dark:border-border/50 flex flex-col items-center text-center gap-1">
                    <div className="h-7 w-7 rounded-full bg-[#0F9B6E]/10 border border-[#0F9B6E]/20 flex items-center justify-center text-sm">
                      {FEATURE_EMOJI[f.icon] || "✦"}
                    </div>
                    <p className="text-xs font-semibold text-[#0A3D2E] dark:text-foreground leading-tight line-clamp-2">{f.title || "Feature title…"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "stats":
        if (liveStats.length === 0) {
          return (
            <div className="h-full flex flex-col">
              <SectionHeader icon={BarChart2} title="Stats Bar" status="Hidden — no stats added" statusCls="text-amber-600 dark:text-amber-400" />
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2 bg-muted/10">
                <BarChart2 className="h-7 w-7 text-amber-400" />
                <p className="text-xs font-semibold text-foreground">Stats section is hidden</p>
                <p className="text-xs text-muted-foreground">Add at least one stat below to show this section on your page.</p>
              </div>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={BarChart2} title="Stats Bar" status={`${liveStats.length} stats · live`} statusCls="text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 bg-[#0A3D2E] p-4 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {liveStats.slice(0, 4).map((s, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-2 border border-white/10 text-center">
                    <p className="text-white font-black text-sm leading-none">{s.value}</p>
                    <p className="text-white/50 text-xs mt-1 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "services":
        if (liveServices.length === 0) {
          return (
            <div className="h-full flex flex-col">
              <SectionHeader icon={Layers} title="Services" status="Hidden — no services added" statusCls="text-muted-foreground" />
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2 bg-muted/10">
                <Layers className="h-7 w-7 text-teal-400" />
                <p className="text-xs font-semibold text-foreground">No services added yet</p>
                <p className="text-xs text-muted-foreground">Add services below — they appear as a card grid on your page.</p>
              </div>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Layers} title="Services" status={`${liveServices.length} services · live`} statusCls="text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {liveServices.slice(0, 4).map((s, i) => (
                  <div key={i} className="rounded-lg bg-[#F4F8F6] dark:bg-muted/30 border border-[#DCE9E3] dark:border-border/50 overflow-hidden">
                    {s.imageUrl ? (
                      <img src={s.imageUrl} alt="" className="w-full h-10 object-cover" />
                    ) : (
                      <div className="w-full h-1.5 bg-[#0F9B6E]" />
                    )}
                    <div className="p-2">
                      <p className="text-xs font-bold text-[#0A3D2E] dark:text-foreground leading-tight line-clamp-2">{s.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "trust":
        if (liveTrustPoints.length === 0) {
          return (
            <div className="h-full flex flex-col">
              <SectionHeader icon={ShieldCheck} title="Trust & Facilities" status="Hidden — no points added" statusCls="text-muted-foreground" />
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2 bg-muted/10">
                <ShieldCheck className="h-7 w-7 text-red-400" />
                <p className="text-xs font-semibold text-foreground">Trust section is hidden</p>
                <p className="text-xs text-muted-foreground">Add real clinic benefits such as accessibility, parking, emergency care, or technology.</p>
              </div>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={ShieldCheck} title="Trust & Facilities" status={`${liveTrustPoints.length} points · live`} statusCls="text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {liveTrustPoints.slice(0, 6).map((point, i) => (
                  <div key={i} className="p-2 rounded-lg border border-red-200/70 dark:border-red-500/20 bg-red-50/40 dark:bg-red-950/10">
                    <ShieldCheck className="h-4 w-4 text-red-600 mb-1" />
                    <p className="text-xs font-bold leading-tight line-clamp-2">{point.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{point.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "specialties":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Sparkles} title="Specialities" status={`${liveSpecialties.length} cards · preview`} statusCls={liveSpecialties.length ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(liveSpecialties.length ? liveSpecialties : specialties).slice(0, 3).map((item, i) => (
                  <div key={i} className="p-3 rounded-lg border border-red-200/70 dark:border-red-500/20 bg-red-50/40 dark:bg-red-950/10">
                    <div className="h-6 w-6 rounded-md bg-red-600 text-white flex items-center justify-center mb-2">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs font-bold leading-tight line-clamp-2">{item.title || "Speciality title…"}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description || "Add a short description…"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "treatments":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={ListChecks} title="Treatment Groups" status={`${liveTreatmentGroups.length} groups · preview`} statusCls={liveTreatmentGroups.length ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(liveTreatmentGroups.length ? liveTreatmentGroups : treatmentGroups).slice(0, 3).map((group, i) => (
                  <div key={i} className="p-3 rounded-lg bg-red-600 text-white min-h-[92px]">
                    <p className="text-xs font-bold leading-tight line-clamp-2">{group.name || "Treatment group…"}</p>
                    <p className="text-[10px] text-white/70 mt-2 line-clamp-3">{group.items.filter(Boolean).join(" · ") || "Add treatment items…"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "gallery":
        if (liveGallery.length === 0) {
          return (
            <div className="h-full flex flex-col">
              <SectionHeader icon={Image} title="Photo Gallery" status="Hidden — no photos" statusCls="text-amber-600 dark:text-amber-400" />
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2 bg-muted/10">
                <Image className="h-7 w-7 text-rose-400" />
                <p className="text-xs font-semibold text-foreground">Gallery section is hidden</p>
                <p className="text-xs text-muted-foreground">Upload clinic photos below to show this section on your page.</p>
              </div>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Image} title="Photo Gallery" status={`${liveGallery.length} photos · live`} statusCls="text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 bg-[#0A3D2E] p-4 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {liveGallery.slice(0, 4).map((g, i) => (
                  <div key={i} className="rounded-lg overflow-hidden aspect-video shadow-md">
                    <img src={g.url} alt={g.caption || ""} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "testimonials":
        if (liveTestimonials.length === 0) {
          return (
            <div className="h-full flex flex-col">
              <SectionHeader icon={Star} title="Patient Reviews" status="Hidden — no reviews" statusCls="text-amber-600 dark:text-amber-400" />
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2 bg-muted/10">
                <Star className="h-7 w-7 text-amber-400" />
                <p className="text-xs font-semibold text-foreground">Reviews section is hidden</p>
                <p className="text-xs text-muted-foreground">Add at least one review below to show this section.</p>
              </div>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Star} title="Patient Reviews" status={`${liveTestimonials.length} reviews · showing`} statusCls="text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden space-y-2">
              {liveTestimonials.slice(0, 2).map((t, i) => (
                <div key={i} className="p-2 rounded-lg bg-[#F4F8F6] dark:bg-muted/30 border border-[#DCE9E3] dark:border-border/50">
                  <div className="flex gap-0.5 mb-1">
                    {[1,2,3,4,5].map(n => (
                      <span key={n} className={`text-xs ${n <= t.rating ? "text-amber-400" : "text-gray-200 dark:text-gray-700"}`}>★</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-muted-foreground italic leading-relaxed line-clamp-2">"{t.quote}"</p>
                  <p className="text-xs font-bold text-[#0A3D2E] dark:text-foreground mt-1">— {t.patientName}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case "faq":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={HelpCircle} title="Frequently Asked Questions" status={`${liveFaq.length} answers · preview`} statusCls={liveFaq.length ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden space-y-1.5">
              {(liveFaq.length ? liveFaq : faq).slice(0, 3).map((item, i) => (
                <div key={i} className="rounded-lg border border-red-200/70 dark:border-red-500/20 overflow-hidden">
                  <p className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-semibold line-clamp-1">{item.question || "Question…"}</p>
                  <p className="px-2.5 py-1.5 text-xs text-muted-foreground line-clamp-1">{item.answer || "Answer…"}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case "hours":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Clock} title="Clinic Hours" status={`${hours.length} slots · visible`} statusCls="text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden">
              <div className="divide-y divide-gray-50 dark:divide-border/30 rounded-lg border border-[#DCE9E3] dark:border-border/50 overflow-hidden">
                {hours.map((h, i) => (
                  <div key={i} className="flex justify-between items-center px-2.5 py-1.5 bg-[#F4F8F6] dark:bg-muted/20">
                    <span className="text-xs font-semibold text-gray-700 dark:text-foreground">{h.day || "—"}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${h.closed ? "bg-red-50 dark:bg-rose-950/30 text-red-500 dark:text-rose-400" : "bg-[#0F9B6E]/10 text-[#0F9B6E]"}`}>
                      {h.closed ? "Closed" : h.open && h.close ? `${h.open} – ${h.close}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "social":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Share2} title="Social Links" status={socialCount > 0 ? `${socialCount} connected` : "None added"} statusCls={socialCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
            <div className="flex-1 p-4 bg-white dark:bg-card overflow-hidden">
              {socialCount > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {socialLinks.instagram && (
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200/70 dark:border-purple-500/20">
                      <Instagram className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span className="text-xs text-purple-700 dark:text-purple-400 font-semibold truncate">{socialLinks.instagram}</span>
                    </div>
                  )}
                  {socialLinks.facebook && (
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-500/20">
                      <Facebook className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs text-blue-700 dark:text-blue-400 font-semibold truncate">{socialLinks.facebook}</span>
                    </div>
                  )}
                  {socialLinks.youtube && (
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/70 dark:border-red-500/20">
                      <Youtube className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                      <span className="text-xs text-red-700 dark:text-red-400 font-semibold truncate">{socialLinks.youtube}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <Share2 className="h-6 w-6 text-pink-300" />
                  <p className="text-xs text-muted-foreground">No social links added yet.</p>
                </div>
              )}
            </div>
          </div>
        );

      case "social-posts":
        return (
          <div className="h-full flex flex-col">
            <SectionHeader icon={Instagram} title="Social Gallery" status={`${liveSocialPosts.length} posts · preview`} statusCls={liveSocialPosts.length ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
            <div className="flex-1 p-4 bg-[#8f1717] dark:bg-red-950/50 overflow-hidden">
              <div className="grid grid-cols-3 gap-2">
                {(liveSocialPosts.length ? liveSocialPosts : socialPosts).slice(0, 3).map((post, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-white/10">
                    {post.imageUrl ? <img src={post.imageUrl} alt="" className="w-full h-full object-cover" /> : <Instagram className="w-full h-full p-8 text-white/40" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="h-full flex items-center justify-center bg-muted/10">
            <p className="text-xs text-muted-foreground">Select a section to preview it here.</p>
          </div>
        );
    }
  };

  const scrollFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  /* ── Edit pane (bottom of right panel) ───────────── */
  const EditorPane = () => {
    switch (openSection) {
      case "theme":
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Choose the visual style for your public clinic page. You can change this anytime.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                    className={`group relative rounded-xl border-2 overflow-hidden text-left transition-colors ${
                     theme === t.id ? "border-primary bg-primary/[0.03]" : "border-border/60 hover:border-primary/40"
                  }`}
                  data-testid={`theme-option-${t.id}`}
                >
                  <div className={`h-20 w-full ${t.preview} flex items-end p-2.5`}>
                    <div className="bg-white/10 rounded-lg px-2.5 py-1 backdrop-blur-sm">
                      <div className="h-1.5 w-12 bg-white/60 rounded mb-1" />
                      <div className="h-1 w-8 bg-white/40 rounded" />
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{t.label}</span>
                      {theme === t.id && <Badge className="text-[10px] px-2 py-0 rounded-full">Active</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case "hero":
        return (
          <div className="space-y-4">
            <div>
              <Label className="label-field mb-1.5 block">Top Strip Message (optional)</Label>
              <Input value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="e.g. Advanced dental care in your city" className="rounded-xl" onFocus={scrollFocus} data-testid="input-announcement-text" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="label-field mb-1.5 block">Tagline Line 1</Label>
                <Input value={taglineL1} onChange={e => setTaglineL1(e.target.value)} placeholder="e.g. Your Smile," className="rounded-xl" onFocus={scrollFocus} data-testid="input-tagline-l1" />
              </div>
              <div>
                <Label className="label-field mb-1.5 block">Tagline Line 2 (highlighted)</Label>
                <Input value={taglineL2} onChange={e => setTaglineL2(e.target.value)} placeholder="e.g. Our Passion." className="rounded-xl" onFocus={scrollFocus} data-testid="input-tagline-l2" />
              </div>
            </div>
            <div>
              <Label className="label-field mb-1.5 block">Hero Description</Label>
              <Textarea value={heroDescription} onChange={e => setHeroDescription(e.target.value)} placeholder="Short paragraph shown below the tagline..." rows={3} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid="input-hero-description" />
            </div>
            <div>
              <Label className="label-field mb-1.5 block">Hero / Clinic Photo</Label>
              <p className="text-xs text-muted-foreground mb-2">Used as the main image across themes. The Red Clinical theme uses it as the hero background.</p>
              <ImageUpload currentImage={heroImageUrl || undefined} onImageUploaded={(url) => setHeroImageUrl(url)} folder="clinics" fallbackText="Hero" />
            </div>
            <div>
              <Label className="label-field mb-1.5 block">Hero Foreground / Doctor Photo (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Used by the Red Clinical theme for a separate doctor or portrait image.</p>
              <ImageUpload currentImage={heroForegroundImageUrl || undefined} onImageUploaded={(url) => setHeroForegroundImageUrl(url)} folder="clinics" fallbackText="Doctor" />
            </div>
          </div>
        );

      case "about":
        return (
          <div className="space-y-4">
            <div>
              <Label className="label-field mb-1.5 block">About Photo (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Shown beside the clinic story in the Red Clinical theme.</p>
              <ImageUpload currentImage={aboutImageUrl || undefined} onImageUploaded={(url) => setAboutImageUrl(url)} folder="clinics" fallbackText="About" />
            </div>
            <div>
              <Label className="label-field mb-1.5 block">About / Our Story</Label>
              <Textarea value={aboutDescription} onChange={e => setAboutDescription(e.target.value)} placeholder="Tell patients about your clinic, your background, and what makes you different..." rows={4} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid="input-about-description" />
            </div>
            <div>
              <Label className="label-field mb-1.5 block">Our Vision</Label>
              <Textarea value={vision} onChange={e => setVision(e.target.value)} placeholder="e.g. Exceptional dental care delivered with precision, compassion, and modern technology." rows={2} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid="input-vision" />
            </div>
            <div>
              <Label className="label-field mb-1.5 block">Our Values</Label>
              <Textarea value={values} onChange={e => setValues(e.target.value)} placeholder="e.g. Patient-first · Pain-free dentistry · Transparency · Continuous excellence." rows={2} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid="input-values" />
            </div>
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50">
              <input type="checkbox" id="show-map" checked={showMap} onChange={e => setShowMap(e.target.checked)} className="h-4 w-4 accent-primary" data-testid="checkbox-show-map" />
              <Label htmlFor="show-map" className="text-sm font-medium cursor-pointer">Show interactive map on your clinic page</Label>
            </div>
          </div>
        );

      case "features":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Up to 4 reasons shown as icon cards. Always visible on every theme.</p>
            {features.map((f, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={f.icon}
                  onChange={e => setFeatures(prev => prev.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm w-full sm:w-48 sm:shrink-0 min-h-[44px]"
                  data-testid={`select-feature-icon-${i}`}
                >
                  {FEATURE_ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={f.title}
                    onChange={e => setFeatures(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                    placeholder="e.g. Expert and Passionate Team"
                    className="rounded-xl flex-1"
                    onFocus={scrollFocus}
                    data-testid={`input-feature-title-${i}`}
                  />
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10 active:scale-[0.95] shrink-0" onClick={() => setFeatures(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-feature-${i}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {features.length < 4 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setFeatures(prev => [...prev, { icon: "check", title: "" }])} data-testid="button-add-feature">
                <Plus className="h-3.5 w-3.5" />Add Feature
              </Button>
            )}
            <div className="pt-2 border-t border-border/40">
              <Label className="label-field mb-1.5 block">Side Photo (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Shown next to the feature grid. Falls back to Hero photo if not set.</p>
              <ImageUpload currentImage={featuresImageUrl || undefined} onImageUploaded={(url) => setFeaturesImageUrl(url)} folder="clinics" fallbackText="Photo" />
            </div>
          </div>
        );

      case "stats":
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Your clinic's achievements. These defaults are pre-filled — edit the numbers and labels to match your own, or delete any you don't need.</p>
            {stats.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center">
                <Input value={s.value} onChange={e => setStats(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="e.g. 2800+" className="rounded-xl font-bold" onFocus={scrollFocus} data-testid={`input-stat-value-${i}`} />
                <Input value={s.label} onChange={e => setStats(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="e.g. Dental Fillings Completed" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-stat-label-${i}`} />
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
        );

      case "services":
        return (
          <div className="space-y-4">
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
                  <Input value={s.name} onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Service name" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-service-name-${i}`} />
                  <Input value={s.description} onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Short description" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-service-desc-${i}`} />
                </div>
                <div>
                  <Label className="label-field mb-1.5 block">Service Photo (optional)</Label>
                  <ImageUpload currentImage={s.imageUrl || undefined} onImageUploaded={(url) => setServices(prev => prev.map((x, j) => j === i ? { ...x, imageUrl: url } : x))} folder="clinics" fallbackText="Svc" />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setServices(prev => [...prev, { name: "", description: "" }])} data-testid="button-add-service">
              <Plus className="h-3.5 w-3.5" />Add Service
            </Button>
          </div>
        );

      case "trust":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Add up to 6 specific, truthful reasons patients can trust your clinic. Examples include wheelchair access, emergency appointments, parking, technology, specialist care, or EMI options.</p>
            {trustPoints.map((point, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Trust point {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setTrustPoints(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-trust-point-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                  <Input value={point.title} onChange={e => setTrustPoints(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="e.g. Wheelchair-friendly ground floor" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-trust-point-title-${i}`} />
                  <select value={point.category ?? ""} onChange={e => setTrustPoints(prev => prev.map((x, j) => j === i ? { ...x, category: e.target.value || undefined } : x))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[44px]" data-testid={`select-trust-point-category-${i}`}>
                    <option value="">Category (optional)</option>
                    <option value="Accessibility">Accessibility</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Technology">Technology</option>
                    <option value="Facilities">Facilities</option>
                    <option value="Payment">Payment</option>
                    <option value="Specialist care">Specialist care</option>
                  </select>
                </div>
                <Textarea value={point.description} onChange={e => setTrustPoints(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Explain how this helps patients" rows={2} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid={`input-trust-point-description-${i}`} />
              </div>
            ))}
            {trustPoints.length < 6 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setTrustPoints(prev => [...prev, { title: "", description: "" }])} data-testid="button-add-trust-point">
                <Plus className="h-3.5 w-3.5" />Add Trust Point
              </Button>
            )}
          </div>
        );

      case "specialties":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Add up to 6 speciality cards. These are shown in the Red Clinical theme as focused areas of expertise.</p>
            {specialties.map((item, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Speciality {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setSpecialties(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-specialty-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={item.title} onChange={e => setSpecialties(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="Speciality title" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-specialty-title-${i}`} />
                <Textarea value={item.description} onChange={e => setSpecialties(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Short description of this speciality" rows={2} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid={`input-specialty-description-${i}`} />
              </div>
            ))}
            {specialties.length < 6 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setSpecialties(prev => [...prev, { title: "", description: "" }])} data-testid="button-add-specialty">
                <Plus className="h-3.5 w-3.5" />Add Speciality
              </Button>
            )}
          </div>
        );

      case "treatments":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Add up to 8 treatment groups. Enter one treatment per line to create the reference-style red treatment cards.</p>
            {treatmentGroups.map((group, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Treatment Group {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setTreatmentGroups(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-treatment-group-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={group.name} onChange={e => setTreatmentGroups(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="e.g. Aesthetic & Conservative Dentistry" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-treatment-group-name-${i}`} />
                <Textarea value={group.description ?? ""} onChange={e => setTreatmentGroups(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Optional group description" rows={2} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid={`input-treatment-group-description-${i}`} />
                <Textarea value={group.items.join("\n")} onChange={e => setTreatmentGroups(prev => prev.map((x, j) => j === i ? { ...x, items: e.target.value.split("\n").map(v => v.trim()).filter(Boolean) } : x))} placeholder={"One treatment per line\nComposite bonding\nCeramic veneers"} rows={4} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid={`input-treatment-group-items-${i}`} />
                <div>
                  <Label className="label-field mb-1.5 block">Group Image (optional)</Label>
                  <ImageUpload currentImage={group.imageUrl || undefined} onImageUploaded={(url) => setTreatmentGroups(prev => prev.map((x, j) => j === i ? { ...x, imageUrl: url } : x))} folder="clinics" fallbackText="Treat" />
                </div>
              </div>
            ))}
            {treatmentGroups.length < 8 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setTreatmentGroups(prev => [...prev, { name: "", description: "", items: [] }])} data-testid="button-add-treatment-group">
                <Plus className="h-3.5 w-3.5" />Add Treatment Group
              </Button>
            )}
          </div>
        );

      case "gallery":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Upload up to 6 clinic photos. Gallery section is <strong>hidden</strong> until at least one photo is added.</p>
            {gallery.map((g, i) => (
              <div key={i} className="p-3 rounded-xl border border-border/40 space-y-2 sm:space-y-0 sm:p-0 sm:border-0 sm:flex sm:items-start sm:gap-3">
                <div className="sm:flex-1">
                  <ImageUpload currentImage={g.url || undefined} onImageUploaded={(url) => setGallery(prev => prev.map((x, j) => j === i ? { ...x, url } : x))} folder="clinics" fallbackText={`P${i + 1}`} />
                </div>
                <div className="flex items-center gap-2 sm:flex-1">
                  <Input value={g.caption} onChange={e => setGallery(prev => prev.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))} placeholder="Caption (optional)" className="rounded-xl flex-1" onFocus={scrollFocus} data-testid={`input-gallery-caption-${i}`} />
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10 active:scale-[0.95] shrink-0" onClick={() => setGallery(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-gallery-${i}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {gallery.length < 6 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setGallery(prev => [...prev, { url: "", caption: "" }])} data-testid="button-add-gallery">
                <Plus className="h-3.5 w-3.5" />Add Photo
              </Button>
            )}
          </div>
        );

      case "testimonials":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Testimonials section is <strong>hidden</strong> until you add at least one review.</p>
            {testimonials.map((t, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Testimonial {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setTestimonials(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-testimonial-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea value={t.quote} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, quote: e.target.value } : x))} placeholder="Patient quote..." rows={2} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid={`input-testimonial-quote-${i}`} />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={t.patientName} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, patientName: e.target.value } : x))} placeholder="Patient first name" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-testimonial-name-${i}`} />
                  <select value={t.rating} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, rating: Number(e.target.value) } : x))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[44px]" data-testid={`select-testimonial-rating-${i}`}>
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
        );

      case "faq":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Add up to 12 frequently asked questions. The FAQ section is hidden until at least one complete answer is saved.</p>
            {faq.map((item, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Question {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setFaq(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-faq-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={item.question} onChange={e => setFaq(prev => prev.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} placeholder="Frequently asked question" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-faq-question-${i}`} />
                <Textarea value={item.answer} onChange={e => setFaq(prev => prev.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))} placeholder="Answer for patients" rows={3} className="rounded-xl resize-none" onFocus={scrollFocus} data-testid={`input-faq-answer-${i}`} />
              </div>
            ))}
            {faq.length < 12 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setFaq(prev => [...prev, { question: "", answer: "" }])} data-testid="button-add-faq">
                <Plus className="h-3.5 w-3.5" />Add Question
              </Button>
            )}
          </div>
        );

      case "hours":
        return (
          <div className="space-y-3">
            {hours.map((h, i) => (
              <div key={i} className="p-3 rounded-xl border border-border/40 space-y-2 sm:space-y-0 sm:p-0 sm:border-0 sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] sm:gap-2 sm:items-center">
                <Input value={h.day} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, day: e.target.value } : x))} placeholder="e.g. Mon – Fri" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-hours-day-${i}`} />
                <div className="flex gap-2 items-center">
                  <Input value={h.open} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, open: e.target.value } : x))} placeholder="9:00 AM" className="rounded-xl flex-1 sm:w-28 sm:flex-none" disabled={h.closed} onFocus={scrollFocus} data-testid={`input-hours-open-${i}`} />
                  <Input value={h.close} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, close: e.target.value } : x))} placeholder="7:00 PM" className="rounded-xl flex-1 sm:w-28 sm:flex-none" disabled={h.closed} onFocus={scrollFocus} data-testid={`input-hours-close-${i}`} />
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap min-h-[44px]">
                    <input type="checkbox" checked={h.closed} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, closed: e.target.checked } : x))} className="accent-primary h-4 w-4" data-testid={`checkbox-hours-closed-${i}`} />
                    Closed
                  </label>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10 active:scale-[0.95] shrink-0" onClick={() => setHours(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-hours-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setHours(prev => [...prev, { day: "", open: "", close: "", closed: false }])} data-testid="button-add-hours">
              <Plus className="h-3.5 w-3.5" />Add Row
            </Button>
          </div>
        );

      case "social":
        return (
          <div className="space-y-4">
            <div>
              <Label className="label-field mb-1.5 block">Instagram URL</Label>
              <Input value={socialLinks.instagram ?? ""} onChange={e => setSocialLinks(p => ({ ...p, instagram: e.target.value }))} placeholder="https://instagram.com/yourclinic" className="rounded-xl" onFocus={scrollFocus} data-testid="input-social-instagram" />
            </div>
            <div>
              <Label className="label-field mb-1.5 block">Facebook URL</Label>
              <Input value={socialLinks.facebook ?? ""} onChange={e => setSocialLinks(p => ({ ...p, facebook: e.target.value }))} placeholder="https://facebook.com/yourclinic" className="rounded-xl" onFocus={scrollFocus} data-testid="input-social-facebook" />
            </div>
            <div>
              <Label className="label-field mb-1.5 block">YouTube URL</Label>
              <Input value={socialLinks.youtube ?? ""} onChange={e => setSocialLinks(p => ({ ...p, youtube: e.target.value }))} placeholder="https://youtube.com/@yourclinic" className="rounded-xl" onFocus={scrollFocus} data-testid="input-social-youtube" />
            </div>
          </div>
        );

      case "social-posts":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Add up to 6 image cards for the social gallery. These are manually managed; the page does not connect to a live social-media feed.</p>
            {socialPosts.map((post, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Social Post {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setSocialPosts(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-social-post-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ImageUpload currentImage={post.imageUrl || undefined} onImageUploaded={(url) => setSocialPosts(prev => prev.map((x, j) => j === i ? { ...x, imageUrl: url } : x))} folder="clinics" fallbackText="Post" />
                <Input value={post.caption ?? ""} onChange={e => setSocialPosts(prev => prev.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))} placeholder="Caption (optional)" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-social-post-caption-${i}`} />
                <Input value={post.link ?? ""} onChange={e => setSocialPosts(prev => prev.map((x, j) => j === i ? { ...x, link: e.target.value } : x))} placeholder="Post link (optional)" className="rounded-xl" onFocus={scrollFocus} data-testid={`input-social-post-link-${i}`} />
              </div>
            ))}
            {socialPosts.length < 6 && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setSocialPosts(prev => [...prev, { imageUrl: "" }])} data-testid="button-add-social-post">
                <Plus className="h-3.5 w-3.5" />Add Social Post
              </Button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Top header ── */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex">
          <div className="w-1.5 bg-sky-500/60 shrink-0" />
          <div className="flex-1 px-5 py-4 bg-gradient-to-r from-sky-500/[0.06] to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Globe className="h-[18px] w-[18px] text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Clinic Website</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure your public clinic page. Patients can browse it before booking.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {previewUrl && (
                <>
                  {/* Mobile: open preview in-app sheet */}
                  <Button
                    variant="outline"
                    className="gap-2 rounded-xl min-h-[44px] sm:hidden"
                    onClick={() => setPreviewSheetOpen(true)}
                    data-testid="button-preview-mobile"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                  {/* Desktop: open in new tab */}
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
                    <Button variant="outline" className="gap-2 rounded-xl min-h-[44px]">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </>
              )}
              <Button
                className="gap-2 rounded-xl min-h-[44px]"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                data-testid="button-save-website"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save Website</span>
                <span className="sm:hidden">Save</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          WEBSITE STRUCTURE  (2-pane unified editor)
      ══════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-border/60 overflow-hidden">

        {/* E — Panel header with completion counter */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-muted/40 border-b border-border/50">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Layout className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-sm text-foreground">Website Structure</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {configuredCount} of {MAP_ROWS.length} sections set up
              {needsAttentionCount > 0 && ` · ${needsAttentionCount} need content`}
            </span>
          </div>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline active:underline active:opacity-70 shrink-0"
            >
              Open live page <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>

        {/* 2-pane body */}
        <div className="flex flex-col lg:flex-row bg-background" style={{ minHeight: "clamp(400px, 60vh, 600px)" }}>

          {/* ── Mobile: horizontal tab strip with status dots (hidden on desktop) ── */}
          <div className="hide-scrollbar lg:hidden flex overflow-x-auto gap-1 p-2 border-b border-border/40">
            {MAP_ROWS.map((row, idx) => {
              const Icon = row.icon;
              const isActive = openSection === row.id;
              const dotCls = row.dot === "green" ? "bg-emerald-500" : row.dot === "amber" ? "bg-amber-400" : "bg-muted-foreground/20";
              return (
                <button
                  key={row.id}
                  onClick={() => row.editable ? setOpenSection(row.id as Section) : undefined}
                  disabled={!row.editable}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border whitespace-nowrap shrink-0 transition-all min-h-[44px] text-xs font-semibold ${
                    isActive
                    ? "bg-primary/12 border-primary/40 text-primary"
                      : "border-border/40 text-muted-foreground hover:bg-muted/50 active:scale-[0.97]"
                  } ${!row.editable ? "opacity-40 cursor-default" : ""}`}
                  data-testid={`mobile-tab-${row.id}`}
                >
                  <span className="text-xs font-mono opacity-40">{idx + 1}</span>
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotCls}`} />
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {row.label}
                </button>
              );
            })}
          </div>

          {/* B — Left: redesigned section navigator (desktop only) */}
          <div className="hidden lg:flex lg:flex-col w-60 shrink-0 border-r border-border/40 overflow-y-auto">
            {MAP_ROWS.map((row, idx) => {
              const Icon = row.icon;
              const isActive = openSection === row.id;
              const dotCls =
                row.dot === "green" ? "bg-emerald-500" :
                row.dot === "amber" ? "bg-amber-400" :
                "bg-muted-foreground/25";
              const statusCls =
                row.dot === "amber" ? "text-amber-600 dark:text-amber-400" :
                row.dot === "green" ? "text-emerald-600 dark:text-emerald-400" :
                "text-muted-foreground";

              if (!row.editable) {
                return (
                  <div
                    key={row.id}
                    className="flex items-start gap-3 px-3 py-3 border-b border-border/20 bg-muted/10"
                  >
                    <span className="text-xs font-mono text-muted-foreground/30 mt-1.5 w-4 text-right shrink-0">{idx + 1}</span>
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-xs font-semibold text-muted-foreground/70 leading-none truncate">{row.label}</p>
                      <p className="text-xs text-muted-foreground/50 mt-1 leading-tight line-clamp-2">{row.autoNote || row.status}</p>
                    </div>
                    <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${dotCls}`} />
                  </div>
                );
              }

              return (
                <button
                  key={row.id}
                  onClick={() => setOpenSection(row.id as Section)}
                  className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-all group min-h-[52px] border-b border-border/20 ${
                    isActive
                       ? "bg-primary/12 border-l-[3px] border-l-primary"
                      : "hover:bg-muted/50 active:bg-muted/70 border-l-[3px] border-l-transparent"
                  }`}
                  data-testid={`map-row-${row.id}`}
                >
                  <span className={`text-xs font-mono mt-1.5 w-4 text-right shrink-0 ${isActive ? "text-primary/50" : "text-muted-foreground/30"}`}>{idx + 1}</span>
                     <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-primary/15" : "bg-muted group-hover:bg-muted/70"}`}>
                    <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className={`text-xs font-semibold leading-none truncate ${isActive ? "text-primary" : "text-foreground"}`}>{row.label}</p>
                    <p className={`text-xs mt-1 truncate ${statusCls}`}>{row.status}</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${dotCls}`} />
                </button>
              );
            })}
          </div>

          {/* ── Right: preview + editor ── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* C — Content preview strip (SectionHeader rendered inside each PreviewPane case) */}
            <div className="h-52 shrink-0 border-b border-border/40 overflow-hidden">
              {PreviewPane()}
            </div>

            {/* Edit form area */}
            {activeRow?.editable ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="editor-form-fields flex-1 overflow-y-auto p-5">
                  {EditorPane()}
                </div>
                {/* Sticky save bar */}
                <div className="shrink-0 border-t border-border/40 bg-background px-5 py-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Changes apply to your live page after saving.
                  </p>
                  <Button
                    className="gap-2 rounded-xl px-6 min-h-[44px]"
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-website-panel"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saveMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">Auto-generated</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
                  This section is built automatically from your clinic profile — no manual editing needed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile live preview sheet ── */}
      {previewUrl && (
        <Sheet open={previewSheetOpen} onOpenChange={setPreviewSheetOpen}>
          <SheetContent
            side="bottom"
            className="h-[92dvh] p-0 flex flex-col rounded-t-2xl overflow-hidden"
          >
            {/* Header bar */}
            <SheetHeader className="shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b border-border/50 bg-background space-y-0">
              <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Live Clinic Page
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground active:scale-[0.95]"
                  onClick={() => setIframeKey(k => k + 1)}
                  title="Reload preview"
                  data-testid="button-reload-preview"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 rounded-xl items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title="Open in new tab"
                  data-testid="link-open-preview-tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground active:scale-[0.95]"
                  onClick={() => setPreviewSheetOpen(false)}
                  data-testid="button-close-preview"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </SheetHeader>

            {/* URL pill */}
            <div className="shrink-0 px-4 py-2 bg-muted/30 border-b border-border/40">
              <p className="text-[11px] text-muted-foreground font-mono truncate text-center">
                {window.location.origin}{previewUrl}
              </p>
            </div>

            {/* iframe */}
            <div className="flex-1 overflow-hidden bg-background">
              <iframe
                key={iframeKey}
                src={previewUrl}
                title="Clinic page preview"
                className="w-full h-full border-0"
                data-testid="iframe-clinic-preview"
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
