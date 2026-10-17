import {
  handleListClientGrants,
  handleRegisterClientGrant,
} from '@hypha-platform/core/server';

import {
  integrationApiDeps,
  integrationRoute,
} from '../../../../../../../lib/integration-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * replaces: POST /api/v1/integration-grants
 * auth:     client key + user token
 * Registers the token user's consent for the calling client. Idempotent per client and person. Needs a Hypha profile (403 without). Does not check the wallet signer.
 */
export const POST = integrationRoute((request: Request) =>
  handleRegisterClientGrant(request, integrationApiDeps),
);

/**
 * replaces: GET /api/v1/integration-grants (client view)
 * auth:     client key + user token
 * The token user's grants for the calling client only; "already consented" is an item with status active.
 */
export const GET = integrationRoute((request: Request) =>
  handleListClientGrants(request, integrationApiDeps),
);
