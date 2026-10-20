import { handleActionResult } from '@hypha-platform/core/server';

import { integrationRoute } from '../../../../../../../../../lib/integration-api';
import { integrationActionDeps } from '../../../../../../../../../lib/integration-api/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * status: spike (approval flow, #2515 milestone 04b)
 * auth:   user token
 * The page reports what its wallet did after approve: submitted with a tx hash, or failed.
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) =>
    handleActionResult(request, integrationActionDeps, (await params).id),
);
