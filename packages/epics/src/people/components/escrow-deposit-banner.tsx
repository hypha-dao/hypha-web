'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { ArrowRightIcon, Loader2, X } from 'lucide-react';
import { formatUnits } from 'viem';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  PendingEscrowDeposit,
  useEscrowDepositMutation,
  useEscrowCancelMutation,
  publicClient,
} from '@hypha-platform/core/client';
import { useNameForAddress } from '../../governance/hooks';

type Props = {
  deposit: PendingEscrowDeposit;
  onDeposited?: () => void;
  onRefused?: () => void;
};

const formatAmount = (raw: bigint, decimals: number) =>
  formatCurrencyValue(formatUnits(raw, decimals));

/** True when a wallet/RPC error is actually the escrow telling us the
 * user's side is already funded — a harmless race condition we want to
 * surface as success rather than as a scary stack trace. */
const isAlreadyFundedError = (err: unknown): boolean => {
  const msg =
    err instanceof Error ? `${err.message} ${err.stack ?? ''}` : String(err);
  return (
    /Party already funded/i.test(msg) ||
    // ASCII-hex payload of the revert string — present in raw RPC responses.
    /506172747920616c72656164792066756e646564/i.test(msg)
  );
};

/** True when a `cancelEscrow` revert is actually the escrow telling us it
 * is already in a terminal state (cancelled or completed). The user's
 * intent — "make this banner go away" — is already satisfied on-chain, so
 * we treat these as a soft success and just refresh, instead of surfacing
 * a long red user-operation revert blob. */
const isAlreadyTerminatedError = (err: unknown): boolean => {
  const msg =
    err instanceof Error ? `${err.message} ${err.stack ?? ''}` : String(err);
  return (
    /Escrow already cancelled/i.test(msg) ||
    /Escrow already completed/i.test(msg) ||
    // ASCII-hex payload of the revert strings — present in raw RPC responses
    // when the bundler returns the revert as `Error(string)` selector data.
    /457363726f7720616c72656164792063616e63656c6c6564/i.test(msg) ||
    /457363726f7720616c726561647920636f6d706c65746564/i.test(msg)
  );
};

/**
 * Heuristic: an "Investment" pattern is one where partyA is also the
 * creator of the escrow (a space proposing to mint/sell tokens) and
 * has already pre-funded its side, while partyB (the user/investor)
 * still needs to deposit. The current user is on side B in this case.
 *
 * For ordinary peer-to-peer exchange proposals the creator may be
 * either party but partyA pre-funds before partyB and the messaging
 * is generic.
 */
const isInvestmentDeposit = (deposit: PendingEscrowDeposit): boolean => {
  if (deposit.side !== 'B') return false;
  const creator = deposit.creator?.toLowerCase?.();
  const partyA = deposit.partyA?.toLowerCase?.();
  if (!creator || !partyA) return false;
  return creator === partyA && deposit.isPartyAFunded;
};

export const EscrowDepositBanner = ({
  deposit,
  onDeposited,
  onRefused,
}: Props) => {
  const t = useTranslations('Spaces');
  const {
    deposit: sendDeposit,
    isDepositing,
    depositError,
    resetDeposit,
  } = useEscrowDepositMutation();
  const {
    cancelEscrow,
    isCancellingEscrow,
    cancelEscrowError,
    resetCancelEscrow,
  } = useEscrowCancelMutation();
  const [isWaitingReceipt, setIsWaitingReceipt] = React.useState(false);
  const [errorOverride, setErrorOverride] = React.useState<string | null>(null);
  // Immediate, synchronous in-flight flags so the buttons flip to their
  // loading state on the same render as the click — without depending on the
  // SWR mutation's `isMutating` flag, which can trail the click by a tick on
  // slow renders / when the wallet provider is busy. Also doubles as a
  // double-click guard: clicking Refuse twice in a row was racing the first
  // tx onto the bundler and surfacing an "Escrow already cancelled" revert.
  const [isSubmittingDeposit, setIsSubmittingDeposit] = React.useState(false);
  const [isSubmittingRefuse, setIsSubmittingRefuse] = React.useState(false);

  const needsApprove = deposit.payAllowance < deposit.payAmount;
  const insufficientBalance = deposit.payBalance < deposit.payAmount;

  const handleClick = React.useCallback(async () => {
    if (isSubmittingDeposit || isSubmittingRefuse) return;
    setIsSubmittingDeposit(true);
    setErrorOverride(null);
    try {
      const hash = await sendDeposit({
        escrowId: deposit.escrowId,
        token: deposit.payToken,
        amount: deposit.payAmount,
        currentAllowance: deposit.payAllowance,
      });
      if (hash) {
        setIsWaitingReceipt(true);
        await publicClient.waitForTransactionReceipt({ hash });
      }
      onDeposited?.();
    } catch (err) {
      if (isAlreadyFundedError(err)) {
        // The on-chain state already reflects our deposit — surface a success
        // outcome so the banner disappears on next refresh instead of a scary
        // red error.
        console.warn(
          'Escrow deposit already settled on-chain; treating as success.',
        );
        resetDeposit();
        onDeposited?.();
        return;
      }
      console.error('Escrow deposit failed:', err);
      setErrorOverride(err instanceof Error ? err.message : String(err));
    } finally {
      setIsWaitingReceipt(false);
      setIsSubmittingDeposit(false);
    }
  }, [
    deposit,
    isSubmittingDeposit,
    isSubmittingRefuse,
    sendDeposit,
    onDeposited,
    resetDeposit,
  ]);

  const handleRefuse = React.useCallback(async () => {
    if (isSubmittingDeposit || isSubmittingRefuse) return;
    setIsSubmittingRefuse(true);
    setErrorOverride(null);
    try {
      // The user has not yet deposited, so cancelling alone is enough –
      // there is nothing to withdraw on their side.
      await cancelEscrow({
        escrowId: deposit.escrowId,
        withdrawAfterCancel: false,
      });
      resetCancelEscrow();
      onRefused?.();
    } catch (err) {
      if (isAlreadyTerminatedError(err)) {
        // The escrow is already cancelled or completed on-chain — the
        // banner is stale, not the user. Refresh silently instead of
        // dumping the bundler's hex revert blob in red.
        console.warn(
          'Escrow already cancelled/completed on-chain; treating refuse as success.',
        );
        resetCancelEscrow();
        onRefused?.();
        return;
      }
      console.error('Escrow refuse failed:', err);
      setErrorOverride(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingRefuse(false);
    }
  }, [
    cancelEscrow,
    deposit.escrowId,
    isSubmittingDeposit,
    isSubmittingRefuse,
    onRefused,
    resetCancelEscrow,
  ]);

  // Display the seller-side amount (what the seller is offering) followed by
  // the buyer-side amount (what is being asked from the user). This matches
  // the new copy "[Seller] has proposed to exchange X TOKEN_A for Y TOKEN_B
  // from you." regardless of which side the current user is on.
  const sellerAmountLabel = `${formatAmount(
    deposit.amountA,
    deposit.tokenADecimals,
  )} ${deposit.tokenASymbol || 'tokens'}`;
  const buyerAmountLabel = `${formatAmount(
    deposit.amountB,
    deposit.tokenBDecimals,
  )} ${deposit.tokenBSymbol || 'tokens'}`;

  const investment = isInvestmentDeposit(deposit);

  // `isSubmittingDeposit` is the synchronous flag set on click; SWR's
  // `isDepositing` and the local `isWaitingReceipt` are kept as additional
  // signals so the spinner stays on across the whole approve→deposit→receipt
  // flow even after the click handler has returned.
  const depositInFlight =
    isSubmittingDeposit || isDepositing || isWaitingReceipt;
  const refuseInFlight = isSubmittingRefuse || isCancellingEscrow;

  const getActionLabel = () => {
    if (isWaitingReceipt) {
      return t('exchangeDepositProposalConfirming');
    }
    if (isDepositing) {
      if (needsApprove) return t('escrowDepositApproving');
      if (investment) return t('exchangeDepositProposalConfirming');
      return t('escrowDepositDepositing');
    }
    if (isSubmittingDeposit) {
      if (investment) return t('exchangeDepositProposalConfirming');
      if (needsApprove) return t('escrowDepositApproving');
      return t('escrowDepositDepositing');
    }
    return investment ? t('confirmInvestmentCta') : t('escrowConfirmExchange');
  };

  const actionLabel = getActionLabel();

  const refuseLabel = refuseInFlight
    ? t('escrowDepositRefusing')
    : t('escrowDepositRefuse');

  const mutationError =
    depositError && !isAlreadyFundedError(depositError)
      ? depositError instanceof Error
        ? depositError.message
        : String(depositError)
      : null;
  const cancelMutationError = cancelEscrowError
    ? cancelEscrowError instanceof Error
      ? cancelEscrowError.message
      : String(cancelEscrowError)
    : null;
  const errorMessage = errorOverride ?? mutationError ?? cancelMutationError;

  const title = investment
    ? t('acceptInvestmentTitle')
    : t('exchangeStakesAndTokensTitle');

  // Resolve partyA into a friendly name (person OR space). Handles both
  // investment proposals (partyA is always a space's executor) and ordinary
  // peer-to-peer exchanges (partyA can be a member's smart wallet).
  const { label: sellerLabel } = useNameForAddress(deposit.partyA);

  // For non-investment exchanges we identify the proposer side: the user
  // viewing this banner is whichever side they are NOT yet funded on, so
  // the COUNTERPARTY is the one who created the proposal. For copy purposes
  // we keep referring to partyA ("seller") which matches how the escrow
  // contract orders the legs.

  return (
    <div className="bg-accent-surface-mix rounded-[8px] border-1 border-accent-6 bg-center p-5 flex flex-col lg:flex-row gap-4 lg:gap-5 items-start lg:items-center justify-between">
      <div className="flex items-start gap-3 lg:gap-5 w-full lg:w-auto">
        <ArrowRightIcon
          width={16}
          height={16}
          className="text-foreground flex-shrink-0 mt-1"
        />
        <div className="flex flex-col gap-2 flex-1">
          <span className="text-2 text-foreground font-bold">{title}</span>
          <span className="text-2 text-foreground">
            {investment
              ? t('acceptInvestmentBodyPersonal', {
                  sellerLabel,
                  buyerAmountLabel,
                  sellerAmountLabel,
                })
              : t('exchangeStakesAndTokensBodyPersonal', {
                  sellerLabel,
                  sellerAmountLabel,
                  buyerAmountLabel,
                })}
          </span>
          {insufficientBalance ? (
            <span className="text-2 text-error-11">
              {t('escrowDepositInsufficientWallet')}
            </span>
          ) : null}
          {errorMessage ? (
            <span className="text-2 text-error-11 break-all">
              {errorMessage}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-normal">
        <Button
          variant="outline"
          onClick={handleRefuse}
          disabled={depositInFlight || refuseInFlight}
          className="w-full sm:flex-1 lg:w-fit lg:flex-none text-wrap justify-center"
        >
          {refuseInFlight && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {refuseLabel}
        </Button>
        <Button
          onClick={handleClick}
          disabled={depositInFlight || refuseInFlight || insufficientBalance}
          variant="outline"
          colorVariant="accent"
          className="w-full sm:flex-1 lg:w-fit lg:flex-none text-wrap justify-center"
        >
          {depositInFlight && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {actionLabel}
        </Button>
      </div>
    </div>
  );
};
