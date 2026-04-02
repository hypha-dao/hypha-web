'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
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

export function MemberExchangeEscrowFunding({
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
  const {
    fundMemberExchangeEscrow,
    isFundingMemberExchangeEscrow,
    errorFundMemberExchangeEscrow,
  } = useFundMemberExchangeEscrowWeb3Rpc();

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

  const canFund =
    deferred &&
    executed &&
    !persistedEscrowId &&
    parsedExchange?.sellerLeg?.length &&
    parsedExchange?.buyerLeg?.length &&
    parsedExchange.sellerLeg.length === parsedExchange.buyerLeg.length &&
    parsedExchange.sellerAddress &&
    parsedExchange.buyerAddress;

  const handleFund = async () => {
    if (!canFund || !parsedExchange) return;
    const escrowIds = await fundMemberExchangeEscrow({
      sellerAddress: parsedExchange.sellerAddress!,
      buyerAddress: parsedExchange.buyerAddress!,
      sellerLeg: toFundingLeg(parsedExchange.sellerLeg),
      buyerLeg: toFundingLeg(parsedExchange.buyerLeg),
    });
    const first = escrowIds[0];
    if (first === undefined || !description) return;
    const nextDesc = upsertExchangeEscrowIdInDescription(description, first);
    await web2.updateAgreementBySlug({
      slug: documentSlug,
      description: nextDesc,
    });
    router.refresh();
  };

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

  if (!canFund) return null;

  return (
    <div className="rounded-[8px] p-4 border border-accent-6 bg-accent-surface flex flex-col gap-3">
      <p className="text-2 text-foreground">{t('memberEscrowFundPrompt')}</p>
      {!isSellerWallet ? (
        <p className="text-2 text-destructive">{t('connectSellerWallet')}</p>
      ) : null}
      {errorFundMemberExchangeEscrow ? (
        <p className="text-2 text-destructive">
          {(errorFundMemberExchangeEscrow as Error).message}
        </p>
      ) : null}
      <Button
        type="button"
        onClick={() => void handleFund()}
        disabled={
          !isSellerWallet ||
          isFundingMemberExchangeEscrow ||
          web2.isUpdatingAgreement
        }
      >
        {isFundingMemberExchangeEscrow || web2.isUpdatingAgreement
          ? t('memberEscrowFunding')
          : t('memberEscrowFundCta')}
      </Button>
    </div>
  );
}
