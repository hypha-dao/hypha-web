'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, PanelRightClose, Settings } from 'lucide-react';
import { useSidebar } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type HumanChatPanelHeaderProps = {
  title?: string;
  description?: string;
  onBack?: () => void;
  /** Controls after the sidebar/back control (e.g. mention inbox bell). Same row height as other header buttons. */
  trailingStart?: ReactNode;
  /**
   * Opens notification preferences (right of the mention bell in the top row).
   * Same target as the former settings control on the tab row.
   */
  notificationSettingsHref?: string | null;
};

export function HumanChatPanelHeader({
  title,
  description,
  onBack,
  trailingStart,
  notificationSettingsHref,
}: HumanChatPanelHeaderProps) {
  const { setOpen, setOpenMobile } = useSidebar();
  const router = useRouter();
  const t = useTranslations('HumanChatPanel');

  const displayTitle = title ?? t('title');
  const displayDescription = description;

  return (
    <div className="flex h-[var(--menu-top-height,70px)] min-w-0 items-center gap-2 border-b border-border/70 bg-background-5 px-3 dark:bg-background-2">
      <div className="flex shrink-0 items-center gap-0.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex size-9 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label={t('backToSpaceChat')}
          >
            <ArrowLeft className="craft-icon" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              // Keep both desktop/sidebar and mobile/sheet states in sync.
              setOpen(false);
              setOpenMobile(false);
            }}
            className="flex size-9 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            title={t('hidePanel')}
            aria-label={t('closePanel')}
          >
            <PanelRightClose className="craft-icon" />
          </button>
        )}
        {trailingStart}
        {notificationSettingsHref ? (
          <button
            type="button"
            onClick={() => {
              // Close chat panel first so settings overlay is not hidden behind it.
              setOpen(false);
              setOpenMobile(false);
              router.push(notificationSettingsHref);
            }}
            className="flex size-9 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label={t('mentionInboxNotificationSettings')}
            title={t('mentionInboxNotificationSettings')}
          >
            <Settings className="craft-icon" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {displayDescription && (
          <p className="craft-meta line-clamp-1">{displayDescription}</p>
        )}
        {displayTitle ? (
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {displayTitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}
