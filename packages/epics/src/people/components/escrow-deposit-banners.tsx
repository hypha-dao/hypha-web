'use client';

import React from 'react';
import { useMe, usePendingEscrowDeposits } from '@hypha-platform/core/client';
import { EscrowDepositBanner } from './escrow-deposit-banner';

type Props = {
  /** Slug of the profile currently being viewed — banners only render on your own profile. */
  personSlug: string;
  /** Address of the person whose profile is displayed (the banner's partyB). */
  personAddress?: `0x${string}` | null;
};

export const EscrowDepositBanners = ({ personSlug, personAddress }: Props) => {
  const { isMe } = useMe();
  const viewingOwnProfile = isMe(personSlug);
  const { pendingDeposits, refresh } = usePendingEscrowDeposits({
    user: viewingOwnProfile && personAddress ? personAddress : undefined,
  });

  if (!viewingOwnProfile || pendingDeposits.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {pendingDeposits.map((deposit) => (
        <EscrowDepositBanner
          key={deposit.escrowId.toString()}
          deposit={deposit}
          onDeposited={() => refresh()}
          onRefused={() => refresh()}
        />
      ))}
    </div>
  );
};
