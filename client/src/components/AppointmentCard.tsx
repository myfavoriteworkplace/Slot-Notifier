import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import {
  Phone, Hash, CalendarDays, CheckCircle2, X, UserPlus,
  Building2, Loader2, IndianRupee, ClipboardList, FileText,
  AlertCircle, UserCheck, Activity, CalendarPlus, PenLine,
  Stethoscope, MoreHorizontal, UserX, ShieldCheck,
} from "lucide-react";
import { LiaStethoscopeSolid, LiaHeartbeatSolid } from "react-icons/lia";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ──────────────── Shared Types ────────────────

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
  assignedDoctor?: string | null;
  assignedDoctorEmail?: string | null;
  doctorApprovalStatus?: string | null;
  doctorNotes?: string | null;
  clinicalStatus?: string | null;
  visitStatus?: string | null;
  checkedInAt?: Date | string | null;
  completedAt?: Date | string | null;
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

export type AppointmentCardRole = 'clinic' | 'doctor';

export interface AppointmentCardProps {
  booking: BookingWithSlot;
  role: AppointmentCardRole;
  bookingNumber: string;
  complaints?: string[];
  clinicName?: string;
  clinicCity?: string;
  onCardClick: () => void;
  onConfirm?: () => void;
  onCancel?: (reason: string) => void;
  onBill?: () => void;
  onAssignDoctor?: (doctorName: string, doctorEmail: string) => void;
  onApprove?: () => void;
  onDecline?: () => void;
  onOpenNotes?: () => void;
  onOpenRecords?: () => void;
  confirmPending?: boolean;
  cancelPending?: boolean;
  assignDoctorPending?: boolean;
  approvePending?: boolean;
  declinePending?: boolean;
  onCheckIn?: () => void;
  onUndoCheckIn?: () => void;
  onStartConsultation?: () => void;
  onCompleteVisit?: () => void;
  onBookAgain?: () => void;
  onNoShow?: () => void;
  checkInPending?: boolean;
  startConsultPending?: boolean;
  completeVisitPending?: boolean;
  noShowPending?: boolean;
}

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
  onApprove,
  onDecline,
  onOpenNotes,
  onOpenRecords,
  confirmPending,
  assignDoctorPending,
  approvePending,
  declinePending,
  onCheckIn,
  onUndoCheckIn,
  onStartConsultation,
  onCompleteVisit,
  onBookAgain,
  onNoShow,
  checkInPending,
  startConsultPending,
  completeVisitPending,
  noShowPending,
}: AppointmentCardProps) {
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOther, setCancelReasonOther] = useState("");

  const startTime = new Date(booking.slot.startTime);
  const endTime = new Date(booking.slot.endTime);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const bookingDateStr = format(startTime, 'yyyy-MM-dd');
  const isToday = bookingDateStr === todayStr;
  const isPast = startTime < new Date(new Date().setHours(0, 0, 0, 0)) && !isToday;
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  const isCancelled = booking.verificationStatus === 'cancelled';
  const isNoShow = booking.verificationStatus === 'no_show';
  const isConfirmed = role === 'clinic'
    ? (booking.verificationStatus === 'confirmed' || !!booking.confirmedBy)
    : (booking.doctorApprovalStatus === 'approved' || booking.doctorApprovalStatus === 'admin_confirmed');
  const isApptDeclined = role === 'doctor' && booking.doctorApprovalStatus === 'declined';

  // Lifecycle stage booleans
  const isVisitCompleted = booking.visitStatus === 'completed';
  const isTreatmentCompleted = booking.visitStatus === 'treatment_completed' || isVisitCompleted;
  const isInTreatment = booking.visitStatus === 'in_consultation' || isTreatmentCompleted;
  const isArrived = booking.visitStatus === 'checked_in' || isInTreatment;
  // 0=Booked, 1=Arrived, 2=InTreatment, 3=TreatmentDone, 4=VisitDone
  const lifecycleStage = isVisitCompleted ? 4 : isTreatmentCompleted ? 3 : isInTreatment ? 2 : isArrived ? 1 : 0;

  const accentBar = isNoShow
    ? "bg-gradient-to-r from-slate-400 to-slate-300"
    : isToday
    ? "bg-gradient-to-r from-sky-400 to-cyan-400"
    : isPast
    ? "bg-gradient-to-r from-slate-400 to-slate-300"
    : isVisitCompleted
    ? "bg-gradient-to-r from-emerald-400 to-teal-400"
    : "bg-gradient-to-r from-primary to-accent";

  const headerBg = isNoShow
    ? "bg-muted/30"
    : isToday
    ? "bg-gradient-to-r from-sky-500/8 to-cyan-500/5"
    : isPast
    ? "bg-muted/30"
    : "bg-gradient-to-r from-primary/5 to-accent/5";

  const leftBorder = isCancelled
    ? "border-l-2 border-l-rose-400 dark:border-l-rose-500"
    : isNoShow
    ? "border-l-2 border-l-slate-400 dark:border-l-slate-500"
    : isVisitCompleted
    ? "border-l-2 border-l-emerald-400 dark:border-l-emerald-500"
    : isConfirmed
    ? "border-l-2 border-l-emerald-400 dark:border-l-emerald-500"
    : "border-l-2 border-l-amber-400 dark:border-l-amber-500";

  const maxChips = role === 'clinic' ? 4 : 3;
  const displayClinicName = clinicName || booking.clinicName || booking.clinic?.name;

  const visitRingClass = role === 'doctor' && booking.visitStatus === 'checked_in'
    ? "ring-2 ring-primary/40 ring-offset-2 animate-[pulse_2s_ease-in-out_infinite]"
    : (role === 'doctor' || role === 'clinic') && booking.visitStatus === 'in_consultation'
    ? "ring-2 ring-teal-400/60 ring-offset-2"
    : "";

  const LIFECYCLE_STAGES = [
    { key: 'booked', label: 'Booked' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'in_tmt', label: 'In Tmt.' },
    { key: 'tmt_done', label: 'Tmt. Done' },
    { key: 'visit_done', label: 'Visit Done' },
  ];

  // Extract Category and Visit Type from description string
  const rawDesc = booking.description ?? "";
  const categoryMatch = rawDesc.match(/Category:\s*([^|]+)/);
  const visitMatch = rawDesc.match(/Visit:\s*([^|]+)/);
  const treatmentCategory = categoryMatch ? categoryMatch[1].trim() : null;
  const visitType = visitMatch ? visitMatch[1].trim() : null;
  const slotCost = (booking as any).slotCost as number | undefined;

  const handleCancelSubmit = () => {
    const reason = cancelReason === "Other" ? cancelReasonOther.trim() : cancelReason;
    onCancel?.(reason);
    setCancelReason("");
    setCancelReasonOther("");
  };

  return (
    <Card
      className={`overflow-hidden border-border/50 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/30 transition-all group flex flex-col ${(isPast || isNoShow) ? "opacity-75" : ""} ${leftBorder} ${visitRingClass}`}
      data-testid={`card-booking-${booking.id}`}
    >
      {/* Top accent bar */}
      <div className={`h-[3px] ${accentBar}`} />

      {/* Clickable card body */}
      <div
        className="w-full text-left cursor-pointer flex-1 flex flex-col"
        onClick={onCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCardClick(); }}
      >
        {/* Header */}
        {/* FIX #4: responsive padding px-3 sm:px-4 */}
        <div className={`px-3 sm:px-4 pt-2.5 pb-2 ${headerBg} transition-colors group-hover:brightness-[0.97]`}>
          <div className="flex items-start justify-between gap-2">

            {/* Avatar + name block */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="shrink-0 h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 dark:border-primary/30 flex items-center justify-center">
                <span className="text-sm font-bold text-primary dark:text-primary/70 leading-none">
                  {booking.customerName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm leading-tight truncate">{booking.customerName}</span>
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-md shrink-0">
                    #{bookingNumber}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  <Phone className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{booking.customerPhone}</span>
                  <span className="opacity-30">·</span>
                  {(booking.customerAge || booking.customerGender) ? (
                    <span className="truncate">
                      {booking.customerAge ? `${booking.customerAge}y` : ""}
                      {booking.customerAge && booking.customerGender ? " · " : ""}
                      {booking.customerGender ? (booking.customerGender.charAt(0).toUpperCase() + booking.customerGender.slice(1)) : ""}
                    </span>
                  ) : (
                    <span className="italic opacity-60">Not available</span>
                  )}
                </div>
              </div>
            </div>

            {/* Status column + ⋮ menu (clinic only) */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {/* Runtime status badge */}
              {isCancelled || isApptDeclined ? (
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <X className="h-2.5 w-2.5" />
                  {isApptDeclined ? "Declined" : "Cancelled"}
                </span>
              ) : isNoShow ? (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <UserX className="h-2.5 w-2.5" />
                  No Show
                </span>
              ) : role === 'clinic' && isVisitCompleted ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Visit Done
                </span>
              ) : role === 'clinic' && isTreatmentCompleted ? (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  Awaiting Closure
                </span>
              ) : role === 'clinic' && booking.visitStatus === 'in_consultation' ? (
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  With Doctor
                </span>
              ) : role === 'clinic' && booking.visitStatus === 'checked_in' ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  In Clinic
                </span>
              ) : isConfirmed ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Confirmed
                </span>
              ) : booking.assignedDoctor && booking.doctorApprovalStatus === 'pending' ? (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  Awaiting DR
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  Pending
                </span>
              )}
              {/* ⋮ More menu — clinic only, not cancelled / no_show / visit_done */}
              {role === 'clinic' && !isCancelled && !isNoShow && !isVisitCompleted && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 transition-colors"
                      data-testid={`button-more-${booking.id}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1.5 rounded-xl shadow-lg" side="bottom" align="end" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onNoShow?.(); }}
                      disabled={noShowPending}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                      data-testid={`button-no-show-${booking.id}`}
                    >
                      {noShowPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                      Mark No Show
                    </button>
                    {!isTreatmentCompleted && (
                      <div className="my-1 h-px bg-border/50" />
                    )}
                    {!isTreatmentCompleted && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onCompleteVisit?.(); }}
                        disabled={completeVisitPending}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors disabled:opacity-50"
                        data-testid={`button-override-complete-${booking.id}`}
                      >
                        {completeVisitPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                        Mark Visit Complete ↗
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>

        {/* Info rows — FIX #4: responsive padding */}
        <div className="px-3 sm:px-4 py-2 space-y-1.5">

          {/* Date + Time row with inline relative-date badge */}
          <div className="flex items-center gap-2 text-xs min-w-0">
            <div className="h-4 w-4 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="font-medium text-muted-foreground shrink-0">Date:</span>
            <span className="font-semibold text-foreground shrink-0">
              {format(startTime, "EEE, d MMM")}
            </span>
            <span className="text-muted-foreground font-medium truncate min-w-0">
              {format(startTime, "h:mm a")}
              <span className="mx-1 opacity-40">→</span>
              {format(endTime, "h:mm a")}
            </span>
            {!isPast && (() => {
              const daysAway = differenceInCalendarDays(startTime, new Date());
              const dLabel = isToday ? "Today" : daysAway === 1 ? "Tomorrow" : `in ${daysAway}d`;
              // FIX #1: "Today" badge uses sky-* per spec; Tomorrow uses amber; future uses muted
              const dCls = isToday
                ? "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/20 border-sky-200 dark:border-sky-500/20"
                : daysAway === 1
                ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                : "text-muted-foreground bg-muted/50 border-border/50";
              return (
                <span className={`shrink-0 text-xs font-medium border px-1.5 py-px rounded-full ${dCls}`}>
                  {dLabel}
                </span>
              );
            })()}
            {role === 'doctor' && (
              <span className="shrink-0 text-xs font-bold text-muted-foreground bg-muted/50 border border-border/50 px-1.5 py-px rounded-full">{durationMin}m</span>
            )}
          </div>

          {/* Row 3: patient code (clinic) or clinic name (doctor) */}
          {role === 'clinic' && (
            <div className="flex items-center gap-2 text-xs">
              <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${booking.patientCode ? 'bg-primary/10' : 'bg-muted'}`}>
                <Hash className={`h-2.5 w-2.5 ${booking.patientCode ? 'text-primary' : 'text-muted-foreground/40'}`} />
              </div>
              <span className="font-medium text-muted-foreground shrink-0">Patient Code:</span>
              {booking.patientCode
                ? <span className="font-mono font-semibold text-primary">{booking.patientCode}</span>
                : <span className="italic text-muted-foreground/60">Not available</span>
              }
            </div>
          )}
          {role === 'doctor' && (
            <div className="flex items-center gap-2 text-xs min-w-0">
              <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${displayClinicName ? 'bg-muted/60' : 'bg-muted'}`}>
                <Building2 className={`h-2.5 w-2.5 ${displayClinicName ? 'text-muted-foreground' : 'text-muted-foreground/40'}`} />
              </div>
              <span className="font-medium text-muted-foreground shrink-0">Clinic:</span>
              {displayClinicName
                ? <span className="text-foreground font-medium truncate">{displayClinicName}{clinicCity ? ` (${clinicCity})` : ""}</span>
                : <span className="italic text-muted-foreground/60">Not available</span>
              }
            </div>
          )}

          {/* Visit status row — doctor view — read-only, always visible when approved */}
          {role === 'doctor' && !isCancelled && !isApptDeclined && booking.doctorApprovalStatus !== 'pending' && (
            <div className="flex items-center gap-2 text-xs">
              <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0
                ${booking.visitStatus === 'checked_in' ? 'bg-emerald-50 dark:bg-emerald-500/10'
                  : booking.visitStatus === 'in_consultation' ? 'bg-teal-50 dark:bg-teal-500/10'
                  : booking.visitStatus === 'treatment_completed' ? 'bg-primary/10'
                  : booking.visitStatus === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10'
                  : 'bg-muted'}`}>
                <UserCheck className={`h-2.5 w-2.5
                  ${booking.visitStatus === 'checked_in' ? 'text-emerald-600 dark:text-emerald-400'
                    : booking.visitStatus === 'in_consultation' ? 'text-teal-600 dark:text-teal-400'
                    : booking.visitStatus === 'treatment_completed' ? 'text-primary'
                    : booking.visitStatus === 'completed' ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground/40'}`} />
              </div>
              <span className="font-medium text-muted-foreground shrink-0">Visit Status:</span>
              {!booking.visitStatus && (
                <span className="italic text-muted-foreground/50 text-xs">Awaiting arrival</span>
              )}
              {booking.visitStatus === 'checked_in' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  In Clinic
                  {booking.checkedInAt && (
                    <span className="font-normal opacity-70">· {format(new Date(booking.checkedInAt), 'h:mm a')}</span>
                  )}
                </span>
              )}
              {booking.visitStatus === 'in_consultation' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  With Doctor
                </span>
              )}
              {booking.visitStatus === 'treatment_completed' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Treatment Done
                  {(booking as any).completedAt && (
                    <span className="font-normal opacity-70">· {format(new Date((booking as any).completedAt), 'h:mm a')}</span>
                  )}
                </span>
              )}
              {booking.visitStatus === 'completed' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Visit Closed
                </span>
              )}
            </div>
          )}

          {/* Row 4: doctor assignment (clinic) */}
          {/* FIX #3: Stethoscope → LiaStethoscopeSolid (medical domain icon) */}
          {role === 'clinic' && (() => {
            if (booking.assignedDoctor) {
              const drStatus = isCancelled ? (
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">Cancelled</span>
                  {booking.cancellationReason && (
                    <span className="italic text-muted-foreground/60">· {booking.cancellationReason}</span>
                  )}
                </span>
              ) : booking.doctorApprovalStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Awaiting</span>
                  <span className="italic text-muted-foreground/60">Dr Approval</span>
                </span>
              ) : booking.doctorApprovalStatus === 'approved' ? (
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Approved</span>
                  <span className="italic text-muted-foreground/60">by Dr</span>
                </span>
              ) : booking.doctorApprovalStatus === 'admin_confirmed' ? (
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Confirmed</span>
                  <span className="italic text-muted-foreground/60">by Admin</span>
                </span>
              ) : booking.doctorApprovalStatus === 'declined' ? (
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">Declined</span>
                  <span className="italic text-muted-foreground/60">by Dr</span>
                </span>
              ) : null;

              const adminConfirmed = !isCancelled && isConfirmed && booking.confirmedBy === 'admin' && booking.doctorApprovalStatus !== 'admin_confirmed';

              return (
                <div className="flex items-start gap-2 text-xs">
                  <div className="h-4 w-4 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-px">
                    <LiaStethoscopeSolid className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-muted-foreground shrink-0">Doctor:</span>
                    <span className="font-medium text-primary">Dr. {booking.assignedDoctor}</span>
                    <span>{drStatus}</span>
                    {adminConfirmed && (
                      <>
                        <span />
                        <span className="inline-flex items-center gap-1">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Confirmed</span>
                          <span className="italic text-muted-foreground/60">by Admin</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            }
            if (!isPast && !isCancelled) {
              return (
                <div className="flex items-center gap-2 text-xs min-w-0">
                  <div className="h-4 w-4 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <LiaStethoscopeSolid className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <span className="font-medium text-muted-foreground shrink-0">Doctor:</span>
                  {(booking.clinicDoctors ?? []).length > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        {/* FIX #5: touch target — min-h-[44px] on mobile, revert on sm+ */}
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:bg-amber-100 px-3 py-2 sm:py-0.5 rounded-full transition-colors min-h-[44px] sm:min-h-0"
                          data-testid={`button-assign-inline-${booking.id}`}
                        >
                          <UserPlus className="h-2.5 w-2.5" />
                          Assign doctor
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-52 p-1.5 rounded-xl shadow-lg"
                        side="top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Select a doctor</p>
                        <div className="space-y-0.5">
                          {(booking.clinicDoctors ?? []).map((doc, idx) => (
                            <button
                              key={idx}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary/5 active:bg-primary/10 transition-colors text-left"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAssignDoctor?.(doc.name, doc.email ?? '');
                              }}
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
                    <span className="italic text-muted-foreground/60 text-xs">No doctor assigned</span>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* Visit status row — clinic admin view — always visible */}
          {role === 'clinic' && !isCancelled && !isNoShow && (
            <div className="flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
              <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0
                ${booking.visitStatus === 'checked_in' ? 'bg-emerald-50 dark:bg-emerald-500/10'
                  : booking.visitStatus === 'in_consultation' ? 'bg-teal-50 dark:bg-teal-500/10'
                  : booking.visitStatus === 'treatment_completed' ? 'bg-amber-50 dark:bg-amber-500/10'
                  : booking.visitStatus === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10'
                  : 'bg-muted'}`}>
                <UserCheck className={`h-2.5 w-2.5
                  ${booking.visitStatus === 'checked_in' ? 'text-emerald-600 dark:text-emerald-400'
                    : booking.visitStatus === 'in_consultation' ? 'text-teal-600 dark:text-teal-400'
                    : booking.visitStatus === 'treatment_completed' ? 'text-amber-600 dark:text-amber-400'
                    : booking.visitStatus === 'completed' ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground/50'}`} />
              </div>
              <span className="font-medium text-muted-foreground shrink-0">Visit Status:</span>
              {!booking.visitStatus && (
                isConfirmed ? (
                  <button
                    onClick={onCheckIn}
                    disabled={checkInPending}
                    data-testid={`button-checkin-${booking.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground border border-border/60 hover:border-primary/40 hover:text-primary hover:bg-primary/5 active:scale-[0.97] px-3 py-2 sm:py-0.5 rounded-full transition-all min-h-[44px] sm:min-h-0"
                  >
                    {checkInPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                    Mark Arrived
                  </button>
                ) : (
                  <span className="italic text-muted-foreground/50 text-xs">Awaiting confirmation</span>
                )
              )}
              {booking.visitStatus === 'checked_in' && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    In Clinic
                    {booking.checkedInAt && (
                      <span className="font-normal opacity-70">· {format(new Date(booking.checkedInAt), 'h:mm a')}</span>
                    )}
                  </span>
                  <button
                    onClick={onUndoCheckIn}
                    disabled={checkInPending}
                    title="Undo check-in"
                    data-testid={`button-undo-checkin-${booking.id}`}
                    className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/80 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    {checkInPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </button>
                </div>
              )}
              {booking.visitStatus === 'in_consultation' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  With Doctor
                </span>
              )}
              {booking.visitStatus === 'treatment_completed' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  Treatment Done · Awaiting Closure
                </span>
              )}
              {booking.visitStatus === 'completed' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Visit Closed
                  {(booking as any).completedAt && (
                    <span className="font-normal opacity-70">· {format(new Date((booking as any).completedAt), 'h:mm a')}</span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Consent status row — clinic view — always visible */}
          {role === 'clinic' && !isCancelled && (
            <div className="flex items-center gap-2 text-xs">
              <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${booking.consentSignedAt ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-muted'}`}>
                <PenLine className={`h-2.5 w-2.5 ${booking.consentSignedAt ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'}`} />
              </div>
              <span className="font-medium text-muted-foreground shrink-0">Consent Status:</span>
              {booking.consentSignedAt ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Consent Signed
                </span>
              ) : (booking as any).consentToken ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-500/20 px-2 py-0.5 rounded-full">
                  Consent Sent
                </span>
              ) : (
                <span className="italic text-muted-foreground/60">Not available</span>
              )}
            </div>
          )}

          {(role === 'clinic' || role === 'doctor') && (
            <div className="flex items-center gap-2 text-xs">
              <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${booking.clinicalStatus ? 'bg-primary/10' : 'bg-muted'}`}>
                <ClipboardList className={`h-2.5 w-2.5 ${booking.clinicalStatus ? 'text-primary' : 'text-muted-foreground/40'}`} />
              </div>
              <span className="font-medium text-muted-foreground shrink-0">Clinical Status:</span>
              {booking.clinicalStatus ? (
                <span className={`inline-flex items-center text-xs font-medium px-2 py-px rounded-full border
                  ${booking.clinicalStatus === "case_closed"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    : booking.clinicalStatus === "follow_up_required"
                    ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                    : booking.clinicalStatus === "revisit"
                    ? "bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800"
                    : "bg-primary/10 text-primary border-primary/20"}`}>
                  {booking.clinicalStatus === "first_visit" ? "First Visit" :
                   booking.clinicalStatus === "revisit" ? "Revisit" :
                   booking.clinicalStatus === "follow_up_required" ? "Follow-up Required" :
                   booking.clinicalStatus === "case_closed" ? "Case Closed" :
                   booking.clinicalStatus}
                </span>
              ) : (
                <span className="italic text-muted-foreground/60">Not set</span>
              )}
            </div>
          )}

          {/* Treatment Category — always visible */}
          <div className="flex items-center gap-2 text-xs">
            <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${treatmentCategory ? 'bg-primary/10' : 'bg-muted'}`}>
              <LiaStethoscopeSolid className={`h-3 w-3 ${treatmentCategory ? 'text-primary' : 'text-muted-foreground/40'}`} />
            </div>
            <span className="font-medium text-muted-foreground shrink-0">Treatment Category:</span>
            {treatmentCategory ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded-md">
                {treatmentCategory}{slotCost && slotCost > 1 ? ` (${slotCost} slots)` : ""}
              </span>
            ) : (
              <span className="italic text-muted-foreground/60">Not available</span>
            )}
          </div>

          {/* Visit Type — always visible */}
          <div className="flex items-center gap-2 text-xs">
            <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${visitType ? 'bg-primary/10' : 'bg-muted'}`}>
              <LiaHeartbeatSolid className={`h-3 w-3 ${visitType ? 'text-primary' : 'text-muted-foreground/40'}`} />
            </div>
            <span className="font-medium text-muted-foreground shrink-0">Visit Type:</span>
            {visitType ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded-md">
                {visitType}
              </span>
            ) : (
              <span className="italic text-muted-foreground/60">Not available</span>
            )}
          </div>

          {/* Chief complaint chips — always visible */}
          <div className="flex items-center gap-2 text-xs">
            <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${complaints.length > 0 ? 'bg-primary/10' : 'bg-muted'}`}>
              <Stethoscope className={`h-2.5 w-2.5 ${complaints.length > 0 ? 'text-primary' : 'text-muted-foreground/40'}`} />
            </div>
            <span className="font-medium text-muted-foreground shrink-0">Chief Complaints:</span>
            <div className="flex flex-wrap gap-1">
              {complaints.length > 0 ? (
                <>
                  {complaints.slice(0, maxChips).map((c, i) => (
                    <span key={i} className="inline-flex items-center text-xs font-semibold text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded-md">
                      {c}
                    </span>
                  ))}
                  {complaints.length > maxChips && (
                    <span className="text-xs text-muted-foreground font-medium px-1">+{complaints.length - maxChips}</span>
                  )}
                </>
              ) : (
                <span className="italic text-muted-foreground/60">No complaints noted</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lifecycle progress strip (clinic + doctor, active bookings only) ── */}
      {(role === 'clinic' || role === 'doctor') && !isCancelled && !isNoShow && (
        <div className="px-3 sm:px-4 py-2.5 border-t border-border/40 bg-muted/10">
          <div className="flex items-center w-full">
            {LIFECYCLE_STAGES.map((stage, idx) => {
              const isCompleted = idx < lifecycleStage;
              const isActive = idx === lifecycleStage;
              return (
                <div key={stage.key} className="flex items-center flex-1 last:flex-none">
                  {/* Node */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      isCompleted
                        ? 'bg-primary'
                        : isActive
                        ? 'bg-amber-500 ring-2 ring-amber-400/40'
                        : 'bg-muted-foreground/20'
                    }`} />
                    <span className={`text-[10px] leading-none font-medium whitespace-nowrap ${
                      isCompleted
                        ? 'text-primary'
                        : isActive
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground/40'
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                  {/* Connector */}
                  {idx < LIFECYCLE_STAGES.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-0.5 rounded-full transition-colors ${
                      idx < lifecycleStage ? 'bg-primary/50' : 'bg-muted-foreground/15'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Clinic footer: Confirm | ₹ Bill | Cancel ── */}
      {/* FIX #4: responsive padding; FIX #5: buttons min-h-[44px] on mobile */}
      {role === 'clinic' && (
        <div className="px-3 sm:px-4 py-1.5 flex items-center gap-2 border-t border-border/50 bg-muted/20" onClick={(e) => e.stopPropagation()}>
          {!isPast && !isCancelled && booking.verificationStatus !== 'confirmed' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 active:bg-emerald-100 dark:active:bg-emerald-400/20 active:scale-[0.98] transition-all"
                onClick={(e) => { e.stopPropagation(); onConfirm?.(); }}
                disabled={confirmPending}
                data-testid={`button-confirm-${booking.id}`}
              >
                {confirmPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Confirm
              </Button>
              <div className="h-4 w-px bg-border/60 shrink-0" />
            </>
          )}
          {/* "Mark Visit Complete" CTA — only when treatment is done but visit not yet closed */}
          {booking.visitStatus === 'treatment_completed' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 active:scale-[0.98] transition-all"
                onClick={(e) => { e.stopPropagation(); onCompleteVisit?.(); }}
                disabled={completeVisitPending}
                data-testid={`button-complete-visit-${booking.id}`}
              >
                {completeVisitPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Mark Visit Complete
              </Button>
              <div className="h-4 w-px bg-border/60 shrink-0" />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-background/80 active:bg-muted/60 active:scale-[0.98] transition-all"
            onClick={(e) => { e.stopPropagation(); onBill?.(); }}
            data-testid={`button-bill-${booking.id}`}
          >
            <IndianRupee className="h-3 w-3" />
            Bill
          </Button>
          <div className="h-4 w-px bg-border/60 shrink-0" />
          {(booking.visitStatus === 'completed' || isNoShow) ? (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 gap-1.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/5 active:bg-primary/10 active:scale-[0.98] transition-all"
              onClick={(e) => { e.stopPropagation(); onBookAgain?.(); }}
              data-testid={`button-book-again-${booking.id}`}
            >
              <CalendarPlus className="h-3 w-3" />
              Book Again
            </Button>
          ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 gap-1.5 text-xs font-semibold text-destructive/70 hover:text-destructive hover:bg-destructive/5 active:bg-destructive/10 active:text-destructive active:scale-[0.98] transition-all"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-cancel-booking-${booking.id}`}
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel {booking.customerName}'s appointment and send them a cancellation email.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-1 py-2 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Reason for cancellation</label>
                  <select
                    value={cancelReason}
                    onChange={e => { setCancelReason(e.target.value); setCancelReasonOther(""); }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a reason…</option>
                    <option value="Patient requested cancellation">Patient requested cancellation</option>
                    <option value="Doctor unavailable">Doctor unavailable</option>
                    <option value="Clinic closure / emergency">Clinic closure / emergency</option>
                    <option value="Patient no-show">Patient no-show</option>
                    <option value="Rescheduled to another slot">Rescheduled to another slot</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {cancelReason === "Other" && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Please specify</label>
                    <Input
                      value={cancelReasonOther}
                      onChange={e => setCancelReasonOther(e.target.value)}
                      placeholder="e.g. Emergency, personal reasons"
                      autoFocus
                    />
                  </div>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setCancelReason(""); setCancelReasonOther(""); }}>Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelSubmit}
                  className="bg-destructive text-destructive-foreground"
                  disabled={!cancelReason || (cancelReason === "Other" && !cancelReasonOther.trim())}
                >
                  Cancel Booking
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
        </div>
      )}

      {/* ── Doctor footer: Accept/Decline (pending) or Notes/Records ── */}
      {/* FIX #4: responsive padding */}
      {role === 'doctor' && (
        <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-border/40 space-y-2">
          {booking.doctorApprovalStatus === 'pending' && (
            <div className="flex gap-2">
              {/* FIX #9: Accept button — emerald-* not green-* */}
              <Button
                size="sm"
                className="flex-1 h-10 sm:h-9 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold"
                onClick={(e) => { e.stopPropagation(); onApprove?.(); }}
                disabled={approvePending || declinePending}
                data-testid={`button-approve-${booking.id}`}
              >
                {approvePending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-10 sm:h-9 text-xs border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 dark:hover:bg-rose-950/20 active:scale-[0.98] font-semibold"
                onClick={(e) => { e.stopPropagation(); onDecline?.(); }}
                disabled={approvePending || declinePending}
                data-testid={`button-decline-${booking.id}`}
              >
                {declinePending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1.5" />}
                Decline
              </Button>
            </div>
          )}
          {booking.doctorApprovalStatus === 'admin_confirmed' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Confirmed by clinic admin on your behalf
            </div>
          )}
          {booking.doctorApprovalStatus === 'approved' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              You confirmed this appointment
            </div>
          )}
          {/* Activity icon kept as Lucide here — this is an action button, not a domain content icon */}
          {booking.visitStatus === 'checked_in' && booking.doctorApprovalStatus !== 'pending' && booking.doctorApprovalStatus !== 'declined' && (
            <Button
              size="sm"
              className="w-full h-9 text-xs font-semibold bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600 text-white active:scale-[0.98] transition-all"
              onClick={(e) => { e.stopPropagation(); onStartConsultation?.(); }}
              disabled={startConsultPending}
              data-testid={`button-start-consultation-${booking.id}`}
            >
              {startConsultPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Activity className="h-3 w-3 mr-1.5" />}
              Start Consultation
            </Button>
          )}
          {booking.visitStatus === 'in_consultation' && booking.doctorApprovalStatus !== 'pending' && booking.doctorApprovalStatus !== 'declined' && (
            <Button
              size="sm"
              className="w-full h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-white active:scale-[0.98] transition-all"
              onClick={(e) => { e.stopPropagation(); onCompleteVisit?.(); }}
              disabled={completeVisitPending}
              data-testid={`button-done-patient-${booking.id}`}
            >
              {completeVisitPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
              Done with Patient
            </Button>
          )}
          {booking.doctorApprovalStatus !== 'pending' && booking.doctorApprovalStatus !== 'declined' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 text-xs font-semibold active:scale-[0.98] transition-all"
                onClick={(e) => { e.stopPropagation(); onOpenNotes?.(); }}
                data-testid={`button-notes-${booking.id}`}
              >
                <FileText className="h-3 w-3 mr-1.5" />
                View Notes
              </Button>
              <Button
                size="sm"
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 text-xs font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
                onClick={(e) => { e.stopPropagation(); onOpenRecords?.(); }}
                data-testid={`button-clinical-records-${booking.id}`}
              >
                <ClipboardList className="h-3 w-3 mr-1.5" />
                Issue Rx / Rec
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
