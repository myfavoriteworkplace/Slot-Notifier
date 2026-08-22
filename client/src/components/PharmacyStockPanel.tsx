import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import type { PharmacyStockItem } from "@shared/schema";
import {
  Pill, Plus, Pencil, Trash2, Loader2, X, Search, Package,
  AlertTriangle, Check, SlidersHorizontal, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

type PharmacyResponse = {
  data: PharmacyStockItem[];
  total: number;
  page: number;
  totalPages: number;
  stats: { total: number; expiringSoon: number; expired: number; lowStock: number };
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const EMPTY_RESPONSE: PharmacyResponse = { data: [], total: 0, page: 1, totalPages: 1, stats: { total: 0, expiringSoon: 0, expired: 0, lowStock: 0 } };

const emptyForm = (): FormState => ({
  medicineName: "",
  dosage: "",
  unitPrice: "",
  availableQty: "",
  expiryDate: "",
});

export default function PharmacyStockPanel({ clinicId }: PharmacyStockPanelProps) {
  const [showAddRow, setShowAddRow] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [sort, setSort] = useState<string>('name');
  const [filterOpen, setFilterOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on sort/pageSize change
  useEffect(() => { setPage(1); }, [sort, pageSize]);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({
      page: String(page), pageSize: String(pageSize), sort,
    });
    if (debouncedSearch) p.set('q', debouncedSearch);
    return p.toString();
  }, [page, pageSize, sort, debouncedSearch]);

  const { data: response = EMPTY_RESPONSE, isLoading } = useQuery<PharmacyResponse>({
    queryKey: ['/api/auth/clinic/pharmacy/paged', debouncedSearch, sort, page, pageSize],
    enabled: !!clinicId,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/auth/clinic/pharmacy/paged?${buildParams()}`);
      if (!res.ok) throw new Error("Failed to load pharmacy catalog");
      return res.json();
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/pharmacy/paged'] });
    queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/pharmacy'] });
  };

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
    onSuccess: () => { invalidate(); setShowAddRow(false); setForm(emptyForm()); notify.success("Medicine added to catalog"); },
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
    onSuccess: () => { invalidate(); setEditingId(null); setEditForm(emptyForm()); notify.success("Medicine updated"); },
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

  const startEdit = (item: PharmacyStockItem) => {
    setShowAddRow(false);
    setEditingId(item.id);
    setEditForm({
      medicineName: item.medicineName,
      dosage: item.dosage || "",
      unitPrice: String(item.unitPrice ?? ""),
      availableQty: String(item.availableQty ?? ""),
      expiryDate: item.expiryDate || "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(emptyForm()); };

  const handleAdd = () => {
    if (!form.medicineName.trim()) { notify.warning("Medicine name is required"); return; }
    if (!form.unitPrice || isNaN(parseFloat(form.unitPrice))) { notify.warning("Enter a valid unit price"); return; }
    createMutation.mutate(form);
  };

  const handleUpdate = (id: number) => {
    if (!editForm.medicineName.trim()) { notify.warning("Medicine name is required"); return; }
    if (!editForm.unitPrice || isNaN(parseFloat(editForm.unitPrice))) { notify.warning("Enter a valid unit price"); return; }
    updateMutation.mutate({ id, data: editForm });
  };

  const items = response.data;
  const total = response.total;
  const totalPages = response.totalPages;
  const stats = response.stats;
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);

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

  const inputCls = "h-7 text-base sm:text-xs px-2 border-border/60 focus-visible:outline-none focus-visible:border-orange-400";

  const sortOptions = [
    { value: 'name', label: 'Name A–Z' },
    { value: 'price-asc', label: 'Price (low)' },
    { value: 'price-desc', label: 'Price (high)' },
    { value: 'qty-asc', label: 'Qty (low)' },
    { value: 'qty-desc', label: 'Qty (high)' },
    { value: 'expiry', label: 'Expiry soonest' },
  ];

  return (
    <div className="space-y-5">
      {/* Panel header */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="flex border-b border-border/50">
          <div className="w-1.5 bg-orange-500/60 shrink-0" />
          <div className="flex-1 px-5 py-4 bg-gradient-to-r from-orange-500/[0.06] to-transparent flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                <Pill className="h-[18px] w-[18px] text-orange-600 dark:text-orange-400" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Pharmacy Stock Catalog</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage medicines, pricing and stock levels</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => { cancelEdit(); setForm(emptyForm()); setShowAddRow(v => !v); }}
              className={`h-9 min-h-[44px] gap-1.5 text-xs border-0 ${showAddRow ? "bg-muted text-foreground hover:bg-muted/80" : "bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white"}`}
              data-testid="button-add-medicine"
            >
              {showAddRow ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showAddRow ? "Cancel" : "Add Medicine"}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Medicines', value: isLoading ? null : stats.total, icon: Package, color: 'orange', subtitle: isLoading ? null : 'in catalog' },
          { label: 'Expiring Soon', value: isLoading ? null : stats.expiringSoon, icon: AlertTriangle, color: 'amber', subtitle: isLoading ? null : 'within 30 days' },
          { label: 'Expired', value: isLoading ? null : stats.expired, icon: X, color: 'red', subtitle: isLoading ? null : 'past expiry' },
          { label: 'Low Stock', value: isLoading ? null : stats.lowStock, icon: AlertTriangle, color: 'amber', subtitle: isLoading ? null : 'qty ≤ 5' },
        ].map(({ label, value, icon: Icon, color, subtitle }) => {
          const bgCls = color === 'orange' ? 'bg-orange-500/10' : color === 'amber' ? 'bg-amber-500/10' : 'bg-red-500/10';
          const textCls = color === 'orange' ? 'text-orange-600' : color === 'amber' ? 'text-amber-600' : 'text-red-600';
          return (
            <div key={label} className="rounded-xl border border-border/50 bg-card p-3 sm:p-4">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-5 w-5 rounded-md" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center ${bgCls}`}>
                      <Icon className={`h-3 w-3 ${textCls}`} aria-hidden="true" />
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-none">{label}</p>
                  </div>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  {subtitle && <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search medicines by name or dosage…"
            className="pl-8 pr-8 h-9 text-base sm:text-sm"
            data-testid="input-pharmacy-search"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              data-testid="button-clear-pharmacy-search"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              className={`h-9 px-3 rounded-lg border text-sm font-semibold flex items-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 ${
                filterOpen || sort !== 'name'
                  ? 'bg-orange-500/10 border-orange-400/40 text-orange-600'
                  : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
              }`}
              data-testid="button-pharmacy-filters"
              aria-label="Sort and filter"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filters
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4 space-y-4" align="end">
            {/* Sort */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sort by</p>
              <div className="flex flex-wrap gap-1.5">
                {sortOptions.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setSort(o.value)}
                    data-testid={`button-pharmacy-sort-${o.value}`}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 ${
                      sort === o.value
                        ? 'bg-orange-500/10 text-orange-600 border-orange-400/50'
                        : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table container */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">

        {/* Table */}
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-8">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Medicine</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Dosage</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Unit Price</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Qty</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Expiry</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="bg-background">
                    <td className="px-3 py-3 text-center"><Skeleton className="h-3.5 w-4 mx-auto" /></td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </td>
                    <td className="px-3 py-3"><Skeleton className="h-3.5 w-20" /></td>
                    <td className="px-3 py-3 text-right"><Skeleton className="h-3.5 w-12 ml-auto" /></td>
                    <td className="px-3 py-3 text-right"><Skeleton className="h-3.5 w-8 ml-auto" /></td>
                    <td className="px-3 py-3"><Skeleton className="h-3.5 w-20" /></td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-end">
                        <Skeleton className="h-6 w-6 rounded" />
                        <Skeleton className="h-6 w-6 rounded" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-8">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Medicine</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Dosage</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Unit Price</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Qty</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Expiry</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">

                {/* Inline add row */}
                {showAddRow && (
                  <tr className="bg-orange-50/60 dark:bg-orange-950/10 border-b border-orange-200/40 dark:border-orange-900/30">
                    <td className="px-3 py-2 text-center text-muted-foreground/40 font-mono select-none">+</td>
                    <td className="px-3 py-2">
                      <Input
                        autoFocus
                        value={form.medicineName}
                        onChange={e => setForm(f => ({ ...f, medicineName: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setShowAddRow(false); setForm(emptyForm()); } }}
                        placeholder="Medicine name *"
                        className={inputCls}
                        data-testid="input-medicine-name"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={form.dosage}
                        onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setShowAddRow(false); setForm(emptyForm()); } }}
                        placeholder="500mg"
                        className={inputCls}
                        data-testid="input-medicine-dosage"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground select-none">₹</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.unitPrice}
                          onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setShowAddRow(false); setForm(emptyForm()); } }}
                          placeholder="0.00"
                          className={`${inputCls} pl-5 text-right`}
                          data-testid="input-medicine-price"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        value={form.availableQty}
                        onChange={e => setForm(f => ({ ...f, availableQty: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setShowAddRow(false); setForm(emptyForm()); } }}
                        placeholder="0"
                        className={`${inputCls} text-right`}
                        data-testid="input-medicine-qty"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="date"
                        value={form.expiryDate}
                        onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Escape") { setShowAddRow(false); setForm(emptyForm()); } }}
                        className={inputCls}
                        data-testid="input-medicine-expiry"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={handleAdd}
                          disabled={createMutation.isPending}
                          className="p-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                          aria-label="Save medicine"
                          data-testid="button-save-medicine"
                        >
                          {createMutation.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                            : <Check className="h-3 w-3" aria-hidden="true" />}
                        </button>
                        <button
                          onClick={() => { setShowAddRow(false); setForm(emptyForm()); }}
                          className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                          aria-label="Cancel add"
                          data-testid="button-cancel-add-medicine"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Empty state */}
                {items.length === 0 && !showAddRow && (
                  <tr>
                    <td colSpan={7}>
                      <div className="py-12 text-center">
                        <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
                          <Package className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {debouncedSearch ? "No medicines match your search" : "No medicines in catalog yet"}
                        </p>
                        {!debouncedSearch && (
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            Click "Add Medicine" to get started
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {items.map((item, idx) => {
                  const expiring = isExpiringSoon(item.expiryDate);
                  const expired = isExpired(item.expiryDate);
                  const lowStock = item.availableQty <= 5;
                  const isEditing = editingId === item.id;
                  const rowNum = (page - 1) * pageSize + idx + 1;

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="bg-orange-50/40 dark:bg-orange-950/10 border-b border-orange-200/40 dark:border-orange-900/30">
                        <td className="px-3 py-2 text-center text-muted-foreground/40 font-mono text-xs select-none">{rowNum}</td>
                        <td className="px-3 py-2">
                          <Input
                            autoFocus
                            value={editForm.medicineName}
                            onChange={e => setEditForm(f => ({ ...f, medicineName: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") handleUpdate(item.id); if (e.key === "Escape") cancelEdit(); }}
                            placeholder="Medicine name *"
                            className={inputCls}
                            data-testid={`input-edit-medicine-name-${item.id}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={editForm.dosage}
                            onChange={e => setEditForm(f => ({ ...f, dosage: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") handleUpdate(item.id); if (e.key === "Escape") cancelEdit(); }}
                            placeholder="500mg"
                            className={inputCls}
                            data-testid={`input-edit-medicine-dosage-${item.id}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground select-none">₹</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.unitPrice}
                              onChange={e => setEditForm(f => ({ ...f, unitPrice: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") handleUpdate(item.id); if (e.key === "Escape") cancelEdit(); }}
                              placeholder="0.00"
                              className={`${inputCls} pl-5 text-right`}
                              data-testid={`input-edit-medicine-price-${item.id}`}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={editForm.availableQty}
                            onChange={e => setEditForm(f => ({ ...f, availableQty: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") handleUpdate(item.id); if (e.key === "Escape") cancelEdit(); }}
                            placeholder="0"
                            className={`${inputCls} text-right`}
                            data-testid={`input-edit-medicine-qty-${item.id}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="date"
                            value={editForm.expiryDate}
                            onChange={e => setEditForm(f => ({ ...f, expiryDate: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Escape") cancelEdit(); }}
                            className={inputCls}
                            data-testid={`input-edit-medicine-expiry-${item.id}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => handleUpdate(item.id)}
                              disabled={updateMutation.isPending}
                              className="p-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                              aria-label={`Save changes to ${item.medicineName}`}
                              data-testid={`button-save-edit-medicine-${item.id}`}
                            >
                              {updateMutation.isPending
                                ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                                : <Check className="h-3 w-3" aria-hidden="true" />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                              aria-label="Cancel edit"
                              data-testid={`button-cancel-edit-medicine-${item.id}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={item.id}
                      className={`group hover:bg-muted/20 transition-colors ${expired ? "opacity-60" : ""}`}
                      data-testid={`pharmacy-row-${item.id}`}
                    >
                      <td className="px-3 py-2.5 text-center font-mono text-muted-foreground/50 text-xs select-none">{rowNum}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-foreground">{item.medicineName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{item.dosage || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-primary">
                        ₹{(item.unitPrice ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-flex items-center justify-end gap-1 font-medium ${lowStock && item.availableQty > 0 ? "text-amber-600" : item.availableQty === 0 ? "text-red-500" : "text-foreground"}`}>
                          {(item.availableQty === 0 || lowStock) && <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />}
                          {item.availableQty}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {item.expiryDate ? (
                          <span className={`inline-flex items-center gap-1 ${expired ? "text-red-500 font-semibold" : expiring ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                            {(expired || expiring) && <AlertTriangle className="h-3 w-3 shrink-0" />}
                            {expired ? "Expired" : expiring ? "Exp soon" : item.expiryDate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            aria-label={`Edit ${item.medicineName}`}
                            data-testid={`button-edit-medicine-${item.id}`}
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
                                aria-label={`Delete ${item.medicineName}`}
                                data-testid={`button-delete-medicine-${item.id}`}
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
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

        {/* Pagination footer */}
        {!isLoading && total > 0 && (
          <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Rows per page:</span>
                <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-background p-0.5">
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => { setPageSize(n); setPage(1); }}
                      data-testid={`button-pagesize-${n}`}
                      className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 ${pageSize === n ? 'bg-orange-500/10 text-orange-600' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {total === 0 ? 'No medicines' : `Showing ${pageStart}–${pageEnd} of ${total} medicine${total !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page <= 1}
                data-testid="button-pharmacy-prev-page"
                aria-label="Previous page"
                className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="text-xs text-muted-foreground tabular-nums min-w-[72px] text-center">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                data-testid="button-pharmacy-next-page"
                aria-label="Next page"
                className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
