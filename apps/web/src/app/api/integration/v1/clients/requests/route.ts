import { handleRequestClient } from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: POST /api/v1/integration-clients/requests
 * auth:     user token (Bearer)
 * An integrator asks to become an approved client. Needs a Hypha profile (403 without). Creates a `pending` record, no key.
 */
export const POST = integrationRoute((request: Request) =>
  handleRequestClient(request, integrationApiDeps),
);
