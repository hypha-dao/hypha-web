'use client';

import { Message, useMatrix } from '@hypha-platform/core/client';
import React from 'react';
import { ChatMessageContainer } from './chat-message.container';

export const ChatRoom = ({
  roomId,
  isLoading,
}: {
  roomId: string;
  isLoading: boolean;
}) => {
  const {
    isMatrixAvailable,
    getRoomMessages,
    registerRoomListener,
    unregisterRoomListerner,
  } = useMatrix();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isMatrixAvailable) {
      console.log('Matrix client is not initialized');
      return;
    }

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

    return () => {
      unregisterRoomListerner(roomId);
    };
  }, [isMatrixAvailable, roomId]);

  return (
    <div className="flex flex-col">
      <ChatMessageContainer
        messages={messages}
        isLoading={isLoading || isMessagesLoading}
      />
    </div>
  );
};
