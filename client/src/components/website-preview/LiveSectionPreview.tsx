import {
  BarChart3,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Image as ImageIcon,
  Instagram,
  Layers3,
  ListChecks,
  Palette,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import type { ClinicWebsiteConfig } from "@shared/schema";
import {
  DEFAULT_FEATURES,
  DEFAULT_SERVICES,
  DEFAULT_STATS,
  DoctorsCarousel,
  GallerySection,
  RedReviews,
  RedSpecialtiesSection,
  RedTreatmentGroups,
  RichFooter,
  ServicesCarousel,
  TestimonialsCarousel,
  ThemeClinic,
} from "@/components/clinic-themes/ClinicThemes";

export type LivePreviewSection =
  | "theme"
  | "hero"
  | "about"
  | "features"
  | "stats"
  | "services"
  | "trust"
  | "specialties"
  | "treatments"
  | "doctors"
  | "gallery"
  | "testimonials"
  | "faq"
  | "hours"
  | "social"
  | "social-posts"
  | "footer";

type ThemeKey = ClinicWebsiteConfig["theme"];

type ThemePreviewTokens = {
  label: string;
  hero: string;
  surface: string;
  panel: string;
  border: string;
  heading: string;
  body: string;
  accent: string;
  accentBg: string;
  gallery: string;
  footer: string;
  serif?: boolean;
};

const THEME_TOKENS: Record<ThemeKey, ThemePreviewTokens> = {
  classic: {
    label: "Classic",
    hero: "bg-[#0A3D2E]",
    surface: "bg-[#F4F8F6]",
    panel: "bg-white",
    border: "border-[#DCE9E3]",
    heading: "text-[#0A3D2E]",
    body: "text-gray-600",
    accent: "text-[#0F9B6E]",
    accentBg: "bg-[#0F9B6E]",
    gallery: "bg-[#0A3D2E]",
    footer: "bg-[#08281f]",
    serif: true,
  },
  warm: {
    label: "Warm",
    hero: "bg-[#1E3A2F]",
    surface: "bg-[#F8EDE3]",
    panel: "bg-[#FFF9F4]",
    border: "border-[#E8D6C6]",
    heading: "text-[#1E3A2F]",
    body: "text-[#6F625A]",
    accent: "text-[#B56A45]",
    accentBg: "bg-[#B56A45]",
    gallery: "bg-[#1E3A2F]",
    footer: "bg-[#0D2B22]",
    serif: true,
  },
  modern: {
    label: "Modern",
    hero: "bg-[#0F172A]",
    surface: "bg-[#F8FAFC]",
    panel: "bg-white",
    border: "border-gray-200",
    heading: "text-[#0F172A]",
    body: "text-gray-600",
    accent: "text-[#0F9B6E]",
    accentBg: "bg-[#0F9B6E]",
    gallery: "bg-[#0F172A]",
    footer: "bg-[#080D14]",
  },
  "red-clinical": {
    label: "Red Clinical",
    hero: "bg-[#130506]",
    surface: "bg-[#FAFAFA]",
    panel: "bg-white",
    border: "border-gray-200",
    heading: "text-[#171717]",
    body: "text-gray-600",
    accent: "text-[#E11D24]",
    accentBg: "bg-[#D9090D]",
    gallery: "bg-[#260708]",
    footer: "bg-[#130506]",
  },
};

const SECTION_LABELS: Record<LivePreviewSection, string> = {
  theme: "Theme",
  hero: "Hero",
  about: "About & Values",
  features: "Why Choose Us",
  stats: "Stats Bar",
  services: "Services",
  trust: "Trust & Facilities",
  specialties: "Specialties",
  treatments: "Treatment Groups",
  doctors: "Doctors",
  gallery: "Photo Gallery",
  testimonials: "Patient Reviews",
  faq: "FAQ",
  hours: "Clinic Hours",
  social: "Social Links",
  "social-posts": "Social Gallery",
  footer: "Footer",
};

const RED_DEFAULT_SPECIALTIES = [
  { title: "Microscope-Assisted Dentistry", description: "Precise, gentle treatment supported by advanced magnification." },
  { title: "Advanced Endodontics", description: "Specialist root canal care designed around comfort and long-term results." },
  { title: "Conservative Dentistry", description: "Preserving natural tooth structure with minimally invasive techniques." },
];

const RED_DEFAULT_TREATMENTS = [
  { name: "Pediatric Dentistry", description: "Gentle care for growing smiles.", items: ["Pulpotomy and crowns", "Fluoride therapy", "Child-friendly environment"] },
  { name: "Aesthetic & Conservative Dentistry", description: "Natural-looking results with thoughtful planning.", items: ["Composite bonding", "Ceramic veneers", "Smile designing"] },
  { name: "General Dentistry", description: "Reliable care for everyday oral health.", items: ["Tooth-coloured fillings", "Scaling and polishing", "Preventive check-ups"] },
];

const RED_DEFAULT_FAQ = [
  { question: "How often should I visit the dentist?", answer: "A dental check-up every six months helps maintain healthy teeth and gums." },
  { question: "What should I do in a dental emergency?", answer: "Call the clinic as soon as possible so the team can guide you to quick relief and expert care." },
  { question: "Is root canal treatment painful?", answer: "Treatment is performed under local anaesthesia and is designed to keep you comfortable." },
];

const titleStyle = (tokens: ThemePreviewTokens) =>
  tokens.serif ? { fontFamily: "'Playfair Display', Georgia, serif" } : { fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.03em" };

function cleanList<T>(items: T[] | undefined, isValid: (item: T) => boolean) {
  return (items ?? []).filter(isValid);
}

function PreviewFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-h-full overflow-hidden ${className}`}>{children}</div>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: React.ElementType; title: string; detail: string }) {
  return (
    <div className="min-h-[260px] flex flex-col items-center justify-center gap-2 px-6 py-10 text-center bg-muted/10">
      <Icon className="h-9 w-9 text-muted-foreground/45" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function ThemeSnapshot({ tokens, clinic }: { tokens: ThemePreviewTokens; clinic: ThemeClinic }) {
  return (
    <div className={`min-h-[290px] ${tokens.surface}`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className={`${tokens.hero} px-5 py-3 flex items-center justify-between gap-3 text-white`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-7 w-7 rounded-lg ${tokens.accentBg} flex items-center justify-center text-xs font-black`}>
            {clinic.name?.charAt(0) || "C"}
          </div>
          <span className="text-xs font-bold truncate">{clinic.name || "Your Clinic"}</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[10px] text-white/65">
          <span>About</span><span>Services</span><span>Contact</span>
        </div>
      </div>
      <div className={`${tokens.hero} px-5 py-8 sm:px-10 sm:py-10 text-white`}>
        <p className={`text-[10px] uppercase tracking-[0.22em] ${tokens.accent}`}>{clinic.city || "Your City"}</p>
        <h2 className="mt-2 max-w-xl text-2xl sm:text-4xl font-black leading-tight" style={titleStyle(tokens)}>
          Exceptional care, thoughtfully designed.
        </h2>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-white/60">
          A recognizable snapshot of the {tokens.label} public website style.
        </p>
        <span className={`mt-5 inline-flex rounded-full ${tokens.accentBg} px-4 py-2 text-[10px] font-bold text-white`}>
          Book an Appointment
        </span>
      </div>
      <div className={`grid grid-cols-3 gap-2 px-5 py-5 ${tokens.panel}`}>
        {["Care", "Trust", "Comfort"].map((label) => (
          <div key={label} className={`rounded-xl border ${tokens.border} p-3 text-center`}>
            <div className={`mx-auto mb-2 h-5 w-5 rounded-full ${tokens.accentBg}/15`} />
            <p className={`text-[10px] font-bold ${tokens.heading}`}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroPreview({ tokens, config, clinic }: { tokens: ThemePreviewTokens; config: ClinicWebsiteConfig; clinic: ThemeClinic }) {
  return (
    <div className={`relative min-h-[330px] overflow-hidden ${tokens.hero} px-6 py-8 sm:px-10 sm:py-10 text-white`}>
      {config.heroImageUrl && (
        <img src={config.heroImageUrl} alt="Clinic hero preview" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      )}
      <div className="relative max-w-2xl">
        <p className={`text-[10px] uppercase tracking-[0.22em] ${tokens.accent}`}>{clinic.city || "Your City"}</p>
        <h2 className="mt-3 text-3xl sm:text-5xl font-black leading-[1.05]" style={titleStyle(tokens)}>
          {config.taglineL1 || "Your smile,"}<br />
          <span className={tokens.accent}>{config.taglineL2 || "our passion."}</span>
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/65">
          {config.heroDescription || `${clinic.name || "Your clinic"} is here to make every visit feel clear, comfortable, and confident.`}
        </p>
        <span className={`mt-6 inline-flex rounded-full ${tokens.accentBg} px-5 py-2.5 text-xs font-bold text-white`}>
          Book an Appointment
        </span>
      </div>
      {config.heroImageUrl && <div className="absolute bottom-5 right-5 h-16 w-20 overflow-hidden rounded-xl border border-white/20 sm:h-24 sm:w-32"><img src={config.heroImageUrl} alt="" className="h-full w-full object-cover" /></div>}
    </div>
  );
}

function AboutPreview({ tokens, config, clinic }: { tokens: ThemePreviewTokens; config: ClinicWebsiteConfig; clinic: ThemeClinic }) {
  const description = config.aboutDescription || `${clinic.name || "Your clinic"} is committed to precise, compassionate dental care in a comfortable environment.`;
  return (
    <div className={`min-h-[330px] ${tokens.surface} p-6 sm:p-10`}>
      <div className="grid gap-7 sm:grid-cols-2 sm:items-center">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${tokens.accent}`}>About us</p>
          <h2 className={`mt-2 text-2xl sm:text-3xl font-black ${tokens.heading}`} style={titleStyle(tokens)}>
            {tokens.label === "Red Clinical" ? `Redefining dental care in ${clinic.city || "your community"}` : clinic.name || "About our clinic"}
          </h2>
          <p className={`mt-3 text-sm leading-relaxed ${tokens.body}`}>{description}</p>
          <div className="mt-4 space-y-2">
            {[config.vision, config.values].filter(Boolean).map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${tokens.accent}`} />
                <span className={tokens.body}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`overflow-hidden rounded-2xl border ${tokens.border} ${tokens.panel} min-h-[170px]`}>
          {config.aboutImageUrl || config.heroImageUrl ? (
            <img src={config.aboutImageUrl || config.heroImageUrl} alt={`Inside ${clinic.name || "the clinic"}`} className="h-full min-h-[170px] w-full object-cover" />
          ) : (
            <div className={`flex min-h-[170px] items-center justify-center ${tokens.heading} opacity-25`}>
              <ImageIcon className="h-12 w-12" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturePreview({ tokens, features }: { tokens: ThemePreviewTokens; features: { icon: string; title: string }[] }) {
  return (
    <div className={`min-h-[300px] ${tokens.surface} p-6 sm:p-10`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${tokens.accent}`}>Why choose us</p>
      <h2 className={`mt-2 text-2xl sm:text-3xl font-black ${tokens.heading}`} style={titleStyle(tokens)}>Our commitment to you</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {features.slice(0, 4).map((feature, index) => (
          <div key={`${feature.title}-${index}`} className={`rounded-2xl border ${tokens.border} ${tokens.panel} p-4 text-center`}>
            <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${tokens.accentBg}/10 border ${tokens.border}`}>
              <Sparkles className={`h-4 w-4 ${tokens.accent}`} aria-hidden="true" />
            </div>
            <p className={`mt-3 text-xs font-bold leading-snug ${tokens.heading}`}>{feature.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsPreview({ tokens, stats }: { tokens: ThemePreviewTokens; stats: { value: string; label: string }[] }) {
  return (
    <div className={`min-h-[250px] ${tokens.hero} px-6 py-10 text-white sm:px-10`}>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        {stats.slice(0, 4).map((stat, index) => (
          <div key={`${stat.label}-${index}`} className="text-center">
            <p className={`text-3xl font-black ${tokens.label === "Red Clinical" ? "text-red-300" : "text-white"}`}>{stat.value}</p>
            <p className="mt-2 text-xs leading-snug text-white/60">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustPreview({ tokens, points }: { tokens: ThemePreviewTokens; points: { title: string; description: string; category?: string }[] }) {
  return (
    <div className={`${tokens.panel} min-h-[270px] px-6 py-8 sm:px-10`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {points.slice(0, 6).map((point, index) => (
          <div key={`${point.title}-${index}`} className="flex items-start gap-2 p-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 ${tokens.accent}`}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold leading-snug text-[#171717]">{point.title}</p>
              <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-gray-500">{point.description}</p>
              {point.category && <span className={`mt-1 block text-[9px] font-bold uppercase tracking-wider ${tokens.accent}`}>{point.category}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoursPreview({ tokens, hours }: { tokens: ThemePreviewTokens; hours: NonNullable<ClinicWebsiteConfig["hours"]> }) {
  return (
    <div className={`${tokens.surface} min-h-[300px] p-6 sm:p-10`}>
      <div className="max-w-xl">
        <div className="flex items-center gap-2">
          <Clock3 className={`h-5 w-5 ${tokens.accent}`} aria-hidden="true" />
          <h2 className={`text-2xl font-black ${tokens.heading}`} style={titleStyle(tokens)}>Clinic Hours</h2>
        </div>
        <div className={`mt-5 overflow-hidden rounded-xl border ${tokens.border}`}>
          {hours.map((hour, index) => (
            <div key={`${hour.day}-${index}`} className={`flex items-center justify-between gap-4 border-b ${tokens.border} ${tokens.panel} px-4 py-3 last:border-b-0`}>
              <span className={`text-xs font-semibold ${tokens.heading}`}>{hour.day || "—"}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${hour.closed ? "bg-red-50 text-red-500" : `${tokens.accentBg}/10 ${tokens.accent}`}`}>
                {hour.closed ? "Closed" : hour.open && hour.close ? `${hour.open} – ${hour.close}` : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SocialPreview({ tokens, links }: { tokens: ThemePreviewTokens; links?: ClinicWebsiteConfig["socialLinks"] }) {
  const entries = [
    { key: "instagram", label: "Instagram", value: links?.instagram, icon: Instagram },
    { key: "facebook", label: "Facebook", value: links?.facebook, icon: Share2 },
    { key: "youtube", label: "YouTube", value: links?.youtube, icon: Users },
  ];
  return (
    <div className={`${tokens.footer} min-h-[270px] p-6 text-white sm:p-10`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${tokens.accent}`}>Connect with us</p>
      <h2 className="mt-2 text-2xl font-black" style={titleStyle(tokens)}>Find us online</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {entries.map(({ key, label, value, icon: Icon }) => (
          <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Icon className={`h-5 w-5 ${tokens.accent}`} aria-hidden="true" />
            <p className="mt-3 text-xs font-bold">{label}</p>
            <p className="mt-1 truncate text-[10px] text-white/55">{value || "Not added yet"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialGalleryPreview({ posts, tokens }: { posts: NonNullable<ClinicWebsiteConfig["socialPosts"]>; tokens: ThemePreviewTokens }) {
  return (
    <div className={`${tokens.gallery} min-h-[300px] p-6 text-white sm:p-10`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Follow our work</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black" style={titleStyle(tokens)}>Inside the clinic</h2>
        <Instagram className="h-6 w-6 text-red-300" aria-hidden="true" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {posts.slice(0, 6).map((post, index) => (
          <div key={`${post.imageUrl}-${index}`} className="aspect-square overflow-hidden rounded-xl bg-white/10">
            <img src={post.imageUrl} alt={post.caption || `Clinic social post ${index + 1}`} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FaqPreview({ faq }: { faq: NonNullable<ClinicWebsiteConfig["faq"]> }) {
  return (
    <div className="min-h-[300px] bg-[#FAFAFA] p-6 sm:p-10">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E11D24]">FAQ</p>
      <h2 className="mt-2 text-2xl font-black text-[#171717]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.03em" }}>Frequently asked questions</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {faq.slice(0, 4).map((item, index) => (
          <div key={`${item.question}-${index}`} className="overflow-hidden border border-gray-200 bg-white">
            <div className="flex items-center gap-2 bg-[#D9090D] px-4 py-3 text-xs font-bold text-white">
              <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.question}</span>
            </div>
            <p className="px-4 py-3 text-xs leading-relaxed text-gray-600">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveSectionContent({
  section,
  tokens,
  config,
  clinic,
  bookingHref,
}: {
  section: LivePreviewSection;
  tokens: ThemePreviewTokens;
  config: ClinicWebsiteConfig;
  clinic: ThemeClinic;
  bookingHref: string;
}) {
  const services = config.services?.length ? config.services : DEFAULT_SERVICES;
  const features = config.features?.length ? config.features : DEFAULT_FEATURES;
  const stats = config.stats?.length ? config.stats : DEFAULT_STATS;
  const hours = config.hours ?? [];
  const doctors = clinic.doctors?.filter((doctor) => doctor.name) ?? [];
  const trustPoints = config.trustPoints?.length
    ? config.trustPoints
    : features.slice(0, 4).map((feature) => ({ title: feature.title, description: "Thoughtful treatment, every visit." }));
  const specialties = config.specialties?.length ? config.specialties : RED_DEFAULT_SPECIALTIES;
  const treatmentGroups = config.treatmentGroups?.length ? config.treatmentGroups : RED_DEFAULT_TREATMENTS;
  const faq = config.faq?.length ? config.faq : RED_DEFAULT_FAQ;
  const testimonials = config.testimonials ?? [];
  const gallery = config.gallery ?? [];
  const socialPosts = config.socialPosts ?? [];

  switch (section) {
    case "theme":
      return <ThemeSnapshot tokens={tokens} clinic={clinic} />;
    case "hero":
      return <HeroPreview tokens={tokens} config={config} clinic={clinic} />;
    case "about":
      return <AboutPreview tokens={tokens} config={config} clinic={clinic} />;
    case "features":
      return tokens.label === "Red Clinical"
        ? <TrustPreview tokens={tokens} points={trustPoints} />
        : <FeaturePreview tokens={tokens} features={features} />;
    case "stats":
      return tokens.label === "Red Clinical"
        ? <StatsPreview tokens={tokens} stats={stats} />
        : <StatsPreview tokens={tokens} stats={stats} />;
    case "services":
      return (
        <ServicesCarousel
          services={services}
          sectionId="live-preview-services"
          titleLabel={tokens.label === "Red Clinical" ? "Treatments" : undefined}
          title={tokens.label === "Red Clinical" ? "Choose the right care for you" : "Our Services"}
          bg={tokens.surface}
          cardBg={tokens.panel}
          border={tokens.border}
          titleColor={tokens.heading}
          accentColor={tokens.accent}
          textColor={tokens.body}
          serif={tokens.serif}
          numStyle={tokens.label === "Red Clinical"}
        />
      );
    case "trust":
      return <TrustPreview tokens={tokens} points={trustPoints} />;
    case "specialties":
      return <RedSpecialtiesSection specialties={specialties} />;
    case "treatments":
      return <RedTreatmentGroups groups={treatmentGroups} />;
    case "doctors":
      return tokens.label === "Red Clinical" ? (
        <div className="pointer-events-none">
          <div className="min-h-[250px]">
            <div className="px-6 py-7 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E11D24]">Our team</p>
              <h2 className="mt-2 text-2xl font-black text-[#171717]">Meet your dental specialists</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-[#FAFAFA] p-6 sm:grid-cols-3">
              {doctors.slice(0, 3).map((doctor, index) => (
                <div key={`${doctor.name}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-[#130506]">
                    {doctor.imageUrl ? <img src={doctor.imageUrl} alt={doctor.name} className="h-full w-full object-cover object-top" /> : <Users className="mx-auto mt-5 h-7 w-7 text-red-300" aria-hidden="true" />}
                  </div>
                  <p className="mt-3 text-xs font-bold text-[#171717]">{doctor.name}</p>
                  {doctor.specialization && <p className="mt-1 text-[10px] font-bold uppercase text-[#D9090D]">{doctor.specialization}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <DoctorsCarousel
          clinic={clinic}
          sectionId="live-preview-doctors"
          title="Our Team of Experts"
          bg={tokens.surface}
          cardBg={tokens.panel}
          border={tokens.border}
          titleColor={tokens.heading}
          accentColor={tokens.accent}
          serif={tokens.serif}
        />
      );
    case "gallery":
      return <GallerySection gallery={gallery} bg={tokens.gallery} titleColor="text-white" serif={tokens.serif} />;
    case "testimonials":
      return tokens.label === "Red Clinical"
        ? <RedReviews testimonials={testimonials} />
        : <TestimonialsCarousel testimonials={testimonials} bg={tokens.panel} heading="What Our Patients Say" headingColor={tokens.heading} quoteColor={tokens.accent} textColor={tokens.body} nameColor={tokens.heading} dividerColor={tokens.accentBg} avatarBg={tokens.accentBg} dotActive={tokens.accentBg} dotInactive="bg-gray-200" serif={tokens.serif} />;
    case "faq":
      return <FaqPreview faq={faq} />;
    case "hours":
      return <HoursPreview tokens={tokens} hours={hours} />;
    case "social":
      return <SocialPreview tokens={tokens} links={config.socialLinks} />;
    case "social-posts":
      return <SocialGalleryPreview posts={socialPosts} tokens={tokens} />;
    case "footer":
      return (
        <div className="pointer-events-none">
          <RichFooter clinic={clinic} cfg={config} bookingHref={bookingHref} darkBg={tokens.footer} accentSuffix={tokens.label === "Classic" ? "" : tokens.label === "Warm" ? "-w" : tokens.label === "Modern" ? "-m" : "-red"} serif={tokens.serif} />
        </div>
      );
  }
}

function isSupported(section: LivePreviewSection, theme: ThemeKey) {
  if (theme !== "red-clinical" && ["trust", "specialties", "treatments", "faq", "social-posts"].includes(section)) return false;
  return true;
}

function sectionHasContent(section: LivePreviewSection, config: ClinicWebsiteConfig) {
  if (section === "gallery") return cleanList(config.gallery, (item) => Boolean(item.url)).length > 0;
  if (section === "testimonials") return cleanList(config.testimonials, (item) => Boolean(item.quote && item.patientName)).length > 0;
  if (section === "social-posts") return cleanList(config.socialPosts, (item) => Boolean(item.imageUrl)).length > 0;
  return true;
}

function getStatus(section: LivePreviewSection, config: ClinicWebsiteConfig, theme: ThemeKey) {
  if (!isSupported(section, theme)) return { label: "Not used by this style", className: "text-muted-foreground" };
  if (["gallery", "testimonials", "social-posts"].includes(section) && !sectionHasContent(section, config)) {
    return { label: "Hidden until content is added", className: "text-amber-600 dark:text-amber-400" };
  }
  if (section === "doctors") return { label: "Automatic", className: "text-sky-600 dark:text-sky-400" };
  if (section === "footer") return { label: "Automatic", className: "text-sky-600 dark:text-sky-400" };
  if (["stats", "services", "features"].includes(section)) return { label: "Uses public fallback when empty", className: "text-emerald-600 dark:text-emerald-400" };
  if (theme === "red-clinical" && ["trust", "specialties", "treatments", "faq"].includes(section)) {
    return { label: "Red Clinical presentation", className: "text-emerald-600 dark:text-emerald-400" };
  }
  return { label: "Updates as you edit", className: "text-emerald-600 dark:text-emerald-400" };
}

export default function LiveSectionPreview({
  section,
  config,
  clinic,
  bookingHref,
  sectionIndex,
  sectionCount,
}: {
  section: LivePreviewSection;
  config: ClinicWebsiteConfig;
  clinic: ThemeClinic;
  bookingHref: string;
  sectionIndex: number;
  sectionCount: number;
}) {
  const theme = config.theme;
  const tokens = THEME_TOKENS[theme];
  const status = getStatus(section, config, theme);
  const unsupported = !isSupported(section, theme);
  const hidden = !unsupported && ["gallery", "testimonials", "social-posts"].includes(section) && !sectionHasContent(section, config);
  const Icon = section === "theme" ? Palette : section === "hero" || section === "gallery" ? ImageIcon : section === "about" || section === "services" ? Layers3 : section === "features" || section === "specialties" ? Sparkles : section === "stats" ? BarChart3 : section === "trust" ? ShieldCheck : section === "treatments" ? ListChecks : section === "doctors" ? Users : section === "testimonials" ? Star : section === "faq" ? HelpCircle : section === "hours" ? Clock3 : section === "social" || section === "social-posts" ? Share2 : Palette;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="live-section-preview">
      <div className="shrink-0 border-b border-border/50 bg-background px-4 py-3" aria-labelledby="live-section-preview-heading">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="live-section-preview-heading" className="truncate text-sm font-bold text-foreground">Live section preview</h2>
              <p className="truncate text-[11px] text-muted-foreground">
                {SECTION_LABELS[section]} · Section {sectionIndex + 1} of {sectionCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">{tokens.label}</span>
            <span className={`font-semibold ${status.className}`}>{status.label}</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Updates as you edit · this is not published until you save.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/10" role="region" tabIndex={0} aria-label={`${SECTION_LABELS[section]} live preview`}>
        {unsupported ? (
          <EmptyState
            icon={Palette}
            title="This section is not used by the selected website style"
            detail="Choose another style to see how it is presented, or continue editing the content for styles that support it."
          />
        ) : hidden ? (
          <EmptyState
            icon={section === "gallery" ? ImageIcon : section === "testimonials" ? Star : Instagram}
            title="This section is currently hidden"
            detail={section === "gallery" ? "Upload photos below to show this section on your public page." : section === "testimonials" ? "Add at least one complete review below to show this section." : "Add social gallery images below to show this section in Red Clinical."}
          />
        ) : (
          <PreviewFrame>
            <LiveSectionContent section={section} tokens={tokens} config={config} clinic={clinic} bookingHref={bookingHref} />
          </PreviewFrame>
        )}
      </div>
    </div>
  );
}