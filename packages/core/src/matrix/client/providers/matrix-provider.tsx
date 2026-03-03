'use client';

import React from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { useAuthentication } from '@hypha-platform/authentication';
import { MatrixTokenData, useMatrixToken } from '../hooks';
import { Message } from '../../types';

interface SendMessageInput {
  roomId: string;
  message: string;
}

export type MatrixEventListener = (
  event: MatrixSdk.MatrixEvent,
) => Promise<void>;
export type RoomMessageListener = (message: Message) => Promise<void>;

interface RoomMessageListenerRecord {
  roomId: string;
  listener: MatrixEventListener;
}

interface MatrixContextType {
  client: MatrixSdk.MatrixClient | null;
  isMatrixAvailable: boolean;
  isAuthenticated: boolean;
  createRoom: (title: string) => Promise<{ roomId: string }>;
  sendMessage: (params: SendMessageInput) => Promise<void>;
  getRoomMessages: (roomId: string) => Message[] | null;
  joinRoom: (roomId: string) => Promise<void>;
  registerRoomListener: (roomId: string, listener: RoomMessageListener) => void;
  unregisterRoomListerner: (roomId: string) => void;
  registeredRoomListeners: RoomMessageListenerRecord[];
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
  const [isMatrixAvailable, setIsMatrixAvailable] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [registeredRoomListeners, setRegisteredRoomListeners] = React.useState<
    RoomMessageListenerRecord[]
  >([]);
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
        const { accessToken, userId, homeserverUrl, deviceId } = matrixToken;
        const matrixClient = MatrixSdk.createClient({
          baseUrl: homeserverUrl,
          accessToken,
          userId,
          deviceId,
        });

        await matrixClient.startClient();

        setClient(matrixClient);
        setIsMatrixAvailable(matrixClient !== null);
        setIsAuthenticated(true);
        console.log('Matrix client initialized');
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

  const createRoom = React.useCallback(
    async (title: string) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      const { room_id: roomId } = await client.createRoom({
        preset: RoomPreset.PublicChat,
        topic: title,
      });
      return { roomId };
    },
    [client],
  );

  const sendMessage = React.useCallback(
    async ({ roomId, message }: SendMessageInput) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      if (!message.trim()) {
        return;
      }

      if (roomId) {
        await client.sendEvent(roomId, EventType.RoomMessage, {
          msgtype: MsgType.Text,
          body: message,
        });
      }
    },
    [client],
  );

  const getRoomMessages = React.useCallback(
    (roomId: string): Message[] | null => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      const messages = room
        ? room
            .getLiveTimeline()
            .getEvents()
            .filter((event) => event.getType() === EventType.RoomMessage)
            .map((event) => ({
              id: event.getId()!,
              sender: event.getSender()!,
              content: event.getContent().body,
              timestamp: new Date(event.getTs()),
            }))
        : null;
      return messages;
    },
    [client],
  );

  const joinRoom = React.useCallback(
    async (roomId: string) => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      try {
        await client.joinRoom(roomId);
      } catch (error) {
        console.warn('Cannot join to room:', error);
      }
    },
    [client],
  );

  const registerRoomListener = React.useCallback(
    (roomId: string, listener: RoomMessageListener) => {
      if (!client) {
        console.warn('Matrix client is not initialized');
        return;
      }
      unregisterRoomListerner(roomId);
      const eventListener: MatrixEventListener = async (
        event: MatrixSdk.MatrixEvent,
      ) => {
        if (
          event.getRoomId() === roomId &&
          event.getType() === EventType.RoomMessage
        ) {
          const message: Message = {
            id: event.getId()!,
            sender: event.getSender()!,
            content: event.getContent().body,
            timestamp: new Date(event.getTs()),
          };
          await listener(message);
        }
      };
      client.addListener(RoomEvent.Timeline, eventListener);
      setRegisteredRoomListeners((prev) => [
        ...prev,
        { roomId, listener: eventListener },
      ]);
    },
    [client],
  );

  const unregisterRoomListerner = React.useCallback(
    (roomId: string) => {
      if (!client) {
        console.warn('Matrix client is not initialized');
        return;
      }
      type Records = RoomMessageListenerRecord[];
      const { found, rest } = registeredRoomListeners.reduce(
        (acc, item) => {
          if (item.roomId === roomId) {
            acc.found.push(item);
          } else {
            acc.rest.push(item);
          }
          return acc;
        },
        { found: [] as Records, rest: [] as Records },
      );
      for (const item of found) {
        if (item) {
          client.removeListener(RoomEvent.Timeline, item.listener);
        }
      }
      setRegisteredRoomListeners(rest);
    },
    [registeredRoomListeners, client],
  );

  const value: MatrixContextType = {
    client,
    isMatrixAvailable,
    isAuthenticated,
    createRoom,
    sendMessage,
    getRoomMessages,
    joinRoom,
    registerRoomListener,
    unregisterRoomListerner,
    registeredRoomListeners,
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
