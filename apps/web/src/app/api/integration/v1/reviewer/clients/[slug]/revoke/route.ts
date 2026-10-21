import { handleReviewRevokeClient } from '@hypha-platform/core/server';

import { integrationRoute } from '@web/lib/integration-api';
import { integrationDeveloperDeps } from '@web/lib/integration-api/developer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * auth: user token (Bearer) of a reviewer
 * Rejects a pending client or revokes an approved one.
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
    handleReviewRevokeClient(request, await params, integrationDeveloperDeps),
);
