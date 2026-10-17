import 'server-only';
import {
  approveIntegrationClient,
  authenticateIntegrationClient,
  authenticateIntegrationUser,
  authorizeIntegrationOps,
  integrationJson,
  listIntegrationClients,
  listIntegrationGrantsForClientPerson,
  listIntegrationGrantsForPerson,
  registerIntegrationGrant,
  requestIntegrationClient,
  revokeIntegrationClient,
  revokeIntegrationGrant,
  rotateIntegrationClientKey,
  withIntegrationApiHeaders,
  type IntegrationApiDeps,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { sendClientRequestEmail } from './send-client-request-email';

/**
 * Wiring of the integration API handlers to the database and identity code.
 * Everything the namespace needs from the rest of the app is listed here.
 */
export const integrationApiDeps: IntegrationApiDeps = {
  authenticateClient: (request) =>
    authenticateIntegrationClient({ request }, { db }),
  authenticateUser: (request) => authenticateIntegrationUser(request, { db }),
  authorizeOps: (request) =>
    authorizeIntegrationOps(
      request,
      process.env.HYPHA_INTEGRATION_CLIENT_OPS_SECRET,
    ),
  requestClient: (input, requester) =>
    requestIntegrationClient(
      input,
      { requestedByPersonId: requester.id },
      { db },
    ),
  notifyClientRequested: ({ client, requester }) =>
    sendClientRequestEmail({
      clientName: client.name,
      slug: client.slug,
      contactEmail: client.contactEmail,
      description: client.description,
      scopes: client.scopes,
      allowedOrigins: client.allowedOrigins,
      requesterName:
        [requester.name, requester.surname].filter(Boolean).join(' ') ||
        'Unknown',
      requesterSlug: requester.slug ?? null,
    }),
  listClients: () => listIntegrationClients({ db }),
  approveClient: (args) => approveIntegrationClient(args, { db }),
  revokeClient: (args) => revokeIntegrationClient(args, { db }),
  rotateClientKey: (args) => rotateIntegrationClientKey(args, { db }),
  registerGrant: (args) => registerIntegrationGrant(args, { db }),
  listClientGrants: (args) =>
    listIntegrationGrantsForClientPerson(args, { db }),
  listUserGrants: (args) => listIntegrationGrantsForPerson(args, { db }),
  revokeGrant: (args) => revokeIntegrationGrant(args, { db }),
};

/**
 * Every integration route exports its handler through this wrapper: all
 * responses, including an error that escaped the handler, carry the cache
 * headers of the namespace.
 */
export function integrationRoute<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return withIntegrationApiHeaders(handler, (error) => {
    console.error('Unhandled integration route error:', error);
    return integrationJson({ error: 'Internal error' }, { status: 500 });
  });
}
