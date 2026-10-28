'use client';

import { useSyncExternalStore } from 'react';

/**
 * Home has two speakers: the left panel and the center chat. Only one should
 * play. When the left panel's sound is on, the center chat yields.
 */
let active = false;
const listeners = new Set<() => void>();

export function setHomeLeftPanelVoiceActive(next: boolean): void {
  if (active === next) return;
  active = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return active;
}

export function useHomeLeftPanelVoiceActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
