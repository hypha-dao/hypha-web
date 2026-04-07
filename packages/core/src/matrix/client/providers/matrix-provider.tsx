'use client';

import React from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { useAuthentication } from '@hypha-platform/authentication';
import { MatrixTokenData, useMatrixToken } from '../hooks';
import { Message } from '../../types';
import { attachReactionsToMessage, isValidReactionKey } from '../../reactions';
import {
  buildRichReplyPlainBody,
  messageFromRoomMessageEvent,
  resolveReplyTargetForSend,
} from '../../rich-reply';

interface SendMessageInput {
  roomId: string;
  message: string;
  /** Rich reply: target m.room.message event id (space chat; not m.thread). */
  replyToEventId?: string;
}

export interface ToggleReactionInput {
  roomId: string;
  targetEventId: string;
  key: string;
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
  toggleReaction: (params: ToggleReactionInput) => Promise<void>;
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
  const [activeMatrixUserId, setActiveMatrixUserId] = React.useState<
    string | null
  >(null);
  const registeredRoomListenersRef = React.useRef<RoomMessageListenerRecord[]>(
    [],
  );
  const [registeredRoomListeners, setRegisteredRoomListeners] = React.useState<
    RoomMessageListenerRecord[]
  >([]);
  const {
    matrixToken,
    isLoading: isMatrixTokenLoading,
    error: matrixTokenError,
  } = useMatrixToken();

  const initializeMatrixClient = React.useCallback(
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
        setActiveMatrixUserId(userId);
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
    if (!client) {
      return;
    }
    if (matrixToken && activeMatrixUserId === matrixToken.userId) {
      return;
    }

    client.stopClient();
    registeredRoomListenersRef.current = [];
    setRegisteredRoomListeners([]);
    setClient(null);
    setActiveMatrixUserId(null);
    setIsAuthenticated(false);
    setIsMatrixAvailable(false);
  }, [activeMatrixUserId, client, matrixToken]);

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
    if (!matrixToken) {
      return;
    }
    initializeMatrixClient(matrixToken);
  }, [
    matrixToken,
    isMatrixTokenLoading,
    matrixTokenError,
    initializeMatrixClient,
  ]);

  React.useEffect(() => {
    return () => {
      if (client) {
        const matrixClient = client as MatrixSdk.MatrixClient;
        matrixClient.setPresence({ presence: 'offline' });
        matrixClient.stopClient();
        setClient(null);
      }
    };
  }, [client]);

  const createRoom = React.useCallback(
    async (title: string) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      const { room_id: roomId } = await client.createRoom({
        preset: RoomPreset.PublicChat,
        name: title,
        topic: title,
      });
      return { roomId };
    },
    [client],
  );

  const toggleReaction = React.useCallback(
    async ({ roomId, targetEventId, key }: ToggleReactionInput) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      if (!isValidReactionKey(key)) {
        throw new Error('Invalid reaction key');
      }
      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      const uid = client.getUserId();
      const rel = room.relations.getChildEventsForEvent(
        targetEventId,
        MatrixSdk.RelationType.Annotation,
        MatrixSdk.EventType.Reaction,
      );
      let ownReactionEventId: string | undefined;
      if (rel && uid) {
        const byKey = rel.getSortedAnnotationsByKey();
        if (byKey) {
          for (const [k, eventSet] of byKey) {
            if (k !== key) continue;
            for (const ev of eventSet) {
              if (ev.isRedacted()) continue;
              if (ev.getSender() === uid) {
                const id = ev.getId();
                if (id) ownReactionEventId = id;
                break;
              }
            }
          }
        }
      }

      if (ownReactionEventId) {
        await client.redactEvent(roomId, ownReactionEventId);
        return;
      }

      await client.sendEvent(roomId, MatrixSdk.EventType.Reaction, {
        'm.relates_to': {
          event_id: targetEventId,
          key,
          rel_type: MatrixSdk.RelationType.Annotation,
        },
      });
    },
    [client],
  );

  const sendMessage = React.useCallback(
    async ({ roomId, message, replyToEventId }: SendMessageInput) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      if (!message.trim()) {
        return;
      }
      if (!roomId?.trim()) {
        return;
      }

      if (replyToEventId?.trim()) {
        const {
          eventId: resolvedTargetId,
          sender,
          body: targetBody,
        } = await resolveReplyTargetForSend(client, roomId, replyToEventId);
        const body = buildRichReplyPlainBody(sender, targetBody, message);
        await client.sendEvent(roomId, EventType.RoomMessage, {
          msgtype: MsgType.Text,
          body,
          'm.relates_to': {
            'm.in_reply_to': {
              event_id: resolvedTargetId,
            },
          },
        });
        return;
      }

      await client.sendEvent(roomId, EventType.RoomMessage, {
        msgtype: MsgType.Text,
        body: message,
      });
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
      const uid = client.getUserId();
      const messages = room
        ? room
            .getLiveTimeline()
            .getEvents()
            .filter((event) => event.getType() === EventType.RoomMessage)
            .filter((event) => event.getId() && event.getSender())
            .map((event) => {
              const base = messageFromRoomMessageEvent(
                client,
                roomId,
                event,
                pinned.includes(event.getId()!),
              );
              return attachReactionsToMessage(room, base, uid);
            })
        : null;
      return messages;
    },
    [client, getPinnedMessageIds],
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
        members?.map(async (member) => {
          try {
            const presence = await client.getPresence(member.userId);
            return {
              userId: member.userId,
              presence: presence.currently_active ?? false,
            } as ChatMember;
          } catch {
            return {
              userId: member.userId,
              presence: false,
            } as ChatMember;
          }
        }) ?? null;
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

  const unregisterRoomListener = React.useCallback(
    (roomId: string) => {
      if (!client) {
        console.warn('Matrix client is not initialized');
        return;
      }
      type Records = RoomMessageListenerRecord[];
      const { found, rest } = registeredRoomListenersRef.current.reduce(
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
      registeredRoomListenersRef.current = rest;
      setRegisteredRoomListeners(rest);
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
        const room = client.getRoom(roomId);
        const type = event.getType();

        if (type === EventType.RoomMessage) {
          const eventId = event.getId();
          const sender = event.getSender();
          if (!eventId || !sender) return;
          const pinnedIds = room ? getPinnedMessageIds(roomId) : [];
          let message = messageFromRoomMessageEvent(
            client,
            roomId,
            event,
            pinnedIds.includes(eventId),
          );
          if (room) {
            message = attachReactionsToMessage(
              room,
              message,
              client.getUserId(),
            );
          }
          await messageListener(message);
        } else if (type === EventType.RoomPinnedEvents) {
          const pinned = event.getContent().pinned;
          await messagePinnedListener(pinned);
        } else if (type === EventType.Reaction) {
          const targetId = event.getWireContent()?.['m.relates_to']?.[
            'event_id'
          ] as string | undefined;
          if (!targetId || !room) return;
          const targetEv = room.findEventById(targetId);
          if (!targetEv || targetEv.getType() !== EventType.RoomMessage) {
            return;
          }
          const pinnedIds = getPinnedMessageIds(roomId);
          const eventId = targetEv.getId();
          const targetSender = targetEv.getSender();
          if (!eventId || !targetSender) return;
          let message = messageFromRoomMessageEvent(
            client,
            roomId,
            targetEv,
            pinnedIds.includes(eventId),
          );
          message = attachReactionsToMessage(room, message, client.getUserId());
          await messageListener(message);
        } else if (type === EventType.RoomRedaction) {
          const redacts =
            (event.getAssociatedId() as string | undefined) ??
            (event.getContent()?.redacts as string | undefined);
          if (!redacts || !room) return;
          const redacted = room.findEventById(redacts);
          if (!redacted) return;
          if (redacted.getType() === EventType.Reaction) {
            const targetId = redacted.getWireContent()?.['m.relates_to']?.[
              'event_id'
            ] as string | undefined;
            if (!targetId) return;
            const targetEv = room.findEventById(targetId);
            if (!targetEv || targetEv.getType() !== EventType.RoomMessage) {
              return;
            }
            const pinnedIds = getPinnedMessageIds(roomId);
            const tevId = targetEv.getId();
            const tevSender = targetEv.getSender();
            if (!tevId || !tevSender) return;
            let message = messageFromRoomMessageEvent(
              client,
              roomId,
              targetEv,
              pinnedIds.includes(tevId),
            );
            message = attachReactionsToMessage(
              room,
              message,
              client.getUserId(),
            );
            await messageListener(message);
          } else if (redacted.getType() === EventType.RoomMessage) {
            const pinnedIds = getPinnedMessageIds(roomId);
            const mid = redacted.getId();
            const ms = redacted.getSender();
            if (!mid || !ms) return;
            let message = messageFromRoomMessageEvent(
              client,
              roomId,
              redacted,
              pinnedIds.includes(mid),
            );
            message = attachReactionsToMessage(
              room,
              message,
              client.getUserId(),
            );
            await messageListener(message);
          }
        }
      };
      client.addListener(RoomEvent.Timeline, eventListener);
      const newRecord = { roomId, listener: eventListener };
      registeredRoomListenersRef.current = [
        ...registeredRoomListenersRef.current,
        newRecord,
      ];
      setRegisteredRoomListeners([...registeredRoomListenersRef.current]);
    },
    [client, unregisterRoomListener, getPinnedMessageIds],
  );

  const value: MatrixContextType = {
    client,
    isMatrixAvailable,
    isAuthenticated,
    createRoom,
    sendMessage,
    toggleReaction,
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

const noopMatrixContext: MatrixContextType = {
  client: null,
  isMatrixAvailable: false,
  isAuthenticated: false,
  createRoom: async () => {
    throw new Error('Matrix unavailable');
  },
  sendMessage: async () => {
    throw new Error('Matrix unavailable');
  },
  toggleReaction: async () => {
    throw new Error('Matrix unavailable');
  },
  getRoomMessages: () => null,
  joinRoom: async () => {
    throw new Error('Matrix unavailable');
  },
  registerRoomListener: () => {},
  unregisterRoomListener: () => {},
  registeredRoomListeners: [],
  getPinnedMessageIds: () => [],
  togglePinnedMessage: async () => {},
  getRoomMembers: async () => [],
};

export const useMatrix = () => {
  const context = React.useContext(MatrixContext);
  if (!context) {
    return noopMatrixContext;
  }
  return context;
};

export const RoomEvent = MatrixSdk.RoomEvent;
export const EventType = MatrixSdk.EventType;
export const MsgType = MatrixSdk.MsgType;
export const RoomPreset = MatrixSdk.Preset;
