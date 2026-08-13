import matter from 'gray-matter';
import {
  parseIntelligenceFrontmatter,
  type ParsedIntelligenceFrontmatter,
} from './validation';
import type { IntelligenceArtifact } from './types';
import { contentSha } from './content-sha';

export type ParsedIntelligenceMarkdown = {
  frontmatter: ParsedIntelligenceFrontmatter;
  body: string;
  raw: string;
  sha: string;
};

export function parseIntelligenceMarkdown(
  raw: string,
): ParsedIntelligenceMarkdown {
  const normalized = raw.replace(/^\uFEFF/, '');
  const parsed = matter(normalized);
  const frontmatter = parseIntelligenceFrontmatter(parsed.data);
  const body = parsed.content.replace(/^\n+/, '');
  // Re-serialize raw from validated frontmatter so SHA is stable across writers.
  const rawCanonical = serializeIntelligenceMarkdown({ frontmatter, body });
  return {
    frontmatter,
    body,
    raw: rawCanonical,
    sha: contentSha(rawCanonical),
  };
}

export function serializeIntelligenceMarkdown(input: {
  frontmatter: ParsedIntelligenceFrontmatter;
  body: string;
}): string {
  const body = input.body.replace(/^\n+/, '').replace(/\n+$/, '');
  return matter.stringify(body ? `${body}\n` : '', input.frontmatter);
}

export function toIntelligenceArtifact(input: {
  raw: string;
  path: string;
}): IntelligenceArtifact {
  const parsed = parseIntelligenceMarkdown(input.raw);
  return {
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    raw: parsed.raw,
    path: input.path,
    sha: parsed.sha,
  };
}
