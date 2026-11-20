import type { AuthDbPool } from './db';
import { classifyClient } from './consent';
import { logOnboarding, redactingLog } from './redact';
import { redirectHostForLog } from './redirect-display';

export type OnboardingStep = 'authorize' | 'consent' | 'token';

/** Which step (if any) a path under the API base path is. */
export function onboardingStepOf(
  pathname: string,
  method: string,
): OnboardingStep | null {
  const m = method.toUpperCase();
  if (pathname.endsWith('/oauth2/authorize') && (m === 'GET' || m === 'POST'))
    return 'authorize';
  if (pathname.endsWith('/oauth2/consent') && m === 'POST') return 'consent';
  if (pathname.endsWith('/oauth2/token') && m === 'POST') return 'token';
  return null;
}

/** What the log line needs from the request, read from parameters only (never logged as is). */
export async function readOnboardingParams(
  request: Request,
  step: OnboardingStep,
): Promise<{ clientId: string; redirectUri: string }> {
  const pick = (params: URLSearchParams) => ({
    clientId: params.get('client_id') ?? '',
    redirectUri: params.get('redirect_uri') ?? '',
  });
  try {
    if (step === 'authorize' && request.method.toUpperCase() === 'GET')
      return pick(new URL(request.url).searchParams);
    const text = await request.text();
    const type = request.headers.get('content-type') ?? '';
    if (type.includes('application/json')) {
      const body = JSON.parse(text) as Record<string, unknown>;
      // Consent carries the signed authorization query as a string.
      if (typeof body.oauth_query === 'string')
        return pick(new URLSearchParams(body.oauth_query));
      return {
        clientId: typeof body.client_id === 'string' ? body.client_id : '',
        redirectUri:
          typeof body.redirect_uri === 'string' ? body.redirect_uri : '',
      };
    }
    return pick(new URLSearchParams(text));
  } catch {
    return { clientId: '', redirectUri: '' };
  }
}

/** OAuth error code of a response: JSON body for errors, `error` in the Location of a redirect. */
export async function readErrorCode(response: Response): Promise<string> {
  try {
    const location = response.headers.get('location');
    if (location) {
      // The login/consent redirects stay on this server; app redirects carry `error=` on failure.
      return (
        new URL(location, 'http://x.invalid').searchParams.get('error') ?? ''
      );
    }
    if (response.status < 400) return '';
    const body = (await response.clone().json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : '';
  } catch {
    return '';
  }
}

export async function clientKindOf(
  pool: Pick<AuthDbPool, 'query'> | undefined,
  clientId: string,
): Promise<string> {
  if (!pool || !clientId) return 'unknown';
  try {
    const { rows } = await pool.query(
      `select "clientDiscoveryId", metadata->>'registration' as registration
         from as_oauth_client where "clientId" = $1 limit 1`,
      [clientId],
    );
    if (!rows[0]) return 'unknown';
    return classifyClient({
      clientDiscoveryId: rows[0].clientDiscoveryId,
      registration: rows[0].registration,
    });
  } catch {
    return 'unknown';
  }
}

/**
 * Writes the one allow-listed line for a step. `requestCopy` is a clone taken before the handler
 * consumed the request body. Never throws and never changes the response.
 */
export async function logOnboardingStep(input: {
  step: OnboardingStep;
  requestCopy: Request;
  response: Response;
  pool: Pick<AuthDbPool, 'query'> | undefined;
}): Promise<void> {
  try {
    const params = await readOnboardingParams(input.requestCopy, input.step);
    logOnboarding({
      clientKind: await clientKindOf(input.pool, params.clientId),
      step: input.step,
      error: await readErrorCode(input.response),
      redirectHost: redirectHostForLog(params.redirectUri),
    });
  } catch (error) {
    redactingLog('warn', 'onboarding log failed', error);
  }
}
