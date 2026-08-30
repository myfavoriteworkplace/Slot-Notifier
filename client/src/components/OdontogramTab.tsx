import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, History, Save, AlertCircle, Trash2, Clock, ChevronDown, ChevronUp, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  getOdontogramToothReference,
  TOOTH_DISPLAY_ORDER,
  type OdontogramToothReference,
  type OdontogramToothType,
} from "./odontogram-reference";

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

const SVG_TOKENS = {
  card: "hsl(var(--card))",
  muted: "hsl(var(--muted))",
  border: "hsl(var(--border))",
  primary: "hsl(var(--primary))",
  mutedForeground: "hsl(var(--muted-foreground))",
};

const HEALTHY_STYLE = { fill: SVG_TOKENS.card, stroke: SVG_TOKENS.border };

// Display order is centralized in the Step 1 FDI reference guide.
const UPPER_RIGHT = TOOTH_DISPLAY_ORDER.upperRight;
const UPPER_LEFT = TOOTH_DISPLAY_ORDER.upperLeft;
const LOWER_RIGHT = TOOTH_DISPLAY_ORDER.lowerRight;
const LOWER_LEFT = TOOTH_DISPLAY_ORDER.lowerLeft;

// ── Tooth-type geometry ───────────────────────────────────────────────────────

type ToothType = OdontogramToothType;

function getToothType(fdi: number): ToothType {
  return getOdontogramToothReference(fdi).type;
}

// cW = cervical (gum) width — the wider side; oW = occlusal/incisal — narrower; h = crown height.
// These are base illustration units; each tooth's relative guide values scale them below.
interface CrownDims { cW: number; oW: number; h: number }
const BASE_CROWN_DIMS: Record<ToothType, CrownDims> = {
  incisor:  { cW: 17, oW: 15, h: 21 },
  canine:   { cW: 15, oW:  9, h: 24 },
  premolar: { cW: 15, oW: 13, h: 18 },
  molar:    { cW: 20, oW: 18, h: 14 },
};

// nW = neck width at cervical margin; h = relative root length.
interface RootDims { nW: number; h: number; rootCount: 1 | 2 | 3 }
const BASE_ROOT_DIMS: Record<ToothType, Omit<RootDims, "rootCount">> = {
  // Roots remain longer than crowns, but the previous shared 31-unit height
  // made posterior roots dominate the illustration.
  incisor:  { nW:  7, h: 22 },
  canine:   { nW:  7, h: 25 },
  premolar: { nW:  8, h: 21 },
  molar:    { nW: 18, h: 17 },
};

function getCrownDims(reference: OdontogramToothReference): CrownDims {
  const base = BASE_CROWN_DIMS[reference.type];
  return {
    cW: base.cW * reference.crownWidth,
    oW: base.oW * reference.crownWidth,
    h: base.h * reference.crownHeight,
  };
}

function getRootDims(reference: OdontogramToothReference): RootDims {
  const base = BASE_ROOT_DIMS[reference.type];
  return {
    nW: base.nW,
    h: base.h * reference.rootLength,
    rootCount: reference.rootCount,
  };
}

// ── SVG path generators ───────────────────────────────────────────────────────

function rootLean(reference: OdontogramToothReference, amount: number): number {
  if (reference.rootCurve === "neutral") return 0;
  const towardMidline = reference.rootCurve === "toward-midline";
  const sideDirection = reference.side === "right" ? 1 : -1;
  return (towardMidline ? -1 : 1) * sideDirection * amount;
}

// Single root pointing UP (upper arch) — gently tapers and curves into a rounded apex.
function rootUp(cx: number, cervY: number, apexY: number, nW: number, leanDirection = 0): string {
  const n = nW / 2, h = cervY - apexY;
  const lean = nW >= 15 ? 1.2 : nW <= 7 ? 0.8 : 0.4;
  const apexCx = cx + leanDirection;
  return `M ${cx-n},${cervY}
    C ${cx-n*1.05},${cervY-h*0.38} ${apexCx-lean-1},${apexY+9} ${apexCx-lean},${apexY+2}
    Q ${apexCx},${apexY-1} ${apexCx+lean},${apexY+2}
    C ${apexCx+lean+1},${apexY+9} ${cx+n*1.05},${cervY-h*0.38} ${cx+n},${cervY} Z`;
}

// Single root pointing DOWN (lower arch).
function rootDown(cx: number, cervY: number, apexY: number, nW: number, leanDirection = 0): string {
  const n = nW / 2, h = apexY - cervY;
  const lean = nW >= 15 ? 1.2 : nW <= 7 ? 0.8 : 0.4;
  const apexCx = cx + leanDirection;
  return `M ${cx-n},${cervY}
    C ${cx-n*1.05},${cervY+h*0.38} ${apexCx-lean-1},${apexY-9} ${apexCx-lean},${apexY-2}
    Q ${apexCx},${apexY+1} ${apexCx+lean},${apexY-2}
    C ${apexCx+lean+1},${apexY-9} ${cx+n*1.05},${cervY+h*0.38} ${cx+n},${cervY} Z`;
}

// Two diverging roots pointing UP (upper molars). Each root is closed
// independently so the furcation remains visible at all fill colours.
function dualRootsUp(cx: number, cervY: number, apexY: number, nW: number, leanDirection = 0): string {
  const n = nW / 2, h = cervY - apexY, s = 4.7, g = 2;
  const lA = cx - s + leanDirection * 0.45, rA = cx + s + leanDirection;
  return (
    `M ${cx-n},${cervY} C ${cx-n},${cervY-h*0.5} ${lA-2},${apexY+9} ${lA},${apexY} Q ${lA+0.5},${apexY-1} ${lA+1},${apexY+1} C ${lA+2.5},${apexY+8} ${cx-g},${cervY-h*0.45} ${cx-g},${cervY} Z ` +
    `M ${cx+g},${cervY} C ${cx+g},${cervY-h*0.45} ${rA-2.5},${apexY+8} ${rA-0.5},${apexY+1} Q ${rA},${apexY-1} ${rA+0.5},${apexY} C ${rA+2},${apexY+9} ${cx+n},${cervY-h*0.5} ${cx+n},${cervY} Z`
  );
}

// Two diverging roots pointing DOWN (lower molars).
function dualRootsDown(cx: number, cervY: number, apexY: number, nW: number, leanDirection = 0): string {
  const n = nW / 2, h = apexY - cervY, s = 4.7, g = 2;
  const lA = cx - s + leanDirection * 0.45, rA = cx + s + leanDirection;
  return (
    `M ${cx-n},${cervY} C ${cx-n},${cervY+h*0.5} ${lA-2},${apexY-9} ${lA},${apexY} Q ${lA+0.5},${apexY+1} ${lA+1},${apexY-1} C ${lA+2.5},${apexY-8} ${cx-g},${cervY+h*0.45} ${cx-g},${cervY} Z ` +
    `M ${cx+g},${cervY} C ${cx+g},${cervY+h*0.45} ${rA-2.5},${apexY-8} ${rA-0.5},${apexY-1} Q ${rA},${apexY+1} ${rA+0.5},${apexY} C ${rA+2},${apexY-9} ${cx+n},${cervY+h*0.5} ${cx+n},${cervY} Z`
  );
}

function tripleRootsUp(cx: number, cervY: number, apexY: number, nW: number, leanDirection = 0): string {
  const h = cervY - apexY;
  const sideOffset = nW * 0.28;
  const sideWidth = Math.max(4.5, nW * 0.26);
  const palatalWidth = Math.max(5.5, nW * 0.34);
  const leftApex = cx - sideOffset + leanDirection * 0.45;
  const rightApex = cx + sideOffset + leanDirection;
  const palatalApex = cx + leanDirection * 0.4;
  const root = (rootCx: number, width: number, apexCx: number) => {
    const n = width / 2;
    return `M ${rootCx-n},${cervY} C ${rootCx-n*1.05},${cervY-h*0.5} ${apexCx-n*0.35},${apexY+9} ${apexCx},${apexY} Q ${apexCx+0.5},${apexY-1} ${apexCx+1},${apexY+1} C ${apexCx+2},${apexY+9} ${rootCx+n*1.05},${cervY-h*0.5} ${rootCx+n},${cervY} Z`;
  };
  return [
    root(cx - nW * 0.28, sideWidth, leftApex),
    root(cx + nW * 0.28, sideWidth, rightApex),
    root(cx, palatalWidth, palatalApex),
  ].join(" ");
}

function tripleRootsDown(cx: number, cervY: number, apexY: number, nW: number, leanDirection = 0): string {
  const h = apexY - cervY;
  const sideOffset = nW * 0.28;
  const sideWidth = Math.max(4.5, nW * 0.26);
  const palatalWidth = Math.max(5.5, nW * 0.34);
  const leftApex = cx - sideOffset + leanDirection * 0.45;
  const rightApex = cx + sideOffset + leanDirection;
  const palatalApex = cx + leanDirection * 0.4;
  const root = (rootCx: number, width: number, apexCx: number) => {
    const n = width / 2;
    return `M ${rootCx-n},${cervY} C ${rootCx-n*1.05},${cervY+h*0.5} ${apexCx-n*0.35},${apexY-9} ${apexCx},${apexY} Q ${apexCx+0.5},${apexY+1} ${apexCx+1},${apexY-1} C ${apexCx+2},${apexY-9} ${rootCx+n*1.05},${cervY+h*0.5} ${rootCx+n},${cervY} Z`;
  };
  return [
    root(cx - nW * 0.28, sideWidth, leftApex),
    root(cx + nW * 0.28, sideWidth, rightApex),
    root(cx, palatalWidth, palatalApex),
  ].join(" ");
}

// Crown for UPPER arch: cervical (wider) at top y0, occlusal (narrower) at bottom y0+h
function crownUp(cx: number, y0: number, { cW, oW, h }: CrownDims, reference: OdontogramToothReference): string {
  const type = reference.type;
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
function crownDown(cx: number, y0: number, { cW, oW, h }: CrownDims, reference: OdontogramToothReference): string {
  const type = reference.type;
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

// Fine occlusal/incisal anatomy drawn above the condition fill. These marks
// intentionally stay presentation-only: they do not represent a diagnosis.
function crownAnatomy(
  cx: number,
  y0: number,
  dims: CrownDims,
  reference: OdontogramToothReference,
  arch: "upper" | "lower",
  stroke: string,
) {
  const type = reference.type;
  const y1 = y0 + dims.h;
  const direction = arch === "upper" ? 1 : -1;
  const opacity = 0.55;
  const lineProps = {
    fill: "none",
    stroke,
    strokeWidth: 0.65,
    strokeLinecap: "round" as const,
    opacity,
    pointerEvents: "none" as const,
  };

  if (type === "molar") {
    const surfaceY = arch === "upper" ? y1 - 3.5 : y0 + 3.5;
    const cuspScale = Math.min(1, Math.max(0.75, reference.cuspCount / 5));
    const cuspSpan = dims.oW * 0.36 * cuspScale;
    return (
      <g {...lineProps}>
        <path d={`M ${cx - cuspSpan},${surfaceY} Q ${cx - 1},${surfaceY - direction * 2.2} ${cx},${surfaceY + direction * 0.4} Q ${cx + 1},${surfaceY - direction * 2.2} ${cx + cuspSpan},${surfaceY}`} />
        <path d={`M ${cx - dims.oW * 0.42},${surfaceY - direction * 1.2} Q ${cx - dims.oW * 0.2},${surfaceY + direction * 2.2} ${cx - 1.5},${surfaceY + direction * 1.1}`} />
        <path d={`M ${cx + dims.oW * 0.42},${surfaceY - direction * 1.2} Q ${cx + dims.oW * 0.2},${surfaceY + direction * 2.2} ${cx + 1.5},${surfaceY + direction * 1.1}`} />
        {reference.hasMolarRidge && (
          <path d={`M ${cx - dims.oW * 0.24},${surfaceY - direction * 0.4} Q ${cx - 1},${y0 + dims.h * 0.52} ${cx + dims.oW * 0.28},${y0 + dims.h * 0.3}`} />
        )}
        {reference.cuspPattern === "lower-molar" && (
          <>
            <path d={`M ${cx},${surfaceY - direction * 0.5} Q ${cx - 1.4},${y0 + dims.h * 0.48} ${cx},${y0 + dims.h * 0.26}`} />
            <path d={`M ${cx - dims.oW * 0.29},${y0 + dims.h * 0.47} Q ${cx},${surfaceY - direction * 0.1} ${cx + dims.oW * 0.29},${y0 + dims.h * 0.47}`} />
          </>
        )}
        {reference.cuspPattern === "variable" && (
          <path d={`M ${cx - dims.oW * 0.16},${surfaceY - direction * 0.6} Q ${cx + 1.4},${y0 + dims.h * 0.48} ${cx + dims.oW * 0.18},${surfaceY}`} />
        )}
      </g>
    );
  }

  if (type === "premolar") {
    const surfaceY = arch === "upper" ? y1 - 2.5 : y0 + 2.5;
    const firstPremolar = reference.number % 10 === 4;
    const buccalCusp = dims.oW * (firstPremolar ? 0.31 : 0.27);
    const lingualCusp = dims.oW * (firstPremolar ? 0.2 : 0.24);
    return (
      <g {...lineProps}>
        <path d={`M ${cx - buccalCusp},${surfaceY - direction * 0.8} Q ${cx},${surfaceY + direction * 2} ${cx + lingualCusp},${surfaceY - direction * 0.2}`} />
        <path d={`M ${cx - buccalCusp * 0.72},${surfaceY - direction * 0.1} Q ${cx},${surfaceY + direction * 2.5} ${cx + lingualCusp},${surfaceY - direction * 0.2}`} />
        <path d={`M ${cx},${y0 + dims.h * 0.34} Q ${cx - 1.2},${y0 + dims.h * 0.55} ${cx},${surfaceY - direction * 0.8}`} />
      </g>
    );
  }

  if (type === "canine") {
    return (
      <path
        d={`M ${cx},${arch === "upper" ? y1 - 1.5 : y0 + 1.5} C ${cx - 1},${y0 + dims.h * 0.5} ${cx - 1},${y0 + dims.h * 0.64} ${cx - 0.4},${y0 + dims.h * 0.78}`}
        {...lineProps}
      />
    );
  }

  return (
    <path
      d={`M ${cx - dims.oW * 0.28},${arch === "upper" ? y1 - 1.5 : y0 + 1.5} Q ${cx},${arch === "upper" ? y1 - 0.3 : y0 + 0.3} ${cx + dims.oW * 0.28},${arch === "upper" ? y1 - 1.5 : y0 + 1.5}`}
      {...lineProps}
    />
  );
}

// ── Fixed Y anchors ───────────────────────────────────────────────────────────

const STEP         = 24;
const MIDLINE_EXTRA = 8;
const START_CX     = 19;   // cx of first tooth slot

const UPPER_ROOT_Y  = 10;  // safe top boundary for upper root tips
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

// Keep the divider in the space between the two central incisors. Deriving it
// from their slot centers keeps it aligned if the chart spacing changes.
const VERTICAL_MIDLINE_X = (toothCx(11) + toothCx(21)) / 2;

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
  const [isFocused, setIsFocused] = useState(false);
  const reference = getOdontogramToothReference(tooth);
  const cx    = toothCx(tooth);
  const cond  = state?.condition ?? null;
  const meta  = cond ? CONDITION_META[cond] : null;
  const crownStroke = meta ? meta.stroke : HEALTHY_STYLE.stroke;
  const isMissing   = cond === "missing";
  const hasHistory  = (state?.history?.length ?? 0) > 0;

  const type  = getToothType(tooth);
  const dims  = getCrownDims(reference);
  const rdims = getRootDims(reference);

  const SEL   = SVG_TOKENS.primary;
  const cSW   = isSelected ? 1.8 : 1;
  const cCol  = isSelected ? SEL : crownStroke;
   const toothLabel = `Tooth ${tooth}, ${getOdontogramToothReference(tooth).displayName}`;

  // Y anchors
  const crownY0 = arch === "upper" ? UPPER_CROWN_Y : LOWER_CROWN_Y;
  const labelY  = arch === "upper" ? UPPER_LABEL_Y : LOWER_LABEL_Y;
  // cervical margin (root meets crown)
  const cervY   = arch === "upper" ? UPPER_CROWN_Y : LOWER_CROWN_Y + dims.h;
  // root apex
  const apexY   = arch === "upper"
    ? Math.max(UPPER_ROOT_Y, UPPER_CROWN_Y - rdims.h)
    : LOWER_CROWN_Y + dims.h + rdims.h;

  // ── Paths ──
  const crownPath = arch === "upper"
    ? crownUp(cx, crownY0, dims, reference)
    : crownDown(cx, crownY0, dims, reference);

  const rootLeanDirection = rootLean(reference, type === "molar" ? 1.2 : 0.7);
  const rootPath = rdims.rootCount === 3
    ? (arch === "upper"
      ? tripleRootsUp(cx, cervY, apexY, rdims.nW, rootLeanDirection)
      : tripleRootsDown(cx, cervY, apexY, rdims.nW, rootLeanDirection))
    : rdims.rootCount === 2
      ? (arch === "upper"
        ? dualRootsUp(cx, cervY, apexY, rdims.nW, rootLeanDirection)
        : dualRootsDown(cx, cervY, apexY, rdims.nW, rootLeanDirection))
      : (arch === "upper"
        ? rootUp(cx, cervY, apexY, rdims.nW, rootLeanDirection)
        : rootDown(cx, cervY, apexY, rdims.nW, rootLeanDirection));

  // ── Elements ──
  const rootEl = (
    <path d={rootPath}
      fill={isMissing ? "url(#odontogram-root-missing)" : "url(#odontogram-root-healthy)"}
      stroke={isSelected ? SEL : SVG_TOKENS.border}
      strokeWidth={isSelected ? 1.5 : 0.6}
      strokeDasharray={isMissing ? "3 2" : undefined}
      filter="url(#odontogram-root-shadow)"
    />
  );

  const crownEl = (
    <path d={crownPath}
      fill={meta ? `url(#odontogram-crown-${cond})` : "url(#odontogram-crown-healthy)"}
      stroke={cCol}
      strokeWidth={cSW}
      strokeDasharray={isMissing ? "3 2" : undefined}
      filter="url(#odontogram-tooth-shadow)"
    />
  );

  const anatomyEl = crownAnatomy(cx, crownY0, dims, reference, arch, meta?.stroke ?? SVG_TOKENS.mutedForeground);

  // Keep the detailed silhouette easy to select on touch screens. The target
  // covers the root and crown but remains visually transparent.
  const hitTarget = (
    <rect
      x={cx - Math.max(dims.cW, rdims.nW) / 2 - 4}
      y={arch === "upper" ? UPPER_ROOT_Y - 2 : crownY0 - 3}
      width={Math.max(dims.cW, rdims.nW) + 8}
      height={arch === "upper"
        ? crownY0 + dims.h - UPPER_ROOT_Y + 6
        : apexY - crownY0 + 6}
      fill="#FFFFFF"
      fillOpacity={0}
      stroke="none"
      pointerEvents="all"
      aria-hidden="true"
    />
  );

  // Missing X — crosses through the crown bounding box
  const mxH = dims.cW / 2;
  const missingX = isMissing && (
    <g>
      <line x1={cx - mxH + 4} y1={crownY0 + 3} x2={cx + mxH - 4} y2={crownY0 + dims.h - 3} stroke={SVG_TOKENS.mutedForeground} strokeWidth={1.2} />
      <line x1={cx + mxH - 4} y1={crownY0 + 3} x2={cx - mxH + 4} y2={crownY0 + dims.h - 3} stroke={SVG_TOKENS.mutedForeground} strokeWidth={1.2} />
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

  const focusRing = isFocused && !isSelected && (
    <rect
      x={cx - dims.cW / 2 - 3} y={crownY0 - 3}
      width={dims.cW + 6} height={dims.h + 6}
      rx={4} fill="none"
      stroke={SEL} strokeWidth={1.2} strokeDasharray="2 2" opacity={0.85}
      pointerEvents="none"
    />
  );

  // Indicator dots — top-right of crown
  const dotX = cx + dims.cW / 2 - 1;
  const newDot  = isNewThisVisit && <circle cx={dotX} cy={crownY0 + 1} r={3} fill={SVG_TOKENS.primary} />;
  const histDot = !isNewThisVisit && hasHistory && <circle cx={dotX} cy={crownY0 + 1} r={2.5} fill={SVG_TOKENS.mutedForeground} opacity={0.7} />;

  const label = (
    <text x={cx} y={labelY} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
      fill={isSelected ? SVG_TOKENS.primary : SVG_TOKENS.mutedForeground} fontWeight={isSelected ? "700" : "500"}>
      {tooth}
    </text>
  );

  return (
    <g
       onClick={onClick}
       onKeyDown={(event) => {
         if (event.key === "Enter" || event.key === " ") {
           event.preventDefault();
           onClick();
         }
       }}
       onFocus={() => setIsFocused(true)}
       onBlur={() => setIsFocused(false)}
       role="button"
       tabIndex={0}
       aria-label={`${toothLabel}${meta ? `, ${meta.label}` : ", no condition recorded"}${isNewThisVisit ? ", edited this visit" : hasHistory ? ", has visit history" : ""}${isEditable ? ", editable" : ", read-only"}`}
       aria-pressed={isSelected}
       data-testid={`button-tooth-${tooth}`}
       style={{ cursor: "pointer" }}
       opacity={isMissing && !isSelected ? 0.7 : 1}>
      {hitTarget}
      {arch === "upper"
        ? <>{rootEl}{crownEl}{anatomyEl}{missingX}{selRing}{focusRing}{newDot}{histDot}{label}</>
        : <>{label}{crownEl}{anatomyEl}{missingX}{selRing}{focusRing}{newDot}{histDot}{rootEl}</>
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
  const [zoom, setZoom] = useState(100);

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
    const today = format(new Date(), "yyyy-MM-dd");
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
      <div className="flex items-center justify-center py-16" role="status" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading chart…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 m-4" role="alert">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Could not load chart — patient record may not be linked to this booking.</span>
      </div>
    );
  }

  // ── Chart SVG ───────────────────────────────────────────────────────────────
  const svgViewBox = "0 0 410 185";
  const chartMinWidth = 410;

  const MidlineY    = MIDLINE_Y;
  const MidlineX1   = 6;
  const MidlineX2   = 404;
  const VertMidX    = VERTICAL_MIDLINE_X;

  const chartSvg = (
    <svg
      viewBox={svgViewBox}
      xmlns="http://www.w3.org/2000/svg"
      role="group"
      aria-label="Dental odontogram chart. Select any tooth to inspect its recorded condition."
      style={{
        width: `${zoom}%`,
        height: "auto",
         minWidth: chartMinWidth,
        display: "block",
      }}
    >
      <defs>
        <linearGradient id="odontogram-crown-healthy" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={SVG_TOKENS.card} stopOpacity={0.98} />
          <stop offset="58%" stopColor={SVG_TOKENS.card} stopOpacity={0.9} />
          <stop offset="100%" stopColor={SVG_TOKENS.card} stopOpacity={0.72} />
        </linearGradient>
        {(Object.keys(CONDITION_META) as ToothCondition[]).map((condition) => (
          <linearGradient key={condition} id={`odontogram-crown-${condition}`} x1="0" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor={CONDITION_META[condition].fill} stopOpacity={0.98} />
            <stop offset="58%" stopColor={CONDITION_META[condition].fill} stopOpacity={0.9} />
            <stop offset="100%" stopColor={CONDITION_META[condition].fill} stopOpacity={0.76} />
          </linearGradient>
        ))}
        <linearGradient id="odontogram-root-healthy" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={SVG_TOKENS.card} stopOpacity={0.86} />
          <stop offset="100%" stopColor={SVG_TOKENS.card} stopOpacity={0.54} />
        </linearGradient>
        <linearGradient id="odontogram-root-missing" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={SVG_TOKENS.muted} stopOpacity={0.72} />
          <stop offset="100%" stopColor={SVG_TOKENS.muted} stopOpacity={0.38} />
        </linearGradient>
        <filter id="odontogram-tooth-shadow" x="-35%" y="-35%" width="170%" height="180%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.75" floodColor="#0f172a" floodOpacity="0.16" />
        </filter>
        <filter id="odontogram-root-shadow" x="-35%" y="-15%" width="170%" height="140%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="0.45" stdDeviation="0.55" floodColor="#0f172a" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Quadrant labels */}
      <text x={100} y={5} textAnchor="middle" fontSize={6} fill={SVG_TOKENS.mutedForeground} fontFamily="monospace" fontWeight="600">Q1 · UPPER RIGHT</text>
      <text x={308} y={5} textAnchor="middle" fontSize={6} fill={SVG_TOKENS.mutedForeground} fontFamily="monospace" fontWeight="600">Q2 · UPPER LEFT</text>
      <text x={308} y={183} textAnchor="middle" fontSize={6} fill={SVG_TOKENS.mutedForeground} fontFamily="monospace" fontWeight="600">Q3 · LOWER LEFT</text>
      <text x={100} y={183} textAnchor="middle" fontSize={6} fill={SVG_TOKENS.mutedForeground} fontFamily="monospace" fontWeight="600">Q4 · LOWER RIGHT</text>

      {/* Midline cross lines */}
      <line x1={MidlineX1} y1={MidlineY} x2={MidlineX2} y2={MidlineY} stroke={SVG_TOKENS.border} strokeWidth={0.8} />
      <line x1={VertMidX} y1={UPPER_ROOT_Y} x2={VertMidX} y2={172} stroke={SVG_TOKENS.border} strokeWidth={0.8} strokeDasharray="2 2" />

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
          <span className="text-xs text-green-700 dark:text-green-400 truncate">— {getOdontogramToothReference(selectedTooth).displayName}</span>
          {isNewThisVisit(selectedTooth) && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white">Edited</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelectedTooth(null)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all shrink-0"
          aria-label="Close tooth detail"
          data-testid={`button-close-tooth-detail-${selectedTooth}`}
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
                    type="button"
                    onClick={() => handleConditionSelect(isActive ? null : k)}
                    data-testid={`button-condition-${k}-${selectedTooth}`}
                    aria-pressed={isActive}
                    className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg border p-1.5 text-center transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      isActive
                        ? "border-2 shadow-sm"
                        : "border-border/50 bg-card hover:border-border"
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
                type="button"
                onClick={() => handleConditionSelect(null)}
                data-testid={`button-clear-condition-${selectedTooth}`}
                className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-rose-300 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 transition-all"
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

        {selectedToothState?.note && (
          <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current note</p>
            <p className="mt-1 text-xs text-foreground">{selectedToothState.note}</p>
          </div>
        )}

        {/* History */}
        {selectedHistory.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowHistory(v => !v)}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
              aria-expanded={showHistory}
              data-testid={`button-toggle-tooth-history-${selectedTooth}`}
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
                           try {
                             const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? parseISO(entry.date) : new Date(entry.date);
                             return format(dateValue, "dd MMM yyyy");
                           } catch {
                             return entry.date;
                           }
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
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/60 p-0.5" aria-label="Chart zoom controls">
          <button
            type="button"
             className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40"
            onClick={() => setZoom(value => Math.max(80, value - 10))}
            disabled={zoom <= 80}
            aria-label="Zoom out"
            data-testid="button-odontogram-zoom-out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3.5rem] text-center text-[10px] font-semibold tabular-nums text-muted-foreground" aria-live="polite">
            {zoom}%
          </span>
          <button
            type="button"
             className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40"
            onClick={() => setZoom(value => Math.min(160, value + 10))}
            disabled={zoom >= 160}
            aria-label="Zoom in"
            data-testid="button-odontogram-zoom-in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
             className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40"
            onClick={() => setZoom(100)}
            disabled={zoom === 100}
            aria-label="Reset chart zoom"
            data-testid="button-odontogram-zoom-reset"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 overflow-auto min-h-0">
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
