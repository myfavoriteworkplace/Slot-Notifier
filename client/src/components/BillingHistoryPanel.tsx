import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { IndianRupee, FileText, Trash2, Loader2, Plus, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PatientBill } from "@shared/schema";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BillingHistoryPanelProps {
  bookingId: number;
  onGenerateReceipt: () => void;
  onPrintBill: (bill: PatientBill) => void;
}

function statusBadge(status: string) {
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

export function BillingHistoryPanel({ bookingId, onGenerateReceipt, onPrintBill }: BillingHistoryPanelProps) {
  const { toast } = useToast();

  const { data: bills = [], isLoading } = useQuery<PatientBill[]>({
    queryKey: ["/api/auth/clinic/bills/booking", bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/auth/clinic/bills/booking/${bookingId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bills");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/auth/clinic/bills/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills/booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills"] });
      toast({ title: "Bill deleted" });
    },
    onError: () => toast({ title: "Could not delete bill", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <IndianRupee className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {bills.length > 0 ? `${bills.length} Receipt${bills.length > 1 ? "s" : ""}` : "No Receipts Yet"}
          </span>
        </div>
        <Button
          size="sm"
          onClick={onGenerateReceipt}
          className="h-7 px-2.5 text-[11px] font-bold gap-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0"
          data-testid="button-billing-create"
        >
          <Plus className="h-3 w-3" />
          {bills.length > 0 ? "New Receipt" : "Generate Receipt"}
        </Button>
      </div>

      {bills.length === 0 ? (
        <div className="py-8 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
          <div className="p-2.5 bg-muted/40 rounded-full w-fit mx-auto mb-2">
            <FileText className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No receipts generated yet</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">Click "Generate Receipt" to create the first one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map((bill) => {
            const svcCount = (bill.services as any[])?.length ?? 0;
            return (
              <div
                key={bill.id}
                className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden"
                data-testid={`billing-card-${bill.id}`}
              >
                <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground font-mono">{bill.billNumber}</span>
                      {statusBadge(bill.paymentStatus ?? "paid")}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">
                        {bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : "—"}
                      </span>
                      {svcCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          · {svcCount} item{svcCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        · {bill.paymentMethod ?? "Cash"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-primary">
                      ₹{(bill.total ?? 0).toFixed(0)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => onPrintBill(bill)}
                      data-testid={`button-reprint-${bill.id}`}
                    >
                      <FileText className="h-3 w-3" />
                      Print
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-bill-${bill.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete receipt?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove {bill.billNumber} from the records.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Back</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(bill.id)}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
