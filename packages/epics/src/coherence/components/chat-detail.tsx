import { Text } from '@radix-ui/themes';
import { MarkdownSuspense, Separator, Skeleton } from '@hypha-platform/ui';
import { formatDate } from '@hypha-platform/ui-utils';
import { Coherence } from '@hypha-platform/core/server';
import { ChatRoom } from './chat-room';
import { ChatHead } from './chat-head';
import { ButtonClose } from '../../common';
import { CreatorType } from '../../proposals';
import { ChatMessageInput } from './chat-message-input';

type ChatDetailProps = {
  closeUrl: string;
  creator?: CreatorType;
  conversation?: Coherence;
  isLoading: boolean;
};

export const ChatDetail = ({
  closeUrl,
  creator,
  conversation,
  isLoading,
}: ChatDetailProps) => {
  return (
    <div className="relative w-full h-full">
      <div className="flex flex-col gap-5 pb-[70px]">
        <div className="flex gap-2 justify-between">
          <ChatHead
            creator={creator}
            isLoading={isLoading}
            createDate={formatDate(conversation?.createdAt ?? new Date(), true)}
          />
          <div></div>
          <ButtonClose closeUrl={closeUrl} />
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <Skeleton width="80px" height="16px" loading={isLoading}>
            <Text className="text-3">{conversation?.title}</Text>
          </Skeleton>
          <Skeleton width="80px" height="16px" loading={isLoading}>
            <MarkdownSuspense>{conversation?.description}</MarkdownSuspense>
          </Skeleton>
        </div>
        <Separator />
        <ChatRoom roomId={conversation?.roomId ?? ''} isLoading={isLoading} />
      </div>
      <div className="fixed bottom-0 right-4 pt-1 pl-4 md:pl-7 pr-4 md:pr-9 pb-4 md:pb-7 w-full md:w-[calc(var(--spacing-container-sm)_-_var(--spacing)_*_4)] bg-neutral-2 z-100">
        <ChatMessageInput roomId={conversation?.roomId ?? ''} />
      </div>
    </div>
  );
};
