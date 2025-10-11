import { z } from 'zod';

export const payoutsField = z
  .array(
    z.object({
      amount: z.string().min(1, 'Amount is required'),
      token: z.string().min(1, 'Token is required'),
    }),
  )
  .min(1, 'At least one payout is required');

export const payoutsFieldSchema = z.object({ payouts: payoutsField });
