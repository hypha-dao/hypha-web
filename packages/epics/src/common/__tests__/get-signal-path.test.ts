import { describe, expect, it } from 'vitest';

import { getSignalPath, getSpaceChatPath } from '../get-path-function';

describe('getSignalPath', () => {
  it('opens the signal page in its space', () => {
    expect(getSignalPath('en', 'noord', 'budget-q2')).toBe(
      '/en/dho/noord/coherence/signal/budget-q2',
    );
  });

  it('keeps the signal slug when it contains reserved characters', () => {
    expect(getSignalPath('pt', 'hypha', 'a&b/c')).toBe(
      '/pt/dho/hypha/coherence/signal/a%26b%2Fc',
    );
  });
});

describe('getSpaceChatPath', () => {
  it('opens the space dashboard on the requested channel room', () => {
    expect(getSpaceChatPath('en', 'noord')).toBe(
      '/en/dho/noord/overview?spaceChat=space',
    );
    expect(getSpaceChatPath('en', 'noord', 'ecosystem')).toBe(
      '/en/dho/noord/overview?spaceChat=ecosystem',
    );
    expect(getSpaceChatPath('en', 'noord', 'public')).toBe(
      '/en/dho/noord/overview?spaceChat=public',
    );
  });
});
