'use client';

import React from 'react';

import {
  getNetworkGlobeReady,
  subscribeNetworkGlobeReady,
} from '../lib/network-globe-ready-store';

export function useNetworkGlobeReady(): boolean {
  return React.useSyncExternalStore(
    subscribeNetworkGlobeReady,
    getNetworkGlobeReady,
    () => false,
  );
}
