import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload, ScanLine, AlertTriangle, CheckCircle2, Loader2,
  X, ZoomIn, RotateCcw, Info, Microscope,
} from "lucide-react";
import { notify } from "@/lib/notify";

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

const CONFIDENCE_COLOR = (c: number) => {
  if (c >= 85) return { bar: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800" };
  if (c >= 65) return { bar: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" };
  return { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" };
};

const CONFIDENCE_LABEL = (c: number) => {
  if (c >= 85) return "High";
  if (c >= 65) return "Medium";
  return "Low";
};

const BOX_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6",
];

function DrawingCanvas({
  imageUrl,
  findings,
  naturalW,
  naturalH,
}: {
  imageUrl: string;
  findings: XrayFinding[];
  naturalW: number;
  naturalH: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !imgRef.current) return;
    const dw = canvas.width;
    const dh = canvas.height;
    const scaleX = dw / naturalW;
    const scaleY = dh / naturalH;
    ctx.clearRect(0, 0, dw, dh);
    ctx.drawImage(imgRef.current, 0, 0, dw, dh);
    findings.forEach((f, i) => {
      const color = BOX_COLORS[i % BOX_COLORS.length];
      const { x, y, width: w, height: h } = f.location;
      const bx = x * scaleX;
      const by = y * scaleY;
      const bw = w * scaleX;
      const bh = h * scaleY;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = color + "33";
      ctx.fillRect(bx, by, bw, bh);
      const label = `${i + 1}. ${f.label} (${f.confidence.toFixed(0)}%)`;
      const fontSize = Math.max(10, Math.min(14, dw / 40));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textW = ctx.measureText(label).width + 8;
      const textH = fontSize + 6;
      ctx.fillStyle = color;
      ctx.fillRect(bx, by - textH, textW, textH);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, bx + 4, by - 4);
    });
  }, [findings, naturalW, naturalH]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={Math.round(800 * (naturalH / naturalW))}
      className="w-full rounded-xl border border-border/50 shadow-sm"
      style={{ maxHeight: 480, objectFit: "contain" }}
    />
  );
}

export default function XrayAnalysisTab() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 800, h: 600 });
  const [analysing, setAnalysing] = useState(false);
  const [findings, setFindings] = useState<XrayFinding[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
  const MAX_MB = 10;

  const handleFile = (f: File) => {
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
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const analyse = async () => {
    if (!file) return;
    setAnalysing(true);
    setErrorMsg(null);
    setFindings(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/xray/analyse", {
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
    } catch (err: any) {
      setErrorMsg("Network error. Please check your connection and try again.");
    } finally {
      setAnalysing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setFindings(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
          <Microscope className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
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
          <span className="font-semibold">Clinical decision support only.</span> AI findings are not a diagnosis. Always apply your own clinical judgement. The model may take up to 60 seconds on first use (AI service wakes on demand).
        </p>
      </div>

      {/* Upload zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all min-h-[200px] px-6 py-10
            ${dragging
              ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
              : "border-border/60 bg-muted/20 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/10"}`}
        >
          <div className="h-12 w-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 flex items-center justify-center">
            <Upload className="h-5 w-5 text-violet-600 dark:text-violet-400" />
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
          />
        </div>
      )}

      {/* Image + actions */}
      {file && previewUrl && (
        <div className="space-y-4">

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <ScanLine className="h-4 w-4 text-violet-500 shrink-0" />
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
                  className="h-8 text-xs gap-1.5"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                  {showOverlay ? "Hide" : "Show"} overlay
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="h-8 text-xs gap-1.5 text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Change image
              </Button>
            </div>
          </div>

          {/* Image / Canvas */}
          <div className="relative rounded-xl overflow-hidden border border-border/50 bg-black/5 dark:bg-white/5">
            {findings && showOverlay ? (
              <DrawingCanvas
                imageUrl={previewUrl}
                findings={findings}
                naturalW={naturalSize.w}
                naturalH={naturalSize.h}
              />
            ) : (
              <img
                src={previewUrl}
                alt="X-ray preview"
                className="w-full rounded-xl object-contain max-h-[480px]"
              />
            )}
            {analysing && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <div className="text-center">
                  <p className="text-sm font-semibold">Analysing X-ray…</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take up to 60 seconds on first use</p>
                </div>
              </div>
            )}
          </div>

          {/* Analyse button */}
          {findings === null && !analysing && (
            <Button
              onClick={analyse}
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
              size="lg"
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
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600 shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Results */}
      {findings !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {findings.length === 0
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                : <ScanLine className="h-4 w-4 text-violet-500" />}
              <span className="text-sm font-semibold">
                {findings.length === 0 ? "No findings detected" : `${findings.length} finding${findings.length > 1 ? "s" : ""} detected`}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={analyse}
              disabled={analysing}
              className="h-7 text-xs gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              Re-analyse
            </Button>
          </div>

          {findings.length === 0 && (
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10">
              <CardContent className="px-4 py-3">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  The AI model did not detect any notable findings in this image. This does not rule out pathology — please review the image directly.
                </p>
              </CardContent>
            </Card>
          )}

          {findings.map((f, i) => {
            const { bar, badge } = CONFIDENCE_COLOR(f.confidence);
            return (
              <Card key={i} className="border-border/50 shadow-sm">
                <CardContent className="px-4 py-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: BOX_COLORS[i % BOX_COLORS.length] }}
                      >
                        {i + 1}
                      </div>
                      <span className="text-sm font-semibold truncate">{f.label}</span>
                    </div>
                    <Badge className={`text-[10px] font-semibold px-2 py-0.5 border shrink-0 ${badge}`}>
                      {CONFIDENCE_LABEL(f.confidence)} · {f.confidence.toFixed(1)}%
                    </Badge>
                  </div>

                  {/* Confidence bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Confidence</span>
                      <span>{f.confidence.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${bar} transition-all duration-500`}
                        style={{ width: `${f.confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    {[
                      { k: "X", v: f.location.x.toFixed(0) },
                      { k: "Y", v: f.location.y.toFixed(0) },
                      { k: "W", v: f.location.width.toFixed(0) },
                      { k: "H", v: f.location.height.toFixed(0) },
                    ].map(({ k, v }) => (
                      <div key={k} className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground">{k}</p>
                        <p className="text-xs font-mono font-bold">{v}px</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
