import { BankOnboardingError } from '../../errors';

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

  if (status === 400) {
    return new BankOnboardingError(
      detail
        ? `AUDD rejected ${operation}: ${detail}`
        : `AUDD rejected ${operation} (invalid request).`,
      400,
    );
  }

  if (status === 401) {
    return new BankOnboardingError(
      `AUDD API key was rejected for ${operation}. Confirm AUDD_GATEWAY_API_KEY is an active sandbox key.`,
      500,
    );
  }

  if (status === 403) {
    return new BankOnboardingError(
      `AUDD refused ${operation} (403): the source IP is not allow-listed, or the mTLS client cert is missing / not registered.`,
      403,
    );
  }

  if (status === 409) {
    return new BankOnboardingError(
      detail
        ? `AUDD reports a conflict for ${operation}: ${detail}`
        : `AUDD reports this customer already exists (${operation}).`,
      409,
    );
  }

  if (status === 429) {
    return new BankOnboardingError(
      `AUDD rate-limited ${operation}. Retry shortly.`,
      500,
    );
  }

  if (status === 503 || status === 504) {
    return new BankOnboardingError(
      `AUDD's service was unavailable during ${operation}. This is retryable.`,
      502,
    );
  }

  if (status >= 500) {
    return new BankOnboardingError(
      `AUDD returned an error during ${operation}.`,
      502,
    );
  }

  return null;
}
