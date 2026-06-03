import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import {
  Loader2, Plus, Pencil, Trash2, Download, FileText, Stethoscope,
  ChevronDown, ChevronUp, ClipboardList, Pill, CheckCircle2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ClinicalRecord } from "@shared/schema";

// ─── Medicine row type (JSON-stored in prescription TEXT column) ──────────────

interface MedicineRow {
  name: string;
  dosage: string;
  qty: string;
  frequency: string;
  duration: string;
  durationNum?: string;
  durationUnit?: string;
  route?: string;
  remarks?: string;
}

const FREQUENCY_OPTIONS = ['OD', 'BD', 'TID', 'QID', 'SOS', 'PRN'];
const ROUTE_OPTIONS = ['Oral', 'Topical', 'IV', 'IM', 'Subcutaneous', 'Sublingual', 'Inhaled'];
const DURATION_UNITS = ['days', 'weeks', 'months'];

const emptyRow = (): MedicineRow => ({
  name: '', dosage: '', qty: '', frequency: 'OD',
  duration: '', durationNum: '', durationUnit: 'days',
  route: 'Oral', remarks: '',
});

function parseDuration(s: string): { durationNum: string; durationUnit: string } {
  if (!s) return { durationNum: '', durationUnit: 'days' };
  const trimmed = s.trim();
  const m = trimmed.match(/^(\d+)\s*(days?|weeks?|months?)$/i);
  if (m) {
    const raw = m[2].toLowerCase();
    const unit = raw.endsWith('s') ? raw : raw + 's';
    return { durationNum: m[1], durationUnit: unit };
  }
  if (/^\d+$/.test(trimmed)) return { durationNum: trimmed, durationUnit: 'days' };
  return { durationNum: '', durationUnit: 'days' };
}

function parsePrescription(text: string | null | undefined): MedicineRow[] | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'name' in parsed[0]) {
      return (parsed as any[]).map(r => {
        const { durationNum, durationUnit } = parseDuration(r.duration || '');
        return {
          name: r.name || '',
          dosage: r.dosage || '',
          qty: r.qty || '',
          frequency: r.frequency || 'OD',
          duration: r.duration || '',
          durationNum: r.durationNum ?? durationNum,
          durationUnit: r.durationUnit ?? durationUnit,
          route: r.route ?? 'Oral',
          remarks: r.remarks ?? '',
        } as MedicineRow;
      });
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Diagnosis tags ───────────────────────────────────────────────────────────

const DIAGNOSIS_TAGS = [
  "Caries", "Gingivitis", "Periodontitis", "Pulpitis", "Abscess",
  "Fracture", "Sensitivity", "Malocclusion", "Impaction", "TMJ",
  "Bruxism", "Dry Socket", "Oral Ulcer", "Calculus", "Recession",
];

// ─── PDF export ───────────────────────────────────────────────────────────────

function generatePrescriptionPDF(record: ClinicalRecord, clinicName?: string) {
  import("jspdf").then(({ default: jsPDF }) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    const hr = () => { doc.setDrawColor(200, 200, 200); doc.line(margin, y, pageW - margin, y); y += 6; };

    doc.setFillColor(8, 80, 65);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text(clinicName || "Clinic", margin, 16);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Clinical Record / Prescription", margin, 26);
    doc.text(`Date: ${format(new Date(record.createdAt!), "MMM d, yyyy")}`, margin, 34);

    y = 50;
    doc.setTextColor(30, 28, 60);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Patient Information", margin, y); y += 8; hr();
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Name: ${record.patientName}`, margin, y); y += 7;
    if (record.patientPhone) { doc.text(`Phone: ${record.patientPhone}`, margin, y); y += 7; }
    if (record.doctorName) { doc.text(`Attending Doctor: ${record.doctorName}`, margin, y); y += 7; }
    y += 4;

    if (record.diagnosis && record.diagnosis.length > 0) {
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Diagnosis", margin, y); y += 8; hr();
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(record.diagnosis.join(", "), margin, y, { maxWidth: pageW - margin * 2 });
      y += 14;
    }

    const rows = parsePrescription(record.prescription);
    if (rows && rows.length > 0) {
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Prescription", margin, y); y += 8; hr();
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const colW = [48, 22, 14, 22, 22, 22];
      const headers = ['Medicine', 'Dosage', 'Qty', 'Freq.', 'Duration', 'Route'];
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 3, pageW - margin * 2, 7, "F");
      headers.forEach((h, i) => doc.text(h, margin + colW.slice(0, i).reduce((a, b) => a + b, 0), y + 1));
      y += 9;
      rows.forEach(r => {
        const durStr = r.durationNum ? `${r.durationNum} ${r.durationUnit || 'days'}` : (r.duration || '—');
        const cells = [r.name, r.dosage, r.qty, r.frequency, durStr, r.route || 'Oral'];
        cells.forEach((c, i) => doc.text(c || '—', margin + colW.slice(0, i).reduce((a, b) => a + b, 0), y));
        y += 7;
        if (r.remarks) {
          doc.setFontSize(8); doc.setTextColor(120, 120, 120);
          doc.text(`  Remarks: ${r.remarks}`, margin + 2, y);
          doc.setTextColor(30, 28, 60); doc.setFontSize(9);
          y += 5;
        }
      });
      y += 4;
    } else if (record.prescription) {
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Prescription", margin, y); y += 8; hr();
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      const lines = doc.splitTextToSize(record.prescription, pageW - margin * 2);
      doc.text(lines, margin, y); y += lines.length * 6 + 8;
    }

    if (record.notes) {
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Clinical Notes", margin, y); y += 8; hr();
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      const lines = doc.splitTextToSize(record.notes, pageW - margin * 2);
      doc.text(lines, margin, y);
    }

    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text("Generated by BookMySlot · Confidential Medical Record", margin, doc.internal.pageSize.getHeight() - 10);
    doc.save(`prescription_${record.patientName.replace(/\s+/g, "_")}_${format(new Date(record.createdAt!), "yyyyMMdd")}.pdf`);
  });
}

// ─── Prescription table display ───────────────────────────────────────────────

function PrescriptionDisplay({ prescription }: { prescription: string | null | undefined }) {
  const rows = parsePrescription(prescription);
  if (rows && rows.length > 0) {
    const hasRoute = rows.some(r => r.route && r.route !== 'Oral');
    const hasRemarks = rows.some(r => r.remarks);
    return (
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border/40">
              <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Medicine</th>
              <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Dosage</th>
              <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Qty</th>
              <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Freq.</th>
              <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Duration</th>
              {hasRoute && <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Route</th>}
              {hasRemarks && <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Remarks</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((r, i) => {
              const durStr = r.durationNum ? `${r.durationNum} ${r.durationUnit || 'days'}` : (r.duration || '—');
              return (
                <tr key={i} className="bg-background">
                  <td className="px-2 py-1.5 font-medium text-foreground">{r.name || '—'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.dosage || '—'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.qty || '—'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.frequency || '—'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{durStr}</td>
                  {hasRoute && <td className="px-2 py-1.5 text-muted-foreground">{r.route || 'Oral'}</td>}
                  {hasRemarks && <td className="px-2 py-1.5 text-muted-foreground italic">{r.remarks || '—'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  if (prescription) {
    return <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{prescription}</p>;
  }
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClinicalRecordsTabProps {
  bookingId: number;
  clinicId: number;
  patientName: string;
  patientPhone?: string | null;
  doctorName?: string | null;
  mode: "doctor" | "admin";
  clinicName?: string;
}

// ─── History row (shared by both tabs) ───────────────────────────────────────

function HistoryRow({
  record,
  type,
  onEdit,
  onPdf,
  mode,
}: {
  record: ClinicalRecord;
  type: "diagnosis" | "prescription";
  onEdit?: () => void;
  onPdf: () => void;
  mode: "doctor" | "admin";
}) {
  const [expanded, setExpanded] = useState(false);

  const preview =
    type === "diagnosis"
      ? (record.diagnosis ?? []).slice(0, 2).join(", ") + ((record.diagnosis ?? []).length > 2 ? "…" : "")
      : (parsePrescription(record.prescription) ?? []).slice(0, 1).map(r => r.name).join("") || record.prescription?.slice(0, 30) || "";

  return (
    <div className="px-3 py-2">
      <button
        className="w-full flex items-center justify-between gap-2 text-left min-h-[32px]"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-muted-foreground font-medium shrink-0">
            {format(new Date(record.createdAt!), "MMM d, yyyy")}
          </span>
          {preview && (
            <span className="text-[10px] text-primary/70 font-semibold truncate">{preview}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost"
            className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-primary"
            onClick={e => { e.stopPropagation(); onPdf(); }}>
            <Download className="h-2.5 w-2.5" />
          </Button>
          {mode === "doctor" && onEdit && (
            <Button size="sm" variant="ghost"
              className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-primary"
              onClick={e => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-2.5 w-2.5" />
            </Button>
          )}
          {expanded
            ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
          {record.doctorName && (
            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Stethoscope className="h-2.5 w-2.5" /> Dr. {record.doctorName}
            </p>
          )}
          {type === "diagnosis" && record.diagnosis && record.diagnosis.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {record.diagnosis.map(d => (
                <Badge key={d} variant="outline"
                  className="text-[9px] px-1.5 py-0 rounded-full border-primary/20 bg-primary/5 text-primary">
                  {d}
                </Badge>
              ))}
            </div>
          )}
          {type === "prescription" && record.prescription && (
            <PrescriptionDisplay prescription={record.prescription} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClinicalRecordsTab({
  bookingId, clinicId, patientName, patientPhone, doctorName, mode, clinicName,
}: ClinicalRecordsTabProps) {
  const queryClient = useQueryClient();

  // ── Active tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"diagnosis" | "prescription">("diagnosis");

  // ── Diagnosis state ────────────────────────────────────────────────────────
  const [showDxForm, setShowDxForm] = useState(false);
  const [dxEditId, setDxEditId] = useState<number | null>(null);
  const [dxTags, setDxTags] = useState<string[]>([]);
  const [dxNotes, setDxNotes] = useState("");
  const [showDxHistory, setShowDxHistory] = useState(false);

  // ── Prescription state ─────────────────────────────────────────────────────
  const [showRxForm, setShowRxForm] = useState(false);
  const [rxEditId, setRxEditId] = useState<number | null>(null);
  const [rxRows, setRxRows] = useState<MedicineRow[]>([emptyRow()]);
  const [showRxHistory, setShowRxHistory] = useState(false);

  // ── Shared doctor name draft ───────────────────────────────────────────────
  const [doctorNameDraft, setDoctorNameDraft] = useState(doctorName || "");

  // ── Query ──────────────────────────────────────────────────────────────────
  const queryKey = ["/api/clinical-records/booking", bookingId];

  const { data: records = [], isLoading, error } = useQuery<ClinicalRecord[]>({
    queryKey,
    staleTime: 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clinical-records/booking/${bookingId}`);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.message || `Error ${res.status}`); }
      return res.json();
    },
  });

  // ── Derived record streams ─────────────────────────────────────────────────
  const dxRecords = records.filter(r => r.diagnosis && r.diagnosis.length > 0);
  const rxRecords = records.filter(r => !!r.prescription);
  const latestDx = dxRecords[0] ?? null;
  const historyDx = dxRecords.slice(1);
  const latestRx = rxRecords[0] ?? null;
  const historyRx = rxRecords.slice(1);

  // ── Prescription payload builder ───────────────────────────────────────────
  const rxPayload = () => {
    const filled = rxRows.filter(r => r.name.trim());
    if (filled.length === 0) return null;
    return JSON.stringify(filled.map(r => ({
      ...r,
      duration: r.durationNum ? `${r.durationNum} ${r.durationUnit || 'days'}` : (r.duration || ''),
    })));
  };

  // ── Create mutation ────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload: { diagnosis?: string[]; prescription?: string | null; notes?: string | null }) => {
      const res = await apiRequest("POST", "/api/clinical-records", {
        bookingId, clinicId, patientName,
        patientPhone: patientPhone || null,
        doctorName: doctorNameDraft || doctorName || null,
        diagnosis: payload.diagnosis ?? [],
        prescription: payload.prescription ?? null,
        notes: payload.notes ?? null,
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey });
      notify.success("Saved successfully");
      resetForms();
    },
    onError: (e: any) => notify.apiError(e, "Failed to save"),
  });

  // ── Update mutation ────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<{ diagnosis: string[]; prescription: string | null; notes: string | null; doctorName: string | null }> }) => {
      const res = await apiRequest("PATCH", `/api/clinical-records/${id}`, { ...payload, doctorName: doctorNameDraft || doctorName || null });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey });
      notify.success("Updated");
      resetForms();
    },
    onError: (e: any) => notify.apiError(e, "Failed to update"),
  });

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/clinical-records/${id}`, {});
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
    },
    onSuccess: () => { queryClient.refetchQueries({ queryKey }); notify.success("Deleted"); },
    onError: (e: any) => notify.apiError(e, "Failed to delete"),
  });

  // ── Reset all forms ────────────────────────────────────────────────────────
  const resetForms = () => {
    setShowDxForm(false); setDxEditId(null); setDxTags([]); setDxNotes("");
    setShowRxForm(false); setRxEditId(null); setRxRows([emptyRow()]);
    setDoctorNameDraft(doctorName || "");
  };

  // ── Start edit helpers ─────────────────────────────────────────────────────
  const startEditDx = (record: ClinicalRecord) => {
    resetForms();
    setDxEditId(record.id);
    setDxTags(record.diagnosis || []);
    setDxNotes(record.notes || "");
    setDoctorNameDraft(record.doctorName || doctorName || "");
    setShowDxForm(true);
  };
  const startEditRx = (record: ClinicalRecord) => {
    resetForms();
    setRxEditId(record.id);
    setRxRows(parsePrescription(record.prescription) ?? [emptyRow()]);
    setDoctorNameDraft(record.doctorName || doctorName || "");
    setShowRxForm(true);
  };

  // ── Tag toggle ─────────────────────────────────────────────────────────────
  const toggleTag = (tag: string) =>
    setDxTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  // ── Rx row helpers ─────────────────────────────────────────────────────────
  const updateRxRow = (idx: number, field: keyof MedicineRow, value: string) =>
    setRxRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  const addRxRow = () => setRxRows(prev => [...prev, emptyRow()]);
  const removeRxRow = (idx: number) =>
    setRxRows(prev => prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== idx));

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Loading / error ────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-2 py-6 text-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5">
      <p className="text-xs font-medium text-destructive">Failed to load records</p>
      <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex rounded-lg overflow-hidden border border-border/60 bg-muted/20 p-0.5 gap-0.5">
        {(["diagnosis", "prescription"] as const).map(tab => {
          const count = tab === "diagnosis" ? dxRecords.length : rxRecords.length;
          const Icon = tab === "diagnosis" ? ClipboardList : Pill;
          const label = tab === "diagnosis" ? "Diagnosis" : "Prescription";
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); resetForms(); }}
              data-testid={`tab-${tab}`}
              className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[11px] font-semibold transition-all ${
                active
                  ? "bg-white dark:bg-background shadow-sm text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
              {count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DIAGNOSIS TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "diagnosis" && (
        <div className="space-y-2.5 animate-in fade-in-0 slide-in-from-left-1 duration-150">

          {/* Latest Diagnosis */}
          {latestDx ? (
            <div className="rounded-xl border border-primary/25 bg-primary/[0.03] overflow-hidden">
              <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Latest Diagnosis</span>
                  <span className="text-[9px] text-primary/60 font-medium">
                    {format(new Date(latestDx.createdAt!), "MMM d, yyyy · h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline"
                    className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => generatePrescriptionPDF(latestDx, clinicName)}
                    data-testid="button-download-dx-pdf">
                    <Download className="h-2.5 w-2.5" /> PDF
                  </Button>
                  {mode === "doctor" && (
                    <>
                      <Button size="sm" variant="ghost"
                        className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                        onClick={() => startEditDx(latestDx)}
                        data-testid="button-edit-dx">
                        <Pencil className="h-2.5 w-2.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(latestDx.id)}
                        disabled={deleteMutation.isPending}
                        data-testid="button-delete-dx">
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="px-3 py-2.5 space-y-2">
                {latestDx.doctorName && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" /> Dr. {latestDx.doctorName}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {latestDx.diagnosis!.map(d => (
                    <Badge key={d} variant="outline"
                      className="text-[10px] px-2 py-0.5 rounded-full border-primary/30 bg-primary/8 text-primary font-semibold">
                      {d}
                    </Badge>
                  ))}
                </div>
                {latestDx.notes && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-line border-t border-border/30 pt-2">
                    {latestDx.notes}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
              <ClipboardList className="h-7 w-7 text-muted-foreground/30" />
              <p className="text-xs font-medium text-muted-foreground">No diagnosis recorded yet</p>
              {mode === "doctor" && <p className="text-[10px] text-muted-foreground/60">Use the button below to add one</p>}
            </div>
          )}

          {/* Add / Edit Diagnosis form */}
          {mode === "doctor" && (
            !showDxForm ? (
              <Button size="sm" variant="outline"
                className="w-full h-8 text-xs gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => { resetForms(); setShowDxForm(true); }}
                data-testid="button-add-diagnosis">
                <Plus className="h-3.5 w-3.5" />
                {dxEditId ? "Edit Diagnosis" : "Add Diagnosis"}
              </Button>
            ) : (
              <div className="rounded-xl border border-primary/30 bg-primary/[0.03] overflow-hidden animate-in slide-in-from-top-1 duration-200">
                <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {dxEditId ? "Edit Diagnosis" : "New Diagnosis"}
                    </span>
                  </div>
                  <button onClick={resetForms} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="px-3 py-3 space-y-3">

                  {/* Doctor name */}
                  <div>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Doctor Name</Label>
                    <Input value={doctorNameDraft} onChange={e => setDoctorNameDraft(e.target.value)}
                      placeholder="e.g. Dr. Ananya Krishnan" className="h-8 text-xs mt-1"
                      data-testid="input-dx-doctor-name" />
                  </div>

                  {/* Tag picker */}
                  <div>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Select diagnosis <span className="normal-case font-normal">(one or more)</span>
                    </Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {DIAGNOSIS_TAGS.map(tag => (
                        <button key={tag} type="button" onClick={() => toggleTag(tag)}
                          data-testid={`tag-diagnosis-${tag.toLowerCase()}`}
                          className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all ${
                            dxTags.includes(tag)
                              ? "bg-primary text-white border-primary"
                              : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary"
                          }`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected preview */}
                  {dxTags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border/30">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold mr-0.5">Selected:</span>
                      {dxTags.map(t => (
                        <Badge key={t} variant="outline"
                          className="text-[10px] px-2 py-0.5 rounded-full border-primary/30 bg-primary/8 text-primary font-semibold gap-1">
                          {t}
                          <button onClick={() => toggleTag(t)} className="hover:text-destructive ml-0.5">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Optional notes */}
                  <div>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Notes <span className="normal-case font-normal">(optional)</span>
                    </Label>
                    <textarea
                      value={dxNotes}
                      onChange={e => setDxNotes(e.target.value)}
                      placeholder="Additional observations…"
                      rows={2}
                      className="w-full mt-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      data-testid="textarea-dx-notes"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 h-8 text-xs font-bold"
                      onClick={() => {
                        if (dxEditId) updateMutation.mutate({ id: dxEditId, payload: { diagnosis: dxTags, notes: dxNotes || null } });
                        else createMutation.mutate({ diagnosis: dxTags, notes: dxNotes || null });
                      }}
                      disabled={isSaving || dxTags.length === 0}
                      data-testid="button-save-diagnosis">
                      {isSaving
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <><CheckCircle2 className="h-3 w-3 mr-1" />{dxEditId ? "Update" : "Save Diagnosis"}</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetForms}>Cancel</Button>
                  </div>
                </div>
              </div>
            )
          )}

          {/* History */}
          {historyDx.length > 0 && (
            <div>
              <button
                onClick={() => setShowDxHistory(v => !v)}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary font-medium w-full py-1 transition-colors"
                data-testid="button-toggle-dx-history">
                {showDxHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showDxHistory ? "Hide" : `Show ${historyDx.length} older`} diagnosis {historyDx.length === 1 ? "entry" : "entries"}
              </button>
              {showDxHistory && (
                <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden mt-1 divide-y divide-border/30 animate-in slide-in-from-top-1 duration-150">
                  {historyDx.map(record => (
                    <HistoryRow
                      key={record.id}
                      record={record}
                      type="diagnosis"
                      mode={mode}
                      onEdit={mode === "doctor" ? () => startEditDx(record) : undefined}
                      onPdf={() => generatePrescriptionPDF(record, clinicName)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PRESCRIPTION TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "prescription" && (
        <div className="space-y-2.5 animate-in fade-in-0 slide-in-from-right-1 duration-150">

          {/* Latest Prescription */}
          {latestRx ? (
            <div className="rounded-xl border border-primary/25 bg-primary/[0.03] overflow-hidden">
              <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Pill className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Latest Prescription</span>
                  <span className="text-[9px] text-primary/60 font-medium">
                    {format(new Date(latestRx.createdAt!), "MMM d, yyyy · h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline"
                    className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => generatePrescriptionPDF(latestRx, clinicName)}
                    data-testid="button-download-rx-pdf">
                    <Download className="h-2.5 w-2.5" /> PDF
                  </Button>
                  {mode === "doctor" && (
                    <>
                      <Button size="sm" variant="ghost"
                        className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                        onClick={() => startEditRx(latestRx)}
                        data-testid="button-edit-rx">
                        <Pencil className="h-2.5 w-2.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(latestRx.id)}
                        disabled={deleteMutation.isPending}
                        data-testid="button-delete-rx">
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="px-3 py-2.5 space-y-2">
                {latestRx.doctorName && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" /> Dr. {latestRx.doctorName}
                  </p>
                )}
                <PrescriptionDisplay prescription={latestRx.prescription} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
              <Pill className="h-7 w-7 text-muted-foreground/30" />
              <p className="text-xs font-medium text-muted-foreground">No prescription recorded yet</p>
              {mode === "doctor" && <p className="text-[10px] text-muted-foreground/60">Use the button below to add one</p>}
            </div>
          )}

          {/* Add / Edit Prescription form */}
          {mode === "doctor" && (
            !showRxForm ? (
              <Button size="sm" variant="outline"
                className="w-full h-8 text-xs gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => { resetForms(); setShowRxForm(true); }}
                data-testid="button-add-prescription">
                <Plus className="h-3.5 w-3.5" />
                {rxEditId ? "Edit Prescription" : "Add Prescription"}
              </Button>
            ) : (
              <div className="rounded-xl border border-primary/30 bg-primary/[0.03] overflow-hidden animate-in slide-in-from-top-1 duration-200">
                <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Pill className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {rxEditId ? "Edit Prescription" : "New Prescription"}
                    </span>
                  </div>
                  <button onClick={resetForms} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="px-3 py-3 space-y-3">

                  {/* Doctor name */}
                  <div>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Doctor Name</Label>
                    <Input value={doctorNameDraft} onChange={e => setDoctorNameDraft(e.target.value)}
                      placeholder="e.g. Dr. Ananya Krishnan" className="h-8 text-xs mt-1"
                      data-testid="input-rx-doctor-name" />
                  </div>

                  {/* Medicine rows */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Pill className="h-3 w-3" /> Medicines
                      </Label>
                      <button type="button" onClick={addRxRow}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                        data-testid="button-add-medicine-row">
                        <Plus className="h-3 w-3" /> Add medicine
                      </button>
                    </div>

                    <div className="space-y-2">
                      {rxRows.map((row, idx) => (
                        <div key={idx}
                          className="rounded-lg border border-border/40 bg-muted/5 p-2 space-y-1.5"
                          data-testid={`medicine-row-${idx}`}>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-muted-foreground/50">#{idx + 1}</span>
                            <button type="button" onClick={() => removeRxRow(idx)}
                              className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              data-testid={`button-remove-row-${idx}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Medicine name + Dosage */}
                          <div className="grid grid-cols-[1fr_72px] gap-1.5">
                            <Input value={row.name} onChange={e => updateRxRow(idx, 'name', e.target.value)}
                              placeholder="Medicine name (e.g. Amoxicillin)"
                              className="h-8 text-xs" data-testid={`input-medicine-name-${idx}`} />
                            <Input value={row.dosage} onChange={e => updateRxRow(idx, 'dosage', e.target.value)}
                              placeholder="Dosage" className="h-8 text-xs" data-testid={`input-dosage-${idx}`} />
                          </div>

                          {/* Qty + Frequency + Duration num + Duration unit */}
                          <div className="grid grid-cols-[48px_72px_44px_72px] gap-1.5">
                            <Input value={row.qty} onChange={e => updateRxRow(idx, 'qty', e.target.value)}
                              placeholder="Qty" className="h-8 text-xs" data-testid={`input-qty-${idx}`} />
                            <Select value={row.frequency} onValueChange={v => updateRxRow(idx, 'frequency', v)}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-frequency-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input type="number" min="1" value={row.durationNum ?? ''}
                              onChange={e => updateRxRow(idx, 'durationNum', e.target.value)}
                              placeholder="#" className="h-8 text-xs" data-testid={`input-duration-num-${idx}`} />
                            <Select value={row.durationUnit ?? 'days'} onValueChange={v => updateRxRow(idx, 'durationUnit', v)}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-duration-unit-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DURATION_UNITS.map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Route + Remarks */}
                          <div className="grid grid-cols-[88px_1fr] gap-1.5">
                            <Select value={row.route ?? 'Oral'} onValueChange={v => updateRxRow(idx, 'route', v)}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-route-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROUTE_OPTIONS.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input value={row.remarks ?? ''} onChange={e => updateRxRow(idx, 'remarks', e.target.value)}
                              placeholder="Remarks (e.g. After food)" className="h-8 text-xs"
                              data-testid={`input-remarks-${idx}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 h-8 text-xs font-bold"
                      onClick={() => {
                        const payload = rxPayload();
                        if (rxEditId) updateMutation.mutate({ id: rxEditId, payload: { prescription: payload } });
                        else createMutation.mutate({ prescription: payload });
                      }}
                      disabled={isSaving || !rxRows.some(r => r.name.trim())}
                      data-testid="button-save-prescription">
                      {isSaving
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <><CheckCircle2 className="h-3 w-3 mr-1" />{rxEditId ? "Update" : "Save Prescription"}</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetForms}>Cancel</Button>
                  </div>
                </div>
              </div>
            )
          )}

          {/* History */}
          {historyRx.length > 0 && (
            <div>
              <button
                onClick={() => setShowRxHistory(v => !v)}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary font-medium w-full py-1 transition-colors"
                data-testid="button-toggle-rx-history">
                {showRxHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showRxHistory ? "Hide" : `Show ${historyRx.length} older`} prescription {historyRx.length === 1 ? "entry" : "entries"}
              </button>
              {showRxHistory && (
                <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden mt-1 divide-y divide-border/30 animate-in slide-in-from-top-1 duration-150">
                  {historyRx.map(record => (
                    <HistoryRow
                      key={record.id}
                      record={record}
                      type="prescription"
                      mode={mode}
                      onEdit={mode === "doctor" ? () => startEditRx(record) : undefined}
                      onPdf={() => generatePrescriptionPDF(record, clinicName)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
