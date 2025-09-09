import { z } from 'zod';
import { isAddress } from 'ethers';

export const purchaseSchema = z.object({
  payout: z.object({
    amount: z.string().min(1, 'Please enter a purchase amount. '),
    token: z.string(),
  }),
  recipient: z
    .string()
    .min(1, { message: 'Please add a recipient or wallet address' })
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});

export const activateSpacesSchema = z.object({
  spaces: z
    .array(
      z.object({
        spaceId: z.number().min(1, 'Space is required'),
        months: z.number().min(1, 'Months must be at least 1'),
      }),
    )
    .min(1, 'At least one space must be added'),
  paymentToken: z.enum(['HYPHA', 'USDC']),
});

export type ActivateSpacesFormValues = z.infer<typeof activateSpacesSchema>;
