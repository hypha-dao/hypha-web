import { percentageStringToBigInt } from '@hypha-platform/core/client';
import { z } from 'zod';

export const conversionsField = z
  .array(
    z.object({
      asset: z.string().min(1, { message: 'Asset is required' }),
      percentage: z.string().refine(
        (value) => {
          const num = parseFloat(value);
          return num >= 0 && num <= 100;
        },
        { message: 'Percentage must be between 0 and 100' },
      ),
    }),
  )
  .min(1, { message: 'At least one conversion is required' })
  .refine(
    (value) =>
      value.reduce(
        (acc, curr) => acc + percentageStringToBigInt(curr.percentage),
        0n,
      ) === 10000n,
    {
      message: 'Summary percentage must be 100%',
    },
  );

export const schemaRedeemTokens = z.object({
  redemptions: z
    .array(
      z.object({
        token: z.string().min(1, { message: 'Token is required' }),
        amount: z.string().refine((value) => parseFloat(value) > 0, {
          message: 'Amount must be greater than 0',
        }),
      }),
    )
    .length(1, { message: 'Only one redemption is required' }),
  conversions: conversionsField,
});
