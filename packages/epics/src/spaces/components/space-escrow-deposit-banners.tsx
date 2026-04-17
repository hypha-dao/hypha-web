'use client';

import React from 'react';
import {
  useSpaceDetailsWeb3Rpc,
  usePendingEscrowDeposits,
  useSpaceExchangeDepositAgreements,
} from '@hypha-platform/core/client';
import { useSpaceMember } from '../hooks';
import { SpaceEscrowDepositBanner } from './space-escrow-deposit-banner';

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
  const executorAddress = spaceDetails?.executor as `0x${string}` | undefined;
  const { isMember } = useSpaceMember({
    spaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
  });
  const { pendingDeposits, refresh } = usePendingEscrowDeposits({
    user: executorAddress,
  });
  const {
    escrowIds: escrowIdsWithOpenProposal,
    refresh: refreshDepositAgreements,
  } = useSpaceExchangeDepositAgreements(spaceDbId);

  const existingProposalEscrowIds = React.useMemo(
    () => new Set(escrowIdsWithOpenProposal),
    [escrowIdsWithOpenProposal],
  );

  /**
   * Hide a banner as soon as there is a matching Exchange-Deposit agreement
   * for the escrow. This prevents the "click → proposal created → banner
   * still there → click again = duplicate" race the user hit.
   */
  const visibleDeposits = React.useMemo(
    () =>
      pendingDeposits.filter(
        (deposit) =>
          !existingProposalEscrowIds.has(deposit.escrowId.toString()),
      ),
    [existingProposalEscrowIds, pendingDeposits],
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
        />
      ))}
    </div>
  );
};
