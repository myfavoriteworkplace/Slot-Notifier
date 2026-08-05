import {
  Activity, AlertCircle, AlertTriangle, Clock, ShieldCheck,
} from "lucide-react";
import type { AppointmentCardRole } from "./AppointmentCard";

type Props = {
  role: AppointmentCardRole;
  isPastDue: boolean;
  isCancelled: boolean;
  isNoShow: boolean;
  isLeftEarly: boolean;
  isVisitCompleted: boolean;
  isTreatmentCompleted: boolean;
  isInConsultation: boolean;
  isCheckedIn: boolean;
  isCheckedInLate: boolean;
  isExpiredConfirmed?: boolean;
  doctorApprovalPending?: boolean;
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
  role, isPastDue, isCancelled, isNoShow, isLeftEarly,
  isVisitCompleted, isTreatmentCompleted, isInConsultation, isCheckedIn,
  isCheckedInLate, isExpiredConfirmed = false, doctorApprovalPending, cancellationReason,
  visitCompletionNote, totalBillsCount = 0, openBillsCount = 0, billingStatusKnown = true,
  confirmedBy,
  onBilling, onReschedule,
}: Props) {
  const messages: React.ReactNode[] = [];
  const terminal = isCancelled || isNoShow || isLeftEarly;

  if (isPastDue && !terminal) messages.push(
    <div key="past-due" className="flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-600 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{isExpiredConfirmed
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
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>Patient did not arrive</span>
    </div>
  );
  if (isLeftEarly && !cancellationReason) messages.push(
    <div key="left-early" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>Patient left before completion</span>
    </div>
  );
  if (isCancelled && !cancellationReason) messages.push(
    <div key="cancelled" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-400">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>Appointment cancelled</span>
    </div>
  );
  if (isVisitCompleted && visitCompletionNote) messages.push(
    <div key="note" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{visitCompletionNote}</span>
    </div>
  );
  if (isVisitCompleted && openBillsCount > 0) messages.push(
    <div key="billing" onClick={role === "clinic" ? onBilling : undefined} className={`flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400 ${role === "clinic" ? "cursor-pointer hover:bg-amber-100/60" : ""}`}>
      <Clock className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{role === "clinic" ? "Payment Pending" : "Visit closed — payment is pending with the clinic"}</span>
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
  if (role === "clinic" && isVisitCompleted && billingStatusKnown && totalBillsCount === 0) messages.push(<div key="no-dues" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /><span>No dues recorded</span></div>);
  if (role === "clinic" && isVisitCompleted && billingStatusKnown && totalBillsCount > 0 && openBillsCount === 0) messages.push(<div key="paid" className="flex w-full min-w-0 items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /><span>Payment settled</span></div>);

  if (!messages.length) return null;

  const panelTone = isCancelled || isNoShow || isLeftEarly || isPastDue || openBillsCount > 0
    ? "border-[#ca8a04] bg-[#fefce8] text-[#854d0e] dark:border-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-200"
    : isVisitCompleted
    ? "border-[#16a34a] bg-[#f0fdf4] text-[#166534] dark:border-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-200"
    : "border-[#0284c7] bg-[#f0f9ff] text-[#075985] dark:border-sky-700 dark:bg-sky-950/20 dark:text-sky-200";

  return (
    <section
      aria-label="Appointment status"
      className={`mx-3 mb-1 space-y-1.5 rounded-md border px-2.5 py-2 text-left sm:mx-4 sm:px-3 ${panelTone} [&>div>div]:!rounded-none [&>div>div]:!border-0 [&>div>div]:!bg-transparent [&>div>div]:!px-0 [&>div>div]:!py-0 [&>div>div]:!text-inherit`}
    >
      <div className="space-y-1.5 min-w-0">{messages}</div>
    </section>
  );
}