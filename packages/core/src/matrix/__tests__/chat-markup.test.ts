import { describe, expect, it } from 'vitest';

import {
  buildRichReplyMatrixContent,
  chatMarkupLooksFormatted,
  chatMarkupToHtml,
  matrixTextEventContentWithOptionalFormatting,
  parseChatMarkup,
} from '../chat-markup';
import { splitRichReplyPlainBody } from '../rich-reply';

describe('chatMarkupLooksFormatted', () => {
  it('is false for plain text', () => {
    expect(chatMarkupLooksFormatted('hello')).toBe(false);
  });
  it('detects bold', () => {
    expect(chatMarkupLooksFormatted('a **b** c')).toBe(true);
  });
  it('detects lists and headings', () => {
    expect(chatMarkupLooksFormatted('- one\n- two')).toBe(true);
    expect(chatMarkupLooksFormatted('# Title')).toBe(true);
  });
  it('detects underline', () => {
    expect(chatMarkupLooksFormatted('__hi__')).toBe(true);
  });
});

describe('matrixTextEventContentWithOptionalFormatting', () => {
  it('returns body only when no markup', () => {
    expect(matrixTextEventContentWithOptionalFormatting('plain')).toEqual({
      body: 'plain',
    });
  });
  it('adds formatted_body for bold', () => {
    const r = matrixTextEventContentWithOptionalFormatting('**hi**');
    expect('formatted_body' in r && r.formatted_body).toContain('<strong>');
    expect('formatted_body' in r && r.formatted_body).toContain('hi');
  });
  it('adds lists and headings to formatted_body', () => {
    const r = matrixTextEventContentWithOptionalFormatting(
      '# Hello\n- one\n- two\n1. a',
    );
    expect('formatted_body' in r && r.formatted_body).toContain('<h1>');
    expect('formatted_body' in r && r.formatted_body).toContain('<ul>');
    expect('formatted_body' in r && r.formatted_body).toContain('<ol>');
    expect('formatted_body' in r && r.formatted_body).toContain('<li>');
  });
  it('adds underline to formatted_body', () => {
    const r = matrixTextEventContentWithOptionalFormatting('__hi__');
    expect('formatted_body' in r && r.formatted_body).toContain('<u>');
  });
});

describe('parseChatMarkup', () => {
  it('parses nested bold and italic', () => {
    const nodes = parseChatMarkup('**a *b* c**');
    expect(JSON.stringify(nodes)).toContain('bold');
  });
  it('parses unordered lists', () => {
    const nodes = parseChatMarkup('- one\n- two');
    expect(nodes).toEqual([
      {
        type: 'ul',
        items: [
          [{ type: 'text', value: 'one' }],
          [{ type: 'text', value: 'two' }],
        ],
      },
    ]);
  });
});

describe('chatMarkupToHtml', () => {
  it('renders a heading and bullet list', () => {
    const html = chatMarkupToHtml('## Title\n- a\n- b');
    expect(html).toContain('<h2>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>a</li>');
  });
});

describe('buildRichReplyMatrixContent', () => {
  it('includes quoted plain and formatted reply', () => {
    const r = buildRichReplyMatrixContent('@u:h', 'parent', '**reply**');
    expect(r.body).toContain('> <@u:h>');
    expect(r.body).toContain('**reply**');
    expect(r.formatted_body).toContain('<strong>');
    expect(r.formatted_body).toContain('&lt;@u:h&gt;');
  });

  /**
   * Media edit with cleared caption but existing reply: matrix-provider passes a
   * single space so rich-reply markup stays valid (regression guard).
   */
  it('preserves reply thread with space-only reply text (empty caption placeholder)', () => {
    const r = buildRichReplyMatrixContent(
      '@alice:example.org',
      'original',
      ' ',
    );
    expect(r.body).toContain('> <@alice:example.org>');
    expect(r.body).toContain('original');
    expect(r.format).toBe('org.matrix.custom.html');
    expect(r.formatted_body.length).toBeGreaterThan(0);
    const split = splitRichReplyPlainBody(r.body);
    expect(split.reply).toBe('');
    expect(split.quoted).toContain('@alice:example.org');
  });
});
