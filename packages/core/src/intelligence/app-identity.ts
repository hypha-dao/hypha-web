/** Max UTF-8 byte length for a single intelligence markdown object (MCP + HTTP). */
export const INTELLIGENCE_MARKDOWN_MAX_BYTES = 256 * 1024;

const SOURCE_APP_MAX = 200;

function isSafeSourceAppSlug(value: string): boolean {
  if (value.length === 0 || value.length > SOURCE_APP_MAX) return false;
  let i = 0;
  while (i < value.length) {
    const start = i;
    while (
      i < value.length &&
      ((value[i]! >= 'a' && value[i]! <= 'z') ||
        (value[i]! >= '0' && value[i]! <= '9'))
    ) {
      i += 1;
    }
    if (i === start) return false;
    if (i === value.length) break;
    if (value[i] !== '-') return false;
    i += 1;
    if (i === value.length) return false;
  }
  return true;
}

export function assertSafeSourceApp(value: string): string {
  const slug = value.trim();
  if (!isSafeSourceAppSlug(slug)) {
    throw new Error(`Invalid source_app: "${value}"`);
  }
  return slug;
}

export type ResolveCanonicalSourceAppInput = {
  /** Caller-supplied source_app (frontmatter or tool arg). */
  claimed?: string;
  /** Authenticated installation / launch-ticket identity. */
  configured?: string;
  /** Used when no installation identity is configured (e.g. member MCP). */
  fallback: string;
};

export type ResolveCanonicalSourceAppResult =
  | { ok: true; source_app: string }
  | { ok: false; message: string };

/**
 * Server assigns source_app from auth context. Caller-supplied values that do
 * not match the authenticated app identity are rejected.
 */
export function resolveCanonicalSourceApp(
  input: ResolveCanonicalSourceAppInput,
): ResolveCanonicalSourceAppResult {
  let canonical: string;
  try {
    canonical = assertSafeSourceApp(input.configured?.trim() || input.fallback);
  } catch {
    return {
      ok: false,
      message:
        'Configured app identity (source_app) is invalid; use a lowercase slug.',
    };
  }

  const claimed = input.claimed?.trim();
  if (claimed && claimed !== canonical) {
    return {
      ok: false,
      message: `source_app "${claimed}" does not match authenticated app identity "${canonical}".`,
    };
  }

  return { ok: true, source_app: canonical };
}

export function intelligenceMarkdownByteLength(markdown: string): number {
  return new TextEncoder().encode(markdown).length;
}

export function assertIntelligenceMarkdownSize(markdown: string): void {
  const bytes = intelligenceMarkdownByteLength(markdown);
  if (bytes > INTELLIGENCE_MARKDOWN_MAX_BYTES) {
    throw new Error(
      `Markdown exceeds ${INTELLIGENCE_MARKDOWN_MAX_BYTES} bytes (${bytes}).`,
    );
  }
}
