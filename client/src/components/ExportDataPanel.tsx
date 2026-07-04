import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { format, formatDistanceToNow, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  Download, FileSpreadsheet, FileText, FileBadge, Lock, Bell, X,
  Users, CalendarDays, History, RefreshCw, CheckCircle2, Clock,
  Sparkles, IndianRupee, Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Clinic, ExportHistory, PatientBill } from "@shared/schema";
import type { BookingWithSlot } from "@/lib/clinic-constants";

type ExportFormat = "xlsx" | "csv";
type DatePreset   = "all" | "this-month" | "last-month" | "custom";

interface ScopeOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  { id: "patients",     label: "Patient Profiles",  description: "Code, name, phone, age, gender, visit history",  icon: Users,         available: true  },
  { id: "appointments", label: "Appointments",       description: "Date, time, doctor, status, clinical outcome",   icon: CalendarDays,  available: true  },
  { id: "billing",      label: "Billing History",    description: "Invoices, amounts, payment method, status",      icon: IndianRupee,   available: true  },
  { id: "treatment",    label: "Treatment Notes",    description: "Diagnosis, procedures, prescriptions",           icon: FileText,      available: false },
];

const FORMAT_OPTIONS = [
  { id: "xlsx" as ExportFormat, label: "Excel", ext: ".xlsx", desc: "Best for filtering & analysis", icon: FileSpreadsheet, recommended: true  },
  { id: "csv"  as ExportFormat, label: "CSV",   ext: ".csv",  desc: "Import into other systems",     icon: FileBadge,       recommended: false },
];

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all",        label: "All time"   },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "custom",     label: "Custom…"    },
];

interface ExportDataPanelProps {
  clinic: Clinic | null | undefined;
}

function getReminderState(): { show: boolean } {
  try {
    const val = localStorage.getItem("exportReminderDismissedUntil");
    if (!val) return { show: true };
    if (val === "forever") return { show: false };
    const until = new Date(val);
    return { show: new Date() > until };
  } catch {
    return { show: true };
  }
}

function setReminderDismissed(duration: "forever" | "1d" | "3d" | "7d") {
  try {
    if (duration === "forever") {
      localStorage.setItem("exportReminderDismissedUntil", "forever");
      return;
    }
    const days = duration === "1d" ? 1 : duration === "3d" ? 3 : 7;
    const until = new Date();
    until.setDate(until.getDate() + days);
    localStorage.setItem("exportReminderDismissedUntil", until.toISOString());
  } catch {}
}

function getUniquePatients(bookings: BookingWithSlot[]) {
  const seen = new Set<string>();
  const unique: BookingWithSlot[] = [];
  for (const b of bookings) {
    const key = String((b as any).patientId ?? b.customerEmail ?? b.customerPhone);
    if (!seen.has(key)) { seen.add(key); unique.push(b); }
  }
  return unique;
}

function buildFileName(clinicName: string, scope: string[], fmt: ExportFormat) {
  const slug    = clinicName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const scopeTag = scope.includes("patients") && scope.includes("appointments") && scope.includes("billing") ? "full"
    : scope.length === 1 ? scope[0]
    : scope.join("-");
  return `${slug}_${scopeTag}_${dateStr}.${fmt}`;
}

function downloadBlob(content: string | ArrayBuffer, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function generateCSV(rows: (string | number | null | undefined)[][], headers: string[]): string {
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
}

const apptStatusLabel  = (s: string) =>
  s === "confirmed" ? "Confirmed" : s === "cancelled" ? "Cancelled" : "Pending";
const visitStatusLabel = (s: string | null | undefined) =>
  !s ? "" : s === "checked_in" ? "Arrived" : s === "in_consultation" ? "With Doctor" : s === "completed" ? "Visit Done" : s;
const clinicalLabel    = (s: string | null | undefined) =>
  !s ? "" : s === "first_visit" ? "First Visit" : s === "revisit" ? "Revisit" :
  s === "follow_up_required" ? "Follow-up Required" : s === "case_closed" ? "Case Closed" : s;

export default function ExportDataPanel({ clinic }: ExportDataPanelProps) {
  const qc = useQueryClient();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("xlsx");
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(["patients", "appointments"]));
  const [datePreset, setDatePreset]         = useState<DatePreset>("all");
  const [customFrom, setCustomFrom]         = useState("");
  const [customTo, setCustomTo]             = useState("");
  const [exporting, setExporting]           = useState(false);
  const [progress, setProgress]             = useState(0);
  const [progressLabel, setProgressLabel]   = useState("");
  const [reminderVisible, setReminderVisible] = useState(() => getReminderState().show);
  const [snoozeOpen, setSnoozeOpen]           = useState(false);

  // Fetch all bookings using the legacy flat endpoint (no ?page param) for export purposes
  const { data: bookings } = useQuery<BookingWithSlot[]>({
    queryKey: ["/api/auth/clinic/bookings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/clinic/bookings");
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return res.json();
    },
    enabled: selectedScopes.has("patients") || selectedScopes.has("appointments"),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<ExportHistory[]>({
    queryKey: ["/api/auth/clinic/export-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/clinic/export-history");
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  const { data: bills = [], isLoading: billsLoading } = useQuery<PatientBill[]>({
    queryKey: ["/api/auth/clinic/bills"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/clinic/bills");
      if (!res.ok) throw new Error("Failed to fetch bills");
      return res.json();
    },
    enabled: selectedScopes.has("billing"),
  });

  const logExportMutation = useMutation({
    mutationFn: (data: { fileName: string; format: string; scope: string[]; recordCount: number }) =>
      apiRequest("POST", "/api/auth/clinic/export-log", data).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/clinic/export-history"] }),
  });

  // Computed date range from preset
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    if (datePreset === "this-month") {
      return {
        dateFrom: format(startOfMonth(now), "yyyy-MM-dd"),
        dateTo:   format(endOfMonth(now),   "yyyy-MM-dd"),
      };
    }
    if (datePreset === "last-month") {
      const prev = subMonths(now, 1);
      return {
        dateFrom: format(startOfMonth(prev), "yyyy-MM-dd"),
        dateTo:   format(endOfMonth(prev),   "yyyy-MM-dd"),
      };
    }
    if (datePreset === "custom") {
      return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [datePreset, customFrom, customTo]);

  // Filtered booking/patient/bill sets
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    if (!dateFrom && !dateTo) return bookings;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo + "T23:59:59") : null;
    return bookings.filter(b => {
      const d = new Date(b.slot.startTime);
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  }, [bookings, dateFrom, dateTo]);

  const uniquePatients   = useMemo(() => getUniquePatients(filteredBookings), [filteredBookings]);

  const filteredBills = useMemo(() => {
    if (!bills.length) return [];
    if (!dateFrom && !dateTo) return bills;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo + "T23:59:59") : null;
    return bills.filter(b => {
      const d = new Date(b.createdAt!);
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  }, [bills, dateFrom, dateTo]);

  // Patient visit stats (for CSV patient profiles)
  const patientStats = useMemo(() => {
    const stats = new Map<string, { firstVisit: Date; lastVisit: Date; totalVisits: number }>();
    for (const b of filteredBookings) {
      const key = String((b as any).patientId ?? b.customerEmail ?? b.customerPhone);
      const d   = new Date(b.slot.startTime);
      const ex  = stats.get(key);
      if (!ex) {
        stats.set(key, { firstVisit: d, lastVisit: d, totalVisits: 1 });
      } else {
        if (d < ex.firstVisit) ex.firstVisit = d;
        if (d > ex.lastVisit)  ex.lastVisit  = d;
        ex.totalVisits++;
      }
    }
    return stats;
  }, [filteredBookings]);

  const lastExport  = history[0];
  const totalExports = history.length;

  const scopeRecordCount = useMemo(() => {
    let count = 0;
    if (selectedScopes.has("patients"))     count += uniquePatients.length;
    if (selectedScopes.has("appointments")) count += filteredBookings.length;
    if (selectedScopes.has("billing"))      count += filteredBills.length;
    return count;
  }, [selectedScopes, uniquePatients.length, filteredBookings.length, filteredBills.length]);

  function toggleScope(id: string) {
    setSelectedScopes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function dismissReminder(snooze?: "1d" | "3d" | "7d") {
    setReminderDismissed(snooze ?? "forever");
    setReminderVisible(false);
    setSnoozeOpen(false);
    if (snooze) {
      const label = snooze === "1d" ? "1 day" : snooze === "3d" ? "3 days" : "1 week";
      notify.info(`Reminder snoozed for ${label}`);
    }
  }

  async function runExport(overrideScope?: string[], overrideFormat?: ExportFormat) {
    if (!clinic || !bookings) return;
    const scope = overrideScope ?? [...selectedScopes];
    const fmt   = overrideFormat ?? selectedFormat;
    if (scope.length === 0) return;

    const fileName = buildFileName(clinic.name, scope, fmt);
    setExporting(true); setProgress(0);

    const steps: [number, string][] = [
      [20, "Gathering patient records…"],
      [45, "Processing appointments…"],
      [70, "Compiling selected data…"],
      [88, "Formatting file…"],
      [100, "Finalising…"],
    ];
    for (const [pct, label] of steps) {
      setProgress(pct); setProgressLabel(label);
      await new Promise(r => setTimeout(r, 300));
    }

    try {
      const fmtCsvDate = (d: Date) => format(d, "dd MMM yyyy");

      // ── Patient data for CSV ──
      const patientHeaders = ["Patient Code", "Patient Name", "Phone", "Email", "Age", "Gender", "First Visit", "Last Visit", "Total Visits"];
      const patientRows = uniquePatients.map(b => {
        const key   = String((b as any).patientId ?? b.customerEmail ?? b.customerPhone);
        const stats = patientStats.get(key);
        return [
          (b as any).patientCode ?? "",
          b.customerName,
          b.customerPhone,
          b.customerEmail ?? "",
          (b as any).customerAge ?? "",
          (b as any).customerGender
            ? ((b as any).customerGender.charAt(0).toUpperCase() + (b as any).customerGender.slice(1))
            : "",
          stats ? fmtCsvDate(stats.firstVisit) : "",
          stats ? fmtCsvDate(stats.lastVisit)  : "",
          stats?.totalVisits ?? 1,
        ];
      });

      // ── Appointment data for CSV ──
      const apptHeaders = [
        "Booking ID", "Patient Code", "Patient Name", "Phone", "Age", "Gender",
        "Date", "Day", "Time", "Duration (min)", "Doctor",
        "Appt Status", "Visit Status", "Clinical Status",
        "Chief Complaint", "Payment Status", "Amount (₹)",
      ];
      const apptRows = filteredBookings.map(b => {
        const start  = new Date(b.slot.startTime);
        const end    = new Date(b.slot.endTime);
        const durMin = Math.round((end.getTime() - start.getTime()) / 60000);
        return [
          b.id,
          (b as any).patientCode ?? "",
          b.customerName,
          b.customerPhone,
          (b as any).customerAge ?? "",
          (b as any).customerGender
            ? ((b as any).customerGender.charAt(0).toUpperCase() + (b as any).customerGender.slice(1))
            : "",
          fmtCsvDate(start),
          format(start, "EEEE"),
          format(start, "hh:mm a"),
          durMin,
          (b as any).assignedDoctor ?? "Unassigned",
          apptStatusLabel(b.verificationStatus),
          visitStatusLabel((b as any).visitStatus),
          clinicalLabel((b as any).clinicalStatus),
          b.description ?? "",
          (b as any).paymentStatus ?? "",
          (b as any).paymentAmount ? String((b as any).paymentAmount / 100) : "",
        ];
      });

      // ── Billing data for CSV ──
      const billHeaders = [
        "Bill #", "Date", "Patient Name", "Patient Code", "Patient Phone",
        "Doctor", "Services", "Subtotal (₹)", "Discount %", "Tax %",
        "Total (₹)", "Payment Method", "Status",
      ];
      const billRows = filteredBills.map(b => {
        const matchedBooking = filteredBookings.find(bk => bk.id === b.bookingId);
        const patientCode    = (matchedBooking as any)?.patientCode ?? "";
        const doctor         = (matchedBooking as any)?.assignedDoctor ?? "";
        const services       = ((b.services ?? []) as any[]).map((s: any) => s.description).filter(Boolean).join(", ");
        const statusLabel    = b.paymentStatus === "paid" ? "Paid" : b.paymentStatus === "partial" ? "Partial" : "Pending";
        return [
          b.billNumber,
          b.createdAt ? fmtCsvDate(new Date(b.createdAt)) : "",
          b.patientName,
          patientCode,
          b.patientPhone ?? "",
          doctor,
          services,
          b.subtotal    ?? 0,
          b.discountPct ?? 0,
          b.taxPct      ?? 0,
          b.total       ?? 0,
          b.paymentMethod ?? "Cash",
          statusLabel,
        ];
      });

      // ── FORMAT: CSV ──
      if (fmt === "csv") {
        let csvContent = "";
        if (scope.includes("patients"))     csvContent += "PATIENT PROFILES\n"  + generateCSV(patientRows, patientHeaders) + "\n\n";
        if (scope.includes("appointments")) csvContent += "APPOINTMENTS\n"       + generateCSV(apptRows,    apptHeaders)    + "\n\n";
        if (scope.includes("billing"))      csvContent += "BILLING HISTORY\n"    + generateCSV(billRows,    billHeaders);
        downloadBlob(csvContent, "text/csv;charset=utf-8;", fileName);

      // ── FORMAT: XLSX (server-side) ──
      } else if (fmt === "xlsx") {
        const xlsxRes = await apiRequest("POST", "/api/auth/clinic/export/xlsx", { scope, dateFrom, dateTo });
        if (!xlsxRes.ok) {
          const err = await xlsxRes.json().catch(() => ({ message: "Export failed" }));
          throw new Error(err.message ?? "Export failed");
        }
        const buffer = await xlsxRes.arrayBuffer();
        downloadBlob(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);

      }

      await logExportMutation.mutateAsync({
        fileName, format: fmt, scope, recordCount: scopeRecordCount,
      });
      notify.success("Export complete", { description: `${fileName} downloaded successfully.` });

    } catch (err: any) {
      notify.apiError(err, "Export failed");
    } finally {
      setExporting(false); setProgress(0); setProgressLabel("");
    }
  }

  const canExport = selectedScopes.size > 0 && !exporting
    && !(selectedScopes.has("billing") && billsLoading);

  const scopeLabel = useMemo(() => {
    const labels = SCOPE_OPTIONS.filter(s => s.available && selectedScopes.has(s.id)).map(s => s.label);
    if (labels.length === 0) return "Select at least one data type";
    if (labels.length === 1) return labels[0];
    return labels.join(" + ");
  }, [selectedScopes]);

  const fmtLabel = FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.label ?? "Excel";

  const dateRangeLabel = useMemo(() => {
    if (datePreset === "all")        return "All time";
    if (datePreset === "this-month") return format(new Date(), "MMMM yyyy");
    if (datePreset === "last-month") return format(subMonths(new Date(), 1), "MMMM yyyy");
    if (customFrom && customTo)      return `${customFrom} to ${customTo}`;
    if (customFrom)                  return `From ${customFrom}`;
    if (customTo)                    return `Until ${customTo}`;
    return "Custom range";
  }, [datePreset, customFrom, customTo]);

  return (
    <div className="space-y-5">

      {/* ── REMINDER BANNER ── */}
      {reminderVisible && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 overflow-hidden relative">
          <div className="h-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
          <div className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Monthly backup reminder</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                Keep a regular export of your patient data for compliance and backup. It only takes a moment.
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400"
                  onClick={() => setSnoozeOpen(s => !s)}
                  data-testid="button-snooze-reminder"
                >
                  <Clock className="h-3 w-3 mr-1" />Snooze
                </Button>
                {snoozeOpen && (["1d", "3d", "7d"] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => dismissReminder(d)}
                    className="h-7 px-3 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 bg-transparent hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 transition-colors"
                    data-testid={`button-snooze-${d}`}
                  >
                    {d === "1d" ? "1 day" : d === "3d" ? "3 days" : "1 week"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => dismissReminder()}
              className="absolute top-3 right-3 h-6 w-6 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              data-testid="button-dismiss-reminder"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Patients</p>
              <p className="text-2xl font-bold text-violet-600" data-testid="stat-total-patients">
                {getUniquePatients(bookings ?? []).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">Last Export</p>
              {lastExport ? (
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 truncate" data-testid="stat-last-export">
                  {format(new Date(lastExport.createdAt!), "dd MMM yyyy")}
                </p>
              ) : (
                <p className="text-sm font-medium text-muted-foreground italic" data-testid="stat-last-export">Never</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <History className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Exports</p>
              <p className="text-2xl font-bold text-amber-600" data-testid="stat-total-exports">{totalExports}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">

        {/* LEFT: EXPORT PANEL */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Export Patient Data</h2>
                <p className="text-[11px] text-muted-foreground">Choose format, select data, set period, then download</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">

            {/* Step 1: Format */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                1 — Choose format
              </p>
              <div className="grid grid-cols-3 gap-2">
                {FORMAT_OPTIONS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFormat(f.id)}
                    data-testid={`button-format-${f.id}`}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center
                      ${selectedFormat === f.id
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50"
                      }`}
                  >
                    {f.recommended && (
                      <span className="absolute -top-px -right-px text-[8px] font-black uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded-bl-lg rounded-tr-xl">
                        Default
                      </span>
                    )}
                    <f.icon className={`h-5 w-5 ${selectedFormat === f.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-xs font-bold ${selectedFormat === f.id ? "text-primary" : "text-foreground"}`}>{f.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Step 2: Scope */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                2 — Include in export
              </p>
              <div className="space-y-2">
                {SCOPE_OPTIONS.map(opt => {
                  const isChecked = selectedScopes.has(opt.id);
                  const count = opt.id === "patients"     ? uniquePatients.length
                              : opt.id === "appointments"  ? filteredBookings.length
                              : opt.id === "billing"       ? filteredBills.length
                              : null;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => opt.available && toggleScope(opt.id)}
                      data-testid={`scope-item-${opt.id}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                        ${!opt.available ? "opacity-50 cursor-not-allowed border-border/30 bg-muted/20"
                          : isChecked ? "border-primary/40 bg-primary/5 cursor-pointer"
                          : "border-border/50 bg-muted/30 cursor-pointer hover:border-border hover:bg-muted/40"
                        }`}
                    >
                      <div
                        className={`rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                          ${isChecked && opt.available ? "bg-primary border-primary" : "bg-background border-border/60"}`}
                        style={{ width: 18, height: 18, borderRadius: 5 }}
                      >
                        {isChecked && opt.available && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <opt.icon className={`h-4 w-4 shrink-0 ${isChecked && opt.available ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${isChecked && opt.available ? "text-primary" : "text-foreground"}`}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                      </div>
                      {!opt.available ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Soon</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {opt.id === "billing" && billsLoading && selectedScopes.has("billing")
                            ? "Loading…"
                            : count !== null ? `${count} records` : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Step 3: Date Range */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                3 — Date range
              </p>
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {DATE_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setDatePreset(p.id)}
                    data-testid={`button-date-preset-${p.id}`}
                    className={`text-xs font-semibold px-2 py-1.5 rounded-lg border transition-all
                      ${datePreset === p.id
                        ? "border-primary/50 bg-primary/5 text-primary ring-1 ring-primary/20"
                        : "border-border/50 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {datePreset === "custom" && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      data-testid="input-date-from"
                      className="w-full h-8 pl-8 pr-2 text-xs rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">to</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      data-testid="input-date-to"
                      className="w-full h-8 pl-8 pr-2 text-xs rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                    />
                  </div>
                </div>
              )}
              {datePreset !== "all" && (
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  Filtering by: <span className="font-semibold text-foreground">{dateRangeLabel}</span>
                </p>
              )}
            </div>

            <div className="h-px bg-border/50" />

            {/* Step 4: Download */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                4 — Download
              </p>

              {selectedScopes.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary" data-testid="text-export-summary">
                    {fmtLabel} · {scopeLabel} · {scopeRecordCount.toLocaleString()} records · {dateRangeLabel}
                  </span>
                </div>
              )}

              <Button
                className="w-full gap-2 h-10 text-sm font-bold shadow-md shadow-primary/20 hover:shadow-primary/30"
                onClick={() => runExport()}
                disabled={!canExport || selectedScopes.size === 0}
                data-testid="button-export-download"
              >
                {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? progressLabel : "Export & Download"}
              </Button>

              {exporting && (
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] text-muted-foreground">{progressLabel}</span>
                    <span className="text-[10px] font-bold text-primary">{progress}%</span>
                  </div>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* RIGHT: HISTORY */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <History className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Export History</h2>
                  <p className="text-[11px] text-muted-foreground">Regenerate any previous export</p>
                </div>
              </div>
              {totalExports > 0 && (
                <Badge variant="secondary" className="text-[10px] font-bold">{totalExports}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {historyLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <History className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No exports yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Your export history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => {
                  const fmtInfo  = FORMAT_OPTIONS.find(f => f.id === item.format);
                  const FmtIcon  = fmtInfo?.icon ?? FileText;
                  const colorMap: Record<string, string> = {
                    xlsx: "text-emerald-600 bg-emerald-500/10",
                    csv:  "text-blue-600 bg-blue-500/10",
                    pdf:  "text-rose-600 bg-rose-500/10",
                  };
                  const iconColor = colorMap[item.format] ?? "text-muted-foreground bg-muted/50";

                  const scopeParts: string[] = [];
                  if (item.scope.includes("patients"))     scopeParts.push("Patients");
                  if (item.scope.includes("appointments")) scopeParts.push("Appointments");
                  if (item.scope.includes("billing"))      scopeParts.push("Billing");
                  const scopeDisplay = scopeParts.length === 3 ? "Full export"
                    : scopeParts.length === 0 ? "Unknown"
                    : scopeParts.join(" + ");

                  return (
                    <div
                      key={item.id}
                      data-testid={`history-item-${item.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                        <FmtIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate" title={item.fileName}>
                          {item.fileName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(item.createdAt!), { addSuffix: true })}
                          </span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{item.recordCount.toLocaleString()} records</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{scopeDisplay}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => runExport(item.scope as string[], item.format as ExportFormat)}
                        disabled={exporting}
                        title="Re-download"
                        data-testid={`button-redownload-${item.id}`}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
