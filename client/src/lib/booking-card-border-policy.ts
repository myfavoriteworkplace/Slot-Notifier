export interface BookingCardBorderPolicyInput {
  isPast: boolean;
  isPastDue: boolean;
  isTerminal: boolean;
  isCancelled: boolean;
  isDoctorDeclined: boolean;
  isNoShowState: boolean;
  isLeftEarlyState: boolean;
  isVisitCompleted: boolean;
  isConfirmed: boolean;
  isCheckedIn: boolean;
  isInConsultation: boolean;
  isTreatmentCompleted: boolean;
  isAutoNoShow: boolean;
}

export function shouldGreyHistoricalBorder({
  isPast,
  isCancelled,
  isDoctorDeclined,
  isNoShowState,
  isLeftEarlyState,
  isVisitCompleted,
}: BookingCardBorderPolicyInput): boolean {
  // Every booking from a previous date is historical, regardless of its
  // unresolved or terminal lifecycle state. Keep status colours in badges and
  // internal indicators; only the card-level treatment becomes neutral.
  if (isPast) return true;

  if (
    isCancelled ||
    isDoctorDeclined ||
    isNoShowState ||
    isLeftEarlyState ||
    isVisitCompleted
  ) {
    return true;
  }

  return false;
}
