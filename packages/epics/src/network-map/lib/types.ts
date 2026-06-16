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
  pins: NetworkMapPin[];
  className?: string;
};

export type NetworkMapLayerId = 'land' | 'water' | 'graticule';

export type NetworkMapLayerVisibility = Record<NetworkMapLayerId, boolean>;

export type NetworkMapProjectionMode = 'globe' | 'flat';
