import { z } from 'zod';
import {
  isSpaceContextSectionKey,
  SPACE_CONTEXT_SECTION_TITLE_MAX,
  SPACE_CONTEXT_STATUSES,
  type SpaceContextSectionKey,
} from './constants';

export const spaceContextSectionKeySchema = z
  .string()
  .refine(
    (value): value is SpaceContextSectionKey => isSpaceContextSectionKey(value),
    'Unknown section',
  )
  .transform((value) => value as SpaceContextSectionKey);

export const spaceContextStatusSchema = z.enum(SPACE_CONTEXT_STATUSES);

export const schemaPatchSpaceContextSection = z.object({
  markdown: z.string().max(80_000).optional(),
  status: spaceContextStatusSchema.optional(),
  /** Matrix room id (`!…`) of the section discussion. Stored once. */
  chatRoomId: z
    .string()
    .trim()
    .min(2)
    .max(255)
    .refine((value) => value.startsWith('!'), 'Expected a Matrix room id')
    .optional(),
  /** Suggest removing the section (`remove`) or withdraw that suggestion (`null`). */
  pendingChange: z.enum(['remove']).nullable().optional(),
});

/** Suggest a new section, or restoring one a passed proposal removed. */
export const schemaSuggestSpaceContextSection = z.union([
  z.object({
    title: z.string().trim().min(1).max(SPACE_CONTEXT_SECTION_TITLE_MAX),
    markdown: z.string().max(80_000).optional(),
  }),
  z.object({
    restoreSectionKey: spaceContextSectionKeySchema,
  }),
]);

export const schemaProposeSpaceContext = z.object({
  sectionKeys: z.array(spaceContextSectionKeySchema).min(1).max(50),
  documentId: z.number().int().positive(),
});

export const schemaSaveSpaceContextMemory = z.object({
  memoryMarkdown: z.string().max(20_000),
});

export type PatchSpaceContextSectionInput = z.infer<
  typeof schemaPatchSpaceContextSection
>;
export type SuggestSpaceContextSectionInput = z.infer<
  typeof schemaSuggestSpaceContextSection
>;
export type ProposeSpaceContextInput = z.infer<
  typeof schemaProposeSpaceContext
>;
