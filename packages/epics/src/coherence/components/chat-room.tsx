'use client';

import {
  Message,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMatrix,
} from '@hypha-platform/core/client';
import React from 'react';
import { ChatMessageContainer } from './chat-message.container';

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: 'smooth' });
};

export const ChatRoom = ({
  roomId,
  isLoading,
  slug,
}: {
  roomId: string;
  isLoading: boolean;
  slug: string;
}) => {
  const {
    isMatrixAvailable,
    getRoomMessages,
    joinRoom,
    registerRoomListener,
    unregisterRoomListener,
  } = useMatrix();
  const { jwt: authToken } = useJwt();
  const bottomId = React.useId();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isMatrixAvailable) {
      console.log('Matrix client is not initialized');
      return;
    }

    const register = async (roomId: string) => {
      try {
        await joinRoom(roomId);

        registerRoomListener(roomId, async (message: Message) => {
          setIsMessagesLoading(true);
          setMessages((prev) => [...prev, message]);
          setIsMessagesLoading(false);
        });

        setIsMessagesLoading(true);
        const msgs = getRoomMessages(roomId);
        if (msgs) {
          setMessages(msgs);
        }
        setIsMessagesLoading(false);
      } catch (error) {
        unregisterRoomListener(roomId);
        setIsMessagesLoading(false);
      }
    };

    register(roomId);

    return () => {
      unregisterRoomListener(roomId);
    };
  }, [isMatrixAvailable, roomId]);

  React.useEffect(() => {
    if (!isMatrixAvailable || !roomId || !slug) {
      return;
    }
    updateCoherenceBySlug({ slug, messages: messages.length }).catch(
      (error) => {
        console.warn('Error due update conversation:', error);
      },
    );
  }, [isMatrixAvailable, roomId, messages, slug]);

  React.useEffect(() => {
    if (!isMatrixAvailable || !messages) {
      return;
    }
    scrollToSection(`message-list-bottom-${bottomId}`);
  }, [isMatrixAvailable, messages, bottomId]);

  return (
    <div className="flex flex-col">
      <ChatMessageContainer
        messages={messages}
        isLoading={isLoading || isMessagesLoading}
      />
      <div id={`message-list-bottom-${bottomId}`}></div>
    </div>
  );
};
