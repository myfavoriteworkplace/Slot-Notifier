import { useEffect } from "react";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Stethoscope, Building2, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function DoctorDashboard() {
  const { doctor, isLoading, isAuthenticated, logout, isLoggingOut } = useDoctorAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/clinic-login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  const { data: bookings, isLoading: isBookingsLoading } = useQuery({
    queryKey: ["/api/clinic/bookings", doctor?.clinicId],
    enabled: !!doctor?.clinicId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!doctor) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setLocation("/clinic-login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={doctor.logoUrl || undefined} alt={doctor.clinicName} />
              <AvatarFallback className="bg-primary/10">
                <Stethoscope className="h-6 w-6 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold">{doctor.name}</h1>
              <p className="text-sm text-muted-foreground">{doctor.specialization}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout} 
            disabled={isLoggingOut}
            data-testid="button-doctor-logout"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Clinic</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{doctor.clinicName}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Specialization</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-sm">
                {doctor.specialization}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Today's Appointments</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isBookingsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <p className="text-2xl font-bold">
                  {Array.isArray(bookings) ? bookings.filter((b: any) => {
                    const bookingDate = new Date(b.slot?.startTime);
                    const today = new Date();
                    return bookingDate.toDateString() === today.toDateString();
                  }).length : 0}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isBookingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : Array.isArray(bookings) && bookings.length > 0 ? (
                <div className="space-y-4">
                  {bookings.slice(0, 10).map((booking: any) => (
                    <div 
                      key={booking.id} 
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      data-testid={`booking-item-${booking.id}`}
                    >
                      <div>
                        <p className="font-medium">{booking.customerName}</p>
                        <p className="text-sm text-muted-foreground">{booking.customerPhone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {booking.slot?.startTime ? new Date(booking.slot.startTime).toLocaleDateString() : 'N/A'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.slot?.startTime ? new Date(booking.slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming appointments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
