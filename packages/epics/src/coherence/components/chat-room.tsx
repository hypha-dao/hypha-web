'use client';

import {
  EventType,
  MsgType,
  RoomEvent,
  useMatrix,
} from '@hypha-platform/core/client';
import { Button, Input, ScrollArea, Separator } from '@hypha-platform/ui';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import React from 'react';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
}

export const ChatRoom = ({ roomId }: { roomId: string }) => {
  const { client } = useMatrix();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');

  React.useEffect(() => {
    if (!client) {
      console.log('Matric client is not initialized');
      return;
    }

    const onRoomTimeline = async (event: any) => {
      if (
        event.getRoomId() === roomId &&
        event.getType() === EventType.RoomMessage
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id: event.getId(),
            sender: event.getSender(),
            content: event.getContent().body,
            timestamp: new Date(event.getTs()),
          },
        ]);
      }
    };

    client.addListener(RoomEvent.Timeline, onRoomTimeline);

    const room = client.getRoom(roomId);
    if (room) {
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
    }

    return () => {
      client.removeListener(RoomEvent.Timeline, onRoomTimeline);
    };
  }, [client, roomId]);

  const sendMessage = React.useCallback(async () => {
    if (!client || !input.trim()) {
      return;
    }

    if (roomId) {
      await client.sendEvent(roomId, EventType.RoomMessage, {
        msgtype: MsgType.Text,
        body: input,
      });
    }

    setInput('');
  }, [client, input, roomId]);

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex grow">
        <ScrollArea>
          {messages.map((msg) => (
            <div key={msg.id} className="mb-3">
              <div className="text-sm font-medium">{msg.sender}</div>
              <div className="text-gray-700">{msg.content}</div>
            </div>
          ))}
        </ScrollArea>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div className="flex flex-grow text-1 text-neutral-11 gap-3">
          <Button
            variant="outline"
            colorVariant="neutral"
            className="bg-transparent text-neutral-11"
            onClick={(e) => {
              console.log('Archive Conversation clicked');
              //TODO
            }}
          >
            Archive Conversation
          </Button>
          <Button
            variant="outline"
            colorVariant="accent"
            className="grow"
            onClick={(e) => {
              console.log('Propose Agreement clicked');
              //TODO
            }}
          >
            Propose Agreement
          </Button>
        </div>
        <div className="w-full space-y-2">
          <div className="flex flex-grow text-1 text-neutral-11">
            <Input
              className="w-full"
              placeholder="Say something..."
              value={input}
              rightIcon={
                <Button
                  variant="ghost"
                  colorVariant="neutral"
                  className="w-6 h-6 p-0 pointer-events-auto!"
                  onClick={(e) => {
                    sendMessage();
                  }}
                >
                  <PaperPlaneIcon />
                </Button>
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendMessage();
                }
              }}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
