import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import {
  Loader2, Plus, Pencil, Trash2, Download, FileText, Stethoscope,
  ChevronDown, ChevronUp, ClipboardList, Pill, CheckCircle2, X, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ClinicalRecord, PharmacyStockItem } from "@shared/schema";

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

// ─── PDF export (disabled — jsPDF unavailable) ─────────────────────────────────

function generatePrescriptionPDF(record: ClinicalRecord, clinicName?: string) {
  // eslint-disable-next-line no-console
  console.warn("PDF export disabled — jspdf is not installed");
  return;
}

// ─── Original PDF export (BookMySlot brand template) — disabled ─────────────
/*
function _generatePrescriptionPDF(record: ClinicalRecord, clinicName?: string) {
  Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]).then(([{ default: jsPDF }, { default: autoTable }]) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ── Colour palette (matches docs/pdf-template.md) ─────────────
    const indigoDark: [number, number, number] = [8, 80, 65];
    const magenta: [number, number, number] = [29, 158, 117];
    const indigoMid: [number, number, number] = [15, 155, 110];
    const lightBg: [number, number, number] = [225, 245, 238];
    const metaBg: [number, number, number] = [209, 237, 226];
    const textDark: [number, number, number] = [8, 40, 32];
    const textMid: [number, number, number] = [50, 100, 80];
    const textLight: [number, number, number] = [150, 148, 180];
    const white: [number, number, number] = [255, 255, 255];

    // ── §3.1 Top Gradient Bar ─────────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, 0, pageW * 0.55, 7, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageW * 0.55, 0, pageW * 0.45, 7, "F");

    // ── §3.2 Clinic Header ────────────────────────────────────────
    const cs = 4.5, cw = 1.4;
    doc.setFillColor(...indigoMid);
    doc.rect(margin + (cs - cw) / 2, 12, cw, cs, "F");
    doc.rect(margin, 12 + (cs - cw) / 2, cs, cw, "F");

    const nameX = margin + cs + 3;
    doc.setFontSize(19); doc.setFont("helvetica", "bold"); doc.setTextColor(...textDark);
    doc.text(clinicName || "Clinic", nameX, 20);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...indigoMid);
    doc.text("Caring for Your Smile", nameX, 27);

    const docType = (record.prescription && record.prescription.length > 0)
      ? "Prescription" : "Diagnosis Record";
    doc.setFontSize(7.5); doc.setTextColor(...textMid);
    doc.text(docType, pageW - margin, 15, { align: "right" });
    doc.text(`Date: ${format(new Date(record.createdAt!), "MMM d, yyyy")}`, pageW - margin, 20, { align: "right" });

    doc.setDrawColor(...indigoDark); doc.setLineWidth(0.5);
    doc.line(margin, 33, pageW - margin, 33);

    // ── §3.3 Meta Band ────────────────────────────────────────────
    const metaY = 34;
    doc.setFillColor(...metaBg);
    doc.rect(margin, metaY, pageW - margin * 2, 17, "F");

    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
    doc.text(`Ref #: ${String(record.bookingId || "—").padStart(4, "0")}`, margin + 3, metaY + 5.5);

    if (record.doctorName) {
      doc.text(`Dr. ${record.doctorName}`, pageW / 2, metaY + 5.5, { align: "center" });
    }

    doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoDark);
    doc.text(
      format(new Date(record.createdAt!), "MMM d, yyyy · h:mm a"),
      pageW - margin - 3, metaY + 5.5, { align: "right" }
    );

    doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
    doc.text("Type:", margin + 3, metaY + 12.5);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoDark);
    doc.text(docType, margin + 16, metaY + 12.5);

    // ── §3.4 Patient Information Table ────────────────────────────
    const patientRows: [string, string][] = [
      ["Name", record.patientName || "—"],
      ["Phone", record.patientPhone || "—"],
    ];
    if (record.doctorName) patientRows.push(["Attending Doctor", `Dr. ${record.doctorName}`]);
    patientRows.push(["Record Date", format(new Date(record.createdAt!), "MMMM d, yyyy · h:mm a")]);

    autoTable(doc, {
      startY: metaY + 17 + 5,
      head: [["Patient Information", ""]],
      body: patientRows,
      theme: "grid",
      headStyles: { fillColor: indigoDark, textColor: white, fontSize: 9, fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 48, fillColor: lightBg, textColor: textMid, fontSize: 8 },
        1: { textColor: textMid, fontSize: 8 },
      },
      styles: { cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      margin: { left: margin, right: margin },
    });
    let currentY = (doc as any).lastAutoTable.finalY + 6;

    // ── §3.5-ish Diagnosis Table ──────────────────────────────────
    if (record.diagnosis && record.diagnosis.length > 0) {
      const dxBody: [string, string][] = [
        ["Findings", record.diagnosis.join(" · ")],
      ];
      if (record.notes) dxBody.push(["Notes", record.notes]);

      autoTable(doc, {
        startY: currentY,
        head: [["Diagnosis", ""]],
        body: dxBody,
        theme: "grid",
        headStyles: { fillColor: indigoDark, textColor: white, fontSize: 9, fontStyle: "bold" },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 48, fillColor: lightBg, textColor: textMid, fontSize: 8 },
          1: { textColor: textMid, fontSize: 8 },
        },
        styles: { cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── §3.5 Prescription Summary Table ──────────────────────────
    const rxRows = parsePrescription(record.prescription);
    if (rxRows && rxRows.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [["Medicine", "Dosage", "Qty", "Freq.", "Duration", "Route"]],
        body: rxRows.map(r => [
          r.name || "—",
          r.dosage || "—",
          r.qty || "—",
          r.frequency || "—",
          r.durationNum ? `${r.durationNum} ${r.durationUnit || "days"}` : (r.duration || "—"),
          r.route || "Oral",
        ]),
        theme: "grid",
        headStyles: { fillColor: indigoDark, textColor: white, fontSize: 9, fontStyle: "bold" },
        columnStyles: {
          0: { textColor: textDark, fontSize: 8 },
          1: { textColor: textMid, fontSize: 8, cellWidth: 24 },
          2: { textColor: textMid, fontSize: 8, cellWidth: 14, halign: "center" },
          3: { textColor: textMid, fontSize: 8, cellWidth: 16, halign: "center" },
          4: { textColor: textMid, fontSize: 8, cellWidth: 20, halign: "center" },
          5: { textColor: textMid, fontSize: 8, cellWidth: 22 },
        },
        alternateRowStyles: { fillColor: [240, 250, 246] as [number, number, number] },
        styles: { cellPadding: { top: 2, bottom: 2, left: 4, right: 4 } },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 6;
    } else if (record.prescription) {
      autoTable(doc, {
        startY: currentY,
        head: [["Prescription", ""]],
        body: [["Notes", record.prescription]],
        theme: "grid",
        headStyles: { fillColor: indigoDark, textColor: white, fontSize: 9, fontStyle: "bold" },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 48, fillColor: lightBg, textColor: textMid, fontSize: 8 },
          1: { textColor: textMid, fontSize: 8 },
        },
        styles: { cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── §3.9 Thank-You Footer ─────────────────────────────────────
    const footerY = pageH - 20;
    doc.setDrawColor(...indigoMid); doc.setLineWidth(0.4);
    doc.line(margin, footerY, pageW - margin, footerY);
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoMid);
    doc.text(`Thank you for choosing ${clinicName || "us"}!`, pageW / 2, footerY + 6, { align: "center" });
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textLight);
    doc.text("This is a computer generated clinical record. Generated by BookMySlot.", pageW / 2, footerY + 11, { align: "center" });

    // ── §3.10 Bottom Gradient Bar ─────────────────────────────────
    doc.setFillColor(...indigoDark);
    doc.rect(0, pageH - 8, pageW * 0.55, 8, "F");
    doc.setFillColor(...magenta);
    doc.rect(pageW * 0.55, pageH - 8, pageW * 0.45, 8, "F");
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...white);
    doc.text("Powered by BookMySlot", pageW / 2, pageH - 3, { align: "center" });

    // ── Save ──────────────────────────────────────────────────────
    const safeName = record.patientName.replace(/\s+/g, "_");
    const dateStr = format(new Date(record.createdAt!), "yyyyMMdd");
    doc.save(`clinical_record_${safeName}_${dateStr}.pdf`);
  });
}
*/

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

// ─── Medicine autocomplete combobox ───────────────────────────────────────────

function MedicineCombobox({
  value, onChange, onSelect, catalogue, idx,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (name: string, dosage: string) => void;
  catalogue: PharmacyStockItem[];
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });

  const matches = catalogue.filter(i =>
    !value.trim() ||
    i.medicineName.toLowerCase().includes(value.toLowerCase()) ||
    (i.dosage || "").toLowerCase().includes(value.toLowerCase())
  ).slice(0, 8);

  const updatePos = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 240) });
  };

  const isExpired = (item: PharmacyStockItem) => {
    if (!item.expiryDate) return false;
    try { return new Date(item.expiryDate) < new Date(); } catch { return false; }
  };

  return (
    <>
      <Input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { updatePos(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Medicine name"
        className="h-7 text-xs px-2"
        autoComplete="off"
        data-testid={`input-medicine-name-${idx}`}
      />
      {open && catalogue.length > 0 && matches.length > 0 && createPortal(
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-popover border border-border/60 rounded-lg shadow-xl overflow-hidden py-0.5"
        >
          {matches.map(item => {
            const expired = isExpired(item);
            const oos = !expired && item.availableQty === 0;
            const low = !expired && !oos && item.availableQty <= 5;
            return (
              <button
                key={item.id}
                type="button"
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/60 transition-colors gap-2"
                onMouseDown={e => {
                  e.preventDefault();
                  onSelect(item.medicineName, item.dosage || "");
                  setOpen(false);
                }}
              >
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground truncate leading-tight">{item.medicineName}</span>
                  {item.dosage && (
                    <span className="text-xs text-muted-foreground leading-none mt-0.5">{item.dosage}</span>
                  )}
                </div>
                <span className={`text-xs shrink-0 px-1.5 py-0.5 rounded-full font-semibold leading-none whitespace-nowrap ${
                  expired ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                  : oos    ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                  : low    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                           : "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400"
                }`}>
                  {expired ? "Expired"
                   : oos   ? "Out of stock"
                   : low   ? `Low (${item.availableQty})`
                           : `In stock (${item.availableQty})`}
                </span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
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
  /** When true the internal tab bar is hidden — caller controls which tab is shown via defaultTab */
  hideTabBar?: boolean;
  /** Initial (or forced, when hideTabBar=true) active tab */
  defaultTab?: "diagnosis" | "prescription";
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
        className="w-full flex items-center justify-between gap-2 text-left min-h-[44px]"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            {format(new Date(record.createdAt!), "MMM d, yyyy")}
          </span>
          {preview && (
            <span className="text-xs text-primary/70 font-semibold truncate">{preview}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
            onClick={e => { e.stopPropagation(); onPdf(); }}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          {mode === "doctor" && onEdit && (
            <Button size="sm" variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
              onClick={e => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3.5 w-3.5" />
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
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Stethoscope className="h-3 w-3" /> Dr. {record.doctorName}
            </p>
          )}
          {type === "diagnosis" && record.diagnosis && record.diagnosis.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {record.diagnosis.map(d => (
                <Badge key={d} variant="outline"
                  className="text-xs px-1.5 py-0 rounded-full border-primary/20 bg-primary/5 text-primary">
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
  hideTabBar = false,
  defaultTab = "diagnosis",
}: ClinicalRecordsTabProps) {
  const queryClient = useQueryClient();

  // ── Active tab — driven from outside when hideTabBar is true ───────────────
  const [activeTab, setActiveTab] = useState<"diagnosis" | "prescription">(defaultTab);
  const visibleTab = hideTabBar ? defaultTab : activeTab;

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


  // ── Pharmacy catalogue (doctor mode only) — loaded once, used for autocomplete ──
  const { data: pharmacyCatalogue = [] } = useQuery<PharmacyStockItem[]>({
    queryKey: ["/api/doctor/clinic", clinicId, "pharmacy"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/doctor/clinic/${clinicId}/pharmacy`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: mode === "doctor" && !!clinicId,
  });

  // ── Stock warning helper — looks up catalogue by exact medicine name ────────
  const getStockWarning = (name: string): { type: "oos" | "low" | "expired"; qty: number } | null => {
    if (!name.trim() || pharmacyCatalogue.length === 0) return null;
    const match = pharmacyCatalogue.find(
      i => i.medicineName.toLowerCase() === name.toLowerCase()
    );
    if (!match) return null;
    const expired = match.expiryDate && new Date(match.expiryDate) < new Date();
    if (expired) return { type: "expired", qty: match.availableQty };
    if (match.availableQty === 0) return { type: "oos", qty: 0 };
    if (match.availableQty <= 5) return { type: "low", qty: match.availableQty };
    return null;
  };

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
        doctorName: doctorName || null,
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
      const res = await apiRequest("PATCH", `/api/clinical-records/${id}`, { ...payload, doctorName: doctorName || null });
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
  };

  // ── Start edit helpers ─────────────────────────────────────────────────────
  const startEditDx = (record: ClinicalRecord) => {
    resetForms();
    setDxEditId(record.id);
    setDxTags(record.diagnosis || []);
    setDxNotes(record.notes || "");
    setShowDxForm(true);
  };
  const startEditRx = (record: ClinicalRecord) => {
    resetForms();
    setRxEditId(record.id);
    setRxRows(parsePrescription(record.prescription) ?? [emptyRow()]);
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
    <div className="space-y-3">
      <div className="flex rounded-lg overflow-hidden border border-border/60 bg-muted/20 p-0.5 gap-0.5">
        <Skeleton className="flex-1 h-8 rounded-md" />
        <Skeleton className="flex-1 h-8 rounded-md" />
      </div>
      {[1, 2].map(i => (
        <div key={i} className="rounded-xl border border-border/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-2 py-6 text-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5">
      <p className="text-xs font-medium text-destructive">Failed to load records</p>
      <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
    </div>
  );

  // ── Inline tab bar (hidden when parent controls the tab) ──────────────────
  const TabBar = !hideTabBar ? (
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
            className={`flex-1 flex items-center justify-center gap-1.5 min-h-[44px] rounded-md text-xs font-semibold transition-all ${
              active
                ? "bg-white dark:bg-background shadow-sm text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none ${
                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {TabBar}

      {/* ══════════════════════════════════════════════════════════════════
          DIAGNOSIS TAB
      ══════════════════════════════════════════════════════════════════ */}
      {visibleTab === "diagnosis" && (
        <div className="space-y-2.5 animate-in fade-in-0 slide-in-from-left-1 duration-150">

          {/* ── Add / Edit form — floats on top when open ── */}
          {mode === "doctor" && showDxForm && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.03] overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="h-3 w-3 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {dxEditId ? "Edit Diagnosis" : "New Diagnosis"}
                  </span>
                </div>
                <button onClick={resetForms} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="px-3 py-3 space-y-3">

                {/* Tag picker */}
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Select diagnosis <span className="normal-case font-normal">(one or more)</span>
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {DIAGNOSIS_TAGS.map(tag => (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}
                        data-testid={`tag-diagnosis-${tag.toLowerCase()}`}
                        className={`text-xs px-2.5 py-1.5 rounded-full border font-semibold transition-all active:scale-95 ${
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
                    <span className="text-xs text-muted-foreground uppercase font-semibold mr-0.5">Selected:</span>
                    {dxTags.map(t => (
                      <Badge key={t} variant="outline"
                        className="text-xs px-2 py-0.5 rounded-full border-primary/30 bg-primary/8 text-primary font-semibold gap-1">
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
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
          )}

          {/* ── Add button (shown when form is closed) ── */}
          {mode === "doctor" && !showDxForm && (
            <Button size="sm" variant="outline"
              className="w-full h-8 text-xs gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => { resetForms(); setShowDxForm(true); }}
              data-testid="button-add-diagnosis">
              <Plus className="h-3.5 w-3.5" />
              {dxEditId ? "Edit Diagnosis" : "Add Diagnosis"}
            </Button>
          )}

          {/* Latest Diagnosis */}
          {latestDx && !(showDxForm && dxEditId === latestDx.id) ? (
            <div className="rounded-xl border border-primary/25 bg-primary/[0.03] overflow-hidden">
              <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="h-3 w-3 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Diagnosis</span>
                  <span className="text-xs text-muted-foreground/60 font-medium">
                    {format(new Date(latestDx.createdAt!), "MMM d, yyyy · h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline"
                    className="h-8 w-8 p-0 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => generatePrescriptionPDF(latestDx, clinicName)}
                    data-testid="button-download-dx-pdf">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {mode === "doctor" && (
                    <>
                      <Button size="sm" variant="ghost"
                        className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-primary"
                        onClick={() => startEditDx(latestDx)}
                        data-testid="button-edit-dx">
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(latestDx.id)}
                        disabled={deleteMutation.isPending}
                        data-testid="button-delete-dx">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="px-3 py-2.5 space-y-2">
                {latestDx.doctorName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" /> Dr. {latestDx.doctorName}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {latestDx.diagnosis!.map(d => (
                    <Badge key={d} variant="outline"
                      className="text-xs px-2 py-0.5 rounded-full border-primary/30 bg-primary/8 text-primary font-semibold">
                      {d}
                    </Badge>
                  ))}
                </div>
                {latestDx.notes && (
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line border-t border-border/30 pt-2">
                    {latestDx.notes}
                  </p>
                )}
              </div>
            </div>
          ) : (
            !showDxForm && (
              <div className="flex flex-col items-center gap-2 py-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
                <ClipboardList className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs font-medium text-muted-foreground">No diagnosis recorded yet</p>
                {mode === "doctor" && <p className="text-xs text-muted-foreground/60">Use the button above to add one</p>}
              </div>
            )
          )}

          {/* History */}
          {historyDx.length > 0 && (
            <div>
              <button
                onClick={() => setShowDxHistory(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-medium w-full py-1.5 min-h-[44px] transition-colors"
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
      {visibleTab === "prescription" && (
        <div className="space-y-2.5 animate-in fade-in-0 slide-in-from-right-1 duration-150">

          {/* ── Add / Edit form — floats on top when open ── */}
          {mode === "doctor" && showRxForm && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.03] overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Pill className="h-3 w-3 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {rxEditId ? "Edit Prescription" : "New Prescription"}
                  </span>
                </div>
                <button onClick={resetForms} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="px-3 py-3 space-y-3">

                {/* ── Compact prescription grid ─────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Pill className="h-3 w-3" /> Medicines
                    </Label>
                  </div>

                  {/* Column headers */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[560px]">
                      <div className="grid gap-x-1 mb-1 px-1" style={{ gridTemplateColumns: "1fr 62px 40px 58px 40px 66px 70px 22px" }}>
                        {["Medicine", "Dosage", "Qty", "Freq", "Dur.", "Unit", "Route", ""].map((h, i) => (
                          <span key={i} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 truncate">{h}</span>
                        ))}
                      </div>

                      {/* Medicine rows */}
                      <div className="space-y-1">
                        {rxRows.map((row, idx) => {
                          const stockWarn = mode === "doctor" ? getStockWarning(row.name) : null;
                          return (
                          <div key={idx} className="space-y-0.5" data-testid={`medicine-row-${idx}`}>
                            <div
                              className="grid gap-x-1 items-center"
                              style={{ gridTemplateColumns: "1fr 62px 40px 58px 40px 66px 70px 22px" }}>

                            {mode === "doctor" ? (
                              <MedicineCombobox
                                value={row.name}
                                onChange={v => updateRxRow(idx, "name", v)}
                                onSelect={(name, dosage) => {
                                  setRxRows(prev => prev.map((r, i) => {
                                    if (i !== idx) return r;
                                    return { ...r, name, dosage: dosage || r.dosage, qty: r.qty || '1' };
                                  }));
                                }}
                                catalogue={pharmacyCatalogue}
                                idx={idx}
                              />
                            ) : (
                              <Input value={row.name} onChange={e => updateRxRow(idx, "name", e.target.value)}
                                placeholder="Medicine name"
                                className="h-7 text-xs px-2" data-testid={`input-medicine-name-${idx}`} />
                            )}

                            <Input value={row.dosage} onChange={e => updateRxRow(idx, 'dosage', e.target.value)}
                              placeholder="500mg" className="h-7 text-xs px-2" data-testid={`input-dosage-${idx}`} />

                            <Input value={row.qty} onChange={e => updateRxRow(idx, 'qty', e.target.value)}
                              placeholder="Qty" className="h-7 text-xs px-1.5" data-testid={`input-qty-${idx}`} />

                            <Select value={row.frequency} onValueChange={v => updateRxRow(idx, 'frequency', v)}>
                              <SelectTrigger className="h-7 text-xs px-1.5" data-testid={`select-frequency-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                              </SelectContent>
                            </Select>

                            <Input type="number" min="1" value={row.durationNum ?? ''}
                              onChange={e => updateRxRow(idx, 'durationNum', e.target.value)}
                              placeholder="#" className="h-7 text-xs px-1.5" data-testid={`input-duration-num-${idx}`} />

                            <Select value={row.durationUnit ?? 'days'} onValueChange={v => updateRxRow(idx, 'durationUnit', v)}>
                              <SelectTrigger className="h-7 text-xs px-1.5" data-testid={`select-duration-unit-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DURATION_UNITS.map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}
                              </SelectContent>
                            </Select>

                            <Select value={row.route ?? 'Oral'} onValueChange={v => updateRxRow(idx, 'route', v)}>
                              <SelectTrigger className="h-7 text-xs px-1.5" data-testid={`select-route-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROUTE_OPTIONS.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                              </SelectContent>
                            </Select>

                            <button type="button" onClick={() => removeRxRow(idx)}
                              className="flex items-center justify-center h-7 w-full rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              data-testid={`button-remove-row-${idx}`}>
                              <X className="h-3 w-3" />
                            </button>
                            </div>{/* end inner grid row */}
                            {stockWarn && (
                              <div className="flex items-center gap-1 text-xs pl-1 leading-none">
                                <AlertTriangle className={`h-3 w-3 shrink-0 ${stockWarn.type === "low" ? "text-amber-500" : "text-red-500"}`} />
                                <span className={stockWarn.type === "low" ? "text-amber-500" : "text-red-500"}>
                                  {stockWarn.type === "expired" ? "Expired — do not dispense"
                                   : stockWarn.type === "oos"   ? "Out of stock at this clinic"
                                                                : `Low stock — only ${stockWarn.qty} left`}
                                </span>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>

                      {/* Add medicine row link */}
                      <button type="button" onClick={addRxRow}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors min-h-[44px]"
                        data-testid="button-add-medicine-row">
                        <Plus className="h-3 w-3" /> Add medicine
                      </button>
                    </div>
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
          )}

          {/* ── Add button (shown when form is closed) ── */}
          {mode === "doctor" && !showRxForm && (
            <Button size="sm" variant="outline"
              className="w-full h-8 text-xs gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => { resetForms(); setShowRxForm(true); }}
              data-testid="button-add-prescription">
              <Plus className="h-3.5 w-3.5" />
              {rxEditId ? "Edit Prescription" : "Add Prescription"}
            </Button>
          )}

          {/* Latest Prescription */}
          {latestRx && !(showRxForm && rxEditId === latestRx.id) ? (
            <div className="rounded-xl border border-primary/25 bg-primary/[0.03] overflow-hidden">
              <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Pill className="h-3 w-3 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Prescription</span>
                  <span className="text-xs text-muted-foreground/60 font-medium">
                    {format(new Date(latestRx.createdAt!), "MMM d, yyyy · h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline"
                    className="h-8 w-8 p-0 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => generatePrescriptionPDF(latestRx, clinicName)}
                    data-testid="button-download-rx-pdf">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {mode === "doctor" && (
                    <>
                      <Button size="sm" variant="ghost"
                        className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-primary"
                        onClick={() => startEditRx(latestRx)}
                        data-testid="button-edit-rx">
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(latestRx.id)}
                        disabled={deleteMutation.isPending}
                        data-testid="button-delete-rx">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="px-3 py-2.5 space-y-2">
                {latestRx.doctorName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" /> Dr. {latestRx.doctorName}
                  </p>
                )}
                <PrescriptionDisplay prescription={latestRx.prescription} />
              </div>
            </div>
          ) : (
            !showRxForm && (
              <div className="flex flex-col items-center gap-2 py-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
                <Pill className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs font-medium text-muted-foreground">No prescription recorded yet</p>
                {mode === "doctor" && <p className="text-xs text-muted-foreground/60">Use the button above to add one</p>}
              </div>
            )
          )}

          {/* History */}
          {historyRx.length > 0 && (
            <div>
              <button
                onClick={() => setShowRxHistory(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-medium w-full py-1.5 min-h-[44px] transition-colors"
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
