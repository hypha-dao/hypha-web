import { describe, expect, it } from 'vitest';

import {
  CALL_SHARE_QUALITY_AUTO,
  adaptiveRequestDensity,
  adaptiveRequestSize,
  buildCallShareQualityOptions,
  normalizePublishedLayers,
  resolveCallShareQualityReason,
  servedShareLayer,
} from '../call-share-quality-options';
import { resolveCallShareQualityPhase } from '../call-share-quality-state';

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

describe('adaptiveRequestSize', () => {
  it("uses the whole box at the screen's real density (pixelDensity: 'screen')", () => {
    expect(adaptiveRequestSize(800, 450, 1)).toEqual({
      width: 800,
      height: 450,
    });
    expect(adaptiveRequestSize(800, 450, 1.5)).toEqual({
      width: 1200,
      height: 675,
    });
    expect(adaptiveRequestDensity(0)).toBe(1);
  });
});

describe('servedShareLayer', () => {
  it('picks the smallest copy covering both width and height', () => {
    // Full view on the preview: a 1275 x 815 box received 1080p, since 720p is not tall enough.
    expect(servedShareLayer(layers, { width: 1275, height: 815 })).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(servedShareLayer(layers, { width: 1210, height: 645 })).toEqual({
      width: 1280,
      height: 720,
    });
    expect(servedShareLayer(layers, { width: 4000, height: 2000 })).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});

describe('buildCallShareQualityOptions', () => {
  it('lists Auto then layers from largest down, labelled by height', () => {
    const o = buildCallShareQualityOptions({
      layers,
      tileRequest: { width: 1920, height: 1080 },
    });
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

  const flags = (o: ReturnType<typeof buildCallShareQualityOptions>) =>
    o
      .filter((x) => x.kind === 'layer')
      .map((x) => (x.kind === 'layer' ? [x.label, x.needsResize] : []));

  it('a box wider than 720p is tall enough for 1080p even if narrower', () => {
    // The preview bug: 1920x1080 arriving while 1080p showed as unavailable.
    const o = buildCallShareQualityOptions({
      layers,
      tileRequest: { width: 1275, height: 815 },
    });
    expect(flags(o)).toEqual([
      ['1080p', false],
      ['720p', false],
      ['360p', false],
    ]);
  });

  it('marks layers the box is too small for', () => {
    const o = buildCallShareQualityOptions({
      layers,
      tileRequest: { width: 500, height: 280 },
    });
    expect(flags(o)).toEqual([
      ['1080p', true],
      ['720p', true],
      ['360p', false],
    ]);
  });

  it('never marks the copy that is arriving, even after the shared window shrank', () => {
    const o = buildCallShareQualityOptions({
      layers,
      tileRequest: { width: 1210, height: 645 },
      receivedHeight: 1000,
    });
    expect(flags(o)[0]).toEqual(['1080p', false]);
  });

  it('only Auto when no layers are known; unknown tile disables nothing', () => {
    expect(buildCallShareQualityOptions({ layers: [] })).toEqual([
      { id: CALL_SHARE_QUALITY_AUTO, kind: 'auto' },
    ]);
    const o = buildCallShareQualityOptions({ layers });
    expect(o.every((x) => x.kind === 'auto' || !x.needsResize)).toBe(true);
  });
});

describe('resolveCallShareQualityPhase with the served copy', () => {
  it('a share that arrives at the requested width is done, not limited by network', () => {
    const result = resolveCallShareQualityPhase({
      receivedWidth: 1920,
      receivedHeight: 1080,
      renderedWidth: 960,
      renderedHeight: 540,
      devicePixelRatio: adaptiveRequestDensity(2),
      publishedWidth: 1920,
      elapsedMs: 15_000,
    });
    expect(result.phase).toBe('done');
    expect(result.limitedByNetwork).toBeFalsy();
  });

  it('a shrunken window sending a bit less than the listed copy is not limited by network', () => {
    // Preview: the 360p copy was listed 540 wide, 501 arrived in a small window.
    const result = resolveCallShareQualityPhase({
      receivedWidth: 501,
      receivedHeight: 333,
      renderedWidth: 600,
      renderedHeight: 400,
      devicePixelRatio: 1,
      publishedWidth: 1620,
      elapsedMs: 15_000,
      servedLayerWidth: 540,
    });
    expect(result.phase).toBe('done');
    expect(result.limitedByNetwork).toBeFalsy();
  });

  it('still flags a copy that does not arrive', () => {
    const result = resolveCallShareQualityPhase({
      receivedWidth: 640,
      receivedHeight: 360,
      renderedWidth: 1600,
      renderedHeight: 900,
      devicePixelRatio: 1,
      publishedWidth: 1920,
      elapsedMs: 15_000,
      servedLayerWidth: 1920,
    });
    expect(result.limitedByNetwork).toBe(true);
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
