import { handleOpsListClients } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: GET /api/v1/ops/integration-clients
 * auth:     ops secret
 * Lists clients (metadata only, never key material).
 */
export const GET = integrationRoute((request: Request) =>
  handleOpsListClients(request, integrationApiDeps),
);
