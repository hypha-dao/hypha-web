'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import {
  callAccentAlertActionButtonClassName,
  callAccentAlertCompactRowClassName,
} from './call-accent-alert-styles';

type CallScreenshareTabAudioPipStripProps = {
  onRetry: () => void;
};

/** Document PiP — one full-width action; no header chrome or long warning copy. */
export function CallScreenshareTabAudioPipStrip({
  onRetry,
}: CallScreenshareTabAudioPipStripProps) {
  const t = useTranslations('HumanChatPanel');

  return (
    <div
      role="status"
      className={callAccentAlertCompactRowClassName(
        'shrink-0 border-x-0 px-1.5 py-1',
      )}
    >
      <p className="sr-only">{t('callShareTabAudioNotShared')}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          callAccentAlertActionButtonClassName,
          'h-7 w-full justify-center',
        )}
      >
        {t('callShareTabAudioRetry')}
      </button>
    </div>
  );
}
