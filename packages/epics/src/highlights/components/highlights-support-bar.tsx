'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import {
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import type {
  HighlightsProfile,
  HighlightsSupportAction,
} from '@hypha-platform/core/client';
import { useFundWallet } from '../../treasury/hooks';

type HighlightsSupportBarProps = {
  spaceSlug: string;
  profile: HighlightsProfile;
};

function actionLabel(
  action: HighlightsSupportAction,
  t: ReturnType<typeof useTranslations<'HighlightsTab'>>,
) {
  if (action.label === 'custom' && action.customLabel)
    return action.customLabel;
  return t(`actions.${action.label}`);
}

export function HighlightsSupportBar({
  spaceSlug,
  profile,
}: HighlightsSupportBarProps) {
  const t = useTranslations('HighlightsTab');
  const { space } = useSpaceBySlug(spaceSlug);
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: space?.web3SpaceId as number,
  });
  const executor = spaceDetails?.executor as `0x${string}` | undefined;
  const { fundWallet } = useFundWallet({
    address: executor,
    title: t('support.fundTitle'),
    subtitle: t('support.fundSubtitle'),
  });
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [activeAction, setActiveAction] =
    useState<HighlightsSupportAction | null>(null);

  const enabledActions = profile.supportActions.filter((a) => a.enabled);
  if (enabledActions.length === 0) return null;

  const goalLabel =
    profile.goalAmount && profile.goalCurrency
      ? t('support.goal', {
          amount: profile.goalAmount,
          currency: profile.goalCurrency,
        })
      : null;

  const onAction = async (action: HighlightsSupportAction) => {
    if (action.destination === 'external_url' && action.externalUrl) {
      window.open(action.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action.destination === 'wallet') {
      await fundWallet();
      return;
    }
    setActiveAction(action);
    setInstructionOpen(true);
  };

  return (
    <>
      <div className="sticky top-0 z-10 -mx-1 border-b border-border bg-background/95 px-1 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-2 text-neutral-11">
            {goalLabel ?? t('support.ctaPrompt')}
          </div>
          <div className="flex flex-wrap gap-2">
            {enabledActions.map((action) => (
              <Button
                key={action.id}
                colorVariant="accent"
                onClick={() => void onAction(action)}
              >
                {actionLabel(action, t)}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <Dialog open={instructionOpen} onOpenChange={setInstructionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeAction
                ? actionLabel(activeAction, t)
                : t('support.instructions')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-2 text-neutral-11 whitespace-pre-wrap">
            {activeAction?.copyInstructions?.trim() ||
              t('support.contactSpace')}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
