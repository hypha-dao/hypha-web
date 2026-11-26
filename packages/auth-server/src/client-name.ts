/**
 * The `client_name` claim: the name the client declared for itself (its metadata document, or
 * the row of a registered client), put into the access token so the app can label what a client
 * did without reading this server's tables. Self-declared, so unverified. Cleaned and capped so
 * the token stays small; a missing or empty name gives no claim.
 */
export const CLIENT_NAME_CLAIM = 'client_name';
/** Characters (code points) kept; the same cap as the origin label in the app. */
export const CLIENT_NAME_MAX = 120;

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const collapsed = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const capped = Array.from(collapsed)
    .slice(0, CLIENT_NAME_MAX)
    .join('')
    .trim();
  return capped ? capped : null;
}

/** The claim value minted for a client name, or null when there is nothing to mint. */
export function clientNameClaim(name: unknown): string | null {
  return clean(name);
}

/** Reads the claim from a verified token. Lenient: a missing or malformed claim is `null`. */
export function parseClientNameClaim(raw: unknown): string | null {
  return clean(raw);
}
