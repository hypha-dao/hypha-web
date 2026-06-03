import { describe, expect, it } from 'vitest';

import {
  CALL_DOCUMENT_PIP_CALL,
  clampCallDocumentPipWindowSize,
} from '../call-document-pip-window-geometry';

describe('call-document-pip-window-geometry', () => {
  it('enforces call-mode minimum size and 3:2 aspect ratio', () => {
    const clamped = clampCallDocumentPipWindowSize(
      { width: 120, height: 600 },
      'call',
      900,
    );
    expect(clamped.width).toBeGreaterThanOrEqual(
      CALL_DOCUMENT_PIP_CALL.minWidth,
    );
    expect(clamped.height).toBeGreaterThanOrEqual(
      CALL_DOCUMENT_PIP_CALL.minHeight,
    );
    expect(clamped.width / clamped.height).toBeCloseTo(
      CALL_DOCUMENT_PIP_CALL.aspectRatio,
      2,
    );
  });

  it('preserves valid call-mode sizes within bounds', () => {
    expect(
      clampCallDocumentPipWindowSize({ width: 480, height: 320 }, 'call', 900),
    ).toEqual({ width: 480, height: 320 });
  });

  it('bounds filmstrip mode width and minimum height', () => {
    const clamped = clampCallDocumentPipWindowSize(
      { width: 80, height: 120 },
      'filmstrip',
      900,
    );
    expect(clamped.width).toBe(224);
    expect(clamped.height).toBeGreaterThanOrEqual(280);
  });
});
