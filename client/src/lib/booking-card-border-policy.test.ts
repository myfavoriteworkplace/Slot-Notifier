import test from "node:test";
import assert from "node:assert/strict";
import { shouldGreyHistoricalBorder } from "./booking-card-border-policy";

const currentBooking = {
  isPast: false,
  isPastDue: false,
  isTerminal: false,
  isCancelled: false,
  isDoctorDeclined: false,
  isNoShowState: false,
  isLeftEarlyState: false,
  isVisitCompleted: false,
  isConfirmed: false,
  isCheckedIn: false,
  isInConsultation: false,
  isTreatmentCompleted: false,
  isAutoNoShow: false,
};

test("greys every booking from a previous date", () => {
  assert.equal(
    shouldGreyHistoricalBorder({
      ...currentBooking,
      isPast: true,
      isConfirmed: true,
    }),
    true,
  );
  assert.equal(
    shouldGreyHistoricalBorder({
      ...currentBooking,
      isPast: true,
      isPastDue: true,
      isTerminal: true,
    }),
    true,
  );
});

test("keeps current non-terminal bookings outside the historical grey treatment", () => {
  assert.equal(shouldGreyHistoricalBorder(currentBooking), false);
});

test("keeps terminal bookings grey even when their date is not past", () => {
  assert.equal(
    shouldGreyHistoricalBorder({
      ...currentBooking,
      isCancelled: true,
      isTerminal: true,
    }),
    true,
  );
});