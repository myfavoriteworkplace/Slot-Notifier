import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import {
  IndianRupee, FileText, Trash2, Loader2, Plus, CheckCircle2,
  Clock, AlertCircle, Check, ChevronDown, ChevronUp, X, History,
  Pill, Stethoscope, Receipt, Bell, CreditCard, User, Lock,
  Pencil, AlertTriangle, ShieldCheck, ClipboardList, Printer, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  // Structured pharmacy fields — optional, populated for new items loaded from prescription
  medicineName?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  remarks?: string;
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
  durationNum?: string;
  durationUnit?: string;
  route?: string;
  remarks?: string;
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
  patientId?: number;
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
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `DFT-${bookingId}-${uid}`;
}

function computeTotals(services: ServiceItem[], discountPct: number, taxPct: number) {
  const subtotal = services.reduce((s, i) => s + i.amount, 0);
  const disc = subtotal * (discountPct / 100);
  const tax = (subtotal - disc) * (taxPct / 100);
  const total = subtotal - disc + tax;
  return { subtotal, disc, tax, total };
}

// Returns structured pharmacy display fields — uses stored fields for new items, parses description for old items
function getPharmacyFields(svc: ServiceItem): { medicine: string; dosage: string; frequency: string; duration: string } {
  if (svc.medicineName) {
    return {
      medicine: svc.medicineName,
      dosage: svc.dosage || "",
      frequency: svc.frequency || "",
      duration: svc.duration || "",
    };
  }
  // Fallback: parse from description string (legacy items)
  const crossIdx = svc.description.indexOf("×");
  if (crossIdx === -1) return { medicine: svc.description, dosage: "", frequency: "", duration: "" };
  const medicine = svc.description.slice(0, crossIdx).trim();
  const afterCross = svc.description.slice(crossIdx + 1);
  const m = afterCross.match(/^\d+\s*(.*)/);
  const schedule = m ? m[1].trim() : "";
  const durMatch = schedule.match(/^(.*?)\s*(\d+\s+(?:days?|weeks?|months?|years?))$/i);
  if (durMatch) return { medicine, dosage: "", frequency: durMatch[1].trim(), duration: durMatch[2].trim() };
  return { medicine, dosage: "", frequency: schedule, duration: "" };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
      <CheckCircle2 className="h-2.5 w-2.5" /> Paid
    </span>
  );
  if (status === "draft") return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
      <FileText className="h-2.5 w-2.5" /> Draft
    </span>
  );
  if (status === "partial") return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
      <AlertCircle className="h-2.5 w-2.5" /> Partial
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20">
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
  return <span className={`text-xs font-bold ${m.color}`}>{m.label}</span>;
}

// ── Invoice Preview Modal ──────────────────────────────────────────────────

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
  const { consultation, pharmacy, other } = groupByCategory(allServices);
  const grandTotal = bills.reduce((s, b) => s + (b.total ?? 0), 0);
  const paidTotal  = bills.filter(b => b.paymentStatus === "paid").reduce((s, b) => s + (b.total ?? 0), 0);
  const outstanding = grandTotal - paidTotal;
  const allSettled = outstanding === 0 && bills.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4 text-primary" /> Billing Summary
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
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{bills.length} bill{bills.length !== 1 ? "s" : ""}</span>
            {allSettled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="h-2.5 w-2.5" /> All Bills Paid
              </span>
            )}
          </div>

          {[{ label: "Consultation & Procedures", items: consultation }, { label: "Pharmacy", items: pharmacy }, { label: "Other", items: other }]
            .filter(g => g.items.length > 0)
            .map(g => (
              <div key={g.label}>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{g.label}</div>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  {g.label === "Pharmacy" ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/40">
                          <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Medicine</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground w-14">Dosage</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground w-16">Frequency</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground w-16">Duration</th>
                          <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground w-20">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {g.items.map((svc, i) => {
                          const { medicine, dosage, frequency, duration } = getPharmacyFields(svc);
                          const isPaid = svc.paid || svc.billStatus === "paid";
                          return (
                            <tr key={i} className={isPaid ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "bg-background"}>
                              <td className="px-3 py-1.5 font-medium text-foreground">
                                <span className="flex items-center gap-1">
                                  {isPaid && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />}
                                  {medicine}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground">{dosage || "—"}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{frequency || "—"}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{duration || "—"}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                                <span className={`flex items-center justify-end gap-1 ${isPaid ? "text-emerald-600" : ""}`}>
                                  ₹{svc.amount.toFixed(0)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {g.items.map((svc, i) => {
                        const isPaid = svc.paid || svc.billStatus === "paid";
                        return (
                          <div key={i} className={`flex items-center gap-2 px-3 py-1.5 ${isPaid ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "bg-background"}`}>
                            <span className="flex items-center gap-1 flex-1 text-foreground">
                              {isPaid && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />}
                              {svc.description}
                            </span>
                            {svc.qty && svc.unitPrice ? (
                              <span className="text-muted-foreground/50 tabular-nums shrink-0">{svc.qty}×₹{(svc.unitPrice).toFixed(0)}</span>
                            ) : null}
                            <span className={`font-semibold tabular-nums shrink-0 ${isPaid ? "text-emerald-600" : ""}`}>₹{svc.amount.toFixed(0)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          }

          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="tabular-nums">₹{grandTotal.toFixed(0)}</span></div>
            {paidTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collected</span>
                <span className="tabular-nums text-emerald-600 font-semibold">₹{paidTotal.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-border/30">
              {allSettled ? (
                <>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> All Bills Paid
                  </span>
                  <span className="font-bold tabular-nums text-base text-emerald-600">₹{grandTotal.toFixed(0)}</span>
                </>
              ) : (
                <>
                  <span className="font-bold">Outstanding</span>
                  <span className="font-bold tabular-nums text-base text-primary">₹{outstanding.toFixed(0)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function BillingHistoryPanel({
  bookingId, clinicId, patientName, patientId, patientPhone, patientEmail, patientCode,
  onGenerateReceipt, onPrintBill, onConsolidatedReceipt,
}: BillingHistoryPanelProps) {

  // ── Local state ───────────────────────────────────────────────────────────
  const [addFormOpen, setAddFormOpen] = useState(false);           // for "no bills" standalone form
  const [addFormOpenInCard, setAddFormOpenInCard] = useState(false); // for active bill card form
  const [addForm, setAddForm] = useState<AddEntryForm>({ description: "", category: "Consultation", qty: "1", unitPrice: "" });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [cashierForm, setCashierForm] = useState<CashierForm | null>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [rxPickerOpen, setRxPickerOpen] = useState(false);
  const [rxPickerRecords, setRxPickerRecords] = useState<ClinicalRecord[]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBill, setPreviewBill] = useState<PatientBill | null>(null);
  const [showOlderBills, setShowOlderBills] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<number, Set<string>>>({});

  const didAutoExpand = useRef(false);

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
    queryKey: ["/api/auth/clinic/bills/patient-history", patientId ?? patientEmail ?? patientPhone],
    queryFn: async () => {
      if (patientId) {
        const res = await apiRequest("GET", `/api/auth/clinic/bills/patient-by-id/${patientId}`);
        if (!res.ok) return [];
        return res.json();
      }
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
    enabled: !!(patientId || patientEmail || patientPhone),
  });

  const { data: pharmacy = [] } = useQuery<PharmacyStockItem[]>({
    queryKey: ["/api/auth/clinic/pharmacy"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/clinic/pharmacy");
      if (!res.ok) return [];
      return res.json();
    },
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

  const allCurrentServices: ServiceItemWithMeta[] = bills.flatMap(b =>
    ((b.services ?? []) as ServiceItem[]).map((s, idx) => ({
      ...s, billId: b.id, billNumber: b.billNumber, itemIndex: idx, billStatus: b.paymentStatus ?? "pending",
    }))
  );

  const consolidatedTotal = bills.reduce((s, b) => s + (b.total ?? 0), 0);
  const allCurrentFullyPaid = bills.length > 0 && bills.every(b => b.paymentStatus === "paid");

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

  // Auto-expand the active bill when first loaded
  useEffect(() => {
    if (!didAutoExpand.current && bills.length > 0) {
      const active = findActiveBill();
      if (active) {
        setExpandedIds(new Set([active.id]));
        didAutoExpand.current = true;
      }
    }
  }, [bills]);

  // Collapse all bill cards when all bills become fully paid
  useEffect(() => {
    const allPaid = bills.length > 0 && bills.every(b => b.paymentStatus === "paid");
    if (allPaid) setExpandedIds(new Set());
  }, [bills]);

  // ── Mutations ─────────────────────────────────────────────────────────────

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
          patientId: patientId || null,
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
      setAddFormOpenInCard(false);
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
      // If paying a draft directly (skipping separate "Confirm Bill"), rename DFT- → INV- in one shot
      const billNumber = bill.billNumber.startsWith("DFT-")
        ? bill.billNumber.replace("DFT-", "INV-")
        : bill.billNumber;
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, {
        services,
        paymentStatus: "paid",
        billNumber,
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
        patientId: patientId || null,
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
      // Auto-expand the new bill
      setExpandedIds(new Set([bill.id]));
      notify.success("New draft bill created", { description: `${bill.billNumber} — add items below` });
      logAudit("bill_created", { billNumber: bill.billNumber }, bill.id);
    },
    onError: () => notify.error("Could not create new bill"),
  });

  // ── Load Prescription Items ───────────────────────────────────────────────

  // Core loader — called after a specific record has been chosen (by picker or auto-select)
  const doLoadPrescription = async (record: ClinicalRecord) => {
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
        const durationStr = r.durationNum ? `${r.durationNum} ${r.durationUnit || 'days'}` : (r.duration || '');
        return {
          description: [r.name.trim(), `×${qty}`, r.frequency, durationStr].filter(Boolean).join(" "),
          category: "Pharmacy",
          amount, paid: false, qty, unitPrice,
          medicineName: r.name.trim(),
          dosage: r.dosage || undefined,
          frequency: r.frequency || undefined,
          duration: durationStr || undefined,
          route: r.route || undefined,
          remarks: r.remarks || undefined,
        };
      });

    if (newServices.length === 0) {
      notify.warning("No valid prescription items found");
      return;
    }

    const activeBill = findActiveBill();

    if (activeBill) {
      const existing = (activeBill.services ?? []) as ServiceItem[];
      const existingKeys = new Set(
        existing.filter(s => s.category === "Pharmacy").map(s => (s.medicineName || s.description.split(" ")[0]).toLowerCase())
      );
      const unique = newServices.filter(s => !existingKeys.has((s.medicineName || s.description.split(" ")[0]).toLowerCase()));

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
      const { subtotal, total } = computeTotals(newServices, 0, 0);
      const res = await apiRequest("POST", "/api/auth/clinic/bills", {
        bookingId,
        patientId: patientId || null,
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
  };

  // Entry point — fetches all records for this booking, filters to those with a prescription,
  // auto-loads if exactly one exists, or opens the picker when there are multiple choices.
  const handleLoadPrescription = async () => {
    setLoadingPrescription(true);
    try {
      const res = await apiRequest("GET", `/api/clinical-records/booking/${bookingId}`);
      if (!res.ok) throw new Error("Failed to fetch clinical records");
      const all: ClinicalRecord[] = await res.json();
      const withRx = all.filter(r => !!r.prescription);

      if (withRx.length === 0) {
        notify.warning("No prescription found", { description: "Add a prescription in the Clinical tab first." });
        return;
      }
      if (withRx.length === 1) {
        await doLoadPrescription(withRx[0]);
        return;
      }
      // Multiple prescriptions — let the user pick
      setRxPickerRecords(withRx);
      setRxPickerOpen(true);
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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="space-y-3 p-1">
      {[1, 2].map(i => (
        <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
          <div className="px-3 py-2.5 flex items-center gap-2 bg-muted/20">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-14 rounded-full ml-2" />
            <div className="flex-1" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 font-mono" />
          </div>
          <div className="px-3 py-3 space-y-2 border-t border-border/30">
            {[1, 2, 3].map(j => (
              <div key={j} className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border/30 flex justify-between items-center">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );

  const activeBillId = findActiveBill()?.id;

  const sortedBills = [...bills].sort((a, b) =>
    new Date((b as PatientBill & { createdAt?: string }).createdAt ?? 0).getTime() -
    new Date((a as PatientBill & { createdAt?: string }).createdAt ?? 0).getTime()
  );
  const latestBill = sortedBills[0] ?? null;
  const olderBills = sortedBills.slice(1);

  // ── Bill card renderer ───────────────────────────────────────────────────
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
    const canEdit = !isBillPaid;

    // Inline helper: build ServiceItemWithMeta from local bill context
    const makeItemMeta = (svc: ServiceItem, origIdx: number): ServiceItemWithMeta => ({
      ...svc, billId: bill.id, billNumber: bill.billNumber, itemIndex: origIdx, billStatus: bill.paymentStatus ?? "pending",
    });

    // Item groups
    const consultItems = services.map((svc, i) => ({ svc, origIdx: i }))
      .filter(x => ["Consultation", "Procedure", "Treatment", "Consumable"].includes(x.svc.category));
    const pharmacyItems = services.map((svc, i) => ({ svc, origIdx: i }))
      .filter(x => x.svc.category === "Pharmacy");
    const otherItems = services.map((svc, i) => ({ svc, origIdx: i }))
      .filter(x => !["Consultation", "Procedure", "Treatment", "Consumable", "Pharmacy"].includes(x.svc.category));

    const unpricedPharmacy = pharmacyItems.filter(x => !isBillPaid && x.svc.amount === 0);

    const consultOpen = expandedSections[bill.id] === undefined || expandedSections[bill.id].has("consultation");
    const pharmacyOpen = expandedSections[bill.id] === undefined || expandedSections[bill.id].has("pharmacy");
    const otherOpen = expandedSections[bill.id] === undefined || expandedSections[bill.id].has("other");
    const toggleSection = (section: string) => {
      setExpandedSections(prev => {
        const cur = prev[bill.id] ?? new Set(["consultation", "pharmacy", "other"]);
        const next = new Set(cur);
        if (next.has(section)) next.delete(section); else next.add(section);
        return { ...prev, [bill.id]: next };
      });
    };
    const consultTotal = consultItems.reduce((s, x) => s + x.svc.amount, 0);
    const pharmacyTotal = pharmacyItems.reduce((s, x) => s + x.svc.amount, 0);
    const otherTotal = otherItems.reduce((s, x) => s + x.svc.amount, 0);


    return (
      <div key={bill.id}
        className={`rounded-xl border overflow-hidden shadow-sm ${isActiveBill && !isBillPaid ? "border-primary/40 bg-primary/[0.02]" : "border-border/50 bg-card"}`}
        data-testid={`billing-card-${bill.id}`}>

        {/* ── HEADER ── */}
        <div className={`px-3 py-2.5 flex items-center gap-2 ${isActiveBill && !isBillPaid ? "bg-primary/10" : ""}`}>
          <button className="flex-1 min-w-0 text-left" onClick={() => toggleExpand(bill.id)}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-foreground font-mono">{bill.billNumber}</span>
              <StatusBadge status={bill.paymentStatus ?? "pending"} />
              {isActiveBill && !isBillPaid && (
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
            onClick={() => { setPreviewBill(bill); setPreviewModalOpen(true); }}
            className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-primary shrink-0 active:scale-95 transition-transform"
            title="Preview bill"
            aria-label="Preview bill"
            data-testid={`button-preview-bill-${bill.id}`}>
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onPrintBill(bill)}
            className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-primary shrink-0 active:scale-95 transition-transform"
            title="Print receipt"
            aria-label="Print receipt"
            data-testid={`button-print-bill-${bill.id}`}>
            <Printer className="h-3.5 w-3.5" />
          </button>
          {!isBillPaid && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 shrink-0 active:scale-95 transition-all"
                  title="Delete bill"
                  aria-label="Delete bill"
                  data-testid={`button-delete-bill-${bill.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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
          <button
            onClick={() => toggleExpand(bill.id)}
            className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground shrink-0"
            aria-label={isExpanded ? "Collapse bill" : "Expand bill"}
            data-testid={`button-expand-bill-${bill.id}`}>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* ── EXPANDED BODY ── */}
        {isExpanded && (
          <div className="border-t border-border/40">

            {/* Action toolbar — only for the active editable bill */}
            {isActiveBill && canEdit && (
              <div className="px-3 py-2 border-b border-border/30 bg-background flex items-center gap-2 flex-wrap">
                <Button size="sm"
                  onClick={() => handleLoadPrescription()}
                  disabled={loadingPrescription}
                  className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground"
                  data-testid="button-load-prescription">
                  {loadingPrescription ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pill className="h-3.5 w-3.5" />}
                  Load Prescription
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => setAddFormOpenInCard(v => !v)}
                  className="h-8 text-xs gap-1.5 active:scale-[0.98]"
                  data-testid="button-toggle-add-entry">
                  <Plus className="h-3.5 w-3.5" /> Add Entry
                </Button>
              </div>
            )}

            {/* Inline Add Entry form — compact table-row style */}
            {isActiveBill && canEdit && addFormOpenInCard && (
              <div className="px-3 py-2.5 border-b border-border/40 bg-muted/5 animate-in slide-in-from-top-1 duration-150 space-y-2">
                {/* Header row */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex-1">Add Entry</span>
                  <button onClick={() => setAddFormOpenInCard(false)} className="p-1 rounded hover:bg-muted/60 text-muted-foreground shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {/* Description on its own row, controls on second row */}
                <div className="space-y-1.5">
                  <Input
                    value={addForm.description}
                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description…"
                    className="h-8 text-xs w-full"
                    data-testid="input-entry-description"
                  />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-8 text-xs flex-1 min-w-[90px]" data-testid="select-entry-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input
                    type="number" min="1" value={addForm.qty}
                    onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))}
                    placeholder="Qty"
                    className="h-8 text-xs w-14 shrink-0"
                    data-testid="input-entry-qty"
                  />
                  <div className="relative shrink-0 w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">₹</span>
                    <Input
                      type="number" min="0" step="0.01" value={addForm.unitPrice}
                      onChange={e => setAddForm(f => ({ ...f, unitPrice: e.target.value }))}
                      placeholder="Price"
                      className="pl-5 h-8 text-xs"
                      data-testid="input-entry-unit-price"
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground shrink-0 w-16 text-right tabular-nums">
                    {addForm.qty && addForm.unitPrice && parseFloat(addForm.qty) > 0 && parseFloat(addForm.unitPrice) > 0
                      ? `₹${(parseFloat(addForm.qty) * parseFloat(addForm.unitPrice)).toFixed(0)}`
                      : <span className="text-muted-foreground/40 font-normal">Total</span>}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleAddEntry}
                    disabled={addChargeMutation.isPending}
                    className="h-8 text-xs px-3 shrink-0 gap-1 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground"
                    data-testid="button-save-entry"
                  >
                    {addChargeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Add
                  </Button>
                </div>
                </div>
              </div>
            )}

            {/* Unpriced pharmacy warning */}
            {unpricedPharmacy.length > 0 && (
              <div className="px-3 py-2 bg-amber-50/80 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-800/30 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    {unpricedPharmacy.length} item{unpricedPharmacy.length > 1 ? "s" : ""} need pricing
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5">
                    Click ₹0 to set a price, or update your Pharmacy Catalog first.
                  </p>
                </div>
              </div>
            )}

            {/* Items */}
            {services.length > 0 ? (
              <div className="divide-y divide-border/20">

                {/* Consultation & Procedures */}
                {consultItems.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleSection("consultation")}
                      className="w-full px-3 py-2 bg-green-50 dark:bg-green-900/30 flex items-center gap-1.5 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-left"
                      data-testid={`button-section-consultation-${bill.id}`}
                    >
                      <Stethoscope className="h-3 w-3 text-green-800 dark:text-green-300 shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-800 dark:text-green-300 flex-1">Consultation &amp; Procedures</span>
                      <ChevronDown className={`h-3 w-3 text-green-800 dark:text-green-300 ml-1 shrink-0 transition-transform duration-200 ${consultOpen ? "rotate-180" : ""}`} />
                    </button>
                    {consultOpen && (
                      <div className="mx-3 mb-2.5 rounded-lg border border-border/70 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          {/* 8-col grid: #(4%) | Description spans cols2-4(43%+9%+9%) | ₹/Unit(9%) | Qty(9%) | Total(9%) | Actions(8%) */}
                          <div className="max-h-[10.5rem] overflow-y-scroll" style={{ scrollbarGutter: "stable" }}>
                            <table className="w-full text-xs table-fixed min-w-[500px]">
                              <colgroup>
                                <col style={{ width: "4%" }} />
                                <col style={{ width: "43%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "8%" }} />
                              </colgroup>
                              <thead className="sticky top-0 z-10">
                                <tr className="border-b border-border/50 bg-muted/60">
                                  <th className="text-center py-1 pl-2 pr-1 font-semibold text-muted-foreground">#</th>
                                  <th colSpan={3} className="text-left py-1 px-2 font-semibold text-muted-foreground">Description</th>
                                  <th className="text-right py-1 px-2 font-semibold text-muted-foreground">₹/Unit</th>
                                  <th className="text-center py-1 px-2 font-semibold text-muted-foreground">Qty</th>
                                  <th className="text-right py-1 px-2 font-semibold text-muted-foreground">Total</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {consultItems.map(({ svc, origIdx }, rowIdx) => {
                                  const itemKey = `${bill.id}-${origIdx}`;
                                  const isEditing = editingKey === itemKey;
                                  const isItemPaid = svc.paid || isBillPaid;
                                  return (
                                    <tr key={origIdx} className={`group/row transition-colors ${isItemPaid ? "bg-emerald-50/40 dark:bg-emerald-950/15" : "bg-card hover:bg-muted/20"}`}
                                      data-testid={`billing-item-${bill.id}-${origIdx}`}>
                                      <td className="py-1 pl-2 pr-1 text-center tabular-nums text-muted-foreground/60">{rowIdx + 1}</td>
                                      <td colSpan={3} className="py-1 px-2 text-foreground">
                                        <span className="flex items-center gap-1 min-w-0">
                                          {isItemPaid && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />}
                                          <span className="truncate">{svc.description}</span>
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right tabular-nums text-muted-foreground">
                                        {svc.unitPrice ? `₹${Number(svc.unitPrice).toFixed(0)}` : "—"}
                                      </td>
                                      <td className="py-1 px-2 text-center tabular-nums text-muted-foreground">{svc.qty ?? 1}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">
                                        {isEditing ? (
                                          <div className="relative inline-block">
                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                                            <Input type="number" min="0" value={editingAmount}
                                              onChange={e => setEditingAmount(e.target.value)}
                                              onBlur={() => saveEditAmount(makeItemMeta(svc, origIdx))}
                                              onKeyDown={e => { if (e.key === "Enter") saveEditAmount(makeItemMeta(svc, origIdx)); if (e.key === "Escape") setEditingKey(null); }}
                                              className="h-6 w-20 pl-4 text-xs" autoFocus
                                              data-testid={`input-item-amount-${itemKey}`} />
                                          </div>
                                        ) : isItemPaid ? (
                                          <span className="flex items-center gap-0.5 justify-end text-emerald-600">
                                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> ₹{svc.amount.toFixed(0)}
                                          </span>
                                        ) : (
                                          <span className="tabular-nums text-foreground">₹{svc.amount.toFixed(0)}</span>
                                        )}
                                      </td>
                                      <td className="py-1 px-1">
                                        {isItemPaid ? (
                                          <Lock className="h-3 w-3 text-muted-foreground/30 block mx-auto" aria-hidden title="Paid — cannot remove" />
                                        ) : (
                                          <div className="flex items-center justify-center gap-0.5">
                                            <button
                                              onClick={() => startEditAmount(makeItemMeta(svc, origIdx))}
                                              aria-label="Edit amount"
                                              title="Edit amount"
                                              className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                              data-testid={`button-edit-amount-${itemKey}`}>
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                            <button
                                              onClick={() => deleteItemMutation.mutate({ bill, itemIndex: origIdx })}
                                              disabled={deleteItemMutation.isPending}
                                              aria-label="Remove item"
                                              className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                              data-testid={`button-delete-item-${bill.id}-${origIdx}`}>
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* Pinned footer — stays visible while body scrolls */}
                          <table className="w-full text-xs table-fixed min-w-[500px]">
                            <colgroup>
                              <col style={{ width: "4%" }} />
                              <col style={{ width: "43%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "8%" }} />
                            </colgroup>
                            <tfoot>
                              <tr className="bg-primary/5 border-t border-border/40">
                                <td colSpan={5} className="py-1.5 pl-2 pr-2 text-xs font-semibold text-muted-foreground">
                                  {consultItems.length} service{consultItems.length !== 1 ? "s" : ""}
                                </td>
                                <td className="py-1.5 px-2 text-center tabular-nums text-xs text-muted-foreground">
                                  {consultItems.reduce((s, x) => s + (x.svc.qty ?? 1), 0)}
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-bold text-foreground">
                                  ₹{consultTotal.toFixed(0)}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pharmacy */}
                {pharmacyItems.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleSection("pharmacy")}
                      className="w-full px-3 py-2 bg-green-50 dark:bg-green-900/30 flex items-center gap-1.5 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-left"
                      data-testid={`button-section-pharmacy-${bill.id}`}
                    >
                      <Pill className="h-3 w-3 text-green-800 dark:text-green-300 shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-800 dark:text-green-300 flex-1">Pharmacy</span>
                      <ChevronDown className={`h-3 w-3 text-green-800 dark:text-green-300 ml-1 shrink-0 transition-transform duration-200 ${pharmacyOpen ? "rotate-180" : ""}`} />
                    </button>
                    {pharmacyOpen && (
                      <div className="mx-3 mb-2.5 rounded-lg border border-border/70 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          {/* 8-col grid: #(4%) | Medicine(43%) | Dos.(9%) | Freq.(9%) | Dur.(9%) | Qty(9%) | Total(9%) | Actions(8%) */}
                          <div className="max-h-[10.5rem] overflow-y-scroll" style={{ scrollbarGutter: "stable" }}>
                            <table className="w-full text-xs table-fixed min-w-[500px]">
                              <colgroup>
                                <col style={{ width: "4%" }} />
                                <col style={{ width: "43%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "8%" }} />
                              </colgroup>
                              <thead className="sticky top-0 z-10">
                                <tr className="border-b border-border/50 bg-muted/60">
                                  <th className="text-center py-1 pl-2 pr-1 font-semibold text-muted-foreground">#</th>
                                  <th className="text-left py-1 px-2 font-semibold text-muted-foreground">Medicine</th>
                                  <th className="text-left py-1 px-2 font-semibold text-muted-foreground">Dos.</th>
                                  <th className="text-left py-1 px-2 font-semibold text-muted-foreground">Freq.</th>
                                  <th className="text-left py-1 px-2 font-semibold text-muted-foreground">Dur.</th>
                                  <th className="text-center py-1 px-2 font-semibold text-muted-foreground">Qty</th>
                                  <th className="text-right py-1 px-2 font-semibold text-muted-foreground">Total</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {pharmacyItems.map(({ svc, origIdx }, rowIdx) => {
                                  const itemKey = `${bill.id}-${origIdx}`;
                                  const isEditing = editingKey === itemKey;
                                  const isItemPaid = svc.paid || isBillPaid;
                                  const isUnpriced = svc.amount === 0 && !isBillPaid;
                                  const { medicine, dosage, frequency, duration } = getPharmacyFields(svc);
                                  return (
                                    <tr key={origIdx}
                                      className={`group/row transition-colors ${isItemPaid ? "bg-emerald-50/40 dark:bg-emerald-950/15" : isUnpriced ? "bg-amber-50/60 dark:bg-amber-950/15 hover:bg-amber-50/80" : "bg-card hover:bg-muted/20"}`}
                                      data-testid={`billing-item-${bill.id}-${origIdx}`}>
                                      <td className="py-1 pl-2 pr-1 text-center tabular-nums text-muted-foreground/60">{rowIdx + 1}</td>
                                      <td className="py-1 px-2 font-medium text-foreground">
                                        <span className="flex items-center gap-1 min-w-0">
                                          {isItemPaid && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />}
                                          <span className="truncate">{medicine}</span>
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-muted-foreground truncate">{dosage || "—"}</td>
                                      <td className="py-1 px-2 text-muted-foreground truncate">{frequency || "—"}</td>
                                      <td className="py-1 px-2 text-muted-foreground truncate">{duration || "—"}</td>
                                      <td className="py-1 px-2 text-center tabular-nums text-muted-foreground">{svc.qty ?? 1}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">
                                        {isEditing ? (
                                          <div className="relative inline-block">
                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                                            <Input type="number" min="0" value={editingAmount}
                                              onChange={e => setEditingAmount(e.target.value)}
                                              onBlur={() => saveEditAmount(makeItemMeta(svc, origIdx))}
                                              onKeyDown={e => { if (e.key === "Enter") saveEditAmount(makeItemMeta(svc, origIdx)); if (e.key === "Escape") setEditingKey(null); }}
                                              className={`h-6 w-20 pl-4 text-xs ${isUnpriced ? "border-amber-400" : ""}`} autoFocus
                                              data-testid={`input-item-amount-${itemKey}`} />
                                          </div>
                                        ) : isItemPaid ? (
                                          <span className="flex items-center gap-0.5 justify-end text-emerald-600">
                                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> ₹{svc.amount.toFixed(0)}
                                          </span>
                                        ) : (
                                          <span className={`tabular-nums ${isUnpriced ? "text-amber-600" : "text-foreground"}`}>
                                            ₹{svc.amount.toFixed(0)}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1 px-1">
                                        {isItemPaid ? (
                                          <Lock className="h-3 w-3 text-muted-foreground/30 block mx-auto" aria-hidden title="Paid — cannot remove" />
                                        ) : (
                                          <div className="flex items-center justify-center gap-0.5">
                                            <button
                                              onClick={() => startEditAmount(makeItemMeta(svc, origIdx))}
                                              aria-label="Edit amount"
                                              title="Edit amount"
                                              className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                              data-testid={`button-edit-amount-${itemKey}`}>
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                            <button
                                              onClick={() => deleteItemMutation.mutate({ bill, itemIndex: origIdx })}
                                              disabled={deleteItemMutation.isPending}
                                              aria-label="Remove item"
                                              className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                              data-testid={`button-delete-item-${bill.id}-${origIdx}`}>
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* Pinned footer — stays visible while body scrolls */}
                          <table className="w-full text-xs table-fixed min-w-[500px]">
                            <colgroup>
                              <col style={{ width: "4%" }} />
                              <col style={{ width: "43%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "9%" }} />
                              <col style={{ width: "8%" }} />
                            </colgroup>
                            <tfoot>
                              <tr className="bg-primary/5 border-t border-border/40">
                                <td colSpan={5} className="py-1.5 pl-2 pr-2 text-xs font-semibold text-muted-foreground">
                                  {pharmacyItems.length} medicine{pharmacyItems.length !== 1 ? "s" : ""}
                                </td>
                                <td className="py-1.5 px-2 text-center tabular-nums text-xs text-muted-foreground">
                                  {pharmacyItems.reduce((s, x) => s + (x.svc.qty ?? 1), 0)}
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-bold text-foreground">
                                  ₹{pharmacyTotal.toFixed(0)}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Other items */}
                {otherItems.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleSection("other")}
                      className="w-full px-3 py-2 bg-green-50 dark:bg-green-900/30 flex items-center gap-1.5 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-left"
                      data-testid={`button-section-other-${bill.id}`}
                    >
                      <ClipboardList className="h-3 w-3 text-green-800 dark:text-green-300 shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-800 dark:text-green-300 flex-1">Other</span>
                      <ChevronDown className={`h-3 w-3 text-green-800 dark:text-green-300 ml-1 shrink-0 transition-transform duration-200 ${otherOpen ? "rotate-180" : ""}`} />
                    </button>
                    {otherOpen && otherItems.map(({ svc, origIdx }) => {
                      const itemKey = `${bill.id}-${origIdx}`;
                      const isEditing = editingKey === itemKey;
                      const isItemPaid = svc.paid || isBillPaid;
                      return (
                        <div key={origIdx} className={`flex items-center gap-2 px-3 py-1.5 group/row border-b border-border/10 last:border-0 ${isItemPaid ? "bg-emerald-50/40 dark:bg-emerald-950/15" : "hover:bg-muted/20"}`}
                          data-testid={`billing-item-${bill.id}-${origIdx}`}>
                          <span className="flex-1 text-xs min-w-0 truncate text-foreground flex items-center gap-1">
                            {isItemPaid && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />}
                            {svc.description}
                          </span>
                          {isEditing ? (
                            <div className="relative shrink-0">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                              <Input type="number" min="0" value={editingAmount}
                                onChange={e => setEditingAmount(e.target.value)}
                                onBlur={() => saveEditAmount(makeItemMeta(svc, origIdx))}
                                onKeyDown={e => { if (e.key === "Enter") saveEditAmount(makeItemMeta(svc, origIdx)); if (e.key === "Escape") setEditingKey(null); }}
                                className="h-6 w-20 pl-4 text-xs" autoFocus
                                data-testid={`input-item-amount-${itemKey}`} />
                            </div>
                          ) : (
                            <button onClick={() => !isItemPaid && startEditAmount(makeItemMeta(svc, origIdx))} title="Click to edit"
                              className={`text-xs font-semibold tabular-nums shrink-0 flex items-center gap-0.5 ${isItemPaid ? "text-emerald-600" : "hover:text-primary transition-colors"}`}
                              data-testid={`amount-${itemKey}`}>
                              {isItemPaid && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                              ₹{svc.amount.toFixed(0)}
                              {!isItemPaid && <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/row:opacity-60 transition-opacity ml-0.5" />}
                            </button>
                          )}
                          {isItemPaid ? (
                            <Lock className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                          ) : (
                            <button onClick={() => deleteItemMutation.mutate({ bill, itemIndex: origIdx })}
                              disabled={deleteItemMutation.isPending}
                              className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 shrink-0"
                              data-testid={`button-delete-item-${bill.id}-${origIdx}`}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground italic">
                {isActiveBill && canEdit
                  ? 'No items yet — use "Load Prescription" or "Add Entry" above'
                  : "No items in this bill"}
              </p>
            )}

            {/* Discount + Tax — only for editable bills with items */}
            {canEdit && services.length > 0 && (
              <div className="px-3 py-2 border-t border-border/30 bg-muted/10 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Discount %</label>
                  <Input type="number" min="0" max="100" step="0.5"
                    defaultValue={String(bill.discountPct ?? 0)}
                    onBlur={e => {
                      const val = parseFloat(e.target.value) || 0;
                      if (val !== (bill.discountPct ?? 0)) {
                        updateDiscountTaxMutation.mutate({ bill, discountPct: val, taxPct: bill.taxPct ?? 0 });
                      }
                    }}
                    className="h-7 w-16 text-xs" data-testid="input-discount-pct" />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Tax %</label>
                  <Input type="number" min="0" max="100" step="0.5"
                    defaultValue={String(bill.taxPct ?? 0)}
                    onBlur={e => {
                      const val = parseFloat(e.target.value) || 0;
                      if (val !== (bill.taxPct ?? 0)) {
                        updateDiscountTaxMutation.mutate({ bill, discountPct: bill.discountPct ?? 0, taxPct: val });
                      }
                    }}
                    className="h-7 w-16 text-xs" data-testid="input-tax-pct" />
                </div>
              </div>
            )}

            {/* Totals */}
            {services.length > 0 && (
              <div className="px-3 py-2 bg-muted/20 border-t border-border/30 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Subtotal</span>
                  <span className="text-xs tabular-nums text-foreground">₹{services.reduce((s, i) => s + i.amount, 0).toFixed(0)}</span>
                </div>
                {(bill.discountPct ?? 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Discount ({bill.discountPct}%)</span>
                    <span className="text-xs tabular-nums text-emerald-600">
                      −₹{(services.reduce((s, i) => s + i.amount, 0) * ((bill.discountPct ?? 0) / 100)).toFixed(0)}
                    </span>
                  </div>
                )}
                {(bill.taxPct ?? 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Tax ({bill.taxPct}%)</span>
                    <span className="text-xs tabular-nums text-foreground">
                      +₹{((services.reduce((s, i) => s + i.amount, 0) * (1 - (bill.discountPct ?? 0) / 100)) * ((bill.taxPct ?? 0) / 100)).toFixed(0)}
                    </span>
                  </div>
                )}
                {paidAmt > 0 && !allPaid && !isBillPaid && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Collected</span>
                    <span className="text-xs tabular-nums text-emerald-600 font-semibold">₹{paidAmt.toFixed(0)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-0.5 border-t border-border/30">
                  <span className={`text-sm font-black tracking-wide ${isBillPaid ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                    {isBillPaid ? "PAID" : "Outstanding"}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${isBillPaid ? "text-emerald-600" : "text-primary"}`}>₹{totalAmt.toFixed(0)}</span>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="px-3 py-2.5 bg-muted/20 border-t border-border/30 space-y-2">

              {/* Primary CTA row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  {allPaid || isBillPaid ? (
                    <span className="flex flex-col">
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Fully settled
                      </span>
                      {(bill as PatientBill & { cashierId?: string }).cashierId && (
                        <span className="text-xs text-muted-foreground mt-0.5">
                          Processed by {(bill as PatientBill & { cashierId?: string }).cashierId}
                        </span>
                      )}
                    </span>
                  ) : paidAmt > 0 ? (
                    <span>
                      Collected <span className="font-bold text-emerald-600">₹{paidAmt.toFixed(0)}</span>
                      {" · "}Balance <span className="font-bold text-amber-600">₹{(totalAmt - paidAmt).toFixed(0)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">₹{totalAmt.toFixed(0)} outstanding</span>
                  )}
                </div>

                {/* Single Confirm & Pay CTA — hidden once the payment form is open */}
                {!allPaid && !isBillPaid && services.length > 0 && !showCashierFor && (
                  <Button size="sm"
                    onClick={() => openCashierForm(bill)}
                    className="h-7 px-3 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 active:scale-[0.98]"
                    data-testid={`button-confirm-pay-${bill.id}`}>
                    <CreditCard className="h-3 w-3" /> Confirm &amp; Pay
                  </Button>
                )}
              </div>

              {/* Record Payment form */}
              {showCashierFor && (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 space-y-2 animate-in slide-in-from-top-1 duration-150">
                  {isDraft && (
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> This draft will be confirmed &amp; marked paid in one step.
                    </p>
                  )}
                  {/* 2-column grid — responsive on all screen sizes */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">₹</span>
                      <Input type="number" min="0"
                        value={cashierForm!.amountReceived}
                        onChange={e => setCashierForm(f => f ? { ...f, amountReceived: e.target.value } : f)}
                        className="pl-5 h-8 text-xs w-full" data-testid="input-cashier-amount" />
                    </div>
                    <Select value={cashierForm!.paymentMethod} onValueChange={v => setCashierForm(f => f ? { ...f, paymentMethod: v } : f)}>
                      <SelectTrigger className="h-8 text-xs w-full" data-testid="select-payment-method"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={cashierForm!.cashierName}
                      onChange={e => setCashierForm(f => f ? { ...f, cashierName: e.target.value } : f)}
                      placeholder="Cashier name…"
                      className="h-8 text-xs w-full" data-testid="input-cashier-name" />
                    <Input value={cashierForm!.notes}
                      onChange={e => setCashierForm(f => f ? { ...f, notes: e.target.value } : f)}
                      placeholder="Notes (optional)…"
                      className="h-8 text-xs w-full" data-testid="input-cashier-notes" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setCashierForm(null)} className="h-7 px-2 text-xs" disabled={markPaidMutation.isPending}>
                      Cancel
                    </Button>
                    <Button size="sm"
                      onClick={() => markPaidMutation.mutate({
                        bill,
                        cashierName: cashierForm!.cashierName,
                        amountReceived: parseFloat(cashierForm!.amountReceived) || (bill.total ?? 0),
                        cashierNotes: cashierForm!.notes,
                        paymentMethod: cashierForm!.paymentMethod,
                      })}
                      disabled={markPaidMutation.isPending}
                      className="h-7 px-3 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                      data-testid="button-confirm-payment">
                      {markPaidMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                      Confirm &amp; Pay
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

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RETURN
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Patient identity strip */}
      {patientCode && (
        <div className="flex items-center gap-1.5 px-0.5">
          <User className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">{patientName}</span>
          <span className="font-mono text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1.5 py-0.5 rounded-md shrink-0">
            {patientCode}
          </span>
        </div>
      )}

      {/* Settled banner — when all bills are paid */}
      {bills.length > 0 && allCurrentFullyPaid && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/20 overflow-hidden shadow-sm">
          <div className="px-3 py-2.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">All Bills Paid</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">₹{consolidatedTotal.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {bills.length > 1 && bills.some(b => b.paymentMethod !== sortedBills[0]?.paymentMethod)
                    ? "Multiple methods"
                    : (sortedBills[0]?.paymentMethod ?? "Cash")}
                </span>
                {bills.length === 1 && (sortedBills[0] as PatientBill & { cashierId?: string })?.cashierId && (
                  <><span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">by {(sortedBills[0] as PatientBill & { cashierId?: string }).cashierId}</span></>
                )}
              </div>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {bills.length} bill{bills.length !== 1 ? "s" : ""} · {allCurrentServices.length} item{allCurrentServices.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {bills.length > 1 && onConsolidatedReceipt ? (
                <Button size="sm" variant="ghost" onClick={() => onConsolidatedReceipt(bills)}
                  className="h-7 px-2 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                  data-testid="button-settled-pdf">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              ) : bills.length === 1 ? (
                <Button size="sm" variant="ghost" onClick={() => onPrintBill(bills[0])}
                  className="h-7 px-2 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                  data-testid="button-settled-pdf-single">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => createNewBillMutation.mutate()}
                disabled={createNewBillMutation.isPending}
                className="h-7 px-2 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 border border-emerald-400/30 ml-1"
                data-testid="button-settled-new-bill">
                {createNewBillMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                New Bill
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* No bills yet — standalone action buttons */}
      {bills.length === 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => handleLoadPrescription()} disabled={loadingPrescription}
            className="flex-1 h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground min-w-[130px]"
            data-testid="button-load-prescription">
            {loadingPrescription ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pill className="h-3.5 w-3.5" />}
            Load Prescription
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddFormOpen(v => !v)}
            className="flex-1 h-8 text-xs gap-1.5 active:scale-[0.98] min-w-[100px]"
            data-testid="button-toggle-add-entry">
            <Plus className="h-3.5 w-3.5" /> Add Entry
          </Button>
          <Button size="sm" variant="outline" onClick={() => createNewBillMutation.mutate()} disabled={createNewBillMutation.isPending}
            className="h-8 text-xs gap-1.5 border-blue-400/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 active:scale-[0.98]"
            data-testid="button-new-bill">
            {createNewBillMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            New Bill
          </Button>
        </div>
      )}

      {/* Add Entry form when no bills */}
      {bills.length === 0 && addFormOpen && (
        <div className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Entry</span>
            <button onClick={() => setAddFormOpen(false)} className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description *</Label>
              <Input value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Dental cleaning, Root canal…"
                className="h-8 text-xs mt-0.5" data-testid="input-entry-description" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
              <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-entry-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</Label>
              <Input type="number" min="1" value={addForm.qty}
                onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))}
                className="h-8 text-xs mt-0.5" data-testid="input-entry-qty" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit Price (₹) *</Label>
              <div className="relative mt-0.5">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input type="number" min="0" step="0.01" value={addForm.unitPrice}
                  onChange={e => setAddForm(f => ({ ...f, unitPrice: e.target.value }))}
                  placeholder="0.00" className="pl-5 h-8 text-xs" data-testid="input-entry-unit-price" />
              </div>
              {addForm.qty && addForm.unitPrice && parseFloat(addForm.qty) > 0 && parseFloat(addForm.unitPrice) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total: ₹{(parseFloat(addForm.qty) * parseFloat(addForm.unitPrice)).toFixed(0)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button size="sm" variant="ghost" onClick={() => setAddFormOpen(false)} className="h-8 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleAddEntry} disabled={addChargeMutation.isPending}
              className="h-8 text-xs gap-1 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground"
              data-testid="button-save-entry">
              {addChargeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Add to Bill
            </Button>
          </div>
        </div>
      )}

      {/* ── BILLS SECTION HEADER ──────────────────────────────────────── */}
      {bills.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1 bg-border/40" />
          <div className="flex items-center gap-1.5 shrink-0">
            <IndianRupee className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
              {bills.length} Bill{bills.length !== 1 ? "s" : ""}
            </span>
            {bills.length > 1 && (
              <span className="text-xs text-muted-foreground/60">· ₹{consolidatedTotal.toFixed(0)}</span>
            )}
          </div>
          <div className="h-px flex-1 bg-border/40" />
          {/* Only show here when NOT fully settled — settled banner has its own New Bill */}
          {!allCurrentFullyPaid && (
            <Button size="sm" variant="outline"
              onClick={() => createNewBillMutation.mutate()}
              disabled={createNewBillMutation.isPending}
              className="h-7 text-xs gap-1 border-blue-400/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 active:scale-[0.98] shrink-0"
              data-testid="button-new-bill">
              {createNewBillMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              New Bill
            </Button>
          )}
        </div>
      )}

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
          {latestBill && olderBills.length > 0 && (
            <div className="flex items-center gap-2 px-0.5 pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Latest Bill</span>
              <div className="h-px flex-1 bg-primary/20" />
            </div>
          )}
          {latestBill && renderBillCard(latestBill)}
          {olderBills.length > 0 && (
            <>
              {/* Older Bills section label — matches "Latest Bill" left-label style */}
              <div className="flex items-center gap-2 px-0.5 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Older Bills</span>
                <div className="h-px flex-1 bg-primary/20" />
              </div>
              <button
                onClick={() => setShowOlderBills(v => !v)}
                className="w-full flex items-center gap-2 px-1 py-1 text-left"
                data-testid="button-toggle-older-bills">
                <span className="text-xs text-primary hover:text-primary/70 font-medium transition-colors flex-1">
                  {showOlderBills ? "Hide" : "Show"} {olderBills.length} older bill{olderBills.length !== 1 ? "s" : ""}
                </span>
                {showOlderBills
                  ? <ChevronUp className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-primary/70 shrink-0" />}
              </button>
              {showOlderBills && (
                <div className="rounded-xl border border-border/50 bg-muted/50 dark:bg-muted/20 p-2.5 space-y-2">
                  {Array.from(groupByDate(olderBills)).map(([dateLabel, dateBills]) => (
                    <div key={dateLabel} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border/30" />
                        <span className="text-xs text-muted-foreground/50 font-medium whitespace-nowrap">{dateLabel}</span>
                        <div className="h-px flex-1 bg-border/30" />
                      </div>
                      {dateBills.map(bill => (
                        <div key={bill.id}>{renderBillCard(bill)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PREVIOUS VISITS ─────────────────────────────────────────────── */}
      {previousVisitBills.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <button
            onClick={() => setHistoryExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 group"
            data-testid="button-toggle-patient-history">
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Patient History</span>
                <span className="ml-1.5 text-[10px] text-muted-foreground/50 normal-case">from other visits</span>
              </div>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
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
                  <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{b.billNumber}</span>
                  <StatusBadge status={b.paymentStatus ?? "pending"} />
                  <span className="text-xs tabular-nums font-semibold text-foreground shrink-0">₹{(b.total ?? 0).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT TRAIL ─────────────────────────────────────────────── */}
      <div className="border-t border-border/40 pt-3">
        <button
          onClick={() => setAuditExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-2"
          data-testid="button-toggle-audit">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit Trail</span>
            {auditLogs.length > 0 && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                {auditLogs.length}
              </span>
            )}
          </div>
          {auditExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {auditExpanded && (
          <div className="mt-2 space-y-1">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 py-2 text-center">No audit entries yet</p>
            ) : (
              auditLogs.map((log) => {
                const details = log.details as Record<string, unknown> | undefined;
                const description = details?.description;
                const cashierName = details?.cashierName;
                const amount = details?.amount;
                return (
                  <div key={log.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-muted/10 border border-border/20">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <AuditActionLabel action={log.action} />
                        {description != null && (
                          <span className="text-xs text-muted-foreground truncate">
                            — {String(description)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground/50 mt-0.5">
                        {log.createdAt ? format(new Date(log.createdAt), "dd MMM yyyy · HH:mm") : "—"}
                        {cashierName != null ? ` · ${String(cashierName)}` : ""}
                      </div>
                    </div>
                    {amount != null && (
                      <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">
                        ₹{Number(amount).toFixed(0)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── PRESCRIPTION PICKER DIALOG ────────────────────────────────── */}
      <Dialog open={rxPickerOpen} onOpenChange={open => { if (!open) setRxPickerOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Pill className="h-4 w-4 text-primary" /> Choose a Prescription to Load
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            {rxPickerRecords.length} prescriptions found for this appointment — select one to import into the bill.
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {rxPickerRecords.map(record => {
              const meds = parsePrescription(record.prescription) ?? [];
              const preview = meds.slice(0, 2).map(m => m.name).filter(Boolean).join(", ") + (meds.length > 2 ? `… +${meds.length - 2}` : "");
              const hasLinkedDx = !!(record.diagnosis && record.diagnosis.length > 0);
              return (
                <button
                  key={record.id}
                  onClick={async () => {
                    setRxPickerOpen(false);
                    setLoadingPrescription(true);
                    try {
                      await doLoadPrescription(record);
                    } catch {
                      notify.error("Could not load prescription items");
                    } finally {
                      setLoadingPrescription(false);
                    }
                  }}
                  className="w-full text-left rounded-xl border border-border/60 bg-muted/10 hover:bg-primary/5 hover:border-primary/30 px-3 py-2.5 space-y-1 transition-colors"
                  data-testid={`button-rx-picker-${record.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {record.createdAt ? format(new Date(record.createdAt), "d MMM yyyy · h:mm a") : "Unknown date"}
                    </span>
                    {hasLinkedDx && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold leading-none shrink-0">
                        Rx ✓ Linked to Dx
                      </span>
                    )}
                  </div>
                  {record.doctorName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" /> Dr. {record.doctorName}
                    </p>
                  )}
                  {hasLinkedDx && (
                    <div className="flex flex-wrap gap-1">
                      {(record.diagnosis ?? []).slice(0, 3).map(d => (
                        <span key={d} className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary font-medium">{d}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                    <Pill className="h-3 w-3 shrink-0" />
                    <span className="truncate">{preview || `${meds.length} medicine${meds.length !== 1 ? "s" : ""}`}</span>
                  </p>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── INVOICE PREVIEW MODAL ─────────────────────────────────────── */}
      <InvoicePreviewModal
        open={previewModalOpen}
        onClose={() => { setPreviewModalOpen(false); setPreviewBill(null); }}
        bills={previewBill ? [previewBill] : bills}
        patientName={patientName}
        patientCode={patientCode}
      />

    </div>
  );
}
