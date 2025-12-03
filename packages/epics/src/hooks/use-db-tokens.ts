'use client';

import React from 'react';
import useSWR from 'swr';

type Token = {
  id: number;
  spaceId: number;
  agreementId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  type: 'utility' | 'credits' | 'ownership' | 'voice' | 'impact';
  iconUrl?: string;
  transferable: boolean;
  isVotingToken: boolean;
  decayInterval?: number;
  decayPercentage?: number;
  createdAt: Date;
  documentCount: number;
  address?: string;
  referenceCurrency?: string | null;
  referencePrice?: number | null;
};

type UseDbTokensReturn = {
  tokens: Token[];
  isLoading: boolean;
  refetchDbTokens: () => void;
};

type UseDbTokensProps = {
  search?: string;
};

export const useDbTokens = ({
  search,
}: UseDbTokensProps = {}): UseDbTokensReturn => {
  const endpoint = React.useMemo(() => {
    const base = '/api/v1/tokens';
    return search ? `${base}?search=${encodeURIComponent(search)}` : base;
  }, [search]);

  const {
    data: tokens,
    isLoading,
    mutate,
  } = useSWR([endpoint], ([endpoint]) =>
    fetch(endpoint).then((res) => {
      if (!res.ok) {
        throw new Error('Failed to fetch tokens');
      }
      return res.json();
    }),
  );

  return { tokens: tokens || [], isLoading, refetchDbTokens: mutate };
};
