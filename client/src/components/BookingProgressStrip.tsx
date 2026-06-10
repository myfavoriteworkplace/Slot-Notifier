import { CheckCircle2, Circle } from "lucide-react";

export type LifecycleStage = 0 | 1 | 2 | 3 | 4;

const STAGES = [
  { key: "booked", label: "Booked" },
  { key: "arrived", label: "Arrived" },
  { key: "in_treatment", label: "In Tmt." },
  { key: "tmt_done", label: "Tmt. Done" },
  { key: "visit_done", label: "Visit Done" },
] as const;

interface BookingProgressStripProps {
  stage: LifecycleStage;
  isCancelled?: boolean;
  isNoShow?: boolean;
  isOverride?: boolean;
}

export function BookingProgressStrip({
  stage,
  isCancelled = false,
  isNoShow = false,
  isOverride = false,
}: BookingProgressStripProps) {
  if (isCancelled || isNoShow) {
    return (
      <div className="flex items-center gap-1.5 px-1 py-0.5 overflow-x-auto no-scrollbar">
        {STAGES.map((s, i) => {
          const wasDone = i < stage;
          return (
            <div key={s.key} className="flex items-center gap-1 shrink-0">
              {i > 0 && (
                <div className={`h-px w-3 sm:w-4 ${wasDone ? "bg-red-400/60" : "bg-border/40"}`} />
              )}
              <div className="flex flex-col items-center gap-0.5">
                <div className={`h-4 w-4 rounded-full flex items-center justify-center
                  ${wasDone ? "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" : "bg-muted border border-border/40"}`}>
                  {wasDone
                    ? <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    : <span className="h-1.5 w-1.5 rounded-full bg-border/60" />}
                </div>
                <span className={`text-[9px] font-medium leading-none whitespace-nowrap
                  ${wasDone ? "text-red-500 dark:text-red-400" : "text-muted-foreground/50"}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
        <div className="ml-1.5 shrink-0 flex items-center gap-1 text-[9px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-full">
          {isNoShow ? "No Show" : "Cancelled"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-1 py-0.5 overflow-x-auto no-scrollbar">
      {STAGES.map((s, i) => {
        const isCompleted = i < stage;
        const isCurrent = i === stage;
        const isSkipped = isOverride && i > 0 && i < stage && stage === 4;

        let dotBg: string;
        let dotBorder: string;
        let dotInner: React.ReactNode;
        let lineColor: string;
        let labelColor: string;

        if (isSkipped) {
          dotBg = "bg-orange-50 dark:bg-orange-950/20";
          dotBorder = "border-orange-300 dark:border-orange-700";
          dotInner = <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />;
          lineColor = "bg-orange-300/50";
          labelColor = "text-orange-500 dark:text-orange-400 line-through";
        } else if (isCompleted) {
          dotBg = "bg-emerald-50 dark:bg-emerald-950/20";
          dotBorder = "border-emerald-400 dark:border-emerald-600";
          dotInner = <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />;
          lineColor = "bg-emerald-300 dark:bg-emerald-700";
          labelColor = "text-emerald-600 dark:text-emerald-400 font-semibold";
        } else if (isCurrent) {
          dotBg = "bg-sky-50 dark:bg-sky-950/20";
          dotBorder = "border-sky-400 dark:border-sky-500";
          dotInner = (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
            </span>
          );
          lineColor = "bg-border/40";
          labelColor = "text-sky-600 dark:text-sky-400 font-bold";
        } else {
          dotBg = "bg-muted";
          dotBorder = "border-border/50";
          dotInner = <span className="h-1.5 w-1.5 rounded-full bg-border/60" />;
          lineColor = "bg-border/40";
          labelColor = "text-muted-foreground/50";
        }

        return (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            {i > 0 && (
              <div className={`h-px w-3 sm:w-4 transition-colors ${i <= stage ? lineColor : "bg-border/40"}`} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${dotBg} ${dotBorder} transition-all`}>
                {dotInner}
              </div>
              <span className={`text-[9px] leading-none whitespace-nowrap transition-colors ${labelColor}`}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
