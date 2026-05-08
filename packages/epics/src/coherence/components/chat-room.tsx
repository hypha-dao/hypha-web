'use client';

import {
  Message,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMatrix,
} from '@hypha-platform/core/client';
import React from 'react';
import { ChatMessageContainer } from './chat-message.container';
import { MarkdownSuspense, Separator } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: 'smooth' });
};

export const ChatRoom = ({
  roomId,
  isLoading,
  slug,
  signalDescription,
  messages,
  toggleChatPinnedMessage,
}: {
  roomId: string;
  isLoading: boolean;
  slug: string;
  signalDescription?: string | null;
  messages: Message[];
  toggleChatPinnedMessage: (messageId: string) => Promise<void>;
}) => {
  const t = useTranslations('CoherenceTab');
  const { isMatrixAvailable } = useMatrix();
  const { jwt: authToken } = useJwt();
  const bottomId = React.useId();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const hasLoadedMessagesRef = React.useRef(false);
  const descriptionText = signalDescription?.trim() ?? '';

  React.useEffect(() => {
    if (!isMatrixAvailable || !roomId || !slug || isLoading) {
      return;
    }
    // Avoid clobbering persisted counts with transient empty timeline snapshots.
    if (!hasLoadedMessagesRef.current && messages.length === 0) return;
    hasLoadedMessagesRef.current = true;
    updateCoherenceBySlug({ slug, messages: messages.length }).catch(
      (error) => {
        console.warn('Error due update conversation:', error);
      },
    );
  }, [
    isMatrixAvailable,
    roomId,
    messages,
    slug,
    updateCoherenceBySlug,
    isLoading,
  ]);

  React.useEffect(() => {
    if (!isMatrixAvailable || !messages) {
      return;
    }
    scrollToSection(`message-list-bottom-${bottomId}`);
  }, [isMatrixAvailable, messages.length, bottomId]);

  return (
    <div className="flex flex-col">
      {descriptionText ? (
        <div className="w-full">
          <div className="my-3 rounded-lg border border-border/70 bg-background-3/60 px-3 py-2">
            <p className="mb-1 text-1 font-medium text-neutral-10">
              {t('description')}
            </p>
            <div className="text-1 text-neutral-11">
              <MarkdownSuspense>{descriptionText}</MarkdownSuspense>
            </div>
          </div>
          {messages.length > 0 ? <Separator /> : null}
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
