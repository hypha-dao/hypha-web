import { z } from 'zod';

const spaceSlugSchema = z
  .string()
  .min(1)
  .describe(
    'Space slug (URL segment under /dho/{slug}). Required for local stdio MCP; may be omitted on hosted /api/mcp and inferred from the API key.',
  );

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
  space_slug: spaceSlugSchema.optional(),
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
  enabled_packs: z.array(z.string()).default([]),
});

export type MemoryListOutput = z.infer<typeof memoryListOutputSchema>;

export const memorySearchInputSchema = z.object({
  space_slug: spaceSlugSchema.optional(),
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
  space_slug: spaceSlugSchema.optional(),
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

const memoryMarkdownSchema = z
  .string()
  .min(1)
  .max(400_000)
  .describe(
    'Full Markdown including YAML frontmatter (---). Must be a .md intelligence artifact.',
  );

const memoryPathSchema = z
  .string()
  .min(1)
  .optional()
  .describe(
    'Optional object path. Must match intelligence/spaces/{slug}/{type-folder}/{id}.md',
  );

const memorySourceAppSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .optional()
  .describe(
    'Claimed source_app. Must match HYPHA_MCP_SOURCE_APP (or hypha-mcp when unset). Server stamps identity.',
  );

const memoryWriteOkSchema = z.object({
  ok: z.literal(true),
  space_slug: z.string(),
  created: z.boolean(),
  path: z.string(),
  sha: z.string(),
  source_app: z.string(),
  frontmatter: z.record(z.unknown()),
});

const memoryWriteFailSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  current_sha: z.string().optional(),
});

export const memoryCreateInputSchema = z.object({
  space_slug: spaceSlugSchema.optional(),
  markdown: memoryMarkdownSchema,
  path: memoryPathSchema,
  mode: z
    .enum(['draft', 'publish'])
    .optional()
    .default('draft')
    .describe(
      'draft writes status=draft; publish writes a member-published current version. IBAs should use draft.',
    ),
  source_app: memorySourceAppSchema,
});

export type MemoryCreateInput = z.infer<typeof memoryCreateInputSchema>;

export const memoryCreateOutputSchema = z.union([
  memoryWriteOkSchema,
  memoryWriteFailSchema,
]);

export type MemoryCreateOutput = z.infer<typeof memoryCreateOutputSchema>;

export const memoryUpdateInputSchema = z.object({
  space_slug: spaceSlugSchema.optional(),
  markdown: memoryMarkdownSchema,
  expected_sha: z
    .string()
    .trim()
    .min(7)
    .max(64)
    .describe('SHA-256 of the current artifact (optimistic concurrency).'),
  mode: z
    .enum(['propose', 'publish'])
    .optional()
    .default('propose')
    .describe(
      'propose stores a pending patch on a signal (IBA/AI default). publish versions immediately (space member).',
    ),
  signal_slug: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Required when mode=propose. Members approve on Signal detail.'),
  path: memoryPathSchema,
  source_app: memorySourceAppSchema,
  title: z.string().trim().min(1).max(500).optional(),
});

export type MemoryUpdateInput = z.infer<typeof memoryUpdateInputSchema>;

export const memoryUpdateOutputSchema = z.union([
  memoryWriteOkSchema.extend({ mode: z.literal('publish') }),
  z.object({
    ok: z.literal(true),
    mode: z.literal('propose'),
    space_slug: z.string(),
    signal_slug: z.string(),
    target_id: z.string(),
    patch_status: z.string(),
    source_app: z.string(),
  }),
  memoryWriteFailSchema,
]);

export type MemoryUpdateOutput = z.infer<typeof memoryUpdateOutputSchema>;

export const memoryDeleteInputSchema = z.object({
  space_slug: spaceSlugSchema.optional(),
  artifact_id: z
    .string()
    .min(1)
    .describe('Intelligence artifact slug-id (manifest `id`).'),
  expected_sha: z
    .string()
    .trim()
    .min(7)
    .max(64)
    .describe('SHA-256 of the current artifact (optimistic concurrency).'),
  hard: z
    .boolean()
    .optional()
    .default(false)
    .describe('Hard delete is rejected in MVP; leave false for soft archive.'),
});

export type MemoryDeleteInput = z.infer<typeof memoryDeleteInputSchema>;

export const memoryDeleteOutputSchema = z.union([
  z.object({
    ok: z.literal(true),
    space_slug: z.string(),
    artifact_id: z.string(),
    archived: z.literal(true),
    sha: z.string(),
  }),
  memoryWriteFailSchema,
]);

export type MemoryDeleteOutput = z.infer<typeof memoryDeleteOutputSchema>;

export const memoryEnablePackInputSchema = z.object({
  space_slug: spaceSlugSchema,
  pack_id: z
    .string()
    .trim()
    .min(1)
    .describe('Pack id to enable (currently hypha-energy).'),
});

export type MemoryEnablePackInput = z.infer<typeof memoryEnablePackInputSchema>;

export const memoryEnablePackOutputSchema = z.union([
  z.object({
    ok: z.literal(true),
    space_slug: z.string(),
    pack_id: z.string(),
    enabled_packs: z.array(z.string()),
    seeded: z.array(z.string()),
    skipped: z.array(z.string()),
  }),
  memoryWriteFailSchema,
]);

export type MemoryEnablePackOutput = z.infer<
  typeof memoryEnablePackOutputSchema
>;
