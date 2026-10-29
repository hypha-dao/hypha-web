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
    case 'projects':
      return 'Projects';
    case 'key_repositories':
      return 'Key repositories';
    case 'tools':
      return 'Tools we use';
    case 'how_we_decide':
      return 'How we decide what we work on';
  }
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
