import { CheckCircle2, LogOut, UserX } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ──────────────── Types ────────────────

export type LifecycleStage =
  | "booked"
  | "confirmed"
  | "checked_in"
  | "in_consultation"
  | "treatment_completed"
  | "visit_completed"
  | "left_early"
  | "no_show"
  | "cancelled";

const TERMINAL = new Set<LifecycleStage>(["cancelled", "no_show", "left_early"]);

export interface BookingProgressStripProps {
  stage: LifecycleStage;
  isCancelled?: boolean;
  isNoShow?: boolean;
  isOverride?: boolean;
  isLeftEarly?: boolean;
  hasUnpaidBill?: boolean;
  noBill?: boolean;
  checkedInAt?: Date | string | null;
  completedAt?: Date | string | null;
  /** Reason for cancellation / no-show / left-early — shown as tooltip */
  cancellationReason?: string | null;
  /** Who confirmed the booking ("admin" | "doctor") — shown as tooltip on confirmed step */
  confirmedBy?: string | null;
  /** Highest step index (0–4) that was reached before the booking became terminal */
  stageBeforeCancel?: number;
  /** Reason the admin recorded when closing the visit (normal or override) */
  visitCompletionNote?: string | null;
}

// ──────────────── Steps ────────────────

const STEPS = [
  { key: "booked",    label: "Booked"     },
  { key: "confirmed", label: "Confmd."    },
  { key: "checked_in",label: "Arrived"    },
  { key: "in_tmt",    label: "In Tmt."    },
  { key: "visit_done",label: "Visit Done" },
] as const;

function stageToIndex(stage: LifecycleStage): number {
  switch (stage) {
    case "booked":               return 0;
    case "confirmed":            return 1;
    case "checked_in":           return 2;
    case "in_consultation":      return 3;
    case "treatment_completed":  return 3;
    case "visit_completed":      return 4;
    default:                     return -1;
  }
}

// ──────────────── Component ────────────────

export function BookingProgressStrip({
  stage,
  isCancelled   = false,
  isNoShow      = false,
  isOverride    = false,
  isLeftEarly   = false,
  hasUnpaidBill = false,
  noBill        = false,
  cancellationReason,
  confirmedBy,
  stageBeforeCancel = 0,
  visitCompletionNote,
}: BookingProgressStripProps) {

  const isTerminal = TERMINAL.has(stage) || isCancelled || isNoShow || isLeftEarly;

  // ── Terminal render ──
  if (isTerminal) {
    const isNo    = isNoShow   || stage === "no_show";
    const isEarly = isLeftEarly || stage === "left_early";
    const isCx    = !isNo && !isEarly;

    // Colour palette for completed-before-terminal steps
    const redDotBg     = "bg-rose-50 dark:bg-rose-950/20";
    const redDotBorder = "border-rose-300 dark:border-rose-700";
    const redInner     = "bg-rose-400";
    const redLabel     = "text-rose-500 dark:text-rose-400";
    const redLine      = "bg-rose-300/50";

    const earlyDotBg     = "bg-amber-50 dark:bg-amber-950/20";
    const earlyDotBorder = "border-amber-300 dark:border-amber-700";
    const earlyInner     = "bg-amber-400";
    const earlyLabel     = "text-amber-500 dark:text-amber-400";
    const earlyLine      = "bg-amber-300/50";

    const noDotBg     = "bg-slate-50 dark:bg-slate-900/40";
    const noDotBorder = "border-slate-300 dark:border-slate-700";
    const noInner     = "bg-slate-400";
    const noLabel     = "text-slate-500 dark:text-slate-400";
    const noLine      = "bg-slate-300/50";

    const termDotBg     = isCx ? redDotBg     : isEarly ? earlyDotBg     : noDotBg;
    const termDotBorder = isCx ? redDotBorder : isEarly ? earlyDotBorder : noDotBorder;
    const termInner     = isCx ? redInner     : isEarly ? earlyInner     : noInner;
    const termLabel     = isCx ? redLabel     : isEarly ? earlyLabel     : noLabel;

    // Tooltip text for the last-reached step
    const termTooltip = cancellationReason
      ? cancellationReason
      : isNo
      ? "Patient did not arrive"
      : isEarly
      ? "Patient left before the visit was completed"
      : "Appointment cancelled";

    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center w-full px-1 py-0.5 gap-0">
          {STEPS.map((s, i) => {
            const wasDone    = i <= stageBeforeCancel;
            const isLastDone = i === stageBeforeCancel;

            let dotBg: string, dotBorder: string, dotInner: React.ReactNode, lineColor: string, labelCls: string;

            if (wasDone) {
              // All completed stages shown in terminal colour (red/amber/slate)
              dotBg     = termDotBg;
              dotBorder = termDotBorder;
              dotInner  = <span className={`h-1.5 w-1.5 rounded-full ${termInner}`} />;
              lineColor = isCx ? redLine : isEarly ? earlyLine : noLine;
              labelCls  = termLabel;
            } else {
              dotBg     = "bg-muted";
              dotBorder = "border-border/30";
              dotInner  = <span className="h-1.5 w-1.5 rounded-full bg-border/40" />;
              lineColor = "bg-border/30";
              labelCls  = "text-muted-foreground/30";
            }

            const dotEl = (
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${dotBg} ${dotBorder}`}>
                  {dotInner}
                </div>
                <span className={`text-[9px] font-medium leading-none whitespace-nowrap ${labelCls}`}>
                  {s.label}
                </span>
              </div>
            );

            return (
              <div key={s.key} className="contents">
                {i > 0 && (
                  <div className={`flex-1 h-px min-w-[6px] ${i <= stageBeforeCancel ? lineColor : "bg-border/30"}`} />
                )}
                {/* Tooltip only on the last completed dot */}
                {isLastDone ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-default">{dotEl}</div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                      {termTooltip}
                    </TooltipContent>
                  </Tooltip>
                ) : dotEl}
              </div>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  // ── Normal render ──
  const curStep = stageToIndex(stage);

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex items-center w-full px-1 py-0.5">
        {STEPS.map((s, i) => {
          const isCompleted = i < curStep;
          const isCurrent   = i === curStep;
          const isLast      = i === STEPS.length - 1;
          const isSkipped   = isOverride && curStep === 4 && i > 0 && i < 4;

          let dotBg: string;
          let dotBorder: string;
          let dotInner: React.ReactNode;
          let lineColor: string;
          let labelColor: string;

          if (isSkipped) {
            dotBg     = "bg-orange-50 dark:bg-orange-950/20";
            dotBorder = "border-orange-300 dark:border-orange-700";
            dotInner  = <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />;
            lineColor = "bg-orange-300/40";
            labelColor= "text-orange-500 dark:text-orange-400 line-through";
          } else if (isLast && isCurrent) {
            if (hasUnpaidBill) {
              // Amber: visit done but unpaid bills remain — needs attention
              dotBg     = "bg-amber-50 dark:bg-amber-950/20";
              dotBorder = "border-amber-400 dark:border-amber-600";
              dotInner  = <CheckCircle2 className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />;
              lineColor = "bg-amber-300/60 dark:bg-amber-700/40";
              labelColor= "text-amber-600 dark:text-amber-400 font-semibold";
            } else if (noBill) {
              // Green dashed: visit done intentionally with no invoice (free, waived, etc.)
              dotBg     = "bg-emerald-50 dark:bg-emerald-950/20";
              dotBorder = "border-dashed border-emerald-400 dark:border-emerald-600";
              dotInner  = <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />;
              lineColor = "bg-emerald-300 dark:bg-emerald-700";
              labelColor= "text-emerald-600 dark:text-emerald-400 font-semibold";
            } else {
              // Solid green: fully done
              dotBg     = "bg-emerald-50 dark:bg-emerald-950/20";
              dotBorder = "border-emerald-400 dark:border-emerald-600";
              dotInner  = <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />;
              lineColor = "bg-emerald-300 dark:bg-emerald-700";
              labelColor= "text-emerald-600 dark:text-emerald-400 font-semibold";
            }
          } else if (isCompleted) {
            dotBg     = "bg-emerald-50 dark:bg-emerald-950/20";
            dotBorder = "border-emerald-400 dark:border-emerald-600";
            dotInner  = <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />;
            lineColor = "bg-emerald-300 dark:bg-emerald-700";
            labelColor= "text-emerald-600 dark:text-emerald-400 font-semibold";
          } else if (isCurrent) {
            dotBg     = "bg-sky-50 dark:bg-sky-950/20";
            dotBorder = "border-sky-400 dark:border-sky-500";
            dotInner  = (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
              </span>
            );
            lineColor = "bg-border/40";
            labelColor= "text-sky-600 dark:text-sky-400 font-bold";
          } else {
            dotBg     = "bg-muted";
            dotBorder = "border-border/50";
            dotInner  = <span className="h-1.5 w-1.5 rounded-full bg-border/60" />;
            lineColor = "bg-border/40";
            labelColor= "text-muted-foreground/40";
          }

          // Tooltip content for specific steps
          const isConfirmedStep = i === 1 && (isCompleted || isCurrent);
          const isLastStep      = isLast && isCurrent;
          const hasStepTooltip  = (isConfirmedStep && confirmedBy)
            || (isLastStep && (noBill || hasUnpaidBill || !!visitCompletionNote || isOverride));

          let tooltipText = "";
          if (isConfirmedStep && confirmedBy) {
            tooltipText = confirmedBy === "doctor"
              ? "Confirmed by Doctor"
              : confirmedBy === "admin"
              ? "Confirmed by Clinic Admin"
              : `Confirmed by ${confirmedBy}`;
          } else if (isLastStep) {
            if (visitCompletionNote) {
              tooltipText = visitCompletionNote;
            } else if (hasUnpaidBill) {
              tooltipText = "Bill pending — invoice not yet settled";
            } else if (noBill) {
              tooltipText = "No invoice generated for this visit";
            } else if (isOverride) {
              tooltipText = "Visit force-completed by admin — some stages were skipped";
            }
          }

          const dotEl = (
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all ${dotBg} ${dotBorder}`}>
                {dotInner}
              </div>
              <span className={`text-[9px] leading-none whitespace-nowrap transition-colors ${labelColor}`}>
                {s.label}
              </span>
            </div>
          );

          return (
            <div key={s.key} className="contents">
              {i > 0 && (
                <div className={`flex-1 h-px min-w-[4px] transition-colors ${i <= curStep && !isSkipped ? lineColor : "bg-border/40"}`} />
              )}
              {hasStepTooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-default">{dotEl}</div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                    {tooltipText}
                  </TooltipContent>
                </Tooltip>
              ) : dotEl}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
