import { handleOpsRotateClientKey } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: POST /api/v1/ops/integration-clients/{slug}/rotate-key
 * auth:     ops secret
 * Replaces an approved client's key (returned once; the old key stops working).
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
    handleOpsRotateClientKey(request, await params, integrationApiDeps),
);
