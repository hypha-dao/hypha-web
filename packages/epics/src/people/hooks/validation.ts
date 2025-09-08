import z from 'zod';
import { isAddress } from 'ethers';

export const purchaseSchema = z.object({
  payout: z.object({
    amount: z.string().min(1, 'Amount is required'),
    token: z.string(),
  }),
  recipient: z
    .string()
    .min(1, { message: 'Please add a recipient or wallet address' })
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});
