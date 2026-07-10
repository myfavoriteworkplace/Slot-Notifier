import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, History, Save, AlertCircle, Trash2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

type ToothCondition = "caries" | "filled" | "crown" | "missing" | "implant" | "bridge" | "rct" | "sealant";

interface HistoryEntry {
  date: string;
  bookingId: number;
  bookingRef: string;
  doctorName: string;
  condition: ToothCondition | null;
  note: string;
}

interface ToothState {
  condition: ToothCondition | null;
  note: string;
  history: HistoryEntry[];
}

type ChartData = Record<string, ToothState>;

// ── Constants ────────────────────────────────────────────────────────────────

const CONDITION_META: Record<ToothCondition, { label: string; fill: string; stroke: string; text: string }> = {
  caries:  { label: "Caries",   fill: "#FCA5A5", stroke: "#EF4444", text: "#B91C1C" },
  filled:  { label: "Filled",   fill: "#93C5FD", stroke: "#3B82F6", text: "#1D4ED8" },
  crown:   { label: "Crown",    fill: "#FCD34D", stroke: "#D97706", text: "#92400E" },
  missing: { label: "Missing",  fill: "#E5E7EB", stroke: "#9CA3AF", text: "#4B5563" },
  implant: { label: "Implant",  fill: "#6EE7B7", stroke: "#10B981", text: "#065F46" },
  bridge:  { label: "Bridge",   fill: "#DDD6FE", stroke: "#8B5CF6", text: "#5B21B6" },
  rct:     { label: "RCT",      fill: "#FED7AA", stroke: "#F97316", text: "#9A3412" },
  sealant: { label: "Sealant",  fill: "#A5F3FC", stroke: "#06B6D4", text: "#164E63" },
};

const HEALTHY_STYLE = { fill: "#FFFFFF", stroke: "#A8C4B8" };

const TOOTH_NAMES: Record<number, string> = {
  11:"UR Central", 12:"UR Lateral", 13:"UR Canine",
  14:"UR 1st PM",  15:"UR 2nd PM",
  16:"UR 1st Molar", 17:"UR 2nd Molar", 18:"UR Wisdom",
  21:"UL Central", 22:"UL Lateral", 23:"UL Canine",
  24:"UL 1st PM",  25:"UL 2nd PM",
  26:"UL 1st Molar", 27:"UL 2nd Molar", 28:"UL Wisdom",
  31:"LL Central", 32:"LL Lateral", 33:"LL Canine",
  34:"LL 1st PM",  35:"LL 2nd PM",
  36:"LL 1st Molar", 37:"LL 2nd Molar", 38:"LL Wisdom",
  41:"LR Central", 42:"LR Lateral", 43:"LR Canine",
  44:"LR 1st PM",  45:"LR 2nd PM",
  46:"LR 1st Molar", 47:"LR 2nd Molar", 48:"LR Wisdom",
};

// Display order (left → right on screen from doctor's perspective)
const UPPER_RIGHT = [18,17,16,15,14,13,12,11] as const;
const UPPER_LEFT  = [21,22,23,24,25,26,27,28] as const;
const LOWER_RIGHT = [48,47,46,45,44,43,42,41] as const;
const LOWER_LEFT  = [31,32,33,34,35,36,37,38] as const;

// ── Tooth-type geometry ───────────────────────────────────────────────────────

type ToothType = "incisor" | "canine" | "premolar" | "molar";

function getToothType(fdi: number): ToothType {
  const d = fdi % 10;
  if (d === 1 || d === 2) return "incisor";
  if (d === 3) return "canine";
  if (d === 4 || d === 5) return "premolar";
  return "molar";
}

// cW = cervical (gum) width — the wider side; oW = occlusal/incisal — narrower; h = crown height
interface CrownDims { cW: number; oW: number; h: number }
const CROWN_DIMS: Record<ToothType, CrownDims> = {
  incisor:  { cW: 17, oW: 15, h: 21 },
  canine:   { cW: 15, oW:  9, h: 24 },
  premolar: { cW: 15, oW: 13, h: 18 },
  molar:    { cW: 20, oW: 18, h: 14 },
};

// nW = neck width at cervical margin; h = root length; dual = two roots
interface RootDims { nW: number; h: number; dual: boolean }
const ROOT_DIMS: Record<ToothType, RootDims> = {
  incisor:  { nW:  7, h: 43, dual: false },
  canine:   { nW:  7, h: 43, dual: false },
  premolar: { nW:  8, h: 43, dual: false },
  molar:    { nW: 18, h: 43, dual: true  },
};

// ── SVG path generators ───────────────────────────────────────────────────────

// Single root pointing UP (upper arch) — tapers from neckW at cervicalY to a rounded apex at apexY
function rootUp(cx: number, cervY: number, apexY: number, nW: number): string {
  const n = nW / 2, h = cervY - apexY;
  return `M ${cx-n},${cervY} C ${cx-n},${cervY-h*0.55} ${cx-0.5},${apexY+5} ${cx},${apexY} C ${cx+0.5},${apexY+5} ${cx+n},${cervY-h*0.55} ${cx+n},${cervY} Z`;
}

// Single root pointing DOWN (lower arch)
function rootDown(cx: number, cervY: number, apexY: number, nW: number): string {
  const n = nW / 2, h = apexY - cervY;
  return `M ${cx-n},${cervY} C ${cx-n},${cervY+h*0.55} ${cx-0.5},${apexY-5} ${cx},${apexY} C ${cx+0.5},${apexY-5} ${cx+n},${cervY+h*0.55} ${cx+n},${cervY} Z`;
}

// Two diverging roots pointing UP (upper molars)
function dualRootsUp(cx: number, cervY: number, apexY: number, nW: number): string {
  const n = nW / 2, h = cervY - apexY, s = 4.5, g = 2;
  const lA = cx - s, rA = cx + s;
  return (
    `M ${cx-n},${cervY} C ${cx-n},${cervY-h*0.5} ${lA-2},${apexY+7} ${lA},${apexY} C ${lA+1.5},${apexY+7} ${cx-g},${cervY-h*0.45} ${cx-g},${cervY} ` +
    `M ${cx+g},${cervY} C ${cx+g},${cervY-h*0.45} ${rA-1.5},${apexY+7} ${rA},${apexY} C ${rA+2},${apexY+7} ${cx+n},${cervY-h*0.5} ${cx+n},${cervY} Z`
  );
}

// Two diverging roots pointing DOWN (lower molars)
function dualRootsDown(cx: number, cervY: number, apexY: number, nW: number): string {
  const n = nW / 2, h = apexY - cervY, s = 4.5, g = 2;
  const lA = cx - s, rA = cx + s;
  return (
    `M ${cx-n},${cervY} C ${cx-n},${cervY+h*0.5} ${lA-2},${apexY-7} ${lA},${apexY} C ${lA+1.5},${apexY-7} ${cx-g},${cervY+h*0.45} ${cx-g},${cervY} ` +
    `M ${cx+g},${cervY} C ${cx+g},${cervY+h*0.45} ${rA-1.5},${apexY-7} ${rA},${apexY} C ${rA+2},${apexY-7} ${cx+n},${cervY+h*0.5} ${cx+n},${cervY} Z`
  );
}

// Crown for UPPER arch: cervical (wider) at top y0, occlusal (narrower) at bottom y0+h
function crownUp(cx: number, y0: number, { cW, oW, h }: CrownDims, type: ToothType): string {
  const r = 2, y1 = y0 + h, c = cW / 2, o = oW / 2;
  if (type === "canine")
    return `M ${cx-c+r},${y0} L ${cx+c-r},${y0} Q ${cx+c},${y0} ${cx+c},${y0+r} L ${cx+o},${y1-5} L ${cx},${y1} L ${cx-o},${y1-5} L ${cx-c},${y0+r} Q ${cx-c},${y0} ${cx-c+r},${y0} Z`;
  if (type === "molar") {
    const d = 3;
    return `M ${cx-c+r},${y0} L ${cx+c-r},${y0} Q ${cx+c},${y0} ${cx+c},${y0+r} L ${cx+o},${y1-d} Q ${cx+o*0.4},${y1} ${cx},${y1-d*0.5} Q ${cx-o*0.4},${y1} ${cx-o},${y1-d} L ${cx-c},${y0+r} Q ${cx-c},${y0} ${cx-c+r},${y0} Z`;
  }
  if (type === "premolar") {
    const d = 2.5;
    return `M ${cx-c+r},${y0} L ${cx+c-r},${y0} Q ${cx+c},${y0} ${cx+c},${y0+r} L ${cx+o},${y1-d} Q ${cx},${y1} ${cx-o},${y1-d} L ${cx-c},${y0+r} Q ${cx-c},${y0} ${cx-c+r},${y0} Z`;
  }
  // incisor — gently tapered rectangle
  return `M ${cx-c+r},${y0} L ${cx+c-r},${y0} Q ${cx+c},${y0} ${cx+c},${y0+r} L ${cx+o},${y1-r} Q ${cx+o},${y1} ${cx+o-r},${y1} L ${cx-o+r},${y1} Q ${cx-o},${y1} ${cx-o},${y1-r} L ${cx-c},${y0+r} Q ${cx-c},${y0} ${cx-c+r},${y0} Z`;
}

// Crown for LOWER arch: occlusal (narrower) at top y0, cervical (wider) at bottom y0+h
function crownDown(cx: number, y0: number, { cW, oW, h }: CrownDims, type: ToothType): string {
  const r = 2, y1 = y0 + h, c = cW / 2, o = oW / 2;
  if (type === "canine")
    return `M ${cx},${y0} L ${cx+o},${y0+5} L ${cx+c},${y1-r} Q ${cx+c},${y1} ${cx+c-r},${y1} L ${cx-c+r},${y1} Q ${cx-c},${y1} ${cx-c},${y1-r} L ${cx-o},${y0+5} Z`;
  if (type === "molar") {
    const d = 3;
    return `M ${cx+o},${y0+d} Q ${cx+o*0.4},${y0} ${cx},${y0+d*0.5} Q ${cx-o*0.4},${y0} ${cx-o},${y0+d} L ${cx-c},${y1-r} Q ${cx-c},${y1} ${cx-c+r},${y1} L ${cx+c-r},${y1} Q ${cx+c},${y1} ${cx+c},${y1-r} Z`;
  }
  if (type === "premolar") {
    const d = 2.5;
    return `M ${cx+o},${y0+d} Q ${cx},${y0} ${cx-o},${y0+d} L ${cx-c},${y1-r} Q ${cx-c},${y1} ${cx-c+r},${y1} L ${cx+c-r},${y1} Q ${cx+c},${y1} ${cx+c},${y1-r} Z`;
  }
  // incisor
  return `M ${cx-o+r},${y0} L ${cx+o-r},${y0} Q ${cx+o},${y0} ${cx+o},${y0+r} L ${cx+c},${y1-r} Q ${cx+c},${y1} ${cx+c-r},${y1} L ${cx-c+r},${y1} Q ${cx-c},${y1} ${cx-c},${y1-r} L ${cx-o},${y0+r} Q ${cx-o},${y0} ${cx-o+r},${y0} Z`;
}

// ── Fixed Y anchors ───────────────────────────────────────────────────────────

const STEP         = 24;
const MIDLINE_EXTRA = 8;
const START_CX     = 19;   // cx of first tooth slot

const UPPER_ROOT_Y  = 6;   // tip of upper roots
const UPPER_CROWN_Y = 49;  // cervical margin for upper arch (root meets crown)
const UPPER_LABEL_Y = 82;  // FDI label for upper teeth
const MIDLINE_Y     = 91;  // horizontal midline between arches
const LOWER_LABEL_Y = 99;  // FDI label for lower teeth
const LOWER_CROWN_Y = 104; // occlusal surface of lower teeth (top of lower crown)

function toothCx(tooth: number): number {
  let idx = (UPPER_RIGHT as readonly number[]).indexOf(tooth);
  if (idx !== -1) return START_CX + idx * STEP;
  idx = (UPPER_LEFT as readonly number[]).indexOf(tooth);
  if (idx !== -1) return START_CX + 8 * STEP + MIDLINE_EXTRA + idx * STEP;
  idx = (LOWER_RIGHT as readonly number[]).indexOf(tooth);
  if (idx !== -1) return START_CX + idx * STEP;
  idx = (LOWER_LEFT as readonly number[]).indexOf(tooth);
  if (idx !== -1) return START_CX + 8 * STEP + MIDLINE_EXTRA + idx * STEP;
  return 0;
}

// ── Tooth SVG Element ────────────────────────────────────────────────────────

interface ToothProps {
  tooth: number;
  arch: "upper" | "lower";
  state: ToothState | undefined;
  isSelected: boolean;
  isNewThisVisit: boolean;
  isEditable: boolean;
  onClick: () => void;
}

function ToothSvg({ tooth, arch, state, isSelected, isNewThisVisit, isEditable, onClick }: ToothProps) {
  const cx    = toothCx(tooth);
  const cond  = state?.condition ?? null;
  const meta  = cond ? CONDITION_META[cond] : null;
  const crownFill   = meta ? meta.fill   : HEALTHY_STYLE.fill;
  const crownStroke = meta ? meta.stroke : HEALTHY_STYLE.stroke;
  const isMissing   = cond === "missing";
  const hasHistory  = (state?.history?.length ?? 0) > 0;

  const type  = getToothType(tooth);
  const dims  = CROWN_DIMS[type];
  const rdims = ROOT_DIMS[type];

  const SEL   = "#0F9B6E";
  const cSW   = isSelected ? 1.8 : 1;
  const cCol  = isSelected ? SEL : crownStroke;

  // Y anchors
  const crownY0 = arch === "upper" ? UPPER_CROWN_Y : LOWER_CROWN_Y;
  const labelY  = arch === "upper" ? UPPER_LABEL_Y : LOWER_LABEL_Y;
  // cervical margin (root meets crown)
  const cervY   = arch === "upper" ? UPPER_CROWN_Y : LOWER_CROWN_Y + dims.h;
  // root apex
  const apexY   = arch === "upper" ? UPPER_ROOT_Y  : LOWER_CROWN_Y + dims.h + rdims.h;

  // ── Paths ──
  const crownPath = arch === "upper"
    ? crownUp(cx, crownY0, dims, type)
    : crownDown(cx, crownY0, dims, type);

  const rootPath = rdims.dual
    ? (arch === "upper" ? dualRootsUp(cx, cervY, apexY, rdims.nW) : dualRootsDown(cx, cervY, apexY, rdims.nW))
    : (arch === "upper" ? rootUp(cx, cervY, apexY, rdims.nW)      : rootDown(cx, cervY, apexY, rdims.nW));

  // ── Elements ──
  const rootEl = (
    <path d={rootPath}
      fill={isMissing ? "#F3F4F6" : "#EEF5F1"}
      stroke={isSelected ? SEL : "#C5D9CE"}
      strokeWidth={isSelected ? 1.5 : 0.6}
      strokeDasharray={isMissing ? "3 2" : undefined}
    />
  );

  const crownEl = (
    <path d={crownPath}
      fill={crownFill}
      stroke={cCol}
      strokeWidth={cSW}
      strokeDasharray={isMissing ? "3 2" : undefined}
    />
  );

  // Missing X — crosses through the crown bounding box
  const mxH = dims.cW / 2;
  const missingX = isMissing && (
    <g>
      <line x1={cx - mxH + 4} y1={crownY0 + 3} x2={cx + mxH - 4} y2={crownY0 + dims.h - 3} stroke="#9CA3AF" strokeWidth={1.2} />
      <line x1={cx + mxH - 4} y1={crownY0 + 3} x2={cx - mxH + 4} y2={crownY0 + dims.h - 3} stroke="#9CA3AF" strokeWidth={1.2} />
    </g>
  );

  // Selection ring — dashed rect around crown bounding box
  const selRing = isSelected && (
    <rect
      x={cx - dims.cW / 2 - 2} y={crownY0 - 2}
      width={dims.cW + 4} height={dims.h + 4}
      rx={3} fill="none"
      stroke={SEL} strokeWidth={1.2} strokeDasharray="3 2" opacity={0.6}
    />
  );

  // Indicator dots — top-right of crown
  const dotX = cx + dims.cW / 2 - 1;
  const newDot  = isNewThisVisit && <circle cx={dotX} cy={crownY0 + 1} r={3} fill="#0F9B6E" />;
  const histDot = !isNewThisVisit && hasHistory && <circle cx={dotX} cy={crownY0 + 1} r={2.5} fill="#6B7280" opacity={0.7} />;

  const label = (
    <text x={cx} y={labelY} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
      fill={isSelected ? "#0F9B6E" : "#6B8F7E"} fontWeight={isSelected ? "700" : "500"}>
      {tooth}
    </text>
  );

  return (
    <g onClick={isEditable ? onClick : undefined}
       style={{ cursor: isEditable ? "pointer" : "default" }}
       opacity={isMissing && !isSelected ? 0.7 : 1}>
      {arch === "upper"
        ? <>{rootEl}{crownEl}{missingX}{selRing}{newDot}{histDot}{label}</>
        : <>{label}{crownEl}{missingX}{selRing}{newDot}{histDot}{rootEl}</>
      }
    </g>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface OdontogramTabProps {
  bookingId: number;
  bookingRef: string;
  doctorName: string;
  isEditable: boolean;
}

export default function OdontogramTab({ bookingId, bookingRef, doctorName, isEditable }: OdontogramTabProps) {
  const { toast } = useToast();
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, ToothCondition | null>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── Load chart ──────────────────────────────────────────────────────────────
  const { data: chartResponse, isLoading, isError } = useQuery<{
    chartData: ChartData;
    patientId: number;
    updatedAt: string | null;
  }>({
    queryKey: [`/api/doctor/bookings/${bookingId}/chart`],
    enabled: !!bookingId,
    staleTime: Infinity,
  });

  const serverData: ChartData = chartResponse?.chartData ?? {};

  // Effective tooth state = server data merged with local edits
  const effectiveData = useCallback((): ChartData => {
    const merged = { ...serverData };
    for (const [k, cond] of Object.entries(localEdits)) {
      merged[k] = {
        condition: cond,
        note: serverData[k]?.note ?? "",
        history: serverData[k]?.history ?? [],
      };
    }
    return merged;
  }, [serverData, localEdits])();

  // ── Save mutation ───────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (chartData: ChartData) =>
      apiRequest("PUT", `/api/doctor/bookings/${bookingId}/chart`, { chartData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/doctor/bookings/${bookingId}/chart`] });
      setLocalEdits({});
      setIsDirty(false);
      toast({ title: "Chart saved", description: "Odontogram updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const today = new Date().toISOString().slice(0, 10);
    const updatedData: ChartData = { ...serverData };
    for (const [toothNum, newCondition] of Object.entries(localEdits)) {
      const existing = serverData[toothNum] ?? { condition: null, note: "", history: [] };
      const histEntry: HistoryEntry = {
        date: today,
        bookingId,
        bookingRef,
        doctorName,
        condition: newCondition,
        note: "",
      };
      updatedData[toothNum] = {
        condition: newCondition,
        note: existing.note,
        history: [...(existing.history ?? []), histEntry],
      };
    }
    saveMutation.mutate(updatedData);
  };

  const handleConditionSelect = (condition: ToothCondition | null) => {
    if (!selectedTooth || !isEditable) return;
    const key = String(selectedTooth);
    setLocalEdits(prev => ({ ...prev, [key]: condition }));
    setIsDirty(true);
  };

  const selectedToothState = selectedTooth ? effectiveData[String(selectedTooth)] : undefined;
  const selectedCondition   = selectedToothState?.condition ?? null;
  const selectedHistory     = selectedToothState?.history ?? [];
  const isNewThisVisit      = (t: number) => String(t) in localEdits;

  // ── Loading / error states ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading chart…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 m-4">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Could not load chart — patient record may not be linked to this booking.</span>
      </div>
    );
  }

  // ── Chart SVG ───────────────────────────────────────────────────────────────
  const svgViewBox = "0 0 410 185";

  const MidlineY    = MIDLINE_Y;
  const MidlineX1   = 6;
  const MidlineX2   = 404;
  const VertMidX    = START_CX + 8 * STEP + MIDLINE_EXTRA / 2 - 1; // ~207

  const chartSvg = (
    <svg
      viewBox={svgViewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", minWidth: 310, display: "block" }}
      aria-label="Dental odontogram chart"
    >
      {/* Quadrant labels */}
      <text x={100} y={5} textAnchor="middle" fontSize={6} fill="#9BB8A8" fontFamily="monospace" fontWeight="600">Q1 · UPPER RIGHT</text>
      <text x={308} y={5} textAnchor="middle" fontSize={6} fill="#9BB8A8" fontFamily="monospace" fontWeight="600">Q2 · UPPER LEFT</text>
      <text x={308} y={183} textAnchor="middle" fontSize={6} fill="#9BB8A8" fontFamily="monospace" fontWeight="600">Q3 · LOWER LEFT</text>
      <text x={100} y={183} textAnchor="middle" fontSize={6} fill="#9BB8A8" fontFamily="monospace" fontWeight="600">Q4 · LOWER RIGHT</text>

      {/* Midline cross lines */}
      <line x1={MidlineX1} y1={MidlineY} x2={MidlineX2} y2={MidlineY} stroke="#D1E8DC" strokeWidth={0.8} />
      <line x1={VertMidX} y1={UPPER_ROOT_Y} x2={VertMidX} y2={172} stroke="#D1E8DC" strokeWidth={0.8} strokeDasharray="2 2" />

      {/* Upper right teeth */}
      {UPPER_RIGHT.map(t => (
        <ToothSvg key={t} tooth={t} arch="upper"
          state={effectiveData[String(t)]}
          isSelected={selectedTooth === t}
          isNewThisVisit={isNewThisVisit(t)}
          isEditable={isEditable}
          onClick={() => { setSelectedTooth(prev => prev === t ? null : t); setShowHistory(false); }}
        />
      ))}
      {/* Upper left teeth */}
      {UPPER_LEFT.map(t => (
        <ToothSvg key={t} tooth={t} arch="upper"
          state={effectiveData[String(t)]}
          isSelected={selectedTooth === t}
          isNewThisVisit={isNewThisVisit(t)}
          isEditable={isEditable}
          onClick={() => { setSelectedTooth(prev => prev === t ? null : t); setShowHistory(false); }}
        />
      ))}
      {/* Lower right teeth */}
      {LOWER_RIGHT.map(t => (
        <ToothSvg key={t} tooth={t} arch="lower"
          state={effectiveData[String(t)]}
          isSelected={selectedTooth === t}
          isNewThisVisit={isNewThisVisit(t)}
          isEditable={isEditable}
          onClick={() => { setSelectedTooth(prev => prev === t ? null : t); setShowHistory(false); }}
        />
      ))}
      {/* Lower left teeth */}
      {LOWER_LEFT.map(t => (
        <ToothSvg key={t} tooth={t} arch="lower"
          state={effectiveData[String(t)]}
          isSelected={selectedTooth === t}
          isNewThisVisit={isNewThisVisit(t)}
          isEditable={isEditable}
          onClick={() => { setSelectedTooth(prev => prev === t ? null : t); setShowHistory(false); }}
        />
      ))}
    </svg>
  );

  // ── Legend row ──────────────────────────────────────────────────────────────
  const legendRow = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-2">
      {(Object.entries(CONDITION_META) as [ToothCondition, typeof CONDITION_META[ToothCondition]][]).map(([k, v]) => (
        <div key={k} className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm border" style={{ background: v.fill, borderColor: v.stroke }} />
          <span className="text-[10px] text-muted-foreground">{v.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-sm border border-green-600 bg-green-500" />
        <span className="text-[10px] text-muted-foreground">New this visit</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-500 opacity-70" />
        <span className="text-[10px] text-muted-foreground">Has history</span>
      </div>
    </div>
  );

  // ── Condition picker (shown when tooth selected) ─────────────────────────────
  const conditionPicker = selectedTooth && (
    <div className="mx-3 mb-2 rounded-xl border border-green-800/30 bg-white dark:bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-green-50 dark:bg-green-900/30 border-b border-green-800/30 dark:border-green-700/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-green-800 dark:text-green-300">Tooth {selectedTooth}</span>
          <span className="text-xs text-green-700 dark:text-green-400 truncate">— {TOOTH_NAMES[selectedTooth]}</span>
          {isNewThisVisit(selectedTooth) && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white">Edited</span>
          )}
        </div>
        <button
          onClick={() => setSelectedTooth(null)}
          className="h-5 w-5 rounded flex items-center justify-center text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors shrink-0"
          aria-label="Close tooth detail"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Condition grid */}
        {isEditable ? (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Set Condition</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.entries(CONDITION_META) as [ToothCondition, typeof CONDITION_META[ToothCondition]][]).map(([k, v]) => {
                const isActive = selectedCondition === k;
                return (
                  <button
                    key={k}
                    onClick={() => handleConditionSelect(isActive ? null : k)}
                    data-testid={`button-condition-${k}-${selectedTooth}`}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border text-center transition-all active:scale-95 ${
                      isActive
                        ? "border-2 shadow-sm"
                        : "border-border/50 hover:border-border bg-white"
                    }`}
                    style={isActive ? { borderColor: v.stroke, background: v.fill + "60" } : {}}
                  >
                    <span className="inline-block w-4 h-4 rounded" style={{ background: v.fill, border: `1.5px solid ${v.stroke}` }} />
                    <span className="text-[9px] font-semibold leading-none" style={{ color: isActive ? v.text : undefined }}>{v.label}</span>
                    {isActive && <svg viewBox="0 0 10 10" className="h-2 w-2" style={{ color: v.stroke }} fill="currentColor"><path d="M1.5 5.5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>}
                  </button>
                );
              })}
            </div>
            {selectedCondition && (
              <button
                onClick={() => handleConditionSelect(null)}
                data-testid={`button-clear-condition-${selectedTooth}`}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-rose-300 text-rose-500 text-xs font-medium hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Clear condition (mark healthy)
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {selectedCondition ? (
              <>
                <span className="inline-block w-4 h-4 rounded border shrink-0" style={{ background: CONDITION_META[selectedCondition].fill, borderColor: CONDITION_META[selectedCondition].stroke }} />
                <span className="text-sm font-semibold" style={{ color: CONDITION_META[selectedCondition].text }}>{CONDITION_META[selectedCondition].label}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground/60">No condition recorded</span>
            )}
          </div>
        )}

        {/* History */}
        {selectedHistory.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
            >
              <History className="h-3 w-3" />
              Visit History ({selectedHistory.length})
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {[...selectedHistory].reverse().map((entry, i) => (
                  <div key={i} className="rounded-lg bg-muted/30 border border-border/40 px-2.5 py-1.5 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold font-mono text-primary">{entry.bookingRef}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {(() => {
                          try { return format(new Date(entry.date), "dd MMM yyyy"); } catch { return entry.date; }
                        })()}
                      </span>
                      {entry.condition && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border"
                          style={{ background: CONDITION_META[entry.condition]?.fill, borderColor: CONDITION_META[entry.condition]?.stroke, color: CONDITION_META[entry.condition]?.text }}>
                          {CONDITION_META[entry.condition]?.label ?? entry.condition}
                        </span>
                      )}
                      {!entry.condition && <span className="text-[10px] text-muted-foreground italic">Cleared</span>}
                    </div>
                    {entry.doctorName && (
                      <p className="text-[10px] text-muted-foreground">Dr. {entry.doctorName.replace(/^Dr\.?\s*/i, "")}</p>
                    )}
                    {entry.note && <p className="text-[10px] text-muted-foreground italic">{entry.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedHistory.length === 0 && !isEditable && (
          <p className="text-[11px] text-muted-foreground/60 italic">No history recorded for this tooth.</p>
        )}
      </div>
    </div>
  );

  // ── Summary strip ─────────────────────────────────────────────────────────
  const conditionCounts = Object.values(effectiveData).reduce<Record<string, number>>((acc, t) => {
    if (t.condition) acc[t.condition] = (acc[t.condition] ?? 0) + 1;
    return acc;
  }, {});
  const affectedCount = Object.keys(conditionCounts).reduce((s, k) => s + conditionCounts[k], 0);

  const summaryStrip = affectedCount > 0 && (
    <div className="mx-3 mb-2 flex flex-wrap gap-1.5 px-2 py-1.5 rounded-lg bg-muted/20 border border-border/40">
      {(Object.entries(conditionCounts) as [ToothCondition, number][]).map(([k, n]) => (
        <span key={k} className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
          style={{ background: CONDITION_META[k]?.fill ?? "#F3F4F6", borderColor: CONDITION_META[k]?.stroke ?? "#9CA3AF", color: CONDITION_META[k]?.text ?? "#4B5563" }}>
          {CONDITION_META[k]?.label ?? k} · {n}
        </span>
      ))}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-border/50 bg-muted/10 flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {Object.keys(localEdits).length > 0
              ? <span className="font-semibold text-green-700">{Object.keys(localEdits).length} tooth{Object.keys(localEdits).length !== 1 ? "s" : ""} edited this visit</span>
              : affectedCount > 0
              ? <span>{affectedCount} tooth{affectedCount !== 1 ? "s" : ""} charted</span>
              : <span className="italic">No conditions recorded yet</span>
            }
          </span>
        </div>
        {!isEditable && (
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/40 border border-border/40 px-2 py-0.5 rounded-full">
            Read-only — visit not active
          </span>
        )}
        {isEditable && (
          <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50 px-2 py-0.5 rounded-full">
            Click a tooth to chart
          </span>
        )}
      </div>

      {/* Chart area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* SVG — scrollable horizontally if modal is very narrow */}
        <div className="overflow-x-auto px-3 pt-3 pb-1">
          {chartSvg}
        </div>
        {legendRow}
        {summaryStrip}
        {conditionPicker}
      </div>

      {/* Save footer */}
      {isEditable && (
        <div className="shrink-0 px-3 py-2 border-t border-border/50 bg-muted/10 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground font-mono">
            {isDirty ? "Unsaved changes" : chartResponse?.updatedAt
              ? `Saved ${(() => { try { return format(new Date(chartResponse.updatedAt), "dd MMM · HH:mm"); } catch { return ""; } })()}`
              : "Not yet saved"}
          </span>
          <Button
            size="sm"
            className="h-8 px-4 text-xs font-semibold gap-1.5"
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isPending}
            data-testid="button-save-odontogram"
          >
            {saveMutation.isPending
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Save className="h-3 w-3" />}
            Save Chart
          </Button>
        </div>
      )}
    </div>
  );
}
