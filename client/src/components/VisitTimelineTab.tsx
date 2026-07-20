import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Activity, Stethoscope, Pill, Paperclip, FileText,
  CheckCircle2, Clock, RefreshCw, AlertCircle, CalendarDays,
  ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

interface VisitTimelineEntry {
  bookingId: number;
  visitDate: string;
  visitType: string | null;
  treatmentCategory: string | null;
  visitStatus: string | null;
  description: string | null;
  visitCompletionNote: string | null;
  diagnosis: string[];
  medicationCount: number;
  medicationNames: string[];
  clinicalNotes: string | null;
  attachmentCount: number;
  billServiceCount: number;
  isFirstVisit: boolean;
}

interface Props {
  bookingId: number;
  currentBookingId: number;
  onTabSwitch?: (tab: "diagnosis" | "prescription") => void;
}

function visitLabel(entry: VisitTimelineEntry): string {
  if (entry.visitType === "follow_up" || entry.visitType === "follow-up") return "Follow-up";
  if (entry.visitType === "emergency") return "Emergency";
  if (entry.visitType === "consultation") return "Consultation";
  if (entry.visitStatus === "completed" || entry.visitStatus === "treatment_completed") return "Completed";
  if (entry.visitStatus === "checked_in" || entry.visitStatus === "in_consultation") return "In Progress";
  if (entry.visitStatus === "patient_left_early") return "Left Early";
  return entry.treatmentCategory ?? "Visit";
}

function visitStatusIcon(entry: VisitTimelineEntry) {
  const vs = entry.visitStatus;
  if (vs === "completed" || vs === "treatment_completed") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-white" />;
  }
  if (vs === "checked_in" || vs === "in_consultation") {
    return <Clock className="w-3.5 h-3.5 text-white" />;
  }
  if (vs === "patient_left_early") {
    return <AlertCircle className="w-3.5 h-3.5 text-white" />;
  }
  return <CalendarDays className="w-3.5 h-3.5 text-white" />;
}

function visitDotColor(entry: VisitTimelineEntry, isCurrent: boolean): string {
  if (isCurrent) return "bg-[#0F9B6E]";
  const vs = entry.visitStatus;
  if (vs === "completed" || vs === "treatment_completed") return "bg-[#0F9B6E]";
  if (vs === "checked_in" || vs === "in_consultation") return "bg-blue-500";
  if (vs === "patient_left_early") return "bg-amber-500";
  return "bg-slate-400";
}

/** Inline expandable detail panel for past-visit records */
function PastVisitDetail({ entry }: { entry: VisitTimelineEntry }) {
  return (
    <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 text-[11px]">
      {entry.diagnosis.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Diagnosis findings</p>
          <div className="flex flex-wrap gap-1">
            {entry.diagnosis.map(d => (
              <span key={d} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#0F9B6E]/10 text-[#085041] border border-[#0F9B6E]/20 text-[10px] font-medium">
                {d}
              </span>
            ))}
          </div>
          {entry.clinicalNotes && (
            <p className="mt-1 text-slate-500 italic leading-snug">{entry.clinicalNotes}</p>
          )}
        </div>
      )}
      {entry.medicationNames.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Prescriptions</p>
          <div className="flex flex-wrap gap-1">
            {entry.medicationNames.map((m, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                <Pill className="w-2.5 h-2.5 mr-1" />{m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VisitTimelineTab({ bookingId, currentBookingId, onTabSwitch }: Props) {
  const [expandedPast, setExpandedPast] = useState<Set<number>>(new Set());

  const { data: timeline, isLoading, isError } = useQuery<VisitTimelineEntry[]>({
    queryKey: ["/api/doctor/bookings", bookingId, "visit-timeline"],
    queryFn: () => apiRequest("GET", `/api/doctor/bookings/${bookingId}/visit-timeline`).then(r => r.json()),
    staleTime: 60_000,
  });

  const togglePast = (id: number) => {
    setExpandedPast(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="w-0.5 h-16" />
            </div>
            <Skeleton className="flex-1 h-24 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">Could not load visit history.</p>
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
        <Activity className="w-8 h-8" />
        <p className="text-sm">No visit history found for this patient.</p>
        <p className="text-xs">History appears once the patient has a linked record.</p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto" data-testid="visit-timeline-tab">
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-[#0F9B6E]" />
        <h3 className="text-sm font-semibold text-slate-800">Visit Timeline</h3>
        <Badge variant="outline" className="ml-auto text-[10px] text-slate-500 border-slate-200">
          {timeline.length} visit{timeline.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="relative">
        {timeline.map((entry, idx) => {
          const isCurrent = entry.bookingId === currentBookingId;
          const isLast = idx === timeline.length - 1;
          const label = visitLabel(entry);
          const dateStr = format(parseISO(entry.visitDate), "d MMM yyyy");
          const isPastExpanded = expandedPast.has(entry.bookingId);

          // Diagnosis display values
          const dxTags = entry.diagnosis;
          const dxSummary = dxTags.length > 0
            ? dxTags.slice(0, 2).join(", ") + (dxTags.length > 2 ? ` +${dxTags.length - 2}` : "")
            : null;

          // Prescription display values
          const rxNames = entry.medicationNames;
          const rxSummary = rxNames.length > 0
            ? rxNames.slice(0, 2).join(", ") + (rxNames.length > 2 ? ` +${rxNames.length - 2}` : "")
            : entry.medicationCount > 0
              ? `${entry.medicationCount} Medicine${entry.medicationCount !== 1 ? "s" : ""}`
              : null;

          // Treatment display value
          const treatmentSummary = entry.treatmentCategory
            ?? (entry.clinicalNotes ? entry.clinicalNotes.slice(0, 60) + (entry.clinicalNotes.length > 60 ? "…" : "") : null);

          const hasPastDetail = !isCurrent && (dxTags.length > 0 || rxNames.length > 0);

          return (
            <div key={entry.bookingId} className="flex gap-3 mb-2" data-testid={`timeline-entry-${entry.bookingId}`}>
              {/* Date column */}
              <div className="w-20 shrink-0 text-right pt-1.5">
                <span className="text-[10px] text-slate-500 leading-tight">{dateStr}</span>
              </div>

              {/* Stem + dot */}
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm ${visitDotColor(entry, isCurrent)}`}>
                  {visitStatusIcon(entry)}
                </div>
                {!isLast && <div className="w-px flex-1 bg-slate-200 my-1 min-h-[20px]" />}
              </div>

              {/* Card */}
              <div className={`flex-1 mb-3 rounded-xl border p-3 transition-all ${
                isCurrent
                  ? "border-[#0F9B6E]/40 bg-[#E1F5EE]/60 shadow-sm ring-1 ring-[#0F9B6E]/20"
                  : "border-slate-100 bg-white"
              }`}>
                {/* Card header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={`text-sm font-semibold ${isCurrent ? "text-[#085041]" : "text-slate-800"}`}>
                    {isCurrent ? "Current Visit" : label}
                  </span>
                  {entry.isFirstVisit && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-[#0F9B6E]/10 text-[#0F9B6E] border-[#0F9B6E]/30 border" variant="outline">
                      First Visit
                    </Badge>
                  )}
                  {isCurrent && !entry.isFirstVisit && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200 border" variant="outline">
                      {label}
                    </Badge>
                  )}
                </div>

                {/* 2×2 grid of data cells */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {/* ── Diagnosis ── */}
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400 shrink-0"><Stethoscope className="w-3 h-3" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">Diagnosis</p>
                      {dxSummary ? (
                        <p className="text-xs font-medium text-slate-700 leading-snug">{dxSummary}</p>
                      ) : (
                        <p className="text-xs text-slate-400">—</p>
                      )}
                      {entry.clinicalNotes && dxSummary && (
                        <p className="text-[10px] text-slate-400 italic mt-0.5 leading-snug line-clamp-1">
                          {entry.clinicalNotes}
                        </p>
                      )}
                      {dxSummary && (
                        isCurrent && onTabSwitch ? (
                          <button
                            onClick={() => onTabSwitch("diagnosis")}
                            className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-[#0F9B6E] hover:text-[#085041] font-medium transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            View Diagnosis
                          </button>
                        ) : hasPastDetail ? (
                          <button
                            onClick={() => togglePast(entry.bookingId)}
                            className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-slate-700 font-medium transition-colors"
                          >
                            {isPastExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            {isPastExpanded ? "Hide" : "Details"}
                          </button>
                        ) : null
                      )}
                    </div>
                  </div>

                  {/* ── Prescription ── */}
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400 shrink-0"><Pill className="w-3 h-3" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">Prescription</p>
                      {rxSummary ? (
                        <p className="text-xs font-medium text-slate-700 leading-snug">{rxSummary}</p>
                      ) : (
                        <p className="text-xs text-slate-400">—</p>
                      )}
                      {rxSummary && (
                        isCurrent && onTabSwitch ? (
                          <button
                            onClick={() => onTabSwitch("prescription")}
                            className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-[#0F9B6E] hover:text-[#085041] font-medium transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            View Rx
                          </button>
                        ) : !isCurrent && !hasPastDetail ? null : null
                      )}
                    </div>
                  </div>

                  {/* ── Treatment ── */}
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400 shrink-0"><RefreshCw className="w-3 h-3" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">Treatment</p>
                      {treatmentSummary ? (
                        <p className="text-xs font-medium text-slate-700 leading-snug line-clamp-2">{treatmentSummary}</p>
                      ) : (
                        <p className="text-xs text-slate-400">—</p>
                      )}
                    </div>
                  </div>

                  {/* ── Attachments ── */}
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400 shrink-0"><Paperclip className="w-3 h-3" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">Attachments</p>
                      <p className="text-xs font-medium text-slate-700 leading-snug">
                        {entry.attachmentCount > 0
                          ? `${entry.attachmentCount} File${entry.attachmentCount !== 1 ? "s" : ""}`
                          : entry.billServiceCount > 0
                            ? `${entry.billServiceCount} Service${entry.billServiceCount !== 1 ? "s" : ""} billed`
                            : <span className="text-slate-400">—</span>
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded past-visit detail */}
                {isPastExpanded && <PastVisitDetail entry={entry} />}

                {/* Completion note if present */}
                {entry.visitCompletionNote && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-start gap-1.5">
                    <FileText className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{entry.visitCompletionNote}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
