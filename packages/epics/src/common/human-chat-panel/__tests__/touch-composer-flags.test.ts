import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { touchComposerFromViewportFlags } from '../touch-composer-flags';

const here = dirname(fileURLToPath(import.meta.url));

describe('touchComposerFromViewportFlags', () => {
  it('follows coarse pointer, not viewport width', () => {
    expect(touchComposerFromViewportFlags(true, false)).toBe(false);
    expect(touchComposerFromViewportFlags(false, true)).toBe(true);
    expect(touchComposerFromViewportFlags(true, true)).toBe(true);
    expect(touchComposerFromViewportFlags(true, undefined)).toBe(false);
    expect(touchComposerFromViewportFlags(undefined, true)).toBe(true);
  });

  it('is false while coarse pointer is still hydrating or fine', () => {
    expect(touchComposerFromViewportFlags(undefined, undefined)).toBe(false);
    expect(touchComposerFromViewportFlags(false, false)).toBe(false);
  });
});

describe('viewport hooks are not short-circuited', () => {
  const shortCircuit = /useIsMobile\(\)[^;\n]*usePrefersCoarsePointer\(/;

  it.each([
    'human-chat-panel-messages.tsx',
    'human-chat-panel-message-overflow.tsx',
    'human-chat-panel-chat-bar.tsx',
    'human-chat-panel-in-call-controls.tsx',
    'human-right-panel.tsx',
  ])('%s calls each viewport hook on its own statement', (file) => {
    const path =
      file === 'human-right-panel.tsx'
        ? join(here, '../../human-right-panel.tsx')
        : join(here, '..', file);
    const source = readFileSync(path, 'utf8');
    expect(source).not.toMatch(shortCircuit);
    if (
      file === 'human-chat-panel-messages.tsx' ||
      file === 'human-chat-panel-message-overflow.tsx' ||
      file === 'human-chat-panel-chat-bar.tsx'
    ) {
      expect(source).toContain('touchComposerFromViewportFlags(');
    }
  });
});
