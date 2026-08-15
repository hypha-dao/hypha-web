import { z } from 'zod';
import {
  INTELLIGENCE_CORE_TYPES,
  INTELLIGENCE_STATUSES,
  type IntelligenceFrontmatter,
  type IntelligenceManifest,
  type IntelligenceManifestEntry,
} from './types';

const slugIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be a lowercase slug');

const isoDateSchema = z.preprocess((value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Accept full ISO timestamps by taking the date portion.
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    return trimmed;
  }
  return value;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'));

export const intelligenceFrontmatterSchema = z.object({
  id: slugIdSchema,
  type: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  space: slugIdSchema,
  source_app: z.string().trim().min(1).max(200),
  status: z.enum(INTELLIGENCE_STATUSES),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
  tags: z.array(z.string().trim().min(1).max(100)).default([]),
  related: z.array(slugIdSchema).default([]),
  version: z.coerce.number().int().positive(),
  supersedes: z
    .union([
      z
        .string()
        .trim()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$|^[a-f0-9]{7,64}$/),
      z.null(),
    ])
    .default(null),
  pack_id: slugIdSchema.optional(),
  pack_alias: z.string().trim().min(1).max(32).optional(),
  maturity: z.string().trim().min(1).max(50).optional(),
  confidence: z.string().trim().min(1).max(50).optional(),
  community_id: slugIdSchema.optional(),
  linked_signals: z.array(slugIdSchema).optional(),
});

export type ParsedIntelligenceFrontmatter = z.infer<
  typeof intelligenceFrontmatterSchema
>;

export function parseIntelligenceFrontmatter(
  raw: unknown,
): IntelligenceFrontmatter {
  return intelligenceFrontmatterSchema.parse(raw);
}

/** Field-level parse errors so writers can retry the right key instead of YAML as a blob. */
export function formatIntelligenceMarkdownError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const details = error.issues
      .map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : 'frontmatter';
        return `${path}: ${issue.message}`;
      })
      .join('; ');
    return `Invalid intelligence frontmatter. ${details}`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Markdown is not valid intelligence frontmatter + body.';
}

export function isCoreIntelligenceType(type: string): boolean {
  return (INTELLIGENCE_CORE_TYPES as readonly string[]).includes(type);
}

const manifestEntrySchema = z.object({
  id: slugIdSchema,
  type: z.string().trim().min(1),
  title: z.string().trim().min(1),
  space: slugIdSchema,
  status: z.enum(INTELLIGENCE_STATUSES),
  tags: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  source_app: z.string().trim().min(1),
  path: z.string().trim().min(1),
  sha: z.string().trim().min(7),
  version: z.coerce.number().int().positive(),
  updated_at: isoDateSchema,
  linked_signals: z.array(slugIdSchema).optional().default([]),
});

export const intelligenceManifestSchema = z.object({
  version: z.literal(1),
  space: slugIdSchema,
  updated_at: z.string().trim().min(1),
  enabled_packs: z.array(slugIdSchema).default([]),
  artifacts: z.array(manifestEntrySchema),
});

export function parseIntelligenceManifest(raw: unknown): IntelligenceManifest {
  return intelligenceManifestSchema.parse(raw);
}

export function emptyIntelligenceManifest(
  spaceSlug: string,
): IntelligenceManifest {
  return {
    version: 1,
    space: spaceSlug,
    updated_at: new Date().toISOString().slice(0, 10),
    enabled_packs: [],
    artifacts: [],
  };
}

export function manifestEntryFromFrontmatter(input: {
  frontmatter: IntelligenceFrontmatter;
  path: string;
  sha: string;
}): IntelligenceManifestEntry {
  const { frontmatter, path, sha } = input;
  return {
    id: frontmatter.id,
    type: frontmatter.type,
    title: frontmatter.title,
    space: frontmatter.space,
    status: frontmatter.status,
    tags: frontmatter.tags,
    related: frontmatter.related,
    source_app: frontmatter.source_app,
    path,
    sha,
    version: frontmatter.version,
    updated_at: frontmatter.updated_at,
    linked_signals: frontmatter.linked_signals ?? [],
  };
}
