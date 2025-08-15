import { z } from 'zod';

export const schemaAlchemyWebhook = z.object({
  webhookId: z.string(),
  id: z.string(),
  createdAt: z.string().datetime(),
  type: z.union([z.literal('GRAPHQL'), z.string()]),
  event: z.object({
    data: z.object({
      block: z.object({
        timestamp: z.coerce.number().nonnegative(),
        logs: z.array(z.unknown()),
      }),
    }),
    sequenceNumber: z.coerce.bigint(),
    network: z.union([z.literal('BASE_MAINNET'), z.string()]),
  }),
});

export type AlchemyWebhook = z.infer<typeof schemaAlchemyWebhook>;
