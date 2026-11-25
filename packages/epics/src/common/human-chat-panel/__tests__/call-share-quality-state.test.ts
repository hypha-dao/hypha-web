import { describe, expect, it } from 'vitest';

import {
  CALL_SHARE_QUALITY_IMPROVING_TIMEOUT_MS,
  formatCallShareResolution,
  resolveCallShareQualityPhase,
  resolveRenderedContentWidthPx,
} from '../call-share-quality-state';

const base = {
  receivedWidth: 640,
  receivedHeight: 360,
  renderedWidth: 960,
  renderedHeight: 540,
  devicePixelRatio: 1,
  publishedWidth: 1920,
  elapsedMs: 1000,
};

describe('resolveCallShareQualityPhase', () => {
  it('is starting before the first frame', () => {
    expect(
      resolveCallShareQualityPhase({
        ...base,
        receivedWidth: 0,
        receivedHeight: 0,
      }).phase,
    ).toBe('starting');
  });

  it('gives up on starting after the timeout', () => {
    expect(
      resolveCallShareQualityPhase({
        ...base,
        receivedWidth: 0,
        receivedHeight: 0,
        elapsedMs: CALL_SHARE_QUALITY_IMPROVING_TIMEOUT_MS,
      }).phase,
    ).toBe('done');
  });

  it('is improving while the low layer is shown in a large tile', () => {
    const result = resolveCallShareQualityPhase(base);
    expect(result.phase).toBe('improving');
    expect(result.targetWidth).toBe(960);
  });

  it('is done once the received width reaches the target', () => {
    expect(
      resolveCallShareQualityPhase({
        ...base,
        receivedWidth: 1920,
        receivedHeight: 1080,
      }).phase,
    ).toBe('done');
  });

  it('is done when the low layer already covers a small tile', () => {
    expect(
      resolveCallShareQualityPhase({
        ...base,
        renderedWidth: 400,
        renderedHeight: 225,
      }).phase,
    ).toBe('done');
  });

  it('caps the target at the published width', () => {
    const result = resolveCallShareQualityPhase({
      ...base,
      receivedWidth: 1280,
      receivedHeight: 720,
      renderedWidth: 3000,
      renderedHeight: 1700,
      publishedWidth: 1280,
    });
    expect(result.phase).toBe('done');
    expect(result.targetWidth).toBe(1280);
  });

  it('accounts for device pixel ratio', () => {
    expect(
      resolveCallShareQualityPhase({ ...base, devicePixelRatio: 2 })
        .targetWidth,
    ).toBe(1920);
  });

  it('stops improving after the timeout (network limited)', () => {
    expect(
      resolveCallShareQualityPhase({
        ...base,
        elapsedMs: CALL_SHARE_QUALITY_IMPROVING_TIMEOUT_MS + 1,
      }).phase,
    ).toBe('done');
  });

  it('is done when the tile has no size', () => {
    expect(
      resolveCallShareQualityPhase({
        ...base,
        renderedWidth: 0,
        renderedHeight: 0,
      }).phase,
    ).toBe('done');
  });
});

describe('resolveRenderedContentWidthPx', () => {
  it('uses height when the box is wider than the picture', () => {
    expect(
      resolveRenderedContentWidthPx({
        renderedWidth: 1600,
        renderedHeight: 450,
        receivedWidth: 1600,
        receivedHeight: 900,
        devicePixelRatio: 1,
      }),
    ).toBe(800);
  });
});

describe('formatCallShareResolution', () => {
  it('formats and rejects empty sizes', () => {
    expect(formatCallShareResolution(1920, 1080)).toBe('1920×1080');
    expect(formatCallShareResolution(0, 0)).toBeNull();
  });
});

describe('viewer cap and network limit (#2742)', () => {
  it('a cap lowers the target and completes at the capped layer', () => {
    const r = resolveCallShareQualityPhase({
      ...base,
      renderedWidth: 1920,
      renderedHeight: 1080,
      receivedWidth: 640,
      receivedHeight: 360,
      capWidth: 640,
    });
    expect(r.phase).toBe('done');
    expect(r.targetWidth).toBe(640);
    expect(r.limitedByNetwork).toBeUndefined();
  });

  it('a cap never raises the target', () => {
    const r = resolveCallShareQualityPhase({
      ...base,
      renderedWidth: 960,
      renderedHeight: 540,
      capWidth: 1920,
    });
    expect(r.targetWidth).toBe(960);
  });

  it('flags a network limit only when time ran out below the target', () => {
    const slow = resolveCallShareQualityPhase({
      ...base,
      elapsedMs: CALL_SHARE_QUALITY_IMPROVING_TIMEOUT_MS,
    });
    expect(slow.phase).toBe('done');
    expect(slow.limitedByNetwork).toBe(true);
    const sharp = resolveCallShareQualityPhase({
      ...base,
      receivedWidth: 960,
      receivedHeight: 540,
      elapsedMs: CALL_SHARE_QUALITY_IMPROVING_TIMEOUT_MS,
    });
    expect(sharp.limitedByNetwork).toBeUndefined();
  });
});
