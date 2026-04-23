import { z } from 'zod';

/** Align with {@link schemaProposeContribution} / `schemaPayoutRow` — avoid Zod's generic "Required" on `undefined`. */
const payoutRowField = z.object({
  amount: z.preprocess(
    (val) => (val === undefined || val === null ? '' : String(val)),
    z
      .string()
      .min(1, { message: 'Please enter an amount.' })
      .refine(
        (value) => {
          const n = parseFloat(value);
          return !Number.isNaN(n) && n > 0;
        },
        { message: 'Amount must be greater than 0' },
      ),
  ),
  token: z.preprocess(
    (val) => (val === undefined || val === null ? '' : val),
    z.string().min(1, { message: 'Please select a token' }),
  ),
});

export const payoutsField = z
  .array(payoutRowField)
  .min(1, { message: 'At least one payout is required' });

export const payoutsFieldSchema = z.object({ payouts: payoutsField });
