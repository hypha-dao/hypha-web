'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { UseSendNotificationsHook } from '../hooks';

interface HookRegistry {
  useSendNotifications: UseSendNotificationsHook;
}

const HookRegistryContext = createContext<HookRegistry | null>(null);

interface HookRegistryProviderProps {
  useSendNotifications: UseSendNotificationsHook;
  children: ReactNode;
}

export const HookRegistryProvider: React.FC<HookRegistryProviderProps> = ({
  useSendNotifications,
  children,
}) => {
  const registry: HookRegistry = {
    useSendNotifications,
  };

  return (
    <HookRegistryContext.Provider value={registry}>
      {children}
    </HookRegistryContext.Provider>
  );
};

export const useHookRegistry = () => {
  const context = useContext(HookRegistryContext);
  if (!context) {
    throw new Error('useHookRegistry must be used within HookRegistryProvider');
  }
  return context;
};
