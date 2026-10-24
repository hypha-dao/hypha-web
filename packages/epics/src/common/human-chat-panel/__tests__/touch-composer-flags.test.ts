import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { touchComposerFromViewportFlags } from '../touch-composer-flags';

const here = dirname(fileURLToPath(import.meta.url));

describe('touchComposerFromViewportFlags', () => {
  it('is true when either viewport flag is true', () => {
    expect(touchComposerFromViewportFlags(true, false)).toBe(true);
    expect(touchComposerFromViewportFlags(false, true)).toBe(true);
    expect(touchComposerFromViewportFlags(true, undefined)).toBe(true);
    expect(touchComposerFromViewportFlags(undefined, true)).toBe(true);
  });

  it('is false while both flags are still hydrating or desktop', () => {
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
  });
});
