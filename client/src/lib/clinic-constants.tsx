import type { CSSProperties, ComponentType } from "react";
import type { Slot, Booking } from "@shared/schema";
import { Droplets, Wand2, Stethoscope, Baby, Bone, ShieldCheck } from "lucide-react";

export function ToothIcon({ style, className }: { style?: CSSProperties; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={style} className={className} aria-hidden="true">
      <path d="M12 2C9.3 2 8 4.2 8 6c0 .9.2 1.8.5 2.7C9 10 9.5 11.5 9.5 13.5c0 2 .5 4 1 5.5.2.6.5 1 1 1s.8-.4 1-1c.5-1.5 1-3.5 1-5.5 0-2 .5-3.5 1-5.3C15.8 7.8 16 6.9 16 6c0-1.8-1.3-4-4-4z"/>
    </svg>
  );
}

export interface SlotTiming {
  id: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export type SectionConfig = { maxBookings: number; isCancelled: boolean };
export type DayConfig     = { isClosed: boolean; sections: Record<string, SectionConfig> };

export type BookingWithSlot = Booking & {
  slot: Slot;
  description?: string | null;
  assignedDoctor?: string | null;
  assignedDoctorEmail?: string | null;
  doctorApprovalStatus?: string | null;
  doctorNotes?: string | null;
  clinicalStatus?: string | null;
  clinicDoctors?: { name: string; specialization: string; degree: string; email?: string }[];
  patientCode?: string | null;
};

export const OVERVIEW_VISIT_TYPE_LABELS: Record<string, string> = {
  first_visit:       "First Visit",
  follow_up:         "Follow Up",
  emergency:         "Emergency",
  routine_checkup:   "Routine Checkup",
  consultation:      "Consultation",
  review:            "Review",
  booked_by_patient: "Booked by Patient",
};

export const OVERVIEW_CLINICAL_STATUS: Record<string, { label: string; cls: string }> = {
  first_visit:        { label: "First Visit",        cls: "bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800" },
  revisit:            { label: "Revisit",            cls: "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800" },
  follow_up_required: { label: "Follow-up Required", cls: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  case_closed:        { label: "Case Closed",        cls: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
};

export const DEFAULT_SLOT_TIMINGS: SlotTiming[] = [
  { id: "1", label: "Early Morning", startHour: 8,  startMinute: 0,  endHour: 10, endMinute: 0  },
  { id: "2", label: "Late Morning",  startHour: 10, startMinute: 0,  endHour: 12, endMinute: 30 },
  { id: "3", label: "Midday",        startHour: 12, startMinute: 30, endHour: 14, endMinute: 0  },
  { id: "4", label: "Afternoon",     startHour: 14, startMinute: 0,  endHour: 17, endMinute: 0  },
  { id: "5", label: "Evening",       startHour: 17, startMinute: 0,  endHour: 19, endMinute: 30 },
];

export const DEFAULT_SECTION_CAPACITY: Record<string, number> = { "1": 4, "2": 6, "3": 3, "4": 7, "5": 6 };

export const PROCEDURE_SLOT_COST: Record<string, number> = {
  "Consultation":                1,
  "Diagnostics":                 1,
  "Cleaning / Preventive":       2,
  "Fillings / Minor Restorations": 2,
  "Major Procedures":            3,
};

export const DENTAL_CATEGORIES: Array<{ category: string; Icon: ComponentType<{ className?: string }>; subIssues: string[]; specialists: string[] }> = [
  { category: "Tooth Pain or Sensitivity",        Icon: ToothIcon,   subIssues: ["Sensitivity to hot/cold/sweet", "Sharp or throbbing pain", "Pain while chewing", "Pain at night"],                   specialists: ["Endodontist", "General Dentist"] },
  { category: "Gum Problems",                     Icon: Droplets,    subIssues: ["Bleeding gums", "Swollen or red gums", "Receding gums", "Bad breath or bad taste"],                                specialists: ["Periodontist", "General Dentist"] },
  { category: "Tooth Decay / Cavities",           Icon: ToothIcon,   subIssues: ["Visible hole or black spot", "Pain when eating or drinking", "Food getting stuck"],                                 specialists: ["General Dentist", "Endodontist"] },
  { category: "Broken, Chipped or Cracked Tooth", Icon: ToothIcon,   subIssues: ["Chipped or broken tooth", "Cracked tooth", "Worn down teeth"],                                                      specialists: ["Prosthodontist", "General Dentist"] },
  { category: "Alignment or Bite Issues",         Icon: ToothIcon,   subIssues: ["Crooked or crowded teeth", "Gaps between teeth", "Bite feels off or jaw discomfort"],                               specialists: ["Orthodontist"] },
  { category: "Missing Teeth",                    Icon: ToothIcon,   subIssues: ["One tooth missing", "Multiple teeth missing", "Want replacement options"],                                          specialists: ["Prosthodontist", "Oral Surgeon"] },
  { category: "Cosmetic / Smile Concerns",        Icon: Wand2,       subIssues: ["Yellow or stained teeth", "Want a whiter smile", "Uneven teeth shape", "Gaps I want closed"],                      specialists: ["Cosmetic Dentist", "Prosthodontist"] },
  { category: "Swelling or Infection",            Icon: Stethoscope, subIssues: ["Swollen face or gum", "Pus or abscess", "Severe pain with swelling"],                                              specialists: ["Endodontist", "Oral Surgeon", "General Dentist"] },
  { category: "Child's Dental Issues",            Icon: Baby,        subIssues: ["Tooth decay in baby teeth", "Child complains of pain", "Thumb sucking habits", "Delayed tooth eruption"],         specialists: ["Pedodontist"] },
  { category: "Jaw Pain or Other",                Icon: Bone,        subIssues: ["Jaw pain or clicking (TMJ)", "Dry mouth", "Mouth ulcers", "Suspicious growth or lump"],                            specialists: ["Oral Medicine Specialist", "Oral Surgeon", "General Dentist"] },
  { category: "Wisdom Tooth Problems",            Icon: ToothIcon,   subIssues: ["Pain from wisdom tooth", "Swelling near wisdom tooth", "Difficulty opening mouth"],                               specialists: ["Oral Surgeon", "General Dentist"] },
  { category: "Preventive / Routine Care",        Icon: ShieldCheck, subIssues: ["Regular checkup", "Cleaning or scaling", "Fluoride treatment"],                                                    specialists: ["General Dentist", "Dental Hygienist"] },
];

export const CHIEF_COMPLAINTS = DENTAL_CATEGORIES.flatMap(c => c.subIssues);

export function getRecommendedSpecialists(descriptionText: string): string[] {
  if (!descriptionText) return [];
  const selectedIssues = descriptionText.split(", ").map(s => s.trim().toLowerCase());
  const matched = new Set<string>();
  DENTAL_CATEGORIES.forEach(cat => {
    const hasMatch = cat.subIssues.some(s => selectedIssues.includes(s.toLowerCase()));
    if (hasMatch) cat.specialists.forEach(sp => matched.add(sp));
  });
  return Array.from(matched);
}
