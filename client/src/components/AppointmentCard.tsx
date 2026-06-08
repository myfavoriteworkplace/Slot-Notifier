import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import {
  Phone, Hash, CalendarDays, CheckCircle2, X, Stethoscope,
  UserPlus, Building2, Loader2, IndianRupee, ClipboardList,
  FileText, AlertCircle, UserCheck, Activity, CalendarPlus, PenLine, Clock,
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
  checkInPending?: boolean;
  startConsultPending?: boolean;
  completeVisitPending?: boolean;
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
  checkInPending,
  startConsultPending,
  completeVisitPending,
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
  const isConfirmed = role === 'clinic'
    ? (booking.verificationStatus === 'confirmed' || !!booking.confirmedBy)
    : (booking.doctorApprovalStatus === 'approved' || booking.doctorApprovalStatus === 'admin_confirmed');
  const isApptDeclined = role === 'doctor' && booking.doctorApprovalStatus === 'declined';

  const accentBar = isToday
    ? "bg-gradient-to-r from-sky-400 to-cyan-400"
    : isPast
    ? "bg-gradient-to-r from-slate-400 to-slate-300"
    : "bg-gradient-to-r from-primary to-accent";

  const headerBg = isToday
    ? "bg-gradient-to-r from-sky-500/8 to-cyan-500/5"
    : isPast
    ? "bg-muted/30"
    : "bg-gradient-to-r from-primary/5 to-accent/5";

  const leftBorder = isCancelled
    ? "border-l-2 border-l-rose-400 dark:border-l-rose-500"
    : isConfirmed
    ? "border-l-2 border-l-emerald-400 dark:border-l-emerald-500"
    : "border-l-2 border-l-amber-400 dark:border-l-amber-500";

  const statusLabel = isCancelled ? "Cancelled"
    : isConfirmed ? "Confirmed"
    : isApptDeclined ? "Declined"
    : "Pending";

  const statusClass = isCancelled || isApptDeclined
    ? "text-rose-600 bg-rose-500/10 border-rose-500/25 dark:text-rose-400 dark:bg-rose-400/10 dark:border-rose-500/30"
    : isConfirmed
    ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-500/30"
    : "text-amber-600 bg-amber-500/10 border-amber-500/25 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-500/30";

  const maxChips = role === 'clinic' ? 4 : 3;
  const displayClinicName = clinicName || booking.clinicName || booking.clinic?.name;

  const visitRingClass = role === 'doctor' && booking.visitStatus === 'checked_in'
    ? "ring-2 ring-primary/40 ring-offset-2 animate-[pulse_2s_ease-in-out_infinite]"
    : (role === 'doctor' || role === 'clinic') && booking.visitStatus === 'in_consultation'
    ? "ring-2 ring-teal-400/60 ring-offset-2"
    : "";

  const handleCancelSubmit = () => {
    const reason = cancelReason === "Other" ? cancelReasonOther.trim() : cancelReason;
    onCancel?.(reason);
    setCancelReason("");
    setCancelReasonOther("");
  };

  return (
    <Card
      className={`overflow-hidden border-border/50 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/30 transition-all group flex flex-col ${isPast ? "opacity-75" : ""} ${leftBorder} ${visitRingClass}`}
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
        <div className={`px-4 pt-2.5 pb-2 ${headerBg} transition-colors group-hover:brightness-[0.97]`}>
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
                  {(booking.customerAge || booking.customerGender) && (
                    <>
                      <span className="opacity-30">·</span>
                      <span className="truncate">
                        {booking.customerAge ? `${booking.customerAge}y` : ""}
                        {booking.customerAge && booking.customerGender ? " · " : ""}
                        {booking.customerGender ? (booking.customerGender.charAt(0).toUpperCase() + booking.customerGender.slice(1)) : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Status column — smart text, no pill backgrounds */}
            <div className="flex flex-col items-end gap-0.5">
              {isCancelled || isApptDeclined ? (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <X className="h-2.5 w-2.5" />
                    {isApptDeclined ? "Declined" : "Cancelled"}
                  </span>
                </div>
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
              {role === 'doctor' && booking.visitStatus && booking.visitStatus !== 'completed' && (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-px rounded-full border
                  ${booking.visitStatus === 'checked_in'
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                    : "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20"
                  }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${booking.visitStatus === 'checked_in' ? 'bg-emerald-500 animate-pulse' : 'bg-teal-500'}`} />
                  {booking.visitStatus === 'checked_in' ? 'Arrived' : 'With You'}
                </span>
              )}
              {role === 'doctor' && booking.visitStatus === 'completed' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/50 border border-border/50 px-1.5 py-px rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Visit Done
                  {(booking as any).completedAt && (
                    <span className="font-normal opacity-70">
                      · {format(new Date((booking as any).completedAt), 'd MMM · h:mm a')}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div className="px-4 py-2 space-y-1.5">

          {/* Date + Time row with inline relative-date badge */}
          <div className="flex items-center gap-2 text-xs min-w-0">
            <div className="h-4 w-4 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="h-2.5 w-2.5 text-primary" />
            </div>
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
              const dCls = isToday
                ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                : daysAway === 1
                ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                : "text-muted-foreground bg-muted/50 border-border/50";
              return (
                <span className={`shrink-0 text-xs font-medium border px-1.5 py-px rounded-full ${dCls}`}>
                  {dLabel}
                </span>
              );
            })()}
            {(booking as any).slotCost > 1 && (() => {
              const cost = (booking as any).slotCost as number;
              const rawDesc: string = (booking as any).description ?? "";
              const catMatch = rawDesc.match(/Category:\s*([^,\n]+)/);
              const catName = catMatch ? catMatch[1].trim() : null;
              const label = catName
                ? `${catName} (${cost} slots · ${cost * 25} min)`
                : `${cost} slots · ${cost * 25} min`;
              return (
                <span className="shrink-0 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-400/20 px-1.5 py-px rounded-full">
                  {label}
                </span>
              );
            })()}
            {role === 'doctor' && (
              <span className="shrink-0 text-xs font-bold text-muted-foreground bg-muted/50 border border-border/50 px-1.5 py-px rounded-full">{durationMin}m</span>
            )}
          </div>

          {/* Row 3: patient code (clinic) or clinic name (doctor) */}
          {role === 'clinic' && booking.patientCode && (
            <div className="flex items-center gap-2 text-xs">
              <div className="h-4 w-4 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Hash className="h-2.5 w-2.5 text-primary" />
              </div>
              <span className="font-mono font-semibold text-primary">{booking.patientCode}</span>
            </div>
          )}
          {role === 'doctor' && displayClinicName && (
            <div className="flex items-center gap-2 text-xs min-w-0">
              <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                <Building2 className="h-2.5 w-2.5 text-muted-foreground" />
              </div>
              <span className="text-foreground font-medium truncate">
                {displayClinicName}{clinicCity ? ` (${clinicCity})` : ""}
              </span>
            </div>
          )}

          {/* Row 4: doctor assignment (clinic) or clinical status badge (doctor) */}
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
                    <Stethoscope className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-1.5 gap-y-0.5">
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
                    <Stethoscope className="h-2.5 w-2.5 text-muted-foreground/50" />
                  </div>
                  {(booking.clinicDoctors ?? []).length > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:bg-amber-100 px-2 py-0.5 rounded-full transition-colors"
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

          {/* Visit status row — clinic admin view */}
          {role === 'clinic' && isConfirmed && !isCancelled && (
            <div className="flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
              <div className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${booking.visitStatus ? 'bg-primary/10' : 'bg-muted'}`}>
                <UserCheck className={`h-2.5 w-2.5 ${booking.visitStatus ? 'text-primary' : 'text-muted-foreground/50'}`} />
              </div>
              {!booking.visitStatus && (
                <button
                  onClick={onCheckIn}
                  disabled={checkInPending}
                  data-testid={`button-checkin-${booking.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground border border-border/60 hover:border-primary/40 hover:text-primary hover:bg-primary/5 active:scale-[0.97] px-2 py-0.5 rounded-full transition-all"
                >
                  {checkInPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                  Mark Arrived
                </button>
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
                    className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    {checkInPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
                  </button>
                </div>
              )}
              {booking.visitStatus === 'in_consultation' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  With Doctor
                </span>
              )}
              {booking.visitStatus === 'completed' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Visit Done
                  {(booking as any).completedAt && (
                    <span className="font-normal opacity-70">· {format(new Date((booking as any).completedAt), 'h:mm a')}</span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Consent status row — clinic view, always shown for confirmed bookings */}
          {role === 'clinic' && isConfirmed && !isCancelled && (
            <div className="flex items-center gap-2 text-xs">
              <div className="h-4 w-4 rounded-md bg-muted flex items-center justify-center shrink-0">
                <PenLine className="h-2.5 w-2.5 text-muted-foreground/60" />
              </div>
              {booking.consentSignedAt ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Digital Consent Signed
                </span>
              ) : (booking as any).consentToken ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full">
                  <Clock className="h-2.5 w-2.5" /> Digital Consent Sent
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full">
                  Digital Consent Not Sent
                </span>
              )}
            </div>
          )}

          {role === 'doctor' && booking.clinicalStatus && (
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
          )}

          {/* Chief complaint chips */}
          {complaints.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {complaints.slice(0, maxChips).map((c, i) => (
                <span key={i} className="inline-flex items-center text-xs font-semibold text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded-md">
                  {c}
                </span>
              ))}
              {complaints.length > maxChips && (
                <span className="text-xs text-muted-foreground font-medium px-1">+{complaints.length - maxChips}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Clinic footer: Confirm | ₹ Bill | Cancel ── */}
      {role === 'clinic' && (
        <div className="px-4 py-1.5 flex items-center gap-2 border-t border-border/50 bg-muted/20" onClick={(e) => e.stopPropagation()}>
          {!isPast && !isCancelled && booking.verificationStatus !== 'confirmed' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-9 gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 active:bg-emerald-100 dark:active:bg-emerald-400/20 active:scale-[0.97] transition-all"
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
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-background/80 active:bg-muted/60 active:scale-[0.97] transition-all"
            onClick={(e) => { e.stopPropagation(); onBill?.(); }}
            data-testid={`button-bill-${booking.id}`}
          >
            <IndianRupee className="h-3 w-3" />
            Bill
          </Button>
          <div className="h-4 w-px bg-border/60 shrink-0" />
          {booking.visitStatus === 'completed' ? (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-9 gap-1.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/5 active:bg-primary/10 active:scale-[0.97] transition-all"
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
                className="flex-1 h-9 gap-1.5 text-xs font-semibold text-destructive/70 hover:text-destructive hover:bg-destructive/5 active:bg-destructive/10 active:text-destructive active:scale-[0.97] transition-all"
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
      {role === 'doctor' && (
        <div className="px-4 pb-3 pt-2 border-t border-border/40 space-y-2">
          {booking.doctorApprovalStatus === 'pending' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-10 sm:h-9 text-xs bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-semibold"
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
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
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
