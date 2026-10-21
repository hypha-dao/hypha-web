import { handleReviewListClients } from '@hypha-platform/core/server';

import { integrationRoute } from '@web/lib/integration-api';
import { integrationDeveloperDeps } from '@web/lib/integration-api/developer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * auth: user token (Bearer) of a reviewer (INTEGRATION_CLIENT_REVIEWER_SLUGS)
 * Every client request, with the pending logo, for the review step of the developer area.
 */
export const GET = integrationRoute((request: Request) =>
  handleReviewListClients(request, integrationDeveloperDeps),
);
