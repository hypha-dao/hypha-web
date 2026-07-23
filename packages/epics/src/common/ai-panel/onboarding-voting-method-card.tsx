'use client';

import clsx from 'clsx';
import { useTranslations } from 'next-intl';

import { Card } from '@hypha-platform/ui';

import type { OnboardingVotingMethod } from '../onboarding-voting-method-ui';

type OnboardingVotingMethodCardProps = {
  disabled?: boolean;
  onSelect: (method: OnboardingVotingMethod) => void;
};

export function OnboardingVotingMethodCard({
  disabled = false,
  onSelect,
}: OnboardingVotingMethodCardProps) {
  const tAi = useTranslations('AiPanel');
  const tAgreementFlow = useTranslations('AgreementFlow');

  const options: Array<{
    method: OnboardingVotingMethod;
    title: string;
    description: string;
  }> = [
    {
      method: '1m1v',
      title: tAgreementFlow(
        'plugins.votingMethodSelector.oneMemberOneVoteTitle',
      ),
      description: tAgreementFlow(
        'plugins.votingMethodSelector.oneMemberOneVoteDescription',
      ),
    },
    {
      method: '1v1v',
      title: tAgreementFlow(
        'plugins.votingMethodSelector.oneVoiceOneVoteTitle',
      ),
      description: tAgreementFlow(
        'plugins.votingMethodSelector.oneVoiceOneVoteDescription',
      ),
    },
    {
      method: '1t1v',
      title: tAgreementFlow(
        'plugins.votingMethodSelector.oneTokenOneVoteTitle',
      ),
      description: tAgreementFlow(
        'plugins.votingMethodSelector.oneTokenOneVoteDescription',
      ),
    },
  ];

  return (
    <div className="rounded-lg border border-border/80 bg-background/90 p-4 shadow-sm">
      <p className="mb-1 text-sm font-medium text-foreground">
        {tAi('onboardingVotingMethodTitle')}
      </p>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {tAi('onboardingVotingMethodHint')}
      </p>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <Card
            key={option.method}
            className={clsx(
              'flex cursor-pointer p-4 transition-colors',
              disabled
                ? 'pointer-events-none opacity-60'
                : 'hover:border-accent-5',
            )}
            onClick={() => {
              if (disabled) return;
              onSelect(option.method);
            }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-2 font-medium">{option.title}</span>
              <span className="text-1 text-neutral-11">
                {option.description}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
