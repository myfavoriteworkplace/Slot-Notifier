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
  isPastDue,
  isTerminal,
  isCancelled,
  isDoctorDeclined,
  isNoShowState,
  isLeftEarlyState,
  isVisitCompleted,
  isConfirmed,
  isCheckedIn,
  isInConsultation,
  isTreatmentCompleted,
  isAutoNoShow,
}: BookingCardBorderPolicyInput): boolean {
  if (
    isCancelled ||
    isDoctorDeclined ||
    isNoShowState ||
    isLeftEarlyState ||
    isVisitCompleted
  ) {
    return true;
  }

  return isPast &&
    !isPastDue &&
    !isConfirmed &&
    !isCheckedIn &&
    !isInConsultation &&
    !isTreatmentCompleted &&
    !isAutoNoShow &&
    !isTerminal;
}
