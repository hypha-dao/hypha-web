import { BankOnboardingError } from './errors';

function bridgeErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (typeof record.message === 'string') {
    return record.message;
  }

  return null;
}

/** Maps Bridge HTTP client errors to user-facing BankOnboardingError. */
export function mapBridgeApiError(
  error: unknown,
  operation: string,
): BankOnboardingError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const status = (error as Error & { status?: number }).status;
  const body = (error as Error & { body?: unknown }).body;
  const detail = bridgeErrorMessage(body);

  if (status === 401) {
    return new BankOnboardingError(
      detail
        ? `Bridge API key was rejected for ${operation}: ${detail}. Confirm BRIDGE_API_KEY is a sandbox scoped key with permission for this action (often Update customers or sandbox simulate).`
        : `Bridge API key was rejected for ${operation}. Confirm BRIDGE_API_KEY and BRIDGE_API_BASE_URL (https://api.sandbox.bridge.xyz) in apps/web/.env.`,
      500,
    );
  }

  if (status === 404) {
    return new BankOnboardingError(
      detail ??
        `Bridge resource not found for ${operation}. The customer may not exist in sandbox yet.`,
      404,
    );
  }

  return null;
}
