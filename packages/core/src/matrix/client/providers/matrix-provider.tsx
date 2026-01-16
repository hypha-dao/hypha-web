'use client';

import React from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { useAuthentication } from '@hypha-platform/authentication';
import { MatrixTokenData, useMatrixToken } from '../hooks';

interface MatrixContextType {
  client: MatrixSdk.MatrixClient | null;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const MatrixContext = React.createContext<MatrixContextType | null>(null);

interface MatrixProviderProps {
  children: React.ReactNode;
}

export const MatrixProvider: React.FC<MatrixProviderProps> = ({ children }) => {
  const { user } = useAuthentication();
  const [client, setClient] = React.useState<MatrixSdk.MatrixClient | null>(
    null,
  );
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const {
    matrixToken,
    isLoading: isMatrixTokenLoading,
    error: matrixTokenError,
  } = useMatrixToken();

  const initalizeMatrixClient = React.useCallback(
    async (matrixToken: MatrixTokenData) => {
      if (!matrixToken) {
        return;
      }
      try {
        console.log('Matrix token:', matrixToken);
        const { accessToken, userId, homeserverUrl, deviceId } = matrixToken;
        const matrixClient = MatrixSdk.createClient({
          baseUrl: homeserverUrl,
          accessToken,
          userId,
          deviceId,
        });

        await matrixClient.startClient();

        setClient(matrixClient);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to initialize Matrix client:', error);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (client) {
      //NOTE: already initialized
      return;
    }
    if (isMatrixTokenLoading) {
      return;
    }
    if (matrixTokenError) {
      console.warn('Cannot initialize client due error:', matrixTokenError);
      return;
    }
    initalizeMatrixClient(matrixToken!);
  }, [user, matrixToken, isMatrixTokenLoading, matrixTokenError]);

  const value: MatrixContextType = {
    client,
    isAuthenticated,
    login: async () => {
      console.log('login');
    },
    logout: async () => {
      console.log('logout');
    },
  };
  return (
    <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>
  );
};

export const useMatrix = () => {
  const context = React.useContext(MatrixContext);
  if (!context) {
    throw new Error('useMatrix must be used within MatrixProvider');
  }
  return context;
};

export const RoomEvent = MatrixSdk.RoomEvent;
export const EventType = MatrixSdk.EventType;
export const MsgType = MatrixSdk.MsgType;
export const RoomPreset = MatrixSdk.Preset;
