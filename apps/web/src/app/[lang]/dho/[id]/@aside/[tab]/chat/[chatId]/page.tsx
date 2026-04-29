'use client';

import {
  ChatDetail,
  ChatPageParams,
  SidePanel,
  useConversation,
} from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { getDhoPathCoherence } from '../../../../@tab/coherence/constants';
import { usePersonById } from '@hypha-platform/core/client';

export default function ChatPage() {
  const { lang, id: spaceId, chatId } = useParams<ChatPageParams>();
  const {
    conversation,
    isLoading: isConversationLoading,
    error,
  } = useConversation({
    chatId,
  });
  const { isLoading: isPersonLoading, person: creator } = usePersonById({
    id: conversation?.creatorId,
  });

  const closeUrl = getDhoPathCoherence(lang, spaceId);

  return (
    <SidePanel>
      {error ? (
        <div className="text-error">{error}</div>
      ) : (
        <ChatDetail
          creator={{
            avatar: creator?.avatarUrl || '',
            name: creator?.name || '',
            surname: creator?.surname || '',
            address: creator?.address || '',
          }}
          isLoading={isConversationLoading || isPersonLoading}
          conversation={conversation}
          closeUrl={closeUrl}
        />
      )}
    </SidePanel>
  );
}
