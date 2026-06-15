import { z } from 'zod';

function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
  }
  return remainder === 1;
}

import {
  BRIDGE_DESTINATION_CURRENCIES,
  isAllowedBridgeDestinationCurrency,
} from './bridge-destination-currencies';
import {
  BANK_PAYOUT_RAIL_KEYS,
  BANK_TRANSFER_CORRIDOR_KEYS,
  BANK_VIRTUAL_ACCOUNT_CURRENCIES,
  getPaymentRailForCurrency,
  resolveBankPayoutRail,
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

const payoutAddressSchema = z
  .object({
    street_line_1: z.string().trim().min(1).max(256),
    street_line_2: z.string().trim().max(256).optional(),
    city: z.string().trim().min(1).max(128),
    subdivision: z.string().trim().max(128).optional(),
    postal_code: z.string().trim().min(1).max(32),
    country: z.string().trim().min(2).max(3),
  })
  .strict();

export const schemaCreatePayoutAccount = z
  .object({
    railKey: z.enum(BANK_PAYOUT_RAIL_KEYS),
    sourceCurrency: z.enum(BRIDGE_DESTINATION_CURRENCIES),
    bankName: z.string().trim().min(1).max(256),
    accountName: z.string().trim().min(1).max(256),
    accountOwnerName: z.string().trim().min(1).max(256),
    accountOwnerType: z.enum(['business', 'individual']),
    businessName: z.string().trim().max(256).optional(),
    routingNumber: z.string().trim().optional(),
    accountNumber: z.string().trim().optional(),
    checkingOrSavings: z.enum(['checking', 'savings']).optional(),
    iban: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isValidIban(v), {
        message: 'Invalid IBAN — check the number and try again',
      }),
    bic: z.string().trim().optional(),
    sortCode: z.string().trim().optional(),
    destinationCurrency: z.string().trim().optional(),
    wireMessage: z.string().trim().max(140).optional(),
    address: payoutAddressSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const rail = resolveBankPayoutRail(data.railKey);
    if (!rail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unsupported payout rail',
        path: ['railKey'],
      });
      return;
    }

    if (rail.externalAccountType === 'us') {
      if (!data.routingNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'routingNumber is required for USD accounts',
          path: ['routingNumber'],
        });
      }
      if (!data.accountNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'accountNumber is required for USD accounts',
          path: ['accountNumber'],
        });
      }
    }

    if (rail.externalAccountType === 'iban' && !data.iban?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'iban is required for SEPA accounts',
        path: ['iban'],
      });
    }

    if (rail.externalAccountType === 'gb') {
      if (!data.sortCode?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sortCode is required for GBP accounts',
          path: ['sortCode'],
        });
      }
      if (!data.accountNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'accountNumber is required for GBP accounts',
          path: ['accountNumber'],
        });
      }
    }

    if (rail.externalAccountType === 'swift') {
      if (!data.iban?.trim() && !data.accountNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'iban or accountNumber is required for SWIFT accounts',
          path: ['iban'],
        });
      }
      if (!data.bic?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'bic is required for SWIFT accounts',
          path: ['bic'],
        });
      }
    }

    if (data.accountOwnerType === 'business' && !data.businessName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'businessName is required for business accounts',
        path: ['businessName'],
      });
    }
  });

export type CreatePayoutAccountBody = z.infer<typeof schemaCreatePayoutAccount>;
