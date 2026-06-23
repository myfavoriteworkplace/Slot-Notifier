import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import {
  Loader2, Plus, CalendarDays, Calendar as CalendarIcon, User, Phone,
  Clock, Sun, Moon, CheckCircle2, X, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  DEFAULT_SLOT_TIMINGS, DEFAULT_SECTION_CAPACITY, PROCEDURE_SLOT_COST,
  DENTAL_CATEGORIES,
} from "@/lib/clinic-constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format, startOfToday, addDays, isSameDay, isAfter } from "date-fns";

const slotTimings = DEFAULT_SLOT_TIMINGS;
const COMPLAINTS_INITIAL_VISIBLE = 4;

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${hour < 12 ? "AM" : "PM"}`;
}

type AdminSlotAvailRow = {
  slotIndex: number;
  label: string;
  startTimeISO: string;
  count: number;
  max: number;
  isCancelled: boolean;
  spotsLeft: number;
};

export interface BookASlotPrefillData {
  name?: string;
  phone?: string;
  email?: string;
  age?: string;
  gender?: string;
  description?: string;
  visitType?: string;
  appointmentCategory?: string;
}

interface Props {
  clinic: any;
  prefillData?: BookASlotPrefillData | null;
}

export default function BookASlotPanel({ clinic, prefillData }: Props) {
  const [bookingName, setBookingName] = useState(prefillData?.name ?? "");
  const [bookingPhone, setBookingPhone] = useState(prefillData?.phone ?? "");
  const [bookingEmail, setBookingEmail] = useState(prefillData?.email ?? "");
  const [bookingAge, setBookingAge] = useState(prefillData?.age ?? "");
  const [bookingGender, setBookingGender] = useState(prefillData?.gender ?? "");
  const [patientSuggestions, setPatientSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bookingDescription, setBookingDescription] = useState(prefillData?.description ?? "");
  const [bookingDate, setBookingDate] = useState<Date>(startOfToday());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingShowReview, setBookingShowReview] = useState(false);
  const [bookingSlotPanelOpen, setBookingSlotPanelOpen] = useState(false);
  const [bookingOpenCategory, setBookingOpenCategory] = useState<string | null>(null);
  const [complaintsExpanded, setComplaintsExpanded] = useState(false);
  const [bookingAppointmentCategory, setBookingAppointmentCategory] = useState(prefillData?.appointmentCategory ?? "");
  const [bookingVisitType, setBookingVisitType] = useState(prefillData?.visitType ?? "");

  const handleComplaintClick = (complaint: string) => {
    const currentComplaints = bookingDescription ? bookingDescription.split(", ").filter(Boolean) : [];
    let newDescription = "";
    if (currentComplaints.includes(complaint)) {
      newDescription = currentComplaints.filter(c => c !== complaint).join(", ");
    } else {
      newDescription = [...currentComplaints, complaint].join(", ");
    }
    setBookingDescription(newDescription);
  };

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

  const resetBookingForm = () => {
    setBookingName("");
    setBookingPhone("");
    setBookingEmail("");
    setBookingAge("");
    setBookingGender("");
    setBookingDescription("");
    setBookingDate(startOfToday());
    setSelectedSlot(null);
    setPhoneError("");
    setBookingSuccess(false);
    setBookingShowReview(false);
    setBookingSlotPanelOpen(false);
    setBookingOpenCategory(null);
    setBookingAppointmentCategory("");
    setBookingVisitType("");
  };

  const fetchPatientSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setPatientSuggestions([]); setShowSuggestions(false); return; }
    setSuggestionsLoading(true);
    try {
      const res = await apiRequest('GET', `/api/auth/clinic/patients/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setPatientSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
    } catch { }
    finally { setSuggestionsLoading(false); }
  }, []);

  const handleBookingNameChange = (val: string) => {
    setBookingName(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchPatientSuggestions(val), 300);
  };

  const applyPatientSuggestion = (p: any) => {
    setBookingName(p.name || "");
    setBookingPhone(p.phone || "");
    setBookingEmail(p.email || "");
    setBookingAge(p.age ? String(p.age) : "");
    setBookingGender(p.gender || "");
    setPatientSuggestions([]);
    setShowSuggestions(false);
  };

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/auth/clinic/bookings', data);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Failed to create booking (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      setBookingSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      notify.success("Booking Created!", { description: "The appointment has been successfully booked." });
    },
    onError: (error: any) => {
      notify.apiError(error, "Booking Failed");
    },
  });

  const handleCreateBooking = () => {
    if (!selectedSlot || !bookingName || !bookingPhone || !clinic) return;
    const slotInfo = slotTimings.find(s => s.id === selectedSlot);
    if (!slotInfo) return;

    const startTime = new Date(bookingDate);
    startTime.setHours(slotInfo.startHour, slotInfo.startMinute, 0, 0);
    const endTime = new Date(bookingDate);
    endTime.setHours(slotInfo.endHour, slotInfo.endMinute, 0, 0);

    const descParts: string[] = [];
    if (bookingAppointmentCategory) descParts.push(`Category: ${bookingAppointmentCategory}`);
    if (bookingVisitType) descParts.push(`Visit: ${bookingVisitType}`);
    if (bookingAge) descParts.push(`Age: ${bookingAge}`);
    if (bookingGender) descParts.push(`Gender: ${bookingGender}`);
    if (bookingDescription) descParts.push(bookingDescription);

    const slotCost = bookingAppointmentCategory ? (PROCEDURE_SLOT_COST[bookingAppointmentCategory] ?? 1) : 1;

    createBookingMutation.mutate({
      customerName: bookingName,
      customerPhone: bookingPhone,
      customerEmail: bookingEmail,
      clinicId: clinic.id,
      clinicName: clinic.name,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      description: descParts.join(' | '),
      slotCost,
      verificationStatus: 'confirmed',
      confirmedBy: 'admin',
    } as any);
  };

  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  const { data: adminSlotAvailability, isFetching: adminSlotFetching } = useQuery<AdminSlotAvailRow[]>({
    queryKey: ['admin-slot-availability', clinic?.id, format(bookingDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!clinic) return [];
      const payload = {
        clinicId: clinic.id,
        slots: slotTimings.map((slot, idx) => {
          const t = new Date(bookingDate);
          t.setHours(slot.startHour, slot.startMinute, 0, 0);
          return { slotIndex: idx, label: slot.label, startTimeISO: t.toISOString() };
        }),
      };
      const res = await apiRequest('POST', '/api/public/slot-availability', payload);
      if (!res.ok) throw new Error('Failed to fetch slot availability');
      return res.json();
    },
    enabled: !!clinic && bookingSlotPanelOpen,
    staleTime: 30_000,
  });

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <div className="flex border-b border-border/40">
        <div className="w-1.5 bg-primary/60 shrink-0" />
        <div className="flex-1 px-5 py-4 bg-gradient-to-r from-primary/[0.06] to-transparent flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Plus className="h-[18px] w-[18px] text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Book a Slot</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create a new patient appointment</p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        {bookingSuccess ? (
          <div className="py-10 flex flex-col items-center gap-5 text-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-emerald-400/20 to-primary/20 blur-xl animate-pulse" />
              <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold tracking-tight">Booking Confirmed!</h3>
              <p className="text-sm text-muted-foreground">The appointment has been created successfully.</p>
            </div>
            <div className="w-full rounded-2xl border border-border/60 bg-muted/20 overflow-hidden text-left">
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking Summary</span>
              </div>
              <div className="divide-y divide-border/40">
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{bookingName}</span>
                </div>
                {bookingPhone && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{bookingPhone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-3 w-3 text-emerald-500" />
                  </div>
                  <span className="text-sm font-medium">{format(bookingDate, "EEEE, MMM d, yyyy")}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => resetBookingForm()}
              className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
              data-testid="button-book-another"
            >
              Book Another Appointment
            </Button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">

            {/* LEFT: Patient Details */}
            <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient Details</span>
              </div>

              {/* Name — with autocomplete */}
              <div className="space-y-1.5">
                <Label htmlFor="booking-name" className="block">Patient Name <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="booking-name"
                    value={bookingName}
                    onChange={(e) => handleBookingNameChange(e.target.value)}
                    placeholder="e.g. Rahul Verma"
                    onFocus={(e) => {
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      if (bookingName.length >= 2) fetchPatientSuggestions(bookingName);
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                    autoComplete="off"
                    data-testid="input-booking-name"
                  />
                  {suggestionsLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {showSuggestions && patientSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-1.5 border-b border-border/40 bg-muted/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing patients</p>
                      </div>
                      {patientSuggestions.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => applyPatientSuggestion(p)}
                          className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-primary/5 active:bg-primary/10 transition-colors min-h-[44px] border-b border-border/30 last:border-0"
                          data-testid={`suggestion-patient-${p.id}`}
                        >
                          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 font-bold text-primary text-xs">
                            {(p.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.patientCode && <span className="font-mono">{p.patientCode}</span>}
                              {p.age && <span> · {p.age}y</span>}
                              {p.gender && <span> · {p.gender}</span>}
                              {p.phone && <span> · {p.phone}</span>}
                            </p>
                          </div>
                          <span className="text-xs text-primary shrink-0 font-medium">Fill →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="booking-phone" className="block">Mobile <span className="text-destructive">*</span></Label>
                  <Input
                    id="booking-phone"
                    type="tel"
                    value={bookingPhone}
                    onChange={(e) => handleBookingPhoneChange(e.target.value)}
                    className={phoneError ? "border-destructive" : ""}
                    placeholder="+91 98765 43210"
                    onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    data-testid="input-booking-phone"
                  />
                  {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-email" className="block">Email <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="booking-email"
                    type="email"
                    value={bookingEmail}
                    onChange={(e) => setBookingEmail(e.target.value)}
                    placeholder="e.g. patient@example.com"
                    onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    data-testid="input-booking-email"
                  />
                  <p className="text-xs text-muted-foreground">Confirmation will be sent if provided</p>
                </div>
              </div>

              {/* Age + Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="booking-age" className="block">Age <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="booking-age"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={120}
                    value={bookingAge}
                    onChange={(e) => setBookingAge(e.target.value)}
                    placeholder="e.g. 32"
                    onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    data-testid="input-booking-age"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-gender" className="block">Gender <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                  <Select value={bookingGender} onValueChange={setBookingGender}>
                    <SelectTrigger id="booking-gender" data-testid="select-booking-gender">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category + Visit Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="booking-category" className="block">
                    Category
                    <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
                  </Label>
                  <Select value={bookingAppointmentCategory} onValueChange={setBookingAppointmentCategory}>
                    <SelectTrigger id="booking-category" data-testid="select-booking-category">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Consultation">Consultation <span className="text-muted-foreground font-normal">(1 slot)</span></SelectItem>
                      <SelectItem value="Diagnostics">Diagnostics <span className="text-muted-foreground font-normal">(1 slot)</span></SelectItem>
                      <SelectItem value="Cleaning / Preventive">Cleaning / Preventive <span className="text-muted-foreground font-normal">(2 slots)</span></SelectItem>
                      <SelectItem value="Fillings / Minor Restorations">Fillings / Minor Restorations <span className="text-muted-foreground font-normal">(2 slots)</span></SelectItem>
                      <SelectItem value="Major Procedures">Major Procedures <span className="text-muted-foreground font-normal">(3 slots)</span></SelectItem>
                    </SelectContent>
                  </Select>
                  {bookingAppointmentCategory && (() => {
                    const cost = PROCEDURE_SLOT_COST[bookingAppointmentCategory] ?? 1;
                    return (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span className="inline-flex items-center gap-1 font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-400/20 rounded-md px-1.5 py-0.5 text-xs">
                          {cost} slot{cost > 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground/70">reserved for this procedure</span>
                      </p>
                    );
                  })()}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-visit-type" className="block">
                    Visit Type
                    <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
                  </Label>
                  <Select value={bookingVisitType} onValueChange={setBookingVisitType}>
                    <SelectTrigger id="booking-visit-type" data-testid="select-booking-visit-type">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First Visit">First Visit</SelectItem>
                      <SelectItem value="Re-visit">Re-visit</SelectItem>
                      <SelectItem value="Follow-up Required">Follow up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Chief Complaints */}
              <div className="space-y-2">
                <div>
                  <Label className="block">Chief Complaints <span className="text-xs font-normal text-muted-foreground">(select all that apply)</span></Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Tap a category to expand and select specific issues</p>
                </div>

                {bookingDescription && (
                  <div className="flex flex-wrap gap-1 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="w-full text-xs font-semibold text-primary mb-1">Selected complaints:</p>
                    {bookingDescription.split(", ").filter(Boolean).map(issue => (
                      <span key={issue} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full flex items-center gap-1 min-h-[28px]">
                        {issue}
                        <button
                          type="button"
                          onClick={() => handleComplaintClick(issue)}
                          className="hover:text-destructive active:text-destructive transition-colors ml-0.5"
                          data-testid={`remove-complaint-${issue.replace(/[^\w]+/g, '-').toLowerCase()}`}
                          aria-label={`Remove ${issue}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-border/40 divide-y divide-border/30">
                  {DENTAL_CATEGORIES.slice(0, complaintsExpanded ? DENTAL_CATEGORIES.length : COMPLAINTS_INITIAL_VISIBLE).map((cat) => {
                    const isOpen = bookingOpenCategory === cat.category;
                    const hasSelected = cat.subIssues.some(s => bookingDescription.split(", ").includes(s));
                    return (
                      <div key={cat.category}>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[44px]"
                          onClick={() => setBookingOpenCategory(isOpen ? null : cat.category)}
                          data-testid={`complaint-cat-${cat.category.replace(/[^\w]+/g, '-').toLowerCase()}`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <cat.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-left leading-snug">{cat.category}</span>
                            {hasSelected && (
                              <span className="inline-flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 text-xs px-1.5 py-0.5 rounded-full leading-none font-semibold">
                                {cat.subIssues.filter(s => bookingDescription.split(", ").includes(s)).length} selected
                              </span>
                            )}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 pt-2 bg-muted/10 border-t border-border/20">
                            <p className="text-xs text-muted-foreground mb-2">Tap to select all that apply</p>
                            <div className="flex flex-wrap gap-1.5">
                              {cat.subIssues.map((complaint) => {
                                const isSelected = bookingDescription.split(", ").includes(complaint);
                                return (
                                  <button
                                    key={complaint}
                                    type="button"
                                    onClick={() => handleComplaintClick(complaint)}
                                    data-testid={`complaint-${complaint.replace(/[^\w]+/g, '-').toLowerCase()}`}
                                    className={`text-xs px-2.5 py-1.5 rounded-full border transition-all min-h-[32px] font-medium ${
                                      isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm active:scale-95'
                                        : 'bg-background text-foreground border-border/60 hover:border-primary/40 hover:bg-primary/5 active:scale-95'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3 w-3 mr-1 shrink-0" />}{complaint}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setComplaintsExpanded(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 active:bg-muted/60 active:scale-[0.99] transition-all text-xs font-semibold text-muted-foreground min-h-[44px]"
                  data-testid="button-complaints-expand"
                >
                  {complaintsExpanded
                    ? <><ChevronUp className="h-3.5 w-3.5" /> Show fewer categories</>
                    : <><ChevronDown className="h-3.5 w-3.5" /> Show {DENTAL_CATEGORIES.length - COMPLAINTS_INITIAL_VISIBLE} more categories</>
                  }
                </button>
              </div>
            </div>

            {/* Dividers */}
            <div className="hidden lg:block w-px bg-border/40 self-stretch" />
            <div className="lg:hidden h-px w-full bg-border/40" />

            {/* RIGHT: Date & Slot */}
            <div className="lg:w-[320px] shrink-0 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Select Appointment</span>
              </div>

              {/* Date strip */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">{format(bookingDate, "EEE, d MMM yyyy")}</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" data-testid="button-booking-calendar">
                        <CalendarIcon className="h-3.5 w-3.5" /> Pick date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl shadow-2xl border-border/50" align="end">
                      <Calendar
                        mode="single"
                        selected={bookingDate}
                        onSelect={(date) => {
                          if (date) { setBookingDate(date); setSelectedSlot(null); setBookingSlotPanelOpen(true); }
                        }}
                        disabled={(date) => date < startOfToday()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <ScrollArea className="w-full whitespace-nowrap pb-2">
                  <div className="flex space-x-2 px-0.5">
                    {dates.map((date) => {
                      const isSelected = isSameDay(date, bookingDate);
                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => { setBookingDate(date); setSelectedSlot(null); setBookingSlotPanelOpen(true); }}
                          data-testid={`booking-date-${format(date, 'yyyy-MM-dd')}`}
                          className={`flex flex-col items-center justify-center min-w-[3.25rem] h-14 rounded-xl border transition-all duration-200 ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                              : 'bg-card border-border/50 hover:border-primary/50 hover:bg-primary/5'
                          }`}
                        >
                          <span className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{format(date, "EEE")}</span>
                          <span className="text-sm font-bold leading-none mt-0.5">{format(date, "d")}</span>
                        </button>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>

              {/* Slot reveal */}
              {!bookingSlotPanelOpen ? (
                <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-border/50 gap-2 text-center">
                  <CalendarDays className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Tap a date above to see available slots</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Available Time Slots</span>
                    <span className="text-xs text-muted-foreground/60 font-normal">· 1 slot ≈ 25 min</span>
                  </div>
                  {adminSlotFetching ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="h-[60px] rounded-xl border border-border/40 bg-muted/30 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {slotTimings.map((slot, slotIdx) => {
                        const avail = adminSlotAvailability?.find(a => a.slotIndex === slotIdx);
                        const isSlotCancelled = avail?.isCancelled ?? false;
                        if (isSlotCancelled) return null;
                        const spotsLeft = avail?.spotsLeft ?? DEFAULT_SECTION_CAPACITY[slot.id] ?? 4;
                        const thisCost = bookingAppointmentCategory ? (PROCEDURE_SLOT_COST[bookingAppointmentCategory] ?? 1) : 1;
                        const isFull = avail ? avail.spotsLeft < thisCost : false;
                        const isSelected = selectedSlot === slot.id;
                        const adminSlotStart = new Date(bookingDate);
                        adminSlotStart.setHours(slot.startHour, slot.startMinute, 0, 0);
                        const isSlotPast = isAfter(new Date(), adminSlotStart);
                        const isSlotDisabled = isFull || isSlotPast;
                        const slotIcon = slot.startHour < 12
                          ? { Icon: Sun, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-400/30" }
                          : slot.startHour < 16
                          ? { Icon: Clock, color: "text-sky-500", bg: "bg-sky-500/10", border: "border-sky-400/30" }
                          : { Icon: Moon, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" };
                        const { Icon, color, bg, border } = slotIcon;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => !isSlotDisabled && setSelectedSlot(slot.id)}
                            disabled={isSlotDisabled}
                            data-testid={`booking-slot-${slot.id}`}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                              isSelected
                                ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20 shadow-sm"
                                : isSlotDisabled
                                ? "bg-muted/20 border-border/30 opacity-50 cursor-not-allowed"
                                : "bg-card border-border/50 hover:border-primary/30 hover:bg-primary/5 active:border-primary/50 active:bg-primary/10"
                            }`}
                          >
                            <div className={`h-9 w-9 rounded-lg ${bg} border ${border} flex items-center justify-center shrink-0`}>
                              <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-tight">{slot.label}</p>
                              <p className="text-xs text-muted-foreground">{formatTime(slot.startHour, slot.startMinute)} – {formatTime(slot.endHour, slot.endMinute)}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {isSlotPast ? (
                                <span className="text-xs font-bold bg-muted/60 text-muted-foreground border border-border/40 px-2 py-0.5 rounded-lg">Past</span>
                              ) : isFull ? (
                                <span className="text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-lg">Full</span>
                              ) : (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${spotsLeft <= 2 ? "bg-amber-500/10 text-amber-600 border-amber-400/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-400/20"}`}>
                                  {spotsLeft} left
                                </span>
                              )}
                            </div>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Selected slot summary */}
              {selectedSlot && (() => {
                const info = slotTimings.find(s => s.id === selectedSlot);
                return info ? (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary/8 border border-primary/20">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary">{format(bookingDate, 'd MMM')} · {info.label}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(info.startHour, info.startMinute)} – {formatTime(info.endHour, info.endMinute)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 active:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      data-testid="button-clear-slot"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null;
              })()}

              {/* Review / Confirm */}
              {bookingShowReview ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                    <div className="px-3 py-2.5 bg-muted/20">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Patient</p>
                      <p className="text-sm font-bold mt-0.5">{bookingName}</p>
                      <p className="text-xs text-muted-foreground">
                        {bookingPhone}
                        {bookingAge ? ` · Age ${bookingAge}` : ""}
                        {bookingGender ? ` · ${bookingGender}` : ""}
                        {bookingEmail ? ` · ${bookingEmail}` : ""}
                      </p>
                    </div>
                    {(() => {
                      const reviewSlot = slotTimings.find(s => s.id === selectedSlot);
                      return reviewSlot ? (
                        <div className="px-3 py-2.5">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Appointment</p>
                          <p className="text-sm font-bold mt-0.5">{format(bookingDate, "EEE, d MMM yyyy")}</p>
                          <p className="text-xs text-muted-foreground">{reviewSlot.label} · {formatTime(reviewSlot.startHour, reviewSlot.startMinute)}–{formatTime(reviewSlot.endHour, reviewSlot.endMinute)}</p>
                        </div>
                      ) : null;
                    })()}
                    {(bookingAppointmentCategory || bookingVisitType) && (
                      <div className="px-3 py-2.5">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Classification</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {bookingAppointmentCategory && (
                            <>
                              <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">{bookingAppointmentCategory}</span>
                              {(PROCEDURE_SLOT_COST[bookingAppointmentCategory] ?? 1) > 1 && (
                                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-400/20 px-2 py-0.5 rounded-full">
                                  {PROCEDURE_SLOT_COST[bookingAppointmentCategory]} slots · {(PROCEDURE_SLOT_COST[bookingAppointmentCategory] ?? 1) * 25} min
                                </span>
                              )}
                            </>
                          )}
                          {bookingVisitType && (
                            <span className="text-xs bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">{bookingVisitType}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {bookingDescription && (
                      <div className="px-3 py-2.5">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Complaints</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {bookingDescription.split(", ").filter(Boolean).map(issue => (
                            <span key={issue} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">{issue}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setBookingShowReview(false)} className="flex-1 h-10 rounded-xl border border-border/60 bg-muted/20 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60 active:text-foreground transition-all flex items-center justify-center gap-1.5" data-testid="button-admin-review-back"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
                    <button type="button" onClick={handleCreateBooking} disabled={createBookingMutation.isPending} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-bold shadow-md shadow-primary/20 hover:from-primary/90 hover:to-accent/90 active:from-primary/80 active:to-accent/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed" data-testid="button-create-booking">
                      {createBookingMutation.isPending
                        ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating…</span>
                        : <span className="flex items-center justify-center gap-1.5">Confirm & Book <ArrowRight className="h-3.5 w-3.5" /></span>}
                    </button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setBookingShowReview(true)}
                  disabled={!bookingName || !isPhoneValid || !selectedSlot}
                  className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                  data-testid="button-review-booking"
                >
                  Review Booking →
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
