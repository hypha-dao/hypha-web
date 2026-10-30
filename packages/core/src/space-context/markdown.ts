import {
  SPACE_CONTEXT_SECTION_KEYS,
  type SpaceContextSectionKey,
} from './constants';

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

export function firstMarkdownParagraph(source: string): string {
  const trimmed = source.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';
  const chunks = trimmed.split(/\n\s*\n/).map((part) => part.trim());
  for (const chunk of chunks) {
    if (HEADING_RE.test(chunk)) continue;
    const list = chunk.match(/^[-*]\s+(.+)/);
    if (list?.[1]) return list[1].trim();
    return chunk.replace(/\n/g, ' ').trim();
  }
  return trimmed.replace(/\n/g, ' ').trim();
}

export function stripMarkdownToPlain(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildProposalMarkdown(
  sections: Array<{
    key: SpaceContextSectionKey;
    title: string;
    markdown: string;
  }>,
): string {
  return sections
    .map((section) => {
      const body = section.markdown.trim();
      return `## ${section.title}\n\n${body || '_No draft yet._'}`;
    })
    .join('\n\n');
}

export function headingForSectionKey(key: SpaceContextSectionKey): string {
  switch (key) {
    case 'mission':
      return 'Mission';
    case 'vision':
      return 'Vision';
    case 'strategy':
      return 'Strategy';
    case 'objectives':
      return 'Objectives';
    case 'key_repositories':
      return 'Key repositories';
    case 'tools':
      return 'Tools we use';
    case 'how_we_decide':
      return 'How we decide what we work on';
  }
}

/** Drop a leading ATX heading that repeats the section card title. */
export function stripMatchingLeadingHeading(
  source: string,
  title: string,
): string {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) return source;
  const trimmed = source.replace(/\r\n/g, '\n').replace(/^\s+/, '');
  const match = trimmed.match(/^(#{1,6})\s+(.+?)(?:\n+|$)/);
  if (!match?.[2]) return source;
  const heading = match[2].trim().replace(/\s+#+$/, '');
  if (heading.toLowerCase() !== normalizedTitle) return source;
  return trimmed.slice(match[0].length).replace(/^\s+/, '');
}

const BLOCK_START =
  /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||```|~~~|(?:[-*_]\s*){3,}$)/;

/**
 * Split a section body into its opening prose paragraph and the remainder.
 * Lists, tables, quotes and code are never promoted to the lead.
 */
export function splitLeadParagraph(source: string): {
  lead: string;
  rest: string;
} {
  const trimmed = source.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return { lead: '', rest: '' };
  const lines = trimmed.split('\n');
  let end = 0;
  while (end < lines.length) {
    const line = (lines[end] ?? '').trim();
    if (!line || BLOCK_START.test(line)) break;
    end += 1;
  }
  if (end === 0) return { lead: '', rest: trimmed };
  return {
    lead: lines
      .slice(0, end)
      .map((line) => line.trim())
      .join(' '),
    rest: lines.slice(end).join('\n').trim(),
  };
}

/** Reverse of `buildProposalMarkdown` headings — used when resubmitting a Context proposal. */
export function sectionKeysFromProposalMarkdown(
  markdown: string,
): SpaceContextSectionKey[] {
  const titles = new Map(
    SPACE_CONTEXT_SECTION_KEYS.map((key) => [
      headingForSectionKey(key).toLowerCase(),
      key,
    ]),
  );
  const found: SpaceContextSectionKey[] = [];
  const seen = new Set<SpaceContextSectionKey>();
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^##\s+(.+)$/);
    if (!match?.[1]) continue;
    const key = titles.get(match[1].trim().toLowerCase());
    if (!key || seen.has(key)) continue;
    seen.add(key);
    found.push(key);
  }
  return found;
}
