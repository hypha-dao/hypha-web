import { z } from 'zod';
import {
  SPACE_CONTEXT_SECTION_KEYS,
  SPACE_CONTEXT_STATUSES,
} from './constants';

export const spaceContextSectionKeySchema = z.enum(SPACE_CONTEXT_SECTION_KEYS);

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
});

export const schemaProposeSpaceContext = z.object({
  sectionKeys: z
    .array(spaceContextSectionKeySchema)
    .min(1)
    .max(SPACE_CONTEXT_SECTION_KEYS.length),
  documentId: z.number().int().positive(),
});

export const schemaSaveSpaceContextMemory = z.object({
  memoryMarkdown: z.string().max(20_000),
});

export type PatchSpaceContextSectionInput = z.infer<
  typeof schemaPatchSpaceContextSection
>;
export type ProposeSpaceContextInput = z.infer<
  typeof schemaProposeSpaceContext
>;
