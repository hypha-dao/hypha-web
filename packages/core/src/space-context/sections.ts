import type { SpaceContextFilter } from './constants';
import type { SpaceContextSectionRecord } from './types';

type SectionState = Pick<
  SpaceContextSectionRecord,
  'status' | 'markdown' | 'hasDraftChanges' | 'pendingChange'
>;

/** Draft work waiting on members: unsaved-to-Agreements text or a suggested add/remove. */
export function hasPendingSectionWork(section: SectionState): boolean {
  if (section.status === 'proposed') return false;
  if (section.pendingChange) return true;
  if (section.status === 'ratified') return section.hasDraftChanges;
  return section.status === 'draft' || section.status === 'not_started';
}

export function sectionMatchesFilter(
  section: SectionState,
  filter: SpaceContextFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'ratified') return section.status === 'ratified';
  if (filter === 'proposed') return section.status === 'proposed';
  return hasPendingSectionWork(section);
}

/**
 * Shape agents read (chat tools, MCP). `markdown` is the official text once a
 * section is ratified; a pending draft or add/remove suggestion is separate.
 */
export function toSpaceContextSectionOutput(
  section: SpaceContextSectionRecord,
) {
  return {
    key: section.sectionKey,
    title: section.title,
    status: section.status,
    markdown: section.ratifiedMarkdown ?? section.markdown,
    draft_markdown: section.hasDraftChanges ? section.markdown : null,
    pending_change: section.pendingChange,
    version: section.version,
    updated_at: section.updatedAt,
  };
}

/** The section can go into a ratification proposal now. */
export function isProposableSection(section: SectionState): boolean {
  if (section.status === 'proposed') return false;
  if (section.pendingChange === 'remove') return true;
  if (!section.markdown.trim()) return false;
  if (section.pendingChange === 'add') return true;
  if (section.status === 'ratified') return section.hasDraftChanges;
  return true;
}
