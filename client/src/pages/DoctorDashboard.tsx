import { useEffect, useState } from "react";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Stethoscope, Building2, Calendar, ShieldAlert, Clock, Phone, Mail, ClipboardList, CheckCircle2, AlertCircle, Hash, CalendarDays, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clinic } from "@shared/schema";

export default function DoctorDashboard() {
  const { doctor, isLoading, isAuthenticated, logout, isLoggingOut } = useDoctorAuth();
  const [_, setLocation] = useLocation();
  const [appointmentDateFilter, setAppointmentDateFilter] = useState<string>("");
  const [appointmentClinicFilter, setAppointmentClinicFilter] = useState<string>("all");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/clinic-login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  const { data: doctorClinics = [] } = useQuery<Clinic[]>({
    queryKey: ["/api/doctor/clinics"],
    enabled: isAuthenticated
  });

  const { data: bookings = [], isLoading: isBookingsLoading } = useQuery({
    queryKey: ["/api/auth/clinic/bookings"],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!doctor) return null;

  const allBookings = Array.isArray(bookings) ? bookings : [];
  const myBookings = allBookings.filter((booking: any) => booking.assignedDoctorEmail === doctor.email);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayBookings = myBookings.filter((b: any) => {
    const d = b.slot?.startTime ? new Date(b.slot.startTime).toISOString().split("T")[0] : "";
    return d === todayStr;
  });
  const upcomingBookings = myBookings.filter((b: any) => {
    const d = b.slot?.startTime ? new Date(b.slot.startTime) : null;
    return d && d >= new Date();
  });

  const filteredBookings = myBookings.filter((booking: any) => {
    const matchesClinic = appointmentClinicFilter === "all" || booking.clinicId === parseInt(appointmentClinicFilter);
    const bookingDate = booking.slot?.startTime ? new Date(booking.slot.startTime).toISOString().split("T")[0] : "";
    const matchesDate = !appointmentDateFilter || bookingDate === appointmentDateFilter;
    return matchesClinic && matchesDate;
  });

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 3px neon top bar */}
      <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

      {/* Default password warning */}
      {doctor.isDefaultPassword && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/90 via-yellow-500/90 to-amber-500/90 backdrop-blur-sm text-white px-4 py-2 text-center text-sm font-medium animate-in fade-in slide-in-from-top duration-500 flex items-center justify-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          You are using the default password. For security, please reset via email.
        </div>
      )}

      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-gradient-to-r from-background via-background to-primary/5 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">

          {/* Left — doctor identity */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="h-11 w-11 ring-2 ring-primary/40 shadow-[0_0_14px_hsl(var(--primary)/0.2)]">
                <AvatarImage src={(doctor as any).imageUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold font-display">
                  {doctor.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center shadow-md">
                <Stethoscope className="h-2.5 w-2.5 text-white" />
              </span>
            </div>
            <div>
              <h1 className="text-base font-semibold font-display leading-tight">Dr. {doctor.name}</h1>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge className="text-[10px] py-0 px-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10">
                  {doctor.specialization}
                </Badge>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {doctor.clinicName}
                </span>
              </div>
            </div>
          </div>

          {/* Centre — portal label */}
          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Stethoscope className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary font-display tracking-wide">Doctor Portal</span>
          </div>

          {/* Right — logout */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="border-border/50 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive transition-colors duration-200 shrink-0"
            data-testid="button-logout"
          >
            {isLoggingOut
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <LogOut className="h-4 w-4 mr-1.5" />}
            Logout
          </Button>
        </div>
      </header>

      {/* Hero stats banner */}
      <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_60%)] pointer-events-none" />
        <CalendarDays className="absolute right-8 top-1/2 -translate-y-1/2 h-40 w-40 text-white opacity-[0.05] pointer-events-none select-none" />

        <div className="relative container mx-auto px-4 py-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/55 mb-1">Your Schedule</p>
          <h2 className="text-xl font-extrabold text-white tracking-tight mb-5">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, Dr. {doctor.name.split(" ")[0]}
          </h2>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2.5 bg-white/10 border border-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-white/55 font-medium uppercase tracking-wide leading-none mb-0.5">Total</p>
                <p className="text-lg font-extrabold text-white leading-none">{myBookings.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-white/10 border border-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-white/55 font-medium uppercase tracking-wide leading-none mb-0.5">Today</p>
                <p className="text-lg font-extrabold text-white leading-none">{todayBookings.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-white/10 border border-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-white/55 font-medium uppercase tracking-wide leading-none mb-0.5">Upcoming</p>
                <p className="text-lg font-extrabold text-white leading-none">{upcomingBookings.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
      </div>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              className="pl-9 h-9"
              value={appointmentDateFilter}
              onChange={(e) => setAppointmentDateFilter(e.target.value)}
              data-testid="input-date-filter"
            />
          </div>
          <Select value={appointmentClinicFilter} onValueChange={setAppointmentClinicFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-9" data-testid="select-clinic-filter">
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
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        </div>

        {/* Result count */}
        <p className="text-xs text-muted-foreground px-1">
          Showing <span className="font-semibold text-foreground">{filteredBookings.length}</span> appointment{filteredBookings.length !== 1 ? "s" : ""}
        </p>

        {/* Appointment cards */}
        {isBookingsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
          </div>
        ) : filteredBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBookings.slice(0, 50).map((booking: any) => {
              const startTime = booking.slot?.startTime ? new Date(booking.slot.startTime) : null;
              const endTime = booking.slot?.endTime ? new Date(booking.slot.endTime) : null;
              const durationMin = startTime && endTime
                ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
                : null;
              const clinicName = booking.clinic?.name || booking.clinicName || doctorClinics.find((c: any) => c.id === booking.clinicId)?.name || "Clinic";
              const clinicAddress = booking.clinic?.address || (doctorClinics.find((c: any) => c.id === booking.clinicId) as any)?.address;
              const isVerified = booking.verificationStatus === "verified";

              return (
                <div
                  key={booking.id}
                  data-testid={`booking-card-${booking.id}`}
                  className="rounded-2xl border border-border/50 bg-background shadow-sm shadow-primary/5 overflow-hidden flex flex-col hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300"
                >
                  {/* Gradient top strip */}
                  <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-4 pt-4 pb-3 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                    <div className="relative flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-accent/40 to-primary/30 blur-sm" />
                          <div className="relative h-9 w-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white font-bold text-sm ring-1 ring-white/10">
                            {booking.customerName?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm leading-tight">{booking.customerName}</p>
                          <div className="flex items-center gap-1 mt-0.5 text-white/55 text-[10px]">
                            <Hash className="h-2.5 w-2.5" />
                            <span>REF-{String(booking.id).padStart(4, "0")}</span>
                          </div>
                        </div>
                      </div>
                      {booking.verificationStatus && (
                        <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${isVerified ? "bg-green-500/25 text-green-100" : "bg-amber-400/25 text-amber-100"}`}>
                          {isVerified
                            ? <CheckCircle2 className="h-3 w-3" />
                            : <AlertCircle className="h-3 w-3" />}
                          {isVerified ? "Verified" : "Pending"}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3 flex flex-col gap-2.5 flex-1">
                    {/* Date & time */}
                    <div className="flex items-start gap-2">
                      <Calendar className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold leading-tight">
                          {startTime ? startTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {startTime ? startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                            {endTime ? ` – ${endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                          </span>
                          {durationMin && (
                            <span className="text-[10px] bg-primary/8 text-primary px-1.5 py-0.5 rounded-full font-medium">
                              {durationMin} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Clinic */}
                    <div className="flex items-start gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-medium text-foreground leading-tight">{clinicName}</p>
                        {clinicAddress && <p className="text-muted-foreground mt-0.5 leading-tight">{clinicAddress}</p>}
                      </div>
                    </div>

                    {/* Reason */}
                    {booking.description && (
                      <div className="flex items-start gap-2">
                        <ClipboardList className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{booking.description}</p>
                      </div>
                    )}

                    {/* Contact */}
                    <div className="pt-1 border-t border-border/40 flex flex-wrap gap-x-4 gap-y-1 mt-auto">
                      {booking.customerPhone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{booking.customerPhone}</span>
                        </div>
                      )}
                      {booking.customerEmail && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{booking.customerEmail}</span>
                        </div>
                      )}
                    </div>

                    {/* Booked on */}
                    {booking.createdAt && (
                      <p className="text-[10px] text-muted-foreground/60">
                        Booked {new Date(booking.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground border-dashed border-2 rounded-2xl">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-base">No appointments found</p>
            <p className="text-sm mt-1">
              {appointmentDateFilter || appointmentClinicFilter !== "all"
                ? "Try adjusting your filters"
                : "Appointments assigned to you will appear here"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
