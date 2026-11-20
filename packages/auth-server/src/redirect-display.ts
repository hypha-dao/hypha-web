/**
 * How the consent page names the place the person is sent back to after approving. The rule is
 * about wording only: what registration and authorize accept is decided elsewhere (registration.ts
 * for dynamic registration, the stored redirect list for the others).
 *
 * - https and loopback http: the host (with port), as before.
 * - any other scheme (an app on the person's computer, for example `cursor://anysphere.cursor-mcp/...`):
 *   the scheme and the host, or the scheme and the path when there is no host, so the line is never
 *   empty and the person can tell it is not a website.
 */
export type RedirectKind = 'web' | 'app';

export function describeRedirect(value: string | null | undefined): {
  kind: RedirectKind;
  /** Text to show; empty only when the value is not a URL at all. */
  display: string;
} {
  let url: URL;
  try {
    url = new URL(value ?? '');
  } catch {
    return { kind: 'web', display: '' };
  }
  if (url.protocol === 'https:' || url.protocol === 'http:') {
    return { kind: 'web', display: url.host };
  }
  const scheme = url.protocol; // includes the trailing ":"
  if (url.host) return { kind: 'app', display: `${scheme}//${url.host}` };
  const path = url.pathname.replace(/^\/+/, '').slice(0, 80);
  return { kind: 'app', display: path ? `${scheme}${path}` : scheme };
}

/**
 * Host part only, for log lines: the host for web redirects, the host (or just the scheme) for
 * custom schemes. Never a path, query or credentials.
 */
export function redirectHostForLog(value: string | null | undefined): string {
  let url: URL;
  try {
    url = new URL(value ?? '');
  } catch {
    return '';
  }
  if (url.host) return url.host;
  return url.protocol;
}
