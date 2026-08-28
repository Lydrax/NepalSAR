import { createHash, randomInt } from 'crypto';

/**
 * Generates an easy-to-remember, pure numeric 6-digit verification PIN (e.g. "583921").
 * Contains no hyphens, letters, or confusing symbols.
 */
export function generateVerificationToken(): string {
  // Generates a cryptographically secure 6-digit integer between 100000 and 999999
  const pin = randomInt(100000, 1000000);
  return pin.toString();
}

/**
 * Generates a clean numeric Case ID without hyphens.
 * Format: 4-digit Year + 6-digit unique numeric sequence/random (e.g. "2026001429").
 */
export function generateNumericCaseNumber(): string {
  const year = new Date().getFullYear().toString();
  const sequenceNum = randomInt(100000, 1000000).toString();
  return `${year}${sequenceNum}`;
}

/**
 * Computes the SHA-256 cryptographic hash of a verification token for secure database storage.
 */
export function hashVerificationToken(token: string): string {
  // Strip any accidental surrounding spaces or dashes
  const clean = token.replace(/[^0-9a-zA-Z]/g, '').trim();
  return createHash('sha256').update(clean).digest('hex');
}

/**
 * Validates a plaintext token against a stored SHA-256 hash.
 */
export function verifyTokenMatch(plainToken: string, storedHash: string): boolean {
  if (!plainToken || !storedHash) return false;
  const computedHash = hashVerificationToken(plainToken);
  return computedHash.toLowerCase() === storedHash.toLowerCase();
}

