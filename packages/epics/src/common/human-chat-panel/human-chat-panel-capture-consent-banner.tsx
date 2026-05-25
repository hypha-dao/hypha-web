'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SpaceGroupCallCaptureConsent } from '@hypha-platform/core/client';
import { useResolvedMatrixMemberLabel } from './use-resolved-matrix-member-label';

type HumanChatPanelCaptureConsentBannerProps = {
  consent: SpaceGroupCallCaptureConsent | null;
  roomId?: string | null;
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
  roomId = null,
  variant = 'inCall',
  className,
}: HumanChatPanelCaptureConsentBannerProps) {
  const t = useTranslations('HumanChatPanel');
  const actorUserId = consent?.actorUserId?.trim() ?? '';
  const resolvedActor = useResolvedMatrixMemberLabel({
    matrixUserId: actorUserId || undefined,
    roomId,
    fallbackLabel: consent?.actor ?? '',
  });

  if (!consent) return null;

  const mode = captureModeLabel(t, consent.mode);
  const pausedSuffix = consent.paused
    ? t('callCaptureConsentPausedSuffix')
    : '';
  const actorLabel =
    resolvedActor.trim() ||
    consent.actor.trim() ||
    t('callCaptureConsentActorFallback');

  let message: string;
  if (variant === 'join') {
    message = t('callCaptureConsentJoin', {
      actor: actorLabel,
      mode,
    });
  } else if (consent.isLocalInitiator) {
    message = t('callCaptureConsentLocal', { mode });
  } else {
    message = t('callCaptureConsentRemote', {
      actor: actorLabel,
      mode,
    });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'border-b px-4 py-2',
        variant === 'inCall'
          ? 'border-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_40%,transparent)] bg-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_28%,var(--background))]'
          : 'border-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_12%,var(--background))]',
        className,
      )}
    >
      <p
        className={cn(
          'text-xs font-medium leading-snug',
          variant === 'inCall'
            ? 'text-[color:var(--color-accent-contrast,#f8fafc)]'
            : 'text-[color:var(--color-accent-12,var(--foreground))]',
        )}
      >
        {message}
        {pausedSuffix}
      </p>
      <p
        className={cn(
          'mt-0.5 text-[11px] leading-snug',
          variant === 'inCall'
            ? 'text-[color:color-mix(in_srgb,var(--color-accent-contrast,#f8fafc)_88%,transparent)]'
            : 'text-[color:color-mix(in_srgb,var(--color-accent-11,var(--foreground))_85%,transparent)]',
        )}
      >
        {t('callCaptureConsentLegalNote')}
      </p>
    </div>
  );
}
