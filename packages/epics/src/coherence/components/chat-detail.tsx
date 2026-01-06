import { Locale } from '@hypha-platform/i18n';
import { Text } from '@radix-ui/themes';
import { ButtonClose } from '../../common';
import { MarkdownSuspense, Separator } from '@hypha-platform/ui';
import { CreatorType } from '../../proposals';
import { ChatHead } from './chat-head';
import { formatDate } from '@hypha-platform/ui-utils';
import { Coherence } from '@hypha-platform/core/server';

type ChatDetailProps = {
  closeUrl: string;
  creator?: CreatorType;
  conversation?: Coherence;
  lang: Locale;
  spaceSlug: string;
  chatSlug: string;
  isLoading: boolean;
};

export const ChatDetail = ({
  closeUrl,
  creator,
  conversation,
  lang,
  spaceSlug,
  chatSlug,
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
        <Text>{conversation?.title}</Text>
        <MarkdownSuspense>{conversation?.description}</MarkdownSuspense>
      </div>
      <Separator />
      {/* <MatrixChatIframe /> */}
    </div>
  );
};
