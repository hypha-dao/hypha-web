'use client';

import React from 'react';
import {
  useSpaceDetailsWeb3Rpc,
  usePendingEscrowDeposits,
} from '@hypha-platform/core/client';
import { useSpaceMember } from '../hooks';
import { SpaceEscrowDepositBanner } from './space-escrow-deposit-banner';

type Props = {
  web3SpaceId?: number | null;
  /** On-chain space contract address (treasury source for `transferFrom`). */
  spaceAddress?: `0x${string}` | null;
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
  spaceAddress,
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

  if (!isMember) return null;
  if (!executorAddress || typeof web3SpaceId !== 'number') return null;
  if (pendingDeposits.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {pendingDeposits.map((deposit) => (
        <SpaceEscrowDepositBanner
          key={deposit.escrowId.toString()}
          deposit={deposit}
          web3SpaceId={web3SpaceId}
          spaceAddress={spaceAddress ?? null}
          executorAddress={executorAddress}
          spaceSlug={spaceSlug}
          lang={lang}
          onProposalCreated={() => refresh()}
        />
      ))}
    </div>
  );
};
