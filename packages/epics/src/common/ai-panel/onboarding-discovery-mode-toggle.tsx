'use client';

import { MessageSquareText, Mic } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

import type { OnboardingDiscoveryMode } from '../onboarding-discovery-mode';

type OnboardingDiscoveryModeToggleProps = {
  mode: OnboardingDiscoveryMode;
  disabled?: boolean;
  onChange: (mode: OnboardingDiscoveryMode) => void;
  className?: string;
};

export function OnboardingDiscoveryModeToggle({
  mode,
  disabled = false,
  onChange,
  className,
}: OnboardingDiscoveryModeToggleProps) {
  const t = useTranslations('AiPanel');

  return (
    <div
      className={cn(
        'inline-flex rounded-full border border-border/70 bg-background/80 p-0.5 shadow-sm',
        className,
      )}
      role="group"
      aria-label={t('onboardingDiscoveryModeLabel')}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('chat')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          mode === 'chat'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <MessageSquareText className="size-3.5" aria-hidden />
        {t('onboardingDiscoveryModeChat')}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('voice_interview')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          mode === 'voice_interview'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Mic className="size-3.5" aria-hidden />
        {t('onboardingDiscoveryModeVoice')}
      </button>
    </div>
  );
}
