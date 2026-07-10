import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format, differenceInDays, isToday, isYesterday, isThisWeek } from "date-fns";
import {
  Package, Plus, Search, AlertTriangle, CheckCircle2, Clock,
  Trash2, Minus, PackagePlus, ClipboardList, X,
  Wrench, FlaskConical, Stethoscope, Box, TrendingDown, TrendingUp,
  ArrowUpDown, ShieldAlert, CalendarClock, Info, Pencil, Download,
  FolderPlus, MoreHorizontal, ChevronLeft, Check, History, Settings2,
  RefreshCw, XCircle, LayoutGrid, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InventoryItem, InventoryCategory, StockTransaction, StockAlert } from "@shared/schema";

// ─── helpers ────────────────────────────────────────────────────────────────

type ItemStatus = "critical" | "low" | "expiry" | "ok";

function getItemStatus(item: InventoryItem): ItemStatus {
  if (item.trackingType === "equipment" || item.trackingType === "instrument") {
    if (item.nextServiceDate) {
      const days = differenceInDays(new Date(item.nextServiceDate), new Date());
      if (days <= 14) return "expiry";
    }
    if (item.warrantyExpiry) {
      const days = differenceInDays(new Date(item.warrantyExpiry), new Date());
      if (days <= 30) return "expiry";
    }
    return "ok";
  }
  if (item.criticalLevel !== null && item.currentQty <= item.criticalLevel) return "critical";
  if (item.reorderLevel !== null && item.currentQty <= item.reorderLevel) return "low";
  if (item.expiryDate) {
    const days = differenceInDays(new Date(item.expiryDate), new Date());
    if (days <= 30) return "expiry";
  }
  return "ok";
}

function getStockPercent(item: InventoryItem): number {
  const max = item.reorderLevel ? item.reorderLevel * 3 : Math.max(item.currentQty * 2, 10);
  return Math.min(100, Math.round((item.currentQty / max) * 100));
}

function exportInventoryCSV(items: InventoryItem[], categories: InventoryCategory[]) {
  const headers = ["Name", "Type", "Category", "Unit", "Qty", "Reorder Level", "Critical Level", "Unit Price (Rs)", "Status"];
  const rows = items.map(item => {
    const cat = categories.find(c => c.id === item.categoryId);
    return [
      `"${item.name}"`,
      item.trackingType,
      cat ? `"${cat.name}"` : "",
      item.unit || "",
      item.currentQty,
      item.reorderLevel ?? "",
      item.criticalLevel ?? "",
      item.unitPrice ?? "",
      getItemStatus(item),
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "inventory.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

const STATUS_COLORS: Record<ItemStatus, { dot: string; bar: string; card: string; text: string }> = {
  critical: {
    dot: "bg-red-500 animate-pulse",
    bar: "bg-red-500",
    card: "border-red-200 dark:border-red-900/50",
    text: "text-red-600 dark:text-red-400",
  },
  low: {
    dot: "bg-yellow-500",
    bar: "bg-yellow-500",
    card: "border-yellow-200 dark:border-yellow-900/50",
    text: "text-yellow-600 dark:text-yellow-500",
  },
  expiry: {
    dot: "bg-orange-500 animate-pulse",
    bar: "bg-orange-500",
    card: "border-orange-200 dark:border-orange-900/50",
    text: "text-orange-600 dark:text-orange-400",
  },
  ok: {
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    card: "border-border",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

const TRACKING_ICONS: Record<string, typeof Package> = {
  consumable: Package,
  perishable: FlaskConical,
  instrument: Stethoscope,
  equipment: Wrench,
};

const UNIT_OPTIONS = ["units", "pcs", "boxes", "packs", "bottles", "vials", "pairs", "rolls", "sheets", "ml", "mg", "g", "kg"];

// ─── Status badge (bigger, glanceable badge shown alongside the existing border/dot treatment) ──

type StatusBadgeInfo = { label: string; icon: typeof ShieldAlert; cls: string };

function getStatusBadge(item: InventoryItem, status: ItemStatus): StatusBadgeInfo | null {
  const isAsset = item.trackingType === "equipment" || item.trackingType === "instrument";
  if (!isAsset && item.currentQty <= 0) {
    return {
      label: "OUT OF STOCK",
      icon: XCircle,
      cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    };
  }
  switch (status) {
    case "critical":
      return {
        label: "CRITICAL",
        icon: ShieldAlert,
        cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      };
    case "low":
      return {
        label: "LOW STOCK",
        icon: TrendingDown,
        cls: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      };
    case "expiry":
      return {
        label: isAsset ? "SERVICE DUE" : "EXPIRING",
        icon: CalendarClock,
        cls: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
      };
    default:
      return null;
  }
}

// ─── Quick filter chips (kept alongside the category dropdown — chips for common cuts, dropdown for full category list) ──

type QuickFilter = "all" | "consumable" | "perishable" | "equipment" | "instrument" | "critical" | "low" | "expiry" | "outofstock";

const QUICK_FILTERS: { value: QuickFilter; label: string; icon: typeof Package }[] = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "consumable", label: "Consumables", icon: Package },
  { value: "perishable", label: "Perishables", icon: FlaskConical },
  { value: "equipment", label: "Equipment", icon: Wrench },
  { value: "instrument", label: "Instruments", icon: Stethoscope },
  { value: "critical", label: "Critical", icon: ShieldAlert },
  { value: "low", label: "Low Stock", icon: TrendingDown },
  { value: "expiry", label: "Expiring", icon: CalendarClock },
  { value: "outofstock", label: "Out of Stock", icon: XCircle },
];

// ─── AlertStrip ──────────────────────────────────────────────────────────────

function AlertStrip({
  items,
  onAlertTypeClick,
}: {
  items: InventoryItem[];
  onAlertTypeClick: (type: ItemStatus | null) => void;
}) {
  const critical = items.filter(i => getItemStatus(i) === "critical").length;
  const low = items.filter(i => getItemStatus(i) === "low").length;
  const expiring = items.filter(i => getItemStatus(i) === "expiry").length;
  const total = items.length;

  const cards = [
    {
      num: critical, label: "Critical Stock", sub: "Below critical level",
      bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40",
      numCls: "text-red-600 dark:text-red-400",
      icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
      type: "critical" as ItemStatus,
    },
    {
      num: low, label: "Low Stock", sub: "Below reorder level",
      bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900/40",
      numCls: "text-yellow-600 dark:text-yellow-500",
      icon: <TrendingDown className="h-4 w-4 text-yellow-500" />,
      type: "low" as ItemStatus,
    },
    {
      num: expiring, label: "Expiring Soon", sub: "Within 30 days",
      bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40",
      numCls: "text-orange-600 dark:text-orange-400",
      icon: <CalendarClock className="h-4 w-4 text-orange-500" />,
      type: "expiry" as ItemStatus,
    },
    {
      num: total, label: "Total Items", sub: "All tracked items",
      bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40",
      numCls: "text-emerald-600 dark:text-emerald-500",
      icon: <Box className="h-4 w-4 text-emerald-500" />,
      type: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <button
          key={c.label}
          onClick={c.type ? () => onAlertTypeClick(c.type) : undefined}
          data-testid={`inventory-stat-${c.label.toLowerCase().replace(/ /g, "-")}`}
          className={`rounded-xl border p-4 text-left transition-all ${c.bg} ${c.type ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : "cursor-default"}`}
        >
          <div className="flex items-center justify-between mb-2">
            {c.icon}
          </div>
          <div className={`text-3xl font-extrabold tracking-tight leading-none mb-1 ${c.numCls}`}>{c.num}</div>
          <div className="text-xs font-semibold text-foreground">{c.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
        </button>
      ))}
    </div>
  );
}

// ─── ConsumableCard ──────────────────────────────────────────────────────────

function ConsumableCard({
  item,
  categories,
  onDeduct,
  onDetail,
}: {
  item: InventoryItem;
  categories: InventoryCategory[];
  onDeduct: (item: InventoryItem) => void;
  onDetail: (item: InventoryItem) => void;
}) {
  const status = getItemStatus(item);
  const col = STATUS_COLORS[status];
  const pct = getStockPercent(item);
  const cat = categories.find(c => c.id === item.categoryId);
  const Icon = TRACKING_ICONS[item.trackingType] ?? Package;
  const badge = getStatusBadge(item, status);

  const expiryLabel = () => {
    if (!item.expiryDate) return null;
    const days = differenceInDays(new Date(item.expiryDate), new Date());
    if (days < 0) return { text: "Expired", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    if (days <= 7) return { text: `Exp ${days}d`, cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    if (days <= 30) return { text: `Exp ${days}d`, cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
    return { text: format(new Date(item.expiryDate), "dd MMM yy"), cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  };

  const exp = expiryLabel();

  return (
    <div
      data-testid={`inventory-card-${item.id}`}
      onClick={() => onDetail(item)}
      className={`group relative bg-card rounded-xl border ${col.card} p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md overflow-hidden`}
    >
      <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-xl ${col.bar}`} />

      <div className="flex items-start justify-between gap-2 mb-2 mt-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${col.dot}`} />
            <span className="text-sm font-bold text-foreground truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3 w-3 shrink-0" />
            <span className="capitalize">{item.trackingType}</span>
            {cat && <><span>·</span><span>{cat.name}</span></>}
          </div>
        </div>
        {badge && (
          <span
            data-testid={`status-badge-${item.id}`}
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-md border shrink-0 whitespace-nowrap ${badge.cls}`}
          >
            <badge.icon className="h-3 w-3 shrink-0" />
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span className={`text-3xl font-extrabold tracking-tight leading-none ${col.text}`}>{item.currentQty}</span>
        {item.unit && <span className="text-xs text-muted-foreground font-medium">{item.unit}</span>}
        {item.reorderLevel !== null && (
          <span className="ml-auto text-xs text-muted-foreground">min {item.reorderLevel}</span>
        )}
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all ${col.bar}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          {exp && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${exp.cls}`}>{exp.text}</span>
          )}
          {item.unitPrice != null && (
            <span className="text-xs text-muted-foreground ml-1">₹{item.unitPrice}/unit</span>
          )}
        </div>
        <button
          data-testid={`deduct-btn-${item.id}`}
          onClick={(e) => { e.stopPropagation(); onDeduct(item); }}
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground min-h-[32px]"
        >
          <Minus className="h-3 w-3" /> Deduct
        </button>
      </div>
    </div>
  );
}

// ─── AssetRow ────────────────────────────────────────────────────────────────

function AssetRow({
  item,
  categories,
  onDetail,
}: {
  item: InventoryItem;
  categories: InventoryCategory[];
  onDetail: (item: InventoryItem) => void;
}) {
  const cat = categories.find(c => c.id === item.categoryId);
  const Icon = TRACKING_ICONS[item.trackingType] ?? Wrench;
  const status = getItemStatus(item);
  const badge = getStatusBadge(item, status);

  const serviceStatus = () => {
    if (!item.nextServiceDate) return null;
    const days = differenceInDays(new Date(item.nextServiceDate), new Date());
    if (days < 0) return { text: "Service Overdue", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    if (days <= 14) return { text: `Service in ${days}d`, cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
    return { text: `Next: ${format(new Date(item.nextServiceDate), "dd MMM yy")}`, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  };

  const warrantyStatus = () => {
    if (!item.warrantyExpiry) return null;
    const days = differenceInDays(new Date(item.warrantyExpiry), new Date());
    if (days < 0) return { text: "Warranty Expired", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    if (days <= 30) return { text: `Warranty ${days}d`, cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
    return { text: `Warranty: ${format(new Date(item.warrantyExpiry), "dd MMM yy")}`, cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  };

  const svc = serviceStatus();
  const wty = warrantyStatus();

  return (
    <div
      data-testid={`asset-row-${item.id}`}
      onClick={() => onDetail(item)}
      className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-border/80 hover:shadow-sm transition-all"
    >
      <div className="h-9 w-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{item.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {cat ? cat.name : <span className="italic">Uncategorised</span>}
          {item.notes && <span className="ml-2">· {item.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
        {badge && (
          <span
            data-testid={`status-badge-${item.id}`}
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-md border shrink-0 whitespace-nowrap ${badge.cls}`}
          >
            <badge.icon className="h-3 w-3 shrink-0" />
            {badge.label}
          </span>
        )}
        {svc && <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${svc.cls}`}>{svc.text}</span>}
        {wty && <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${wty.cls}`}>{wty.text}</span>}
        {!svc && !wty && <span className="text-xs text-muted-foreground italic">No service/warranty set</span>}
      </div>
    </div>
  );
}

// ─── Dental item catalogue (autocomplete) ───────────────────────────────────

const DENTAL_CATALOGUE: Record<string, string[]> = {
  consumable: [
    "Nitrile Gloves (Latex-free)", "Surgical Masks (Level 2/3)", "N95/FFP2 Respirators",
    "Face Shields", "Disposable Aprons", "Surgical Caps",
    "Cotton Rolls", "Cotton Pellets", "Gauze Pads (2×2)", "Gauze Pads (4×4)",
    "Saliva Ejectors", "HVE Tips (High Volume Evacuation)", "Disposable Bibs",
    "Bib Clips", "Tongue Depressors",
    "Autoclave Pouches", "Sterilization Wraps", "Biological Indicators (Spore Tests)",
    "Chemical Indicator Strips",
    "Surface Disinfectant Spray", "CaviWipes (Disinfectant Wipes)",
    "Suction Line Cleaner", "Hand Sanitizer",
    "Prophy Paste (Fine)", "Prophy Paste (Medium)", "Prophy Paste (Coarse)",
    "Disposable Prophy Angles", "Fluoride Varnish (Unit Doses)",
    "Dental Floss", "Articulating Paper (Blue)", "Articulating Paper (Red)",
  ],
  perishable: [
    "Lidocaine Carpules (Red)", "Articaine Carpules (Gold)", "Mepivacaine Carpules (Tan)",
    "Composite Resin (A1 Shade)", "Composite Resin (A2 Shade)", "Composite Resin (B1 Shade)",
    "Glass Ionomer Cement (GIC)", "Flowable Composite",
    "Bonding Agent (Adhesive)", "Etchant Gel (Phosphoric Acid 37%)",
    "Zinc Phosphate Cement", "Resin Cement",
    "Cavity Liner (Dycal)", "MTA (Mineral Trioxide Aggregate)", "Core Build-up Material",
    "Alginate Powder", "PVS Putty", "PVS Cartridges (Light Body)", "Bite Registration Material",
    "Sodium Hypochlorite (Irrigant)", "EDTA Solution",
    "Calcium Hydroxide Paste", "Gutta-Percha Points", "Paper Points",
    "Sutures (Silk)", "Sutures (Vicryl)", "Haemostatic Sponges (Gelfoam)", "Sterile Saline",
  ],
  instrument: [
    "Mouth Mirror (Size 4)", "Mouth Mirror (Size 5)",
    "Sickle Exploration Probe", "Briault Probe",
    "Periodontal Probe (CPITN)", "Periodontal Probe (UNC-15)", "College Tweezers",
    "Spoon Excavator", "Amalgam Carrier", "Condenser (Plugger)",
    "Burnisher (Ball)", "Burnisher (Egg)", "Composite Plastic Instrument (Teflon-coated)",
    "Extraction Forceps (Upper Universal)", "Extraction Forceps (Lower Universal)",
    "Cowhorn Forceps", "Coupland Elevator", "Cryer Elevator", "Warwick James Elevator",
    "Periosteal Elevator", "Scalpel Handle (Size 3)", "Needle Holder", "Hemostat",
    "K-Files (Hand Files)", "Hedstrom Files", "NiTi Rotary Files", "Endodontic Ruler",
    "Sickle Scaler", "Gracey Curette 1/2", "Gracey Curette 11/12", "Gracey Curette 13/14",
    "Diamond Burs", "Carbide Burs", "Polishing Discs", "Mandrels",
  ],
  equipment: [
    "Dental Chair (Dental Unit)", "Operatory Light", "3-in-1 Air/Water Syringe",
    "Foot Control", "Suction Unit",
    "High-Speed Turbine", "Low-Speed Micromotor",
    "Straight Handpiece", "Contra-Angle Handpiece",
    "Intraoral Camera", "Apex Locator", "Digital X-ray Sensor (RVG)", "Pulp Tester",
    "Autoclave (Class B)", "Ultrasonic Cleaner", "Model Trimmer",
    "Vacuum Mixer", "Light Curing Unit (LED)",
    "Wall-mounted X-ray Unit", "OPG (Panoramic) Machine", "CBCT Scanner",
    "Air Compressor (Oil-free)", "Dry Suction Motor", "Amalgam Separator",
  ],
};

// ─── ItemNameCombobox ────────────────────────────────────────────────────────

function ItemNameCombobox({
  value,
  onChange,
  trackingType,
}: {
  value: string;
  onChange: (v: string) => void;
  trackingType: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const catalogue = DENTAL_CATALOGUE[trackingType] ?? [];

  const query = value.trim().toLowerCase();
  const filtered = query.length === 0
    ? catalogue.slice(0, 10)
    : catalogue.filter(i => i.toLowerCase().includes(query));

  const exactMatch = catalogue.some(i => i.toLowerCase() === query);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const showDropdown = open && (filtered.length > 0 || (value.trim().length > 0 && !exactMatch));

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id="inv-name"
        data-testid="input-item-name"
        placeholder={`e.g. ${catalogue[0] ?? "Item name"}`}
        value={value}
        autoComplete="off"
        required
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                onMouseDown={(e) => { e.preventDefault(); onChange(item); setOpen(false); }}
              >
                {item}
              </button>
            ))}
            {value.trim().length > 0 && !exactMatch && (
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${filtered.length > 0 ? "border-t border-border" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}
              >
                Use <span className="font-semibold text-foreground">"{value}"</span> as item name
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Item Sheet ──────────────────────────────────────────────────────────

type ItemFormState = {
  name: string; trackingType: string; unit: string; categoryId: string;
  currentQty: string; reorderLevel: string; criticalLevel: string;
  expiryDate: string; warrantyExpiry: string; nextServiceDate: string;
  notes: string; unitPrice: string;
  sku: string; barcode: string; manufacturer: string;
  supplierName: string; supplierContact: string; purchasePrice: string;
  lastPurchasedDate: string; location: string; batchNumber: string;
};

const BLANK_FORM: ItemFormState = {
  name: "", trackingType: "consumable", unit: "units", categoryId: "",
  currentQty: "", reorderLevel: "", criticalLevel: "",
  expiryDate: "", warrantyExpiry: "", nextServiceDate: "", notes: "", unitPrice: "",
  sku: "", barcode: "", manufacturer: "",
  supplierName: "", supplierContact: "", purchasePrice: "",
  lastPurchasedDate: "", location: "", batchNumber: "",
};

function AddItemSheet({
  open,
  onOpenChange,
  categories,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: InventoryCategory[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<ItemFormState>(BLANK_FORM);
  const isAsset = form.trackingType === "equipment" || form.trackingType === "instrument";

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/clinic/inventory/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/transactions"] });
      notify.success("Item added", { description: `${form.name} added to inventory.` });
      setForm(BLANK_FORM);
      onSuccess();
      onOpenChange(false);
    },
    onError: () => notify.error("Failed to add item"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    mutation.mutate({
      name: form.name.trim(),
      trackingType: form.trackingType,
      unit: form.unit || null,
      categoryId: form.categoryId && form.categoryId !== "none" ? Number(form.categoryId) : null,
      currentQty: form.currentQty ? Number(form.currentQty) : 0,
      reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : null,
      criticalLevel: form.criticalLevel ? Number(form.criticalLevel) : null,
      unitPrice: form.unitPrice ? Number(form.unitPrice) : null,
      expiryDate: form.expiryDate || null,
      warrantyExpiry: form.warrantyExpiry || null,
      nextServiceDate: form.nextServiceDate || null,
      notes: form.notes || null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      supplierName: form.supplierName.trim() || null,
      supplierContact: form.supplierContact.trim() || null,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
      lastPurchasedDate: form.lastPurchasedDate || null,
      location: form.location.trim() || null,
      batchNumber: form.batchNumber.trim() || null,
    });
  }

  const set = (k: keyof ItemFormState) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const onChange = (k: keyof ItemFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-emerald-600" />
            Add Inventory Item
          </SheetTitle>
          <SheetDescription>Fill in the details for the new item. Fields vary by type.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-xs font-semibold mb-2 block">Item Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["consumable", "Consumable", Package],
                ["perishable", "Perishable", FlaskConical],
                ["instrument", "Instrument", Stethoscope],
                ["equipment", "Equipment", Wrench],
              ] as [string, string, typeof Package][]).map(([val, label, Icon]) => (
                <button
                  key={val}
                  type="button"
                  data-testid={`type-btn-${val}`}
                  onClick={() => setForm(f => ({ ...f, trackingType: val }))}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${form.trackingType === val ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "border-border hover:border-muted-foreground/30 text-muted-foreground"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />{label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="inv-name" className="text-xs font-semibold mb-1 block">Item Name *</Label>
            <ItemNameCombobox
              value={form.name}
              onChange={(v) => setForm(f => ({ ...f, name: v }))}
              trackingType={form.trackingType}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Category</Label>
              <Select value={form.categoryId} onValueChange={set("categoryId")}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isAsset && (
              <div>
                <Label className="text-xs font-semibold mb-1 block">Unit</Label>
                <Select value={form.unit} onValueChange={set("unit")}>
                  <SelectTrigger data-testid="select-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!isAsset && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="inv-qty" className="text-xs font-semibold mb-1 block">Initial Qty</Label>
                <Input id="inv-qty" data-testid="input-qty" type="number" min={0} placeholder="0" value={form.currentQty} onChange={onChange("currentQty")} />
              </div>
              <div>
                <Label htmlFor="inv-reorder" className="text-xs font-semibold mb-1 block text-yellow-600">Reorder At</Label>
                <Input id="inv-reorder" data-testid="input-reorder" type="number" min={0} placeholder="e.g. 20" value={form.reorderLevel} onChange={onChange("reorderLevel")} />
              </div>
              <div>
                <Label htmlFor="inv-critical" className="text-xs font-semibold mb-1 block text-red-600">Critical At</Label>
                <Input id="inv-critical" data-testid="input-critical" type="number" min={0} placeholder="e.g. 5" value={form.criticalLevel} onChange={onChange("criticalLevel")} />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="inv-unit-price" className="text-xs font-semibold mb-1 block">Unit Price (₹)</Label>
            <Input id="inv-unit-price" data-testid="input-unit-price" type="number" min={0} step="0.01" placeholder="e.g. 150" value={form.unitPrice} onChange={onChange("unitPrice")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="inv-sku" className="text-xs font-semibold mb-1 block">SKU</Label>
              <Input id="inv-sku" data-testid="input-sku" placeholder="e.g. CON-001" value={form.sku} onChange={onChange("sku")} />
            </div>
            <div>
              <Label htmlFor="inv-barcode" className="text-xs font-semibold mb-1 block">Barcode</Label>
              <Input id="inv-barcode" data-testid="input-barcode" placeholder="Scan or type barcode" value={form.barcode} onChange={onChange("barcode")} />
            </div>
          </div>

          <div>
            <Label htmlFor="inv-manufacturer" className="text-xs font-semibold mb-1 block">Manufacturer</Label>
            <Input id="inv-manufacturer" data-testid="input-manufacturer" placeholder="e.g. 3M, Dentsply" value={form.manufacturer} onChange={onChange("manufacturer")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="inv-supplier-name" className="text-xs font-semibold mb-1 block">Supplier</Label>
              <Input id="inv-supplier-name" data-testid="input-supplier-name" placeholder="e.g. MedSupply Co." value={form.supplierName} onChange={onChange("supplierName")} />
            </div>
            <div>
              <Label htmlFor="inv-supplier-contact" className="text-xs font-semibold mb-1 block">Supplier Contact</Label>
              <Input id="inv-supplier-contact" data-testid="input-supplier-contact" placeholder="Phone or email" value={form.supplierContact} onChange={onChange("supplierContact")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="inv-purchase-price" className="text-xs font-semibold mb-1 block">Purchase Price (₹)</Label>
              <Input id="inv-purchase-price" data-testid="input-purchase-price" type="number" min={0} step="0.01" placeholder="e.g. 120" value={form.purchasePrice} onChange={onChange("purchasePrice")} />
            </div>
            <div>
              <Label htmlFor="inv-last-purchased" className="text-xs font-semibold mb-1 block">Last Purchased</Label>
              <Input id="inv-last-purchased" data-testid="input-last-purchased" type="date" value={form.lastPurchasedDate} onChange={onChange("lastPurchasedDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="inv-location" className="text-xs font-semibold mb-1 block">Storage Location</Label>
              <Input id="inv-location" data-testid="input-location" placeholder="e.g. Cabinet 3, Shelf B" value={form.location} onChange={onChange("location")} />
            </div>
            <div>
              <Label htmlFor="inv-batch" className="text-xs font-semibold mb-1 block">Batch / Lot No.</Label>
              <Input id="inv-batch" data-testid="input-batch" placeholder="e.g. LOT-2026-04" value={form.batchNumber} onChange={onChange("batchNumber")} />
            </div>
          </div>

          {(form.trackingType === "consumable" || form.trackingType === "perishable") && (
            <div>
              <Label htmlFor="inv-expiry" className="text-xs font-semibold mb-1 block">Expiry Date</Label>
              <Input id="inv-expiry" data-testid="input-expiry" type="date" value={form.expiryDate} onChange={onChange("expiryDate")} />
            </div>
          )}
          {isAsset && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inv-warranty" className="text-xs font-semibold mb-1 block">Warranty Expiry</Label>
                <Input id="inv-warranty" data-testid="input-warranty" type="date" value={form.warrantyExpiry} onChange={onChange("warrantyExpiry")} />
              </div>
              <div>
                <Label htmlFor="inv-service" className="text-xs font-semibold mb-1 block">Next Service</Label>
                <Input id="inv-service" data-testid="input-service" type="date" value={form.nextServiceDate} onChange={onChange("nextServiceDate")} />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="inv-notes" className="text-xs font-semibold mb-1 block">Notes</Label>
            <Textarea id="inv-notes" data-testid="input-notes" placeholder="e.g. Store in cool, dry place" value={form.notes} onChange={onChange("notes")} rows={2} />
          </div>

          <Button
            type="submit"
            data-testid="btn-add-item-submit"
            disabled={mutation.isPending || !form.name.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {mutation.isPending ? "Adding..." : "Add Item"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Qty Stepper ─────────────────────────────────────────────────────────────

function QtyStepper({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  function step(delta: number) {
    const current = Number(value) || 0;
    onChange(String(Math.max(0, current + delta)));
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="btn-qty-minus"
        onClick={() => step(-1)}
        className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
      >
        <Minus className="h-4 w-4" />
      </button>
      <Input
        data-testid="input-stock-qty"
        type="number"
        min={0}
        placeholder="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-center"
        required
      />
      <button
        type="button"
        data-testid="btn-qty-plus"
        onClick={() => step(1)}
        className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Item Detail Dialog (merged: detail + stock update + edit) ────────────────

type DetailMode = "detail" | "stock" | "edit";

function ItemDetailDialog({
  item,
  categories,
  onClose,
  onDelete,
  transactions,
  initialMode = "detail",
}: {
  item: InventoryItem | null;
  categories: InventoryCategory[];
  onClose: () => void;
  onDelete: (id: number) => void;
  transactions: (StockTransaction & { itemName: string })[];
  initialMode?: DetailMode;
}) {
  const [mode, setMode] = useState<DetailMode>(initialMode);
  const [stockType, setStockType] = useState<"add" | "deduct" | "adjust">("deduct");
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [editForm, setEditForm] = useState<Partial<ItemFormState>>({});

  // Reset mode and form state whenever item changes or initial mode changes
  useEffect(() => {
    if (!item) return;
    setMode(initialMode);
    setStockQty("");
    setStockReason("");
    setStockType("deduct");
    setEditForm({
      name: item.name,
      categoryId: item.categoryId ? String(item.categoryId) : "",
      unit: item.unit || "units",
      reorderLevel: item.reorderLevel != null ? String(item.reorderLevel) : "",
      criticalLevel: item.criticalLevel != null ? String(item.criticalLevel) : "",
      unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
      expiryDate: item.expiryDate ? format(new Date(item.expiryDate), "yyyy-MM-dd") : "",
      warrantyExpiry: item.warrantyExpiry ? format(new Date(item.warrantyExpiry), "yyyy-MM-dd") : "",
      nextServiceDate: item.nextServiceDate ? format(new Date(item.nextServiceDate), "yyyy-MM-dd") : "",
      notes: item.notes || "",
      sku: item.sku || "",
      barcode: item.barcode || "",
      manufacturer: item.manufacturer || "",
      supplierName: item.supplierName || "",
      supplierContact: item.supplierContact || "",
      purchasePrice: item.purchasePrice != null ? String(item.purchasePrice) : "",
      lastPurchasedDate: item.lastPurchasedDate ? format(new Date(item.lastPurchasedDate), "yyyy-MM-dd") : "",
      location: item.location || "",
      batchNumber: item.batchNumber || "",
    });
  }, [item?.id]);

  const stockMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/clinic/inventory/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/alerts"] });
      notify.success("Stock updated");
      setMode("detail");
      setStockQty("");
      setStockReason("");
    },
    onError: () => notify.error("Failed to update stock"),
  });

  const editMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("PATCH", `/api/clinic/inventory/items/${item!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/items"] });
      notify.success("Item updated");
      setMode("detail");
    },
    onError: () => notify.error("Failed to update item"),
  });

  if (!item) return null;

  const isAsset = item.trackingType === "equipment" || item.trackingType === "instrument";
  const status = getItemStatus(item);
  const col = STATUS_COLORS[status];
  const cat = categories.find(c => c.id === item.categoryId);

  const itemHistory = transactions
    .filter(tx => tx.itemId === item.id)
    .slice(0, 6);

  function handleStockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stockQty || isNaN(Number(stockQty)) || Number(stockQty) < 0) return;
    stockMutation.mutate({
      itemId: item!.id,
      type: stockType,
      qtyChange: Number(stockQty),
      reason: stockReason || null,
    });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    editMutation.mutate({
      name: editForm.name?.trim(),
      categoryId: editForm.categoryId && editForm.categoryId !== "none" ? Number(editForm.categoryId) : null,
      unit: editForm.unit || null,
      reorderLevel: editForm.reorderLevel ? Number(editForm.reorderLevel) : null,
      criticalLevel: editForm.criticalLevel ? Number(editForm.criticalLevel) : null,
      unitPrice: editForm.unitPrice ? Number(editForm.unitPrice) : null,
      expiryDate: editForm.expiryDate || null,
      warrantyExpiry: editForm.warrantyExpiry || null,
      nextServiceDate: editForm.nextServiceDate || null,
      notes: editForm.notes || null,
      sku: editForm.sku?.trim() || null,
      barcode: editForm.barcode?.trim() || null,
      manufacturer: editForm.manufacturer?.trim() || null,
      supplierName: editForm.supplierName?.trim() || null,
      supplierContact: editForm.supplierContact?.trim() || null,
      purchasePrice: editForm.purchasePrice ? Number(editForm.purchasePrice) : null,
      lastPurchasedDate: editForm.lastPurchasedDate || null,
      location: editForm.location?.trim() || null,
      batchNumber: editForm.batchNumber?.trim() || null,
    });
  }

  const setEdit = (k: keyof ItemFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm(f => ({ ...f, [k]: e.target.value }));
  const setEditSelect = (k: keyof ItemFormState) => (v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const titles: Record<DetailMode, string> = {
    detail: item.name,
    stock: "Update Stock",
    edit: "Edit Item",
  };

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {mode !== "detail" && (
              <button
                type="button"
                onClick={() => setMode("detail")}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground shrink-0"
                aria-label="Back to detail"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {mode === "detail" && <span className={`inline-block h-2.5 w-2.5 rounded-full ${col.dot} shrink-0`} />}
            {titles[mode]}
          </DialogTitle>
          {mode === "detail" && (
            <DialogDescription>
              <span className="capitalize">{item.trackingType}</span>
              {cat && <> · {cat.name}</>}
              {item.unit && <> · {item.unit}</>}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* ── DETAIL MODE ── */}
        {mode === "detail" && (
          <div className="space-y-3 mt-1">
            {!isAsset && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Current", value: item.currentQty, cls: col.text },
                  { label: "Reorder", value: item.reorderLevel ?? "—", cls: "text-yellow-600" },
                  { label: "Critical", value: item.criticalLevel ?? "—", cls: "text-red-600" },
                ].map(cell => (
                  <div key={cell.label} className="rounded-xl border border-green-800/30 bg-green-50 dark:bg-green-950/20 shadow-sm overflow-hidden">
                    <div className="px-3 py-1.5 bg-green-50 dark:bg-green-950/30 border-b border-green-800/20">
                      <span className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-400">{cell.label}</span>
                    </div>
                    <div className={`text-2xl font-extrabold text-center py-3 ${cell.cls}`}>{cell.value}</div>
                  </div>
                ))}
              </div>
            )}

            {item.unitPrice != null && (
              <div className="flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-950/20 border border-green-800/20 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Unit price:</span>
                <span className="font-semibold text-foreground">₹{item.unitPrice}</span>
                {!isAsset && <span className="text-muted-foreground ml-auto text-xs">Total value: ₹{(item.unitPrice * item.currentQty).toFixed(2)}</span>}
              </div>
            )}

            {item.expiryDate && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Expiry:</span>
                <span className="font-semibold">{format(new Date(item.expiryDate), "dd MMM yyyy")}</span>
              </div>
            )}
            {item.warrantyExpiry && (
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Warranty:</span>
                <span className="font-semibold">{format(new Date(item.warrantyExpiry), "dd MMM yyyy")}</span>
              </div>
            )}
            {item.nextServiceDate && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Next Service:</span>
                <span className="font-semibold">{format(new Date(item.nextServiceDate), "dd MMM yyyy")}</span>
              </div>
            )}
            {(item.sku || item.barcode || item.manufacturer || item.supplierName || item.location || item.batchNumber || item.purchasePrice != null || item.lastPurchasedDate) && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5 text-sm">
                {item.sku && <div className="flex justify-between gap-2"><span className="text-muted-foreground">SKU</span><span className="font-semibold" data-testid="text-detail-sku">{item.sku}</span></div>}
                {item.barcode && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Barcode</span><span className="font-semibold" data-testid="text-detail-barcode">{item.barcode}</span></div>}
                {item.manufacturer && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Manufacturer</span><span className="font-semibold">{item.manufacturer}</span></div>}
                {item.supplierName && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Supplier</span><span className="font-semibold">{item.supplierName}{item.supplierContact ? ` · ${item.supplierContact}` : ""}</span></div>}
                {item.purchasePrice != null && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Purchase Price</span><span className="font-semibold">₹{item.purchasePrice}</span></div>}
                {item.lastPurchasedDate && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Last Purchased</span><span className="font-semibold">{format(new Date(item.lastPurchasedDate), "dd MMM yyyy")}</span></div>}
                {item.location && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Location</span><span className="font-semibold">{item.location}</span></div>}
                {item.batchNumber && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Batch / Lot</span><span className="font-semibold">{item.batchNumber}</span></div>}
              </div>
            )}

            {item.notes && (
              <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">{item.notes}</div>
            )}

            {/* Per-item history */}
            {itemHistory.length > 0 && (
              <div className="rounded-xl border border-green-800/30 bg-white dark:bg-card shadow-sm overflow-hidden">
                <div className="px-3 py-2 bg-green-50 dark:bg-green-950/30 border-b border-green-800/20 flex items-center gap-1.5">
                  <History className="h-3 w-3 text-green-800 dark:text-green-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-400">Recent Movements</span>
                </div>
                <div className="divide-y divide-border/40">
                  {itemHistory.map(tx => {
                    const dotCls = tx.type === "add" ? "bg-emerald-500" : tx.type === "deduct" ? "bg-red-500" : "bg-blue-500";
                    const numCls = tx.type === "add" ? "text-emerald-600" : tx.type === "deduct" ? "text-red-600" : "text-blue-600";
                    return (
                      <div key={tx.id} className="flex items-center gap-3 px-3 py-2">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotCls}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground truncate">{tx.reason || "No reason"}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xs font-bold ${numCls}`}>
                            {tx.type === "add" ? "+" : tx.type === "deduct" ? "−" : "→"}{Math.abs(tx.qtyChange)}
                          </div>
                          <div className="text-xs text-muted-foreground">{tx.performedAt ? format(new Date(tx.performedAt), "dd MMM") : ""}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STOCK MODE ── */}
        {mode === "stock" && (
          <form id="stock-form" onSubmit={handleStockSubmit} className="space-y-4 mt-2">
            <div className="text-sm text-muted-foreground">
              Current: <strong>{item.currentQty} {item.unit || "units"}</strong>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["add", "deduct", "adjust"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setStockType(t)}
                  className={`py-3 rounded-lg text-xs font-bold capitalize border transition-all min-h-[44px] ${stockType === t ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
                >
                  {t === "add" ? <TrendingUp className="h-3.5 w-3.5 mx-auto mb-0.5" /> : t === "deduct" ? <TrendingDown className="h-3.5 w-3.5 mx-auto mb-0.5" /> : <RefreshCw className="h-3.5 w-3.5 mx-auto mb-0.5" />}
                  {t === "adjust" ? "Set to" : t}
                </button>
              ))}
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">
                {stockType === "adjust" ? "Set quantity to" : `Quantity to ${stockType}`}
              </Label>
              <QtyStepper value={stockQty} onChange={setStockQty} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Reason</Label>
              <Input
                data-testid="input-stock-reason"
                placeholder="e.g. Used in procedure, restocked from supplier"
                value={stockReason}
                onChange={e => setStockReason(e.target.value)}
              />
            </div>
          </form>
        )}

        {/* ── EDIT MODE ── */}
        {mode === "edit" && (
          <form id="edit-form" onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Item Name *</Label>
              <Input
                data-testid="input-edit-name"
                value={editForm.name || ""}
                onChange={setEdit("name")}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Category</Label>
                <Select value={editForm.categoryId || ""} onValueChange={setEditSelect("categoryId")}>
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isAsset && (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Unit</Label>
                  <Select value={editForm.unit || "units"} onValueChange={setEditSelect("unit")}>
                    <SelectTrigger data-testid="select-edit-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {!isAsset && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block text-yellow-600">Reorder At</Label>
                  <Input data-testid="input-edit-reorder" type="number" min={0} placeholder="e.g. 20" value={editForm.reorderLevel || ""} onChange={setEdit("reorderLevel")} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block text-red-600">Critical At</Label>
                  <Input data-testid="input-edit-critical" type="number" min={0} placeholder="e.g. 5" value={editForm.criticalLevel || ""} onChange={setEdit("criticalLevel")} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Unit Price (₹)</Label>
                  <Input data-testid="input-edit-price" type="number" min={0} step="0.01" placeholder="e.g. 150" value={editForm.unitPrice || ""} onChange={setEdit("unitPrice")} />
                </div>
              </div>
            )}
            {isAsset && (
              <div>
                <Label className="text-xs font-semibold mb-1 block">Unit Price (₹)</Label>
                <Input data-testid="input-edit-price-asset" type="number" min={0} step="0.01" placeholder="e.g. 50000" value={editForm.unitPrice || ""} onChange={setEdit("unitPrice")} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">SKU</Label>
                <Input data-testid="input-edit-sku" placeholder="e.g. CON-001" value={editForm.sku || ""} onChange={setEdit("sku")} />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Barcode</Label>
                <Input data-testid="input-edit-barcode" placeholder="Scan or type barcode" value={editForm.barcode || ""} onChange={setEdit("barcode")} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Manufacturer</Label>
              <Input data-testid="input-edit-manufacturer" placeholder="e.g. 3M, Dentsply" value={editForm.manufacturer || ""} onChange={setEdit("manufacturer")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Supplier</Label>
                <Input data-testid="input-edit-supplier-name" placeholder="e.g. MedSupply Co." value={editForm.supplierName || ""} onChange={setEdit("supplierName")} />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Supplier Contact</Label>
                <Input data-testid="input-edit-supplier-contact" placeholder="Phone or email" value={editForm.supplierContact || ""} onChange={setEdit("supplierContact")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Purchase Price (₹)</Label>
                <Input data-testid="input-edit-purchase-price" type="number" min={0} step="0.01" placeholder="e.g. 120" value={editForm.purchasePrice || ""} onChange={setEdit("purchasePrice")} />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Last Purchased</Label>
                <Input data-testid="input-edit-last-purchased" type="date" value={editForm.lastPurchasedDate || ""} onChange={setEdit("lastPurchasedDate")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Storage Location</Label>
                <Input data-testid="input-edit-location" placeholder="e.g. Cabinet 3, Shelf B" value={editForm.location || ""} onChange={setEdit("location")} />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Batch / Lot No.</Label>
                <Input data-testid="input-edit-batch" placeholder="e.g. LOT-2026-04" value={editForm.batchNumber || ""} onChange={setEdit("batchNumber")} />
              </div>
            </div>
            {(item.trackingType === "consumable" || item.trackingType === "perishable") && (
              <div>
                <Label className="text-xs font-semibold mb-1 block">Expiry Date</Label>
                <Input data-testid="input-edit-expiry" type="date" value={editForm.expiryDate || ""} onChange={setEdit("expiryDate")} />
              </div>
            )}
            {isAsset && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Warranty Expiry</Label>
                  <Input data-testid="input-edit-warranty" type="date" value={editForm.warrantyExpiry || ""} onChange={setEdit("warrantyExpiry")} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Next Service</Label>
                  <Input data-testid="input-edit-service" type="date" value={editForm.nextServiceDate || ""} onChange={setEdit("nextServiceDate")} />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Notes</Label>
              <Textarea data-testid="input-edit-notes" placeholder="e.g. Store in cool, dry place" value={editForm.notes || ""} onChange={setEdit("notes")} rows={2} />
            </div>
          </form>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row mt-4">
          {mode === "detail" && (
            <>
              {!isAsset && (
                <Button
                  data-testid="btn-detail-stock"
                  onClick={() => setMode("stock")}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ArrowUpDown className="h-4 w-4 mr-1" /> Update Stock
                </Button>
              )}
              <Button
                data-testid="btn-detail-edit"
                variant="outline"
                onClick={() => setMode("edit")}
                className="flex-1"
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    data-testid="btn-detail-delete"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the item and all its stock history. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="btn-confirm-delete"
                      onClick={() => { onDelete(item.id); onClose(); }}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {mode === "stock" && (
            <>
              <Button variant="outline" onClick={() => setMode("detail")} className="flex-1">Cancel</Button>
              <Button
                type="submit"
                form="stock-form"
                data-testid="btn-stock-submit"
                disabled={stockMutation.isPending || !stockQty}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {stockMutation.isPending ? "Saving..." : <><Check className="h-4 w-4 mr-1" /> Save</>}
              </Button>
            </>
          )}
          {mode === "edit" && (
            <>
              <Button variant="outline" onClick={() => setMode("detail")} className="flex-1">Cancel</Button>
              <Button
                type="submit"
                form="edit-form"
                data-testid="btn-edit-submit"
                disabled={editMutation.isPending || !editForm.name?.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {editMutation.isPending ? "Saving..." : <><Check className="h-4 w-4 mr-1" /> Save Changes</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category Management ─────────────────────────────────────────────────────

function CategoryManagementSection({
  categories,
}: {
  categories: InventoryCategory[];
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/clinic/inventory/categories", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/categories"] });
      notify.success("Category added");
      setNewName("");
    },
    onError: () => notify.error("Failed to add category"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiRequest("PATCH", `/api/clinic/inventory/categories/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/categories"] });
      notify.success("Category renamed");
      setEditingId(null);
    },
    onError: () => notify.error("Failed to rename category"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clinic/inventory/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/categories"] });
      notify.success("Category removed");
    },
    onError: () => notify.error("Failed to remove category"),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate(newName.trim());
  }

  function startEdit(cat: InventoryCategory) {
    setEditingId(cat.id);
    setEditingName(cat.name);
  }

  function saveEdit() {
    if (!editingName.trim() || editingId === null) return;
    updateMutation.mutate({ id: editingId, name: editingName.trim() });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          data-testid="input-new-category"
          placeholder="e.g. PPE Supplies"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="flex-1"
        />
        <Button
          type="submit"
          data-testid="btn-add-category"
          disabled={createMutation.isPending || !newName.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          <FolderPlus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </form>

      {categories.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <FolderPlus className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No categories yet</p>
          <p className="text-xs mt-1">Add a category to organise your inventory.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {categories.map(cat => (
            <div
              key={cat.id}
              data-testid={`category-row-${cat.id}`}
              className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3"
            >
              {editingId === cat.id ? (
                <>
                  <Input
                    data-testid={`input-rename-${cat.id}`}
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 h-8 text-sm"
                    autoFocus
                  />
                  <button
                    data-testid={`btn-save-rename-${cat.id}`}
                    onClick={saveEdit}
                    disabled={updateMutation.isPending}
                    className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shrink-0"
                    aria-label="Save rename"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground shrink-0"
                    aria-label="Cancel rename"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-foreground">{cat.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        data-testid={`btn-category-menu-${cat.id}`}
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                        aria-label="Category options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEdit(cat)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={e => e.preventDefault()}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Items in this category will become uncategorised. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              data-testid={`btn-confirm-delete-cat-${cat.id}`}
                              onClick={() => deleteMutation.mutate(cat.id)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Log tab helpers ─────────────────────────────────────────────────────────

type LogGroup = "Today" | "Yesterday" | "This Week" | "Earlier";

function getLogGroup(date: Date | string | null): LogGroup {
  if (!date) return "Earlier";
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return "This Week";
  return "Earlier";
}

// ─── Main InventoryPanel ─────────────────────────────────────────────────────

export function InventoryPanel({ clinicId }: { clinicId: number }) {
  const [activeTab, setActiveTab] = useState<"stock" | "alerts" | "log" | "categories">("stock");
  const [alertFilter, setAlertFilter] = useState<ItemStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [logSearch, setLogSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<"all" | "add" | "deduct" | "adjust">("all");
  const [showAddItem, setShowAddItem] = useState(false);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [detailOpenInStock, setDetailOpenInStock] = useState(false);

  const { data: categories = [], isLoading: catsLoading } = useQuery<InventoryCategory[]>({
    queryKey: ["/api/clinic/inventory/categories"],
    enabled: !!clinicId,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/clinic/inventory/items"],
    enabled: !!clinicId,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<(StockTransaction & { itemName: string })[]>({
    queryKey: ["/api/clinic/inventory/transactions"],
    enabled: !!clinicId && activeTab === "log",
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<(StockAlert & { itemName: string })[]>({
    queryKey: ["/api/clinic/inventory/alerts"],
    enabled: !!clinicId,
  });

  // All transactions (needed for per-item history inside detail dialog)
  const { data: allTransactions = [] } = useQuery<(StockTransaction & { itemName: string })[]>({
    queryKey: ["/api/clinic/inventory/transactions"],
    enabled: !!clinicId,
  });

  const seededRef = useRef(false);
  useEffect(() => {
    if (catsLoading || seededRef.current || categories.length > 0) return;
    seededRef.current = true;
    const defaults = [
      "PPE", "Patient Care", "Sterilization & Disinfection", "Anesthetics",
      "Restorative Materials", "Impression Materials", "Endodontic Supplies",
      "Surgical Supplies", "Diagnostic Instruments", "Restorative Instruments",
      "Surgical Instruments", "Equipment",
    ];
    Promise.all(defaults.map(name => apiRequest("POST", "/api/clinic/inventory/categories", { name })))
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/categories"] }))
      .catch(() => {});
  }, [catsLoading, categories.length]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clinic/inventory/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/items"] });
      notify.success("Item removed");
    },
    onError: () => notify.error("Failed to delete item"),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/clinic/inventory/alerts/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/alerts"] });
      notify.success("Alert dismissed");
    },
    onError: () => notify.error("Failed to dismiss alert"),
  });

  function handleAlertTypeClick(type: ItemStatus) {
    setAlertFilter(type);
    setActiveTab("alerts");
  }

  function openDetailInStockMode(item: InventoryItem) {
    setDetailOpenInStock(true);
    setDetailItem(item);
  }

  function handleDetailClose() {
    setDetailItem(null);
    setDetailOpenInStock(false);
  }

  // Filtered stock
  const consumables = items.filter(i => i.trackingType === "consumable" || i.trackingType === "perishable");
  const assets = items.filter(i => i.trackingType === "equipment" || i.trackingType === "instrument");

  function filterItems(list: InventoryItem[]) {
    return list.filter(i => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        i.name.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.barcode?.toLowerCase().includes(q) ||
        i.manufacturer?.toLowerCase().includes(q) ||
        i.supplierName?.toLowerCase().includes(q) ||
        i.batchNumber?.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q);
      const matchCat = categoryFilter === "all" || String(i.categoryId) === categoryFilter;
      let matchQuick = true;
      if (quickFilter !== "all") {
        if (quickFilter === "consumable" || quickFilter === "perishable" || quickFilter === "equipment" || quickFilter === "instrument") {
          matchQuick = i.trackingType === quickFilter;
        } else if (quickFilter === "outofstock") {
          matchQuick = i.currentQty <= 0;
        } else {
          matchQuick = getItemStatus(i) === quickFilter;
        }
      }
      return matchSearch && matchCat && matchQuick;
    });
  }

  const filteredConsumables = filterItems(consumables);
  const filteredAssets = filterItems(assets);
  const hasActiveFilters = !!search || categoryFilter !== "all" || quickFilter !== "all";

  function clearAllFilters() {
    setSearch("");
    setCategoryFilter("all");
    setQuickFilter("all");
  }

  // Filtered alerts
  const filteredAlerts = alertFilter === "all"
    ? alerts
    : alerts.filter(a => {
        if (alertFilter === "critical") return a.alertType === "critical";
        if (alertFilter === "low") return a.alertType === "low";
        if (alertFilter === "expiry") return a.alertType === "expiry" || a.alertType === "service_due";
        return true;
      });

  const criticalAlerts = filteredAlerts.filter(a => a.alertType === "critical");
  const lowAlerts = filteredAlerts.filter(a => a.alertType === "low");
  const expiryAlerts = filteredAlerts.filter(a => a.alertType === "expiry" || a.alertType === "service_due");

  // Filtered log
  const filteredTransactions = transactions.filter(tx => {
    const matchSearch = !logSearch || tx.itemName.toLowerCase().includes(logSearch.toLowerCase());
    const matchType = logTypeFilter === "all" || tx.type === logTypeFilter;
    return matchSearch && matchType;
  });

  // Group log by date
  const logGroups: Record<LogGroup, typeof filteredTransactions> = {
    Today: [], Yesterday: [], "This Week": [], Earlier: [],
  };
  filteredTransactions.forEach(tx => {
    logGroups[getLogGroup(tx.performedAt)].push(tx);
  });
  const LOG_GROUP_ORDER: LogGroup[] = ["Today", "Yesterday", "This Week", "Earlier"];

  const isLoading = catsLoading || itemsLoading;

  // Total inventory value
  const totalValue = items.reduce((sum, i) => {
    if (i.unitPrice != null) return sum + i.unitPrice * i.currentQty;
    return sum;
  }, 0);

  // Today's usage & monthly consumption (based on "deduct" transactions)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todaysUsage = transactions.reduce((sum, tx) => {
    if (tx.type !== "deduct" || !tx.performedAt) return sum;
    return new Date(tx.performedAt) >= startOfToday ? sum + Math.abs(tx.qtyChange) : sum;
  }, 0);
  const monthlyConsumption = transactions.reduce((sum, tx) => {
    if (tx.type !== "deduct" || !tx.performedAt) return sum;
    return new Date(tx.performedAt) >= startOfMonth ? sum + Math.abs(tx.qtyChange) : sum;
  }, 0);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5 h-full">

        {/* Header */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex">
            <div className="w-1.5 bg-emerald-500/60 shrink-0" />
            <div className="flex-1 px-5 py-4 bg-gradient-to-r from-emerald-500/[0.06] to-transparent flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Package className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Inventory</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Track consumables, instruments, and equipment
                    {totalValue > 0 && <span className="ml-2 text-emerald-600 font-semibold">· Total value: ₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>}
                  </p>
                </div>
              </div>
              <Button
                data-testid="btn-add-item"
                onClick={() => setShowAddItem(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
              >
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border/50 border-t border-border/50">
            <div className="px-5 py-2.5 flex items-center gap-2" data-testid="kpi-todays-usage">
              <TrendingDown className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <span className="text-xs text-muted-foreground">Today's Usage:</span>
              <span className="text-xs font-bold text-foreground">{todaysUsage} units</span>
            </div>
            <div className="px-5 py-2.5 flex items-center gap-2" data-testid="kpi-monthly-consumption">
              <BarChart3 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="text-xs text-muted-foreground">This Month:</span>
              <span className="text-xs font-bold text-foreground">{monthlyConsumption} units consumed</span>
            </div>
          </div>
        </div>

        {/* Alert strip */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <AlertStrip items={items} onAlertTypeClick={handleAlertTypeClick} />
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-xl p-1 self-start">
          {([
            ["stock", "Stock", <Box className="h-3.5 w-3.5" />],
            ["alerts", "Alerts", <AlertTriangle className="h-3.5 w-3.5" />],
            ["log", "Log", <ClipboardList className="h-3.5 w-3.5" />],
            ["categories", "Categories", <Settings2 className="h-3.5 w-3.5" />],
          ] as [string, string, JSX.Element][]).map(([val, label, icon]) => (
            <button
              key={val}
              data-testid={`tab-${val}`}
              onClick={() => setActiveTab(val as "stock" | "alerts" | "log" | "categories")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === val ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {icon}{label}
              {val === "alerts" && alerts.length > 0 && (
                <span className={`text-xs font-bold px-1.5 py-px rounded-full ${activeTab === "alerts" ? "bg-white/25 text-white" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── STOCK TAB ── */}
        {activeTab === "stock" && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 bg-card border border-border rounded-xl px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  data-testid="input-search-items"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search by name, SKU, barcode, supplier..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground" aria-label="Clear search">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter" className="w-36 rounded-xl">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="btn-export-csv"
                    variant="outline"
                    size="icon"
                    onClick={() => exportInventoryCSV(items, categories)}
                    className="rounded-xl shrink-0"
                    aria-label="Export as CSV"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export as CSV</TooltipContent>
              </Tooltip>
            </div>

            {/* Quick filter chips — kept alongside the category dropdown above (chips = common cuts, dropdown = full category list) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {QUICK_FILTERS.map(({ value, label, icon: ChipIcon }) => (
                <button
                  key={value}
                  data-testid={`quick-filter-${value}`}
                  onClick={() => setQuickFilter(value)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all min-h-[32px] ${
                    quickFilter === value
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50"
                  }`}
                >
                  <ChipIcon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
              </div>
            ) : (
              <>
                {filteredConsumables.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Consumables & Perishables</span>
                      <span className="text-xs font-bold px-2 py-px rounded-full bg-muted text-muted-foreground border border-border">{filteredConsumables.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredConsumables.map(item => (
                        <ConsumableCard
                          key={item.id}
                          item={item}
                          categories={categories}
                          onDeduct={openDetailInStockMode}
                          onDetail={setDetailItem}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredAssets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Instruments & Equipment</span>
                      <span className="text-xs font-bold px-2 py-px rounded-full bg-muted text-muted-foreground border border-border">{filteredAssets.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {filteredAssets.map(item => (
                        <AssetRow
                          key={item.id}
                          item={item}
                          categories={categories}
                          onDetail={setDetailItem}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredConsumables.length === 0 && filteredAssets.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No items found</p>
                    <p className="text-sm mt-1">
                      {items.length === 0 ? "Add your first inventory item to get started." : "Try adjusting your search or filter."}
                    </p>
                    {items.length > 0 && hasActiveFilters && (
                      <Button
                        data-testid="btn-clear-filters"
                        variant="outline"
                        className="mt-4"
                        onClick={clearAllFilters}
                      >
                        <X className="h-3.5 w-3.5 mr-1.5" /> Clear Filters
                      </Button>
                    )}
                    {items.length === 0 && (
                      <Button
                        data-testid="btn-add-first-item"
                        onClick={() => setShowAddItem(true)}
                        className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add First Item
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {activeTab === "alerts" && (
          <div className="flex flex-col gap-3">
            {/* Alert type filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {([
                ["all", "All"],
                ["critical", "Critical"],
                ["low", "Low Stock"],
                ["expiry", "Expiring"],
              ] as [typeof alertFilter, string][]).map(([val, label]) => (
                <button
                  key={val}
                  data-testid={`alert-filter-${val}`}
                  onClick={() => setAlertFilter(val)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all min-h-[32px] ${alertFilter === val ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
                >
                  {label}
                  {val !== "all" && (
                    <span className={`ml-1.5 text-xs font-bold ${alertFilter === val ? "text-white/80" : "text-muted-foreground"}`}>
                      {val === "critical" ? alerts.filter(a => a.alertType === "critical").length
                        : val === "low" ? alerts.filter(a => a.alertType === "low").length
                        : alerts.filter(a => a.alertType === "expiry" || a.alertType === "service_due").length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {alertsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30 text-emerald-500" />
                <p className="font-semibold">{alertFilter === "all" ? "All clear" : `No ${alertFilter} alerts`}</p>
                <p className="text-sm mt-1">
                  {alertFilter === "all" ? "No active alerts. Inventory looks healthy." : "No alerts of this type right now."}
                </p>
                {alertFilter !== "all" && (
                  <Button variant="outline" className="mt-4" onClick={() => setAlertFilter("all")}>
                    <X className="h-3.5 w-3.5 mr-1.5" /> Show all alerts
                  </Button>
                )}
              </div>
            ) : (
              <>
                {[
                  { list: criticalAlerts, label: "Critical Stock", color: "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/40", icon: <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />, badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
                  { list: expiryAlerts, label: "Expiring / Service Due", color: "border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900/40", icon: <CalendarClock className="h-4 w-4 text-orange-500 shrink-0" />, badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
                  { list: lowAlerts, label: "Low Stock", color: "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900/40", icon: <TrendingDown className="h-4 w-4 text-yellow-500 shrink-0" />, badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
                ].map(group => group.list.length > 0 && (
                  <div key={group.label}>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                      {group.icon}{group.label}
                      <span className={`text-xs font-bold px-2 py-px rounded-full ${group.badge}`}>{group.list.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.list.map(alert => (
                        <div
                          key={alert.id}
                          data-testid={`alert-row-${alert.id}`}
                          className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${group.color}`}
                        >
                          {group.icon}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{alert.itemName}</div>
                            <div className="text-xs text-muted-foreground capitalize mt-0.5">{alert.alertType.replace("_", " ")} · {alert.createdAt ? format(new Date(alert.createdAt), "dd MMM, h:mm a") : ""}</div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                data-testid={`dismiss-alert-${alert.id}`}
                                onClick={() => dismissMutation.mutate(alert.id)}
                                className="h-9 w-9 rounded-lg flex items-center justify-center border border-border bg-card hover:bg-muted transition-colors text-muted-foreground shrink-0"
                                aria-label="Dismiss alert"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Dismiss alert</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── LOG TAB ── */}
        {activeTab === "log" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 bg-card border border-border rounded-xl px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  data-testid="input-log-search"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search by item name..."
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                />
                {logSearch && (
                  <button onClick={() => setLogSearch("")} className="text-muted-foreground hover:text-foreground" aria-label="Clear log search">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={logTypeFilter} onValueChange={v => setLogTypeFilter(v as typeof logTypeFilter)}>
                <SelectTrigger data-testid="select-log-type" className="w-32 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="deduct">Deduct</SelectItem>
                  <SelectItem value="adjust">Adjust</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              Read-only audit trail — all stock movements are recorded here automatically.
            </div>

            {txLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No transactions found</p>
                <p className="text-sm mt-1">
                  {transactions.length === 0 ? "Stock movements will appear here." : "Try adjusting your search or filter."}
                </p>
                {(logSearch || logTypeFilter !== "all") && (
                  <Button variant="outline" className="mt-4" onClick={() => { setLogSearch(""); setLogTypeFilter("all"); }}>
                    <X className="h-3.5 w-3.5 mr-1.5" /> Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {LOG_GROUP_ORDER.filter(group => logGroups[group].length > 0).map(group => (
                  <div key={group}>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">{group}</div>
                    <div className="flex flex-col gap-1.5">
                      {logGroups[group].map(tx => {
                        const dotCls = tx.type === "add" ? "bg-emerald-500" : tx.type === "deduct" ? "bg-red-500" : "bg-blue-500";
                        const numCls = tx.type === "add" ? "text-emerald-600 dark:text-emerald-400" : tx.type === "deduct" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";
                        return (
                          <div
                            key={tx.id}
                            data-testid={`tx-row-${tx.id}`}
                            className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3"
                          >
                            <span className={`h-2 w-2 rounded-full shrink-0 ${dotCls}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{tx.itemName}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {tx.reason || <span className="italic">No reason given</span>}
                                {tx.performedBy && <> · <span>{tx.performedBy}</span></>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-sm font-bold ${numCls}`}>
                                {tx.type === "add" ? "+" : tx.type === "deduct" ? "−" : "→"}{Math.abs(tx.qtyChange)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {tx.qtyBefore} → {tx.qtyAfter}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground text-right shrink-0 w-16">
                              {tx.performedAt ? format(new Date(tx.performedAt), "dd MMM") : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CATEGORIES TAB ── */}
        {activeTab === "categories" && (
          <CategoryManagementSection categories={categories} />
        )}
      </div>

      {/* Sheets / Dialogs */}
      <AddItemSheet
        open={showAddItem}
        onOpenChange={setShowAddItem}
        categories={categories}
        onSuccess={() => {}}
      />

      <ItemDetailDialog
        item={detailItem}
        categories={categories}
        onClose={handleDetailClose}
        onDelete={(id) => deleteMutation.mutate(id)}
        transactions={allTransactions}
      />
    </TooltipProvider>
  );
}
