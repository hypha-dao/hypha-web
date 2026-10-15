import { describe, expect, it } from 'vitest';

import { layout } from '../layout';

describe('layout', () => {
  it('escapes dynamic text and always carries the unsubscribe token', () => {
    const html = layout({
      title: 'Hi <b>',
      paragraphs: ['"Quoted" & <script>'],
    });
    expect(html).toContain('Hi &lt;b&gt;');
    expect(html).toContain('&quot;Quoted&quot; &amp; &lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('[unsubscribe_url]');
  });

  it('renders CTA, settings link and preheader only when given', () => {
    const bare = layout({ title: 'T', paragraphs: [] });
    expect(bare).not.toContain('Manage notification settings');
    expect(bare).not.toContain('display:none');

    const full = layout({
      preheader: 'Pre',
      title: 'T',
      paragraphs: ['p'],
      cta: { label: 'Go', url: 'https://x.test/a?b=1&c=2' },
      settingsUrl: 'https://x.test/settings',
    });
    expect(full).toContain('Manage notification settings');
    expect(full).toContain('href="https://x.test/a?b=1&amp;c=2"');
    expect(full).toContain('>Pre<');
  });
});
