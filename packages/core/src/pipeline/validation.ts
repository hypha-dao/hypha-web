import { z } from 'zod';
import {
  DEAL_PRIORITIES,
  DEAL_STATUSES,
  PIPELINE_STATUSES,
  PIPELINE_SWIMLANES,
} from './constants';

const dealContactSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  role: z.string().trim().max(100).optional(),
  dept: z.string().trim().max(100).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  mobile: z.string().trim().max(40).optional(),
  linkedin: z.string().trim().max(500).optional(),
  isPrimary: z.boolean().optional(),
  contactType: z.string().trim().max(50).optional(),
});

const optionalDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

const countryCode = z
  .string()
  .trim()
  .length(2)
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((v) => (v ? v.toUpperCase() : null));

export const schemaCreateDeal = z.object({
  title: z.string().trim().min(1).max(200),
  pipelineSwimlane: z.enum(PIPELINE_SWIMLANES),
  pipelineStatus: z.enum(PIPELINE_STATUSES),
  status: z.enum(DEAL_STATUSES).optional().default('active'),
  priority: z.enum(DEAL_PRIORITIES).optional().default('medium'),
  value: z.coerce.number().min(0).optional().default(0),
  currency: z.string().trim().min(1).max(8).optional().default('€'),
  country: countryCode,
  region: z.string().trim().min(1).max(80).optional().default('Global'),
  contacts: z.array(dealContactSchema).optional().default([]),
  contactPerson: optionalText,
  contactEmail: optionalText,
  linkedinUrl: optionalText,
  contactUrl: optionalText,
  teamMemberIds: z.array(z.number().int().positive()).optional().default([]),
  accountManagerId: z.number().int().positive().optional().nullable(),
  successRate: z.coerce.number().int().min(0).max(100).optional().nullable(),
  nextAction: optionalText,
  nextActionDate: optionalDateString,
  notes: z
    .string()
    .trim()
    .max(10000)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  tags: z.array(z.string().trim().min(1).max(50)).optional().default([]),
  blocked: z.boolean().optional().default(false),
  blockerReason: optionalText,
  submissionDeadline: optionalDateString,
  fundingRateSme: z.coerce.number().min(0).max(100).optional().nullable(),
  maxProjectSize: z.coerce.number().min(0).optional().nullable(),
  expectedPartners: optionalText,
  isConsortiumLead: z.boolean().optional().nullable(),
  eligibleCountries: z
    .array(z.string().trim().length(2))
    .optional()
    .default([]),
  callReference: optionalText,
  programme: optionalText,
  eligibilityNotes: optionalText,
});

export const schemaUpdateDeal = schemaCreateDeal.partial().extend({
  ownerId: z.number().int().positive().optional(),
});

export const schemaDealFiltersQuery = z.object({
  q: z.string().trim().optional(),
  swimlane: z
    .union([z.enum(PIPELINE_SWIMLANES), z.array(z.enum(PIPELINE_SWIMLANES))])
    .optional(),
  region: z
    .union([
      z.string().trim().min(1).max(80),
      z.array(z.string().trim().min(1).max(80)),
    ])
    .optional(),
  country: z
    .union([
      z
        .string()
        .trim()
        .length(2)
        .transform((v) => v.toUpperCase()),
      z.array(
        z
          .string()
          .trim()
          .length(2)
          .transform((v) => v.toUpperCase()),
      ),
    ])
    .optional(),
  priority: z
    .union([z.enum(DEAL_PRIORITIES), z.array(z.enum(DEAL_PRIORITIES))])
    .optional(),
  status: z
    .union([z.enum(DEAL_STATUSES), z.array(z.enum(DEAL_STATUSES))])
    .optional(),
  pipelineStatus: z
    .union([z.enum(PIPELINE_STATUSES), z.array(z.enum(PIPELINE_STATUSES))])
    .optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  tag: z.string().trim().optional(),
  hasDeadline: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true';
    }),
});

export const schemaCreatePipelineSavedView = z.object({
  name: z.string().trim().min(1).max(100),
  filters: z.record(z.string(), z.unknown()).optional().default({}),
  sort: z.record(z.string(), z.unknown()).optional().default({}),
});

export const schemaUpdatePipelineSavedView =
  schemaCreatePipelineSavedView.partial();

export const schemaPipelineUserSettings = z.object({
  countryFocus: z.array(z.string().trim().length(2)).default([]),
});

const probabilityValue = z.coerce.number().int().min(0).max(100);

const probabilityLane = z
  .object(
    Object.fromEntries(
      PIPELINE_STATUSES.map((status) => [status, probabilityValue.optional()]),
    ) as Record<
      (typeof PIPELINE_STATUSES)[number],
      z.ZodOptional<typeof probabilityValue>
    >,
  )
  .partial();

export const schemaPipelineConfig = z
  .object({
    regions: z
      .array(z.string().trim().min(1).max(80))
      .min(1)
      .max(50)
      .optional(),
    defaultRegion: z.string().trim().min(1).max(80).optional(),
    probabilities: z
      .object(
        Object.fromEntries(
          PIPELINE_SWIMLANES.map((lane) => [lane, probabilityLane.optional()]),
        ) as Record<
          (typeof PIPELINE_SWIMLANES)[number],
          z.ZodOptional<typeof probabilityLane>
        >,
      )
      .partial()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.defaultRegion &&
      data.regions &&
      !data.regions.some(
        (region) => region.toLowerCase() === data.defaultRegion!.toLowerCase(),
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultRegion'],
        message: 'defaultRegion must be one of the configured regions',
      });
    }
  });
