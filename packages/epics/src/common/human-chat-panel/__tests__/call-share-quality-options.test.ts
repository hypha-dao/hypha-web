import { describe, expect, it } from 'vitest';

import {
  CALL_SHARE_QUALITY_AUTO,
  adaptiveRequestWidthPx,
  buildCallShareQualityOptions,
  normalizePublishedLayers,
  resolveCallShareQualityReason,
} from '../call-share-quality-options';

const layers = [
  { width: 1920, height: 1080 },
  { width: 640, height: 360 },
  { width: 1280, height: 720 },
];

describe('normalizePublishedLayers', () => {
  it('sorts, drops invalid and duplicate layers', () => {
    expect(
      normalizePublishedLayers([
        ...layers,
        { width: 640, height: 360 },
        { width: 0, height: 100 },
        undefined,
        {},
      ]),
    ).toEqual([
      { width: 640, height: 360 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ]);
  });
  it('handles missing input', () => {
    expect(normalizePublishedLayers(undefined)).toEqual([]);
  });
});

describe('adaptiveRequestWidthPx', () => {
  it('uses density 1 up to 2x screens and 2 above', () => {
    expect(adaptiveRequestWidthPx(800, 1)).toBe(800);
    expect(adaptiveRequestWidthPx(800, 2)).toBe(800);
    expect(adaptiveRequestWidthPx(800, 3)).toBe(1600);
  });
});

describe('buildCallShareQualityOptions', () => {
  it('lists Auto then layers from largest down, labelled by height', () => {
    const o = buildCallShareQualityOptions({ layers, tileRequestWidth: 1920 });
    expect(o.map((x) => x.id)).toEqual([
      CALL_SHARE_QUALITY_AUTO,
      'layer:1920x1080',
      'layer:1280x720',
      'layer:640x360',
    ]);
    expect(o.slice(1).map((x) => (x.kind === 'layer' ? x.label : ''))).toEqual([
      '1080p',
      '720p',
      '360p',
    ]);
    expect(o.every((x) => x.kind === 'auto' || !x.needsResize)).toBe(true);
  });

  it('marks layers the tile is too small for', () => {
    const o = buildCallShareQualityOptions({ layers, tileRequestWidth: 500 });
    const flags = o
      .filter((x) => x.kind === 'layer')
      .map((x) => (x.kind === 'layer' ? [x.label, x.needsResize] : []));
    // 500 px is not above the 640 layer, so 720p and 1080p need a bigger tile; 360p never does.
    expect(flags).toEqual([
      ['1080p', true],
      ['720p', true],
      ['360p', false],
    ]);
  });

  it('only Auto when no layers are known; unknown tile disables nothing', () => {
    expect(
      buildCallShareQualityOptions({ layers: [], tileRequestWidth: 0 }),
    ).toEqual([{ id: CALL_SHARE_QUALITY_AUTO, kind: 'auto' }]);
    const o = buildCallShareQualityOptions({ layers, tileRequestWidth: 0 });
    expect(o.every((x) => x.kind === 'auto' || !x.needsResize)).toBe(true);
  });
});

describe('resolveCallShareQualityReason', () => {
  it('improving while not done', () => {
    expect(
      resolveCallShareQualityReason({
        phase: 'improving',
        manual: false,
        limitedByNetwork: false,
      }),
    ).toBe('improving');
  });
  it('network limit wins when done', () => {
    expect(
      resolveCallShareQualityReason({
        phase: 'done',
        manual: true,
        limitedByNetwork: true,
      }),
    ).toBe('limited-by-network');
  });
  it('auto vs capped', () => {
    expect(
      resolveCallShareQualityReason({
        phase: 'done',
        manual: false,
        limitedByNetwork: false,
      }),
    ).toBe('auto');
    expect(
      resolveCallShareQualityReason({
        phase: 'done',
        manual: true,
        limitedByNetwork: false,
      }),
    ).toBe('capped');
  });
});
