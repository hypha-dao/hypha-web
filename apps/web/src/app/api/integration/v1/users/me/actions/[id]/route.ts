import { handleGetUserAction } from '@hypha-platform/core/server';

import { integrationRoute } from '../../../../../../../../lib/integration-api';
import { integrationActionDeps } from '../../../../../../../../lib/integration-api/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * status: spike (approval flow, #2515 milestone 04b)
 * auth:   user token
 * What the approval page shows: status, calling client and a summary generated
 * from the stored action.
 */
export const GET = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) =>
    handleGetUserAction(request, integrationActionDeps, (await params).id),
);
