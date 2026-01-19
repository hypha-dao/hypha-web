'use client';

import { Separator } from '@hypha-platform/ui';
import { Message } from '../types';
import { ChatMessage } from './chat-message';

type ChatMessageContainerProps = {
  messages: Message[];
  isLoading: boolean;
};

export const ChatMessageContainer = ({
  messages,
  isLoading,
}: ChatMessageContainerProps) => {
  return (
    <div className="w-full h-full flex-col">
      {isLoading ? (
        <>
          <ChatMessage
            message={{ id: '', content: '', sender: '', timestamp: new Date() }}
            isLoading={true}
          />
          <Separator />
          <ChatMessage
            message={{ id: '', content: '', sender: '', timestamp: new Date() }}
            isLoading={true}
          />
          <Separator />
          <ChatMessage
            message={{ id: '', content: '', sender: '', timestamp: new Date() }}
            isLoading={true}
          />
        </>
      ) : (
        messages.map((msg, index) => (
          <>
            {index !== 0 && <Separator />}
            <ChatMessage message={msg} isLoading={false} />
          </>
        ))
      )}
    </div>
  );
};
