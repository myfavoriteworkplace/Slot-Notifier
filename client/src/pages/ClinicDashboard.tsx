import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar as CalendarIcon, Phone, Clock, Building2, LogOut, X } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState, useEffect } from "react";
import type { Slot, Booking } from "@shared/schema";

type BookingWithSlot = Booking & { slot: Slot };

export default function ClinicDashboard() {
  const { clinic, isLoading: authLoading, isAuthenticated, logout, isLoggingOut } = useClinicAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [filterDate, setFilterDate] = useState<Date | undefined>(new Date());
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
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
    },
    onError: () => {
      toast({ title: "Failed to cancel booking", variant: "destructive" });
    },
  });

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
  const todaysBookingsCount = bookings?.filter(b => {
    const bookingDateStr = format(new Date(b.slot.startTime), 'yyyy-MM-dd');
    return bookingDateStr === todayStr;
  }).length || 0;

  const handleLogout = () => {
    logout();
    setLocation("/clinic-login");
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-left">{clinic?.name}</h1>
            <p className="text-muted-foreground mt-1 text-left">View and manage your clinic's bookings</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={handleLogout} 
          disabled={isLoggingOut}
          className="gap-2"
          data-testid="button-clinic-logout"
        >
          {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Logout
        </Button>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 text-left">
              <p className="text-sm font-medium text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold mt-2">{bookings?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 text-left">
              <p className="text-sm font-medium text-muted-foreground">Today's Bookings</p>
              <p className="text-2xl font-bold mt-2 text-primary">
                {todaysBookingsCount}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 text-left">
              <p className="text-sm font-medium text-muted-foreground">Filtered Results</p>
              <p className="text-2xl font-bold mt-2 text-accent">
                {filteredBookings?.length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <section>
          <div className="flex flex-col space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-left">Bookings</h2>
            </div>
            
            <div className="flex flex-wrap gap-4 items-end bg-muted/30 p-4 rounded-xl border border-border/50">
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => cancelBookingMutation.mutate(booking.id)}
                          disabled={cancelBookingMutation.isPending}
                          data-testid={`button-cancel-booking-${booking.id}`}
                        >
                          {cancelBookingMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <X className="h-4 w-4 mr-2" />
                          )}
                          Cancel Booking
                        </Button>
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
