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
  messages,
  toggleChatPinnedMessage,
}: {
  roomId: string;
  isLoading: boolean;
  slug: string;
  messages: Message[];
  toggleChatPinnedMessage: (messageId: string) => Promise<void>;
}) => {
  const { isMatrixAvailable } = useMatrix();
  const { jwt: authToken } = useJwt();
  const bottomId = React.useId();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);

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
        isLoading={isLoading}
        togglePinnedMessage={toggleChatPinnedMessage}
      />
      <div id={`message-list-bottom-${bottomId}`}></div>
    </div>
  );
};
