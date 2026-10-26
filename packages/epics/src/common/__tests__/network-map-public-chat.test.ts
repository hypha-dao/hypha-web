import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sidePanel = readFileSync(
  resolve(__dirname, '../../spaces/components/network-side-panel.tsx'),
  'utf8',
);
const headerTrigger = readFileSync(
  resolve(__dirname, '../panel-wrap-layout.tsx'),
  'utf8',
);

describe('all-spaces map chat entry points', () => {
  it('opens the public channel from the map Connect button', () => {
    expect(sidePanel).toContain('useOpenSpacePublicChat');
    expect(sidePanel).toContain('void openPublicChat({');
    expect(sidePanel).toContain('slug: focusedSlug');
    expect(sidePanel).not.toMatch(/openCoherenceChat\(\s*focusedRoomId/);
  });

  it('opens the public channel from the header icon for a map-selected space', () => {
    expect(headerTrigger).toContain('useOpenSpacePublicChat');
    expect(headerTrigger).toContain('if (focusedSpaceChat?.slug)');
    expect(headerTrigger).toContain('void openPublicChat({');
    expect(headerTrigger).toContain('slug: focusedSpaceChat.slug');
    expect(headerTrigger).not.toMatch(
      /openCoherenceChat\(\s*focusedSpaceChat\.roomId/,
    );
  });
});
