import { discussionSummaryContentKey } from './space-memory-display';

type DiscussionSummaryLike = {
  source?: string | null;
  text_excerpt?: string | null;
  textExcerpt?: string | null;
  context?: { textExcerpt?: string | null } | null;
};

function excerptOf(row: DiscussionSummaryLike): string {
  return (
    row.text_excerpt?.trim() ||
    row.textExcerpt?.trim() ||
    row.context?.textExcerpt?.trim() ||
    ''
  );
}

/**
 * Discussion summaries are append-only snapshots. Refreshing with the same
 * chat produces identical cards on different days. Keep the newest of each
 * identical body (input must already be newest-first).
 */
export function collapseDuplicateDiscussionSummaries<
  T extends DiscussionSummaryLike,
>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (row.source !== 'discussion_summary') {
      out.push(row);
      continue;
    }
    const key = discussionSummaryContentKey(excerptOf(row));
    if (!key) {
      out.push(row);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
