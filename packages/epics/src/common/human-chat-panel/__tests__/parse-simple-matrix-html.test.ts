// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseSimpleMatrixHtml } from '../parse-simple-matrix-html';

describe('parseSimpleMatrixHtml', () => {
  it('parses headings, lists, and underline', () => {
    const nodes = parseSimpleMatrixHtml(
      '<h2>Title</h2><ul><li>one</li><li><strong>two</strong></li></ul><ol><li>a</li></ol><u>under</u>',
    );
    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'heading', level: 2 }),
        expect.objectContaining({ type: 'ul' }),
        expect.objectContaining({ type: 'ol' }),
        expect.objectContaining({ type: 'underline' }),
      ]),
    );
  });

  it('parses safe anchor tags and drops javascript hrefs', () => {
    const nodes = parseSimpleMatrixHtml(
      '<a href="https://example.com">docs</a><a href="javascript:alert(1)">x</a>',
    );
    expect(nodes).toEqual([
      {
        type: 'link',
        href: 'https://example.com',
        children: [{ type: 'text', value: 'docs' }],
      },
      { type: 'text', value: 'x' },
    ]);
  });
});
