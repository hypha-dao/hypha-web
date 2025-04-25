import { z } from 'zod';

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const schemaPayForExpenses = z.object({
  recipient: z
    .string()
    .min(1, { message: 'Recipient is required' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),
  payouts: z
    .array(
      z.object({
        amount: z.string().min(1, { message: 'Amount is required' }),
        token: z.string().min(1, { message: 'Token is required' }),
      }),
    )
    .min(1, { message: 'At least one payout is required' }),
});
