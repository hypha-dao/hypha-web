import { describe, expect, it } from 'vitest';

import {
  applyVisualAssetsToKnownAnswers,
  isAnsweredVisualAssetsConfirmed,
} from '../onboarding-visual-assets-guidance';

describe('isAnsweredVisualAssetsConfirmed', () => {
  it('accepts common short affirmatives', () => {
    expect(isAnsweredVisualAssetsConfirmed('yes')).toBe(true);
    expect(isAnsweredVisualAssetsConfirmed('yep')).toBe(true);
    expect(isAnsweredVisualAssetsConfirmed('sure')).toBe(true);
    expect(isAnsweredVisualAssetsConfirmed('looks great')).toBe(true);
    expect(isAnsweredVisualAssetsConfirmed('love them')).toBe(true);
    expect(isAnsweredVisualAssetsConfirmed('works for me')).toBe(true);
  });

  it('rejects non-confirmations', () => {
    expect(isAnsweredVisualAssetsConfirmed('regenerate')).toBe(false);
    expect(isAnsweredVisualAssetsConfirmed('make it darker')).toBe(false);
  });
});

describe('applyVisualAssetsToKnownAnswers', () => {
  const assets = {
    logoUrl: 'https://example.com/logo.png',
    leadImageUrl: 'https://example.com/banner.png',
  };

  it('marks choice and vibe answered when assets exist', () => {
    const knownAnswers: Record<string, unknown> = {};
    applyVisualAssetsToKnownAnswers(knownAnswers, { visualAssets: assets });
    expect(knownAnswers.visual_assets_choice).toBe('generate');
    expect(knownAnswers.visual_vibe).toBe('generated from conversation');
    expect(knownAnswers.visual_assets_confirmed).toBeUndefined();
  });

  it('marks confirmed from persisted flag or last user text', () => {
    const fromFlag: Record<string, unknown> = {};
    applyVisualAssetsToKnownAnswers(fromFlag, {
      visualAssets: assets,
      visualAssetsConfirmed: true,
    });
    expect(fromFlag.visual_assets_confirmed).toBe('yes');

    const fromText: Record<string, unknown> = {};
    applyVisualAssetsToKnownAnswers(fromText, {
      visualAssets: assets,
      lastUserText: 'yep',
    });
    expect(fromText.visual_assets_confirmed).toBe('yes');
  });
});
