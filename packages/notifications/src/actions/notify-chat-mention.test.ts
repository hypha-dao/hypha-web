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
      actorDisplayName: 'Alice <script> "x"',
      messagePreview: "Hello <b>team</b> & 'all'",
      url: 'https://app.hypha.earth/en/dho/test?msg=1',
      contextLabel: 'Hypha Energy',
    });

    expect(html).toContain('Alice &lt;script&gt;');
    expect(html).toContain('&quot;x&quot;');
    expect(html).toContain('Hello &lt;b&gt;team&lt;/b&gt; &amp; &#39;all&#39;');
    expect(html).toContain('mentioned you in Hypha Energy');
    expect(html).not.toContain('<script>');
  });

  it('renders styled layout without preview block when preview is empty', () => {
    const html = buildMentionEmailBody({
      actorDisplayName: 'Alice',
      messagePreview: '',
      url: 'https://app.hypha.earth/en/dho/test?msg=1',
    });

    expect(html).toContain('Hypha &mdash; Growing Together');
    expect(html).toContain('View Mention');
    expect(html).not.toContain('background:#f4f4f5;border-radius:8px');
  });

  it('uses safe fallback link for non-http protocols', () => {
    const html = buildMentionEmailBody({
      actorDisplayName: 'Alice',
      messagePreview: 'hello',
      url: 'javascript:alert(1)',
    });

    expect(html).toContain('href="#"');
  });
});
