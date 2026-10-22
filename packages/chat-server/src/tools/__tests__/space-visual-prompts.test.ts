import { describe, expect, it } from 'vitest';

import { buildBannerPrompt, buildLogoPrompt } from '../space-visual-prompts';

const sample = {
  space_purpose: 'Regenerative coastal community coordination',
  visual_vibe: 'luminous tidepools, warm gold light, sculptural organic forms',
};

describe('space visual asset prompts', () => {
  it('forbids on-image text and asks for a physical mark', () => {
    const prompt = buildLogoPrompt(sample);

    expect(prompt).toMatch(/ZERO TEXT|Pure imagery/i);
    expect(prompt).toMatch(/printed emblem|real object/i);
    expect(prompt).toMatch(/no neon|no fantasy CGI/i);
    expect(prompt).toContain(sample.space_purpose);
    expect(prompt).toContain('luminous tidepools');
  });

  it('asks for a documentary photograph and drops synthetic directions', () => {
    const prompt = buildBannerPrompt({
      ...sample,
      visual_vibe:
        'glowing magical tree, neon energy roots, god rays, warm gold light',
    });

    expect(prompt).toMatch(/ZERO TEXT|Pure imagery/i);
    expect(prompt).toMatch(/documentary photograph/i);
    expect(prompt).toContain('warm gold light');
    expect(prompt).not.toContain('magical tree');
    expect(prompt).not.toContain('neon energy');
    expect(prompt).toContain('no god rays');
  });
});
