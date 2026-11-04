/**
 * Redaction for anything that may reach a log line or an error message. Tokens, codes and
 * secrets must never appear there. This is applied to every Better Auth log call and to
 * errors built by this package.
 */
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const BEARER = /\b(Bearer|DPoP)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const KEYED =
  /((?:access_token|refresh_token|id_token|privyToken|privy_token|client_secret|code_verifier|code|secret|authorization|cookie|set-cookie)["']?\s*[:=]\s*["']?)([^"'\s&,;}]{4,})/gi;

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
