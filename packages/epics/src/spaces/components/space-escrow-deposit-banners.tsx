'use client';

import React from 'react';
import {
  useMe,
  useSpaceDetailsWeb3Rpc,
  usePendingEscrowDeposits,
  useSpaceExchangeDepositAgreements,
} from '@hypha-platform/core/client';
import { useSpaceMember } from '../hooks';
import { SpaceEscrowDepositBanner } from './space-escrow-deposit-banner';

/** Per-user/per-space localStorage key for dismissed banners. */
const dismissedKey = (spaceDbId: number, userKey: string) =>
  `hypha:space-escrow-banner-dismissed:${spaceDbId}:${userKey}`;

/**
 * Reads dismissed escrow ids from localStorage. Falls back to an empty
 * Set when storage is unavailable (e.g. SSR / privacy mode). Returns
 * a fresh Set every call so callers can safely mutate.
 */
const readDismissed = (key: string | null): Set<string> => {
  if (!key || typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
};

const writeDismissed = (key: string | null, ids: Set<string>) => {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* swallow quota / privacy errors */
  }
};

type Props = {
  web3SpaceId?: number | null;
  /** Postgres DB id of the space — used as `spaceId` on the linked web2 agreement. */
  spaceDbId: number;
  /** Dho URL slug for navigation back to agreements after proposal creation. */
  spaceSlug: string;
  /** Locale prefix for navigation (e.g. `en`). */
  lang: string;
};

/**
 * Renders a banner for every open escrow where THIS space (its executor) is
 * the pending depositor — the counterparty-side of a space↔space exchange,
 * or a space that is on the receiving end of an inbound exchange proposal.
 *
 * Only shown to current members of the space, who have the standing to create
 * the follow-up deposit proposal.
 */
export const SpaceEscrowDepositBanners = ({
  web3SpaceId,
  spaceDbId,
  spaceSlug,
  lang,
}: Props) => {
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId ?? null,
  });
  const executorAddress: `0x${string}` | undefined = (() => {
    const raw = spaceDetails?.executor;
    if (typeof raw === 'string' && /^0x[a-fA-F0-9]{40}$/.test(raw)) {
      return raw as `0x${string}`;
    }
    return undefined;
  })();
  const { isMember } = useSpaceMember({
    spaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
  });
  const { person } = useMe();
  const shouldFetchDeposits = isMember && typeof web3SpaceId === 'number' && !!executorAddress;
  const { pendingDeposits, refresh } = usePendingEscrowDeposits({
    user: shouldFetchDeposits ? executorAddress : undefined,
  });
  const {
    escrowIds: escrowIdsWithOpenProposal,
    refresh: refreshDepositAgreements,
  } = useSpaceExchangeDepositAgreements(spaceDbId);

  const existingProposalEscrowIds = React.useMemo(
    () => new Set(escrowIdsWithOpenProposal),
    [escrowIdsWithOpenProposal],
  );

  // Per-user dismiss key (banner is local-only — does not affect other
  // members of the space). Falls back to a shared 'guest' key if there is
  // no logged-in person yet, which is fine because non-members never see
  // banners anyway (`!isMember` guard below).
  const userDismissKey = person?.slug ?? 'guest';
  const storageKey = React.useMemo(
    () => dismissedKey(spaceDbId, userDismissKey),
    [spaceDbId, userDismissKey],
  );
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  // Hydrate after mount to avoid SSR/client mismatch and to react to
  // sign-in/out swapping the storage key.
  React.useEffect(() => {
    setDismissedIds(readDismissed(storageKey));
  }, [storageKey]);

  const handleDismiss = React.useCallback(
    (escrowId: string) => {
      setDismissedIds((prev) => {
        if (prev.has(escrowId)) return prev;
        const next = new Set(prev);
        next.add(escrowId);
        writeDismissed(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  /**
   * Hide a banner as soon as there is a matching Exchange-Deposit agreement
   * for the escrow. This prevents the "click → proposal created → banner
   * still there → click again = duplicate" race the user hit. Also drop
   * banners the current user has explicitly dismissed via the X button.
   */
  const visibleDeposits = React.useMemo(
    () =>
      pendingDeposits.filter((deposit) => {
        const id = deposit.escrowId.toString();
        if (existingProposalEscrowIds.has(id)) return false;
        if (dismissedIds.has(id)) return false;
        return true;
      }),
    [existingProposalEscrowIds, pendingDeposits, dismissedIds],
  );

  if (!isMember) return null;
  if (!executorAddress || typeof web3SpaceId !== 'number') return null;
  if (visibleDeposits.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {visibleDeposits.map((deposit) => (
        <SpaceEscrowDepositBanner
          key={deposit.escrowId.toString()}
          deposit={deposit}
          web3SpaceId={web3SpaceId}
          spaceDbId={spaceDbId}
          spaceSlug={spaceSlug}
          lang={lang}
          onProposalCreated={() => {
            refresh();
            refreshDepositAgreements();
          }}
          onDismiss={() => handleDismiss(deposit.escrowId.toString())}
        />
      ))}
    </div>
  );
};