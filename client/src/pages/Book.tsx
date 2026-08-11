import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Loader2, CalendarDays, CheckCircle2, Building2, User, Phone, Mail,
  MapPin, Sun, Moon, Clock, Shield, Sparkles, Search, Stethoscope, X, ChevronDown,
  CreditCard, ClipboardCheck, Info, Lock, AlertTriangle, ChevronRight, Plus, Users,
  Bone, Baby, Bandage, SmilePlus, ArrowLeftRight, Wrench, MinusCircle, ShieldCheck,
} from "lucide-react";

function ToothIcon({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={style} className={className} aria-hidden="true">
      <path d="M12 2C9.3 2 8 4.2 8 6c0 .9.2 1.8.5 2.7C9 10 9.5 11.5 9.5 13.5c0 2 .5 4 1 5.5.2.6.5 1 1 1s.8-.4 1-1c.5-1.5 1-3.5 1-5.5 0-2 .5-3.5 1-5.3C15.8 7.8 16 6.9 16 6c0-1.8-1.3-4-4-4z"/>
    </svg>
  );
}
import ClinicInfoSheet from "@/components/ClinicInfoSheet";
import type { Clinic } from "@shared/schema";
import { format, addDays, startOfToday, isSameDay, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

interface SlotTiming {
  id: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

const DEFAULT_SLOT_TIMINGS: SlotTiming[] = [
  { id: "1", label: "Early Morning", startHour: 8,  startMinute: 0,  endHour: 10, endMinute: 0  },
  { id: "2", label: "Late Morning",  startHour: 10, startMinute: 0,  endHour: 12, endMinute: 30 },
  { id: "3", label: "Midday",        startHour: 12, startMinute: 30, endHour: 14, endMinute: 0  },
  { id: "4", label: "Afternoon",     startHour: 14, startMinute: 0,  endHour: 17, endMinute: 0  },
  { id: "5", label: "Evening",       startHour: 17, startMinute: 0,  endHour: 19, endMinute: 30 },
];

const DENTAL_CATEGORIES = [
  { category: "Tooth Pain or Sensitivity",        Icon: ToothIcon,         subIssues: ["Sensitivity to hot/cold/sweet", "Sharp or throbbing pain", "Pain while chewing", "Pain at night"],                          specialists: ["Endodontist", "General Dentist"] },
  { category: "Gum Problems",                     Icon: Bandage,           subIssues: ["Bleeding gums", "Swollen or red gums", "Receding gums", "Bad breath or bad taste"],                                        specialists: ["Periodontist", "General Dentist"] },
  { category: "Tooth Decay / Cavities",           Icon: AlertTriangle,     subIssues: ["Visible hole or black spot", "Pain when eating or drinking", "Food getting stuck"],                                         specialists: ["General Dentist", "Endodontist"] },
  { category: "Broken, Chipped or Cracked Tooth", Icon: Wrench,            subIssues: ["Chipped or broken tooth", "Cracked tooth", "Worn down teeth"],                                                              specialists: ["Prosthodontist", "General Dentist"] },
  { category: "Alignment or Bite Issues",         Icon: ArrowLeftRight,    subIssues: ["Crooked or crowded teeth", "Gaps between teeth", "Bite feels off or jaw discomfort"],                                       specialists: ["Orthodontist"] },
  { category: "Missing Teeth",                    Icon: MinusCircle,       subIssues: ["One tooth missing", "Multiple teeth missing", "Want replacement options"],                                                  specialists: ["Prosthodontist", "Oral Surgeon"] },
  { category: "Cosmetic / Smile Concerns",        Icon: SmilePlus,         subIssues: ["Yellow or stained teeth", "Want a whiter smile", "Uneven teeth shape", "Gaps I want closed"],                              specialists: ["Cosmetic Dentist", "Prosthodontist"] },
  { category: "Swelling or Infection",            Icon: Stethoscope,       subIssues: ["Swollen face or gum", "Pus or abscess", "Severe pain with swelling"],                                                      specialists: ["Endodontist", "Oral Surgeon", "General Dentist"] },
  { category: "Child's Dental Issues",            Icon: Baby,              subIssues: ["Tooth decay in baby teeth", "Child complains of pain", "Thumb sucking habits", "Delayed tooth eruption"],                  specialists: ["Pedodontist"] },
  { category: "Jaw Pain or Other",                Icon: Bone,              subIssues: ["Jaw pain or clicking (TMJ)", "Dry mouth", "Mouth ulcers", "Suspicious growth or lump"],                                    specialists: ["Oral Medicine Specialist", "Oral Surgeon", "General Dentist"] },
  { category: "Wisdom Tooth Problems",            Icon: ToothIcon,         subIssues: ["Pain from wisdom tooth", "Swelling near wisdom tooth", "Difficulty opening mouth"],                                         specialists: ["Oral Surgeon", "General Dentist"] },
  { category: "Preventive / Routine Care",        Icon: ShieldCheck,       subIssues: ["Regular checkup", "Cleaning or scaling", "Fluoride treatment"],                                                             specialists: ["General Dentist", "Dental Hygienist"] },
];

const getSlotMeta = (startHour: number) => {
  if (startHour < 12) return { Icon: Sun,   color: "text-amber-500",  bg: "bg-amber-500/10",  border: "border-amber-400/30"  };
  if (startHour < 16) return { Icon: Clock, color: "text-sky-500",    bg: "bg-sky-500/10",    border: "border-sky-400/30"    };
  return              { Icon: Moon,  color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/30"   };
};

function BookingShell({
  open,
  onOpenChange,
  isMobile,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="p-0 rounded-t-3xl overflow-hidden flex flex-col focus:outline-none border-0"
          style={{ maxHeight: "92dvh" }}
        >
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[520px] rounded-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {children}
      </DialogContent>
    </Dialog>
  );
}

export default function Book(props: { params: { clinicId?: string } }) {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const clinicIdFromUrl = props.params.clinicId || params.get("clinicId");

  const [selectedDate, setSelectedDate]     = useState<Date>(startOfToday());
  const [isDetailsOpen, setIsDetailsOpen]   = useState(false);
  const [customerName, setCustomerName]     = useState("");
  const [customerPhone, setCustomerPhone]   = useState("");
  const [customerEmail, setCustomerEmail]   = useState("");
  const [selectedClinic, setSelectedClinic] = useState<string>("");
  const [selectedSlot, setSelectedSlot]     = useState<string | null>(null);
  const [selectedSubIssues, setSelectedSubIssues] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes]     = useState("");
  const [openCategory, setOpenCategory]           = useState("");
  const [customerAge, setCustomerAge]             = useState("");
  const [customerGender, setCustomerGender]       = useState<"male" | "female" | "other" | "">();
  const [showSlots, setShowSlots]           = useState(false);
  const [step, setStep]                     = useState<"details" | "success">("details");
  const [phoneError, setPhoneError]         = useState("");
  const [searchQuery, setSearchQuery]       = useState("");
  const [clinicMode, setClinicMode]         = useState<"select" | "search">("select");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [slotTimings, setSlotTimings]       = useState<SlotTiming[]>(DEFAULT_SLOT_TIMINGS);
  const [paymentLoading, setPaymentLoading]     = useState(false);
  const [bookingPath, setBookingPath]           = useState<"pay" | "pending" | null>(null);
  const [isClinicSheetOpen, setIsClinicSheetOpen] = useState(false);
  const [infoClinic, setInfoClinic] = useState<Clinic | null>(null);
  const [patientProfiles, setPatientProfiles] = useState<any[]>([]);
  const [profilesFetched, setProfilesFetched] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<number | 'new' | null>(null);
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const razorpayScriptRef = useRef(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const dateStripRef = useRef<HTMLDivElement>(null);
  const accordionItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dialogBodyRef = useRef<HTMLDivElement>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [pendingBookingPath, setPendingBookingPath] = useState<"pay" | "pending" | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isAccordionExpanded, setIsAccordionExpanded] = useState(true);
  const [dropdownHighlighted, setDropdownHighlighted] = useState(false);
  const [newPatientSnapshot, setNewPatientSnapshot] = useState<{name: string, phone: string, age: string, gender: any} | null>(null);

  // OTP verification state
  const [otpSent, setOtpSent]               = useState(false);
  const [otpCode, setOtpCode]               = useState("");
  const [emailVerified, setEmailVerified]   = useState(false);
  const [verifiedToken, setVerifiedToken]   = useState("");
  const [otpError, setOtpError]             = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const validateIndianPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    return /^(\+91|91)?[6-9]\d{9}$/.test(cleaned);
  };

  const handlePhoneChange = (value: string) => {
    setCustomerPhone(value);
    if (value && !validateIndianPhone(value)) {
      setPhoneError("Please enter a valid Indian mobile number (10 digits starting with 6-9)");
    } else {
      setPhoneError("");
    }
  };

  const isPhoneValid = customerPhone && validateIndianPhone(customerPhone);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
  const otpDigits = Array.from({ length: 6 }, (_, index) => otpCode[index] || "");
  const isOtpComplete = otpCode.length === 6;
  const isAgeValid = Boolean(customerAge && Number(customerAge) >= 1 && Number(customerAge) <= 120);
  const canProceedToSlots = Boolean(customerName && isAgeValid && customerGender && isPhoneValid && isEmailValid && selectedClinic && emailVerified && verifiedToken && selectedSubIssues.length > 0 && (patientProfiles.length === 0 || selectedProfileId !== null));

  const resetOtpState = () => {
    setOtpSent(false);
    setOtpCode("");
    setEmailVerified(false);
    setVerifiedToken("");
    setOtpError("");
    setResendCountdown(0);
    setPatientProfiles([]);
    setProfilesFetched(false);
    setSelectedProfileId(null);
  };

  const handleEmailChange = (value: string) => {
    setCustomerEmail(value);
    if (emailVerified || otpSent) resetOtpState();
  };

  const handleSendOtp = () => {
    if (!customerName) {
      setOtpError("Please enter your name first.");
      return;
    }
    if (!isAgeValid) {
      setOtpError("Please enter a valid age (1–120) first.");
      return;
    }
    if (!customerGender) {
      setOtpError("Please select your gender first.");
      return;
    }
    if (!isPhoneValid) {
      setOtpError("Please enter a valid phone number first.");
      return;
    }
    if (!isEmailValid) {
      setOtpError("Please enter a valid email address first.");
      return;
    }
    sendOtpMutation.mutate(customerEmail.trim().toLowerCase());
  };

  const handleVerifyOtp = () => {
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setOtpError("Please enter the 6-digit code from your email.");
      return;
    }
    verifyOtpMutation.mutate({ email: customerEmail.trim().toLowerCase(), code });
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    const nextCode = nextDigits.join("").slice(0, 6);
    setOtpCode(nextCode);
    setOtpError("");
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: any) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event: any) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setOtpCode(pasted);
    setOtpError("");
    otpInputRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  // Countdown for OTP resend cooldown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Auto-submit OTP when all 6 digits are entered
  useEffect(() => {
    if (otpCode.length === 6 && otpSent && !emailVerified && !verifyOtpMutation.isPending) {
      const code = otpCode.trim();
      if (/^\d{6}$/.test(code)) {
        verifyOtpMutation.mutate({ email: customerEmail.trim().toLowerCase(), code });
      }
    }
  }, [otpCode]);

  // Restore form fields from sessionStorage on mount
  useEffect(() => {
    const name   = sessionStorage.getItem("bms_name");
    const phone  = sessionStorage.getItem("bms_phone");
    const email  = sessionStorage.getItem("bms_email");
    const issues = sessionStorage.getItem("bms_sub_issues");
    const notes  = sessionStorage.getItem("bms_notes");
    if (name)   setCustomerName(name);
    if (phone)  setCustomerPhone(phone);
    if (email)  setCustomerEmail(email);
    if (issues) { try { setSelectedSubIssues(JSON.parse(issues)); } catch {} }
    if (notes)  setAdditionalNotes(notes);
  }, []);

  // Persist form fields to sessionStorage on every change
  useEffect(() => {
    if (customerName)  sessionStorage.setItem("bms_name",  customerName);
    if (customerPhone) sessionStorage.setItem("bms_phone", customerPhone);
    if (customerEmail) sessionStorage.setItem("bms_email", customerEmail);
    sessionStorage.setItem("bms_sub_issues", JSON.stringify(selectedSubIssues));
    if (additionalNotes) sessionStorage.setItem("bms_notes", additionalNotes);
  }, [customerName, customerPhone, customerEmail, selectedSubIssues, additionalNotes]);

  // Scroll date strip into view after clinic selection animation completes
  useEffect(() => {
    if (!selectedClinic) return;
    const timer = setTimeout(() => {
      dateStripRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 450);
    return () => clearTimeout(timer);
  }, [selectedClinic]);

  const handleSubIssueToggle = (subIssue: string) => {
    setSelectedSubIssues(prev =>
      prev.includes(subIssue) ? prev.filter(s => s !== subIssue) : [...prev, subIssue]
    );
  };

  const countForCategory = (cat: typeof DENTAL_CATEGORIES[0]) =>
    cat.subIssues.filter(s => selectedSubIssues.includes(s)).length;


  useEffect(() => {
    const saved = localStorage.getItem("slotTimings");
    if (saved) setSlotTimings(JSON.parse(saved));
  }, []);

  const { data: clinicsData, isLoading: clinicsLoading } = useQuery<Clinic[]>({
    queryKey: ["/api/public/clinics"],
  });

  const hardcodedClinic: Clinic = {
    id: 999, name: "Demo Smile Clinic", address: "123 Demo St, Dental City",
    city: null, pincode: null, username: "demo_clinic", passwordHash: "",
    email: "demo@example.com", phone: "9876543210", website: "www.demosmile.com",
    doctorName: "Dr. Demo", doctorSpecialization: "General Dentistry", doctorDegree: "DDS",
    doctors: [], logoUrl: null, status: "approved", registeredBy: null,
    isArchived: false, createdAt: new Date(),
    latitude: null,
    longitude: null,
    googleBusinessUrl: null,
    gstNumber: null,
    medicalLicenseUrl: null,
    clinicRegCertUrl: null,
    trustScore: 0,
    plan: "starter",
    subscriptionStatus: "unpaid",
    billingCycle: "monthly",
    razorpaySubscriptionId: null,
    storageLimitBytes: null,
    timezone: "Asia/Kolkata",
    websiteConfig: { theme: "classic" },
    defaultSlotConfig: { isClosed: false, sections: {} },
  };

  const clinics = clinicsData
    ? [...clinicsData.filter(c => !c.isArchived && c.name !== "Demo Smile Clinic"), hardcodedClinic]
    : [hardcodedClinic];

  const filteredClinics = searchQuery.trim()
    ? clinics.filter(c => {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          ((c as any).city || "").toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q) ||
          ((c as any).pincode || "").includes(q)
        );
      })
    : clinics;

  useEffect(() => {
    if (clinicIdFromUrl && clinics.length > 0) {
      const clinic = clinics.find(c => c.id.toString() === clinicIdFromUrl);
      if (clinic) setSelectedClinic(clinic.name);
    }
  }, [clinicIdFromUrl, clinics]);

  const selectedClinicId = clinicsData?.find(c => c.name === selectedClinic)?.id;
  const isRealClinic     = !!selectedClinic && selectedClinic !== "Demo Smile Clinic" && !!selectedClinicId;
  const availabilityDate = format(selectedDate, "yyyy-MM-dd");

  type SlotAvailRow = {
    slotIndex: number; label: string; startTimeISO: string;
    count: number; max: number; isCancelled: boolean; spotsLeft: number;
  };
  const { data: slotAvailability, isFetching: slotAvailFetching } = useQuery<SlotAvailRow[]>({
    queryKey: ["slot-availability", selectedClinic, availabilityDate, slotTimings.map(s => s.id).join(",")],
    enabled: isRealClinic,
    staleTime: 30_000,
    queryFn: async () => {
      const payload = slotTimings.map((s, i) => {
        const st = new Date(selectedDate);
        st.setHours(s.startHour, s.startMinute, 0, 0);
        return { slotIndex: i, label: s.label, startTimeISO: st.toISOString() };
      });
      const res = await apiRequest("POST", "/api/public/slot-availability", { clinicId: selectedClinicId, slots: payload });
      if (!res.ok) throw new Error("Failed to fetch slot availability");
      return res.json();
    },
  });

  type ClinicAvail = { hasAnyAvailable: boolean; totalDoctors: number; onLeaveCount: number };
  const { data: clinicAvailability } = useQuery<ClinicAvail>({
    queryKey: ["clinic-availability", selectedClinic, availabilityDate],
    enabled: isRealClinic,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/public/clinic-availability?clinicId=${selectedClinicId}&date=${availabilityDate}`);
      if (!res.ok) throw new Error("Failed to check clinic availability");
      return res.json();
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/public/bookings", data);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Failed to create booking (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      setBookingPath("pending");
      setStep("success");
      notify.success("Booking submitted", { description: "Your request has been sent to the clinic for approval." });
    },
    onError: (error: any) => {
      notify.apiError(error, "Booking Failed");
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/public/otp/send", { email, purpose: "booking" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send verification code");
      }
      return response.json();
    },
    onSuccess: () => {
      setOtpSent(true);
      setOtpCode("");
      setOtpError("");
      setResendCountdown(60);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      notify.info("Code sent", { description: "Check your email for the 6-digit verification code." });
    },
    onError: (error: any) => {
      setOtpError(error.message || "Failed to send verification code. Please try again.");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await apiRequest("POST", "/api/public/otp/verify", { email, code, purpose: "booking" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Invalid or expired code");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      setEmailVerified(true);
      setVerifiedToken(data.verifiedToken);
      setOtpError("");
      notify.success("Email verified", { description: "You can now complete your booking." });
      // Fetch all patient profiles for this email at this clinic
      try {
        const cId = clinicsData?.find((c: any) => c.name === selectedClinic)?.id;
        if (cId) {
          const lookup = await apiRequest(
            "GET",
            `/api/public/patients-by-email?email=${encodeURIComponent(customerEmail.toLowerCase())}&clinicId=${cId}`
          );
          if (lookup.ok) {
            const profiles = await lookup.json();
            const profileList = Array.isArray(profiles) ? profiles : [];
            setPatientProfiles(profileList);
            setProfilesFetched(true);
            if (profileList.length > 0) {
              setDropdownHighlighted(true);
              setTimeout(() => setDropdownHighlighted(false), 3000);
            }
          }
        }
      } catch { /* non-fatal */ }
    },
    onError: (error: any) => {
      setOtpError(error.message || "Invalid code. Please try again.");
    },
  });

  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${h}:${minute.toString().padStart(2, "0")}${period}`;
  };

  const handleBook = () => {
    if (!selectedSlot || !customerName || !customerPhone || !customerEmail || !selectedClinic) return;
    if (!emailVerified || !verifiedToken) {
      notify.warning("Email Verification Required", { description: "Please verify your email before booking." });
      return;
    }
    const slotInfo = slotTimings.find(s => s.id === selectedSlot);
    if (!slotInfo) return;

    const startTime = new Date(selectedDate);
    startTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
    const endTime = new Date(selectedDate);
    endTime.setHours(slotInfo.endHour, slotInfo.endMinute, 0, 0);

    if (selectedClinic === "Demo Smile Clinic") {
      const newBooking = {
        id: Math.floor(Math.random() * 10000) + 5000,
        slotId: Math.floor(Math.random() * 10000) + 6000,
        customerName, customerPhone, customerEmail,
        verificationStatus: "verified",
        slot: {
          id: Math.floor(Math.random() * 10000) + 6000,
          clinicId: 999, clinicName: "Demo Smile Clinic",
          startTime: startTime.toISOString(), endTime: endTime.toISOString(), isBooked: true,
        },
      };
      const stored = localStorage.getItem("demo_bookings_persistent");
      const persistentBookings = stored ? JSON.parse(stored) : [];
      persistentBookings.push(newBooking);
      localStorage.setItem("demo_bookings_persistent", JSON.stringify(persistentBookings));
      setStep("success");
      notify.success("Booking confirmed", { description: "Your appointment has been successfully booked (Demo)." });
      return;
    }

    const selectedClinicData = clinicsData?.find(c => c.name === selectedClinic);
    const clinicId = selectedClinicData?.id;
    if (!clinicId) {
      notify.error("Please select a valid clinic");
      return;
    }
    createBookingMutation.mutate({
      customerName, customerPhone, customerEmail,
      customerAge: customerAge ? parseInt(customerAge) : undefined,
      customerGender: customerGender || undefined,
      clinicId, clinicName: selectedClinic,
      startTime: startTime.toISOString(), endTime: endTime.toISOString(),
      description: [selectedSubIssues.join(", "), additionalNotes].filter(Boolean).join(" — "),
      verifiedToken,
      patientId: selectedProfileId !== null ? selectedProfileId : undefined,
    });
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    if (razorpayScriptRef.current) return Promise.resolve(true);
    return new Promise(resolve => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => { razorpayScriptRef.current = true; resolve(true); };
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayAndConfirm = async () => {
    if (!selectedSlot || !customerName || !customerPhone || !customerEmail || !selectedClinic) return;
    if (!emailVerified || !verifiedToken) {
      notify.warning("Email Verification Required", { description: "Please verify your email before booking." });
      return;
    }
    const slotInfo = slotTimings.find(s => s.id === selectedSlot);
    if (!slotInfo) return;

    const startTime = new Date(selectedDate);
    startTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
    const endTime = new Date(selectedDate);
    endTime.setHours(slotInfo.endHour, slotInfo.endMinute, 0, 0);

    const selectedClinicData = clinicsData?.find(c => c.name === selectedClinic);
    const clinicId = selectedClinicData?.id;
    if (!clinicId) {
      notify.error("Please select a valid clinic");
      return;
    }

    setPaymentLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load payment gateway");

      const orderRes = await apiRequest("POST", "/api/public/razorpay/create-order", {
        clinicId,
        startTime: startTime.toISOString(),
        email: customerEmail,
        verifiedToken,
      });
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create order");
      }
      const order = await orderRes.json();

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: selectedClinic,
        description: "Token booking fee – actual consultation fee payable at clinic",
        order_id: order.orderId,
        prefill: { name: customerName, contact: customerPhone, email: customerEmail },
        theme: { color: "#0F9B6E" },
        handler: async (response: any) => {
          try {
            const verifyRes = await apiRequest("POST", "/api/public/razorpay/verify-payment", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              customerName, customerPhone, customerEmail,
              clinicId, clinicName: selectedClinic,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              description: [selectedSubIssues.join(", "), additionalNotes].filter(Boolean).join(" — "),
              verifiedToken,
            });
            if (!verifyRes.ok) {
              const body = await verifyRes.json().catch(() => ({}));
              throw new Error(body.message || "Payment verification failed");
            }
            setBookingPath("pay");
            setStep("success");
            notify.success("Payment successful", { description: "Your slot is confirmed." });
          } catch (err: any) {
            notify.apiError(err, "Verification Failed");
          }
        },
        modal: {
          ondismiss: () => setPaymentLoading(false),
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", () => {
        setPaymentLoading(false);
        notify.critical("Payment Failed", { description: "Please try again or choose clinic approval." });
      });
      rzp.open();
    } catch (err: any) {
      setPaymentLoading(false);
      notify.apiError(err);
    }
  };

  const resetForm = () => {
    setIsDetailsOpen(false);
    setShowSlots(false);
    setSelectedSlot(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setSelectedSubIssues([]);
    setAdditionalNotes("");
    setOpenCategory("");
    setCustomerAge("");
    setCustomerGender(undefined);
    setPhoneError("");
    setPaymentLoading(false);
    setBookingPath(null);
    setShowAllCategories(false);
    setShowReview(false);
    setPendingBookingPath(null);
    setIsEditingDetails(false);
    setIsAccordionExpanded(true);
    setStep("details");
    resetOtpState();
    sessionStorage.removeItem("bms_name");
    sessionStorage.removeItem("bms_phone");
    sessionStorage.removeItem("bms_email");
    sessionStorage.removeItem("bms_sub_issues");
    sessionStorage.removeItem("bms_notes");
  };

  const selectedClinicObj = clinics.find(c => c.name === selectedClinic);
  const selectedSlotInfo  = slotTimings.find(s => s.id === selectedSlot);

  // Change 5 — dynamic browser tab title for clinic-specific links
  useEffect(() => {
    if (clinicIdFromUrl && selectedClinicObj) {
      document.title = `Book at ${selectedClinicObj.name} | BookMySlot`;
    } else {
      document.title = "BookMySlot — Book a Dental Appointment";
    }
    return () => { document.title = "BookMySlot"; };
  }, [clinicIdFromUrl, selectedClinicObj?.name]);

  if (clinicsLoading) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        {/* Hero banner skeleton */}
        <div className="bg-foreground dark:bg-background">
          <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />
          <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-3">
            <Skeleton className="h-4 w-32 bg-white/10" />
            <Skeleton className="h-8 w-3/4 bg-white/10" />
            <Skeleton className="h-4 w-1/2 bg-white/10" />
          </div>
        </div>
        {/* Form skeleton */}
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {/* Clinic selector skeleton */}
          <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-xl" />
            {/* Three clinic option skeletons */}
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 px-1 py-1">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
            ))}
          </div>
          {/* Patient details skeleton */}
          <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-background overflow-x-hidden">

      {/* ── BACKGROUND GLOW BLOBS ─────────────────────── */}
      <div className="fixed top-0 right-0 w-[520px] h-[520px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/4 translate-x-1/4" />
      <div className="fixed bottom-0 left-0  w-[420px] h-[420px] bg-accent/5  rounded-full blur-3xl pointer-events-none  translate-y-1/4 -translate-x-1/4" />

      {/* ── HERO BANNER ──────────────────────────────────── */}
      <div className="relative bg-foreground dark:bg-background overflow-hidden">
        {/* Top accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Ambient glow blobs — same as login panel */}
        <div className="absolute -top-40 -left-20 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-20 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

        {/* Grid texture — same as login panel */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Decorative large icon */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.06] pointer-events-none select-none">
          <CalendarDays className="h-52 w-52 text-white" />
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 py-5 sm:py-14 max-w-5xl">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else if (clinicIdFromUrl) {
                window.location.href = `/about?clinic=${clinicIdFromUrl}`;
              } else {
                window.location.href = "/";
              }
            }}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-white/50 hover:text-white mb-4 transition-colors py-2 -my-2"
            data-testid="button-back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Back
          </button>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/50 mb-3">
            <CalendarDays className="h-3 w-3" /> BookMySlot
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-2">
            {clinicIdFromUrl && selectedClinicObj ? (
              <>Book a dental appointment at <span className="text-primary">{selectedClinicObj.name}</span></>
            ) : (
              <>Book a <span className="text-primary">Dental Appointment</span></>
            )}
          </h1>
          <p className="text-white/50 text-sm sm:text-base mb-5 sm:mb-7 max-w-md">
            {clinicIdFromUrl && selectedClinicObj
              ? `Secure your slot at ${selectedClinicObj.name}. Pick a time that works and get confirmed instantly — no account needed.`
              : "Find a verified clinic near you, pick a slot, and get confirmed instantly. No account needed."}
          </p>
          {(() => {
            const clinicLocation = clinicIdFromUrl && selectedClinicObj
              ? ((selectedClinicObj as any).city || selectedClinicObj.address || null)
              : null;
            const desktopPills = clinicLocation
              ? [
                  { Icon: MapPin,    label: clinicLocation                       },
                  { Icon: Shield,   label: "No sign-up — just email verification" },
                  { Icon: Sparkles, label: "Instant WhatsApp confirmation"        },
                ]
              : [
                  { Icon: MapPin,    label: "50+ verified clinics across Kerala"  },
                  { Icon: Shield,   label: "No sign-up — just email verification" },
                  { Icon: Sparkles, label: "Instant WhatsApp confirmation"        },
                ];
            return (
              <>
                <div className="hidden sm:flex flex-wrap gap-2">
                  {desktopPills.map(({ Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.1] rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur-sm">
                      <Icon className="h-3 w-3" />
                      {label}
                    </div>
                  ))}
                </div>
                <div className="flex sm:hidden gap-3 text-[11px] text-white/50 font-semibold">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {clinicLocation ?? "50+ clinics"}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Email verified</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Instant</span>
                </div>
              </>
            );
          })()}
        </div>

        {/* Bottom accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────── */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl space-y-6">

        {/* ── CLINIC SELECTION ────────────────────────────── */}
        {!clinicIdFromUrl && (
          <div>
            {/* Section heading */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold tracking-tight">Choose a Clinic</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Find a verified dental clinic near you by name, area, or city</p>
              </div>
              {selectedClinic && (
                <button
                  onClick={() => setSelectedClinic("")}
                  className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            {/* ── Mode toggle pill switcher ── */}
            <div className="flex gap-1.5 p-1 bg-muted/40 border border-border/50 rounded-xl mb-4 w-full sm:w-fit">
              {([
                { id: "select", Icon: Building2, label: "All Clinics",           mobileLabel: "All Clinics"  },
                { id: "search", Icon: MapPin,    label: "Search by Name / Area",  mobileLabel: "Search"       },
              ] as const).map(({ id, Icon, label, mobileLabel }) => (
                <button
                  key={id}
                  onClick={() => {
                    setClinicMode(id);
                    setSearchQuery("");
                    setIsDropdownOpen(false);
                  }}
                  className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap active:scale-[0.98] ${
                    clinicMode === id
                      ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`mode-tab-${id}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="sm:hidden">{mobileLabel}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* ── SELECT CLINIC MODE — custom dropdown ── */}
            {clinicMode === "select" && (
              <div className="relative max-w-md">
                {/* Trigger */}
                <button
                  onClick={() => setIsDropdownOpen(o => !o)}
                  className={`w-full flex items-center gap-0 rounded-xl border transition-all duration-200 overflow-hidden ${
                    isDropdownOpen
                      ? "border-primary/50 ring-2 ring-primary/10"
                      : "border-border/60 hover:border-primary/40"
                  } bg-card`}
                  data-testid="select-clinic"
                >
                  {/* Icon tile */}
                  <div className={`flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 shrink-0 border-r border-border/40 transition-colors ${
                    isDropdownOpen ? "bg-primary/10 border-primary/20" : "bg-muted/30"
                  }`}>
                    {selectedClinic ? (
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[11px] font-black text-white">
                        {selectedClinic.charAt(0)}
                      </div>
                    ) : (
                      <Building2 className={`h-4 w-4 ${isDropdownOpen ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                  </div>
                  {/* Label */}
                  <span className={`flex-1 text-left px-3 text-sm ${selectedClinic ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {selectedClinic || "Choose a dental clinic"}
                  </span>
                  {/* Chevron */}
                  <div className="px-3">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Dropdown panel */}
                {isDropdownOpen && (
                  <>
                    {/* Click-outside backdrop */}
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    {/* Panel */}
                    <div className="absolute top-full left-0 right-0 z-20 mt-2 rounded-xl border border-border/60 bg-card shadow-xl shadow-black/10 overflow-hidden">
                      <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {clinics.length} verified clinic{clinics.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {clinics.map(clinic => {
                          const isSelected = selectedClinic === clinic.name;
                          return (
                            <button
                              key={clinic.id}
                              onClick={() => { setSelectedClinic(clinic.name); setIsDropdownOpen(false); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-primary/5 border-b border-border/30 last:border-0 ${
                                isSelected ? "bg-primary/8 border-l-2 border-l-primary pl-[10px]" : ""
                              }`}
                              data-testid={`clinic-option-${clinic.id}`}
                            >
                              {/* Small avatar */}
                              <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black text-white ${
                                isSelected
                                  ? "bg-gradient-to-br from-primary to-accent"
                                  : "bg-gradient-to-br from-primary/60 to-accent/60"
                              }`}>
                                {clinic.name.charAt(0)}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${isSelected ? "text-primary" : ""}`}>{clinic.name}</p>
                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                  {clinic.doctorName && <><Stethoscope className="h-2.5 w-2.5 shrink-0" />Dr. {clinic.doctorName}</>}
                                  {clinic.address && <><MapPin className="h-2.5 w-2.5 shrink-0 ml-1" />{[(clinic as any).city, clinic.address].filter(Boolean).join(", ")}</>}
                                </p>
                              </div>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── SEARCH BY LOCATION MODE ── */}
            {clinicMode === "search" && (
              <div className="max-w-md">
                {/* Search input */}
                <div className="flex items-center rounded-xl border border-border/60 bg-card focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden mb-3">
                  <div className="flex items-center justify-center h-12 w-12 shrink-0 border-r border-border/40 bg-muted/30">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Type clinic name, city, or area…"
                    className="flex-1 h-12 bg-transparent pl-3 pr-3 text-sm outline-none"
                    data-testid="input-clinic-search"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="px-3 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Empty state hint */}
                {!searchQuery.trim() && (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border/60 bg-muted/20">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Search className="h-5 w-5 text-primary/60" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground/80">Find your clinic</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Type a name, area, or pincode to find verified clinics near you</p>
                    </div>
                  </div>
                )}

                {/* Search results */}
                {searchQuery.trim() && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[11px] text-muted-foreground">
                        {filteredClinics.length === 0
                          ? `No results for "${searchQuery}"`
                          : `${filteredClinics.length} result${filteredClinics.length !== 1 ? "s" : ""} found`}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card shadow-md overflow-hidden">
                      {filteredClinics.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                          <MapPin className="h-8 w-8 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">No clinics found matching "{searchQuery}"</p>
                          <p className="text-xs text-muted-foreground/70">Try a different name or area</p>
                        </div>
                      ) : (
                        filteredClinics.map(clinic => {
                          const isSelected = selectedClinic === clinic.name;
                          return (
                            <div
                              key={clinic.id}
                              className={`flex items-center gap-3 px-3 py-3 border-b border-border/30 last:border-0 ${
                                isSelected ? "bg-primary/8 border-l-2 border-l-primary pl-[10px]" : ""
                              }`}
                            >
                              <button
                                onClick={() => setSelectedClinic(clinic.name)}
                                className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-primary/5 active:scale-[0.98] transition-all rounded-lg -mx-1 px-1 py-0.5"
                                data-testid={`clinic-search-result-${clinic.id}`}
                              >
                                <div className={`h-9 w-9 rounded-xl shrink-0 flex items-center justify-center text-sm font-black text-white ${
                                  isSelected
                                    ? "bg-gradient-to-br from-primary to-accent"
                                    : "bg-gradient-to-br from-primary/60 to-accent/60"
                                }`}>
                                  {clinic.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${isSelected ? "text-primary" : ""}`}>{clinic.name}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    {clinic.doctorName && <><Stethoscope className="h-2.5 w-2.5 shrink-0" />Dr. {clinic.doctorName} · </>}
                                    {[(clinic as any).city, clinic.address].filter(Boolean).join(", ")}
                                  </p>
                                </div>
                                {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setInfoClinic(clinic); setIsClinicSheetOpen(true); }}
                                className="h-10 w-10 shrink-0 rounded-lg bg-primary/8 hover:bg-primary/15 flex items-center justify-center text-primary/60 hover:text-primary transition-all border border-primary/15 hover:border-primary/30"
                                title="View clinic details"
                                data-testid={`button-clinic-info-${clinic.id}`}
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CLINIC PROFILE STRIP (once selected) ─────────── */}
        {selectedClinic && (
          <div className="rounded-2xl overflow-hidden border border-primary/25 shadow-lg shadow-primary/8 animate-in fade-in slide-in-from-top-2 duration-400">
            {/* Neon top bar */}
            <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />
            <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-4 sm:px-5 py-3 sm:py-4 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
              <div className="relative flex items-center gap-3 sm:gap-4">
                {/* Avatar — show clinic logo if available, otherwise first-letter initial */}
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-accent/40 to-primary/30 blur-sm" />
                  <div className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center ring-1 ring-white/10 overflow-hidden">
                    {selectedClinicObj?.logoUrl ? (
                      <img
                        src={selectedClinicObj.logoUrl}
                        alt={selectedClinic}
                        className="h-full w-full object-cover"
                        fetchPriority="high"
                      />
                    ) : (
                      <span className="text-lg sm:text-xl font-black text-white">{selectedClinic.charAt(0)}</span>
                    )}
                  </div>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55 mb-0.5">Booking At</p>
                  <p className="text-white font-extrabold text-base sm:text-lg leading-tight truncate">{selectedClinic}</p>
                  {selectedClinicObj?.doctorName && (
                    <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1 overflow-hidden">
                      <Stethoscope className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        Dr. {selectedClinicObj.doctorName}
                        {selectedClinicObj.doctorSpecialization ? ` · ${selectedClinicObj.doctorSpecialization}` : ""}
                      </span>
                    </p>
                  )}
                  {((selectedClinicObj as any)?.city || selectedClinicObj?.address) && (
                    <p className="text-white/50 text-xs mt-0.5 flex items-center gap-1 overflow-hidden">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {(selectedClinicObj as any).city || selectedClinicObj?.address}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setInfoClinic(selectedClinicObj ?? null); setIsClinicSheetOpen(true); }}
                    className="flex items-center gap-1.5 h-9 px-2 sm:px-3 rounded-xl bg-white/15 hover:bg-white/30 text-white/90 hover:text-white text-[11px] font-bold transition-all border border-white/25 hover:border-white/45 shadow-sm"
                    data-testid="button-view-clinic-details"
                  >
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">About Clinic</span>
                  </button>
                  {!clinicIdFromUrl && (
                    <button
                      onClick={() => setSelectedClinic("")}
                      className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
            </div>
          </div>
        )}

        {/* ── DATE STRIP ──────────────────────────────────── */}
        {selectedClinic && (
          <div ref={dateStripRef} className="animate-in fade-in slide-in-from-top-2 duration-400">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-primary" /> Select Date
              </h3>
              <p className="text-xs text-muted-foreground">{format(selectedDate, "MMMM yyyy")}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="w-full whitespace-nowrap pb-3">
                  <div className="flex space-x-2.5 px-0.5">
                    {dates.map(date => {
                      const isSelected = isSameDay(date, selectedDate);
                      let isDayFull = false;

                      if (selectedClinic === "Demo Smile Clinic") {
                        const storedConfigs  = localStorage.getItem("demo_slot_configs");
                        const configs        = storedConfigs ? JSON.parse(storedConfigs) : {};
                        const storedBookings = localStorage.getItem("demo_bookings_persistent");
                        const persistentBookings = storedBookings ? JSON.parse(storedBookings) : [];
                        isDayFull = slotTimings.every(slot => {
                          const slotTime = new Date(date);
                          slotTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                          const iso      = slotTime.toISOString();
                          const config   = configs[iso];
                          const max      = config?.maxBookings ?? 3;
                          const cancelled = config?.isCancelled ?? false;
                          if (cancelled) return true;
                          const current = persistentBookings.filter((b: any) =>
                            new Date(b.slot.startTime).toISOString() === iso
                          ).length;
                          return current >= max;
                        });
                      } else {
                        // For real clinics we only have live availability for the currently selected date.
                        // Mark that date accurately; other dates stay green (checked in Step 2).
                        if (isSameDay(date, selectedDate) && slotAvailability) {
                          isDayFull = slotAvailability.every(s => s.spotsLeft === 0 || s.isCancelled);
                        } else {
                          isDayFull = false;
                        }
                      }

                      return (
                        <TooltipProvider key={date.toISOString()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                disabled={isDayFull}
                                onClick={() => {
                                  setSelectedDate(date);
                                  setShowSlots(false);
                                  setIsDetailsOpen(true);
                                }}
                                data-testid={`date-button-${format(date, "yyyy-MM-dd")}`}
                                className={`flex flex-col items-center justify-center min-w-[3.5rem] sm:min-w-[4rem] h-14 sm:h-[4.5rem] rounded-2xl border transition-all duration-200 relative active:scale-[0.98] ${
                                  isSelected
                                    ? "bg-gradient-to-b from-primary to-accent text-white border-primary shadow-lg shadow-primary/25 scale-105"
                                    : isDayFull
                                    ? "bg-destructive/8 border-destructive/20 text-destructive/60 cursor-not-allowed opacity-70"
                                    : "bg-card border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
                                }`}
                              >
                                <span className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                                  {format(date, "EEE")}
                                </span>
                                <span className="text-base sm:text-xl font-black leading-none">
                                  {format(date, "d")}
                                </span>
                                <span className={`hidden sm:block text-xs mt-0.5 ${isSelected ? "text-white/50" : "text-muted-foreground/60"}`}>
                                  {format(date, "MMM")}
                                </span>
                                <div className={`h-1.5 w-1.5 rounded-full mt-1 transition-colors ${
                                  isSelected
                                    ? "bg-white/60"
                                    : isDayFull
                                    ? "bg-muted-foreground/30"
                                    : "bg-emerald-400"
                                }`} />
                                {isDayFull && (
                                  <span className="absolute -top-1.5 -right-1.5 text-xs font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                                    FULL
                                  </span>
                                )}
                              </button>
                            </TooltipTrigger>
                            {isDayFull && <TooltipContent><p>Fully booked</p></TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>

              {/* Calendar picker */}
              <div className="shrink-0 pb-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-14 w-12 sm:h-[4.5rem] sm:w-14 rounded-2xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                      data-testid="button-calendar-picker"
                    >
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl shadow-2xl border-border/50" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={d => {
                        if (d) { setSelectedDate(d); setShowSlots(false); setIsDetailsOpen(true); }
                      }}
                      disabled={d => d < startOfToday()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Hint */}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50" />
              Tap any date to see available time slots
            </p>
          </div>
        )}
      </div>

      {/* ── BOOKING PANEL (Sheet on mobile, Dialog on desktop) ── */}
      <BookingShell
        open={isDetailsOpen}
        onOpenChange={open => { if (!open) resetForm(); else setIsDetailsOpen(open); }}
        isMobile={isMobile}
      >

          {/* Neon accent bar */}
          <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent shrink-0" />

          {step === "success" ? (
            /* ── SUCCESS STATE ─────────────────────────── */
            <div className="flex flex-col items-center px-6 py-10 gap-5 text-center">
              {/* Animated check */}
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-emerald-400/20 to-accent/20 blur-xl animate-pulse" />
                <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
              </div>

              <DialogHeader className="space-y-1">
                <DialogTitle className="text-2xl font-extrabold tracking-tight">
                  {bookingPath === "pay" ? "Slot Confirmed!" : "Booking Submitted!"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  {bookingPath === "pay"
                    ? "Payment of ₹1 received. Your slot is reserved — pay the consultation fee at the clinic."
                    : "Your request has been sent to the clinic. You'll get a confirmation once they approve it."}
                </DialogDescription>
              </DialogHeader>

              {/* Booking summary card */}
              <div className="w-full rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking Summary</span>
                  {bookingPath === "pay" && (
                    <span className="ml-auto text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-400/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CreditCard className="h-2.5 w-2.5" /> ₹1 Paid
                    </span>
                  )}
                  {bookingPath === "pending" && (
                    <span className="ml-auto text-xs font-bold bg-amber-500/15 text-amber-600 border border-amber-400/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ClipboardCheck className="h-2.5 w-2.5" /> Pending Approval
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{customerName}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{selectedClinic}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-3 w-3 text-emerald-500" />
                    </div>
                    <span className="text-sm font-medium">{format(selectedDate, "EEEE, MMM d, yyyy")}</span>
                  </div>
                  {selectedSlotInfo && (
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <div className="h-6 w-6 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                        <Clock className="h-3 w-3 text-sky-500" />
                      </div>
                      <span className="text-sm font-medium">
                        {selectedSlotInfo.label} · {formatTime(selectedSlotInfo.startHour, selectedSlotInfo.startMinute)} – {formatTime(selectedSlotInfo.endHour, selectedSlotInfo.endMinute)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={resetForm}
                className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                data-testid="button-done"
              >
                Done
              </Button>
            </div>

          ) : (
            <>
              {/* ── DIALOG HERO HEADER ─────────────────────── */}
              <div className="relative bg-foreground dark:bg-background px-5 pt-5 pb-4 shrink-0 overflow-hidden">
                {/* Glow blobs */}
                <div className="absolute -top-20 -left-10 w-[260px] h-[260px] rounded-full bg-primary/20 blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-16 -right-10 w-[200px] h-[200px] rounded-full bg-primary/10 blur-[60px] pointer-events-none" />
                {/* Grid texture */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.04]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />
                <div className="relative">
                  {/* Step pills */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                      !showSlots
                        ? "bg-white/20 border-white/30 text-white"
                        : "bg-white/8 border-white/15 text-white/45"
                    }`}>
                      <span className="h-3.5 w-3.5 rounded-full bg-white/30 flex items-center justify-center text-xs font-black">1</span>
                      Your Details
                    </div>
                    <div className="h-px w-4 bg-white/20" />
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                      showSlots && !showReview
                        ? "bg-white/20 border-white/30 text-white"
                        : "bg-white/8 border-white/15 text-white/45"
                    }`}>
                      <span className="h-3.5 w-3.5 rounded-full bg-white/30 flex items-center justify-center text-xs font-black">2</span>
                      Pick a Slot
                    </div>
                    <div className="h-px w-4 bg-white/20" />
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                      showReview
                        ? "bg-white/20 border-white/30 text-white"
                        : "bg-white/8 border-white/15 text-white/45"
                    }`}>
                      <span className="h-3.5 w-3.5 rounded-full bg-white/30 flex items-center justify-center text-xs font-black">3</span>
                      Review
                    </div>
                  </div>
                  <p className="text-xs text-white/40 mb-2">Quick booking · 3 steps · about 90 seconds</p>

                  <DialogTitle className="text-white font-extrabold text-xl leading-tight">
                    {format(selectedDate, "EEEE, MMMM d")}
                  </DialogTitle>
                  <p className="text-white/55 text-xs mt-1 flex items-center gap-1">
                    <Building2 className="h-2.5 w-2.5" /> {selectedClinic}
                  </p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
              </div>

              {/* ── DIALOG BODY ─────────────────────────────── */}
              <div ref={dialogBodyRef} className="overflow-y-auto flex-1 p-5">
                {!showSlots ? (
                  /* STEP 1: Patient details */
                  <div className="space-y-4">

                    {emailVerified && !isEditingDetails ? (
                      <> {/* ─── Verified summary + patient picker ─── */}
                      {!profilesFetched && (
                        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border border-border/50 bg-muted/30 animate-in fade-in duration-200" data-testid="section-profiles-loading">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                          </div>
                          <p className="text-xs text-muted-foreground">Checking records…</p>
                        </div>
                      )}
                      {profilesFetched && patientProfiles.length === 0 && (
                      <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 animate-in fade-in duration-300" data-testid="section-patient-summary">
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-foreground leading-tight">{customerName}</p>
                            <button
                              type="button"
                              onClick={() => setIsEditingDetails(true)}
                              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors shrink-0 flex items-center gap-1"
                              data-testid="button-edit-details"
                            >
                              ✏ Edit
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {customerAge} yrs · {customerGender ? customerGender.charAt(0).toUpperCase() + customerGender.slice(1) : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">{customerPhone}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{customerEmail}</span>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">✓ verified</span>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* ── Patient profile picker — always visible when profiles exist ── */}
                      {patientProfiles.length > 0 && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="mb-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                              <p className="text-xs font-bold text-foreground">Who is this appointment for?</p>
                            </div>
                            <p className="text-xs text-muted-foreground pl-5">Pick one from the list or select the one you already added</p>
                          </div>
                          <Popover open={isPatientDropdownOpen} onOpenChange={setIsPatientDropdownOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                data-testid="btn-patient-dropdown-trigger"
                                onClick={() => setDropdownHighlighted(false)}
                                className={`w-full flex items-center justify-between gap-2 px-3 h-11 rounded-xl border bg-muted/20 hover:border-primary/40 hover:bg-primary/5 transition-all ${
                                  selectedProfileId !== null
                                    ? "border-primary/40 bg-primary/5"
                                    : dropdownHighlighted
                                    ? "border-amber-400 ring-2 ring-amber-400/40 animate-pulse"
                                    : "border-border/60"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {selectedProfileId === null ? (
                                    <>
                                      <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="text-sm text-muted-foreground truncate">Select patient…</span>
                                    </>
                                  ) : selectedProfileId === 'new' ? (
                                    <>
                                      <div className="h-6 w-6 rounded-md bg-muted border border-border/50 flex items-center justify-center shrink-0">
                                        <Plus className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                      <span className="text-sm font-medium text-foreground truncate">{customerName || "New patient"}</span>
                                      <span className="text-[9px] font-bold bg-primary/15 text-primary border border-primary/25 px-1.5 py-0.5 rounded-full uppercase tracking-wide leading-none shrink-0">NEW</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="h-6 w-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 font-bold text-primary text-xs">
                                        {(patientProfiles.find((p: any) => p.id === selectedProfileId)?.name || "?").charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm font-medium text-foreground truncate">
                                        {patientProfiles.find((p: any) => p.id === selectedProfileId)?.name}
                                      </span>
                                      {patientProfiles.find((p: any) => p.id === selectedProfileId)?.patientCode && (
                                        <span className="font-mono text-xs bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded shrink-0">
                                          {patientProfiles.find((p: any) => p.id === selectedProfileId)?.patientCode}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isPatientDropdownOpen ? "rotate-180" : ""}`} />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              sideOffset={4}
                              className="p-1 rounded-xl shadow-xl border-border/60"
                              style={{ width: "var(--radix-popover-trigger-width)" }}
                            >
                              {patientProfiles.map((p: any) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  data-testid={`btn-select-patient-${p.id}`}
                                  onClick={() => {
                                    if (selectedProfileId === null || selectedProfileId === 'new') {
                                      setNewPatientSnapshot({ name: customerName, phone: customerPhone, age: customerAge, gender: customerGender });
                                    }
                                    setSelectedProfileId(p.id);
                                    setCustomerName(p.name || "");
                                    if (p.phone) setCustomerPhone(p.phone);
                                    if (p.age) setCustomerAge(String(p.age));
                                    if (p.gender) setCustomerGender(p.gender as any);
                                    setIsPatientDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-primary/8 active:bg-primary/12 transition-all text-left"
                                >
                                  <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
                                    {(p.name || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold leading-tight truncate">{p.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                      {p.patientCode && <span className="font-mono">{p.patientCode}</span>}
                                      {p.age && <span> · {p.age}y</span>}
                                      {p.gender && <span> · {p.gender}</span>}
                                      {p.visitCount != null && <span className="text-primary/70"> · Visit #{p.visitCount + 1}</span>}
                                    </p>
                                  </div>
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                </button>
                              ))}
                              <div className="h-px bg-border/50 mx-2 my-1" />
                              <button
                                type="button"
                                data-testid="btn-select-patient-new"
                                onClick={() => {
                                  if (newPatientSnapshot) {
                                    setCustomerName(newPatientSnapshot.name);
                                    setCustomerPhone(newPatientSnapshot.phone);
                                    setCustomerAge(newPatientSnapshot.age);
                                    setCustomerGender(newPatientSnapshot.gender);
                                  }
                                  setSelectedProfileId('new');
                                  setIsPatientDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-primary/8 active:bg-primary/12 transition-all text-left"
                              >
                                <div className="h-8 w-8 rounded-lg bg-muted border border-border/50 flex items-center justify-center shrink-0">
                                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-semibold leading-tight">{newPatientSnapshot?.name || customerName || "New patient"}</p>
                                    <span className="text-[9px] font-bold bg-primary/15 text-primary border border-primary/25 px-1.5 py-0.5 rounded-full uppercase tracking-wide leading-none">NEW</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <p className="text-xs text-muted-foreground">Continue with the details you entered</p>
                                    <button
                                      type="button"
                                      data-testid="btn-new-patient-edit-details"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setSelectedProfileId('new');
                                        setIsPatientDropdownOpen(false);
                                        setIsEditingDetails(true);
                                      }}
                                      className="text-xs font-semibold text-primary hover:text-accent underline underline-offset-2 transition-colors leading-none"
                                    >
                                      Edit details
                                    </button>
                                  </div>
                                </div>
                              </button>
                            </PopoverContent>
                          </Popover>
                          {selectedProfileId === 'new' && (
                            <div className="mt-3 flex items-start gap-3 p-3.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 animate-in fade-in duration-300">
                              <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-bold text-foreground leading-tight">{customerName}</p>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingDetails(true)}
                                    className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors shrink-0 flex items-center gap-1"
                                    data-testid="button-edit-new-patient"
                                  >
                                    ✏ Edit
                                  </button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {customerAge} yrs · {customerGender ? customerGender.charAt(0).toUpperCase() + customerGender.slice(1) : ""}
                                </p>
                                <p className="text-xs text-muted-foreground">{customerPhone}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs text-muted-foreground">{customerEmail}</span>
                                  <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">✓ verified</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      </>

                    ) : (
                    <>

                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">What's your name? <span className="text-destructive">*</span></label>
                      <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                        <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <input
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder="e.g. Rahul Verma"
                          onFocus={e => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" })}
                          className="flex-1 h-10 bg-transparent pl-3 pr-3 text-sm outline-none"
                          data-testid="input-name"
                        />
                      </div>
                    </div>

                    {/* Age & Gender — mandatory */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Age &amp; Gender <span className="text-destructive">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden w-28 shrink-0">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={120}
                            value={customerAge}
                            onChange={e => setCustomerAge(e.target.value)}
                            placeholder="Age"
                            onFocus={e => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" })}
                            className="w-full h-10 bg-transparent pl-3 pr-2 text-sm outline-none"
                            data-testid="input-age"
                          />
                          <span className="text-xs text-muted-foreground pr-3 shrink-0">yrs</span>
                        </div>
                        <div className="flex gap-1.5 flex-1">
                          {(["male", "female", "other"] as const).map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setCustomerGender(prev => prev === g ? undefined : g)}
                              data-testid={`btn-gender-${g}`}
                              className={`flex-1 h-10 rounded-xl border text-xs font-semibold capitalize transition-all ${
                                customerGender === g
                                  ? "bg-primary text-white border-primary shadow-sm shadow-primary/25"
                                  : "border-border/60 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              }`}
                            >
                              {g === "male" ? "♂ Male" : g === "female" ? "♀ Female" : "Other"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Best number to reach you? <span className="text-destructive">*</span></label>
                      <div className={`flex items-center rounded-xl border bg-muted/20 focus-within:bg-background focus-within:ring-2 transition-all overflow-hidden ${
                        phoneError ? "border-destructive focus-within:ring-destructive/10 focus-within:border-destructive" : "border-border/60 focus-within:border-primary/50 focus-within:ring-primary/10"
                      }`}>
                        <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={e => handlePhoneChange(e.target.value)}
                          placeholder="+91 9876543210"
                          onFocus={e => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" })}
                          className="flex-1 h-10 bg-transparent pl-3 pr-3 text-sm outline-none"
                          data-testid="input-phone"
                        />
                      </div>
                      {phoneError && (
                        <p className="text-xs text-destructive">{phoneError}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Your email address <span className="text-destructive">*</span></label>
                      {isEditingDetails && emailVerified ? (
                        /* ── Locked email row when editing other details ── */
                        <div className="flex items-center rounded-xl border border-emerald-400/30 bg-emerald-500/8 overflow-hidden">
                          <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-emerald-400/20 bg-emerald-500/10">
                            <Lock className="h-3.5 w-3.5 text-emerald-600" />
                          </div>
                          <span className="flex-1 px-3 text-sm text-foreground font-medium truncate">{customerEmail}</span>
                          <span className="mr-3 text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">✓ verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                          <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <input
                            type="email"
                            value={customerEmail}
                            onChange={e => handleEmailChange(e.target.value)}
                            placeholder="you@example.com"
                            onFocus={e => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" })}
                            className="flex-1 h-10 bg-transparent pl-3 pr-3 text-sm outline-none"
                            data-testid="input-email"
                          />
                        </div>
                      )}
                      {isEditingDetails && emailVerified && (
                        <button
                          type="button"
                          onClick={() => { resetOtpState(); setIsEditingDetails(false); }}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 mt-0.5"
                          data-testid="button-change-email"
                        >
                          <Mail className="h-3 w-3" /> Change email address (requires new verification)
                        </button>
                      )}
                    </div>

                    {/* Verification block — only appears once a valid email is entered and not in edit mode */}
                    {isEmailValid && !isEditingDetails && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">

                        {/* Contextual hint — shown only before OTP is sent */}
                        {!emailVerified && !otpSent && (
                          <div className="flex items-center gap-2 px-1">
                            <Shield className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              We'll verify your email before showing available slots — takes 30 seconds
                            </p>

                          </div>
                        )}

                        <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                          emailVerified
                            ? "border-emerald-400/30 bg-emerald-500/10 shadow-sm shadow-emerald-500/10"
                            : otpSent
                            ? "border-primary/20 bg-card shadow-lg shadow-primary/10"
                            : "border-border/60 bg-muted/20"
                        }`}>
                          {emailVerified ? (
                            <div className="flex items-center gap-3 p-3 text-emerald-600 animate-in fade-in slide-in-from-top-1 duration-300" data-testid="status-email-verified">
                              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
                                <CheckCircle2 className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold">Email verified</p>
                                <p className="text-xs text-emerald-700/80">You can now view slots and complete your booking.</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              {!otpSent && (
                                <div className="p-4 space-y-3">
                                  <div className="flex items-start gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                      <Shield className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0 pt-0.5">
                                      <p className="text-sm font-bold text-foreground">Verify your email</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">We'll send a 6-digit code to confirm</p>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    onClick={handleSendOtp}
                                    disabled={!customerName || !isAgeValid || !customerGender || !isPhoneValid || !isEmailValid || sendOtpMutation.isPending}
                                    className="w-full h-10 text-xs font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 rounded-xl shadow-md shadow-primary/15"
                                    data-testid="button-send-otp"
                                  >
                                    {sendOtpMutation.isPending ? (
                                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending Code…</>
                                    ) : (
                                      "Send Verification Code"
                                    )}
                                  </Button>
                                </div>
                              )}
                              {otpSent && (
                                <div className="p-4 animate-in fade-in slide-in-from-top-2 duration-300" data-testid="section-otp-verification">
                                  <div className="flex items-center justify-between gap-3 mb-4">
                                    <div>
                                      <p className="text-sm font-bold text-foreground">Verify your email</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">Enter the code we sent to your email</p>
                                    </div>
                                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                      {verifyOtpMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                      ) : (
                                        <Shield className="h-4 w-4 text-primary" />
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 sm:gap-1.5">
                                    {otpDigits.map((digit, index) => (
                                      <input
                                        key={index}
                                        ref={node => {
                                          otpInputRefs.current[index] = node;
                                        }}
                                        value={digit}
                                        onChange={e => handleOtpDigitChange(index, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(index, e)}
                                        onPaste={handleOtpPaste}
                                        inputMode="numeric"
                                        maxLength={1}
                                        disabled={verifyOtpMutation.isPending}
                                        className={`h-11 w-9 sm:h-12 sm:w-11 rounded-xl border text-center text-lg sm:text-xl font-bold outline-none transition-all duration-200 shadow-sm ${
                                          digit
                                            ? "border-primary/35 bg-primary/8 text-foreground shadow-primary/10"
                                            : "border-border/60 bg-background text-foreground"
                                        } focus:border-primary/70 focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-primary/15 focus:shadow-lg focus:shadow-primary/15 disabled:opacity-60`}
                                        data-testid={`input-otp-digit-${index}`}
                                        aria-label={`OTP digit ${index + 1}`}
                                      />
                                    ))}
                                    <button
                                      type="button"
                                      onClick={handleVerifyOtp}
                                      disabled={!isOtpComplete || verifyOtpMutation.isPending}
                                      className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl border flex items-center justify-center transition-all duration-200 shrink-0 ${
                                        isOtpComplete
                                          ? "border-emerald-400/50 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
                                          : "border-border/60 bg-muted/40 text-muted-foreground"
                                      } disabled:cursor-not-allowed disabled:opacity-60`}
                                      data-testid="button-verify-otp"
                                      aria-label="Verify OTP code"
                                    >
                                      {verifyOtpMutation.isPending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-5 w-5" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                    {resendCountdown > 0 ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                        <span data-testid="text-resend-countdown">Resend code in 0:{resendCountdown.toString().padStart(2, "0")}</span>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        disabled={sendOtpMutation.isPending}
                                        className="font-bold text-primary hover:text-accent transition-colors disabled:opacity-60"
                                        data-testid="button-resend-otp"
                                      >
                                        {sendOtpMutation.isPending ? "Sending…" : "Resend code"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                              {otpError && (
                                <p className="px-4 pb-3 text-xs text-destructive animate-in fade-in duration-200" data-testid="text-otp-error">{otpError}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Done editing button — only shown when editing details */}
                    {isEditingDetails && emailVerified && (
                      <button
                        type="button"
                        onClick={() => setIsEditingDetails(false)}
                        className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-xs font-bold hover:from-primary/90 hover:to-accent/90 shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-1.5"
                        data-testid="button-done-editing"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Save Changes
                      </button>
                    )}
                    </>
                    )}

                    {/* Chief complaints + Additional Notes — revealed after email verify + patient selected */}
                    {emailVerified && !isEditingDetails && profilesFetched && (patientProfiles.length === 0 || selectedProfileId !== null) && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-400">

                        {/* Chief complaints — accordion */}
                        <div className="space-y-2">

                          {/* Section heading */}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-foreground">
                                What brings you in today? <span className="text-destructive">*</span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Stethoscope className="h-3 w-3 text-primary/60 shrink-0" />
                                Tap a category below to expand it, then select your symptom(s)
                              </p>
                            </div>
                            {selectedSubIssues.length > 0 && (
                              <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0 ml-2">
                                {selectedSubIssues.length} selected
                              </span>
                            )}
                          </div>

                          {/* ── Chip summary view (when issues are selected and accordion is collapsed) ── */}
                          {selectedSubIssues.length > 0 && !isAccordionExpanded ? (
                            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 animate-in fade-in duration-200">
                              <div className="flex items-start gap-2">
                                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                  {selectedSubIssues.map(issue => (
                                    <span
                                      key={issue}
                                      className="inline-flex items-center gap-1 text-xs font-medium bg-primary/15 border border-primary/30 text-primary px-2 py-1 rounded-full"
                                    >
                                      <span className="text-emerald-600">✓</span> {issue}
                                    </span>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setIsAccordionExpanded(true)}
                                  className="shrink-0 h-8 w-8 rounded-lg bg-background border border-border/60 hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center text-muted-foreground hover:text-primary transition-all"
                                  title="Edit symptom selection"
                                  data-testid="button-edit-symptoms"
                                >
                                  ✏
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Full accordion picker ── */
                            <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                              selectedSubIssues.length > 0 ? "border-primary/30" : "border-border/60"
                            }`}>
                              <Accordion
                                type="single"
                                collapsible
                                value={openCategory}
                                onValueChange={val => {
                                  setOpenCategory(val);
                                  if (val) {
                                    setTimeout(() => {
                                      accordionItemRefs.current[val]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                    }, 150);
                                  }
                                }}
                                className="divide-y divide-border/40"
                              >
                                {(showAllCategories ? DENTAL_CATEGORIES : DENTAL_CATEGORIES.slice(0, 4)).map((cat) => {
                                  const count = countForCategory(cat);
                                  return (
                                    <AccordionItem key={cat.category} value={cat.category} className="border-0" ref={el => { accordionItemRefs.current[cat.category] = el; }}>
                                      <AccordionTrigger
                                        className="px-3 py-2.5 hover:no-underline hover:bg-muted/30 transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-muted-foreground"
                                        data-testid={`accordion-${cat.category}`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <cat.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                          <span className="text-xs font-semibold text-foreground text-left leading-tight">{cat.category}</span>
                                          {count > 0 && (
                                            <span className="shrink-0 text-xs font-bold text-primary bg-primary/12 border border-primary/25 px-1.5 py-0.5 rounded-full">
                                              {count}
                                            </span>
                                          )}
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent className="px-3 pb-3 pt-0">
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                          {cat.subIssues.map(issue => {
                                            const isOn = selectedSubIssues.includes(issue);
                                            return (
                                              <button
                                                key={issue}
                                                type="button"
                                                onClick={() => handleSubIssueToggle(issue)}
                                                className={`text-xs font-medium px-3 py-2.5 min-h-[44px] rounded-lg border transition-all ${
                                                  isOn
                                                    ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                                                    : "bg-background border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                                }`}
                                                data-testid={`chip-subissue-${issue}`}
                                              >
                                                {isOn && <span className="mr-1">✓</span>}{issue}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  );
                                })}
                              </Accordion>
                              {!showAllCategories && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllCategories(true)}
                                  className="w-full py-2.5 text-xs font-semibold text-primary hover:text-accent transition-colors border-t border-border/40 bg-muted/10 hover:bg-muted/30"
                                  data-testid="button-show-more-categories"
                                >
                                  Show {DENTAL_CATEGORIES.length - 4} more categories ↓
                                </button>
                              )}
                              {/* Done selecting — collapses to chip view */}
                              {selectedSubIssues.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => { setIsAccordionExpanded(false); setOpenCategory(""); }}
                                  className="w-full py-2.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors border-t border-emerald-400/30 bg-emerald-500/8 hover:bg-emerald-500/15 flex items-center justify-center gap-1.5"
                                  data-testid="button-done-selecting"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Done selecting · {selectedSubIssues.length} symptom{selectedSubIssues.length !== 1 ? "s" : ""} chosen
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Additional Notes (optional) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Additional notes</label>
                            <span className="text-xs font-medium text-muted-foreground/60 bg-muted/60 border border-border/40 px-1.5 py-0.5 rounded-full">Optional</span>
                          </div>
                          <textarea
                            value={additionalNotes}
                            onChange={e => setAdditionalNotes(e.target.value)}
                            placeholder="e.g. Allergies, previous treatments, other concerns…"
                            rows={2}
                            className="w-full rounded-xl border border-border/60 bg-muted/20 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10 px-3 py-2.5 text-sm outline-none resize-none transition-all"
                            data-testid="textarea-additional-notes"
                          />
                        </div>

                      </div>
                    )}

                    {/* CTA */}
                    <div className="relative">
                      {canProceedToSlots && (
                        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/50 to-accent/50 blur-sm animate-pulse pointer-events-none" />
                      )}
                      <Button
                        onClick={() => { setShowSlots(true); setTimeout(() => dialogBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50); }}
                        disabled={!canProceedToSlots}
                        className={`relative w-full h-12 font-bold rounded-xl border-0 transition-all duration-300 flex items-center justify-center gap-2 ${
                          canProceedToSlots
                            ? "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-lg shadow-primary/30"
                            : "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
                        }`}
                        data-testid="button-check-slots"
                      >
                        {canProceedToSlots ? (
                          <>View Available Slots <span aria-hidden>→</span></>
                        ) : emailVerified ? (
                          <>
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                            {!customerName
                              ? "Enter your name first"
                              : !isAgeValid || !customerGender
                              ? "Enter your age and select a gender"
                              : !isPhoneValid
                              ? "Enter a valid phone number"
                              : "Select a reason for your visit"}
                          </>
                        ) : (
                          <><Lock className="h-3.5 w-3.5 shrink-0" /> Verify email to continue</>
                        )}
                      </Button>
                    </div>
                  </div>

                ) : (
                  /* STEP 2 / 3: Slot selection or Review */
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold">
                        {showReview ? "Review Booking" : "Select a Time Slot"}
                      </h3>
                      <button
                        onClick={() => showReview ? setShowReview(false) : setShowSlots(false)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                    </div>

                    {showReview && selectedSlot ? (
                      /* ─── Booking Review Screen ─── */
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="text-center space-y-0.5 pb-1">
                          <p className="text-sm font-bold text-foreground">Review your booking</p>
                          <p className="text-xs text-muted-foreground">Double-check everything before confirming</p>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                          {/* Patient */}
                          <div className="px-4 py-3 space-y-0.5">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Patient</p>
                            <p className="text-sm font-bold text-foreground">{customerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {customerAge} yrs · {customerGender ? customerGender.charAt(0).toUpperCase() + customerGender.slice(1) : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">{customerPhone} · {customerEmail}</p>
                          </div>
                          {/* Appointment */}
                          {(() => {
                            const reviewSlot = slotTimings.find(s => s.id === selectedSlot);
                            return reviewSlot ? (
                              <div className="px-4 py-3 space-y-0.5">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Appointment</p>
                                <p className="text-sm font-bold text-foreground">{format(selectedDate, "EEEE, d MMMM yyyy")}</p>
                                <p className="text-xs text-muted-foreground">
                                  {reviewSlot.label} · {formatTime(reviewSlot.startHour, reviewSlot.startMinute)}–{formatTime(reviewSlot.endHour, reviewSlot.endMinute)}
                                </p>
                                <p className="text-xs text-muted-foreground">{selectedClinic}</p>
                              </div>
                            ) : null;
                          })()}
                          {/* Reason */}
                          <div className="px-4 py-3 space-y-1.5">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Reason for visit</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedSubIssues.map(issue => (
                                <span key={issue} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">{issue}</span>
                              ))}
                            </div>
                            {additionalNotes && (
                              <p className="text-xs text-muted-foreground italic">"{additionalNotes}"</p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => setShowReview(false)}
                            className="flex-1 h-11 rounded-xl border border-border/60 bg-muted/20 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-all"
                            data-testid="button-review-back"
                          >
                            ← Go back
                          </button>
                          <button
                            type="button"
                            disabled={paymentLoading || createBookingMutation.isPending}
                            onClick={() => { if (pendingBookingPath === "pay") handlePayAndConfirm(); else handleBook(); }}
                            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-bold shadow-md shadow-primary/20 hover:from-primary/90 hover:to-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="button-review-confirm"
                          >
                            {paymentLoading || createBookingMutation.isPending ? (
                              <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</span>
                            ) : pendingBookingPath === "pay" ? "Pay ₹1 & Confirm →" : "Confirm Booking →"}
                          </button>
                        </div>
                      </div>
                    ) : (
                    <>

                    {/* ── Doctor on-leave soft warning ── */}
                    {isRealClinic && clinicAvailability && !clinicAvailability.hasAnyAvailable && (
                      <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-400/30 bg-amber-500/8 animate-in fade-in duration-300">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-400/25 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-amber-700">All doctors on leave today</p>
                          <p className="text-xs text-amber-600/80 mt-0.5 leading-relaxed">
                            All {clinicAvailability.totalDoctors} doctor{clinicAvailability.totalDoctors !== 1 ? "s" : ""} at this clinic are on leave on {format(selectedDate, "MMM d")}. You can still book — the clinic will manage your appointment.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Loading shimmer while fetching availability ── */}
                    {isRealClinic && slotAvailFetching && !slotAvailability && (
                      <div className="space-y-2">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="h-[72px] rounded-2xl border border-border/40 bg-muted/30 animate-pulse" />
                        ))}
                      </div>
                    )}

                    {slotTimings.map((slot, slotIdx) => {
                      const startTime = new Date(selectedDate);
                      startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                      const iso = startTime.toISOString();

                      let isSlotFull      = false;
                      let isSlotCancelled = false;
                      let maxBookings     = 3;
                      let currentCount    = 0;

                      if (selectedClinic === "Demo Smile Clinic") {
                        const storedConfigs = localStorage.getItem("demo_slot_configs");
                        const configs       = storedConfigs ? JSON.parse(storedConfigs) : {};
                        const config        = configs[iso];
                        maxBookings     = config?.maxBookings ?? 3;
                        isSlotCancelled = config?.isCancelled ?? false;
                        const storedBookings     = localStorage.getItem("demo_bookings_persistent");
                        const persistentBookings = storedBookings ? JSON.parse(storedBookings) : [];
                        currentCount = persistentBookings.filter((b: any) =>
                          new Date(b.slot.startTime).toISOString() === iso
                        ).length;
                        isSlotFull = currentCount >= maxBookings;
                      } else {
                        // Use live data from the public slot-availability API
                        const avail = slotAvailability?.find(a => a.slotIndex === slotIdx);
                        maxBookings     = avail?.max ?? 3;
                        isSlotCancelled = avail?.isCancelled ?? false;
                        currentCount    = avail?.count ?? 0;
                        isSlotFull      = avail ? avail.spotsLeft === 0 : false;
                      }

                      if (isSlotCancelled) return null;

                      const isSelected = selectedSlot === slot.id;
                      const { Icon, color, bg, border } = getSlotMeta(slot.startHour);
                      const spotsLeft = Math.max(0, maxBookings - currentCount);
                      const slotStartTime = new Date(selectedDate);
                      slotStartTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                      const isSlotPast = isAfter(new Date(), slotStartTime);
                      const isDisabled = isSlotFull || isSlotPast;

                      return (
                        <button
                          key={slot.id}
                          disabled={isDisabled}
                          onClick={() => !isDisabled && setSelectedSlot(slot.id)}
                          data-testid={`slot-button-${slot.id}`}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left relative overflow-hidden ${
                            isSelected
                              ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20 shadow-md shadow-primary/10"
                              : isDisabled
                              ? "bg-muted/30 border-border/40 opacity-50 cursor-not-allowed"
                              : "bg-card border-border/50 hover:border-primary/30 hover:bg-primary/4 hover:shadow-md"
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 pointer-events-none" />
                          )}
                          {/* Slot icon */}
                          <div className={`relative h-11 w-11 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
                            <Icon className={`h-5 w-5 ${color}`} />
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{slot.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(slot.startHour, slot.startMinute)} → {formatTime(slot.endHour, slot.endMinute)}
                            </p>
                          </div>
                          {/* Availability */}
                          <div className="shrink-0 text-right">
                            {isSlotPast ? (
                              <span className="text-[10px] font-bold bg-muted/60 text-muted-foreground border border-border/40 px-2 py-1 rounded-lg">Past</span>
                            ) : isSlotFull ? (
                              <span className="text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20 px-2 py-1 rounded-lg">FULL</span>
                            ) : (
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                                spotsLeft <= 1 ? "bg-amber-500/10 text-amber-600 border border-amber-400/20" : "bg-emerald-500/10 text-emerald-600 border border-emerald-400/20"
                              }`}>
                                {spotsLeft} left
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}

                    {/* ── ALL SLOTS FULL: inline calendar to change date ── */}
                    {(() => {
                      const allSlotsFull = isRealClinic && slotAvailability
                        ? slotAvailability.every(s => s.spotsLeft === 0 || s.isCancelled)
                        : false;
                      if (!allSlotsFull) return null;
                      return (
                        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 overflow-hidden animate-in fade-in duration-300">
                          <div className="flex items-center gap-2 px-4 py-3 border-b border-destructive/15 bg-destructive/8">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-destructive">No slots available on {format(selectedDate, "EEEE, MMM d")}</p>
                              <p className="text-[11px] text-destructive/70">Pick another date — your details and verification are saved.</p>
                            </div>
                          </div>
                          <div className="flex justify-center p-3">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={d => { if (d) { setSelectedDate(d); setSelectedSlot(null); } }}
                              disabled={d => d < startOfToday()}
                              initialFocus
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── TWO BOOKING OPTIONS ──────────────────────── */}
                    {selectedClinic !== "Demo Smile Clinic" && !(isRealClinic && slotAvailability?.every(s => s.spotsLeft === 0 || s.isCancelled)) && (
                      <div className="mt-3 space-y-2.5">
                        {/* Divider */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-border/50" />
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">Choose how to confirm</span>
                          <div className="flex-1 h-px bg-border/50" />
                        </div>

                        {/* Option 1: Pay & Confirm */}
                        <button
                          onClick={() => { setPendingBookingPath("pay"); setShowReview(true); }}
                          disabled={!selectedSlot || !emailVerified || !verifiedToken || paymentLoading || createBookingMutation.isPending}
                          data-testid="button-pay-confirm"
                          className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/8 to-accent/8 hover:from-primary/15 hover:to-accent/15 hover:border-primary/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left group"
                        >
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                            {paymentLoading
                              ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                              : <CreditCard className="h-5 w-5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground">Pay ₹1 &amp; Confirm Instantly</p>
                            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">Token fee only · Slot reserved immediately · Pay at clinic for treatment</p>
                            <p className="sm:hidden text-xs text-muted-foreground mt-0.5">Token fee · Pay at clinic</p>
                          </div>
                          <div className="shrink-0">
                            <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 px-2 py-1 rounded-lg">INSTANT</span>
                          </div>
                        </button>

                        {/* Option 2: Clinic Approval */}
                        <button
                          onClick={() => { setPendingBookingPath("pending"); setShowReview(true); }}
                          disabled={!selectedSlot || !emailVerified || !verifiedToken || createBookingMutation.isPending || paymentLoading}
                          data-testid="button-clinic-approval"
                          className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:bg-primary/4 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
                        >
                          <div className="h-11 w-11 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center shrink-0">
                            {createBookingMutation.isPending
                              ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                              : <ClipboardCheck className="h-5 w-5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground">Book with Clinic Approval</p>
                            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">Free · Clinic will confirm your slot · No payment now</p>
                            <p className="sm:hidden text-xs text-muted-foreground mt-0.5">Free · Awaiting approval</p>
                          </div>
                          <div className="shrink-0">
                            <span className="text-[10px] font-bold bg-muted text-muted-foreground border border-border/50 px-2 py-1 rounded-lg">FREE</span>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Demo clinic: single button */}
                    {selectedClinic === "Demo Smile Clinic" && (
                      <Button
                        onClick={() => { setPendingBookingPath("pending"); setShowReview(true); }}
                        disabled={!selectedSlot || !emailVerified || !verifiedToken || createBookingMutation.isPending}
                        className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl mt-2"
                        data-testid="button-confirm-booking"
                      >
                        {createBookingMutation.isPending
                          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming…</>
                          : "Confirm Booking"}
                      </Button>
                    )}

                    </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
      </BookingShell>

      <ClinicInfoSheet
        clinic={(infoClinic ?? selectedClinicObj) as any ?? null}
        open={isClinicSheetOpen}
        onOpenChange={(open) => { setIsClinicSheetOpen(open); if (!open) setInfoClinic(null); }}
        onContinueBooking={() => { setIsClinicSheetOpen(false); setInfoClinic(null); }}
      />
    </div>
  );
}
