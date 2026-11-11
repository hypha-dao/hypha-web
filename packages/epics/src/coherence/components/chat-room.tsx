'use client';

import {
  Message,
  RoomEvent,
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
  const persistedCountRef = React.useRef<number | null>(null);
  const descriptionText = signalDescription?.trim() ?? '';

  React.useEffect(() => {
    hasLoadedMessagesRef.current = false;
    persistedCountRef.current = null;
  }, [roomId, slug]);

  React.useEffect(() => {
    if (!isMatrixAvailable || !roomId || !slug || isLoading || !client) {
      return;
    }
    let cancelled = false;
    const persist = () => {
      if (cancelled) return;
      const discussion = readSignalRoomDiscussionCount(
        client,
        roomId,
        descriptionText,
      );
      // Scrollback can reach the room start without changing the visible
      // message length. Listen for timeline events so the stored total is
      // the full human count, not the tail that painted first.
      if (!discussion?.reachesRoomStart) return;
      if (!hasLoadedMessagesRef.current && discussion.comments === 0) return;
      if (persistedCountRef.current === discussion.comments) return;
      hasLoadedMessagesRef.current = true;
      persistedCountRef.current = discussion.comments;
      updateCoherenceBySlug({ slug, messages: discussion.comments }).catch(
        (error) => {
          if (persistedCountRef.current === discussion.comments) {
            persistedCountRef.current = null;
          }
          console.warn('Error due update conversation:', error);
        },
      );
    };
    persist();
    const onTimeline = (_event: unknown, room?: { roomId?: string }) => {
      if (room?.roomId && room.roomId !== roomId) return;
      persist();
    };
    client.on(RoomEvent.Timeline, onTimeline);
    return () => {
      cancelled = true;
      client.off(RoomEvent.Timeline, onTimeline);
    };
  }, [
    isMatrixAvailable,
    client,
    roomId,
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
