export interface ClinicMonitoringPeriod {
  from: string;
  to: string;
  timezone: "clinic-local";
}

export interface ClinicMonitoringSummary {
  activeClinicCount: number;
  externalBookingCount: number;
  internalBookingCount: number;
  unclassifiedBookingCount: number;
  totalBookingCount: number;
  scheduledHours: number;
  observedVisitHours: number;
  averageObservedVisitMinutes: number | null;
}

export interface ClinicMonitoringTrendPoint {
  date: string;
  activeClinicCount: number;
  externalBookings: number;
  internalBookings: number;
  unclassifiedBookings: number;
  totalBookings: number;
}

export interface ClinicMonitoringClinicRow {
  clinicId: number;
  clinicName: string;
  plan: string | null;
  subscriptionStatus: string | null;
  timezone: string;
  activeDays: number;
  externalBookings: number;
  internalBookings: number;
  unclassifiedBookings: number;
  totalBookings: number;
  scheduledHours: number;
  observedVisitHours: number;
  averageObservedVisitMinutes: number | null;
  cancellationRate: number | null;
  noShowRate: number | null;
  lastActiveDate: string | null;
  changePercent: number | null;
  anomalousVisitDurationCount: number;
}

export interface ClinicMonitoringResponse {
  period: ClinicMonitoringPeriod;
  summary: ClinicMonitoringSummary;
  trend: ClinicMonitoringTrendPoint[];
  clinics: ClinicMonitoringClinicRow[];
}