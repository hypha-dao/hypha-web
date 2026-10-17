import { handleOpsApproveClient } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: POST /api/v1/ops/integration-clients/{slug}/approve
 * auth:     ops secret
 * Approves a pending client and issues its key (returned once).
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
    handleOpsApproveClient(request, await params, integrationApiDeps),
);
