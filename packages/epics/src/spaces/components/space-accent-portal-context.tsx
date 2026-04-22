'use client';

import * as React from 'react';
import type { SpaceAccentPortalStyles } from '../utils/space-accent-portal-styles';
import { defaultSpacePortalStyles } from '../utils/space-accent-portal-styles';

export type { SpaceAccentPortalStyles };

const SpaceAccentPortalStylesContext =
  React.createContext<SpaceAccentPortalStyles>(defaultSpacePortalStyles);

const SpaceAccentPortalSetterContext = React.createContext<
  ((s: SpaceAccentPortalStyles) => void) | null
>(null);

export function SpaceAccentPortalBridge({
  children,
}: {
  children: React.ReactNode;
}) {
  const [styles, setStyles] = React.useState<SpaceAccentPortalStyles>(
    defaultSpacePortalStyles,
  );

  return (
    <SpaceAccentPortalStylesContext.Provider value={styles}>
      <SpaceAccentPortalSetterContext.Provider value={setStyles}>
        {children}
      </SpaceAccentPortalSetterContext.Provider>
    </SpaceAccentPortalStylesContext.Provider>
  );
}

export function useSpaceAccentPortalStyles(): SpaceAccentPortalStyles {
  return React.useContext(SpaceAccentPortalStylesContext);
}

export function useSetSpaceAccentPortalStyles():
  | ((s: SpaceAccentPortalStyles) => void)
  | null {
  return React.useContext(SpaceAccentPortalSetterContext);
}
