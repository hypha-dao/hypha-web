import { z } from 'zod';

import {
  BRIDGE_DESTINATION_CURRENCIES,
  isAllowedBridgeDestinationCurrency,
} from './bridge-destination-currencies';
import {
  BANK_TRANSFER_CORRIDOR_KEYS,
  BANK_VIRTUAL_ACCOUNT_CURRENCIES,
  getPaymentRailForCurrency,
  resolveBankTransferCorridor,
} from './constants';

export const schemaSpaceBankCustomerOnboarding = z
  .object({
    legalName: z.string().trim().min(1, 'legalName is required').max(1024),
    contactEmail: z.string().trim().email('contactEmail must be a valid email'),
    requestedRails: z.array(z.enum(BANK_VIRTUAL_ACCOUNT_CURRENCIES)).optional(),
    endorsements: z.array(z.string()).optional(),
  })
  .strict();

export type SpaceBankCustomerOnboardingInput = z.infer<
  typeof schemaSpaceBankCustomerOnboarding
>;

export const schemaProvisionVirtualAccount = z
  .object({
    currency: z.enum(BANK_VIRTUAL_ACCOUNT_CURRENCIES),
    destinationCurrency: z.enum(BRIDGE_DESTINATION_CURRENCIES).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.destinationCurrency) {
      return;
    }
    const paymentRail = getPaymentRailForCurrency(data.currency);
    if (
      !paymentRail ||
      !isAllowedBridgeDestinationCurrency({
        sourceRail: paymentRail,
        destinationCurrency: data.destinationCurrency,
      })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'destinationCurrency is not supported for this currency',
        path: ['destinationCurrency'],
      });
    }
  });

export type ProvisionVirtualAccountBody = z.infer<
  typeof schemaProvisionVirtualAccount
>;

const optionalOnboardingFields = {
  legalName: z.string().trim().min(1).max(1024).optional(),
  contactEmail: z.string().trim().email().optional(),
};

export const schemaRequestEndorsementKyc = z
  .object({
    endorsement: z.string().trim().min(1),
  })
  .strict();

export const schemaCreateBankTransfer = z
  .object({
    railKey: z.enum(BANK_TRANSFER_CORRIDOR_KEYS).optional(),
    corridorKey: z.enum(BANK_TRANSFER_CORRIDOR_KEYS).optional(),
    currency: z.enum(BANK_VIRTUAL_ACCOUNT_CURRENCIES).optional(),
    destinationCurrency: z.enum(BRIDGE_DESTINATION_CURRENCIES).optional(),
    amount: z
      .string()
      .trim()
      .min(1)
      .regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal string')
      .optional(),
    /** Client-supplied per-action key so retries dedupe at Bridge (24h window). */
    idempotencyKey: z.string().uuid().optional(),
    ...optionalOnboardingFields,
  })
  .strict()
  .refine((data) => data.corridorKey != null || data.currency != null, {
    message: 'corridorKey or currency is required',
  })
  .superRefine((data, ctx) => {
    if (!data.destinationCurrency) {
      return;
    }

    const corridor = resolveBankTransferCorridor({
      corridorKey: data.corridorKey ?? data.railKey,
      currency: data.currency,
    });
    const paymentRail = corridor?.paymentRail ?? null;

    if (
      !paymentRail ||
      !isAllowedBridgeDestinationCurrency({
        sourceRail: paymentRail,
        destinationCurrency: data.destinationCurrency,
      })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'destinationCurrency is not supported for this corridor',
        path: ['destinationCurrency'],
      });
    }
  });

export type CreateBankTransferBody = z.infer<typeof schemaCreateBankTransfer>;

export const schemaRequestSpaceBankVirtualAccounts = z
  .object({
    currencies: z
      .array(z.enum(BANK_VIRTUAL_ACCOUNT_CURRENCIES))
      .min(1, 'currencies must include at least one value'),
    ...optionalOnboardingFields,
  })
  .strict();

export type RequestSpaceBankVirtualAccountsBody = z.infer<
  typeof schemaRequestSpaceBankVirtualAccounts
>;
