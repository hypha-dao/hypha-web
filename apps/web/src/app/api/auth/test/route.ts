import { NextResponse } from 'next/server';
import {
  blockUnlessAuthServerHost,
  guardResource,
} from '@hypha-platform/auth-server/server';
import { getAuthServerConfig } from '../../../(auth)/auth/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Small protected route that proves the resource side end to end (#2608): bearer token,
 * audience, whitelist and scope. Exists only when its URL is listed in AUTH_SERVER_RESOURCES.
 * Not a Hypha data route: it only echoes who is calling.
 */
export async function GET(request: Request) {
  const config = getAuthServerConfig();
  const blocked = blockUnlessAuthServerHost(request, config);
  if (blocked || !config.enabled)
    return blocked ?? new Response('Not Found', { status: 404 });

  const audience = `${config.issuer}/api/auth/test`;
  if (!config.resources.includes(audience)) {
    return new Response('Not Found', { status: 404 });
  }

  const guard = await guardResource(request, config, {
    audience,
    scope: 'spaces:read',
  });
  if (!guard.ok) return guard.response;
  const { sub, clientId, scopes, aud } = guard.caller;
  return NextResponse.json(
    { sub, clientId, scopes, aud },
    { headers: { 'cache-control': 'no-store' } },
  );
}
