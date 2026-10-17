import { handleGetClientMe } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: none (new)
 * auth:     client key
 * The calling client's own slug, name, status and scopes.
 */
export const GET = integrationRoute((request: Request) =>
  handleGetClientMe(request, integrationApiDeps),
);
