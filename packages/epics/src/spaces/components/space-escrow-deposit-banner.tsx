'use client';

import React from 'react';
import { formatUnits } from 'viem';
import { ArrowRightIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  getProposalFromLogs,
  PendingEscrowDeposit,
  publicClient,
  useAgreementMutationsWeb2Rsc,
  useJwt,
  useMe,
  useSpaceExchangeDepositProposalMutation,
  web3ProposalIdForDb,
} from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

type Props = {
  /** Escrow slot waiting for this space to fund. */
  deposit: PendingEscrowDeposit;
  /** Web3 id of the space that owes the deposit. */
  web3SpaceId: number;
  /** Postgres DB id of the space — attached to the linked web2 agreement. */
  spaceDbId: number;
  /** On-chain space contract address (treasury source). */
  spaceAddress?: `0x${string}` | null;
  /** Space executor — target of `transferFrom` / `mint` inside the proposal. */
  executorAddress: `0x${string}`;
  /** Dho URL slug used to navigate to the newly created agreement. */
  spaceSlug: string;
  /** Locale prefix for navigation (e.g. `en`). */
  lang: string;
  onProposalCreated?: () => void;
};

const formatAmount = (raw: bigint, decimals: number) =>
  formatCurrencyValue(formatUnits(raw, decimals));

export const SpaceEscrowDepositBanner = ({
  deposit,
  web3SpaceId,
  spaceDbId,
  spaceAddress,
  executorAddress,
  spaceSlug,
  lang,
  onProposalCreated,
}: Props) => {
  const t = useTranslations('Spaces');
  const { jwt } = useJwt();
  const { person } = useMe();
  const {
    createDepositProposal,
    isCreatingDepositProposal,
    depositProposalError,
  } = useSpaceExchangeDepositProposalMutation();
  const { createAgreement, updateAgreementBySlug, deleteAgreementBySlug } =
    useAgreementMutationsWeb2Rsc(jwt);
  const [isWaitingReceipt, setIsWaitingReceipt] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const router = useRouter();

  const handleClick = React.useCallback(async () => {
    setLocalError(null);

    if (!jwt) {
      setLocalError('You must be signed in to create a deposit proposal.');
      return;
    }
    if (!person?.id) {
      setLocalError('Your member profile is not ready yet — please retry.');
      return;
    }

    const title = t('exchangeDepositProposalTitle', {
      amount: formatAmount(deposit.payAmount, deposit.payTokenDecimals),
      symbol: deposit.payTokenSymbol || 'tokens',
      escrowId: deposit.escrowId.toString(),
    });
    const description = t('exchangeDepositProposalDescription', {
      amount: formatAmount(deposit.payAmount, deposit.payTokenDecimals),
      symbol: deposit.payTokenSymbol || 'tokens',
      escrowId: deposit.escrowId.toString(),
    });

    // Create the web2 agreement FIRST so the proposal shows up in the
    // agreements tab. If anything fails downstream we delete it again to keep
    // the DB in sync with the on-chain state.
    let createdSlug: string | undefined;
    try {
      const created = await createAgreement({
        title,
        description,
        creatorId: person.id,
        spaceId: spaceDbId,
        label: 'Exchange-Deposit',
      });
      createdSlug = created?.slug ?? undefined;

      const hash = await createDepositProposal({
        spaceId: web3SpaceId,
        escrowId: deposit.escrowId,
        payToken: deposit.payToken,
        payAmount: deposit.payAmount,
        treasuryAddress: spaceAddress ?? null,
        executorAddress,
        title,
        description,
      });

      if (hash) {
        setIsWaitingReceipt(true);
        const { logs } = await publicClient.waitForTransactionReceipt({
          hash,
        });
        // Link the web2 agreement to the web3 proposal so it appears under
        // the space's "agreements" tab like any other proposal.
        try {
          const event = getProposalFromLogs(logs);
          const web3ProposalId = web3ProposalIdForDb(
            event?.proposalId as bigint | undefined,
          );
          if (createdSlug) {
            await updateAgreementBySlug({
              slug: createdSlug,
              web3ProposalId,
            });
          }
        } catch (linkErr) {
          console.error(
            'Failed to link deposit proposal to agreement:',
            linkErr,
          );
        }
      }
      onProposalCreated?.();
      router.push(`/${lang}/dho/${spaceSlug}/agreements`);
    } catch (err) {
      console.error('Space escrow deposit proposal failed:', err);
      if (createdSlug) {
        try {
          await deleteAgreementBySlug({ slug: createdSlug });
        } catch (cleanupErr) {
          console.error('Failed to clean up orphaned agreement:', cleanupErr);
        }
      }
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsWaitingReceipt(false);
    }
  }, [
    createAgreement,
    createDepositProposal,
    deleteAgreementBySlug,
    deposit,
    executorAddress,
    jwt,
    lang,
    onProposalCreated,
    person?.id,
    router,
    spaceAddress,
    spaceDbId,
    spaceSlug,
    t,
    updateAgreementBySlug,
    web3SpaceId,
  ]);

  const sendLabel = `${formatAmount(
    deposit.payAmount,
    deposit.payTokenDecimals,
  )} ${deposit.payTokenSymbol || 'tokens'}`;
  const receiveLabel = `${formatAmount(
    deposit.receiveAmount,
    deposit.receiveTokenDecimals,
  )} ${deposit.receiveTokenSymbol || 'tokens'}`;

  const actionLabel = isWaitingReceipt
    ? t('exchangeDepositProposalConfirming')
    : isCreatingDepositProposal
    ? t('exchangeDepositProposalCreating')
    : t('exchangeDepositProposalCta');

  const mutationError = depositProposalError
    ? depositProposalError instanceof Error
      ? depositProposalError.message
      : String(depositProposalError)
    : null;
  const errorMessage = localError ?? mutationError;

  return (
    <div className="rounded-[8px] p-5 border-1 bg-accent-surface border-accent-6 bg-center flex flex-col md:flex-row gap-4 md:gap-5 items-start md:items-center justify-between">
      <div className="flex items-start gap-3 md:gap-5 w-full md:w-auto">
        <ArrowRightIcon
          width={16}
          height={16}
          className="text-foreground flex-shrink-0 mt-1"
        />
        <div className="flex flex-col gap-2 flex-1">
          <span className="text-2 text-foreground font-bold">
            {t('exchangeDepositProposalTitleBanner')}
          </span>
          <span className="text-2 text-foreground">
            {t.rich('exchangeDepositProposalBody', {
              send: () => <span className="font-bold">{sendLabel}</span>,
              receive: () => <span className="font-bold">{receiveLabel}</span>,
              escrowId: deposit.escrowId.toString(),
            })}
          </span>
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
          disabled={isCreatingDepositProposal || isWaitingReceipt}
          className="w-full md:w-fit text-wrap justify-center"
        >
          {(isCreatingDepositProposal || isWaitingReceipt) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {actionLabel}
        </Button>
      </div>
    </div>
  );
};
