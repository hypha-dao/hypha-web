'use client';

import React from 'react';
import { formatUnits } from 'viem';
import { ArrowRightIcon, Loader2 } from 'lucide-react';

import { Button, ConfirmDialog } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  RefundableEscrow,
  useEscrowCancelMutation,
  useEscrowRefundProposalMutation,
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
   * When set, the escrow party is the space's executor (not the connected
   * user's wallet). The Refund button creates a governance proposal that,
   * once approved, calls `cancelEscrow` + `withdrawFromCancelled` from the
   * executor — the only address the on-chain ACL accepts.
   *
   * When omitted, the Refund button calls `cancelEscrow` directly from the
   * connected user's smart wallet (used on the personal profile page).
   */
  spaceId?: number | null;
  /**
   * Heading shown above the list. Defaults to "Refundable escrow deposits".
   * Pass an empty string to hide.
   */
  heading?: string;
};

const formatAmount = (raw: bigint, decimals: number) =>
  formatCurrencyValue(formatUnits(raw, decimals));

type RefundRowProps = {
  escrow: RefundableEscrow;
  spaceId?: number | null;
  onRefunded: () => void;
};

const DirectRefundRow: React.FC<RefundRowProps> = ({ escrow, onRefunded }) => {
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
    <RefundRowShell
      escrow={escrow}
      refundLabel={refundLabel}
      errorMessage={errorMessage}
      successMessage={null}
      confirmTitle="Refund this deposit?"
      confirmDescription={`Cancel escrow #${escrow.escrowId.toString()} and return ${refundLabel} to your wallet. The other party will not be able to settle the swap.`}
      buttonLabel={buttonLabel}
      isBusy={isBusy}
      onConfirm={handleRefund}
    />
  );
};

const ProposalRefundRow: React.FC<RefundRowProps & { spaceId: number }> = ({
  escrow,
  spaceId,
  onRefunded,
}) => {
  const {
    createRefundProposal,
    isCreatingRefundProposal,
    refundProposalError,
    refundProposalHash,
    resetRefundProposal,
  } = useEscrowRefundProposalMutation();
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [didSubmit, setDidSubmit] = React.useState(false);

  const handleRefund = React.useCallback(async () => {
    setLocalError(null);
    try {
      await createRefundProposal({
        spaceId,
        escrowId: escrow.escrowId,
        withdrawAfterCancel: true,
      });
      setDidSubmit(true);
      onRefunded();
    } catch (err) {
      console.error('Escrow refund proposal failed:', err);
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  }, [createRefundProposal, escrow.escrowId, onRefunded, spaceId]);

  React.useEffect(() => {
    return () => {
      resetRefundProposal();
    };
  }, [resetRefundProposal]);

  const refundLabel = `${formatAmount(
    escrow.refundAmount,
    escrow.refundTokenDecimals,
  )} ${escrow.refundTokenSymbol || 'tokens'}`;
  const mutationError = refundProposalError
    ? refundProposalError instanceof Error
      ? refundProposalError.message
      : String(refundProposalError)
    : null;
  const errorMessage = localError ?? mutationError;

  const proposalSubmitted = didSubmit && Boolean(refundProposalHash);
  const successMessage = proposalSubmitted
    ? 'Refund proposal created. Once members approve it, the deposit will be returned to the treasury.'
    : null;

  const isBusy = isCreatingRefundProposal;
  const buttonLabel = isCreatingRefundProposal
    ? 'Submitting proposal...'
    : proposalSubmitted
    ? 'Proposal submitted'
    : 'Propose refund';

  return (
    <RefundRowShell
      escrow={escrow}
      refundLabel={refundLabel}
      errorMessage={errorMessage}
      successMessage={successMessage}
      confirmTitle="Propose to refund this deposit?"
      confirmDescription={`Create a governance proposal that, when approved, cancels escrow #${escrow.escrowId.toString()} and returns ${refundLabel} to the space treasury. The other party will not be able to settle the swap once it is cancelled.`}
      confirmAcceptLabel="Yes, create proposal"
      buttonLabel={buttonLabel}
      isBusy={isBusy}
      isDisabled={proposalSubmitted}
      onConfirm={handleRefund}
    />
  );
};

const RefundRowShell: React.FC<{
  escrow: RefundableEscrow;
  refundLabel: string;
  errorMessage: string | null;
  successMessage: string | null;
  confirmTitle: string;
  confirmDescription: string;
  confirmAcceptLabel?: string;
  buttonLabel: string;
  isBusy: boolean;
  isDisabled?: boolean;
  onConfirm: () => Promise<void> | void;
}> = ({
  escrow,
  refundLabel,
  errorMessage,
  successMessage,
  confirmTitle,
  confirmDescription,
  confirmAcceptLabel = 'Yes, refund',
  buttonLabel,
  isBusy,
  isDisabled = false,
  onConfirm,
}) => {
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
          {successMessage ? (
            <span className="text-1 text-success-11">{successMessage}</span>
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
          title={confirmTitle}
          description={confirmDescription}
          customAcceptButtonText={confirmAcceptLabel}
          customRejectButtonText="Cancel"
          onAcceptClicked={onConfirm}
        >
          <Button
            variant="outline"
            colorVariant="accent"
            disabled={isBusy || isDisabled}
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
  spaceId,
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
        {refundableEscrows.map((escrow) =>
          spaceId ? (
            <ProposalRefundRow
              key={escrow.escrowId.toString()}
              escrow={escrow}
              spaceId={spaceId}
              onRefunded={() => refresh()}
            />
          ) : (
            <DirectRefundRow
              key={escrow.escrowId.toString()}
              escrow={escrow}
              onRefunded={() => refresh()}
            />
          ),
        )}
      </div>
    </div>
  );
};
