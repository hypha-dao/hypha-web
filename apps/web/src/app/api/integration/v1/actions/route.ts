import { handlePrepareAction } from '@hypha-platform/core/server';

import { integrationRoute } from '../../../../../lib/integration-api';
import { integrationActionDeps } from '../../../../../lib/integration-api/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * status: spike (approval flow, #2515 milestone 04b)
 * auth:   client key + user token
 * Prepares an operation for the token user: validates it with the existing
 * read logic, stores it and answers 202 with the approval URL.
 */
export const POST = integrationRoute((request: Request) =>
  handlePrepareAction(request, integrationActionDeps),
);
