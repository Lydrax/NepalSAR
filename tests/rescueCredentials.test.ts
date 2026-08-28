import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getRescueCredentialsByCaseNumber,
  getRescueCredentialsByClientRequestId,
  saveRescueCredentials,
} from '../src/lib/client/rescueCredentials';

describe('Rescue credential local persistence', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores credentials by client request ID and case number', () => {
    const clientRequestId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const caseNumber = 'NR-2026-000184';
    const token = 'nrt_v1_exampletoken';

    saveRescueCredentials(clientRequestId, caseNumber, token);

    expect(getRescueCredentialsByCaseNumber(caseNumber)).toBe(token);
    expect(getRescueCredentialsByClientRequestId(clientRequestId)).toEqual({
      caseNumber,
      verificationToken: token,
      savedAt: expect.any(String),
    });
  });

  it('recovers credentials for idempotent resubmission on the same device', () => {
    const clientRequestId = 'c4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f';
    const caseNumber = 'NR-2026-000185';
    const token = 'nrt_v1_recoveredtoken';

    saveRescueCredentials(clientRequestId, caseNumber, token);

    const recovered = getRescueCredentialsByClientRequestId(clientRequestId);
    expect(recovered?.verificationToken).toBe(token);
    expect(recovered?.caseNumber).toBe(caseNumber);
  });

  it('returns null when credentials were never saved on this device', () => {
    expect(
      getRescueCredentialsByClientRequestId('00000000-0000-4000-8000-000000000000')
    ).toBeNull();
    expect(getRescueCredentialsByCaseNumber('NR-2026-000999')).toBeNull();
  });
});
