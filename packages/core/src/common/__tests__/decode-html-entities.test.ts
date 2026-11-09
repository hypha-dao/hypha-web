import { describe, expect, it } from 'vitest';

import { decodeHtmlEntities } from '../decode-html-entities';

describe('decodeHtmlEntities', () => {
  it('decodes common named entities', () => {
    expect(
      decodeHtmlEntities(
        'Ecosystem Growth &amp; Activation Lead Commitment &amp; Development',
      ),
    ).toBe('Ecosystem Growth & Activation Lead Commitment & Development');
  });

  it('decodes numeric and hex entities', () => {
    expect(decodeHtmlEntities('A&#38;B &#x26; C')).toBe('A&B & C');
  });

  it('unwraps double-encoded ampersands', () => {
    expect(decodeHtmlEntities('Foo &amp;amp; Bar')).toBe('Foo & Bar');
  });

  it('leaves plain text alone', () => {
    expect(decodeHtmlEntities('No entities here')).toBe('No entities here');
    expect(decodeHtmlEntities('')).toBe('');
  });
});
