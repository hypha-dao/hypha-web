import { verifyAccess, type ApiData } from '@vercel/flags';
import { getProviderData } from '@vercel/flags/next';
import { NextResponse, type NextRequest } from 'next/server';
import * as flags from '@hypha-platform/feature-flags';

export async function GET(request: NextRequest) {
  const access = await verifyAccess(request.headers.get('Authorization'));
  if (!access) return NextResponse.json(null, { status: 401 });

  const providerData = getProviderData(flags);

  return NextResponse.json<ApiData>(providerData);
}
