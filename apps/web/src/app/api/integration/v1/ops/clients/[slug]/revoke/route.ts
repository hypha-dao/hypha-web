import { handleOpsRevokeClient } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: POST /api/v1/ops/integration-clients/{slug}/revoke
 * auth:     ops secret
 * Rejects a pending client or revokes an approved one.
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
    handleOpsRevokeClient(request, await params, integrationApiDeps),
);
