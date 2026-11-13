'use client';

import * as React from 'react';

/**
 * Lets energy-page background work (intelligence, idle-gated prefetch)
 * wait until the 7d telemetry request has finished — success or retries
 * exhausted — instead of starting in the same window.
 */
let settledHolders = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getEnergySevenDaySettled(): boolean {
  return settledHolders > 0;
}

export function subscribeEnergySevenDaySettled(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hold while 7d telemetry has resolved, or while energy is disabled. */
export function holdEnergySevenDaySettled(): () => void {
  settledHolders += 1;
  notify();
  return () => {
    settledHolders = Math.max(0, settledHolders - 1);
    notify();
  };
}

export function useEnergySevenDaySettled(): boolean {
  return React.useSyncExternalStore(
    subscribeEnergySevenDaySettled,
    getEnergySevenDaySettled,
    getEnergySevenDaySettled,
  );
}
