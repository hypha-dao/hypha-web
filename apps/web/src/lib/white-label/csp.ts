/**
 * Directives a host's Privy origins are added to: the SDK talks to its cookie
 * host (`privy.<cookie domain>`) by fetch, in a frame and by form post.
 */
const PRIVY_HOST_DIRECTIVES = [
  'connect-src',
  'frame-src',
  'child-src',
  'form-action',
] as const;

/**
 * Adds a mapped host's own Privy origins to the directives above of an
 * already built CSP. Each directive keeps its existing sources; a missing
 * directive is not created (it would narrow `default-src` fallback). Origins
 * are exact (`https://host`), never a wildcard; anything else is ignored.
 */
export function withPrivyHostOrigins(
  csp: string,
  origins: readonly string[],
): string {
  const safe = origins.filter((origin) =>
    /^https:\/\/[a-z0-9.-]+$/.test(origin),
  );
  if (safe.length === 0) return csp;
  return csp
    .split(';')
    .map((directive) => {
      const trimmed = directive.trim();
      const name = trimmed.split(/\s+/)[0];
      if (!(PRIVY_HOST_DIRECTIVES as readonly string[]).includes(name ?? '')) {
        return directive;
      }
      const present = new Set(trimmed.split(/\s+/));
      const additions = safe.filter((origin) => !present.has(origin));
      return additions.length > 0
        ? `${trimmed} ${additions.join(' ')}`
        : directive;
    })
    .join(';');
}
