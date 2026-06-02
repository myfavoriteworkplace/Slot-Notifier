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

// ── Medicine row type (stored as JSON in the prescription TEXT column) ──
interface MedicineRow {
  name: string;
  dosage: string;
  qty: string;
  frequency: string;
  duration: string;
}

const FREQUENCY_OPTIONS = ['OD', 'BD', 'TID', 'QID', 'SOS', 'PRN'];
const emptyRow = (): MedicineRow => ({ name: '', dosage: '', qty: '', frequency: 'OD', duration: '' });

function parsePrescription(text: string | null | undefined): MedicineRow[] | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'name' in parsed[0]) {
      return parsed as MedicineRow[];
    }
    return null;
  } catch {
    return null;
  }
}

// ── Diagnosis tags ──
const DIAGNOSIS_TAGS = [
  "Caries", "Gingivitis", "Periodontitis", "Pulpitis", "Abscess",
  "Fracture", "Sensitivity", "Malocclusion", "Impaction", "TMJ",
  "Bruxism", "Dry Socket", "Oral Ulcer", "Calculus", "Recession",
];

// ── PDF export ──
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
      const colW = [60, 28, 20, 26, 28];
      const headers = ['Medicine', 'Dosage', 'Qty', 'Freq.', 'Duration'];
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 3, pageW - margin * 2, 7, "F");
      headers.forEach((h, i) => doc.text(h, margin + colW.slice(0, i).reduce((a, b) => a + b, 0), y + 1));
      y += 9;
      rows.forEach(r => {
        const cells = [r.name, r.dosage, r.qty, r.frequency, r.duration];
        cells.forEach((c, i) => doc.text(c || '—', margin + colW.slice(0, i).reduce((a, b) => a + b, 0), y));
        y += 7;
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

// ── Prescription display helper (used in record cards) ──
function PrescriptionDisplay({ prescription }: { prescription: string | null | undefined }) {
  const rows = parsePrescription(prescription);
  if (rows && rows.length > 0) {
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
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((r, i) => (
              <tr key={i} className="bg-background">
                <td className="px-2 py-1.5 font-medium text-foreground">{r.name || '—'}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.dosage || '—'}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.qty || '—'}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.frequency || '—'}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.duration || '—'}</td>
              </tr>
            ))}
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

// ── Props ──
interface ClinicalRecordsTabProps {
  bookingId: number;
  clinicId: number;
  patientName: string;
  patientPhone?: string | null;
  doctorName?: string | null;
  mode: "doctor" | "admin";
  clinicName?: string;
}

export default function ClinicalRecordsTab({
  bookingId, clinicId, patientName, patientPhone, doctorName, mode, clinicName,
}: ClinicalRecordsTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [diagnosisDraft, setDiagnosisDraft] = useState<string[]>([]);
  const [prescriptionRows, setPrescriptionRows] = useState<MedicineRow[]>([emptyRow()]);
  const [notesDraft, setNotesDraft] = useState("");
  const [doctorNameDraft, setDoctorNameDraft] = useState(doctorName || "");

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

  const prescriptionPayload = () => {
    const filled = prescriptionRows.filter(r => r.name.trim());
    return filled.length > 0 ? JSON.stringify(filled) : null;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clinical-records", {
        bookingId, clinicId, patientName,
        patientPhone: patientPhone || null,
        doctorName: doctorNameDraft || doctorName || null,
        diagnosis: diagnosisDraft,
        prescription: prescriptionPayload(),
        notes: notesDraft || null,
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { queryClient.refetchQueries({ queryKey }); notify.success("Record saved", { description: "Clinical record added successfully." }); resetForm(); },
    onError: (e: any) => notify.apiError(e, "Failed to save record"),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/clinical-records/${id}`, {
        doctorName: doctorNameDraft || doctorName || null,
        diagnosis: diagnosisDraft,
        prescription: prescriptionPayload(),
        notes: notesDraft || null,
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { queryClient.refetchQueries({ queryKey }); notify.success("Record updated"); resetForm(); },
    onError: (e: any) => notify.apiError(e, "Failed to update record"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/clinical-records/${id}`, {});
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
    },
    onSuccess: () => { queryClient.refetchQueries({ queryKey }); notify.success("Record deleted"); },
    onError: (e: any) => notify.apiError(e, "Failed to delete record"),
  });

  const resetForm = () => {
    setShowForm(false); setEditingId(null);
    setDiagnosisDraft([]); setPrescriptionRows([emptyRow()]);
    setNotesDraft(""); setDoctorNameDraft(doctorName || "");
  };

  const startEdit = (record: ClinicalRecord) => {
    setEditingId(record.id);
    setDiagnosisDraft(record.diagnosis || []);
    const rows = parsePrescription(record.prescription);
    setPrescriptionRows(rows ?? [emptyRow()]);
    setNotesDraft(record.notes || "");
    setDoctorNameDraft(record.doctorName || doctorName || "");
    setShowForm(true);
  };

  const toggleTag = (tag: string) =>
    setDiagnosisDraft(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const updateRow = (idx: number, field: keyof MedicineRow, value: string) =>
    setPrescriptionRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const addRow = () => setPrescriptionRows(prev => [...prev, emptyRow()]);

  const removeRow = (idx: number) =>
    setPrescriptionRows(prev => prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== idx));

  const latestRecord = records[0] ?? null;
  const historyRecords = records.slice(1);

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

  return (
    <div className="space-y-3">

      {/* ── Latest Record ── */}
      {latestRecord ? (
        <div className="rounded-xl border border-primary/25 bg-primary/3 overflow-hidden">
          <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="h-3 w-3 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Latest Record</span>
              <span className="text-xs text-primary/60 font-medium">
                {format(new Date(latestRecord.createdAt!), "MMM d, yyyy · h:mm a")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => generatePrescriptionPDF(latestRecord, clinicName)} data-testid="button-download-latest-pdf">
                <Download className="h-2.5 w-2.5" />PDF
              </Button>
              {mode === "doctor" && (
                <>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"
                    onClick={() => startEdit(latestRecord)} data-testid="button-edit-latest-record">
                    <Pencil className="h-2.5 w-2.5" />Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(latestRecord.id)} disabled={deleteMutation.isPending} data-testid="button-delete-latest-record">
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="px-3 py-2.5 space-y-2.5">
            {latestRecord.doctorName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Stethoscope className="h-3 w-3" />Dr. {latestRecord.doctorName}
              </p>
            )}
            {latestRecord.diagnosis && latestRecord.diagnosis.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Diagnosis</p>
                <div className="flex flex-wrap gap-1">
                  {latestRecord.diagnosis.map(d => (
                    <Badge key={d} variant="outline" className="text-xs px-2 py-0.5 rounded-full border-primary/30 bg-primary/8 text-primary font-semibold">{d}</Badge>
                  ))}
                </div>
              </div>
            )}
            {latestRecord.prescription && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Pill className="h-3 w-3" /> Prescription
                </p>
                <PrescriptionDisplay prescription={latestRecord.prescription} />
              </div>
            )}
            {latestRecord.notes && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Notes
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{latestRecord.notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
          <ClipboardList className="h-7 w-7 text-muted-foreground/30" />
          <p className="text-xs font-medium text-muted-foreground">No clinical records yet</p>
          {mode === "doctor" && (
            <p className="text-xs text-muted-foreground/70">Add the first record for this patient below</p>
          )}
        </div>
      )}

      {/* ── History ── */}
      {historyRecords.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              History ({historyRecords.length})
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {historyRecords.map(record => (
              <div key={record.id} className="px-3 py-2">
                <button
                  className="w-full flex items-center justify-between gap-2 text-left min-h-[36px]"
                  onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">
                      {format(new Date(record.createdAt!), "MMM d, yyyy")}
                    </span>
                    {record.diagnosis && record.diagnosis.length > 0 && (
                      <span className="text-xs text-primary/70 font-semibold">
                        {record.diagnosis.slice(0, 2).join(", ")}{record.diagnosis.length > 2 ? "…" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs gap-1 text-muted-foreground hover:text-primary"
                      onClick={e => { e.stopPropagation(); generatePrescriptionPDF(record, clinicName); }}>
                      <Download className="h-2.5 w-2.5" />
                    </Button>
                    {expandedId === record.id ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </button>
                {expandedId === record.id && (
                  <div className="mt-2 space-y-2 animate-in slide-in-from-top-1 duration-150">
                    {record.doctorName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Stethoscope className="h-2.5 w-2.5" />Dr. {record.doctorName}
                      </p>
                    )}
                    {record.diagnosis && record.diagnosis.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {record.diagnosis.map(d => (
                          <Badge key={d} variant="outline" className="text-xs px-1.5 py-0 rounded-full border-primary/20 bg-primary/5 text-primary">{d}</Badge>
                        ))}
                      </div>
                    )}
                    {record.prescription && <PrescriptionDisplay prescription={record.prescription} />}
                    {record.notes && <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{record.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add / Edit Form (doctor only) ── */}
      {mode === "doctor" && (
        <>
          {!showForm ? (
            <Button size="sm" variant="outline"
              className="w-full h-9 text-xs gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => { resetForm(); setShowForm(true); }}
              data-testid="button-add-clinical-record">
              <Plus className="h-3.5 w-3.5" />Add Clinical Record
            </Button>
          ) : (
            <div className="rounded-xl border border-primary/30 bg-primary/3 overflow-hidden animate-in slide-in-from-top-1 duration-200">
              <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center gap-1.5">
                <Plus className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {editingId ? "Edit Record" : "New Clinical Record"}
                </span>
              </div>
              <div className="px-3 py-3 space-y-4">

                {/* Doctor name */}
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doctor Name</Label>
                  <Input value={doctorNameDraft} onChange={e => setDoctorNameDraft(e.target.value)}
                    placeholder="e.g. Dr. Ananya Krishnan" className="h-8 text-xs mt-1" data-testid="input-doctor-name" />
                </div>

                {/* Diagnosis tags */}
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Diagnosis</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {DIAGNOSIS_TAGS.map(tag => (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-all ${
                          diagnosisDraft.includes(tag)
                            ? "bg-primary text-white border-primary"
                            : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary"
                        }`}
                        data-testid={`tag-diagnosis-${tag.toLowerCase()}`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prescription grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Pill className="h-3 w-3" /> Prescription
                    </Label>
                    <button type="button" onClick={addRow}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 active:text-primary/60 transition-colors"
                      data-testid="button-add-medicine-row">
                      <Plus className="h-3 w-3" /> Add medicine
                    </button>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_72px_56px_72px_72px_28px] gap-1 mb-1 px-0.5">
                    {['Medicine Name', 'Dosage', 'Qty', 'Frequency', 'Duration', ''].map((h, i) => (
                      <span key={i} className="text-xs font-semibold text-muted-foreground/70">{h}</span>
                    ))}
                  </div>

                  {/* Medicine rows */}
                  <div className="space-y-1.5">
                    {prescriptionRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_72px_56px_72px_72px_28px] gap-1 items-center"
                        data-testid={`medicine-row-${idx}`}>
                        <Input
                          value={row.name}
                          onChange={e => updateRow(idx, 'name', e.target.value)}
                          placeholder="e.g. Amoxicillin"
                          className="h-8 text-xs"
                          data-testid={`input-medicine-name-${idx}`}
                        />
                        <Input
                          value={row.dosage}
                          onChange={e => updateRow(idx, 'dosage', e.target.value)}
                          placeholder="500mg"
                          className="h-8 text-xs"
                          data-testid={`input-dosage-${idx}`}
                        />
                        <Input
                          value={row.qty}
                          onChange={e => updateRow(idx, 'qty', e.target.value)}
                          placeholder="1 tab"
                          className="h-8 text-xs"
                          data-testid={`input-qty-${idx}`}
                        />
                        <Select value={row.frequency} onValueChange={v => updateRow(idx, 'frequency', v)}>
                          <SelectTrigger className="h-8 text-xs" data-testid={`select-frequency-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCY_OPTIONS.map(f => (
                              <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={row.duration}
                          onChange={e => updateRow(idx, 'duration', e.target.value)}
                          placeholder="5 days"
                          className="h-8 text-xs"
                          data-testid={`input-duration-${idx}`}
                        />
                        <button type="button" onClick={() => removeRow(idx)}
                          className="flex items-center justify-center h-8 w-7 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors"
                          data-testid={`button-remove-row-${idx}`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Clinical Notes <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
                  </Label>
                  <textarea
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    placeholder="e.g. Patient requested cancellation"
                    className="w-full mt-1 min-h-[60px] resize-none rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid="textarea-clinical-notes"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 h-8 text-xs font-bold"
                    onClick={() => editingId ? updateMutation.mutate(editingId) : createMutation.mutate()}
                    disabled={createMutation.isPending || updateMutation.isPending || (diagnosisDraft.length === 0 && !prescriptionRows.some(r => r.name.trim()))}
                    data-testid="button-save-clinical-record">
                    {(createMutation.isPending || updateMutation.isPending)
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><CheckCircle2 className="h-3 w-3 mr-1" />{editingId ? "Update" : "Save Record"}</>}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetForm}>Cancel</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
