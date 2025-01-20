'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { IPFSClient, IPFSClientImpl, IPFSClientConfig } from './client';

interface IPFSContextValue {
  client: IPFSClient | null;
  isConnected: boolean;
  connect(config?: IPFSClientConfig): Promise<void>;
  disconnect(): Promise<void>;
}

const IPFSContext = createContext<IPFSContextValue | null>(null);

export interface IPFSProviderProps {
  children: React.ReactNode;
  initialConfig?: IPFSClientConfig;
}

export const IPFSProvider: React.FC<IPFSProviderProps> = ({
  children,
  initialConfig,
}) => {
  const [client, setClient] = useState<IPFSClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(
    async (config?: IPFSClientConfig) => {
      try {
        const newClient = new IPFSClientImpl(config || initialConfig);
        setClient(newClient);
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to connect to IPFS:', error);
        setIsConnected(false);
        throw error;
      }
    },
    [initialConfig],
  );

  const disconnect = useCallback(async () => {
    setClient(null);
    setIsConnected(false);
  }, []);

  const value = useMemo(
    () => ({
      client,
      isConnected,
      connect,
      disconnect,
    }),
    [client, isConnected, connect, disconnect],
  );

  React.useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return <IPFSContext.Provider value={value}>{children}</IPFSContext.Provider>;
};

export const useIPFSContext = () => {
  const context = useContext(IPFSContext);
  if (!context) {
    throw new Error('useIPFSContext must be used within an IPFSProvider');
  }
  return context;
};
