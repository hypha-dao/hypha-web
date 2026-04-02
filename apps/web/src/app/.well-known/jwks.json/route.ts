import { NextResponse } from 'next/server';
import type { JSONWebKeySet } from 'jose';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
if (!PRIVY_APP_ID) {
  throw new Error('Missing required env var: NEXT_PUBLIC_PRIVY_APP_ID');
}

const PRIVY_JWKS_BASE = 'https://auth.privy.io/api/v1/apps';

function getPrivyJwksUrls(): string[] {
  const urls = [`${PRIVY_JWKS_BASE}/${PRIVY_APP_ID}/jwks.json`];
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

export async function GET() {
  try {
    const allUrls = [...STATIC_JWKS_URLS, ...getPrivyJwksUrls()];

    const results = (await Promise.all(
      allUrls.map((url) => fetch(url).then((res) => res.json())),
    )) as JWKSResponse[];

    const combinedJwks: JWKSResponse = {
      keys: results.flatMap((r) => r.keys || []),
    };

    return NextResponse.json(combinedJwks);
  } catch (error) {
    console.error('Error fetching JWKS:', error);
    return NextResponse.json(
      { error: 'Failed to fetch JWKS' },
      { status: 500 },
    );
  }
}
