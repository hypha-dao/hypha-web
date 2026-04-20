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

  // Banners the user has just resolved (deposit confirmed or refused) and
  // that we've optimistically hidden while the RPC/bundler propagates the
  // new escrow state. Without this, `refresh()` can race against a bundler
  // node that hasn't yet seen the receipt, the SWR cache repopulates with
  // the still-unfunded escrow, and the banner reappears for one or two
  // poll cycles even though the user already confirmed.
  const [resolvedIds, setResolvedIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  // Poll the underlying SWR refresh until the resolved escrows actually
  // disappear from the API response, then clear them from our local
  // optimistic set. Bounded so we don't run forever on RPC outages.
  const pollUntilGone = React.useCallback(
    async (escrowId: string) => {
      const maxAttempts = 30;
      const delayMs = 1500;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const next = await refresh();
        const stillThere = (next ?? []).some(
          (d) => d.escrowId.toString() === escrowId,
        );
        if (!stillThere) {
          setResolvedIds((prev) => {
            if (!prev.has(escrowId)) return prev;
            const copy = new Set(prev);
            copy.delete(escrowId);
            return copy;
          });
          return;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
      // Give up gracefully: drop the optimistic dismiss so a genuinely
      // unsettled banner can come back rather than being permanently hidden.
      setResolvedIds((prev) => {
        if (!prev.has(escrowId)) return prev;
        const copy = new Set(prev);
        copy.delete(escrowId);
        return copy;
      });
    },
    [refresh],
  );

  const handleResolved = React.useCallback(
    (escrowId: bigint) => {
      const id = escrowId.toString();
      setResolvedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      void pollUntilGone(id);
    },
    [pollUntilGone],
  );

  const visibleDeposits = React.useMemo(
    () =>
      pendingDeposits.filter(
        (deposit) => !resolvedIds.has(deposit.escrowId.toString()),
      ),
    [pendingDeposits, resolvedIds],
  );

  if (!viewingOwnProfile || visibleDeposits.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {visibleDeposits.map((deposit) => (
        <EscrowDepositBanner
          key={deposit.escrowId.toString()}
          deposit={deposit}
          onDeposited={() => handleResolved(deposit.escrowId)}
          onRefused={() => handleResolved(deposit.escrowId)}
        />
      ))}
    </div>
  );
};
