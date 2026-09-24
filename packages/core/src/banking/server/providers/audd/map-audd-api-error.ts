import {
  BANK_SETUP_FAILED_USER_MESSAGE,
  BankOnboardingError,
} from '../../errors';

/** AUDD error bodies are `{ message, messageKey, status, timestamp, path }`. */
function auddErrorDetail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const message = typeof record.message === 'string' ? record.message : null;
  const key = typeof record.messageKey === 'string' ? record.messageKey : null;
  if (message && key) {
    return `${message} (${key})`;
  }
  return message ?? key;
}

/**
 * Map an AUDD Gateway HTTP client error to a user-facing `BankOnboardingError`. Returns `null` when
 * the error is not a recognised AUDD API error, so the caller can rethrow.
 */
export function mapAuddApiError(
  error: unknown,
  operation: string,
): BankOnboardingError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const status = (error as Error & { status?: number }).status;
  const body = (error as Error & { body?: unknown }).body;
  const detail = auddErrorDetail(body);

  if (status === undefined) {
    return null;
  }

  // Provider name and operator hints (allow-list, mTLS, API key) belong in the server log only:
  // BankOnboardingError messages are returned to the end user verbatim.
  const logOperatorDetail = (hint: string) =>
    console.error(
      `[audd] ${operation} failed (${status}): ${hint}${
        detail ? ` — ${detail}` : ''
      }`,
    );

  if (status === 400) {
    return new BankOnboardingError(
      detail
        ? `We could not verify these details: ${detail}`
        : 'We could not verify these details. Please check them and try again.',
      400,
    );
  }

  if (status === 409) {
    return new BankOnboardingError(
      detail
        ? `A verification for these details already exists: ${detail}`
        : 'A verification for these details already exists.',
      409,
    );
  }

  if (status === 401) {
    logOperatorDetail(
      'API key rejected — confirm AUDD_GATEWAY_API_KEY is an active key for this environment',
    );
    return new BankOnboardingError(BANK_SETUP_FAILED_USER_MESSAGE, 500);
  }

  if (status === 403) {
    logOperatorDetail(
      'source IP not allow-listed, or the mTLS client cert is missing / not registered',
    );
    return new BankOnboardingError(BANK_SETUP_FAILED_USER_MESSAGE, 502);
  }

  if (status === 429) {
    logOperatorDetail('rate-limited (20 failed auths / 5 min per source IP)');
    return new BankOnboardingError(BANK_SETUP_FAILED_USER_MESSAGE, 502);
  }

  if (status >= 500) {
    logOperatorDetail('upstream error');
    return new BankOnboardingError(BANK_SETUP_FAILED_USER_MESSAGE, 502);
  }

  return null;
}
