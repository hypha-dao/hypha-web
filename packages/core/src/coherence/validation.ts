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
});

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
