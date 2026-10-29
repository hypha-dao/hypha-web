'use client';

import React from 'react';
import useSWR from 'swr';

export type EnergyPerson = {
  id?: number;
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
 * Resolves leftover wallet addresses to Hypha profiles in one request.
 * The Energy tab prefers `participantProfiles` from `/energy` and only
 * calls this for addresses the server could not label.
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
      const res = await fetch(
        `/api/v1/people/by-web3-addresses?addresses=${normalized
          .map((address) => encodeURIComponent(address))
          .join(',')}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch energy people: ${res.status}`);
      }
      const payload = (await res.json()) as Record<string, EnergyPerson | null>;
      const result: EnergyPeopleMap = {};
      for (const address of normalized) {
        const person = payload[address] ?? null;
        result[address] = person && person.slug ? person : null;
      }
      return result;
    },
    { revalidateOnFocus: false },
  );

  return { people: data ?? {}, isLoading };
};
