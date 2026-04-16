'use client';

import React from 'react';
import { formatUnits } from 'viem';
import { ArrowRightIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  PendingEscrowDeposit,
  publicClient,
  useSpaceExchangeDepositProposalMutation,
} from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

type Props = {
  /** Escrow slot waiting for this space to fund. */
  deposit: PendingEscrowDeposit;
  /** Web3 id of the space that owes the deposit. */
  web3SpaceId: number;
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
  spaceAddress,
  executorAddress,
  spaceSlug,
  lang,
  onProposalCreated,
}: Props) => {
  const t = useTranslations('Spaces');
  const {
    createDepositProposal,
    isCreatingDepositProposal,
    depositProposalError,
  } = useSpaceExchangeDepositProposalMutation();
  const [isWaitingReceipt, setIsWaitingReceipt] = React.useState(false);
  const router = useRouter();

  const handleClick = React.useCallback(async () => {
    try {
      const hash = await createDepositProposal({
        spaceId: web3SpaceId,
        escrowId: deposit.escrowId,
        payToken: deposit.payToken,
        payAmount: deposit.payAmount,
        treasuryAddress: spaceAddress ?? null,
        executorAddress,
        title: t('exchangeDepositProposalTitle', {
          amount: formatAmount(deposit.payAmount, deposit.payTokenDecimals),
          symbol: deposit.payTokenSymbol || 'tokens',
          escrowId: deposit.escrowId.toString(),
        }),
        description: t('exchangeDepositProposalDescription', {
          amount: formatAmount(deposit.payAmount, deposit.payTokenDecimals),
          symbol: deposit.payTokenSymbol || 'tokens',
          escrowId: deposit.escrowId.toString(),
        }),
      });
      if (hash) {
        setIsWaitingReceipt(true);
        await publicClient.waitForTransactionReceipt({ hash });
      }
      onProposalCreated?.();
      router.push(`/${lang}/dho/${spaceSlug}/agreements`);
    } catch (err) {
      console.error('Space escrow deposit proposal failed:', err);
    } finally {
      setIsWaitingReceipt(false);
    }
  }, [
    createDepositProposal,
    deposit,
    executorAddress,
    lang,
    onProposalCreated,
    router,
    spaceAddress,
    spaceSlug,
    t,
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

  const errorMessage = depositProposalError
    ? depositProposalError instanceof Error
      ? depositProposalError.message
      : String(depositProposalError)
    : null;

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
