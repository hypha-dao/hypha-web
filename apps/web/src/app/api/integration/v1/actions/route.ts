import { handlePrepareAction } from '@hypha-platform/core/server';

import { integrationRoute } from '../../../../../lib/integration-api';
import { integrationClientActionDeps } from '../../../../../lib/integration-api/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * status: spike (approval flow, #2515 milestone 04b)
 * auth:   client key + user token (Privy, or an authorization-server token: scope
 *         agreements:vote to prepare, spaces:read to poll; #2608 TEMP)
 * Prepares an operation for the token user: validates it with the existing
 * read logic, stores it and answers 202 with the approval URL.
 */
export const POST = integrationRoute((request: Request) =>
  handlePrepareAction(request, integrationClientActionDeps),
);
