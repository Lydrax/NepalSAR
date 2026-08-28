import { describe, it, expect } from 'vitest';
import {
  generateVerificationToken,
  hashVerificationToken,
  verifyTokenMatch,
} from '../src/lib/services/tokenAuth';

describe('Cryptographic Verification Token System', () => {
  it('generates a high entropy non-empty token string', () => {
    const token1 = generateVerificationToken();
    const token2 = generateVerificationToken();
    expect(token1).toMatch(/^nrt_v1_[0-9a-f]{48}$/);
    expect(token2).toMatch(/^nrt_v1_[0-9a-f]{48}$/);
    expect(token1).not.toBe(token2);
  });

  it('produces a standard 64-character hex SHA-256 hash', () => {
    const token = generateVerificationToken();
    const hash = hashVerificationToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifies exact matching token against hash and rejects incorrect token', () => {
    const token = generateVerificationToken();
    const wrongToken = generateVerificationToken();
    const hash = hashVerificationToken(token);

    expect(verifyTokenMatch(token, hash)).toBe(true);
    expect(verifyTokenMatch(wrongToken, hash)).toBe(false);
    expect(verifyTokenMatch('', hash)).toBe(false);
  });
});
