'use client';

import type { ReactNode } from 'react';
import {
  ArrowLeft,
  MessageCircle,
  PanelRightClose,
  Settings,
} from 'lucide-react';
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
    <div className="flex h-[var(--menu-top-height,70px)] min-w-0 items-center gap-2 border-b border-border bg-background-2 px-4 py-3">
      <div className="flex shrink-0 items-center gap-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('backToSpaceChat')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              // Keep both desktop/sidebar and mobile/sheet states in sync.
              setOpen(false);
              setOpenMobile(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t('hidePanel')}
            aria-label={t('closePanel')}
          >
            <PanelRightClose className="h-4 w-4" />
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('mentionInboxNotificationSettings')}
            title={t('mentionInboxNotificationSettings')}
          >
            <Settings className="h-4 w-4" aria-hidden />
          </button>
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted p-0 ring-1 ring-border/70">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
