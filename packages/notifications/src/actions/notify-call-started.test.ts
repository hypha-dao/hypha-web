import { describe, expect, it } from 'vitest';

import { buildCallStartedEmailBody } from './notify-call-started.utils';

describe('buildCallStartedEmailBody', () => {
  it('escapes html-sensitive content', () => {
    const html = buildCallStartedEmailBody({
      actorDisplayName: 'Alice <script>',
      contextLabel: 'Signal <b>team</b>',
      url: 'https://app.hypha.earth/en/dho/test?joinCall=1',
    });

    expect(html).toContain('Alice &lt;script&gt;');
    expect(html).toContain('Signal &lt;b&gt;team&lt;/b&gt;');
    expect(html).not.toContain('<script>');
  });

  it('uses safe fallback link for non-http protocols', () => {
    const html = buildCallStartedEmailBody({
      actorDisplayName: 'Alice',
      contextLabel: 'General chat',
      url: 'javascript:alert(1)',
    });

    expect(html).toContain('<a href="#">Join call</a>');
  });
});
