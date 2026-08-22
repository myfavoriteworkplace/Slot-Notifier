import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Archive, ArchiveRestore, Building2, MapPin, Key, Eye, EyeOff, Check, LogIn, LogOut, Copy, ExternalLink, Trash2, UserPlus, Stethoscope, Sparkles, Image as ImageIcon, Link as LinkIcon, Megaphone, Mail, Phone, Globe, Hash, CalendarDays, CheckCircle2, Navigation, Upload, Star, Timer, Tag, Video, MousePointerClick, BarChart2, Pencil, X, ChevronDown, ChevronUp, Shield, AlertTriangle, Flag, FileText, ShieldCheck, XCircle, Info, CreditCard, Activity, MonitorSmartphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SpecializationInput } from "@/components/SpecializationInput";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notify";
import { compressImage } from "@/lib/imageCompression";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Clinic, SmileDeal } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
function SiFacebook({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>;
}
function SiInstagram({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;
}
function SiLinkedin({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
}
function SiWhatsapp({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ── Clinic verification helpers ───────────────────────────────────────────────

const FREE_EMAIL_PROVIDERS = ['gmail.', 'yahoo.', 'hotmail.', 'outlook.', 'rediffmail.'];
function isGenericEmailProvider(email: string) {
  return FREE_EMAIL_PROVIDERS.some(p => email.toLowerCase().includes(p));
}

function riskFromScore(score: number): { label: string; color: string; barPct: number; barColor: string } {
  if (score >= 75) return { label: 'Low', color: 'text-emerald-500', barPct: 15, barColor: 'bg-emerald-500' };
  if (score >= 50) return { label: 'Medium', color: 'text-amber-500', barPct: 50, barColor: 'bg-amber-500' };
  return { label: 'High', color: 'text-red-500', barPct: 83, barColor: 'bg-red-500' };
}

function trustBandColor(score: number): string {
  if (score >= 75) return 'text-emerald-500';
  if (score >= 50) return 'text-amber-500';
  if (score >= 25) return 'text-blue-500';
  return 'text-muted-foreground';
}

export default function Admin() {
  const { user, isLoading: authLoading, logout, login, isLoggingIn, loginError, verifyOtp, isVerifyingOtp, verifyOtpError } = useAuth();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginStep, setLoginStep] = useState<"credentials" | "otp">("credentials");
  const [loginOtp, setLoginOtp] = useState("");
  
  // Create clinic state
  const [newClinicName, setNewClinicName] = useState("");
  const [newClinicAddress, setNewClinicAddress] = useState("");
  const [newClinicCity, setNewClinicCity] = useState("");
  const [newClinicPincode, setNewClinicPincode] = useState("");
  const [newClinicEmail, setNewClinicEmail] = useState("");
  const [newClinicPhone, setNewClinicPhone] = useState("");
  const [newClinicWebsite, setNewClinicWebsite] = useState("");
  const [newClinicDoctors, setNewClinicDoctors] = useState<{ name: string; specialization: string; degree: string; email: string }[]>([]);
  const [newClinicUsername, setNewClinicUsername] = useState("");
  const [newClinicPassword, setNewClinicPassword] = useState("");

  // Edit clinic state
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [editClinicDialogOpen, setEditClinicDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editDoctors, setEditDoctors] = useState<{ name: string; specialization: string; degree: string; email?: string }[]>([]);
  const [editStorageLimitMb, setEditStorageLimitMb] = useState("");

  // Credentials dialog state
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // Smile Deals state
  const [dealCreatorTab, setDealCreatorTab] = useState<"deal" | "ad">("deal");
  const [dealListTab, setDealListTab] = useState<"deal" | "ad">("deal");
  const [dealTitle, setDealTitle] = useState("");
  const [dealDescription, setDealDescription] = useState("");
  const [dealImageUrl, setDealImageUrl] = useState("");
  const [dealImageManualUrl, setDealImageManualUrl] = useState("");
  const [dealBookingLink, setDealBookingLink] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const [dealVideoUrl, setDealVideoUrl] = useState("");
  const [dealOriginalPrice, setDealOriginalPrice] = useState("");
  const [dealSubcategory, setDealSubcategory] = useState("");
  const [dealIsFlash, setDealIsFlash] = useState(false);
  const [dealStartsAt, setDealStartsAt] = useState<Date | undefined>(undefined);
  const [dealExpiresAt, setDealExpiresAt] = useState<Date | undefined>(undefined);
  const [dealIsFeatured, setDealIsFeatured] = useState(false);
  const [dealCategory, setDealCategory] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isOptimising, setIsOptimising] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Login activity filters
  const [loginRoleFilter, setLoginRoleFilter] = useState<"all" | "owner" | "doctor" | "superuser">("all");
  const [loginResultFilter, setLoginResultFilter] = useState<"all" | "success" | "failed">("all");

  // New deal fields
  const [dealClinicId, setDealClinicId] = useState<number | null>(null);
  const [dealSponsorName, setDealSponsorName] = useState("");
  const [dealSponsorPhone, setDealSponsorPhone] = useState("");
  const [dealSponsorEmail, setDealSponsorEmail] = useState("");
  const [dealSponsorWebsite, setDealSponsorWebsite] = useState("");
  // Ad-specific social links
  const [dealAdFacebook, setDealAdFacebook] = useState("");
  const [dealAdInstagram, setDealAdInstagram] = useState("");
  const [dealAdLinkedin, setDealAdLinkedin] = useState("");
  const [dealAdWhatsapp, setDealAdWhatsapp] = useState("");

  // Edit deal sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<SmileDeal | null>(null);
  const [dealTargetAudience, setDealTargetAudience] = useState<"patient" | "clinic">("patient");

  // Deals → targeted at patients
  const DEAL_CATEGORIES = [
    "Treatment Offers",
    "Smile Packages",
    "Seasonal & Festival Offers",
    "Membership & Loyalty Plans",
    "New Clinic Launch",
    "Free Consultation",
    "Paediatric Dentistry",
    "Sponsored / Featured Slots",
  ];

  // Ads → targeted at clinics (B2B)
  const CLINIC_DEAL_CATEGORIES = [
    "Dental Materials & Consumables",
    "Equipment & Instruments",
    "Imaging & Diagnostics",
    "Lab & Prosthetics Services",
    "Dental Technology",
    "Practice Management Software",
    "PPE & Infection Control",
    "Continuing Education & Training",
    "Clinic Setup & Furniture",
    "Finance & Leasing",
    "Sponsored / Featured Slots",
  ];

  const DEAL_SUBCATEGORIES = ["Scaling & Cleaning", "Teeth Whitening", "Braces / Orthodontics", "Dental Implants", "Root Canal Treatment", "Extraction", "X-Ray / Imaging", "Consultation", "Gum Treatment", "Cosmetic Dentistry", "Smile Makeover", "Paediatric Care", "Other"];
  const CLINIC_DEAL_SUBCATEGORIES = ["Composites & Adhesives", "Impression Materials", "Cements & Liners", "Endodontic Supplies", "Handpieces & Drills", "Dental Chairs", "Sterilisers & Autoclaves", "Intraoral Cameras", "X-Ray & CBCT Units", "CAD/CAM Systems", "3D Printers", "Crowns & Bridges", "Clear Aligners", "Dentures", "PMS & Billing Software", "Scheduling Tools", "PPE & Gloves", "Disinfectants & Pouches", "CPD Courses", "Webinars & Certifications", "Clinic Cabinetry", "Reception Furniture", "Equipment EMI Plans", "Practice Loans", "Other"];
  const CATEGORIES_WITH_PRICE = ["Treatment Offers", "Smile Packages", "Seasonal & Festival Offers", "Membership & Loyalty Plans", "New Clinic Launch", "Free Consultation", "Paediatric Dentistry", "Dental Materials & Consumables", "Equipment & Instruments", "Lab & Prosthetics Services", "Finance & Leasing"];
  const LINK_CONFIG: Record<string, { label: string; placeholder: string }> = {
    "Sponsored / Featured Slots": { label: "Sponsor / Ad URL", placeholder: "https://sponsor-website.com" },
    "Finance & Leasing": { label: "Apply / Learn More Link", placeholder: "https://finance-provider.com" },
    "Continuing Education & Training": { label: "Course / Registration Link", placeholder: "https://course-provider.com" },
    "Practice Management Software": { label: "Product / Demo Link", placeholder: "https://software-product.com" },
  };
  const showPrice = !dealCategory || CATEGORIES_WITH_PRICE.includes(dealCategory);
  const linkConfig = dealCategory ? (LINK_CONFIG[dealCategory] || { label: "Booking Link", placeholder: "/book/clinic-name" }) : { label: "Link", placeholder: "Select a category first" };

  const { data: smileDeals = [], isLoading: dealsLoading } = useQuery<SmileDeal[]>({
    queryKey: ['/api/smile-deals'],
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/admin/smile-deals', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smile-deals'] });
      resetDealForm();
      notify.success("Smile Deal added");
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to add deal");
    }
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await apiRequest('PATCH', `/api/admin/smile-deals/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smile-deals'] });
      notify.success("Smile Deal updated");
    }
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/admin/smile-deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smile-deals'] });
      notify.success("Smile Deal deleted");
    }
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      notify.error("Invalid file type", { description: "Please upload a JPG, PNG or WebP image." });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let fileToUpload = file;
    if (file.size > 2 * 1024 * 1024) {
      setIsOptimising(true);
      try {
        fileToUpload = await compressImage(file, 2 * 1024 * 1024, 1500);
        if (fileToUpload.size > 2 * 1024 * 1024) {
          notify.error("File too large", { description: "Could not compress this image below 2 MB. Please use a smaller image." });
          if (fileInputRef.current) fileInputRef.current.value = "";
          setIsOptimising(false);
          return;
        }
      } catch {
        notify.error("File too large", { description: "Deal image must be under 2 MB. Please resize or compress the image." });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsOptimising(false);
        return;
      }
      setIsOptimising(false);
    }

    setIsUploading(true);

    try {
      // Get signed URL
      const signedRes = await apiRequest('POST', '/api/uploads/signed-url', {
        fileName: fileToUpload.name,
        contentType: fileToUpload.type,
        fileSize: fileToUpload.size,
        folder: 'smile-deals'
      });
      if (!signedRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await signedRes.json();

      // Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileToUpload,
      });
      if (!uploadRes.ok) throw new Error("R2 Upload failed");

      setDealImageUrl(publicUrl);
      notify.success("Image uploaded");
    } catch (err: any) {
      notify.apiError(err, "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const resetDealForm = () => {
    setDealTitle(""); setDealDescription(""); setDealImageUrl(""); setDealImageManualUrl("");
    setDealBookingLink(""); setDealPrice(""); setDealVideoUrl(""); setDealOriginalPrice("");
    setDealSubcategory(""); setDealIsFlash(false); setDealStartsAt(undefined);
    setDealExpiresAt(undefined); setDealIsFeatured(false); setDealCategory("");
    setDealClinicId(null); setDealSponsorName(""); setDealSponsorPhone("");
    setDealSponsorEmail(""); setDealSponsorWebsite("");
    setDealAdFacebook(""); setDealAdInstagram(""); setDealAdLinkedin(""); setDealAdWhatsapp("");
    setDealTargetAudience(dealCreatorTab === "ad" ? "clinic" : "patient");
  };

  const getDealPayload = () => ({
    title: dealTitle,
    description: dealDescription,
    imageUrl: dealImageUrl || "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800",
    bookingLink: dealBookingLink,
    price: dealPrice || null,
    originalPrice: dealOriginalPrice || null,
    videoUrl: dealVideoUrl || null,
    subcategory: dealSubcategory || null,
    isFlash: dealIsFlash,
    startsAt: dealStartsAt ? dealStartsAt.toISOString() : null,
    expiresAt: dealExpiresAt ? dealExpiresAt.toISOString() : null,
    isFeatured: dealIsFeatured,
    category: dealCategory || null,
    clinicId: dealClinicId || null,
    contactInfo: dealTargetAudience === "clinic"
      ? {
          sponsorName: dealSponsorName || undefined,
          phone: dealSponsorPhone || undefined,
          email: dealSponsorEmail || undefined,
          website: dealSponsorWebsite || undefined,
          facebookUrl: dealAdFacebook || undefined,
          instagramUrl: dealAdInstagram || undefined,
          linkedinUrl: dealAdLinkedin || undefined,
          whatsappNumber: dealAdWhatsapp || undefined,
        }
      : dealCategory === "Sponsored / Featured Slots" && (dealSponsorName || dealSponsorPhone || dealSponsorEmail || dealSponsorWebsite)
        ? { sponsorName: dealSponsorName || undefined, phone: dealSponsorPhone || undefined, email: dealSponsorEmail || undefined, website: dealSponsorWebsite || undefined }
        : null,
    targetAudience: dealTargetAudience,
  });

  const handleEditDeal = (deal: SmileDeal) => {
    setDealTitle(deal.title);
    setDealDescription(deal.description || "");
    setDealImageUrl(deal.imageUrl || "");
    setDealImageManualUrl(deal.imageUrl || "");
    setDealBookingLink(deal.bookingLink || "");
    setDealPrice(deal.price || "");
    setDealVideoUrl(deal.videoUrl || "");
    setDealOriginalPrice((deal as any).originalPrice || "");
    setDealSubcategory((deal as any).subcategory || "");
    setDealIsFlash((deal as any).isFlash || false);
    setDealStartsAt(deal.startsAt ? new Date(deal.startsAt as any) : undefined);
    setDealExpiresAt(deal.expiresAt ? new Date(deal.expiresAt as any) : undefined);
    setDealIsFeatured(deal.isFeatured || false);
    setDealCategory((deal as any).category || "");
    setDealClinicId((deal as any).clinicId || null);
    const audience = ((deal as any).targetAudience as string) === "clinic" ? "clinic" : "patient";
    setDealTargetAudience(audience);
    setDealCreatorTab(audience === "clinic" ? "ad" : "deal");
    const ci = (deal as any).contactInfo;
    if (ci) {
      setDealSponsorName(ci.sponsorName || "");
      setDealSponsorPhone(ci.phone || "");
      setDealSponsorEmail(ci.email || "");
      setDealSponsorWebsite(ci.website || "");
      setDealAdFacebook(ci.facebookUrl || "");
      setDealAdInstagram(ci.instagramUrl || "");
      setDealAdLinkedin(ci.linkedinUrl || "");
      setDealAdWhatsapp(ci.whatsappNumber || "");
    } else {
      setDealSponsorName(""); setDealSponsorPhone(""); setDealSponsorEmail(""); setDealSponsorWebsite("");
      setDealAdFacebook(""); setDealAdInstagram(""); setDealAdLinkedin(""); setDealAdWhatsapp("");
    }
    setEditingDeal(deal);
    setEditSheetOpen(true);
  };

  const { data: clinics = [], isLoading: clinicsLoading } = useQuery<Clinic[]>({
    queryKey: ['/api/clinics'],
  });

  const { data: loginEventsRaw = [], isLoading: loginEventsLoading, refetch: refetchLoginEvents } = useQuery<any[]>({
    queryKey: ['/api/auth/admin/login-events'],
    enabled: !!user,
    refetchInterval: false,
  });

  const createClinicMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/clinics', data);
      return res.json();
    },
    onSuccess: async (clinic) => {
      if (newClinicUsername && newClinicPassword) {
        await setCredentialsMutation.mutateAsync({ 
          clinicId: clinic.id, 
          username: newClinicUsername, 
          password: newClinicPassword 
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setNewClinicName("");
      setNewClinicAddress("");
      setNewClinicCity("");
      setNewClinicPincode("");
      setNewClinicEmail("");
      setNewClinicPhone("");
      setNewClinicWebsite("");
      setNewClinicDoctors([]);
      setNewClinicUsername("");
      setNewClinicPassword("");
      notify.success("Clinic added");
    },
    onError: (error: any) => {
      notify.apiError(error, "Failed to add clinic");
    },
  });

  const setCredentialsMutation = useMutation({
    mutationFn: async (data: { clinicId: number; username: string; password: string }) => {
      const res = await apiRequest('PATCH', `/api/clinics/${data.clinicId}/credentials`, {
        username: data.username,
        password: data.password,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update credentials");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setCredentialsDialogOpen(false);
      setSelectedClinic(null);
      setEditUsername("");
      setEditPassword("");
      notify.success("Credentials updated");
    },
  });

  const archiveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/clinics/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      notify.success("Clinic archived");
    }
  });

  const unarchiveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/clinics/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      notify.success("Clinic restored");
    }
  });

  const updateClinicMutation = useMutation({
    mutationFn: async (data: { 
      id: number;
      name: string; 
      address: string;
      city?: string;
      pincode?: string;
      email?: string;
      phone?: string;
      website?: string;
      doctors?: { name: string; specialization: string; degree: string; email?: string }[];
       storageLimitBytes?: number | null;
    }) => {
       const { id, ...updateData } = data;
      const res = await apiRequest('PATCH', `/api/clinics/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setEditClinicDialogOpen(false);
      setSelectedClinic(null);
      notify.success("Clinic updated");
    }
  });

  const [approvalPlans, setApprovalPlans] = useState<Record<number, string>>({});
  const [approvalCycles, setApprovalCycles] = useState<Record<number, string>>({});

  const approveClinicMutation = useMutation({
    mutationFn: async ({ id, plan, billingCycle }: { id: number; plan: string; billingCycle: string }) => {
      const res = await apiRequest('PATCH', `/api/clinics/${id}/approve`, { plan, billingCycle });
      if (!res.ok) throw new Error("Failed to approve clinic");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      notify.success("Clinic approved", { description: "Credentials and payment activation link have been sent to the clinic." });
    }
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PATCH', `/api/clinics/${id}/mark-paid`);
      if (!res.ok) throw new Error("Failed to mark as paid");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      notify.success("Marked as paid", { description: "Clinic subscription is now active." });
    }
  });

  const rejectClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PATCH', `/api/clinics/${id}/reject`);
      if (!res.ok) throw new Error("Failed to reject clinic");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      notify.success("Registration rejected", { description: "The clinic has been removed from the pending queue." });
    }
  });

  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<number>>(new Set());
  const toggleReview = (id: number) => {
    setExpandedReviewIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleFlagForReview = (clinicName: string) => {
    notify.info("Flagged for manual review", { description: `${clinicName} has been flagged — it will remain in the pending queue for further review.` });
  };

  const handleAdminLogout = () => {
    logout();
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      notify.warning("Please fill in all fields");
      return;
    }
    login(
      { email: loginEmail, password: loginPassword },
      {
        onSuccess: (data: any) => {
          if (data?.step === "otp_required") {
            setLoginStep("otp");
            setLoginOtp("");
            notify.info("OTP sent", { description: "Check your admin email for the 6-digit code." });
          }
        },
        onError: (err: any) => {
          notify.apiError(err, "Invalid credentials");
        },
      }
    );
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginOtp.length !== 6) {
      notify.warning("Enter the 6-digit code from your email");
      return;
    }
    verifyOtp(loginOtp, {
      onError: (err: any) => {
        notify.apiError(err, "Invalid OTP");
      },
    });
  };

  useEffect(() => {
    if (!authLoading && user && user.role !== 'superuser') {
      notify.critical("Access Denied");
      setLocation("/dashboard");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border/50 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!user || user.role !== 'superuser') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-primary/5 to-transparent px-4">
        <Card className="w-full max-w-md">

          {/* ── Step 1: Credentials ── */}
          {loginStep === "credentials" && (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl mb-1">System Admin Login</CardTitle>
                <CardDescription>Enter your credentials — a one-time code will be sent to your email</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" data-testid="label-email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoggingIn}
                      data-testid="input-admin-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" data-testid="label-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        disabled={isLoggingIn}
                        data-testid="input-admin-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        disabled={isLoggingIn}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  {loginError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                      {(loginError as any)?.message || "Login failed. Please try again."}
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoggingIn} data-testid="button-admin-login">
                    {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                    {isLoggingIn ? "Sending OTP…" : "Continue"}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="justify-center">
                <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-back-home">
                  Back to Home
                </Button>
              </CardFooter>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {loginStep === "otp" && (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl mb-1">Check your email</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to your admin email address. It expires in 10 minutes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="otp" data-testid="label-otp">One-time code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={loginOtp}
                      onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={isVerifyingOtp}
                      className="text-center text-2xl font-bold tracking-[0.4em] h-14"
                      data-testid="input-admin-otp"
                      autoFocus
                    />
                  </div>
                  {verifyOtpError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                      {(verifyOtpError as any)?.message || "Invalid code. Please try again."}
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={isVerifyingOtp || loginOtp.length !== 6} data-testid="button-admin-verify-otp">
                    {isVerifyingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isVerifyingOtp ? "Verifying…" : "Verify & Sign In"}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setLoginStep("credentials"); setLoginOtp(""); }}
                  data-testid="button-back-to-credentials"
                >
                  ← Use a different account
                </Button>
              </CardFooter>
            </>
          )}

        </Card>
      </div>
    );
  }

  if (clinicsLoading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-32 rounded-md" />)}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border/50 p-5 space-y-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-56" />
                <Skeleton className="h-3.5 w-40" />
              </div>
              <div className="flex gap-2 shrink-0">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activeClinics = clinics.filter(c => c.status === 'approved' && !c.isArchived);
  const pendingClinics = clinics.filter(c => c.status === 'pending');
  const archivedClinics = clinics.filter(c => c.isArchived);

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Admin Panel</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage clinics and application settings</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                Add Clinic
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Clinic</DialogTitle>
                <DialogDescription>Enter the clinic details and create an admin account.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={newClinicName} onChange={(e) => setNewClinicName(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">Address</Label>
                  <Input id="address" value={newClinicAddress} onChange={(e) => setNewClinicAddress(e.target.value)} className="col-span-3" placeholder="Street / Building" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="city" className="text-right">City</Label>
                  <Input id="city" value={newClinicCity} onChange={(e) => setNewClinicCity(e.target.value)} className="col-span-3" placeholder="e.g. Kochi" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="pincode" className="text-right">Pincode</Label>
                  <Input id="pincode" value={newClinicPincode} onChange={(e) => setNewClinicPincode(e.target.value)} className="col-span-3" placeholder="e.g. 682001" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" type="email" value={newClinicEmail} onChange={(e) => setNewClinicEmail(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Phone</Label>
                  <Input id="phone" value={newClinicPhone} onChange={(e) => setNewClinicPhone(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="website" className="text-right">Website</Label>
                  <Input id="website" value={newClinicWebsite} onChange={(e) => setNewClinicWebsite(e.target.value)} className="col-span-3" />
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Doctors ({newClinicDoctors.length})
                    </p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setNewClinicDoctors([...newClinicDoctors, { name: '', specialization: '', degree: '', email: '' }])}
                      data-testid="button-add-doctor"
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Add Doctor
                    </Button>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {newClinicDoctors.map((doctor, index) => (
                      <div key={index} className="p-3 border rounded-md space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Doctor {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setNewClinicDoctors(newClinicDoctors.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <Input
                          placeholder="e.g. Dr. Suresh Iyer"
                          value={doctor.name}
                          onChange={(e) => {
                            const updated = [...newClinicDoctors];
                            updated[index].name = e.target.value;
                            setNewClinicDoctors(updated);
                          }}
                          className="h-8"
                          data-testid={`input-doctor-name-${index}`}
                          required
                        />
                        <Input
                          placeholder="e.g. doctor@clinic.com"
                          type="email"
                          value={doctor.email || ""}
                          onChange={(e) => {
                            const updated = [...newClinicDoctors];
                            updated[index].email = e.target.value;
                            setNewClinicDoctors(updated);
                          }}
                          className="h-8"
                          data-testid={`input-doctor-email-${index}`}
                          required
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <SpecializationInput
                            placeholder="e.g. General Dentist"
                            value={doctor.specialization}
                            onChange={(val) => {
                              const updated = [...newClinicDoctors];
                              updated[index].specialization = val;
                              setNewClinicDoctors(updated);
                            }}
                            className="h-8"
                            data-testid={`input-doctor-specialization-${index}`}
                            required
                          />
                          <Input
                            placeholder="e.g. BDS, MDS"
                            value={doctor.degree}
                            onChange={(e) => {
                              const updated = [...newClinicDoctors];
                              updated[index].degree = e.target.value;
                              setNewClinicDoctors(updated);
                            }}
                            className="h-8"
                            data-testid={`input-doctor-degree-${index}`}
                          />
                        </div>
                      </div>
                    ))}
                    {newClinicDoctors.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No doctors added yet. Click "Add Doctor" to add one.</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-4">Admin Account Credentials</p>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="username" className="text-right">Username</Label>
                      <Input id="username" value={newClinicUsername} onChange={(e) => setNewClinicUsername(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="pass" className="text-right">Password</Label>
                      <div className="col-span-3 relative">
                        <Input id="pass" type={showPassword ? "text" : "password"} value={newClinicPassword} onChange={(e) => setNewClinicPassword(e.target.value)} />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createClinicMutation.mutate({ 
                  name: newClinicName, 
                  address: newClinicAddress,
                  city: newClinicCity,
                  pincode: newClinicPincode,
                  email: newClinicEmail,
                  phone: newClinicPhone,
                  website: newClinicWebsite,
                  doctors: newClinicDoctors.filter(d => d.name.trim() !== '')
                })} disabled={createClinicMutation.isPending || !newClinicName || !newClinicAddress}>
                  {createClinicMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Clinic
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleAdminLogout} className="h-9">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Active ({activeClinics.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Pending ({pendingClinics.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archived ({archivedClinics.length})
          </TabsTrigger>
          <TabsTrigger value="smile-deals" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Smile Deals
          </TabsTrigger>
          <TabsTrigger value="login-activity" className="flex items-center gap-2" data-testid="tab-login-activity">
            <Activity className="h-4 w-4" />
            Login Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Active Clinics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeClinics.map((clinic) => (
                  <div key={clinic.id} className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow duration-300">

                    {/* Header */}
                    <div className="relative px-5 py-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                      <div className="flex items-start justify-between gap-4 pl-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold tracking-tight">{clinic.name}</h3>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Active
                            </span>
                            {(clinic as any).subscriptionStatus === "active" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                                <CreditCard className="h-2.5 w-2.5" />
                                Subscribed
                              </span>
                            ) : (clinic as any).subscriptionStatus === "pending_payment" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                                <CreditCard className="h-2.5 w-2.5" />
                                Payment Pending
                              </span>
                            ) : null}
                            {(clinic as any).plan && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted border border-border/60 px-2 py-0.5 rounded-full capitalize">
                                {(clinic as any).plan}
                              </span>
                            )}
                          </div>

                          {/* Location row */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            {clinic.address && (
                              <span className="text-xs text-muted-foreground">{clinic.address}</span>
                            )}
                            {(clinic as any).city && (
                              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                                <Navigation className="h-2.5 w-2.5" />
                                {(clinic as any).city}
                              </span>
                            )}
                            {(clinic as any).pincode && (
                              <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground border border-border/60 px-2 py-0.5 rounded-full font-mono">
                                <Hash className="h-2.5 w-2.5" />
                                {(clinic as any).pincode}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/book/${clinic.id}`);
                              notify.success("Copied to clipboard");
                            }}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Book URL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/about?clinicId=${clinic.id}`);
                              notify.success("Copied to clipboard");
                            }}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            About URL
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                            setSelectedClinic(clinic);
                            setEditName(clinic.name);
                            setEditAddress(clinic.address || "");
                            setEditCity((clinic as any).city || "");
                            setEditPincode((clinic as any).pincode || "");
                            setEditEmail(clinic.email || "");
                            setEditPhone(clinic.phone || "");
                            setEditWebsite(clinic.website || "");
                            setEditDoctors(clinic.doctors || []);
                            setEditStorageLimitMb((clinic as any).storageLimitBytes ? (Number((clinic as any).storageLimitBytes) / (1024 * 1024)).toString().replace(/\.0$/, "") : "");
                            setEditClinicDialogOpen(true);
                          }}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                            setSelectedClinic(clinic);
                            setEditUsername("");
                            setEditPassword("");
                            setCredentialsDialogOpen(true);
                          }}>
                            <Key className="h-3.5 w-3.5 mr-1" />
                            Creds
                          </Button>
                          {(clinic as any).subscriptionStatus !== "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs border-blue-400/50 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                              onClick={() => markPaidMutation.mutate(clinic.id)}
                              disabled={markPaidMutation.isPending}
                              data-testid={`button-mark-paid-${clinic.id}`}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Mark Paid
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => archiveClinicMutation.mutate(clinic.id)}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">

                      {/* Contact info */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Contact Details</p>
                        <div className="space-y-2">
                          {clinic.email && (
                            <div className="flex items-center gap-3 group">
                              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 flex items-center justify-center shrink-0">
                                <Mail className="h-3.5 w-3.5 text-blue-500" />
                              </div>
                              <a href={`mailto:${clinic.email}`} className="text-xs text-foreground hover:text-primary transition-colors truncate">
                                {clinic.email}
                              </a>
                            </div>
                          )}
                          {clinic.phone && (
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center shrink-0">
                                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                              </div>
                              <span className="text-xs text-foreground font-mono">{clinic.phone}</span>
                            </div>
                          )}
                          {clinic.website && (
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 flex items-center justify-center shrink-0">
                                <Globe className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <a href={clinic.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
                                {clinic.website.replace(/^https?:\/\//, '')}
                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              </a>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 flex items-center justify-center shrink-0">
                              <CalendarDays className="h-3.5 w-3.5 text-amber-500" />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Added {clinic.createdAt ? new Date(clinic.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Doctors */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Stethoscope className="h-3 w-3" />
                          Doctors
                        </p>
                        <div className="space-y-2">
                          {clinic.doctors && clinic.doctors.length > 0 ? (
                            clinic.doctors.map((doc, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                  {doc.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium leading-tight truncate">Dr. {doc.name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{doc.specialization}{doc.degree ? ` · ${doc.degree}` : ''}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No doctors listed</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {activeClinics.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No active clinics found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sparkles className="h-5 w-5 mr-2" />
                Pending Registrations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingClinics.map((clinic) => (
                  <div key={clinic.id} className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow duration-300">

                    {/* Header */}
                    <div className="relative px-5 py-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-border/40">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l-xl" />
                      <div className="flex items-start justify-between gap-4 pl-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold tracking-tight">{clinic.name}</h3>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                              <Sparkles className="h-2.5 w-2.5" />
                              Pending Review
                            </span>
                          </div>

                          {/* Location row */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            {clinic.address && (
                              <span className="text-xs text-muted-foreground">{clinic.address}</span>
                            )}
                            {(clinic as any).city && (
                              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                                <Navigation className="h-2.5 w-2.5" />
                                {(clinic as any).city}
                              </span>
                            )}
                            {(clinic as any).pincode && (
                              <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground border border-border/60 px-2 py-0.5 rounded-full font-mono">
                                <Hash className="h-2.5 w-2.5" />
                                {(clinic as any).pincode}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          <select
                            value={approvalPlans[clinic.id] ?? (clinic.plan || "starter")}
                            onChange={e => setApprovalPlans(p => ({ ...p, [clinic.id]: e.target.value }))}
                            className="h-8 rounded-md border border-border/60 bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                            data-testid={`select-plan-${clinic.id}`}
                          >
                            <option value="starter">Starter</option>
                            <option value="growth">Growth</option>
                            <option value="pro">Pro</option>
                          </select>
                          <select
                            value={approvalCycles[clinic.id] ?? "monthly"}
                            onChange={e => setApprovalCycles(p => ({ ...p, [clinic.id]: e.target.value }))}
                            className="h-8 rounded-md border border-border/60 bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                            data-testid={`select-cycle-${clinic.id}`}
                          >
                            <option value="monthly">Monthly</option>
                            <option value="annual">Annual</option>
                          </select>
                          <Button
                            size="sm"
                            onClick={() => approveClinicMutation.mutate({
                              id: clinic.id,
                              plan: approvalPlans[clinic.id] ?? (clinic.plan || "starter"),
                              billingCycle: approvalCycles[clinic.id] ?? "monthly",
                            })}
                            disabled={approveClinicMutation.isPending}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/book/${clinic.id}`);
                              notify.success("Copied to clipboard");
                            }}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Book URL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/about?clinicId=${clinic.id}`);
                              notify.success("Copied to clipboard");
                            }}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            About URL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setSelectedClinic(clinic);
                              setEditName(clinic.name);
                              setEditAddress(clinic.address || "");
                              setEditCity((clinic as any).city || "");
                              setEditPincode((clinic as any).pincode || "");
                              setEditEmail(clinic.email || "");
                              setEditPhone(clinic.phone || "");
                              setEditWebsite(clinic.website || "");
                             setEditDoctors(clinic.doctors || []);
                             setEditStorageLimitMb((clinic as any).storageLimitBytes ? (Number((clinic as any).storageLimitBytes) / (1024 * 1024)).toString().replace(/\.0$/, "") : "");
                              setEditClinicDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => archiveClinicMutation.mutate(clinic.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">

                      {/* Contact Details */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Contact Details</p>
                        <div className="space-y-2">
                          {clinic.email && (
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 flex items-center justify-center shrink-0">
                                <Mail className="h-3.5 w-3.5 text-blue-500" />
                              </div>
                              <a href={`mailto:${clinic.email}`} className="text-xs text-foreground hover:text-primary transition-colors truncate">
                                {clinic.email}
                              </a>
                            </div>
                          )}
                          {clinic.phone && (
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center shrink-0">
                                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                              </div>
                              <span className="text-xs text-foreground font-mono">{clinic.phone}</span>
                            </div>
                          )}
                          {clinic.website && (
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 flex items-center justify-center shrink-0">
                                <Globe className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <a href={clinic.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
                                {clinic.website.replace(/^https?:\/\//, '')}
                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              </a>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 flex items-center justify-center shrink-0">
                              <CalendarDays className="h-3.5 w-3.5 text-amber-500" />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Registered {clinic.createdAt ? new Date(clinic.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Doctors */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Stethoscope className="h-3 w-3" />
                          Doctors
                        </p>
                        <div className="space-y-2">
                          {clinic.doctors && clinic.doctors.length > 0 ? (
                            clinic.doctors.map((doc, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                  {doc.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium leading-tight truncate">Dr. {doc.name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{doc.specialization}{doc.degree ? ` · ${doc.degree}` : ''}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No doctors listed</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── VERIFICATION REVIEW ACCORDION ─────────────────── */}
                    {(() => {
                      const score       = (clinic as any).trustScore || 0;
                      const email       = clinic.email || '';
                      const phone       = (clinic.phone || '').replace(/\D/g, '');
                      const medLicense  = (clinic as any).medicalLicenseUrl || '';
                      const regCert     = (clinic as any).clinicRegCertUrl || '';
                      const gstNum      = (clinic as any).gstNumber || '';
                      const gmb         = (clinic as any).googleBusinessUrl || '';
                      const freeEmail   = isGenericEmailProvider(email);
                      const isDuplicate = clinics.some(c =>
                        c.id !== clinic.id && (
                          (c.phone && c.phone.replace(/\D/g, '') === phone && phone.length >= 10) ||
                          (c.email && c.email.toLowerCase() === email.toLowerCase() && email.length > 0)
                        )
                      );
                      const autoChecks = [true, !freeEmail, !isDuplicate, !!gmb];
                      const passedCount = autoChecks.filter(Boolean).length;
                      const risk        = riskFromScore(score);
                      const isExpanded  = expandedReviewIds.has(clinic.id);

                      const alertParts: string[] = [];
                      if (isDuplicate)          alertParts.push('Duplicate phone or email found — verify before approving');
                      if (freeEmail)            alertParts.push('Free email domain detected');
                      if (!medLicense && !regCert) alertParts.push('No documents uploaded');
                      else if (!medLicense || !regCert) alertParts.push('Documents partially uploaded');
                      const alertMsg = alertParts.length > 0
                        ? alertParts.join('. ') + '. Admin review recommended before approval.'
                        : '';

                      const CheckRow = ({ icon: Icon, iconBg, label, detail, statusLabel, statusColor, statusBg }: {
                        icon: React.ElementType; iconBg: string; label: string; detail: string;
                        statusLabel: string; statusColor: string; statusBg: string;
                      }) => (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className={`h-6 w-6 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{detail}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusColor} ${statusBg}`}>
                            {statusLabel}
                          </span>
                        </div>
                      );

                      const DocRow = ({ label, detail, present, link }: {
                        label: string; detail: string; present: boolean; link?: string;
                      }) => (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${present ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                            {present
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{detail}</p>
                          </div>
                          {present && link ? (
                            <a href={link} target="_blank" rel="noreferrer"
                              className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                              View <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${present ? 'text-emerald-600 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                              {present ? 'Uploaded' : 'Missing'}
                            </span>
                          )}
                        </div>
                      );

                      return (
                        <>
                          {/* Toggle button */}
                          <button
                            type="button"
                            onClick={() => toggleReview(clinic.id)}
                            className="w-full flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors"
                            data-testid={`button-toggle-review-${clinic.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Shield className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-semibold text-foreground">Verification Review</span>
                              <span className="text-[11px] text-muted-foreground">
                                · Trust <span className={trustBandColor(score)}>{score}/100</span> · {passedCount}/4 checks · Risk: <span className={risk.color}>{risk.label}</span>
                              </span>
                            </div>
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                          </button>

                          {/* Expanded panel */}
                          {isExpanded && (
                            <div className="border-t border-border/40 p-5 space-y-4 bg-muted/10 animate-in fade-in slide-in-from-top-1 duration-200">

                              {/* Alert banner */}
                              {alertMsg && (
                                <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-amber-400/40 bg-amber-500/8">
                                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{alertMsg}</p>
                                </div>
                              )}

                              {/* Stat tiles */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
                                  <p className={`text-2xl font-extrabold tabular-nums ${trustBandColor(score)}`}>{score}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">Trust score</p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
                                  <p className="text-2xl font-extrabold tabular-nums text-foreground">{passedCount}/4</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">Checks passed</p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
                                  <p className={`text-2xl font-extrabold ${risk.color}`}>{risk.label}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">Risk level</p>
                                </div>
                              </div>

                              {/* Risk bar */}
                              <div className="space-y-1.5 px-0.5">
                                <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400 overflow-hidden">
                                  <div className="absolute inset-0 rounded-full bg-muted/80" style={{ left: `${risk.barPct}%` }} />
                                </div>
                                <div className="flex justify-between text-[9px] text-muted-foreground font-medium">
                                  <span>Low risk</span><span>Medium</span><span>High risk</span>
                                </div>
                              </div>

                              {/* Automated checks */}
                              <div className="rounded-xl border border-border/60 overflow-hidden">
                                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Automated Checks</p>
                                </div>
                                <div className="divide-y divide-border/30">
                                  <CheckRow
                                    icon={ShieldCheck} iconBg="bg-emerald-500/15"
                                    label="Email OTP"
                                    detail={`${email} · verified at registration`}
                                    statusLabel="Verified" statusColor="text-emerald-600" statusBg="bg-emerald-500/10"
                                  />
                                  <CheckRow
                                    icon={freeEmail ? AlertTriangle : ShieldCheck}
                                    iconBg={freeEmail ? "bg-amber-400/15" : "bg-emerald-500/15"}
                                    label="Email domain"
                                    detail={freeEmail ? `${email} · free provider` : `${email} · professional domain`}
                                    statusLabel={freeEmail ? "Needs attention" : "Verified"}
                                    statusColor={freeEmail ? "text-amber-600" : "text-emerald-600"}
                                    statusBg={freeEmail ? "bg-amber-400/10" : "bg-emerald-500/10"}
                                  />
                                  <CheckRow
                                    icon={isDuplicate ? AlertTriangle : ShieldCheck}
                                    iconBg={isDuplicate ? "bg-amber-400/15" : "bg-emerald-500/15"}
                                    label="Duplicate check"
                                    detail={isDuplicate ? "Another clinic with same phone or email exists" : "No existing clinic with same phone or email"}
                                    statusLabel={isDuplicate ? "Duplicate found" : "Clear"}
                                    statusColor={isDuplicate ? "text-amber-600" : "text-emerald-600"}
                                    statusBg={isDuplicate ? "bg-amber-400/10" : "bg-emerald-500/10"}
                                  />
                                  <CheckRow
                                    icon={gmb ? ShieldCheck : Info}
                                    iconBg={gmb ? "bg-emerald-500/15" : "bg-muted/40"}
                                    label="Google Business Profile"
                                    detail={gmb ? "Profile URL provided" : "No GMB profile linked"}
                                    statusLabel={gmb ? "Linked" : "Not provided"}
                                    statusColor={gmb ? "text-emerald-600" : "text-muted-foreground"}
                                    statusBg={gmb ? "bg-emerald-500/10" : "bg-muted/40"}
                                  />
                                  <CheckRow
                                    icon={Info} iconBg="bg-blue-400/15"
                                    label="Location validation"
                                    detail="Manual check required — verify address independently"
                                    statusLabel="Manual" statusColor="text-blue-500" statusBg="bg-blue-400/10"
                                  />
                                  <CheckRow
                                    icon={Info} iconBg="bg-blue-400/15"
                                    label="Medical council check"
                                    detail="Auto-check unavailable — review license document below"
                                    statusLabel="Manual" statusColor="text-blue-500" statusBg="bg-blue-400/10"
                                  />
                                </div>
                              </div>

                              {/* Document review */}
                              <div className="rounded-xl border border-border/60 overflow-hidden">
                                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Document Review</p>
                                </div>
                                <div className="divide-y divide-border/30">
                                  <DocRow
                                    label="Doctor's medical license"
                                    detail={medLicense ? "Uploaded at registration" : "Not uploaded — request before approval"}
                                    present={!!medLicense}
                                    link={medLicense || undefined}
                                  />
                                  <DocRow
                                    label="Clinic registration certificate"
                                    detail={regCert ? "Uploaded at registration" : "Not uploaded — request before approval"}
                                    present={!!regCert}
                                    link={regCert || undefined}
                                  />
                                  <DocRow
                                    label="GST registration"
                                    detail={gstNum ? `GSTIN: ${gstNum}` : "Not provided — optional unless issuing tax invoices"}
                                    present={!!gstNum}
                                  />
                                </div>
                              </div>

                              {/* Admin decision */}
                              <div className="rounded-xl border border-border/60 overflow-hidden">
                                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admin Decision</p>
                                </div>
                                <div className="p-4 space-y-3">
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <label className="label-field block mb-1">Plan</label>
                                      <select
                                        value={approvalPlans[clinic.id] ?? (clinic.plan || "starter")}
                                        onChange={e => setApprovalPlans(p => ({ ...p, [clinic.id]: e.target.value }))}
                                        className="w-full h-8 rounded-md border border-border/60 bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                        data-testid={`select-plan-expanded-${clinic.id}`}
                                      >
                                        <option value="starter">Starter — ₹999/mo</option>
                                        <option value="growth">Growth — ₹1,599/mo</option>
                                        <option value="pro">Pro — ₹2,999/mo</option>
                                      </select>
                                    </div>
                                    <div className="flex-1">
                                      <label className="label-field block mb-1">Billing</label>
                                      <select
                                        value={approvalCycles[clinic.id] ?? "monthly"}
                                        onChange={e => setApprovalCycles(p => ({ ...p, [clinic.id]: e.target.value }))}
                                        className="w-full h-8 rounded-md border border-border/60 bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                        data-testid={`select-cycle-expanded-${clinic.id}`}
                                      >
                                        <option value="monthly">Monthly</option>
                                        <option value="annual">Annual (2 months free)</option>
                                      </select>
                                    </div>
                                  </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => approveClinicMutation.mutate({
                                      id: clinic.id,
                                      plan: approvalPlans[clinic.id] ?? (clinic.plan || "starter"),
                                      billingCycle: approvalCycles[clinic.id] ?? "monthly",
                                    })}
                                    disabled={approveClinicMutation.isPending}
                                    className="h-9 gap-1.5 text-xs"
                                    data-testid={`button-approve-clinic-${clinic.id}`}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Approve clinic
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleFlagForReview(clinic.name)}
                                    className="h-9 gap-1.5 text-xs border-amber-400/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                                    data-testid={`button-flag-clinic-${clinic.id}`}
                                  >
                                    <Flag className="h-3.5 w-3.5" />
                                    Flag for review
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => rejectClinicMutation.mutate(clinic.id)}
                                    disabled={rejectClinicMutation.isPending}
                                    className="h-9 gap-1.5 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                                    data-testid={`button-reject-clinic-${clinic.id}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Reject
                                  </Button>
                                </div>
                                </div>
                              </div>

                            </div>
                          )}
                        </>
                      );
                    })()}

                  </div>
                ))}
                {pendingClinics.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No pending registrations.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-muted-foreground">
                <Archive className="h-5 w-5 mr-2" />
                Archived Clinics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {archivedClinics.map((clinic) => (
                  <div key={clinic.id} className="flex items-center justify-between p-4 border rounded-lg opacity-60">
                    <div>
                      <h3 className="font-medium">{clinic.name}</h3>
                      <p className="text-sm text-muted-foreground">{clinic.address}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => unarchiveClinicMutation.mutate(clinic.id)}>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </div>
                ))}
                {archivedClinics.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No archived clinics.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smile-deals">
          <div className="space-y-6">

            {/* Deal Creator Panel */}
            <Card className="overflow-hidden shadow-md border-0">
              <div className="bg-gradient-to-r from-primary to-accent px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-lg leading-tight">Deals & Ads</h2>
                    <p className="text-white/70 text-sm">Create patient-facing deals or clinic-facing ads</p>
                  </div>
                </div>
                {/* Type selector tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setDealCreatorTab("deal"); setDealTargetAudience("patient"); setDealCategory(""); setDealSubcategory(""); }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${dealCreatorTab === "deal" ? "bg-white text-primary border-white shadow-sm" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`}
                  >
                    🧑 Deal <span className="font-normal opacity-75 text-xs">for Patients</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDealCreatorTab("ad"); setDealTargetAudience("clinic"); setDealCategory(""); setDealSubcategory(""); }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${dealCreatorTab === "ad" ? "bg-white text-primary border-white shadow-sm" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`}
                  >
                    🏥 Ad <span className="font-normal opacity-75 text-xs">for Clinics</span>
                  </button>
                </div>
                <p className="text-white/60 text-xs mt-2">
                  {dealCreatorTab === "deal" ? "Deals are shown on the public Smile Deals page — visible to patients browsing for offers." : "Ads are shown in the clinic-facing section — visible to dental professionals and practice owners."}
                </p>
              </div>
              <CardContent className="p-6">
                <div className="grid gap-6 lg:grid-cols-2">

                  {/* Left: Image Upload Zone */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Deal Image <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    {dealImageUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border-2 border-primary/30 aspect-video bg-muted">
                        <img src={dealImageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isOptimising}>
                            {isOptimising ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-amber-400" /> : isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            {isOptimising ? "Optimising…" : isUploading ? "Uploading…" : "Change"}
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => { setDealImageUrl(""); setDealImageManualUrl(""); }}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isOptimising}
                        className="w-full aspect-video border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer"
                      >
                        {isOptimising ? (
                          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                        ) : isUploading ? (
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        ) : (
                          <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-sm font-medium text-primary">
                            {isOptimising ? "Optimising…" : isUploading ? "Uploading…" : "Click to upload image"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP · max 2 MB</p>
                        </div>
                      </button>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Or paste an image URL</Label>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={dealImageManualUrl}
                        onChange={(e) => {
                          setDealImageManualUrl(e.target.value);
                          setDealImageUrl(e.target.value);
                        }}
                      />
                    </div>
                  </div>

                  {/* Right: Form Fields */}
                  <div className="space-y-4">

                    {/* Category — driven by type tab */}
                    <div className="space-y-2">
                      <Label htmlFor="deal-category" className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        Category
                      </Label>
                      <select
                        id="deal-category"
                        value={dealCategory}
                        onChange={(e) => setDealCategory(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                      >
                        <option value="">Select category</option>
                        {(dealTargetAudience === "clinic" ? CLINIC_DEAL_CATEGORIES : DEAL_CATEGORIES).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Subcategory — driven by audience */}
                    <div className="space-y-2">
                      <Label htmlFor="deal-subcategory" className="flex items-center gap-1.5">
                        {dealTargetAudience === "clinic" ? "Product / Service Type" : "Procedure / Type"}{" "}
                        <span className="text-muted-foreground font-normal text-xs">(filter pill on public page)</span>
                      </Label>
                      <select
                        id="deal-subcategory"
                        value={dealSubcategory}
                        onChange={(e) => setDealSubcategory(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                      >
                        <option value="">{dealTargetAudience === "clinic" ? "Select product / service type" : "Select procedure type"}</option>
                        {(dealTargetAudience === "clinic" ? CLINIC_DEAL_SUBCATEGORIES : DEAL_SUBCATEGORIES).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Clinic selector — for patient-facing deals */}
                    {dealCreatorTab === "deal" && (
                      <div className="space-y-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                        <Label htmlFor="deal-clinic" className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <Building2 className="h-3.5 w-3.5" /> Link to Clinic <span className="text-muted-foreground font-normal">(optional — auto-fills booking link)</span>
                        </Label>
                        <select
                          id="deal-clinic"
                          value={dealClinicId ?? ""}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            setDealClinicId(id || null);
                            if (id) {
                              const clinic = clinics.find(c => c.id === id);
                              if (clinic) {
                                setDealBookingLink(`/book/${id}`);
                                if (!dealTitle) setDealTitle(clinic.name + " — Special Deal");
                              }
                            }
                          }}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                        >
                          <option value="">Select a clinic</option>
                          {clinics.filter(c => !(c as any).isArchived && (c as any).status !== 'rejected').map(c => (
                            <option key={c.id} value={c.id}>{c.name}{(c as any).city ? ` — ${(c as any).city}` : ""}</option>
                          ))}
                        </select>
                        {dealClinicId && (
                          <p className="text-[11px] text-muted-foreground">Booking link auto-set to <span className="text-primary font-mono">/book/{dealClinicId}</span></p>
                        )}
                      </div>
                    )}

                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="deal-title">Title</Label>
                      <Input id="deal-title" value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="20% Off Dental Checkup" />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="deal-desc">Description</Label>
                      <Textarea id="deal-desc" value={dealDescription} onChange={(e) => setDealDescription(e.target.value)} placeholder="Enter details..." className="resize-none h-[72px]" />
                    </div>

                    {/* Contact & Social Links — always shown for Ads */}
                    {dealCreatorTab === "ad" && (
                      <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5" /> Contact & Social Links
                          <span className="font-normal text-muted-foreground">(shown on ad card)</span>
                        </p>
                        <Input placeholder="Company / Brand name" value={dealSponsorName} onChange={(e) => setDealSponsorName(e.target.value)} className="h-8 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Phone" value={dealSponsorPhone} onChange={(e) => setDealSponsorPhone(e.target.value)} className="pl-8 h-8 text-sm" />
                          </div>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Email" value={dealSponsorEmail} onChange={(e) => setDealSponsorEmail(e.target.value)} className="pl-8 h-8 text-sm" />
                          </div>
                        </div>
                        <div className="relative">
                          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input placeholder="Website URL (https://...)" value={dealSponsorWebsite} onChange={(e) => setDealSponsorWebsite(e.target.value)} className="pl-8 h-8 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <SiFacebook className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#1877F2]" />
                            <Input placeholder="Facebook page URL" value={dealAdFacebook} onChange={(e) => setDealAdFacebook(e.target.value)} className="pl-8 h-8 text-sm" />
                          </div>
                          <div className="relative">
                            <SiInstagram className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#E1306C]" />
                            <Input placeholder="Instagram profile URL" value={dealAdInstagram} onChange={(e) => setDealAdInstagram(e.target.value)} className="pl-8 h-8 text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <SiLinkedin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#0A66C2]" />
                            <Input placeholder="LinkedIn company URL" value={dealAdLinkedin} onChange={(e) => setDealAdLinkedin(e.target.value)} className="pl-8 h-8 text-sm" />
                          </div>
                          <div className="relative">
                            <SiWhatsapp className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#25D366]" />
                            <Input placeholder="WhatsApp number (with +91)" value={dealAdWhatsapp} onChange={(e) => setDealAdWhatsapp(e.target.value)} className="pl-8 h-8 text-sm" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sponsor contact info — only for Deals with Sponsored / Featured Slots */}
                    {dealCreatorTab === "deal" && dealCategory === "Sponsored / Featured Slots" && (
                      <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <Megaphone className="h-3.5 w-3.5" /> Sponsor Contact Info <span className="font-normal text-muted-foreground">(shown on deal card)</span>
                        </p>
                        <Input placeholder="Sponsor / Brand name" value={dealSponsorName} onChange={(e) => setDealSponsorName(e.target.value)} className="h-8 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Phone" value={dealSponsorPhone} onChange={(e) => setDealSponsorPhone(e.target.value)} className="pl-8 h-8 text-sm" />
                          </div>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Email" value={dealSponsorEmail} onChange={(e) => setDealSponsorEmail(e.target.value)} className="pl-8 h-8 text-sm" />
                          </div>
                        </div>
                        <div className="relative">
                          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input placeholder="Website URL" value={dealSponsorWebsite} onChange={(e) => setDealSponsorWebsite(e.target.value)} className="pl-8 h-8 text-sm" />
                        </div>
                      </div>
                    )}

                    {/* Price + Original Price + Link */}
                    {showPrice && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="deal-price">Deal Price (₹)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
                            <Input id="deal-price" value={dealPrice} onChange={(e) => setDealPrice(e.target.value)} placeholder="499" className="pl-7" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="deal-original-price" className="flex items-center gap-1">
                            Original Price (₹) <span className="text-[10px] text-muted-foreground">(strike-through)</span>
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
                            <Input id="deal-original-price" value={dealOriginalPrice} onChange={(e) => setDealOriginalPrice(e.target.value)} placeholder="999" className="pl-7" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="deal-link">{linkConfig.label}</Label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="deal-link" value={dealBookingLink} onChange={(e) => setDealBookingLink(e.target.value)} placeholder={linkConfig.placeholder} className="pl-9" />
                      </div>
                    </div>

                    {/* Video URL */}
                    <div className="space-y-2">
                      <Label htmlFor="deal-video" className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                        Promo Video URL <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <div className="relative">
                        <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="deal-video" value={dealVideoUrl} onChange={(e) => setDealVideoUrl(e.target.value)} placeholder="YouTube, Vimeo, or .mp4 URL" className="pl-9" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">Plays on hover in cards and as hero background when featured</p>
                    </div>

                    {/* Start Date + Expiry Date */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          Start Date <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={`w-full justify-start text-left font-normal text-sm h-9 ${!dealStartsAt && "text-muted-foreground"}`}>
                              <CalendarDays className="mr-2 h-3.5 w-3.5" />
                              {dealStartsAt ? format(dealStartsAt, "d MMM yyyy") : "Start date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                            <Calendar mode="single" selected={dealStartsAt} onSelect={setDealStartsAt} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs">
                          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                          Expiry Date <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={`w-full justify-start text-left font-normal text-sm h-9 ${!dealExpiresAt && "text-muted-foreground"}`}>
                              <CalendarDays className="mr-2 h-3.5 w-3.5" />
                              {dealExpiresAt ? format(dealExpiresAt, "d MMM yyyy") : "Expiry date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                            <Calendar mode="single" selected={dealExpiresAt} onSelect={setDealExpiresAt} disabled={(date) => date < new Date()} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Featured + Flash toggles */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-xs font-medium">Featured</p>
                            <p className="text-[10px] text-muted-foreground">Hero card</p>
                          </div>
                        </div>
                        <Switch checked={dealIsFeatured} onCheckedChange={setDealIsFeatured} />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">⚡</span>
                          <div>
                            <p className="text-xs font-medium">Flash Deal</p>
                            <p className="text-[10px] text-muted-foreground">Scroll strip</p>
                          </div>
                        </div>
                        <Switch checked={dealIsFlash} onCheckedChange={setDealIsFlash} />
                      </div>
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium shadow-md shadow-primary/20"
                      onClick={() => createDealMutation.mutate(getDealPayload())}
                      disabled={createDealMutation.isPending || !dealTitle}
                    >
                      {createDealMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      {dealCreatorTab === "ad" ? "Publish Ad" : "Publish Deal"}
                    </Button>
                  </div>
                </div>

                {/* Live Preview — always visible */}
                <div className="mt-6 pt-6 border-t border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
                    <Eye className="h-3 w-3" /> Live Preview
                  </p>
                  {!dealTitle ? (
                    <div className="max-w-sm rounded-2xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center py-10 gap-2">
                      <Eye className="h-6 w-6 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">Start filling the form to see a preview</p>
                    </div>
                  ) : dealCreatorTab === "ad" ? (
                    /* Ad Preview — B2B card */
                    <div className="max-w-sm rounded-2xl overflow-hidden border bg-card shadow-md">
                      <div className="relative aspect-video overflow-hidden bg-muted">
                        <img
                          src={dealImageUrl || "https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&q=80&w=800"}
                          alt={dealTitle}
                          className="w-full h-full object-cover"
                        />
                        {dealIsFeatured && (
                          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Star className="h-2.5 w-2.5 fill-white" /> Featured
                          </span>
                        )}
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          🏥 Ad
                        </span>
                        {dealCategory && (
                          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">{dealCategory}</span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        {dealSponsorName && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{dealSponsorName}</p>}
                        <h3 className="font-bold text-sm leading-snug">{dealTitle}</h3>
                        {dealDescription && <p className="text-xs text-muted-foreground line-clamp-2">{dealDescription}</p>}
                        {dealPrice && showPrice && (
                          <p className="text-sm font-bold text-primary">
                            ₹{dealPrice}
                            {dealOriginalPrice && <span className="ml-2 text-xs font-normal text-muted-foreground line-through">₹{dealOriginalPrice}</span>}
                          </p>
                        )}
                        {/* Social links preview */}
                        {(dealSponsorWebsite || dealAdFacebook || dealAdInstagram || dealAdLinkedin || dealAdWhatsapp || dealSponsorPhone || dealSponsorEmail) && (
                          <div className="pt-2 border-t border-border/50 flex items-center gap-2 flex-wrap">
                            {dealSponsorWebsite && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-primary/10 transition-colors"><Globe className="h-3.5 w-3.5 text-muted-foreground" /></span>}
                            {dealSponsorPhone && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-primary/10 transition-colors"><Phone className="h-3.5 w-3.5 text-muted-foreground" /></span>}
                            {dealSponsorEmail && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-primary/10 transition-colors"><Mail className="h-3.5 w-3.5 text-muted-foreground" /></span>}
                            {dealAdFacebook && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1877F2]/10 hover:bg-[#1877F2]/20 transition-colors"><SiFacebook className="h-3.5 w-3.5 text-[#1877F2]" /></span>}
                            {dealAdInstagram && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#E1306C]/10 hover:bg-[#E1306C]/20 transition-colors"><SiInstagram className="h-3.5 w-3.5 text-[#E1306C]" /></span>}
                            {dealAdLinkedin && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 transition-colors"><SiLinkedin className="h-3.5 w-3.5 text-[#0A66C2]" /></span>}
                            {dealAdWhatsapp && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors"><SiWhatsapp className="h-3.5 w-3.5 text-[#25D366]" /></span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Deal Preview — patient card */
                    <div className="max-w-sm rounded-2xl overflow-hidden border bg-card shadow-md">
                      <div className="relative aspect-video overflow-hidden bg-muted">
                        <img
                          src={dealImageUrl || "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800"}
                          alt={dealTitle}
                          className="w-full h-full object-cover"
                        />
                        {dealIsFeatured && (
                          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Star className="h-2.5 w-2.5 fill-white" /> Featured
                          </span>
                        )}
                        {dealCategory && (
                          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">{dealCategory}</span>
                        )}
                        {dealPrice && showPrice && (
                          <span className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-lg">₹{dealPrice}</span>
                        )}
                      </div>
                      <div className="p-4 space-y-1.5">
                        <h3 className="font-bold text-sm leading-snug">{dealTitle}</h3>
                        {dealDescription && <p className="text-xs text-muted-foreground line-clamp-2">{dealDescription}</p>}
                        {dealOriginalPrice && showPrice && (
                          <p className="text-[11px] text-muted-foreground line-through">₹{dealOriginalPrice}</p>
                        )}
                        {(dealStartsAt || dealExpiresAt) && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-0.5">
                            <CalendarDays className="h-3 w-3" />
                            {dealStartsAt && <span>From {format(dealStartsAt, "d MMM")}</span>}
                            {dealStartsAt && dealExpiresAt && <span>–</span>}
                            {dealExpiresAt && <span>Until {format(dealExpiresAt, "d MMM")}</span>}
                          </div>
                        )}
                        {dealBookingLink && (
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                              <ExternalLink className="h-3 w-3" /> Book Now
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Running Deals & Ads */}
            <Card className="shadow-md border-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-5 w-5 text-primary" />
                    {dealListTab === "deal" ? "Running Deals" : "Running Ads"}
                  </CardTitle>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {smileDeals.filter(d => d.isActive && (dealListTab === "ad" ? d.targetAudience === "clinic" : d.targetAudience !== "clinic")).length} Active
                  </span>
                </div>
                {/* List tab switcher */}
                <div className="flex gap-1 mt-2 p-1 bg-muted rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setDealListTab("deal")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${dealListTab === "deal" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    🧑 Deals ({smileDeals.filter(d => d.targetAudience !== "clinic").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealListTab("ad")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${dealListTab === "ad" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    🏥 Ads ({smileDeals.filter(d => d.targetAudience === "clinic").length})
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {smileDeals.filter(d => dealListTab === "ad" ? d.targetAudience === "clinic" : d.targetAudience !== "clinic").map((deal) => (
                  <div
                    key={deal.id}
                    className={`flex gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
                      deal.isActive
                        ? "border-l-4 border-l-green-500 border-t border-r border-b"
                        : "border-l-4 border-l-muted-foreground/30 border-t border-r border-b opacity-60"
                    }`}
                  >
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0 shadow-sm"
                      onError={(e) => (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800"}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-sm">{deal.title}</h4>
                        {deal.isFeatured && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                            <Star className="h-2.5 w-2.5 fill-primary" /> Featured
                          </span>
                        )}
                        {deal.category && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full border">
                            <Tag className="h-2.5 w-2.5" /> {deal.category}
                          </span>
                        )}
                        {deal.price && (
                          <span className="inline-flex items-center text-xs font-bold bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800 px-2 py-0.5 rounded-full">
                            ₹{deal.price}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{deal.description}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        {deal.bookingLink && (
                          <a href={deal.bookingLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <LinkIcon className="h-3 w-3" />
                            {deal.bookingLink}
                          </a>
                        )}
                        {deal.expiresAt && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            <Timer className="h-3 w-3" />
                            Expires {new Date(deal.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                        {deal.videoUrl && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Video className="h-3 w-3" /> Video
                          </span>
                        )}
                      </div>
                      {/* Analytics row */}
                      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Eye className="h-3 w-3" /> {deal.viewCount ?? 0} views
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MousePointerClick className="h-3 w-3" /> {deal.clickCount ?? 0} clicks
                        </span>
                        {(deal.viewCount ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-medium">
                            <BarChart2 className="h-3 w-3" />
                            {Math.round(((deal.clickCount ?? 0) / (deal.viewCount ?? 1)) * 100)}% CTR
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${deal.isActive ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        <span className="text-xs text-muted-foreground">{deal.isActive ? "Active" : "Stopped"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={deal.isActive}
                          onCheckedChange={(checked) => updateDealMutation.mutate({ id: deal.id, updates: { isActive: checked } })}
                        />
                      </div>
                      <div className="flex items-center gap-1.5" title="Toggle featured spotlight">
                        <Star className={`h-3 w-3 ${deal.isFeatured ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                        <Switch
                          checked={deal.isFeatured}
                          onCheckedChange={(checked) => updateDealMutation.mutate({ id: deal.id, updates: { isFeatured: checked } })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary text-muted-foreground"
                        onClick={() => handleEditDeal(deal)}
                        title="Edit deal"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                        onClick={() => deleteDealMutation.mutate(deal.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {smileDeals.filter(d => dealListTab === "ad" ? d.targetAudience === "clinic" : d.targetAudience !== "clinic").length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="p-4 bg-muted/50 rounded-full">
                      <Megaphone className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium text-muted-foreground">
                      {dealListTab === "ad" ? "No ads published yet" : "No deals published yet"}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {dealListTab === "ad" ? "Switch to the Ad tab above and publish your first clinic-facing ad" : "Switch to the Deal tab above and publish your first patient-facing deal"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ── Login Activity Tab ───────────────────────────────────────────────── */}
        <TabsContent value="login-activity">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    Login Activity
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    Every sign-in attempt across all roles — successful and failed.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchLoginEvents()} data-testid="button-refresh-login-events">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Refresh
                </Button>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 pt-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mr-1">Role:</div>
                {(["all", "owner", "doctor", "superuser"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setLoginRoleFilter(r)}
                    data-testid={`filter-role-${r}`}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      loginRoleFilter === r
                        ? "bg-primary text-white border-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {r === "all" ? "All roles" : r === "owner" ? "Clinic" : r === "doctor" ? "Doctor" : "Superuser"}
                  </button>
                ))}
                <div className="w-px h-5 bg-border self-center mx-1" />
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mr-1">Result:</div>
                {(["all", "success", "failed"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setLoginResultFilter(r)}
                    data-testid={`filter-result-${r}`}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      loginResultFilter === r
                        ? r === "failed" ? "bg-red-500 text-white border-red-500" : "bg-primary text-white border-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {r === "all" ? "All" : r === "success" ? "✓ Success" : "✗ Failed"}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loginEventsLoading ? (
                <div className="divide-y divide-border/40">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <Skeleton className="h-3.5 w-36" />
                        <Skeleton className="h-3 w-52" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                      <Skeleton className="h-5 w-14 rounded-full shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (() => {
                const filtered = loginEventsRaw.filter(e => {
                  if (loginRoleFilter !== "all" && e.role !== loginRoleFilter) return false;
                  if (loginResultFilter === "success" && !e.success) return false;
                  if (loginResultFilter === "failed" && e.success) return false;
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No events match this filter</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Try changing the role or result filters above</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Result</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Role</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Identifier</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">IP Address</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                            <span className="flex items-center gap-1"><MonitorSmartphone className="h-3 w-3" /> Device</span>
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((event: any, i: number) => {
                          const ua: string = event.userAgent || "";
                          const isMobile = /mobile|android|iphone|ipad/i.test(ua);
                          const browser =
                            /edg\//i.test(ua) ? "Edge" :
                            /opr\//i.test(ua) ? "Opera" :
                            /chrome/i.test(ua) ? "Chrome" :
                            /safari/i.test(ua) ? "Safari" :
                            /firefox/i.test(ua) ? "Firefox" : "Other";
                          const os =
                            /windows/i.test(ua) ? "Windows" :
                            /mac os/i.test(ua) ? "macOS" :
                            /linux/i.test(ua) ? "Linux" :
                            /android/i.test(ua) ? "Android" :
                            /ios|iphone|ipad/i.test(ua) ? "iOS" : "";
                          const deviceLabel = [browser, os].filter(Boolean).join(" · ") || "Unknown";

                          const when = event.createdAt ? new Date(event.createdAt) : null;
                          const timeStr = when ? when.toLocaleString("en-IN", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true
                          }) : "—";

                          const roleBadge: Record<string, string> = {
                            owner:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                            doctor:    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
                            superuser: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
                          };

                          return (
                            <tr
                              key={event.id ?? i}
                              data-testid={`row-login-event-${event.id ?? i}`}
                              className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${!event.success ? "bg-red-500/3" : ""}`}
                            >
                              <td className="px-4 py-3">
                                {event.success ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Success
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-500 font-medium text-xs">
                                    <XCircle className="h-3.5 w-3.5" /> Failed
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleBadge[event.role] ?? "bg-muted text-muted-foreground"}`}>
                                  {event.role === "owner" ? "Clinic" : event.role === "doctor" ? "Doctor" : "Superuser"}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-foreground max-w-[180px] truncate" title={event.identifier}>
                                {event.identifier}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                {event.ipAddress || "—"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate" title={ua}>
                                <span className="flex items-center gap-1">
                                  {isMobile ? <MonitorSmartphone className="h-3 w-3 shrink-0" /> : <MonitorSmartphone className="h-3 w-3 shrink-0 opacity-40" />}
                                  {deviceLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                {timeStr}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-[11px] text-muted-foreground/50 px-4 py-3 border-t border-border/30">
                      Showing {filtered.length} of {loginEventsRaw.length} total events (last 200)
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Clinic Dialog */}
      <Dialog open={editClinicDialogOpen} onOpenChange={setEditClinicDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Clinic</DialogTitle>
            <DialogDescription>Update details for {selectedClinic?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-address" className="text-right">Address</Label>
              <Input id="edit-address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="col-span-3" placeholder="Street / Building" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-city" className="text-right">City</Label>
              <Input id="edit-city" value={editCity} onChange={(e) => setEditCity(e.target.value)} className="col-span-3" placeholder="e.g. Kochi" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-pincode" className="text-right">Pincode</Label>
              <Input id="edit-pincode" value={editPincode} onChange={(e) => setEditPincode(e.target.value)} className="col-span-3" placeholder="e.g. 682001" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-storage" className="text-right">Storage (MB)</Label>
              <Input id="edit-storage" type="number" min="1" value={editStorageLimitMb} onChange={(e) => setEditStorageLimitMb(e.target.value)} className="col-span-3" placeholder="Leave blank to use plan default" />
            </div>
          </div>
          <DialogFooter>
             <Button onClick={() => updateClinicMutation.mutate({ id: selectedClinic!.id, name: editName, address: editAddress, city: editCity, pincode: editPincode, storageLimitBytes: editStorageLimitMb.trim() ? Math.round(Number(editStorageLimitMb) * 1024 * 1024) : null })} disabled={updateClinicMutation.isPending}>
              {updateClinicMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Deal Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={(open) => { if (!open) { setEditSheetOpen(false); setEditingDeal(null); resetDealForm(); } }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" /> Edit Deal
            </SheetTitle>
            <SheetDescription>Update details for <span className="font-medium text-foreground">{editingDeal?.title}</span></SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            {/* Image */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Deal Image</Label>
              {dealImageUrl && (
                <div className="relative rounded-xl overflow-hidden border aspect-video bg-muted mb-2">
                  <img src={dealImageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Paste image URL"
                  value={dealImageManualUrl}
                  onChange={(e) => { setDealImageManualUrl(e.target.value); setDealImageUrl(e.target.value); }}
                  className="text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isOptimising} title={isOptimising ? "Optimising…" : isUploading ? "Uploading…" : "Upload image"}>
                  {isOptimising ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> : isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Audience */}
            <div className="space-y-2">
              <Label className="font-semibold">Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["patient", "clinic"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setDealTargetAudience(opt); setDealCategory(""); setDealSubcategory(""); }}
                    className={`h-9 rounded-lg border text-sm font-semibold transition-all ${dealTargetAudience === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/50"}`}
                  >
                    {opt === "clinic" ? "🏥 Ad — for Clinics" : "🧑 Deal — for Patients"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-muted-foreground" /> Category</Label>
              <select value={dealCategory} onChange={(e) => setDealCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground">
                <option value="">Select category</option>
                {(dealTargetAudience === "clinic" ? CLINIC_DEAL_CATEGORIES : DEAL_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {/* Clinic selector */}
            {dealTargetAudience === "patient" && (
              <div className="space-y-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Building2 className="h-3.5 w-3.5" /> Link to Clinic <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <select value={dealClinicId ?? ""} onChange={(e) => {
                  const id = Number(e.target.value);
                  setDealClinicId(id || null);
                  if (id) { const clinic = clinics.find(c => c.id === id); if (clinic) setDealBookingLink(`/book/${id}`); }
                }} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground">
                  <option value="">Select a clinic</option>
                  {clinics.filter(c => !(c as any).isArchived && (c as any).status !== 'rejected').map(c => (
                    <option key={c.id} value={c.id}>{c.name}{(c as any).city ? ` — ${(c as any).city}` : ""}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Subcategory */}
            <div className="space-y-2">
              <Label>{dealTargetAudience === "clinic" ? "Product / Service Type" : "Procedure / Type"}</Label>
              <select value={dealSubcategory} onChange={(e) => setDealSubcategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground">
                <option value="">{dealTargetAudience === "clinic" ? "Select product / service type" : "Select procedure type"}</option>
                {(dealTargetAudience === "clinic" ? CLINIC_DEAL_SUBCATEGORIES : DEAL_SUBCATEGORIES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="Deal title" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={dealDescription} onChange={(e) => setDealDescription(e.target.value)} className="resize-none h-[72px]" />
            </div>

            {/* Contact & Social Links — always shown for Ads */}
            {dealTargetAudience === "clinic" && (
              <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Contact & Social Links
                </p>
                <Input placeholder="Company / Brand name" value={dealSponsorName} onChange={(e) => setDealSponsorName(e.target.value)} className="h-8 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Phone" value={dealSponsorPhone} onChange={(e) => setDealSponsorPhone(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Email" value={dealSponsorEmail} onChange={(e) => setDealSponsorEmail(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                </div>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Website URL (https://...)" value={dealSponsorWebsite} onChange={(e) => setDealSponsorWebsite(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <SiFacebook className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#1877F2]" />
                    <Input placeholder="Facebook page URL" value={dealAdFacebook} onChange={(e) => setDealAdFacebook(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                  <div className="relative">
                    <SiInstagram className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#E1306C]" />
                    <Input placeholder="Instagram profile URL" value={dealAdInstagram} onChange={(e) => setDealAdInstagram(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <SiLinkedin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#0A66C2]" />
                    <Input placeholder="LinkedIn company URL" value={dealAdLinkedin} onChange={(e) => setDealAdLinkedin(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                  <div className="relative">
                    <SiWhatsapp className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#25D366]" />
                    <Input placeholder="WhatsApp number (+91...)" value={dealAdWhatsapp} onChange={(e) => setDealAdWhatsapp(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* Sponsor contact info — Deals with Sponsored / Featured Slots only */}
            {dealTargetAudience === "patient" && dealCategory === "Sponsored / Featured Slots" && (
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5" /> Sponsor Contact Info
                </p>
                <Input placeholder="Sponsor / Brand name" value={dealSponsorName} onChange={(e) => setDealSponsorName(e.target.value)} className="h-8 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Phone" value={dealSponsorPhone} onChange={(e) => setDealSponsorPhone(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Email" value={dealSponsorEmail} onChange={(e) => setDealSponsorEmail(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                </div>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Website URL" value={dealSponsorWebsite} onChange={(e) => setDealSponsorWebsite(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
              </div>
            )}

            {/* Price */}
            {(!dealCategory || CATEGORIES_WITH_PRICE.includes(dealCategory)) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Deal Price (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input value={dealPrice} onChange={(e) => setDealPrice(e.target.value)} placeholder="499" className="pl-7" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Original Price (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input value={dealOriginalPrice} onChange={(e) => setDealOriginalPrice(e.target.value)} placeholder="999" className="pl-7" />
                  </div>
                </div>
              </div>
            )}

            {/* Booking link */}
            <div className="space-y-2">
              <Label>{linkConfig.label}</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={dealBookingLink} onChange={(e) => setDealBookingLink(e.target.value)} placeholder={linkConfig.placeholder} className="pl-9" />
              </div>
            </div>

            {/* Video URL */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5 text-muted-foreground" /> Promo Video URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative">
                <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={dealVideoUrl} onChange={(e) => setDealVideoUrl(e.target.value)} placeholder="YouTube, Vimeo, or .mp4 URL" className="pl-9" />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full justify-start text-left font-normal text-sm h-9 ${!dealStartsAt && "text-muted-foreground"}`}>
                      <CalendarDays className="mr-2 h-3.5 w-3.5" />
                      {dealStartsAt ? format(dealStartsAt, "d MMM yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                    <Calendar mode="single" selected={dealStartsAt} onSelect={setDealStartsAt} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-muted-foreground" /> Expiry Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full justify-start text-left font-normal text-sm h-9 ${!dealExpiresAt && "text-muted-foreground"}`}>
                      <CalendarDays className="mr-2 h-3.5 w-3.5" />
                      {dealExpiresAt ? format(dealExpiresAt, "d MMM yyyy") : "Expiry date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                    <Calendar mode="single" selected={dealExpiresAt} onSelect={setDealExpiresAt} disabled={(date) => date < new Date()} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Featured + Flash */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <div><p className="text-xs font-medium">Featured</p><p className="text-[10px] text-muted-foreground">Hero card</p></div>
                </div>
                <Switch checked={dealIsFeatured} onCheckedChange={setDealIsFeatured} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚡</span>
                  <div><p className="text-xs font-medium">Flash Deal</p><p className="text-[10px] text-muted-foreground">Scroll strip</p></div>
                </div>
                <Switch checked={dealIsFlash} onCheckedChange={setDealIsFlash} />
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium"
              onClick={() => updateDealMutation.mutate(
                { id: editingDeal!.id, updates: getDealPayload() },
                { onSuccess: () => { setEditSheetOpen(false); setEditingDeal(null); resetDealForm(); } }
              )}
              disabled={updateDealMutation.isPending || !dealTitle}
            >
              {updateDealMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Credentials</DialogTitle>
            <DialogDescription>Set username and password for {selectedClinic?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cred-user" className="text-right">Username</Label>
              <Input id="cred-user" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cred-pass" className="text-right">Password</Label>
              <Input id="cred-pass" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentialsMutation.mutate({ clinicId: selectedClinic!.id, username: editUsername, password: editPassword })} disabled={setCredentialsMutation.isPending}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
