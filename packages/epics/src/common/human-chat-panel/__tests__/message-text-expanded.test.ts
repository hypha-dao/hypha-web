import { describe, expect, it } from 'vitest';

import { toggleExpandedMessageId } from '../message-text-expanded';

describe('toggleExpandedMessageId', () => {
  it('toggles only the message id that was clicked', () => {
    const older = toggleExpandedMessageId(new Set(), '$older');
    expect([...older]).toEqual(['$older']);

    const both = toggleExpandedMessageId(older, '$newer');
    expect(both.has('$older')).toBe(true);
    expect(both.has('$newer')).toBe(true);

    const collapsedOlder = toggleExpandedMessageId(both, '$older');
    expect(collapsedOlder.has('$older')).toBe(false);
    expect(collapsedOlder.has('$newer')).toBe(true);
  });

  it('ignores a blank id', () => {
    const expanded = toggleExpandedMessageId(new Set(['$older']), '  ');
    expect([...expanded]).toEqual(['$older']);
  });
});
