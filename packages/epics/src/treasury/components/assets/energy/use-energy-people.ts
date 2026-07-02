'use client';

import React from 'react';
import useSWR from 'swr';

export type EnergyPerson = {
  slug: string;
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  address?: string | null;
};

export type EnergyPeopleMap = Record<string, EnergyPerson | null>;

/**
 * Resolves a set of wallet addresses to Hypha profiles via
 * `/api/v1/people/by-web3-address/:address`. Returns a lowercase-address →
 * profile map (or `null` when the address has no linked profile yet).
 */
export const useEnergyPeople = (
  addresses: string[],
): {
  people: EnergyPeopleMap;
  isLoading: boolean;
} => {
  const normalized = React.useMemo(
    () =>
      Array.from(
        new Set(addresses.map((a) => a?.toLowerCase()).filter(Boolean)),
      ) as string[],
    [addresses],
  );

  const key = normalized.length ? ['energy-people', ...normalized] : null;

  const { data, isLoading } = useSWR(
    key,
    async () => {
      const entries = await Promise.all(
        normalized.map(async (address) => {
          try {
            const res = await fetch(
              `/api/v1/people/by-web3-address/${address}`,
            );
            if (!res.ok) return [address, null] as const;
            const person = (await res.json()) as EnergyPerson | null;
            return [address, person && person.slug ? person : null] as const;
          } catch {
            return [address, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as EnergyPeopleMap;
    },
    { revalidateOnFocus: false },
  );

  return { people: data ?? {}, isLoading };
};
