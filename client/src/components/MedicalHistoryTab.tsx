import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Pencil, X, Plus, Trash2, AlertTriangle, Pill, ShieldAlert,
  Scissors, Users, FileText, Syringe, CreditCard, Phone, Cigarette,
  Activity, CheckCircle2, Clock, ChevronDown, ChevronUp, Save,
  Maximize2,
} from "lucide-react";
import type {
  PatientMedicalHistory, MedicalAlert, CurrentMedication, AllergyEntry,
  SurgicalEntry, DentalHistoryMap, MedHistLifestyle, MedHistClearance,
  MedHistInsurance, MedHistEmergency, MedHistAttachment,
} from "@shared/schema";

// ── Constants ────────────────────────────────────────────────────────────────

const GENERAL_CONDITIONS = [
  "Diabetes", "Hypertension", "Thyroid Disorder", "Asthma", "Heart Disease",
  "Tuberculosis", "HIV/AIDS", "Hepatitis", "Kidney Disease", "Liver Disease",
  "Cancer", "Osteoporosis", "Arthritis", "Epilepsy",
];

const FAMILY_CONDITIONS = [
  "Diabetes", "Hypertension", "Heart Disease", "Oral Cancer",
  "Gum Disease", "Asthma", "Thyroid Disorder",
];

const VACCINES = ["Hepatitis B", "COVID-19", "Tetanus", "Influenza"];

const DENTAL_FIELDS: { key: keyof DentalHistoryMap; label: string }[] = [
  { key: "rootCanal",        label: "Previous Root Canal" },
  { key: "bruxism",          label: "Bruxism (Teeth Grinding)" },
  { key: "implant",          label: "Implant Placed" },
  { key: "sensitivity",      label: "Sensitivity Issues" },
  { key: "orthodontic",      label: "Orthodontic Treatment" },
  { key: "gumDisease",       label: "Gum Disease (Periodontitis)" },
  { key: "wisdomExtraction", label: "Wisdom Tooth Extraction" },
  { key: "dentures",         label: "Dentures / Partial Dentures" },
  { key: "tobaccoChewing",   label: "Tobacco Chewing" },
];

const ALERT_COLORS = [
  { value: "rose",   label: "Red"    },
  { value: "amber",  label: "Amber"  },
  { value: "violet", label: "Purple" },
  { value: "sky",    label: "Blue"   },
];

const SEVERITY_COLORS: Record<string, string> = {
  High:   "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800",
  Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  Low:    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800",
};

const ALERT_BG: Record<string, string> = {
  rose:   "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700",
  amber:  "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  violet: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-700",
  sky:    "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeRisk(d: Partial<PatientMedicalHistory>): { level: "High" | "Medium" | "Low"; factors: string[] } {
  const factors: string[] = [];
  const conds = d.generalConditions ?? [];
  const meds  = d.currentMedications ?? [];
  const allgs = d.allergies ?? [];

  if (conds.includes("Heart Disease"))      factors.push("Heart disease");
  if (conds.includes("Diabetes"))           factors.push("Diabetes");
  if (conds.includes("HIV/AIDS"))           factors.push("HIV/AIDS");
  if (conds.includes("Hepatitis"))          factors.push("Hepatitis");
  if (conds.includes("Epilepsy"))           factors.push("Epilepsy");
  if (meds.some(m => /blood thinner|warfarin|aspirin|heparin|clopidogrel/i.test(m.medicine)))
    factors.push("Blood thinner medication");
  if (meds.some(m => /bisphosphonate|fosamax|zometa|prolia/i.test(m.medicine)))
    factors.push("Bisphosphonate (MRONJ risk)");
  if (allgs.some(a => a.severity === "High"))
    factors.push("High-severity allergy");

  if (factors.length >= 2) return { level: "High", factors };
  if (factors.length === 1 || conds.length >= 2 || allgs.length >= 1)
    return { level: "Medium", factors };
  return { level: "Low", factors };
}

function SectionCard({ icon, title, children, isEmpty }: {
  icon: ReactNode; title: string; children: ReactNode; isEmpty?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/40 bg-muted/30">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <div className="px-3.5 py-3">
        {isEmpty
          ? <p className="text-xs text-muted-foreground italic">None recorded</p>
          : children}
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-medium">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:text-primary/60 transition-colors" aria-label={`Remove ${label}`}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// ── Empty draft ──────────────────────────────────────────────────────────────

function emptyDraft(): Omit<PatientMedicalHistory, "id" | "patientId" | "clinicId" | "createdAt" | "updatedAt"> {
  return {
    medicalAlerts:      [],
    generalConditions:  [],
    currentMedications: [],
    allergies:          [],
    surgicalHistory:    [],
    familyHistory:      [],
    dentalHistory:      null as any,
    vaccinationHistory: [],
    insuranceDetails:   null as any,
    emergencyContact:   null as any,
    lifestyle:          null as any,
    medicalClearance:   null as any,
    generalNotes:       null as any,
    attachments:        [],
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  bookingId: number;
  setDialogExpanded: (v: boolean) => void;
  dialogExpanded: boolean;
}

export default function MedicalHistoryTab({ bookingId, setDialogExpanded, dialogExpanded }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<ReturnType<typeof emptyDraft>>(emptyDraft());

  const { data: resp, isLoading } = useQuery<{ data: PatientMedicalHistory | null; patientId: number; clinicId: number }>({
    queryKey: [`/api/doctor/bookings/${bookingId}/medical-history`],
    staleTime: 1000 * 60 * 5,
  });

  const saved = resp?.data ?? null;

  const saveMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof emptyDraft>) =>
      apiRequest("PUT", `/api/doctor/bookings/${bookingId}/medical-history`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/doctor/bookings/${bookingId}/medical-history`] });
      setMode("view");
      notify.success("Medical history saved");
    },
    onError: (e: any) => notify.error(e.message ?? "Save failed"),
  });

  function startEdit() {
    const base = saved ?? {};
    setDraft({
      medicalAlerts:      (base.medicalAlerts      ?? []) as MedicalAlert[],
      generalConditions:  (base.generalConditions   ?? []) as string[],
      currentMedications: (base.currentMedications  ?? []) as CurrentMedication[],
      allergies:          (base.allergies           ?? []) as AllergyEntry[],
      surgicalHistory:    (base.surgicalHistory     ?? []) as SurgicalEntry[],
      familyHistory:      (base.familyHistory       ?? []) as string[],
      dentalHistory:      (base.dentalHistory       ?? {}) as DentalHistoryMap,
      vaccinationHistory: (base.vaccinationHistory  ?? []) as string[],
      insuranceDetails:   (base.insuranceDetails    ?? {}) as MedHistInsurance,
      emergencyContact:   (base.emergencyContact    ?? {}) as MedHistEmergency,
      lifestyle:          (base.lifestyle           ?? {}) as MedHistLifestyle,
      medicalClearance:   (base.medicalClearance    ?? {}) as MedHistClearance,
      generalNotes:       base.generalNotes ?? "",
      attachments:        (base.attachments         ?? []) as MedHistAttachment[],
    });
    setMode("edit");
    setDialogExpanded(true);
  }

  function cancelEdit() {
    setMode("view");
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading medical history…</span>
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  if (mode === "view") {
    const d = saved;
    const risk = d ? computeRisk(d) : { level: "Low" as const, factors: [] };
    const hasAny = d && (
      (d.medicalAlerts?.length ?? 0) > 0 ||
      (d.generalConditions?.length ?? 0) > 0 ||
      (d.currentMedications?.length ?? 0) > 0 ||
      (d.allergies?.length ?? 0) > 0 ||
      (d.surgicalHistory?.length ?? 0) > 0 ||
      d.dentalHistory ||
      d.generalNotes ||
      d.emergencyContact ||
      d.lifestyle
    );

    return (
      <div className="p-4 space-y-3">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Medical History</span>
            {d?.updatedAt && (
              <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(d.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {d && (
              <Badge
                className={`text-xs font-semibold border ${
                  risk.level === "High"
                    ? "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800"
                    : risk.level === "Medium"
                    ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
                    : "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                }`}
              >
                {risk.level} Risk
              </Badge>
            )}
            <Button
              size="sm"
              className="h-7 text-xs gap-1 px-3"
              onClick={startEdit}
              data-testid="button-edit-medical-history"
            >
              <Pencil className="h-3 w-3" />
              {hasAny ? "Edit" : "Add History"}
              {!dialogExpanded && <Maximize2 className="h-3 w-3 ml-0.5 opacity-60" />}
            </Button>
          </div>
        </div>

        {!hasAny && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2 border border-dashed border-border/60 rounded-xl">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No medical history recorded yet</p>
            <p className="text-xs opacity-60">Click "Add History" to fill in patient details</p>
          </div>
        )}

        {hasAny && (
          <div className={`grid gap-3 ${dialogExpanded ? "sm:grid-cols-2" : "grid-cols-1"}`}>
            {/* Medical Alerts */}
            {(d?.medicalAlerts?.length ?? 0) > 0 && (
              <div className={dialogExpanded ? "sm:col-span-2" : ""}>
                <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 px-3.5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide">Medical Alerts</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d!.medicalAlerts!.map((a, i) => (
                      <span key={i} className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 ${ALERT_BG[a.color ?? "rose"]}`}>
                        {a.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Risk Factors */}
            {risk.factors.length > 0 && (
              <SectionCard icon={<ShieldAlert className="h-3.5 w-3.5" />} title="Patient Risk Factors">
                <ul className="space-y-1">
                  {risk.factors.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* General Conditions */}
            <SectionCard
              icon={<Activity className="h-3.5 w-3.5" />}
              title="General Medical Conditions"
              isEmpty={(d?.generalConditions?.length ?? 0) === 0}
            >
              <div className="flex flex-wrap gap-1.5">
                {d!.generalConditions!.map((c, i) => <Chip key={i} label={c} />)}
              </div>
            </SectionCard>

            {/* Emergency Contact */}
            {(d?.emergencyContact?.name || d?.emergencyContact?.phone) && (
              <SectionCard icon={<Phone className="h-3.5 w-3.5" />} title="Emergency Contact">
                <div className="space-y-1 text-xs">
                  {d.emergencyContact!.name && <div><span className="text-muted-foreground">Name: </span>{d.emergencyContact!.name}</div>}
                  {d.emergencyContact!.relationship && <div><span className="text-muted-foreground">Relationship: </span>{d.emergencyContact!.relationship}</div>}
                  {d.emergencyContact!.phone && <div><span className="text-muted-foreground">Phone: </span><span className="font-medium">{d.emergencyContact!.phone}</span></div>}
                </div>
              </SectionCard>
            )}

            {/* Current Medications */}
            <SectionCard
              icon={<Pill className="h-3.5 w-3.5" />}
              title="Current Medications"
              isEmpty={(d?.currentMedications?.length ?? 0) === 0}
            >
              <div className="space-y-1.5">
                {d!.currentMedications!.map((m, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                    <div>
                      <span className="font-semibold text-foreground">{m.medicine}</span>
                      <span className="text-muted-foreground ml-1.5">{m.dose} · {m.frequency}</span>
                    </div>
                    {m.startedOn && <span className="text-muted-foreground/60 shrink-0">{m.startedOn}</span>}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Allergies */}
            <SectionCard
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              title="Allergies (Drugs / Materials)"
              isEmpty={(d?.allergies?.length ?? 0) === 0}
            >
              <div className="space-y-1.5">
                {d!.allergies!.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <span className="font-semibold text-foreground">{a.allergy}</span>
                      <span className="text-muted-foreground ml-1.5 capitalize">{a.type}</span>
                      {a.reaction && <span className="text-muted-foreground"> · {a.reaction}</span>}
                    </div>
                    {a.severity && (
                      <span className={`text-xs font-semibold border rounded-full px-2 py-px shrink-0 ${SEVERITY_COLORS[a.severity] ?? ""}`}>
                        {a.severity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Lifestyle */}
            {d?.lifestyle && (
              <SectionCard icon={<Cigarette className="h-3.5 w-3.5" />} title="Lifestyle & Body Metrics">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {d.lifestyle.smoking    && <div><span className="text-muted-foreground">Smoking: </span>{d.lifestyle.smoking}</div>}
                  {d.lifestyle.alcohol    && <div><span className="text-muted-foreground">Alcohol: </span>{d.lifestyle.alcohol}</div>}
                  {d.lifestyle.tobacco    && <div><span className="text-muted-foreground">Tobacco: </span>{d.lifestyle.tobacco}</div>}
                  {d.lifestyle.pregnancy  && <div><span className="text-muted-foreground">Pregnancy: </span>{d.lifestyle.pregnancy}</div>}
                  {d.lifestyle.heightCm   && <div><span className="text-muted-foreground">Height: </span>{d.lifestyle.heightCm} cm</div>}
                  {d.lifestyle.weightKg   && <div><span className="text-muted-foreground">Weight: </span>{d.lifestyle.weightKg} kg</div>}
                  {d.lifestyle.heightCm && d.lifestyle.weightKg && (
                    <div><span className="text-muted-foreground">BMI: </span>
                      <span className="font-semibold">
                        {(d.lifestyle.weightKg / Math.pow(d.lifestyle.heightCm / 100, 2)).toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Dental History */}
            {d?.dentalHistory && Object.keys(d.dentalHistory).length > 0 && (
              <SectionCard icon={<Activity className="h-3.5 w-3.5" />} title="Dental History">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {DENTAL_FIELDS.filter(f => d.dentalHistory![f.key]).map(f => (
                    <div key={f.key} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className={`h-3 w-3 shrink-0 ${d.dentalHistory![f.key] === "Yes" ? "text-primary" : "text-muted-foreground/40"}`} />
                      <span className={d.dentalHistory![f.key] === "Yes" ? "text-foreground" : "text-muted-foreground/60"}>
                        {f.label}
                        {d.dentalHistory![f.key] && d.dentalHistory![f.key] !== "Yes" && d.dentalHistory![f.key] !== "No"
                          ? `: ${d.dentalHistory![f.key]}`
                          : ` (${d.dentalHistory![f.key]})`}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Surgical History */}
            <SectionCard
              icon={<Scissors className="h-3.5 w-3.5" />}
              title="Surgical History"
              isEmpty={(d?.surgicalHistory?.length ?? 0) === 0}
            >
              <div className="space-y-1.5">
                {d!.surgicalHistory!.map((s, i) => (
                  <div key={i} className="text-xs border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                    <span className="font-semibold">{s.procedure}</span>
                    {s.year && <span className="text-muted-foreground ml-1.5">({s.year})</span>}
                    {s.hospital && <span className="text-muted-foreground"> · {s.hospital}</span>}
                    {s.notes && <p className="text-muted-foreground/70 mt-0.5">{s.notes}</p>}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Family History */}
            <SectionCard
              icon={<Users className="h-3.5 w-3.5" />}
              title="Family History"
              isEmpty={(d?.familyHistory?.length ?? 0) === 0}
            >
              <div className="flex flex-wrap gap-1.5">
                {d!.familyHistory!.map((c, i) => <Chip key={i} label={c} />)}
              </div>
            </SectionCard>

            {/* Vaccination */}
            {(d?.vaccinationHistory?.length ?? 0) > 0 && (
              <SectionCard icon={<Syringe className="h-3.5 w-3.5" />} title="Vaccination History">
                <div className="flex flex-wrap gap-1.5">
                  {d!.vaccinationHistory!.map((v, i) => <Chip key={i} label={v} />)}
                </div>
              </SectionCard>
            )}

            {/* Insurance */}
            {(d?.insuranceDetails?.provider || d?.insuranceDetails?.policyNumber) && (
              <SectionCard icon={<CreditCard className="h-3.5 w-3.5" />} title="Insurance Details">
                <div className="space-y-1 text-xs">
                  {d.insuranceDetails!.provider     && <div><span className="text-muted-foreground">Provider: </span>{d.insuranceDetails!.provider}</div>}
                  {d.insuranceDetails!.policyNumber && <div><span className="text-muted-foreground">Policy No: </span>{d.insuranceDetails!.policyNumber}</div>}
                  {d.insuranceDetails!.expiryDate   && <div><span className="text-muted-foreground">Expiry: </span>{d.insuranceDetails!.expiryDate}</div>}
                </div>
              </SectionCard>
            )}

            {/* Medical Clearance */}
            {d?.medicalClearance && (
              <SectionCard icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Medical Clearance">
                <div className="space-y-1 text-xs">
                  {d.medicalClearance.required     && <div><span className="text-muted-foreground">Required: </span>{d.medicalClearance.required}</div>}
                  {d.medicalClearance.requestedOn  && <div><span className="text-muted-foreground">Requested: </span>{d.medicalClearance.requestedOn}</div>}
                  {d.medicalClearance.receivedOn   && <div><span className="text-muted-foreground">Received: </span>{d.medicalClearance.receivedOn}</div>}
                </div>
              </SectionCard>
            )}

            {/* Doctor Notes */}
            {d?.generalNotes && (
              <div className={dialogExpanded ? "" : ""}>
                <SectionCard icon={<FileText className="h-3.5 w-3.5" />} title="General Medical Notes">
                  <p className="text-xs whitespace-pre-wrap text-foreground/80">{d.generalNotes}</p>
                </SectionCard>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const d = draft;

  function setField<K extends keyof typeof d>(key: K, val: (typeof d)[K]) {
    setDraft(prev => ({ ...prev, [key]: val }));
  }

  function addMed() {
    setField("currentMedications", [...d.currentMedications, { medicine: "", dose: "", frequency: "", startedOn: "" }]);
  }
  function removeMed(i: number) {
    setField("currentMedications", d.currentMedications.filter((_, idx) => idx !== i));
  }
  function patchMed(i: number, patch: Partial<CurrentMedication>) {
    setField("currentMedications", d.currentMedications.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  }

  function addAllergy() {
    setField("allergies", [...d.allergies, { allergy: "", type: "Drug", reaction: "", severity: "Medium", verifiedOn: "" }]);
  }
  function removeAllergy(i: number) {
    setField("allergies", d.allergies.filter((_, idx) => idx !== i));
  }
  function patchAllergy(i: number, patch: Partial<AllergyEntry>) {
    setField("allergies", d.allergies.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }

  function addAlert() {
    setField("medicalAlerts", [...d.medicalAlerts, { text: "", color: "rose" }]);
  }
  function removeAlert(i: number) {
    setField("medicalAlerts", d.medicalAlerts.filter((_, idx) => idx !== i));
  }
  function patchAlert(i: number, patch: Partial<MedicalAlert>) {
    setField("medicalAlerts", d.medicalAlerts.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }

  function addSurgery() {
    setField("surgicalHistory", [...d.surgicalHistory, { procedure: "", year: "", hospital: "", notes: "" }]);
  }
  function removeSurgery(i: number) {
    setField("surgicalHistory", d.surgicalHistory.filter((_, idx) => idx !== i));
  }
  function patchSurgery(i: number, patch: Partial<SurgicalEntry>) {
    setField("surgicalHistory", d.surgicalHistory.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  function toggleCondition(cond: string) {
    const curr = d.generalConditions as string[];
    setField("generalConditions", curr.includes(cond) ? curr.filter(c => c !== cond) : [...curr, cond]);
  }

  function toggleFamily(cond: string) {
    const curr = d.familyHistory as string[];
    setField("familyHistory", curr.includes(cond) ? curr.filter(c => c !== cond) : [...curr, cond]);
  }

  function toggleVaccine(v: string) {
    const curr = d.vaccinationHistory as string[];
    setField("vaccinationHistory", curr.includes(v) ? curr.filter(x => x !== v) : [...curr, v]);
  }

  function patchDental(key: keyof DentalHistoryMap, val: string) {
    setField("dentalHistory", { ...(d.dentalHistory ?? {}), [key]: val } as DentalHistoryMap);
  }

  function patchLifestyle(patch: Partial<MedHistLifestyle>) {
    setField("lifestyle", { ...(d.lifestyle ?? {}), ...patch } as MedHistLifestyle);
  }

  function patchEmergency(patch: Partial<MedHistEmergency>) {
    setField("emergencyContact", { ...(d.emergencyContact ?? {}), ...patch } as MedHistEmergency);
  }

  function patchInsurance(patch: Partial<MedHistInsurance>) {
    setField("insuranceDetails", { ...(d.insuranceDetails ?? {}), ...patch } as MedHistInsurance);
  }

  function patchClearance(patch: Partial<MedHistClearance>) {
    setField("medicalClearance", { ...(d.medicalClearance ?? {}), ...patch } as MedHistClearance);
  }

  const lifestyle   = (d.lifestyle       ?? {}) as MedHistLifestyle;
  const emergency   = (d.emergencyContact ?? {}) as MedHistEmergency;
  const insurance   = (d.insuranceDetails ?? {}) as MedHistInsurance;
  const clearance   = (d.medicalClearance ?? {}) as MedHistClearance;
  const dentalHist  = (d.dentalHistory    ?? {}) as DentalHistoryMap;

  const YN_OPTIONS = ["Yes", "No", "Under treatment"];

  return (
    <div className="p-4 space-y-5 pb-20">
      {/* Edit header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 -mt-2 border-b border-border/40 -mx-4 px-4 mb-2">
        <span className="text-sm font-bold text-foreground">Edit Medical History</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={cancelEdit} disabled={saveMutation.isPending} data-testid="button-cancel-medical-edit">
            <X className="h-3 w-3" /> Cancel
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1 bg-primary text-white" onClick={() => saveMutation.mutate(d)} disabled={saveMutation.isPending} data-testid="button-save-medical-history">
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </Button>
        </div>
      </div>

      {/* Layout: 2-col on expanded, 1-col on compact */}
      <div className={`grid gap-5 ${dialogExpanded ? "sm:grid-cols-2" : "grid-cols-1"}`}>

        {/* LEFT COLUMN */}
        <div className="space-y-5">

          {/* Medical Alerts */}
          <EditSection icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-500" />} title="Medical Alerts (always visible)">
            <div className="space-y-2">
              {d.medicalAlerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={a.text}
                    onChange={e => patchAlert(i, { text: e.target.value })}
                    placeholder="e.g. Allergic to Penicillin"
                    className="h-8 text-xs flex-1"
                    data-testid={`input-alert-text-${i}`}
                  />
                  <Select value={a.color ?? "rose"} onValueChange={v => patchAlert(i, { color: v })}>
                    <SelectTrigger className="h-8 text-xs w-24" data-testid={`select-alert-color-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button onClick={() => removeAlert(i)} className="text-muted-foreground hover:text-rose-500 transition-colors" aria-label="Remove alert" data-testid={`button-remove-alert-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addAlert} data-testid="button-add-alert">
                <Plus className="h-3 w-3" /> Add Alert
              </Button>
            </div>
          </EditSection>

          {/* General Conditions */}
          <EditSection icon={<Activity className="h-3.5 w-3.5" />} title="General Medical Conditions">
            <div className="grid grid-cols-2 gap-1.5">
              {GENERAL_CONDITIONS.map(cond => {
                const checked = (d.generalConditions as string[]).includes(cond);
                return (
                  <label key={cond} className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-lg border transition-colors ${checked ? "bg-primary/10 border-primary/30 text-primary" : "border-border/50 hover:border-border"}`} data-testid={`checkbox-condition-${cond.replace(/\s+/g, "-").toLowerCase()}`}>
                    <input type="checkbox" className="accent-primary" checked={checked} onChange={() => toggleCondition(cond)} />
                    {cond}
                  </label>
                );
              })}
            </div>
          </EditSection>

          {/* Current Medications */}
          <EditSection icon={<Pill className="h-3.5 w-3.5" />} title="Current Medications (ongoing)">
            <div className="space-y-3">
              {d.currentMedications.map((m, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-2.5 space-y-2 relative">
                  <button onClick={() => removeMed(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-rose-500 transition-colors" aria-label="Remove medication" data-testid={`button-remove-med-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Medicine</Label>
                      <Input value={m.medicine} onChange={e => patchMed(i, { medicine: e.target.value })} placeholder="Medicine name" className="h-7 text-xs mt-0.5" data-testid={`input-med-name-${i}`} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Dose</Label>
                      <Input value={m.dose} onChange={e => patchMed(i, { dose: e.target.value })} placeholder="e.g. 500mg" className="h-7 text-xs mt-0.5" data-testid={`input-med-dose-${i}`} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Frequency</Label>
                      <Input value={m.frequency} onChange={e => patchMed(i, { frequency: e.target.value })} placeholder="e.g. Twice daily" className="h-7 text-xs mt-0.5" data-testid={`input-med-freq-${i}`} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Started On</Label>
                      <Input value={m.startedOn ?? ""} onChange={e => patchMed(i, { startedOn: e.target.value })} placeholder="Month / Year" className="h-7 text-xs mt-0.5" data-testid={`input-med-started-${i}`} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addMed} data-testid="button-add-medication">
                <Plus className="h-3 w-3" /> Add Medication
              </Button>
            </div>
          </EditSection>

          {/* Allergies */}
          <EditSection icon={<ShieldAlert className="h-3.5 w-3.5" />} title="Allergies — Drugs & Materials">
            <div className="space-y-3">
              {d.allergies.map((a, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-2.5 space-y-2 relative">
                  <button onClick={() => removeAllergy(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-rose-500 transition-colors" aria-label="Remove allergy" data-testid={`button-remove-allergy-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Allergy</Label>
                      <Input value={a.allergy} onChange={e => patchAllergy(i, { allergy: e.target.value })} placeholder="e.g. Penicillin" className="h-7 text-xs mt-0.5" data-testid={`input-allergy-name-${i}`} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <Select value={a.type} onValueChange={v => patchAllergy(i, { type: v })}>
                        <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-allergy-type-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Drug">Drug</SelectItem>
                          <SelectItem value="Material">Material</SelectItem>
                          <SelectItem value="Food">Food</SelectItem>
                          <SelectItem value="Environmental">Environmental</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Reaction</Label>
                      <Input value={a.reaction ?? ""} onChange={e => patchAllergy(i, { reaction: e.target.value })} placeholder="e.g. Anaphylaxis" className="h-7 text-xs mt-0.5" data-testid={`input-allergy-reaction-${i}`} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Severity</Label>
                      <Select value={a.severity ?? "Medium"} onValueChange={v => patchAllergy(i, { severity: v as "High" | "Medium" | "Low" })}>
                        <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-allergy-severity-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addAllergy} data-testid="button-add-allergy">
                <Plus className="h-3 w-3" /> Add Allergy
              </Button>
            </div>
          </EditSection>

          {/* Surgical History */}
          <EditSection icon={<Scissors className="h-3.5 w-3.5" />} title="Surgical History">
            <div className="space-y-3">
              {d.surgicalHistory.map((s, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-2.5 space-y-2 relative">
                  <button onClick={() => removeSurgery(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-rose-500 transition-colors" aria-label="Remove surgery" data-testid={`button-remove-surgery-${i}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Procedure / Surgery</Label>
                      <Input value={s.procedure} onChange={e => patchSurgery(i, { procedure: e.target.value })} placeholder="e.g. Appendectomy" className="h-7 text-xs mt-0.5" data-testid={`input-surgery-proc-${i}`} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Year</Label>
                      <Input value={s.year ?? ""} onChange={e => patchSurgery(i, { year: e.target.value })} placeholder="e.g. 2021" className="h-7 text-xs mt-0.5" data-testid={`input-surgery-year-${i}`} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Hospital / Clinic</Label>
                      <Input value={s.hospital ?? ""} onChange={e => patchSurgery(i, { hospital: e.target.value })} placeholder="Hospital name" className="h-7 text-xs mt-0.5" data-testid={`input-surgery-hospital-${i}`} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addSurgery} data-testid="button-add-surgery">
                <Plus className="h-3 w-3" /> Add Surgery
              </Button>
            </div>
          </EditSection>

          {/* Dental History */}
          <EditSection icon={<Activity className="h-3.5 w-3.5" />} title="Dental History">
            <div className="grid grid-cols-2 gap-2">
              {DENTAL_FIELDS.map(f => (
                <div key={f.key}>
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <Select value={dentalHist[f.key] ?? ""} onValueChange={v => patchDental(f.key, v)}>
                    <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-dental-${f.key}`}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {YN_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </EditSection>

          {/* General Notes */}
          <EditSection icon={<FileText className="h-3.5 w-3.5" />} title="General Medical Notes">
            <Textarea
              value={d.generalNotes ?? ""}
              onChange={e => setField("generalNotes", e.target.value)}
              placeholder="Persistent clinical notes relevant across all visits…"
              className="text-xs min-h-[80px] resize-none"
              data-testid="textarea-general-notes"
            />
          </EditSection>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">

          {/* Family History */}
          <EditSection icon={<Users className="h-3.5 w-3.5" />} title="Family History">
            <div className="grid grid-cols-2 gap-1.5">
              {FAMILY_CONDITIONS.map(cond => {
                const checked = (d.familyHistory as string[]).includes(cond);
                return (
                  <label key={cond} className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-lg border transition-colors ${checked ? "bg-primary/10 border-primary/30 text-primary" : "border-border/50 hover:border-border"}`} data-testid={`checkbox-family-${cond.replace(/\s+/g, "-").toLowerCase()}`}>
                    <input type="checkbox" className="accent-primary" checked={checked} onChange={() => toggleFamily(cond)} />
                    {cond}
                  </label>
                );
              })}
            </div>
          </EditSection>

          {/* Vaccination */}
          <EditSection icon={<Syringe className="h-3.5 w-3.5" />} title="Vaccination History">
            <div className="grid grid-cols-2 gap-1.5">
              {VACCINES.map(v => {
                const checked = (d.vaccinationHistory as string[]).includes(v);
                return (
                  <label key={v} className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-lg border transition-colors ${checked ? "bg-primary/10 border-primary/30 text-primary" : "border-border/50 hover:border-border"}`} data-testid={`checkbox-vaccine-${v.replace(/\s+/g, "-").toLowerCase()}`}>
                    <input type="checkbox" className="accent-primary" checked={checked} onChange={() => toggleVaccine(v)} />
                    {v}
                  </label>
                );
              })}
            </div>
          </EditSection>

          {/* Emergency Contact */}
          <EditSection icon={<Phone className="h-3.5 w-3.5" />} title="Emergency Contact">
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input value={emergency.name ?? ""} onChange={e => patchEmergency({ name: e.target.value })} placeholder="Full name" className="h-7 text-xs mt-0.5" data-testid="input-emergency-name" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Relationship</Label>
                <Input value={emergency.relationship ?? ""} onChange={e => patchEmergency({ relationship: e.target.value })} placeholder="e.g. Spouse, Parent" className="h-7 text-xs mt-0.5" data-testid="input-emergency-relationship" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={emergency.phone ?? ""} onChange={e => patchEmergency({ phone: e.target.value })} placeholder="Mobile number" className="h-7 text-xs mt-0.5" data-testid="input-emergency-phone" />
              </div>
            </div>
          </EditSection>

          {/* Lifestyle & Body Metrics */}
          <EditSection icon={<Cigarette className="h-3.5 w-3.5" />} title="Lifestyle & Body Metrics">
            <div className="grid grid-cols-2 gap-2">
              {(["smoking", "alcohol", "tobacco"] as const).map(field => (
                <div key={field}>
                  <Label className="text-xs text-muted-foreground capitalize">{field}</Label>
                  <Select value={lifestyle[field] ?? ""} onValueChange={v => patchLifestyle({ [field]: v })}>
                    <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-lifestyle-${field}`}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Never">Never</SelectItem>
                      <SelectItem value="Occasional">Occasional</SelectItem>
                      <SelectItem value="Regular">Regular</SelectItem>
                      <SelectItem value="Heavy">Heavy</SelectItem>
                      <SelectItem value="Former">Former</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div>
                <Label className="text-xs text-muted-foreground">Pregnancy</Label>
                <Select value={lifestyle.pregnancy ?? ""} onValueChange={v => patchLifestyle({ pregnancy: v })}>
                  <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-lifestyle-pregnancy"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="Breastfeeding">Breastfeeding</SelectItem>
                    <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Height (cm)</Label>
                <Input
                  type="number"
                  value={lifestyle.heightCm ?? ""}
                  onChange={e => patchLifestyle({ heightCm: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g. 165"
                  className="h-7 text-xs mt-0.5"
                  data-testid="input-height"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Weight (kg)</Label>
                <Input
                  type="number"
                  value={lifestyle.weightKg ?? ""}
                  onChange={e => patchLifestyle({ weightKg: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g. 70"
                  className="h-7 text-xs mt-0.5"
                  data-testid="input-weight"
                />
              </div>
              {lifestyle.heightCm && lifestyle.weightKg && (
                <div className="col-span-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  BMI: <span className="font-bold text-foreground">
                    {(lifestyle.weightKg / Math.pow(lifestyle.heightCm / 100, 2)).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </EditSection>

          {/* Medical Clearance */}
          <EditSection icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Medical Clearance">
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Required?</Label>
                <Select value={clearance.required ?? ""} onValueChange={v => patchClearance({ required: v })}>
                  <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-clearance-required"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Requested On</Label>
                  <Input value={clearance.requestedOn ?? ""} onChange={e => patchClearance({ requestedOn: e.target.value })} placeholder="dd/mm/yyyy" className="h-7 text-xs mt-0.5" data-testid="input-clearance-requested" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Received On</Label>
                  <Input value={clearance.receivedOn ?? ""} onChange={e => patchClearance({ receivedOn: e.target.value })} placeholder="dd/mm/yyyy" className="h-7 text-xs mt-0.5" data-testid="input-clearance-received" />
                </div>
              </div>
            </div>
          </EditSection>

          {/* Insurance */}
          <EditSection icon={<CreditCard className="h-3.5 w-3.5" />} title="Insurance Details">
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <Input value={insurance.provider ?? ""} onChange={e => patchInsurance({ provider: e.target.value })} placeholder="Insurance company" className="h-7 text-xs mt-0.5" data-testid="input-insurance-provider" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Policy Number</Label>
                <Input value={insurance.policyNumber ?? ""} onChange={e => patchInsurance({ policyNumber: e.target.value })} placeholder="Policy / Member ID" className="h-7 text-xs mt-0.5" data-testid="input-insurance-policy" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                <Input value={insurance.expiryDate ?? ""} onChange={e => patchInsurance({ expiryDate: e.target.value })} placeholder="mm/yyyy" className="h-7 text-xs mt-0.5" data-testid="input-insurance-expiry" />
              </div>
            </div>
          </EditSection>
        </div>
      </div>
    </div>
  );
}

// ── EditSection sub-component ─────────────────────────────────────────────────

function EditSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-b border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        aria-expanded={open}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-3.5 py-3">{children}</div>}
    </div>
  );
}
