'use client';

import { Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

type LocalScreenSharePlaceholderProps = {
  isFullView?: boolean;
  panelFlush?: boolean;
  className?: string;
};

/** Shown to the sharer instead of mirroring their own capture (avoids hall-of-mirrors). */
export function LocalScreenSharePlaceholder({
  isFullView = false,
  panelFlush = false,
  className,
}: LocalScreenSharePlaceholderProps) {
  const t = useTranslations('HumanChatPanel');

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col items-center justify-center gap-3 bg-black text-zinc-50',
        isFullView
          ? 'min-h-0 flex-1'
          : panelFlush
          ? 'min-h-[min(32vh,240px)] flex-1'
          : 'min-h-[min(42vh,360px)] rounded-md',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Monitor
        className={cn(
          'opacity-80',
          isFullView ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-8 w-8',
        )}
        aria-hidden
      />
      <p
        className={cn(
          'max-w-[90%] text-center font-medium text-zinc-100',
          isFullView ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
        )}
      >
        {t('callYouAreSharingScreen')}
      </p>
      <p className="max-w-[90%] text-center text-xs text-zinc-400">
        {t('callYouAreSharingScreenHint')}
      </p>
    </div>
  );
}
