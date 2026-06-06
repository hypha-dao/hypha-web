import { describe, expect, it } from 'vitest';
import {
  DOCK_EXPANDED_SIZE,
  DOCK_THUMBNAIL_SIZE,
  resolveDockGeometryForModeButton,
} from '../call-dock-mode-geometry';

describe('resolveDockGeometryForModeButton', () => {
  it('snaps to thumbnail preset while preserving position', () => {
    expect(
      resolveDockGeometryForModeButton(
        { x: 12, y: 8, width: 880, height: 640 },
        'thumbnail',
      ),
    ).toEqual({
      x: 12,
      y: 8,
      width: DOCK_THUMBNAIL_SIZE.width,
      height: DOCK_THUMBNAIL_SIZE.height,
    });
  });

  it('snaps to expanded preset while preserving position', () => {
    expect(
      resolveDockGeometryForModeButton(
        {
          x: 4,
          y: 2,
          width: DOCK_THUMBNAIL_SIZE.width,
          height: DOCK_THUMBNAIL_SIZE.height,
        },
        'expanded',
      ),
    ).toEqual({
      x: 4,
      y: 2,
      width: DOCK_EXPANDED_SIZE.width,
      height: DOCK_EXPANDED_SIZE.height,
    });
  });

  it('ignores previously saved custom dimensions on mode button clicks', () => {
    const firstClick = resolveDockGeometryForModeButton(
      { x: 0, y: 0, width: 800, height: 520 },
      'thumbnail',
    );
    const secondClick = resolveDockGeometryForModeButton(
      { ...firstClick, width: 800, height: 520 },
      'thumbnail',
    );
    expect(secondClick).toEqual(firstClick);
  });
});
