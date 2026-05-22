'use client';

import { FC, useMemo } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

import {
  getBankInstructionBlocks,
  getDepositMessage,
  getDestinationFromInstructions,
  getDeveloperFeeDisplay,
} from '../deposit-instruction-display';
import { useDepositInstructionsShare } from '../hooks/use-deposit-instructions-share';
import type {
  BankTransferPublic,
  BankVirtualAccountPublic,
} from '../hooks/types';
import { CopyableInstructionBlock } from './copyable-instruction-block';
import { TreasuryDestinationCard } from './treasury-destination-card';

type DepositInstructionsPanelProps = {
  account?: BankVirtualAccountPublic;
  transfer?: BankTransferPublic;
};

function toPanelSource(props: DepositInstructionsPanelProps) {
  if (props.transfer) {
    return {
      paymentRail: props.transfer.paymentRail,
      depositInstructions: props.transfer.depositInstructions,
      depositMessage: props.transfer.depositMessage,
      destinationAddress: props.transfer.destinationAddress,
    };
  }
  if (props.account) {
    return {
      paymentRail: props.account.paymentRail,
      depositInstructions: props.account.depositInstructions,
      depositMessage: null as string | null,
      destinationAddress: props.account.destinationAddress,
    };
  }
  return null;
}

export const DepositInstructionsPanel: FC<DepositInstructionsPanelProps> = (
  props,
) => {
  const t = useTranslations('BankingTab.depositInstructions');
  const source = toPanelSource(props);

  const { handleShare, shareCopied, canShare } = useDepositInstructionsShare({
    account: props.account,
    transfer: props.transfer,
  });

  const blocks = useMemo(
    () =>
      source
        ? getBankInstructionBlocks(
            source.paymentRail,
            source.depositInstructions,
          )
        : [],
    [source],
  );

  const depositMessage = useMemo(
    () =>
      source
        ? getDepositMessage(source.depositInstructions, source.depositMessage)
        : null,
    [source],
  );

  const developerFee = useMemo(
    () => (source ? getDeveloperFeeDisplay(source.depositInstructions) : null),
    [source],
  );

  const destination = useMemo(
    () =>
      source
        ? getDestinationFromInstructions(
            source.depositInstructions,
            source.destinationAddress,
          )
        : null,
    [source],
  );

  if (!source) {
    return null;
  }

  const hasBankBlocks = blocks.length > 0 || depositMessage;

  return (
    <div className="flex flex-col gap-6">
      {hasBankBlocks ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h5 className="text-2 font-semibold text-foreground">
              {t('bankInstructionsSection')}
            </h5>
            {canShare ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={handleShare}
              >
                {shareCopied ? (
                  <Check className="h-3.5 w-3.5 text-success-11" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {shareCopied
                  ? t('copyInstructionsCopied')
                  : t('copyInstructions')}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            {depositMessage ? (
              <CopyableInstructionBlock
                label={t('depositMessage')}
                value={depositMessage}
              />
            ) : null}
            {blocks.map((block) => (
              <CopyableInstructionBlock
                key={block.id}
                label={t(block.labelKey as Parameters<typeof t>[0])}
                value={block.value}
              />
            ))}
          </div>
        </section>
      ) : null}

      {destination ? (
        <>
          <div className="border-t border-border" />
          <section className="flex flex-col gap-3">
            <h5 className="text-2 font-semibold text-foreground">
              {t('treasurySection')}
            </h5>
            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
              <TreasuryDestinationCard
                address={destination.address}
                currencyLabel={destination.currency.toUpperCase()}
              />
              <div className="flex flex-col justify-center gap-2 py-1">
                <p className="text-2 font-semibold text-foreground">
                  {t('hyphaFees')}
                </p>
                <p className="text-2 text-foreground">
                  {developerFee ?? t('feesUnavailable')}
                </p>
                <p className="text-1 text-muted-foreground">
                  {t('providerFeesNote')}
                </p>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

/** @deprecated Use DepositInstructionsPanel */
export const DepositInstructionsFields = DepositInstructionsPanel;
