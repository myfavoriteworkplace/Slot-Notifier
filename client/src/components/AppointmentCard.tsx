import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import {
  Phone, Hash, CalendarDays, CheckCircle2, X, UserPlus,
  Building2, Loader2, IndianRupee, ClipboardList, FileText,
  AlertCircle, UserCheck, Activity, CalendarPlus, PenLine,
  Stethoscope, MoreHorizontal, UserX, ShieldCheck, Bell,
  Clock, Tag, Repeat2, RefreshCw, Copy, Check, BadgeAlert,
  LogOut, AlertTriangle, ChevronDown, ChevronUp, Download,
  Receipt,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BookingProgressStrip, type LifecycleStage } from "@/components/BookingProgressStrip";
import type { BookingWithSlot } from "@/lib/clinic-constants";
import { AppointmentInfoSection } from "@/components/AppointmentInfoSection";
import {
  classifyClientBooking,
  createClientBookingDateContext,
  getBookingLifecycleStage,
} from "@/lib/booking-classification";
import type { BookingClassification, BusinessDateContext } from "@shared/booking-status";
import {
  getAppointmentFooterModel,
  type AppointmentFooterAction,
} from "@/lib/appointment-footer-model";

export type AppointmentCardRole = "clinic" | "doctor";

export interface AppointmentCardProps {
  booking: BookingWithSlot;
  role: AppointmentCardRole;
  classification?: BookingClassification;
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
  onCompleteVisit?: (note?: string) => void;
  onNoShow?: (reason?: string) => void;
  onPatientLeftEarly?: (reason: string) => void;
  onSendReminder?: () => void;
  onOverrideComplete?: (reason: string) => void;
  onBookAgain?: () => void;
  onRevertNoShow?: () => void;
  revertNoShowPending?: boolean;
  totalBillsCount?: number;
  // Doctor actions
  onApprove?: () => void;
  onDecline?: () => void;
  onStartConsultation?: () => void;
  onDoctorCompleteVisit?: () => void;
  onOpenNotes?: () => void;
  onOpenRecords?: () => void;
  onOpenPrescription?: () => void;
  onRequestConsent?: () => void;
  onOpenActionTab?: () => void;
  openBillsCount?: number;
  // Loading states
  confirmPending?: boolean;
  cancelPending?: boolean;
  assignDoctorPending?: boolean;
  checkInPending?: boolean;
  completeVisitPending?: boolean;
  noShowPending?: boolean;
  leftEarlyPending?: boolean;
  sendReminderPending?: boolean;
  overridePending?: boolean;
  approvePending?: boolean;
  declinePending?: boolean;
  startConsultPending?: boolean;
  consentRequestPending?: boolean;
  visitNumber?: number;
  totalVisits?: number;
  latestLabel?: "latest_record";
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ──────────────── Helpers ────────────────

const VISIT_TYPE_LABELS: Record<string, string> = {
  first_visit: "First Visit",
  follow_up: "Follow Up",
  emergency: "Emergency",
  routine_checkup: "Routine Checkup",
  consultation: "Consultation",
  review: "Review",
  booked_by_patient: "Booked by Patient",
  admin_booked: "Admin booked",
};

const CLINICAL_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  first_visit:          { label: "First Visit",          cls: "bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800" },
  revisit:              { label: "Revisit",              cls: "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800" },
  follow_up_required:   { label: "Follow-up Required",   cls: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  case_closed:          { label: "Case Closed",          cls: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
};

const UNKNOWN_CLINICAL_STATUS_CLASS =
  "bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";

function formatClinicalStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ──────────────── Component ────────────────

export function AppointmentCard({
  booking,
  role,
  classification: providedClassification,
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
  onPatientLeftEarly,
  onSendReminder,
  onOverrideComplete,
  onBookAgain,
  onRevertNoShow,
  totalBillsCount = 0,
  onApprove,
  onDecline,
  onStartConsultation,
  onDoctorCompleteVisit,
  onOpenNotes,
  onOpenRecords,
  onOpenPrescription,
  onRequestConsent,
  onOpenActionTab,
  openBillsCount = 0,
  confirmPending,
  cancelPending,
  assignDoctorPending,
  checkInPending,
  completeVisitPending,
  noShowPending,
  leftEarlyPending,
  sendReminderPending,
  overridePending,
  revertNoShowPending,
  approvePending,
  declinePending,
  startConsultPending,
  consentRequestPending,
  visitNumber,
  totalVisits,
  latestLabel,
  isCollapsed,
  onToggleCollapse,
}: AppointmentCardProps) {
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOther, setCancelReasonOther] = useState("");
  const [noShowPredefined, setNoShowPredefined] = useState("");
  const [noShowCustom, setNoShowCustom] = useState("");
  const [overridePredefined, setOverridePredefined] = useState("");
  const [overrideCustom, setOverrideCustom] = useState("");
  const [leftEarlyReason, setLeftEarlyReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [consentCopied, setConsentCopied] = useState(false);
  const [visitDoneOpen, setVisitDoneOpen] = useState(false);
  const [visitDoneReason, setVisitDoneReason] = useState("");
  const [visitMenuOpen, setVisitMenuOpen] = useState(false);
  const [visitMenuPredefined, setVisitMenuPredefined] = useState("");
  const [visitMenuCustom, setVisitMenuCustom] = useState("");
  const [pendingVisitNote, setPendingVisitNote] = useState<string | undefined>();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  function handleMarkVisitDone(note?: string) {
    if (openBillsCount > 0) {
      setPendingVisitNote(note);
      setVisitDoneOpen(true);
    } else {
      onCompleteVisit?.(note);
    }
  }

  // ── Date helpers ──
  const startTime = new Date(booking.slot.startTime);
  const endTime   = new Date(booking.slot.endTime);
  const classification = providedClassification ?? classifyClientBooking(booking, role, createClientBookingDateContext());
  const isToday = classification.isToday;
  const isPast  = classification.isOld;
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  // ── Status helpers ──
  const isCancelled = classification.normalizedLifecycle === "cancelled";
  const isNoShowState = classification.normalizedLifecycle === "no_show";
  const isLeftEarlyState = classification.isEarlyExit;
  const isTerminal = classification.isTerminal;
  const isClinicConfirmed = classification.isConfirmed;
  const isDoctorConfirmed = classification.doctorApproval.value === "approved" || classification.doctorApproval.value === "admin_confirmed";
  const isConfirmed = role === "doctor" ? isDoctorConfirmed : classification.isConfirmed;
  const isDoctorDeclined = classification.doctorApproval.value === "declined";
  const isVisitCompleted = classification.isCompleted;
  const isTreatmentCompleted = classification.isTreatmentCompleted;
  const isInConsultation = classification.normalizedLifecycle === "in_consultation";
  const isCheckedIn = classification.normalizedLifecycle === "checked_in";

  // Keep the visible booking vocabulary intentionally small. More precise
  // lifecycle details remain available in the tooltip and progress strip.
  const bookingStatus = isCancelled || isDoctorDeclined
    ? {
        label: "Cancelled",
        textClass: "text-rose-600 dark:text-rose-400",
        chipClass: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/20 dark:border-rose-800",
        dotClass: "bg-rose-500",
        barClass: "bg-gradient-to-r from-rose-400 to-pink-400",
        borderClass: "border-l-[3px] border-l-rose-400 dark:border-l-rose-500",
      }
    : isNoShowState || isLeftEarlyState
    ? {
        label: "No Show",
        textClass: "text-slate-600 dark:text-slate-400",
        chipClass: "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900/30 dark:border-slate-700",
        dotClass: "bg-slate-500",
        barClass: "bg-gradient-to-r from-slate-400 to-slate-300",
        borderClass: "border-l-[3px] border-l-slate-400 dark:border-l-slate-500",
      }
    : isVisitCompleted
    ? {
        label: "Completed",
        textClass: "text-emerald-600 dark:text-emerald-400",
        chipClass: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
        barClass: "bg-gradient-to-r from-emerald-400 to-teal-400",
        borderClass: "border-l-[3px] border-l-emerald-400 dark:border-l-emerald-500",
      }
    : isInConsultation || isCheckedIn || isTreatmentCompleted
    ? {
        label: "In Consult",
        textClass: "text-violet-600 dark:text-violet-400",
        chipClass: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-950/20 dark:border-violet-800",
        dotClass: "bg-violet-500",
        barClass: "bg-gradient-to-r from-violet-400 to-fuchsia-400",
        borderClass: "border-l-[3px] border-l-violet-400 dark:border-l-violet-500",
      }
    : isConfirmed
    ? {
        label: "Confirmed",
        textClass: "text-emerald-600 dark:text-emerald-400",
        chipClass: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
        barClass: "bg-gradient-to-r from-emerald-400 to-teal-400",
        borderClass: "border-l-[3px] border-l-emerald-400 dark:border-l-emerald-500",
      }
    : {
        label: "Pending",
        textClass: "text-amber-600 dark:text-amber-400",
        chipClass: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/20 dark:border-amber-800",
        dotClass: "bg-amber-500",
        barClass: "bg-gradient-to-r from-amber-400 to-orange-400",
        borderClass: "border-l-[3px] border-l-amber-400 dark:border-l-amber-500",
      };

  // Override: visit is complete but patient never physically checked in → stages 1–3 were skipped
  const isOverrideCompleted = isVisitCompleted && !booking.checkedInAt && !isLeftEarlyState;

  // Billing state for progress strip
  const hasUnpaidBill = isVisitCompleted && openBillsCount > 0;
  const noBill        = isVisitCompleted && totalBillsCount === 0;

  const footerModel = getAppointmentFooterModel(
    classification,
    role,
    {
      totalBillsCount,
      openBillsCount,
      noShowSource: (booking as any).noShowSource ?? null,
    },
  );

  const footerActionPending = (action: AppointmentFooterAction) => {
    switch (action.id) {
      case "confirm":
        return !!confirmPending;
      case "cancel":
        return !!cancelPending;
      case "mark_arrived":
        return !!checkInPending;
      case "mark_visit_done":
      case "doctor_complete_visit":
        return !!completeVisitPending;
      case "remind":
        return !!sendReminderPending;
      case "revert_no_show":
        return !!revertNoShowPending;
      case "accept":
        return !!approvePending;
      case "decline":
        return !!declinePending;
      case "start_consultation":
        return !!startConsultPending;
      default:
        return false;
    }
  };

  const handleFooterAction = (action: AppointmentFooterAction) => {
    switch (action.id) {
      case "accept":
        onApprove?.();
        break;
      case "decline":
        onDecline?.();
        break;
      case "confirm":
        onConfirm?.();
        break;
      case "cancel":
        setCancelOpen(true);
        break;
      case "mark_arrived":
        onCheckIn?.();
        break;
      case "remind":
        onSendReminder?.();
        break;
      case "resolve_booking":
      case "manage_visit":
        onOpenActionTab?.();
        break;
      case "mark_visit_done":
        handleMarkVisitDone();
        break;
      case "bill":
      case "settle_payment":
      case "view_invoice":
        onBill?.();
        break;
      case "rebook":
        onBookAgain?.();
        break;
      case "revert_no_show":
        onRevertNoShow?.();
        break;
      case "start_consultation":
        onStartConsultation?.();
        break;
      case "doctor_complete_visit":
        onDoctorCompleteVisit?.();
        break;
      case "add_observation":
        onOpenRecords?.();
        break;
      case "open_notes":
        onOpenNotes?.();
        break;
      case "view_edit_prescription":
        onOpenPrescription?.();
        break;
      case "review_appointment":
      case "review_visit":
        onCardClick();
        break;
    }
  };

  const renderFooterAction = (action: AppointmentFooterAction, primary: boolean) => {
    const pending = footerActionPending(action);
    return (
      <Button
        key={action.id}
        variant={primary ? "default" : "outline"}
        size={primary ? "default" : "sm"}
        className={`min-w-0 ${primary ? "flex-1 basis-[140px] h-10 text-sm font-semibold" : "flex-1 basis-[100px] h-10 text-xs font-medium"} whitespace-normal text-center leading-tight gap-1.5 active:scale-[0.98] transition-all`}
        onClick={() => handleFooterAction(action)}
        disabled={pending}
        data-testid={`button-footer-${action.id}-${booking.id}`}
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {action.label}
      </Button>
    );
  };

  // Auto No-Show: confirmed, slot date has fully passed, patient never progressed — visual-only flag
  const isAutoNoShow = classification.isOld && isConfirmed
    && !classification.isStarted && !isTreatmentCompleted && !isVisitCompleted && !isTerminal;

  // Past-due: slot time has passed but visit still unresolved (no terminal or active state)
  const isPastDue = classification.isPastDueToday
    || classification.messageInputs.showOldResolution;

  // Delayed check-in: patient arrived after the slot's end time
  const isCheckedInLate = !!booking.checkedInAt && new Date(booking.checkedInAt) > endTime;

  // Derive string lifecycle stage for progress strip
  const lifecycleStage: LifecycleStage = getBookingLifecycleStage(classification);

  // ── Visual classes ──
  // Both card borders encode lifecycle status. Timing is represented by the
  // date badge, not by the top bar.
  // Priority follows the shared classifier: terminal states win over active,
  // completed, confirmed, and pending states.
  const accentBar = bookingStatus.barClass;

  // Left border = STATUS dimension.
  // In Consult group (checked-in → in consult → treatment done) → violet full/left border.
  // Visit Completed merges with Confirmed → emerald.
  // Left Early merges with No Show → slate.
  const cardBorderClass = bookingStatus.borderClass;

  const latestPillStatus = isCancelled
    ? { icon: "×", label: "CANCELLED", tone: "rose" }
    : isDoctorDeclined
    ? { icon: "×", label: "DECLINED", tone: "rose" }
    : isNoShowState || isAutoNoShow
    ? { icon: "⚠", label: "NO-SHOW", tone: "slate" }
    : isLeftEarlyState
    ? { icon: "↗", label: "LEFT EARLY", tone: "amber" }
    : isVisitCompleted
    ? { icon: "✓", label: "COMPLETED", tone: "emerald" }
    : isTreatmentCompleted
    ? { icon: "◐", label: "TREATMENT DONE", tone: "violet" }
    : isInConsultation
    ? { icon: "●", label: "IN CONSULTATION", tone: "violet" }
    : isCheckedIn
    ? { icon: "●", label: "CHECKED IN", tone: "violet" }
    : isPastDue
    ? { icon: "⚠", label: "ACTION NEEDED", tone: "amber" }
    : isConfirmed
    ? { icon: "✓", label: "CONFIRMED", tone: "emerald" }
    : { icon: "◷", label: "PENDING", tone: "amber" };

  const latestPillTone = {
    emerald: "border-emerald-700 bg-emerald-800 text-white dark:border-emerald-500 dark:bg-emerald-700",
    amber: "border-amber-600 bg-amber-500 text-white dark:border-amber-400 dark:bg-amber-600",
    violet: "border-violet-700 bg-violet-800 text-white dark:border-violet-400 dark:bg-violet-700",
    rose: "border-rose-700 bg-rose-800 text-white dark:border-rose-400 dark:bg-rose-700",
    slate: "border-slate-600 bg-slate-700 text-white dark:border-slate-400 dark:bg-slate-600",
  }[latestPillStatus.tone];

  // Header tint follows WHEN; terminal states are muted regardless of date.
  const headerBg = (isNoShowState || isCancelled || isLeftEarlyState)
    ? "bg-muted/30"
    : isToday
    ? "bg-gradient-to-r from-sky-500/10 to-cyan-500/5"
    : isPast
    ? "bg-muted/20"
    : "bg-gradient-to-r from-primary/5 to-accent/5";


  // ── Derived display values ──
  const displayClinicName = clinicName || (booking as any).clinicName || (booking as any).clinic?.name;
  const slotCost = booking.slotCost ?? 0;
  const maxChips = role === "clinic" ? 3 : 3;

  // visitType: prefer dedicated column, fall back to description parse, then bookedBy origin badge
  const rawDesc = booking.description ?? "";
  const parsedVisitType = rawDesc.match(/Visit:\s*([^|,\n]+)/)?.[1]?.trim() ?? null;
  const visitType = booking.visitType || parsedVisitType;
  const bookedByOrigin: string | null = (booking as any).bookedBy ?? null;
  const fallbackVisitKey = !visitType
    ? (bookedByOrigin === 'patient' ? 'booked_by_patient' : bookedByOrigin === 'admin' ? 'admin_booked' : null)
    : null;
  const visitTypeLabel = visitType
    ? (VISIT_TYPE_LABELS[visitType] ?? visitType)
    : fallbackVisitKey ? (VISIT_TYPE_LABELS[fallbackVisitKey] ?? null)
    : null;

  // treatmentCategory: prefer dedicated column, fall back to description parse
  const parsedCategory = rawDesc.match(/Category:\s*([^|,\n]+)/)?.[1]?.trim() ?? null;
  const treatmentCategory = booking.treatmentCategory || parsedCategory;

  // ── Status badge ──
  const StatusBadge = () => {
    return (
      <span className={`text-xs font-bold flex items-center gap-1 ${bookingStatus.textClass}`}>
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${bookingStatus.dotClass}`} />
        {bookingStatus.label}
      </span>
    );
  };

  // ── Status tooltip text (shown on hover of StatusBadge) ──
  const statusTooltip = isDoctorDeclined
    ? "Doctor declined this appointment"
    : isCancelled
    ? "Appointment cancelled"
    : isNoShowState
    ? "Patient did not arrive"
    : isAutoNoShow
    ? "Booking confirmed but patient did not show up — mark No Show to close"
    : isLeftEarlyState
    ? "Patient left before the visit was completed"
    : isVisitCompleted
    ? "Visit completed successfully"
    : isTreatmentCompleted
    ? "Doctor completed consultation — awaiting admin closure"
    : isInConsultation
    ? "Patient currently with doctor"
    : isCheckedIn
    ? "Patient checked in — waiting for doctor"
    : (booking.assignedDoctor && booking.doctorApprovalStatus === "pending")
    ? "Doctor assigned — awaiting their confirmation"
    : isConfirmed
    ? "Appointment confirmed"
    : "Appointment awaiting confirmation";

  // ── Cancel submit ──
  const handleCancelSubmit = () => {
    const reason = cancelReason === "Other" ? cancelReasonOther.trim() : cancelReason;
    onCancel?.(reason);
    setCancelReason(""); setCancelReasonOther("");
  };

  const canShowMoreMenu = role === "clinic" && !isCancelled && !isNoShowState && !isLeftEarlyState && !isVisitCompleted;

  return (
    <Card
      className={`relative min-w-0 overflow-visible mt-3 mb-3 h-full rounded-xl border border-border/70 bg-card shadow-sm transition-colors duration-200 group flex flex-col ${(isPast || isTerminal) ? "opacity-80" : ""} ${cardBorderClass}`}
      data-testid={`card-booking-${booking.id}`}
    >
      {latestLabel && (
        <span className={`absolute -top-4 right-3 z-20 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide whitespace-nowrap ${latestPillTone}`}>
          {latestPillStatus.icon} LATEST {role === "clinic" ? "BOOKING" : "APPOINTMENT"} · {latestPillStatus.label}
        </span>
      )}
      <div className="min-w-0 flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl">
      {/* Accent bar — pulse when actively in-progress */}
      <div className={`h-[3px] ${accentBar} ${isInConsultation || (role === "doctor" && isCheckedIn) ? "animate-pulse" : ""}`} />

      {/* Clickable body */}
      <div
        className="w-full min-w-0 text-left cursor-pointer flex-1 flex flex-col"
        onClick={onCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onCardClick(); }}
      >
        {/* ── Header ── */}
        <div className={`px-3 sm:px-4 ${latestLabel ? "pt-5" : "pt-2.5"} pb-2 ${headerBg} transition-colors`}>
          <div className="flex min-w-0 items-start justify-between gap-2 relative">

            {/* Avatar + name */}
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="shrink-0 h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 dark:border-primary/30 flex items-center justify-center">
                <span className="text-sm font-bold text-primary dark:text-primary/80 leading-none">
                  {booking.customerName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 space-y-0.5">
                {/* Row 1: patient identity, visit history, and stable appointment reference */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm leading-tight truncate">{booking.customerName}</span>
                  {visitNumber !== undefined && totalVisits !== undefined && totalVisits > 1 && (
                    <span className="inline-flex items-center gap-0.5 text-xs leading-none font-semibold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-1.5 py-1 rounded-md shrink-0">
                      <Repeat2 className="h-2.5 w-2.5" />
                      Visit {visitNumber}/{totalVisits}
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-md shrink-0">
                    Ref #{bookingNumber}
                  </span>
                </div>
                {/* Row 2: PAT code */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                  {booking.patientCode ? (
                    <span className="font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-px rounded-md shrink-0">
                      {booking.patientCode}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">Patient ID not assigned</span>
                  )}
                </div>
                {/* Row 3: Phone · Age · Gender */}
              <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-2.5 w-2.5 shrink-0" />
                <span className="min-w-0 max-w-full truncate">{booking.customerPhone || "--"}</span>
                  <span className="opacity-30 shrink-0 px-0.5">·</span>
                  <span className="shrink-0">{booking.customerAge ? `${booking.customerAge}y` : "--"}</span>
                  <span className="opacity-30 shrink-0 px-0.5">·</span>
                <span className="min-w-0 truncate">
                    {booking.customerGender
                      ? booking.customerGender.charAt(0).toUpperCase() + booking.customerGender.slice(1)
                      : "--"}
                  </span>
                </div>
              </div>
            </div>
            {/* Status + ⋮ menu */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <StatusBadge />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="text-xs font-medium max-w-[200px] whitespace-normal">
                    {statusTooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Doctor visit badge */}
              {role === "doctor" && isCheckedIn && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-1.5 py-px rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Arrived{booking.checkedInAt ? ` · ${format(new Date(booking.checkedInAt), "h:mm a")}` : ""}
                </span>
              )}
              {role === "doctor" && isVisitCompleted && booking.completedAt && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Done · {format(new Date(booking.completedAt), "d MMM h:mm a")}
                </span>
              )}

              {/* ⋮ Three-dot menu — clinic only */}
              {canShowMoreMenu && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground bg-muted/50 border border-border/50 hover:bg-muted hover:border-border/80 active:scale-[0.95] transition-all"
                      data-testid={`button-more-${booking.id}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1.5 rounded-xl shadow-xl border border-border/60" side="bottom" align="end" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Actions</p>

                    {/* Assign Doctor */}
                    {!isVisitCompleted && !isTreatmentCompleted && !isInConsultation && (booking.clinicDoctors ?? []).length > 0 && (
                      <MenuButton icon={<Stethoscope className="h-3 w-3" />} label="Reassign Doctor" onClick={() => {}} />
                    )}

                    {/* Send Reminder — only for pending (Stage 0); confirmed stage has it in footer */}
                    {!isVisitCompleted && !isTreatmentCompleted && !isPast && !isCheckedIn && !isInConsultation && !isClinicConfirmed && (
                      <MenuButton
                        icon={sendReminderPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                        label="Send Reminder"
                        onClick={() => onSendReminder?.()}
                        disabled={sendReminderPending}
                      />
                    )}

                    {/* Mark No Show — only for unconfirmed or confirmed-not-arrived stages (patient truly did not show) */}
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
                          {openBillsCount > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1.5 mx-0">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>{openBillsCount} unpaid bill{openBillsCount > 1 ? 's' : ''} on this booking — consider settling in billing first.</span>
                            </div>
                          )}
                          <div className="px-1 py-2 space-y-3">
                            <div className="space-y-1.5">
                              <label className="label-field">Reason (optional)</label>
                              <select
                                value={noShowPredefined}
                                onChange={(e) => { setNoShowPredefined(e.target.value); setNoShowCustom(""); }}
                                className="w-full select-base"
                              >
                                <option value="">Select a reason…</option>
                                <option>Patient didn't respond to calls</option>
                                <option>Patient forgot the appointment</option>
                                <option>Phone unreachable</option>
                                <option>Patient rescheduled elsewhere</option>
                                <option>Repeat no-show</option>
                                <option value="Other">Other (specify)</option>
                              </select>
                            </div>
                            {noShowPredefined === "Other" && (
                              <div className="space-y-1.5">
                                <label className="label-field">Please specify</label>
                                <Input
                                  value={noShowCustom}
                                  onChange={(e) => setNoShowCustom(e.target.value)}
                                  placeholder="e.g. Patient called to cancel"
                                  autoFocus
                                />
                              </div>
                            )}
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => { setNoShowPredefined(""); setNoShowCustom(""); }}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                const reason = noShowPredefined === "Other" ? noShowCustom.trim() : noShowPredefined;
                                onNoShow?.(reason || undefined);
                                setNoShowPredefined(""); setNoShowCustom("");
                              }}
                              className="bg-amber-600 text-white hover:bg-amber-700"
                            >
                              Mark No Show
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* Mark Visit Done — normal Stage 3→4 path */}
                    {isTreatmentCompleted && !isVisitCompleted && (
                      <>
                        <button
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setVisitMenuOpen(true); }}
                          data-testid={`button-menu-visit-done-${booking.id}`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Mark Visit Done
                          {openBillsCount > 0 && (
                            <span className="ml-auto text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full px-1.5 py-0.5">
                              {openBillsCount} unpaid
                            </span>
                          )}
                        </button>
                        <AlertDialog open={visitMenuOpen} onOpenChange={(open) => { if (!open) { setVisitMenuPredefined(""); setVisitMenuCustom(""); } setVisitMenuOpen(open); }}>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Mark Visit as Done?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Confirm that {booking.customerName}'s visit has been completed. Select a reason for record-keeping.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="px-1 py-2 space-y-3">
                              <div className="space-y-1.5">
                                <label className="label-field">Reason (optional)</label>
                                <select
                                  value={visitMenuPredefined}
                                  onChange={(e) => { setVisitMenuPredefined(e.target.value); setVisitMenuCustom(""); }}
                                  className="w-full select-base"
                                >
                                  <option value="">Select a reason…</option>
                                  <option>Visit completed as scheduled</option>
                                  <option>Early discharge by doctor</option>
                                  <option>Patient requested early exit</option>
                                  <option>Treatment deferred to next visit</option>
                                  <option value="Other">Other (specify)</option>
                                </select>
                              </div>
                              {visitMenuPredefined === "Other" && (
                                <div className="space-y-1.5">
                                  <label className="label-field">Please specify</label>
                                  <Input
                                    value={visitMenuCustom}
                                    onChange={(e) => setVisitMenuCustom(e.target.value)}
                                    placeholder="e.g. Patient discharged with prescription"
                                    autoFocus
                                  />
                                </div>
                              )}
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => { setVisitMenuPredefined(""); setVisitMenuCustom(""); }}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  const reason = visitMenuPredefined === "Other" ? visitMenuCustom.trim() : visitMenuPredefined;
                                  setVisitMenuOpen(false);
                                  handleMarkVisitDone(reason || undefined);
                                }}
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                <ShieldCheck className="h-3.5 w-3.5 mr-1" />Confirm Visit Done
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}

                    {/* Cancel Booking — available at Stage 2/3 via overflow (removed from footer at those stages) */}
                    {(isCheckedIn || isInConsultation) && (
                      <button
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setCancelOpen(true); }}
                        disabled={cancelPending}
                        data-testid={`button-cancel-overflow-${booking.id}`}
                      >
                        {cancelPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        Cancel Booking
                      </button>
                    )}

                    {/* Patient Left Early — for when patient leaves waiting room (checked_in) or mid-consultation */}
                    {(isCheckedIn || isInConsultation) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                            data-testid={`button-left-early-${booking.id}`}
                          >
                            {leftEarlyPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
                            Patient Left Early
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Patient Left Before Visit Completed?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Mark this visit as ended early. The visit record will be preserved. A reason is required.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="px-1 py-2">
                            <label className="label-field">Reason <span className="text-destructive">*</span></label>
                            <Input
                              className="mt-1.5"
                              value={leftEarlyReason}
                              onChange={(e) => setLeftEarlyReason(e.target.value)}
                              placeholder="e.g. Patient felt unwell, will reschedule"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setLeftEarlyReason("")}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={!leftEarlyReason.trim()}
                              onClick={() => { onPatientLeftEarly?.(leftEarlyReason.trim()); setLeftEarlyReason(""); }}
                              className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              Confirm — Patient Left
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* Stage 3b info — explain why override is unavailable once doctor has finished */}
                    {isTreatmentCompleted && !isVisitCompleted && (
                      <p className="text-xs text-muted-foreground/50 px-2 pb-1">Force-complete not available — use "Mark Visit Done" above.</p>
                    )}

                    {(!isVisitCompleted && !isTreatmentCompleted) && (
                      <div className="mt-1 pt-1 border-t border-border/40">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 px-2 pb-0.5">Admin Override</p>
                      </div>
                    )}

                    {/* Override complete — only when intermediate stages not yet reached (skip path) */}
                    {!isVisitCompleted && !isTreatmentCompleted && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors" data-testid={`button-override-${booking.id}`}>
                            {overridePending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                            Mark Visit Complete ↗
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Force Complete Visit?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will mark the visit as complete, skipping intermediate steps. Skipped stages will be flagged in the audit log.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="px-1 py-2 space-y-3">
                            {openBillsCount > 0 && (
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {openBillsCount} unpaid bill{openBillsCount !== 1 ? "s" : ""} — consider settling payment before closing
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <label className="label-field">Reason <span className="text-destructive">*</span></label>
                              <select
                                value={overridePredefined}
                                onChange={(e) => { setOverridePredefined(e.target.value); setOverrideCustom(""); }}
                                className="w-full select-base"
                              >
                                <option value="">Select a reason…</option>
                                <option>Admin override — technical issue</option>
                                <option>Patient confirmed treatment done verbally</option>
                                <option>Doctor completed off-system</option>
                                <option>Short visit — no check-in needed</option>
                                <option>Emergency clinic closure</option>
                                <option value="Other">Other (specify)</option>
                              </select>
                            </div>
                            {overridePredefined === "Other" && (
                              <div className="space-y-1.5">
                                <label className="label-field">Please specify</label>
                                <Input
                                  value={overrideCustom}
                                  onChange={(e) => setOverrideCustom(e.target.value)}
                                  placeholder="e.g. Patient confirmed, no paperwork needed"
                                  autoFocus
                                />
                              </div>
                            )}
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => { setOverridePredefined(""); setOverrideCustom(""); }}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                const reason = overridePredefined === "Other" ? overrideCustom.trim() : overridePredefined;
                                onOverrideComplete?.(reason);
                                setOverridePredefined(""); setOverrideCustom("");
                              }}
                              disabled={!overridePredefined || (overridePredefined === "Other" && !overrideCustom.trim())}
                              className="bg-orange-600 text-white hover:bg-orange-700"
                            >
                              Override &amp; Complete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* No actions fallback — visit is fully completed, nothing left to do */}
                    {isVisitCompleted && (
                      <p className="text-xs text-center text-muted-foreground/50 py-2 px-2">No actions available</p>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              {onToggleCollapse && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
                  className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 transition-colors"
                  data-testid={`button-collapse-${booking.id}`}
                  title="Collapse to row"
                  aria-label="Collapse to row"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Info Rows ── */}
        <div className="px-3 sm:px-4 py-2.5 space-y-2.5">

          {/* Date + time — doubles as collapse toggle on mobile (or expand when isCollapsed) */}
          <div
            className={`flex items-center gap-2 text-xs min-w-0 overflow-hidden ${(role === "clinic" || (role === "doctor" && !displayClinicName)) ? "cursor-pointer sm:cursor-default" : ""}`}
            onClick={(role === "clinic" || (role === "doctor" && !displayClinicName)) ? (e) => { e.stopPropagation(); isCollapsed ? onToggleCollapse?.() : setMobileExpanded(v => !v); } : undefined}
          >
            <div className="h-4 w-4 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="font-semibold text-foreground shrink-0">{format(startTime, "EEE, d MMM")}</span>
            {/* Relative time badge — timing colour is independent from booking status */}
            {(() => {
              const d = differenceInCalendarDays(startTime, new Date());
              const timeBadge = isToday
                ? {
                    label: "Today",
                    cls: "text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/30",
                  }
                : isPast
                ? {
                    label: "Past",
                    cls: "text-slate-600 bg-slate-50 dark:text-slate-300 dark:bg-slate-500/15 border-slate-200 dark:border-slate-500/30",
                  }
                : {
                    label: d === 1 ? "Tomorrow" : `in ${d}d`,
                    cls: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30",
                  };
              return <span className={`shrink-0 text-xs font-semibold border px-1.5 py-px rounded-full ${timeBadge.cls}`}>{timeBadge.label}</span>;
            })()}
            <span className="text-muted-foreground font-medium shrink-0">
              {format(startTime, "h:mm a")}
              <span className="mx-1 opacity-40">→</span>
              {format(endTime, "h:mm a")}
            </span>
            {/* Collapse chevron — visible on mobile only, shown when clinic role or doctor has no clinic name */}
            {(role === "clinic" || (role === "doctor" && !displayClinicName)) && (
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto sm:hidden transition-transform duration-150 ${mobileExpanded ? "rotate-180" : ""}`}
              />
            )}
          </div>

          {/* Standard booking status — lifecycle meaning is independent from date timing. */}
          <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-center gap-x-2 text-xs min-w-0">
            <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
              <Activity className={`h-2.5 w-2.5 ${bookingStatus.textClass}`} />
            </div>
            <span className="text-muted-foreground shrink-0">Booking Status:</span>
            <span className={`inline-flex items-center gap-1.5 justify-self-start text-xs font-semibold px-1.5 py-0.5 rounded-md border ${bookingStatus.chipClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${bookingStatus.dotClass}`} />
              {bookingStatus.label}
            </span>
          </div>

          {/* Clinic name — doctor view, just under date — doubles as collapse toggle on mobile (or expand when isCollapsed) */}
          {role === "doctor" && displayClinicName && (
            <div
              className="flex items-center gap-2 text-xs min-w-0 cursor-pointer sm:cursor-default"
              onClick={(e) => { e.stopPropagation(); isCollapsed ? onToggleCollapse?.() : setMobileExpanded(v => !v); }}
            >
              <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                <Building2 className="h-2.5 w-2.5 text-muted-foreground" />
              </div>
              <span className="font-medium truncate">{displayClinicName}{clinicCity ? ` (${clinicCity})` : ""}</span>
              {/* Collapse chevron — visible on mobile only */}
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto sm:hidden transition-transform duration-150 ${mobileExpanded ? "rotate-180" : ""}`}
              />
            </div>
          )}

          {/* Collapsible detail rows — hidden on mobile until expanded, always hidden when collapsed */}
          <div className={`${isCollapsed ? "hidden" : (mobileExpanded ? "space-y-2" : "hidden sm:block space-y-2")} min-w-0`}>

          {/* Visit Type */}
          <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-xs min-w-0">
            <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
              <Repeat2 className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground shrink-0">Visit Type:</span>
            {visitTypeLabel ? (
              <span className={`inline-flex items-center gap-1 justify-self-start font-semibold px-1.5 py-0.5 rounded-md min-w-0 max-w-full truncate ${
                fallbackVisitKey
                  ? 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-700'
                  : 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800'
              }`}>
                {visitTypeLabel}
              </span>
            ) : (
              <span className="text-muted-foreground/50">–</span>
            )}
          </div>

          {/* Treatment Category */}
          <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-xs min-w-0">
            <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
              <Tag className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground shrink-0">Treatment:</span>
            {treatmentCategory ? (
              <div className="flex items-center gap-1.5 justify-self-start min-w-0 max-w-full">
                <span className="inline-flex items-center font-semibold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 rounded-md min-w-0 max-w-full truncate">
                  {treatmentCategory}
                </span>
                {slotCost > 1 && (
                  <span className="shrink-0 text-muted-foreground font-medium">· {slotCost} slots</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground/50">–</span>
            )}
          </div>

          {/* Doctor assignment — clinic view */}
          {role === "clinic" && (() => {
            if (booking.assignedDoctor) {
               const drStatus = isCancelled ? null
                : booking.doctorApprovalStatus === "pending"
                 ? <span className="text-amber-600 dark:text-amber-400"> (Awaiting doctor approval)</span>
                : booking.doctorApprovalStatus === "approved"
                 ? <span className="text-emerald-600 dark:text-emerald-400"> (Approved ✓)</span>
                : booking.doctorApprovalStatus === "admin_confirmed"
                 ? <span className="text-emerald-600 dark:text-emerald-400"> (Admin confirmed ✓)</span>
                : booking.doctorApprovalStatus === "declined"
                 ? <span className="text-rose-600 dark:text-rose-400"> (Declined)</span>
                : null;
              return (
                 <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-xs min-w-0">
                  <div className="h-4 w-4 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <span className="text-muted-foreground shrink-0">Assigned:</span>
                    <span className="font-semibold text-foreground min-w-0 max-w-full break-words">
                     Dr. {booking.assignedDoctor}{drStatus}
                   </span>
                </div>
              );
            }
            if (!isPast && !isTerminal && !isVisitCompleted) {
              return (
                 <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-xs" onClick={(e) => e.stopPropagation()}>
                  <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground shrink-0">Assigned:</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenActionTab?.(); }}
                    data-testid={`button-assign-doctor-${booking.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/15 active:scale-95 px-1.5 py-0.5 rounded-md transition-all"
                  >
                    <UserPlus className="h-2.5 w-2.5" />Assign Doctor →
                  </button>
                </div>
              );
            }
            return (
                 <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-xs min-w-0">
                <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                  <Stethoscope className="h-2.5 w-2.5 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground shrink-0">Assigned:</span>
                 <span className="text-muted-foreground/60">Not assigned</span>
              </div>
            );
          })()}

          {/* Consent Status — clinic + doctor view */}
          {(role === "clinic" || role === "doctor") && (
             <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-xs min-w-0" onClick={(e) => e.stopPropagation()}>
              <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                <PenLine className="h-2.5 w-2.5 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground shrink-0">Consent:</span>
              {booking.consentSignedAt ? (
                <span className="inline-flex items-center gap-1 justify-self-start font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                  <CheckCircle2 className="h-2.5 w-2.5" />Signed ✓
                </span>
              ) : booking.consentToken ? (
                 <div className="flex items-center gap-1.5 justify-self-start min-w-0 max-w-full">
                   <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md max-w-full">
                    <Clock className="h-2.5 w-2.5" />Consent Sent
                  </span>
                  <TooltipProvider delayDuration={400}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                   <button
                          onClick={(e) => { e.stopPropagation(); onRequestConsent?.(); }}
                          disabled={consentRequestPending}
                          data-testid={`button-resend-consent-icon-${booking.id}`}
                          className="h-[22px] w-[22px] inline-flex items-center justify-center rounded-md text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {consentRequestPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Resend consent link</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(`${window.location.origin}/consent/${booking.consentToken}`);
                            setConsentCopied(true);
                            setTimeout(() => setConsentCopied(false), 2000);
                          }}
                          data-testid={`button-copy-consent-link-${booking.id}`}
                          className="h-[22px] w-[22px] inline-flex items-center justify-center rounded-md text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all"
                        >
                          {consentCopied ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">{consentCopied ? "Copied!" : "Copy consent link"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : (
                onRequestConsent ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRequestConsent(); }}
                    disabled={consentRequestPending}
                    data-testid={`button-request-consent-inline-${booking.id}`}
                     className="inline-flex items-center gap-1 justify-self-start font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/15 active:scale-95 px-1.5 py-0.5 rounded-md transition-all disabled:opacity-50"
                  >
                    {consentRequestPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <PenLine className="h-2.5 w-2.5" />}
                    Send Link →
                  </button>
                ) : (
                  <span className="text-muted-foreground/50">–</span>
                )
              )}
            </div>
          )}

          {/* Clinical status — shown for both clinic and doctor roles */}
          {booking.clinicalStatus && (
            <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-xs min-w-0">
              <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                <ClipboardList className="h-2.5 w-2.5 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground shrink-0">Clinical Status:</span>
              <span className={`inline-flex items-center justify-self-start text-xs font-semibold px-1.5 py-0.5 rounded-md border min-w-0 max-w-full truncate ${CLINICAL_STATUS_LABELS[booking.clinicalStatus]?.cls ?? UNKNOWN_CLINICAL_STATUS_CLASS}`}>
                {CLINICAL_STATUS_LABELS[booking.clinicalStatus]?.label ?? formatClinicalStatusLabel(booking.clinicalStatus)}
              </span>
            </div>
          )}

          {/* Doctor notes indicator */}
          {role === "doctor" && booking.doctorNotes && (
            <div className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-x-2 text-xs text-muted-foreground">
              <FileText className="h-2.5 w-2.5 shrink-0" />
              <span className="italic">Notes added</span>
            </div>
          )}

          {/* Chief Complaints — always shown */}
          <div className="grid grid-cols-[18px_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-xs min-w-0">
            <div className="h-4 w-4 rounded-md bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
              <ClipboardList className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground shrink-0 pt-0.5">Complaints:</span>
            {complaints.length > 0 ? (
              <div className="flex min-w-0 flex-wrap gap-1">
                {complaints.slice(0, maxChips).map((c, i) => (
                  <span key={i} className="inline-flex max-w-full items-center break-words text-xs leading-tight font-medium text-muted-foreground bg-muted/30 border border-border/60 px-1.5 py-0.5 rounded-md">
                    {c}
                  </span>
                ))}
                {complaints.length > maxChips && (
                  <span className="text-muted-foreground font-medium px-1">+{complaints.length - maxChips}</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground/50 pt-0.5">–</span>
            )}
          </div>

          </div>{/* end collapsible detail rows */}
        </div>
      </div>

      {/* Collapsible outer sections — banners, progress strip, footers; hidden on mobile until expanded, always hidden when collapsed */}
        <div className={`${isCollapsed ? "hidden" : (mobileExpanded ? "" : "hidden sm:block")} min-w-0 mt-auto shrink-0`}>

      <AppointmentInfoSection
        role={role}
        classification={classification}
        isCheckedInLate={isCheckedInLate}
        cancellationReason={booking.cancellationReason}
        visitCompletionNote={(booking as any).visitCompletionNote}
        totalBillsCount={totalBillsCount}
        openBillsCount={openBillsCount}
        onBilling={onBill}
        onReschedule={onOpenActionTab}
      />

      {/* ── Progress Strip ── */}
      <div className="px-3 sm:px-4 pt-1.5 pb-0.5 border-t border-border/30">
        <BookingProgressStrip
          stage={lifecycleStage}
          isCancelled={isCancelled}
          isNoShow={isNoShowState}
          isOverride={isOverrideCompleted}
          isLeftEarly={isLeftEarlyState}
          hasUnpaidBill={hasUnpaidBill}
          noBill={noBill}
          cancellationReason={(booking as any).cancellationReason ?? null}
          confirmedBy={(booking as any).confirmedBy ?? null}
          visitCompletionNote={(booking as any).visitCompletionNote ?? null}
          stageBeforeCancel={
            isLeftEarlyState ? 3 :
            (isCancelled || isNoShowState) ? (
              (booking as any).visitStatus === 'completed' ? 4 :
              ((booking as any).visitStatus === 'treatment_completed' || (booking as any).visitStatus === 'in_consultation') ? 3 :
              (!!(booking as any).checkedInAt || (booking as any).visitStatus === 'checked_in') ? 2 :
              !!(booking as any).confirmedBy ? 1 :
              0
            ) : 0
          }
        />
      </div>

      {/* ═══════════════════════════════════════
          CLINIC FOOTER — lifecycle-driven
          Primary button (full-width) + 2-button secondary row
          ═══════════════════════════════════════ */}
      {role === "clinic" && (
        <div className="px-3 sm:px-4 py-2.5 border-t border-border/40 bg-muted/10" onClick={(e) => e.stopPropagation()}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {footerModel.primary && renderFooterAction(footerModel.primary, true)}
            {footerModel.secondary.map((action) => renderFooterAction(action, false))}
          </div>

           {/* Terminal: Cancelled — functional billing/rebook actions only */}
          {false && isCancelled && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {totalBillsCount > 0 && (
                <Button variant="outline" size="sm"
                  className="min-w-0 flex-1 basis-[140px] h-10 text-xs font-medium whitespace-normal text-center leading-tight gap-1.5 active:scale-[0.98]"
                  onClick={() => onBill?.()}
                  data-testid={`button-view-bill-cancelled-${booking.id}`}>
                  <Receipt className="h-3 w-3" />View Bill
                </Button>
              )}
              <Button variant="outline" size="sm"
                className="min-w-0 flex-1 basis-[140px] h-10 text-xs font-medium whitespace-normal text-center leading-tight text-primary hover:text-primary hover:bg-primary/5 gap-1.5 active:scale-[0.98]"
                onClick={() => onBookAgain?.()}
                data-testid={`button-rebook-terminal-${booking.id}`}>
                <Repeat2 className="h-3 w-3" />Rebook
              </Button>
            </div>
          )}

           {/* Terminal: No Show — functional actions only */}
          {false && isNoShowState && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {(booking as any).noShowSource === "batch_admin" && (
                <Button variant="outline" size="sm" className="min-w-0 flex-1 basis-[140px] h-10 text-xs font-medium whitespace-normal text-center leading-tight gap-1.5"
                  onClick={() => onRevertNoShow?.()} disabled={revertNoShowPending}>
                  {revertNoShowPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Revert No-Show
                </Button>
              )}
              <Button variant="outline" size="sm"
                 className="min-w-0 flex-1 basis-[140px] h-10 text-xs font-medium whitespace-normal text-center leading-tight text-primary hover:text-primary hover:bg-primary/5 gap-1.5 active:scale-[0.98]"
                onClick={() => onBookAgain?.()}
                data-testid={`button-rebook-terminal-${booking.id}`}>
                <Repeat2 className="h-3 w-3" />Rebook
              </Button>
            </div>
          )}

           {/* Terminal: Patient Left Early — functional billing/rebook actions only */}
          {false && isLeftEarlyState && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {totalBillsCount > 0 && (
                <Button variant="outline" size="sm"
                  className="min-w-0 flex-1 basis-[140px] h-10 text-xs font-medium whitespace-normal text-center leading-tight gap-1.5 active:scale-[0.98]"
                  onClick={() => onBill?.()}
                  data-testid={`button-view-bill-leftearly-${booking.id}`}>
                  <Receipt className="h-3 w-3" />View Bill
                </Button>
              )}
              <Button variant="outline" size="sm"
                className="min-w-0 flex-1 basis-[140px] h-10 text-xs font-medium whitespace-normal text-center leading-tight text-primary hover:text-primary hover:bg-primary/5 gap-1.5 active:scale-[0.98]"
                onClick={() => onBookAgain?.()}
                data-testid={`button-rebook-terminal-${booking.id}`}>
                <Repeat2 className="h-3 w-3" />Rebook
              </Button>
            </div>
          )}

          {/* Stage 0 — Pending: [Confirm flex-1] [Cancel] — or [Reschedule] [Cancel] when past */}
          {false && !isTerminal && !isClinicConfirmed && !isVisitCompleted && !isTreatmentCompleted && !isCheckedIn && !isInConsultation && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {isPast ? (
                <Button
                  className="min-w-0 flex-1 basis-[140px] h-10 text-sm font-semibold whitespace-normal text-center leading-tight bg-amber-500 hover:bg-amber-600 text-white gap-2 active:scale-[0.98] transition-all"
                  onClick={() => onOpenActionTab?.()}
                  data-testid={`button-reschedule-pending-${booking.id}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />Reschedule
                </Button>
              ) : (
                <Button
                  className="min-w-0 flex-1 basis-[140px] h-10 text-sm font-semibold whitespace-normal text-center leading-tight bg-blue-600 hover:bg-blue-700 text-white gap-2 active:scale-[0.98] transition-all"
                  onClick={() => onConfirm?.()}
                  disabled={confirmPending}
                  data-testid={`button-confirm-${booking.id}`}
                >
                  {confirmPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Confirm
                </Button>
              )}
              <Button variant="ghost" size="sm"
                className="min-w-0 flex-1 basis-[100px] h-10 text-xs font-medium whitespace-normal text-center leading-tight text-destructive/70 hover:text-destructive hover:bg-destructive/5 gap-1.5 active:scale-[0.98]"
                onClick={(e) => { e.stopPropagation(); setCancelOpen(true); }}
                disabled={cancelPending}
                data-testid={`button-cancel-booking-${booking.id}`}>
                {cancelPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Cancel
              </Button>
            </div>
          )}

          {/* Stage 1 — Confirmed, not arrived: [Mark Arrived flex-1] [Send Reminder] [Cancel → three-dot] */}
          {false && !isTerminal && isClinicConfirmed && !isPast && !isCheckedIn && !isInConsultation && !isTreatmentCompleted && !isVisitCompleted && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                className="min-w-0 flex-1 basis-[140px] h-10 text-sm font-semibold whitespace-normal text-center leading-tight bg-sky-600 hover:bg-sky-700 text-white gap-2 active:scale-[0.98] transition-all"
                onClick={() => onCheckIn?.()}
                disabled={checkInPending}
                data-testid={`button-checkin-${booking.id}`}
              >
                {checkInPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                Mark Arrived
              </Button>
              {!isPast && onSendReminder && (
                <Button variant="outline" size="sm"
                  className="min-w-0 flex-1 basis-[100px] h-10 text-xs font-medium whitespace-normal text-center leading-tight gap-1.5 active:scale-[0.98]"
                  onClick={() => onSendReminder?.()}
                  disabled={sendReminderPending}
                  data-testid={`button-send-reminder-footer-${booking.id}`}>
                  {sendReminderPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                  Remind
                </Button>
              )}
            </div>
          )}

          {/* Stage 2 — Arrived (Waiting): [₹ Bill flex-1] — status shown in info strip above */}
          {false && !isTerminal && isCheckedIn && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button variant="outline"
                className="w-full min-w-0 flex-1 h-10 text-sm font-medium whitespace-normal text-center leading-tight gap-2 active:scale-[0.98]"
                onClick={() => onBill?.()}
                data-testid={`button-bill-${booking.id}`}>
                <IndianRupee className="h-3.5 w-3.5" />₹ Bill
              </Button>
            </div>
          )}

          {/* Stage 3 — In Treatment: [₹ Bill flex-1] — status shown in info strip above */}
          {false && !isTerminal && isInConsultation && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button variant="outline"
                className="w-full min-w-0 flex-1 h-10 text-sm font-medium whitespace-normal text-center leading-tight gap-2 active:scale-[0.98]"
                onClick={() => onBill?.()}
                data-testid={`button-bill-${booking.id}`}>
                <IndianRupee className="h-3.5 w-3.5" />₹ Bill
              </Button>
            </div>
          )}

          {/* Stage 3b — Treatment Completed: [₹ Bill] [Mark Visit Done flex-1] */}
          {false && !isTerminal && isTreatmentCompleted && !isVisitCompleted && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button variant="outline" size="sm"
                className="min-w-0 flex-1 basis-[100px] h-10 text-xs font-medium whitespace-normal text-center leading-tight gap-1.5 active:scale-[0.98]"
                onClick={() => onBill?.()}
                data-testid={`button-bill-tmt-${booking.id}`}>
                <IndianRupee className="h-3 w-3" />₹ Bill
              </Button>
              <Button
                className="min-w-0 flex-1 basis-[140px] h-10 text-sm font-semibold whitespace-normal text-center leading-tight bg-emerald-600 hover:bg-emerald-700 text-white gap-2 active:scale-[0.98] transition-all"
                onClick={() => handleMarkVisitDone()}
                disabled={completeVisitPending}
                data-testid={`button-mark-visit-done-${booking.id}`}
              >
                {completeVisitPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Mark Visit Done
                {openBillsCount > 0 && (
                  <span className="text-xs font-semibold bg-white/20 rounded-full px-1.5 py-0.5 ml-1">
                    {openBillsCount} unpaid
                  </span>
                )}
              </Button>
            </div>
          )}

          {/* Stage 1 — Confirmed but past: the slot can no longer be checked in; offer rebooking */}
          {false && !isTerminal && isClinicConfirmed && isPast && !isCheckedIn && !isInConsultation && !isTreatmentCompleted && !isVisitCompleted && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button variant="outline"
                className="w-full min-w-0 flex-1 h-10 text-sm font-medium whitespace-normal text-center leading-tight text-primary hover:text-primary hover:bg-primary/5 gap-2 active:scale-[0.98]"
                onClick={() => onBookAgain?.()}
                data-testid={`button-rebook-past-confirmed-${booking.id}`}>
                <CalendarPlus className="h-3.5 w-3.5" />Rebook
              </Button>
            </div>
          )}

          {/* Stage 5 — Visit Completed: [status flex-1] [Rebook] */}
          {false && !isTerminal && isVisitCompleted && (
            <div className="flex items-center gap-2">
              {noBill ? null : openBillsCount > 0 ? (
                <Button
                  className="min-w-0 flex-1 basis-[140px] h-10 text-sm font-semibold whitespace-normal text-center leading-tight border border-amber-400 bg-amber-50/60 text-amber-700 hover:bg-amber-100/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/40 gap-2 active:scale-[0.98] transition-all"
                  variant="outline"
                  onClick={() => onBill?.()}
                  title="Payment outstanding — tap to settle"
                  data-testid={`button-settle-bill-${booking.id}`}
                >
                  Settle Payment
                </Button>
              ) : (
                <Button
                  className="min-w-0 flex-1 basis-[140px] h-10 text-sm font-semibold whitespace-normal text-center leading-tight bg-emerald-600 hover:bg-emerald-700 text-white gap-2 active:scale-[0.98] transition-all"
                  onClick={() => onBill?.()}
                  title="View or download invoice"
                  data-testid={`button-bill-complete-${booking.id}`}
                >
                  <Receipt className="h-3.5 w-3.5" />View Invoice
                </Button>
              )}
              <Button variant="outline" size="sm"
                className="min-w-0 flex-1 basis-[120px] h-10 text-xs font-medium whitespace-normal text-center leading-tight text-primary hover:text-primary hover:bg-primary/5 gap-1.5 active:scale-[0.98]"
                onClick={() => onBookAgain?.()}
                data-testid={`button-rebook-${booking.id}`}>
                <CalendarPlus className="h-3 w-3" />Rebook
              </Button>
            </div>
          )}

          {/* Cancel confirmation dialog (controlled, single instance) */}
          <AlertDialog open={cancelOpen} onOpenChange={(open) => { if (!open) { setCancelReason(""); setCancelReasonOther(""); } setCancelOpen(open); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel {booking.customerName}'s appointment and send a cancellation email.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-1 py-2 space-y-3">
                <div className="space-y-1.5">
                  <label className="label-field">Reason <span className="text-destructive">*</span></label>
                  <select value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setCancelReasonOther(""); }}
                    className="w-full select-base">
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
                    <label className="label-field">Please specify</label>
                    <Input value={cancelReasonOther} onChange={(e) => setCancelReasonOther(e.target.value)} placeholder="e.g. Emergency, personal reasons" autoFocus />
                  </div>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { handleCancelSubmit(); setCancelOpen(false); }}
                  className="bg-destructive text-destructive-foreground"
                  disabled={!cancelReason || (cancelReason === "Other" && !cancelReasonOther.trim())}
                >
                  Cancel Booking
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Open-bills warning dialog — shown before marking Visit Done when unpaid bills exist */}
          <AlertDialog open={visitDoneOpen} onOpenChange={(open) => { if (!open) setVisitDoneReason(""); setVisitDoneOpen(open); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <BadgeAlert className="h-4 w-4 text-amber-500" />
                  Unpaid Bills Found
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This booking has <strong>{openBillsCount} unpaid bill(s)</strong>. Select a reason to mark the visit as done anyway, or go to billing to settle them first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-1 py-2 space-y-1.5">
                <label className="label-field">Reason <span className="text-destructive">*</span></label>
                <Select value={visitDoneReason} onValueChange={setVisitDoneReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="settle_later">Bills to be settled separately</SelectItem>
                    <SelectItem value="deferred">Patient deferred payment</SelectItem>
                    <SelectItem value="waived">Waived / Pro bono</SelectItem>
                    <SelectItem value="billing_error">Error in billing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:mr-auto"
                  onClick={() => { setVisitDoneOpen(false); setVisitDoneReason(""); onBill?.(); }}
                >
                  <IndianRupee className="h-3 w-3 mr-1" />Go to Billing
                </Button>
                <AlertDialogCancel onClick={() => setVisitDoneReason("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { onCompleteVisit?.(pendingVisitNote); setVisitDoneOpen(false); setVisitDoneReason(""); setPendingVisitNote(undefined); }}
                  disabled={!visitDoneReason}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />Mark Visit Done
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
      )}

      {/* ═════════════════════════════════════
          DOCTOR FOOTER — lifecycle-driven
          Primary button (full-width) + secondary row
          ═════════════════════════════════════ */}
      {role === "doctor" && (
        <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {footerModel.primary && renderFooterAction(footerModel.primary, true)}
            {footerModel.secondary.map((action) => renderFooterAction(action, false))}
          </div>

          {/* Pending approval — Approve / Decline (already a single flex row) */}
          {false && booking.doctorApprovalStatus === "pending" && !isVisitCompleted && !isTreatmentCompleted && !isTerminal && (
            <div className="flex min-w-0 flex-wrap gap-2">
              <Button size="sm"
                className="min-w-0 flex-1 basis-[140px] h-10 text-xs font-semibold whitespace-normal text-center leading-tight bg-primary hover:bg-primary/90 text-white gap-1.5 active:scale-[0.98]"
                onClick={() => onApprove?.()} disabled={approvePending || declinePending}
                data-testid={`button-approve-${booking.id}`}>
                {approvePending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Accept
              </Button>
              <Button size="sm" variant="outline"
                className="min-w-0 flex-1 basis-[140px] h-10 text-xs font-semibold whitespace-normal text-center leading-tight border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 dark:hover:bg-rose-950/20 gap-1.5 active:scale-[0.98]"
                onClick={() => onDecline?.()} disabled={approvePending || declinePending}
                data-testid={`button-decline-${booking.id}`}>
                {declinePending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Decline
              </Button>
            </div>
          )}

          {/* Terminal state indicator */}
          {false && isTerminal && (
            <div className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted/40 border border-border/40">
              <span className="text-xs text-muted-foreground">
                {isNoShowState
                  ? "Patient did not arrive"
                  : isCancelled
                  ? "Appointment cancelled"
                  : "Patient left before completion"}
              </span>
            </div>
          )}

          {/* Stage 1 — Booked: no footer button — status shown in info strip above */}

          {/* Stage 2 — Arrived: [Start Consultation flex-1] [Add Obs.] */}
          {false && isCheckedIn && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                className="min-w-0 flex-1 basis-[140px] h-10 text-sm font-semibold whitespace-normal text-center leading-tight bg-blue-600 hover:bg-blue-700 text-white gap-2 active:scale-[0.98] transition-all"
                onClick={() => onStartConsultation?.()}
                disabled={startConsultPending}
                data-testid={`button-start-consultation-${booking.id}`}
              >
                {startConsultPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                Start Consultation
              </Button>
              <Button variant="outline" size="sm"
                className="min-w-0 flex-1 basis-[100px] h-10 text-xs font-medium whitespace-normal text-center leading-tight gap-1.5 active:scale-[0.98]"
                onClick={() => onOpenRecords?.()}
                data-testid={`button-add-observation-${booking.id}`}>
                <ClipboardList className="h-3 w-3" />Add Obs.
              </Button>
            </div>
          )}

          {/* Stage 3 — In Treatment: [Add Obs. icon] [Notes icon] [Done flex-1] [Issue Rx icon] */}
          {false && isInConsultation && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm"
                      className="shrink-0 h-10 w-10 p-0 active:scale-[0.98]"
                      onClick={() => onOpenRecords?.()}
                      data-testid={`button-add-obs-${booking.id}`}>
                      <ClipboardList className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Add Observation</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm"
                      className="shrink-0 h-10 w-10 p-0 active:scale-[0.98]"
                      onClick={() => onOpenNotes?.()}
                      data-testid={`button-notes-consult-${booking.id}`}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Notes</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                className="min-w-0 flex-1 basis-[120px] h-10 text-sm font-semibold whitespace-normal text-center leading-tight bg-teal-600 hover:bg-teal-700 text-white gap-2 active:scale-[0.98] transition-all"
                onClick={() => onDoctorCompleteVisit?.()}
                disabled={completeVisitPending}
                data-testid={`button-done-patient-${booking.id}`}
              >
                {completeVisitPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Done
              </Button>
              <Button size="sm"
                className="min-w-0 flex-1 basis-[100px] h-10 px-3 text-xs font-semibold whitespace-normal text-center leading-tight bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 active:scale-[0.98] gap-1.5"
                onClick={() => onOpenRecords?.()}
                data-testid={`button-issue-rx-${booking.id}`}>
                <Stethoscope className="h-3.5 w-3.5" />Issue Rx
              </Button>
            </div>
          )}

          {/* Stage 4 — Treatment Completed: [View Rx flex-1] — status shown in info strip above */}
          {false && isTreatmentCompleted && !isVisitCompleted && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button variant="outline"
                className="w-full min-w-0 flex-1 h-10 text-sm font-medium whitespace-normal text-center leading-tight gap-2 active:scale-[0.98]"
                onClick={() => onOpenRecords?.()}
                data-testid={`button-view-rx-${booking.id}`}>
                <ClipboardList className="h-3.5 w-3.5" />View / Edit Rx
              </Button>
            </div>
          )}

          {/* Booked/confirmed and completed cards still expose a full-width appointment action. */}
          {false && !isTerminal && !isCheckedIn && !isInConsultation && !isTreatmentCompleted && !isVisitCompleted && booking.doctorApprovalStatus !== "pending" && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button variant="outline"
                className="w-full min-w-0 flex-1 h-10 text-sm font-medium whitespace-normal text-center leading-tight gap-2 active:scale-[0.98]"
                onClick={() => onCardClick()}
                data-testid={`button-view-appointment-${booking.id}`}>
                <CalendarDays className="h-3.5 w-3.5" />View Appointment
              </Button>
            </div>
          )}

          {false && isVisitCompleted && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button variant="outline"
                className="w-full min-w-0 flex-1 h-10 text-sm font-medium whitespace-normal text-center leading-tight gap-2 active:scale-[0.98]"
                onClick={() => onCardClick()}
                data-testid={`button-view-completed-appointment-${booking.id}`}>
                <CalendarDays className="h-3.5 w-3.5" />View Appointment
              </Button>
            </div>
          )}

        </div>
      )}

      {/* Declined state */}
      {false && role === "doctor" && isDoctorDeclined && (
        <div className="px-3 sm:px-4 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
          <X className="h-3.5 w-3.5" />Appointment Declined
        </div>
      )}

      </div>{/* end collapsible outer sections */}
      </div>{/* end rounded card shell */}
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
