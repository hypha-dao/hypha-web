import { describe, expect, it } from 'vitest';

import { sanitizeMentionIds } from './notify-chat-mention.utils';

describe('sanitizeMentionIds', () => {
  it('deduplicates and trims matrix ids', () => {
    expect(
      sanitizeMentionIds([
        ' @alice:matrix.org ',
        '@alice:matrix.org',
        '',
        '   ',
        '@bob:matrix.org',
      ]),
    ).toEqual(['@alice:matrix.org', '@bob:matrix.org']);
  });
});
