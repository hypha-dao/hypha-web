import { handleReviewApproveClient } from '@hypha-platform/core/server';

import { integrationRoute } from '@web/lib/integration-api';
import { integrationDeveloperDeps } from '@web/lib/integration-api/developer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * auth: user token (Bearer) of a reviewer
 * Approves a pending client (and so its logo) and issues its key, returned by this call only.
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
    handleReviewApproveClient(request, await params, integrationDeveloperDeps),
);
