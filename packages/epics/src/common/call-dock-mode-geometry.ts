export type DockModeGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DOCK_THUMBNAIL_SIZE = {
  width: 480,
  height: 320,
} as const;

export const DOCK_EXPANDED_SIZE = {
  width: 640,
  height: 420,
} as const;

/** Preset width/height for explicit minimize/expand clicks; keep dock position. */
export function resolveDockGeometryForModeButton(
  prev: Pick<DockModeGeometry, 'x' | 'y' | 'width' | 'height'>,
  nextMode: 'thumbnail' | 'expanded',
): Pick<DockModeGeometry, 'x' | 'y' | 'width' | 'height'> {
  const preset =
    nextMode === 'thumbnail' ? DOCK_THUMBNAIL_SIZE : DOCK_EXPANDED_SIZE;
  return {
    x: prev.x,
    y: prev.y,
    width: preset.width,
    height: preset.height,
  };
}
