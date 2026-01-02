import { useSlots, useCreateSlot } from "@/hooks/use-slots";
import { CreateSlotDialog } from "@/components/CreateSlotDialog";
import { SlotCard } from "@/components/SlotCard";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, Calendar as CalendarIcon, ListFilter } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const { data: slots, isLoading: slotsLoading } = useSlots({ 
    ownerId: user?.id 
  });

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

  const sortedSlots = slots?.sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const { mutate: createSlot } = useCreateSlot();

  const onDateSelect = (date: Date | undefined) => {
    if (!date || !user) return;
    
    // Automatically create 3 slots for this date
    const times = [
      { h: 9, m: 0 },
      { h: 13, m: 0 },
      { h: 17, m: 0 }
    ];

    times.forEach(({ h, m }) => {
      const startTime = new Date(date);
      startTime.setHours(h, m, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setHours(h + 1);

      createSlot({
        startTime,
        endTime,
      });
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your availability and view bookings.</p>
        </div>
        <div className="flex items-center gap-2">
          <CreateSlotDialog onDateSelect={onDateSelect} />
        </div>
      </div>

      {slotsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : slots?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-muted rounded-2xl bg-muted/10">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No slots created</h3>
          <p className="text-muted-foreground max-w-sm mt-2 mb-6">
            Get started by creating your first time slot. Customers will be able to book it immediately.
          </p>
          <CreateSlotDialog />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card p-6 rounded-2xl border shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Slots</p>
              <p className="text-2xl font-bold mt-2">{slots?.length}</p>
            </div>
            <div className="bg-card p-6 rounded-2xl border shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Booked Slots</p>
              <p className="text-2xl font-bold mt-2 text-accent">
                {slots?.filter(s => s.isBooked).length}
              </p>
            </div>
            <div className="bg-card p-6 rounded-2xl border shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Available Slots</p>
              <p className="text-2xl font-bold mt-2 text-primary">
                {slots?.filter(s => !s.isBooked).length}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Schedule</h2>
              <Button variant="outline" size="sm" className="gap-2">
                <ListFilter className="h-4 w-4" />
                Filter
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedSlots?.map((slot) => (
                <SlotCard key={slot.id} slot={slot} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
