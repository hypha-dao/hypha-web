'use client';

import {
  getDelegators,
  Person,
  publicClient,
  useDelegatesForSpaces,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { useMemo } from 'react';
import useSWR from 'swr';

import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import type { UseMembers } from './types';

function normalizeAddress(address: string | undefined | null): string | null {
  const trimmed = address?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

async function fetchPersonByWeb3Address(
  address: string,
): Promise<Person | null> {
  const res = await fetch(
    `/api/v1/people/by-web3-address/${encodeURIComponent(address)}`,
  );
  if (!res.ok) return null;
  const person = (await res.json()) as Person;
  return person?.id ? person : null;
}

/**
 * On-chain space members plus valid delegates (delegator is an on-chain member).
 * Same population allowed to interact in space chat — excludes Matrix room joiners
 * who are not members or delegates.
 */
export function useSpaceMembersAndDelegates({
  spaceSlug,
  web3SpaceId,
  useMembers,
  refreshInterval,
}: {
  spaceSlug?: string;
  web3SpaceId?: number | null;
  useMembers: UseMembers;
  refreshInterval?: number;
}) {
  const { persons, isLoading: isLoadingMembers } = useMembers({
    spaceSlug,
    paginationDisabled: true,
    refreshInterval,
  });

  const memberPersons = persons?.data ?? [];

  const effectiveWeb3SpaceId =
    typeof web3SpaceId === 'number' &&
    Number.isFinite(web3SpaceId) &&
    web3SpaceId > 0
      ? web3SpaceId
      : undefined;

  const {
    data: delegateAddresses,
    isLoading: isLoadingDelegateAddresses,
    error: delegateAddressesError,
  } = useDelegatesForSpaces({
    spaceId: effectiveWeb3SpaceId ? BigInt(effectiveWeb3SpaceId) : undefined,
  });

  const {
    spaceDetails,
    isLoading: isLoadingSpaceDetails,
    error: spaceDetailsError,
  } = useSpaceDetailsWeb3Rpc({
    spaceId: effectiveWeb3SpaceId,
  });

  const onChainMemberAddressSet = useMemo(() => {
    const set = new Set<string>();
    for (const member of spaceDetails?.members ?? []) {
      const normalized = normalizeAddress(member);
      if (normalized) set.add(normalized);
    }
    return set;
  }, [spaceDetails?.members]);

  const onChainMembersCacheKey = useMemo(
    () => [...onChainMemberAddressSet].sort().join('\u0000'),
    [onChainMemberAddressSet],
  );

  const memberPersonIds = useMemo(
    () => new Set(memberPersons.map((person) => person.id)),
    [memberPersons],
  );

  const memberPersonIdsCacheKey = useMemo(
    () => [...memberPersonIds].sort((a, b) => a - b).join(','),
    [memberPersonIds],
  );

  const memberAddressSet = useMemo(() => {
    const set = new Set<string>();
    for (const person of memberPersons) {
      const normalized = normalizeAddress(person.address);
      if (normalized) set.add(normalized);
    }
    return set;
  }, [memberPersons]);

  const extraDelegateAddresses = useMemo(() => {
    if (!delegateAddresses?.length) return [];
    const out: string[] = [];
    for (const delegate of delegateAddresses) {
      const normalized = normalizeAddress(delegate);
      if (!normalized || memberAddressSet.has(normalized)) continue;
      out.push(normalized);
    }
    return out;
  }, [delegateAddresses, memberAddressSet]);

  const delegatePersonsKey =
    effectiveWeb3SpaceId && extraDelegateAddresses.length > 0
      ? [
          'spaceDelegatePersons',
          effectiveWeb3SpaceId,
          extraDelegateAddresses.join('\u0000'),
          onChainMembersCacheKey,
          memberPersonIdsCacheKey,
        ]
      : null;

  const {
    data: delegatePersons,
    isLoading: isLoadingDelegatePersons,
    error: delegatePersonsError,
  } = useSWR(
    delegatePersonsKey,
    async () => {
      if (!effectiveWeb3SpaceId) return [];
      const spaceId = BigInt(effectiveWeb3SpaceId);
      const resolved: Person[] = [];

      await Promise.all(
        extraDelegateAddresses.map(async (address) => {
          try {
            const delegators = await publicClient.readContract(
              getDelegators({
                user: address as `0x${string}`,
                spaceId,
              }),
            );
            const isValidDelegate = delegators.some((delegator) => {
              const normalized = normalizeAddress(delegator);
              return normalized
                ? onChainMemberAddressSet.has(normalized)
                : false;
            });
            if (!isValidDelegate) return;

            const person = await fetchPersonByWeb3Address(address);
            if (person && !memberPersonIds.has(person.id)) {
              resolved.push(person);
            }
          } catch (error) {
            console.warn(
              '[useSpaceMembersAndDelegates] delegate lookup failed',
              address,
              error,
            );
          }
        }),
      );

      return resolved;
    },
    { revalidateOnFocus: true },
  );

  const personsList = useMemo(() => {
    const byId = new Map<number, Person>();
    for (const person of memberPersons) {
      byId.set(person.id, person);
    }
    for (const person of delegatePersons ?? []) {
      if (!byId.has(person.id)) {
        byId.set(person.id, person);
      }
    }
    return [...byId.values()].sort((a, b) =>
      personRosterDisplayLabel(a, '').localeCompare(
        personRosterDisplayLabel(b, ''),
        undefined,
        { sensitivity: 'base' },
      ),
    );
  }, [memberPersons, delegatePersons]);

  const error =
    delegateAddressesError ?? spaceDetailsError ?? delegatePersonsError;

  return {
    persons: personsList,
    isLoading:
      isLoadingMembers ||
      isLoadingDelegateAddresses ||
      isLoadingSpaceDetails ||
      isLoadingDelegatePersons,
    error,
  };
}
