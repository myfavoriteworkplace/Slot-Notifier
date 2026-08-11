import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, Clock, ShieldCheck,
} from "lucide-react";
import type { AppointmentCardRole } from "./AppointmentCard";
import type { BookingClassification } from "@shared/booking-status";

type Props = {
  role: AppointmentCardRole;
  classification: BookingClassification;
  isCheckedInLate: boolean;
  cancellationReason?: string | null;
  visitCompletionNote?: string | null;
  totalBillsCount?: number;
  openBillsCount?: number;
  billingStatusKnown?: boolean;
  confirmedBy?: string | null;
  onBilling?: () => void;
  onReschedule?: () => void;
};

export function AppointmentInfoSection({
  role, classification, isCheckedInLate, cancellationReason,
  visitCompletionNote, totalBillsCount = 0, openBillsCount = 0, billingStatusKnown = true,
  confirmedBy,
  onBilling, onReschedule,
}: Props) {
  const messages: React.ReactNode[] = [];
  const [expanded, setExpanded] = useState(false);
  const [hasMoreContent, setHasMoreContent] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    isPastDueToday: isPastDue,
    isEarlyExit: isLeftEarly,
    isCompleted: isVisitCompleted,
    isTreatmentCompleted,
    isActive,
    isTerminal: terminal,
    messageInputs,
  } = classification;
  const isCancelled = classification.normalizedLifecycle === "cancelled";
  const isNoShow = classification.normalizedLifecycle === "no_show";
  const isInConsultation = classification.normalizedLifecycle === "in_consultation";
  const isCheckedIn = classification.normalizedLifecycle === "checked_in";
  const doctorApprovalPending = classification.isAwaitingDoctorApproval;

  if (isPastDue && !terminal) messages.push(
    <div key="past-due" className="flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-600 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{messageInputs.showOldResolution
        ? (role === "clinic" ? "Patient did not arrive — review for No-Show or reschedule" : "Patient did not arrive — waiting for clinic to reschedule or close this appointment")
        : `Slot time has passed — ${role === "clinic" ? "please reschedule or update this booking" : "waiting for clinic action"}`}</span>
      {role === "clinic" && onReschedule && <button onClick={onReschedule} className="min-h-[32px] shrink-0 underline underline-offset-2">Reschedule</button>}
    </div>
  );
  if (terminal && cancellationReason) messages.push(
    <div key="reason" className={`flex w-full min-w-0 items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
      isNoShow ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950/20 dark:text-slate-400"
      : isLeftEarly ? "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
      : "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-400"
    }`}>
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{cancellationReason}</span>
    </div>
  );
  if (isNoShow && !cancellationReason) messages.push(
    <div key="no-show" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/20 dark:text-slate-400">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>Patient did not arrive — review the appointment outcome</span>
    </div>
  );
  if (isLeftEarly && !cancellationReason) messages.push(
    <div key="left-early" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>Patient left before completion — visit ended early</span>
    </div>
  );
  if (isCancelled && !cancellationReason) messages.push(
    <div key="cancelled" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-400">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>Appointment cancelled — no visit will take place</span>
    </div>
  );
  if (isVisitCompleted && visitCompletionNote) messages.push(
    <div key="note" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{visitCompletionNote}</span>
    </div>
  );
  if (isVisitCompleted && openBillsCount > 0) messages.push(
    <div key="billing" onClick={role === "clinic" ? onBilling : undefined} className={`flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400 ${role === "clinic" ? "cursor-pointer hover:bg-amber-100/60" : ""}`}>
      <Clock className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{role === "clinic" ? "Payment pending — review outstanding clinic billing" : "Visit closed — payment is pending with the clinic"}</span>
    </div>
  );
  if (isCheckedInLate && !terminal && !isVisitCompleted) messages.push(
    <div key="late" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-600 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-400">
      <Clock className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{role === "clinic" ? "Patient arrived after scheduled slot time — waiting for doctor" : "Patient arrived late — ready for consultation"}</span>
    </div>
  );
  if (role === "clinic" && isCheckedIn && !terminal) messages.push(<div key="waiting" className="flex w-full items-start gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400"><Clock className="mt-0.5 h-3 w-3 shrink-0" /><span>Patient is waiting for the doctor</span></div>);
  if (role === "clinic" && isInConsultation) messages.push(<div key="consult" className="flex w-full items-start gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-600 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-400"><Activity className="mt-0.5 h-3 w-3 shrink-0" /><span>Consultation is in progress</span></div>);
  if (role === "doctor" && !terminal && !isCheckedIn && !isInConsultation && !isTreatmentCompleted && !isVisitCompleted && !doctorApprovalPending) messages.push(<div key="doctor-wait" className="flex w-full items-start gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400"><Clock className="mt-0.5 h-3 w-3 shrink-0" /><span>Waiting for patient to arrive — no action needed</span></div>);
  if (role === "doctor" && isInConsultation) messages.push(<div key="doctor-consult" className="flex w-full items-start gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-600 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-400"><Activity className="mt-0.5 h-3 w-3 shrink-0" /><span>Consultation is in progress</span></div>);
  if (role === "doctor" && isTreatmentCompleted && !isVisitCompleted) messages.push(<div key="doctor-done" className="flex w-full items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-600 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400"><Clock className="mt-0.5 h-3 w-3 shrink-0" /><span>Consultation done — awaiting clinic to close the visit</span></div>);
  if (role === "doctor" && isVisitCompleted && openBillsCount === 0) messages.push(<div key="closed" className="flex w-full items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /><span className="break-words">Visit closed successfully{billingStatusKnown ? (totalBillsCount === 0 ? " — no billing recorded" : " — payment settled") : ""}</span></div>);
   if (role === "clinic" && isVisitCompleted && billingStatusKnown && totalBillsCount === 0) messages.push(<div key="no-dues" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /><span>No dues recorded — this visit has no billing items</span></div>);
   if (role === "clinic" && isVisitCompleted && billingStatusKnown && totalBillsCount > 0 && openBillsCount === 0) messages.push(<div key="paid" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /><span>Payment settled — all visit bills are paid</span></div>);

  const panelTone = isCancelled || isNoShow || isLeftEarly || isPastDue || openBillsCount > 0
    ? "border-yellow-200 bg-[#fefce8] text-[#9a7b36] dark:border-yellow-800/60 dark:bg-yellow-950/20 dark:text-yellow-200"
    : isVisitCompleted
    ? "border-emerald-200 bg-[#f0fdf4] text-[#4d8b62] dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-200"
    : "border-sky-200 bg-[#f0f9ff] text-[#397894] dark:border-sky-800/60 dark:bg-sky-950/20 dark:text-sky-200";

  useEffect(() => {
    const measure = () => {
      const element = contentRef.current;
      if (!element) return;
      // The compact preview is intentionally two rows tall; measure the
      // content against that preview height rather than its unconstrained
      // natural height.
      setHasMoreContent(element.scrollHeight > 48);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measure)
      : null;
    if (observer && contentRef.current) observer.observe(contentRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [messages.length]);

  if (!messages.length) return null;

  const SectionIcon = isVisitCompleted && openBillsCount === 0
    ? ShieldCheck
    : (isPastDue || terminal || openBillsCount > 0)
      ? AlertTriangle
      : isInConsultation
        ? Activity
        : Clock;

  return (
    <section
      aria-label="Appointment status"
      tabIndex={hasMoreContent ? 0 : undefined}
      onFocus={() => hasMoreContent && setExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
      }}
      onClick={(event) => {
        if (hasMoreContent && !(event.target as HTMLElement).closest("button")) {
          setExpanded((value) => !value);
        }
      }}
      className={`mx-3 mb-1 rounded-md border px-2.5 py-2 text-left text-[11.5px] transition-[max-height] duration-200 sm:mx-4 sm:px-3 ${panelTone} ${expanded || !hasMoreContent ? "max-h-[1000px]" : "max-h-[68px] overflow-hidden"}`}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <SectionIcon className="mt-0.5 h-3 w-3 shrink-0 opacity-75" aria-hidden="true" />
        <div ref={contentRef} className="min-w-0 flex-1 space-y-1.5 [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!px-0 [&>div]:!py-0 [&>div>svg]:hidden [&>div]:!text-inherit">
          {messages}
        </div>
      </div>
      {hasMoreContent && (
        <button
          type="button"
          className="mt-1 ml-4 inline-flex h-5 w-5 items-center justify-center rounded-full text-sm font-bold opacity-75 hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/40"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse appointment details" : "Expand appointment details"}
          onClick={() => setExpanded((value) => !value)}
        >
          <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
        </button>
      )}
    </section>
  );
}