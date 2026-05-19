import { describe, expect, it } from 'vitest';

import {
  buildMentionEmailBody,
  sanitizeMentionIds,
} from './notify-chat-mention.utils';

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

describe('buildMentionEmailBody', () => {
  it('escapes html-sensitive content', () => {
    const html = buildMentionEmailBody({
      actorDisplayName: 'Alice <script>',
      messagePreview: 'Hello <b>team</b>',
      url: 'https://app.hypha.earth/en/dho/test?msg=1',
    });

    expect(html).toContain('Alice &lt;script&gt;');
    expect(html).toContain('Hello &lt;b&gt;team&lt;/b&gt;');
    expect(html).not.toContain('<script>');
  });

  it('renders fallback copy when preview is empty', () => {
    const html = buildMentionEmailBody({
      actorDisplayName: 'Alice',
      messagePreview: '',
      url: 'https://app.hypha.earth/en/dho/test?msg=1',
    });

    expect(html).toContain('Open chat to view the message.');
  });
});
