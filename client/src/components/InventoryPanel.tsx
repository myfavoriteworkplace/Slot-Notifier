import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import {
  Package, Plus, Search, AlertTriangle, CheckCircle2, Clock,
  Trash2, Minus, PackagePlus, ClipboardList, ChevronDown, X,
  Wrench, FlaskConical, Stethoscope, Box, TrendingDown, TrendingUp,
  ArrowUpDown, ShieldAlert, CalendarClock, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
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

// ─── sub-components ─────────────────────────────────────────────────────────

function AlertStrip({
  items, onAlertsClick,
}: {
  items: InventoryItem[];
  onAlertsClick: () => void;
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
      clickable: true,
    },
    {
      num: low, label: "Low Stock", sub: "Below reorder level",
      bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900/40",
      numCls: "text-yellow-600 dark:text-yellow-500",
      icon: <TrendingDown className="h-4 w-4 text-yellow-500" />,
      clickable: true,
    },
    {
      num: expiring, label: "Expiring Soon", sub: "Within 30 days",
      bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40",
      numCls: "text-orange-600 dark:text-orange-400",
      icon: <CalendarClock className="h-4 w-4 text-orange-500" />,
      clickable: true,
    },
    {
      num: total, label: "Total Items", sub: "All tracked items",
      bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40",
      numCls: "text-emerald-600 dark:text-emerald-500",
      icon: <Box className="h-4 w-4 text-emerald-500" />,
      clickable: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <button
          key={c.label}
          onClick={c.clickable ? onAlertsClick : undefined}
          data-testid={`inventory-stat-${c.label.toLowerCase().replace(/ /g, "-")}`}
          className={`rounded-xl border p-4 text-left transition-all ${c.bg} ${c.clickable ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : "cursor-default"}`}
        >
          <div className="flex items-center justify-between mb-2">
            {c.icon}
          </div>
          <div className={`text-3xl font-extrabold tracking-tight leading-none mb-1 ${c.numCls}`}>{c.num}</div>
          <div className="text-xs font-semibold text-foreground">{c.label}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</div>
        </button>
      ))}
    </div>
  );
}

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

      <div className="flex items-start justify-between mb-2 mt-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${col.dot}`} />
            <span className="text-sm font-bold text-foreground truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Icon className="h-3 w-3 shrink-0" />
            <span className="capitalize">{item.trackingType}</span>
            {cat && <><span>·</span><span>{cat.name}</span></>}
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span className={`text-3xl font-extrabold tracking-tight leading-none ${col.text}`}>{item.currentQty}</span>
        {item.unit && <span className="text-xs text-muted-foreground font-medium">{item.unit}</span>}
        {item.reorderLevel !== null && (
          <span className="ml-auto text-[10px] text-muted-foreground">min {item.reorderLevel}</span>
        )}
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all ${col.bar}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          {exp && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${exp.cls}`}>{exp.text}</span>
          )}
        </div>
        <button
          data-testid={`deduct-btn-${item.id}`}
          onClick={(e) => { e.stopPropagation(); onDeduct(item); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Minus className="h-3 w-3" /> Deduct
        </button>
      </div>
    </div>
  );
}

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
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {cat ? cat.name : <span className="italic">Uncategorised</span>}
          {item.notes && <span className="ml-2">· {item.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
        {svc && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${svc.cls}`}>{svc.text}</span>}
        {wty && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${wty.cls}`}>{wty.text}</span>}
        {!svc && !wty && <span className="text-[10px] text-muted-foreground italic">No service/warranty set</span>}
      </div>
    </div>
  );
}

// ─── Add Item Sheet ──────────────────────────────────────────────────────────

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
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", trackingType: "consumable", unit: "units", categoryId: "",
    currentQty: "", reorderLevel: "", criticalLevel: "",
    expiryDate: "", warrantyExpiry: "", nextServiceDate: "", notes: "",
  });

  const isAsset = form.trackingType === "equipment" || form.trackingType === "instrument";

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/clinic/inventory/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/transactions"] });
      toast({ title: "Item added", description: `${form.name} added to inventory.` });
      setForm({ name: "", trackingType: "consumable", unit: "units", categoryId: "", currentQty: "", reorderLevel: "", criticalLevel: "", expiryDate: "", warrantyExpiry: "", nextServiceDate: "", notes: "" });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to add item.", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    mutation.mutate({
      name: form.name.trim(),
      trackingType: form.trackingType,
      unit: form.unit || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      currentQty: form.currentQty ? Number(form.currentQty) : 0,
      reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : null,
      criticalLevel: form.criticalLevel ? Number(form.criticalLevel) : null,
      expiryDate: form.expiryDate || null,
      warrantyExpiry: form.warrantyExpiry || null,
      nextServiceDate: form.nextServiceDate || null,
      notes: form.notes || null,
    });
  }

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const onChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

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
          {/* Type selector */}
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

          {/* Name */}
          <div>
            <Label htmlFor="inv-name" className="text-xs font-semibold mb-1 block">Item Name *</Label>
            <Input
              id="inv-name"
              data-testid="input-item-name"
              placeholder={`e.g. ${form.trackingType === "consumable" ? "Latex Gloves" : form.trackingType === "perishable" ? "Lidocaine 2%" : form.trackingType === "instrument" ? "Dental Mirror" : "Autoclave Machine"}`}
              value={form.name}
              onChange={onChange("name")}
              required
            />
          </div>

          {/* Category + Unit */}
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

          {/* Qty / thresholds — consumables only */}
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

          {/* Dates */}
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

          {/* Notes */}
          <div>
            <Label htmlFor="inv-notes" className="text-xs font-semibold mb-1 block">Notes</Label>
            <Textarea id="inv-notes" data-testid="input-notes" placeholder="Optional notes..." value={form.notes} onChange={onChange("notes")} rows={2} />
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

// ─── Deduct / Adjust Dialog ──────────────────────────────────────────────────

function StockActionDialog({
  item,
  onClose,
}: {
  item: InventoryItem | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [qty, setQty] = useState("");
  const [type, setType] = useState<"add" | "deduct" | "adjust">("deduct");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/clinic/inventory/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/alerts"] });
      toast({ title: "Stock updated", description: "Inventory has been updated." });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to update stock.", variant: "destructive" }),
  });

  if (!item) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qty || isNaN(Number(qty)) || Number(qty) < 0) return;
    mutation.mutate({ itemId: item!.id, type, qtyChange: Number(qty), reason: reason || null });
  }

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[400px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowUpDown className="h-4 w-4 text-emerald-600" />
            Update Stock — {item.name}
          </DialogTitle>
          <DialogDescription>
            Current: <strong>{item.currentQty} {item.unit || "units"}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-2">
            {(["add", "deduct", "adjust"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 rounded-lg text-xs font-bold capitalize border transition-all ${type === t ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
              >
                {t === "add" ? <TrendingUp className="h-3.5 w-3.5 mx-auto mb-0.5" /> : t === "deduct" ? <TrendingDown className="h-3.5 w-3.5 mx-auto mb-0.5" /> : <ArrowUpDown className="h-3.5 w-3.5 mx-auto mb-0.5" />}
                {t}
              </button>
            ))}
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">
              {type === "adjust" ? "Set quantity to" : `Quantity to ${type}`}
            </Label>
            <Input
              data-testid="input-stock-qty"
              type="number"
              min={0}
              placeholder="0"
              value={qty}
              onChange={e => setQty(e.target.value)}
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Reason</Label>
            <Input
              data-testid="input-stock-reason"
              placeholder="e.g. Used in procedure, restocked..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            data-testid="btn-stock-submit"
            disabled={mutation.isPending || !qty}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {mutation.isPending ? "Saving..." : "Update Stock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item Detail Dialog ──────────────────────────────────────────────────────

function ItemDetailDialog({
  item,
  categories,
  onClose,
  onDeduct,
  onDelete,
}: {
  item: InventoryItem | null;
  categories: InventoryCategory[];
  onClose: () => void;
  onDeduct: (item: InventoryItem) => void;
  onDelete: (id: number) => void;
}) {
  if (!item) return null;
  const status = getItemStatus(item);
  const col = STATUS_COLORS[status];
  const cat = categories.find(c => c.id === item.categoryId);
  const isAsset = item.trackingType === "equipment" || item.trackingType === "instrument";

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${col.dot}`} />
            {item.name}
          </DialogTitle>
          <DialogDescription>
            <span className="capitalize">{item.trackingType}</span>
            {cat && <> · {cat.name}</>}
            {item.unit && <> · {item.unit}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {!isAsset && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <div className={`text-2xl font-extrabold ${col.text}`}>{item.currentQty}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Current</div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <div className="text-2xl font-extrabold text-yellow-600">{item.reorderLevel ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Reorder</div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <div className="text-2xl font-extrabold text-red-600">{item.criticalLevel ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Critical</div>
              </div>
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
          {item.notes && (
            <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">{item.notes}</div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {!isAsset && (
            <Button
              data-testid="btn-detail-deduct"
              onClick={() => { onClose(); onDeduct(item); }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ArrowUpDown className="h-4 w-4 mr-1" /> Update Stock
            </Button>
          )}
          <Button
            data-testid="btn-detail-delete"
            variant="outline"
            onClick={() => { onDelete(item.id); onClose(); }}
            className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main InventoryPanel ─────────────────────────────────────────────────────

export function InventoryPanel({ clinicId }: { clinicId: number }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"stock" | "alerts" | "log">("stock");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddItem, setShowAddItem] = useState(false);
  const [deductItem, setDeductItem] = useState<InventoryItem | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

  const { data: categories = [], isLoading: catsLoading } = useQuery<InventoryCategory[]>({
    queryKey: ["/api/clinic/inventory/categories"],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/clinic/inventory/items"],
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<(StockTransaction & { itemName: string })[]>({
    queryKey: ["/api/clinic/inventory/transactions"],
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<(StockAlert & { itemName: string })[]>({
    queryKey: ["/api/clinic/inventory/alerts"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clinic/inventory/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/items"] });
      toast({ title: "Item removed", description: "Item deleted from inventory." });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/clinic/inventory/alerts/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/inventory/alerts"] });
    },
  });

  // Filtered items
  const consumables = items.filter(i => i.trackingType === "consumable" || i.trackingType === "perishable");
  const assets = items.filter(i => i.trackingType === "equipment" || i.trackingType === "instrument");

  const filterItems = (list: InventoryItem[]) =>
    list.filter(i => {
      const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || String(i.categoryId) === categoryFilter;
      return matchSearch && matchCat;
    });

  const filteredConsumables = filterItems(consumables);
  const filteredAssets = filterItems(assets);

  // Alerts grouped by severity
  const criticalAlerts = alerts.filter(a => a.alertType === "critical");
  const lowAlerts = alerts.filter(a => a.alertType === "low");
  const expiryAlerts = alerts.filter(a => a.alertType === "expiry" || a.alertType === "service_due");

  const isLoading = catsLoading || itemsLoading;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5 h-full">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              Inventory
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track consumables, instruments, and equipment</p>
          </div>
          <Button
            data-testid="btn-add-item"
            onClick={() => setShowAddItem(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>

        {/* Alert strip */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <AlertStrip items={items} onAlertsClick={() => setActiveTab("alerts")} />
        )}

        {/* Tabs */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 bg-muted/50 border border-border rounded-xl p-1">
            {([
              ["stock", "Stock", <Box className="h-3.5 w-3.5" />],
              ["alerts", "Alerts", <AlertTriangle className="h-3.5 w-3.5" />],
              ["log", "Log", <ClipboardList className="h-3.5 w-3.5" />],
            ] as [string, string, JSX.Element][]).map(([val, label, icon]) => (
              <button
                key={val}
                data-testid={`tab-${val}`}
                onClick={() => setActiveTab(val as "stock" | "alerts" | "log")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === val ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {icon}{label}
                {val === "alerts" && alerts.length > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${activeTab === "alerts" ? "bg-white/25 text-white" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                    {alerts.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── STOCK TAB ── */}
        {activeTab === "stock" && (
          <div className="flex flex-col gap-4">
            {/* Search + filter */}
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 bg-card border border-border rounded-xl px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  data-testid="input-search-items"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search items..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
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
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
              </div>
            ) : (
              <>
                {/* Consumables */}
                {filteredConsumables.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Consumables & Perishables</span>
                      <span className="text-[10px] font-bold px-2 py-px rounded-full bg-muted text-muted-foreground border border-border">{filteredConsumables.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredConsumables.map(item => (
                        <ConsumableCard
                          key={item.id}
                          item={item}
                          categories={categories}
                          onDeduct={setDeductItem}
                          onDetail={setDetailItem}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Assets */}
                {filteredAssets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Instruments & Equipment</span>
                      <span className="text-[10px] font-bold px-2 py-px rounded-full bg-muted text-muted-foreground border border-border">{filteredAssets.length}</span>
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
            {alertsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30 text-emerald-500" />
                <p className="font-semibold">All clear</p>
                <p className="text-sm mt-1">No active alerts. Inventory looks healthy.</p>
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
                      <span className={`text-[10px] font-bold px-2 py-px rounded-full ${group.badge}`}>{group.list.length}</span>
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
                            <div className="text-[11px] text-muted-foreground capitalize mt-0.5">{alert.alertType.replace("_", " ")} · {alert.createdAt ? format(new Date(alert.createdAt), "dd MMM, h:mm a") : ""}</div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                data-testid={`dismiss-alert-${alert.id}`}
                                onClick={() => dismissMutation.mutate(alert.id)}
                                className="h-7 w-7 rounded-lg flex items-center justify-center border border-border bg-card hover:bg-muted transition-colors text-muted-foreground"
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
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              Read-only audit trail — all stock movements are recorded here automatically.
            </div>

            {txLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No transactions yet</p>
                <p className="text-sm mt-1">Stock movements will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {transactions.map(tx => {
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
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {tx.reason || <span className="italic">No reason given</span>}
                          {tx.performedBy && <> · <span>{tx.performedBy}</span></>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-bold ${numCls}`}>
                          {tx.type === "add" ? "+" : tx.type === "deduct" ? "-" : "→"}{Math.abs(tx.qtyChange)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {tx.qtyBefore} → {tx.qtyAfter}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right shrink-0 w-16">
                        {tx.performedAt ? format(new Date(tx.performedAt), "dd MMM") : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sheets / Dialogs */}
      <AddItemSheet
        open={showAddItem}
        onOpenChange={setShowAddItem}
        categories={categories}
        onSuccess={() => {}}
      />

      <StockActionDialog
        item={deductItem}
        onClose={() => setDeductItem(null)}
      />

      <ItemDetailDialog
        item={detailItem}
        categories={categories}
        onClose={() => setDetailItem(null)}
        onDeduct={(item) => { setDetailItem(null); setDeductItem(item); }}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </TooltipProvider>
  );
}
