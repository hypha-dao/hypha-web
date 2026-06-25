'use client';

import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { Building2, Layers } from 'lucide-react';

import { Card } from '@hypha-platform/ui';

import type { OnboardingSetupJourney } from '../onboarding-setup-journey-ui';

type OnboardingSetupJourneyCardProps = {
  disabled?: boolean;
  onSelect: (journey: OnboardingSetupJourney, submitLabel: string) => void;
};

export function OnboardingSetupJourneyCard({
  disabled = false,
  onSelect,
}: OnboardingSetupJourneyCardProps) {
  const tAi = useTranslations('AiPanel');

  const options: Array<{
    journey: OnboardingSetupJourney;
    title: string;
    description: string;
    icon: typeof Layers;
  }> = [
    {
      journey: 'single_space',
      title: tAi('onboardingSetupJourneySingleTitle'),
      description: tAi('onboardingSetupJourneySingleDescription'),
      icon: Layers,
    },
    {
      journey: 'ecosystem',
      title: tAi('onboardingSetupJourneyEcosystemTitle'),
      description: tAi('onboardingSetupJourneyEcosystemDescription'),
      icon: Building2,
    },
  ];

  return (
    <div className="rounded-xl border border-border/80 bg-background/90 p-4 shadow-sm">
      <p className="mb-1 text-sm font-medium text-foreground">
        {tAi('onboardingSetupJourneyTitle')}
      </p>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {tAi('onboardingSetupJourneyHint')}
      </p>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <Card
              key={option.journey}
              className={clsx(
                'flex cursor-pointer p-4 transition-colors',
                disabled
                  ? 'pointer-events-none opacity-60'
                  : 'hover:border-accent-5',
              )}
              onClick={() => {
                if (disabled) return;
                onSelect(option.journey, option.title);
              }}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-accent-9" />
                <div className="flex flex-col gap-1">
                  <span className="text-2 font-medium">{option.title}</span>
                  <span className="text-1 text-neutral-11">
                    {option.description}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
