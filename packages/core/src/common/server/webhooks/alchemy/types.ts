import type { Abi, ContractEventName, ParseEventLogsReturnType } from 'viem';
import { z } from 'zod';

export type HandlerParams<A extends Abi, E extends ContractEventName<A>> = {
  signingKey: string;
  abi: A;
  event: E;
};

/**
 * @summary Callback to handle parsed logs from the Alchemy webhook
 * @param events Parsed events
 * @throws Any exception to signify an error
 */
export type Callback<A extends Abi, E extends ContractEventName<A>> = (
  events: ParseEventLogsReturnType<
    A,
    E,
    true,
    E extends ContractEventName<A>[] ? E[number] : E
  >,
) => Promise<void>;

export const schemaWebhookBody = z.object({
  webhookId: z.string(),
  id: z.string(),
  createdAt: z.iso.datetime(),
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

export type WebhookBody = z.infer<typeof schemaWebhookBody>;
