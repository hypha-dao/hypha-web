import { describe, expect, it } from 'vitest';

import {
  filterEmojiShortcodes,
  getActiveColonToken,
} from '../emoji-mart-index';

describe('getActiveColonToken', () => {
  it('opens a shortcode at the start of the draft', () => {
    expect(getActiveColonToken(':', 1)).toEqual({ start: 0, query: '' });
    expect(getActiveColonToken(':smile', 6)).toEqual({
      start: 0,
      query: 'smile',
    });
  });

  it('opens a shortcode after whitespace', () => {
    expect(getActiveColonToken('hi :th', 6)).toEqual({ start: 3, query: 'th' });
  });

  it('keeps the colon in 10:30', () => {
    expect(getActiveColonToken('10:', 3)).toBeNull();
    expect(getActiveColonToken('10:30', 5)).toBeNull();
    expect(getActiveColonToken('see you at 10:30', 16)).toBeNull();
  });

  it('keeps the colon in text: more', () => {
    expect(getActiveColonToken('text:', 5)).toBeNull();
    expect(getActiveColonToken('text: more', 5)).toBeNull();
    expect(getActiveColonToken('text: more', 10)).toBeNull();
  });

  it('closes once a space is typed after a real shortcode start', () => {
    expect(getActiveColonToken(': ', 2)).toBeNull();
    expect(getActiveColonToken('hi : more', 9)).toBeNull();
  });

  it('closes across a newline without rewriting the token', () => {
    expect(getActiveColonToken(':\n', 2)).toBeNull();
    expect(getActiveColonToken(':smile\n', 7)).toBeNull();
  });
});

describe('filterEmojiShortcodes', () => {
  const all = [
    { id: 'smile', native: '😄' },
    { id: 'smiley', native: '😃' },
    { id: 'thumbsup', native: '👍' },
  ];

  it('still returns a pickable match for a typed shortcode', () => {
    expect(filterEmojiShortcodes(all, 'smi').map((row) => row.native)).toEqual([
      '😄',
      '😃',
    ]);
  });
});
