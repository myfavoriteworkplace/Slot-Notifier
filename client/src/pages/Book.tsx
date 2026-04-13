import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CalendarDays, CheckCircle2, Building2, User, Phone, Mail,
  MapPin, Sun, Moon, Clock, Shield, Sparkles, Search, Stethoscope, X, ChevronDown,
  CreditCard, ClipboardCheck, Info,
} from "lucide-react";
import ClinicInfoSheet from "@/components/ClinicInfoSheet";
import type { Clinic, Slot } from "@shared/schema";
import { format, addDays, startOfToday, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SlotTiming {
  id: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

const DEFAULT_SLOT_TIMINGS: SlotTiming[] = [
  { id: "1", label: "Morning",   startHour: 9,  startMinute: 0, endHour: 12, endMinute: 0 },
  { id: "2", label: "Afternoon", startHour: 14, startMinute: 0, endHour: 16, endMinute: 0 },
  { id: "3", label: "Evening",   startHour: 16, startMinute: 0, endHour: 18, endMinute: 0 },
];

const CHIEF_COMPLAINTS = [
  "Toothache", "Cavities", "Sensitivity", "Swelling",
  "Bleeding", "Abscess", "Fracture", "Wisdom",
  "Infection", "Checkup",
];

const getSlotMeta = (startHour: number) => {
  if (startHour < 12) return { Icon: Sun,   color: "text-amber-500",  bg: "bg-amber-500/10",  border: "border-amber-400/30"  };
  if (startHour < 16) return { Icon: Clock, color: "text-sky-500",    bg: "bg-sky-500/10",    border: "border-sky-400/30"    };
  return              { Icon: Moon,  color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/30"   };
};

export default function Book(props: { params: { clinicId?: string } }) {
  const { toast } = useToast();
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
  const [description, setDescription]       = useState("");
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
  const razorpayScriptRef = useRef(false);

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
  const canProceedToSlots = Boolean(customerName && isPhoneValid && isEmailValid && selectedClinic && emailVerified && verifiedToken);

  const resetOtpState = () => {
    setOtpSent(false);
    setOtpCode("");
    setEmailVerified(false);
    setVerifiedToken("");
    setOtpError("");
    setResendCountdown(0);
  };

  const handleEmailChange = (value: string) => {
    setCustomerEmail(value);
    if (emailVerified || otpSent) resetOtpState();
  };

  const handleSendOtp = () => {
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

  // Countdown for OTP resend cooldown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleComplaintClick = (complaint: string) => {
    const current = description ? description.split(", ").filter(Boolean) : [];
    const updated = current.includes(complaint)
      ? current.filter(c => c !== complaint)
      : [...current, complaint];
    setDescription(updated.join(", "));
  };

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

  const { data: slots } = useQuery<Slot[]>({ queryKey: ["/api/slots"] });

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
      toast({ title: "Booking Submitted!", description: "Your request has been sent to the clinic for approval." });
    },
    onError: (error: any) => {
      toast({ title: "Booking Failed", description: error.message || "Failed to create booking", variant: "destructive" });
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/public/otp/send", { email });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send verification code");
      }
      return response.json();
    },
    onSuccess: () => {
      setOtpSent(true);
      setOtpError("");
      setResendCountdown(60);
      toast({ title: "Code Sent!", description: "Check your email for the 6-digit verification code." });
    },
    onError: (error: any) => {
      setOtpError(error.message || "Failed to send verification code. Please try again.");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await apiRequest("POST", "/api/public/otp/verify", { email, code });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Invalid or expired code");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setEmailVerified(true);
      setVerifiedToken(data.verifiedToken);
      setOtpError("");
      toast({ title: "Email Verified!", description: "You can now complete your booking." });
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
      toast({ title: "Email Verification Required", description: "Please verify your email before booking.", variant: "destructive" });
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
      toast({ title: "Booking Confirmed!", description: "Your appointment has been successfully booked (Demo)." });
      return;
    }

    const selectedClinicData = clinicsData?.find(c => c.name === selectedClinic);
    const clinicId = selectedClinicData?.id;
    if (!clinicId) {
      toast({ title: "Error", description: "Please select a valid clinic", variant: "destructive" });
      return;
    }
    createBookingMutation.mutate({
      customerName, customerPhone, customerEmail,
      clinicId, clinicName: selectedClinic,
      startTime: startTime.toISOString(), endTime: endTime.toISOString(), description,
      verifiedToken,
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
      toast({ title: "Email Verification Required", description: "Please verify your email before booking.", variant: "destructive" });
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
      toast({ title: "Error", description: "Please select a valid clinic", variant: "destructive" });
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
        theme: { color: "#6d28d9" },
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
              description,
              verifiedToken,
            });
            if (!verifyRes.ok) {
              const body = await verifyRes.json().catch(() => ({}));
              throw new Error(body.message || "Payment verification failed");
            }
            setBookingPath("pay");
            setStep("success");
            toast({ title: "Payment Successful!", description: "Your slot is confirmed." });
          } catch (err: any) {
            toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
          }
        },
        modal: {
          ondismiss: () => setPaymentLoading(false),
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", () => {
        setPaymentLoading(false);
        toast({ title: "Payment Failed", description: "Please try again or choose clinic approval.", variant: "destructive" });
      });
      rzp.open();
    } catch (err: any) {
      setPaymentLoading(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setIsDetailsOpen(false);
    setShowSlots(false);
    setSelectedSlot(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setDescription("");
    setPhoneError("");
    setPaymentLoading(false);
    setBookingPath(null);
    setStep("details");
    resetOtpState();
  };

  const selectedClinicObj = clinics.find(c => c.name === selectedClinic);
  const selectedSlotInfo  = slotTimings.find(s => s.id === selectedSlot);

  if (clinicsLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 blur-md animate-pulse" />
          <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <CalendarDays className="h-7 w-7 text-white" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading clinics…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-background overflow-x-hidden">

      {/* ── BACKGROUND GLOW BLOBS ─────────────────────── */}
      <div className="fixed top-0 right-0 w-[520px] h-[520px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/4 translate-x-1/4" />
      <div className="fixed bottom-0 left-0  w-[420px] h-[420px] bg-accent/5  rounded-full blur-3xl pointer-events-none  translate-y-1/4 -translate-x-1/4" />

      {/* ── HERO BANNER ──────────────────────────────────── */}
      <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 overflow-hidden">
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
        {/* decorative large icon */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.07] pointer-events-none select-none">
          <CalendarDays className="h-52 w-52 text-white" />
        </div>
        <div className="relative container mx-auto px-4 sm:px-6 py-10 sm:py-14 max-w-5xl">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/60 mb-3">
            <CalendarDays className="h-3 w-3" /> BookMySlot
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-2">
            Book Your <span className="text-white/85">Appointment</span>
          </h1>
          <p className="text-white/55 text-sm sm:text-base mb-7 max-w-md">
            Choose a clinic, pick a date, and confirm instantly — no account required.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { Icon: Clock,     label: "3 time slots daily"   },
              { Icon: Sparkles,  label: "Confirmed instantly"  },
              { Icon: Shield,    label: "No account needed"    },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur-sm">
                <Icon className="h-3 w-3" />
                {label}
              </div>
            ))}
          </div>
        </div>
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
                <p className="text-xs text-muted-foreground mt-0.5">Select from the list or search by location</p>
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
            <div className="flex gap-1.5 p-1 bg-muted/40 border border-border/50 rounded-xl mb-4 w-fit">
              {([
                { id: "select", Icon: Building2, label: "Select Clinic"       },
                { id: "search", Icon: MapPin,    label: "Search by Location"  },
              ] as const).map(({ id, Icon, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    setClinicMode(id);
                    setSearchQuery("");
                    setIsDropdownOpen(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    clinicMode === id
                      ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`mode-tab-${id}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
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
                  <div className={`flex items-center justify-center h-12 w-12 shrink-0 border-r border-border/40 transition-colors ${
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
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {clinics.length} clinic{clinics.length !== 1 ? "s" : ""} available
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
                                <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
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
                    className="flex-1 h-12 bg-transparent pl-3 pr-3 text-sm outline-none placeholder:text-muted-foreground"
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
                      <p className="text-sm font-semibold text-foreground/80">Search for a clinic</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Type a clinic name, city, pincode, or area to find nearby clinics</p>
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
                            <button
                              key={clinic.id}
                              onClick={() => setSelectedClinic(clinic.name)}
                              className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all hover:bg-primary/5 border-b border-border/30 last:border-0 ${
                                isSelected ? "bg-primary/8 border-l-2 border-l-primary pl-[10px]" : ""
                              }`}
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
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  {clinic.doctorName && <><Stethoscope className="h-2.5 w-2.5 shrink-0" />Dr. {clinic.doctorName} · </>}
                                  {[(clinic as any).city, clinic.address].filter(Boolean).join(", ")}
                                </p>
                              </div>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            </button>
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
            <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-5 py-4 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
              <div className="relative flex items-center gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-accent/40 to-primary/30 blur-sm" />
                  <div className="relative h-12 w-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center ring-1 ring-white/10">
                    <span className="text-xl font-black text-white">{selectedClinic.charAt(0)}</span>
                  </div>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-0.5">Booking At</p>
                  <p className="text-white font-extrabold text-lg leading-tight truncate">{selectedClinic}</p>
                  {selectedClinicObj?.doctorName && (
                    <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" />
                      Dr. {selectedClinicObj.doctorName}
                      {selectedClinicObj.doctorSpecialization ? ` · ${selectedClinicObj.doctorSpecialization}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsClinicSheetOpen(true)}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/10 hover:bg-white/25 text-white/70 hover:text-white text-[11px] font-semibold transition-all border border-white/15 hover:border-white/30"
                    data-testid="button-view-clinic-details"
                  >
                    <Info className="h-3 w-3" />
                    <span className="hidden sm:inline">Clinic Info</span>
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
          <div className="animate-in fade-in slide-in-from-top-2 duration-400">
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
                        isDayFull = slotTimings.every(slot => {
                          const slotTime = new Date(date);
                          slotTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                          const iso    = slotTime.toISOString();
                          const slotData = slots?.find(s =>
                            new Date(s.startTime).toISOString() === iso && s.clinicName === selectedClinic
                          );
                          if (slotData?.isCancelled) return true;
                          const max     = slotData?.maxBookings ?? 3;
                          const current = slots?.filter(s =>
                            new Date(s.startTime).toISOString() === iso && s.clinicName === selectedClinic && s.isBooked
                          ).length || 0;
                          return current >= max;
                        });
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
                                className={`flex flex-col items-center justify-center min-w-[4rem] h-[4.5rem] rounded-2xl border transition-all duration-200 relative ${
                                  isSelected
                                    ? "bg-gradient-to-b from-primary to-accent text-white border-primary shadow-lg shadow-primary/25 scale-105"
                                    : isDayFull
                                    ? "bg-destructive/8 border-destructive/20 text-destructive/60 cursor-not-allowed opacity-70"
                                    : "bg-card border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
                                }`}
                              >
                                <span className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                                  {format(date, "EEE")}
                                </span>
                                <span className="text-xl font-black leading-none">
                                  {format(date, "d")}
                                </span>
                                <span className={`text-[8px] mt-0.5 ${isSelected ? "text-white/50" : "text-muted-foreground/60"}`}>
                                  {format(date, "MMM")}
                                </span>
                                {isDayFull && (
                                  <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
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
                      className="h-[4.5rem] w-14 rounded-2xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
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
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50" />
              Tap a date to view available slots and book your appointment
            </p>
          </div>
        )}
      </div>

      {/* ── BOOKING DIALOG ────────────────────────────────── */}
      <Dialog open={isDetailsOpen} onOpenChange={open => { if (!open) resetForm(); else setIsDetailsOpen(open); }}>
        <DialogContent className="w-[95vw] sm:max-w-[460px] rounded-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">

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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Booking Summary</span>
                  {bookingPath === "pay" && (
                    <span className="ml-auto text-[9px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-400/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CreditCard className="h-2.5 w-2.5" /> ₹1 Paid
                    </span>
                  )}
                  {bookingPath === "pending" && (
                    <span className="ml-auto text-[9px] font-bold bg-amber-500/15 text-amber-600 border border-amber-400/25 px-2 py-0.5 rounded-full flex items-center gap-1">
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
              <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-5 pt-5 pb-4 shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                <div className="relative">
                  {/* Step pills */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      !showSlots
                        ? "bg-white/20 border-white/30 text-white"
                        : "bg-white/8 border-white/15 text-white/45"
                    }`}>
                      <span className="h-3.5 w-3.5 rounded-full bg-white/30 flex items-center justify-center text-[8px] font-black">1</span>
                      Your Details
                    </div>
                    <div className="h-px w-4 bg-white/20" />
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      showSlots
                        ? "bg-white/20 border-white/30 text-white"
                        : "bg-white/8 border-white/15 text-white/45"
                    }`}>
                      <span className="h-3.5 w-3.5 rounded-full bg-white/30 flex items-center justify-center text-[8px] font-black">2</span>
                      Pick a Slot
                    </div>
                  </div>

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
              <div className="overflow-y-auto flex-1 p-5">
                {!showSlots ? (
                  /* STEP 1: Patient details */
                  <div className="space-y-4">

                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                      <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                        <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <input
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder="Your full name"
                          className="flex-1 h-10 bg-transparent pl-3 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                          data-testid="input-name"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone Number</label>
                      <div className={`flex items-center rounded-xl border bg-muted/20 focus-within:bg-background focus-within:ring-2 transition-all overflow-hidden ${
                        phoneError ? "border-destructive focus-within:ring-destructive/10 focus-within:border-destructive" : "border-border/60 focus-within:border-primary/50 focus-within:ring-primary/10"
                      }`}>
                        <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <input
                          value={customerPhone}
                          onChange={e => handlePhoneChange(e.target.value)}
                          placeholder="+91 9876543210"
                          className="flex-1 h-10 bg-transparent pl-3 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                          data-testid="input-phone"
                        />
                      </div>
                      {phoneError && (
                        <p className="text-[11px] text-destructive">{phoneError}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
                      <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                        <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={e => handleEmailChange(e.target.value)}
                          placeholder="you@example.com"
                          className="flex-1 h-10 bg-transparent pl-3 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                          data-testid="input-email"
                        />
                      </div>
                      <div className={`rounded-xl border p-3 space-y-2.5 ${
                        emailVerified
                          ? "border-emerald-400/30 bg-emerald-500/10"
                          : "border-border/60 bg-muted/20"
                      }`}>
                        {emailVerified ? (
                          <div className="flex items-center gap-2 text-emerald-600" data-testid="status-email-verified">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs font-bold">Email verified</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                onClick={handleSendOtp}
                                disabled={!isEmailValid || sendOtpMutation.isPending || resendCountdown > 0}
                                className="h-9 px-3 text-xs font-bold bg-primary hover:bg-primary/90"
                                data-testid="button-send-otp"
                              >
                                {sendOtpMutation.isPending ? (
                                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending…</>
                                ) : resendCountdown > 0 ? (
                                  `Resend in ${resendCountdown}s`
                                ) : otpSent ? (
                                  "Resend Code"
                                ) : (
                                  "Send Verification Code"
                                )}
                              </Button>
                              {otpSent && (
                                <span className="text-[11px] text-muted-foreground" data-testid="text-otp-sent">
                                  Code sent to your email
                                </span>
                              )}
                            </div>
                            {otpSent && (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={otpCode}
                                  onChange={e => {
                                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                                    setOtpError("");
                                  }}
                                  inputMode="numeric"
                                  maxLength={6}
                                  placeholder="6-digit code"
                                  className="h-9 text-sm"
                                  data-testid="input-otp-code"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleVerifyOtp}
                                  disabled={otpCode.length !== 6 || verifyOtpMutation.isPending}
                                  className="h-9 px-3 text-xs font-bold shrink-0"
                                  data-testid="button-verify-otp"
                                >
                                  {verifyOtpMutation.isPending ? (
                                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Verifying…</>
                                  ) : (
                                    "Verify"
                                  )}
                                </Button>
                              </div>
                            )}
                            {otpError && (
                              <p className="text-[11px] text-destructive" data-testid="text-otp-error">{otpError}</p>
                            )}
                            {!otpSent && !otpError && (
                              <p className="text-[11px] text-muted-foreground" data-testid="text-email-verification-hint">
                                Verify your email to unlock available appointment slots.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Chief complaints */}
                    <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chief Complaints</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">Select all that apply</span>
                      </div>
                      <div className="p-3 flex flex-wrap gap-1.5">
                        {CHIEF_COMPLAINTS.map(complaint => {
                          const isOn = description.split(", ").includes(complaint);
                          return (
                            <button
                              key={complaint}
                              type="button"
                              onClick={() => handleComplaintClick(complaint)}
                              className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg border transition-all ${
                                isOn
                                  ? "bg-primary/15 border-primary/35 text-primary shadow-sm"
                                  : "bg-background border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                              }`}
                              data-testid={`chip-complaint-${complaint}`}
                            >
                              {complaint}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Additional Notes</label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe your issue in more detail…"
                        rows={3}
                        className="w-full rounded-xl border border-border/60 bg-muted/20 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground resize-none transition-all"
                        data-testid="textarea-description"
                      />
                    </div>

                    {/* CTA */}
                    <Button
                      onClick={() => setShowSlots(true)}
                      disabled={!canProceedToSlots}
                      className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                      data-testid="button-check-slots"
                    >
                      {emailVerified ? "View Available Slots →" : "Verify Email to View Slots"}
                    </Button>
                  </div>

                ) : (
                  /* STEP 2: Slot selection */
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold">Select a Time Slot</h3>
                      <button
                        onClick={() => setShowSlots(false)}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                    </div>

                    {slotTimings.map(slot => {
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
                        const slotData  = slots?.find(s => new Date(s.startTime).toISOString() === iso && s.clinicName === selectedClinic);
                        maxBookings     = slotData?.maxBookings ?? 3;
                        isSlotCancelled = slotData?.isCancelled ?? false;
                        currentCount    = slots?.filter(s => new Date(s.startTime).toISOString() === iso && s.clinicName === selectedClinic && s.isBooked).length || 0;
                        isSlotFull      = currentCount >= maxBookings;
                      }

                      if (isSlotCancelled) return null;

                      const isSelected = selectedSlot === slot.id;
                      const { Icon, color, bg, border } = getSlotMeta(slot.startHour);
                      const spotsLeft = Math.max(0, maxBookings - currentCount);

                      return (
                        <button
                          key={slot.id}
                          disabled={isSlotFull}
                          onClick={() => setSelectedSlot(slot.id)}
                          data-testid={`slot-button-${slot.id}`}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left relative overflow-hidden ${
                            isSelected
                              ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20 shadow-md shadow-primary/10"
                              : isSlotFull
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
                            {isSlotFull ? (
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

                    {/* ── TWO BOOKING OPTIONS ──────────────────────── */}
                    {selectedClinic !== "Demo Smile Clinic" && (
                      <div className="mt-3 space-y-2.5">
                        {/* Divider */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-border/50" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">Choose how to confirm</span>
                          <div className="flex-1 h-px bg-border/50" />
                        </div>

                        {/* Option 1: Pay & Confirm */}
                        <button
                          onClick={handlePayAndConfirm}
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
                            <p className="text-[11px] text-muted-foreground mt-0.5">Token fee only · Slot reserved immediately · Pay at clinic for treatment</p>
                          </div>
                          <div className="shrink-0">
                            <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 px-2 py-1 rounded-lg">INSTANT</span>
                          </div>
                        </button>

                        {/* Option 2: Clinic Approval */}
                        <button
                          onClick={handleBook}
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
                            <p className="text-[11px] text-muted-foreground mt-0.5">Free · Clinic will confirm your slot · No payment now</p>
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
                        onClick={handleBook}
                        disabled={!selectedSlot || !emailVerified || !verifiedToken || createBookingMutation.isPending}
                        className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl mt-2"
                        data-testid="button-confirm-booking"
                      >
                        {createBookingMutation.isPending
                          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming…</>
                          : "Confirm Booking"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ClinicInfoSheet
        clinic={selectedClinicObj as any ?? null}
        open={isClinicSheetOpen}
        onOpenChange={setIsClinicSheetOpen}
        onContinueBooking={() => setIsClinicSheetOpen(false)}
      />
    </div>
  );
}
