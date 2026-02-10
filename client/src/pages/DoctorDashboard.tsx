import { useEffect, useState } from "react";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Stethoscope, Building2, User, Search, Calendar, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Patient, Clinic } from "@shared/schema";

export default function DoctorDashboard() {
  const { doctor, isLoading, isAuthenticated, logout, isLoggingOut } = useDoctorAuth();
  const [_, setLocation] = useLocation();
  const [selectedClinic, setSelectedClinic] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/clinic-login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  const { data: patients = [], isLoading: loadingPatients } = useQuery<(Patient & { clinic: Clinic })[]>({
    queryKey: ["/api/doctor/patients"],
    enabled: isAuthenticated
  });

  const { data: doctorClinics = [] } = useQuery<Clinic[]>({
    queryKey: ["/api/doctor/clinics"],
    enabled: isAuthenticated
  });

  const { data: bookings = [], isLoading: isBookingsLoading } = useQuery({
    queryKey: ["/api/clinic/bookings", doctor?.clinicId],
    enabled: !!doctor?.clinicId,
  });

  const [appointmentDateFilter, setAppointmentDateFilter] = useState<string>("");
  const [appointmentClinicFilter, setAppointmentClinicFilter] = useState<string>("all");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!doctor) return null;

  const filteredPatients = patients.filter(p => {
    const matchesClinic = selectedClinic === "all" || p.clinicId === parseInt(selectedClinic);
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (p.phone && p.phone.includes(searchTerm));
    return matchesClinic && matchesSearch;
  });

  // Group patients by clinic for display
  const groupedPatients = filteredPatients.reduce((acc, p) => {
    const clinicName = p.clinic?.name || "Unknown Clinic";
    if (!acc[clinicName]) acc[clinicName] = [];
    acc[clinicName].push(p);
    return acc;
  }, {} as Record<string, typeof filteredPatients>);

  const filteredBookings = Array.isArray(bookings) ? bookings.filter((booking: any) => {
    const matchesClinic = appointmentClinicFilter === "all" || booking.clinicId === parseInt(appointmentClinicFilter);
    const bookingDate = booking.slot?.startTime ? new Date(booking.slot.startTime).toISOString().split('T')[0] : "";
    const matchesDate = !appointmentDateFilter || bookingDate === appointmentDateFilter;
    return matchesClinic && matchesDate;
  }) : [];

  return (
    <div className="min-h-screen bg-muted/30">
      {doctor.isDefaultPassword && (
        <div className="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium animate-in fade-in slide-in-from-top duration-500">
          You are using the default password. For security, please reset via email.
        </div>
      )}
      
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={(doctor as any).imageUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {doctor.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold">Dr. {doctor.name}</h1>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px] py-0">{doctor.specialization}</Badge>
                <Badge variant="secondary" className="text-[10px] py-0">{doctor.clinicName}</Badge>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => logout()} 
            disabled={isLoggingOut}
            className="text-muted-foreground hover:text-destructive"
          >
            {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="patients" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <TabsList>
              <TabsTrigger value="patients" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Patients
              </TabsTrigger>
              <TabsTrigger value="appointments" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Appointments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="patients" className="m-0 flex-1 w-full md:w-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search patients..." 
                    className="pl-9 h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={selectedClinic} onValueChange={setSelectedClinic}>
                  <SelectTrigger className="w-full sm:w-[200px] h-9">
                    <SelectValue placeholder="All Clinics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clinics</SelectItem>
                    {doctorClinics.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </div>

          <TabsContent value="patients" className="space-y-8 animate-in fade-in duration-500">
            {loadingPatients ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              </div>
            ) : Object.keys(groupedPatients).length > 0 ? (
              Object.entries(groupedPatients).map(([clinicName, clinicPatients]) => (
                <div key={clinicName} className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{clinicName}</h2>
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">{clinicPatients.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clinicPatients.map((patient) => (
                      <Card key={patient.id} className="hover-elevate transition-all overflow-hidden border-border/50 shadow-sm">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/5 text-primary text-xs">
                                {patient.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="overflow-hidden">
                              <CardTitle className="text-base truncate">{patient.name}</CardTitle>
                              <p className="text-xs text-muted-foreground truncate">{patient.email || 'No email'}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="space-y-0.5">
                              <p className="text-muted-foreground">Phone</p>
                              <p className="font-medium">{patient.phone || "—"}</p>
                            </div>
                            <div className="space-y-0.5 text-right">
                              <p className="text-muted-foreground">Joined</p>
                              <p className="font-medium">
                                {new Date(patient.createdAt || "").toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <Card className="py-16 flex flex-col items-center justify-center text-center border-dashed bg-transparent">
                <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-10" />
                <CardTitle className="text-lg text-muted-foreground">No patients found</CardTitle>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  {searchTerm || selectedClinic !== "all" 
                    ? "Adjust your filters to see more results" 
                    : "Assigned patients will appear here grouped by clinic"}
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date"
                  className="pl-9 h-9"
                  value={appointmentDateFilter}
                  onChange={(e) => setAppointmentDateFilter(e.target.value)}
                />
              </div>
              <Select value={appointmentClinicFilter} onValueChange={setAppointmentClinicFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-9">
                  <SelectValue placeholder="All Clinics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clinics</SelectItem>
                  {doctorClinics.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9"
                onClick={() => {
                  setAppointmentDateFilter("");
                  setAppointmentClinicFilter("all");
                }}
              >
                Clear
              </Button>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Appointment Schedule
                </CardTitle>
                <Badge variant="outline" className="font-normal">
                  Showing: {filteredBookings.length}
                </Badge>
              </CardHeader>
              <CardContent>
                {isBookingsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
                  </div>
                ) : filteredBookings.length > 0 ? (
                  <div className="divide-y">
                    {filteredBookings.slice(0, 50).map((booking: any) => (
                      <div 
                        key={booking.id} 
                        className="flex items-center justify-between py-4 group hover:bg-muted/50 transition-colors px-2 rounded-lg"
                        data-testid={`booking-item-${booking.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary text-xs font-medium">
                            {booking.customerName[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{booking.customerName}</p>
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 py-0 font-normal">
                                {booking.clinicName || doctorClinics.find(c => c.id === booking.clinicId)?.name || "Clinic"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{booking.customerPhone}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold">
                            {booking.slot?.startTime ? new Date(booking.slot.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {booking.slot?.startTime ? new Date(booking.slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border-dashed border-2 rounded-lg">
                    <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No scheduled appointments found matching filters</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
