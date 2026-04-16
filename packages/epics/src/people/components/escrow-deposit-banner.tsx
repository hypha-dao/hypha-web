'use client';

import React from 'react';
import { Button } from '@hypha-platform/ui';
import { ArrowRightIcon, Loader2 } from 'lucide-react';
import { formatUnits } from 'viem';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  PendingEscrowDeposit,
  useEscrowDepositMutation,
  publicClient,
} from '@hypha-platform/core/client';

type Props = {
  deposit: PendingEscrowDeposit;
  onDeposited?: () => void;
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

export const EscrowDepositBanner = ({ deposit, onDeposited }: Props) => {
  const {
    deposit: sendDeposit,
    isDepositing,
    depositError,
    resetDeposit,
  } = useEscrowDepositMutation();
  const [isWaitingReceipt, setIsWaitingReceipt] = React.useState(false);
  const [errorOverride, setErrorOverride] = React.useState<string | null>(null);

  const needsApprove = deposit.payAllowance < deposit.payAmount;
  const insufficientBalance = deposit.payBalance < deposit.payAmount;

  const handleClick = React.useCallback(async () => {
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
    }
  }, [deposit, sendDeposit, onDeposited, resetDeposit]);

  const sendLabel = `${formatAmount(
    deposit.payAmount,
    deposit.payTokenDecimals,
  )} ${deposit.payTokenSymbol || 'tokens'}`;
  const receiveLabel = `${formatAmount(
    deposit.receiveAmount,
    deposit.receiveTokenDecimals,
  )} ${deposit.receiveTokenSymbol || 'tokens'}`;

  const actionLabel = isWaitingReceipt
    ? 'Confirming...'
    : isDepositing
    ? needsApprove
      ? 'Approving...'
      : 'Depositing...'
    : needsApprove
    ? 'Approve & Deposit'
    : 'Deposit to Escrow';

  const mutationError =
    depositError && !isAlreadyFundedError(depositError)
      ? depositError instanceof Error
        ? depositError.message
        : String(depositError)
      : null;
  const errorMessage = errorOverride ?? mutationError;

  const title =
    deposit.side === 'A'
      ? 'Complete your side of the exchange'
      : 'Complete your deposit';
  const bodyIntro =
    deposit.side === 'A'
      ? 'An exchange proposal you are party to was approved.'
      : 'A proposal you are party to was approved.';

  return (
    <div className="rounded-[8px] p-5 border-1 bg-accent-surface border-accent-6 bg-center flex flex-col md:flex-row gap-4 md:gap-5 items-start md:items-center justify-between">
      <div className="flex items-start gap-3 md:gap-5 w-full md:w-auto">
        <ArrowRightIcon
          width={16}
          height={16}
          className="text-foreground flex-shrink-0 mt-1"
        />
        <div className="flex flex-col gap-2 flex-1">
          <span className="text-2 text-foreground font-bold">{title}</span>
          <span className="text-2 text-foreground">
            {bodyIntro} Deposit <span className="font-bold">{sendLabel}</span>{' '}
            into escrow to receive{' '}
            <span className="font-bold">{receiveLabel}</span> in exchange.
          </span>
          {insufficientBalance ? (
            <span className="text-2 text-error-11">
              Your wallet balance is below the required amount.
            </span>
          ) : null}
          {errorMessage ? (
            <span className="text-2 text-error-11 break-all">
              {errorMessage}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 w-full md:w-auto justify-between md:justify-normal">
        <Button
          onClick={handleClick}
          disabled={isDepositing || isWaitingReceipt || insufficientBalance}
          className="w-full md:w-fit text-wrap justify-center"
        >
          {(isDepositing || isWaitingReceipt) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {actionLabel}
        </Button>
      </div>
    </div>
  );
};
