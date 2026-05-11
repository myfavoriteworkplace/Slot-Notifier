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

type Section = "theme" | "hero" | "about" | "services" | "gallery" | "testimonials" | "hours" | "social";

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
  const [services, setServices] = useState<{ name: string; description: string }[]>(
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
  const [openSection, setOpenSection] = useState<Section>("theme");

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
      services: services.filter(s => s.name),
      gallery: gallery.filter(g => g.url),
      testimonials: testimonials.filter(t => t.quote && t.patientName),
      hours,
      socialLinks: Object.values(socialLinks).some(Boolean) ? socialLinks : undefined,
      showMap,
    };
    saveMutation.mutate(config);
  };

  const previewUrl = clinic?.id ? `/about?clinicId=${clinic.id}` : null;

  const toggle = (s: Section) => setOpenSection(prev => prev === s ? "theme" : s);

  const SectionHeader = ({ id, icon: Icon, label }: { id: Section; icon: any; label: string }) => (
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
      </div>
      {openSection === id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Header row */}
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

      {/* ── Section 1: Theme picker ── */}
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
                {/* Thumbnail */}
                <div className={`h-28 w-full ${t.preview} flex items-end p-3`}>
                  <div className="bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    <div className="h-2 w-16 bg-white/60 rounded mb-1.5" />
                    <div className="h-1.5 w-10 bg-white/40 rounded" />
                  </div>
                </div>
                {/* Info */}
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

      {/* ── Section 2: Hero ── */}
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
              <p className="text-xs text-muted-foreground mb-2">Used as the background (Warm theme) or side image (Classic theme). Also shown in the Modern theme.</p>
              <ImageUpload
                currentImageUrl={heroImageUrl || null}
                onUploadComplete={(url) => setHeroImageUrl(url)}
                folder="clinic-photos"
                label="Upload Clinic Photo"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: About ── */}
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
              <input
                type="checkbox"
                id="show-map"
                checked={showMap}
                onChange={e => setShowMap(e.target.checked)}
                className="h-4 w-4 accent-primary"
                data-testid="checkbox-show-map"
              />
              <Label htmlFor="show-map" className="text-sm font-medium cursor-pointer">Show interactive map on your clinic page</Label>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Services ── */}
      <div className="space-y-3">
        <SectionHeader id="services" icon={Layers} label="Services" />
        {openSection === "services" && (
          <div className="px-1 space-y-3">
            {services.map((s, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_1.5fr_auto] gap-3 items-start">
                <Input
                  value={s.name}
                  onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  placeholder="Service name"
                  className="rounded-xl"
                  data-testid={`input-service-name-${i}`}
                />
                <Input
                  value={s.description}
                  onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                  placeholder="Short description"
                  className="rounded-xl"
                  data-testid={`input-service-desc-${i}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setServices(prev => prev.filter((_, j) => j !== i))}
                  data-testid={`button-remove-service-${i}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              onClick={() => setServices(prev => [...prev, { name: "", description: "" }])}
              data-testid="button-add-service"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Service
            </Button>
          </div>
        )}
      </div>

      {/* ── Section 5: Gallery ── */}
      <div className="space-y-3">
        <SectionHeader id="gallery" icon={Image} label="Photo Gallery" />
        {openSection === "gallery" && (
          <div className="px-1 space-y-4">
            <p className="text-xs text-muted-foreground">Upload up to 6 clinic photos. These appear as a gallery grid on your website.</p>
            {gallery.map((g, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-1">
                  <ImageUpload
                    currentImageUrl={g.url || null}
                    onUploadComplete={(url) => setGallery(prev => prev.map((x, j) => j === i ? { ...x, url } : x))}
                    folder="clinic-photos"
                    label={`Photo ${i + 1}`}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={g.caption}
                    onChange={e => setGallery(prev => prev.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}
                    placeholder="Caption (optional)"
                    className="rounded-xl"
                    data-testid={`input-gallery-caption-${i}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 shrink-0 mt-1"
                  onClick={() => setGallery(prev => prev.filter((_, j) => j !== i))}
                  data-testid={`button-remove-gallery-${i}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {gallery.length < 6 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2"
                onClick={() => setGallery(prev => [...prev, { url: "", caption: "" }])}
                data-testid="button-add-gallery"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Photo
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Section 6: Testimonials ── */}
      <div className="space-y-3">
        <SectionHeader id="testimonials" icon={Star} label="Patient Testimonials" />
        {openSection === "testimonials" && (
          <div className="px-1 space-y-4">
            {testimonials.map((t, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Testimonial {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                    onClick={() => setTestimonials(prev => prev.filter((_, j) => j !== i))}
                    data-testid={`button-remove-testimonial-${i}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  value={t.quote}
                  onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, quote: e.target.value } : x))}
                  placeholder="Patient quote..."
                  rows={2}
                  className="rounded-xl resize-none"
                  data-testid={`input-testimonial-quote-${i}`}
                />
                <div className="flex gap-3">
                  <Input
                    value={t.patientName}
                    onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, patientName: e.target.value } : x))}
                    placeholder="Patient first name"
                    className="rounded-xl"
                    data-testid={`input-testimonial-name-${i}`}
                  />
                  <select
                    value={t.rating}
                    onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, rating: Number(e.target.value) } : x))}
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    data-testid={`select-testimonial-rating-${i}`}
                  >
                    {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{"★".repeat(r)} {r}/5</option>)}
                  </select>
                </div>
              </div>
            ))}
            {testimonials.length < 5 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2"
                onClick={() => setTestimonials(prev => [...prev, { quote: "", patientName: "", rating: 5 }])}
                data-testid="button-add-testimonial"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Testimonial
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Section 7: Hours ── */}
      <div className="space-y-3">
        <SectionHeader id="hours" icon={Clock} label="Clinic Hours" />
        {openSection === "hours" && (
          <div className="px-1 space-y-3">
            {hours.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
                <Input
                  value={h.day}
                  onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, day: e.target.value } : x))}
                  placeholder="e.g. Mon – Fri"
                  className="rounded-xl"
                  data-testid={`input-hours-day-${i}`}
                />
                <Input
                  value={h.open}
                  onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, open: e.target.value } : x))}
                  placeholder="9:00 AM"
                  className="rounded-xl w-28"
                  disabled={h.closed}
                  data-testid={`input-hours-open-${i}`}
                />
                <Input
                  value={h.close}
                  onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, close: e.target.value } : x))}
                  placeholder="7:00 PM"
                  className="rounded-xl w-28"
                  disabled={h.closed}
                  data-testid={`input-hours-close-${i}`}
                />
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={h.closed}
                    onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, closed: e.target.checked } : x))}
                    className="accent-primary"
                    data-testid={`checkbox-hours-closed-${i}`}
                  />
                  Closed
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setHours(prev => prev.filter((_, j) => j !== i))}
                  data-testid={`button-remove-hours-${i}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              onClick={() => setHours(prev => [...prev, { day: "", open: "", close: "", closed: false }])}
              data-testid="button-add-hours"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </Button>
          </div>
        )}
      </div>

      {/* ── Section 8: Social links ── */}
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

      {/* Save bar */}
      <div className="pt-4 border-t border-border/50 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="gap-2 rounded-xl px-8"
          data-testid="button-save-website-bottom"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save Website"}
        </Button>
      </div>
    </div>
  );
}
