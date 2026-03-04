'use client';

import { Message, useUserPrivyIdByMatrixId } from '@hypha-platform/core/client';
import { ChatPin } from './chat-pin';

export interface ChatPinsProps {
  messages: Message[];
  isLoading: boolean;
}

export const ChatPins = ({ messages, isLoading }: ChatPinsProps) => {
  const pinnedMessages = messages.filter((message) => message.pinned);
  return (
    <div>
      {pinnedMessages.map((message) => (
        <ChatPin message={message} isLoading={isLoading} />
      ))}
    </div>
  );
};
