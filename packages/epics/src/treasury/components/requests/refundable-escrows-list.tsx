'use client';

import React from 'react';
import { formatUnits } from 'viem';
import { ArrowRightIcon, Loader2 } from 'lucide-react';

import { Button, ConfirmDialog } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  getProposalFromLogs,
  publicClient,
  RefundableEscrow,
  useAgreementMutationsWeb2Rsc,
  useEscrowCancelMutation,
  useEscrowRefundProposalMutation,
  useJwt,
  useMe,
  useRefundableEscrows,
  web3ProposalIdForDb,
} from '@hypha-platform/core/client';
import { useNameForAddress } from '../../../governance/hooks';

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
   * Postgres DB id of the space — required when `spaceId` is set so the
   * generated refund proposal also creates a linked web2 agreement that
   * shows up under the space's "agreements" tab. Without it, the on-chain
   * proposal exists but is invisible in the UI listings.
   */
  spaceDbId?: number | null;
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
  spaceDbId?: number | null;
  onRefunded: () => void;
};

/** True when a refund userOp revert is actually the escrow telling us the
 * desired terminal state is already on-chain (cancelled / completed /
 * funds already returned). The mutation hook absorbs most of these races,
 * but we keep this guard so any straggler error blob still surfaces as a
 * silent success rather than red text in the UI. */
const isRefundAlreadySettledError = (err: unknown): boolean => {
  const msg =
    err instanceof Error ? `${err.message} ${err.stack ?? ''}` : String(err);
  return (
    /Escrow already cancelled/i.test(msg) ||
    /Escrow already completed/i.test(msg) ||
    /No funds to withdraw/i.test(msg) ||
    /457363726f7720616c72656164792063616e63656c6c6564/i.test(msg) ||
    /457363726f7720616c726561647920636f6d706c65746564/i.test(msg) ||
    /4e6f2066756e647320746f2077697468647261/i.test(msg)
  );
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
      if (isRefundAlreadySettledError(err)) {
        console.warn(
          'Escrow refund already settled on-chain; treating as success.',
        );
        resetCancelEscrow();
        onRefunded();
        return;
      }
      console.error('Escrow refund failed:', err);
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  }, [cancelEscrow, escrow.escrowId, onRefunded, resetCancelEscrow]);

  const refundLabel = `${formatAmount(
    escrow.refundAmount,
    escrow.refundTokenDecimals,
  )} ${escrow.refundTokenSymbol || 'tokens'}`;
  const counterpartyMutationError =
    cancelEscrowError && !isRefundAlreadySettledError(cancelEscrowError)
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

const ProposalRefundRow: React.FC<
  RefundRowProps & { spaceId: number; spaceDbId?: number | null }
> = ({ escrow, spaceId, spaceDbId, onRefunded }) => {
  const {
    createRefundProposal,
    isCreatingRefundProposal,
    refundProposalError,
    refundProposalHash,
    resetRefundProposal,
  } = useEscrowRefundProposalMutation();
  const { jwt } = useJwt();
  const { person } = useMe();
  const { createAgreement, updateAgreementBySlug, deleteAgreementBySlug } =
    useAgreementMutationsWeb2Rsc(jwt);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [didSubmit, setDidSubmit] = React.useState(false);
  const [isLinkingAgreement, setIsLinkingAgreement] = React.useState(false);

  const refundLabelForCopy = `${formatAmount(
    escrow.refundAmount,
    escrow.refundTokenDecimals,
  )} ${escrow.refundTokenSymbol || 'tokens'}`;

  const handleRefund = React.useCallback(async () => {
    setLocalError(null);

    // The web2 agreement gives the proposal a row in the space's "Agreements"
    // tab — without it the on-chain proposal exists but is invisible in the
    // UI listings (which read the web2 table). Mirror the deposit flow:
    // create the agreement first, then create the on-chain proposal, then
    // link them. If anything fails downstream we delete the agreement so the
    // DB stays in sync with chain.
    const canCreateAgreement = !!jwt && !!person?.id && !!spaceDbId;
    const title = `Refund escrow #${escrow.escrowId.toString()} (${refundLabelForCopy})`;
    const description = `Cancel escrow #${escrow.escrowId.toString()} and return ${refundLabelForCopy} to the space treasury.`;

    let createdSlug: string | undefined;
    try {
      if (canCreateAgreement) {
        const created = await createAgreement({
          title,
          description,
          creatorId: person.id,
          spaceId: spaceDbId,
          label: 'Refund',
        });
        createdSlug = created?.slug ?? undefined;
      }

      const hash = await createRefundProposal({
        spaceId,
        escrowId: escrow.escrowId,
        withdrawAfterCancel: true,
      });
      setDidSubmit(true);

      if (hash && createdSlug) {
        setIsLinkingAgreement(true);
        try {
          const { logs } = await publicClient.waitForTransactionReceipt({
            hash,
          });
          const event = getProposalFromLogs(logs);
          const web3ProposalId = web3ProposalIdForDb(
            event?.proposalId as bigint | undefined,
          );
          await updateAgreementBySlug({
            slug: createdSlug,
            web3ProposalId,
          });
        } catch (linkErr) {
          // Linking failure is non-fatal: the proposal still exists on-chain
          // and the agreement still exists in the DB, just unlinked. We log
          // and surface a softer warning rather than rolling back.
          console.error(
            'Failed to link refund proposal to agreement:',
            linkErr,
          );
        } finally {
          setIsLinkingAgreement(false);
        }
      }

      onRefunded();
    } catch (err) {
      console.error('Escrow refund proposal failed:', err);
      if (createdSlug) {
        try {
          await deleteAgreementBySlug({ slug: createdSlug });
        } catch (cleanupErr) {
          console.error('Failed to clean up orphaned agreement:', cleanupErr);
        }
      }
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  }, [
    createAgreement,
    createRefundProposal,
    deleteAgreementBySlug,
    escrow.escrowId,
    jwt,
    onRefunded,
    person?.id,
    refundLabelForCopy,
    spaceDbId,
    spaceId,
    updateAgreementBySlug,
  ]);

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

  const isBusy = isCreatingRefundProposal || isLinkingAgreement;
  const buttonLabel = isCreatingRefundProposal
    ? 'Submitting proposal...'
    : isLinkingAgreement
      ? 'Linking agreement...'
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
  // The "other party" of an unsettled escrow is whichever leg is NOT us.
  const counterpartyAddress =
    escrow.side === 'A' ? escrow.partyB : escrow.partyA;
  const { label: resolvedCounterparty } =
    useNameForAddress(counterpartyAddress);
  const counterpartyLabel = resolvedCounterparty || 'the other party';

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
            You deposited <span className="font-bold">{refundLabel}</span> into
            escrow (#{escrow.escrowId.toString()}) and the transaction with{' '}
            <span className="font-bold">{counterpartyLabel}</span> is not yet
            settled, so the amount is still refundable.
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
  spaceDbId,
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
              spaceDbId={spaceDbId ?? null}
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
