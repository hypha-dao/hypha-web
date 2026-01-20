'use client';

import { EventType, RoomEvent, useMatrix } from '@hypha-platform/core/client';
import React from 'react';
import { Message } from '../types';
import { ChatMessageContainer } from './chat-message.container';

export const ChatRoom = ({
  roomId,
  isLoading,
}: {
  roomId: string;
  isLoading: boolean;
}) => {
  const { client } = useMatrix();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = React.useState(false);

  React.useEffect(() => {
    if (!client) {
      console.log('Matrix client is not initialized');
      return;
    }

    const onRoomTimeline = async (event: any) => {
      if (
        event.getRoomId() === roomId &&
        event.getType() === EventType.RoomMessage
      ) {
        setIsMessagesLoading(true);
        setMessages((prev) => [
          ...prev,
          {
            id: event.getId(),
            sender: event.getSender(),
            content: event.getContent().body,
            timestamp: new Date(event.getTs()),
          },
        ]);
        setIsMessagesLoading(false);
      }
    };

    client.addListener(RoomEvent.Timeline, onRoomTimeline);

    const room = client.getRoom(roomId);
    if (room) {
      setIsMessagesLoading(true);
      setMessages(
        room
          .getLiveTimeline()
          .getEvents()
          .filter((event) => event.getType() === EventType.RoomMessage)
          .map((event) => ({
            id: event.getId()!,
            sender: event.getSender()!,
            content: event.getContent().body,
            timestamp: new Date(event.getTs()),
          })),
      );
      setIsMessagesLoading(false);
    }

    return () => {
      client.removeListener(RoomEvent.Timeline, onRoomTimeline);
    };
  }, [client, roomId]);

  return (
    <div className="flex flex-col">
      <ChatMessageContainer
        messages={messages}
        isLoading={isLoading || isMessagesLoading}
      />
    </div>
  );
};
