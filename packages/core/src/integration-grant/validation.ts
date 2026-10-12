import { z } from 'zod';

import { INTEGRATION_CLIENT_SCOPES } from '../integration-client/types';

/** Body of a grant registration; scopes default to all of the client's. */
export const schemaRegisterIntegrationGrant = z.object({
  scopes: z.array(z.enum(INTEGRATION_CLIENT_SCOPES)).min(1).max(10).optional(),
});

export type RegisterIntegrationGrantInput = z.infer<
  typeof schemaRegisterIntegrationGrant
>;
