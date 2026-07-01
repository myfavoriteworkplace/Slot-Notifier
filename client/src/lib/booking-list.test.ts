import test from "node:test";
import assert from "node:assert/strict";
import { filterAndSortBookings, getBookingActionState, getBookingDisplayMeta, getBookingNumber } from "./booking-list";
import type { BookingWithSlot } from "./clinic-constants";

const createBooking = (overrides: Partial<BookingWithSlot>): BookingWithSlot => ({
  id: 1,
  patientId: 1,
  slot: { startTime: "2024-01-01T10:00:00.000Z" },
  verificationStatus: "pending",
  confirmedBy: null,
  visitStatus: "scheduled",
  ...overrides,
}) as BookingWithSlot;

test("filterAndSortBookings keeps pending bookings ahead of confirmed ones and respects patient filtering", () => {
  const bookings = [
    createBooking({ id: 1, patientId: 1, slot: { startTime: "2024-01-03T10:00:00.000Z" }, verificationStatus: "confirmed", confirmedBy: "doctor" }),
    createBooking({ id: 2, patientId: 2, slot: { startTime: "2024-01-02T10:00:00.000Z" }, verificationStatus: "pending", confirmedBy: null }),
    createBooking({ id: 3, patientId: 1, slot: { startTime: "2024-01-01T10:00:00.000Z" }, verificationStatus: "pending", confirmedBy: null }),
  ];

  const result = filterAndSortBookings({
    bookings,
    quickFilter: "all",
    activePatientFilter: { id: 1, name: "Test Patient" },
    todayStart: new Date("2024-01-01T00:00:00.000Z"),
    todayStr: "2024-01-01",
    thisWeekStart: new Date("2023-12-31T00:00:00.000Z"),
    thisWeekEnd: new Date("2024-01-06T23:59:59.999Z"),
    nextWeekStart: new Date("2024-01-07T00:00:00.000Z"),
    nextWeekEnd: new Date("2024-01-13T23:59:59.999Z"),
    statNext7DaysEnd: new Date("2024-01-08T23:59:59.999Z"),
  });

  assert.deepEqual(result.map((booking) => booking.id), [3, 1]);
});

test("getBookingDisplayMeta groups past, upcoming, and pending states consistently", () => {
  const booking = createBooking({
    slot: { startTime: "2024-01-03T10:00:00.000Z" },
    verificationStatus: "pending",
    confirmedBy: null,
  });

  const meta = getBookingDisplayMeta({ booking, todayStart: new Date("2024-01-01T00:00:00.000Z"), todayStr: "2024-01-01" });

  assert.equal(meta.group, 0);
  assert.equal(meta.timeLabel, "Upcoming");
  assert.equal(meta.statusLabel, "Pending");
});

test("getBookingNumber calculates sequence for bookings on the same date", () => {
  const bookings = [
    createBooking({ id: 1, slot: { startTime: "2024-01-01T10:00:00.000Z" } }),
    createBooking({ id: 2, slot: { startTime: "2024-01-01T11:00:00.000Z" } }),
    createBooking({ id: 3, slot: { startTime: "2024-01-02T10:00:00.000Z" } }),
  ];

  assert.equal(getBookingNumber({ booking: bookings[1], bookings }), "2");
});

test("getBookingActionState disables follow-up actions when booking is already completed", () => {
  const booking = createBooking({
    verificationStatus: "confirmed",
    visitStatus: "completed",
  });

  const state = getBookingActionState({ booking });

  assert.equal(state.canConfirm, false);
  assert.equal(state.canCheckIn, false);
  assert.equal(state.canCompleteVisit, false);
});
