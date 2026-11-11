'use client';

import {
  Message,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMatrix,
} from '@hypha-platform/core/client';
import React from 'react';
import { ChatMessageContainer } from './chat-message.container';
import { Separator } from '@hypha-platform/ui';
import { SignalDetailMedia } from './signal-detail-media';
import { readSignalRoomDiscussionCount } from '../hooks/use-signal-room-activity';

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: 'smooth' });
};

export const ChatRoom = ({
  roomId,
  isLoading,
  slug,
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
  const { client, isMatrixAvailable } = useMatrix();
  const { jwt: authToken } = useJwt();
  const bottomId = React.useId();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const hasLoadedMessagesRef = React.useRef(false);
  const descriptionText = signalDescription?.trim() ?? '';

  React.useEffect(() => {
    if (!isMatrixAvailable || !roomId || !slug || isLoading) {
      return;
    }
    const discussion = readSignalRoomDiscussionCount(
      client,
      roomId,
      descriptionText,
    );
    // A partial timeline is not the comment total. Wait until it reaches the
    // room start, then store the same filtered reply count the page shows.
    if (!discussion?.reachesRoomStart) return;
    if (!hasLoadedMessagesRef.current && discussion.comments === 0) return;
    hasLoadedMessagesRef.current = true;
    updateCoherenceBySlug({ slug, messages: discussion.comments }).catch(
      (error) => {
        console.warn('Error due update conversation:', error);
      },
    );
  }, [
    isMatrixAvailable,
    client,
    roomId,
    messages.length,
    slug,
    descriptionText,
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
