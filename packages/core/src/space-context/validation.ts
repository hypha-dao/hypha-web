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
});

export const schemaAppendSpaceContextMessage = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().trim().min(1).max(20_000),
  agentKey: z.string().trim().min(1).max(64).optional(),
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
export type AppendSpaceContextMessageInput = z.infer<
  typeof schemaAppendSpaceContextMessage
>;
export type ProposeSpaceContextInput = z.infer<
  typeof schemaProposeSpaceContext
>;
