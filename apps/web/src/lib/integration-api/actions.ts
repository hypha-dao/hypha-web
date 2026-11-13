import 'server-only';
import {
  authenticateIntegrationClient,
  authenticateIntegrationUser,
  claimPendingAction,
  countPendingActions,
  createIntegrationAction,
  findActionForClientPerson,
  findActionForPerson,
  getAbsoluteAppUrl,
  recordActionResult,
  resolveVoteTarget,
  supersedePendingActions,
  type IntegrationActionDeps,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authenticateIntegrationUserAsOrPrivy } from './as-user';

/**
 * Wiring of the approval-flow spike handlers (#2515, milestone 04b) to the
 * database and the existing read logic. The routes themselves are wrapped by
 * `integrationRoute`, like every other route in the namespace.
 */
export const integrationActionDeps: IntegrationActionDeps = {
  authenticateClient: (request) =>
    authenticateIntegrationClient({ request }, { db }),
  authenticateUser: (request) => authenticateIntegrationUser(request, { db }),
  resolveVoteTarget: (args) => resolveVoteTarget(args, { db }),
  countPendingActions: (args) => countPendingActions(args, { db }),
  supersedePendingActions: (args) => supersedePendingActions(args, { db }),
  createAction: (args) => createIntegrationAction(args, { db }),
  findActionForClientPerson: (args) => findActionForClientPerson(args, { db }),
  findActionForPerson: (args) => findActionForPerson(args, { db }),
  claimPendingAction: (args) => claimPendingAction(args, { db }),
  recordActionResult: (args) => recordActionResult(args, { db }),
  approvalUrl: (actionId) => getAbsoluteAppUrl(`/en/approve/${actionId}`),
  now: () => new Date(),
};

/**
 * #2608 TEMP: the app-facing routes (`POST actions`, `GET actions/{id}`) take the person from an
 * authorization-server token (or Privy, unchanged). The approval page's routes keep
 * `integrationActionDeps`: Privy only, by design (wallet signing is Privy in Hypha's UI).
 */
export const integrationClientActionDeps: IntegrationActionDeps = {
  ...integrationActionDeps,
  authenticateUser: authenticateIntegrationUserAsOrPrivy,
};
