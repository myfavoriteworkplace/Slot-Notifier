import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Activity, Stethoscope, Pill, Paperclip, FileText, CheckCircle2, Clock, RefreshCw, AlertCircle, CalendarDays } from "lucide-react";
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
  attachmentCount: number;
  billServiceCount: number;
  isFirstVisit: boolean;
}

interface Props {
  bookingId: number;
  currentBookingId: number;
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

function DataCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-slate-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-xs font-medium text-slate-700 leading-snug">{value}</p>
      </div>
    </div>
  );
}

export default function VisitTimelineTab({ bookingId, currentBookingId }: Props) {
  const { data: timeline, isLoading, isError } = useQuery<VisitTimelineEntry[]>({
    queryKey: ["/api/doctor/bookings", bookingId, "visit-timeline"],
    queryFn: () => apiRequest("GET", `/api/doctor/bookings/${bookingId}/visit-timeline`).then(r => r.json()),
    staleTime: 60_000,
  });

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
                  <DataCell
                    icon={<Stethoscope className="w-3 h-3" />}
                    label="Diagnosis"
                    value={
                      entry.diagnosis.length > 0
                        ? entry.diagnosis.slice(0, 2).join(", ") + (entry.diagnosis.length > 2 ? ` +${entry.diagnosis.length - 2}` : "")
                        : <span className="text-slate-400">—</span>
                    }
                  />
                  <DataCell
                    icon={<Pill className="w-3 h-3" />}
                    label="Prescription"
                    value={
                      entry.medicationCount > 0
                        ? `${entry.medicationCount} Medicine${entry.medicationCount !== 1 ? "s" : ""}`
                        : <span className="text-slate-400">—</span>
                    }
                  />
                  <DataCell
                    icon={<RefreshCw className="w-3 h-3" />}
                    label="Treatment"
                    value={entry.treatmentCategory ?? <span className="text-slate-400">—</span>}
                  />
                  <DataCell
                    icon={<Paperclip className="w-3 h-3" />}
                    label="Attachments"
                    value={
                      entry.attachmentCount > 0
                        ? `${entry.attachmentCount} File${entry.attachmentCount !== 1 ? "s" : ""}`
                        : entry.billServiceCount > 0
                          ? `${entry.billServiceCount} Service${entry.billServiceCount !== 1 ? "s" : ""} billed`
                          : <span className="text-slate-400">—</span>
                    }
                  />
                </div>

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
