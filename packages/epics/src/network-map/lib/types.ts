import type { Space } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

export type NetworkMapPin = {
  id: number;
  slug: string;
  title: string;
  latitude: number;
  longitude: number;
  locationLabel?: string | null;
};

export type NetworkGlobeMapProps = {
  lang: Locale;
  spaces: Space[];
  className?: string;
  renderToolbar?: (layerControls: React.ReactNode) => React.ReactNode;
  /** When false, skip render loops while the map panel is hidden. */
  isActive?: boolean;
  /** When false, omit the map stage (toolbar stays mounted for chrome state). */
  showStage?: boolean;
  /**
   * When set, the map moves to this projection. Overview uses `flat`.
   * Clearing it leaves the current projection alone.
   */
  alignProjection?: NetworkMapProjectionMode;
  /** Fired when the corner control changes globe or flat. */
  onProjectionModeChange?: (mode: NetworkMapProjectionMode) => void;
};

export const NETWORK_MAP_LAYER_IDS = ['land', 'water', 'grid'] as const;

export type NetworkMapLayerId = (typeof NETWORK_MAP_LAYER_IDS)[number];

export type NetworkMapLayerVisibility = Record<NetworkMapLayerId, boolean>;

export type NetworkMapProjectionMode = 'globe' | 'flat';
