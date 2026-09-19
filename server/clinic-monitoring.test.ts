import assert from "node:assert/strict";
import test from "node:test";
import { buildClinicMonitoringReport } from "./clinic-monitoring";

const clinics = [{
  id: 1,
  name: "Alpha Dental",
  plan: "starter",
  subscriptionStatus: "active",
  timezone: "Asia/Kolkata",
}];

test("aggregates public and clinic-created bookings without exposing row data", () => {
  const report = buildClinicMonitoringReport(clinics, [
    {
      clinicId: 1,
      slotId: 10,
      bookingId: 100,
      slotStart: "2026-09-10T04:30:00.000Z",
      slotEnd: "2026-09-10T05:30:00.000Z",
      slotCancelled: false,
      bookedBy: "patient",
      verificationStatus: "confirmed",
      checkedInAt: "2026-09-10T04:35:00.000Z",
      completedAt: "2026-09-10T05:05:00.000Z",
    },
    {
      clinicId: 1,
      slotId: 10,
      bookingId: 101,
      slotStart: "2026-09-10T04:30:00.000Z",
      slotEnd: "2026-09-10T05:30:00.000Z",
      slotCancelled: false,
      bookedBy: "admin",
      verificationStatus: "no_show",
      checkedInAt: null,
      completedAt: null,
    },
  ], { from: "2026-09-10", to: "2026-09-10" });

  assert.equal(report.summary.externalBookingCount, 1);
  assert.equal(report.summary.internalBookingCount, 1);
  assert.equal(report.summary.totalBookingCount, 2);
  assert.equal(report.summary.scheduledHours, 1);
  assert.equal(report.clinics[0].noShowRate, 50);
  assert.equal(report.clinics[0].averageObservedVisitMinutes, 30);
  assert.equal(report.trend[0].totalBookings, 2);
  assert.equal("bookingId" in report.clinics[0], false);
  assert.equal("patientId" in report.clinics[0], false);
});

test("keeps cancelled slots out of scheduled hours and excludes extreme durations", () => {
  const report = buildClinicMonitoringReport(clinics, [
    {
      clinicId: 1,
      slotId: 20,
      bookingId: 200,
      slotStart: "2026-09-10T04:30:00.000Z",
      slotEnd: "2026-09-10T05:30:00.000Z",
      slotCancelled: true,
      bookedBy: "patient",
      verificationStatus: "cancelled",
      checkedInAt: "2026-09-10T04:30:00.000Z",
      completedAt: "2026-09-11T05:30:00.000Z",
    },
  ], { from: "2026-09-10", to: "2026-09-10" });

  assert.equal(report.summary.scheduledHours, 0);
  assert.equal(report.summary.observedVisitHours, 0);
  assert.equal(report.clinics[0].anomalousVisitDurationCount, 1);
  assert.equal(report.clinics[0].cancellationRate, 100);
});

test("calculates previous-period change for a clinic", () => {
  const report = buildClinicMonitoringReport(clinics, [
    {
      clinicId: 1,
      slotId: 30,
      bookingId: 300,
      slotStart: "2026-09-10T04:30:00.000Z",
      slotEnd: "2026-09-10T05:30:00.000Z",
      slotCancelled: false,
      bookedBy: "patient",
      verificationStatus: "confirmed",
      checkedInAt: null,
      completedAt: null,
    },
    {
      clinicId: 1,
      slotId: 31,
      bookingId: 301,
      slotStart: "2026-09-09T04:30:00.000Z",
      slotEnd: "2026-09-09T05:30:00.000Z",
      slotCancelled: false,
      bookedBy: "patient",
      verificationStatus: "confirmed",
      checkedInAt: null,
      completedAt: null,
    },
  ], { from: "2026-09-10", to: "2026-09-10" });

  assert.equal(report.clinics[0].changePercent, 0);
});