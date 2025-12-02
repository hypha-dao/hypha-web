import { z } from 'zod';
import {
  ALLOWED_IMAGE_FILE_SIZE,
  DEFAULT_FILE_ACCEPT,
  DEFAULT_IMAGE_ACCEPT,
} from '../assets/constant';
import { isBefore } from 'date-fns';
import { EntryMethodType, REFERENCE_CURRENCIES } from './types';
import { isAddress } from 'ethers';

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

export const createAgreementFiles = {
  leadImage: z
    .custom<File>(isBrowserFile, { message: 'Please upload a valid file' })
    .refine(
      (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
      'Your file is too large and exceeds the 4MB limit. Please upload a smaller file.',
    )
    .refine(
      (file) => DEFAULT_IMAGE_ACCEPT.includes(file.type),
      'File must be an image (JPEG, PNG, GIF, WEBP).',
    )
    .optional(),
  attachments: z
    .array(
      z
        .custom<File>(isBrowserFile, { message: 'Please upload a valid file' })
        .refine(
          (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
          (file) => ({
            message: `Your file "${file.name}" is too large and exceeds the 4MB limit. Please upload a smaller file.`,
          }),
        )
        .refine(
          (file) => DEFAULT_FILE_ACCEPT.includes(file.type),
          (file) => ({
            message: `This file "${file.name}" format isn’t supported. Please upload a JPEG, PNG, WebP, or PDF (up to 4MB).`,
          }),
        ),
    )
    .max(3, {
      message:
        'You can attach up to 3 files. Please remove the extra attachments.',
    })
    .optional(),
};

export const schemaCreateAgreementFiles = z.object(createAgreementFiles);

export const schemaCreateAgreement = z.object({
  ...createAgreementWeb2Props,
});

export const schemaProposeContribution = z.object({
  recipient: z
    .string()
    .min(1, { message: 'Please add a recipient or wallet address' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' })
    .optional(),

  payouts: z
    .array(
      z.object({
        amount: z.string().refine((value) => parseFloat(value) > 0, {
          message: 'Amount must be greater than 0',
        }),
        token: z.string(),
      }),
    )
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

const transferWhitelistSchema = z.object({
  to: z.array(transferWhitelistEntrySchema).optional(),
  from: z.array(transferWhitelistEntrySchema).optional(),
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
          'Your file is too large and exceeds the 4MB limit. Please upload a smaller file',
        )
        .refine(
          (file) => DEFAULT_IMAGE_ACCEPT.includes(file.type),
          'File must be an image (JPEG, PNG, GIF, WEBP)',
        ),
    ])
    .transform((val) => (val === '' || val === null ? undefined : val)),

  type: z.enum(['utility', 'credits', 'ownership', 'voice', 'impact'], {
    required_error: 'Please select a token type',
  }),

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
  enableTokenPrice: z.boolean(),
  referenceCurrency: z.enum(REFERENCE_CURRENCIES).optional(),
  tokenPrice: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) {
        return undefined;
      }
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().positive().optional(),
  ),
});

export const schemaIssueNewToken = baseSchemaIssueNewToken.superRefine(
  (data, ctx) => {
    if (data.maxSupply > 0 && !data.maxSupplyType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a max supply type',
        path: ['maxSupplyType'],
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
    attachments: z.array(z.custom<File>()).max(3).optional(),
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
    .array(transactionSchema)
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
