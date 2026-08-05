import { describe, expect, it } from 'vitest';
import { looksLikeMarkdown } from './looks-like-markdown';

describe('looksLikeMarkdown', () => {
  it('rejects plain prose', () => {
    expect(looksLikeMarkdown('hello world')).toBe(false);
    expect(looksLikeMarkdown('Just a sentence.')).toBe(false);
  });

  it('rejects bare URLs', () => {
    expect(looksLikeMarkdown('https://example.com/path')).toBe(false);
  });

  it('detects headings and lists', () => {
    expect(looksLikeMarkdown('# Title')).toBe(true);
    expect(
      looksLikeMarkdown(`# Title
- one
- two`),
    ).toBe(true);
    expect(
      looksLikeMarkdown(`1. first
2. second`),
    ).toBe(true);
  });

  it('detects bold / links', () => {
    expect(looksLikeMarkdown('say **hello** now')).toBe(true);
    expect(looksLikeMarkdown('see [docs](https://example.com)')).toBe(true);
  });

  it('detects task-list style lines', () => {
    expect(looksLikeMarkdown('- [ ] todo')).toBe(true);
  });
});
