import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import {
  Pill, Plus, Pencil, Trash2, Loader2, X, Search, Package,
  AlertTriangle, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { PharmacyStockItem } from "@shared/schema";

interface PharmacyStockPanelProps {
  clinicId: number;
}

interface FormState {
  medicineName: string;
  dosage: string;
  unitPrice: string;
  availableQty: string;
  expiryDate: string;
}

const emptyForm = (): FormState => ({
  medicineName: "",
  dosage: "",
  unitPrice: "",
  availableQty: "",
  expiryDate: "",
});

export default function PharmacyStockPanel({ clinicId }: PharmacyStockPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery<PharmacyStockItem[]>({
    queryKey: ["/api/auth/clinic/pharmacy"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/clinic/pharmacy");
      if (!res.ok) throw new Error("Failed to load pharmacy catalog");
      return res.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/pharmacy"] });

  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const res = await apiRequest("POST", "/api/auth/clinic/pharmacy", {
        medicineName: data.medicineName.trim(),
        dosage: data.dosage.trim() || null,
        unitPrice: parseFloat(data.unitPrice) || 0,
        availableQty: parseInt(data.availableQty) || 0,
        expiryDate: data.expiryDate || null,
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { invalidate(); resetForm(); notify.success("Medicine added to catalog"); },
    onError: (e: any) => notify.error(e.message || "Could not add medicine"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormState }) => {
      const res = await apiRequest("PATCH", `/api/auth/clinic/pharmacy/${id}`, {
        medicineName: data.medicineName.trim(),
        dosage: data.dosage.trim() || null,
        unitPrice: parseFloat(data.unitPrice) || 0,
        availableQty: parseInt(data.availableQty) || 0,
        expiryDate: data.expiryDate || null,
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { invalidate(); resetForm(); notify.success("Medicine updated"); },
    onError: (e: any) => notify.error(e.message || "Could not update medicine"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/auth/clinic/pharmacy/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { invalidate(); notify.success("Medicine removed from catalog"); },
    onError: () => notify.error("Could not delete medicine"),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (item: PharmacyStockItem) => {
    setEditingId(item.id);
    setForm({
      medicineName: item.medicineName,
      dosage: item.dosage || "",
      unitPrice: String(item.unitPrice ?? ""),
      availableQty: String(item.availableQty ?? ""),
      expiryDate: item.expiryDate || "",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.medicineName.trim()) { notify.warning("Medicine name is required"); return; }
    if (!form.unitPrice || isNaN(parseFloat(form.unitPrice))) { notify.warning("Enter a valid unit price"); return; }
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filtered = items.filter(i =>
    i.medicineName.toLowerCase().includes(search.toLowerCase()) ||
    (i.dosage || "").toLowerCase().includes(search.toLowerCase())
  );

  const isExpiringSoon = (expiry: string | null | undefined) => {
    if (!expiry) return false;
    try {
      const d = new Date(expiry);
      const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return diff < 30 && diff >= 0;
    } catch { return false; }
  };

  const isExpired = (expiry: string | null | undefined) => {
    if (!expiry) return false;
    try { return new Date(expiry).getTime() < Date.now(); } catch { return false; }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
              <Pill className="h-[18px] w-[18px] text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Pharmacy Stock Catalog</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {items.length} medicine{items.length !== 1 ? "s" : ""} · pricing source for billing
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="h-8 gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white border-0"
            data-testid="button-add-medicine"
          >
            <Plus className="h-3.5 w-3.5" /> Add Medicine
          </Button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search medicines…"
              className="pl-8 h-8 text-xs"
              data-testid="input-pharmacy-search"
            />
          </div>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <div className="px-5 py-4 border-b border-border/40 bg-orange-50/40 dark:bg-orange-950/10 animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                {editingId ? "Edit Medicine" : "New Medicine"}
              </span>
              <button onClick={resetForm} className="p-1 rounded hover:bg-muted/60 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medicine Name *</Label>
                <Input
                  value={form.medicineName}
                  onChange={e => setForm(f => ({ ...f, medicineName: e.target.value }))}
                  placeholder="e.g. Amoxicillin"
                  className="h-8 text-xs mt-1"
                  data-testid="input-medicine-name"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dosage</Label>
                <Input
                  value={form.dosage}
                  onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                  placeholder="e.g. 500mg"
                  className="h-8 text-xs mt-1"
                  data-testid="input-medicine-dosage"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit Price (₹) *</Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                    placeholder="0.00"
                    className="pl-5 h-8 text-xs"
                    data-testid="input-medicine-price"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.availableQty}
                  onChange={e => setForm(f => ({ ...f, availableQty: e.target.value }))}
                  placeholder="0"
                  className="h-8 text-xs mt-1"
                  data-testid="input-medicine-qty"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="h-8 text-xs mt-1"
                  data-testid="input-medicine-expiry"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-3 justify-end">
              <Button size="sm" variant="outline" onClick={resetForm} className="h-7 text-xs" disabled={isPending}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isPending}
                className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white border-0 gap-1"
                data-testid="button-save-medicine"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {editingId ? "Update" : "Add to Catalog"}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
              <Package className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No medicines match your search" : "No medicines in catalog yet"}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Add medicines to auto-price prescriptions in billing
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Medicine</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Dosage</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Unit Price</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Qty</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Expiry</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(item => {
                  const expiring = isExpiringSoon(item.expiryDate);
                  const expired = isExpired(item.expiryDate);
                  const lowStock = item.availableQty <= 5;
                  return (
                    <tr
                      key={item.id}
                      className={`group hover:bg-muted/20 transition-colors ${expired ? "opacity-60" : ""}`}
                      data-testid={`pharmacy-row-${item.id}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-foreground">{item.medicineName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{item.dosage || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-primary">
                        ₹{(item.unitPrice ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-medium ${lowStock && item.availableQty > 0 ? "text-amber-600" : item.availableQty === 0 ? "text-red-500" : "text-foreground"}`}>
                          {item.availableQty}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {item.expiryDate ? (
                          <span className={`inline-flex items-center gap-1 ${expired ? "text-red-500 font-semibold" : expiring ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                            {(expired || expiring) && <AlertTriangle className="h-3 w-3 shrink-0" />}
                            {expired ? "Expired" : expiring ? `Exp soon` : item.expiryDate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                            title="Edit"
                            data-testid={`button-edit-medicine-${item.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500"
                                title="Delete"
                                data-testid={`button-delete-medicine-${item.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {item.medicineName}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This medicine will be removed from the pharmacy catalog. Existing bills are not affected.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Back</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer stats */}
        {items.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/30 bg-muted/10 flex items-center gap-4 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{items.length}</span> medicines
            </span>
            {items.filter(i => isExpiringSoon(i.expiryDate)).length > 0 && (
              <span className="text-[11px] text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {items.filter(i => isExpiringSoon(i.expiryDate)).length} expiring soon
              </span>
            )}
            {items.filter(i => isExpired(i.expiryDate)).length > 0 && (
              <span className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {items.filter(i => isExpired(i.expiryDate)).length} expired
              </span>
            )}
            {items.filter(i => i.availableQty <= 5).length > 0 && (
              <span className="text-[11px] text-amber-600">
                {items.filter(i => i.availableQty <= 5).length} low stock
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
