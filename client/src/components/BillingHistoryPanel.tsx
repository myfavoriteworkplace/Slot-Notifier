import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  IndianRupee, FileText, Trash2, Loader2, Plus, CheckCircle2,
  Clock, AlertCircle, Check, ChevronDown, ChevronUp, X, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PatientBill } from "@shared/schema";
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
}

interface BillingHistoryPanelProps {
  bookingId: number;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  patientCode?: string;
  onGenerateReceipt: (existingBill?: PatientBill) => void;
  onPrintBill: (bill: PatientBill) => void;
  onConsolidatedReceipt?: (bills: PatientBill[]) => void;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
      <CheckCircle2 className="h-2.5 w-2.5" /> Paid
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

export function BillingHistoryPanel({
  bookingId, patientName, patientPhone, patientEmail, patientCode, onGenerateReceipt, onPrintBill, onConsolidatedReceipt,
}: BillingHistoryPanelProps) {
  const { toast } = useToast();
  const [addDesc, setAddDesc] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [historyExpanded, setHistoryExpanded] = useState(false);

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
        const res = await apiRequest(
          "GET",
          `/api/auth/clinic/bills/patient-by-email/${encodeURIComponent(patientEmail)}`
        );
        if (!res.ok) throw new Error("Failed to load patient history");
        return res.json();
      }
      if (patientPhone) {
        const res = await apiRequest(
          "GET",
          `/api/auth/clinic/bills/patient/${encodeURIComponent(patientPhone)}`
        );
        if (!res.ok) throw new Error("Failed to load patient history");
        return res.json();
      }
      return [];
    },
    enabled: !!(patientEmail || patientPhone),
  });

  const previousVisitBills = patientHistory.filter(b => b.bookingId !== bookingId);

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

  const addChargeMutation = useMutation({
    mutationFn: async ({ description, amount }: { description: string; amount: number }) => {
      const activeBill = bills.find(b => b.paymentStatus !== "paid");
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
          services, subtotal, total, paymentStatus: computeStatus(services),
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
          paymentStatus: "pending",
        });
        if (!res.ok) throw new Error("Failed to create bill");
        return res.json();
      }
    },
    onSuccess: (_, vars) => {
      invalidate();
      setAddDesc("");
      setAddAmount("");
      toast({ title: "Charge added", description: `₹${vars.amount} for "${vars.description}" saved.` });
    },
    onError: () => toast({ title: "Could not add charge", variant: "destructive" }),
  });

  const updateItemsMutation = useMutation({
    mutationFn: async ({ bill, services }: { bill: PatientBill; services: ServiceItem[] }) => {
      const paymentStatus = computeStatus(services);
      const subtotal = services.reduce((s, i) => s + i.amount, 0);
      const disc = subtotal * ((bill.discountPct ?? 0) / 100);
      const tax = (subtotal - disc) * ((bill.taxPct ?? 0) / 100);
      const total = subtotal - disc + tax;
      const res = await apiRequest("PATCH", `/api/auth/clinic/bills/${bill.id}`, {
        services, paymentStatus, subtotal, total,
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => { invalidate(); },
    onError: () => toast({ title: "Could not update status", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ bill, itemIndex }: { bill: PatientBill; itemIndex: number }) => {
      const services = ((bill.services ?? []) as ServiceItem[]).filter((_, i) => i !== itemIndex);
      const paymentStatus = computeStatus(services);
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
    onError: () => toast({ title: "Could not remove item", variant: "destructive" }),
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/auth/clinic/bills/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { invalidate(); toast({ title: "Bill deleted" }); },
    onError: () => toast({ title: "Could not delete bill", variant: "destructive" }),
  });

  const handleAddCharge = () => {
    const amount = parseFloat(addAmount);
    if (!addDesc.trim() || isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a description and valid amount", variant: "destructive" });
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

  const markAllPaid = (bill: PatientBill) => {
    const services = ((bill.services ?? []) as ServiceItem[]).map(s => ({ ...s, paid: true }));
    updateItemsMutation.mutate({ bill, services });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeBill = bills.find(b => b.paymentStatus !== "paid") ?? bills[0];

  if (isLoading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <IndianRupee className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {bills.length > 0 ? `${bills.length} Bill${bills.length > 1 ? "s" : ""}` : "No Bills Yet"}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => onGenerateReceipt(activeBill)}
          className="h-7 px-2.5 text-[11px] font-bold gap-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0"
          data-testid="button-billing-create"
        >
          <FileText className="h-3 w-3" />
          {activeBill ? "Finalise Receipt" : "Generate Receipt"}
        </Button>
      </div>

      {/* ── Inline Add Charge ─────────────────────────────────── */}
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
            type="number"
            min="0"
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

      {/* ── Bills list ───────────────────────────────────────── */}
      {bills.length === 0 ? (
        <div className="py-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
          <div className="p-2 bg-muted/40 rounded-full w-fit mx-auto mb-2">
            <FileText className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Add a charge above to start billing</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">or click "Generate Receipt" for a full invoice</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...groupByDate(bills).entries()].map(([dateLabel, dateBills]) => (
            <div key={dateLabel}>
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {dateLabel}
                </p>
                {onConsolidatedReceipt && (
                  <button
                    onClick={() => onConsolidatedReceipt(dateBills)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors"
                    data-testid={`button-consolidated-receipt-${dateLabel}`}
                  >
                    <FileText className="h-2.5 w-2.5" />
                    Consolidated PDF
                  </button>
                )}
              </div>
              <div className="space-y-2">
          {dateBills.map(bill => {
            const services = (bill.services ?? []) as ServiceItem[];
            const isExpanded = expandedIds.has(bill.id);
            const paidAmt = services.filter(s => s.paid).reduce((s, i) => s + i.amount, 0);
            const totalAmt = bill.total ?? 0;
            const allPaid = services.length > 0 && services.every(s => s.paid);

            return (
              <div
                key={bill.id}
                className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden"
                data-testid={`billing-card-${bill.id}`}
              >
                {/* Bill header row */}
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <button className="flex-1 min-w-0 text-left" onClick={() => toggleExpand(bill.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground font-mono">{bill.billNumber}</span>
                      <StatusBadge status={bill.paymentStatus ?? "paid"} />
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
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-2 group"
                            data-testid={`billing-item-${bill.id}-${idx}`}
                          >
                            {/* Per-item paid checkbox */}
                            <button
                              onClick={() => toggleItemPaid(bill, idx)}
                              disabled={updateItemsMutation.isPending}
                              className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                                svc.paid
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-border/60 hover:border-primary/60 bg-background"
                              }`}
                              title={svc.paid ? "Mark as unpaid" : "Mark as paid"}
                              data-testid={`button-toggle-item-paid-${bill.id}-${idx}`}
                            >
                              {svc.paid && <Check className="h-2.5 w-2.5" />}
                            </button>

                            <span className={`flex-1 text-xs ${svc.paid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {svc.description}
                            </span>

                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${svc.paid ? "text-emerald-600" : "text-foreground"}`}>
                              ₹{svc.amount.toFixed(0)}
                            </span>

                            {/* Remove item */}
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

                    {/* Footer: collected summary + actions */}
                    <div className="px-3 py-2.5 bg-muted/20 border-t border-border/30 flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[10px] text-muted-foreground">
                        {allPaid ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Fully settled
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

                      <div className="flex items-center gap-1.5">
                        {/* Mark All Paid */}
                        {!allPaid && services.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAllPaid(bill)}
                            disabled={updateItemsMutation.isPending}
                            className="h-6 px-2 text-[10px] gap-1 border-emerald-400/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            data-testid={`button-mark-all-paid-${bill.id}`}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Mark All Paid
                          </Button>
                        )}

                        {/* Print */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onPrintBill(bill)}
                          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                          data-testid={`button-reprint-${bill.id}`}
                        >
                          <FileText className="h-3 w-3" /> Print
                        </Button>

                        {/* Delete bill */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              data-testid={`button-delete-bill-${bill.id}`}
                            >
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
                              <AlertDialogAction
                                onClick={() => deleteBillMutation.mutate(bill.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Previous Visits Section ───────────────────────────── */}
      {previousVisitBills.length > 0 && (
        <div className="border-t border-border/40 pt-3 mt-1">
          <button
            onClick={() => setHistoryExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 group"
            data-testid="button-toggle-patient-history"
          >
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Previous Visits
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                {previousVisitBills.length} bill{previousVisitBills.length !== 1 ? "s" : ""}
              </span>
            </div>
            {historyExpanded
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {historyExpanded && (
            <div className="mt-2 space-y-3">
              {[...groupByDate(previousVisitBills).entries()].map(([dateLabel, dateBills]) => (
                <div key={dateLabel}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5 px-0.5">
                    {dateLabel}
                  </p>
                  <div className="space-y-1.5">
                    {dateBills.map(bill => {
                      const services = (bill.services ?? []) as ServiceItem[];
                      const paidAmt = services.filter(s => s.paid).reduce((s, i) => s + i.amount, 0);
                      const totalAmt = bill.total ?? 0;
                      return (
                        <div
                          key={bill.id}
                          className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5"
                          data-testid={`history-bill-${bill.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold font-mono text-foreground/80 flex-1 min-w-0 truncate">
                              {bill.billNumber}
                            </span>
                            <StatusBadge status={bill.paymentStatus ?? "pending"} />
                            <span className="text-sm font-bold text-primary shrink-0">
                              ₹{totalAmt.toFixed(0)}
                            </span>
                          </div>
                          {services.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {services.map((svc, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className={`flex-1 text-[11px] ${svc.paid ? "line-through text-muted-foreground/60" : "text-muted-foreground"}`}>
                                    {svc.description}
                                  </span>
                                  <span className="text-[11px] font-medium tabular-nums text-muted-foreground shrink-0">
                                    ₹{svc.amount.toFixed(0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {paidAmt > 0 && paidAmt < totalAmt && (
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                              Collected <span className="font-semibold text-emerald-600">₹{paidAmt.toFixed(0)}</span>
                              {" · "}Balance <span className="font-semibold text-amber-600">₹{(totalAmt - paidAmt).toFixed(0)}</span>
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1.5 gap-2">
                            <span className="text-[10px] text-muted-foreground/60">
                              {bill.paymentMethod ?? "Cash"}
                            </span>
                            <button
                              onClick={() => onPrintBill(bill)}
                              className="text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
                              data-testid={`button-history-print-${bill.id}`}
                            >
                              <FileText className="h-2.5 w-2.5" /> Print
                            </button>
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

    </div>
  );
}
