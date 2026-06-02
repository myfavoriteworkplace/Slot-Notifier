import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import {
  IndianRupee, FileText, Trash2, Loader2, Plus, CheckCircle2,
  Clock, AlertCircle, Check, ChevronDown, ChevronUp, X, History,
  Pill, Stethoscope, Receipt, Bell, CreditCard, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PatientBill, PharmacyStockItem } from "@shared/schema";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ServiceItem {
  description: string;
  category: string;
  amount: number;
  paid?: boolean;
  qty?: number;
  unitPrice?: number;
}

interface MedicineRow {
  name: string;
  dosage: string;
  qty: string;
  frequency: string;
  duration: string;
}

interface ClinicalRecord {
  id: number;
  bookingId: number;
  patientName: string;
  doctorName?: string | null;
  diagnosis?: string[] | null;
  prescription?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

interface BillingHistoryPanelProps {
  bookingId: number;
  clinicId: number;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  patientCode?: string;
  onGenerateReceipt: (existingBill?: PatientBill) => void;
  onPrintBill: (bill: PatientBill) => void;
  onConsolidatedReceipt?: (bills: PatientBill[]) => void;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
      <CheckCircle2 className="h-2.5 w-2.5" /> Paid
    </span>
  );
  if (status === "draft") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
      <FileText className="h-2.5 w-2.5" /> Draft
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
      <Clock className="h-2.5 w-2.5" /> Pending
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
      <AlertCircle className="h-2.5 w-2.5" /> Partial
    </span>
  );
}

// ── Parse prescription JSON ───────────────────────────────────────────────────

function parsePrescription(text: string | null | undefined): MedicineRow[] | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'name' in parsed[0]) {
      return parsed as MedicineRow[];
    }
    return null;
  } catch { return null; }
}

// ── Cashier form state ────────────────────────────────────────────────────────

interface CashierForm {
  billId: number;
  amountReceived: string;
  cashierName: string;
  notes: string;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BillingHistoryPanel({
  bookingId, clinicId, patientName, patientPhone, patientEmail, patientCode,
  onGenerateReceipt, onPrintBill, onConsolidatedReceipt,
}: BillingHistoryPanelProps) {
  const [addDesc, setAddDesc] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [pastRxExpanded, setPastRxExpanded] = useState(false);
  const [cashierForm, setCashierForm] = useState<CashierForm | null>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: bills = [], isLoading } = useQuery<PatientBill[]>({
    queryKey: ["/api/auth/clinic/bills/booking", bookingId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/auth/clinic/bills/booking/${bookingId}`);
      if (!res.ok) throw new Error("Failed to load bills");
      return res.json();
    },
  });

  const { data: patientHistory = [] } = useQuery<PatientBill[]>({
    queryKey: ["/api/auth/clinic/bills/patient-by-email", patientEmail || patientPhone],
    queryFn: async () => {
      if (patientEmail) {
        const res = await apiRequest("GET", `/api/auth/clinic/bills/patient-by-email/${encodeURIComponent(patientEmail)}`);
        if (!res.ok) return [];
        return res.json();
      }
      if (patientPhone) {
        const res = await apiRequest("GET", `/api/auth/clinic/bills/patient/${encodeURIComponent(patientPhone)}`);
        if (!res.ok) return [];
        return res.json();
      }
      return [];
    },
    enabled: !!(patientEmail || patientPhone),
  });

  const { data: pharmacy = [] } = useQuery<PharmacyStockItem[]>({
    queryKey: ["/api/auth/clinic/pharmacy"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/clinic/pharmacy");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: pastClinicalRecords = [] } = useQuery<ClinicalRecord[]>({
    queryKey: ["/api/auth/clinic/clinical-records/patient", patientPhone],
    queryFn: async () => {
      if (!patientPhone) return [];
      const res = await apiRequest("GET", `/api/auth/clinic/clinical-records/patient?phone=${encodeURIComponent(patientPhone)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!patientPhone,
  });

  const previousVisitBills = patientHistory.filter(b => b.bookingId !== bookingId);
  const pastPrescriptions = pastClinicalRecords.filter(
    r => r.bookingId !== bookingId && r.prescription && parsePrescription(r.prescription)
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  const groupByDate = (billList: PatientBill[]) => {
    const map = new Map<string, PatientBill[]>();
    for (const b of billList) {
      const label = b.createdAt ? format(new Date(b.createdAt), "dd MMM yyyy") : "Unknown date";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(b);
    }
    return map;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills/booking", bookingId] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills"] });
  };

  const computeStatus = (svcs: ServiceItem[]) => {
    if (svcs.length === 0) return "pending";
    const allPaid = svcs.every(s => s.paid);
    const somePaid = svcs.some(s => s.paid);
    return allPaid ? "paid" : somePaid ? "partial" : "pending";
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addChargeMutation = useMutation({
    mutationFn: async ({ description, amount }: { description: string; amount: number }) => {
      const activeBill = bills.find(b => b.paymentStatus !== "paid" && b.paymentStatus !== "draft") ?? bills.find(b => b.paymentStatus === "draft");
      if (activeBill) {
        const services: ServiceItem[] = [
          ...((activeBill.services ?? []) as ServiceItem[]),
          { description, category: "Treatment", amount, paid: false },
        ];
        const subtotal = services.reduce((s, i) => s + i.amount, 0);
        const disc = subtotal * ((activeBill.discountPct ?? 0) / 100);
        const tax = (subtotal - disc) * ((activeBill.taxPct ?? 0) / 100);
        const total = subtotal - disc + tax;
        const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${activeBill.id}`, {
          services, subtotal, total,
          paymentStatus: activeBill.paymentStatus === "draft" ? "draft" : computeStatus(services),
        });
        if (!res.ok) throw new Error("Failed to add charge");
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/auth/clinic/bills", {
          bookingId,
          billNumber: `DFT-${bookingId}-${format(new Date(), "yyyyMMddHHmm")}`,
          patientName: patientName || "Patient",
          patientPhone: patientPhone || "",
          patientEmail: patientEmail || "",
          services: [{ description, category: "Treatment", amount, paid: false }],
          subtotal: amount,
          total: amount,
          paymentStatus: "draft",
        });
        if (!res.ok) throw new Error("Failed to create bill");
        return res.json();
      }
    },
    onSuccess: (_, vars) => {
      invalidate();
      setAddDesc("");
      setAddAmount("");
      notify.success("Charge added", { description: `₹${vars.amount} for "${vars.description}" saved.` });
    },
    onError: () => notify.error("Could not add charge"),
  });

  const updateItemsMutation = useMutation({
    mutationFn: async ({ bill, services, extra }: { bill: PatientBill; services: ServiceItem[]; extra?: Partial<PatientBill> }) => {
      const paymentStatus = bill.paymentStatus === "draft" ? "draft" : computeStatus(services);
      const subtotal = services.reduce((s, i) => s + i.amount, 0);
      const disc = subtotal * ((bill.discountPct ?? 0) / 100);
      const tax = (subtotal - disc) * ((bill.taxPct ?? 0) / 100);
      const total = subtotal - disc + tax;
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, {
        services, paymentStatus, subtotal, total, ...extra,
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => { invalidate(); },
    onError: () => notify.error("Could not update status"),
  });

  const markPaidWithCashierMutation = useMutation({
    mutationFn: async ({ bill, cashierName, amountReceived, cashierNotes }: {
      bill: PatientBill; cashierName: string; amountReceived: number; cashierNotes: string;
    }) => {
      const services = ((bill.services ?? []) as ServiceItem[]).map(s => ({ ...s, paid: true }));
      const subtotal = services.reduce((s, i) => s + i.amount, 0);
      const disc = subtotal * ((bill.discountPct ?? 0) / 100);
      const tax = (subtotal - disc) * ((bill.taxPct ?? 0) / 100);
      const total = subtotal - disc + tax;
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, {
        services,
        paymentStatus: "paid",
        subtotal,
        total,
        cashierId: cashierName || "Admin",
        cashierNotes: cashierNotes || null,
        amountReceived: amountReceived || total,
      });
      if (!res.ok) throw new Error("Failed to mark paid");
      return { bill: await res.json(), billId: bill.id };
    },
    onSuccess: async ({ billId }) => {
      invalidate();
      setCashierForm(null);
      notify.success("Bill marked as paid", { description: "Payment recorded. Sending notification to patient…" });
      try {
        await apiRequest("POST", `/api/auth/clinic/bills/${billId}/notify-paid`);
      } catch { /* notification failure is non-blocking */ }
    },
    onError: () => notify.error("Could not record payment"),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ bill, itemIndex }: { bill: PatientBill; itemIndex: number }) => {
      const services = ((bill.services ?? []) as ServiceItem[]).filter((_, i) => i !== itemIndex);
      const paymentStatus = bill.paymentStatus === "draft" ? "draft" : computeStatus(services);
      const subtotal = services.reduce((s, i) => s + i.amount, 0);
      const disc = subtotal * ((bill.discountPct ?? 0) / 100);
      const tax = (subtotal - disc) * ((bill.taxPct ?? 0) / 100);
      const total = subtotal - disc + tax;
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, {
        services, paymentStatus, subtotal, total,
      });
      if (!res.ok) throw new Error("Failed to remove item");
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: () => notify.error("Could not remove item"),
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/auth/clinic/bills/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { invalidate(); notify.success("Bill deleted"); },
    onError: () => notify.error("Could not delete bill"),
  });

  // ── Load Prescription Items ────────────────────────────────────────────────

  const handleLoadPrescription = async (fromRecord?: ClinicalRecord) => {
    setLoadingPrescription(true);
    try {
      let record: ClinicalRecord | null = null;

      if (fromRecord) {
        record = fromRecord;
      } else {
        const res = await apiRequest("GET", `/api/clinical-records/booking/${bookingId}`);
        if (res.ok) {
          const records: ClinicalRecord[] = await res.json();
          record = records?.[0] ?? null;
        }
      }

      if (!record?.prescription) {
        notify.warning("No prescription found", { description: "Add a prescription in the Clinical tab first." });
        return;
      }

      const rows = parsePrescription(record.prescription);
      if (!rows || rows.length === 0) {
        notify.warning("Prescription is empty");
        return;
      }

      const newServices: ServiceItem[] = rows
        .filter(r => r.name?.trim())
        .map(r => {
          const qty = parseInt(r.qty) || 1;
          const match = pharmacy.find(p =>
            p.medicineName.toLowerCase().trim() === r.name.toLowerCase().trim()
          );
          const unitPrice = match ? (match.unitPrice ?? 0) : 0;
          const amount = qty * unitPrice;
          return {
            description: [r.name.trim(), r.dosage, `×${qty}`, r.frequency, r.duration].filter(Boolean).join(" "),
            category: "Pharmacy",
            amount,
            paid: false,
            qty,
            unitPrice,
          };
        });

      if (newServices.length === 0) {
        notify.warning("No valid prescription items found");
        return;
      }

      const activeBill = bills.find(b => b.paymentStatus !== "paid") ?? bills[0];
      if (activeBill) {
        const existing = (activeBill.services ?? []) as ServiceItem[];
        const combined = [...existing, ...newServices];
        const subtotal = combined.reduce((s, i) => s + i.amount, 0);
        const disc = subtotal * ((activeBill.discountPct ?? 0) / 100);
        const tax = (subtotal - disc) * ((activeBill.taxPct ?? 0) / 100);
        const total = subtotal - disc + tax;
        const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${activeBill.id}`, {
          services: combined,
          subtotal,
          total,
          paymentStatus: activeBill.paymentStatus === "draft" ? "draft" : computeStatus(combined),
        });
        if (!res.ok) throw new Error("Failed to update bill");
      } else {
        const subtotal = newServices.reduce((s, i) => s + i.amount, 0);
        const res = await apiRequest("POST", "/api/auth/clinic/bills", {
          bookingId,
          billNumber: `DFT-${bookingId}-${format(new Date(), "yyyyMMddHHmm")}`,
          patientName: patientName || "Patient",
          patientPhone: patientPhone || "",
          patientEmail: patientEmail || "",
          services: newServices,
          subtotal,
          total: subtotal,
          paymentStatus: "draft",
        });
        if (!res.ok) throw new Error("Failed to create bill");
      }

      invalidate();
      const matched = newServices.filter(s => (s.unitPrice ?? 0) > 0).length;
      const unmatched = newServices.length - matched;
      notify.success(`${newServices.length} prescription item${newServices.length !== 1 ? "s" : ""} loaded`, {
        description: matched > 0
          ? `${matched} auto-priced from catalog${unmatched > 0 ? ` · ${unmatched} need manual pricing` : ""}`
          : `${unmatched} item${unmatched !== 1 ? "s" : ""} added — please enter prices manually`,
      });
    } catch (e: any) {
      notify.error("Could not load prescription items");
    } finally {
      setLoadingPrescription(false);
    }
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const handleAddCharge = () => {
    const amount = parseFloat(addAmount);
    if (!addDesc.trim() || isNaN(amount) || amount <= 0) {
      notify.warning("Enter a description and a valid amount");
      return;
    }
    addChargeMutation.mutate({ description: addDesc.trim(), amount });
  };

  const toggleItemPaid = (bill: PatientBill, idx: number) => {
    const services = ((bill.services ?? []) as ServiceItem[]).map((s, i) =>
      i === idx ? { ...s, paid: !s.paid } : s
    );
    updateItemsMutation.mutate({ bill, services });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleDate = (label: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  // ── Consolidated invoice preview helpers ───────────────────────────────────

  const allCurrentServices: (ServiceItem & { billNumber: string })[] = bills.flatMap(b =>
    ((b.services ?? []) as ServiceItem[]).map(s => ({ ...s, billNumber: b.billNumber }))
  );
  const consolidatedSubtotal = allCurrentServices.reduce((s, i) => s + i.amount, 0);
  const consolidatedPaid = allCurrentServices.filter(s => s.paid).reduce((s, i) => s + i.amount, 0);
  const allCurrentFullyPaid = bills.length > 0 && bills.every(b => b.paymentStatus === "paid");

  if (isLoading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-3">

      {/* ── Consolidated Invoice Preview ──────────────────────────── */}
      {allCurrentServices.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Invoice Preview</span>
            </div>
            <div className="flex items-center gap-1.5">
              {onConsolidatedReceipt && bills.length > 1 && (
                <Button
                  size="sm" variant="outline"
                  onClick={() => onConsolidatedReceipt(bills)}
                  className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  data-testid="button-consolidated-pdf"
                >
                  <FileText className="h-2.5 w-2.5" /> Consolidated PDF
                </Button>
              )}
              {bills.length === 1 && (
                <Button
                  size="sm" variant="outline"
                  onClick={() => onPrintBill(bills[0])}
                  className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  data-testid="button-preview-pdf"
                >
                  <FileText className="h-2.5 w-2.5" /> Download PDF
                </Button>
              )}
            </div>
          </div>

          {/* Patient + date row */}
          <div className="px-3 py-2 border-b border-border/30 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{patientName}</span>
              {patientCode && <span className="text-[10px] text-muted-foreground font-mono">#{patientCode}</span>}
            </div>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-xs text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</span>
            {bills.length > 1 && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">{bills.length} bills</span>
              </>
            )}
          </div>

          {/* Line items */}
          <div className="divide-y divide-border/20">
            {allCurrentServices.map((svc, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5">
                <span className={`flex-1 text-xs ${svc.paid ? "line-through text-muted-foreground/60" : "text-foreground"}`}>
                  {svc.description}
                </span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0 px-1 py-0.5 rounded bg-muted/40">
                  {svc.category}
                </span>
                <span className={`text-xs font-semibold tabular-nums shrink-0 ${svc.paid ? "text-emerald-600" : "text-foreground"}`}>
                  ₹{svc.amount.toFixed(0)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-3 py-2 bg-muted/20 border-t border-border/30 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Subtotal</span>
              <span className="text-[11px] tabular-nums text-foreground">₹{consolidatedSubtotal.toFixed(0)}</span>
            </div>
            {consolidatedPaid > 0 && consolidatedPaid < consolidatedSubtotal && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Collected</span>
                <span className="text-[11px] tabular-nums text-emerald-600 font-semibold">₹{consolidatedPaid.toFixed(0)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-0.5 border-t border-border/30">
              <span className="text-xs font-bold text-foreground">Total</span>
              <span className={`text-sm font-bold tabular-nums ${allCurrentFullyPaid ? "text-emerald-600" : "text-primary"}`}>
                ₹{bills.reduce((s, b) => s + (b.total ?? 0), 0).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <IndianRupee className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {bills.length > 0 ? `${bills.length} Bill${bills.length > 1 ? "s" : ""}` : "No Bills Yet"}
        </span>
      </div>

      {/* ── Load Prescription Items ─────────────────────────────── */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleLoadPrescription()}
        disabled={loadingPrescription}
        className="w-full h-8 text-xs gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
        data-testid="button-load-prescription"
      >
        {loadingPrescription
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Pill className="h-3.5 w-3.5" />}
        Load Prescription Items
      </Button>

      {/* ── Inline Add Charge ────────────────────────────────────── */}
      <div className="flex gap-1.5 items-center">
        <Input
          value={addDesc}
          onChange={e => setAddDesc(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAddCharge()}
          placeholder="Service / treatment…"
          className="h-8 text-xs flex-1"
          data-testid="input-charge-description"
        />
        <div className="relative w-24 shrink-0">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
          <Input
            type="number" min="0"
            value={addAmount}
            onChange={e => setAddAmount(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddCharge()}
            placeholder="0"
            className="h-8 text-xs pl-5"
            data-testid="input-charge-amount"
          />
        </div>
        <Button
          size="sm"
          onClick={handleAddCharge}
          disabled={addChargeMutation.isPending || !addDesc.trim() || !addAmount}
          className="h-8 w-8 p-0 shrink-0"
          data-testid="button-add-charge"
        >
          {addChargeMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* ── Bills list ───────────────────────────────────────────── */}
      {bills.length === 0 ? (
        <div className="py-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
          <div className="p-2 bg-muted/40 rounded-full w-fit mx-auto mb-2">
            <FileText className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Add a charge above to start billing</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">or click "Load Prescription Items" to auto-fill from clinical tab</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...groupByDate(bills).entries()].map(([dateLabel, dateBills]) => {
            const isDateOpen = expandedDates.has(dateLabel);
            const groupTotal = dateBills.reduce((s, b) => s + (b.total ?? 0), 0);
            const groupPaid = dateBills.every(b => b.paymentStatus === "paid");
            return (
              <div key={dateLabel} className="rounded-xl border border-border/50 overflow-hidden">
                {/* Date group header */}
                <button
                  onClick={() => toggleDate(dateLabel)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                  data-testid={`button-toggle-date-${dateLabel}`}
                >
                  {isDateOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-[11px] font-bold text-foreground/80 flex-1">{dateLabel}</span>
                  <span className="text-[10px] text-muted-foreground/70 shrink-0">
                    {dateBills.length} bill{dateBills.length !== 1 ? "s" : ""}
                  </span>
                  <span className={`text-xs font-bold shrink-0 ${groupPaid ? "text-emerald-600" : "text-primary"}`}>
                    ₹{groupTotal.toFixed(0)}
                  </span>
                  <span
                    onClick={e => {
                      e.stopPropagation();
                      if (dateBills.length === 1) { onGenerateReceipt(dateBills[0]); }
                      else if (onConsolidatedReceipt) { onConsolidatedReceipt(dateBills); }
                      else { onGenerateReceipt(dateBills[0]); }
                    }}
                    role="button"
                    className="flex items-center gap-1 text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors shrink-0 px-1.5 py-0.5 rounded hover:bg-primary/10"
                    data-testid={`button-generate-bill-${dateLabel}`}
                  >
                    <FileText className="h-2.5 w-2.5" />
                    {dateBills.length > 1 ? "Consolidated" : "Receipt"}
                  </span>
                </button>

                {isDateOpen && (
                  <div className="divide-y divide-border/30">
                    {dateBills.map(bill => {
                      const services = (bill.services ?? []) as ServiceItem[];
                      const isExpanded = expandedIds.has(bill.id);
                      const paidAmt = services.filter(s => s.paid).reduce((s, i) => s + i.amount, 0);
                      const totalAmt = bill.total ?? 0;
                      const allPaid = services.length > 0 && services.every(s => s.paid);
                      const isDraft = bill.paymentStatus === "draft";
                      const showCashierFor = cashierForm?.billId === bill.id;

                      return (
                        <div key={bill.id} className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden" data-testid={`billing-card-${bill.id}`}>
                          {/* Bill header row */}
                          <div className="px-3 py-2.5 flex items-center gap-2">
                            <button className="flex-1 min-w-0 text-left" onClick={() => toggleExpand(bill.id)}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground font-mono">{bill.billNumber}</span>
                                <StatusBadge status={bill.paymentStatus ?? "pending"} />
                                {services.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">· {services.length} item{services.length !== 1 ? "s" : ""}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : "—"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">· {bill.paymentMethod ?? "Cash"}</span>
                              </div>
                            </button>
                            <span className="text-sm font-bold text-primary shrink-0">₹{totalAmt.toFixed(0)}</span>
                            <button
                              onClick={() => toggleExpand(bill.id)}
                              className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground shrink-0"
                              data-testid={`button-expand-bill-${bill.id}`}
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          </div>

                          {/* Expanded items */}
                          {isExpanded && (
                            <div className="border-t border-border/40 bg-background/50">
                              {services.length > 0 ? (
                                <div className="divide-y divide-border/30">
                                  {services.map((svc, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 group" data-testid={`billing-item-${bill.id}-${idx}`}>
                                      <button
                                        onClick={() => toggleItemPaid(bill, idx)}
                                        disabled={updateItemsMutation.isPending || isDraft}
                                        className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                                          svc.paid ? "bg-emerald-500 border-emerald-500 text-white" : "border-border/60 hover:border-primary/60 bg-background"
                                        } ${isDraft ? "opacity-40 cursor-not-allowed" : ""}`}
                                        title={isDraft ? "Mark bill as pending first" : (svc.paid ? "Mark as unpaid" : "Mark as paid")}
                                        data-testid={`button-toggle-item-paid-${bill.id}-${idx}`}
                                      >
                                        {svc.paid && <Check className="h-2.5 w-2.5" />}
                                      </button>
                                      <span className={`flex-1 text-xs ${svc.paid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                        {svc.description}
                                      </span>
                                      {svc.qty && svc.unitPrice ? (
                                        <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                                          {svc.qty}×₹{svc.unitPrice?.toFixed(0)}
                                        </span>
                                      ) : null}
                                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${svc.paid ? "text-emerald-600" : "text-foreground"}`}>
                                        ₹{svc.amount.toFixed(0)}
                                      </span>
                                      <button
                                        onClick={() => deleteItemMutation.mutate({ bill, itemIndex: idx })}
                                        disabled={deleteItemMutation.isPending}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 shrink-0"
                                        data-testid={`button-delete-item-${bill.id}-${idx}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="px-3 py-2 text-xs text-muted-foreground italic">No items on this bill</p>
                              )}

                              {/* Footer actions */}
                              <div className="px-3 py-2.5 bg-muted/20 border-t border-border/30 space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="text-[10px] text-muted-foreground">
                                    {allPaid ? (
                                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Fully settled
                                        {(bill as any).cashierId && <span className="font-normal opacity-75">· by {(bill as any).cashierId}</span>}
                                      </span>
                                    ) : isDraft ? (
                                      <span className="text-blue-600 font-medium flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Draft — confirm to enable payments
                                      </span>
                                    ) : paidAmt > 0 ? (
                                      <span>
                                        Collected <span className="font-bold text-emerald-600">₹{paidAmt.toFixed(0)}</span>
                                        {" · "}Balance <span className="font-bold text-amber-600">₹{(totalAmt - paidAmt).toFixed(0)}</span>
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 font-medium">₹{totalAmt.toFixed(0)} outstanding</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isDraft && (
                                      <Button
                                        size="sm" variant="outline"
                                        onClick={() => updateItemsMutation.mutate({ bill, services, extra: { paymentStatus: "pending" } })}
                                        disabled={updateItemsMutation.isPending}
                                        className="h-6 px-2 text-[10px] gap-1 border-blue-400/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                        data-testid={`button-confirm-draft-${bill.id}`}
                                      >
                                        <Check className="h-3 w-3" /> Confirm Bill
                                      </Button>
                                    )}
                                    {!allPaid && !isDraft && services.length > 0 && (
                                      <Button
                                        size="sm" variant="outline"
                                        onClick={() => setCashierForm({
                                          billId: bill.id,
                                          amountReceived: String((bill.total ?? 0).toFixed(0)),
                                          cashierName: "",
                                          notes: "",
                                        })}
                                        disabled={updateItemsMutation.isPending}
                                        className="h-6 px-2 text-[10px] gap-1 border-emerald-400/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                        data-testid={`button-mark-all-paid-${bill.id}`}
                                      >
                                        <CreditCard className="h-3 w-3" /> Mark Paid
                                      </Button>
                                    )}
                                    <Button
                                      size="sm" variant="ghost"
                                      onClick={() => onPrintBill(bill)}
                                      className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                      data-testid={`button-reprint-${bill.id}`}
                                    >
                                      <FileText className="h-3 w-3" /> Print
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-bill-${bill.id}`}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently remove {bill.billNumber} and all its entries from billing history.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Back</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteBillMutation.mutate(bill.id)} className="bg-destructive text-destructive-foreground">
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>

                                {/* Cashier form (inline, shown when "Mark Paid" clicked) */}
                                {showCashierFor && (
                                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 space-y-2 animate-in slide-in-from-top-1 duration-150">
                                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                      <CreditCard className="h-3 w-3" /> Record Cash Payment
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount Received (₹)</Label>
                                        <div className="relative mt-0.5">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                                          <Input
                                            type="number" min="0"
                                            value={cashierForm!.amountReceived}
                                            onChange={e => setCashierForm(f => f ? { ...f, amountReceived: e.target.value } : f)}
                                            className="pl-5 h-7 text-xs"
                                            data-testid="input-cashier-amount-received"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cashier Name</Label>
                                        <Input
                                          value={cashierForm!.cashierName}
                                          onChange={e => setCashierForm(f => f ? { ...f, cashierName: e.target.value } : f)}
                                          placeholder="e.g. Priya"
                                          className="h-7 text-xs mt-0.5"
                                          data-testid="input-cashier-name"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
                                      <Input
                                        value={cashierForm!.notes}
                                        onChange={e => setCashierForm(f => f ? { ...f, notes: e.target.value } : f)}
                                        placeholder="e.g. UPI, partial…"
                                        className="h-7 text-xs mt-0.5"
                                        data-testid="input-cashier-notes"
                                      />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                      <Button size="sm" variant="ghost" onClick={() => setCashierForm(null)} className="h-6 px-2 text-[10px]" disabled={markPaidWithCashierMutation.isPending}>
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => markPaidWithCashierMutation.mutate({
                                          bill,
                                          cashierName: cashierForm!.cashierName,
                                          amountReceived: parseFloat(cashierForm!.amountReceived) || (bill.total ?? 0),
                                          cashierNotes: cashierForm!.notes,
                                        })}
                                        disabled={markPaidWithCashierMutation.isPending}
                                        className="h-6 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                        data-testid="button-confirm-payment"
                                      >
                                        {markPaidWithCashierMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                                        Confirm &amp; Notify
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Previous Visits ───────────────────────────────────────── */}
      {previousVisitBills.length > 0 && (
        <div className="border-t border-border/40 pt-3 mt-1">
          <button
            onClick={() => setHistoryExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 group"
            data-testid="button-toggle-patient-history"
          >
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Previous Visits</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                {previousVisitBills.length} bill{previousVisitBills.length !== 1 ? "s" : ""}
              </span>
            </div>
            {historyExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {historyExpanded && (
            <div className="mt-2 space-y-3">
              {[...groupByDate(previousVisitBills).entries()].map(([dateLabel, dateBills]) => (
                <div key={dateLabel}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5 px-0.5">{dateLabel}</p>
                  <div className="space-y-1.5">
                    {dateBills.map(bill => {
                      const services = (bill.services ?? []) as ServiceItem[];
                      const paidAmt = services.filter(s => s.paid).reduce((s, i) => s + i.amount, 0);
                      const totalAmt = bill.total ?? 0;
                      return (
                        <div key={bill.id} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5" data-testid={`history-bill-${bill.id}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold font-mono text-foreground/80 flex-1 min-w-0 truncate">{bill.billNumber}</span>
                            <StatusBadge status={bill.paymentStatus ?? "pending"} />
                            <span className="text-sm font-bold text-primary shrink-0">₹{totalAmt.toFixed(0)}</span>
                          </div>
                          {services.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {services.map((svc, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className={`flex-1 text-[11px] ${svc.paid ? "line-through text-muted-foreground/60" : "text-muted-foreground"}`}>{svc.description}</span>
                                  <span className="text-[11px] font-medium tabular-nums text-muted-foreground shrink-0">₹{svc.amount.toFixed(0)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {paidAmt > 0 && paidAmt < totalAmt && (
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                              Collected <span className="font-bold text-emerald-600">₹{paidAmt.toFixed(0)}</span>
                              {" · "}Balance <span className="font-bold text-amber-600">₹{(totalAmt - paidAmt).toFixed(0)}</span>
                            </p>
                          )}
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

      {/* ── Past Prescriptions ────────────────────────────────────── */}
      {pastPrescriptions.length > 0 && (
        <div className="border-t border-border/40 pt-3 mt-1">
          <button
            onClick={() => setPastRxExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 group"
            data-testid="button-toggle-past-prescriptions"
          >
            <div className="flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Past Prescriptions</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                {pastPrescriptions.length} record{pastPrescriptions.length !== 1 ? "s" : ""}
              </span>
            </div>
            {pastRxExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {pastRxExpanded && (
            <div className="mt-2 space-y-2">
              {pastPrescriptions.map(record => {
                const rows = parsePrescription(record.prescription);
                return (
                  <div key={record.id} className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden" data-testid={`past-rx-${record.id}`}>
                    <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Pill className="h-3 w-3 text-primary/70 shrink-0" />
                        <span className="text-[11px] font-semibold text-foreground truncate">
                          {record.createdAt ? format(new Date(record.createdAt), "dd MMM yyyy") : "Unknown date"}
                        </span>
                        {record.doctorName && (
                          <span className="text-[10px] text-muted-foreground">· Dr. {record.doctorName}</span>
                        )}
                        {record.diagnosis && record.diagnosis.length > 0 && (
                          <span className="text-[10px] text-primary/70 font-semibold truncate">
                            · {record.diagnosis.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleLoadPrescription(record)}
                        disabled={loadingPrescription}
                        className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                        data-testid={`button-load-past-rx-${record.id}`}
                      >
                        <Plus className="h-2.5 w-2.5" /> Load
                      </Button>
                    </div>
                    {rows && rows.length > 0 && (
                      <div className="divide-y divide-border/20">
                        {rows.filter(r => r.name?.trim()).map((r, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="text-xs text-foreground font-medium flex-1 min-w-0 truncate">{r.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{r.dosage}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">×{r.qty}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{r.frequency}</span>
                          </div>
                        ))}
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
