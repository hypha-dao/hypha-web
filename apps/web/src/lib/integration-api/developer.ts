import 'server-only';
import {
  findIntegrationClientBySlug,
  listIntegrationClientsForPerson,
  authenticateIntegrationUser,
  setIntegrationClientLogo,
  type IntegrationDeveloperDeps,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { storeClientLogo } from './store-client-logo';

/** Wiring of the developer area handlers to the database and file storage. */
export const integrationDeveloperDeps: IntegrationDeveloperDeps = {
  authenticateUser: (request) => authenticateIntegrationUser(request, { db }),
  listClientsForPerson: (args) => listIntegrationClientsForPerson(args, { db }),
  findClientBySlug: (args) => findIntegrationClientBySlug(args, { db }),
  storeLogo: storeClientLogo,
  setLogo: (args) => setIntegrationClientLogo(args, { db }),
};
