import { z } from 'zod';
import { getPeopleBySpaceSlugInputSchema } from './get-people-by-space-slug-schema.js';

export const getSpaceContextInputSchema = getPeopleBySpaceSlugInputSchema.pick({
  space_slug: true,
});

export type GetSpaceContextInput = z.infer<typeof getSpaceContextInputSchema>;

const sectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  status: z.enum(['not_started', 'draft', 'proposed', 'ratified']),
  markdown: z.string(),
  draft_markdown: z.string().nullable(),
  pending_change: z.enum(['add', 'remove']).nullable(),
  version: z.number(),
  updated_at: z.string(),
});

export const getSpaceContextOutputSchema = z.object({
  found: z.boolean(),
  space_slug: z.string(),
  space_title: z.string().optional(),
  ratified_count: z.number().optional(),
  total_count: z.number().optional(),
  sections: z.array(sectionSchema).optional(),
  error: z.string().optional(),
});

export type GetSpaceContextOutput = z.infer<typeof getSpaceContextOutputSchema>;
