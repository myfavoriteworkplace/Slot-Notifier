import { CheckCircle2, LogOut, UserX, X } from "lucide-react";
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
}

// ──────────────── Steps ────────────────

const STEPS = [
  { key: "booked",       label: "Booked"    },
  { key: "confirmed",    label: "Confmd."   },
  { key: "checked_in",   label: "Arrived"   },
  { key: "in_tmt",       label: "In Tmt."   },
  { key: "visit_done",   label: "Visit Done" },
] as const;

function stageToIndex(stage: LifecycleStage): number {
  switch (stage) {
    case "booked":               return 0;
    case "confirmed":            return 1;
    case "checked_in":           return 2;
    case "in_consultation":      return 3;
    case "treatment_completed":  return 3;
    case "visit_completed":      return 4;
    default:                     return -1; // terminal
  }
}

// ──────────────── Component ────────────────

export function BookingProgressStrip({
  stage,
  isCancelled  = false,
  isNoShow     = false,
  isOverride   = false,
  isLeftEarly  = false,
  hasUnpaidBill = false,
  noBill        = false,
}: BookingProgressStripProps) {

  const isTerminal = TERMINAL.has(stage) || isCancelled || isNoShow || isLeftEarly;

  // ── Terminal render ──
  if (isTerminal) {
    const isNo    = isNoShow  || stage === "no_show";
    const isEarly = isLeftEarly || stage === "left_early";
    const trailColor  = isEarly ? "bg-amber-300/50" : "bg-rose-300/50";
    const doneBorder  = isEarly ? "border-amber-300 dark:border-amber-700" : "border-rose-300 dark:border-rose-700";
    const doneBg      = isEarly ? "bg-amber-50 dark:bg-amber-950/20" : "bg-rose-50 dark:bg-rose-950/20";
    const doneInner   = isEarly ? "bg-amber-400" : "bg-rose-400";
    const doneLabel   = isEarly ? "text-amber-500 dark:text-amber-400" : "text-rose-500 dark:text-rose-400";
    const badgeCls    = isNo
      ? "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
      : isEarly
      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
      : "text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800";
    const badgeLabel  = isNo ? "No Show" : isEarly ? "Left Early" : "Cancelled";
    const BadgeIcon   = isNo ? UserX : isEarly ? LogOut : X;

    return (
      <div className="flex items-center w-full px-1 py-0.5 gap-0">
        {STEPS.map((s, i) => {
          const pastStage = 0; // always 0 for terminal (nothing was reached)
          const wasDone = i < pastStage;
          return (
            <div key={s.key} className="contents">
              {i > 0 && (
                <div className={`flex-1 h-px min-w-[6px] ${wasDone ? trailColor : "bg-border/30"}`} />
              )}
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${wasDone ? `${doneBg} ${doneBorder}` : "bg-muted border-border/30"}`}>
                  {wasDone
                    ? <span className={`h-1.5 w-1.5 rounded-full ${doneInner}`} />
                    : <span className="h-1.5 w-1.5 rounded-full bg-border/40" />}
                </div>
                <span className={`text-[9px] font-medium leading-none whitespace-nowrap ${wasDone ? doneLabel : "text-muted-foreground/30"}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
        <div className={`ml-2 shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badgeCls}`}>
          <BadgeIcon className="h-2.5 w-2.5" />
          {badgeLabel}
        </div>
      </div>
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
              dotBg     = "bg-amber-50 dark:bg-amber-950/20";
              dotBorder = "border-amber-400 dark:border-amber-600";
              dotInner  = <CheckCircle2 className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />;
              lineColor = "bg-amber-300/60 dark:bg-amber-700/40";
              labelColor= "text-amber-600 dark:text-amber-400 font-semibold";
            } else if (noBill) {
              dotBg     = "bg-amber-50 dark:bg-amber-950/20";
              dotBorder = "border-amber-400 dark:border-amber-600";
              dotInner  = <CheckCircle2 className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />;
              lineColor = "bg-emerald-300 dark:bg-emerald-700";
              labelColor= "text-amber-600 dark:text-amber-400 font-semibold";
            } else {
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

          const lastStepTooltip = isLast && (noBill || hasUnpaidBill);

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
              {lastStepTooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-default">{dotEl}</div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {hasUnpaidBill ? "Bill pending — invoice not yet settled" : "No Invoice generated"}
                  </TooltipContent>
                </Tooltip>
              ) : dotEl}
            </div>
          );
        })}

        {curStep === 4 && hasUnpaidBill && (
          <div className="ml-1.5 shrink-0 flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-full">
            Bill Due
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
