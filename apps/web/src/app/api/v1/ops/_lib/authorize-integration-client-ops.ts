import { NextRequest, NextResponse } from 'next/server';

import { opsSecretMatches, readOpsSecret } from './ops-auth';

/**
 * Guard for integration client administration (#2515). Uses its own secret,
 * separate from the space API key one, so the two can be rotated and handed
 * out independently. Returns a response to send back when the caller is not
 * authorized, or null to continue.
 */
export function authorizeIntegrationClientOps(
  request: NextRequest,
): NextResponse | null {
  const configuredSecret =
    process.env.HYPHA_INTEGRATION_CLIENT_OPS_SECRET?.trim() ?? '';
  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'HYPHA_INTEGRATION_CLIENT_OPS_SECRET is not configured' },
      { status: 503 },
    );
  }

  const presented = readOpsSecret(request);
  if (!presented || !opsSecretMatches(presented, configuredSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
