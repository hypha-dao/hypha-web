'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SpaceGroupCallCaptureConsent } from '@hypha-platform/core/client';

type HumanChatPanelCaptureConsentBannerProps = {
  consent: SpaceGroupCallCaptureConsent | null;
  variant?: 'join' | 'inCall';
  className?: string;
};

function captureModeLabel(
  t: ReturnType<typeof useTranslations<'HumanChatPanel'>>,
  mode: SpaceGroupCallCaptureConsent['mode'],
): string {
  return mode === 'transcript_only'
    ? t('callCaptureModeTranscriptOnly')
    : t('callCaptureModeRecordingWithTranscript');
}

export function HumanChatPanelCaptureConsentBanner({
  consent,
  variant = 'inCall',
  className,
}: HumanChatPanelCaptureConsentBannerProps) {
  const t = useTranslations('HumanChatPanel');
  if (!consent) return null;

  const mode = captureModeLabel(t, consent.mode);
  const pausedSuffix = consent.paused
    ? t('callCaptureConsentPausedSuffix')
    : '';

  let message: string;
  if (variant === 'join') {
    message = t('callCaptureConsentJoin', {
      actor: consent.actor,
      mode,
    });
  } else if (consent.isLocalInitiator) {
    message = t('callCaptureConsentLocal', { mode });
  } else {
    message = t('callCaptureConsentRemote', {
      actor: consent.actor,
      mode,
    });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'border-b border-amber-500/35 bg-amber-500/12 px-4 py-2',
        className,
      )}
    >
      <p className="text-xs font-medium leading-snug text-amber-950 dark:text-amber-50">
        {message}
        {pausedSuffix}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-amber-900/90 dark:text-amber-100/90">
        {t('callCaptureConsentLegalNote')}
      </p>
    </div>
  );
}
