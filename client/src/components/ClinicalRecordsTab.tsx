import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import {
  Loader2, Plus, Pencil, Trash2, Printer, Eye, FileText, Stethoscope,
  ChevronDown, ChevronUp, ChevronRight, ClipboardList, Pill, CheckCircle2, X, AlertTriangle,
  MoreVertical, MapPin, History,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ClinicalRecord, PharmacyStockItem } from "@shared/schema";
import { printClinicalRecord } from "@/lib/clinic-pdf";

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

// ─── Legacy PDF export (jsPDF-based) — removed; see printClinicalRecord() in
//     @/lib/clinic-pdf.ts for the current window.open + print implementation ──

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

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

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
  // Tracks whether the user's pointer is down inside the dropdown — prevents
  // the input's onBlur from closing the dropdown before the click fires.
  const clickingDropdownRef = useRef(false);

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
        onChange={e => onChange(capitalizeFirst(e.target.value))}
        onFocus={() => { updatePos(); setOpen(true); }}
        onBlur={() => {
          // If a dropdown item is being clicked, do not close yet — the click
          // handler will close it after onSelect fires.
          if (clickingDropdownRef.current) return;
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder="Medicine name"
        className="h-7 text-xs px-2"
        autoComplete="off"
        data-testid={`input-medicine-name-${idx}`}
      />
      {open && catalogue.length > 0 && matches.length > 0 && createPortal(
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-popover border border-border/60 rounded-lg shadow-xl overflow-hidden py-0.5"
          onPointerDown={() => { clickingDropdownRef.current = true; }}
          onPointerUp={() => { clickingDropdownRef.current = false; }}
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
                  // Prevent focus from leaving the input so blur does not fire.
                  e.preventDefault();
                }}
                onClick={() => {
                  onSelect(item.medicineName, item.dosage || "");
                  clickingDropdownRef.current = false;
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
  const teeth = (record.affectedTeeth as string[] | null) ?? [];
  const rxMeds = parsePrescription(record.prescription);
  const rxPreview = rxMeds ? rxMeds.slice(0, 2).map(r => r.name).filter(Boolean).join(", ") : null;

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Record actions"
          onClick={e => e.stopPropagation()}>
          <MoreVertical className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs w-36">
        <DropdownMenuItem onClick={onPdf} className="gap-1.5"><Eye className="h-3 w-3" /> Preview</DropdownMenuItem>
        <DropdownMenuItem onClick={onPdf} className="gap-1.5"><Printer className="h-3 w-3" /> Print</DropdownMenuItem>
        {onEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit} className="gap-1.5"><Pencil className="h-3 w-3" /> Edit</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ── Collapsed summary row (common to both types) ── */
  const summaryRow = (
    <button
      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors min-h-[44px]"
      onClick={() => setExpanded(v => !v)}>
      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-300 dark:bg-slate-600" />
      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
          {format(new Date(record.createdAt!), "d MMM yyyy")}
        </span>
        {record.doctorName && (
          <span className="text-[11px] text-muted-foreground/70 shrink-0">· Dr. {record.doctorName}</span>
        )}
        {type === "diagnosis" && (
          <>
            {teeth.length > 0 && (
              <span className="text-[10px] px-1.5 py-0 rounded-full border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50 font-semibold leading-5 shrink-0">
                [{teeth.join(", ")}]
              </span>
            )}
            {(record.diagnosis ?? []).map(d => (
              <span key={d} className="text-[10px] px-1.5 py-0 rounded-full border border-green-700/25 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold leading-5">
                {d}
              </span>
            ))}
            {record.prescription && (
              <span className="text-[10px] px-1.5 py-0 rounded-full bg-primary/10 text-primary font-semibold leading-5 shrink-0">Rx ✓</span>
            )}
          </>
        )}
        {type === "prescription" && rxPreview && (
          <span className="text-[11px] text-muted-foreground/70 truncate">{rxPreview}</span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {mode === "doctor" && actionsMenu}
        {expanded
          ? <ChevronUp className="h-3 w-3 text-muted-foreground/50" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
      </div>
    </button>
  );

  /* ── Expanded detail panel ── */
  const detailPanel = expanded && (
    <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-border/20 bg-muted/20 animate-in slide-in-from-top-1 duration-150">
      {/* Recorded by */}
      {record.doctorName && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0">Recorded by</span>
          <span className="text-xs text-foreground flex items-center gap-1">
            <Stethoscope className="h-3 w-3 text-muted-foreground" /> Dr. {record.doctorName}
          </span>
        </div>
      )}

      {type === "diagnosis" && (
        <>
          {/* Anat. Focus */}
          {teeth.length > 0 && (
            <div className="flex items-start gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Anat. Focus</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {teeth.map(t => (
                  <span key={t}
                    className="text-[10px] px-1.5 py-0 rounded-full border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50 font-semibold leading-5">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {(record.diagnosis ?? []).length > 0 && (
            <div className="flex items-start gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Findings</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {(record.diagnosis ?? []).map(d => (
                  <Badge key={d} variant="outline"
                    className="text-xs px-2 py-0.5 rounded-full border-green-800/30 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 dark:border-green-700/50 font-semibold">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Notes</span>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line flex-1">{record.notes}</p>
            </div>
          )}

          {/* Linked Rx */}
          {record.prescription && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Medicines</span>
              <div className="flex-1">
                <PrescriptionDisplay prescription={record.prescription} />
              </div>
            </div>
          )}
        </>
      )}

      {type === "prescription" && record.prescription && (
        <div className="flex items-start gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Medicines</span>
          <div className="flex-1">
            <PrescriptionDisplay prescription={record.prescription} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="border-b border-border/30 overflow-hidden mb-1.5 last:mb-0">
      {summaryRow}
      {detailPanel}
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
  const [dxTeeth, setDxTeeth] = useState<string[]>([]);
  const [dxToothInput, setDxToothInput] = useState("");
  const [dxNotes, setDxNotes] = useState("");
  const [showDxHistory, setShowDxHistory] = useState(false);

  // ── Prescription state ─────────────────────────────────────────────────────
  const [showRxForm, setShowRxForm] = useState(false);
  const [rxEditId, setRxEditId] = useState<number | null>(null);
  const [rxRows, setRxRows] = useState<MedicineRow[]>([emptyRow()]);
  const [showRxHistory, setShowRxHistory] = useState(false);
  // When set, saving the Rx form PATCHes this record id (links Rx to an existing Dx row)
  const [rxLinkedToDxId, setRxLinkedToDxId] = useState<number | null>(null);

  // ── Previous visits history (read-only) ────────────────────────────────────
  const [showPastVisits, setShowPastVisits] = useState(false);


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

  // ── Query — current booking records ───────────────────────────────────────
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

  // ── Query — previous visits for the same patient (read-only) ───────────────
  interface PastVisit { bookingId: number; slotDate: string; records: ClinicalRecord[] }
  const { data: pastVisits = [] } = useQuery<PastVisit[]>({
    queryKey: ["/api/clinical-records/booking", bookingId, "patient-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clinical-records/booking/${bookingId}/patient-history`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived record streams ─────────────────────────────────────────────────
  const dxRecords = records.filter(r => r.diagnosis && r.diagnosis.length > 0);
  // Records that have BOTH diagnosis + prescription show inside the Dx card (linked)
  // AND in the Prescription tab, so the prescription is visible from either tab.
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
    mutationFn: async (payload: { diagnosis?: string[]; affectedTeeth?: string[]; prescription?: string | null; notes?: string | null }) => {
      const res = await apiRequest("POST", "/api/clinical-records", {
        bookingId, clinicId, patientName,
        patientPhone: patientPhone || null,
        doctorName: doctorName || null,
        diagnosis: payload.diagnosis ?? [],
        affectedTeeth: payload.affectedTeeth ?? [],
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
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<{ diagnosis: string[]; affectedTeeth: string[]; prescription: string | null; notes: string | null; doctorName: string | null }> }) => {
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
    setShowDxForm(false); setDxEditId(null); setDxTags([]); setDxTeeth([]); setDxToothInput(""); setDxNotes("");
    setShowRxForm(false); setRxEditId(null); setRxRows([emptyRow()]); setRxLinkedToDxId(null);
  };

  // ── Start edit helpers ─────────────────────────────────────────────────────
  const startEditDx = (record: ClinicalRecord) => {
    resetForms();
    setDxEditId(record.id);
    setDxTags(record.diagnosis || []);
    setDxTeeth((record.affectedTeeth as string[] | null) || []);
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

  // ── Inline tab bar (hidden when parent controls the tab, or in admin
  //     read-only mode where both records are shown stacked at once) ─────────
  const TabBar = !hideTabBar && mode !== "admin" ? (
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
          DIAGNOSIS TAB — always shown alongside Prescription in admin mode
      ══════════════════════════════════════════════════════════════════ */}
      {(mode === "admin" || visibleTab === "diagnosis") && (
        <div className="space-y-2.5 animate-in fade-in-0 slide-in-from-left-1 duration-150">

          {/* Section divider — admin mode only (doctor mode uses tab bar) */}
          {mode === "admin" && (
            <div className="flex items-center gap-2 px-0.5">
              <ClipboardList className="h-3 w-3 text-primary shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Diagnosis</span>
              <div className="h-px flex-1 bg-primary/20" />
            </div>
          )}

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
                  <Label className="label-field">
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

                {/* Anatomical focus */}
                <div>
                  <Label className="label-field flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Anatomical Focus <span className="normal-case font-normal">(optional — tooth numbers or quadrants)</span>
                  </Label>
                  {/* Quick quadrant buttons */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {["Generalized", "Upper Right", "Upper Left", "Lower Right", "Lower Left"].map(q => (
                      <button key={q} type="button"
                        onClick={() => { if (!dxTeeth.includes(q)) setDxTeeth(prev => [...prev, q]); }}
                        className="text-[10px] px-2 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50"
                        data-testid={`btn-quadrant-${q.toLowerCase().replace(/ /g,"-")}`}>
                        {q}
                      </button>
                    ))}
                  </div>
                  {/* Tooth number input */}
                  <div className="flex gap-1.5 mt-1.5">
                    <Input
                      value={dxToothInput}
                      onChange={e => setDxToothInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          const val = dxToothInput.trim().replace(/^[Tt]ooth\s*/i, "");
                          if (val && !dxTeeth.includes(`Tooth ${val}`)) {
                            setDxTeeth(prev => [...prev, `Tooth ${val}`]);
                          }
                          setDxToothInput("");
                        }
                      }}
                      placeholder="e.g. 14, 36"
                      className="h-7 text-xs w-36"
                      data-testid="input-tooth-number"
                    />
                    <Button size="sm" type="button" variant="outline"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => {
                        const val = dxToothInput.trim().replace(/^[Tt]ooth\s*/i, "");
                        if (val && !dxTeeth.includes(`Tooth ${val}`)) {
                          setDxTeeth(prev => [...prev, `Tooth ${val}`]);
                        }
                        setDxToothInput("");
                      }}>
                      Add
                    </Button>
                  </div>
                  {dxTeeth.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {dxTeeth.map(t => (
                        <Badge key={t} variant="outline"
                          className="text-xs px-1.5 py-0 rounded-full border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50 gap-1">
                          {t}
                          <button type="button" onClick={() => setDxTeeth(prev => prev.filter(x => x !== t))} className="hover:text-destructive ml-0.5">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Optional notes */}
                <div>
                  <Label className="label-field">
                    Notes <span className="normal-case font-normal">(optional)</span>
                  </Label>
                  <textarea
                    value={dxNotes}
                    onChange={e => setDxNotes(e.target.value)}
                    placeholder="Additional observations…"
                    rows={2}
                    className="w-full mt-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/20"
                    data-testid="textarea-dx-notes"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 h-8 text-xs font-bold"
                    onClick={() => {
                      if (dxEditId) updateMutation.mutate({ id: dxEditId, payload: { diagnosis: dxTags, affectedTeeth: dxTeeth, notes: dxNotes || null } });
                      else createMutation.mutate({ diagnosis: dxTags, affectedTeeth: dxTeeth, notes: dxNotes || null });
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
            <div className="rounded-xl border border-green-800/30 bg-white dark:bg-card shadow-sm overflow-hidden">
              {/* ── Consolidated single-row header ─────────────────────── */}
              <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/30 border-b border-green-800/30 dark:border-green-700/50 flex items-center justify-between gap-2 min-h-[36px]">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                  <ClipboardList className="h-3 w-3 text-green-800 dark:text-green-300 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-green-800 dark:text-green-300 shrink-0">Latest Diagnosis</span>
                  <span className="text-[10px] text-muted-foreground/70 font-medium shrink-0">
                    · {format(new Date(latestDx.createdAt!), "d MMM yyyy, h:mm a")}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Diagnosis actions"
                      data-testid="button-dx-actions">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs w-36">
                    <DropdownMenuItem
                      onClick={() => printClinicalRecord({ type: "diagnosis", clinicName, patientName, patientPhone, doctorName: latestDx.doctorName, date: format(new Date(latestDx.createdAt!), "MMM d, yyyy · h:mm a"), diagnosis: latestDx.diagnosis ?? [], notes: latestDx.notes })}
                      className="gap-1.5" data-testid="button-preview-dx-pdf">
                      <Eye className="h-3 w-3" /> Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => printClinicalRecord({ type: "diagnosis", clinicName, patientName, patientPhone, doctorName: latestDx.doctorName, date: format(new Date(latestDx.createdAt!), "MMM d, yyyy · h:mm a"), diagnosis: latestDx.diagnosis ?? [], notes: latestDx.notes })}
                      className="gap-1.5" data-testid="button-print-dx-pdf">
                      <Printer className="h-3 w-3" /> Print
                    </DropdownMenuItem>
                    {mode === "doctor" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => startEditDx(latestDx)} className="gap-1.5" data-testid="button-edit-dx">
                          <Pencil className="h-3 w-3" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(latestDx.id)}
                          className="gap-1.5 text-destructive focus:text-destructive" data-testid="button-delete-dx">
                          <Trash2 className="h-3 w-3" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* ── Card body ──────────────────────────────────────────── */}
              <div className="px-3 py-2 space-y-1.5">

                {/* Recorded by */}
                {latestDx.doctorName && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0">Recorded by</span>
                    <span className="text-xs text-foreground flex items-center gap-1">
                      <Stethoscope className="h-3 w-3 text-muted-foreground" /> Dr. {latestDx.doctorName}
                    </span>
                  </div>
                )}

                {/* Anatomical focus */}
                {((latestDx.affectedTeeth as string[] | null) ?? []).length > 0 && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Anat. Focus</span>
                    <div className="flex flex-wrap gap-1 flex-1">
                      {((latestDx.affectedTeeth as string[]) ?? []).map(t => (
                        <span key={t}
                          className="text-[10px] px-1.5 py-0 rounded-full border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50 font-semibold leading-5">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clinical findings */}
                <div className="flex items-start gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Findings</span>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {latestDx.diagnosis!.map(d => (
                      <Badge key={d} variant="outline"
                        className="text-xs px-2 py-0.5 rounded-full border-green-800/30 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 dark:border-green-700/50 font-semibold">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Clinical notes */}
                {latestDx.notes && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Notes</span>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line flex-1">
                      {latestDx.notes}
                    </p>
                  </div>
                )}

                {/* Linked prescription */}
                {latestDx.prescription && (
                  <div className="pt-1.5 border-t border-border/20 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Pill className="h-3 w-3 text-primary" />
                      <span className="text-xs font-semibold text-primary">Linked Prescription</span>
                    </div>
                    <PrescriptionDisplay prescription={latestDx.prescription} />
                  </div>
                )}

                {/* Add Rx micro-button */}
                {mode === "doctor" && !latestDx.prescription && !showRxForm && (
                  <div className="pt-1.5 border-t border-border/20">
                    <button
                      onClick={() => { setRxLinkedToDxId(latestDx.id); setShowRxForm(true); }}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 font-medium transition-colors"
                      data-testid="button-add-rx-for-dx">
                      <Pill className="h-3 w-3" /> + Add Prescription
                    </button>
                  </div>
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
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium w-full py-1.5 min-h-[44px] transition-colors"
                data-testid="button-toggle-dx-history">
                {mode === "admin" ? (
                  <>View all old diagnosis ({historyDx.length + 1}) <ChevronRight className="h-3 w-3" /></>
                ) : (
                  <>
                    {showDxHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showDxHistory ? "Hide" : `Show ${historyDx.length} older`} diagnosis {historyDx.length === 1 ? "entry" : "entries"}
                  </>
                )}
              </button>
              {showDxHistory && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/30 overflow-hidden mt-1 divide-y divide-slate-200 dark:divide-slate-700 animate-in slide-in-from-top-1 duration-150">
                  {historyDx.map(record => (
                    <HistoryRow
                      key={record.id}
                      record={record}
                      type="diagnosis"
                      mode={mode}
                      onEdit={mode === "doctor" ? () => startEditDx(record) : undefined}
                      onPdf={() => printClinicalRecord({
                        type: "diagnosis",
                        clinicName,
                        patientName,
                        patientPhone,
                        doctorName: record.doctorName,
                        date: format(new Date(record.createdAt!), "MMM d, yyyy · h:mm a"),
                        diagnosis: record.diagnosis ?? [],
                        notes: record.notes,
                      })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PRESCRIPTION TAB — always shown alongside Diagnosis in admin mode
      ══════════════════════════════════════════════════════════════════ */}
      {(mode === "admin" || visibleTab === "prescription" || (rxLinkedToDxId !== null && showRxForm)) && (
        <div className="space-y-2.5 animate-in fade-in-0 slide-in-from-right-1 duration-150">

          {/* Section divider — admin mode only */}
          {mode === "admin" && (
            <div className="flex items-center gap-2 px-0.5 pt-1">
              <Pill className="h-3 w-3 text-primary shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Prescription</span>
              <div className="h-px flex-1 bg-primary/20" />
            </div>
          )}

          {/* ── Add / Edit form — floats on top when open ── */}
          {mode === "doctor" && showRxForm && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.03] overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-2 bg-primary/8 border-b border-primary/15 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Pill className="h-3 w-3 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {rxEditId ? "Edit Prescription" : rxLinkedToDxId ? "Prescription for this Diagnosis" : "New Prescription"}
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
                    <Label className="label-field flex items-center gap-1">
                      <Pill className="h-3 w-3" /> Medicines
                    </Label>
                  </div>

                  {/* Column headers */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[540px]">
                      <div className="grid gap-x-1 mb-1 px-1" style={{ gridTemplateColumns: "20px 160px 56px 40px 52px 40px 58px 62px 20px" }}>
                        {["#", "Medicine", "Dosage", "Qty", "Freq", "Dur.", "Unit", "Route", ""].map((h, i) => (
                          <span key={i} className="label-field/70 truncate">{h}</span>
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
                              style={{ gridTemplateColumns: "20px 160px 56px 40px 52px 40px 58px 62px 20px" }}>

                            {/* Serial number */}
                            <span className="text-xs text-muted-foreground/60 font-semibold text-center select-none">
                              {idx + 1}
                            </span>

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
                              <Input value={row.name} onChange={e => updateRxRow(idx, "name", capitalizeFirst(e.target.value))}
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
                      else if (rxLinkedToDxId) updateMutation.mutate({ id: rxLinkedToDxId, payload: { prescription: payload } });
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
          {latestRx && !(showRxForm && rxEditId === latestRx.id) && !rxLinkedToDxId ? (
            <div className="rounded-xl border border-green-800/30 bg-white dark:bg-card shadow-sm overflow-hidden">
              {/* ── Single-row header ──────────────────────────────────── */}
              <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/30 border-b border-green-800/30 dark:border-green-700/50 flex items-center justify-between gap-2 min-h-[36px]">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                  <Pill className="h-3 w-3 text-green-800 dark:text-green-300 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-green-800 dark:text-green-300 shrink-0">Latest Prescription</span>
                  <span className="text-[10px] text-muted-foreground/70 font-medium shrink-0">
                    · {format(new Date(latestRx.createdAt!), "d MMM yyyy, h:mm a")}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Prescription actions"
                      data-testid="button-rx-actions">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs w-36">
                    <DropdownMenuItem
                      onClick={() => printClinicalRecord({ type: "prescription", clinicName, patientName, patientPhone, doctorName: latestRx.doctorName, date: format(new Date(latestRx.createdAt!), "MMM d, yyyy · h:mm a"), medicines: parsePrescription(latestRx.prescription), rawPrescription: latestRx.prescription })}
                      className="gap-1.5" data-testid="button-preview-rx-pdf">
                      <Eye className="h-3 w-3" /> Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => printClinicalRecord({ type: "prescription", clinicName, patientName, patientPhone, doctorName: latestRx.doctorName, date: format(new Date(latestRx.createdAt!), "MMM d, yyyy · h:mm a"), medicines: parsePrescription(latestRx.prescription), rawPrescription: latestRx.prescription })}
                      className="gap-1.5" data-testid="button-print-rx-pdf">
                      <Printer className="h-3 w-3" /> Print
                    </DropdownMenuItem>
                    {mode === "doctor" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => startEditRx(latestRx)} className="gap-1.5" data-testid="button-edit-rx">
                          <Pencil className="h-3 w-3" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(latestRx.id)}
                          className="gap-1.5 text-destructive focus:text-destructive" data-testid="button-delete-rx">
                          <Trash2 className="h-3 w-3" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* ── Card body ──────────────────────────────────────────── */}
              <div className="px-3 py-2 space-y-1.5">
                {latestRx.doctorName && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0">Recorded by</span>
                    <span className="text-xs text-foreground flex items-center gap-1">
                      <Stethoscope className="h-3 w-3 text-muted-foreground" /> Dr. {latestRx.doctorName}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-24 shrink-0 pt-0.5">Medicines</span>
                  <div className="flex-1">
                    <PrescriptionDisplay prescription={latestRx.prescription} />
                  </div>
                </div>
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
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium w-full py-1.5 min-h-[44px] transition-colors"
                data-testid="button-toggle-rx-history">
                {mode === "admin" ? (
                  <>View all old prescriptions ({historyRx.length + 1}) <ChevronRight className="h-3 w-3" /></>
                ) : (
                  <>
                    {showRxHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showRxHistory ? "Hide" : `Show ${historyRx.length} older`} prescription {historyRx.length === 1 ? "entry" : "entries"}
                  </>
                )}
              </button>
              {showRxHistory && (
                <div className="rounded-xl border border-border/60 bg-muted/30 overflow-hidden mt-1 divide-y divide-border/30 animate-in slide-in-from-top-1 duration-150">
                  {historyRx.map(record => (
                    <HistoryRow
                      key={record.id}
                      record={record}
                      type="prescription"
                      mode={mode}
                      onEdit={mode === "doctor" ? () => startEditRx(record) : undefined}
                      onPdf={() => printClinicalRecord({
                        type: "prescription",
                        clinicName,
                        patientName,
                        patientPhone,
                        doctorName: record.doctorName,
                        date: format(new Date(record.createdAt!), "MMM d, yyyy · h:mm a"),
                        medicines: parsePrescription(record.prescription),
                        rawPrescription: record.prescription,
                      })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Previous Visit Records — read-only, collapsible ─────────────────── */}
      {pastVisits.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 mt-1">
          <button
            onClick={() => setShowPastVisits(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors min-h-[44px]"
            data-testid="button-toggle-past-visit-records"
          >
            <History className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex-1 text-left">
              Previous Visit Records
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">
                ({pastVisits.reduce((a, v) => a + v.records.length, 0)} record{pastVisits.reduce((a, v) => a + v.records.length, 0) !== 1 ? "s" : ""} across {pastVisits.length} visit{pastVisits.length !== 1 ? "s" : ""})
              </span>
            </span>
            {showPastVisits
              ? <ChevronUp className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              : <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            }
          </button>

          {showPastVisits && (
            <div className="px-0 py-3 space-y-5 bg-slate-50/60 dark:bg-slate-900/20">
              {pastVisits.map((visit) => {
                const visitDx = visit.records.filter(r => r.diagnosis && (r.diagnosis as string[]).length > 0);
                const visitRx = visit.records.filter(r => !!r.prescription);
                return (
                  <div key={visit.bookingId}>
                    {/* Visit date divider */}
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                      Visit — {format(new Date(visit.slotDate), "d MMM yyyy, h:mm a")}
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </p>

                    {visitDx.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" /> Diagnosis
                        </p>
                        <div className="border-t border-border/50 bg-muted/20 overflow-hidden divide-y divide-border/30">
                          {visitDx.map(record => (
                            <HistoryRow
                              key={record.id}
                              record={record}
                              type="diagnosis"
                              mode={mode}
                              onPdf={() => printClinicalRecord({
                                type: "diagnosis",
                                clinicName,
                                patientName,
                                patientPhone,
                                doctorName: record.doctorName,
                                date: format(new Date(record.createdAt!), "MMM d, yyyy · h:mm a"),
                                diagnosis: record.diagnosis ?? [],
                                notes: record.notes,
                              })}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {visitRx.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Pill className="h-3 w-3" /> Prescription
                        </p>
                        <div className="border-t border-border/50 bg-muted/20 overflow-hidden divide-y divide-border/30">
                          {visitRx.map(record => (
                            <HistoryRow
                              key={record.id}
                              record={record}
                              type="prescription"
                              mode={mode}
                              onPdf={() => printClinicalRecord({
                                type: "prescription",
                                clinicName,
                                patientName,
                                patientPhone,
                                doctorName: record.doctorName,
                                date: format(new Date(record.createdAt!), "MMM d, yyyy · h:mm a"),
                                medicines: parsePrescription(record.prescription),
                                rawPrescription: record.prescription,
                              })}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
