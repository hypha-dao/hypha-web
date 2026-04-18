'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

type HumanChatPanelUnreadDividerProps = {
  className?: string;
};

/** Full-width red rule + “NEW” pill (Discord-style unread boundary). */
export function HumanChatPanelUnreadDivider({
  className,
}: HumanChatPanelUnreadDividerProps) {
  const t = useTranslations('HumanChatPanel');

  return (
    <div
      className={cn('relative my-2 flex h-6 w-full items-center', className)}
      role="separator"
      aria-label={t('unreadDividerAria')}
    >
      <div className="h-px flex-1 bg-destructive" aria-hidden />
      <span className="shrink-0 rounded bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground shadow-sm">
        {t('unreadDividerBadge')}
      </span>
    </div>
  );
}
