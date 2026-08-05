import { describe, expect, it } from 'vitest';
import { tokenizeInlineMarkdown } from './markdown-inline';

describe('tokenizeInlineMarkdown', () => {
  it('tokenizes bold', () => {
    expect(tokenizeInlineMarkdown('a **b** c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', value: 'b' },
      { type: 'text', value: ' c' },
    ]);
  });

  it('tokenizes italic and underline', () => {
    expect(tokenizeInlineMarkdown('*i* and __u__')).toEqual([
      { type: 'italic', value: 'i' },
      { type: 'text', value: ' and ' },
      { type: 'underline', value: 'u' },
    ]);
  });
});
