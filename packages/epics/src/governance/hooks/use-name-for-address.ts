'use client';

import React from 'react';
import { useDbSpaces } from '../../hooks';
import { usePersonByWeb3Address } from './use-person-by-web3-address';

const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as `0x${string}`;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const shortAddress = (addr: string | undefined | null): string =>
  !addr ? '' : `${addr.slice(0, 6)}…${addr.slice(-4)}`;

type Resolved = {
  /** Friendly label: person full name, space title, or short address fallback. */
  label: string;
  /** Whether `label` came from a person, space, or fallback short-address. */
  kind: 'person' | 'space' | 'address' | 'unknown';
  /** Avatar/logo URL if available. */
  avatarUrl?: string;
};

/**
 * Resolve an EVM address into a friendly display name by checking — in order
 * — the person directory and the space directory. Falls back to the short
 * address. Empty / non-EVM input returns an empty label so callers can opt
 * out of rendering.
 *
 * Used by banners and refund rows that need to show "Acme Space has proposed
 * …" instead of "0x1234…ABCD has proposed …" without each call site having
 * to wire `usePersonByWeb3Address` + `useDbSpaces` themselves.
 */
export const useNameForAddress = (
  address: string | undefined | null,
): Resolved => {
  const isEvm = !!address && ADDRESS_RE.test(address);
  const { person } = usePersonByWeb3Address(
    isEvm ? (address as `0x${string}`) : ZERO_ADDRESS,
  );
  const { spaces: dbSpaces } = useDbSpaces({ parentOnly: false });

  return React.useMemo<Resolved>(() => {
    if (!isEvm) return { label: '', kind: 'unknown' };
    const lower = address!.toLowerCase();

    if (person) {
      const personLabel = [person.name, person.surname]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (personLabel) {
        return {
          label: personLabel,
          kind: 'person',
          avatarUrl: person.avatarUrl ?? undefined,
        };
      }
    }

    const space = dbSpaces.find((s) => s.address?.toLowerCase() === lower);
    if (space?.title?.trim()) {
      return {
        label: space.title.trim(),
        kind: 'space',
        avatarUrl: space.logoUrl ?? undefined,
      };
    }

    return { label: shortAddress(address), kind: 'address' };
  }, [address, dbSpaces, isEvm, person]);
};
