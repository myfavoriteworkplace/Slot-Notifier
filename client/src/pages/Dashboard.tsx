import { useSlots, useCreateSlot } from "@/hooks/use-slots";
import { CreateSlotDialog } from "@/components/CreateSlotDialog";
import { SlotCard } from "@/components/SlotCard";
import { useAuth } from "@/hooks/use-auth";
import { useBookings } from "@/hooks/use-bookings";
import { useLocation } from "wouter";
import { Loader2, Calendar as CalendarIcon, ListFilter, User as UserIcon, Phone, Clock, Search } from "lucide-react";
import { format, isSameDay, startOfToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const [filterDate, setFilterDate] = useState<Date | undefined>(startOfToday());
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [filterClinic, setFilterClinic] = useState<string>("all");
  const [defaultSlotsCount, setDefaultSlotsCount] = useState<number>(9);

  const { data: slots, isLoading: slotsLoading } = useSlots({ 
    ownerId: user?.id 
  });
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { mutate: createSlot } = useCreateSlot();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sortedSlots = slots?.sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const filteredBookings = bookings?.filter(booking => {
    const bookingDate = new Date(booking.slot.startTime);
    let dateMatch = true;

    if (filterDate && filterEndDate) {
      dateMatch = bookingDate >= filterDate && bookingDate <= filterEndDate;
    } else if (filterDate) {
      dateMatch = isSameDay(bookingDate, filterDate);
    }

    const clinicMatch = filterClinic === "all" || booking.slot.clinicName === filterClinic;
    return dateMatch && clinicMatch;
  });

  const clinics = [
    "Dr Gijo's Dental Solutions",
    "Parappuram's Smile Dental Clinic Muvattupuzha",
    "Smiletree Multispeciality Dental Clinic Muvattupuzha",
    "Valiyakulangara dental clinic Muvattupuzha"
  ];

  const onDateSelect = (date: Date | undefined) => {
    if (!date || !user) return;
    
    const startHour = 9;
    for (let i = 0; i < defaultSlotsCount; i++) {
      const startTime = new Date(date);
      startTime.setHours(startHour + (i * 2), 0, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setHours(startHour + (i * 2) + 1);

      createSlot({
        startTime,
        endTime,
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-left">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-left">Manage your availability and view bookings.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-card border rounded-xl px-3 h-10 shadow-sm">
            <Label className="text-xs font-medium whitespace-nowrap">Default Slots:</Label>
            <Input 
              type="number" 
              min="1" 
              max="10" 
              value={defaultSlotsCount} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultSlotsCount(parseInt(e.target.value) || 1)}
              className="w-16 h-7 border-none bg-transparent focus-visible:ring-0 text-center font-bold"
            />
          </div>
          <CreateSlotDialog onDateSelect={onDateSelect} />
        </div>
      </div>

      {(slotsLoading || bookingsLoading) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : slots?.length === 0 ? (
        <div className="flex flex-col items-start justify-center py-16 text-left border-2 border-dashed border-muted rounded-2xl bg-muted/10 px-8">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-left">No slots created</h3>
          <p className="text-muted-foreground max-w-sm mt-2 mb-6 text-left">
            Get started by creating your first time slot. Customers will be able to book it immediately.
          </p>
          <CreateSlotDialog onDateSelect={onDateSelect} />
        </div>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-6 text-left">
                <p className="text-sm font-medium text-muted-foreground">Total Slots</p>
                <p className="text-2xl font-bold mt-2">{slots?.length}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-6 text-left">
                <p className="text-sm font-medium text-muted-foreground">Booked Slots</p>
                <p className="text-2xl font-bold mt-2 text-accent">
                  {slots?.filter(s => s.isBooked).length}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-6 text-left">
                <p className="text-sm font-medium text-muted-foreground">Available Slots</p>
                <p className="text-2xl font-bold mt-2 text-primary">
                  {slots?.filter(s => !s.isBooked).length}
                </p>
              </CardContent>
            </Card>
          </div>

          <section>
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-left">Recent Bookings</h2>
              </div>
              
              <div className="flex flex-wrap gap-4 items-end bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <p className="text-xs font-medium text-muted-foreground px-1 text-left">Clinic</p>
                  <Select value={filterClinic} onValueChange={setFilterClinic}>
                    <SelectTrigger className="rounded-xl h-10 border-border/50 bg-background">
                      <SelectValue placeholder="All Clinics" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Clinics</SelectItem>
                      {clinics.map(clinic => (
                        <SelectItem key={clinic} value={clinic}>{clinic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <p className="text-xs font-medium text-muted-foreground px-1 text-left">Start Date</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start text-left font-normal rounded-xl h-10 bg-background border-border/50 ${!filterDate && "text-muted-foreground"}`}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterDate ? format(filterDate, "PPP") : "Select date"}
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

                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <p className="text-xs font-medium text-muted-foreground px-1 text-left">End Date (Optional)</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start text-left font-normal rounded-xl h-10 bg-background border-border/50 ${!filterEndDate && "text-muted-foreground"}`}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterEndDate ? format(filterEndDate, "PPP") : "Select end date"}
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

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setFilterDate(startOfToday());
                    setFilterEndDate(undefined);
                    setFilterClinic("all");
                  }}
                  className="rounded-xl h-10 px-4 text-muted-foreground hover:text-foreground"
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBookings?.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-muted/20 rounded-2xl border border-dashed">
                  <p className="text-muted-foreground">No bookings found for the selected criteria.</p>
                </div>
              ) : (
                filteredBookings?.map((booking) => (
                  <Card key={booking.id} className="overflow-hidden border-border/50 hover:shadow-md transition-shadow">
                    <CardHeader className="bg-primary/5 pb-4 text-left">
                      <div className="flex justify-between items-start">
                        <div className="text-left">
                          <CardTitle className="text-lg text-left">{booking.customerName}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 text-left">
                            <Phone className="h-3 w-3" />
                            {booking.customerPhone}
                          </div>
                          {booking.slot.clinicName && (
                            <div className="text-xs font-semibold text-primary mt-1 text-left">
                              {booking.slot.clinicName}
                            </div>
                          )}
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
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-left">Your Availability</h2>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                <ListFilter className="h-4 w-4" />
                Filter
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedSlots?.filter(s => !s.isBooked).map((slot) => (
                <SlotCard key={slot.id} slot={slot} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
