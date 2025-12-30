import { useState } from "react";
import { useSlots } from "@/hooks/use-slots";
import { SlotCard } from "@/components/SlotCard";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfToday, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function Book() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  
  // Fetch slots for the selected date (filtering client-side for now as backend supports optional filtering)
  const { data: slots, isLoading: slotsLoading } = useSlots();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "customer") {
    setLocation("/");
    return null;
  }

  // Generate next 14 days for date picker
  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  // Filter slots for selected date
  const slotsForDate = slots?.filter(slot => 
    isSameDay(new Date(slot.startTime), selectedDate)
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Book a Session</h1>
          <p className="text-muted-foreground">Select a date and time that works for you.</p>
        </div>

        {/* Date Selection Strip */}
        <div className="mb-10 relative">
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex space-x-4 px-1">
              {dates.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
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

        {/* Slots Grid */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-lg font-semibold border-b pb-4">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <h3>Availability for {format(selectedDate, "EEEE, MMMM do")}</h3>
          </div>

          {slotsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-40 rounded-2xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : !slotsForDate || slotsForDate.length === 0 ? (
            <div className="py-16 text-center bg-muted/20 rounded-2xl border border-dashed">
              <p className="text-muted-foreground font-medium">No slots available for this date.</p>
              <Button 
                variant="outline" 
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="mt-2 text-primary"
              >
                Check next day &rarr;
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {slotsForDate.map((slot) => (
                <SlotCard key={slot.id} slot={slot} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
