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

function legsKey(parsed: ParsedExchangeDetails | null): string {
  if (!parsed?.sellerLeg?.length || !parsed?.buyerLeg?.length) return '';
  return JSON.stringify({
    s: parsed.sellerLeg,
    b: parsed.buyerLeg,
    seller: parsed.sellerAddress,
    buyer: parsed.buyerAddress,
  });
}

/**
 * No button: when the deferred member-exchange proposal is executed and the seller
 * wallet matches, fund escrow once (same wallet pattern as contribution proposals).
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
  const updateAgreementRef = React.useRef(web2.updateAgreementBySlug);
  updateAgreementRef.current = web2.updateAgreementBySlug;

  const { client } = useSmartWallets();
  const { fundMemberExchangeEscrow } = useFundMemberExchangeEscrowWeb3Rpc();
  const fundRef = React.useRef(fundMemberExchangeEscrow);
  fundRef.current = fundMemberExchangeEscrow;

  const attemptedRef = React.useRef(false);
  const [fundError, setFundError] = React.useState<string | null>(null);

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

  const legsStable = legsKey(parsedExchange);

  const canAutoFund =
    deferred &&
    executed &&
    persistedEscrowId === undefined &&
    isSellerWallet &&
    parsedExchange?.sellerLeg?.length &&
    parsedExchange?.buyerLeg?.length &&
    parsedExchange.sellerLeg.length === parsedExchange.buyerLeg.length &&
    parsedExchange.sellerAddress &&
    parsedExchange.buyerAddress;

  React.useEffect(() => {
    if (
      !canAutoFund ||
      !parsedExchange ||
      typeof description !== 'string' ||
      attemptedRef.current
    ) {
      return;
    }
    attemptedRef.current = true;
    setFundError(null);

    void (async () => {
      try {
        const escrowIds = await fundRef.current({
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
        await updateAgreementRef.current({
          slug: documentSlug,
          description: nextDesc,
        });
        router.refresh();
      } catch (e) {
        attemptedRef.current = false;
        const msg = e instanceof Error ? e.message : String(e);
        setFundError(msg);
        console.error('Member exchange auto-fund failed:', e);
      }
    })();
  }, [
    canAutoFund,
    description,
    documentSlug,
    legsStable,
    parsedExchange,
    router,
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

  if (fundError) {
    return (
      <div
        className="rounded-[8px] p-4 border border-destructive-6 bg-destructive-surface text-2 text-destructive"
        role="alert"
      >
        {t('memberEscrowFundError', { message: fundError })}
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
