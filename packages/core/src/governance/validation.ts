import { z } from 'zod';
import {
  ALLOWED_IMAGE_FILE_SIZE,
  DEFAULT_FILE_ACCEPT,
  DEFAULT_IMAGE_ACCEPT,
  UPLOADTHING_ATTACHMENTS_LIMIT_MESSAGE,
  UPLOADTHING_STANDARD_MAX_FILE_COUNT,
  UPLOADTHING_STANDARD_MAX_SIZE_LABEL,
} from '../assets/constant';
import { isBefore } from 'date-fns';
import {
  DocumentState,
  EntryMethodType,
  REFERENCE_CURRENCIES,
  TOKEN_PRICE_REFERENCE_CURRENCIES,
} from './types';
import { getAddress, isAddress } from 'ethers';

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const paymentScheduleOptions = [
  'Immediately',
  'Future Payment',
  'Milestones',
] as const;
export type PaymentScheduleOption = (typeof paymentScheduleOptions)[number];

export const dateRangeSchema = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
  })
  .optional();

export const milestoneSchema = z.object({
  percentage: z.number().min(0).max(100),
  dateRange: dateRangeSchema,
});

export const paymentScheduleSchema = z
  .object({
    option: z.enum(paymentScheduleOptions),
    futureDate: z.date().optional(),
    milestones: z.array(milestoneSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.option === 'Future Payment' && data.futureDate) {
      if (isBefore(data.futureDate, new Date())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'The future payment date must be later than the current date',
          path: ['futureDate'],
        });
      }
    }

    if (data.option === 'Milestones' && data.milestones) {
      if (!data.milestones || data.milestones.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Milestones cannot be empty',
          path: ['milestones'],
        });
        return;
      }

      const total = data.milestones.reduce((sum, m) => sum + m.percentage, 0);
      const now = new Date();

      for (let i = 0; i < data.milestones.length; i++) {
        const milestone = data.milestones[i];
        // @ts-ignore TODO: fix types
        const { dateRange } = milestone;

        if (!dateRange?.from) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Each milestone must have a start date',
            path: ['milestones', i, 'dateRange', 'from'],
          });
        }

        if (i === 0 && dateRange?.from && isBefore(dateRange.from, now)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'First milestone must be in the future',
            path: ['milestones', i, 'dateRange', 'from'],
          });
        }

        const previous = data.milestones[i - 1];
        const previousFrom = previous?.dateRange?.from;
        if (
          i > 0 &&
          previousFrom &&
          dateRange?.from &&
          isBefore(dateRange.from, previousFrom)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Milestone ${i + 1} must be after milestone ${i}`,
            path: ['milestones', i, 'dateRange', 'from'],
          });
        }
      }

      if (total > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Total percentage cannot exceed 100%',
          path: ['milestones'],
        });
      }
    }
  });

const createAgreementWeb2Props = {
  title: z
    .string()
    .trim()
    .min(1, { message: 'Please add a title for your proposal' })
    .max(50),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Please add content to your proposal' })
    .max(4000),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    )
    .optional(),
  creatorId: z.number().min(1),
  spaceId: z.number().min(1),
  web3ProposalId: z.number().optional(),
  label: z.string().optional(),
  state: z.nativeEnum(DocumentState).optional(),
};

export const schemaCreateAgreementWeb2 = z.object(createAgreementWeb2Props);

export const schemaRequestInvite = schemaCreateAgreementWeb2.extend({
  memberAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
    .min(1, { message: 'Member address is required' }),
});

export const createAgreementWeb2FileUrls = {
  leadImage: z.string().url('Lead Image URL must be a valid URL').optional(),
};

export const schemaCreateAgreementWeb2FileUrls = z.object(
  createAgreementWeb2FileUrls,
);

const isBrowserFile = (v: unknown): v is File =>
  typeof File !== 'undefined' && v instanceof File;

const fileTooLargeMessage = `Your file is too large and exceeds the ${UPLOADTHING_STANDARD_MAX_SIZE_LABEL} limit. Please upload a smaller file.`;

const leadImageFileSchema = z
  .custom<File>(isBrowserFile, { message: 'Please upload a valid file' })
  .refine((file) => file.size <= ALLOWED_IMAGE_FILE_SIZE, fileTooLargeMessage)
  .refine(
    (file) => DEFAULT_IMAGE_ACCEPT.includes(file.type),
    'File must be an image (JPEG, PNG, GIF, WEBP).',
  );

const attachmentFileSchema = z
  .custom<File>(isBrowserFile, { message: 'Please upload a valid file' })
  .refine(
    (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
    (file) => ({
      message: `Your file "${file.name}" is too large and exceeds the ${UPLOADTHING_STANDARD_MAX_SIZE_LABEL} limit. Please upload a smaller file.`,
    }),
  )
  .refine(
    (file) => DEFAULT_FILE_ACCEPT.includes(file.type),
    (file) => ({
      message: `This file "${file.name}" format isn’t supported. Please upload a JPEG, PNG, WebP, or PDF (up to ${UPLOADTHING_STANDARD_MAX_SIZE_LABEL}).`,
    }),
  );

export const createAgreementFiles = {
  leadImage: z
    .union([
      leadImageFileSchema,
      z.string().url('Lead Image URL must be a valid URL'),
    ])
    .optional(),
  attachments: z
    .array(
      z.union([
        attachmentFileSchema,
        z.string().url('Attachment URL must be a valid URL'),
        z.object({
          name: z.string().min(1, 'Attachment name is required'),
          url: z.string().url('Attachment URL must be a valid URL'),
        }),
      ]),
    )
    .max(UPLOADTHING_STANDARD_MAX_FILE_COUNT, {
      message: UPLOADTHING_ATTACHMENTS_LIMIT_MESSAGE,
    })
    .optional(),
};

export const schemaCreateAgreementFiles = z.object(createAgreementFiles);

export const schemaCreateAgreement = z.object({
  ...createAgreementWeb2Props,
  web3SpaceId: z.number().optional(),
});

/** Single payout row — preprocess `undefined` (RHF defaults) so Zod runs `.min()` instead of generic "Required". */
const schemaPayoutRow = z.object({
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

export const schemaProposeContribution = z.object({
  recipient: z
    .string()
    .min(1, { message: 'Please add a recipient or wallet address' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' })
    .optional(),

  payouts: z
    .array(schemaPayoutRow)
    .min(1, { message: 'At least one payout is required' })
    .optional(),

  paymentSchedule: paymentScheduleSchema.optional(),
});

export const transactionSchema = z.object({
  target: z
    .string()
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' })
    .min(1, { message: 'Target address is required' }),
  value: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Value must be greater than or equal to 0' }),
  ),
  data: z.string().optional(),
});

export const schemaMemberWithNumber = z.object({
  member: z
    .string()
    .min(1, { message: 'Recipient is required' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),
  number: z.number().min(0, 'Number must be non-negative'),
});

export const schemaDecaySettings = z.object({
  decayPeriod: z.number().min(1, 'Decay period must be at least 1').max(200),
  timeFormat: z.enum(['Minutes', 'Hours', 'Days', 'Weeks', 'Months']),
  decayPercent: z
    .number()
    .min(1)
    .max(100, 'Decay percent must be between 1-100'),
});

export const schemaQuorumAndUnity = z.object({
  quorum: z.number().min(0).max(100, 'Quorum must be between 0-100'),
  unity: z.number().min(0).max(100, 'Unity must be between 0-100'),
});

const decaySettingsSchema = z.object({
  decayInterval: z
    .number({
      invalid_type_error: 'Please enter a voice decay frequency',
    })
    .positive({ message: 'Voice decay frequency must be greater than 0' }),
  decayPercentage: z
    .number({
      invalid_type_error: 'Please enter a voice decay percentage',
    })
    .positive({ message: 'Voice decay percentage must be greater than 0' })
    .lte(100, {
      message: 'Decay percentage must not exceed 100%',
    }),
});

const transferWhitelistEntrySchema = z.object({
  type: z.enum(['member', 'space']).default('member'),
  address: z
    .string({ message: 'Please enter a blockchain address' })
    .trim()
    .min(1, { message: 'Please enter a blockchain address' })
    .refine((value) => isAddress(value), {
      message: 'Please enter a valid blockchain address',
    }),
  includeSpaceMembers: z.boolean().optional(),
});

/** Stable message token for i18n mapping in issue/update token forms */
export const WHITELIST_DUPLICATE_ENTRY_MESSAGE =
  '__WHITELIST_DUPLICATE_ENTRY__';

/** Same member/space key used for Zod duplicate checks and whitelist combobox filtering */
export function transferWhitelistEntryDedupeKey(
  type: 'member' | 'space',
  address: string,
): string | undefined {
  const trimmed = address.trim();
  if (!trimmed) return undefined;
  if (!isAddress(trimmed)) {
    // Avoid `trimmed` after `!isAddress`: ethers’ type guard narrows to `never` here in strict TS.
    return `${type === 'space' ? 's' : 'm'}:raw:${address
      .trim()
      .toLowerCase()}`;
  }
  try {
    const norm = getAddress(trimmed).toLowerCase();
    return `${type === 'space' ? 's' : 'm'}:${norm}`;
  } catch {
    return undefined;
  }
}

function refineTransferWhitelistNoDuplicates(
  data: { to?: unknown[]; from?: unknown[] },
  ctx: z.RefinementCtx,
) {
  const checkSide = (side: 'to' | 'from') => {
    const arr = data[side] as
      | Array<{ type?: string; address?: string }>
      | undefined;
    if (!arr?.length) return;
    const keyToIndices = new Map<string, number[]>();
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      const t = e?.type === 'space' ? 'space' : 'member';
      const key = e?.address
        ? transferWhitelistEntryDedupeKey(t, e.address)
        : undefined;
      if (!key) continue;
      const list = keyToIndices.get(key) ?? [];
      list.push(i);
      keyToIndices.set(key, list);
    }
    for (const indices of keyToIndices.values()) {
      if (indices.length < 2) continue;
      for (const idx of indices) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: WHITELIST_DUPLICATE_ENTRY_MESSAGE,
          path: [side, idx, 'address'],
        });
      }
    }
  };
  checkSide('to');
  checkSide('from');
}

const transferWhitelistSchema = z
  .object({
    to: z.array(transferWhitelistEntrySchema).optional(),
    from: z.array(transferWhitelistEntrySchema).optional(),
  })
  .superRefine((data, ctx) => {
    refineTransferWhitelistNoDuplicates(data, ctx);
  });

export const schemaMintTokensToSpaceTreasury = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  mint: z.object({
    amount: z
      .string({ message: 'Please enter amount' })
      .min(1, 'Please enter amount'),
    token: z
      .string({ message: 'Choose a token to mint' })
      .min(1, 'Choose a token to mint'),
  }),
});

const acceptInvestmentAmountRefine = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
};

const acceptInvestmentTokenRow = z.object({
  amount: z
    .string({ message: 'Please enter amount' })
    .min(1, 'Please enter amount')
    .refine(acceptInvestmentAmountRefine, {
      message: 'Amount must be greater than 0',
    }),
  token: z
    .string({ message: 'Token is required' })
    .min(1, 'Token is required')
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});

/** v1: escrow contract supports a single token pair (one send leg, one receive leg). */
export const schemaAcceptInvestment = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  /** User-authored body; marker appended on submit must stay within API limits. */
  description: z
    .string()
    .trim()
    .min(1, { message: 'Please add content to your proposal' })
    .max(3500),
  label: z.literal('Investment'),
  recipient: z
    .string({ message: 'Please add a recipient or wallet address' })
    .min(1, { message: 'Please add a recipient or wallet address' })
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
  investorSendLegs: z.array(acceptInvestmentTokenRow).length(1, {
    message:
      'Exactly one token row is required under Investing Member will Send',
  }),
  spaceReceiveLegs: z.array(acceptInvestmentTokenRow).length(1, {
    message:
      'Exactly one token row is required under Investing Member will Receive',
  }),
});

const exchangeTokenRow = z.object({
  amount: z
    .string()
    .refine((value) => value.trim() !== '', {
      message: 'Please enter an amount.',
    })
    .refine(
      (value) => {
        const normalized = value.trim();
        const amount = Number(normalized);
        return Number.isFinite(amount) && amount > 0;
      },
      { message: 'Amount must be greater than 0' },
    ),
  token: z
    .string()
    .min(1, { message: 'Please select a token' })
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});

/** v1: exchange escrow supports a single token pair on each side. */
export const schemaExchangeStakesAndTokens = z
  .object({
    ...createAgreementWeb2Props,
    ...createAgreementFiles,
    label: z.literal('Exchange'),
    /** Plugin-controlled hint for client-side balance checks. */
    sellerRecipientType: z.enum(['member', 'space']).optional(),
    buyerRecipientType: z.enum(['member', 'space']).optional(),
    /** Buyer space treasury executor — used as on-chain escrow partyB when buyer is a space. */
    buyerExecutorAddressForSettlement: z.string().optional(),
    /** Active space treasury executor — used as on-chain escrow partyA when seller is a space. */
    spaceExecutorAddress: z.string().optional(),
    sellerAddress: z
      .string()
      .min(1, { message: 'Please add a recipient or wallet address' })
      .refine(isAddress, { message: 'Invalid Ethereum address' }),
    sellerLeg: z
      .array(exchangeTokenRow)
      .length(1, { message: 'Exactly one seller token row is required' }),
    buyerAddress: z
      .string()
      .min(1, { message: 'Please add a recipient or wallet address' })
      .refine(isAddress, { message: 'Invalid Ethereum address' }),
    buyerLeg: z
      .array(exchangeTokenRow)
      .length(1, { message: 'Exactly one buyer token row is required' }),
  })
  .superRefine((data, ctx) => {
    if (data.buyerRecipientType === 'space') {
      const exec = data.buyerExecutorAddressForSettlement?.trim();
      if (!exec || !isAddress(exec)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Buyer space treasury is unavailable',
          path: ['buyerAddress'],
        });
      }
    }
    if (data.sellerRecipientType === 'space') {
      const exec = data.spaceExecutorAddress?.trim();
      if (!exec || !isAddress(exec)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Seller space treasury is unavailable',
          path: ['sellerAddress'],
        });
      }
    }
    // Space↔space exchanges are supported: the proposing space funds its leg
    // inline at createEscrow; the counterparty space funds via a follow-up
    // proposal triggered from the space-page deposit banner.
  });

const schemaTokenBurningTarget = z
  .object({
    type: z.enum(['member', 'space']).default('member'),
    address: z
      .string({ message: 'Please add a recipient or wallet address' })
      .trim()
      .min(1, { message: 'Please add a recipient or wallet address' })
      .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),
    amount: z.string().optional(),
    allBalance: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.allBalance) {
      return;
    }

    if (!data.amount || data.amount.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter an amount to continue.',
        path: ['amount'],
      });
      return;
    }

    const parsedAmount = Number(data.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount must be greater than 0',
        path: ['amount'],
      });
    }
  });

export const schemaTokenBurning = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  label: z.literal('Token Burning').optional(),
  tokenBurning: z.object({
    token: z
      .string({ message: 'Choose a token to burn' })
      .min(1, 'Choose a token to burn')
      .refine((value) => isAddress(value), {
        message: 'Invalid token address',
      }),
    burns: z
      .array(schemaTokenBurningTarget)
      .min(1, 'At least one burn target is required'),
  }),
});

export const baseSchemaIssueNewToken = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,

  name: z
    .string()
    .trim()
    .min(2, { message: 'Please enter a token name (min. 2 characters)' })
    .max(100, { message: 'Token name must be at most 100 characters long' })
    .refine((val) => !/[\p{Emoji}]|(https?:\/\/|www\.|t\.me\/)/iu.test(val), {
      message: 'Token name cannot contain emojis or links',
    }),

  symbol: z
    .string()
    .trim()
    .min(2, { message: 'Please enter a token symbol (min. 2 characters)' })
    .max(10, { message: 'Token symbol must be at most 10 characters long' })
    .regex(/^[A-Z]+$/, {
      message:
        'Please enter the token symbol using only uppercase letters (A–Z)',
    })
    .refine((val) => !/[\p{Emoji}]|(https?:\/\/|www\.|t\.me\/)/iu.test(val), {
      message: 'Token symbol cannot contain emojis or links',
    }),

  iconUrl: z
    .union([
      z
        .string({ message: 'Please upload a token icon' })
        .url('Icon URL must be a valid URL'),
      z.literal(''),
      z
        .custom<File>(isBrowserFile, { message: 'Please upload a valid file' })
        .refine(
          (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
          fileTooLargeMessage,
        )
        .refine(
          (file) => DEFAULT_IMAGE_ACCEPT.includes(file.type),
          'File must be an image (JPEG, PNG, GIF, WEBP)',
        ),
    ])
    .transform((val) => (val === '' || val === null ? undefined : val)),

  type: z.enum(
    [
      'utility',
      'credits',
      'ownership',
      'voice',
      'impact',
      'community_currency',
    ],
    {
      required_error: 'Please select a token type',
    },
  ),

  maxSupply: z.preprocess(
    (val) => Number(val),
    z
      .number()
      .min(0, { message: 'Max supply must be 0 or greater' })
      .refine((value) => value >= 0, {
        message: 'Max supply must be a non-negative number',
      }),
  ),

  maxSupplyType: z
    .object({
      label: z.string(),
      value: z.enum(['immutable', 'updatable']),
    })
    .optional(),
  decaySettings: decaySettingsSchema,

  isVotingToken: z.boolean(),
  transferable: z.boolean().optional(),
  enableAdvancedTransferControls: z.boolean().optional(),
  transferWhitelist: transferWhitelistSchema.optional(),

  enableProposalAutoMinting: z.boolean(),
  enableLimitedSupply: z.boolean().optional(),
  enableTokenPrice: z.boolean(),
  referenceCurrency: z.enum(TOKEN_PRICE_REFERENCE_CURRENCIES).optional(),
  tokenPrice: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) {
      return undefined;
    }
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }, z.number().positive().optional()),

  /** Mutual credit: opt-in toggle to enable credit lines for whitelisted spaces */
  enableMutualCredit: z.boolean().optional(),
  /** Per-eligible-account credit limit, in human token units (multiplied by 10^18 on-chain) */
  defaultCreditLimit: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) {
      return undefined;
    }
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }, z.number().int().nonnegative().optional()),
  /** Web3 space ids whose members are eligible for the credit line */
  creditWhitelistedSpaceIds: z.array(z.number().int().nonnegative()).optional(),
  /**
   * Extra wallet addresses granted minter rights (mint, burnFrom,
   * batchSetCreditWhitelistAddresses) on the new token, in addition to the
   * space executor/owner. On creation these become the token's initial
   * authorized minters; on update they are granted via `batchSetAuthorizedMinters`.
   */
  authorizedMinters: z
    .array(
      z.string().refine((v) => isAddress(v), {
        message: 'Please enter a valid blockchain address',
      }),
    )
    .optional(),
  /**
   * Update flow only: wallet addresses whose minter rights should be revoked
   * via `batchSetAuthorizedMinters(accounts, [false, ...])`.
   */
  authorizedMintersToRevoke: z
    .array(
      z.string().refine((v) => isAddress(v), {
        message: 'Please enter a valid blockchain address',
      }),
    )
    .optional(),
  /**
   * Plugin-populated list of selectable spaces, used to resolve `transferWhitelist`
   * space rows → web3 space ids in the orchestrator. Validates the minimal shape
   * the orchestrator actually reads (`address`, `web3SpaceId`) so primitives/null
   * items can't slip through and crash `splitWhitelistFormToTargets`. Extra
   * `Space` fields are accepted on input and stripped on parse — the orchestrator
   * doesn't read them.
   */
  spacesForWhitelistResolution: z
    .array(
      z.object({
        address: z.string().nullable().optional(),
        web3SpaceId: z.number().int().nullable().optional(),
      }),
    )
    .optional(),
});

export const schemaIssueNewToken = baseSchemaIssueNewToken.superRefine(
  (data, ctx) => {
    if (
      (data.enableLimitedSupply === true || data.maxSupply > 0) &&
      !data.maxSupplyType
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a max supply type',
        path: ['maxSupplyType'],
      });
    }

    if (
      data.maxSupplyType?.value === 'updatable' &&
      (data.maxSupply == null || isNaN(data.maxSupply) || data.maxSupply <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Max supply must be greater than 0 when updatable type is selected',
        path: ['maxSupply'],
      });
    }

    if (data.enableTokenPrice) {
      if (!data.referenceCurrency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please select a reference currency',
          path: ['referenceCurrency'],
        });
      }
      if (
        data.tokenPrice === undefined ||
        data.tokenPrice === null ||
        isNaN(data.tokenPrice) ||
        data.tokenPrice <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a token price greater than 0',
          path: ['tokenPrice'],
        });
      }
    }

    if (data.enableMutualCredit) {
      if (
        data.defaultCreditLimit === undefined ||
        data.defaultCreditLimit === null ||
        isNaN(data.defaultCreditLimit) ||
        data.defaultCreditLimit <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a credit limit greater than 0',
          path: ['defaultCreditLimit'],
        });
      }
    }
  },
);

export const schemaCreateProposalChangeVotingMethodMembersField = z
  .object({
    member: z
      .string()
      .trim()
      .min(1, { message: 'Please select a member.' })
      .refine((memberAddress) => isAddress(memberAddress), {
        message: 'Invalid member address.',
      })
      .catch(''),
    number: z.coerce
      .number()
      .positive({ message: 'Please specify a positive number of tokens.' })
      .catch(0),
  })
  .refine(({ member, number }) => !!(member && number > 0), {
    message:
      'Please select a member and specify the number of tokens to allocate.',
    path: [],
  });

export const schemaCreateProposalChangeVotingMethod = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { message: 'Please add a title for your proposal' })
      .max(50),
    description: z
      .string()
      .trim()
      .min(1, { message: 'Please add content to your proposal' })
      .max(4000),
    slug: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    creatorId: z.number().min(1),
    spaceId: z.number().min(1),
    web3ProposalId: z.number().optional(),
    label: z.string().optional(),
    members: z
      .array(schemaCreateProposalChangeVotingMethodMembersField)
      .optional(),
    token: z.string().optional(),
    quorumAndUnity: z
      .object({
        quorum: z.number().min(0).max(100),
        unity: z.number().min(0).max(100),
      })
      .optional(),
    votingMethod: z.enum(['1m1v', '1v1v', '1t1v']).nullable().optional(),
    autoExecution: z.boolean().optional(),
    votingDuration: z
      .number({
        message:
          'Auto-execution is disabled. Please set a minimum voting duration.',
      })
      .optional(),
    leadImage: z.custom<File>().optional(),
    attachments: z
      .array(z.custom<File>())
      .max(UPLOADTHING_STANDARD_MAX_FILE_COUNT)
      .optional(),
  })
  .refine(
    (data) => {
      if (data.autoExecution === false) {
        return data.votingDuration !== undefined && data.votingDuration > 0;
      }
      return true;
    },
    {
      message:
        'Auto-execution is disabled. Please set a minimum voting duration.',
      path: ['votingDuration'],
    },
  )
  .refine(
    (data) => {
      if (data.votingMethod === '1v1v' || data.votingMethod === '1t1v') {
        return typeof data.token === 'string' && data.token.length > 0;
      }
      return true;
    },
    {
      message: 'Please select a token to pursue with this voting method.',
      path: ['token'],
    },
  );

export const schemaCreateAgreementForm = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  recipient: schemaProposeContribution.shape.recipient,
  payouts: schemaProposeContribution.shape.payouts,
  paymentSchedule: paymentScheduleSchema.optional(),
});

export const schemaCreateProposalWeb3 = z.object({
  spaceId: z
    .bigint()
    .min(1n, { message: 'Space ID must be a positive number' }),
  duration: z.bigint().min(1n, { message: 'Duration must be greater than 0' }),
  transactions: z
    .array(transactionSchema, { message: 'Invalid transactions' })
    .min(1, { message: 'At least one transaction is required' }),
});

export const schemaChangeEntryMethod = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  entryMethod: z
    .number()
    .int()
    .min(EntryMethodType.OPEN_ACCESS)
    .max(EntryMethodType.INVITE_ONLY),
  tokenBase: z
    .object({
      amount: z
        .number()
        .int('Should be integer')
        .positive('Amount must be greater than 0'),
      token: z
        .string()
        .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' })
        .min(1, { message: 'Token address is required' }),
    })
    .optional(),
});

export const schemaBuyHyphaTokens = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  payout: z.object({
    amount: z.string().min(1, 'Please enter a purchase amount. '),
    token: z.string(),
  }),
  recipient: z
    .string()
    .min(1, { message: 'Please add a recipient or wallet address' })
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});

export const schemaActivateSpaces = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  label: z.literal('Activate Spaces'),
  recipient: z.string(),
  paymentToken: z.enum(['HYPHA', 'USDC']),
  spaces: z
    .array(
      z.object({
        spaceId: z
          .number()
          .min(1, { message: 'Please select a space to activate.' }),
        months: z.number().min(1, {
          message: 'Please enter the number of months to activate.',
        }),
      }),
    )
    .min(1),
});

export const schemaSpaceToSpaceMembership = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  label: z.literal('Space To Space'),
  space: z
    .string({ message: 'Please select a space to join' })
    .min(1)
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
  member: z
    .string({ message: 'Please select a delegated voting member' })
    .min(1)
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});

export const schemaChangeSpaceDelegate = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  label: z.literal('Change Delegate'),
  space: z
    .string({ message: 'Please select a governance space' })
    .min(1, { message: 'Please select a governance space' })
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
  member: z
    .string({ message: 'Please select a delegated voting member' })
    .min(1, { message: 'Please select a delegated voting member' })
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});

export const schemaMembershipExit = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  label: z.literal('Membership Exit'),
  space: z.number().min(1, { message: 'Please select a space to exit.' }),
  member: z
    .string({ message: 'Please select a member to remove' })
    .min(1)
    .refine(isAddress, { message: 'Invalid Ethereum address' }),
});

const backingCollateralEntrySchema = z.object({
  token: z
    .string()
    .min(1, { message: 'Please select a backing collateral' })
    .refine((v) => isAddress(v), { message: 'Invalid token address' }),
  amount: z
    .string()
    .min(1, { message: 'Please enter amount' })
    .refine((v) => parseFloat(v) > 0, {
      message: 'Amount must be greater than 0',
    }),
});

const whitelistEntrySchema = z.object({
  type: z.enum(['member', 'space']),
  address: z
    .string()
    .min(1)
    .refine((v) => isAddress(v), { message: 'Invalid address' }),
  includeSpaceMembers: z.boolean().optional(),
});

export const schemaTokenBackingVault = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  label: z.literal('Backing Vault').optional(),
  tokenBackingVault: z
    .object({
      spaceToken: z
        .string()
        .min(1, { message: 'Please select a token' })
        .refine((v) => isAddress(v), { message: 'Invalid token address' }),
      activateVault: z.boolean().default(true),
      enableRedemption: z.boolean().default(false),
      addCollaterals: z.array(backingCollateralEntrySchema).optional(),
      removeCollaterals: z.array(backingCollateralEntrySchema).optional(),
      referenceCurrency: z.string().optional(),
      tokenPrice: z
        .string()
        .optional()
        .transform((v) => (v === '' || v === undefined ? undefined : v)),
      minimumBackingPercent: z.number().min(0).max(100).optional().default(0),
      maxRedemptionPercent: z.number().min(0).max(100).optional(),
      maxRedemptionPeriodDays: z.number().min(0).optional(),
      redemptionStartDate: z.date().optional().nullable(),
      enableAdvancedRedemptionControls: z.boolean().default(false),
      redemptionWhitelist: z.array(whitelistEntrySchema).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.enableRedemption) {
        const price = data.tokenPrice;
        if (
          !price ||
          price === '' ||
          isNaN(parseFloat(price)) ||
          parseFloat(price) <= 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Token price is required when redemption is active. Enter a price greater than 0.',
            path: ['tokenPrice'],
          });
        }
        if (!data.referenceCurrency || data.referenceCurrency.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Reference currency is required when redemption is active.',
            path: ['referenceCurrency'],
          });
        }
        if (
          data.maxRedemptionPercent === undefined ||
          data.maxRedemptionPercent === null
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Maximum Redemption % is required when redemption is active. Enter 0 for no limit.',
            path: ['maxRedemptionPercent'],
          });
        }
        if (
          data.maxRedemptionPeriodDays === undefined ||
          data.maxRedemptionPeriodDays === null ||
          data.maxRedemptionPeriodDays <= 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Period (days) is required when Redemption is active. Select a redemption period.',
            path: ['maxRedemptionPeriodDays'],
          });
        }
        if (
          !data.redemptionStartDate ||
          !(data.redemptionStartDate instanceof Date) ||
          isNaN(data.redemptionStartDate.getTime())
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Authorise Redemption from date is required when Redemption is active.',
            path: ['redemptionStartDate'],
          });
        }
      }
    }),
});

export const schemaChangeSpaceTransparencySettings = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  spaceDiscoverability: z.number().int().min(0).max(3),
  spaceActivityAccess: z.number().int().min(0).max(3),
});

/** Plain object schema so consumers can `.extend()` before `.superRefine(refineSpaceTokenPurchaseWhenActive)`. */
export const schemaSpaceTokenPurchaseObject = z.object({
  ...createAgreementWeb2Props,
  ...createAgreementFiles,
  tokenAddress: z
    .string({ message: 'Please select a token' })
    .min(1, 'Please select a token'),
  activatePurchase: z.boolean().default(false),
  purchasePrice: z.preprocess(
    (val) =>
      val === '' || val === null || val === undefined ? undefined : Number(val),
    z.number().positive('Purchase price must be greater than 0').optional(),
  ),
  /**
   * Full set of reference currencies for UI selection (REFERENCE_CURRENCIES).
   * On-chain hydration via useSpaceTokenSaleDetailsFromChain only yields USD/EUR.
   */
  purchaseCurrency: z.enum(REFERENCE_CURRENCIES).optional(),
  tokensAvailableForPurchase: z.preprocess(
    (val) =>
      val === '' || val === null || val === undefined ? undefined : Number(val),
    z.number().min(0, 'Available amount cannot be negative').optional(),
  ),
});

export const refineSpaceTokenPurchaseWhenActive = (
  data: {
    activatePurchase: boolean;
    purchasePrice?: number;
    purchaseCurrency?: string;
    tokensAvailableForPurchase?: number;
  },
  ctx: z.RefinementCtx,
) => {
  if (!data.activatePurchase) {
    return;
  }
  if (data.purchasePrice === undefined || data.purchasePrice <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Purchase price must be greater than 0 when token purchase is active.',
      path: ['purchasePrice'],
    });
  }
  if (!data.purchaseCurrency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Please select a payment currency when token purchase is active.',
      path: ['purchaseCurrency'],
    });
  }
  if (
    data.tokensAvailableForPurchase === undefined ||
    data.tokensAvailableForPurchase < 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Tokens available for purchase is required when token purchase is active (use 0 if none left).',
      path: ['tokensAvailableForPurchase'],
    });
  }
};

export const schemaSpaceTokenPurchase =
  schemaSpaceTokenPurchaseObject.superRefine(
    refineSpaceTokenPurchaseWhenActive,
  );
