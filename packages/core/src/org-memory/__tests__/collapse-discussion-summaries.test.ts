import { describe, expect, it } from 'vitest';

import { collapseDuplicateDiscussionSummaries } from '../collapse-discussion-summaries';

describe('collapseDuplicateDiscussionSummaries', () => {
  it('keeps the newest of identical discussion summary bodies', () => {
    const rows = collapseDuplicateDiscussionSummaries([
      {
        source: 'discussion_summary',
        text_excerpt: 'Hypha call capture notice https://example.com/a',
        discussion_summary_id: 2,
      },
      {
        source: 'discussion_summary',
        text_excerpt: 'Hypha call capture notice https://example.com/a',
        discussion_summary_id: 1,
      },
      {
        source: 'call_recording',
        text_excerpt: 'unrelated',
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ discussion_summary_id: 2 });
    expect(rows[1]).toMatchObject({ source: 'call_recording' });
  });

  it('keeps summaries with different bodies', () => {
    const rows = collapseDuplicateDiscussionSummaries([
      {
        source: 'discussion_summary',
        text_excerpt: 'First take on the roadmap.',
      },
      {
        source: 'discussion_summary',
        text_excerpt: 'Later update on the budget.',
      },
    ]);
    expect(rows).toHaveLength(2);
  });
});
