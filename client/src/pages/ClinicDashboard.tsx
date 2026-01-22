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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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

type BookingWithSlot = Booking & { 
  slot: Slot; 
  description?: string | null;
  assignedDoctor?: string | null;
  clinicDoctors?: { name: string; specialization: string; degree: string }[];
};

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
      const response = await apiRequest('POST', '/api/auth/clinic/slots/configure', data);
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
    services: [{ description: "Dental Consultation", amount: "500" }],
    date: ""
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

  const assignDoctorMutation = useMutation({
    mutationFn: async ({ bookingId, doctorName }: { bookingId: number; doctorName: string }) => {
      const response = await apiRequest('PATCH', `/api/clinic/bookings/${bookingId}/assign-doctor`, { doctorName });
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
                  <Card
                    key={booking.id}
                    className="overflow-hidden border-border/50 hover:shadow-md transition-all cursor-pointer group"
                    data-testid={`card-booking-${booking.id}`}
                  >
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="w-full h-full text-left">
                          <CardHeader className="bg-primary/5 pb-4 text-left group-hover:bg-primary/10 transition-colors">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider bg-muted/50 whitespace-nowrap">
                                    #{getBookingNumber(booking).padStart(2, '0')}
                                  </Badge>
                                  <CardTitle className="text-lg truncate">{booking.customerName}</CardTitle>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <Phone className="h-3 w-3" />
                                  {booking.customerPhone}
                                </div>
                              </div>
                              <Badge variant="outline">Booked</Badge>
                            </div>
                          </CardHeader>

                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                              <CalendarIcon className="h-4 w-4 text-primary" />
                              <span className="font-medium">
                                {format(new Date(booking.slot.startTime), "EEEE, MMMM do")}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              {format(new Date(booking.slot.startTime), "h:mm a")}
                            </div>
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
                            <Avatar className="h-12 w-12 border">
                              <AvatarFallback className="bg-primary/5 text-primary">
                                {booking.customerName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider bg-muted/50">
                                  #{getBookingNumber(booking).padStart(2, '0')}
                                </Badge>
                                <div className="font-semibold text-lg">{booking.customerName}</div>
                              </div>
                              <div className="text-sm text-muted-foreground">{booking.customerPhone}</div>
                              <div className="text-[10px] text-muted-foreground mt-1 uppercase font-bold flex items-center gap-1">
                                <Clock className="h-3 w-3" /> 
                                Booked on: {booking.createdAt ? format(new Date(booking.createdAt), "MMM d, h:mm a") : "N/A"}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" /> Date
                              </div>
                              <div className="text-sm font-medium">
                                {format(new Date(booking.slot.startTime), "MMM d, yyyy")}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Time
                              </div>
                              <div className="text-sm font-medium">
                                {format(new Date(booking.slot.startTime), "h:mm a")} - {format(new Date(booking.slot.endTime), "h:mm a")}
                              </div>
                            </div>
                          </div>

                          {booking.clinicDoctors && booking.clinicDoctors.length > 0 && (
                            <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border/50">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium">Assign Doctor</p>
                              </div>
                              <div className="grid gap-2">
                                {booking.clinicDoctors.map((doctor, idx) => (
                                  <Button
                                    key={idx}
                                    variant={booking.assignedDoctor === doctor.name ? "default" : "outline"}
                                    size="sm"
                                    className="justify-start h-auto py-2 px-3"
                                    onClick={() => assignDoctorMutation.mutate({ 
                                      bookingId: booking.id, 
                                      doctorName: doctor.name 
                                    })}
                                    disabled={assignDoctorMutation.isPending}
                                  >
                                    <div className="text-left">
                                      <p className="font-medium text-xs">{doctor.name}</p>
                                      <p className="text-[10px] opacity-70">{doctor.specialization} • {doctor.degree}</p>
                                    </div>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> Email
                            </div>
                            <div className="text-sm bg-muted/30 p-2 rounded-lg border border-border/50">
                              {booking.customerEmail || "No email provided"}
                            </div>
                          </div>

                          {booking.description && (
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                <FlaskConical className="h-3 w-3" /> Chief Complaints
                              </div>
                              <div className="flex flex-wrap gap-1.5 p-1">
                                {(() => {
                                  // Split by comma, period, or space and filter out common filler words
                                  const parts = booking.description.split(/[,.\s]+/).map(p => p.trim()).filter(Boolean);
                                  const matched = CHIEF_COMPLAINTS.filter(c => 
                                    parts.some(p => p.toLowerCase() === c.toLowerCase())
                                  );
                                  
                                  return (
                                    <>
                                      {matched.length > 0 ? matched.map((complaint, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-[10px] py-0 px-2 h-5 bg-primary/10 text-primary border-primary/20">
                                          {complaint}
                                        </Badge>
                                      )) : (
                                        <span className="text-xs text-muted-foreground italic">None identified in description</span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {booking.description && (
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                <FileText className="h-3 w-3" /> Detailed Description
                              </div>
                              <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-xl border italic leading-relaxed">
                                "{booking.description}"
                              </div>
                            </div>
                          )}
                        </div>

                        <Separator />

                        <DialogFooter className="flex-row gap-2">
                          <Button
                            variant="outline"
                            className="flex-1 gap-2"
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
                                  onClick={() =>
                                    cancelBookingMutation.mutate(booking.id)
                                  }
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
