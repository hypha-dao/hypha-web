/**
 * Redaction for anything that may reach a log line or an error message. Tokens, codes and
 * secrets must never appear there. This is applied to every Better Auth log call and to
 * errors built by this package.
 */
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const BEARER = /\b(Bearer|DPoP)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const KEYED =
  /((?:access_token|refresh_token|id_token|privyToken|privy_token|token|client_secret|code_verifier|code|secret|authorization|cookie|set-cookie)["']?\s*[:=]\s*["']?)([^"'\s&,;}]{4,})/gi;

export const REDACTED = '[redacted]';

export function redactSecrets(text: string): string {
  return text
    .replace(JWT, REDACTED)
    .replace(BEARER, `$1 ${REDACTED}`)
    .replace(KEYED, `$1${REDACTED}`);
}

export function redactValue(value: unknown): string {
  if (typeof value === 'string') return redactSecrets(value);
  if (value instanceof Error) {
    return redactSecrets(`${value.name}: ${value.message}`);
  }
  try {
    return redactSecrets(JSON.stringify(value));
  } catch {
    return REDACTED;
  }
}

/**
 * Onboarding log line: one per authorize / consent / token step, so the first connection of each
 * AI app can be followed in the logs. Built from an allow-list: every field is checked against a
 * closed set or a strict pattern and anything else is dropped, so a token, code, email, free text
 * or full redirect URL cannot get in even if a caller passes one by mistake.
 */
export const ONBOARDING_STEPS = ['authorize', 'consent', 'token'] as const;
export const ONBOARDING_CLIENT_KINDS = [
  'cimd',
  'registered',
  'dcr',
  'unknown',
] as const;
export type OnboardingLogFields = {
  clientKind: string;
  step: string;
  /** OAuth error code (`invalid_request`, ...), or empty/undefined when the step succeeded. */
  error?: string | null;
  /** Host only (or `scheme:` for a hostless custom-scheme redirect). */
  redirectHost?: string | null;
};

const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;
const HOST = /^[a-z0-9.\-[\]:]{1,255}$/i;
const SCHEME_ONLY = /^[a-z][a-z0-9+.-]{0,31}:$/i;

export function onboardingLogLine(fields: OnboardingLogFields): string {
  const kind = (ONBOARDING_CLIENT_KINDS as readonly string[]).includes(
    fields.clientKind,
  )
    ? fields.clientKind
    : 'unknown';
  const step = (ONBOARDING_STEPS as readonly string[]).includes(fields.step)
    ? fields.step
    : 'unknown';
  const error =
    fields.error && ERROR_CODE.test(fields.error) ? fields.error : 'none';
  const host =
    fields.redirectHost &&
    (HOST.test(fields.redirectHost) || SCHEME_ONLY.test(fields.redirectHost))
      ? fields.redirectHost
      : 'none';
  return `[auth-server:onboarding] client_kind=${kind} step=${step} error=${error} redirect_host=${host}`;
}

export function logOnboarding(fields: OnboardingLogFields) {
  console.log(onboardingLogLine(fields));
}

/** Better Auth logger hook: redacts the message and every argument before printing. */
export function redactingLog(
  level: string,
  message: string,
  ...args: unknown[]
) {
  const line = [redactSecrets(String(message)), ...args.map(redactValue)].join(
    ' ',
  );
  const out =
    level === 'error'
      ? console.error
      : level === 'warn'
      ? console.warn
      : console.log;
  out(`[auth-server:${level}] ${line}`);
}
