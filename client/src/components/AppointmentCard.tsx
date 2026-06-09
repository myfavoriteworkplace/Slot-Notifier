import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import {
  Phone, Hash, CalendarDays, CheckCircle2, X, UserPlus,
  Building2, Loader2, IndianRupee, ClipboardList, FileText,
  AlertCircle, UserCheck, Activity, CalendarPlus, PenLine,
  Stethoscope, MoreHorizontal, UserX, ShieldCheck, Bell,
  Clock, Tag, Repeat2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { BookingProgressStrip, type LifecycleStage } from "@/components/BookingProgressStrip";

// ──────────────── Types ────────────────

export interface ClinicDoctorEntry {
  name: string;
  specialization: string;
  degree: string;
  email?: string;
}

export interface BookingWithSlot {
  id: number;
  slotId?: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAge?: number | null;
  customerGender?: string | null;
  verificationStatus: string;
  description?: string | null;
  visitType?: string | null;
  treatmentCategory?: string | null;
  assignedDoctor?: string | null;
  assignedDoctorEmail?: string | null;
  doctorApprovalStatus?: string | null;
  doctorNotes?: string | null;
  clinicalStatus?: string | null;
  visitStatus?: string | null;
  checkedInAt?: Date | string | null;
  completedAt?: Date | string | null;
  slotCost?: number | null;
  confirmedBy?: string | null;
  consentSignature?: string | null;
  consentSignedAt?: Date | string | null;
  consentToken?: string | null;
  cancellationReason?: string | null;
  createdAt?: Date | string | null;
  patientCode?: string | null;
  slot: { startTime: string | Date; endTime: string | Date };
  clinicDoctors?: ClinicDoctorEntry[];
  clinicId?: number;
  clinic?: { name?: string; address?: string } | null;
  clinicName?: string | null;
}

export type AppointmentCardRole = "clinic" | "doctor";

export interface AppointmentCardProps {
  booking: BookingWithSlot;
  role: AppointmentCardRole;
  bookingNumber: string;
  complaints?: string[];
  clinicName?: string;
  clinicCity?: string;
  onCardClick: () => void;
  // Clinic actions
  onConfirm?: () => void;
  onCancel?: (reason: string) => void;
  onBill?: () => void;
  onAssignDoctor?: (doctorName: string, doctorEmail: string) => void;
  onCheckIn?: () => void;
  onUndoCheckIn?: () => void;
  onCompleteVisit?: () => void;
  onNoShow?: (reason?: string) => void;
  onSendReminder?: () => void;
  onOverrideComplete?: (reason: string) => void;
  onBookAgain?: () => void;
  // Doctor actions
  onApprove?: () => void;
  onDecline?: () => void;
  onStartConsultation?: () => void;
  onDoctorCompleteVisit?: () => void;
  onOpenNotes?: () => void;
  onOpenRecords?: () => void;
  // Loading states
  confirmPending?: boolean;
  cancelPending?: boolean;
  assignDoctorPending?: boolean;
  checkInPending?: boolean;
  completeVisitPending?: boolean;
  noShowPending?: boolean;
  sendReminderPending?: boolean;
  overridePending?: boolean;
  approvePending?: boolean;
  declinePending?: boolean;
  startConsultPending?: boolean;
}

// ──────────────── Helpers ────────────────

const VISIT_TYPE_LABELS: Record<string, string> = {
  first_visit: "First Visit",
  follow_up: "Follow Up",
  emergency: "Emergency",
  routine_checkup: "Routine Checkup",
  consultation: "Consultation",
  review: "Review",
};

const CLINICAL_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  first_visit:          { label: "First Visit",          cls: "bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800" },
  revisit:              { label: "Revisit",              cls: "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800" },
  follow_up_required:   { label: "Follow-up Required",   cls: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  case_closed:          { label: "Case Closed",          cls: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
};

// ──────────────── Component ────────────────

export function AppointmentCard({
  booking,
  role,
  bookingNumber,
  complaints = [],
  clinicName,
  clinicCity,
  onCardClick,
  onConfirm,
  onCancel,
  onBill,
  onAssignDoctor,
  onCheckIn,
  onUndoCheckIn,
  onCompleteVisit,
  onNoShow,
  onSendReminder,
  onOverrideComplete,
  onBookAgain,
  onApprove,
  onDecline,
  onStartConsultation,
  onDoctorCompleteVisit,
  onOpenNotes,
  onOpenRecords,
  confirmPending,
  cancelPending,
  assignDoctorPending,
  checkInPending,
  completeVisitPending,
  noShowPending,
  sendReminderPending,
  overridePending,
  approvePending,
  declinePending,
  startConsultPending,
}: AppointmentCardProps) {
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOther, setCancelReasonOther] = useState("");
  const [noShowReason, setNoShowReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  // ── Date helpers ──
  const startTime = new Date(booking.slot.startTime);
  const endTime   = new Date(booking.slot.endTime);
  const todayStr      = format(new Date(), "yyyy-MM-dd");
  const bookingDateStr = format(startTime, "yyyy-MM-dd");
  const isToday = bookingDateStr === todayStr;
  const isPast  = startTime < new Date(new Date().setHours(0, 0, 0, 0)) && !isToday;
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  // ── Status helpers ──
  const isCancelled  = booking.verificationStatus === "cancelled";
  const isNoShowState = booking.verificationStatus === "no_show";
  const isTerminal   = isCancelled || isNoShowState;

  const isClinicConfirmed = booking.verificationStatus === "confirmed" || !!booking.confirmedBy;
  const isDoctorConfirmed = booking.doctorApprovalStatus === "approved" || booking.doctorApprovalStatus === "admin_confirmed";
  const isConfirmed = role === "clinic" ? isClinicConfirmed : isDoctorConfirmed;
  const isDoctorDeclined = role === "doctor" && booking.doctorApprovalStatus === "declined";

  const isVisitCompleted       = booking.visitStatus === "completed";
  const isOverrideCompleted    = (booking as any)._overrideCompleted === true; // set by API if needed
  const isTreatmentCompleted   = booking.visitStatus === "treatment_completed" || isVisitCompleted;
  const isInConsultation       = booking.visitStatus === "in_consultation";
  const isCheckedIn            = booking.visitStatus === "checked_in";

  // Derive numeric lifecycle stage (0–4) for progress strip
  const lifecycleStage: LifecycleStage = isVisitCompleted ? 4
    : isTreatmentCompleted ? 3
    : isInConsultation ? 2
    : isCheckedIn ? 1
    : 0;

  // ── Visual classes ──
  const accentBar = isNoShowState
    ? "bg-gradient-to-r from-slate-400 to-slate-300"
    : isCancelled
    ? "bg-gradient-to-r from-rose-400 to-rose-300"
    : isVisitCompleted
    ? "bg-gradient-to-r from-emerald-400 to-teal-400"
    : isTreatmentCompleted
    ? "bg-gradient-to-r from-amber-400 to-yellow-300"
    : isToday
    ? "bg-gradient-to-r from-sky-400 to-cyan-400"
    : isPast
    ? "bg-gradient-to-r from-slate-300 to-slate-200"
    : "bg-gradient-to-r from-primary to-accent";

  const leftBorder = isCancelled
    ? "border-l-[3px] border-l-rose-400 dark:border-l-rose-500"
    : isNoShowState
    ? "border-l-[3px] border-l-slate-400 dark:border-l-slate-500"
    : isVisitCompleted
    ? "border-l-[3px] border-l-emerald-400 dark:border-l-emerald-500"
    : isTreatmentCompleted
    ? "border-l-[3px] border-l-amber-400 dark:border-l-amber-500"
    : isConfirmed
    ? "border-l-[3px] border-l-emerald-400 dark:border-l-emerald-500"
    : "border-l-[3px] border-l-amber-400 dark:border-l-amber-500";

  const headerBg = isNoShowState || isCancelled
    ? "bg-muted/30"
    : isVisitCompleted
    ? "bg-gradient-to-r from-emerald-500/5 to-teal-500/5"
    : isTreatmentCompleted
    ? "bg-gradient-to-r from-amber-500/5 to-yellow-500/5"
    : isToday
    ? "bg-gradient-to-r from-sky-500/10 to-cyan-500/5"
    : "bg-gradient-to-r from-primary/5 to-accent/5";

  const ringClass = role === "doctor" && isCheckedIn
    ? "ring-2 ring-primary/40 ring-offset-2 animate-[pulse_2s_ease-in-out_infinite]"
    : isInConsultation
    ? "ring-2 ring-teal-400/60 ring-offset-2"
    : "";

  // ── Derived display values ──
  const displayClinicName = clinicName || booking.clinicName || booking.clinic?.name;
  const slotCost = booking.slotCost ?? 0;
  const maxChips = role === "clinic" ? 3 : 3;

  // visitType: prefer dedicated column, fall back to description parse
  const rawDesc = booking.description ?? "";
  const parsedVisitType = rawDesc.match(/Visit:\s*([^|,\n]+)/)?.[1]?.trim() ?? null;
  const visitType = booking.visitType || parsedVisitType;
  const visitTypeLabel = visitType ? (VISIT_TYPE_LABELS[visitType] ?? visitType) : null;

  // treatmentCategory: prefer dedicated column, fall back to description parse
  const parsedCategory = rawDesc.match(/Category:\s*([^|,\n]+)/)?.[1]?.trim() ?? null;
  const treatmentCategory = booking.treatmentCategory || parsedCategory;

  // ── Status badge ──
  const StatusBadge = () => {
    if (isCancelled || isDoctorDeclined) return (
      <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
        <X className="h-2.5 w-2.5" />{isDoctorDeclined ? "Declined" : "Cancelled"}
      </span>
    );
    if (isNoShowState) return (
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
        <UserX className="h-2.5 w-2.5" />No Show
      </span>
    );
    if (isVisitCompleted) return (
      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <ShieldCheck className="h-2.5 w-2.5" />Visit Done
      </span>
    );
    if (isTreatmentCompleted) return (
      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
        </span>Tmt. Done
      </span>
    );
    if (isInConsultation) return (
      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />With Doctor
      </span>
    );
    if (isCheckedIn) return (
      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
        </span>Arrived
      </span>
    );
    if (isConfirmed) return (
      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" />Confirmed
      </span>
    );
    if (booking.assignedDoctor && booking.doctorApprovalStatus === "pending") return (
      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
        </span>Awaiting DR
      </span>
    );
    return (
      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
        </span>Pending
      </span>
    );
  };

  // ── Workflow banner ──
  const bannerMsg = isCancelled
    ? { text: "Appointment cancelled", cls: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400" }
    : isNoShowState
    ? { text: "Patient did not arrive", cls: "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400" }
    : isVisitCompleted
    ? { text: "Visit completed successfully", cls: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400" }
    : isTreatmentCompleted
    ? { text: "Doctor completed consultation — awaiting admin closure", cls: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400" }
    : isInConsultation
    ? { text: "Patient currently with doctor", cls: "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400" }
    : isCheckedIn
    ? { text: "Patient checked in — waiting for doctor", cls: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400" }
    : isConfirmed
    ? { text: "Appointment confirmed", cls: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400" }
    : { text: "Appointment awaiting confirmation", cls: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400" };

  // ── Cancel submit ──
  const handleCancelSubmit = () => {
    const reason = cancelReason === "Other" ? cancelReasonOther.trim() : cancelReason;
    onCancel?.(reason);
    setCancelReason(""); setCancelReasonOther("");
  };

  const canShowMoreMenu = role === "clinic" && !isCancelled && !isNoShowState;

  return (
    <Card
      className={`overflow-hidden border-border/50 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 group flex flex-col ${(isPast || isTerminal) ? "opacity-80" : ""} ${leftBorder} ${ringClass}`}
      data-testid={`card-booking-${booking.id}`}
    >
      {/* Accent bar */}
      <div className={`h-[3px] ${accentBar}`} />

      {/* Clickable body */}
      <div
        className="w-full text-left cursor-pointer flex-1 flex flex-col"
        onClick={onCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onCardClick(); }}
      >
        {/* ── Header ── */}
        <div className={`px-3 sm:px-4 pt-2.5 pb-2 ${headerBg} transition-colors`}>
          <div className="flex items-start justify-between gap-2">

            {/* Avatar + name */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="shrink-0 h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 dark:border-primary/30 flex items-center justify-center">
                <span className="text-sm font-bold text-primary dark:text-primary/80 leading-none">
                  {booking.customerName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm leading-tight truncate">{booking.customerName}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-md shrink-0">
                    #{bookingNumber}
                  </span>
                  {booking.patientCode && (
                    <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md shrink-0">
                      {booking.patientCode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  <Phone className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{booking.customerPhone}</span>
                  {(booking.customerAge || booking.customerGender) && (
                    <>
                      <span className="opacity-30">·</span>
                      <span>
                        {booking.customerAge ? `${booking.customerAge}y` : ""}
                        {booking.customerAge && booking.customerGender ? " · " : ""}
                        {booking.customerGender ? booking.customerGender.charAt(0).toUpperCase() + booking.customerGender.slice(1) : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Status + ⋮ menu */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge />

              {/* Doctor visit badge */}
              {role === "doctor" && isCheckedIn && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-1.5 py-px rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Arrived{booking.checkedInAt ? ` · ${format(new Date(booking.checkedInAt), "h:mm a")}` : ""}
                </span>
              )}
              {role === "doctor" && isVisitCompleted && booking.completedAt && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Done · {format(new Date(booking.completedAt), "d MMM h:mm a")}
                </span>
              )}

              {/* ⋮ Three-dot menu — clinic only */}
              {canShowMoreMenu && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 active:scale-[0.95] transition-all"
                      data-testid={`button-more-${booking.id}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1.5 rounded-xl shadow-xl border border-border/60" side="bottom" align="end" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Actions</p>

                    {/* Assign Doctor */}
                    {!isVisitCompleted && !isTreatmentCompleted && (booking.clinicDoctors ?? []).length > 0 && (
                      <MenuButton icon={<Stethoscope className="h-3 w-3" />} label="Reassign Doctor" onClick={() => {}} />
                    )}

                    {/* Send Reminder — only for booked/confirmed, not past */}
                    {!isVisitCompleted && !isTreatmentCompleted && !isPast && (
                      <MenuButton
                        icon={sendReminderPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                        label="Send Reminder"
                        onClick={() => onSendReminder?.()}
                        disabled={sendReminderPending}
                      />
                    )}

                    {/* Mark No Show — only if not yet arrived, show AlertDialog inline */}
                    {!isCheckedIn && !isInConsultation && !isTreatmentCompleted && !isVisitCompleted && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors" data-testid={`button-no-show-${booking.id}`}>
                            {noShowPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                            Mark No Show
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Mark as No Show?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {booking.customerName} will be marked as no-show. You can still rebook them.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="px-1 py-2">
                            <label className="text-sm font-medium">Reason (optional)</label>
                            <Input className="mt-1.5" value={noShowReason} onChange={(e) => setNoShowReason(e.target.value)} placeholder="e.g. Patient didn't call" />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setNoShowReason("")}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { onNoShow?.(noShowReason || undefined); setNoShowReason(""); }} className="bg-amber-600 text-white hover:bg-amber-700">
                              Mark No Show
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <div className="my-1 h-px bg-border/40" />

                    {/* Override complete — available at any non-terminal, non-completed state */}
                    {!isVisitCompleted && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors" data-testid={`button-override-${booking.id}`}>
                            {overridePending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                            Mark Visit Complete ↗
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Force Complete Visit?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will mark the visit as complete, skipping intermediate steps. Skipped stages will be flagged in the audit log.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="px-1 py-2 space-y-1.5">
                            <label className="text-sm font-medium">Reason <span className="text-destructive">*</span></label>
                            <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Admin override, patient left early" />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setOverrideReason("")}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => { onOverrideComplete?.(overrideReason); setOverrideReason(""); }}
                              disabled={!overrideReason.trim()}
                              className="bg-orange-600 text-white hover:bg-orange-700"
                            >
                              Override &amp; Complete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>

        {/* ── Progress Strip ── */}
        <div className="px-3 sm:px-4 pt-1.5 pb-0.5 border-b border-border/30">
          <BookingProgressStrip
            stage={lifecycleStage}
            isCancelled={isCancelled}
            isNoShow={isNoShowState}
          />
        </div>

        {/* ── Workflow Banner ── */}
        <div className={`mx-3 sm:mx-4 mt-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium ${bannerMsg.cls}`}>
          {bannerMsg.text}
        </div>

        {/* ── Info Rows ── */}
        <div className="px-3 sm:px-4 py-2 space-y-1.5">

          {/* Date + time */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-4 w-4 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-2.5 w-2.5 text-primary" />
              </div>
              <span className="font-semibold text-foreground">{format(startTime, "EEE, d MMM")}</span>
              <span className="text-muted-foreground font-medium">
                {format(startTime, "h:mm a")}
                <span className="mx-1 opacity-40">→</span>
                {format(endTime, "h:mm a")}
              </span>
            </div>
            {/* Relative badge */}
            {!isPast && !isTerminal && (() => {
              const d = differenceInCalendarDays(startTime, new Date());
              const lbl = isToday ? "Today" : d === 1 ? "Tomorrow" : `in ${d}d`;
              const cls = isToday
                ? "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20"
                : d === 1
                ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                : "text-muted-foreground bg-muted/50 border-border/50";
              return <span className={`shrink-0 text-[10px] font-semibold border px-1.5 py-px rounded-full ${cls}`}>{lbl}</span>;
            })()}
            {/* Duration */}
            <span className="shrink-0 text-[10px] text-muted-foreground bg-muted/50 border border-border/40 px-1.5 py-px rounded-full">
              {durationMin}m
            </span>
          </div>

          {/* Visit Type + Treatment Category */}
          {(visitTypeLabel || treatmentCategory) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {visitTypeLabel && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 px-1.5 py-0.5 rounded-md">
                  <Repeat2 className="h-2 w-2" />{visitTypeLabel}
                </span>
              )}
              {treatmentCategory && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 rounded-md">
                  <Tag className="h-2 w-2" />{treatmentCategory}
                </span>
              )}
              {slotCost > 1 && (
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 border border-border/40 px-1.5 py-0.5 rounded-md">
                  {slotCost} slots · {slotCost * 25} min
                </span>
              )}
            </div>
          )}

          {/* Clinic name — doctor view */}
          {role === "doctor" && displayClinicName && (
            <div className="flex items-center gap-2 text-xs min-w-0">
              <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                <Building2 className="h-2.5 w-2.5 text-muted-foreground" />
              </div>
              <span className="font-medium truncate">{displayClinicName}{clinicCity ? ` (${clinicCity})` : ""}</span>
            </div>
          )}

          {/* Cancellation / no-show reason */}
          {(isCancelled || isNoShowState) && booking.cancellationReason && (
            <div className="flex items-start gap-2 text-xs min-w-0">
              <AlertCircle className="h-3 w-3 text-muted-foreground shrink-0 mt-px" />
              <span className="text-muted-foreground italic truncate">{booking.cancellationReason}</span>
            </div>
          )}

          {/* Doctor assignment — clinic view */}
          {role === "clinic" && (() => {
            if (booking.assignedDoctor) {
              const drStatus = isCancelled ? null
                : booking.doctorApprovalStatus === "pending"
                ? <span className="text-amber-600 dark:text-amber-400">Awaiting approval</span>
                : booking.doctorApprovalStatus === "approved"
                ? <span className="text-emerald-600 dark:text-emerald-400">Approved ✓</span>
                : booking.doctorApprovalStatus === "admin_confirmed"
                ? <span className="text-emerald-600 dark:text-emerald-400">Admin confirmed ✓</span>
                : booking.doctorApprovalStatus === "declined"
                ? <span className="text-rose-600 dark:text-rose-400">Declined ✗</span>
                : null;
              return (
                <div className="flex items-center gap-2 text-xs min-w-0">
                  <div className="h-4 w-4 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <span className="font-medium text-primary truncate">Dr. {booking.assignedDoctor}</span>
                  {drStatus && <span className="text-[10px] truncate">{drStatus}</span>}
                </div>
              );
            }
            if (!isPast && !isTerminal && !isVisitCompleted) {
              return (
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-4 w-4 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Stethoscope className="h-2.5 w-2.5 text-muted-foreground/50" />
                  </div>
                  {(booking.clinicDoctors ?? []).length > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:scale-[0.98] min-h-[28px] px-2.5 rounded-full transition-colors"
                          data-testid={`button-assign-inline-${booking.id}`}
                        >
                          <UserPlus className="h-2.5 w-2.5" />Assign doctor
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-1.5 rounded-xl shadow-lg" side="top" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Select a doctor</p>
                        <div className="space-y-0.5">
                          {(booking.clinicDoctors ?? []).map((doc, idx) => (
                            <button key={idx}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary/5 active:bg-primary/10 transition-colors text-left"
                              onClick={(e) => { e.stopPropagation(); onAssignDoctor?.(doc.name, doc.email ?? ""); }}
                              disabled={assignDoctorPending}
                            >
                              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">{doc.name.charAt(0)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">Dr. {doc.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{doc.specialization}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="italic text-muted-foreground/60 text-xs">Unassigned</span>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* Consent status — clinic view */}
          {role === "clinic" && isClinicConfirmed && !isTerminal && (
            <div className="flex items-center gap-2 text-xs">
              <div className="h-4 w-4 rounded-md bg-muted flex items-center justify-center shrink-0">
                <PenLine className="h-2.5 w-2.5 text-muted-foreground/60" />
              </div>
              {booking.consentSignedAt ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" />Consent Signed
                </span>
              ) : booking.consentToken ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                  <Clock className="h-2.5 w-2.5" />Consent Sent
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full">
                  <AlertCircle className="h-2.5 w-2.5 opacity-50" />Consent Not Sent
                </span>
              )}
            </div>
          )}

          {/* Clinical status — doctor view */}
          {role === "doctor" && booking.clinicalStatus && CLINICAL_STATUS_LABELS[booking.clinicalStatus] && (
            <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${CLINICAL_STATUS_LABELS[booking.clinicalStatus].cls}`}>
              {CLINICAL_STATUS_LABELS[booking.clinicalStatus].label}
            </span>
          )}

          {/* Doctor notes indicator */}
          {role === "doctor" && booking.doctorNotes && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-2.5 w-2.5 shrink-0" />
              <span className="italic">Notes added</span>
            </div>
          )}

          {/* Chief complaint chips */}
          {complaints.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {complaints.slice(0, maxChips).map((c, i) => (
                <span key={i} className="inline-flex items-center text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">
                  {c}
                </span>
              ))}
              {complaints.length > maxChips && (
                <span className="text-[10px] text-muted-foreground font-medium px-1">+{complaints.length - maxChips}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          CLINIC FOOTER — role-specific actions
          ═══════════════════════════════════════ */}
      {role === "clinic" && (
        <div className="px-3 sm:px-4 py-1.5 border-t border-border/40 bg-muted/10 space-y-1.5" onClick={(e) => e.stopPropagation()}>

          {/* Visit status progress row (in-card, for checked-in / in-consultation) */}
          {isClinicConfirmed && !isTerminal && (
            <div className="flex items-center gap-2 text-xs">
              <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${booking.visitStatus ? "bg-primary/10" : "bg-muted"}`}>
                <UserCheck className={`h-2.5 w-2.5 ${booking.visitStatus ? "text-primary" : "text-muted-foreground/50"}`} />
              </div>
              {!booking.visitStatus && (
                <button onClick={onCheckIn} disabled={checkInPending}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground border border-border/60 hover:border-primary/40 hover:text-primary hover:bg-primary/5 active:scale-[0.98] min-h-[28px] px-2.5 rounded-full transition-all"
                  data-testid={`button-checkin-${booking.id}`}>
                  {checkInPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                  Mark Arrived
                </button>
              )}
              {isCheckedIn && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    In Clinic{booking.checkedInAt ? ` · ${format(new Date(booking.checkedInAt), "h:mm a")}` : ""}
                  </span>
                  <button onClick={onUndoCheckIn} disabled={checkInPending} title="Undo check-in"
                    className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted/80 text-muted-foreground/40 hover:text-muted-foreground active:scale-[0.98] transition-all"
                    data-testid={`button-undo-checkin-${booking.id}`}>
                    {checkInPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
                  </button>
                </div>
              )}
              {isInConsultation && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />With Doctor
                </span>
              )}
              {isTreatmentCompleted && !isVisitCompleted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />Treatment Done
                </span>
              )}
              {isVisitCompleted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" />Visit Done
                  {booking.completedAt && <span className="font-normal opacity-70">· {format(new Date(booking.completedAt), "h:mm a")}</span>}
                </span>
              )}
            </div>
          )}

          {/* Primary action buttons row */}
          <div className="flex items-center gap-2">
            {/* Confirm — only when not confirmed and not past */}
            {!isClinicConfirmed && !isPast && !isTerminal && (
              <Button variant="ghost" size="sm"
                className="flex-1 h-9 gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 active:scale-[0.98] transition-all"
                onClick={() => onConfirm?.()} disabled={confirmPending}
                data-testid={`button-confirm-${booking.id}`}>
                {confirmPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Confirm
              </Button>
            )}

            {/* Mark Visit Complete — when treatment is done and admin needs to close */}
            {isTreatmentCompleted && !isVisitCompleted && !isTerminal && (
              <Button size="sm"
                className="flex-1 h-9 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-all"
                onClick={() => onCompleteVisit?.()} disabled={completeVisitPending}
                data-testid={`button-mark-visit-complete-${booking.id}`}>
                {completeVisitPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Mark Visit Complete
              </Button>
            )}

            {/* Bill */}
            <Button variant="ghost" size="sm"
              className="flex-1 h-9 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-background/80 active:scale-[0.98] transition-all"
              onClick={() => onBill?.()} data-testid={`button-bill-${booking.id}`}>
              <IndianRupee className="h-3 w-3" />Bill
            </Button>

            <div className="h-4 w-px bg-border/60 shrink-0" />

            {/* Book Again (visit done) OR Cancel */}
            {isVisitCompleted ? (
              <Button variant="ghost" size="sm"
                className="flex-1 h-9 gap-1.5 text-xs font-semibold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
                onClick={() => onBookAgain?.()} data-testid={`button-book-again-${booking.id}`}>
                <CalendarPlus className="h-3 w-3" />Book Again
              </Button>
            ) : isNoShowState ? (
              <Button variant="ghost" size="sm"
                className="flex-1 h-9 gap-1.5 text-xs font-semibold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
                onClick={() => onBookAgain?.()} data-testid={`button-rebook-${booking.id}`}>
                <Repeat2 className="h-3 w-3" />Rebook
              </Button>
            ) : !isCancelled ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm"
                    className="flex-1 h-9 gap-1.5 text-xs font-semibold text-destructive/70 hover:text-destructive hover:bg-destructive/5 active:scale-[0.98] transition-all"
                    onClick={(e) => e.stopPropagation()} disabled={cancelPending}
                    data-testid={`button-cancel-booking-${booking.id}`}>
                    {cancelPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel {booking.customerName}'s appointment and send a cancellation email.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="px-1 py-2 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Reason <span className="text-destructive">*</span></label>
                      <select value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setCancelReasonOther(""); }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="">Select a reason…</option>
                        <option>Patient requested cancellation</option>
                        <option>Doctor unavailable</option>
                        <option>Clinic closure / emergency</option>
                        <option>Patient no-show</option>
                        <option>Rescheduled to another slot</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    {cancelReason === "Other" && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Please specify</label>
                        <Input value={cancelReasonOther} onChange={(e) => setCancelReasonOther(e.target.value)} placeholder="e.g. Emergency, personal reasons" autoFocus />
                      </div>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setCancelReason(""); setCancelReasonOther(""); }}>Back</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelSubmit} className="bg-destructive text-destructive-foreground"
                      disabled={!cancelReason || (cancelReason === "Other" && !cancelReasonOther.trim())}>
                      Cancel Booking
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════
          DOCTOR FOOTER — clinical actions
          ═════════════════════════════════════ */}
      {role === "doctor" && (
        <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-border/40 space-y-2" onClick={(e) => e.stopPropagation()}>

          {/* Approve / Decline — when pending */}
          {booking.doctorApprovalStatus === "pending" && (
            <div className="flex gap-2">
              <Button size="sm"
                className="flex-1 h-10 sm:h-9 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white active:scale-[0.98]"
                onClick={() => onApprove?.()} disabled={approvePending || declinePending}
                data-testid={`button-approve-${booking.id}`}>
                {approvePending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
                Accept
              </Button>
              <Button size="sm" variant="outline"
                className="flex-1 h-10 sm:h-9 text-xs font-semibold border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 dark:hover:bg-rose-950/20 active:scale-[0.98]"
                onClick={() => onDecline?.()} disabled={approvePending || declinePending}
                data-testid={`button-decline-${booking.id}`}>
                {declinePending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <X className="h-3 w-3 mr-1.5" />}
                Decline
              </Button>
            </div>
          )}

          {/* Status banners for doctor */}
          {booking.doctorApprovalStatus === "admin_confirmed" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="h-3 w-3 shrink-0" />Confirmed by clinic admin on your behalf
            </div>
          )}
          {booking.doctorApprovalStatus === "approved" && !isCheckedIn && !isInConsultation && !isTreatmentCompleted && !isVisitCompleted && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5">
              <CheckCircle2 className="h-3 w-3 shrink-0" />You accepted this appointment — waiting for patient
            </div>
          )}

          {/* Read-only state label for Booked/Confirmed on doctor side */}
          {booking.doctorApprovalStatus !== "pending" && booking.doctorApprovalStatus !== "declined" && !isCheckedIn && !isInConsultation && !isTreatmentCompleted && !isVisitCompleted && !booking.doctorApprovalStatus && (
            <div className="flex items-center justify-center text-xs text-muted-foreground italic py-1">
              No Action (Read Only)
            </div>
          )}

          {/* Start Consultation — when patient arrived */}
          {isCheckedIn && booking.doctorApprovalStatus !== "pending" && booking.doctorApprovalStatus !== "declined" && (
            <Button size="sm"
              className="w-full h-9 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white active:scale-[0.98] transition-all"
              onClick={() => onStartConsultation?.()} disabled={startConsultPending}
              data-testid={`button-start-consultation-${booking.id}`}>
              {startConsultPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Activity className="h-3 w-3 mr-1.5" />}
              Start Consultation
            </Button>
          )}

          {/* Done with Patient — in consultation */}
          {isInConsultation && booking.doctorApprovalStatus !== "pending" && booking.doctorApprovalStatus !== "declined" && (
            <Button size="sm"
              className="w-full h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-white active:scale-[0.98] transition-all"
              onClick={() => onDoctorCompleteVisit?.()} disabled={completeVisitPending}
              data-testid={`button-done-patient-${booking.id}`}>
              {completeVisitPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
              Done with Patient
            </Button>
          )}

          {/* Treatment completed — read-only for doctor */}
          {isTreatmentCompleted && !isVisitCompleted && (
            <div className="flex items-center justify-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5 gap-1.5">
              <Clock className="h-3 w-3 shrink-0" />Consultation completed — admin closing visit
            </div>
          )}

          {/* Visit completed — doctor view */}
          {isVisitCompleted && (
            <div className="flex items-center justify-center text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5 gap-1.5">
              <ShieldCheck className="h-3 w-3 shrink-0" />Visit Completed (Read Only)
            </div>
          )}

          {/* Notes + Records — available whenever not pending/declined */}
          {booking.doctorApprovalStatus !== "pending" && booking.doctorApprovalStatus !== "declined" && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline"
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 text-xs font-semibold active:scale-[0.98] transition-all"
                onClick={() => onOpenNotes?.()} data-testid={`button-notes-${booking.id}`}>
                <FileText className="h-3 w-3 mr-1.5" />View Notes
              </Button>
              <Button size="sm"
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 text-xs font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
                onClick={() => onOpenRecords?.()} data-testid={`button-clinical-records-${booking.id}`}>
                <ClipboardList className="h-3 w-3 mr-1.5" />Issue Rx / Rec
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Small helper for ⋮ menu items ──
function MenuButton({ icon, label, onClick, disabled = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
    >
      {icon}{label}
    </button>
  );
}
