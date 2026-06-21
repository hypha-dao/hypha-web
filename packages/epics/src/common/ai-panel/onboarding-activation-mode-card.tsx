'use client';

import clsx from 'clsx';
import { useTranslations } from 'next-intl';

import { Card } from '@hypha-platform/ui';

import type { OnboardingActivationMethod } from '../onboarding-activation-ui';

type OnboardingActivationModeCardProps = {
  disabled?: boolean;
  onSelect: (method: OnboardingActivationMethod) => void;
};

export function OnboardingActivationModeCard({
  disabled = false,
  onSelect,
}: OnboardingActivationModeCardProps) {
  const tAi = useTranslations('AiPanel');
  const tSpaces = useTranslations('Spaces');

  const options: Array<{
    method: OnboardingActivationMethod;
    title: string;
    description: string;
  }> = [
    {
      method: 'sandbox',
      title: tSpaces('sandboxMode'),
      description: tSpaces('sandboxDescription'),
    },
    {
      method: 'pilot',
      title: tSpaces('pilotMode'),
      description: tSpaces('pilotDescription'),
    },
    {
      method: 'deployment',
      title: tSpaces('liveMode'),
      description: tSpaces('liveDescription'),
    },
  ];

  return (
    <div className="rounded-xl border border-border/80 bg-background/90 p-4 shadow-sm">
      <p className="mb-1 text-sm font-medium text-foreground">
        {tAi('onboardingActivationTitle')}
      </p>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {tAi('onboardingActivationHint')}
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
