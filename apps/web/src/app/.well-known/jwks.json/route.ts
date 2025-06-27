import { NextResponse } from 'next/server';
import type { JSONWebKeySet } from 'jose';

const JWKS_URLS = {
  Web3AuthSocial: 'https://api-auth.web3auth.io/jwks',
  Web3AuthWallet: 'https://authjs.web3auth.io/jwks',
  Privy:
    'https://auth.privy.io/api/v1/apps/cm5y07p2z02napk1cutzzx7o6/jwks.json',
};

type JWKSResponse = JSONWebKeySet;

// This function handles GET requests to /.well-known/jwks.json
export async function GET() {
  try {
    // Fetch both JWKS in parallel
    const [socialJwks, walletJwks, privyJwks] = (await Promise.all([
      fetch(JWKS_URLS.Web3AuthSocial).then((res) => res.json()),
      fetch(JWKS_URLS.Web3AuthWallet).then((res) => res.json()),
      fetch(JWKS_URLS.Privy).then((res) => res.json()),
    ])) as [JWKSResponse, JWKSResponse, JWKSResponse];

    // Combine the keys from both JWKS
    const combinedJwks: JWKSResponse = {
      keys: [
        ...(socialJwks.keys || []),
        ...(walletJwks.keys || []),
        ...(privyJwks.keys || []),
      ],
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
