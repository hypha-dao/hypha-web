import { NextResponse } from 'next/server';
import {
  JWKSService,
  PrivyServerAdapter,
  Web3AuthServerAdapter,
} from '@hypha-platform/core';

// This function handles GET requests to /.well-known/jwks.json
export async function GET() {
  try {
    const adapters = [
      new PrivyServerAdapter({ appId: 'cm5y07p2z02napk1cutzzx7o6' }),
      new Web3AuthServerAdapter(),
    ];

    const jwksService = new JWKSService(adapters);
    const combinedJwks = await jwksService.getCombinedJWKS();

    return NextResponse.json(combinedJwks);
  } catch (error) {
    console.error('Error fetching JWKS:', error);
    return NextResponse.json(
      { error: 'Failed to fetch JWKS' },
      { status: 500 },
    );
  }
}
