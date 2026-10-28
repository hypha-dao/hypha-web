import { describe, expect, it } from 'vitest';

import { getSignalPath } from '../get-path-function';

describe('getSignalPath', () => {
  it('opens that signal on its space via the human-chat deep link', () => {
    expect(getSignalPath('en', 'noord', 'budget-q2')).toBe(
      '/en/dho/noord?signal=budget-q2',
    );
  });

  it('keeps the signal slug when it contains reserved characters', () => {
    expect(getSignalPath('pt', 'hypha', 'a&b')).toBe(
      '/pt/dho/hypha?signal=a%26b',
    );
  });
});
