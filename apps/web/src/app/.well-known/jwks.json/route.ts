import { NextResponse } from 'next/server';
import type { JSONWebKeySet } from 'jose';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
if (!PRIVY_APP_ID) {
  throw new Error('Missing required env var: NEXT_PUBLIC_PRIVY_APP_ID');
}

const PRIVY_JWKS_BASE = 'https://auth.privy.io/api/v1/apps';

// Never empty: the primary app's URL always comes first.
function getPrivyJwksUrls(): [string, ...string[]] {
  const urls: [string, ...string[]] = [
    `${PRIVY_JWKS_BASE}/${PRIVY_APP_ID}/jwks.json`,
  ];
  const extraIds = process.env.PRIVY_EXTRA_JWKS_APP_IDS;
  if (extraIds) {
    for (const id of extraIds.split(',')) {
      const trimmed = id.trim();
      if (trimmed && trimmed !== PRIVY_APP_ID) {
        urls.push(`${PRIVY_JWKS_BASE}/${trimmed}/jwks.json`);
      }
    }
  }
  return urls;
}

const STATIC_JWKS_URLS = [
  'https://api-auth.web3auth.io/jwks',
  'https://authjs.web3auth.io/jwks',
];

type JWKSResponse = JSONWebKeySet;

async function fetchJwks(url: string): Promise<JWKSResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`JWKS fetch failed for ${url}: ${res.status}`);
  }
  return (await res.json()) as JWKSResponse;
}

// Cached at the CDN for a few minutes: keys rotate rarely, and Neon (which fetches this on
// a short poll) would otherwise cost a function run each time. Vercel hides `s-maxage` and
// `stale-while-revalidate` from the client; check `x-vercel-cache` and `age` instead.
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET() {
  try {
    const [primaryPrivyUrl, ...optionalPrivyUrls] = getPrivyJwksUrls();

    const required = await Promise.all([
      ...STATIC_JWKS_URLS.map(fetchJwks),
      fetchJwks(primaryPrivyUrl),
    ]);

    const optional = await Promise.allSettled(optionalPrivyUrls.map(fetchJwks));
    for (const result of optional) {
      if (result.status === 'rejected') {
        console.warn('Optional JWKS fetch failed:', result.reason);
      }
    }

    const results = [
      ...required,
      ...optional
        .filter(
          (r): r is PromiseFulfilledResult<JWKSResponse> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value),
    ];

    const combinedJwks: JWKSResponse = {
      keys: results.flatMap((r) => r.keys || []),
    };

    return NextResponse.json(combinedJwks, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching JWKS:', error);
    return NextResponse.json(
      { error: 'Failed to fetch JWKS' },
      { status: 500 },
    );
  }
}
