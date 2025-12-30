'use client';

import React from 'react';
import { Coherence } from '../types';
import useSWR from 'swr';
import { MOCK_RECORDS } from './use-coherence-records';

type UseConversationProps = {
  chatId: string;
};

export const useConversation = ({ chatId }: UseConversationProps) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadConversation = async (chatId: string): Promise<Coherence> => {
    const record = MOCK_RECORDS.find((rec) => rec.roomId === chatId);
    if (!record) {
      throw new Error('Chat not found');
    }
    return record;
  };

  const { data: conversation } = useSWR(
    [chatId, 'loadConversation'],
    async ([chatId]) => {
      setIsLoading(true);
      try {
        return await loadConversation(chatId);
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
