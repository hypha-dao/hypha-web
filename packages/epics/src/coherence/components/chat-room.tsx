'use client';

import { Message, useMatrix } from '@hypha-platform/core/client';
import React from 'react';
import { ChatMessageContainer } from './chat-message.container';
import { Separator } from '@hypha-platform/ui';
import { SignalDetailMedia } from './signal-detail-media';

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: 'smooth' });
};

export const ChatRoom = ({
  isLoading,
  signalDescription,
  leadImage,
  videoUrl,
  attachments,
  messages,
  toggleChatPinnedMessage,
}: {
  roomId: string;
  isLoading: boolean;
  slug: string;
  signalDescription?: string | null;
  leadImage?: string | null;
  videoUrl?: string | null;
  attachments?: Array<{ name: string; url: string }> | null;
  messages: Message[];
  toggleChatPinnedMessage: (messageId: string) => Promise<void>;
}) => {
  const { isMatrixAvailable } = useMatrix();
  const bottomId = React.useId();
  const descriptionText = signalDescription?.trim() ?? '';

  React.useEffect(() => {
    if (!isMatrixAvailable || !messages) {
      return;
    }
    scrollToSection(`message-list-bottom-${bottomId}`);
  }, [isMatrixAvailable, messages.length, bottomId]);

  return (
    <div className="flex flex-col">
      {descriptionText || leadImage || videoUrl || attachments?.length ? (
        <div className="my-3 w-full border border-border/70 bg-background-3/60 px-3 py-3">
          <SignalDetailMedia
            leadImage={leadImage}
            videoUrl={videoUrl}
            attachments={attachments}
            description={descriptionText}
          />
          {messages.length > 0 ? <Separator className="mt-3" /> : null}
        </div>
      ) : null}
      <ChatMessageContainer
        messages={messages}
        isLoading={isLoading}
        togglePinnedMessage={toggleChatPinnedMessage}
      />
      <div id={`message-list-bottom-${bottomId}`}></div>
    </div>
  );
};
