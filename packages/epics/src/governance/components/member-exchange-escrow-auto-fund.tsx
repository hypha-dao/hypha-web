'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  useAgreementMutationsWeb2Rsc,
  useFundMemberExchangeEscrowWeb3Rpc,
  useJwt,
} from '@hypha-platform/core/client';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { useRouter } from 'next/navigation';
import {
  parseExchangeEscrowIdFromDescription,
  upsertExchangeEscrowIdInDescription,
} from '../utils/exchange-escrow-id-in-description';
import type { ParsedExchangeDetails } from '../utils/exchange-details-parser';

type Leg = { amount: string; tokenAddress: string };

function toFundingLeg(legs: Leg[]) {
  return legs.map((leg) => ({
    amount: leg.amount,
    token: leg.tokenAddress,
  }));
}

/**
 * No UI button: when the deferred member-exchange proposal is executed and the seller
 * wallet is connected, funds escrow automatically (embedded in voting flow).
 */
export function MemberExchangeEscrowAutoFund({
  documentSlug,
  description,
  executed,
  parsedExchange,
}: {
  documentSlug: string;
  description?: string | null;
  executed: boolean;
  parsedExchange: ParsedExchangeDetails | null;
}) {
  const t = useTranslations('AgreementFlow.plugins.exchangeStakesAndTokens');
  const { jwt } = useJwt();
  const router = useRouter();
  const web2 = useAgreementMutationsWeb2Rsc(jwt);
  const { client } = useSmartWallets();
  const { fundMemberExchangeEscrow } = useFundMemberExchangeEscrowWeb3Rpc();
  const runRef = React.useRef(false);

  const deferred =
    typeof description === 'string' &&
    description.includes('exchange-funding:deferred');
  const persistedEscrowId = parseExchangeEscrowIdFromDescription(description);

  const smartAddress = (
    client as { account?: { address?: string } } | null
  )?.account?.address?.toLowerCase();
  const sellerAddr = parsedExchange?.sellerAddress?.toLowerCase();
  const isSellerWallet = Boolean(
    smartAddress && sellerAddr && smartAddress === sellerAddr,
  );

  const canAutoFund =
    deferred &&
    executed &&
    !persistedEscrowId &&
    isSellerWallet &&
    parsedExchange?.sellerLeg?.length &&
    parsedExchange?.buyerLeg?.length &&
    parsedExchange.sellerLeg.length === parsedExchange.buyerLeg.length &&
    parsedExchange.sellerAddress &&
    parsedExchange.buyerAddress;

  React.useEffect(() => {
    if (!canAutoFund || !parsedExchange || !description || runRef.current) {
      return;
    }
    runRef.current = true;

    void (async () => {
      try {
        const escrowIds = await fundMemberExchangeEscrow({
          sellerAddress: parsedExchange.sellerAddress!,
          buyerAddress: parsedExchange.buyerAddress!,
          sellerLeg: toFundingLeg(parsedExchange.sellerLeg),
          buyerLeg: toFundingLeg(parsedExchange.buyerLeg),
        });
        const first = escrowIds[0];
        if (first === undefined) return;
        const nextDesc = upsertExchangeEscrowIdInDescription(
          description,
          first,
        );
        await web2.updateAgreementBySlug({
          slug: documentSlug,
          description: nextDesc,
        });
        router.refresh();
      } catch {
        runRef.current = false;
      }
    })();
  }, [
    canAutoFund,
    description,
    documentSlug,
    fundMemberExchangeEscrow,
    parsedExchange,
    router,
    web2,
  ]);

  if (!deferred) return null;

  if (persistedEscrowId !== undefined) {
    return (
      <div
        className="rounded-[8px] p-4 border border-accent-6 bg-accent-surface text-2 text-foreground"
        role="status"
      >
        {t('memberEscrowFunded', { escrowId: persistedEscrowId.toString() })}
      </div>
    );
  }

  if (!executed) {
    return (
      <div
        className="rounded-[8px] p-4 border border-accent-6 bg-accent-surface text-2 text-foreground"
        role="note"
      >
        {t('memberEscrowPendingVote')}
      </div>
    );
  }

  if (deferred && executed && !isSellerWallet) {
    return (
      <div
        className="rounded-[8px] p-4 border border-accent-6 bg-accent-surface text-2 text-destructive"
        role="alert"
      >
        {t('connectSellerWalletAuto')}
      </div>
    );
  }

  if (canAutoFund) {
    return (
      <div
        className="rounded-[8px] p-4 border border-accent-6 bg-accent-surface text-2 text-foreground"
        role="status"
        aria-live="polite"
      >
        {t('memberEscrowFundingAuto')}
      </div>
    );
  }

  return null;
}
