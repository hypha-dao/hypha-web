import { handleRevokeUserGrant } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: DELETE /api/v1/integration-grants/{id} (user mode)
 * auth:     user token
 * The user revokes any of their own grants.
 */
export const DELETE = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) =>
    handleRevokeUserGrant(request, await params, integrationApiDeps),
);
