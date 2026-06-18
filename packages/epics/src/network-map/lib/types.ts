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
};

export type NetworkMapLayerId = 'land' | 'water' | 'graticule';

export type NetworkMapLayerVisibility = Record<NetworkMapLayerId, boolean>;

export type NetworkMapProjectionMode = 'globe' | 'flat';
