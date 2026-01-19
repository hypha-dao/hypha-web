import { Locale } from '@hypha-platform/i18n';
import { Text } from '@radix-ui/themes';
import { MarkdownSuspense, Separator, Skeleton } from '@hypha-platform/ui';
import { formatDate } from '@hypha-platform/ui-utils';
import { Coherence } from '@hypha-platform/core/server';
import { ChatRoom } from './chat-room';
import { ChatHead } from './chat-head';
import { ButtonClose } from '../../common';
import { CreatorType } from '../../proposals';

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
    <div className="flex flex-col gap-5">
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
  );
};
