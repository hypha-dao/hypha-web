'use client';

import useSWR from 'swr';
import { Space } from '@hypha-platform/core/client';

const isEvmAddress = (value?: string): value is `0x${string}` =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

type SpaceByContractPayload = Pick<
  Space,
  'id' | 'title' | 'slug' | 'logoUrl' | 'leadImage' | 'address' | 'web3SpaceId'
>;

/**
 * Resolves a space by its on-chain contract address (public API, no auth).
 * Use when the party is a space wallet and `useDbSpaces` may not include that space.
 */
export const useSpaceByContractAddress = (
  address: string | undefined,
): { space: SpaceByContractPayload | null | undefined; isLoading: boolean } => {
  const endpoint =
    address && isEvmAddress(address)
      ? `/api/v1/spaces/by-contract-address/${address.toLowerCase()}`
      : null;

  const { data, isLoading } = useSWR<SpaceByContractPayload | null>(
    endpoint,
    async (url) => {
      const res = await fetch(url);
      if (res.status === 404) return null;
      const json = (await res.json()) as unknown;
      if (!res.ok) return null;
      if (json === null) return null;
      if (typeof json !== 'object' || !('id' in json)) return null;
      return json as SpaceByContractPayload;
    },
    { revalidateOnFocus: false },
  );

  return { space: data, isLoading };
};
