import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarDays, CheckCircle2 } from "lucide-react";
import type { Clinic, Slot } from "@shared/schema";
import { format, addDays, startOfToday, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  { id: "1", label: "Morning", startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
  { id: "2", label: "Afternoon", startHour: 14, startMinute: 0, endHour: 16, endMinute: 0 },
  { id: "3", label: "Evening", startHour: 16, startMinute: 0, endHour: 18, endMinute: 0 },
];

export default function Book() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedClinic, setSelectedClinic] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [phoneError, setPhoneError] = useState("");

  const [slotTimings, setSlotTimings] = useState<SlotTiming[]>(DEFAULT_SLOT_TIMINGS);

  const validateIndianPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    const indiaRegex = /^(\+91|91)?[6-9]\d{9}$/;
    return indiaRegex.test(cleaned);
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

  useEffect(() => {
    const saved = localStorage.getItem('slotTimings');
    if (saved) {
      setSlotTimings(JSON.parse(saved));
    }
  }, []);

  const { data: clinicsData, isLoading: clinicsLoading } = useQuery<Clinic[]>({
    queryKey: ['/api/clinics'],
  });

  const hardcodedClinic: Clinic = {
    id: 999,
    name: "Demo Smile Clinic",
    address: "123 Demo St, Dental City",
    username: "demo_clinic",
    passwordHash: "",
    isArchived: false,
    createdAt: new Date()
  };

  const clinics = clinicsData 
    ? [...clinicsData.filter(c => !c.isArchived && c.name !== "Demo Smile Clinic"), hardcodedClinic]
    : [hardcodedClinic];

  const { data: slots, isLoading: slotsLoading } = useQuery<Slot[]>({
    queryKey: ['/api/slots'],
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/public/bookings', data);
      return response.json();
    },
    onSuccess: () => {
      setStep('success');
      toast({
        title: "Booking Confirmed!",
        description: "Your appointment has been successfully booked.",
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

  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')}${period}`;
  };

  const handleBook = () => {
    if (!selectedSlot || !customerName || !customerPhone || !customerEmail || !selectedClinic) return;
    const slotInfo = slotTimings.find(s => s.id === selectedSlot);
    if (!slotInfo) return;

    const startTime = new Date(selectedDate);
    startTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
    const endTime = new Date(selectedDate);
    endTime.setHours(slotInfo.endHour, slotInfo.endMinute, 0, 0);

    if (selectedClinic === "Demo Smile Clinic") {
      // Mock creation for Demo Smile Clinic and persist to local storage
      const newBooking = {
        id: Math.floor(Math.random() * 10000) + 5000,
        slotId: Math.floor(Math.random() * 10000) + 6000,
        customerName,
        customerPhone,
        customerEmail,
        verificationStatus: "verified",
        slot: {
          id: Math.floor(Math.random() * 10000) + 6000,
          clinicId: 999,
          clinicName: "Demo Smile Clinic",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isBooked: true
        }
      };
      
      const stored = localStorage.getItem("demo_bookings_persistent");
      const persistentBookings = stored ? JSON.parse(stored) : [];
      persistentBookings.push(newBooking);
      localStorage.setItem("demo_bookings_persistent", JSON.stringify(persistentBookings));
      
      setStep('success');
      toast({
        title: "Booking Confirmed!",
        description: "Your appointment has been successfully booked (Demo).",
      });
      return;
    }

    const selectedClinicData = clinicsData?.find(c => c.name === selectedClinic);
    const clinicId = selectedClinicData?.id;

    if (!clinicId) {
      toast({
        title: "Error",
        description: "Please select a valid clinic",
        variant: "destructive",
      });
      return;
    }

    createBookingMutation.mutate({
      customerName,
      customerPhone,
      customerEmail,
      clinicId,
      clinicName: selectedClinic,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
  };

  const resetForm = () => {
    setIsDetailsOpen(false);
    setShowSlots(false);
    setSelectedSlot(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setPhoneError("");
    setStep('details');
  };

  if (clinicsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-clinics" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl">
        <div className="text-left mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-left">Book a Session</h1>
          <p className="text-sm sm:text-base text-muted-foreground text-left">Select a clinic and date to book your appointment.</p>
        </div>

        <div className="max-w-md mb-6 sm:mb-10 text-left">
          <Label className="text-sm font-medium mb-2 block text-left">Select Clinic</Label>
          <Select value={selectedClinic} onValueChange={setSelectedClinic}>
            <SelectTrigger className="w-full rounded-xl h-14 sm:h-12 border-border/50 bg-card shadow-sm transition-all hover:border-primary/50" data-testid="select-clinic">
              <SelectValue placeholder="Choose a dental clinic" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border/50">
              {clinics.map((clinic) => (
                <SelectItem key={clinic.id} value={clinic.name} className="py-4 sm:py-3 rounded-lg cursor-pointer" data-testid={`clinic-option-${clinic.id}`}>
                  {clinic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClinic && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground text-left">Select Date</h2>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 w-full overflow-hidden">
                <ScrollArea className="w-full whitespace-nowrap pb-4">
                  <div className="flex space-x-4 px-1">
                    {dates.map((date) => {
                      const isSelected = isSameDay(date, selectedDate);
                      const daySlots = slots?.filter(s => 
                        isSameDay(new Date(s.startTime), date) && 
                        s.clinicName === selectedClinic
                      );
                      const bookedCount = daySlots?.filter(s => s.isBooked).length || 0;
                      const isFull = bookedCount >= 9;

                      return (
                        <button
                          key={date.toISOString()}
                          disabled={isFull}
                          onClick={() => {
                            setSelectedDate(date);
                            setShowSlots(false);
                            setIsDetailsOpen(true);
                          }}
                          data-testid={`date-button-${format(date, 'yyyy-MM-dd')}`}
                          className={`
                            flex flex-col items-center justify-center min-w-[4.5rem] h-20 rounded-xl border transition-all duration-200 relative
                            ${isSelected 
                              ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105' 
                              : isFull
                                ? 'bg-destructive/10 border-destructive/20 text-destructive cursor-not-allowed opacity-60'
                                : 'bg-card hover:border-primary/50 hover:bg-muted/50'}
                          `}
                        >
                          <span className="text-xs font-medium uppercase mb-1 opacity-80">
                            {format(date, "EEE")}
                          </span>
                          <span className="text-xl font-bold">
                            {format(date, "d")}
                          </span>
                          {isFull && <span className="absolute top-1 right-1 text-[8px] font-bold uppercase text-destructive">Full</span>}
                        </button>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>

              <div className="flex-shrink-0 pt-1 sm:pt-0 pb-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-20 w-16 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-muted/50 transition-all"
                      data-testid="button-calendar-picker"
                    >
                      <CalendarDays className="h-6 w-6 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl shadow-2xl border-border/50" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setShowSlots(false);
                          setIsDetailsOpen(true);
                        }
                      }}
                      disabled={(date) => date < startOfToday()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        else setIsDetailsOpen(open);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          {step === 'details' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left">Book your session</DialogTitle>
                <DialogDescription className="text-left">
                  Enter your details and select a time for {format(selectedDate, "MMMM do")}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="col-span-3"
                    placeholder="John Doe"
                    data-testid="input-name"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Phone</Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="phone"
                      value={customerPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className={phoneError ? "border-destructive" : ""}
                      placeholder="+91 9876543210"
                      data-testid="input-phone"
                    />
                    {phoneError && (
                      <p className="text-xs text-destructive">{phoneError}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="col-span-3"
                    placeholder="you@example.com"
                    data-testid="input-email"
                  />
                </div>

                {!showSlots ? (
                  <Button 
                    onClick={() => setShowSlots(true)}
                    disabled={!customerName || !isPhoneValid || !customerEmail || !selectedClinic}
                    className="w-full mt-4"
                    data-testid="button-check-slots"
                  >
                    Check Available Slots
                  </Button>
                ) : (
                  <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label className="text-sm font-semibold text-left block">Select Time Slot</Label>
                    <div className="grid gap-2">
                      {slotTimings.map((slot) => {
                        const startTime = new Date(selectedDate);
                        startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
                        const isoString = startTime.toISOString();
                        
                        let isSlotFull = false;
                        let isSlotCancelled = false;
                        let maxBookings = 3;

                        if (selectedClinic === "Demo Smile Clinic") {
                          const storedConfigs = localStorage.getItem("demo_slot_configs");
                          const configs = storedConfigs ? JSON.parse(storedConfigs) : {};
                          const config = configs[isoString];
                          maxBookings = config?.maxBookings ?? 3;
                          isSlotCancelled = config?.isCancelled ?? false;

                          const storedBookings = localStorage.getItem("demo_bookings_persistent");
                          const persistentBookings = storedBookings ? JSON.parse(storedBookings) : [];
                          const currentBookings = persistentBookings.filter((b: any) => 
                            new Date(b.slot.startTime).toISOString() === isoString
                          ).length;
                          isSlotFull = currentBookings >= maxBookings;
                        } else {
                          const slotData = slots?.find(s => 
                            new Date(s.startTime).toISOString() === isoString && 
                            s.clinicName === selectedClinic
                          );
                          maxBookings = slotData?.maxBookings ?? 3;
                          isSlotCancelled = slotData?.isCancelled ?? false;

                          // For registered clinics, we calculate current bookings from existing slots data
                          const currentBookings = slots?.filter(s => 
                            new Date(s.startTime).toISOString() === isoString && 
                            s.clinicName === selectedClinic &&
                            s.isBooked
                          ).length || 0;
                          isSlotFull = currentBookings >= maxBookings;
                        }

                        if (isSlotCancelled) return null;

                        const slotLabel = `${formatTime(slot.startHour, slot.startMinute)} TO ${formatTime(slot.endHour, slot.endMinute)}`;

                        return (
                          <TooltipProvider key={slot.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  key={slot.id}
                                  disabled={isSlotFull}
                                  onClick={() => setSelectedSlot(slot.id)}
                                  data-testid={`slot-button-${slot.id}`}
                                  className={`p-3 rounded-lg border text-left transition-all relative ${
                                    selectedSlot === slot.id 
                                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                                      : isSlotFull
                                        ? "border-destructive/20 bg-destructive/10 cursor-not-allowed"
                                        : "border-border hover:bg-muted"
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <div className={`font-medium text-left ${isSlotFull ? "text-destructive/70" : ""}`}>{slotLabel}</div>
                                    {isSlotFull && (
                                      <Badge variant="destructive" className="px-1.5 py-0 text-[10px] h-4">
                                        Full
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              </TooltipTrigger>
                              {isSlotFull && (
                                <TooltipContent>
                                  <p>Booking closed for this slot</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                    <DialogFooter className="mt-6">
                      <Button 
                        onClick={handleBook}
                        disabled={!selectedSlot || createBookingMutation.isPending}
                        className="w-full"
                        data-testid="button-confirm-booking"
                      >
                        {createBookingMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Booking...
                          </>
                        ) : (
                          'Confirm Booking'
                        )}
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="py-8 flex flex-col items-center gap-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <DialogHeader>
                <DialogTitle className="text-center">Booking Confirmed!</DialogTitle>
                <DialogDescription className="text-center">
                  Your appointment on {format(selectedDate, "MMMM do, yyyy")} has been confirmed.
                </DialogDescription>
              </DialogHeader>
              <Button 
                onClick={resetForm}
                className="mt-4"
                data-testid="button-done"
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
