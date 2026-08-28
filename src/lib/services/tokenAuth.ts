import { createHash, randomBytes } from 'crypto';

/**
 * Generates a high-entropy, cryptographically secure verification token.
 * Example format: "nrt_v1_7f8a9b2c..."
 */
export function generateVerificationToken(): string {
  const bytes = randomBytes(24).toString('hex');
  return `nrt_v1_${bytes}`;
}

/**
 * Computes the SHA-256 cryptographic hash of a verification token for secure database storage.
 */
export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Validates a plaintext token against a stored SHA-256 hash.
 */
export function verifyTokenMatch(plainToken: string, storedHash: string): boolean {
  if (!plainToken || !storedHash) return false;
  const computedHash = hashVerificationToken(plainToken);
  return computedHash.toLowerCase() === storedHash.toLowerCase();
}
