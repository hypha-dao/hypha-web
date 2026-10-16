'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, PanelRightClose, Settings } from 'lucide-react';
import { useSidebar } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
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
  /** One room name, in the same box as the space and ecosystem choice. */
  mark?: string;
  /** Two rooms that sit side by side, such as a space and its ecosystem. */
  roomChoice?: {
    value: string;
    options: { value: string; label: string }[];
    ariaLabel: string;
    onChange: (next: string) => void;
  };
};

export function HumanChatPanelHeader({
  title,
  description,
  onBack,
  trailingStart,
  notificationSettingsHref,
  mark,
  roomChoice,
}: HumanChatPanelHeaderProps) {
  const { setOpen, setOpenMobile } = useSidebar();
  const router = useRouter();
  const t = useTranslations('HumanChatPanel');

  const displayTitle = title ?? t('title');
  const displayDescription = description;

  return (
    <div className="flex h-[var(--menu-top-height,70px)] min-w-0 items-center gap-2 border-b border-border/70 bg-page-background px-3 dark:bg-background-2">
      <div className="flex shrink-0 items-center gap-0.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
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
            className="flex h-[36px] w-[36px] items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
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
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
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
        {mark && !roomChoice ? (
          <span className="inline-flex shrink-0 border border-foreground bg-foreground px-3 py-1 text-1 text-background">
            {mark}
          </span>
        ) : null}
        {roomChoice ? (
          <div
            role="group"
            aria-label={roomChoice.ariaLabel}
            className="inline-flex shrink-0 border border-foreground"
          >
            {roomChoice.options.map((option) => {
              const selected = roomChoice.value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => roomChoice.onChange(option.value)}
                  className={cn(
                    'px-3 py-1 text-1',
                    selected
                      ? 'bg-foreground text-background'
                      : 'bg-background text-foreground',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : displayTitle ? (
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {displayTitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}
