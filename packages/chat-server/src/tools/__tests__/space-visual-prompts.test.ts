import { describe, expect, it } from 'vitest';

import { buildBannerPrompt, buildLogoPrompt } from '../space-visual-prompts';

const sample = {
  space_purpose: 'Regenerative coastal community coordination',
  visual_vibe: 'luminous tidepools, warm gold light, sculptural organic forms',
};

describe('space visual asset prompts', () => {
  it('forbids on-image text and avoids basic flat logo language', () => {
    const prompt = buildLogoPrompt(sample);

    expect(prompt).toMatch(/ZERO TEXT|Pure imagery/i);
    expect(prompt).not.toMatch(/minimal flat vector/i);
    expect(prompt).toMatch(/mindblowing|emblematic|sculptural/i);
    expect(prompt).toContain(sample.space_purpose);
    expect(prompt).toContain(sample.visual_vibe);
  });

  it('asks for mature cinematic banners without typography', () => {
    const prompt = buildBannerPrompt(sample);

    expect(prompt).toMatch(/ZERO TEXT|Pure imagery/i);
    expect(prompt).toMatch(/cinematic|inspirational|mature/i);
  });
});
