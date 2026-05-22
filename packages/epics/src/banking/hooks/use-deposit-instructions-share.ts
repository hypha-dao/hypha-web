'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { copyToClipboard } from '@hypha-platform/ui-utils';

import {
  formatBankInstructionsCopyText,
  getBankInstructionBlocks,
  getDepositMessage,
} from '../deposit-instruction-display';
import type {
  BankTransferPublic,
  BankVirtualAccountPublic,
} from '../hooks/types';

type ShareSource = {
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  depositMessage?: string | null;
};

function toShareSource(
  account?: BankVirtualAccountPublic | null,
  transfer?: BankTransferPublic | null,
): ShareSource | null {
  if (transfer) {
    return {
      paymentRail: transfer.paymentRail,
      depositInstructions: transfer.depositInstructions,
      depositMessage: transfer.depositMessage,
    };
  }
  if (account) {
    return {
      paymentRail: account.paymentRail,
      depositInstructions: account.depositInstructions,
    };
  }
  return null;
}

export function useDepositInstructionsShare({
  account,
  transfer,
}: {
  account?: BankVirtualAccountPublic | null;
  transfer?: BankTransferPublic | null;
}) {
  const t = useTranslations('BankingTab.depositInstructions');
  const [shareCopied, setShareCopied] = useState(false);

  const source = toShareSource(account, transfer);

  const shareText = useMemo(() => {
    if (!source) {
      return '';
    }

    const blocks = getBankInstructionBlocks(
      source.paymentRail,
      source.depositInstructions,
    );
    const depositMessage = getDepositMessage(
      source.depositInstructions,
      source.depositMessage,
    );

    if (blocks.length === 0 && !depositMessage) {
      return '';
    }

    return formatBankInstructionsCopyText({
      blocks,
      depositMessage,
      resolveLabel: (key) => {
        try {
          return t(key as Parameters<typeof t>[0]);
        } catch {
          return key;
        }
      },
    });
  }, [source, t]);

  const handleShare = useCallback(() => {
    if (!shareText) {
      return;
    }

    copyToClipboard(shareText);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2000);
  }, [shareText]);

  return { handleShare, shareCopied, canShare: Boolean(shareText) };
}
