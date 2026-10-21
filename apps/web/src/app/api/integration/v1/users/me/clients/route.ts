import { handleListMyClients } from '@hypha-platform/core/server';

import { integrationRoute } from '@web/lib/integration-api';
import { integrationDeveloperDeps } from '@web/lib/integration-api/developer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * auth: user token (Bearer)
 * The caller's own client requests with status, scopes, origins and logo review state.
 */
export const GET = integrationRoute((request: Request) =>
  handleListMyClients(request, integrationDeveloperDeps),
);
