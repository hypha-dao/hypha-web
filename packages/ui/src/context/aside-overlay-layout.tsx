'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

export type AsideOverlayLayoutMode = 'modal-shell' | 'side-panel';

const AsideOverlayLayoutContext =
  createContext<AsideOverlayLayoutMode>('side-panel');

export function AsideOverlayLayoutProvider({
  mode,
  children,
}: {
  mode: AsideOverlayLayoutMode;
  children: ReactNode;
}) {
  return (
    <AsideOverlayLayoutContext.Provider value={mode}>
      {children}
    </AsideOverlayLayoutContext.Provider>
  );
}

export function useAsideOverlayLayout(): AsideOverlayLayoutMode {
  return useContext(AsideOverlayLayoutContext);
}
