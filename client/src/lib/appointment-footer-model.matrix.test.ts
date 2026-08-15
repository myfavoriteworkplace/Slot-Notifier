import assert from "node:assert/strict";
import test from "node:test";
import { createBusinessDateContext, classifyBooking } from "@shared/booking-status";
import { getAppointmentFooterModel } from "./appointment-footer-model";

const context = createBusinessDateContext(
  new Date("2026-08-10T08:00:00.000Z"),
  "Asia/Kolkata",
);

type BookingOverrides = Record<string, unknown>;

const makeBooking = (overrides: BookingOverrides = {}) => ({
  verificationStatus: "confirmed",
  doctorApprovalStatus: "approved",
  visitStatus: null,
  confirmedBy: "clinic",
  slot: { startTime: "2026-08-10T15:00:00+05:30" },
  ...overrides,
});

const actionIds = (role: "clinic" | "doctor", overrides: BookingOverrides = {}, options = {}) => {
  const classification = classifyBooking(
    makeBooking(overrides),
    context,
    role === "clinic" ? "owner" : "doctor",
  );
  const model = getAppointmentFooterModel(classification, role, options);
  return {
    policyState: model.policyState,
    readOnly: model.readOnly,
    ids: [
      ...(model.primary ? [model.primary.id] : []),
      ...model.secondary.map((action) => action.id),
    ],
  };
};

test("clinic footer covers every documented lifecycle row", () => {
  const cases: Array<[string, BookingOverrides, string[], Record<string, number>?]> = [
    [
      "future pending",
      {
        verificationStatus: "pending",
        confirmedBy: null,
        slot: { startTime: "2026-08-11T10:00:00+05:30" },
      },
      ["confirm", "cancel"],
    ],
    [
      "future confirmed",
      { slot: { startTime: "2026-08-11T10:00:00+05:30" } },
      ["mark_arrived", "remind"],
    ],
    [
      "same-day past due",
      { slot: { startTime: "2026-08-10T07:00:00+05:30" } },
      ["resolve_booking"],
    ],
    [
      "old unresolved",
      {
        verificationStatus: "pending",
        confirmedBy: null,
        slot: { startTime: "2026-08-09T10:00:00+05:30" },
      },
      ["resolve_booking", "rebook"],
    ],
    [
      "old active",
      {
        visitStatus: "in_consultation",
        slot: { startTime: "2026-08-09T10:00:00+05:30" },
      },
      ["manage_visit", "bill"],
      { totalBillsCount: 1 },
    ],
    [
      "old treatment completed",
      {
        visitStatus: "treatment_completed",
        slot: { startTime: "2026-08-09T10:00:00+05:30" },
      },
      ["mark_visit_done", "bill"],
    ],
    [
      "active checked-in",
      { visitStatus: "checked_in" },
      ["manage_visit", "bill"],
    ],
    [
      "treatment completed",
      { visitStatus: "treatment_completed" },
      ["mark_visit_done", "bill"],
    ],
    [
      "completed unpaid",
      { visitStatus: "completed" },
      ["settle_payment", "rebook"],
      { totalBillsCount: 1, openBillsCount: 1 },
    ],
    [
      "completed paid",
      { visitStatus: "completed" },
      ["view_invoice", "rebook"],
      { totalBillsCount: 1, openBillsCount: 0 },
    ],
    [
      "completed without bill",
      { visitStatus: "completed" },
      ["review_visit", "rebook"],
    ],
    [
      "terminal no-show",
      { verificationStatus: "no_show" },
      ["rebook"],
    ],
    [
      "batch no-show with billing",
      { verificationStatus: "no_show" },
      ["rebook", "revert_no_show", "bill"],
      { totalBillsCount: 1, noShowSource: "batch_admin" },
    ],
    [
      "unknown date",
      { slot: null },
      ["resolve_booking"],
    ],
  ];

  for (const [name, overrides, expected, options] of cases) {
    const result = actionIds("clinic", overrides, options);
    assert.deepEqual(result.ids, expected, name);
    assert.equal(result.readOnly, false, name);
  }
});

test("doctor footer covers approval, clinical, historical, and terminal rows", () => {
  const cases: Array<[string, BookingOverrides, string[], boolean]> = [
    [
      "awaiting approval",
      {
        verificationStatus: "pending",
        confirmedBy: null,
        doctorApprovalStatus: "pending",
        slot: { startTime: "2026-08-11T10:00:00+05:30" },
      },
      ["accept", "decline"],
      false,
    ],
    [
      "checked in",
      { visitStatus: "checked_in" },
      ["start_consultation", "add_observation"],
      false,
    ],
    [
      "in consultation",
      { visitStatus: "in_consultation" },
      ["doctor_complete_visit", "add_observation", "open_notes", "view_edit_prescription"],
      false,
    ],
    [
      "treatment completed",
      { visitStatus: "treatment_completed" },
      ["view_edit_prescription"],
      false,
    ],
    [
      "completed",
      { visitStatus: "completed" },
      ["review_visit"],
      true,
    ],
    [
      "old unresolved",
      { slot: { startTime: "2026-08-09T10:00:00+05:30" } },
      ["review_visit"],
      true,
    ],
    [
      "same-day past due",
      { slot: { startTime: "2026-08-10T07:00:00+05:30" } },
      ["review_visit"],
      true,
    ],
    [
      "doctor declined",
      { doctorApprovalStatus: "declined" },
      ["review_visit"],
      true,
    ],
    [
      "terminal",
      { verificationStatus: "cancelled" },
      ["review_visit"],
      true,
    ],
    [
      "unknown date",
      { slot: null },
      ["review_visit"],
      true,
    ],
    [
      "other non-terminal appointment",
      { slot: { startTime: "2026-08-11T10:00:00+05:30" } },
      ["review_appointment"],
      false,
    ],
  ];

  for (const [name, overrides, expected, readOnly] of cases) {
    const result = actionIds("doctor", overrides);
    assert.deepEqual(result.ids, expected, name);
    assert.equal(result.readOnly, readOnly, name);
  }
});