import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('energy-route space logos stay on next/image', () => {
  it('routes the AI panel header mark through SpaceSwitcherMark', () => {
    const source = readFileSync(
      join(dir, '../ai-panel/ai-panel-header.tsx'),
      'utf8',
    );
    expect(source).toContain('SpaceSwitcherMark');
    expect(source).not.toMatch(/<img\s+src=\{currentIcon\}/);
  });

  it('does not load the human-chat space mark from a raw img', () => {
    const panel = readFileSync(join(dir, '../human-right-panel.tsx'), 'utf8');
    const header = readFileSync(
      join(dir, '../human-chat-panel/human-chat-panel-header.tsx'),
      'utf8',
    );
    expect(panel).toContain('OptimizedAvatarImage');
    expect(panel).not.toMatch(/<img\s+src=\{src\}/);
    expect(header).toContain('OptimizedAvatarImage');
    expect(header).not.toMatch(/<img\s+src=\{src\}/);
  });

  it('does not mark 7d settled while space energy is still loading', () => {
    const source = readFileSync(
      join(dir, '../../treasury/components/assets/space-energy-section.tsx'),
      'utf8',
    );
    expect(source).toContain('shouldHoldSettledForDisabledEnergy');
    expect(source).not.toMatch(/if \(isLoading \|\| data\?\.enabled\) return;/);
  });

  it('gates the spaces-rail intelligence SWR until 7d settles', () => {
    const source = readFileSync(
      join(dir, '../../people/components/mobile-spaces-subnav.tsx'),
      'utf8',
    );
    expect(source).toContain('useMemberIntelligence');
    expect(source).not.toMatch(
      /jwt \? \['\/api\/v1\/people\/me\/intelligence'/,
    );
  });
});
