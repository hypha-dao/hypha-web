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

const swiftBankAddressSchema = z
  .object({
    street_line_1: z.string().trim().min(1).max(256),
    city: z.string().trim().min(1).max(128),
    postal_code: z.string().trim().max(32).optional(),
    country: z.string().trim().min(2).max(3),
    state: z.string().trim().max(128).optional(),
  })
  .strict();

export const schemaCreatePayoutAccount = z
  .object({
    railKey: z.enum(BANK_PAYOUT_RAIL_KEYS),
    sourceCurrency: z.enum(BRIDGE_DESTINATION_CURRENCIES),
    bankName: z.string().trim().min(1).max(256),
    accountName: z.string().trim().min(1).max(256),
    accountOwnerName: z.string().trim().min(1).max(256),
    accountOwnerType: z.enum(['business', 'individual']).optional(),
    firstName: z.string().trim().max(256).optional(),
    lastName: z.string().trim().max(256).optional(),
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
    // SWIFT-specific fields
    swiftAccountFormat: z.enum(['iban', 'other']).optional(),
    swiftIbanCountry: z.string().trim().min(2).max(3).optional(),
    swiftBankAddress: swiftBankAddressSchema.optional(),
    swiftCategory: z.string().trim().optional(),
    swiftPurposeOfFunds: z.array(z.string().trim()).optional(),
    swiftBusinessDescription: z.string().trim().max(1024).optional(),
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
      // Bridge enforces 3–35 chars on account_owner_name for ACH/Wire
      const ownerName = data.accountOwnerName.trim();
      if (ownerName.length < 3 || ownerName.length > 35) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'accountOwnerName must be 3–35 characters for US ACH/Wire accounts',
          path: ['accountOwnerName'],
        });
      }
    }

    if (rail.externalAccountType === 'iban') {
      if (!data.iban?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'iban is required for SEPA accounts',
          path: ['iban'],
        });
      }
      if (data.accountOwnerType === 'individual') {
        if (!data.firstName?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'firstName is required for individual SEPA accounts',
            path: ['firstName'],
          });
        }
        if (!data.lastName?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'lastName is required for individual SEPA accounts',
            path: ['lastName'],
          });
        }
      }
    }

    if (rail.externalAccountType === 'gb') {
      const cleanSortCode = (data.sortCode ?? '').replace(/\D/g, '');
      if (!cleanSortCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sortCode is required for GBP accounts',
          path: ['sortCode'],
        });
      } else if (!/^\d{6}$/.test(cleanSortCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sortCode must be exactly 6 digits for GBP accounts',
          path: ['sortCode'],
        });
      }
      const gbpAccountNumber = (data.accountNumber ?? '').trim();
      if (!gbpAccountNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'accountNumber is required for GBP accounts',
          path: ['accountNumber'],
        });
      } else if (!/^\d{8}$/.test(gbpAccountNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'accountNumber must be exactly 8 digits for GBP accounts',
          path: ['accountNumber'],
        });
      }
    }

    if (rail.externalAccountType === 'swift') {
      const isIban = data.swiftAccountFormat !== 'other';
      if (isIban) {
        if (!data.iban?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'iban is required for SWIFT IBAN accounts',
            path: ['iban'],
          });
        }
        if (!data.swiftIbanCountry?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'swiftIbanCountry is required for SWIFT IBAN accounts',
            path: ['swiftIbanCountry'],
          });
        }
      } else {
        if (!data.accountNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'accountNumber is required for SWIFT non-IBAN accounts',
            path: ['accountNumber'],
          });
        }
        if (!data.bic?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'bic is required for SWIFT non-IBAN accounts',
            path: ['bic'],
          });
        }
      }
      if (!data.swiftBankAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'swiftBankAddress is required for SWIFT accounts',
          path: ['swiftBankAddress'],
        });
      }
      if (!data.swiftCategory?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'swiftCategory is required for SWIFT accounts',
          path: ['swiftCategory'],
        });
      }
      if (!data.swiftPurposeOfFunds?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'swiftPurposeOfFunds is required for SWIFT accounts',
          path: ['swiftPurposeOfFunds'],
        });
      }
      if (!data.swiftBusinessDescription?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'swiftBusinessDescription is required for SWIFT accounts',
          path: ['swiftBusinessDescription'],
        });
      }
    }

    // US ACH/Wire: no accountOwnerType — Bridge only uses account_owner_name
    if (
      rail.externalAccountType !== 'us' &&
      data.accountOwnerType === 'business' &&
      !data.businessName?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'businessName is required for business accounts',
        path: ['businessName'],
      });
    }
  });

export type CreatePayoutAccountBody = z.infer<typeof schemaCreatePayoutAccount>;
