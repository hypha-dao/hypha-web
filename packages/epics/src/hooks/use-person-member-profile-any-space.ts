'use client';

import useSWR from 'swr';
import { Person } from '@hypha-platform/core/client';

const isEvmAddress = (value?: string): value is `0x${string}` =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

/**
 * Public profile for a wallet when that person is a member of any Hypha space
 * (not necessarily the current proposal space). No auth required.
 */
export const usePersonMemberProfileAnySpace = (
  address: string | undefined,
): { person: Person | null | undefined; isLoading: boolean } => {
  const endpoint =
    address && isEvmAddress(address)
      ? `/api/v1/people/by-web3-address/${address.toLowerCase()}/member-profile`
      : null;

  const { data, isLoading } = useSWR<Person | null>(
    endpoint,
    async (url) => {
      const res = await fetch(url);
      const json = (await res.json()) as unknown;
      if (!res.ok) return null;
      if (json === null) return null;
      if (typeof json !== 'object' || !('id' in json)) return null;
      return json as Person;
    },
    { revalidateOnFocus: false },
  );

  return { person: data, isLoading };
};
