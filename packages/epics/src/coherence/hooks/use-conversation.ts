'use client';

import React from 'react';
import useSWR from 'swr';
import { getCoherenceBySlug } from '../../../../core/src/coherence/server/web3';

type UseConversationProps = {
  chatId: string;
};

export const useConversation = ({ chatId }: UseConversationProps) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { data: conversation } = useSWR(
    [chatId, 'loadConversation'],
    async ([chatId]) => {
      setIsLoading(true);
      try {
        return await getCoherenceBySlug({ slug: chatId });
      } catch (error) {
        setError(error instanceof Error ? error.message : `${error}`);
      } finally {
        setIsLoading(false);
      }
    },
  );

  return {
    conversation,
    isLoading,
    error,
  };
};
