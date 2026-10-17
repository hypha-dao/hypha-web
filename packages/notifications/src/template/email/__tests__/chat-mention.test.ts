import { describe, expect, it } from 'vitest';

import { emailChatMention } from '../chat-mention';

const url = 'https://app.hypha.earth/en/dho/test?msg=1';

describe('emailChatMention', () => {
  it('escapes html-sensitive content', () => {
    const { body } = emailChatMention({
      actorName: 'Alice <script> "x"',
      messagePreview: "Hello <b>team</b> & 'all'",
      url,
      contextLabel: 'Hypha Energy',
    });
    expect(body).toContain('Alice &lt;script&gt;');
    expect(body).toContain('&quot;x&quot;');
    expect(body).toContain('Hello &lt;b&gt;team&lt;/b&gt; &amp; &#39;all&#39;');
    expect(body).toContain('<strong>Hypha Energy</strong>');
    expect(body).not.toContain('<script>');
  });

  it('uses the actor in the subject and the preview as preheader', () => {
    const email = emailChatMention({
      actorName: 'Alice',
      messagePreview: 'hi there',
      url,
    });
    expect(email.subject).toBe('Alice mentioned you');
    expect(email.preheader).toBe('hi there');
  });

  it('falls back to "Someone", "chat" and a generic preheader without a preview', () => {
    const email = emailChatMention({ messagePreview: '', url });
    expect(email.subject).toBe('Someone mentioned you');
    expect(email.preheader).toBe('Someone mentioned you in chat.');
    expect(email.body).not.toContain('class="preview"');
    expect(email.body).toContain('View Mention');
  });

  it('renders settings link and unsubscribe; omits settings link when unset', () => {
    const withSettings = emailChatMention({
      url,
      settingsUrl: 'https://app.hypha.earth/en/network/notification-centre',
    });
    expect(withSettings.body).toContain(
      'href="https://app.hypha.earth/en/network/notification-centre"',
    );
    expect(withSettings.body).toContain('[unsubscribe_url]');
    expect(emailChatMention({ url }).body).not.toContain(
      'Manage notification settings',
    );
  });

  it('neutralises non-http(s) urls', () => {
    const { body } = emailChatMention({ url: 'javascript:alert(1)' });
    expect(body).toContain('class="cta" href="#"');
  });
});
