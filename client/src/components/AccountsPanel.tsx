import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import type { PatientBill } from "@shared/schema";
import {
  Loader2, IndianRupee, Download, Clock, CheckCircle2, ChevronDown, Trash2, Users, AlertCircle,
  ChevronLeft, ChevronRight, Search, SlidersHorizontal, Calendar as CalendarIcon, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { printBillFromRecord, type ClinicInfo } from "@/lib/clinic-pdf";

type LedgerGroup = {
  key: string; patientId: number | null; patientCode: string | null;
  name: string; email: string; phone: string;
  bills: (PatientBill & { patientCode?: string | null })[];
  totalBilled: number; totalCollected: number; outstanding: number;
  oldestUnpaidDays: number; hasOverdue: boolean;
};

type AccountsStats = {
  totalRevenue: number; pendingAmt: number; paidCount: number;
  overdueCount: number; overdueAmt: number;
};

type AccountsResponse = {
  data: (PatientBill & { patientCode?: string | null })[] | LedgerGroup[];
  total: number; page: number; totalPages: number;
  stats: AccountsStats;
};

interface AccountsPanelProps {
  clinic: any;
  onViewPatient: (patientId: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const OVERDUE_DAYS = 3;
const EMPTY_STATS: AccountsStats = { totalRevenue: 0, pendingAmt: 0, paidCount: 0, overdueCount: 0, overdueAmt: 0 };
const EMPTY_RESPONSE: AccountsResponse = { data: [], total: 0, page: 1, totalPages: 1, stats: EMPTY_STATS };

export default function AccountsPanel({ clinic, onViewPatient }: AccountsPanelProps) {
  const [accountsView, setAccountsView] = useState<'ledger' | 'register'>('ledger');
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'partial' | 'overdue'>('all');
  const [sort, setSort] = useState<string>('date');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [billDeleteConfirm, setBillDeleteConfirm] = useState<number | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, sort, dateFrom, dateTo, pageSize, accountsView]);

  const buildParams = useCallback((overrides: { exportAll?: boolean } = {}) => {
    const p = new URLSearchParams({
      view: accountsView,
      page: String(page),
      pageSize: String(pageSize),
      sort,
      status: statusFilter,
    });
    if (debouncedSearch) p.set('q', debouncedSearch);
    if (dateFrom) p.set('dateFrom', dateFrom.toISOString());
    if (dateTo) p.set('dateTo', dateTo.toISOString());
    if (overrides.exportAll) p.set('exportAll', 'true');
    return p.toString();
  }, [accountsView, page, pageSize, sort, statusFilter, debouncedSearch, dateFrom, dateTo]);

  const { data: response = EMPTY_RESPONSE, isLoading } = useQuery<AccountsResponse>({
    queryKey: ['/api/auth/clinic/bills/paged', accountsView, debouncedSearch, statusFilter, sort, page, pageSize, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/auth/clinic/bills/paged?${buildParams()}`);
      if (!res.ok) throw new Error('Failed to load accounts');
      return res.json();
    },
    enabled: true,
  });

  const updateBillStatusMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: number; paymentStatus: string }) =>
      apiRequest('PATCH', `/api/auth/clinic/bills/${id}`, { paymentStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bills/paged'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bills'] });
      notify.success("Status updated", { description: "Bill payment status has been saved." });
    },
    onError: () => notify.error("Failed to update bill status"),
  });

  const deleteBillMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/auth/clinic/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bills/paged'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bills'] });
      notify.success("Receipt deleted", { description: "The bill record has been removed." });
    },
    onError: () => notify.error("Failed to delete bill"),
  });

  const nowMs = Date.now();
  const isOverdue = (bill: PatientBill) =>
    (bill.paymentStatus === 'pending' || bill.paymentStatus === 'partial') &&
    !!bill.createdAt && (nowMs - new Date(bill.createdAt).getTime()) > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
  const daysSince = (bill: PatientBill) =>
    Math.floor((nowMs - new Date(bill.createdAt!).getTime()) / (24 * 60 * 60 * 1000));

  const stats = response.stats;
  const total = response.total;
  const totalPages = response.totalPages;
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);

  const agingLabel = (days: number) => {
    if (days === 0) return null;
    if (days <= 30) return { label: `${days}d`, cls: 'bg-amber-100 text-amber-700 border-amber-300/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40' };
    if (days <= 60) return { label: `${days}d`, cls: 'bg-orange-100 text-orange-700 border-orange-300/60 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40' };
    return { label: `${days}d`, cls: 'bg-red-100 text-red-700 border-red-300/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40' };
  };

  const exportAccountsCSV = async () => {
    const res = await apiRequest('GET', `/api/auth/clinic/bills/paged?${buildParams({ exportAll: true })}`);
    if (!res.ok) { notify.error("Export failed"); return; }
    const result: AccountsResponse = await res.json();
    const rows = accountsView === 'register'
      ? result.data as PatientBill[]
      : (result.data as LedgerGroup[]).flatMap(g => g.bills);
    const escape = (val: string | null | undefined) => `"${(val ?? "").replace(/"/g, '""')}"`;
    const headers = ["Receipt #","Patient Name","Phone","Email","Date","Services","Subtotal (INR)","Discount %","Tax %","Total (INR)","Payment Method","Status","Notes"];
    const bodyRows = rows.map(b => {
      const svcs = ((b.services ?? []) as { description: string; amount: number }[])
        .map(s => `${s.description} (${s.amount.toFixed(2)})`).join("; ");
      return [
        escape(b.billNumber), escape(b.patientName), escape(b.patientPhone), escape(b.patientEmail),
        escape(b.createdAt ? format(new Date(b.createdAt), "dd MMM yyyy") : ""),
        escape(svcs),
        String((b.subtotal ?? 0).toFixed(2)), String(b.discountPct ?? 0), String(b.taxPct ?? 0),
        String((b.total ?? 0).toFixed(2)), escape(b.paymentMethod), escape(b.paymentStatus), escape(b.notes),
      ].join(",");
    });
    const csv = [headers.join(","), ...bodyRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `billing_history_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    notify.success("CSV exported", { description: `${rows.length} record${rows.length !== 1 ? "s" : ""} downloaded.` });
  };

  const hasDateFilter = !!(dateFrom || dateTo);
  const clearDates = () => { setDateFrom(undefined); setDateTo(undefined); setPage(1); };

  // Sort options per view
  const registerSorts = [
    { value: 'date', label: 'Date (newest)' },
    { value: 'amount', label: 'Amount (highest)' },
    { value: 'patient', label: 'Patient name' },
  ];
  const ledgerSorts = [
    { value: 'outstanding', label: 'Outstanding (highest)' },
    { value: 'billed', label: 'Total billed (highest)' },
    { value: 'patient', label: 'Patient name' },
    { value: 'oldest', label: 'Oldest unpaid first' },
  ];
  const sortOptions = accountsView === 'ledger' ? ledgerSorts : registerSorts;

  return (
    <div className="space-y-5">

      {/* ── Panel header ── */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="flex">
          <div className="w-1.5 bg-primary/60 shrink-0" />
          <div className="flex-1 px-5 py-4 bg-gradient-to-r from-primary/[0.06] to-transparent flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <IndianRupee className="h-[18px] w-[18px] text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Accounts</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Billing &amp; payment records</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5 gap-0.5">
                {(['ledger', 'register'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setAccountsView(v)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                      accountsView === v
                        ? 'bg-primary text-primary-foreground border border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid={`accounts-view-${v}`}
                  >
                    {v === 'ledger' ? 'Patient Ledger' : 'Transaction Register'}
                  </button>
                ))}
              </div>
              <button
                onClick={exportAccountsCSV}
                disabled={isLoading || total === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/60 bg-background text-sm font-semibold text-foreground hover:bg-muted/50 hover:border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="Export as CSV"
                data-testid="button-export-csv"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Receipts Paid',  value: isLoading ? null : stats.paidCount,                                    icon: CheckCircle2, color: 'emerald', subtitle: isLoading ? null : 'from paid bills' },
          { label: 'Revenue',        value: isLoading ? null : `₹${stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: IndianRupee,   color: 'primary', subtitle: isLoading ? null : 'total collected' },
          { label: 'Outstanding',    value: isLoading ? null : `₹${stats.pendingAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,   icon: Clock,         color: 'amber',   subtitle: isLoading ? null : 'pending + partial' },
          { label: 'Overdue',        value: isLoading ? null : (stats.overdueCount > 0 ? `₹${stats.overdueAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'), icon: AlertCircle,   color: 'red',     subtitle: isLoading ? null : (stats.overdueCount > 0 ? `${stats.overdueCount} bill${stats.overdueCount !== 1 ? 's' : ''} · 3+ days` : 'no overdue bills') },
        ].map(({ label, value, icon: Icon, color, subtitle }) => {
          const bgCls = color === 'emerald' ? 'bg-emerald-500/10' : color === 'primary' ? 'bg-primary/10' : color === 'amber' ? 'bg-amber-500/10' : 'bg-red-500/10';
          const textCls = color === 'emerald' ? 'text-emerald-600' : color === 'primary' ? 'text-primary' : color === 'amber' ? 'text-amber-600' : 'text-red-600';
          const isOverdueCard = label === 'Overdue';
          const CardWrapper = isOverdueCard ? 'button' : 'div';
          const overdueClick = isOverdueCard ? () => { setAccountsView('register'); setStatusFilter('overdue'); } : undefined;
          const overdueCls = isOverdueCard && stats.overdueCount > 0
            ? 'border-red-300/60 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40 hover:bg-red-100/60 dark:hover:bg-red-950/30 text-left'
            : isOverdueCard ? 'border-border/50 bg-card text-left' : 'border-border/50 bg-card';
          return (
            <CardWrapper
              key={label}
              {...(isOverdueCard ? { onClick: overdueClick, 'data-testid': 'stat-overdue' } : {})}
              className={`rounded-xl border p-3 sm:p-4 ${overdueCls} transition-all ${isOverdueCard ? 'cursor-pointer' : ''}`}
            >
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ) : (
                <>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${bgCls}`}>
                    <Icon className={`h-4 w-4 ${textCls}`} />
                  </div>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                </>
              )}
            </CardWrapper>
          );
        })}
      </div>

      {/* ── Overdue banner ── */}
      {!isLoading && stats.overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-300/60 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40" data-testid="banner-overdue">
          <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-950/50 border border-red-300/60 dark:border-red-800/40 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {stats.overdueCount} bill{stats.overdueCount !== 1 ? 's are' : ' is'} overdue (3+ days unpaid)
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              Total outstanding: ₹{stats.overdueAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })} — consider sending a payment reminder
            </p>
          </div>
          <button
            onClick={() => { setAccountsView('register'); setStatusFilter('overdue'); }}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-950/50 border border-red-300/60 dark:border-red-800/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-950 transition-colors"
            data-testid="button-view-overdue"
          >
            View overdue
          </button>
        </div>
      )}

      {/* ── Search + Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={accountsView === 'ledger'
              ? "Search by patient name, email or phone…"
              : "Search by patient name, email, phone or receipt #…"}
            className="pl-8 pr-8 h-9 text-sm"
            data-testid="input-accounts-search"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              data-testid="button-clear-accounts-search"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              className={`h-9 px-3 rounded-lg border text-sm font-semibold flex items-center gap-2 transition-all ${
                filterOpen || hasDateFilter || sort !== (accountsView === 'ledger' ? 'outstanding' : 'date')
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
              }`}
              data-testid="button-accounts-filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasDateFilter && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4 space-y-4" align="end">
            {/* Date range */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date range</p>
              <div className="flex gap-2">
                <Popover open={fromPickerOpen} onOpenChange={setFromPickerOpen}>
                  <PopoverTrigger asChild>
                    <button className={`flex-1 h-8 px-2 rounded-md border text-xs font-medium flex items-center gap-1.5 ${dateFrom ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background border-border/60 text-muted-foreground'}`}>
                      <CalendarIcon className="h-3 w-3" />
                      {dateFrom ? format(dateFrom, 'dd MMM') : 'From'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={d => { setDateFrom(d); setFromPickerOpen(false); setPage(1); }} initialFocus />
                  </PopoverContent>
                </Popover>
                <Popover open={toPickerOpen} onOpenChange={setToPickerOpen}>
                  <PopoverTrigger asChild>
                    <button className={`flex-1 h-8 px-2 rounded-md border text-xs font-medium flex items-center gap-1.5 ${dateTo ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background border-border/60 text-muted-foreground'}`}>
                      <CalendarIcon className="h-3 w-3" />
                      {dateTo ? format(dateTo, 'dd MMM') : 'To'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={d => { setDateTo(d); setToPickerOpen(false); setPage(1); }} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              {hasDateFilter && (
                <button onClick={clearDates} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                  <X className="h-3 w-3" /> Clear dates
                </button>
              )}
            </div>
            {/* Sort */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sort by</p>
              <div className="flex flex-wrap gap-1.5">
                {sortOptions.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setSort(o.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                      sort === o.value
                        ? 'bg-primary text-primary-foreground border-primary'
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

      {/* ── Status filter pills (Register only) ── */}
      {accountsView === 'register' && (
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'paid', 'pending', 'partial', 'overdue'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                s === 'overdue'
                  ? statusFilter === 'overdue'
                    ? 'bg-red-600 text-white border-red-600'
                    : stats.overdueCount > 0
                    ? 'bg-red-50 border-red-300/60 text-red-700 dark:bg-red-950/20 dark:border-red-800/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/30'
                    : 'bg-background border-border/60 text-muted-foreground'
                  : statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
              data-testid={`filter-accounts-${s}`}
            >
              {s === 'overdue' ? `Overdue${stats.overdueCount > 0 ? ` (${stats.overdueCount})` : ''}` : s}
            </button>
          ))}
        </div>
      )}

      {/* ── Status filter pills (Ledger only) ── */}
      {accountsView === 'ledger' && (
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'paid', 'pending', 'overdue'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                s === 'overdue'
                  ? statusFilter === 'overdue'
                    ? 'bg-red-600 text-white border-red-600'
                    : stats.overdueCount > 0
                    ? 'bg-red-50 border-red-300/60 text-red-700 dark:bg-red-950/20 dark:border-red-800/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/30'
                    : 'bg-background border-border/60 text-muted-foreground'
                  : statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
              data-testid={`filter-ledger-${s}`}
            >
              {s === 'overdue' ? `Overdue${stats.overdueCount > 0 ? ` (${stats.overdueCount})` : ''}` : s}
            </button>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          PATIENT LEDGER VIEW
          ════════════════════════════════════════════════════ */}
      {accountsView === 'ledger' && (
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))
          ) : (response.data as LedgerGroup[]).length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
              <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
                <IndianRupee className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">
                {total === 0 ? "No bills yet" : "No patients match your search"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {total === 0
                  ? "Open any booking and add a charge to get started"
                  : "Try a different name, email or phone"}
              </p>
            </div>
          ) : (response.data as LedgerGroup[]).map(group => {
            const isExpanded = expandedPatients.has(group.key);
            const aging = agingLabel(group.oldestUnpaidDays);
            const sortedBills = [...group.bills].sort(
              (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
            );
            return (
              <div
                key={group.key}
                className={`rounded-xl border overflow-hidden transition-colors ${
                  group.hasOverdue ? 'border-red-300/50 dark:border-red-800/40' : 'border-border/60'
                }`}
                data-testid={`ledger-patient-${group.key}`}
              >
                {/* Patient header row */}
                <button
                  className={`relative w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${
                    group.hasOverdue ? 'bg-red-50/40 dark:bg-red-950/10' : 'bg-card'
                  }`}
                  onClick={() => setExpandedPatients(prev => {
                    const next = new Set(prev);
                    if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                    return next;
                  })}
                  data-testid={`ledger-expand-${group.key}`}
                >
                  {group.hasOverdue && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500/70 rounded-r" />
                  )}
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    group.outstanding > 0
                      ? group.hasOverdue
                        ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                        : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {group.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">{group.name}</p>
                      {group.patientCode && (
                        <span className="font-mono text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 px-2 py-0.5 rounded-md shrink-0">
                          {group.patientCode}
                        </span>
                      )}
                      {aging && (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${aging.cls}`}>
                          <Clock className="h-3 w-3" />{aging.label} overdue
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {group.email && <span className="text-xs text-muted-foreground truncate">{group.email}</span>}
                      {group.email && group.phone && <span className="text-xs text-muted-foreground/40">·</span>}
                      {group.phone && <span className="text-xs text-muted-foreground">{group.phone}</span>}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 shrink-0 text-right">
                    <div><p className="text-xs text-muted-foreground">Billed</p><p className="text-xs font-bold text-foreground">₹{group.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
                    <div><p className="text-xs text-muted-foreground">Collected</p><p className="text-xs font-bold text-emerald-600">₹{group.totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
                    <div><p className="text-xs text-muted-foreground">Balance</p><p className={`text-xs font-bold ${group.outstanding > 0 ? (group.hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600') : 'text-muted-foreground'}`}>{group.outstanding > 0 ? `₹${group.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Visits</p><p className="text-xs font-bold text-foreground">{group.bills.length}</p></div>
                  </div>
                  <div className="sm:hidden flex flex-col items-end shrink-0">
                    <p className={`text-sm font-bold ${group.outstanding > 0 ? (group.hasOverdue ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600'}`}>
                      {group.outstanding > 0 ? `₹${group.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })} due` : '✓ Settled'}
                    </p>
                    <p className="text-xs text-muted-foreground">{group.bills.length} visit{group.bills.length !== 1 ? 's' : ''}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded bill rows */}
                {isExpanded && (
                  <div className="border-t border-border/40 bg-muted/5 divide-y divide-border/30">
                    <div className="hidden sm:grid grid-cols-[1fr_110px_90px_1fr] gap-3 px-4 py-1.5 bg-muted/30">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receipt #</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Status / Actions</span>
                    </div>
                    {sortedBills.map(bill => {
                      const od = isOverdue(bill);
                      const isUpd = updateBillStatusMutation.isPending && updateBillStatusMutation.variables?.id === bill.id;
                      const sc: Record<string, string> = { pending: 'paid', partial: 'paid', paid: 'pending' };
                      const nxt = sc[bill.paymentStatus ?? 'pending'] ?? 'paid';
                      const svcs = (bill.services ?? []) as { description: string; amount: number }[];
                      return (
                        <div
                          key={bill.id}
                          className={`grid grid-cols-1 sm:grid-cols-[1fr_110px_90px_1fr] gap-2 sm:gap-3 px-4 py-2.5 items-center group transition-colors hover:bg-muted/20 ${od ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}
                          data-testid={`ledger-bill-${bill.id}`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-mono font-semibold text-foreground truncate">{bill.billNumber}</p>
                            {svcs.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {svcs.slice(0, 2).map(s => s.description).join(', ')}{svcs.length > 2 ? ` +${svcs.length - 2} more` : ''}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : "—"}</p>
                          <p className={`text-xs font-bold text-right ${od ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                          <div className="flex items-center justify-end gap-1.5">
                            {bill.paymentStatus === 'paid' && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0"><CheckCircle2 className="h-3 w-3" /> Paid</span>
                            )}
                            {bill.paymentStatus === 'pending' && (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${od ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-800/40' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}><Clock className="h-3 w-3" /> Pending</span>
                            )}
                            {bill.paymentStatus === 'partial' && (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${od ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-800/40' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'}`}>Partial</span>
                            )}
                            <button
                              className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border transition-colors active:scale-[0.97] ${nxt === 'paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-400' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'}`}
                              onClick={() => updateBillStatusMutation.mutate({ id: bill.id, paymentStatus: nxt })}
                              disabled={isUpd}
                              data-testid={`ledger-status-toggle-${bill.id}`}
                            >
                              {isUpd ? <Loader2 className="h-3 w-3 animate-spin" /> : nxt === 'paid' ? <><CheckCircle2 className="h-3 w-3" /> Mark Paid</> : <><Clock className="h-3 w-3" /> Unpaid</>}
                            </button>
                            <button
                              className="p-2 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors active:scale-[0.97]"
                              onClick={() => printBillFromRecord(bill, clinic as ClinicInfo, [])}
                              title="Download PDF"
                              data-testid={`ledger-print-${bill.id}`}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="px-4 py-2 bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">{group.bills.length} visit{group.bills.length !== 1 ? 's' : ''} total</p>
                        {group.patientId && (
                          <button
                            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            onClick={() => onViewPatient(group.patientId!)}
                            data-testid={`ledger-view-profile-${group.patientId}`}
                          >
                            View Profile →
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground">Billed <span className="font-bold text-foreground">₹{group.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                        <span className="text-xs text-muted-foreground">Collected <span className="font-bold text-emerald-600">₹{group.totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                        {group.outstanding > 0 && (
                          <span className="text-xs text-muted-foreground">Balance <span className={`font-bold ${group.hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600'}`}>₹{group.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          TRANSACTION REGISTER VIEW
          ════════════════════════════════════════════════════ */}
      {accountsView === 'register' && (
        <div className="space-y-4">
          {/* Flat bill list */}
          {isLoading ? (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="divide-y divide-border/40">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          ) : (response.data as PatientBill[]).length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
              <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
                <IndianRupee className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">
                {total === 0 ? "No receipts yet" : "No results match your filter"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {total === 0 ? "Generate your first receipt from any booking" : "Try adjusting the search or status filter"}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_130px_100px_90px_1fr] gap-4 px-4 py-2 bg-muted/40 border-b border-border/50">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Patient</span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receipt #</span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Status</span>
              </div>
              <div className="divide-y divide-border/40">
                {(response.data as PatientBill[]).map(bill => {
                  const isUpdating = updateBillStatusMutation.isPending && updateBillStatusMutation.variables?.id === bill.id;
                  const sc: Record<string, string> = { pending: 'paid', partial: 'paid', paid: 'pending' };
                  const nextStatus = sc[bill.paymentStatus ?? 'pending'] ?? 'paid';
                  const overdue = isOverdue(bill);
                  const daysAgo = overdue ? daysSince(bill) : 0;
                  return (
                    <div
                      key={bill.id}
                      className={`relative grid grid-cols-1 sm:grid-cols-[1fr_130px_100px_90px_1fr] gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/20 transition-colors items-center group ${overdue ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}
                      data-testid={`accounts-row-${bill.id}`}
                    >
                      {overdue && <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r bg-red-500/70" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{bill.patientName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {bill.patientEmail && <p className="text-xs text-muted-foreground truncate">{bill.patientEmail}</p>}
                          {bill.patientEmail && bill.patientPhone && <span className="text-xs text-muted-foreground/40">·</span>}
                          {bill.patientPhone && <p className="text-xs text-muted-foreground">{bill.patientPhone}</p>}
                          {overdue && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300/60 dark:border-red-800/40 shrink-0" data-testid={`accounts-overdue-badge-${bill.id}`}>
                              <Clock className="h-3 w-3" />{daysAgo}d overdue
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate">{bill.billNumber}</p>
                      <p className="text-xs text-muted-foreground">{bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : "—"}</p>
                      <p className={`text-sm font-bold text-right ${overdue ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>
                        ₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                      <div className="flex items-center justify-end gap-1.5">
                        {bill.paymentStatus === 'paid' && <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0"><CheckCircle2 className="h-3 w-3" /> Paid</span>}
                        {bill.paymentStatus === 'pending' && <span className={`inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${overdue ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300/60 dark:border-red-800/40' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}><Clock className="h-3 w-3" /> Pending</span>}
                        {bill.paymentStatus === 'partial' && <span className={`inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${overdue ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300/60 dark:border-red-800/40' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>Partial</span>}
                        <button
                          className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${nextStatus === 'paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-400' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'}`}
                          onClick={() => updateBillStatusMutation.mutate({ id: bill.id, paymentStatus: nextStatus })}
                          disabled={isUpdating}
                          data-testid={`accounts-status-toggle-${bill.id}`}
                        >
                          {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : nextStatus === 'paid' ? <><CheckCircle2 className="h-3 w-3" /> Mark Paid</> : <><Clock className="h-3 w-3" /> Unpaid</>}
                        </button>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground" onClick={() => printBillFromRecord(bill, clinic as ClinicInfo, [])} title="Download PDF" data-testid={`accounts-print-${bill.id}`}>
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {billDeleteConfirm === bill.id ? (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button className="text-xs font-bold px-2 py-1 rounded-lg bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-700 dark:text-red-400" onClick={() => { deleteBillMutation.mutate(bill.id); setBillDeleteConfirm(null); }} disabled={deleteBillMutation.isPending} data-testid={`accounts-delete-confirm-${bill.id}`}>
                              {deleteBillMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Yes, delete"}
                            </button>
                            <button className="text-xs font-bold px-2 py-1 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground" onClick={() => setBillDeleteConfirm(null)} data-testid={`accounts-delete-cancel-${bill.id}`}>Cancel</button>
                          </div>
                        ) : (
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 dark:hover:text-red-400" onClick={() => setBillDeleteConfirm(bill.id)} title="Delete" data-testid={`accounts-delete-${bill.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Register totals row */}
              <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-muted-foreground">{total} record{total !== 1 ? 's' : ''} total</p>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">Total <span className="font-bold text-foreground">₹{(response.data as PatientBill[]).reduce((s, b) => s + (b.total ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                  <span className="text-xs text-muted-foreground">Collected <span className="font-bold text-emerald-600">₹{(response.data as PatientBill[]).filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.total ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                  <span className="text-xs text-muted-foreground">Outstanding <span className="font-bold text-amber-600">₹{(response.data as PatientBill[]).filter(b => b.paymentStatus !== 'paid').reduce((s, b) => s + (b.total ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Table footer: rows per page + count + pagination ── */}
      {!isLoading && total > 0 && (
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
          {/* Left: rows-per-page selector + count */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Rows per page:</span>
              <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-background p-0.5">
                {PAGE_SIZE_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => { setPageSize(n); setPage(1); }}
                    data-testid={`button-pagesize-${n}`}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${pageSize === n ? 'bg-rose-500/10 text-rose-600' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {total === 0 ? 'No bills' : `Showing ${pageStart}–${pageEnd} of ${total} bill${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          {/* Right: prev / page indicator / next */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1}
              data-testid="button-accounts-prev-page"
              className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[72px] text-center">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              data-testid="button-accounts-next-page"
              className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
