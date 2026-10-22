'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { getCoherenceBySlug } from '@hypha-platform/core/coherence/server/web3';
import { cn } from '@hypha-platform/ui-utils';
import { stageSignalAsContributionProposal } from '../utils/signal-to-proposal';

type SignalTurnIntoProposalButtonProps = {
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  payouts?: Array<{ amount: string; token: string }>;
  disabled?: boolean;
  className?: string;
};

export function SignalTurnIntoProposalButton({
  slug,
  title,
  description,
  payouts,
  disabled = false,
  className,
}: SignalTurnIntoProposalButtonProps) {
  const t = useTranslations('CoherenceTab');
  const router = useRouter();
  const params = useParams<{ lang?: string; id?: string }>();
  const [isOpening, setIsOpening] = React.useState(false);

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const lang = params.lang?.trim();
    const spaceSlug = params.id?.trim();
    if (!lang || !spaceSlug || isOpening) return;

    setIsOpening(true);
    try {
      let nextTitle = title?.trim() ?? '';
      let nextDescription = description ?? '';
      let nextPayouts = payouts ?? [];
      let nextLeadImage: string | null = null;
      let nextAttachments: Array<{ name: string; url: string }> = [];
      const signalSlug = slug?.trim();
      if (signalSlug) {
        try {
          const signal = await getCoherenceBySlug({ slug: signalSlug });
          if (signal) {
            nextTitle = signal.title;
            nextDescription = signal.description;
            nextPayouts = signal.indicativePayouts ?? [];
            nextLeadImage = signal.leadImage;
            nextAttachments = signal.attachments ?? [];
          }
        } catch (error) {
          console.warn(
            'Could not load signal amounts before opening the proposal:',
            error,
          );
        }
      }
      stageSignalAsContributionProposal({
        title: nextTitle,
        description: nextDescription,
        payouts: nextPayouts,
        leadImage: nextLeadImage,
        attachments: nextAttachments,
      });
      router.push(
        `/${lang}/dho/${spaceSlug}/agreements/create/propose-contribution`,
      );
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      colorVariant="neutral"
      className={cn('shrink-0', className)}
      disabled={disabled || isOpening || !params.id}
      onClick={handleClick}
    >
      {t('turnIntoProposal')}
    </Button>
  );
}
