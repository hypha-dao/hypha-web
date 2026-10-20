import { z } from 'zod';

import { INTEGRATION_ACTION_OPERATIONS } from './types';

/** Body of `POST actions`. Slugs are looked up, never rendered back as text. */
export const schemaPrepareIntegrationAction = z.object({
  operation: z.enum(INTEGRATION_ACTION_OPERATIONS),
  spaceSlug: z.string().trim().min(1).max(255),
  proposalSlug: z.string().trim().min(1).max(255),
  choice: z.enum(['yes', 'no']),
});

export type PrepareIntegrationActionInput = z.infer<
  typeof schemaPrepareIntegrationAction
>;

/** Body of `POST users/me/actions/{id}/result`. */
export const schemaActionResult = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('submitted'),
    txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  }),
  z.object({ outcome: z.literal('failed') }),
]);

export type ActionResultInput = z.infer<typeof schemaActionResult>;
