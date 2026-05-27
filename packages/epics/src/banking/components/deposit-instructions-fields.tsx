'use client';

import { FC, useMemo } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  getBankInstructionBlocks,
  getCompletedTransferIban,
  getDepositMessage,
  getDestinationFromInstructions,
  getDeveloperFeeDisplay,
  splitInstructionBlocksForTransferReference,
} from '../deposit-instruction-display';
import { useDepositInstructionsShare } from '../hooks/use-deposit-instructions-share';
import type {
  BankTransferPublic,
  BankVirtualAccountPublic,
} from '../hooks/types';
import {
  BANKING_REFERENCE_WARNING_BANNER_CLASS,
  isTransferDepositInstructionsReadOnly,
} from '../banking-ui';
import { CopyableInstructionBlock } from './copyable-instruction-block';
import { TreasuryDestinationCard } from './treasury-destination-card';
import { TransferReceiptBox } from './transfer-bridge-receipt-section';

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
  const tDetails = useTranslations('BankingTab.transferDetails');
  const source = toPanelSource(props);

  const instructionsReadOnly = props.transfer
    ? isTransferDepositInstructionsReadOnly(props.transfer)
    : false;

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

  const { leadingBlocks, trailingBlocks } = useMemo(() => {
    if (!props.transfer || !source) {
      return { leadingBlocks: blocks, trailingBlocks: [] as typeof blocks };
    }
    const { leading, trailing } = splitInstructionBlocksForTransferReference(
      blocks,
      source.paymentRail,
    );
    return { leadingBlocks: leading, trailingBlocks: trailing };
  }, [blocks, props.transfer, source]);

  const depositMessage = useMemo(
    () =>
      source
        ? getDepositMessage(source.depositInstructions, source.depositMessage)
        : null,
    [source],
  );

  const completedIban = useMemo(
    () =>
      instructionsReadOnly && source
        ? getCompletedTransferIban(source.depositInstructions)
        : null,
    [instructionsReadOnly, source],
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

  const hasBankBlocks =
    instructionsReadOnly && props.transfer
      ? Boolean(completedIban || depositMessage || props.transfer)
      : blocks.length > 0 || depositMessage;

  return (
    <div className="flex flex-col gap-6">
      {hasBankBlocks ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h5 className="text-2 font-semibold text-foreground">
              {t('bankInstructionsSection')}
            </h5>
            {canShare && !instructionsReadOnly ? (
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
          <div
            className={cn(
              'flex flex-col gap-2',
              instructionsReadOnly && 'opacity-80',
            )}
          >
            {depositMessage && props.transfer && !instructionsReadOnly ? (
              <p className={BANKING_REFERENCE_WARNING_BANNER_CLASS}>
                {tDetails('referenceWarning')}
              </p>
            ) : null}
            <div className="flex flex-col gap-1">
              {instructionsReadOnly && props.transfer ? (
                <>
                  {completedIban ? (
                    <CopyableInstructionBlock
                      label={t('iban')}
                      value={completedIban}
                      readOnly
                    />
                  ) : null}
                  {depositMessage ? (
                    <CopyableInstructionBlock
                      label={t('depositMessage')}
                      value={depositMessage}
                      readOnly
                    />
                  ) : null}
                  <CopyableInstructionBlock
                    label={tDetails('amountLabel')}
                    value={
                      props.transfer.amount
                        ? `${
                            props.transfer.amount
                          } ${props.transfer.currency.toUpperCase()}`
                        : tDetails('flexibleAmount')
                    }
                    readOnly
                  />
                </>
              ) : (
                <>
                  {leadingBlocks.map((block) => (
                    <CopyableInstructionBlock
                      key={block.id}
                      label={t(block.labelKey as Parameters<typeof t>[0])}
                      value={block.value}
                      readOnly={instructionsReadOnly}
                    />
                  ))}
                  {depositMessage ? (
                    <CopyableInstructionBlock
                      label={t('depositMessage')}
                      value={depositMessage}
                      readOnly={instructionsReadOnly}
                    />
                  ) : null}
                </>
              )}
            </div>
            {!instructionsReadOnly
              ? trailingBlocks.map((block) => (
                  <CopyableInstructionBlock
                    key={block.id}
                    label={t(block.labelKey as Parameters<typeof t>[0])}
                    value={block.value}
                    readOnly={instructionsReadOnly}
                  />
                ))
              : null}
            {props.transfer && !instructionsReadOnly ? (
              <div
                className={cn(
                  'rounded-md border border-border/70 bg-muted/25',
                  'px-3 py-2.5',
                )}
              >
                <p className="text-1 font-medium text-muted-foreground">
                  {tDetails('amountLabel')}
                </p>
                <p className="mt-1 text-2 font-medium text-foreground">
                  {props.transfer.amount
                    ? `${
                        props.transfer.amount
                      } ${props.transfer.currency.toUpperCase()}`
                    : tDetails('flexibleAmount')}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {instructionsReadOnly && props.transfer ? (
        <>
          <div className="border-t border-border" />
          <TransferReceiptBox
            depositInstructions={props.transfer.depositInstructions}
          />
        </>
      ) : null}

      {destination ? (
        <>
          <div className="border-t border-border" />
          <section
            className={cn(
              'flex flex-col gap-3',
              instructionsReadOnly && 'opacity-80',
            )}
          >
            <h5 className="text-2 font-semibold text-foreground">
              {t('treasurySection')}
            </h5>
            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
              <TreasuryDestinationCard
                address={destination.address}
                currencyLabel={destination.currency.toUpperCase()}
                destinationCurrency={destination.currency}
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
