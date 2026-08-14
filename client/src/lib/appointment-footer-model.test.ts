import assert from "node:assert/strict";
import test from "node:test";
import { createBusinessDateContext, classifyBooking } from "@shared/booking-status";
import {
  getAppointmentFooterModel,
  type AppointmentFooterModelOptions,
} from "./appointment-footer-model";

const context = createBusinessDateContext(
  new Date("2026-08-10T08:00:00.000Z"),
  "Asia/Kolkata",
);

const makeClassification = (
  overrides: Record<string, unknown> = {},
  role: "owner" | "doctor" = "owner",
) =>
  classifyBooking(
    {
      verificationStatus: "confirmed",
      doctorApprovalStatus: "approved",
      visitStatus: null,
      confirmedBy: "clinic",
      slot: { startTime: "2026-08-10T10:00:00.000+05:30" },
      ...overrides,
    },
    context,
    role,
  );

const ids = (model: ReturnType<typeof getAppointmentFooterModel>) => [
  model.primary?.id,
  ...model.secondary.map((item) => item.id),
];

test("old unresolved clinic bookings resolve first and keep rebook secondary", () => {
  const model = getAppointmentFooterModel(
    makeClassification({
      verificationStatus: "pending",
      confirmedBy: null,
      slot: { startTime: "2026-08-09T10:00:00+05:30" },
    }),
    "clinic",
  );

  assert.deepEqual(ids(model), ["resolve_booking", "rebook"]);
  assert.equal(model.primary?.target, "actions");
  assert.equal(model.policyState, "old_needs_resolution");
});

test("old active clinic visits never replace visit management with rebook", () => {
  const model = getAppointmentFooterModel(
    makeClassification({
      visitStatus: "in_consultation",
      slot: { startTime: "2026-08-09T10:00:00+05:30" },
    }),
    "clinic",
    { totalBillsCount: 1 },
  );

  assert.deepEqual(ids(model), ["manage_visit", "bill"]);
  assert.equal(model.primary?.target, "actions");
  assert.equal(model.policyState, "active_visit");
});

test("completed clinic visits prioritize payment state and keep rebook secondary", () => {
  const unpaid = getAppointmentFooterModel(
    makeClassification({ visitStatus: "completed" }),
    "clinic",
    { totalBillsCount: 2, openBillsCount: 1 },
  );
  const paid = getAppointmentFooterModel(
    makeClassification({ visitStatus: "completed" }),
    "clinic",
    { totalBillsCount: 2, openBillsCount: 0 },
  );
  const noBill = getAppointmentFooterModel(
    makeClassification({ visitStatus: "completed" }),
    "clinic",
    {} satisfies AppointmentFooterModelOptions,
  );

  assert.deepEqual(ids(unpaid), ["settle_payment", "rebook"]);
  assert.deepEqual(ids(paid), ["view_invoice", "rebook"]);
  assert.deepEqual(ids(noBill), ["review_visit", "rebook"]);
});

test("doctor historical records are review-only", () => {
  const old = getAppointmentFooterModel(
    makeClassification(
      { slot: { startTime: "2026-08-09T10:00:00+05:30" } },
      "doctor",
    ),
    "doctor",
  );
  const terminal = getAppointmentFooterModel(
    makeClassification({ verificationStatus: "no_show" }, "doctor"),
    "doctor",
  );

  assert.deepEqual(ids(old), ["review_visit"]);
  assert.deepEqual(ids(terminal), ["review_visit"]);
  assert.equal(old.readOnly, true);
  assert.equal(terminal.readOnly, true);
});

test("doctor active and approval states preserve their clinical actions", () => {
  const approval = getAppointmentFooterModel(
    makeClassification(
      {
        verificationStatus: "pending",
        confirmedBy: null,
        doctorApprovalStatus: "pending",
      },
      "doctor",
    ),
    "doctor",
  );
  const checkedIn = getAppointmentFooterModel(
    makeClassification({ visitStatus: "checked_in" }, "doctor"),
    "doctor",
  );
  const consultation = getAppointmentFooterModel(
    makeClassification({ visitStatus: "in_consultation" }, "doctor"),
    "doctor",
  );

  assert.deepEqual(ids(approval), ["accept", "decline"]);
  assert.deepEqual(ids(checkedIn), ["start_consultation", "add_observation"]);
  assert.deepEqual(ids(consultation), [
    "doctor_complete_visit",
    "add_observation",
    "open_notes",
    "view_edit_prescription",
  ]);
});