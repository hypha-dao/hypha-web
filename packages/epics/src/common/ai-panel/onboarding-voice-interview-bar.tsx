'use client';

import { Mic, MicOff, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import type { VoiceInterviewPhase } from '../use-onboarding-voice-interview';

type OnboardingVoiceInterviewBarProps = {
  phase: VoiceInterviewPhase;
  liveTranscript: string;
  voiceError: string | null;
  disabled?: boolean;
  onToggleListening: () => void;
  onStopSpeaking: () => void;
};

function VoiceOrb({ phase }: { phase: VoiceInterviewPhase }) {
  const active = phase === 'listening' || phase === 'speaking';
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      {active ? (
        <>
          <span
            className={cn(
              'absolute inset-0 rounded-full opacity-40 blur-md',
              phase === 'listening' ? 'bg-info-9' : 'bg-accent-9',
            )}
            aria-hidden
          />
          <span
            className={cn(
              'absolute inset-1 animate-pulse rounded-full border',
              phase === 'listening'
                ? 'border-info-8/60 bg-info-3/30'
                : 'border-accent-8/60 bg-accent-3/30',
            )}
            aria-hidden
          />
        </>
      ) : null}
      <span
        className={cn(
          'relative flex h-12 w-12 items-center justify-center rounded-full border shadow-sm',
          phase === 'listening'
            ? 'border-info-8 bg-info-9 text-info-contrast'
            : phase === 'speaking'
            ? 'border-accent-8 bg-accent-9 text-accent-contrast'
            : 'border-border bg-muted text-foreground',
        )}
      >
        <Mic className="size-5" aria-hidden />
      </span>
    </div>
  );
}

export function OnboardingVoiceInterviewBar({
  phase,
  liveTranscript,
  voiceError,
  disabled = false,
  onToggleListening,
  onStopSpeaking,
}: OnboardingVoiceInterviewBarProps) {
  const t = useTranslations('AiPanel');

  const statusKey =
    phase === 'listening'
      ? 'onboardingVoiceStatusListening'
      : phase === 'processing'
      ? 'onboardingVoiceStatusThinking'
      : phase === 'speaking'
      ? 'onboardingVoiceStatusSpeaking'
      : 'onboardingVoiceStatusReady';

  const errorMessage =
    voiceError === 'unsupported'
      ? t('onboardingVoiceUnsupported')
      : voiceError
      ? t('onboardingVoiceError')
      : null;

  return (
    <div className="border-t border-border/70 bg-background/90 px-4 py-4 md:px-5">
      <p className="mb-1 text-center text-sm font-medium text-foreground">
        {t('onboardingVoiceInterviewTitle')}
      </p>
      <p className="mb-4 text-center text-xs leading-relaxed text-muted-foreground">
        {t('onboardingVoiceInterviewHint')}
      </p>

      <div className="flex flex-col items-center gap-3">
        <VoiceOrb phase={phase} />
        <p className="text-xs font-medium text-muted-foreground">
          {t(statusKey)}
        </p>
        {liveTranscript ? (
          <p className="max-w-xl text-center text-sm text-foreground/90">
            “{liveTranscript}”
          </p>
        ) : null}
        {errorMessage ? (
          <p className="text-center text-xs text-destructive">{errorMessage}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            disabled={
              disabled || phase === 'processing' || phase === 'speaking'
            }
            onClick={onToggleListening}
            className="min-w-[140px]"
          >
            {phase === 'listening' ? (
              <>
                <MicOff className="size-4" aria-hidden />
                {t('onboardingVoiceFinishTurn')}
              </>
            ) : (
              <>
                <Mic className="size-4" aria-hidden />
                {t('onboardingVoiceStartListening')}
              </>
            )}
          </Button>
          {phase === 'speaking' ? (
            <Button
              type="button"
              variant="outline"
              onClick={onStopSpeaking}
              className="min-w-[120px]"
            >
              <Square className="size-4" aria-hidden />
              {t('onboardingVoiceStopSpeaking')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
