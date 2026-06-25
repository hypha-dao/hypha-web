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
};

export const NETWORK_MAP_LAYER_IDS = ['land', 'water', 'grid'] as const;

export type NetworkMapLayerId = (typeof NETWORK_MAP_LAYER_IDS)[number];

export type NetworkMapLayerVisibility = Record<NetworkMapLayerId, boolean>;

export type NetworkMapProjectionMode = 'globe' | 'flat';
