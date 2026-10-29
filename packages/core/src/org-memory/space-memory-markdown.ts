import type { SpaceMemoryBranch } from './space-memory-branches';
import { SPACE_MEMORY_BRANCHES } from './space-memory-branches';

export type SpaceMemoryMarkdownCategory = SpaceMemoryBranch;

export type SpaceMemoryMarkdownDocInput = {
  title: string;
  category: SpaceMemoryMarkdownCategory;
  occurredAt?: string | Date | null;
  body: string;
  bullets?: readonly string[];
  /** Extra YAML fields (string values only). */
  meta?: Record<string, string | number | boolean | null | undefined>;
};

export type SpaceMemoryCategoryIndexItem = {
  title: string;
  occurredAt?: string | null;
  excerpt?: string | null;
  assetKey?: string | null;
  source?: string | null;
};

function yamlScalar(value: string | number | boolean): string {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return '""';
  if (/^[\w./:@+-]+$/u.test(trimmed)) return trimmed;
  return JSON.stringify(trimmed);
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Build a markdown document AI tools can fetch as `text/markdown`.
 * Frontmatter carries the Space Memory category so models can route context.
 */
export function formatSpaceMemoryMarkdownDoc(
  input: SpaceMemoryMarkdownDocInput,
): string {
  const title = input.title.trim() || 'Space Memory';
  const body = input.body.trim();
  const bullets = (input.bullets ?? []).map((b) => b.trim()).filter(Boolean);
  const occurred = toIso(input.occurredAt ?? null);

  const lines: string[] = ['---', `title: ${yamlScalar(title)}`];
  lines.push(`category: ${input.category}`);
  if (occurred) lines.push(`occurred_at: ${yamlScalar(occurred)}`);
  if (input.meta) {
    for (const [key, raw] of Object.entries(input.meta)) {
      if (raw == null) continue;
      const safeKey = key.trim();
      if (!safeKey || !/^[\w.-]+$/u.test(safeKey)) continue;
      if (typeof raw === 'string' && !raw.trim()) continue;
      lines.push(
        `${safeKey}: ${yamlScalar(
          typeof raw === 'string' ? raw : (raw as number | boolean),
        )}`,
      );
    }
  }
  lines.push('---', '', `# ${title}`, '');

  if (body) {
    lines.push(body, '');
  }
  if (bullets.length > 0) {
    lines.push('## Highlights', '');
    for (const bullet of bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function formatDiscussionSummaryMarkdown(input: {
  id: number;
  summary: string;
  bullets?: readonly string[];
  occurredAt?: string | Date | null;
  spaceSlug?: string | null;
}): string {
  return formatSpaceMemoryMarkdownDoc({
    title: `Discussion summary ${input.id}`,
    category: 'conversations',
    occurredAt: input.occurredAt,
    body: input.summary,
    bullets: input.bullets,
    meta: {
      source: 'discussion_summary',
      discussion_summary_id: input.id,
      space_slug: input.spaceSlug ?? undefined,
    },
  });
}

export function formatCallTranscriptMarkdown(input: {
  callSessionId: string;
  text: string;
  summary?: string | null;
  occurredAt?: string | Date | null;
  spaceSlug?: string | null;
}): string {
  const body = [input.summary?.trim(), input.text.trim()]
    .filter(Boolean)
    .join('\n\n');
  return formatSpaceMemoryMarkdownDoc({
    title: `Call transcript ${input.callSessionId}`,
    category: 'calls',
    occurredAt: input.occurredAt,
    body,
    meta: {
      source: 'call_transcript',
      call_session_id: input.callSessionId,
      space_slug: input.spaceSlug ?? undefined,
    },
  });
}

export function formatMemoryDocumentMarkdown(input: {
  title: string;
  description: string;
  documentId: number;
  occurredAt?: string | Date | null;
  spaceSlug?: string | null;
  documentSlug?: string | null;
}): string {
  return formatSpaceMemoryMarkdownDoc({
    title: input.title.trim() || `Memory ${input.documentId}`,
    category: 'conversations',
    occurredAt: input.occurredAt,
    body: input.description,
    meta: {
      source: 'memory',
      document_id: input.documentId,
      document_slug: input.documentSlug ?? undefined,
      space_slug: input.spaceSlug ?? undefined,
    },
  });
}

const CATEGORY_TITLES: Record<SpaceMemoryBranch, string> = {
  conversations: 'Conversations',
  calls: 'Calls',
  ai: 'AI Chat',
  files: 'Files',
};

const CATEGORY_INTROS: Record<SpaceMemoryBranch, string> = {
  conversations:
    'Written conversation summaries and Space Memory entries for this space.',
  calls: 'Call recordings and transcripts captured for this space.',
  ai: 'Memories and attachments from AI chat in this space.',
  files: 'Uploads and proposal attachments for this space.',
};

/**
 * One markdown file per Space Memory category — a pack AI can read for context.
 */
export function buildSpaceMemoryCategoryMarkdownPack(input: {
  spaceSlug: string;
  spaceTitle?: string | null;
  asOf?: string | null;
  itemsByCategory: Record<SpaceMemoryBranch, SpaceMemoryCategoryIndexItem[]>;
}): Record<SpaceMemoryBranch, string> {
  const asOf =
    toIso(input.asOf ?? new Date().toISOString()) ?? new Date().toISOString();
  const pack = {} as Record<SpaceMemoryBranch, string>;

  for (const category of SPACE_MEMORY_BRANCHES) {
    const items = input.itemsByCategory[category] ?? [];
    const lines: string[] = [
      '---',
      `title: ${yamlScalar(CATEGORY_TITLES[category])}`,
      `category: ${category}`,
      `space_slug: ${yamlScalar(input.spaceSlug)}`,
      ...(input.spaceTitle?.trim()
        ? [`space_title: ${yamlScalar(input.spaceTitle.trim())}`]
        : []),
      `occurred_at: ${yamlScalar(asOf)}`,
      'kind: category_index',
      `item_count: ${items.length}`,
      '---',
      '',
      `# ${CATEGORY_TITLES[category]}`,
      '',
      CATEGORY_INTROS[category],
      '',
    ];

    if (items.length === 0) {
      lines.push('_No items in this category yet._', '');
    } else {
      for (const item of items) {
        const when = item.occurredAt?.trim();
        const heading = item.title.trim() || 'Untitled';
        lines.push(`## ${heading}`);
        if (when) lines.push('', `- Occurred: ${when}`);
        if (item.source?.trim()) lines.push(`- Source: ${item.source.trim()}`);
        if (item.assetKey?.trim()) {
          lines.push(`- asset_key: \`${item.assetKey.trim()}\``);
        }
        if (item.excerpt?.trim()) {
          lines.push('', item.excerpt.trim());
        }
        lines.push('');
      }
    }

    pack[category] = lines.join('\n').trimEnd() + '\n';
  }

  return pack;
}
