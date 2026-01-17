import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Calendar as CalendarIcon, Phone, Clock, Building2, LogOut, X, 
  Download, Plus, ChevronDown, ChevronUp, CheckCircle2, Receipt, FileText, 
  User, Mail, CalendarDays, FlaskConical 
} from "lucide-react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { format, startOfDay, endOfDay, startOfToday, addDays, isSameDay } from "date-fns";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import type { Slot, Booking } from "@shared/schema";

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

type BookingWithSlot = Booking & { slot: Slot };

export default function ClinicDashboard() {
  const { clinic, isLoading: authLoading, isAuthenticated, logout, isLoggingOut } = useClinicAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [filterDate, setFilterDate] = useState<Date | undefined>(new Date());
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(new Date());
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);

  // Booking form state
  const [isBookingOpen, setIsBookingOpen] = useState(false);
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

  const configureSlotMutation = useMutation({
    mutationFn: async (data: { startTime: string; maxBookings: number; isCancelled: boolean }) => {
      if (localStorage.getItem("demo_clinic_active") === "true") {
        // Mock configuration for demo_clinic and persist to local storage
        const stored = localStorage.getItem("demo_slot_configs");
        const configs = stored ? JSON.parse(stored) : {};
        configs[data.startTime] = {
          maxBookings: data.maxBookings,
          isCancelled: data.isCancelled
        };
        localStorage.setItem("demo_slot_configs", JSON.stringify(configs));
        return { message: "Configuration updated (Demo)" };
      }
      const response = await apiRequest('POST', '/api/clinic/slots/configure', data);
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
      if (localStorage.getItem("demo_clinic_active") === "true") {
        // Mock cancellation for demo_clinic
        const stored = localStorage.getItem("demo_bookings_persistent");
        if (stored) {
          const persistentBookings = JSON.parse(stored);
          const filtered = persistentBookings.filter((b: any) => b.id !== bookingId);
          localStorage.setItem("demo_bookings_persistent", JSON.stringify(filtered));
        }
        return { message: "Cancelled" };
      }
      
      setCancellingBookingId(bookingId);
      const API_BASE_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_BASE_URL}/api/clinic/bookings/${bookingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
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
      if (localStorage.getItem("demo_clinic_active") === "true") {
        // Mock creation for demo_clinic and persist to local storage
        const newBooking = {
          id: Math.floor(Math.random() * 10000) + 5000,
          slotId: data.slotId || Math.floor(Math.random() * 10000) + 6000,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail || "patient@example.com",
          verificationStatus: "verified",
          slot: {
            id: data.slotId || Math.floor(Math.random() * 10000) + 6000,
            clinicId: 999,
            clinicName: data.clinicName || "Demo Smile Clinic",
            startTime: data.startTime || new Date().toISOString(),
            endTime: data.endTime || new Date(Date.now() + 3600000).toISOString(),
            isBooked: true
          }
        };
        
        const stored = localStorage.getItem("demo_bookings_persistent");
        const persistentBookings = stored ? JSON.parse(stored) : [];
        persistentBookings.push(newBooking);
        localStorage.setItem("demo_bookings_persistent", JSON.stringify(persistentBookings));
        
        // Send mock email for demo purposes (logged to console)
        const email = data.customerEmail || "patient@example.com";
        console.log(`[DEMO EMAIL] To: ${email}`);
        console.log(`[DEMO EMAIL] Subject: Booking Confirmed - ${data.clinicName || "Demo Smile Clinic"}`);
        console.log(`[DEMO EMAIL] Body: Dear ${data.customerName}, your appointment for ${new Date(data.startTime).toLocaleString()} has been confirmed.`);

        return newBooking;
      }
      const response = await apiRequest('POST', '/api/public/bookings', data);
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
    });
  };

  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithSlot[]>({
    queryKey: ['/api/clinic/bookings'],
    queryFn: async () => {
      if (localStorage.getItem("demo_clinic_active") === "true") {
        const activeDemoClinicId = localStorage.getItem("demo_clinic_id");
        const today = new Date();
        const staticBookings: BookingWithSlot[] = [];
        const customerNames = ["Rahul Sharma", "Priya Patel", "Amit Singh", "Anjali Gupta", "Vikram Mehta"];
        
        // Only generate static for Demo Smile Clinic (ID 999)
        if (activeDemoClinicId === "999" || !activeDemoClinicId) {
          for (let i = 1; i <= 15; i++) {
            const bookingDate = new Date(2026, 0, i);
            const slotIdx = (i % 3);
            const slot = DEFAULT_SLOT_TIMINGS[slotIdx];
            
            const startTime = new Date(bookingDate);
            startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
            const endTime = new Date(bookingDate);
            endTime.setHours(slot.endHour, slot.endMinute, 0, 0);

            staticBookings.push({
              id: i,
              slotId: i,
              customerName: customerNames[i % customerNames.length],
              customerPhone: "+91 987654321" + (i % 10),
              customerEmail: `patient${i}@example.com`,
              verificationStatus: "verified",
              slot: {
                id: i,
                clinicId: 999,
                clinicName: "Demo Smile Clinic",
                startTime: startTime,
                endTime: endTime,
                isBooked: true
              } as any,
              createdAt: new Date(),
              customerId: null,
              verificationCode: null,
              verificationExpiresAt: null
            });
          }
        }

        const stored = localStorage.getItem("demo_bookings_persistent");
        let persistentBookings = stored ? JSON.parse(stored) : [];
        
        // Filter persistent bookings by active clinic ID
        if (activeDemoClinicId) {
          persistentBookings = persistentBookings.filter((b: any) => 
            b.slot?.clinicId?.toString() === activeDemoClinicId
          );
        }
        
        return [...staticBookings, ...persistentBookings].sort((a, b) => 
          new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime()
        );
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_BASE_URL}/api/clinic/bookings`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
    enabled: isAuthenticated,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/clinic-login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Moved the isAuthenticated check to after all hooks
  const isUserAuthenticated = isAuthenticated;

  const filteredBookings = bookings?.filter(booking => {
    const bookingDate = new Date(booking.slot.startTime);
    
    if (filterDate && filterEndDate) {
      return bookingDate >= startOfDay(filterDate) && bookingDate <= endOfDay(filterEndDate);
    } else if (filterDate) {
      // Compare using local date strings to avoid timezone issues
      const bookingDateStr = format(bookingDate, 'yyyy-MM-dd');
      const filterDateStr = format(filterDate, 'yyyy-MM-dd');
      return bookingDateStr === filterDateStr;
    }
    
    return true;
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

  // Billing State
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [billingBooking, setBillingBooking] = useState<BookingWithSlot | null>(null);
  const [billingDetails, setBillingDetails] = useState({
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    clinicName: "",
    services: [{ description: "Dental Consultation", amount: "500" }],
    date: ""
  });

  const handleOpenBilling = (booking: BookingWithSlot) => {
    setBillingBooking(booking);
    setBillingDetails({
      patientName: booking.customerName,
      patientPhone: booking.customerPhone,
      patientEmail: booking.customerEmail || "",
      clinicName: clinic?.name || "",
      services: [{ description: "Dental Consultation", amount: "500" }],
      date: format(new Date(booking.slot.startTime), "PPP")
    });
    setIsBillingOpen(true);
  };

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
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text(billingDetails.clinicName, pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Medical Billing Invoice", pageWidth / 2, 28, { align: "center" });

    // Divider
    doc.setDrawColor(200);
    doc.line(20, 35, pageWidth - 20, 35);

    // Patient Details
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text("Patient Information", 20, 45);
    
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Name: ${billingDetails.patientName}`, 20, 52);
    doc.text(`Phone: ${billingDetails.patientPhone}`, 20, 58);
    doc.text(`Email: ${billingDetails.patientEmail}`, 20, 64);
    doc.text(`Date: ${billingDetails.date}`, 20, 70);

    // Billing Table
    const tableBody = billingDetails.services.map(s => [s.description, s.amount]);
    const totalAmount = billingDetails.services.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

    autoTable(doc, {
      startY: 80,
      head: [["Service Description", "Amount (INR)"]],
      body: tableBody,
      theme: "striped",
      headStyles: { fillColor: [79, 70, 229] }, // Indigo color
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // Total
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(`Total Amount: INR ${totalAmount.toFixed(2)}`, pageWidth - 20, finalY + 15, { align: "right" });

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Generated by BookMySlot", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

    doc.save(`bill_${billingDetails.patientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
    
    setIsBillingOpen(false);
    toast({ title: "Bill Generated", description: "Your PDF download has started." });
  };

  const handleLogout = () => {
    logout();
    setLocation("/clinic-login");
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
      <div className="flex flex-col gap-4 mb-6 sm:mb-8">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-left truncate">{clinic?.name}</h1>
              {clinic?.id && clinic.id >= 999 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <FlaskConical className="h-3 w-3" />
                  Demo
                </Badge>
              )}
            </div>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 text-left">Manage your clinic's bookings</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 sm:p-6 text-left">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Future Bookings</p>
              <p className="text-xl sm:text-2xl font-bold mt-2">{futureBookingsCount}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 sm:p-6 text-left">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Past Bookings</p>
              <p className="text-xl sm:text-2xl font-bold mt-2 text-muted-foreground">{pastBookingsCount}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 sm:p-6 text-left">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Today's Bookings</p>
              <p className="text-xl sm:text-2xl font-bold mt-2 text-primary">
                {todaysBookingsCount}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 sm:p-6 text-left">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Filtered Results</p>
              <p className="text-xl sm:text-2xl font-bold mt-2 text-accent">
                {filteredBookings?.length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Slot Configuration Section */}
        <Collapsible open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <Card className="shadow-sm border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-lg">Configure Slots</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">Set capacity or cancel slots</p>
                    </div>
                  </div>
                  {isConfigOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
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
                    <Label className="text-left block">Select Date & Time</Label>
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Book a Slot Section */}
        <Collapsible open={isBookingOpen} onOpenChange={setIsBookingOpen}>
          <Card className="shadow-sm border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-lg">Book a Slot for Patient</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">Create a new appointment booking</p>
                    </div>
                  </div>
                  {isBookingOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
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
                                    className={`p-5 sm:p-4 rounded-xl border text-center transition-all relative ${
                                      selectedSlot === slot.id 
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <section>
          <div className="flex flex-col space-y-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight text-left">Bookings</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadExcel}
                className="gap-2"
                disabled={!filteredBookings || filteredBookings.length === 0}
                data-testid="button-download-excel"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
            
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
                filteredBookings?.map((booking) => (
                  <Card key={booking.id} className="overflow-hidden border-border/50 hover:shadow-md transition-all cursor-pointer group" data-testid={`card-booking-${booking.id}`}>
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="w-full h-full text-left">
                          <CardHeader className="bg-primary/5 pb-4 text-left group-hover:bg-primary/10 transition-colors">
                            <div className="flex justify-between items-start gap-2">
                              <div className="text-left">
                                <CardTitle className="text-lg text-left">{booking.customerName}</CardTitle>
                                <div className="flex flex-col gap-1 mt-1">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground text-left">
                                    <Phone className="h-3 w-3" />
                                    {booking.customerPhone}
                                  </div>
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-background">
                                Booked
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 space-y-3 text-left">
                            <div className="flex items-center gap-3 text-sm text-left">
                              <CalendarIcon className="h-4 w-4 text-primary" />
                              <span className="font-medium text-left">
                                {format(new Date(booking.slot.startTime), "EEEE, MMMM do")}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground text-left">
                              <Clock className="h-4 w-4" />
                              <span className="text-left">
                                {format(new Date(booking.slot.startTime), "h:mm a")} - {format(new Date(booking.slot.endTime), "h:mm a")}
                              </span>
                            </div>
                            {booking.description && (
                              <div className="text-xs text-muted-foreground italic line-clamp-1 bg-muted/50 p-2 rounded-md mt-2 border border-border/30">
                                {booking.description}
                              </div>
                            )}
                          </CardContent>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px] rounded-2xl">
                        <DialogHeader>
                          <DialogTitle>Booking Details</DialogTitle>
                          <DialogDescription>
                            Full information for this appointment
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                {booking.customerName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-bold text-lg">{booking.customerName}</h3>
                              <p className="text-sm text-muted-foreground">{booking.customerPhone}</p>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <CalendarIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold">Date</p>
                                <p className="text-sm text-muted-foreground">{format(new Date(booking.slot.startTime), "EEEE, MMMM do, yyyy")}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold">Time Slot</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(booking.slot.startTime), "h:mm a")} - {format(new Date(booking.slot.endTime), "h:mm a")}
                                </p>
                              </div>
                            </div>
                            {booking.customerEmail && (
                              <div className="flex items-start gap-3">
                                <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold">Email</p>
                                  <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-start gap-3">
                              <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">CHIEF COMPLAINTS / DESCRIPTION</p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {booking.description ? (
                                    booking.description.split(", ").map((complaint, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-[10px] px-2 py-0">
                                        {complaint}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-sm text-muted-foreground italic">No complaints recorded</span>
                                  )}
                                </div>
                                {booking.description && (
                                  <p className="mt-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md italic">
                                    "{booking.description}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div className="text-xs text-muted-foreground">
                            Booked on {booking.createdAt ? format(new Date(booking.createdAt), "MMM d, yyyy 'at' h:mm a") : "N/A"}
                          </div>
                        </div>
                        <DialogFooter className="flex-row gap-2">
                          <Button 
                            variant="outline" 
                            className="flex-1 text-primary gap-2"
                            onClick={() => handleOpenBilling(booking)}
                          >
                            <Receipt className="h-4 w-4" />
                            Bill
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" className="flex-1 text-destructive gap-2">
                                <X className="h-4 w-4" />
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
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <div className="px-4 pb-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-primary hover:bg-primary/5 gap-2"
                        onClick={() => handleOpenBilling(booking)}
                      >
                        <Receipt className="h-4 w-4" />
                        Bill
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-destructive hover:bg-destructive/5 gap-2"
                            disabled={cancellingBookingId === booking.id}
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel {booking.customerName}'s appointment?
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
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {/* Billing Modal */}
      <Dialog open={isBillingOpen} onOpenChange={setIsBillingOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generate Billing Invoice
            </DialogTitle>
            <DialogDescription>
              Review and update details before generating the PDF.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinic Information</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Input 
                    value={billingDetails.clinicName} 
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, clinicName: e.target.value }))}
                    placeholder="Clinic Name"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient Information</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={billingDetails.patientName} 
                      onChange={(e) => setBillingDetails(prev => ({ ...prev, patientName: e.target.value }))}
                      placeholder="Patient Name"
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={billingDetails.patientPhone} 
                      onChange={(e) => setBillingDetails(prev => ({ ...prev, patientPhone: e.target.value }))}
                      placeholder="Phone"
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={billingDetails.patientEmail} 
                      onChange={(e) => setBillingDetails(prev => ({ ...prev, patientEmail: e.target.value }))}
                      placeholder="Email"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</Label>
                  <Button variant="ghost" size="sm" onClick={addServiceRow} className="h-7 px-2 text-primary gap-1">
                    <Plus className="h-3 w-3" />
                    <span className="text-[10px]">Add Row</span>
                  </Button>
                </div>
                <div className="space-y-3">
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

              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appointment Date</Label>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <Input 
                    value={billingDetails.date} 
                    onChange={(e) => setBillingDetails(prev => ({ ...prev, date: e.target.value }))}
                    placeholder="Date"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBillingOpen(false)}>Cancel</Button>
            <Button onClick={generatePDF} className="gap-2">
              <Download className="h-4 w-4" />
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
