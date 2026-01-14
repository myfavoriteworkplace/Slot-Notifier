import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar as CalendarIcon, Phone, Clock, Building2, LogOut, X, Download, Plus, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
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
  const [bookingDate, setBookingDate] = useState<Date>(startOfToday());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [slotTimings] = useState<SlotTiming[]>(DEFAULT_SLOT_TIMINGS);

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
      const res = await fetch(`/api/clinic/bookings/${bookingId}`, {
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
      endTime: endTime.toISOString()
    });
  };

  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithSlot[]>({
    queryKey: ['/api/clinic/bookings'],
    queryFn: async () => {
      const res = await fetch('/api/clinic/bookings', {
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

  if (!isAuthenticated) {
    return null;
  }

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

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 mb-6 sm:mb-8">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-left truncate">{clinic?.name}</h1>
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

                    {/* Date Selection */}
                    <div className="space-y-2">
                      <Label className="text-left block">Select Date</Label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex-1 w-full overflow-hidden">
                          <ScrollArea className="w-full whitespace-nowrap pb-4">
                            <div className="flex space-x-3 px-1">
                              {dates.map((date) => {
                                const isSelected = isSameDay(date, bookingDate);
                                return (
                                  <button
                                    key={date.toISOString()}
                                    onClick={() => setBookingDate(date)}
                                    data-testid={`booking-date-${format(date, 'yyyy-MM-dd')}`}
                                    className={`
                                      flex flex-col items-center justify-center min-w-[4rem] h-16 rounded-xl border transition-all duration-200
                                      ${isSelected 
                                        ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105' 
                                        : 'bg-card hover:border-primary/50 hover:bg-muted/50'}
                                    `}
                                  >
                                    <span className="text-xs font-medium uppercase mb-0.5 opacity-80">
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

                        <div className="flex-shrink-0 pb-4">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-16 w-14 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-muted/50 transition-all"
                                data-testid="button-booking-calendar"
                              >
                                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
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
                        {slotTimings.map((slot) => {
                          const slotLabel = `${formatTime(slot.startHour, slot.startMinute)} - ${formatTime(slot.endHour, slot.endMinute)}`;
                          return (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedSlot(slot.id)}
                              data-testid={`booking-slot-${slot.id}`}
                              className={`p-4 rounded-xl border text-center transition-all ${
                                selectedSlot === slot.id 
                                  ? "border-primary bg-primary/5 ring-1 ring-primary" 
                                  : "border-border hover:bg-muted/50 hover:border-primary/50"
                              }`}
                            >
                              <div className="font-medium">{slot.label}</div>
                              <div className="text-sm text-muted-foreground mt-1">{slotLabel}</div>
                            </button>
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
                  <Card key={booking.id} className="overflow-hidden border-border/50 hover:shadow-md transition-shadow" data-testid={`card-booking-${booking.id}`}>
                    <CardHeader className="bg-primary/5 pb-4 text-left">
                      <div className="flex justify-between items-start gap-2">
                        <div className="text-left">
                          <CardTitle className="text-lg text-left">{booking.customerName}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 text-left">
                            <Phone className="h-3 w-3" />
                            {booking.customerPhone}
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
                      {booking.createdAt && (
                        <div className="pt-2 mt-2 border-t border-border/50 text-xs text-muted-foreground text-left">
                          Booked on {format(new Date(booking.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                      )}
                      <div className="pt-3 mt-3 border-t border-border/50">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={cancellingBookingId === booking.id}
                              data-testid={`button-cancel-booking-${booking.id}`}
                            >
                              {cancellingBookingId === booking.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <X className="h-4 w-4 mr-2" />
                              )}
                              Cancel Booking
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel the booking for {booking.customerName}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelBookingMutation.mutate(booking.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Yes, Cancel Booking
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
