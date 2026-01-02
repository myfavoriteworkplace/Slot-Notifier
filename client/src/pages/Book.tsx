import { useState } from "react";
import { useSlots } from "@/hooks/use-slots";
import { SlotCard } from "@/components/SlotCard";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, Calendar as CalendarIcon, ChevronDown, CalendarDays } from "lucide-react";
import { format, addDays, startOfToday, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export default function Book() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedClinic, setSelectedClinic] = useState<string>("");

  const clinics = [
    "Dr Gijo's Dental Solutions",
    "Parappuram's Smile Dental Clinic Muvattupuzha",
    "Smiletree Multispeciality Dental Clinic Muvattupuzha",
    "Valiyakulangara dental clinic Muvattupuzha"
  ];
  
  // Fetch slots for the selected date
  const { data: slots, isLoading: slotsLoading } = useSlots();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  // Generate next 14 days for date picker
  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  // Filter slots for selected date
  const slotsForDate = slots?.filter(slot => 
    isSameDay(new Date(slot.startTime), selectedDate)
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showSlots, setShowSlots] = useState(false);

  const predefinedSlots = [
    { id: "1", label: "9:00AM TO 12:00PM", start: 9, end: 12 },
    { id: "2", label: "2:00PM - 4:00PM", start: 14, end: 16 },
    { id: "3", label: "4:00PM TO 6:00PM", start: 16, end: 18 },
  ];

  const handleBook = () => {
    if (!selectedSlot || !customerName || !customerPhone || !selectedClinic) return;
    const slotInfo = predefinedSlots.find(s => s.id === selectedSlot);
    if (!slotInfo) return;

    const startTime = new Date(selectedDate);
    startTime.setHours(slotInfo.start, 0, 0, 0);
    const endTime = new Date(selectedDate);
    endTime.setHours(slotInfo.end, 0, 0, 0);

    // Reset states
    setIsDetailsOpen(false);
    setShowSlots(false);
    setSelectedSlot(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Book a Session</h1>
          <p className="text-muted-foreground">Select a date to see available times.</p>
        </div>

        {/* Clinic Selection */}
        <div className="max-w-md mx-auto mb-10">
          <Label className="text-sm font-medium mb-2 block">Select Clinic</Label>
          <Select value={selectedClinic} onValueChange={setSelectedClinic}>
            <SelectTrigger className="w-full rounded-xl h-12 border-border/50 bg-card shadow-sm transition-all hover:border-primary/50">
              <SelectValue placeholder="Choose a dental clinic" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border/50">
              {clinics.map((clinic) => (
                <SelectItem key={clinic} value={clinic} className="py-3 rounded-lg cursor-pointer">
                  {clinic}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Selection Strip */}
        {selectedClinic && (
          <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex-1 w-full overflow-hidden">
              <ScrollArea className="w-full whitespace-nowrap pb-4">
                <div className="flex space-x-4 px-1">
                  {dates.map((date) => {
                    const isSelected = isSameDay(date, selectedDate);
                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => {
                          setSelectedDate(date);
                          setShowSlots(false);
                          setIsDetailsOpen(true);
                        }}
                        className={`
                          flex flex-col items-center justify-center min-w-[4.5rem] h-20 rounded-xl border transition-all duration-200
                          ${isSelected 
                            ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105' 
                            : 'bg-card hover:border-primary/50 hover:bg-muted/50'}
                        `}
                      >
                        <span className="text-xs font-medium uppercase mb-1 opacity-80">
                          {format(date, "EEE")}
                        </span>
                        <span className="text-xl font-bold">
                          {format(date, "d")}
                        </span>
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
        )}
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={(open) => {
        setIsDetailsOpen(open);
        if (!open) setShowSlots(false);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Book your session</DialogTitle>
            <DialogDescription>
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
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Phone</Label>
              <Input
                id="phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="col-span-3"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            {!showSlots ? (
              <Button 
                onClick={() => setShowSlots(true)}
                disabled={!customerName || !customerPhone || !selectedClinic}
                className="w-full mt-4"
              >
                Check Available Slots
              </Button>
            ) : (
              <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="text-sm font-semibold">Select Time Slot</Label>
                <div className="grid gap-2">
                  {predefinedSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedSlot === slot.id 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{slot.label}</div>
                    </button>
                  ))}
                </div>
                <DialogFooter className="mt-6">
                  <Button 
                    onClick={handleBook}
                    disabled={!selectedSlot}
                    className="w-full"
                  >
                    Confirm Booking
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
