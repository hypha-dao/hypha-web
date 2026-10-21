import { handleReviewRotateClientKey } from '@hypha-platform/core/server';

import { integrationRoute } from '@web/lib/integration-api';
import { integrationDeveloperDeps } from '@web/lib/integration-api/developer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * auth: user token (Bearer) of a reviewer
 * Replaces the key of an approved client; the new key is returned by this call only.
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
    handleReviewRotateClientKey(
      request,
      await params,
      integrationDeveloperDeps,
    ),
);
