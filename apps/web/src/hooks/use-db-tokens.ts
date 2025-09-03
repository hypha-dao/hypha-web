'use client';

import React from 'react';
import useSWR from 'swr';
import { useJwt } from '@hypha-platform/core/client';

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
  const { jwt } = useJwt();

  const endpoint = React.useMemo(() => {
    const base = '/api/v1/tokens';
    return search ? `${base}?search=${encodeURIComponent(search)}` : base;
  }, [search]);

  const { data: tokens, isLoading } = useSWR(
    jwt ? [endpoint, jwt] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch tokens');
        }
        return res.json();
      }),
  );

  return { tokens: tokens || [], isLoading };
};
