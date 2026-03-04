import { Coherence } from '@hypha-platform/core/server';
import { CreatorType } from '../../proposals/components/proposal-head';
import { ButtonClose } from '../../common';
import React from 'react';
import { MarkdownSuspense, Skeleton } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { ChatTabs } from './chat-tabs';
import { ChatMessageInput } from './chat-message-input';
import { ChatRoom } from './chat-room';
import { ChatMembers } from './chat-members';
import { ChatPins } from './chat-pins';

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
  return (
    <div className="relative w-full h-full">
      <div className="fixed top-9 right-0 pt-5 pb-1 pl-4 md:pl-7 pr-4 md:pr-7 w-[calc(100vw)] md:w-[calc(var(--spacing-container-sm)_-_var(--spacing-4))] h-[calc(15vh+var(--spacing-7))] max-h-[calc(15vh+var(--spacing-7))] bg-neutral-2 overflow-hidden">
        <div className="flex flex-col w-full h-full bg-red-600">
          <div className="flex flex-row">
            <div className="flex flex-col grow">
              <div className="flex-1 min-w-0">
                <Skeleton width="80px" height="24px" loading={isLoading}>
                  <Text className="text-5 truncate">
                    # {conversation?.title}
                  </Text>
                </Skeleton>
              </div>
              <div className="h-[calc(15vh-var(--spacing-7))] bg-blue-600 overflow-y-auto">
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
          <div className="flex flex-row bg-fuchsia-600 h-6 w-full">
            <ChatTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </div>
      </div>
      <div className="fixed top-[calc(var(--spacing-9)+15vh+var(--spacing-8))] right-0 bottom-24 md:bottom-29 pl-4 md:pl-7 pr-4 md:pr-7 gap-5 w-[calc(100vw)] md:w-[calc(var(--spacing-container-sm)_-_var(--spacing-4))]">
        <div className="flex flex-col w-full h-full">
          {activeTab === 'chat' && (
            <div className="w-full bg-yellow-600 overflow-auto">
              <ChatRoom
                roomId={conversation?.roomId ?? ''}
                slug={conversation?.slug ?? ''}
                isLoading={isLoading}
              />
            </div>
          )}
          {activeTab === 'members' && (
            <div className="w-full bg-purple-600">
              <ChatMembers />
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
        <div className="flex flex-col w-full h-full bg-green-600">
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
