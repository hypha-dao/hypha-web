import { z } from 'zod';

import { BANK_VIRTUAL_ACCOUNT_CURRENCIES } from './constants';

export const schemaSpaceBankCustomerOnboarding = z
  .object({
    legalName: z.string().trim().min(1, 'legalName is required').max(1024),
    contactEmail: z.string().trim().email('contactEmail must be a valid email'),
    endorsements: z.array(z.string()).optional(),
  })
  .strict();

export type SpaceBankCustomerOnboardingInput = z.infer<
  typeof schemaSpaceBankCustomerOnboarding
>;

export const schemaProvisionVirtualAccount = z
  .object({
    currency: z.enum(BANK_VIRTUAL_ACCOUNT_CURRENCIES),
  })
  .strict();

export type ProvisionVirtualAccountBody = z.infer<
  typeof schemaProvisionVirtualAccount
>;

const optionalOnboardingFields = {
  legalName: z.string().trim().min(1).max(1024).optional(),
  contactEmail: z.string().trim().email().optional(),
};

export const schemaCreateBankTransfer = z
  .object({
    currency: z.enum(BANK_VIRTUAL_ACCOUNT_CURRENCIES),
    amount: z
      .string()
      .trim()
      .min(1)
      .regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal string')
      .optional(),
    ...optionalOnboardingFields,
  })
  .strict();

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
