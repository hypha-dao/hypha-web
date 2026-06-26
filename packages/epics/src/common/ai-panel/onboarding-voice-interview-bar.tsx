'use client';

import { MicOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import type { VoiceInterviewPhase } from '../use-onboarding-voice-interview';
import { LiveVoiceMicIcon } from './live-voice-mic-icon';

type OnboardingVoiceInterviewBarProps = {
  phase: VoiceInterviewPhase;
  liveTranscript: string;
  voiceError: string | null;
  disabled?: boolean;
  isConnecting?: boolean;
  isRealtimeConnected?: boolean;
  transport?: 'realtime' | 'web_speech';
  realtimeFeatureEnabled?: boolean;
  usingWebSpeechFallback?: boolean;
  onToggleListening: () => void;
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
        <LiveVoiceMicIcon size="md" />
      </span>
    </div>
  );
}

export function OnboardingVoiceInterviewBar({
  phase,
  liveTranscript,
  voiceError,
  disabled = false,
  isConnecting = false,
  isRealtimeConnected = false,
  transport = 'web_speech',
  realtimeFeatureEnabled = false,
  usingWebSpeechFallback = false,
  onToggleListening,
}: OnboardingVoiceInterviewBarProps) {
  const t = useTranslations('AiPanel');

  const transportBadgeLabel =
    transport === 'realtime'
      ? isRealtimeConnected
        ? t('onboardingVoiceRealtimeLive')
        : isConnecting
        ? t('onboardingVoiceTransportConnecting')
        : t('onboardingVoiceTransportRealtime')
      : realtimeFeatureEnabled && usingWebSpeechFallback
      ? null
      : t('onboardingVoiceTransportBrowser');

  const statusKey = isConnecting
    ? 'onboardingVoiceStatusConnecting'
    : phase === 'listening'
    ? 'onboardingVoiceStatusListening'
    : phase === 'processing'
    ? 'onboardingVoiceStatusThinking'
    : phase === 'speaking'
    ? 'onboardingVoiceStatusSpeaking'
    : 'onboardingVoiceStatusReady';

  const errorMessage =
    voiceError === 'unsupported'
      ? t('onboardingVoiceUnsupported')
      : voiceError === 'not-allowed'
      ? t('onboardingVoicePermissionDenied')
      : voiceError === 'audio-capture'
      ? t('onboardingVoiceMicUnavailable')
      : voiceError === 'network'
      ? t('onboardingVoiceNetworkError')
      : voiceError === 'session'
      ? t('onboardingVoiceSessionError')
      : voiceError === 'blocked'
      ? t('onboardingVoiceInteractionBlocked')
      : voiceError
      ? t('onboardingVoiceError')
      : null;

  const needsRealtimeConnection =
    transport === 'realtime' &&
    !isRealtimeConnected &&
    !isConnecting &&
    phase !== 'listening';

  const startButtonLabel = needsRealtimeConnection
    ? t('onboardingVoiceStartConversation')
    : t('onboardingVoiceStartListening');

  const realtimeMicAlwaysOn =
    transport === 'realtime' && (isRealtimeConnected || isConnecting);

  return (
    <div className="border-t border-border/70 bg-background/90 px-4 py-4 md:px-5">
      <div className="mb-1 flex items-center justify-center gap-2">
        <p className="text-center text-sm font-medium text-foreground">
          {t('onboardingVoiceInterviewTitle')}
        </p>
        {transportBadgeLabel ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              transport === 'realtime' && isRealtimeConnected
                ? 'bg-accent-9/15 text-accent-11'
                : transport === 'realtime'
                ? 'bg-info-9/15 text-info-11'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {transportBadgeLabel}
          </span>
        ) : null}
      </div>
      <p className="mb-4 text-center text-xs leading-relaxed text-muted-foreground">
        {t('onboardingVoiceInterviewHint')}
      </p>
      {usingWebSpeechFallback ? (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          {t('onboardingVoiceRealtimeFallback')}
        </p>
      ) : null}

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
              disabled ||
              isConnecting ||
              phase === 'processing' ||
              (realtimeMicAlwaysOn && phase === 'speaking')
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
                <LiveVoiceMicIcon size="sm" />
                {startButtonLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
