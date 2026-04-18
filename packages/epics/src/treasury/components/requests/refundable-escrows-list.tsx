'use client';

import React from 'react';
import { formatUnits } from 'viem';
import { ArrowRightIcon, Loader2 } from 'lucide-react';

import { Button, ConfirmDialog } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  RefundableEscrow,
  useEscrowCancelMutation,
  useRefundableEscrows,
} from '@hypha-platform/core/client';

type Props = {
  /**
   * Wallet whose funded-but-unsettled escrow positions can be refunded.
   * For a member: the connected user's address. For a space: the space
   * executor (treasury) address — both forms can call `cancelEscrow`.
   */
  user?: `0x${string}` | null;
  /**
   * Heading shown above the list. Defaults to "Refundable escrow deposits".
   * Pass an empty string to hide.
   */
  heading?: string;
};

const formatAmount = (raw: bigint, decimals: number) =>
  formatCurrencyValue(formatUnits(raw, decimals));

const RefundRow: React.FC<{
  escrow: RefundableEscrow;
  onRefunded: () => void;
}> = ({ escrow, onRefunded }) => {
  const {
    cancelEscrow,
    isCancellingEscrow,
    cancelEscrowError,
    resetCancelEscrow,
  } = useEscrowCancelMutation();
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleRefund = React.useCallback(async () => {
    setLocalError(null);
    try {
      await cancelEscrow({
        escrowId: escrow.escrowId,
        withdrawAfterCancel: true,
      });
      resetCancelEscrow();
      onRefunded();
    } catch (err) {
      console.error('Escrow refund failed:', err);
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  }, [cancelEscrow, escrow.escrowId, onRefunded, resetCancelEscrow]);

  const refundLabel = `${formatAmount(
    escrow.refundAmount,
    escrow.refundTokenDecimals,
  )} ${escrow.refundTokenSymbol || 'tokens'}`;
  const counterpartyMutationError = cancelEscrowError
    ? cancelEscrowError instanceof Error
      ? cancelEscrowError.message
      : String(cancelEscrowError)
    : null;
  const errorMessage = localError ?? counterpartyMutationError;

  const isBusy = isCancellingEscrow;
  const buttonLabel = isCancellingEscrow ? 'Refunding...' : 'Refund';

  return (
    <div className="rounded-[8px] p-4 border-1 bg-accent-surface border-accent-6 flex flex-col md:flex-row gap-3 md:gap-5 md:items-center justify-between">
      <div className="flex items-start gap-3 md:gap-4 w-full md:w-auto">
        <ArrowRightIcon
          width={16}
          height={16}
          className="text-foreground flex-shrink-0 mt-1"
        />
        <div className="flex flex-col gap-1 flex-1">
          <span className="text-2 text-foreground">
            Escrow #{escrow.escrowId.toString()} — you deposited{' '}
            <span className="font-bold">{refundLabel}</span> and the swap is
            still open.
          </span>
          {escrow.isCounterpartyFunded ? (
            <span className="text-1 text-warning-11">
              The counterparty has also funded — refunding will cancel the swap
              for both sides.
            </span>
          ) : null}
          {errorMessage ? (
            <span className="text-1 text-error-11 break-all">
              {errorMessage}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 w-full md:w-auto justify-end">
        <ConfirmDialog
          title="Refund this deposit?"
          description={`Cancel escrow #${escrow.escrowId.toString()} and return ${refundLabel} to your wallet. The other party will not be able to settle the swap.`}
          customAcceptButtonText="Yes, refund"
          customRejectButtonText="Cancel"
          onAcceptClicked={handleRefund}
        >
          <Button
            variant="outline"
            colorVariant="accent"
            disabled={isBusy}
            className="w-full md:w-fit text-wrap justify-center"
          >
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {buttonLabel}
          </Button>
        </ConfirmDialog>
      </div>
    </div>
  );
};

export const RefundableEscrowsList: React.FC<Props> = ({
  user,
  heading = 'Refundable escrow deposits',
}) => {
  const { refundableEscrows, refresh } = useRefundableEscrows({ user });

  if (!user) return null;
  if (refundableEscrows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {heading ? (
        <span className="text-2 font-bold text-neutral-11">{heading}</span>
      ) : null}
      <div className="flex flex-col gap-2">
        {refundableEscrows.map((escrow) => (
          <RefundRow
            key={escrow.escrowId.toString()}
            escrow={escrow}
            onRefunded={() => refresh()}
          />
        ))}
      </div>
    </div>
  );
};
