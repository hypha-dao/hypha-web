import { handleRotateMyClientKey } from '@hypha-platform/core/server';

import { integrationRoute } from '@web/lib/integration-api';
import { integrationDeveloperDeps } from '@web/lib/integration-api/developer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * auth: user token (Bearer), the requester of an approved client
 * Issues a new client key and returns it once; the previous key stops working.
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
    handleRotateMyClientKey(request, await params, integrationDeveloperDeps),
);
