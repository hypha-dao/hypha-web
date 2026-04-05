'use client';

import useSWR from 'swr';
import { getCoherenceBySlug } from '@hypha-platform/core/coherence/server/web3';

type UseConversationProps = {
  chatId: string;
};

export const useConversation = ({ chatId }: UseConversationProps) => {
  const {
    data: conversation,
    isLoading,
    error,
  } = useSWR(
    [chatId, 'loadConversation'],
    async ([chatId]) => {
      return await getCoherenceBySlug({ slug: chatId });
    },
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  return {
    conversation,
    isLoading,
    error: error ? (error instanceof Error ? error.message : `${error}`) : null,
  };
};
