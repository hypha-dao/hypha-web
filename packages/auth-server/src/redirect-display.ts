/**
 * How the consent page names the place the person is sent back to after approving. The rule is
 * about wording only: what registration and authorize accept is decided elsewhere (registration.ts
 * for dynamic registration, the stored redirect list for the others).
 *
 * - loopback (`127.0.0.1`, `localhost`, `[::1]`): an app on the person's own computer. Nothing is
 *   displayed (`display` is empty): the page words it ("an app on this computer"), and the port is
 *   never shown, since native apps pick a new one each time and a number means nothing to people.
 * - https (and any other http host): the host, with a port only when the address has one.
 * - any other scheme (an app on the person's computer, for example `cursor://anysphere.cursor-mcp/...`):
 *   the scheme and the host, or the scheme and the path when there is no host, so the line is never
 *   empty and the person can tell it is not a website.
 */
export type RedirectKind = 'web' | 'local' | 'app';

/** Hostnames that always mean "this computer" (RFC 8252 loopback; `URL` keeps IPv6 brackets). */
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function isLoopbackRedirect(url: URL): boolean {
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase())
  );
}

export function describeRedirect(value: string | null | undefined): {
  kind: RedirectKind;
  /** Text to show; empty for `local` (the page words it) and when the value is not a URL at all. */
  display: string;
} {
  let url: URL;
  try {
    url = new URL(value ?? '');
  } catch {
    return { kind: 'web', display: '' };
  }
  if (isLoopbackRedirect(url)) return { kind: 'local', display: '' };
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
