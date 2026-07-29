import { NextRequest, NextResponse } from 'next/server';

import { opsSecretMatches, readOpsSecret } from '../../../../_lib/ops-auth';

/**
 * Guard for space API key administration. Returns a response to send back when
 * the caller is not authorized, or null to continue.
 */
export function authorizeSpaceApiKeyOps(
  request: NextRequest,
): NextResponse | null {
  const configuredSecret =
    process.env.HYPHA_SPACE_API_KEY_OPS_SECRET?.trim() ?? '';
  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'HYPHA_SPACE_API_KEY_OPS_SECRET is not configured' },
      { status: 503 },
    );
  }

  const presented = readOpsSecret(request);
  if (!presented || !opsSecretMatches(presented, configuredSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
