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
      z
        .object({
          spaceId: z.number(),
          months: z.number(),
        })
        .superRefine((val, ctx) => {
          if (!val.spaceId || val.spaceId < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['spaceId'],
              message: 'Please select a space to activate.',
            });
          }
          if (!val.months || val.months < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['months'],
              message: 'Please enter the number of months to activate.',
            });
          }
        }),
    )
    .min(1, 'At least one space must be added'),
  paymentToken: z.enum(['HYPHA', 'USDC']),
  recipient: z
    .string()
    .min(1, { message: 'Please add a recipient or wallet address' })
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});

export type ActivateSpacesFormValues = z.infer<typeof activateSpacesSchema>;

export const yesNoEnum = z.enum(['yes', 'no']);

export const schemaNotificationCentreForm = z.object({
  emailNotifications: yesNoEnum.default('no'),
  browserNotifications: yesNoEnum.default('no'),
  newProposalOpen: z.boolean().default(false),
  proposalApprovedOrRejected: z.boolean().default(false),
});

export type YesNo = z.infer<typeof yesNoEnum>;

export type NotificationCentreFormValues = z.infer<
  typeof schemaNotificationCentreForm
>;
