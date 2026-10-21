import 'server-only';
import {
  approveIntegrationClient,
  findIntegrationClientBySlug,
  listIntegrationClients,
  listIntegrationClientsForPerson,
  revokeIntegrationClient,
  rotateIntegrationClientKey,
  authenticateIntegrationUser,
  setIntegrationClientLogo,
  type IntegrationDeveloperDeps,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { storeClientLogo } from './store-client-logo';

/**
 * Reviewers are Hypha profiles named by slug in
 * INTEGRATION_CLIENT_REVIEWER_SLUGS (comma separated). Unset means nobody:
 * requests are then answered through the `ops/` routes only.
 */
function reviewerSlugs(): Set<string> {
  return new Set(
    (process.env.INTEGRATION_CLIENT_REVIEWER_SLUGS ?? '')
      .split(',')
      .map((slug) => slug.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Wiring of the developer area handlers to the database, file storage and the reviewer list. */
export const integrationDeveloperDeps: IntegrationDeveloperDeps = {
  authenticateUser: (request) => authenticateIntegrationUser(request, { db }),
  isReviewer: (user) =>
    !!user.slug && reviewerSlugs().has(user.slug.toLowerCase()),
  listClientsForPerson: (args) => listIntegrationClientsForPerson(args, { db }),
  listClients: () => listIntegrationClients({ db }),
  findClientBySlug: (args) => findIntegrationClientBySlug(args, { db }),
  storeLogo: storeClientLogo,
  setLogo: (args) => setIntegrationClientLogo(args, { db }),
  approveClient: (args) => approveIntegrationClient(args, { db }),
  revokeClient: (args) => revokeIntegrationClient(args, { db }),
  rotateClientKey: (args) => rotateIntegrationClientKey(args, { db }),
};
