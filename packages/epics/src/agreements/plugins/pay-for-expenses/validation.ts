import { z } from 'zod';

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const schemaPayForExpenses = z.object({
  recipient: z
    .string()
    .min(1, { message: 'Recipient is required' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),
});
