import { handleApproveAction } from '@hypha-platform/core/server';

import { integrationRoute } from '../../../../../../../../../lib/integration-api';
import { integrationActionDeps } from '../../../../../../../../../lib/integration-api/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * status: spike (approval flow, #2515 milestone 04b)
 * auth:   user token
 * Claims the action once (pending to approved) and returns what the page must sign.
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) =>
    handleApproveAction(request, integrationActionDeps, (await params).id),
);
