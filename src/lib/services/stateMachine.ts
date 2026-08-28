import { RescueCaseStatus } from '../types/emergency';

/**
 * Valid operational state transitions.
 * Arbitrary transitions are blocked.
 */
export const ALLOWED_TRANSITIONS: Record<RescueCaseStatus, RescueCaseStatus[]> = {
  SUBMITTED: ['VERIFIED', 'CANCELLED'],
  VERIFIED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['RESCUER_EN_ROUTE', 'CANCELLED'],
  RESCUER_EN_ROUTE: ['RESCUED', 'CANCELLED'],
  RESCUED: ['CLOSED'],
  CANCELLED: ['CLOSED'],
  CLOSED: [], // Terminal state
};

/**
 * Validates whether a proposed status transition is permitted by SAR workflow rules.
 */
export function isValidStateTransition(
  currentStatus: RescueCaseStatus,
  targetStatus: RescueCaseStatus
): boolean {
  if (currentStatus === targetStatus) {
    return true; // No-op transition
  }
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus];
  return allowedNext ? allowedNext.includes(targetStatus) : false;
}
