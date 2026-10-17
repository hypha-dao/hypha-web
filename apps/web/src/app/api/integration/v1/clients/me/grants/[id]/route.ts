import { handleRevokeClientGrant } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: DELETE /api/v1/integration-grants/{id} (client mode)
 * auth:     client key + user token
 * The client revokes its own grant for that user.
 */
export const DELETE = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) =>
    handleRevokeClientGrant(request, await params, integrationApiDeps),
);
