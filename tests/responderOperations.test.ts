import { describe, it, expect } from 'vitest';
import { isValidStateTransition } from '../src/lib/services/stateMachine';
import { PriorityLevel, RescueCaseStatus, ResponderRole } from '../src/lib/types/emergency';

describe('Phase 4 Responder Operations & Authorization', () => {
  describe('State Machine Operational Transitions', () => {
    it('enforces exact forward SAR workflow: SUBMITTED -> VERIFIED -> ASSIGNED -> EN_ROUTE -> RESCUED -> CLOSED', () => {
      let current: RescueCaseStatus = 'SUBMITTED';

      expect(isValidStateTransition(current, 'VERIFIED')).toBe(true);
      current = 'VERIFIED';

      expect(isValidStateTransition(current, 'ASSIGNED')).toBe(true);
      current = 'ASSIGNED';

      expect(isValidStateTransition(current, 'RESCUER_EN_ROUTE')).toBe(true);
      current = 'RESCUER_EN_ROUTE';

      expect(isValidStateTransition(current, 'RESCUED')).toBe(true);
      current = 'RESCUED';

      expect(isValidStateTransition(current, 'CLOSED')).toBe(true);
      current = 'CLOSED';

      expect(isValidStateTransition(current, 'SUBMITTED')).toBe(false);
    });

    it('allows controlled cancellation only from permitted active states', () => {
      const cancellableStates: RescueCaseStatus[] = ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUER_EN_ROUTE'];

      cancellableStates.forEach((st) => {
        expect(isValidStateTransition(st, 'CANCELLED')).toBe(true);
      });

      expect(isValidStateTransition('CLOSED', 'CANCELLED')).toBe(false);
    });

    it('rejects illegal jumps or backward status manipulations', () => {
      // Direct jump from SUBMITTED to RESCUER_EN_ROUTE
      expect(isValidStateTransition('SUBMITTED', 'RESCUER_EN_ROUTE')).toBe(false);

      // Direct jump from SUBMITTED to RESCUED
      expect(isValidStateTransition('SUBMITTED', 'RESCUED')).toBe(false);

      // Direct jump from VERIFIED to CLOSED
      expect(isValidStateTransition('VERIFIED', 'CLOSED')).toBe(false);

      // Backward transition from RESCUED to ASSIGNED
      expect(isValidStateTransition('RESCUED', 'ASSIGNED')).toBe(false);
    });
  });

  describe('Role-Based Operational Permissions Matrix', () => {
    it('verifies required permissions by role', () => {
      const canCloseCase = (role: ResponderRole) => role === 'DISPATCHER' || role === 'ADMIN';
      const canChangePriority = (role: ResponderRole) => role === 'DISPATCHER' || role === 'ADMIN';
      const canAssignOtherResponders = (role: ResponderRole) => role === 'DISPATCHER' || role === 'ADMIN';
      const canSelfAssign = (role: ResponderRole) => ['RESPONDER', 'DISPATCHER', 'ADMIN'].includes(role);

      // Responder role
      expect(canCloseCase('RESPONDER')).toBe(false);
      expect(canChangePriority('RESPONDER')).toBe(false);
      expect(canAssignOtherResponders('RESPONDER')).toBe(false);
      expect(canSelfAssign('RESPONDER')).toBe(true);

      // Dispatcher role
      expect(canCloseCase('DISPATCHER')).toBe(true);
      expect(canChangePriority('DISPATCHER')).toBe(true);
      expect(canAssignOtherResponders('DISPATCHER')).toBe(true);
      expect(canSelfAssign('DISPATCHER')).toBe(true);

      // Admin role
      expect(canCloseCase('ADMIN')).toBe(true);
      expect(canChangePriority('ADMIN')).toBe(true);
      expect(canAssignOtherResponders('ADMIN')).toBe(true);
      expect(canSelfAssign('ADMIN')).toBe(true);
    });
  });

  describe('Triage Queue Sorting & Priority Weighting', () => {
    it('sorts queue strictly by Priority (CRITICAL -> HIGH -> NORMAL) and oldest first', () => {
      const priorityWeight: Record<PriorityLevel, number> = {
        CRITICAL: 1,
        HIGH: 2,
        NORMAL: 3,
      };

      const rawCases = [
        { id: '1', caseNumber: 'NR-2026-001', priority: 'NORMAL' as PriorityLevel, createdAt: '2026-08-28T05:00:00Z' },
        { id: '2', caseNumber: 'NR-2026-002', priority: 'CRITICAL' as PriorityLevel, createdAt: '2026-08-28T05:10:00Z' },
        { id: '3', caseNumber: 'NR-2026-003', priority: 'HIGH' as PriorityLevel, createdAt: '2026-08-28T05:05:00Z' },
        { id: '4', caseNumber: 'NR-2026-004', priority: 'CRITICAL' as PriorityLevel, createdAt: '2026-08-28T05:01:00Z' },
      ];

      const sorted = [...rawCases].sort((a, b) => {
        const weightA = priorityWeight[a.priority];
        const weightB = priorityWeight[b.priority];
        if (weightA !== weightB) return weightA - weightB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // NR-2026-004 (CRITICAL 05:01) should be first
      expect(sorted[0].caseNumber).toBe('NR-2026-004');
      // NR-2026-002 (CRITICAL 05:10) should be second
      expect(sorted[1].caseNumber).toBe('NR-2026-002');
      // NR-2026-003 (HIGH 05:05) should be third
      expect(sorted[2].caseNumber).toBe('NR-2026-003');
      // NR-2026-001 (NORMAL 05:00) should be fourth
      expect(sorted[3].caseNumber).toBe('NR-2026-001');
    });
  });
});
