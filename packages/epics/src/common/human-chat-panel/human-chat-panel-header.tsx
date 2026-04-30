'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageCircle,
  PanelRightClose,
  Settings,
} from 'lucide-react';
import { useSidebar } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

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
  const { toggleSidebar } = useSidebar();
  const t = useTranslations('HumanChatPanel');

  const displayTitle = title ?? t('title');
  const displayDescription = description;

  return (
    <div className="flex min-h-[var(--menu-top-height,70px)] min-w-0 items-center gap-2 border-b border-border bg-background-2 px-4 py-3">
      <div className="flex shrink-0 items-center gap-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('backToSpaceChat')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t('hidePanel')}
            aria-label={t('closePanel')}
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </button>
        )}
        {trailingStart}
        {notificationSettingsHref ? (
          <Link
            href={notificationSettingsHref}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('mentionInboxNotificationSettings')}
            title={t('mentionInboxNotificationSettings')}
          >
            <Settings className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {displayDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {displayDescription}
          </p>
        )}
        <span className="font-semibold text-sm text-foreground truncate min-w-0">
          {displayTitle}
        </span>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary">
          <MessageCircle className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      </div>
    </div>
  );
}
