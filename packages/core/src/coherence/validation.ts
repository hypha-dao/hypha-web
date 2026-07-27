import { z } from 'zod';
import { COHERENCE_SIGNAL_TYPES } from './coherence-types';
import { COHERENCE_PRIORITIES } from './coherence-priorities';

const coherenceTagsSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(50)
  .transform((tags) => {
    const seen = new Set<string>();
    const uniqueTags: string[] = [];
    for (const tag of tags) {
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      uniqueTags.push(tag);
    }
    return uniqueTags;
  })
  .default([]);

const assigneeIdsSchema = z
  .array(z.number().int().min(1))
  .max(20)
  .transform((ids) => {
    const seen = new Set<number>();
    const unique: number[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }
    return unique;
  })
  .default([]);

const optionalDueAtSchema = z
  .union([z.string().datetime(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

const signalTaskFields = {
  dueAt: optionalDueAtSchema,
  progressStatus: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/)
    .nullable()
    .optional(),
  board: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/)
    .nullable()
    .optional(),
  assigneeIds: assigneeIdsSchema.optional(),
};

const coherenceSignalFields = {
  type: z.enum(COHERENCE_SIGNAL_TYPES),
  priority: z.enum(COHERENCE_PRIORITIES),
  title: z
    .string()
    .trim()
    .min(1, { message: 'Please add a title for your coherence' })
    .max(50),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Please add content to your coherence' })
    .max(4000),
  tags: coherenceTagsSchema,
  ...signalTaskFields,
};

const coherenceSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(
    /^[a-z0-9-]+$/,
    'Slug must contain only lowercase letters, numbers, and hyphens',
  );

export const createCoherenceWeb2Props = {
  ...coherenceSignalFields,
  slug: coherenceSlugSchema.optional(),
  roomId: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Room ID must contain only lowercase letters, numbers, and hyphens',
    )
    .optional(),
  creatorId: z.number().min(1),
  spaceId: z.number().min(1),
  archived: z.boolean(),
};
export const schemaCreateCoherenceWeb2 = z.object(createCoherenceWeb2Props);

export const schemaCreateCoherence = schemaCreateCoherenceWeb2;
export const schemaCreateCoherenceForm = schemaCreateCoherenceWeb2;

export const schemaUpdateCoherenceSignalBySlug = z.object({
  slug: coherenceSlugSchema,
  ...coherenceSignalFields,
});

export const schemaPatchCoherenceTaskBySlug = z.object({
  slug: coherenceSlugSchema,
  ...signalTaskFields,
  priority: z.enum(COHERENCE_PRIORITIES).optional(),
});

const evmAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'walletAddress must be an EVM address');

/**
 * An integration identifies an author by wallet or email; it never creates
 * people. When the author is omitted, or matches nobody in Hypha, the signal is
 * attributed to the space itself.
 */
const ingestedSignalAuthorSchema = z
  .object({
    walletAddress: evmAddressSchema.optional(),
    email: z.string().trim().email().max(320).optional(),
  })
  .strict()
  .refine((author) => Boolean(author.walletAddress || author.email), {
    message: 'author requires either walletAddress or email',
  });

const workflowSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/)
  .nullable()
  .optional();

/**
 * Tri-state so a patch can leave a due date untouched (absent) or clear it
 * (explicit null). The shared `optionalDueAtSchema` collapses both to null.
 */
const patchDueAtSchema = z
  .union([z.string().datetime(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

/**
 * Signal creation by a community app. Types are limited to the four the Hypha
 * edit form can round-trip, so an ingested signal stays fully editable in the
 * UI. Assignees are Hypha person ids and remain a Hypha-side concern.
 */
export const schemaIngestSignal = z
  .object({
    type: z.enum(COHERENCE_SIGNAL_TYPES),
    priority: z.enum(COHERENCE_PRIORITIES).default('medium'),
    title: z.string().trim().min(1).max(50),
    description: z.string().trim().min(1).max(4000),
    tags: coherenceTagsSchema,
    progressStatus: workflowSlugSchema,
    board: workflowSlugSchema,
    dueAt: optionalDueAtSchema,
    /** The integration's own record id, used to make retries idempotent. */
    externalId: z.string().trim().min(1).max(200).optional(),
    /** Omit to publish as the space rather than on behalf of a person. */
    author: ingestedSignalAuthorSchema.optional(),
  })
  .strict();

export const schemaPatchIngestedSignal = z
  .object({
    type: z.enum(COHERENCE_SIGNAL_TYPES).optional(),
    priority: z.enum(COHERENCE_PRIORITIES).optional(),
    title: z.string().trim().min(1).max(50).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    tags: coherenceTagsSchema.optional(),
    archived: z.boolean().optional(),
    progressStatus: workflowSlugSchema,
    board: workflowSlugSchema,
    dueAt: patchDueAtSchema,
  })
  .strict()
  .refine(
    (patch) => Object.values(patch).some((value) => value !== undefined),
    {
      message: 'Provide at least one field to update',
    },
  );

export const schemaIngestedSignalUpvote = z
  .object({
    voter: z.object({ walletAddress: evmAddressSchema }).strict(),
    votingPowerPercent: z.number().int().min(1).max(100).optional(),
  })
  .strict();

const signalStatusCategorySchema = z.enum([
  'backlog',
  'active',
  'done',
  'cancelled',
]);

export const signalStatusDefinitionSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().min(1).max(32),
  category: signalStatusCategorySchema,
  position: z.number().int().min(0).max(100),
  isTerminal: z.boolean().optional(),
});

export const signalBoardDefinitionSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().min(1).max(32),
  position: z.number().int().min(0).max(100),
  archived: z.boolean().optional(),
});

export const schemaSignalWorkflowConfig = z
  .object({
    statuses: z.array(signalStatusDefinitionSchema).min(1).max(20),
    boards: z.array(signalBoardDefinitionSchema).min(1).max(50),
  })
  .superRefine((data, ctx) => {
    const statusSlugs = new Set<string>();
    for (const status of data.statuses) {
      if (statusSlugs.has(status.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate status slug: ${status.slug}`,
          path: ['statuses'],
        });
        break;
      }
      statusSlugs.add(status.slug);
    }
    const boardSlugs = new Set<string>();
    for (const board of data.boards) {
      if (boardSlugs.has(board.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate board slug: ${board.slug}`,
          path: ['boards'],
        });
        break;
      }
      boardSlugs.add(board.slug);
    }
  });
