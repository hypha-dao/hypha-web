'use client';

import { Separator } from '@hypha-platform/ui';
import { ChatMessage } from './chat-message';
import { Message } from '@hypha-platform/core/client';

type ChatMessageContainerProps = {
  messages: Message[];
  isLoading: boolean;
  togglePinnedMessage: (messageId: string) => Promise<void>;
};

export const ChatMessageContainer = ({
  messages,
  isLoading,
  togglePinnedMessage,
}: ChatMessageContainerProps) => {
  return (
    <div className="w-full h-full flex-col">
      {isLoading ? (
        <>
          <ChatMessage
            message={{ id: '', content: '', sender: '', timestamp: new Date() }}
            isLoading={true}
            togglePinnedMessage={() => Promise.resolve()}
          />
          <Separator />
          <ChatMessage
            message={{ id: '', content: '', sender: '', timestamp: new Date() }}
            isLoading={true}
            togglePinnedMessage={() => Promise.resolve()}
          />
          <Separator />
          <ChatMessage
            message={{ id: '', content: '', sender: '', timestamp: new Date() }}
            isLoading={true}
            togglePinnedMessage={() => Promise.resolve()}
          />
        </>
      ) : (
        messages.map((msg, index) => (
          <div key={msg.id} className="w-full">
            {index !== 0 && <Separator />}
            <ChatMessage
              message={msg}
              isLoading={false}
              togglePinnedMessage={togglePinnedMessage}
            />
          </div>
        ))
      )}
    </div>
  );
};
