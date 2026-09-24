'use client';

import { MessageSquareText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';

import type { OnboardingDiscoveryMode } from '../onboarding-discovery-mode';
import { LiveVoiceMicIcon } from './live-voice-mic-icon';

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
      className={className}
      role="group"
      aria-label={t('onboardingDiscoveryModeLabel')}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={mode === 'chat' ? 'default' : 'outline'}
          colorVariant="accent"
          disabled={disabled}
          aria-pressed={mode === 'chat'}
          onClick={() => onChange('chat')}
          className="shadow-none"
        >
          <MessageSquareText
            className="size-3.5"
            strokeWidth={1.25}
            aria-hidden
          />
          {t('onboardingDiscoveryModeChat')}
        </Button>
        <Button
          type="button"
          variant={mode === 'voice_interview' ? 'default' : 'outline'}
          colorVariant="accent"
          disabled={disabled}
          aria-pressed={mode === 'voice_interview'}
          onClick={() => onChange('voice_interview')}
          className="shadow-none"
        >
          <LiveVoiceMicIcon size="sm" />
          {t('onboardingDiscoveryModeVoice')}
        </Button>
      </div>
    </div>
  );
}
