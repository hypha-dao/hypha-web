import { INTELLIGENCE_CORE_TYPES } from '@hypha-platform/core/intelligence';

const SLUG_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ARTIFACT_ID_MAX = 80;

export function slugifyIntelligenceId(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ARTIFACT_ID_MAX)
    .replace(/-+$/g, '');
  return slug || 'insight';
}

export function isIntelligenceSlugId(value: string): boolean {
  return SLUG_ID.test(value) && value.length >= 1 && value.length <= 200;
}

export function normalizeLinkedSignalSlugs(
  value: string | string[] | undefined,
): string[] | undefined {
  if (value == null) return undefined;
  const items = (Array.isArray(value) ? value : value.split(/[\s,]+/))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(items)].filter(isIntelligenceSlugId);
  return unique.length > 0 ? unique : undefined;
}

/**
 * Chat models confuse Coherence board type `signal` with Intelligence folders.
 * Coerce that to `insight`; keep other core types; slugify unknown pack types.
 */
export function normalizeIntelligenceArtifactType(
  type: string | undefined,
): string {
  const raw = (type ?? 'insight').trim().toLowerCase();
  if (!raw || raw === 'signal') return 'insight';
  if ((INTELLIGENCE_CORE_TYPES as readonly string[]).includes(raw)) {
    return raw;
  }
  return slugifyIntelligenceId(raw);
}

/** If the model stuffed YAML fences into `body`, keep only the Markdown body. */
export function stripAccidentalYamlFence(body: string): string {
  const text = body.replace(/^\uFEFF/, '').trim();
  if (!text.startsWith('---')) return text;

  let openEnd = 3;
  if (text[openEnd] === '\r') openEnd += 1;
  if (text[openEnd] !== '\n') {
    const firstNl = text.indexOf('\n');
    if (firstNl === -1) return '';
    return stripAccidentalYamlFence(text.slice(firstNl + 1));
  }

  const yamlStart = openEnd + 1;
  let i = yamlStart;
  while (i < text.length) {
    if (text[i] === '-' && text[i + 1] === '-' && text[i + 2] === '-') {
      let j = i + 3;
      if (text[j] === '\r') j += 1;
      if (j >= text.length || text[j] === '\n') {
        const bodyStart = j < text.length ? j + 1 : j;
        return text.slice(bodyStart).trim();
      }
    }
    const nextNl = text.indexOf('\n', i);
    if (nextNl === -1) break;
    i = nextNl + 1;
  }

  const firstNl = text.indexOf('\n');
  return firstNl === -1 ? '' : text.slice(firstNl + 1).trim();
}

export function buildMemoryCreateFields(input: {
  title: string;
  type?: string;
  artifactId?: string;
  body: string;
  linkedSignals?: string | string[];
  tags?: string[];
}): {
  id: string;
  type: string;
  title: string;
  body: string;
  linked_signals?: string[];
  tags?: string[];
} {
  const title = input.title.trim();
  const artifactId = input.artifactId?.trim();
  return {
    id: slugifyIntelligenceId(artifactId || title),
    type: normalizeIntelligenceArtifactType(input.type),
    title,
    body: stripAccidentalYamlFence(input.body),
    linked_signals: normalizeLinkedSignalSlugs(input.linkedSignals),
    tags: input.tags
      ?.map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 20),
  };
}
