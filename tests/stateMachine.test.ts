import { describe, it, expect } from 'vitest';
import { isValidStateTransition } from '../src/lib/services/stateMachine';

describe('Rescue Case State Transition Validator', () => {
  it('allows standard sequential forward transitions', () => {
    expect(isValidStateTransition('SUBMITTED', 'VERIFIED')).toBe(true);
    expect(isValidStateTransition('VERIFIED', 'ASSIGNED')).toBe(true);
    expect(isValidStateTransition('ASSIGNED', 'RESCUER_EN_ROUTE')).toBe(true);
    expect(isValidStateTransition('RESCUER_EN_ROUTE', 'RESCUED')).toBe(true);
    expect(isValidStateTransition('RESCUED', 'CLOSED')).toBe(true);
  });

  it('allows cancellation from active intermediate states', () => {
    expect(isValidStateTransition('SUBMITTED', 'CANCELLED')).toBe(true);
    expect(isValidStateTransition('VERIFIED', 'CANCELLED')).toBe(true);
    expect(isValidStateTransition('ASSIGNED', 'CANCELLED')).toBe(true);
    expect(isValidStateTransition('RESCUER_EN_ROUTE', 'CANCELLED')).toBe(true);
    expect(isValidStateTransition('CANCELLED', 'CLOSED')).toBe(true);
  });

  it('blocks invalid or skipping transitions', () => {
    // Skipping verification directly to rescued
    expect(isValidStateTransition('SUBMITTED', 'RESCUED')).toBe(false);
    expect(isValidStateTransition('SUBMITTED', 'RESCUER_EN_ROUTE')).toBe(false);

    // Backward transition
    expect(isValidStateTransition('RESCUED', 'SUBMITTED')).toBe(false);
    expect(isValidStateTransition('ASSIGNED', 'SUBMITTED')).toBe(false);

    // Transitions out of CLOSED terminal state
    expect(isValidStateTransition('CLOSED', 'SUBMITTED')).toBe(false);
    expect(isValidStateTransition('CLOSED', 'ASSIGNED')).toBe(false);
  });
});
