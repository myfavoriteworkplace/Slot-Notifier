import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import {
  IndianRupee, FileText, Trash2, Loader2, Plus, CheckCircle2,
  Clock, AlertCircle, Check, ChevronDown, ChevronUp, X, History,
  Pill, Stethoscope, Receipt, Bell, CreditCard, User, Lock,
  Eye, Pencil, AlertTriangle, ShieldCheck, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { PatientBill, BillingAuditLog, PharmacyStockItem } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────────────

interface ServiceItem {
  description: string;
  category: string;
  amount: number;
  paid?: boolean;
  qty?: number;
  unitPrice?: number;
}

interface ServiceItemWithMeta extends ServiceItem {
  billId: number;
  billNumber: string;
  itemIndex: number;
  billStatus: string;
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

interface CashierForm {
  billId: number;
  amountReceived: string;
  cashierName: string;
  notes: string;
  paymentMethod: string;
}

interface AddEntryForm {
  description: string;
  category: string;
  qty: string;
  unitPrice: string;
}

export interface BillingHistoryPanelProps {
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

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORIES = ["Consultation", "Procedure", "Treatment", "Pharmacy", "Consumable", "Other"] as const;
const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Insurance", "Online"] as const;

function parsePrescription(text: string | null | undefined): MedicineRow[] | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && "name" in parsed[0]) {
      return parsed as MedicineRow[];
    }
    return null;
  } catch {
    return null;
  }
}

function groupByCategory(items: ServiceItemWithMeta[]) {
  const consultation: ServiceItemWithMeta[] = [];
  const pharmacy: ServiceItemWithMeta[] = [];
  const other: ServiceItemWithMeta[] = [];
  for (const item of items) {
    if (item.category === "Pharmacy") pharmacy.push(item);
    else if (["Consultation", "Procedure", "Treatment", "Consumable"].includes(item.category)) consultation.push(item);
    else other.push(item);
  }
  return { consultation, pharmacy, other };
}

function uniqueBillNumber(bookingId: number) {
  return `DFT-${bookingId}-${Date.now()}`;
}

function computeTotals(services: ServiceItem[], discountPct: number, taxPct: number) {
  const subtotal = services.reduce((s, i) => s + i.amount, 0);
  const disc = subtotal * (discountPct / 100);
  const tax = (subtotal - disc) * (taxPct / 100);
  const total = subtotal - disc + tax;
  return { subtotal, disc, tax, total };
}

// ── Sub-components ─────────────────────────────────────────────────────────

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
  if (status === "partial") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
      <AlertCircle className="h-2.5 w-2.5" /> Partial
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20">
      <Clock className="h-2.5 w-2.5" /> Pending
    </span>
  );
}

function AuditActionLabel({ action }: { action: string }) {
  const map: Record<string, { label: string; color: string }> = {
    prescription_loaded: { label: "Prescription loaded", color: "text-blue-600" },
    item_added: { label: "Item added", color: "text-emerald-600" },
    item_removed: { label: "Item removed", color: "text-red-500" },
    item_amount_changed: { label: "Amount edited", color: "text-amber-600" },
    bill_confirmed: { label: "Bill confirmed", color: "text-blue-600" },
    bill_paid: { label: "Marked paid", color: "text-emerald-600" },
    bill_deleted: { label: "Bill deleted", color: "text-red-500" },
  };
  const m = map[action] ?? { label: action, color: "text-muted-foreground" };
  return <span className={`text-[10px] font-bold ${m.color}`}>{m.label}</span>;
}

// ── Preview Modal ──────────────────────────────────────────────────────────

function InvoicePreviewModal({
  open, onClose, bills, patientName, patientCode,
}: {
  open: boolean;
  onClose: () => void;
  bills: PatientBill[];
  patientName: string;
  patientCode?: string;
}) {
  const allServices: ServiceItemWithMeta[] = bills.flatMap(b =>
    ((b.services ?? []) as ServiceItem[]).map((s, idx) => ({
      ...s, billId: b.id, billNumber: b.billNumber, itemIndex: idx, billStatus: b.paymentStatus ?? "pending",
    }))
  );
  const subtotal = allServices.reduce((s, i) => s + i.amount, 0);
  const paid = allServices.filter(s => s.paid).reduce((s, i) => s + i.amount, 0);
  const { consultation, pharmacy, other } = groupByCategory(allServices);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4 text-primary" /> Invoice Preview
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap pb-2 border-b border-border/40">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="font-semibold">{patientName}</span>
              {patientCode && <span className="text-muted-foreground font-mono">#{patientCode}</span>}
            </div>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</span>
            {bills.length > 1 && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{bills.length} bills</span></>}
          </div>

          {[{ label: "Consultation & Procedures", items: consultation }, { label: "Pharmacy", items: pharmacy }, { label: "Other", items: other }]
            .filter(g => g.items.length > 0)
            .map(g => (
              <div key={g.label}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{g.label}</div>
                <div className="divide-y divide-border/20 rounded-lg border border-border/40 overflow-hidden">
                  {g.items.map((svc, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                      <span className={`flex-1 ${svc.paid ? "line-through text-muted-foreground/50" : "text-foreground"}`}>{svc.description}</span>
                      {svc.qty && svc.unitPrice ? (
                        <span className="text-muted-foreground/50 tabular-nums shrink-0">{svc.qty}×₹{(svc.unitPrice).toFixed(0)}</span>
                      ) : null}
                      <span className={`font-semibold tabular-nums shrink-0 ${svc.paid ? "text-emerald-600" : ""}`}>₹{svc.amount.toFixed(0)}</span>
                      {svc.paid && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            ))
          }

          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">₹{subtotal.toFixed(0)}</span></div>
            {paid > 0 && paid < subtotal && (
              <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span className="tabular-nums text-emerald-600 font-semibold">₹{paid.toFixed(0)}</span></div>
            )}
            <div className="flex justify-between pt-1 border-t border-border/30">
              <span className="font-bold">Total</span>
              <span className={`font-bold tabular-nums text-base ${bills.every(b => b.paymentStatus === "paid") ? "text-emerald-600" : "text-primary"}`}>
                ₹{bills.reduce((s, b) => s + (b.total ?? 0), 0).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function BillingHistoryPanel({
  bookingId, clinicId, patientName, patientPhone, patientEmail, patientCode,
  onGenerateReceipt, onPrintBill, onConsolidatedReceipt,
}: BillingHistoryPanelProps) {

  // ── Local state ───────────────────────────────────────────────────────────
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddEntryForm>({ description: "", category: "Consultation", qty: "1", unitPrice: "" });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [cashierForm, setCashierForm] = useState<CashierForm | null>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [showOlderBills, setShowOlderBills] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

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

  const { data: auditLogs = [] } = useQuery<BillingAuditLog[]>({
    queryKey: ["/api/auth/clinic/billing-audit/booking", bookingId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/auth/clinic/billing-audit/booking/${bookingId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: auditExpanded,
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const previousVisitBills = patientHistory.filter(b => b.bookingId !== bookingId);
  const pastPrescriptions = pastClinicalRecords.filter(
    r => r.bookingId !== bookingId && r.prescription && parsePrescription(r.prescription)
  );

  const allCurrentServices: ServiceItemWithMeta[] = bills.flatMap(b =>
    ((b.services ?? []) as ServiceItem[]).map((s, idx) => ({
      ...s, billId: b.id, billNumber: b.billNumber, itemIndex: idx, billStatus: b.paymentStatus ?? "pending",
    }))
  );

  const consolidatedSubtotal = allCurrentServices.reduce((s, i) => s + i.amount, 0);
  const consolidatedPaid = allCurrentServices.filter(s => s.paid).reduce((s, i) => s + i.amount, 0);
  const consolidatedTotal = bills.reduce((s, b) => s + (b.total ?? 0), 0);
  const allCurrentFullyPaid = bills.length > 0 && bills.every(b => b.paymentStatus === "paid");

  const { consultation: previewConsultation, pharmacy: previewPharmacy, other: previewOther } = groupByCategory(allCurrentServices);

  const unpricedPharmacyItems = allCurrentServices.filter(s => s.category === "Pharmacy" && s.amount === 0);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills/booking", bookingId] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills"] });
  }, [bookingId]);

  const logAudit = useCallback(async (action: string, details: Record<string, unknown> = {}, billId?: number) => {
    try {
      await apiRequest("POST", "/api/auth/clinic/billing-audit", { bookingId, clinicId, billId, action, details });
      if (auditExpanded) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/billing-audit/booking", bookingId] });
      }
    } catch { /* non-blocking */ }
  }, [bookingId, clinicId, auditExpanded]);

  const computeStatus = (svcs: ServiceItem[]) => {
    if (svcs.length === 0) return "pending";
    const allPaid = svcs.every(s => s.paid);
    const somePaid = svcs.some(s => s.paid);
    return allPaid ? "paid" : somePaid ? "partial" : "pending";
  };

  const groupByDate = (billList: PatientBill[]) => {
    const map = new Map<string, PatientBill[]>();
    for (const b of billList) {
      const label = b.createdAt ? format(new Date(b.createdAt), "dd MMM yyyy") : "Unknown date";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(b);
    }
    return map;
  };

  /** Find the right bill to add items to. Never add to a paid bill. */
  const findActiveBill = () =>
    bills.find(b => b.paymentStatus === "draft") ??
    bills.find(b => b.paymentStatus === "pending") ??
    bills.find(b => b.paymentStatus === "partial") ??
    null;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateItemsMutation = useMutation({
    mutationFn: async ({ bill, services, extra }: { bill: PatientBill; services: ServiceItem[]; extra?: Partial<PatientBill> }) => {
      const paymentStatus = bill.paymentStatus === "draft" ? "draft" : computeStatus(services);
      const { subtotal, total } = computeTotals(services, bill.discountPct ?? 0, bill.taxPct ?? 0);
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, {
        services, paymentStatus, subtotal, total, ...extra,
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: () => notify.error("Could not update bill"),
  });

  const addChargeMutation = useMutation({
    mutationFn: async ({ description, category, amount, qty, unitPrice }: {
      description: string; category: string; amount: number; qty?: number; unitPrice?: number;
    }) => {
      const newItem: ServiceItem = { description, category, amount, paid: false, qty, unitPrice };
      const activeBill = findActiveBill();

      if (activeBill) {
        const services: ServiceItem[] = [...((activeBill.services ?? []) as ServiceItem[]), newItem];
        const { subtotal, total } = computeTotals(services, activeBill.discountPct ?? 0, activeBill.taxPct ?? 0);
        const paymentStatus = activeBill.paymentStatus === "draft" ? "draft" : computeStatus(services);
        const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${activeBill.id}`, { services, subtotal, total, paymentStatus });
        if (!res.ok) throw new Error("Failed to add charge");
        return { bill: await res.json(), billId: activeBill.id };
      } else {
        const { subtotal, total } = computeTotals([newItem], 0, 0);
        const res = await apiRequest("POST", "/api/auth/clinic/bills", {
          bookingId,
          billNumber: uniqueBillNumber(bookingId),
          patientName: patientName || "Patient",
          patientPhone: patientPhone || "",
          patientEmail: patientEmail || "",
          services: [newItem],
          subtotal, total,
          paymentStatus: "draft",
        });
        if (!res.ok) throw new Error("Failed to create bill");
        const bill = await res.json();
        return { bill, billId: bill.id };
      }
    },
    onSuccess: async ({ billId }, vars) => {
      invalidate();
      setAddForm({ description: "", category: "Consultation", qty: "1", unitPrice: "" });
      setAddFormOpen(false);
      notify.success("Item added", { description: `₹${vars.amount} for "${vars.description}"` });
      await logAudit("item_added", { description: vars.description, amount: vars.amount, category: vars.category }, billId);
    },
    onError: () => notify.error("Could not add item"),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ bill, itemIndex }: { bill: PatientBill; itemIndex: number }) => {
      const services = ((bill.services ?? []) as ServiceItem[]).filter((_, i) => i !== itemIndex);
      const { subtotal, total } = computeTotals(services, bill.discountPct ?? 0, bill.taxPct ?? 0);
      const paymentStatus = bill.paymentStatus === "draft" ? "draft" : computeStatus(services);
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, { services, subtotal, total, paymentStatus });
      if (!res.ok) throw new Error("Failed to remove item");
      return { updated: await res.json(), removedDesc: ((bill.services ?? []) as ServiceItem[])[itemIndex]?.description };
    },
    onSuccess: async ({ removedDesc }, vars) => {
      invalidate();
      await logAudit("item_removed", { description: removedDesc ?? "", billNumber: vars.bill.billNumber }, vars.bill.id);
    },
    onError: () => notify.error("Could not remove item"),
  });

  const editAmountMutation = useMutation({
    mutationFn: async ({ bill, itemIndex, newAmount }: { bill: PatientBill; itemIndex: number; newAmount: number }) => {
      const services = ((bill.services ?? []) as ServiceItem[]).map((s, i) =>
        i === itemIndex ? { ...s, amount: newAmount, unitPrice: s.qty ? newAmount / s.qty : newAmount } : s
      );
      const { subtotal, total } = computeTotals(services, bill.discountPct ?? 0, bill.taxPct ?? 0);
      const paymentStatus = bill.paymentStatus === "draft" ? "draft" : computeStatus(services);
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, { services, subtotal, total, paymentStatus });
      if (!res.ok) throw new Error("Failed to update amount");
      return res.json();
    },
    onSuccess: () => { invalidate(); setEditingKey(null); },
    onError: () => notify.error("Could not update amount"),
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ bill, cashierName, amountReceived, cashierNotes, paymentMethod }: {
      bill: PatientBill; cashierName: string; amountReceived: number; cashierNotes: string; paymentMethod: string;
    }) => {
      const services = ((bill.services ?? []) as ServiceItem[]).map(s => ({ ...s, paid: true }));
      const { subtotal, total } = computeTotals(services, bill.discountPct ?? 0, bill.taxPct ?? 0);
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, {
        services,
        paymentStatus: "paid",
        subtotal, total,
        cashierId: cashierName || "Admin",
        cashierNotes: cashierNotes || null,
        amountReceived: amountReceived || total,
        paymentMethod,
      });
      if (!res.ok) throw new Error("Failed to mark paid");
      return { updated: await res.json(), billId: bill.id, billNumber: bill.billNumber };
    },
    onSuccess: async ({ billId, billNumber }, vars) => {
      invalidate();
      setCashierForm(null);
      notify.success("Bill marked as paid", { description: "Payment recorded. Sending notification to patient…" });
      await logAudit("bill_paid", {
        billNumber,
        amountReceived: vars.amountReceived,
        cashierName: vars.cashierName,
        paymentMethod: vars.paymentMethod,
      }, billId);
      try { await apiRequest("POST", `/api/auth/clinic/bills/${billId}/notify-paid`); } catch { /* non-blocking */ }
    },
    onError: () => notify.error("Could not record payment"),
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (bill: PatientBill) => {
      const res = await apiRequest("DELETE", `/api/auth/clinic/bills/${bill.id}`);
      if (!res.ok) throw new Error("Failed to delete");
      return bill;
    },
    onSuccess: async (bill) => {
      invalidate();
      notify.success("Bill deleted");
      await logAudit("bill_deleted", { billNumber: bill.billNumber }, bill.id);
    },
    onError: () => notify.error("Could not delete bill"),
  });

  const confirmDraftMutation = useMutation({
    mutationFn: async (bill: PatientBill) => {
      const services = (bill.services ?? []) as ServiceItem[];
      const newBillNumber = bill.billNumber.startsWith("DFT-")
        ? bill.billNumber.replace("DFT-", "INV-")
        : bill.billNumber;
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, {
        paymentStatus: services.length > 0 ? computeStatus(services) : "pending",
        billNumber: newBillNumber,
      });
      if (!res.ok) throw new Error("Failed to confirm");
      return res.json();
    },
    onSuccess: async (_, bill) => {
      invalidate();
      notify.success("Bill confirmed");
      await logAudit("bill_confirmed", { billNumber: bill.billNumber }, bill.id);
    },
    onError: () => notify.error("Could not confirm bill"),
  });

  const updateDiscountTaxMutation = useMutation({
    mutationFn: async ({ bill, discountPct, taxPct }: { bill: PatientBill; discountPct: number; taxPct: number }) => {
      const services = (bill.services ?? []) as ServiceItem[];
      const { subtotal, total } = computeTotals(services, discountPct, taxPct);
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, { discountPct, taxPct, subtotal, total });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: () => notify.error("Could not update discount/tax"),
  });

  const createNewBillMutation = useMutation({
    mutationFn: async () => {
      const existingEmptyDraft = bills.find(
        b => b.paymentStatus === "draft" && ((b.services ?? []) as ServiceItem[]).length === 0
      );
      if (existingEmptyDraft) return existingEmptyDraft;
      const res = await apiRequest("POST", "/api/auth/clinic/bills", {
        bookingId,
        billNumber: uniqueBillNumber(bookingId),
        patientName: patientName || "Patient",
        patientPhone: patientPhone || "",
        patientEmail: patientEmail || "",
        services: [],
        subtotal: 0,
        total: 0,
        paymentStatus: "draft",
      });
      if (!res.ok) throw new Error("Failed to create bill");
      return res.json();
    },
    onSuccess: (bill) => {
      invalidate();
      setShowOlderBills(false);
      notify.success("New draft bill created", { description: `${bill.billNumber} — add items below` });
      logAudit("bill_created", { billNumber: bill.billNumber }, bill.id);
    },
    onError: () => notify.error("Could not create new bill"),
  });

  // ── Load Prescription Items (bug-fixed) ───────────────────────────────────

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
            amount, paid: false, qty, unitPrice,
          };
        });

      if (newServices.length === 0) {
        notify.warning("No valid prescription items found");
        return;
      }

      // FIX: find active (non-paid) bill. Never add to a paid bill.
      const activeBill = findActiveBill();

      if (activeBill) {
        const existing = (activeBill.services ?? []) as ServiceItem[];
        // Deduplication: skip items already present by matching first word of description + category
        const existingKeys = new Set(
          existing.filter(s => s.category === "Pharmacy").map(s => s.description.split(" ")[0].toLowerCase())
        );
        const unique = newServices.filter(s => !existingKeys.has(s.description.split(" ")[0].toLowerCase()));

        if (unique.length === 0) {
          notify.warning("Already loaded", { description: "All prescription items are already in this bill." });
          return;
        }

        const combined = [...existing, ...unique];
        const { subtotal, total } = computeTotals(combined, activeBill.discountPct ?? 0, activeBill.taxPct ?? 0);
        const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${activeBill.id}`, {
          services: combined, subtotal, total,
          paymentStatus: activeBill.paymentStatus === "draft" ? "draft" : computeStatus(combined),
        });
        if (!res.ok) throw new Error("Failed to update bill");
        await logAudit("prescription_loaded", { count: unique.length, recordId: record.id }, activeBill.id);
      } else {
        // FIX: All bills are paid — create a NEW draft bill, never add to paid bill
        const { subtotal, total } = computeTotals(newServices, 0, 0);
        const res = await apiRequest("POST", "/api/auth/clinic/bills", {
          bookingId,
          billNumber: uniqueBillNumber(bookingId),
          patientName: patientName || "Patient",
          patientPhone: patientPhone || "",
          patientEmail: patientEmail || "",
          services: newServices,
          subtotal, total,
          paymentStatus: "draft",
        });
        if (!res.ok) throw new Error("Failed to create bill");
        const newBill = await res.json();
        await logAudit("prescription_loaded", { count: newServices.length, recordId: record.id, newDraft: true }, newBill.id);
      }

      invalidate();
      const matched = newServices.filter(s => (s.unitPrice ?? 0) > 0).length;
      const unmatched = newServices.length - matched;
      notify.success(`${newServices.length} prescription item${newServices.length !== 1 ? "s" : ""} loaded`, {
        description: matched > 0
          ? `${matched} auto-priced from catalog${unmatched > 0 ? ` · ${unmatched} need manual pricing` : ""}`
          : `${unmatched} item${unmatched !== 1 ? "s" : ""} added — please set prices below`,
      });
    } catch {
      notify.error("Could not load prescription items");
    } finally {
      setLoadingPrescription(false);
    }
  };

  // ── Add Entry form submit ─────────────────────────────────────────────────

  const handleAddEntry = () => {
    if (!addForm.description.trim()) { notify.warning("Enter a description"); return; }
    const qty = parseFloat(addForm.qty) || 1;
    const unitPrice = parseFloat(addForm.unitPrice) || 0;
    if (unitPrice <= 0) { notify.warning("Enter a valid unit price"); return; }
    const amount = qty * unitPrice;
    addChargeMutation.mutate({
      description: addForm.description.trim(),
      category: addForm.category,
      amount,
      qty: qty !== 1 ? qty : undefined,
      unitPrice: qty !== 1 ? unitPrice : undefined,
    });
  };

  // ── Inline amount editing ─────────────────────────────────────────────────

  const startEditAmount = (item: ServiceItemWithMeta) => {
    if (item.paid || item.billStatus === "paid") return;
    setEditingKey(`${item.billId}-${item.itemIndex}`);
    setEditingAmount(String(item.amount));
  };

  const saveEditAmount = (item: ServiceItemWithMeta) => {
    const newAmount = parseFloat(editingAmount);
    if (isNaN(newAmount) || newAmount < 0) { setEditingKey(null); return; }
    const bill = bills.find(b => b.id === item.billId);
    if (!bill) { setEditingKey(null); return; }
    editAmountMutation.mutate({ bill, itemIndex: item.itemIndex, newAmount });
    logAudit("item_amount_changed", { description: item.description, oldAmount: item.amount, newAmount }, item.billId);
  };

  // ── Cashier form open (pre-fill with unpaid amount) ───────────────────────

  const openCashierForm = (bill: PatientBill) => {
    const services = (bill.services ?? []) as ServiceItem[];
    const unpaidTotal = services.filter(s => !s.paid).reduce((s, i) => s + i.amount, 0);
    setCashierForm({
      billId: bill.id,
      amountReceived: String((unpaidTotal > 0 ? unpaidTotal : bill.total ?? 0).toFixed(0)),
      cashierName: "",
      notes: "",
      paymentMethod: "Cash",
    });
  };

  const toggleExpand = (id: number) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleDate = (label: string) => setExpandedDates(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  // Active draft bill (for discount/tax editing)
  const draftBill = bills.find(b => b.paymentStatus === "draft");
  const activeBillForTotals = draftBill ?? bills.find(b => b.paymentStatus !== "paid") ?? bills[0];

  // Open vs paid split for invoice preview
  const openBills = bills.filter(b => b.paymentStatus !== "paid");
  const openServices: ServiceItemWithMeta[] = openBills.flatMap(b =>
    ((b.services ?? []) as ServiceItem[]).map((s, idx) => ({
      ...s, billId: b.id, billNumber: b.billNumber, itemIndex: idx, billStatus: b.paymentStatus ?? "pending",
    }))
  );
  const paidBillsCount = bills.length - openBills.length;
  const hasOpenItems = openServices.length > 0;
  const { consultation: openConsultation, pharmacy: openPharmacy, other: openOther } = groupByCategory(openServices);
  const unpricedOpenPharmacy = openServices.filter(s => s.category === "Pharmacy" && s.amount === 0);

  // Active bill id — for "Active" badge
  const activeBillId = findActiveBill()?.id;

  // Bills sorted newest first, split into latest vs older
  const sortedBills = [...bills].sort((a, b) =>
    new Date((b as PatientBill & { createdAt?: string }).createdAt ?? 0).getTime() -
    new Date((a as PatientBill & { createdAt?: string }).createdAt ?? 0).getTime()
  );
  const latestBill = sortedBills[0] ?? null;
  const olderBills = sortedBills.slice(1);

  // ── Bill card renderer (shared for latest + older bills) ─────────────────
  const renderBillCard = (bill: PatientBill) => {
    const services = (bill.services ?? []) as ServiceItem[];
    const isExpanded = expandedIds.has(bill.id);
    const paidAmt = services.filter(s => s.paid).reduce((s, i) => s + i.amount, 0);
    const totalAmt = bill.total ?? 0;
    const allPaid = services.length > 0 && services.every(s => s.paid);
    const isDraft = bill.paymentStatus === "draft";
    const isBillPaid = bill.paymentStatus === "paid";
    const showCashierFor = cashierForm?.billId === bill.id;
    const isActiveBill = bill.id === activeBillId;

    return (
      <div key={bill.id} className="rounded-xl border border-border/50 overflow-hidden bg-background/50" data-testid={`billing-card-${bill.id}`}>
        {/* Bill header row */}
        <div className="px-3 py-2.5 flex items-center gap-2">
          <button className="flex-1 min-w-0 text-left" onClick={() => toggleExpand(bill.id)}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-foreground font-mono">{bill.billNumber}</span>
              <StatusBadge status={bill.paymentStatus ?? "pending"} />
              {isActiveBill && (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Active
                </span>
              )}
              {services.length > 0 && (
                <span className="text-xs text-muted-foreground">· {services.length} item{services.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : "—"}
              </span>
              <span className="text-xs text-muted-foreground">· {bill.paymentMethod ?? "Cash"}</span>
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
          <div className="border-t border-border/40">
            {services.length > 0 ? (
              <div className="divide-y divide-border/30">
                {services.map((svc, idx) => {
                  const isItemPaid = svc.paid || isBillPaid;
                  return (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 group" data-testid={`billing-item-${bill.id}-${idx}`}>
                      <div className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center ${isItemPaid ? "bg-emerald-500 border-emerald-500 text-white" : "border-border/60"}`}>
                        {isItemPaid && <Check className="h-2.5 w-2.5" />}
                      </div>
                      <span className={`flex-1 text-xs ${isItemPaid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {svc.description}
                      </span>
                      {svc.qty && svc.unitPrice && svc.qty > 1 ? (
                        <span className="text-xs text-muted-foreground/60 shrink-0 tabular-nums">
                          {svc.qty}×₹{(svc.unitPrice).toFixed(0)}
                        </span>
                      ) : null}
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${isItemPaid ? "text-emerald-600" : "text-foreground"}`}>
                        ₹{svc.amount.toFixed(0)}
                      </span>
                      {isItemPaid ? (
                        <Lock className="h-3 w-3 text-muted-foreground/30 shrink-0" title="Paid — cannot remove" />
                      ) : (
                        <button
                          onClick={() => deleteItemMutation.mutate({ bill, itemIndex: idx })}
                          disabled={deleteItemMutation.isPending}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 shrink-0"
                          data-testid={`button-delete-item-${bill.id}-${idx}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-3 py-2 text-xs text-muted-foreground italic">No items yet — use "Add Entry" or "Load Prescription" above</p>
            )}

            {/* Footer actions */}
            <div className="px-3 py-2.5 bg-muted/20 border-t border-border/30 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  {allPaid || isBillPaid ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Fully settled
                      {(bill as PatientBill & { cashierId?: string }).cashierId && (
                        <span className="font-normal opacity-75">· by {(bill as PatientBill & { cashierId?: string }).cashierId}</span>
                      )}
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
                      onClick={() => confirmDraftMutation.mutate(bill)}
                      disabled={confirmDraftMutation.isPending}
                      className="h-6 px-2 text-[10px] gap-1 border-blue-400/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                      data-testid={`button-confirm-draft-${bill.id}`}
                    >
                      <Check className="h-3 w-3" /> Confirm Bill
                    </Button>
                  )}
                  {!allPaid && !isBillPaid && !isDraft && services.length > 0 && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => openCashierForm(bill)}
                      className="h-6 px-2 text-[10px] gap-1 border-emerald-400/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                      data-testid={`button-mark-paid-${bill.id}`}
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
                  {!isBillPaid && (
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
                            This will permanently remove {bill.billNumber} and all its entries. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Back</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteBillMutation.mutate(bill)} className="bg-destructive text-destructive-foreground">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {/* Cashier / Mark Paid form */}
              {showCashierFor && (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 space-y-2 animate-in slide-in-from-top-1 duration-150">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Record Payment
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)</Label>
                      <div className="relative mt-0.5">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                        <Input
                          type="number" min="0"
                          value={cashierForm!.amountReceived}
                          onChange={e => setCashierForm(f => f ? { ...f, amountReceived: e.target.value } : f)}
                          className="pl-5 h-7 text-xs"
                          data-testid="input-cashier-amount"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Method</Label>
                      <Select
                        value={cashierForm!.paymentMethod}
                        onValueChange={v => setCashierForm(f => f ? { ...f, paymentMethod: v } : f)}
                      >
                        <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-payment-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
                      <Input
                        value={cashierForm!.notes}
                        onChange={e => setCashierForm(f => f ? { ...f, notes: e.target.value } : f)}
                        placeholder="Optional…"
                        className="h-7 text-xs mt-0.5"
                        data-testid="input-cashier-notes"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setCashierForm(null)} className="h-6 px-2 text-[10px]" disabled={markPaidMutation.isPending}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => markPaidMutation.mutate({
                        bill,
                        cashierName: cashierForm!.cashierName,
                        amountReceived: parseFloat(cashierForm!.amountReceived) || (bill.total ?? 0),
                        cashierNotes: cashierForm!.notes,
                        paymentMethod: cashierForm!.paymentMethod,
                      })}
                      disabled={markPaidMutation.isPending}
                      className="h-6 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                      data-testid="button-confirm-payment"
                    >
                      {markPaidMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
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
  };

  return (
    <div className="space-y-3">

      {/* ── INVOICE PREVIEW ─────────────────────────────────────────── */}

      {/* STATE A: All bills paid → compact "Settled" bar */}
      {bills.length > 0 && allCurrentFullyPaid && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/20 overflow-hidden shadow-sm">
          <div className="px-3 py-2.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Settled</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">₹{consolidatedTotal.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{bills[0]?.paymentMethod ?? "Cash"}</span>
                {(bills[0] as PatientBill & { cashierId?: string })?.cashierId && (
                  <><span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">by {(bills[0] as PatientBill & { cashierId?: string }).cashierId}</span></>
                )}
              </div>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {bills.length} bill{bills.length !== 1 ? "s" : ""} · {allCurrentServices.length} item{allCurrentServices.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm" variant="ghost"
                onClick={() => setPreviewModalOpen(true)}
                className="h-7 px-2 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                data-testid="button-settled-view"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
              {bills.length > 1 && onConsolidatedReceipt ? (
                <Button size="sm" variant="ghost"
                  onClick={() => onConsolidatedReceipt(bills)}
                  className="h-7 px-2 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                  data-testid="button-settled-pdf"
                >
                  <FileText className="h-3.5 w-3.5" /> PDF
                </Button>
              ) : bills.length === 1 ? (
                <Button size="sm" variant="ghost"
                  onClick={() => onPrintBill(bills[0])}
                  className="h-7 px-2 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                  data-testid="button-settled-pdf-single"
                >
                  <FileText className="h-3.5 w-3.5" /> PDF
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* STATE B/C: Has open items → editable invoice preview (open items only) */}
      {hasOpenItems && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">

          {/* Header bar */}
          <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Open Invoice</span>
              {paidBillsCount > 0 && (
                <span className="text-xs text-muted-foreground/60">
                  · {paidBillsCount} paid bill{paidBillsCount > 1 ? "s" : ""} hidden
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm" variant="ghost"
                onClick={() => setPreviewModalOpen(true)}
                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                data-testid="button-preview-modal"
              >
                <Eye className="h-2.5 w-2.5" /> Preview
              </Button>
              {openBills.length > 1 && onConsolidatedReceipt ? (
                <Button size="sm" variant="outline"
                  onClick={() => onConsolidatedReceipt(openBills)}
                  className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  data-testid="button-open-consolidated-pdf"
                >
                  <FileText className="h-2.5 w-2.5" /> PDF
                </Button>
              ) : openBills.length === 1 ? (
                <Button size="sm" variant="outline"
                  onClick={() => onPrintBill(openBills[0])}
                  className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  data-testid="button-open-pdf"
                >
                  <FileText className="h-2.5 w-2.5" /> PDF
                </Button>
              ) : null}
            </div>
          </div>

          {/* Patient info row */}
          <div className="px-3 py-2 border-b border-border/30 flex items-center gap-3 flex-wrap bg-muted/10">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{patientName}</span>
              {patientCode && <span className="text-xs text-muted-foreground font-mono">#{patientCode}</span>}
            </div>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-xs text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</span>
            {openBills.length > 1 && (
              <><span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">{openBills.length} open bills</span></>
            )}
          </div>

          {/* Unpriced pharmacy warning — open items only */}
          {unpricedOpenPharmacy.length > 0 && (
            <div className="px-3 py-2 bg-amber-50/80 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-800/30 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {unpricedOpenPharmacy.length} item{unpricedOpenPharmacy.length > 1 ? "s" : ""} need pricing
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5">
                  Click ₹0 below to set a price, or update your Pharmacy Catalog first.
                </p>
              </div>
            </div>
          )}

          {/* Line items — grouped by category, open items only */}
          <div className="divide-y divide-border/20">
            {[
              { label: "Consultation & Procedures", items: openConsultation, icon: Stethoscope },
              { label: "Pharmacy", items: openPharmacy, icon: Pill },
              { label: "Other", items: openOther, icon: ClipboardList },
            ].filter(g => g.items.length > 0).map((group, gi) => (
              <div key={gi}>
                <div className="px-3 py-1.5 bg-muted/20 flex items-center gap-1.5">
                  <group.icon className="h-3 w-3 text-muted-foreground/60" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{group.label}</span>
                </div>
                {group.items.map((svc, idx) => {
                  const itemKey = `${svc.billId}-${svc.itemIndex}`;
                  const isEditing = editingKey === itemKey;
                  const isUnpriced = svc.amount === 0 && svc.category === "Pharmacy";
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 px-3 py-1.5 group ${isUnpriced ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                      data-testid={`preview-item-${svc.billId}-${svc.itemIndex}`}
                    >
                      {openBills.length > 1 && (
                        <span className="text-xs font-mono text-muted-foreground/40 shrink-0 hidden sm:block">
                          {svc.billNumber.split("-").slice(-1)[0]}
                        </span>
                      )}
                      <span className="flex-1 text-xs min-w-0 truncate text-foreground">{svc.description}</span>
                      {svc.qty && svc.unitPrice && svc.qty > 1 ? (
                        <span className="text-xs text-muted-foreground/50 shrink-0 tabular-nums hidden sm:block">
                          {svc.qty}×₹{(svc.unitPrice).toFixed(0)}
                        </span>
                      ) : null}
                      {isEditing ? (
                        <div className="relative shrink-0">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                          <Input
                            type="number" min="0"
                            value={editingAmount}
                            onChange={e => setEditingAmount(e.target.value)}
                            onBlur={() => saveEditAmount(svc)}
                            onKeyDown={e => { if (e.key === "Enter") saveEditAmount(svc); if (e.key === "Escape") setEditingKey(null); }}
                            className={`h-6 w-20 pl-4 text-xs ${isUnpriced ? "border-amber-400" : ""}`}
                            autoFocus
                            data-testid={`input-item-amount-${itemKey}`}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditAmount(svc)}
                          title="Click to edit amount"
                          className={`text-xs font-semibold tabular-nums shrink-0 flex items-center gap-0.5 hover:text-primary group/amt transition-colors ${isUnpriced ? "text-amber-600" : "text-foreground"}`}
                          data-testid={`amount-${itemKey}`}
                        >
                          ₹{svc.amount.toFixed(0)}
                          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/amt:opacity-100 transition-opacity" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const bill = bills.find(b => b.id === svc.billId);
                          if (bill) deleteItemMutation.mutate({ bill, itemIndex: svc.itemIndex });
                        }}
                        disabled={deleteItemMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 shrink-0"
                        title="Remove item"
                        data-testid={`button-preview-delete-${itemKey}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Discount + Tax controls */}
          {activeBillForTotals && (
            <div className="px-3 py-2 border-t border-border/30 bg-muted/10 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Discount %</label>
                <Input
                  type="number" min="0" max="100" step="0.5"
                  defaultValue={String(activeBillForTotals.discountPct ?? 0)}
                  onBlur={e => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val !== (activeBillForTotals.discountPct ?? 0)) {
                      updateDiscountTaxMutation.mutate({ bill: activeBillForTotals, discountPct: val, taxPct: activeBillForTotals.taxPct ?? 0 });
                    }
                  }}
                  className="h-6 w-16 text-xs"
                  data-testid="input-discount-pct"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Tax %</label>
                <Input
                  type="number" min="0" max="100" step="0.5"
                  defaultValue={String(activeBillForTotals.taxPct ?? 0)}
                  onBlur={e => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val !== (activeBillForTotals.taxPct ?? 0)) {
                      updateDiscountTaxMutation.mutate({ bill: activeBillForTotals, discountPct: activeBillForTotals.discountPct ?? 0, taxPct: val });
                    }
                  }}
                  className="h-6 w-16 text-xs"
                  data-testid="input-tax-pct"
                />
              </div>
            </div>
          )}

          {/* Totals — open bills only */}
          <div className="px-3 py-2 bg-muted/20 border-t border-border/30 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Subtotal (open)</span>
              <span className="text-xs tabular-nums text-foreground">₹{openServices.reduce((s, i) => s + i.amount, 0).toFixed(0)}</span>
            </div>
            {paidBillsCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Already paid</span>
                <span className="text-xs tabular-nums text-emerald-600 font-semibold">
                  ₹{bills.filter(b => b.paymentStatus === "paid").reduce((s, b) => s + (b.total ?? 0), 0).toFixed(0)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-0.5 border-t border-border/30">
              <span className="text-xs font-bold text-foreground">Outstanding</span>
              <span className="text-sm font-bold tabular-nums text-primary">
                ₹{openBills.reduce((s, b) => s + (b.total ?? 0), 0).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION BUTTONS ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => handleLoadPrescription()}
          disabled={loadingPrescription}
          className="flex-1 h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground min-w-[130px]"
          data-testid="button-load-prescription"
        >
          {loadingPrescription ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pill className="h-3.5 w-3.5" />}
          Load Prescription
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => setAddFormOpen(v => !v)}
          className="flex-1 h-8 text-xs gap-1.5 min-w-[100px]"
          data-testid="button-toggle-add-entry"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Entry
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => createNewBillMutation.mutate()}
          disabled={createNewBillMutation.isPending}
          className="h-8 text-xs gap-1.5 border-blue-400/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          data-testid="button-new-bill"
        >
          {createNewBillMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <FileText className="h-3.5 w-3.5" />}
          New Bill
        </Button>
      </div>

      {/* ── ADD ENTRY FORM ──────────────────────────────────────────── */}
      {addFormOpen && (
        <div className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Entry</span>
            <button onClick={() => setAddFormOpen(false)} className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description *</Label>
              <Input
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Dental cleaning, Consultation…"
                className="h-7 text-xs mt-0.5"
                data-testid="input-entry-description"
              />
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
              <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-entry-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</Label>
              <Input
                type="number" min="1"
                value={addForm.qty}
                onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))}
                className="h-7 text-xs mt-0.5"
                data-testid="input-entry-qty"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Price (₹) *</Label>
              <div className="relative mt-0.5">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={addForm.unitPrice}
                  onChange={e => setAddForm(f => ({ ...f, unitPrice: e.target.value }))}
                  placeholder="0.00"
                  className="pl-5 h-7 text-xs"
                  data-testid="input-entry-unit-price"
                />
              </div>
              {addForm.qty && addForm.unitPrice && parseFloat(addForm.qty) > 0 && parseFloat(addForm.unitPrice) > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Total: ₹{(parseFloat(addForm.qty) * parseFloat(addForm.unitPrice)).toFixed(0)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button size="sm" variant="ghost" onClick={() => setAddFormOpen(false)} className="h-7 text-xs">Cancel</Button>
            <Button
              size="sm"
              onClick={handleAddEntry}
              disabled={addChargeMutation.isPending}
              className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-save-entry"
            >
              {addChargeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Add to Bill
            </Button>
          </div>
        </div>
      )}

      {/* ── BILLS LIST ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 pt-1">
        <IndianRupee className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {bills.length > 0 ? `${bills.length} Bill${bills.length > 1 ? "s" : ""}` : "No Bills Yet"}
        </span>
        {bills.length > 1 && (
          <span className="text-xs text-muted-foreground ml-auto">₹{consolidatedTotal.toFixed(0)} total</span>
        )}
      </div>

      {bills.length === 0 ? (
        <div className="py-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
          <div className="p-2 bg-muted/40 rounded-full w-fit mx-auto mb-2">
            <FileText className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">No bills yet for this visit</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Use "Load Prescription", "Add Entry", or "New Bill" above to start
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Latest bill — always shown */}
          {latestBill && renderBillCard(latestBill)}

          {/* Older bills — lazy reveal */}
          {olderBills.length > 0 && (
            <>
              <button
                onClick={() => setShowOlderBills(v => !v)}
                className="w-full flex items-center gap-2 px-1 py-1.5 text-left group"
                data-testid="button-toggle-older-bills"
              >
                <div className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {showOlderBills ? "Hide" : "Load"} {olderBills.length} older bill{olderBills.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {showOlderBills
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </button>
              {showOlderBills && olderBills.map(bill => (
                <div key={bill.id}>{renderBillCard(bill)}</div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── PREVIOUS VISITS ─────────────────────────────────────────── */}
      {previousVisitBills.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <button
            onClick={() => setHistoryExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 group"
            data-testid="button-toggle-patient-history"
          >
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Previous Visits</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                {previousVisitBills.length}
              </span>
            </div>
            {historyExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {historyExpanded && (
            <div className="mt-2 space-y-1.5">
              {previousVisitBills.slice(0, 10).map(b => (
                <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/20 border border-border/30">
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-mono text-muted-foreground flex-1 truncate">{b.billNumber}</span>
                  <StatusBadge status={b.paymentStatus ?? "pending"} />
                  <span className="text-[10px] tabular-nums font-semibold text-foreground shrink-0">₹{(b.total ?? 0).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PAST PRESCRIPTIONS ──────────────────────────────────────── */}
      {pastPrescriptions.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Pill className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Past Prescriptions</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {pastPrescriptions.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {pastPrescriptions.slice(0, 5).map(r => {
              const rows = parsePrescription(r.prescription);
              return (
                <div key={r.id} className="flex items-start gap-2 px-2 py-2 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-muted-foreground mb-1">
                      {r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : "—"} · {r.doctorName ?? "Doctor"}
                    </div>
                    <div className="text-[11px] text-foreground truncate">
                      {rows?.slice(0, 2).map(rx => rx.name).join(", ")}
                      {rows && rows.length > 2 ? ` +${rows.length - 2} more` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleLoadPrescription(r)}
                    disabled={loadingPrescription}
                    className="h-6 px-2 text-[10px] shrink-0 gap-1"
                    data-testid={`button-load-past-rx-${r.id}`}
                  >
                    <Pill className="h-2.5 w-2.5" /> Load
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AUDIT TRAIL ─────────────────────────────────────────────── */}
      <div className="border-t border-border/40 pt-3">
        <button
          onClick={() => setAuditExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-2"
          data-testid="button-toggle-audit"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audit Trail</span>
            {auditLogs.length > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                {auditLogs.length}
              </span>
            )}
          </div>
          {auditExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {auditExpanded && (
          <div className="mt-2 space-y-1">
            {auditLogs.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 py-2 text-center">No audit entries yet</p>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-muted/10 border border-border/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <AuditActionLabel action={log.action} />
                      {(log.details as Record<string, unknown>)?.description && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          — {String((log.details as Record<string, unknown>).description)}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-muted-foreground/50 mt-0.5">
                      {log.createdAt ? format(new Date(log.createdAt), "dd MMM yyyy · HH:mm") : "—"}
                      {(log.details as Record<string, unknown>)?.cashierName ? ` · ${String((log.details as Record<string, unknown>).cashierName)}` : ""}
                    </div>
                  </div>
                  {(log.details as Record<string, unknown>)?.amount !== undefined && (
                    <span className="text-[10px] font-semibold text-foreground shrink-0 tabular-nums">
                      ₹{Number((log.details as Record<string, unknown>).amount).toFixed(0)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── INVOICE PREVIEW MODAL ───────────────────────────────────── */}
      <InvoicePreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        bills={bills}
        patientName={patientName}
        patientCode={patientCode}
      />
    </div>
  );
}
