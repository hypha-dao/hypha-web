import { handleGetClientAction } from '@hypha-platform/core/server';

import { integrationRoute } from '../../../../../../lib/integration-api';
import { integrationClientActionDeps } from '../../../../../../lib/integration-api/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * status: spike (approval flow, #2515 milestone 04b)
 * auth:   client key + user token (Privy, or an authorization-server token: scope
 *         agreements:vote to prepare, spaces:read to poll; #2608 TEMP)
 * The state of an action, only for the client that prepared it and the person
 * it was prepared for (404 for anyone else).
 */
export const GET = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) =>
    handleGetClientAction(
      request,
      integrationClientActionDeps,
      (await params).id,
    ),
);
