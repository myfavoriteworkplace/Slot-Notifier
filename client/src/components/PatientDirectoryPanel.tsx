import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Patient, PatientBill, ClinicalRecord, Booking, Slot } from "@shared/schema";
import {
  Download, Loader2, Search, ArrowUpDown, TrendingUp, BadgeCheck, IndianRupee,
  Users, User, X, FileText, Stethoscope, CalendarDays,
} from "lucide-react";

type PatientHistory = {
  bookings: (Booking & { slot: Slot })[];
  bills: PatientBill[];
  clinicalRecords: ClinicalRecord[];
};

interface PatientDirectoryPanelProps {
  isAuthenticated: boolean;
  selectedPatientId: number | null;
  onSelectPatient: (id: number | null) => void;
}

export default function PatientDirectoryPanel({
  isAuthenticated,
  selectedPatientId,
  onSelectPatient,
}: PatientDirectoryPanelProps) {
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSort, setPatientSort] = useState<'recent' | 'visits' | 'billed'>('recent');

  const { data: patientDirectory = [], isLoading: patientsLoading } = useQuery<(Patient & { totalBilled: number })[]>({
    queryKey: ['/api/auth/clinic/patients'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/clinic/patients');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: patientHistory, isLoading: historyLoading } = useQuery<PatientHistory>({
    queryKey: ['/api/auth/clinic/patients', selectedPatientId, 'history'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/auth/clinic/patients/${selectedPatientId}/history`);
      if (!res.ok) throw new Error('Failed to load history');
      return res.json();
    },
    enabled: !!selectedPatientId,
  });

  const q = patientSearch.toLowerCase().trim();
  const filtered = patientDirectory.filter(p =>
    !q ||
    (p.patientCode ?? '').toLowerCase().includes(q) ||
    (p.name ?? '').toLowerCase().includes(q) ||
    (p.email ?? '').toLowerCase().includes(q) ||
    (p.phone ?? '').toLowerCase().includes(q)
  );
  const sorted = [...filtered].sort((a, b) => {
    if (patientSort === 'visits') return b.visitCount - a.visitCount;
    if (patientSort === 'billed') return b.totalBilled - a.totalBilled;
    return new Date(b.lastVisitAt ?? 0).getTime() - new Date(a.lastVisitAt ?? 0).getTime();
  });

  const totalPatients = patientDirectory.length;
  const nowMs = Date.now();
  const activeThisMonth = patientDirectory.filter(p =>
    p.lastVisitAt && (nowMs - new Date(p.lastVisitAt).getTime()) < 30 * 24 * 60 * 60 * 1000
  ).length;
  const newThisMonth = patientDirectory.filter(p =>
    p.createdAt && (nowMs - new Date(p.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000
  ).length;
  const totalRevenue = patientDirectory.reduce((s, p) => s + p.totalBilled, 0);

  const exportCSV = () => {
    const header = ['PAT Code', 'Name', 'Email', 'Phone', 'Visits', 'Last Visit', 'Total Billed (₹)'];
    const rows = patientDirectory.map(p => [
      p.patientCode ?? '',
      p.name ?? '',
      p.email ?? '',
      p.phone ?? '',
      String(p.visitCount),
      p.lastVisitAt ? format(new Date(p.lastVisitAt), 'dd MMM yyyy') : '',
      String(p.totalBilled),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'patients.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <div className="space-y-5">
      {/* Panel header */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="flex">
          <div className="w-1.5 bg-rose-500/60 shrink-0" />
          <div className="flex-1 px-5 py-4 bg-gradient-to-r from-rose-500/[0.06] to-transparent flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Users className="h-[18px] w-[18px] text-rose-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Patient Directory</h2>
                <p className="text-xs text-muted-foreground mt-0.5">All patients who booked via verified email</p>
              </div>
            </div>
            <button
              onClick={exportCSV}
              data-testid="button-export-patients"
              disabled={patientDirectory.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border border-border/60 bg-background hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Patients', value: totalPatients, icon: Users, color: 'rose' },
          { label: 'Active This Month', value: activeThisMonth, icon: TrendingUp, color: 'emerald' },
          { label: 'New This Month', value: newThisMonth, icon: BadgeCheck, color: 'blue' },
          { label: 'Revenue Collected', value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: IndianRupee, color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border/50 bg-card p-4">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${
              color === 'rose' ? 'bg-rose-500/10' :
              color === 'emerald' ? 'bg-emerald-500/10' :
              color === 'blue' ? 'bg-blue-500/10' : 'bg-amber-500/10'
            }`}>
              <Icon className={`h-4 w-4 ${
                color === 'rose' ? 'text-rose-500' :
                color === 'emerald' ? 'text-emerald-600' :
                color === 'blue' ? 'text-blue-500' : 'text-amber-600'
              }`} />
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Search + Sort bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={patientSearch}
            onChange={e => setPatientSearch(e.target.value)}
            placeholder="Search by name, email, phone or PAT code…"
            data-testid="input-patient-search"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-border/60 bg-card focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 transition-all placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
          {(['recent', 'visits', 'billed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setPatientSort(s)}
              data-testid={`button-sort-${s}`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${patientSort === s ? 'bg-rose-500/10 text-rose-600' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <ArrowUpDown className="h-3 w-3" />
              {s === 'recent' ? 'Recent' : s === 'visits' ? 'Most Visits' : 'Highest Billed'}
            </button>
          ))}
        </div>
      </div>

      {/* Patient list */}
      {patientsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {patientSearch ? 'No patients match your search' : 'No patients yet'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {patientSearch ? 'Try a different name, email, or PAT code' : 'Patients appear here once they book with email OTP verification'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 bg-muted/30 border-b border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="w-20">PAT Code</span>
            <span>Name</span>
            <span>Email</span>
            <span>Phone</span>
            <span className="w-14 text-right">Visits</span>
            <span className="w-24 text-right">Last Visit</span>
            <span className="w-24 text-right">Collected</span>
          </div>

          <div className="divide-y divide-border/50">
            {sorted.map((patient) => (
              <div
                key={patient.id}
                data-testid={`row-patient-${patient.id}`}
                onClick={() => onSelectPatient(patient.id)}
                className="px-4 py-3 hover:bg-rose-500/5 cursor-pointer transition-colors group"
              >
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-3 items-center">
                  <span className="w-20 font-mono text-xs font-bold bg-rose-500/10 text-rose-600 px-2 py-1 rounded-md">
                    {patient.patientCode ?? '—'}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate group-hover:text-rose-600 transition-colors">{patient.name ?? '—'}</span>
                  <span className="text-xs text-muted-foreground truncate">{patient.email ?? '—'}</span>
                  <span className="text-xs text-muted-foreground truncate">{patient.phone ?? '—'}</span>
                  <span className="w-14 text-right">
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary/10 text-primary text-xs font-bold px-1.5">
                      {patient.visitCount}
                    </span>
                  </span>
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    {patient.lastVisitAt ? format(new Date(patient.lastVisitAt), 'dd MMM yyyy') : '—'}
                  </span>
                  <span className="w-24 text-right text-sm font-semibold text-emerald-600">
                    {patient.totalBilled > 0 ? `₹${patient.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                  </span>
                </div>

                {/* Mobile card */}
                <div className="sm:hidden flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{patient.name ?? '—'}</p>
                        <span className="font-mono text-xs font-bold bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded-md shrink-0">
                          {patient.patientCode ?? '—'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{patient.email ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{patient.phone ?? '—'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600">
                      {patient.totalBilled > 0 ? `₹${patient.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">{patient.visitCount} visit{patient.visitCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      {patient.lastVisitAt ? format(new Date(patient.lastVisitAt), 'dd MMM') : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Showing {sorted.length} of {totalPatients} patient{totalPatients !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Total collected <span className="font-bold text-emerald-600">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </p>
          </div>
        </div>
      )}

      {/* "Click a row to view history" hint */}
      {sorted.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-2">
          Click any patient row to view their full visit history
        </p>
      )}
    </div>

    {/* ── PATIENT HISTORY SLIDE-OVER ── */}
    {selectedPatientId && (() => {
      const selPatient = patientDirectory.find(p => p.id === selectedPatientId);
      const visitBookings = patientHistory?.bookings ?? [];
      const visitBills = patientHistory?.bills ?? [];
      const visitRecords = patientHistory?.clinicalRecords ?? [];

      return (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
            onClick={() => onSelectPatient(null)}
          />
          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-border/60 bg-card shrink-0">
              <div className="h-11 w-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-bold text-foreground">{selPatient?.name ?? 'Patient'}</p>
                  {selPatient?.patientCode && (
                    <span className="font-mono text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 px-2 py-0.5 rounded-md">
                      {selPatient.patientCode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{selPatient?.email ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{selPatient?.phone ?? '—'}</p>
              </div>
              <button
                onClick={() => onSelectPatient(null)}
                data-testid="button-close-patient-history"
                className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick stats bar */}
            <div className="grid grid-cols-3 divide-x divide-border/50 border-b border-border/60 shrink-0">
              {[
                { label: 'Total Visits', value: selPatient?.visitCount ?? 0 },
                { label: 'Bills Raised', value: visitBills.length },
                { label: 'Total Billed', value: `₹${(selPatient?.totalBilled ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-3 text-center">
                  <p className="text-base font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {historyLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="p-5 space-y-6">

                  {/* Visit Timeline */}
                  <section>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                      Visit Timeline ({visitBookings.length})
                    </p>
                    {visitBookings.length === 0 ? (
                      <p className="text-[12px] text-muted-foreground italic">No bookings linked yet</p>
                    ) : (
                      <div className="space-y-2">
                        {visitBookings.map((bk) => {
                          const slotBills = visitBills.filter(b => b.bookingId === bk.id);
                          const slotRecord = visitRecords.find(r => r.bookingId === bk.id);
                          const statusColor =
                            bk.verificationStatus === 'confirmed' ? 'text-emerald-600 bg-emerald-500/10' :
                            bk.verificationStatus === 'cancelled' ? 'text-rose-500 bg-rose-500/10' :
                            'text-amber-600 bg-amber-500/10';
                          return (
                            <div key={bk.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                              {/* Visit header */}
                              <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-muted/30 border-b border-border/40">
                                <div className="flex items-center gap-2 min-w-0">
                                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-[12px] font-semibold text-foreground">
                                    {format(new Date(bk.slot.startTime), 'dd MMM yyyy')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(bk.slot.startTime), 'h:mm a')} – {format(new Date(bk.slot.endTime), 'h:mm a')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
                                    {bk.verificationStatus}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-mono">#{bk.id}</span>
                                </div>
                              </div>

                              <div className="px-3 py-2.5 space-y-2">
                                {/* Doctor */}
                                {bk.assignedDoctor && (
                                  <div className="flex items-center gap-2">
                                    <Stethoscope className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="text-xs text-muted-foreground">Dr. {bk.assignedDoctor}</span>
                                  </div>
                                )}

                                {/* Clinical record */}
                                {slotRecord && (
                                  <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 p-2.5 space-y-1">
                                    {(slotRecord.diagnosis as string[])?.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {(slotRecord.diagnosis as string[]).map((d, i) => (
                                          <span key={i} className="text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-md font-medium">{d}</span>
                                        ))}
                                      </div>
                                    )}
                                    {slotRecord.prescription && (() => {
                                      let rxText = slotRecord.prescription;
                                      try {
                                        const rxRows = JSON.parse(slotRecord.prescription);
                                        if (Array.isArray(rxRows) && rxRows[0]?.name) {
                                          rxText = rxRows.map((r: any) => `${r.name}${r.dosage ? ` ${r.dosage}` : ''}${r.frequency ? ` ${r.frequency}` : ''}`).join(', ');
                                        }
                                      } catch { /* use raw text */ }
                                      return (
                                        <p className="text-xs text-muted-foreground">
                                          <span className="font-semibold text-foreground">Rx: </span>{rxText}
                                        </p>
                                      );
                                    })()}
                                    {slotRecord.notes && (
                                      <p className="text-xs text-muted-foreground">
                                        <span className="font-semibold text-foreground">Notes: </span>{slotRecord.notes}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Bills */}
                                {slotBills.length > 0 && (
                                  <div className="space-y-1">
                                    {slotBills.map(bill => (
                                      <div key={bill.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                          <span className="text-xs text-muted-foreground font-mono truncate">{bill.billNumber}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${bill.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                            {bill.paymentStatus}
                                          </span>
                                          <span className="text-[12px] font-bold text-foreground">₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Unlinked bills (no bookingId match) */}
                  {(() => {
                    const linkedBillIds = new Set(visitBookings.map(b => b.id));
                    const unlinked = visitBills.filter(b => !b.bookingId || !linkedBillIds.has(b.bookingId));
                    if (unlinked.length === 0) return null;
                    return (
                      <section>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                          Other Bills ({unlinked.length})
                        </p>
                        <div className="space-y-1.5">
                          {unlinked.map(bill => (
                            <div key={bill.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-3 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-foreground font-mono">{bill.billNumber}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {bill.createdAt ? format(new Date(bill.createdAt), 'dd MMM yyyy') : '—'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${bill.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                  {bill.paymentStatus}
                                </span>
                                <span className="text-sm font-bold text-foreground">₹{(bill.total ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })()}

                </div>
              )}
            </div>
          </div>
        </>
      );
    })()}

    </>
  );
}
