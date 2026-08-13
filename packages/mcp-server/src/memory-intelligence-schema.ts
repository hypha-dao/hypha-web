import { z } from 'zod';

const spaceSlugSchema = z
  .string()
  .min(1)
  .describe('Space slug (URL segment under /dho/{slug}).');

const intelligenceManifestEntrySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  space: z.string(),
  status: z.string(),
  tags: z.array(z.string()),
  related: z.array(z.string()),
  source_app: z.string(),
  path: z.string(),
  sha: z.string(),
  version: z.number(),
  updated_at: z.string(),
});

export const memoryListInputSchema = z.object({
  space_slug: spaceSlugSchema,
  type: z
    .string()
    .optional()
    .describe(
      'Optional core type filter (context, signal, assessment, insight, …).',
    ),
  status: z
    .string()
    .optional()
    .describe('Optional status filter (draft, current, contested, …).'),
  search: z
    .string()
    .optional()
    .describe(
      'Optional case-insensitive filter on title, id, or tags (same as memory.search).',
    ),
});

export type MemoryListInput = z.infer<typeof memoryListInputSchema>;

export const memoryListOutputSchema = z.object({
  space_slug: z.string(),
  configured: z.boolean(),
  artifacts: z.array(intelligenceManifestEntrySchema),
});

export type MemoryListOutput = z.infer<typeof memoryListOutputSchema>;

export const memorySearchInputSchema = z.object({
  space_slug: spaceSlugSchema,
  query: z
    .string()
    .min(1)
    .describe('Case-insensitive search across title, id, and tags.'),
  type: z.string().optional(),
  status: z.string().optional(),
});

export type MemorySearchInput = z.infer<typeof memorySearchInputSchema>;

export const memorySearchOutputSchema = memoryListOutputSchema;

export const memoryReadInputSchema = z.object({
  space_slug: spaceSlugSchema,
  artifact_id: z
    .string()
    .min(1)
    .describe('Intelligence artifact slug-id (manifest `id`).'),
});

export type MemoryReadInput = z.infer<typeof memoryReadInputSchema>;

export const memoryReadOutputSchema = z.object({
  space_slug: z.string(),
  configured: z.boolean(),
  found: z.boolean(),
  frontmatter: z.record(z.unknown()).nullable(),
  body: z.string().nullable(),
  path: z.string().nullable(),
});

export type MemoryReadOutput = z.infer<typeof memoryReadOutputSchema>;
