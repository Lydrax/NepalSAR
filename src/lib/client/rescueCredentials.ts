const CLIENT_REQUEST_CREDENTIALS_KEY = 'nepal_rescue_client_credentials';

export interface StoredRescueCredentials {
  caseNumber: string;
  verificationToken: string;
  savedAt: string;
}

function readCredentialMap(): Record<string, StoredRescueCredentials> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(CLIENT_REQUEST_CREDENTIALS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredRescueCredentials>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Persists case credentials locally after a successful first submission.
 * Used to recover verification tokens on idempotent retries without server-side plaintext storage.
 */
export function saveRescueCredentials(
  clientRequestId: string,
  caseNumber: string,
  verificationToken: string
): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(`rescue_case_${caseNumber}`, verificationToken);

  const map = readCredentialMap();
  map[clientRequestId] = {
    caseNumber,
    verificationToken,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(CLIENT_REQUEST_CREDENTIALS_KEY, JSON.stringify(map));
}

export function getRescueCredentialsByClientRequestId(
  clientRequestId: string
): StoredRescueCredentials | null {
  if (typeof window === 'undefined') return null;
  return readCredentialMap()[clientRequestId] ?? null;
}

export function getRescueCredentialsByCaseNumber(caseNumber: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`rescue_case_${caseNumber}`);
}
