import { describe, expect, it } from 'vitest';

import { layout, paragraphHtml, preview, strong } from '../layout';

describe('layout', () => {
  it('escapes dynamic text', () => {
    const html = layout({
      title: 'Hi <b>',
      paragraphs: ['"Quoted" & <script>'],
      contentHtml: paragraphHtml(strong('<x>')) + preview('<i>'),
    });
    expect(html).toContain('<title>Hi &lt;b&gt;</title>');
    expect(html).toContain('&quot;Quoted&quot; &amp; &lt;script&gt;');
    expect(html).toContain('<strong>&lt;x&gt;</strong>');
    expect(html).toContain('class="preview">&lt;i&gt;');
    expect(html).not.toContain('<script>');
  });

  it('renders the shared header, greeting, signoff and support footer', () => {
    const html = layout({ title: 'T' });
    expect(html).toContain(
      'https://app.hypha.earth/brand/hypha-logo-white.png',
    );
    expect(html).toContain('Hey there,');
    expect(html).toContain('With gratitude, Hypha');
    expect(html).toContain('mailto:support@hypha.earth');
  });

  it('carries settings + unsubscribe only for subscription emails', () => {
    const subscription = layout({
      title: 'T',
      footer: { unsubscribe: true, settingsUrl: 'https://x.test/s' },
    });
    expect(subscription).toContain('[unsubscribe_url]');
    expect(subscription).toContain('Manage notification settings');

    const transactional = layout({ title: 'T' });
    expect(transactional).not.toContain('[unsubscribe_url]');
    expect(transactional).not.toContain('Manage notification settings');
  });

  it('renders the CTA escaping URLs, without an in-body preheader', () => {
    const html = layout({
      title: 'T',
      preheader: 'Pre',
      cta: { label: 'Go', url: 'https://x.test/a?b=1&c=2' },
    });
    expect(html).toContain('class="cta" href="https://x.test/a?b=1&amp;c=2"');
    // the preheader travels as `email_preheader`; OneSignal injects the hidden span
    expect(html).not.toContain('>Pre<');
  });
});
