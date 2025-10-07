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
  type: 'utility' | 'credits' | 'ownership' | 'voice';
  iconUrl?: string;
  transferable: boolean;
  isVotingToken: boolean;
  decayInterval?: number;
  decayPercentage?: number;
  createdAt: string;
  documentCount: number;
  address?: string;
};

type UseDbTokensReturn = {
  tokens: Token[];
  isLoading: boolean;
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

  const { data: tokens, isLoading } = useSWR([endpoint], ([endpoint]) =>
    fetch(endpoint).then((res) => {
      if (!res.ok) {
        throw new Error('Failed to fetch tokens');
      }
      return res.json();
    }),
  );

  return { tokens: tokens || [], isLoading };
};
