import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Upload, ScanLine, AlertTriangle, CheckCircle2, Loader2,
  X, RotateCcw, Info, Microscope, Eye, EyeOff, Zap,
} from "lucide-react";
import { notify } from "@/lib/notify";
import { API_BASE_URL } from "@/lib/queryClient";

/* ─── Types (match backend exactly) ─── */
interface XrayLocation {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface XrayFinding {
  class_id: number;
  label: string;
  confidence: number;
  location: XrayLocation;
}

type FindingType = "deep-caries" | "caries" | "impacted" | "unknown";
type FilterType = "all" | FindingType;

/* ─── Semantic colour mapping by finding type ─── */
const TYPE_META: Record<
  FindingType,
  {
    label: string;
    stroke: string;
    fill: string;
    badgeBg: string;
    badgeText: string;
    chipBg: string;
    chipText: string;
    chipBorder: string;
    chipOnBg: string;
    chipOnText: string;
    chipOnBorder: string;
    severity: string;
    severityClasses: string;
    rowBg: string;
    rowText: string;
    summaryText: string;
    lightBg: string;
    confThreshold: string; // confidence bar colour for this type
  }
> = {
  "deep-caries": {
    label: "Deep Caries",
    stroke: "stroke-rose-500",
    fill: "fill-rose-500",
    badgeBg: "bg-rose-50 dark:bg-rose-950/30",
    badgeText: "text-rose-700 dark:text-rose-400",
    chipBg: "bg-rose-50 dark:bg-rose-950/20",
    chipText: "text-rose-700 dark:text-rose-400",
    chipBorder: "border-rose-200 dark:border-rose-800",
    chipOnBg: "bg-rose-600",
    chipOnText: "text-white",
    chipOnBorder: "border-rose-600",
    severity: "Critical",
    severityClasses: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
    rowBg: "bg-rose-50 dark:bg-rose-950/20",
    rowText: "text-rose-700 dark:text-rose-400",
    summaryText: "text-rose-600 dark:text-rose-400",
    lightBg: "bg-rose-50 dark:bg-rose-950/10",
    confThreshold: "bg-rose-500",
  },
  caries: {
    label: "Caries",
    stroke: "stroke-amber-500",
    fill: "fill-amber-500",
    badgeBg: "bg-amber-50 dark:bg-amber-950/30",
    badgeText: "text-amber-700 dark:text-amber-400",
    chipBg: "bg-amber-50 dark:bg-amber-950/20",
    chipText: "text-amber-700 dark:text-amber-400",
    chipBorder: "border-amber-200 dark:border-amber-800",
    chipOnBg: "bg-amber-600",
    chipOnText: "text-white",
    chipOnBorder: "border-amber-600",
    severity: "Moderate",
    severityClasses: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    rowBg: "bg-amber-50 dark:bg-amber-950/20",
    rowText: "text-amber-700 dark:text-amber-400",
    summaryText: "text-amber-600 dark:text-amber-400",
    lightBg: "bg-amber-50 dark:bg-amber-950/10",
    confThreshold: "bg-amber-500",
  },
  impacted: {
    label: "Impacted",
    stroke: "stroke-blue-500",
    fill: "fill-blue-500",
    badgeBg: "bg-blue-50 dark:bg-blue-950/30",
    badgeText: "text-blue-700 dark:text-blue-400",
    chipBg: "bg-blue-50 dark:bg-blue-950/20",
    chipText: "text-blue-700 dark:text-blue-400",
    chipBorder: "border-blue-200 dark:border-blue-800",
    chipOnBg: "bg-blue-600",
    chipOnText: "text-white",
    chipOnBorder: "border-blue-600",
    severity: "Structural",
    severityClasses: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    rowBg: "bg-blue-50 dark:bg-blue-950/20",
    rowText: "text-blue-700 dark:text-blue-400",
    summaryText: "text-blue-600 dark:text-blue-400",
    lightBg: "bg-blue-50 dark:bg-blue-950/10",
    confThreshold: "bg-blue-500",
  },
  unknown: {
    label: "Unknown",
    stroke: "stroke-slate-500",
    fill: "fill-slate-500",
    badgeBg: "bg-slate-50 dark:bg-slate-950/30",
    badgeText: "text-slate-700 dark:text-slate-400",
    chipBg: "bg-slate-50 dark:bg-slate-950/20",
    chipText: "text-slate-700 dark:text-slate-400",
    chipBorder: "border-slate-200 dark:border-slate-800",
    chipOnBg: "bg-slate-600",
    chipOnText: "text-white",
    chipOnBorder: "border-slate-600",
    severity: "Unknown",
    severityClasses: "bg-slate-50 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400",
    rowBg: "bg-slate-50 dark:bg-slate-950/20",
    rowText: "text-slate-700 dark:text-slate-400",
    summaryText: "text-slate-600 dark:text-slate-400",
    lightBg: "bg-slate-50 dark:bg-slate-950/10",
    confThreshold: "bg-slate-500",
  },
};

/* ─── Confidence bar colour (for the bar inside each row) ─── */
const CONFIDENCE_BAR = (c: number) => {
  if (c >= 85) return "bg-emerald-500";
  if (c >= 65) return "bg-amber-500";
  return "bg-slate-400";
};
const CONFIDENCE_PCT = (c: number) => {
  if (c >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (c >= 65) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
};
const CONFIDENCE_LABEL = (c: number) => {
  if (c >= 85) return "High";
  if (c >= 65) return "Medium";
  return "Low";
};

/* ─── Helpers ─── */
function normalizeLabel(label: string): FindingType {
  const lower = label.toLowerCase();
  if (lower.includes("deep") && lower.includes("caries")) return "deep-caries";
  if (lower.includes("caries")) return "caries";
  if (lower.includes("impacted") || lower.includes("impact")) return "impacted";
  return "unknown";
}

function groupByType(findings: XrayFinding[]): Record<FindingType, XrayFinding[]> {
  const groups: Record<FindingType, XrayFinding[]> = {
    "deep-caries": [],
    caries: [],
    impacted: [],
    unknown: [],
  };
  for (const f of findings) {
    groups[normalizeLabel(f.label)].push(f);
  }
  return groups;
}

function highestConfidence(findings: XrayFinding[]): number {
  if (findings.length === 0) return 0;
  return Math.max(...findings.map((f) => f.confidence));
}

/* ─── SVG Annotation Overlay ─── */
function AnnotationOverlay({
  findings,
  naturalW,
  naturalH,
  containerW,
  containerH,
  threshold,
  activeFilter,
  hoveredId,
  onHoverId,
  showOverlay,
}: {
  findings: XrayFinding[];
  naturalW: number;
  naturalH: number;
  containerW: number;
  containerH: number;
  threshold: number;
  activeFilter: FilterType;
  hoveredId: number | null;
  onHoverId: (id: number | null) => void;
  showOverlay: boolean;
}) {
  const scaleX = containerW / naturalW;
  const scaleY = containerH / naturalH;

  if (!showOverlay) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${containerW} ${containerH}`}
      preserveAspectRatio="none"
    >
      {findings.map((f, idx) => {
        const type = normalizeLabel(f.label);
        const meta = TYPE_META[type];
        const visible =
          f.confidence >= threshold && (activeFilter === "all" || activeFilter === type);
        const isHovered = hoveredId === idx;

        if (!visible) return null;

        const bx = f.location.x * scaleX;
        const by = f.location.y * scaleY;
        const bw = f.location.width * scaleX;
        const bh = f.location.height * scaleY;

        return (
          <g
            key={idx}
            className="pointer-events-auto"
            onMouseEnter={() => onHoverId(idx)}
            onMouseLeave={() => onHoverId(null)}
            onClick={() => onHoverId(idx)}
          >
            <rect
              x={bx}
              y={by}
              width={bw}
              height={bh}
              rx={3}
              ry={3}
              className={cn(
                "transition-all duration-200",
                meta.stroke,
                isHovered ? "fill-opacity-10 stroke-[2.5]" : "fill-transparent stroke-[1.5]",
                isHovered && meta.fill,
                !isHovered && "opacity-80"
              )}
              style={{
                filter: isHovered ? `drop-shadow(0 0 6px currentColor)` : undefined,
              }}
            />
            <rect
              x={bx}
              y={Math.max(by - 18, 0)}
              width={Math.min(bw, 60)}
              height={16}
              rx={3}
              ry={3}
              className={cn(meta.fill, "opacity-80")}
            />
            <text
              x={bx + 4}
              y={Math.max(by - 6, 10)}
              className="fill-white"
              style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 600 }}
            >
              {idx + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Tooltip for hovered annotation ─── */
function AnnotationTooltip({
  finding,
  visible,
  containerRect,
  mousePos,
}: {
  finding: XrayFinding | null;
  visible: boolean;
  containerRect: DOMRect | null;
  mousePos: { x: number; y: number };
}) {
  if (!visible || !finding || !containerRect) return null;

  const type = normalizeLabel(finding.label);
  const meta = TYPE_META[type];
  const barColor = CONFIDENCE_BAR(finding.confidence);

  // Position relative to container
  const left = Math.min(mousePos.x + 12, containerRect.width - 180);
  const top = Math.min(mousePos.y + 12, containerRect.height - 80);

  return (
    <div
      className="absolute z-20 rounded-lg border border-white/10 bg-[rgba(10,15,12,0.92)] backdrop-blur-sm p-2.5 shadow-xl pointer-events-none"
      style={{ left, top, minWidth: 160 }}
    >
      <p className="text-xs font-semibold text-white mb-1">{finding.label}</p>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${finding.confidence}%` }} />
        </div>
        <span className={cn("text-xs font-semibold font-mono", meta.rowText)}>
          {finding.confidence.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function XrayAnalysisTab() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 800, h: 600 });
  const [analysing, setAnalysing] = useState(false);
  const [findings, setFindings] = useState<XrayFinding[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [threshold, setThreshold] = useState(50);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
  const MAX_MB = 10;

  /* File handling */
  const handleFile = useCallback((f: File) => {
    if (!ACCEPTED.includes(f.type)) {
      notify.error("Please upload a JPEG, PNG, WebP or BMP image.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      notify.error(`File exceeds ${MAX_MB} MB limit.`);
      return;
    }
    setFile(f);
    setFindings(null);
    setErrorMsg(null);
    setActiveFilter("all");
    setThreshold(50);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const analyse = useCallback(async () => {
    if (!file) return;
    setAnalysing(true);
    setErrorMsg(null);
    setFindings(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/xray/analyse`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || "Analysis failed. Please try again.");
        return;
      }
      setFindings(data.findings);
      if (data.findings.length === 0) {
        notify.success("Analysis complete — no findings detected.");
      } else {
        notify.success(`Analysis complete — ${data.findings.length} finding(s) detected.`);
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
    } finally {
      setAnalysing(false);
    }
  }, [file]);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setFindings(null);
    setErrorMsg(null);
    setActiveFilter("all");
    setThreshold(50);
    setHoveredId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /* Mouse tracking for tooltip */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!imageWrapRef.current) return;
    const rect = imageWrapRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setContainerRect(rect);
  }, []);

  /* Derived data */
  const filteredFindings = useMemo(() => {
    if (!findings) return [];
    return findings.filter((f) => {
      const type = normalizeLabel(f.label);
      const typeMatch = activeFilter === "all" || activeFilter === type;
      const confMatch = f.confidence >= threshold;
      return typeMatch && confMatch;
    });
  }, [findings, activeFilter, threshold]);

  const grouped = useMemo(() => {
    if (!findings) return null;
    const g = groupByType(findings);
    // Only include groups that have visible findings after threshold+filter
    const result: Partial<Record<FindingType, XrayFinding[]>> = {};
    (Object.keys(g) as FindingType[]).forEach((type) => {
      const visible = g[type].filter((f) => {
        const typeMatch = activeFilter === "all" || activeFilter === type;
        return typeMatch && f.confidence >= threshold;
      });
      if (visible.length > 0) result[type] = visible;
    });
    return result;
  }, [findings, activeFilter, threshold]);

  const summaryCounts = useMemo(() => {
    if (!findings) return null;
    const g = groupByType(findings);
    return {
      "deep-caries": { count: g["deep-caries"].length, highest: highestConfidence(g["deep-caries"]) },
      caries: { count: g["caries"].length, highest: highestConfidence(g["caries"]) },
      impacted: { count: g["impacted"].length, highest: highestConfidence(g["impacted"]) },
    };
  }, [findings]);

  const hoveredFinding = hoveredId !== null && findings ? findings[hoveredId] : null;

  /* ─── Render ─── */
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Microscope className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground leading-tight">X-Ray Analysis</h2>
          <p className="text-xs text-muted-foreground">AI-powered dental finding detection</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3.5 py-3">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <span className="font-semibold">Clinical decision support only.</span> AI findings are not a diagnosis. Always apply your own clinical judgement. The model may take up to 60 seconds on first use.
        </p>
      </div>

      {/* Upload zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all min-h-[200px] px-6 py-10",
            dragging
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-border/60 bg-muted/20 hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/5"
          )}
          data-testid="xray-upload-zone"
        >
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Drop an X-ray image here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse — JPEG, PNG, WebP, BMP · max 10 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            data-testid="xray-file-input"
          />
        </div>
      )}

      {/* Image + actions */}
      {file && previewUrl && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <ScanLine className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate max-w-[240px]">{file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {findings !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOverlay((v) => !v)}
                  className="h-9 text-xs gap-1.5"
                  data-testid="button-toggle-overlay"
                >
                  {showOverlay ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showOverlay ? "Hide" : "Show"} overlay
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="h-9 text-xs gap-1.5 text-muted-foreground"
                data-testid="button-change-image"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Change image
              </Button>
            </div>
          </div>

          {/* Image viewer */}
          <div
            ref={imageWrapRef}
            className="relative rounded-xl overflow-hidden border border-border/50 bg-black dark:bg-white/5"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Toolbar inside viewer (dark) */}
            {findings !== null && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-[rgba(10,15,12,0.9)] backdrop-blur-sm border-b border-white/5">
                <span className="text-xs text-white/50 font-mono truncate">{file.name}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOverlay((v) => !v)}
                    className={cn(
                      "h-9 text-xs gap-1 text-white/70 hover:text-white hover:bg-white/10",
                      showOverlay && "bg-primary text-white hover:bg-primary"
                    )}
                  >
                    {showOverlay ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showOverlay ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={analyse}
                    disabled={analysing}
                    className="h-9 text-xs gap-1 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Re-analyse
                  </Button>
                </div>
              </div>
            )}

            {/* Image + SVG overlay */}
            <div className="relative w-full" style={{ aspectRatio: `${naturalSize.w} / ${naturalSize.h}` }}>
              <img
                ref={imgRef}
                src={previewUrl}
                alt="X-ray preview"
                className="w-full h-full object-contain"
              />
              {findings && (
                <AnnotationOverlay
                  findings={findings}
                  naturalW={naturalSize.w}
                  naturalH={naturalSize.h}
                  containerW={imageWrapRef.current?.clientWidth || naturalSize.w}
                  containerH={imageWrapRef.current?.clientHeight || naturalSize.h}
                  threshold={threshold}
                  activeFilter={activeFilter}
                  hoveredId={hoveredId}
                  onHoverId={setHoveredId}
                  showOverlay={showOverlay}
                />
              )}
              <AnnotationTooltip
                finding={hoveredFinding}
                visible={hoveredId !== null && showOverlay}
                containerRect={containerRect}
                mousePos={mousePos}
              />
            </div>

            {/* Legend + threshold */}
            {findings && findings.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-[rgba(10,15,12,0.9)] border-t border-white/5 flex-wrap">
                <div className="flex items-center gap-3">
                  {(Object.keys(TYPE_META) as FindingType[])
                    .filter((t) => t !== "unknown")
                    .map((type) => (
                      <div key={type} className="flex items-center gap-1.5">
                        <div className={cn("h-2 w-2 rounded-sm", TYPE_META[type].fill)} />
                        <span className="text-xs text-white/40 font-mono">{TYPE_META[type].label}</span>
                      </div>
                    ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-white/40">Min confidence</span>
                  <span className="text-xs text-primary font-semibold font-mono min-w-[32px]">{threshold}%</span>
                  <Slider
                    value={[threshold]}
                    onValueChange={(v) => setThreshold(v[0])}
                    min={50}
                    max={95}
                    step={1}
                    className="w-24 flex-shrink-0"
                  />
                </div>
              </div>
            )}

            {/* Analysing overlay */}
            {analysing && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-sm font-semibold">Analysing X-ray…</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take up to 60 seconds on first use</p>
                </div>
              </div>
            )}
          </div>

          {/* Analyse button (pre-analysis) */}
          {findings === null && !analysing && (
            <Button
              onClick={analyse}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-white h-10"
              data-testid="button-analyse-xray"
            >
              <ScanLine className="h-4 w-4" />
              Analyse X-Ray
            </Button>
          )}
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 px-3.5 py-3">
          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">Analysis failed</p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">{errorMsg}</p>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-400 hover:text-rose-600 shrink-0 h-9 w-9 flex items-center justify-center rounded-md hover:bg-rose-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Results */}
      {findings !== null && (
        <div className="space-y-4">
          {/* Summary row */}
          {summaryCounts && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(summaryCounts) as Array<keyof typeof summaryCounts>).map((type) => {
                const meta = TYPE_META[type];
                const { count, highest } = summaryCounts[type];
                const isActive = activeFilter === type;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(isActive ? "all" : type)}
                    className={cn(
                      "relative text-left rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
                      meta.chipBorder,
                      isActive && meta.lightBg,
                      !isActive && "bg-card border-border"
                    )}
                    data-testid={`summary-card-${type}`}
                  >
                    {/* Top accent bar */}
                    <div className={cn("absolute top-0 left-0 right-0 h-[3px] rounded-t-xl", meta.fill)} />
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn("h-2.5 w-2.5 rounded-full", meta.fill)} />
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", meta.severityClasses)}>
                        {meta.severity}
                      </span>
                    </div>
                    <div className={cn("text-2xl font-bold font-display", meta.summaryText)}>
                      {count}
                    </div>
                    <div className="text-sm font-semibold text-foreground">{meta.label}</div>
                    {count > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Highest confidence: {highest.toFixed(1)}%
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Analysis panel: image + findings */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
            {/* Image viewer (repeated for results phase, or just show the one above) */}
            {/* Actually the image viewer is already shown above. We just need the findings panel. */}
            {/* Findings panel */}
            <Card className="border-border/50 shadow-sm overflow-hidden flex flex-col max-h-[680px] lg:max-h-none">
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Findings</span>
                    <Badge className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary text-xs font-semibold px-2 py-0.5">
                      {filteredFindings.length}
                    </Badge>
                  </div>
                  {findings.length === 0 && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                </div>

                {/* Filter chips */}
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setActiveFilter("all")}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold transition-all",
                      activeFilter === "all"
                        ? "bg-foreground text-white border border-foreground"
                        : "bg-muted text-muted-foreground border border-border hover:border-primary/40"
                    )}
                    data-testid="filter-chip-all"
                  >
                    All
                  </button>
                  {(Object.keys(TYPE_META) as FindingType[])
                    .filter((t) => t !== "unknown")
                    .map((type) => (
                      <button
                        key={type}
                        onClick={() => setActiveFilter(isActiveFilter(type, activeFilter) ? "all" : type)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1",
                          activeFilter === type
                            ? `${metaFor(type).chipOnBg} ${metaFor(type).chipOnText} border ${metaFor(type).chipOnBorder}`
                            : `${metaFor(type).chipBg} ${metaFor(type).chipText} border ${metaFor(type).chipBorder}`
                        )}
                        data-testid={`filter-chip-${type}`}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", metaFor(type).fill)} />
                        {metaFor(type).label}
                      </button>
                    ))}
                </div>
              </div>

              {/* Grouped findings list */}
              <ScrollArea className="flex-1 min-h-0">
                {findings.length === 0 && (
                  <div className="px-4 py-6">
                    <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10">
                      <CardContent className="px-4 py-3">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          The AI model did not detect any notable findings in this image. This does not rule out pathology — please review the image directly.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {grouped && Object.keys(grouped).length === 0 && findings.length > 0 && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-muted-foreground">No findings match the current filter.</p>
                  </div>
                )}

                {grouped &&
                  (Object.keys(grouped) as FindingType[])
                    .filter((type) => grouped[type]?.length)
                    .map((type) => (
                      <div key={type}>
                        {/* Sticky group header */}
                        <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-2 flex items-center gap-2">
                          <div className={cn("h-3.5 w-1 rounded-sm", metaFor(type).fill)} />
                          <span className={cn("text-xs font-bold uppercase tracking-wider", metaFor(type).rowText)}>
                            {metaFor(type).label}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {grouped[type]?.length} finding{grouped[type]!.length > 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Rows */}
                        {grouped[type]!.map((f, i) => {
                          const originalIdx = findings.indexOf(f);
                          const isHovered = hoveredId === originalIdx;
                          const barColor = CONFIDENCE_BAR(f.confidence);
                          const pctColor = CONFIDENCE_PCT(f.confidence);
                          return (
                            <div
                              key={originalIdx}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 border-b border-border/50 cursor-pointer transition-colors",
                                isHovered && metaFor(type).rowBg,
                                "hover:bg-muted/50"
                              )}
                              onMouseEnter={() => setHoveredId(originalIdx)}
                              onMouseLeave={() => setHoveredId(null)}
                              onClick={() => setHoveredId(isHovered ? null : originalIdx)}
                              data-testid={`finding-row-${originalIdx}`}
                            >
                              {/* Number circle */}
                              <div
                                className={cn(
                                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                  metaFor(type).badgeBg,
                                  metaFor(type).rowText
                                )}
                              >
                                {originalIdx + 1}
                              </div>

                              {/* Body */}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{f.label}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={cn("h-full rounded-full transition-all", barColor)}
                                      style={{ width: `${f.confidence}%` }}
                                    />
                                  </div>
                                  <span className={cn("text-xs font-semibold font-mono min-w-[38px] text-right", pctColor)}>
                                    {f.confidence.toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              {/* Confidence label chip */}
                              <span
                                className={cn(
                                  "text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0",
                                  f.confidence >= 85
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                    : f.confidence >= 65
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                    : "bg-slate-50 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400"
                                )}
                              >
                                {CONFIDENCE_LABEL(f.confidence)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
              </ScrollArea>

              {/* Footer hint */}
              <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex-shrink-0 flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Tap or hover a finding to highlight its location on the image
                </span>
              </div>
            </Card>
          </div>

          {/* Re-analyse button (below results) */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={analyse}
              disabled={analysing}
              className="h-9 text-xs gap-1.5"
              data-testid="button-reanalyse"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-analyse
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small helpers ─── */
function isActiveFilter(type: FindingType, active: FilterType): boolean {
  return active === type;
}
function metaFor(type: FindingType) {
  return TYPE_META[type];
}
