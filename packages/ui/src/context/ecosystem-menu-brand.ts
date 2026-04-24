'use client';

import { useSyncExternalStore } from 'react';

/**
 * When set, `MenuTop` shows this ecosystem (root) mark instead of the app Hypha logo.
 * DHO / space pages set and clear on mount/unmount via a small client bridge.
 */
export type EcosystemMenuBrand = {
  logoUrl: string;
  href: string;
  /** e.g. "{rootTitle} home" for aria; alt text on image */
  label: string;
};

let state: EcosystemMenuBrand | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getEcosystemMenuBrand(): EcosystemMenuBrand | null {
  return state;
}

export function setEcosystemMenuBrand(next: EcosystemMenuBrand | null): void {
  const same =
    (next === null && state === null) ||
    (next !== null &&
      state !== null &&
      next.logoUrl === state.logoUrl &&
      next.href === state.href &&
      next.label === state.label);
  if (same) return;
  state = next;
  emit();
}

export function subscribeEcosystemMenuBrand(
  onStoreChange: () => void,
): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * For use in `MenuTop`: subscribe to the ecosystem override (no SSR value).
 */
export function useEcosystemMenuBrand(): EcosystemMenuBrand | null {
  return useSyncExternalStore(
    subscribeEcosystemMenuBrand,
    getEcosystemMenuBrand,
    () => null,
  );
}
