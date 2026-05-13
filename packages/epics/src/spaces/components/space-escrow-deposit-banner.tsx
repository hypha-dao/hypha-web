'use client';

import React from 'react';
import { formatUnits } from 'viem';
import { ArrowRightIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Cross1Icon } from '@radix-ui/react-icons';

import { Button } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  buildExchangeDepositEscrowMarker,
  getProposalFromLogs,
  PendingEscrowDeposit,
  publicClient,
  useAgreementMutationsWeb2Rsc,
  useJwt,
  useMe,
  useSpaceBySlug,
  useSpaceExchangeDepositProposalMutation,
  web3ProposalIdForDb,
} from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { useNameForAddress } from '../../governance/hooks';

type Props = {
  /** Escrow slot waiting for this space to fund. */
  deposit: PendingEscrowDeposit;
  /** Web3 id of the space that owes the deposit. */
  web3SpaceId: number;
  /** Postgres DB id of the space — attached to the linked web2 agreement. */
  spaceDbId: number;
  /** Dho URL slug used to navigate to the newly created agreement. */
  spaceSlug: string;
  /** Locale prefix for navigation (e.g. `en`). */
  lang: string;
  onProposalCreated?: () => void;
  /**
   * When the user clicks the dismiss "X" — the parent should remember the
   * escrow id locally so the banner stays hidden for them. Refreshing the
   * page restores it (this is intentional, the banner reflects an open
   * on-chain obligation that doesn't disappear by clicking).
   */
  onDismiss?: () => void;
};

const formatAmount = (raw: bigint, decimals: number) =>
  formatCurrencyValue(formatUnits(raw, decimals));

/**
 * Investment heuristic: partyA is the creator and has pre-funded — meaning
 * the proposing space is essentially issuing tokens for the buyer (this
 * space) to invest in. See same logic in the personal banner.
 */
const isInvestmentDeposit = (deposit: PendingEscrowDeposit): boolean => {
  if (deposit.side !== 'B') return false;
  const creator = deposit.creator?.toLowerCase?.();
  const partyA = deposit.partyA?.toLowerCase?.();
  if (!creator || !partyA) return false;
  return creator === partyA && deposit.isPartyAFunded;
};

export const SpaceEscrowDepositBanner = ({
  deposit,
  web3SpaceId,
  spaceDbId,
  spaceSlug,
  lang,
  onProposalCreated,
  onDismiss,
}: Props) => {
  const t = useTranslations('Spaces');
  const tCommon = useTranslations('Common');
  const { jwt } = useJwt();
  const { person } = useMe();
  const { space: activeSpace } = useSpaceBySlug(spaceSlug);
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

  const investment = isInvestmentDeposit(deposit);
  // The active space is partyB (the one that owes the deposit). The "other
  // party" the proposal copy refers to is therefore partyA.
  const { label: counterpartyLabel } = useNameForAddress(deposit.partyA);
  const activeSpaceTitle = activeSpace?.title?.trim() || 'this space';

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

    const payAmountText = formatAmount(
      deposit.payAmount,
      deposit.payTokenDecimals,
    );
    const paySymbol = deposit.payTokenSymbol || 'tokens';
    // For the SPACE-side deposit, the active space is partyB and will receive
    // partyA's leg (tokenA / amountA) once both sides are funded and the
    // escrow auto-completes.
    const receiveAmountText = formatAmount(
      deposit.amountA,
      deposit.tokenADecimals,
    );
    const receiveSymbol = deposit.tokenASymbol || 'tokens';
    const otherParty = counterpartyLabel || 'the other party';

    const title = t('exchangeDepositProposalTitle', {
      amount: payAmountText,
      symbol: paySymbol,
      escrowId: deposit.escrowId.toString(),
    });
    const descriptionBody = investment
      ? t('investmentDepositProposalDescription', {
          payAmount: payAmountText,
          paySymbol,
          escrowId: deposit.escrowId.toString(),
          otherParty,
          activeSpace: activeSpaceTitle,
          receiveAmount: receiveAmountText,
          receiveSymbol,
        })
      : t('exchangeDepositProposalDescription', {
          payAmount: payAmountText,
          paySymbol,
          escrowId: deposit.escrowId.toString(),
          otherParty,
          activeSpace: activeSpaceTitle,
          receiveAmount: receiveAmountText,
          receiveSymbol,
        });
    const description = `${descriptionBody}\n\n${buildExchangeDepositEscrowMarker(
      deposit.escrowId,
    )}`;

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
    activeSpaceTitle,
    counterpartyLabel,
    createAgreement,
    createDepositProposal,
    deleteAgreementBySlug,
    deposit,
    investment,
    jwt,
    lang,
    onProposalCreated,
    person?.id,
    router,
    spaceDbId,
    spaceSlug,
    t,
    updateAgreementBySlug,
    web3SpaceId,
  ]);

  const sellerAmountLabel = `${formatAmount(
    deposit.amountA,
    deposit.tokenADecimals,
  )} ${deposit.tokenASymbol || 'tokens'}`;
  const buyerAmountLabel = `${formatAmount(
    deposit.amountB,
    deposit.tokenBDecimals,
  )} ${deposit.tokenBSymbol || 'tokens'}`;

  const actionLabel = isWaitingReceipt
    ? t('exchangeDepositProposalConfirming')
    : isCreatingDepositProposal
    ? t('exchangeDepositProposalCreating')
    : investment
    ? 'Confirm Investment'
    : t('exchangeDepositProposalCta');

  const bannerTitle = investment
    ? 'Accept Investment'
    : 'Exchange Stakes & Tokens';

  const mutationError = depositProposalError
    ? depositProposalError instanceof Error
      ? depositProposalError.message
      : String(depositProposalError)
    : null;
  const errorMessage = localError ?? mutationError;

  const sellerLabel = counterpartyLabel;

  return (
    <div className="rounded-[8px] border-1 border-accent-6 bg-accent-surface-mix bg-center p-5 flex flex-col lg:flex-row gap-4 lg:gap-5 items-start lg:items-center justify-between">
      <div className="flex items-start gap-3 lg:gap-5 w-full lg:w-auto">
        <ArrowRightIcon
          width={16}
          height={16}
          className="text-foreground flex-shrink-0 mt-1"
        />
        <div className="flex flex-col gap-2 flex-1">
          <span className="text-2 text-foreground font-bold">
            {bannerTitle}
          </span>
          <span className="text-2 text-foreground">
            {investment ? (
              <>
                <span className="font-bold">{sellerLabel}</span> has accepted
                your space's investment of{' '}
                <span className="font-bold">{buyerAmountLabel}</span> and offers{' '}
                <span className="font-bold">{sellerAmountLabel}</span> in
                return.
              </>
            ) : (
              <>
                <span className="font-bold">{sellerLabel}</span> has proposed to
                exchange <span className="font-bold">{sellerAmountLabel}</span>{' '}
                for <span className="font-bold">{buyerAmountLabel}</span> from
                your space.
              </>
            )}
          </span>
          {errorMessage ? (
            <span className="text-2 text-error-11 break-all">
              {errorMessage}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 w-full lg:w-auto justify-between lg:justify-normal">
        <Button
          onClick={handleClick}
          disabled={isCreatingDepositProposal || isWaitingReceipt}
          className="w-full lg:w-fit text-wrap justify-center"
        >
          {(isCreatingDepositProposal || isWaitingReceipt) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {actionLabel}
        </Button>
        {onDismiss ? (
          <Button
            onClick={onDismiss}
            variant="ghost"
            aria-label={tCommon('close')}
            className="group rounded-full w-fit flex-shrink-0 text-foreground"
          >
            <Cross1Icon
              width={16}
              height={16}
              className="transition-colors group-hover:text-white dark:group-hover:text-foreground"
            />
          </Button>
        ) : null}
      </div>
    </div>
  );
};
