import QRCode from "react-qr-code";
import { ImageUpload } from "@/components/ImageUpload";
import MapLocationPicker from "@/components/MapLocationPicker";
import ExportDataPanel from "@/components/ExportDataPanel";
import { BookingNotesThread } from "@/components/BookingNotesThread";
import ClinicalRecordsTab from "@/components/ClinicalRecordsTab";
import { InventoryPanel } from "@/components/InventoryPanel";
import WebsiteConfigPanel from "@/components/WebsiteConfigPanel";
import { BillingHistoryPanel } from "@/components/BillingHistoryPanel";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Calendar as CalendarIcon, Phone, Clock, Building2, LogOut, X,
  Download, Plus, ChevronDown, ChevronUp, CheckCircle2, IndianRupee, FileText,
  User, Mail, CalendarDays, FlaskConical, Settings, TrendingUp, History, Filter, Copy, Check,
  Globe, Lock, ExternalLink, MapPin, Info, ClipboardCheck, PenLine, Link2, ClipboardList, Package, AlertTriangle, CreditCard
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { format, startOfDay, endOfDay, startOfToday, addDays, isSameDay, differenceInCalendarDays, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { SpecializationInput } from "@/components/SpecializationInput";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import type { Slot, Booking, PatientBill } from "@shared/schema";
import { Stethoscope, Trash2, GraduationCap, UserPlus, Upload, KeyRound } from "lucide-react";

interface SlotTiming {
  id: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

const DEFAULT_SLOT_TIMINGS: SlotTiming[] = [
  { id: "1", label: "Morning", startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
  { id: "2", label: "Afternoon", startHour: 14, startMinute: 0, endHour: 16, endMinute: 0 },
  { id: "3", label: "Evening", startHour: 16, startMinute: 0, endHour: 18, endMinute: 0 },
];

type BookingWithSlot = Booking & { 
  slot: Slot; 
  description?: string | null;
  assignedDoctor?: string | null;
  assignedDoctorEmail?: string | null;
  doctorApprovalStatus?: string | null;
  doctorNotes?: string | null;
  clinicalStatus?: string | null;
  clinicDoctors?: { name: string; specialization: string; degree: string }[];
};

export default function ClinicDashboard() {
  const { clinic, isLoading: authLoading, isAuthenticated, logout, isLoggingOut, refetch: refetchClinic } = useClinicAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const updateLogoMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      const response = await apiRequest('PATCH', '/api/auth/clinic/me', { logoUrl });
      if (!response.ok) throw new Error('Failed to update logo');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinic) refetchClinic();
      toast({ title: "Logo updated successfully" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { phone?: string; email?: string; website?: string; address?: string; city?: string; pincode?: string; doctorName?: string }) => {
      const response = await apiRequest('PATCH', '/api/auth/clinic/me', data);
      if (!response.ok) throw new Error('Failed to update clinic profile');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinic) refetchClinic();
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/me'] });
      toast({ title: "Profile updated", description: "Your clinic profile has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (clinic) {
      setProfilePhone(clinic.phone ?? "");
      setProfileEmail(clinic.email ?? "");
      setProfileWebsite(clinic.website ?? "");
      setProfileAddress(clinic.address ?? "");
      setProfileCity(clinic.city ?? "");
      setProfilePincode(clinic.pincode ?? "");
      setProfileDoctorName((clinic as any).doctorName ?? "");
      setProfileLatitude((clinic as any).latitude ?? null);
      setProfileLongitude((clinic as any).longitude ?? null);
    }
  }, [clinic]);

  const [filterDate, setFilterDate] = useState<Date | undefined>(new Date());
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(new Date());
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'upcoming' | 'past' | 'this-week' | 'next-week'>('all');
  const [copiedUrlType, setCopiedUrlType] = useState<'booking' | 'about' | null>(null);

  const copyClinicUrl = (type: 'booking' | 'about') => {
    if (!clinic?.id) return;
    const url = type === 'booking'
      ? `${window.location.origin}/book/${clinic.id}`
      : `${window.location.origin}/clinic/${clinic.username || clinic.id}`;
    navigator.clipboard.writeText(url);
    setCopiedUrlType(type);
    toast({ title: type === 'booking' ? "Booking URL copied" : "About URL copied" });
    setTimeout(() => setCopiedUrlType(null), 2000);
  };
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);

  // Modal tab state — keyed by booking id
  const [modalTabs, setModalTabs] = useState<Record<number, 'overview' | 'clinical' | 'notes' | 'actions' | 'billing'>>({});
  const getModalTab = (id: number) => modalTabs[id] ?? 'overview';
  const setModalTab = (id: number, tab: 'overview' | 'clinical' | 'notes' | 'actions' | 'billing') =>
    setModalTabs(prev => ({ ...prev, [id]: tab }));

  // Reschedule state
  const [rescheduleBookingId, setRescheduleBookingId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(startOfToday());
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [consentUrls, setConsentUrls] = useState<Record<number, string>>({});
  const [copiedConsentId, setCopiedConsentId] = useState<number | null>(null);

  // Booking form state
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'bookings' | 'configure-slots' | 'manage-doctors' | 'clinic-profile' | 'book-a-slot' | 'export-data' | 'inventory' | 'website' | 'accounts'>('bookings');
  const [accountsSearch, setAccountsSearch] = useState("");
  const [accountsStatusFilter, setAccountsStatusFilter] = useState<'all' | 'paid' | 'pending' | 'partial'>('all');

  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileWebsite, setProfileWebsite] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profilePincode, setProfilePincode] = useState("");
  const [profileDoctorName, setProfileDoctorName] = useState("");
  const [profileLatitude, setProfileLatitude] = useState<number | null>(null);
  const [profileLongitude, setProfileLongitude] = useState<number | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingDescription, setBookingDescription] = useState("");
  const [bookingDate, setBookingDate] = useState<Date>(startOfToday());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [slotTimings] = useState<SlotTiming[]>(DEFAULT_SLOT_TIMINGS);

  const CHIEF_COMPLAINTS = [
    "Toothache", "Cavities", "Sensitivity", "Swelling",
    "Bleeding", "Abscess", "Fracture", "Wisdom",
    "Infection", "Checkup"
  ];

  const handleComplaintClick = (complaint: string) => {
    const currentComplaints = bookingDescription ? bookingDescription.split(", ").filter(Boolean) : [];
    let newDescription = "";

    if (currentComplaints.includes(complaint)) {
      newDescription = currentComplaints.filter(c => c !== complaint).join(", ");
    } else {
      newDescription = [...currentComplaints, complaint].join(", ");
    }
    setBookingDescription(newDescription);
  };

  // Slot Configuration state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configDate, setConfigDate] = useState<Date>(startOfToday());
  const [configMaxBookings, setConfigMaxBookings] = useState(3);
  const [configIsCancelled, setConfigIsCancelled] = useState(false);

  // Doctor Management state
  const [isDoctorsOpen, setIsDoctorsOpen] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialization, setNewDoctorSpecialization] = useState("");
  const [newDoctorDegree, setNewDoctorDegree] = useState("");
  const [newDoctorEmail, setNewDoctorEmail] = useState("");
  const [newDoctorImageUrl, setNewDoctorImageUrl] = useState<string | null>(null);

  // Reset Doctor Password state
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdDoctorId, setResetPwdDoctorId] = useState<number | null>(null);
  const [resetPwdDoctorName, setResetPwdDoctorName] = useState("");
  const [resetPwdDoctorEmail, setResetPwdDoctorEmail] = useState("");
  const [resetPwdNew, setResetPwdNew] = useState("");
  const [resetPwdConfirm, setResetPwdConfirm] = useState("");

  // Fetch clinic doctors
  const { data: clinicData, refetch: refetchClinicData } = useQuery<{ doctors: { name: string; specialization: string; degree: string; email?: string; imageUrl?: string | null }[] }>({
    queryKey: ['/api/auth/clinic/me'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/me');
      if (!res.ok) throw new Error('Failed to fetch clinic');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch real linked doctor accounts (for reset password key icon)
  const { data: linkedDoctors = [] } = useQuery<{ id: number; name: string; email: string }[]>({
    queryKey: ['/api/auth/clinic/linked-doctors'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/linked-doctors');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // All clinic bills (for Accounts tab)
  const { data: allBills = [] } = useQuery<PatientBill[]>({
    queryKey: ['/api/auth/clinic/bills'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/bills');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const updateBillStatusMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: number; paymentStatus: string }) =>
      apiRequest('PATCH', `/api/auth/clinic/bills/${id}`, { paymentStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bills'] });
      toast({ title: 'Status updated', description: 'Bill payment status has been saved.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update bill status.', variant: 'destructive' }),
  });

  const addDoctorMutation = useMutation({
    mutationFn: async (data: { name: string; specialization: string; degree: string; email?: string; imageUrl?: string | null }) => {
      const response = await apiRequest('POST', '/api/auth/clinic/doctors', data);
      if (!response.ok) throw new Error('Failed to add doctor');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinicData) refetchClinicData();
      if (refetchClinic) refetchClinic();
      setNewDoctorName("");
      setNewDoctorSpecialization("");
      setNewDoctorDegree("");
      setNewDoctorEmail("");
      setNewDoctorImageUrl(null);
      toast({ title: "Doctor added successfully", description: "A welcome email with login credentials has been sent." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add doctor", description: error.message, variant: "destructive" });
    },
  });

  const resetDoctorPasswordMutation = useMutation({
    mutationFn: async ({ doctorId, newPassword }: { doctorId: number; newPassword: string }) => {
      const res = await apiRequest('POST', `/api/auth/clinic/doctors/${doctorId}/reset-password`, { newPassword });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset", description: "The doctor's password has been updated." });
      setResetPwdOpen(false);
      setResetPwdNew("");
      setResetPwdConfirm("");
    },
    onError: (e: any) => toast({ title: "Failed to reset password", description: e.message, variant: "destructive" }),
  });

  const removeDoctorMutation = useMutation({
    mutationFn: async (index: number) => {
      const response = await apiRequest('DELETE', `/api/auth/clinic/doctors/${index}`);
      if (!response.ok) throw new Error('Failed to remove doctor');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinicData) refetchClinicData();
      if (refetchClinic) refetchClinic();
      toast({ title: "Doctor removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove doctor", description: error.message, variant: "destructive" });
    },
  });

  const handleAddDoctor = () => {
    if (!newDoctorName || !newDoctorSpecialization || !newDoctorEmail) {
      toast({ title: "Please fill in name, specialization and email", variant: "destructive" });
      return;
    }
    addDoctorMutation.mutate({
      name: newDoctorName,
      specialization: newDoctorSpecialization,
      degree: newDoctorDegree,
      email: newDoctorEmail,
      imageUrl: newDoctorImageUrl
    });
  };

  const configureSlotMutation = useMutation({
    mutationFn: async (data: { startTime: string; maxBookings: number; isCancelled: boolean }) => {
      const response = await apiRequest('POST', '/api/auth/clinic/slots/configure', data);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Failed to update slot configuration (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinic/bookings'] });
      toast({ title: "Slot configuration updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update configuration", description: error.message, variant: "destructive" });
    },
  });

  const handleConfigureSlot = () => {
    if (!selectedSlot || !clinic) return;
    const slotInfo = slotTimings.find(s => s.id === selectedSlot);
    if (!slotInfo) return;

    const startTime = new Date(configDate);
    startTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);

    configureSlotMutation.mutate({
      startTime: startTime.toISOString(),
      maxBookings: configMaxBookings,
      isCancelled: configIsCancelled
    });
  };

  // Load existing configuration when slot or date changes
  useEffect(() => {
    if (localStorage.getItem("demo_clinic_active") === "true" && selectedSlot) {
      const slotInfo = slotTimings.find(s => s.id === selectedSlot);
      if (slotInfo) {
        const startTime = new Date(configDate);
        startTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
        const isoString = startTime.toISOString();

        const stored = localStorage.getItem("demo_slot_configs");
        const configs = stored ? JSON.parse(stored) : {};
        const config = configs[isoString];

        if (config) {
          setConfigMaxBookings(config.maxBookings);
          setConfigIsCancelled(config.isCancelled);
        } else {
          setConfigMaxBookings(3);
          setConfigIsCancelled(false);
        }
      }
    }
  }, [selectedSlot, configDate, slotTimings]);

  const validateIndianPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    const indiaRegex = /^(\+91|91)?[6-9]\d{9}$/;
    return indiaRegex.test(cleaned);
  };

  const handleBookingPhoneChange = (value: string) => {
    setBookingPhone(value);
    if (value && !validateIndianPhone(value)) {
      setPhoneError("Please enter a valid Indian mobile number (10 digits starting with 6-9)");
    } else {
      setPhoneError("");
    }
  };

  const isPhoneValid = bookingPhone && validateIndianPhone(bookingPhone);

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')}${period}`;
  };

  const resetBookingForm = () => {
    setBookingName("");
    setBookingPhone("");
    setBookingEmail("");
    setBookingDescription("");
    setBookingDate(startOfToday());
    setSelectedSlot(null);
    setPhoneError("");
    setBookingSuccess(false);
  };

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      setCancellingBookingId(bookingId);
      const res = await apiRequest('DELETE', `/api/auth/clinic/bookings/${bookingId}`);
      if (!res.ok) throw new Error('Failed to cancel booking');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinic/bookings'] });
      toast({ title: "Booking cancelled successfully" });
      setCancellingBookingId(null);
    },
    onError: () => {
      toast({ title: "Failed to cancel booking", variant: "destructive" });
      setCancellingBookingId(null);
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/clinic/bookings', data);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Failed to create booking (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      setBookingSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['/api/clinic/bookings'] });
      toast({
        title: "Booking Created!",
        description: "The appointment has been successfully booked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    },
  });

  const handleCreateBooking = () => {
    if (!selectedSlot || !bookingName || !bookingPhone || !bookingEmail || !clinic) return;
    const slotInfo = slotTimings.find(s => s.id === selectedSlot);
    if (!slotInfo) return;

    const startTime = new Date(bookingDate);
    startTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
    const endTime = new Date(bookingDate);
    endTime.setHours(slotInfo.endHour, slotInfo.endMinute, 0, 0);

    createBookingMutation.mutate({
      customerName: bookingName,
      customerPhone: bookingPhone,
      customerEmail: bookingEmail,
      clinicId: clinic.id,
      clinicName: clinic.name,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      description: bookingDescription
    } as any);
  };

  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithSlot[]>({
    queryKey: ['/api/auth/clinic/bookings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/bookings');
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
    enabled: isAuthenticated,
    refetchOnMount: 'always',
    refetchInterval: 30000,
    staleTime: 0,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/clinic-login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Moved the isAuthenticated check to after all hooks
  const isUserAuthenticated = isAuthenticated;

  // Billing State
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [billingBooking, setBillingBooking] = useState<BookingWithSlot | null>(null);
  const [billingDetails, setBillingDetails] = useState({
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    clinicName: "",
    clinicAddress: "",
    clinicPhone: "",
    clinicEmail: "",
    receiptNumber: "",
    services: [{ description: "Dental Consultation", amount: "500" }],
    date: "",
    discount: "0",
    tax: "0",
    paymentMethod: "Cash",
    remarks: ""
  });

  // Count today's bookings using the same timezone-safe comparison
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayStart = startOfDay(new Date());

  const todaysBookingsCount = bookings?.filter(b => {
    const bookingDateStr = format(new Date(b.slot.startTime), 'yyyy-MM-dd');
    return bookingDateStr === todayStr;
  }).length || 0;

  // Count future bookings (including today)
  const futureBookingsCount = bookings?.filter(b => {
    const bookingDate = new Date(b.slot.startTime);
    return bookingDate >= todayStart;
  }).length || 0;

  // Count past bookings (before today)
  const pastBookingsCount = bookings?.filter(b => {
    const bookingDate = new Date(b.slot.startTime);
    return bookingDate < todayStart;
  }).length || 0;

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });

  const thisWeekCount = bookings?.filter(b => {
    const d = new Date(b.slot.startTime);
    return d >= thisWeekStart && d <= thisWeekEnd;
  }).length || 0;

  const nextWeekCount = bookings?.filter(b => {
    const d = new Date(b.slot.startTime);
    return d >= nextWeekStart && d <= nextWeekEnd;
  }).length || 0;

  // Calculate booking numbers based on appointment time
  const getBookingNumber = (booking: BookingWithSlot) => {
    if (!bookings) return "0";
    // Get all bookings for the same date
    const bookingDateStr = format(new Date(booking.slot.startTime), 'yyyy-MM-dd');
    const dayBookings = bookings
      .filter(b => format(new Date(b.slot.startTime), 'yyyy-MM-dd') === bookingDateStr)
      .sort((a, b) => new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime());
    
    const index = dayBookings.findIndex(b => b.id === booking.id);
    return (index + 1).toString();
  };

  const getStatusGroup = (booking: BookingWithSlot) => {
    const d = new Date(booking.slot.startTime);
    const isPast = d < todayStart && format(d, 'yyyy-MM-dd') !== todayStr;
    if (isPast) return 2;
    if (booking.verificationStatus === 'confirmed' || !!booking.confirmedBy) return 1;
    return 0;
  };

  const filteredBookings = bookings?.filter(booking => {
    const bookingDate = new Date(booking.slot.startTime);

    // Quick filter takes precedence over date picker
    if (quickFilter === 'today') {
      return format(bookingDate, 'yyyy-MM-dd') === todayStr;
    }
    if (quickFilter === 'upcoming') {
      return bookingDate >= todayStart && format(bookingDate, 'yyyy-MM-dd') !== todayStr;
    }
    if (quickFilter === 'past') {
      return bookingDate < todayStart;
    }
    if (quickFilter === 'this-week') {
      return bookingDate >= thisWeekStart && bookingDate <= thisWeekEnd;
    }
    if (quickFilter === 'next-week') {
      return bookingDate >= nextWeekStart && bookingDate <= nextWeekEnd;
    }

    if (filterDate && filterEndDate) {
      return bookingDate >= startOfDay(filterDate) && bookingDate <= endOfDay(filterEndDate);
    } else if (filterDate) {
      // Compare using local date strings to avoid timezone issues
      const bookingDateStr = format(bookingDate, 'yyyy-MM-dd');
      const filterDateStr = format(filterDate, 'yyyy-MM-dd');
      return bookingDateStr === filterDateStr;
    }

    return true;
  })?.sort((a, b) => {
    if (quickFilter === 'all' && !filterDate) {
      const groupA = getStatusGroup(a);
      const groupB = getStatusGroup(b);
      if (groupA !== groupB) return groupA - groupB;
    }
    return new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime();
  });

  const handleOpenBilling = (booking: BookingWithSlot) => {
    setBillingBooking(booking);
    const receiptDate = format(new Date(), "yyyyMMdd");
    setBillingDetails({
      patientName: booking.customerName,
      patientPhone: booking.customerPhone,
      patientEmail: booking.customerEmail || "",
      clinicName: clinic?.name || "",
      clinicAddress: (clinic as any)?.address || "",
      clinicPhone: (clinic as any)?.phone || "",
      clinicEmail: (clinic as any)?.email || "",
      receiptNumber: `RCP-${booking.id}-${receiptDate}`,
      services: [{ description: "Dental Consultation", amount: "500" }],
      date: format(new Date(booking.slot.startTime), "PPP"),
      discount: "0",
      tax: "0",
      paymentMethod: "Cash",
      remarks: ""
    });
    setIsBillingOpen(true);
  };

  const assignDoctorMutation = useMutation({
    mutationFn: async ({ bookingId, doctorName, doctorEmail }: { bookingId: number; doctorName: string; doctorEmail?: string }) => {
      const response = await apiRequest('PATCH', `/api/clinic/bookings/${bookingId}/assign-doctor`, { doctorName, doctorEmail });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      toast({ title: "Doctor assigned successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign doctor", description: error.message, variant: "destructive" });
    },
  });

  const { data: allDoctorLeaves = [] } = useQuery<{ doctorEmail?: string; doctorName?: string; leaveDate: string; reason?: string | null }[]>({
    queryKey: ['/api/clinic/doctor-leaves/all'],
    enabled: isAuthenticated,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ bookingId, newSlotId }: { bookingId: number; newSlotId: number }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/reschedule`, { newSlotId });
      if (!response.ok) throw new Error('Failed to reschedule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      setRescheduleBookingId(null);
      setRescheduleSlot(null);
      toast({ title: "Booking rescheduled successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to reschedule booking", description: error.message, variant: "destructive" });
    },
  });

  const updateClinicalStatusMutation = useMutation({
    mutationFn: async ({ bookingId, clinicalStatus }: { bookingId: number; clinicalStatus: string }) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/clinical-status`, { clinicalStatus });
      if (!response.ok) throw new Error('Failed to update clinical status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      toast({ title: "Clinical status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update clinical status", description: error.message, variant: "destructive" });
    },
  });

  const requestConsentMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('POST', `/api/auth/clinic/bookings/${bookingId}/request-consent`, {});
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to send consent request');
      }
      return response.json() as Promise<{ consentUrl: string }>;
    },
    onSuccess: (data, bookingId) => {
      setConsentUrls(prev => ({ ...prev, [bookingId]: data.consentUrl }));
      toast({ title: "Consent request sent", description: "WhatsApp link sent to the patient." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send consent request", description: error.message, variant: "destructive" });
    },
  });

  const confirmBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('PATCH', `/api/auth/clinic/bookings/${bookingId}/confirm`, {});
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to confirm booking');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      toast({ title: "Booking Confirmed", description: "A confirmation email has been sent to the patient." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to confirm booking", description: error.message, variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const addServiceRow = () => {
    setBillingDetails(prev => ({
      ...prev,
      services: [...prev.services, { description: "", amount: "" }]
    }));
  };

  const removeServiceRow = (index: number) => {
    if (billingDetails.services.length <= 1) return;
    setBillingDetails(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };

  const updateService = (index: number, field: "description" | "amount", value: string) => {
    setBillingDetails(prev => ({
      ...prev,
      services: prev.services.map((s, i) => i === index ? { ...s, [field]: value } : s)
    }));
  };

  const generatePDF = () => {
    if (!billingBooking) return;

    const doc = new jsPDF();
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // ── BookMySlot Green palette ─────────────────────────────────
    const indigoDark: [number, number, number]  = [8,   80,  65];   // #085041 dark green
    const magenta: [number, number, number]     = [29,  158, 117];  // #1D9E75 accent green
    const indigoMid: [number, number, number]   = [15,  155, 110];  // #0F9B6E primary green
    const lightBg: [number, number, number]     = [225, 245, 238];  // #E1F5EE light tint
    const metaBg: [number, number, number]      = [209, 237, 226];  // soft green tint
    const totalRowBg: [number, number, number]  = [193, 229, 215];  // medium green tint
    const textDark: [number, number, number]    = [8,   40,  32];   // deep forest text
    const textMid: [number, number, number]     = [50,  100, 80];   // medium green text
    const textLight: [number, number, number]   = [150, 148, 180];
    const white: [number, number, number]       = [255, 255, 255];

    // ── Top gradient bar (7 px) ──────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, 0, pageWidth * 0.55, 7, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, 7, "F");

    // ── Medical cross icon (left of clinic name) ─────────────────
    const iconX = margin;
    const iconY = 12;
    const cs    = 4.5;                       // cross arm size
    const cw    = 1.4;                       // cross arm width
    doc.setFillColor(...indigoMid);
    doc.rect(iconX + (cs - cw) / 2, iconY,        cw, cs, "F"); // vertical
    doc.rect(iconX,                  iconY + (cs - cw) / 2, cs, cw, "F"); // horizontal

    // ── Header left: clinic name + subtitle ─────────────────────
    const nameX = iconX + cs + 3;
    doc.setFontSize(19);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(billingDetails.clinicName || "Clinic", nameX, 20);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...indigoMid);
    doc.text("Medical Services Receipt", nameX, 27);

    // ── Header right: address (wrapped) + phone + email ─────────
    const rightX        = pageWidth - margin;
    const rightColWidth = pageWidth * 0.42;   // max width for right column text
    let   contactY      = 11;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);

    if (billingDetails.clinicAddress) {
      const addrLines: string[] = doc.splitTextToSize(billingDetails.clinicAddress, rightColWidth);
      addrLines.forEach((line: string) => {
        doc.text(line, rightX, contactY, { align: "right" });
        contactY += 4.2;
      });
    }
    if (billingDetails.clinicPhone) {
      doc.text(`Tel: ${billingDetails.clinicPhone}`, rightX, contactY, { align: "right" });
      contactY += 4.2;
    }
    if (billingDetails.clinicEmail) {
      doc.text(billingDetails.clinicEmail, rightX, contactY, { align: "right" });
    }

    // ── Divider ──────────────────────────────────────────────────
    doc.setDrawColor(...indigoDark);
    doc.setLineWidth(0.5);
    doc.line(margin, 33, pageWidth - margin, 33);

    // ── Meta band: Date | Payment method (center) | Receipt # ───
    const metaY = 34;
    const metaH = 10;
    doc.setFillColor(...metaBg);
    doc.rect(margin, metaY, pageWidth - margin * 2, metaH, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);
    doc.text(`Date:  ${billingDetails.date}`, margin + 4, metaY + 6.5);

    doc.setTextColor(...indigoMid);
    doc.setFont("helvetica", "bold");
    doc.text(billingDetails.paymentMethod || "Cash", pageWidth / 2, metaY + 6.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);
    doc.text(`Receipt #:  ${billingDetails.receiptNumber}`, rightX - 4, metaY + 6.5, { align: "right" });

    // ── Patient Information table ─────────────────────────────────
    autoTable(doc, {
      startY: metaY + metaH + 5,
      head: [["Patient Information", ""]],
      body: [
        ["Name",             billingDetails.patientName],
        ["Phone",            billingDetails.patientPhone],
        ["Email",            billingDetails.patientEmail || "—"],
        ["Appointment Date", billingDetails.date],
      ],
      theme: "grid",
      headStyles: {
        fillColor: indigoDark,
        textColor: white,
        fontStyle: "bold",
        fontSize: 9,
        halign: "left",
        cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 48, textColor: textDark, fillColor: lightBg, fontSize: 8.5,
             cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
        1: { textColor: textMid, fontSize: 8.5,
             cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      },
      bodyStyles: { cellPadding: 3 },
      margin: { left: margin, right: margin },
    });

    // ── Services table ────────────────────────────────────────────
    const servicesStartY = (doc as any).lastAutoTable.finalY + 7;
    const tableBody = billingDetails.services.map(s => [
      s.description,
      `INR ${parseFloat(s.amount || "0").toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: servicesStartY,
      head: [["Description of Services", "Amount"]],
      body: tableBody,
      theme: "striped",
      headStyles: {
        fillColor: indigoDark,
        textColor: white,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
      },
      columnStyles: {
        0: { textColor: textDark, fontSize: 8.5,
             cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
        1: { halign: "right", textColor: textDark, cellWidth: 40, fontSize: 8.5,
             cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      },
      alternateRowStyles: { fillColor: [248, 247, 255] },
      bodyStyles: { cellPadding: 3 },
      margin: { left: margin, right: margin },
    });

    const afterServicesY = (doc as any).lastAutoTable.finalY + 8;

    // ── Totals ───────────────────────────────────────────────────
    const subtotal    = billingDetails.services.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const discountPct = parseFloat(billingDetails.discount) || 0;
    const taxPct      = parseFloat(billingDetails.tax) || 0;
    const discountAmt = subtotal * (discountPct / 100);
    const taxAmt      = (subtotal - discountAmt) * (taxPct / 100);
    const total       = subtotal - discountAmt + taxAmt;

    // ── Payment method box (left) ─────────────────────────────────
    const leftBoxW = pageWidth / 2 - margin - 6;
    const leftBoxH = billingDetails.remarks ? 34 : 24;

    doc.setFillColor(...lightBg);
    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, afterServicesY, leftBoxW, leftBoxH, 2.5, 2.5, "FD");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoMid);
    doc.text("PAYMENT METHOD", margin + 5, afterServicesY + 7);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(billingDetails.paymentMethod || "Cash", margin + 5, afterServicesY + 15);

    if (billingDetails.remarks) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textMid);
      const remarkLines: string[] = doc.splitTextToSize("Note: " + billingDetails.remarks, leftBoxW - 10);
      doc.text(remarkLines, margin + 5, afterServicesY + 23);
    }

    // ── Summary table (right) ─────────────────────────────────────
    const summaryData = [
      ["Subtotal",               `INR ${subtotal.toFixed(2)}`],
      [`Discount (${discountPct}%)`, `- INR ${discountAmt.toFixed(2)}`],
      [`Tax / GST (${taxPct}%)`,    `+ INR ${taxAmt.toFixed(2)}`],
      ["Total Amount Due",       `INR ${total.toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: afterServicesY,
      head: [],
      body: summaryData,
      theme: "grid",
      columnStyles: {
        0: { halign: "right", fontStyle: "normal", textColor: textMid,  fontSize: 8.5, cellWidth: 52,
             cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
        1: { halign: "right", textColor: textDark, fontSize: 8.5, cellWidth: 38,
             cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      },
      bodyStyles: { cellPadding: 3 },
      willDrawCell: (data: any) => {
        if (data.row.index === 3 && data.section === "body") {
          doc.setFillColor(...totalRowBg);
        }
      },
      didDrawCell: (data: any) => {
        if (data.row.index === 3 && data.section === "body") {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...indigoDark);
        }
      },
      margin: { left: pageWidth / 2 + 3, right: margin },
    });

    // ── Thank-you + fine print ────────────────────────────────────
    const finalY = Math.max((doc as any).lastAutoTable.finalY, afterServicesY + leftBoxH) + 12;

    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY - 5, pageWidth - margin, finalY - 5);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoMid);
    doc.text(`Thank you for choosing ${billingDetails.clinicName || "us"}!`, pageWidth / 2, finalY, { align: "center" });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textLight);
    doc.text(
      "This is a computer generated receipt and does not require a physical signature.",
      pageWidth / 2, finalY + 6, { align: "center" }
    );

    // ── Bottom gradient bar ───────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, pageHeight - 8, pageWidth * 0.55, 8, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, pageHeight - 8, pageWidth * 0.45, 8, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...white);
    doc.text("Powered by BookMySlot", pageWidth / 2, pageHeight - 3, { align: "center" });

    doc.save(`receipt_${billingDetails.patientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);

    // Save bill to database
    const _saveSub = billingDetails.services.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const _saveDiscPct = parseFloat(billingDetails.discount) || 0;
    const _saveTaxPct = parseFloat(billingDetails.tax) || 0;
    const _saveDiscAmt = _saveSub * (_saveDiscPct / 100);
    const _saveTaxAmt = (_saveSub - _saveDiscAmt) * (_saveTaxPct / 100);
    const _saveTot = _saveSub - _saveDiscAmt + _saveTaxAmt;
    apiRequest("POST", "/api/auth/clinic/bills", {
      bookingId: billingBooking.id,
      billNumber: billingDetails.receiptNumber,
      patientName: billingDetails.patientName,
      patientPhone: billingDetails.patientPhone,
      patientEmail: billingDetails.patientEmail,
      services: billingDetails.services.map(s => ({
        description: s.description,
        category: "General",
        amount: parseFloat(s.amount) || 0,
      })),
      subtotal: _saveSub,
      discountPct: _saveDiscPct,
      taxPct: _saveTaxPct,
      total: _saveTot,
      paymentMethod: billingDetails.paymentMethod || "Cash",
      paymentStatus: "paid",
      notes: billingDetails.remarks || null,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills/booking", billingBooking.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills"] });
    });

    setIsBillingOpen(false);
    toast({ title: "Receipt Generated", description: "PDF downloaded and saved to billing history." });
  };

  const printBillFromRecord = (bill: PatientBill) => {
    const doc = new jsPDF();
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const indigoDark: [number,number,number] = [8,80,65];
    const magenta: [number,number,number]    = [29,158,117];
    const indigoMid: [number,number,number]  = [15,155,110];
    const lightBg: [number,number,number]    = [225,245,238];
    const metaBg: [number,number,number]     = [209,237,226];
    const totalRowBg: [number,number,number] = [193,229,215];
    const textDark: [number,number,number]   = [8,40,32];
    const textMid: [number,number,number]    = [50,100,80];
    const textLight: [number,number,number]  = [120,160,140];
    const white: [number,number,number]      = [255,255,255];

    const rightX = pageWidth - margin;
    const rightColWidth = 70;
    let contactY = 16;

    doc.setFillColor(...indigoDark);
    doc.rect(0, 0, pageWidth * 0.55, 12, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, 12, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica","bold");
    doc.setTextColor(...white);
    doc.text("BookMySlot — Digital Dental Receipt", pageWidth / 2, 7.5, { align: "center" });

    const clinicName = (clinic as any)?.name || "Clinic";
    const nameX = margin;
    doc.setFontSize(19);
    doc.setFont("helvetica","bold");
    doc.setTextColor(...textDark);
    doc.text(clinicName, nameX, 20);
    doc.setFontSize(8.5);
    doc.setFont("helvetica","normal");
    doc.setTextColor(...indigoMid);
    doc.text("DENTAL RECEIPT", nameX, 26);

    if ((clinic as any)?.address) {
      const addrLines: string[] = doc.splitTextToSize((clinic as any).address, rightColWidth);
      addrLines.forEach((line: string) => { doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(...textMid); doc.text(line, rightX, contactY, {align:"right"}); contactY += 4.2; });
    }
    if ((clinic as any)?.phone) { doc.text(`Tel: ${(clinic as any).phone}`, rightX, contactY, {align:"right"}); contactY += 4.2; }
    if ((clinic as any)?.email) { doc.text((clinic as any).email, rightX, contactY, {align:"right"}); }

    const metaY = 32; const metaH = 16;
    doc.setFillColor(...metaBg);
    doc.roundedRect(margin, metaY, pageWidth - margin * 2, metaH, 3, 3, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica","normal");
    doc.setTextColor(...textMid);
    doc.text(`Date:  ${bill.createdAt ? format(new Date(bill.createdAt), "PPP") : format(new Date(), "PPP")}`, margin + 4, metaY + 6.5);
    doc.setTextColor(...indigoMid);
    doc.setFont("helvetica","bold");
    doc.text(bill.paymentMethod || "Cash", pageWidth / 2, metaY + 6.5, {align:"center"});
    doc.setFont("helvetica","normal");
    doc.setTextColor(...textMid);
    doc.text(`Receipt #:  ${bill.billNumber}`, rightX - 4, metaY + 6.5, {align:"right"});

    autoTable(doc, {
      startY: metaY + metaH + 5,
      head: [["Patient Information",""]],
      body: [
        ["Name", bill.patientName],
        ["Phone", bill.patientPhone || "—"],
        ["Email", bill.patientEmail || "—"],
      ],
      theme: "grid",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 9, halign: "left", cellPadding: {top:3,bottom:3,left:5,right:5} },
      columnStyles: {
        0: { fontStyle:"bold", cellWidth:48, textColor:textDark, fillColor:lightBg, fontSize:8.5, cellPadding:{top:3,bottom:3,left:5,right:5} },
        1: { textColor:textMid, fontSize:8.5, cellPadding:{top:3,bottom:3,left:5,right:5} },
      },
      bodyStyles: { cellPadding: 3 },
      margin: { left: margin, right: margin },
    });

    const servicesStartY = (doc as any).lastAutoTable.finalY + 7;
    const svcs = (bill.services as {description:string;amount:number}[]) || [];
    const tableBody = svcs.map(s => [s.description, `INR ${(s.amount||0).toFixed(2)}`]);
    autoTable(doc, {
      startY: servicesStartY,
      head: [["Description of Services","Amount"]],
      body: tableBody,
      theme: "striped",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle:"bold", fontSize:9, cellPadding:{top:3,bottom:3,left:5,right:5} },
      columnStyles: {
        0: { textColor:textDark, fontSize:8.5, cellPadding:{top:3,bottom:3,left:5,right:5} },
        1: { halign:"right", textColor:textDark, cellWidth:40, fontSize:8.5, cellPadding:{top:3,bottom:3,left:5,right:5} },
      },
      alternateRowStyles: { fillColor: [248,247,255] as [number,number,number] },
      bodyStyles: { cellPadding: 3 },
      margin: { left: margin, right: margin },
    });

    const afterServicesY = (doc as any).lastAutoTable.finalY + 8;
    const leftBoxW = pageWidth / 2 - margin - 6;
    doc.setFillColor(...lightBg);
    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, afterServicesY, leftBoxW, 24, 2.5, 2.5, "FD");
    doc.setFontSize(7);
    doc.setFont("helvetica","bold");
    doc.setTextColor(...indigoMid);
    doc.text("PAYMENT METHOD", margin + 5, afterServicesY + 7);
    doc.setFontSize(9.5);
    doc.setFont("helvetica","bold");
    doc.setTextColor(...textDark);
    doc.text(bill.paymentMethod || "Cash", margin + 5, afterServicesY + 15);

    const discountAmt = (bill.subtotal || 0) * ((bill.discountPct || 0) / 100);
    const taxAmt = ((bill.subtotal || 0) - discountAmt) * ((bill.taxPct || 0) / 100);
    const summaryData = [
      ["Subtotal", `INR ${(bill.subtotal||0).toFixed(2)}`],
      [`Discount (${bill.discountPct||0}%)`, `- INR ${discountAmt.toFixed(2)}`],
      [`Tax / GST (${bill.taxPct||0}%)`, `+ INR ${taxAmt.toFixed(2)}`],
      ["Total Amount Due", `INR ${(bill.total||0).toFixed(2)}`],
    ];
    autoTable(doc, {
      startY: afterServicesY,
      head: [],
      body: summaryData,
      theme: "grid",
      columnStyles: {
        0: { halign:"right", fontStyle:"normal", textColor:textMid, fontSize:8.5, cellWidth:52, cellPadding:{top:3,bottom:3,left:5,right:5} },
        1: { halign:"right", textColor:textDark, fontSize:8.5, cellWidth:38, cellPadding:{top:3,bottom:3,left:5,right:5} },
      },
      bodyStyles: { cellPadding: 3 },
      willDrawCell: (data: any) => { if (data.row.index === 3 && data.section === "body") doc.setFillColor(...totalRowBg); },
      didDrawCell:  (data: any) => { if (data.row.index === 3 && data.section === "body") { doc.setFont("helvetica","bold"); doc.setTextColor(...indigoDark); } },
      margin: { left: pageWidth / 2 + 3, right: margin },
    });

    const finalY = Math.max((doc as any).lastAutoTable.finalY, afterServicesY + 24) + 12;
    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY - 5, pageWidth - margin, finalY - 5);
    doc.setFontSize(10);
    doc.setFont("helvetica","bold");
    doc.setTextColor(...indigoMid);
    doc.text(`Thank you for choosing ${clinicName}!`, pageWidth / 2, finalY, {align:"center"});
    doc.setFontSize(6.5);
    doc.setFont("helvetica","normal");
    doc.setTextColor(...textLight);
    doc.text("This is a computer generated receipt and does not require a physical signature.", pageWidth / 2, finalY + 6, {align:"center"});
    doc.setFillColor(...indigoDark);
    doc.rect(0, pageHeight - 8, pageWidth * 0.55, 8, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, pageHeight - 8, pageWidth * 0.45, 8, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica","normal");
    doc.setTextColor(...white);
    doc.text("Powered by BookMySlot", pageWidth / 2, pageHeight - 3, {align:"center"});

    doc.save(`receipt_${bill.patientName.replace(/\s+/g,"_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast({ title: "Receipt Printed", description: `${bill.billNumber} downloaded.` });
  };

  const generateConsentPdf = (booking: BookingWithSlot) => {
    const doc = new jsPDF();
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // ── Colour palette (matches billing PDF) ─────────────────────
    const indigoDark: [number, number, number]  = [8,   80,  65];
    const magenta: [number, number, number]     = [29,  158, 117];
    const indigoMid: [number, number, number]   = [15,  155, 110];
    const lightBg: [number, number, number]     = [225, 245, 238];
    const metaBg: [number, number, number]      = [209, 237, 226];
    const textDark: [number, number, number]    = [8,   40,  32];
    const textMid: [number, number, number]     = [50,  100, 80];
    const textLight: [number, number, number]   = [150, 148, 180];
    const white: [number, number, number]       = [255, 255, 255];

    // ── Top gradient bar ─────────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, 0, pageWidth * 0.55, 7, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, 7, "F");

    // ── Medical cross icon ───────────────────────────────────────
    const iconX = margin;
    const iconY = 12;
    const cs    = 4.5;
    const cw    = 1.4;
    doc.setFillColor(...indigoMid);
    doc.rect(iconX + (cs - cw) / 2, iconY,                   cw, cs, "F");
    doc.rect(iconX,                  iconY + (cs - cw) / 2,  cs, cw, "F");

    // ── Header left: clinic name + subtitle ──────────────────────
    const nameX = iconX + cs + 3;
    doc.setFontSize(19);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(clinic?.name || "Clinic", nameX, 20);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...indigoMid);
    doc.text("Digital Informed Consent Form", nameX, 27);

    // ── Header right: address / phone ────────────────────────────
    const rightX        = pageWidth - margin;
    const rightColWidth = pageWidth * 0.42;
    let   contactY      = 11;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);

    if (clinic?.address) {
      const addrLines: string[] = doc.splitTextToSize(clinic.address, rightColWidth);
      addrLines.forEach((line: string) => {
        doc.text(line, rightX, contactY, { align: "right" });
        contactY += 4.2;
      });
    }
    if (clinic?.phone) {
      doc.text(`Tel: ${clinic.phone}`, rightX, contactY, { align: "right" });
      contactY += 4.2;
    }
    if (clinic?.email) {
      doc.text(clinic.email, rightX, contactY, { align: "right" });
    }

    // ── Divider ──────────────────────────────────────────────────
    doc.setDrawColor(...indigoDark);
    doc.setLineWidth(0.5);
    doc.line(margin, 33, pageWidth - margin, 33);

    // ── Meta band ────────────────────────────────────────────────
    const metaY = 34;
    const metaH = 10;
    doc.setFillColor(...metaBg);
    doc.rect(margin, metaY, pageWidth - margin * 2, metaH, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoMid);
    doc.text("DIGITAL CONSENT RECORD", pageWidth / 2, metaY + 6.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);
    doc.text(
      `Generated: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`,
      rightX - 4, metaY + 6.5, { align: "right" }
    );

    // ── Patient details table ────────────────────────────────────
    autoTable(doc, {
      startY: metaY + metaH + 5,
      head: [["Patient & Appointment Details", ""]],
      body: [
        ["Patient Name",   booking.customerName],
        ["Phone",          booking.customerPhone],
        ["Appointment",    format(new Date(booking.slot.startTime), "dd MMM yyyy, hh:mm a")],
        ["Clinic",         clinic?.name || ""],
      ],
      theme: "grid",
      headStyles: {
        fillColor: indigoDark, textColor: white, fontStyle: "bold",
        fontSize: 9, halign: "left",
        cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 48, textColor: textDark, fillColor: lightBg,
             fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
        1: { textColor: textMid, fontSize: 8.5,
             cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      },
      bodyStyles: { cellPadding: 3 },
      margin: { left: margin, right: margin },
    });

    let curY = (doc as any).lastAutoTable.finalY + 9;

    // ── Consent Declaration heading ──────────────────────────────
    doc.setFillColor(...lightBg);
    doc.rect(margin, curY, pageWidth - margin * 2, 7, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoDark);
    doc.text("CONSENT DECLARATION", margin + 4, curY + 4.8);
    curY += 11;

    // ── Consent body text ────────────────────────────────────────
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);

    const textW = pageWidth - margin * 2;

    const para1 = `I, ${booking.customerName}, hereby give my informed consent to ${clinic?.name || "the clinic"} to perform dental examination and any necessary dental treatment deemed appropriate by the treating dentist.`;
    const p1Lines: string[] = doc.splitTextToSize(para1, textW);
    doc.text(p1Lines, margin, curY);
    curY += p1Lines.length * 5 + 4;

    doc.text("I understand and acknowledge the following:", margin, curY);
    curY += 6;

    const bullets = [
      "The nature of the proposed treatment and its alternatives have been explained to me.",
      "All dental procedures carry certain risks including pain, swelling, and infection.",
      "I am responsible for informing the clinic of any allergies or medical conditions.",
      "My personal and health information will be kept confidential.",
      "I have the right to withdraw consent at any time before treatment begins.",
    ];
    doc.setTextColor(...textMid);
    bullets.forEach(b => {
      const bLines: string[] = doc.splitTextToSize(`\u2022  ${b}`, textW - 6);
      doc.text(bLines, margin + 4, curY);
      curY += bLines.length * 5 + 1.5;
    });

    curY += 2;
    doc.setTextColor(...textDark);
    const para3 = `By signing below, I confirm that I have read and understood the above and voluntarily consent to the dental care at ${clinic?.name || "the clinic"}.`;
    const p3Lines: string[] = doc.splitTextToSize(para3, textW);
    doc.text(p3Lines, margin, curY);
    curY += p3Lines.length * 5 + 10;

    // ── Signature section ────────────────────────────────────────
    doc.setFillColor(...lightBg);
    doc.rect(margin, curY, pageWidth - margin * 2, 7, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoDark);
    doc.text("PATIENT SIGNATURE", margin + 4, curY + 4.8);
    curY += 10;

    // signature image box
    const sigBoxW = 90;
    const sigBoxH = 40;
    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, curY, sigBoxW, sigBoxH, 2, 2, "D");

    if (booking.consentSignature) {
      try {
        doc.addImage(booking.consentSignature, "PNG", margin + 2, curY + 2, sigBoxW - 4, sigBoxH - 4);
      } catch (_) {}
    }
    curY += sigBoxH + 5;

    // signed on + audit line
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMid);
    if (booking.consentSignedAt) {
      doc.text(
        `Signed digitally on: ${format(new Date(booking.consentSignedAt), "dd MMMM yyyy 'at' hh:mm a")}`,
        margin, curY
      );
      curY += 5;
    }
    doc.text("IP address recorded for audit purposes. This is a legally binding digital consent.", margin, curY);
    curY += 12;

    // ── Footer ───────────────────────────────────────────────────
    doc.setDrawColor(...indigoMid);
    doc.setLineWidth(0.3);
    doc.line(margin, curY - 4, pageWidth - margin, curY - 4);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigoMid);
    doc.text(`Thank you for choosing ${clinic?.name || "us"}!`, pageWidth / 2, curY, { align: "center" });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textLight);
    doc.text(
      "This document was generated by BookMySlot and serves as the official digital consent record.",
      pageWidth / 2, curY + 6, { align: "center" }
    );

    // ── Bottom gradient bar ───────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, pageHeight - 8, pageWidth * 0.55, 8, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageWidth * 0.55, pageHeight - 8, pageWidth * 0.45, 8, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...white);
    doc.text("Powered by BookMySlot", pageWidth / 2, pageHeight - 3, { align: "center" });

    const fileName = `consent_${booking.customerName.replace(/\s+/g, "_")}_${format(new Date(booking.slot.startTime), "yyyyMMdd")}.pdf`;
    doc.save(fileName);
    toast({ title: "Consent PDF Downloaded", description: `${fileName} saved successfully.` });
  };

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/clinic-login");
      toast({ title: "Logged out successfully" });
    } catch (error: any) {
      console.error("[CLINIC-DASHBOARD] Logout error:", error);
      // Even if API fails, clear local state and redirect
      setLocation("/clinic-login");
    }
  };

  const downloadExcel = () => {
    if (!filteredBookings || filteredBookings.length === 0) {
      toast({ title: "No bookings to download", variant: "destructive" });
      return;
    }

    const headers = ["Name", "Phone Number", "Booking Date", "Time Slot"];
    const rows = filteredBookings.map(booking => [
      booking.customerName,
      booking.customerPhone,
      format(new Date(booking.slot.startTime), "yyyy-MM-dd"),
      `${format(new Date(booking.slot.startTime), "h:mm a")} - ${format(new Date(booking.slot.endTime), "h:mm a")}`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bookings_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isUserAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">

      {/* Subscription payment pending banner */}
      {(clinic as any)?.subscriptionStatus === "pending_payment" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3.5">
          <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-amber-400/20 flex items-center justify-center">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Subscription payment pending</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Your clinic is approved but your subscription is not yet active. Check your email for an activation link to complete payment, or contact support.
            </p>
          </div>
          <a
            href="mailto:support@bookmyslot.in"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors mt-0.5"
            data-testid="link-subscription-support"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Contact support
          </a>
        </div>
      )}

      {/* Page Header */}
      <div className="rounded-2xl overflow-hidden shadow-xl mb-6 sm:mb-8 border border-white/10">
        {/* Neon accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-5 py-4 sm:px-6 sm:py-5">
          {/* Subtle radial glow overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_60%)] pointer-events-none" />

          <div className="relative flex items-center justify-between gap-4">

            <div className="flex items-center gap-4 min-w-0">

              {/* Logo upload with double-ring glow */}
              <div className="shrink-0 relative">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent/30 to-primary/30 blur-sm" />
                <div className="relative ring-2 ring-white/25 rounded-2xl">
                  <ImageUpload
                    currentImage={clinic?.logoUrl || undefined}
                    onImageUploaded={(url: string) => updateLogoMutation.mutate(url)}
                    folder="clinics"
                    fallbackText={clinic?.name || "Clinic"}
                    allowedTypes={["image/png", "image/jpeg"]}
                    maxSizeKb={500}
                  />
                </div>
                {/* Logo spec hint */}
                <div className="absolute -bottom-5 left-0 right-0 text-center">
                  <span className="text-[9px] font-medium text-white/40 whitespace-nowrap">PNG · JPG · max 500 KB</span>
                </div>
              </div>

              {/* Text block */}
              <div className="min-w-0">
                {/* Clinic name — prominent */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide truncate drop-shadow-sm">
                    {clinic?.name}
                  </h1>
                  {clinic?.id && clinic.id >= 999 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
                      <FlaskConical className="h-2.5 w-2.5" />
                      Demo
                    </span>
                  )}
                </div>

                {/* Sub-row: badges + live indicator */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/90 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">
                    <Building2 className="h-2.5 w-2.5" />
                    Clinic Administration
                  </span>

                  {/* Live indicator */}
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Live
                  </span>

                  {/* Current date */}
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-white/60 bg-white/8 border border-white/15 px-2 py-0.5 rounded-full">
                    <CalendarIcon className="h-2.5 w-2.5" />
                    {format(new Date(), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>

            {/* Sign out */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="shrink-0 text-white/70 hover:text-white hover:bg-white/15 border border-white/15 gap-1.5 text-xs backdrop-blur-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* ===== NAMEPLATE STRIP ===== */}
        <div className="relative bg-black/25 backdrop-blur-sm px-5 sm:px-6 py-2.5 flex items-center justify-center overflow-hidden">
          {/* Left decorative line */}
          <div className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 h-px w-16 bg-gradient-to-r from-accent/50 to-transparent" />
          {/* Right decorative line */}
          <div className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 h-px w-16 bg-gradient-to-l from-accent/50 to-transparent" />
          {/* Corner brackets */}
          <span className="absolute left-5 sm:left-6 text-accent/40 text-xs font-mono select-none">[</span>
          <span className="absolute right-5 sm:right-6 text-accent/40 text-xs font-mono select-none">]</span>
          {/* Clinic name */}
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-white/65 truncate px-8">
            {clinic?.name}
          </p>
        </div>
        {/* Bottom accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-accent via-primary to-accent opacity-50" />

      </div>

      {/* Two-column layout: left sidebar + main content */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ===== LEFT SIDEBAR NAV ===== */}
        <div className="w-full lg:w-56 shrink-0">
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="p-2 space-y-0.5">

              <button
                onClick={() => setActivePanel('bookings')}
                data-testid="nav-bookings"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'bookings' ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'bookings' ? 'bg-primary/10 border-primary/20' : 'bg-muted/50 border-border/50'}`}>
                  <CalendarIcon className={`h-4 w-4 ${activePanel === 'bookings' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'bookings' ? 'text-primary' : 'text-foreground'}`}>Bookings</p>
                  <p className="text-[10px] text-muted-foreground">All appointments</p>
                </div>
                {activePanel === 'bookings' && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
              </button>

              <button
                onClick={() => setActivePanel('configure-slots')}
                data-testid="nav-configure-slots"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'configure-slots' ? 'bg-blue-500/10 border border-blue-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'configure-slots' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Clock className={`h-4 w-4 ${activePanel === 'configure-slots' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'configure-slots' ? 'text-blue-600' : 'text-foreground'}`}>Configure Slots</p>
                  <p className="text-[10px] text-muted-foreground">Capacity &amp; cancellation</p>
                </div>
                {activePanel === 'configure-slots' && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
              </button>

              <button
                onClick={() => setActivePanel('manage-doctors')}
                data-testid="nav-manage-doctors"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'manage-doctors' ? 'bg-teal-500/10 border border-teal-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'manage-doctors' ? 'bg-teal-500/10 border-teal-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Stethoscope className={`h-4 w-4 ${activePanel === 'manage-doctors' ? 'text-teal-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'manage-doctors' ? 'text-teal-700 dark:text-teal-400' : 'text-foreground'}`}>Manage Doctors</p>
                  <p className="text-[10px] text-muted-foreground">Add or remove doctors</p>
                </div>
                {activePanel === 'manage-doctors' && <div className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />}
              </button>

              <button
                onClick={() => setActivePanel('clinic-profile')}
                data-testid="nav-clinic-profile"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'clinic-profile' ? 'bg-violet-500/10 border border-violet-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'clinic-profile' ? 'bg-violet-500/10 border-violet-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Building2 className={`h-4 w-4 ${activePanel === 'clinic-profile' ? 'text-violet-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'clinic-profile' ? 'text-violet-700 dark:text-violet-400' : 'text-foreground'}`}>Clinic Profile</p>
                  <p className="text-[10px] text-muted-foreground">Edit public about page</p>
                </div>
                {activePanel === 'clinic-profile' && <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />}
              </button>

              <button
                onClick={() => setActivePanel('book-a-slot')}
                data-testid="nav-book-a-slot"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'book-a-slot' ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'book-a-slot' ? 'bg-primary/10 border-primary/20' : 'bg-muted/50 border-border/50'}`}>
                  <Plus className={`h-4 w-4 ${activePanel === 'book-a-slot' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'book-a-slot' ? 'text-primary' : 'text-foreground'}`}>Book a Slot</p>
                  <p className="text-[10px] text-muted-foreground">New patient appointment</p>
                </div>
                {activePanel === 'book-a-slot' && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
              </button>

              <button
                onClick={() => setActivePanel('export-data')}
                data-testid="nav-export-data"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'export-data' ? 'bg-amber-500/10 border border-amber-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'export-data' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Download className={`h-4 w-4 ${activePanel === 'export-data' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'export-data' ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>Export Data</p>
                  <p className="text-[10px] text-muted-foreground">Download patient records</p>
                </div>
                {activePanel === 'export-data' && <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
              </button>

              <button
                onClick={() => setActivePanel('inventory')}
                data-testid="nav-inventory"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'inventory' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'inventory' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Package className={`h-4 w-4 ${activePanel === 'inventory' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'inventory' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>Inventory</p>
                  <p className="text-[10px] text-muted-foreground">Stock, assets & alerts</p>
                </div>
                {activePanel === 'inventory' && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
              </button>

              <button
                onClick={() => setActivePanel('website')}
                data-testid="nav-website"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'website' ? 'bg-sky-500/10 border border-sky-500/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'website' ? 'bg-sky-500/10 border-sky-500/20' : 'bg-muted/50 border-border/50'}`}>
                  <Globe className={`h-4 w-4 ${activePanel === 'website' ? 'text-sky-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'website' ? 'text-sky-700 dark:text-sky-400' : 'text-foreground'}`}>Clinic Website</p>
                  <p className="text-[10px] text-muted-foreground">Theme & content</p>
                </div>
                {activePanel === 'website' && <div className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />}
              </button>

              <button
                onClick={() => setActivePanel('accounts')}
                data-testid="nav-accounts"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activePanel === 'accounts' ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-muted/50'}`}
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${activePanel === 'accounts' ? 'bg-primary/10 border-primary/20' : 'bg-muted/50 border-border/50'}`}>
                  <IndianRupee className={`h-4 w-4 ${activePanel === 'accounts' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${activePanel === 'accounts' ? 'text-primary' : 'text-foreground'}`}>Accounts</p>
                  <p className="text-[10px] text-muted-foreground">All patient billing history</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {allBills.length > 0 && (
                    <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{allBills.length}</span>
                  )}
                  {activePanel === 'accounts' && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
              </button>

            </div>
          </div>

          {/* Scan & Share Card */}
          {clinic && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden mt-3">
              <div className="px-3 pt-3 pb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scan &amp; Share</p>
              </div>
              <div className="px-3 pb-3 flex flex-col items-center gap-3">
                {/* QR Code */}
                <div className="relative rounded-2xl overflow-hidden bg-white p-3 border border-border/40 shadow-inner w-full flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none rounded-2xl" />
                  <QRCode
                    value={`${window.location.origin}/clinic/${clinic.username || clinic.id}`}
                    size={120}
                    level="M"
                    fgColor="#085041"
                    bgColor="#ffffff"
                    style={{ display: "block" }}
                  />
                </div>
                {/* Label */}
                <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
                  Patients scan to visit your clinic page
                </p>
                {/* URL row */}
                <div className="w-full rounded-xl border border-border/50 bg-muted/30 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Clinic Page URL</p>
                      <p className="text-[10px] text-foreground truncate font-mono mt-0.5">/clinic/{clinic.username || clinic.id}</p>
                    </div>
                    <button
                      onClick={() => copyClinicUrl('about')}
                      data-testid="button-copy-about-url"
                      title="Copy clinic page URL"
                      className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200
                        ${copiedUrlType === 'about'
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5'}`}
                    >
                      {copiedUrlType === 'about' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
        {/* ===== END LEFT SIDEBAR NAV ===== */}

        {/* ===== MAIN CONTENT ===== */}
        <div className="flex-1 min-w-0">

          {/* BOOKINGS PANEL */}
          {activePanel === 'bookings' && (
            <div className="space-y-5">
          {/* Stats Cards — click to filter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Upcoming */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${quickFilter === 'upcoming' ? 'ring-2 ring-blue-500 border-blue-400' : 'border-border/50'}`}
                    onClick={() => setQuickFilter(q => q === 'upcoming' ? 'all' : 'upcoming')}
                    data-testid="card-filter-upcoming"
                  >
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
                    <CardContent className="p-4 text-left flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${quickFilter === 'upcoming' ? 'bg-blue-500/20' : 'bg-blue-500/10'}`}>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground">Upcoming</p>
                        <p className="text-xl font-bold text-blue-600">{futureBookingsCount}</p>
                      </div>
                      {quickFilter === 'upcoming' && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full shrink-0">Active</span>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  Confirmed & pending appointments from tomorrow onwards
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Past */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${quickFilter === 'past' ? 'ring-2 ring-slate-400 border-slate-400' : 'border-border/50'}`}
                    onClick={() => setQuickFilter(q => q === 'past' ? 'all' : 'past')}
                    data-testid="card-filter-past"
                  >
                    <div className="h-1 bg-gradient-to-r from-slate-400 to-slate-300" />
                    <CardContent className="p-4 text-left flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${quickFilter === 'past' ? 'bg-muted' : 'bg-muted'}`}>
                        <History className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground">Past</p>
                        <p className="text-xl font-bold text-muted-foreground">{pastBookingsCount}</p>
                      </div>
                      {quickFilter === 'past' && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded-full shrink-0">Active</span>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  All appointments that have already passed
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Today */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${quickFilter === 'today' ? 'ring-2 ring-primary border-primary/60' : 'border-border/50'}`}
                    onClick={() => setQuickFilter(q => q === 'today' ? 'all' : 'today')}
                    data-testid="card-filter-today"
                  >
                    <div className="h-1 bg-gradient-to-r from-primary to-accent" />
                    <CardContent className="p-4 text-left flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${quickFilter === 'today' ? 'bg-primary/20' : 'bg-primary/10'}`}>
                        <CalendarIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground">Today</p>
                        <p className="text-xl font-bold text-primary">{todaysBookingsCount}</p>
                      </div>
                      {quickFilter === 'today' && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">Active</span>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  All appointments scheduled for today
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Filtered (non-clickable, shows current result count) */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="shadow-sm border-border/50 overflow-hidden cursor-default">
                    <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
                    <CardContent className="p-4 text-left flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Filter className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Showing</p>
                        <p className="text-xl font-bold text-amber-600">{filteredBookings?.length || 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  Total bookings matching your current filter or date range
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Week filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-muted-foreground">Quick week:</span>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setQuickFilter(q => q === 'this-week' ? 'all' : 'this-week')}
                    data-testid="chip-filter-this-week"
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                      quickFilter === 'this-week'
                        ? 'bg-violet-500 text-white border-violet-500 shadow-sm'
                        : 'bg-background text-muted-foreground border-border/60 hover:border-violet-400 hover:text-violet-600'
                    }`}
                  >
                    <CalendarIcon className="h-3 w-3" />
                    This Week
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${quickFilter === 'this-week' ? 'bg-white/20 text-white' : 'bg-violet-500/10 text-violet-600'}`}>
                      {thisWeekCount}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  Bookings falling within the current Mon–Sun week
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setQuickFilter(q => q === 'next-week' ? 'all' : 'next-week')}
                    data-testid="chip-filter-next-week"
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                      quickFilter === 'next-week'
                        ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                        : 'bg-background text-muted-foreground border-border/60 hover:border-indigo-400 hover:text-indigo-600'
                    }`}
                  >
                    <CalendarDays className="h-3 w-3" />
                    Next Week
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${quickFilter === 'next-week' ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-600'}`}>
                      {nextWeekCount}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[180px] text-center">
                  Bookings falling within next Mon–Sun week
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {(quickFilter === 'this-week' || quickFilter === 'next-week') && (
              <button
                onClick={() => setQuickFilter('all')}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Bookings Section */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">

            {/* Bookings header */}
            <div className="bg-gradient-to-r from-primary to-accent px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Bookings</h2>
                <p className="text-white/70 text-[11px] mt-0.5">All patient appointments</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadExcel}
                className="gap-2 text-white/80 hover:text-white hover:bg-white/15 border border-white/20 text-xs"
                disabled={!filteredBookings || filteredBookings.length === 0}
                data-testid="button-download-excel"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </Button>
            </div>

          <div className="p-5 space-y-5">
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground px-1 text-left">Start Date</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start text-left font-normal rounded-xl h-10 bg-background border-border/50 ${!filterDate && "text-muted-foreground"}`}>
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{filterDate ? format(filterDate, "PPP") : "Select date"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                      <Calendar
                        mode="single"
                        selected={filterDate}
                        onSelect={setFilterDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground px-1 text-left">End Date (Optional)</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start text-left font-normal rounded-xl h-10 bg-background border-border/50 ${!filterEndDate && "text-muted-foreground"}`}>
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{filterEndDate ? format(filterEndDate, "PPP") : "Select end date"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                      <Calendar
                        mode="single"
                        selected={filterEndDate}
                        onSelect={setFilterEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterDate(new Date());
                    setFilterEndDate(undefined);
                  }}
                  className="rounded-xl h-10 px-4 text-muted-foreground hover:text-foreground"
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterDate(undefined);
                    setFilterEndDate(undefined);
                  }}
                  className="rounded-xl h-10 px-4 text-muted-foreground hover:text-foreground"
                >
                  All
                </Button>
              </div>
            </div>

          {bookingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBookings?.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-muted/20 rounded-2xl border border-dashed">
                  <p className="text-muted-foreground">No bookings found for the selected date range.</p>
                </div>
              ) : (
                (() => {
                  const isGrouped = quickFilter === 'all' && !filterDate;
                  const groupConfig = [
                    { label: 'Pending', textColor: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
                    { label: 'Upcoming', textColor: 'text-primary', bg: 'bg-primary/5 dark:bg-primary/10', border: 'border-primary/20' },
                    { label: 'Past', textColor: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border/40' },
                  ];
                  let lastGroup = -1;
                  return filteredBookings?.flatMap((booking) => {
                  const bookingDateTime = new Date(booking.slot.startTime);
                  const bookingDateStr = format(bookingDateTime, 'yyyy-MM-dd');
                  const isBookingToday = bookingDateStr === todayStr;
                  const isBookingPast = bookingDateTime < startOfDay(new Date()) && !isBookingToday;

                  const accentBar = isBookingToday
                    ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                    : isBookingPast
                    ? "bg-gradient-to-r from-slate-400 to-slate-300"
                    : "bg-gradient-to-r from-primary via-accent to-accent";

                  const headerBg = isBookingToday
                    ? "bg-gradient-to-r from-emerald-500/8 to-teal-500/5"
                    : isBookingPast
                    ? "bg-muted/30"
                    : "bg-gradient-to-r from-primary/5 to-accent/5";

                  const isConfirmed = booking.verificationStatus === 'confirmed' || !!booking.confirmedBy;
                  const statusLabel = isBookingPast
                    ? "Past"
                    : isConfirmed
                    ? (isBookingToday ? "Today" : "Upcoming")
                    : "Pending";
                  const statusClass = isBookingPast
                    ? "text-muted-foreground bg-muted/50 border-border/50"
                    : isConfirmed
                    ? (isBookingToday
                        ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/25"
                        : "text-primary bg-primary/10 border-primary/25")
                    : "text-amber-600 bg-amber-500/10 border-amber-500/25 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-500/30";

                  const cardOpacity = isBookingPast ? "opacity-75" : "";

                  const complaints = booking.description
                    ? CHIEF_COMPLAINTS.filter(c =>
                        booking.description!.split(/[,.\s]+/).map(p => p.trim().toLowerCase()).includes(c.toLowerCase())
                      )
                    : [];

                  const isPending = !isConfirmed && !isBookingPast;
                  const group = isGrouped ? getStatusGroup(booking) : -1;
                  const showDivider = isGrouped && group !== lastGroup;
                  if (isGrouped) lastGroup = group;
                  const groupCfg = groupConfig[Math.max(0, group)];
                  return [
                    showDivider ? (
                      <div key={`divider-group-${group}`} className="col-span-full flex items-center gap-3 mt-2 mb-1">
                        <div className="h-px flex-1 bg-border/50" />
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${groupCfg.textColor} ${groupCfg.bg} ${groupCfg.border}`}>
                          {groupCfg.label}
                        </span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                    ) : null,
                    (
                  <Card
                    key={booking.id}
                    className={`overflow-hidden border-border/50 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/30 transition-all group flex flex-col ${cardOpacity} ${isPending ? "border-l-2 border-l-amber-400 dark:border-l-amber-500" : ""}`}
                    data-testid={`card-booking-${booking.id}`}
                  >
                    {/* Status accent bar */}
                    <div className={`h-[3px] ${accentBar}`} />

                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="w-full text-left cursor-pointer flex-1 flex flex-col">

                          {/* Card Header */}
                          <div className={`px-4 pt-3.5 pb-3 ${headerBg} transition-colors group-hover:brightness-[0.97]`}>
                            <div className="flex items-start justify-between gap-2">

                              {/* Avatar + name block */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 dark:border-primary/30 flex items-center justify-center">
                                  <span className="text-sm font-bold text-primary dark:text-primary/70 leading-none">
                                    {booking.customerName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-sm leading-tight truncate">{booking.customerName}</span>
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-md shrink-0">
                                      #{getBookingNumber(booking).padStart(2, '0')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                                    <Phone className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">{booking.customerPhone}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Status pill + consent pill */}
                              <div className="flex flex-col items-end gap-1">
                                {!isConfirmed && !isBookingPast ? (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded-full cursor-default ${statusClass}`}>
                                          {statusLabel}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        Patient booked — awaiting clinic confirmation
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded-full cursor-default ${statusClass}`}>
                                          {isConfirmed && !isBookingPast && <CheckCircle2 className="h-2.5 w-2.5" />}
                                          {statusLabel}
                                        </span>
                                      </TooltipTrigger>
                                      {isConfirmed && !isBookingPast && booking.confirmedBy && (
                                        <TooltipContent side="top" className="text-xs">
                                          {booking.confirmedBy === 'doctor'
                                            ? `Confirmed by Dr. ${booking.assignedDoctor || 'Doctor'}`
                                            : 'Confirmed by Admin'}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {booking.consentSignedAt && (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-1.5 py-0.5 rounded-full cursor-default">
                                          <CheckCircle2 className="h-2 w-2" />
                                          Consent Signed
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="text-xs">
                                        Digital consent signed by patient
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Info rows */}
                          <div className="px-4 py-3 space-y-2">

                            {/* Date */}
                            <div className="flex items-center gap-2.5 text-[12px]">
                              <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                <CalendarIcon className="h-3 w-3 text-primary" />
                              </div>
                              <span className="font-semibold text-foreground">
                                {format(bookingDateTime, "EEEE, MMMM do")}
                              </span>
                              {!isBookingPast && (() => {
                                const daysAway = differenceInCalendarDays(bookingDateTime, new Date());
                                const label = isBookingToday ? "Today" : daysAway === 1 ? "Tomorrow" : `in ${daysAway} days`;
                                const cls = isBookingToday
                                  ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                                  : daysAway === 1
                                  ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                                  : "text-muted-foreground bg-muted/50 border-border/50";
                                return (
                                  <span className={`text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-full ${cls}`}>
                                    {label}
                                  </span>
                                );
                              })()}
                            </div>

                            {/* Time range */}
                            <div className="flex items-center gap-2.5 text-[12px]">
                              <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <span className="text-muted-foreground font-medium">
                                {format(bookingDateTime, "h:mm a")}
                                <span className="mx-1 opacity-40">→</span>
                                {format(new Date(booking.slot.endTime), "h:mm a")}
                              </span>
                            </div>

                            {/* Email */}
                            {booking.customerEmail && (
                              <div className="flex items-center gap-2.5 text-[12px]">
                                <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <span className="text-muted-foreground truncate">{booking.customerEmail}</span>
                              </div>
                            )}

                            {/* Assigned doctor */}
                            {booking.assignedDoctor ? (
                              <div className="flex items-center gap-2 text-[12px] flex-wrap">
                                <div className="flex items-center gap-2">
                                  <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <Stethoscope className="h-3 w-3 text-primary" />
                                  </div>
                                  <span className="font-medium text-primary">Dr. {booking.assignedDoctor}</span>
                                </div>
                                {booking.doctorApprovalStatus === 'pending' && (
                                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                                    Awaiting Dr. Approval
                                  </span>
                                )}
                                {booking.doctorApprovalStatus === 'approved' && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-500 text-white dark:bg-green-600">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Confirmed by Doctor
                                  </span>
                                )}
                                {booking.doctorApprovalStatus === 'admin_confirmed' && (
                                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                                    Confirmed by admin
                                  </span>
                                )}
                                {booking.doctorApprovalStatus === 'declined' && (
                                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                                    Declined — reassign
                                  </span>
                                )}
                              </div>
                            ) : !isBookingPast && (
                              <div className="flex items-center gap-2 text-[12px] min-w-0">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                                  <div className="h-5 w-5 rounded-md bg-muted flex items-center justify-center shrink-0">
                                    <Stethoscope className="h-3 w-3 text-muted-foreground/50" />
                                  </div>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="italic text-muted-foreground/60 truncate">No doctor assigned</span>
                                      </TooltipTrigger>
                                      <TooltipContent>No doctor assigned</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                {booking.confirmedBy === 'admin' && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 shrink-0">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Confirmed by Admin
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Chief complaint chips */}
                            {complaints.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {complaints.slice(0, 4).map((c, i) => (
                                  <span key={i} className="inline-flex items-center text-[9px] font-semibold uppercase tracking-wide text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded-md">
                                    {c}
                                  </span>
                                ))}
                                {complaints.length > 4 && (
                                  <span className="text-[9px] text-muted-foreground font-medium px-1">+{complaints.length - 4}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </DialogTrigger>

                      <DialogContent className="w-[95vw] sm:max-w-[680px] rounded-2xl p-0 overflow-hidden h-[85vh] flex flex-col">

                        {/* ── HEADER ── */}
                        <div className="shrink-0 bg-gradient-to-br from-primary/90 via-primary to-accent/80 px-5 pt-5 pb-0 relative overflow-hidden">
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                          {/* Top row: avatar + name + close */}
                          <div className="relative flex items-start gap-4 mb-3">
                            <div className="shrink-0">
                              <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center ring-2 ring-white/10">
                                <span className="text-xl font-black text-white leading-none">
                                  {booking.customerName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <DialogTitle className="text-white font-extrabold text-xl leading-tight tracking-tight">
                                  {booking.customerName}
                                </DialogTitle>
                                <span className="font-mono text-[9px] uppercase tracking-widest text-white/60 bg-white/10 border border-white/20 px-1.5 py-0.5 rounded-md shrink-0">
                                  REF-{getBookingNumber(booking).padStart(4, '0')}
                                </span>
                              </div>
                              {/* Badges row — consistent pill style throughout */}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {/* Single confirmation badge — shows WHO confirmed, using confirmedBy field */}
                                {booking.verificationStatus === 'confirmed' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/25">
                                    {booking.confirmedBy === 'doctor'
                                      ? <Stethoscope className="h-2.5 w-2.5" />
                                      : <CheckCircle2 className="h-2.5 w-2.5" />}
                                    {booking.confirmedBy === 'doctor'
                                      ? `Dr. ${booking.assignedDoctor || 'Doctor'} Confirmed`
                                      : booking.confirmedBy === 'admin'
                                      ? 'Admin Confirmed'
                                      : 'Payment Confirmed'}
                                  </span>
                                )}
                                {/* Awaiting doctor — only when unconfirmed and doctor hasn't acted yet */}
                                {booking.verificationStatus !== 'confirmed' && booking.doctorApprovalStatus === 'pending' && booking.assignedDoctor && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30">
                                    <Clock className="h-2.5 w-2.5" />
                                    Awaiting Dr. {booking.assignedDoctor.split(' ')[0]}
                                  </span>
                                )}
                                {/* Consent signed */}
                                {booking.consentSignedAt && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/20">
                                    <PenLine className="h-2.5 w-2.5" />
                                    Consent Signed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Appointment strip */}
                          <div className="relative flex items-center gap-4 pb-3 flex-wrap">
                            <div className="flex items-center gap-1.5 text-[12px] text-white/75">
                              <CalendarDays className="h-3 w-3 opacity-80 shrink-0" />
                              <strong className="text-white font-semibold">{format(bookingDateTime, "EEE, d MMM yyyy")}</strong>
                            </div>
                            <div className="flex items-center gap-1.5 text-[12px] text-white/75">
                              <Clock className="h-3 w-3 opacity-80 shrink-0" />
                              <strong className="text-white font-semibold">{format(bookingDateTime, "h:mm a")}</strong>
                              <span>→ {format(new Date(booking.slot.endTime), "h:mm a")}</span>
                            </div>
                            {clinic?.name && (
                              <div className="flex items-center gap-1.5 text-[12px] text-white/75">
                                <Building2 className="h-3 w-3 opacity-80 shrink-0" />
                                <span>{clinic.name}</span>
                              </div>
                            )}
                            {!isBookingPast && (() => {
                              const daysAway = differenceInCalendarDays(bookingDateTime, new Date());
                              const label = isBookingToday ? "Today" : daysAway === 1 ? "Tomorrow" : `in ${daysAway} days`;
                              return (
                                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30">
                                  {label}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Tab bar — sits at the bottom of the header */}
                          <div className="relative flex border-t border-white/10 -mx-5">
                            {([ 
                              { key: 'overview', label: 'Overview', icon: <User className="h-3 w-3" /> },
                              { key: 'clinical', label: 'Clinical', icon: <ClipboardList className="h-3 w-3" /> },
                              { key: 'notes',    label: 'Notes',    icon: <FileText className="h-3 w-3" /> },
                              { key: 'actions',  label: 'Actions',  icon: <Settings className="h-3 w-3" /> },
                              { key: 'billing',  label: 'Billing',  icon: <IndianRupee className="h-3 w-3" /> },
                            ] as const).map(({ key, label, icon }) => {
                              const isActive = getModalTab(booking.id) === key;
                              return (
                                <button
                                  key={key}
                                  onClick={() => setModalTab(booking.id, key)}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-all border-b-2 ${
                                    isActive
                                      ? 'text-white border-white'
                                      : 'text-white/55 border-transparent hover:text-white/80'
                                  }`}
                                  data-testid={`modal-tab-${key}-${booking.id}`}
                                >
                                  {icon}{label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* ── TAB PANELS ── */}
                        <div className="overflow-y-auto flex-1">

                          {/* OVERVIEW TAB */}
                          {getModalTab(booking.id) === 'overview' && (
                            <div className="p-4 space-y-3">

                              {/* Appointment details */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                  <CalendarDays className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Appointment</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-border/50">
                                  <div className="px-3 py-2.5">
                                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Date</p>
                                    <p className="text-sm font-bold text-foreground">{format(bookingDateTime, "MMM d, yyyy")}</p>
                                    <p className="text-[10px] text-muted-foreground">{format(bookingDateTime, "EEEE")}</p>
                                  </div>
                                  <div className="px-3 py-2.5">
                                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Time</p>
                                    <p className="text-sm font-bold text-foreground">{format(bookingDateTime, "h:mm a")}</p>
                                    <p className="text-[10px] text-muted-foreground">→ {format(new Date(booking.slot.endTime), "h:mm a")}</p>
                                  </div>
                                  {booking.assignedDoctor && (
                                    <div className="px-3 py-2.5 col-span-2 sm:col-span-1 border-t border-border/50 sm:border-t-0">
                                      <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Doctor</p>
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                                          <span className="text-[8px] font-bold text-primary">{booking.assignedDoctor.charAt(0)}</span>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground truncate">Dr. {booking.assignedDoctor}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {booking.createdAt && (
                                  <div className="px-3 py-1.5 bg-muted/20 border-t border-border/40">
                                    <span className="text-[10px] text-muted-foreground">Booked on {format(new Date(booking.createdAt), "MMM d, yyyy · h:mm a")}</span>
                                  </div>
                                )}
                              </div>

                              {/* Contact */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                  <User className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact</span>
                                </div>
                                <div className="divide-y divide-border/40">
                                  <div className="px-3 py-2.5 flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                      <Phone className="h-3 w-3 text-primary" />
                                    </div>
                                    <span className="text-sm font-medium text-foreground">{booking.customerPhone}</span>
                                  </div>
                                  <div className="px-3 py-2.5 flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                      <Mail className="h-3 w-3 text-blue-500" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">{booking.customerEmail || "No email provided"}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Chief Complaints */}
                              {(complaints.length > 0 || booking.description) && (
                                <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                  <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                    <FlaskConical className="h-3 w-3 text-primary" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chief Complaint</span>
                                  </div>
                                  {complaints.length > 0 && (
                                    <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
                                      {complaints.map((c, i) => (
                                        <span key={i} className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 border border-primary/25 px-2 py-1 rounded-lg">
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {booking.description && complaints.length === 0 && (
                                    <p className="px-3 py-2.5 text-sm text-muted-foreground italic leading-relaxed">"{booking.description}"</p>
                                  )}
                                </div>
                              )}

                              {/* Consent Status */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <ClipboardCheck className="h-3 w-3 text-primary" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Digital Consent</span>
                                  </div>
                                  {booking.consentSignedAt ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="h-3 w-3" /> Signed
                                    </span>
                                  ) : null}
                                </div>
                                {booking.consentSignedAt ? (
                                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                      Signed on {format(new Date(booking.consentSignedAt), "dd MMM yyyy, hh:mm a")}
                                    </span>
                                    {booking.consentSignature && (
                                      <button
                                        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                                        onClick={() => generateConsentPdf(booking)}
                                        data-testid={`button-download-consent-${booking.id}`}
                                      >
                                        <Download className="h-3 w-3" />
                                        Download PDF
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-muted-foreground">Not yet signed</span>
                                    <button
                                      className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                                      onClick={() => { requestConsentMutation.mutate(booking.id); setModalTab(booking.id, 'actions'); }}
                                      disabled={requestConsentMutation.isPending && requestConsentMutation.variables === booking.id}
                                      data-testid={`button-request-consent-overview-${booking.id}`}
                                    >
                                      Request Consent →
                                    </button>
                                  </div>
                                )}
                                {!booking.consentSignedAt && consentUrls[booking.id] && (
                                  <div className="px-3 pb-2.5 space-y-2">
                                    <p className="text-[10px] text-muted-foreground">
                                      Link sent to <strong>{booking.customerPhone}</strong>. Share manually:
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex-1 bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-[10px] text-muted-foreground font-mono truncate">
                                        {consentUrls[booking.id]}
                                      </div>
                                      <button
                                        className="shrink-0 p-1.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                                        onClick={() => { navigator.clipboard.writeText(consentUrls[booking.id]); setCopiedConsentId(booking.id); setTimeout(() => setCopiedConsentId(null), 2000); }}
                                        data-testid={`button-copy-consent-${booking.id}`}
                                      >
                                        {copiedConsentId === booking.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                                      </button>
                                      <a href={consentUrls[booking.id]} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors" data-testid={`link-open-consent-${booking.id}`}>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>

                            </div>
                          )}

                          {/* CLINICAL TAB */}
                          {getModalTab(booking.id) === 'clinical' && (
                            <div className="p-4 space-y-3">

                              {/* Clinical Status — now interactive for admin */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                  <ClipboardCheck className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clinical Status</span>
                                </div>
                                <div className="px-3 py-3 flex flex-wrap gap-2">
                                  {([
                                    { value: 'first_visit', label: 'First Visit' },
                                    { value: 'revisit', label: 'Revisit' },
                                    { value: 'follow_up_required', label: 'Follow-up Required' },
                                    { value: 'case_closed', label: 'Case Closed' },
                                  ] as const).map(({ value, label }) => {
                                    const isActive = booking.clinicalStatus === value;
                                    return (
                                      <button
                                        key={value}
                                        onClick={() => updateClinicalStatusMutation.mutate({ bookingId: booking.id, clinicalStatus: value })}
                                        disabled={updateClinicalStatusMutation.isPending}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                          isActive
                                            ? value === 'case_closed'
                                              ? 'bg-green-500 text-white border-green-500'
                                              : value === 'follow_up_required'
                                              ? 'bg-amber-500 text-white border-amber-500'
                                              : value === 'revisit'
                                              ? 'bg-blue-500 text-white border-blue-500'
                                              : 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                        }`}
                                        data-testid={`clinical-status-${value}-${booking.id}`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Clinical Records */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                                  <ClipboardList className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clinical Records</span>
                                </div>
                                <div className="p-3">
                                  <ClinicalRecordsTab
                                    bookingId={booking.id}
                                    clinicId={clinic?.id ?? (booking.slot as any)?.clinicId}
                                    patientName={booking.customerName}
                                    patientPhone={booking.customerPhone}
                                    doctorName={booking.assignedDoctor}
                                    mode="admin"
                                    clinicName={clinic?.name}
                                  />
                                </div>
                              </div>

                            </div>
                          )}

                          {/* NOTES TAB */}
                          {getModalTab(booking.id) === 'notes' && (
                            <div className="p-4">
                              <BookingNotesThread bookingId={booking.id} authorType="clinic_admin" />
                            </div>
                          )}

                          {/* ACTIONS TAB */}
                          {getModalTab(booking.id) === 'actions' && (
                            <div className="p-4 space-y-3">

                              {/* Reschedule */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <CalendarDays className="h-3 w-3 text-primary" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reschedule Appointment</span>
                                  </div>
                                  {rescheduleBookingId === booking.id ? (
                                    <button
                                      className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                      onClick={() => { setRescheduleBookingId(null); setRescheduleSlot(null); }}
                                      data-testid="button-cancel-reschedule"
                                    >
                                      Collapse ↑
                                    </button>
                                  ) : (
                                    <button
                                      className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                                      onClick={() => { setRescheduleBookingId(booking.id); setRescheduleDate(new Date(booking.slot.startTime)); }}
                                      data-testid="button-start-reschedule"
                                    >
                                      Change →
                                    </button>
                                  )}
                                </div>
                                {rescheduleBookingId !== booking.id && (
                                  <div className="px-3 py-2.5">
                                    <p className="text-[12px] text-muted-foreground">Current: <span className="font-medium text-foreground">{format(bookingDateTime, "EEE, MMM d")} · {format(bookingDateTime, "h:mm a")} → {format(new Date(booking.slot.endTime), "h:mm a")}</span></p>
                                  </div>
                                )}
                                {rescheduleBookingId === booking.id && (
                                  <div className="px-3 py-3 space-y-3">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Select Date</span>
                                        <span className="text-[10px] text-muted-foreground">{format(rescheduleDate, "MMMM yyyy")}</span>
                                      </div>
                                      <ScrollArea className="w-full whitespace-nowrap pb-1">
                                        <div className="flex space-x-1.5 w-max pb-1">
                                          {dates.map((date) => (
                                            <button
                                              key={date.toISOString()}
                                              onClick={() => { setRescheduleDate(date); setRescheduleSlot(null); }}
                                              className={`flex flex-col items-center justify-center min-w-[2.75rem] h-11 rounded-xl border transition-all text-center ${
                                                isSameDay(date, rescheduleDate)
                                                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                                                  : 'bg-background border-border/60 hover:border-primary/40 hover:bg-primary/5'
                                              }`}
                                              data-testid={`reschedule-date-${format(date, 'yyyy-MM-dd')}`}
                                            >
                                              <span className="text-[8px] uppercase font-bold opacity-70">{format(date, "EEE")}</span>
                                              <span className="text-sm font-black leading-tight">{format(date, "d")}</span>
                                            </button>
                                          ))}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                      </ScrollArea>
                                    </div>
                                    <div className="space-y-1.5">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Select Slot</span>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        {slotTimings.map((slot) => {
                                          const slotTime = new Date(rescheduleDate);
                                          slotTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                                          const isoString = slotTime.toISOString();
                                          const currentBookings = bookings?.filter(b =>
                                            new Date(b.slot.startTime).toISOString() === isoString && b.id !== booking.id
                                          ).length || 0;
                                          const isFull = currentBookings >= 3;
                                          const isSelected = rescheduleSlot === slot.id;
                                          return (
                                            <button
                                              key={slot.id}
                                              onClick={() => !isFull && setRescheduleSlot(slot.id)}
                                              disabled={isFull}
                                              className={`relative flex flex-col items-center justify-center h-12 rounded-xl border text-center transition-all ${
                                                isSelected
                                                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                                                  : isFull
                                                  ? 'bg-muted/30 border-border/40 opacity-50 cursor-not-allowed'
                                                  : 'bg-background border-border/60 hover:border-primary/40 hover:bg-primary/5'
                                              }`}
                                              data-testid={`reschedule-slot-${slot.id}`}
                                            >
                                              <span className="text-[10px] font-bold leading-tight">{slot.label}</span>
                                              <span className="text-[9px] opacity-70 leading-tight">{formatTime(slot.startHour, slot.startMinute)}</span>
                                              {isFull && (
                                                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-destructive text-destructive-foreground px-1 rounded-full">FULL</span>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <Button
                                      className="w-full h-9 text-xs font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0"
                                      disabled={!rescheduleSlot || rescheduleMutation.isPending}
                                      onClick={async () => {
                                        if (!rescheduleSlot) return;
                                        const slotInfo = slotTimings.find(s => s.id === rescheduleSlot);
                                        if (!slotInfo) return;
                                        const newSlotTime = new Date(rescheduleDate);
                                        newSlotTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
                                        try {
                                          const configResponse = await apiRequest('POST', '/api/auth/clinic/slots/configure', {
                                            startTime: newSlotTime.toISOString(), maxBookings: 3, isCancelled: false
                                          });
                                          if (!configResponse.ok) throw new Error('Failed to ensure slot exists');
                                          const configResult = await configResponse.json();
                                          const newSlotId = configResult.id;
                                          if (newSlotId) {
                                            rescheduleMutation.mutate({ bookingId: booking.id, newSlotId });
                                          } else {
                                            throw new Error("Invalid slot ID received from server");
                                          }
                                        } catch (error: any) {
                                          toast({ title: "Failed to reschedule", description: error.message, variant: "destructive" });
                                        }
                                      }}
                                      data-testid="button-confirm-reschedule"
                                    >
                                      {rescheduleMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                      Confirm Reschedule
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Digital Consent */}
                              <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <ClipboardCheck className="h-3 w-3 text-primary" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request Digital Consent</span>
                                  </div>
                                  {booking.consentSignedAt ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="h-3 w-3" /> Signed
                                    </span>
                                  ) : (
                                    <button
                                      className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                                      onClick={() => requestConsentMutation.mutate(booking.id)}
                                      disabled={requestConsentMutation.isPending && requestConsentMutation.variables === booking.id}
                                      data-testid={`button-request-consent-${booking.id}`}
                                    >
                                      {requestConsentMutation.isPending && requestConsentMutation.variables === booking.id
                                        ? "Sending…"
                                        : consentUrls[booking.id] ? "Resend →" : "Send Link →"}
                                    </button>
                                  )}
                                </div>
                                {!booking.consentSignedAt && (
                                  <div className="px-3 py-2.5">
                                    {consentUrls[booking.id] ? (
                                      <div className="space-y-2">
                                        <p className="text-[10px] text-muted-foreground">
                                          WhatsApp link sent to <strong>{booking.customerPhone}</strong>. Share manually if needed:
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                          <div className="flex-1 bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-[10px] text-muted-foreground font-mono truncate">
                                            {consentUrls[booking.id]}
                                          </div>
                                          <button
                                            className="shrink-0 p-1.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                                            onClick={() => { navigator.clipboard.writeText(consentUrls[booking.id]); setCopiedConsentId(booking.id); setTimeout(() => setCopiedConsentId(null), 2000); }}
                                            data-testid={`button-copy-consent-actions-${booking.id}`}
                                          >
                                            {copiedConsentId === booking.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                                          </button>
                                          <a href={consentUrls[booking.id]} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors" data-testid={`link-open-consent-actions-${booking.id}`}>
                                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                          </a>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[12px] text-muted-foreground">Send a digital consent form to the patient via WhatsApp or SMS.</p>
                                    )}
                                  </div>
                                )}
                                {booking.consentSignedAt && (
                                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                      Signed on {format(new Date(booking.consentSignedAt), "dd MMM yyyy, hh:mm a")}
                                    </span>
                                    {booking.consentSignature && (
                                      <button
                                        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                                        onClick={() => generateConsentPdf(booking)}
                                        data-testid={`button-download-consent-actions-${booking.id}`}
                                      >
                                        <Download className="h-3 w-3" />
                                        Download PDF
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Assign Doctor */}
                              {(clinic?.doctorName || (clinic?.doctors && (clinic.doctors as any[]).length > 0)) && (() => {
                                const bookingDateStr = format(new Date(booking.slot.startTime), 'yyyy-MM-dd');
                                const isOOO = (email?: string, name?: string) =>
                                  allDoctorLeaves.some(l =>
                                    l.leaveDate === bookingDateStr &&
                                    ((email && l.doctorEmail === email) || (name && l.doctorName === name))
                                  );
                                const oooReason = (email?: string, name?: string) =>
                                  allDoctorLeaves.find(l =>
                                    l.leaveDate === bookingDateStr &&
                                    ((email && l.doctorEmail === email) || (name && l.doctorName === name))
                                  )?.reason;
                                return (
                                  <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                                    <div className="px-3 py-2 bg-muted/40 border-b border-border/50 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <Stethoscope className="h-3 w-3 text-primary" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assign Doctor</span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">{format(new Date(booking.slot.startTime), "MMM d · h:mm a")}</span>
                                    </div>
                                    <div className="p-2.5 space-y-1.5">
                                      {clinic?.doctorName && (() => {
                                        const isAssigned = booking.assignedDoctor === clinic.doctorName;
                                        const outOfOffice = isOOO(undefined, clinic.doctorName);
                                        const reason = oooReason(undefined, clinic.doctorName);
                                        const btn = (
                                          <button
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                              isAssigned
                                                ? 'bg-primary border-primary shadow-md shadow-primary/20'
                                                : outOfOffice
                                                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 opacity-80 hover:opacity-100'
                                                : 'bg-background border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm'
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); assignDoctorMutation.mutate({ bookingId: booking.id, doctorName: clinic.doctorName!, doctorEmail: undefined }); }}
                                            disabled={assignDoctorMutation.isPending}
                                          >
                                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isAssigned ? 'bg-white/20 border border-white/30' : 'bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20'}`}>
                                              <span className={`text-xs font-bold ${isAssigned ? 'text-white' : 'text-primary'}`}>{clinic.doctorName.charAt(0)}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className={`text-xs font-semibold leading-tight truncate ${isAssigned ? 'text-white' : 'text-foreground'}`}>{clinic.doctorName}</p>
                                              <p className={`text-[10px] ${isAssigned ? 'text-white/70' : outOfOffice ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                                {outOfOffice ? '⚠ Out of office' : (clinic.doctorSpecialization || 'Lead Doctor')}
                                              </p>
                                            </div>
                                            {isAssigned && <CheckCircle2 className="h-4 w-4 text-white shrink-0" />}
                                          </button>
                                        );
                                        return outOfOffice ? (
                                          <TooltipProvider key="lead" delayDuration={100}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                              <TooltipContent side="top" className="text-xs max-w-[200px] bg-amber-900 text-amber-100 border-amber-700">
                                                <p className="font-semibold">Out of office on {format(new Date(booking.slot.startTime), 'MMM d')}</p>
                                                {reason && <p className="text-amber-300 mt-0.5">{reason}</p>}
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        ) : btn;
                                      })()}
                                      {clinic?.doctors && Array.isArray(clinic.doctors) && (clinic.doctors as any[]).map((doctor, idx) => {
                                        const isAssigned = booking.assignedDoctor === doctor.name;
                                        const outOfOffice = isOOO(doctor.email, doctor.name);
                                        const reason = oooReason(doctor.email, doctor.name);
                                        const btn = (
                                          <button
                                            key={idx}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                              isAssigned
                                                ? 'bg-primary border-primary shadow-md shadow-primary/20'
                                                : outOfOffice
                                                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 opacity-80 hover:opacity-100'
                                                : 'bg-background border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm'
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); assignDoctorMutation.mutate({ bookingId: booking.id, doctorName: doctor.name, doctorEmail: doctor.email }); }}
                                            disabled={assignDoctorMutation.isPending}
                                          >
                                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isAssigned ? 'bg-white/20 border border-white/30' : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-300/30'}`}>
                                              <span className={`text-xs font-bold ${isAssigned ? 'text-white' : 'text-emerald-600'}`}>{doctor.name.charAt(0)}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className={`text-xs font-semibold leading-tight truncate ${isAssigned ? 'text-white' : 'text-foreground'}`}>Dr. {doctor.name}</p>
                                              <p className={`text-[10px] ${isAssigned ? 'text-white/70' : outOfOffice ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                                {outOfOffice ? '⚠ Out of office' : `${doctor.specialization}${doctor.degree ? ` · ${doctor.degree}` : ''}`}
                                              </p>
                                            </div>
                                            {isAssigned && <CheckCircle2 className="h-4 w-4 text-white shrink-0" />}
                                          </button>
                                        );
                                        return outOfOffice ? (
                                          <TooltipProvider key={idx} delayDuration={100}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                              <TooltipContent side="top" className="text-xs max-w-[200px] bg-amber-900 text-amber-100 border-amber-700">
                                                <p className="font-semibold">Out of office on {format(new Date(booking.slot.startTime), 'MMM d')}</p>
                                                {reason && <p className="text-amber-300 mt-0.5">{reason}</p>}
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        ) : btn;
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}

                            </div>
                          )}

                          {/* BILLING TAB */}
                          {getModalTab(booking.id) === 'billing' && (
                            <div className="p-4">
                              <BillingHistoryPanel
                                bookingId={booking.id}
                                onGenerateReceipt={() => handleOpenBilling(booking)}
                                onPrintBill={printBillFromRecord}
                              />
                            </div>
                          )}

                        </div>

                        {/* ── PERSISTENT FOOTER ── */}
                        <div className="shrink-0 px-4 py-3 border-t border-border/50 bg-muted/10 flex gap-2">
                          {/* Confirm / Confirmed status */}
                          {!isBookingPast && booking.verificationStatus !== 'confirmed' && (
                            <Button
                              className="flex-1 gap-1.5 h-9 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border-0 shadow-md shadow-emerald-500/20 text-white"
                              onClick={() => confirmBookingMutation.mutate(booking.id)}
                              disabled={confirmBookingMutation.isPending}
                              data-testid={`button-dialog-confirm-${booking.id}`}
                            >
                              {confirmBookingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Confirm
                            </Button>
                          )}
                          {booking.verificationStatus === 'confirmed' && (
                            <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs font-semibold">Confirmed</span>
                              {booking.confirmedBy && (
                                <span className="text-[10px] font-normal opacity-75">· by {booking.confirmedBy === 'doctor' ? `Dr. ${booking.assignedDoctor || 'Doctor'}` : 'Admin'}</span>
                              )}
                            </div>
                          )}
                          {/* Generate Bill */}
                          <Button
                            className="flex-1 gap-1.5 h-9 text-xs font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20"
                            onClick={() => handleOpenBilling(booking)}
                            data-testid={`button-dialog-bill-${booking.id}`}
                          >
                            <IndianRupee className="h-3.5 w-3.5" />
                            Generate Bill
                          </Button>
                          {/* Cancel Booking */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="gap-1.5 h-9 text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
                                data-testid={`button-dialog-cancel-${booking.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Permanently remove {booking.customerName}'s appointment.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Back</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelBookingMutation.mutate(booking.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Cancel Booking
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                      </DialogContent>
                    </Dialog>

                    {/* Quick-action footer */}
                    <div className="px-4 py-2.5 flex items-center gap-2 border-t border-border/50 bg-muted/20">
                      {!isBookingPast && booking.verificationStatus !== 'confirmed' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 h-7 gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-400/10"
                            onClick={(e) => { e.stopPropagation(); confirmBookingMutation.mutate(booking.id); }}
                            disabled={confirmBookingMutation.isPending}
                            data-testid={`button-confirm-${booking.id}`}
                          >
                            {confirmBookingMutation.isPending
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle2 className="h-3 w-3" />}
                            Confirm
                          </Button>
                          <div className="h-4 w-px bg-border/60 shrink-0" />
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-7 gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-background/80"
                        onClick={(e) => { e.stopPropagation(); handleOpenBilling(booking); }}
                        data-testid={`button-bill-${booking.id}`}
                      >
                        <IndianRupee className="h-3 w-3" />
                        Bill
                      </Button>
                      <div className="h-4 w-px bg-border/60 shrink-0" />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 h-7 gap-1.5 text-[11px] font-semibold text-destructive/70 hover:text-destructive hover:bg-destructive/5"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-cancel-booking-${booking.id}`}
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Permanently remove {booking.customerName}'s appointment.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Back</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => cancelBookingMutation.mutate(booking.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Cancel Booking
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </Card>
                    )
                  ].filter(Boolean) as React.ReactNode[];
                  });
                })()
              )}
            </div>
          )}
          </div>
            </div>
            </div>
          )}

          {/* CONFIGURE SLOTS PANEL */}
          {activePanel === 'configure-slots' && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-white" />
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Configure Slots</h2>
                  <p className="text-white/70 text-[11px] mt-0.5">Set capacity and manage cancellations</p>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 text-left">
                      <Label className="block">Max Bookings</Label>
                      <Input
                        type="number"
                        min="0"
                        value={configMaxBookings}
                        onChange={(e) => setConfigMaxBookings(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-8">
                      <input
                        type="checkbox"
                        id="is-cancelled"
                        checked={configIsCancelled}
                        onChange={(e) => setConfigIsCancelled(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="is-cancelled">Cancel this slot</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-left block">Select Date &amp; Time</Label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                      <ScrollArea className="w-full whitespace-nowrap pb-2">
                        <div className="flex space-x-3 px-1 py-1">
                          {dates.map((date) => (
                            <button
                              key={date.toISOString()}
                              onClick={() => setConfigDate(date)}
                              className={`flex flex-col items-center justify-center min-w-[4.5rem] h-16 rounded-xl border transition-all ${isSameDay(date, configDate) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'}`}
                            >
                              <span className="text-[10px] uppercase">{format(date, "EEE")}</span>
                              <span className="text-lg font-bold">{format(date, "d")}</span>
                            </button>
                          ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {slotTimings.map((slot) => (
                        <Button
                          key={slot.id}
                          variant={selectedSlot === slot.id ? "default" : "outline"}
                          className="h-12"
                          onClick={() => setSelectedSlot(slot.id)}
                        >
                          {slot.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleConfigureSlot}
                    disabled={!selectedSlot || configureSlotMutation.isPending}
                  >
                    {configureSlotMutation.isPending ? <Loader2 className="animate-spin" /> : "Update Configuration"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MANAGE DOCTORS PANEL */}
          {activePanel === 'manage-doctors' && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#085041] to-[#0F9B6E] px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Stethoscope className="h-5 w-5 text-white" />
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Manage Doctors</h2>
                    <p className="text-white/70 text-[11px] mt-0.5">Add and manage practitioners</p>
                  </div>
                </div>
                <Badge className="bg-white/20 text-white border-white/30 text-xs hover:bg-white/20">
                  {clinicData?.doctors?.length || 0} {(clinicData?.doctors?.length || 0) === 1 ? 'doctor' : 'doctors'}
                </Badge>
              </div>
              <div className="p-5 space-y-4">
                <div className="border-t border-border/30 px-4 pb-4 pt-3">
                  <div className="space-y-4">

                  {/* Current Doctors List */}
                  {clinicData?.doctors && clinicData.doctors.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Current Doctors</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                          <Stethoscope className="h-3 w-3" />
                          {clinicData.doctors.length} {clinicData.doctors.length === 1 ? "doctor" : "doctors"}
                        </span>
                      </div>
                      <div className="grid gap-3">
                        {clinicData.doctors.map((doctor, index) => (
                          <div
                            key={index}
                            className="relative rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group"
                            data-testid={`doctor-card-${index}`}
                          >
                            {/* Gradient left accent bar */}
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-accent via-primary to-accent" />

                            {/* Subtle tinted background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent pointer-events-none" />

                            <div className="relative flex items-center gap-4 px-5 py-4 pl-5">
                              {/* Avatar with index badge */}
                              <div className="relative shrink-0">
                                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/25 ring-2 ring-primary/10 group-hover:ring-primary/25 transition-all duration-300 flex items-center justify-center overflow-hidden shadow-sm">
                                  {doctor.imageUrl ? (
                                    <img src={doctor.imageUrl} alt={doctor.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-sm font-bold bg-gradient-to-br from-accent to-primary bg-clip-text text-transparent">
                                      {doctor.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span className="absolute -bottom-1 -right-1 font-mono text-[9px] font-bold bg-muted border border-border/60 text-muted-foreground px-1 py-px rounded-full leading-none">
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                              </div>

                              {/* Doctor info */}
                              <div className="flex-1 text-left min-w-0">
                                {/* Name + active pill */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-sm tracking-tight">Dr. {doctor.name}</p>
                                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-px rounded-full">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                  </span>
                                </div>

                                {/* Specialization + degree badges */}
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <span className="inline-flex items-center text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                                    {doctor.specialization}
                                  </span>
                                  {doctor.degree && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted border border-border/60 px-2 py-0.5 rounded-full">
                                      <GraduationCap className="h-2.5 w-2.5" />
                                      {doctor.degree}
                                    </span>
                                  )}
                                </div>

                                {/* Email */}
                                {doctor.email && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                    <span className="text-[11px] font-mono text-muted-foreground truncate">{doctor.email}</span>
                                  </div>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1 shrink-0">
                              {(() => {
                                const linked = linkedDoctors.find(d => d.email === doctor.email);
                                if (!linked) return null;
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                                          onClick={() => {
                                            setResetPwdDoctorId(linked.id);
                                            setResetPwdDoctorName(linked.name);
                                            setResetPwdDoctorEmail(linked.email);
                                            setResetPwdNew("");
                                            setResetPwdConfirm("");
                                            setResetPwdOpen(true);
                                          }}
                                          data-testid={`button-reset-password-${index}`}
                                        >
                                          <KeyRound className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reset password</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })()}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    data-testid={`button-remove-doctor-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Doctor?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {doctor.name} from your clinic? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => removeDoctorMutation.mutate(index)}
                                      className="bg-destructive text-destructive-foreground"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-muted/20 rounded-xl border border-dashed">
                      <div className="p-3 bg-muted/50 rounded-full w-fit mx-auto mb-3">
                        <Stethoscope className="h-7 w-7 text-muted-foreground/60" />
                      </div>
                      <p className="font-medium text-muted-foreground">No doctors added yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Add your first doctor using the form below</p>
                    </div>
                  )}

                  {/* Add New Doctor Panel */}
                  <div className="rounded-xl overflow-hidden border border-border/60 shadow-sm">

                    {/* Panel header */}
                    <div className="bg-gradient-to-r from-primary to-accent px-5 py-3.5 flex items-center gap-3">
                      <div className="p-1.5 bg-white/20 rounded-lg">
                        <UserPlus className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm leading-tight">Add a New Doctor</h3>
                        <p className="text-white/70 text-xs">Register a new practitioner to your clinic profile</p>
                      </div>
                    </div>

                    {/* Panel body */}
                    <div className="p-5 bg-card">
                      <div className="grid gap-5 lg:grid-cols-2">

                        {/* Left: Photo upload */}
                        <div className="space-y-2 flex flex-col items-center lg:items-start">
                          <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Doctor Photo</Label>
                          <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 w-fit">
                            <ImageUpload
                              currentImage={newDoctorImageUrl || undefined}
                              onImageUploaded={(url) => setNewDoctorImageUrl(url)}
                              folder="doctors"
                              fallbackText={newDoctorName ? newDoctorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : "Dr"}
                            />
                            <p className="text-[10px] text-muted-foreground text-center">Click photo to upload</p>
                          </div>
                        </div>

                        {/* Right: Form fields */}
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="doctor-name" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Name</Label>
                            <Input
                              id="doctor-name"
                              value={newDoctorName}
                              onChange={(e) => setNewDoctorName(e.target.value)}
                              placeholder="John Smith"
                              data-testid="input-doctor-name"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="doctor-email" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Email</Label>
                            <Input
                              id="doctor-email"
                              type="email"
                              value={newDoctorEmail}
                              onChange={(e) => setNewDoctorEmail(e.target.value)}
                              placeholder="doctor@example.com"
                              data-testid="input-doctor-email"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="doctor-specialization" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Specialization</Label>
                              <SpecializationInput
                                id="doctor-specialization"
                                value={newDoctorSpecialization}
                                onChange={setNewDoctorSpecialization}
                                placeholder="General Dentist"
                                data-testid="input-doctor-specialization"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="doctor-degree" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Degree (Optional)</Label>
                              <Input
                                id="doctor-degree"
                                value={newDoctorDegree}
                                onChange={(e) => setNewDoctorDegree(e.target.value)}
                                placeholder="BDS, MDS"
                                data-testid="input-doctor-degree"
                              />
                            </div>
                          </div>
                          <Button
                            onClick={handleAddDoctor}
                            disabled={!newDoctorName || !newDoctorSpecialization || !newDoctorEmail || addDoctorMutation.isPending}
                            className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium shadow-md shadow-primary/20 mt-1"
                            data-testid="button-add-doctor"
                          >
                            {addDoctorMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <UserPlus className="h-4 w-4 mr-2" />
                            )}
                            Add Doctor
                          </Button>
                        </div>

                      </div>
                    </div>
                  </div>

              </div>
            </div>
          </div>
        </div>
          )}

          {/* CLINIC PROFILE PANEL */}
          {activePanel === 'clinic-profile' && (
            <div className="space-y-5">

              {/* Panel header */}
              <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
                <div className="bg-gradient-to-r from-violet-600 to-violet-400 px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight">Clinic Profile</h2>
                      <p className="text-white/70 text-[11px] mt-0.5">Update your public About page details</p>
                    </div>
                  </div>
                  <a
                    href={`/clinic/${clinic?.username || clinic?.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-preview-about"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-semibold"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Preview
                  </a>
                </div>

                {/* Locked identity row */}
                <div className="px-5 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-3">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clinic Name</span>
                    <p className="text-sm font-semibold text-foreground truncate">{clinic?.name}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground shrink-0">
                    Managed by platform
                  </Badge>
                </div>

                {/* Editable fields */}
                <div className="p-5 bg-card space-y-6">

                  {/* Contact section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                        <Phone className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contact Information</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="profile-phone" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            id="profile-phone"
                            value={profilePhone}
                            onChange={(e) => setProfilePhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="pl-9"
                            data-testid="input-profile-phone"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="profile-email" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            id="profile-email"
                            type="email"
                            value={profileEmail}
                            onChange={(e) => setProfileEmail(e.target.value)}
                            placeholder="clinic@example.com"
                            className="pl-9"
                            data-testid="input-profile-email"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="profile-website" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Website</Label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            id="profile-website"
                            value={profileWebsite}
                            onChange={(e) => setProfileWebsite(e.target.value)}
                            placeholder="https://yourclinic.com"
                            className="pl-9"
                            data-testid="input-profile-website"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Address section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                        <MapPin className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Address</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="profile-address" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Street Address</Label>
                        <Input
                          id="profile-address"
                          value={profileAddress}
                          onChange={(e) => setProfileAddress(e.target.value)}
                          placeholder="123 Main Street, Area"
                          data-testid="input-profile-address"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="profile-city" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">City</Label>
                        <Input
                          id="profile-city"
                          value={profileCity}
                          onChange={(e) => setProfileCity(e.target.value)}
                          placeholder="Mumbai"
                          data-testid="input-profile-city"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="profile-pincode" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Pincode</Label>
                        <Input
                          id="profile-pincode"
                          value={profilePincode}
                          onChange={(e) => setProfilePincode(e.target.value)}
                          placeholder="400001"
                          data-testid="input-profile-pincode"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Map location section */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                        <MapPin className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Map Location</h3>
                      {profileLatitude && profileLongitude && (
                        <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
                          Pin saved
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Search your clinic or click on the map to drop a pin. Patients will see this map on your public profile page.
                    </p>
                    <MapLocationPicker
                      latitude={profileLatitude}
                      longitude={profileLongitude}
                      onChange={(lat, lng) => { setProfileLatitude(lat); setProfileLongitude(lng); }}
                    />
                  </div>

                  <Separator />

                  {/* Primary doctor section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Primary Practitioner</h3>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-doctor-name" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Doctor Name</Label>
                      <Input
                        id="profile-doctor-name"
                        value={profileDoctorName}
                        onChange={(e) => setProfileDoctorName(e.target.value)}
                        placeholder="Jane Smith"
                        data-testid="input-profile-doctor-name"
                      />
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                        <Info className="h-3 w-3" />
                        This is the lead doctor shown on your About page. Individual doctors are managed in Manage Doctors.
                      </p>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex items-center justify-end pt-2">
                    <Button
                      onClick={() => updateProfileMutation.mutate({
                        phone: profilePhone,
                        email: profileEmail,
                        website: profileWebsite,
                        address: profileAddress,
                        city: profileCity,
                        pincode: profilePincode,
                        doctorName: profileDoctorName,
                        latitude: profileLatitude,
                        longitude: profileLongitude,
                      })}
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                      className="rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25 hover:-translate-y-0.5 transition-all px-6"
                    >
                      {updateProfileMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                      ) : (
                        "Save Profile"
                      )}
                    </Button>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* BOOK A SLOT PANEL */}
          {activePanel === 'book-a-slot' && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-accent px-5 py-4 flex items-center gap-3">
                <Plus className="h-5 w-5 text-white" />
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Book a Slot</h2>
                  <p className="text-white/70 text-[11px] mt-0.5">Create a new patient appointment</p>
                </div>
              </div>
              <div className="p-5">
              <div className="border-t border-border/30 px-4 pb-4 pt-3">
                {bookingSuccess ? (
                  <div className="py-8 flex flex-col items-center gap-4">
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                    <div className="text-center">
                      <h3 className="text-lg font-semibold">Booking Confirmed!</h3>
                      <p className="text-muted-foreground mt-1">
                        Appointment on {format(bookingDate, "MMMM do, yyyy")} has been booked.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        resetBookingForm();
                      }}
                      className="mt-2"
                      data-testid="button-book-another"
                    >
                      Book Another
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Patient Details */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="booking-name" className="text-left block">Patient Name</Label>
                        <Input
                          id="booking-name"
                          value={bookingName}
                          onChange={(e) => setBookingName(e.target.value)}
                          placeholder="John Doe"
                          data-testid="input-booking-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="booking-phone" className="text-left block">Phone Number</Label>
                        <div className="space-y-1">
                          <Input
                            id="booking-phone"
                            value={bookingPhone}
                            onChange={(e) => handleBookingPhoneChange(e.target.value)}
                            className={phoneError ? "border-destructive" : ""}
                            placeholder="+91 9876543210"
                            data-testid="input-booking-phone"
                          />
                          {phoneError && (
                            <p className="text-xs text-destructive">{phoneError}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="booking-email" className="text-left block">Email</Label>
                        <Input
                          id="booking-email"
                          type="email"
                          value={bookingEmail}
                          onChange={(e) => setBookingEmail(e.target.value)}
                          placeholder="patient@example.com"
                          data-testid="input-booking-email"
                        />
                      </div>
                    </div>

                    {/* Chief Complaints Section */}
                    <div className="space-y-3 py-2">
                      <Label className="text-sm font-semibold text-left block">CHIEF COMPLAINTS</Label>
                      <div className="flex flex-wrap gap-2">
                        {CHIEF_COMPLAINTS.map((complaint) => {
                          const isSelected = bookingDescription.split(", ").includes(complaint);
                          return (
                            <Badge
                              key={complaint}
                              variant={isSelected ? "default" : "outline"}
                              className="cursor-pointer transition-all hover:scale-105 active:scale-95 px-3 py-1"
                              onClick={() => handleComplaintClick(complaint)}
                            >
                              {complaint}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="booking-description" className="text-left block">Description</Label>
                      <textarea
                        id="booking-description"
                        value={bookingDescription}
                        onChange={(e) => setBookingDescription(e.target.value)}
                        placeholder="Describe patient issue..."
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    {/* Date Selection */}
                    <div className="space-y-2">
                      <Label className="text-left block">Select Date</Label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        <div className="flex-1 w-full overflow-hidden">
                          <ScrollArea className="w-full whitespace-nowrap pb-2">
                            <div className="flex space-x-3 px-1 py-1">
                              {dates.map((date) => {
                                const isSelected = isSameDay(date, bookingDate);
                                return (
                                  <button
                                    key={date.toISOString()}
                                    onClick={() => setBookingDate(date)}
                                    data-testid={`booking-date-${format(date, 'yyyy-MM-dd')}`}
                                    className={`
                                      flex flex-col items-center justify-center min-w-[4.5rem] h-16 rounded-xl border transition-all duration-200
                                      ${isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105'
                                        : 'bg-card hover:border-primary/50 hover:bg-muted/50'}
                                    `}
                                  >
                                    <span className="text-[10px] font-medium uppercase mb-0.5 opacity-80">
                                      {format(date, "EEE")}
                                    </span>
                                    <span className="text-lg font-bold">
                                      {format(date, "d")}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </div>

                        <div className="flex-shrink-0 pb-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-16 w-full sm:w-14 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-muted/50 transition-all"
                                data-testid="button-booking-calendar"
                              >
                                <CalendarIcon className="h-5 w-5 text-muted-foreground mr-2 sm:mr-0" />
                                <span className="sm:hidden font-medium">Choose from calendar</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-xl shadow-2xl border-border/50" align="end">
                              <Calendar
                                mode="single"
                                selected={bookingDate}
                                onSelect={(date) => {
                                  if (date) setBookingDate(date);
                                }}
                                disabled={(date) => date < startOfToday()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>

                    {/* Time Slot Selection */}
                    <div className="space-y-2">
                      <Label className="text-left block">Select Time Slot</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {slotTimings.filter(slot => {
                          const startTime = new Date(bookingDate);
                          startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                          const isoString = startTime.toISOString();

                          if (localStorage.getItem("demo_clinic_active") === "true") {
                            const storedConfigs = localStorage.getItem("demo_slot_configs");
                            const configs = storedConfigs ? JSON.parse(storedConfigs) : {};
                            if (configs[isoString]?.isCancelled) return false;

                            // Check capacity
                            const maxBookings = configs[isoString]?.maxBookings ?? 3;
                            const currentBookings = bookings?.filter(b =>
                              new Date(b.slot.startTime).toISOString() === isoString
                            ).length || 0;

                            return true;
                          } else {
                            // Logic for registered clinics
                            // Filter out slots that are cancelled
                            const existingBookingWithSlot = bookings?.find(b =>
                              new Date(b.slot.startTime).toISOString() === isoString
                            );
                            if (existingBookingWithSlot?.slot.isCancelled) return false;

                            return true;
                          }
                        }).map((slot) => {
                          const startTime = new Date(bookingDate);
                          startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                          const isoString = startTime.toISOString();

                          let isFull = false;
                          let maxBookings = 3;

                          if (localStorage.getItem("demo_clinic_active") === "true") {
                            const storedConfigs = localStorage.getItem("demo_slot_configs");
                            const configs = storedConfigs ? JSON.parse(storedConfigs) : {};
                            maxBookings = configs[isoString]?.maxBookings ?? 3;
                            const currentBookings = bookings?.filter(b =>
                              new Date(b.slot.startTime).toISOString() === isoString
                            ).length || 0;
                            isFull = currentBookings >= maxBookings;
                          } else {
                            // Logic for registered clinics using backend data
                            const currentBookings = bookings?.filter(b =>
                              new Date(b.slot.startTime).toISOString() === isoString
                            ).length || 0;

                            // Try to find maxBookings from any existing booking's slot info
                            const existingBookingWithSlot = bookings?.find(b =>
                              new Date(b.slot.startTime).toISOString() === isoString
                            );

                            maxBookings = existingBookingWithSlot?.slot.maxBookings ?? 3;
                            isFull = currentBookings >= maxBookings;
                          }

                          const slotLabel = `${formatTime(slot.startHour, slot.startMinute)} - ${formatTime(slot.endHour, slot.endMinute)}`;
                          return (
                            <TooltipProvider key={slot.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => !isFull && setSelectedSlot(slot.id)}
                                    disabled={isFull}
                                    data-testid={`booking-slot-${slot.id}`}
                                    className={`p-5 sm:p-4 rounded-xl border text-center transition-all relative ${selectedSlot === slot.id
                                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                                      : isFull
                                        ? "border-destructive/30 bg-destructive/5 cursor-not-allowed"
                                        : "border-border hover:bg-muted/50 hover:border-primary/50"
                                      }`}
                                  >
                                    <div className={`font-semibold text-base sm:text-base ${isFull ? "text-destructive/70" : ""}`}>
                                      {slot.label}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">{slotLabel}</div>
                                    {isFull && (
                                      <Badge variant="destructive" className="absolute -top-2 -right-2 px-1.5 py-0 text-[10px] h-4">
                                        Full
                                      </Badge>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                {isFull && (
                                  <TooltipContent>
                                    <p>Booking closed for this slot</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                      onClick={handleCreateBooking}
                      disabled={!bookingName || !isPhoneValid || !bookingEmail || !selectedSlot || createBookingMutation.isPending}
                      className="w-full sm:w-auto"
                      data-testid="button-create-booking"
                    >
                      {createBookingMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Booking...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Create Booking
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* EXPORT DATA PANEL */}
          {activePanel === 'export-data' && (
            <ExportDataPanel clinic={clinic} bookings={bookings} />
          )}

          {/* INVENTORY PANEL */}
          {activePanel === 'inventory' && (
            <InventoryPanel clinicId={clinic.id} />
          )}

          {/* WEBSITE PANEL */}
          {activePanel === 'website' && (
            <div className="p-6 sm:p-8">
              <WebsiteConfigPanel clinic={clinic} />
            </div>
          )}

          {/* ACCOUNTS PANEL */}
          {activePanel === 'accounts' && (() => {
            const filtered = allBills.filter(bill => {
              const matchesSearch = !accountsSearch ||
                bill.patientName.toLowerCase().includes(accountsSearch.toLowerCase()) ||
                (bill.patientPhone ?? "").includes(accountsSearch) ||
                (bill.billNumber ?? "").toLowerCase().includes(accountsSearch.toLowerCase());
              const matchesStatus = accountsStatusFilter === 'all' || bill.paymentStatus === accountsStatusFilter;
              return matchesSearch && matchesStatus;
            });

            const totalRevenue = allBills.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.total ?? 0), 0);
            const pendingAmt   = allBills.filter(b => b.paymentStatus === 'pending').reduce((s, b) => s + (b.total ?? 0), 0);
            const paidCount    = allBills.filter(b => b.paymentStatus === 'paid').length;

            return (
              <div className="p-6 sm:p-8 space-y-6">
                {/* Header */}
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Patient Accounts</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Complete billing history across all patient visits</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Receipts</p>
                    <p className="text-2xl font-black text-foreground">{allBills.length}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{paidCount} paid</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Collected</p>
                    <p className="text-2xl font-black text-primary">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">from paid bills</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Pending</p>
                    <p className="text-2xl font-black text-amber-600">₹{pendingAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">outstanding balance</p>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={accountsSearch}
                      onChange={e => setAccountsSearch(e.target.value)}
                      placeholder="Search by patient name, phone, or receipt #…"
                      className="pl-8 h-9 text-sm"
                      data-testid="input-accounts-search"
                    />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['all', 'paid', 'pending', 'partial'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setAccountsStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                          accountsStatusFilter === s
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                        data-testid={`filter-accounts-${s}`}
                      >
                        {s === 'all' ? `All (${allBills.length})` : s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bill list */}
                {filtered.length === 0 ? (
                  <div className="py-16 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
                    <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
                      <IndianRupee className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium text-muted-foreground">
                      {allBills.length === 0 ? "No receipts generated yet" : "No results match your search"}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {allBills.length === 0
                        ? "Open any booking and click 'Generate Receipt' to create your first bill"
                        : "Try adjusting your search or status filter"}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    {/* Table header */}
                    <div className="hidden sm:grid grid-cols-[1fr_120px_100px_90px_80px] gap-4 px-4 py-2 bg-muted/40 border-b border-border/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Patient</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receipt #</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Status</span>
                    </div>
                    <div className="divide-y divide-border/40">
                      {filtered.map((bill) => {
                        const isUpdating = updateBillStatusMutation.isPending && updateBillStatusMutation.variables?.id === bill.id;
                        const statusCycle: Record<string, string> = { pending: 'paid', partial: 'paid', paid: 'pending' };
                        const nextStatus = statusCycle[bill.paymentStatus ?? 'pending'] ?? 'paid';
                        return (
                          <div
                            key={bill.id}
                            className="grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_90px_1fr] gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/20 transition-colors items-center group"
                            data-testid={`accounts-row-${bill.id}`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{bill.patientName}</p>
                              <p className="text-[10px] text-muted-foreground">{bill.patientPhone || "—"}</p>
                            </div>
                            <p className="text-xs font-mono text-muted-foreground truncate">{bill.billNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : "—"}
                            </p>
                            <p className="text-sm font-bold text-primary text-right">
                              ₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Status badge — always visible */}
                              {bill.paymentStatus === 'paid' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Paid
                                </span>
                              )}
                              {bill.paymentStatus === 'pending' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                                  <Clock className="h-2.5 w-2.5" /> Pending
                                </span>
                              )}
                              {bill.paymentStatus === 'partial' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                                  Partial
                                </span>
                              )}

                              {/* Mark as Paid / Unpaid — appears on hover */}
                              <button
                                className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg border ${
                                  nextStatus === 'paid'
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-400'
                                    : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'
                                }`}
                                onClick={() => updateBillStatusMutation.mutate({ id: bill.id, paymentStatus: nextStatus })}
                                disabled={isUpdating}
                                title={nextStatus === 'paid' ? 'Mark as Paid' : 'Mark as Pending'}
                                data-testid={`accounts-status-toggle-${bill.id}`}
                              >
                                {isUpdating
                                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  : nextStatus === 'paid'
                                    ? <><CheckCircle2 className="h-2.5 w-2.5" /> Mark Paid</>
                                    : <><Clock className="h-2.5 w-2.5" /> Unpaid</>
                                }
                              </button>

                              {/* Print / download */}
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                onClick={() => printBillFromRecord(bill)}
                                title="Download receipt PDF"
                                data-testid={`accounts-print-${bill.id}`}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
        {/* ===== END MAIN CONTENT ===== */}
        {/* ===== END BOOKINGS SECTION ===== */}

      </div>
      {/* ===== END TWO-COLUMN LAYOUT ===== */}

      {/* Billing Modal */}
      <Dialog open={isBillingOpen} onOpenChange={setIsBillingOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generate Receipt
            </DialogTitle>
            <DialogDescription>
              Review and edit details before generating the PDF. All fields are pre-filled from booking data.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">

            {/* Clinic Information */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinic Information</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={billingDetails.clinicName}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicName: e.target.value }))}
                    placeholder="Clinic Name"
                    className="h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={billingDetails.clinicEmail}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicEmail: e.target.value }))}
                    placeholder="Clinic Email"
                    className="h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={billingDetails.clinicPhone}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicPhone: e.target.value }))}
                    placeholder="Clinic Phone"
                    className="h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0 opacity-0" />
                  <Input
                    value={billingDetails.clinicAddress}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicAddress: e.target.value }))}
                    placeholder="Clinic Address"
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Receipt + Date */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt Details</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={billingDetails.receiptNumber}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, receiptNumber: e.target.value }))}
                  placeholder="Receipt #"
                  className="h-9 text-sm"
                />
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={billingDetails.date}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, date: e.target.value }))}
                    placeholder="Date"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Patient Information */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient Information</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={billingDetails.patientName}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, patientName: e.target.value }))}
                    placeholder="Patient Name"
                    className="h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={billingDetails.patientPhone}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, patientPhone: e.target.value }))}
                    placeholder="Phone"
                    className="h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={billingDetails.patientEmail}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, patientEmail: e.target.value }))}
                    placeholder="Email"
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Services */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</Label>
                <Button variant="ghost" size="sm" onClick={addServiceRow} className="h-7 px-2 text-primary gap-1">
                  <Plus className="h-3 w-3" />
                  <span className="text-[10px]">Add Row</span>
                </Button>
              </div>
              <div className="space-y-2">
                {billingDetails.services.map((service, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        value={service.description}
                        onChange={(e) => updateService(index, "description", e.target.value)}
                        placeholder="Service Description"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={service.amount}
                        onChange={(e) => updateService(index, "amount", e.target.value)}
                        placeholder="Amount"
                        className="h-9 text-sm"
                      />
                    </div>
                    {billingDetails.services.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeServiceRow(index)}
                        className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Discount, Tax, Payment */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment & Summary</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={billingDetails.discount}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, discount: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Tax / GST %</Label>
                  <Input
                    type="number"
                    min="0"
                    value={billingDetails.tax}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, tax: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Payment Method</Label>
                  <Input
                    value={billingDetails.paymentMethod}
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    placeholder="Cash / UPI / Card"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <Input
                value={billingDetails.remarks}
                onChange={(e) => setBillingDetails(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Remarks (optional)"
                className="h-9 text-sm"
              />
            </div>

            {/* Live total preview */}
            {(() => {
              const sub = billingDetails.services.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
              const disc = sub * ((parseFloat(billingDetails.discount) || 0) / 100);
              const tax = (sub - disc) * ((parseFloat(billingDetails.tax) || 0) / 100);
              const total = sub - disc + tax;
              return (
                <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>INR {sub.toFixed(2)}</span>
                  </div>
                  {disc > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Discount</span><span>- INR {disc.toFixed(2)}</span>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax / GST</span><span>+ INR {tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-primary border-t border-primary/15 pt-1 mt-1">
                    <span>Total Amount Due</span><span>INR {total.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBillingOpen(false)}>Cancel</Button>
            <Button onClick={generatePDF} className="gap-2">
              <Download className="h-4 w-4" />
              Generate Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Doctor Password Dialog */}
      <Dialog open={resetPwdOpen} onOpenChange={(open) => { setResetPwdOpen(open); if (!open) { setResetPwdNew(""); setResetPwdConfirm(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Reset Doctor Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-semibold">{resetPwdDoctorName}</span>
              {resetPwdDoctorEmail && <span className="text-muted-foreground"> ({resetPwdDoctorEmail})</span>}.
              They will be prompted to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pwd-new">New Password</Label>
              <Input
                id="reset-pwd-new"
                type="password"
                placeholder="Enter new password"
                value={resetPwdNew}
                onChange={e => setResetPwdNew(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-pwd-confirm">Confirm Password</Label>
              <Input
                id="reset-pwd-confirm"
                type="password"
                placeholder="Confirm new password"
                value={resetPwdConfirm}
                onChange={e => setResetPwdConfirm(e.target.value)}
              />
              {resetPwdConfirm && resetPwdNew !== resetPwdConfirm && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetPwdOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (resetPwdDoctorId && resetPwdNew && resetPwdNew === resetPwdConfirm) {
                  resetDoctorPasswordMutation.mutate({ doctorId: resetPwdDoctorId, newPassword: resetPwdNew });
                }
              }}
              disabled={!resetPwdNew || resetPwdNew !== resetPwdConfirm || resetDoctorPasswordMutation.isPending}
              className="gap-2"
            >
              {resetDoctorPasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
