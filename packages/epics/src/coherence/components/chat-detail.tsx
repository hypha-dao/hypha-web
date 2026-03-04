'use client';

import { CreatorType } from '../../proposals/components/proposal-head';
import { ButtonClose } from '../../common';
import React from 'react';
import { MarkdownSuspense, Separator, Skeleton } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { ChatTabs } from './chat-tabs';
import { ChatMessageInput } from './chat-message-input';
import { ChatRoom } from './chat-room';
import { ChatMembers } from './chat-members';
import { ChatPins } from './chat-pins';
import {
  ChatMember,
  Coherence,
  Message,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMatrix,
} from '@hypha-platform/core/client';

export interface ChatDetailProps {
  closeUrl: string;
  creator?: CreatorType;
  conversation?: Coherence;
  isLoading: boolean;
}

export const ChatDetail = ({
  closeUrl,
  creator,
  conversation,
  isLoading,
}: ChatDetailProps) => {
  const [activeTab, setActiveTab] = React.useState('chat');
  const { jwt: authToken } = useJwt();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const [members, setMembers] = React.useState<ChatMember[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = React.useState(false);

  const {
    isMatrixAvailable,
    getRoomMessages,
    joinRoom,
    registerRoomListener,
    unregisterRoomListener,
    togglePinnedMessage,
    getRoomMembers,
  } = useMatrix();

  React.useEffect(() => {
    if (!isMatrixAvailable) {
      console.log('Matrix client is not initialized');
      return;
    }

    console.log('Conversation:', conversation);

    if (!conversation || !conversation.roomId) {
      console.log('Conversation roomId is not specified');
      return;
    }

    const register = async (roomId: string) => {
      try {
        await joinRoom(roomId);

        registerRoomListener(
          roomId,
          async (message: Message) => {
            setIsMessagesLoading(true);
            setMessages((prev) => [...prev, message]);
            const members = await getRoomMembers(roomId);
            setMembers(members);
            setIsMessagesLoading(false);
          },
          async (pinned: string[]) => {
            setIsMessagesLoading(true);
            setMessages((prev) =>
              prev.map((message) => ({
                ...message,
                pinned: pinned.includes(message.id),
              })),
            );
            setIsMessagesLoading(false);
          },
        );

        setIsMessagesLoading(true);
        const msgs = getRoomMessages(roomId);
        if (msgs) {
          setMessages(msgs);
        }
        const roomMembers = await getRoomMembers(roomId);
        setMembers(roomMembers);
        setIsMessagesLoading(false);
      } catch (error) {
        unregisterRoomListener(roomId);
        setIsMessagesLoading(false);
      }
    };

    const rootId = conversation.roomId ?? '';
    register(rootId);

    return () => {
      unregisterRoomListener(rootId);
    };
  }, [isMatrixAvailable, conversation?.roomId]);

  const toggleChatPinnedMessage = React.useCallback(
    async (messageId: string) => {
      if (!conversation) {
        return;
      }
      await togglePinnedMessage(conversation.roomId ?? '', messageId);
    },
    [conversation, togglePinnedMessage],
  );

  React.useEffect(() => {
    //TODO: improve compute views
    if (!conversation) {
      return;
    }
    const { slug, views = 0 } = conversation;
    (async (slug: string, views: number) => {
      try {
        await updateCoherenceBySlug({ slug, views: views + 1 });
      } catch (error) {
        console.error(error);
      }
    })(slug, views);
  }, [conversation]);

  return (
    <div className="relative w-full h-full">
      <div className="fixed top-9 right-0 pt-5 pb-1 pl-4 md:pl-7 pr-4 md:pr-7 w-[calc(100vw)] md:w-[calc(var(--spacing-container-sm)_-_var(--spacing-4))] h-[calc(15vh+var(--spacing-9))] max-h-[calc(15vh+var(--spacing-9))] bg-neutral-2 overflow-hidden">
        <div className="flex flex-col w-full h-full">
          <div className="flex flex-row">
            <div className="flex flex-col grow">
              <div className="flex-1 min-w-0">
                <Skeleton width="80px" height="24px" loading={isLoading}>
                  <Text className="text-5 truncate">
                    # {conversation?.title}
                  </Text>
                </Skeleton>
              </div>
              <div className="h-[calc(15vh-var(--spacing-7))] overflow-y-auto">
                <Skeleton
                  width="80px"
                  height="calc(15vh-var(--spacing-7))"
                  loading={isLoading}
                >
                  <MarkdownSuspense>
                    {conversation?.description}
                  </MarkdownSuspense>
                </Skeleton>
              </div>
            </div>
            <div className="flex flex-col">
              <ButtonClose closeUrl={closeUrl} narrow />
            </div>
          </div>
          <div className="flex flex-row w-full">
            <ChatTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
          <Separator />
        </div>
      </div>
      <div className="fixed top-[calc(var(--spacing-9)+15vh+var(--spacing-9))] right-0 bottom-24 md:bottom-29 pl-4 md:pl-7 pr-4 md:pr-7 gap-5 w-[calc(100vw)] md:w-[calc(var(--spacing-container-sm)_-_var(--spacing-4))]">
        <div className="flex flex-col w-full h-full">
          {activeTab === 'chat' && (
            <div className="w-full overflow-auto">
              <ChatRoom
                roomId={conversation?.roomId ?? ''}
                slug={conversation?.slug ?? ''}
                isLoading={isLoading || isMessagesLoading}
                messages={messages}
                toggleChatPinnedMessage={toggleChatPinnedMessage}
              />
            </div>
          )}
          {activeTab === 'members' && (
            <div className="w-full">
              <ChatMembers
                isLoading={isLoading || isMessagesLoading}
                members={members}
              />
            </div>
          )}
          {activeTab === 'pins' && (
            <div className="w-full bg-pink-600">
              <ChatPins />
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 right-0 pt-1 pl-4 md:pl-7 pr-4 md:pr-7 pb-4 md:pb-7 w-[calc(100vw)] md:w-[calc(var(--spacing-container-sm)_-_var(--spacing-4))] h-24 md:h-29 bg-neutral-2">
        <div className="flex flex-col w-full h-full">
          <ChatMessageInput
            roomId={conversation?.roomId ?? ''}
            coherenceSlug={conversation?.slug ?? ''}
            closeUrl={closeUrl}
          />
        </div>
      </div>
    </div>
  );
};
