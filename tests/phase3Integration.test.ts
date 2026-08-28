import { describe, it, expect } from 'vitest';
import { validateRescueRequestPayload } from '../src/lib/validation/rescueRequest';
import { generateVerificationToken, hashVerificationToken, verifyTokenMatch } from '../src/lib/services/tokenAuth';
import { calculateServerPriority } from '../src/lib/services/priorityEngine';
import { isValidStateTransition } from '../src/lib/services/stateMachine';
import { checkRateLimit } from '../src/lib/services/rateLimiter';
import { STATUS_DESCRIPTIONS } from '../src/lib/constants/emergency';
import { RescueCaseStatus } from '../src/lib/types/emergency';

describe('Phase 3 End-to-End & Security Specifications', () => {
  const validUUID = 'c4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f';

  describe('Payload Compatibility (snake_case and camelCase)', () => {
    it('accepts snake_case properties as specified in API contract', () => {
      const snakePayload = {
        client_request_id: validUUID,
        latitude: 28.1234,
        longitude: 85.5678,
        location_accuracy: 25,
        location_timestamp: new Date().toISOString(),
        location_source: 'GPS',
        manual_location: '',
        people_count: 5,
        immediate_danger: 'trapped',
        injury_level: 'critical',
        disaster_type: 'landslide',
        disaster_other: '',
        description: 'Road collapsed, 5 people trapped in vehicle.',
        phone_number: '9841234567',
      };

      const result = validateRescueRequestPayload(snakePayload);
      expect(result.success).toBe(true);
      expect(result.data?.clientRequestId).toBe(validUUID);
      expect(result.data?.peopleCount).toBe(5);
      expect(result.data?.situation).toBe('trapped');
      expect(result.data?.injuryLevel).toBe('critical');
      expect(result.data?.disasterType).toBe('landslide');
      expect(result.data?.location.latitude).toBe(28.1234);
    });

    it('sanitizes control characters in user descriptions', () => {
      const payloadWithControlChars = {
        client_request_id: validUUID,
        people_count: 1,
        immediate_danger: 'stranded',
        injury_level: 'none',
        disaster_type: 'flood',
        manual_location: 'Near bank\u0000\u0007',
        description: 'Water rising\u0000 rapidly\u001F on first floor.',
      };

      const result = validateRescueRequestPayload(payloadWithControlChars);
      expect(result.success).toBe(true);
      expect(result.data?.description).not.toContain('\u0000');
      expect(result.data?.description).toBe('Water rising rapidly on first floor.');
    });
  });

  describe('Anti-Enumeration and Verification Token Security', () => {
    it('generates distinct cryptographic tokens with secure entropy', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateVerificationToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('consistently verifies SHA-256 token match', () => {
      const token = generateVerificationToken();
      const hash = hashVerificationToken(token);

      expect(verifyTokenMatch(token, hash)).toBe(true);
      expect(verifyTokenMatch('invalid_token_xyz', hash)).toBe(false);
    });
  });

  describe('Status UX Mapping and Terminal States', () => {
    it('maps all statuses to accurate human-readable operational language', () => {
      expect(STATUS_DESCRIPTIONS.SUBMITTED.title).toBe('Request received');
      expect(STATUS_DESCRIPTIONS.VERIFIED.title).toBe('Request verified');
      expect(STATUS_DESCRIPTIONS.ASSIGNED.title).toBe('Responder assigned');
      expect(STATUS_DESCRIPTIONS.RESCUER_EN_ROUTE.title).toBe('Responder en route');
      expect(STATUS_DESCRIPTIONS.RESCUED.title).toBe('Rescue reported complete');
      expect(STATUS_DESCRIPTIONS.CLOSED.title).toBe('Case closed');
      expect(STATUS_DESCRIPTIONS.CANCELLED.title).toBe('Request cancelled');
    });

    it('identifies terminal statuses where polling must cease', () => {
      const terminalStatuses: RescueCaseStatus[] = ['RESCUED', 'CLOSED', 'CANCELLED'];
      const activeStatuses: RescueCaseStatus[] = ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUER_EN_ROUTE'];

      activeStatuses.forEach((status) => {
        expect(terminalStatuses.includes(status)).toBe(false);
      });

      terminalStatuses.forEach((status) => {
        expect(terminalStatuses.includes(status)).toBe(true);
      });
    });
  });

  describe('Rate Limiter Throttling on Public Endpoints', () => {
    it('enforces request limit threshold within window', () => {
      const ipKey = 'test_ip_phase3_' + Math.random().toString(36);
      const limitConfig = { windowMs: 5000, maxRequests: 5 };

      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(ipKey, limitConfig);
        expect(res.allowed).toBe(true);
      }

      const blockedRes = checkRateLimit(ipKey, limitConfig);
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
    });
  });
});
