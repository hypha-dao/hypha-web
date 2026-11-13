'use client';

import useSWR, { type Middleware, type SWRConfiguration } from 'swr';
import { useJwt, type MemberIntelligence } from '@hypha-platform/core/client';

import {
  useEnergyGatedSWRKey,
  useEnergyOverviewIdleGate,
} from './use-after-idle';

/** Canonical path shared by every member-intelligence SWR key. */
export const MEMBER_INTELLIGENCE_PATH = '/api/v1/people/me/intelligence';

/** User-opened Add people dialog — must not wait on the energy 7d gate. */
export const ADD_PEOPLE_DIRECTORY_KEY = 'add-people-directory';

export function isMemberIntelligenceSWRKey(key: unknown): boolean {
  if (typeof key === 'string') {
    return key.includes(MEMBER_INTELLIGENCE_PATH);
  }
  if (Array.isArray(key) && typeof key[0] === 'string') {
    return key[0].includes(MEMBER_INTELLIGENCE_PATH);
  }
  return false;
}

export function isEnergyExemptMemberIntelligenceKey(key: unknown): boolean {
  return Array.isArray(key) && key.includes(ADD_PEOPLE_DIRECTORY_KEY);
}

/**
 * Open Add people with no result yet is pending (in-flight or energy-gated
 * null key), not a load failure.
 */
export function isAddPeopleDirectoryPending(input: {
  addOpen: boolean;
  hasJwt: boolean;
  home: unknown;
  error: unknown;
}): boolean {
  return Boolean(
    input.addOpen && input.hasJwt && input.home == null && input.error == null,
  );
}

export function isAddPeopleDirectoryFailed(input: {
  addOpen: boolean;
  hasJwt: boolean;
  error: unknown;
}): boolean {
  return Boolean(input.addOpen && input.hasJwt && input.error != null);
}

/**
 * Drops every intelligence SWR key on `/energy` until 7d telemetry has
 * settled (success or retries exhausted). One middleware so a missed
 * `useEnergyGatedSWRKey` at a caller cannot race 7d. User-initiated Add
 * people is exempt.
 */
export const energyIntelligenceSWRMiddleware: Middleware = (useSWRNext) => {
  return (key, fetcher, config) => {
    const ready = useEnergyOverviewIdleGate();
    if (
      !ready &&
      isMemberIntelligenceSWRKey(key) &&
      !isEnergyExemptMemberIntelligenceKey(key)
    ) {
      return useSWRNext(null, fetcher, config);
    }
    return useSWRNext(key, fetcher, config);
  };
};

export async function fetchMemberIntelligence(
  key: readonly [string, string, ...unknown[]],
): Promise<MemberIntelligence | null> {
  const [url, token] = key;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`member-intelligence ${response.status}`);
  }
  return (await response.json()) as MemberIntelligence;
}

type MemberIntelligenceSWRConfig =
  SWRConfiguration<MemberIntelligence | null> & {
    enabled?: boolean;
  };

/**
 * Shared member-intelligence SWR. Same key as the spaces rail / directory so
 * SWR dedupes to one GET. Energy-gated until 7d settles.
 */
export function useMemberIntelligence(
  extraKey?: string | number | null,
  config?: MemberIntelligenceSWRConfig,
) {
  const { jwt } = useJwt();
  const { enabled = true, ...swrConfig } = config ?? {};
  const key = useEnergyGatedSWRKey(
    enabled && jwt
      ? extraKey != null
        ? ([MEMBER_INTELLIGENCE_PATH, jwt, extraKey] as const)
        : ([MEMBER_INTELLIGENCE_PATH, jwt] as const)
      : null,
  );
  return useSWR<MemberIntelligence | null>(
    key,
    fetchMemberIntelligence,
    swrConfig,
  );
}
