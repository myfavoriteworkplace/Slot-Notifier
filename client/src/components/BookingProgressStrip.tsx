import { CheckCircle2, LogOut } from "lucide-react";

export type LifecycleStage = 0 | 1 | 2 | 3 | 4;

const STAGES = [
  { key: "booked",       label: "Booked"    },
  { key: "arrived",      label: "Arrived"   },
  { key: "in_treatment", label: "In Tmt."   },
  { key: "tmt_done",     label: "Tmt. Done" },
  { key: "visit_done",   label: "Visit Done"},
] as const;

export interface BookingProgressStripProps {
  stage: LifecycleStage;
  isCancelled?: boolean;
  isNoShow?: boolean;
  isOverride?: boolean;
  isLeftEarly?: boolean;
  hasUnpaidBill?: boolean;
  noBill?: boolean;
}

export function BookingProgressStrip({
  stage,
  isCancelled  = false,
  isNoShow     = false,
  isOverride   = false,
  isLeftEarly  = false,
  hasUnpaidBill = false,
  noBill        = false,
}: BookingProgressStripProps) {

  if (isCancelled || isNoShow || isLeftEarly) {
    const trailColor   = isLeftEarly ? "bg-amber-400/60"  : "bg-red-400/60";
    const dotDoneBg    = isLeftEarly
      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
      : "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700";
    const dotDoneInner = isLeftEarly ? "bg-amber-400" : "bg-red-400";
    const labelDone    = isLeftEarly
      ? "text-amber-500 dark:text-amber-400"
      : "text-red-500 dark:text-red-400";
    const badgeCls     = isLeftEarly
      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
      : "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800";
    const badgeLabel   = isNoShow ? "No Show" : isLeftEarly ? "Left Early" : "Cancelled";

    return (
      <div className="flex items-center w-full px-1 py-0.5">
        {STAGES.map((s, i) => {
          const wasDone = i < stage;
          return (
            <div key={s.key} className="contents">
              {i > 0 && (
                <div className={`flex-1 h-px min-w-[6px] ${wasDone ? trailColor : "bg-border/40"}`} />
              )}
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${wasDone ? dotDoneBg : "bg-muted border-border/40"}`}>
                  {wasDone
                    ? <span className={`h-1.5 w-1.5 rounded-full ${dotDoneInner}`} />
                    : <span className="h-1.5 w-1.5 rounded-full bg-border/60" />}
                </div>
                <span className={`text-xs font-medium leading-none whitespace-nowrap ${wasDone ? labelDone : "text-muted-foreground/50"}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
        <div className={`ml-1.5 shrink-0 flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${badgeCls}`}>
          {isLeftEarly && <LogOut className="h-2 w-2" />}
          {badgeLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full px-1 py-0.5">
      {STAGES.map((s, i) => {
        const isCompleted = i < stage;
        const isCurrent   = i === stage;
        const isSkipped   = isOverride && stage === 4 && i > 0 && i < 4;

        let dotBg: string;
        let dotBorder: string;
        let dotInner: React.ReactNode;
        let lineColor: string;
        let labelColor: string;
        let labelText: string = s.label;

        if (isSkipped) {
          dotBg      = "bg-orange-50 dark:bg-orange-950/20";
          dotBorder  = "border-orange-300 dark:border-orange-700";
          dotInner   = <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />;
          lineColor  = "bg-orange-300/50";
          labelColor = "text-orange-500 dark:text-orange-400 line-through";
        } else if (isCurrent && i === 4) {
          if (hasUnpaidBill || noBill) {
            dotBg      = "bg-amber-50 dark:bg-amber-950/20";
            dotBorder  = "border-amber-300 dark:border-amber-600";
            dotInner   = <CheckCircle2 className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />;
            lineColor  = "bg-amber-300/60 dark:bg-amber-700/40";
            labelColor = "text-amber-600 dark:text-amber-400 font-semibold";
            labelText  = hasUnpaidBill ? "Bill Pending" : "No Invoice";
          } else {
            dotBg      = "bg-emerald-50 dark:bg-emerald-950/20";
            dotBorder  = "border-emerald-400 dark:border-emerald-600";
            dotInner   = <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />;
            lineColor  = "bg-emerald-300 dark:bg-emerald-700";
            labelColor = "text-emerald-600 dark:text-emerald-400 font-semibold";
          }
        } else if (isCompleted) {
          dotBg      = "bg-emerald-50 dark:bg-emerald-950/20";
          dotBorder  = "border-emerald-400 dark:border-emerald-600";
          dotInner   = <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />;
          lineColor  = "bg-emerald-300 dark:bg-emerald-700";
          labelColor = "text-emerald-600 dark:text-emerald-400 font-semibold";
        } else if (isCurrent) {
          dotBg      = "bg-sky-50 dark:bg-sky-950/20";
          dotBorder  = "border-sky-400 dark:border-sky-500";
          dotInner   = (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
            </span>
          );
          lineColor  = "bg-border/40";
          labelColor = "text-sky-600 dark:text-sky-400 font-bold";
        } else {
          dotBg      = "bg-muted";
          dotBorder  = "border-border/50";
          dotInner   = <span className="h-1.5 w-1.5 rounded-full bg-border/60" />;
          lineColor  = "bg-border/40";
          labelColor = "text-muted-foreground/50";
        }

        return (
          <div key={s.key} className="contents">
            {i > 0 && (
              <div className={`flex-1 h-px min-w-[6px] transition-colors ${i <= stage ? lineColor : "bg-border/40"}`} />
            )}
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${dotBg} ${dotBorder} transition-all`}>
                {dotInner}
              </div>
              <span className={`text-xs leading-none whitespace-nowrap transition-colors ${labelColor}`}>
                {labelText}
              </span>
            </div>
          </div>
        );
      })}

      {stage === 4 && (hasUnpaidBill || noBill) && (
        <div className="ml-1 shrink-0 flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-full">
          {hasUnpaidBill ? "Bill Due" : "No Invoice"}
        </div>
      )}
    </div>
  );
}
