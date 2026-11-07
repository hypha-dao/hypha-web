import 'server-only';

/**
 * Read-only enrichment from the Hypha platform.
 *
 * Some contributors also have a Hypha profile — the two apps share a Privy
 * app, so the same wallet turns up on both. Where that is true the admin
 * ledger can show a real name and avatar instead of an email address.
 *
 * This is done over Hypha's public HTTP API and never against its database.
 * Three properties follow from that, and they are the reason it is written
 * this way:
 *
 *   - There is no connection string, no pool and no schema import here, so
 *     there is no code path by which this app can write to Hypha at all.
 *   - `GET /api/v1/people/by-web3-address/:address` is an unauthenticated
 *     read, so no credential needs to be issued, held or rotated.
 *   - Hypha being slow or down degrades a display name; it cannot fail a
 *     contribution. Every failure here resolves to null.
 *
 * It follows the same shape as the ACAW integration documented in
 * docs/integrations/external-signal-ingestion.md: match an existing profile,
 * never create one. A contributor who wants a Hypha profile makes it on Hypha.
 */

const DEFAULT_BASE_URL = 'https://app.hypha.earth';

/** How long a lookup may take before the campaign gives up and shows the email. */
const TIMEOUT_MS = 2_500;

/** Enrichment is cosmetic, so a stale name for an hour is perfectly fine. */
const CACHE_TTL_MS = 60 * 60 * 1000;

export type HyphaProfile = {
  slug: string;
  name: string | null;
  avatarUrl: string | null;
  url: string;
};

type CacheEntry = { profile: HyphaProfile | null; expiresAt: number };

const cache = new Map<string, CacheEntry>();

function baseUrl(): string {
  return (process.env.HYPHA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/**
 * Looks up the Hypha profile for a wallet address, or null if there is none.
 * Never throws: callers render whatever the campaign already knows.
 */
export async function findHyphaProfileByWallet(
  walletAddress: string | null | undefined,
): Promise<HyphaProfile | null> {
  if (!walletAddress) return null;

  const key = walletAddress.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.profile;

  const profile = await fetchProfile(key);
  cache.set(key, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
  return profile;
}

async function fetchProfile(address: string): Promise<HyphaProfile | null> {
  const host = baseUrl();
  const url = `${host}/api/v1/people/by-web3-address/${encodeURIComponent(
    address,
  )}`;

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const person = (await response.json()) as {
      slug?: string;
      name?: string | null;
      surname?: string | null;
      nickname?: string | null;
      avatarUrl?: string | null;
    } | null;

    if (!person?.slug) return null;

    const fullName =
      [person.name, person.surname].filter(Boolean).join(' ').trim() ||
      person.nickname ||
      null;

    return {
      slug: person.slug,
      name: fullName,
      avatarUrl: person.avatarUrl ?? null,
      url: `${host}/en/profile/${person.slug}`,
    };
  } catch {
    // Timeout, DNS, malformed body — all the same to us.
    return null;
  }
}

/**
 * Enriches a batch of wallets in one pass, de-duplicating so a ledger page
 * with twenty rows from one contributor makes one request rather than twenty.
 */
export async function findHyphaProfiles(
  walletAddresses: (string | null | undefined)[],
): Promise<Map<string, HyphaProfile>> {
  const unique = [
    ...new Set(
      walletAddresses
        .filter((a): a is string => Boolean(a))
        .map((a) => a.toLowerCase()),
    ),
  ];

  const found = new Map<string, HyphaProfile>();
  const results = await Promise.all(
    unique.map(
      async (address) =>
        [address, await findHyphaProfileByWallet(address)] as const,
    ),
  );

  for (const [address, profile] of results) {
    if (profile) found.set(address, profile);
  }
  return found;
}
