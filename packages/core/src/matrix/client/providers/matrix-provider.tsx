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
export type RoomMessagePinnedListener = (pinned: string[]) => Promise<void>;

interface RoomMessageListenerRecord {
  roomId: string;
  listener: MatrixEventListener;
}

export interface ChatMember {
  userId: string;
  presence: boolean;
}

interface MatrixContextType {
  client: MatrixSdk.MatrixClient | null;
  isMatrixAvailable: boolean;
  isAuthenticated: boolean;
  createRoom: (title: string) => Promise<{ roomId: string }>;
  sendMessage: (params: SendMessageInput) => Promise<void>;
  getRoomMessages: (roomId: string) => Message[] | null;
  getPinnedMessageIds: (roomId: string) => string[];
  togglePinnedMessage: (roomId: string, messageId: string) => Promise<void>;
  getRoomMembers: (roomId: string) => Promise<ChatMember[]>;
  joinRoom: (roomId: string) => Promise<void>;
  registerRoomListener: (
    roomId: string,
    messageListener: RoomMessageListener,
    pinnedListener: RoomMessagePinnedListener,
  ) => void;
  unregisterRoomListener: (roomId: string) => void;
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

        await matrixClient.setPresence({ presence: 'online' });

        setClient(matrixClient);
        setIsMatrixAvailable(matrixClient !== null);
        setIsAuthenticated(true);
        console.log('Matrix client initialized');
      } catch (error) {
        console.error('Failed to initialize Matrix client:', error);
        setClient(null);
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

    return () => {
      if (client) {
        const matrixClient = client as MatrixSdk.MatrixClient;
        matrixClient.setPresence({ presence: 'offline' });
        matrixClient.stopClient();
        setClient(null);
      }
    };
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

  const getPinnedMessageIds = React.useCallback(
    (roomId: string): string[] => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const state = room
        .getLiveTimeline()
        .getState(MatrixSdk.EventTimeline.FORWARDS);

      if (!state) {
        return [];
      }

      const pinnedEvent = state.getStateEvents(EventType.RoomPinnedEvents, '');
      return pinnedEvent?.getContent()?.pinned ?? [];
    },
    [client],
  );

  const getRoomMessages = React.useCallback(
    (roomId: string): Message[] | null => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const pinned = getPinnedMessageIds(roomId);
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
              pinned: pinned.includes(event.getId()!),
            }))
        : null;
      return messages;
    },
    [client],
  );

  const togglePinnedMessage = React.useCallback(
    async (roomId: string, messageId: string) => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      try {
        const pinnedInitial = getPinnedMessageIds(roomId);
        const pinned = pinnedInitial.includes(messageId)
          ? pinnedInitial.filter((pinnedId: string) => pinnedId !== messageId)
          : [...pinnedInitial, messageId];
        await client.sendStateEvent(roomId, EventType.RoomPinnedEvents, {
          pinned,
        });
      } catch (error) {
        console.error('Cannot update pinned message:', error);
      }
    },
    [client],
  );

  const getRoomMembers = React.useCallback(
    async (roomId: string): Promise<ChatMember[]> => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      const members = room ? room.getJoinedMembers() : null;
      const memberObjects =
        members?.map(
          async (member) =>
            ({
              userId: member.userId,
              presence:
                (await client.getPresence(member.userId)).currently_active ??
                false,
            } as ChatMember),
        ) ?? null;
      return memberObjects ? await Promise.all(memberObjects) : [];
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
    (
      roomId: string,
      messageListener: RoomMessageListener,
      messagePinnedListener: RoomMessagePinnedListener,
    ) => {
      if (!client) {
        console.warn('Matrix client is not initialized');
        return;
      }
      unregisterRoomListener(roomId);
      const eventListener: MatrixEventListener = async (
        event: MatrixSdk.MatrixEvent,
      ) => {
        if (event.getRoomId() !== roomId) {
          return;
        }
        if (event.getType() === EventType.RoomMessage) {
          const message: Message = {
            id: event.getId()!,
            sender: event.getSender()!,
            content: event.getContent().body,
            timestamp: new Date(event.getTs()),
          };
          await messageListener(message);
        } else if (event.getType() === EventType.RoomPinnedEvents) {
          const pinned = event.getContent().pinned;
          await messagePinnedListener(pinned);
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

  const unregisterRoomListener = React.useCallback(
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
    getPinnedMessageIds,
    togglePinnedMessage,
    getRoomMembers,
    joinRoom,
    registerRoomListener,
    unregisterRoomListener,
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
