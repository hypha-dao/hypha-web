import { handleListUserGrants } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: GET /api/v1/integration-grants (user mode)
 * auth:     user token
 * All of the user's grants across clients (platform consent screen).
 */
export const GET = integrationRoute((request: Request) =>
  handleListUserGrants(request, integrationApiDeps),
);
