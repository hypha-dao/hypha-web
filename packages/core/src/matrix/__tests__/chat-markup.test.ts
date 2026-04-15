import { describe, expect, it } from 'vitest';

import {
  buildRichReplyMatrixContent,
  chatMarkupLooksFormatted,
  matrixTextEventContentWithOptionalFormatting,
  parseChatMarkup,
} from '../chat-markup';

describe('chatMarkupLooksFormatted', () => {
  it('is false for plain text', () => {
    expect(chatMarkupLooksFormatted('hello')).toBe(false);
  });
  it('detects bold', () => {
    expect(chatMarkupLooksFormatted('a **b** c')).toBe(true);
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
});

describe('parseChatMarkup', () => {
  it('parses nested bold and italic', () => {
    const nodes = parseChatMarkup('**a *b* c**');
    expect(JSON.stringify(nodes)).toContain('bold');
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
  });
});
