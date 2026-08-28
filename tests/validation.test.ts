import { describe, it, expect } from 'vitest';
import { validateRescueRequestPayload } from '../src/lib/validation/rescueRequest';

describe('Rescue Request Server-side Validation', () => {
  const validUUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  const validBasePayload = {
    clientRequestId: validUUID,
    peopleCount: 3,
    situation: 'trapped',
    injuryLevel: 'serious',
    disasterType: 'flood',
    location: {
      latitude: 27.7172,
      longitude: 85.324,
      accuracy: 15,
      source: 'GPS',
      timestamp: new Date().toISOString(),
    },
    description: 'Trapped on second floor.',
    phoneNumber: '+9779812345678',
  };

  it('accepts a fully valid payload with GPS coordinates', () => {
    const res = validateRescueRequestPayload(validBasePayload);
    expect(res.success).toBe(true);
    expect(res.data?.peopleCount).toBe(3);
    expect(res.data?.situation).toBe('trapped');
  });

  it('accepts a valid payload with manual location description when GPS is null', () => {
    const payload = {
      ...validBasePayload,
      location: {
        latitude: null,
        longitude: null,
        accuracy: null,
        source: 'MANUAL',
        manualDescription: 'Near Timure bridge, Rasuwa.',
      },
    };
    const res = validateRescueRequestPayload(payload);
    expect(res.success).toBe(true);
    expect(res.data?.location.source).toBe('MANUAL');
    expect(res.data?.location.manualDescription).toBe('Near Timure bridge, Rasuwa.');
  });

  it('rejects payload when both coordinates and manual description are missing', () => {
    const payload = {
      ...validBasePayload,
      location: {
        latitude: null,
        longitude: null,
        accuracy: null,
        source: 'GPS',
        manualDescription: '',
      },
    };
    const res = validateRescueRequestPayload(payload);
    expect(res.success).toBe(false);
    expect(res.errors).toContain(
      'You must provide either valid GPS coordinates or a descriptive location text.'
    );
  });

  it('rejects invalid people count (< 1, > 100, float)', () => {
    expect(validateRescueRequestPayload({ ...validBasePayload, peopleCount: 0 }).success).toBe(false);
    expect(validateRescueRequestPayload({ ...validBasePayload, peopleCount: 101 }).success).toBe(false);
    expect(validateRescueRequestPayload({ ...validBasePayload, peopleCount: 2.5 }).success).toBe(false);
  });

  it('rejects invalid latitude and longitude ranges', () => {
    const res1 = validateRescueRequestPayload({
      ...validBasePayload,
      location: { ...validBasePayload.location, latitude: 95.0 },
    });
    expect(res1.success).toBe(false);
    expect(res1.errors).toContain('latitude must be between -90 and 90 degrees.');

    const res2 = validateRescueRequestPayload({
      ...validBasePayload,
      location: { ...validBasePayload.location, longitude: 185.0 },
    });
    expect(res2.success).toBe(false);
    expect(res2.errors).toContain('longitude must be between -180 and 180 degrees.');
  });

  it('rejects invalid situation and injury enums', () => {
    const res = validateRescueRequestPayload({
      ...validBasePayload,
      situation: 'invalid_situation',
      injuryLevel: 'fatal',
    });
    expect(res.success).toBe(false);
  });

  it('rejects malformed clientRequestId (non-UUID)', () => {
    const res = validateRescueRequestPayload({
      ...validBasePayload,
      clientRequestId: 'not-a-uuid-1234',
    });
    expect(res.success).toBe(false);
    expect(res.errors).toContain('clientRequestId must be a valid UUIDv4.');
  });
});
