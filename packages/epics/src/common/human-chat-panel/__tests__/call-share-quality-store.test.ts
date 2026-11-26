import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getShareQualityChoice,
  publishShareQualityPicker,
  resetShareQualityStoreForTests,
  setShareQualityChoice,
  getShareQualityPicker,
} from '../call-share-quality-store';

describe('share quality store', () => {
  beforeEach(() => resetShareQualityStoreForTests());

  it('keeps the choice per share and clears it with Auto', () => {
    setShareQualityChoice('TR_a', { width: 640, height: 360 });
    expect(getShareQualityChoice('TR_a')).toEqual({ width: 640, height: 360 });
    expect(getShareQualityChoice('TR_b')).toBeUndefined();
    setShareQualityChoice('TR_a', undefined);
    expect(getShareQualityChoice('TR_a')).toBeUndefined();
    expect(getShareQualityChoice(undefined)).toBeUndefined();
  });

  it('only the owner that published can clear the picker', () => {
    const tileA = {};
    const tileB = {};
    const state = {
      shareKey: 'TR_a',
      options: [],
      selectedId: 'auto',
      select: vi.fn(),
    };
    publishShareQualityPicker(tileA, state);
    publishShareQualityPicker(tileB, null); // not the owner: ignored
    expect(getShareQualityPicker()?.shareKey).toBe('TR_a');
    publishShareQualityPicker(tileB, { ...state, shareKey: 'TR_b' });
    publishShareQualityPicker(tileA, null); // stale owner: ignored
    expect(getShareQualityPicker()?.shareKey).toBe('TR_b');
    publishShareQualityPicker(tileB, null);
    expect(getShareQualityPicker()).toBeNull();
  });
});
