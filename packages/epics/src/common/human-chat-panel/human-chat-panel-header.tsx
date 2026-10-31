'use client';

import type { ComponentType, ReactNode } from 'react';
import {
  ArrowLeft,
  Circle,
  Globe,
  Globe2,
  PanelRightClose,
  Settings,
  Target,
} from 'lucide-react';
import {
  CountBadge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useSidebar,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type RoomChoiceIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}>;

const ROOM_CHOICE_ICONS: Record<string, RoomChoiceIcon> = {
  space: Circle,
  ecosystem: Target,
  public: Globe,
};

type RoomChoiceOption = {
  value: string;
  label: string;
  /** Unread message count for this channel. */
  unreadCount?: number;
  unreadCountIsCapped?: boolean;
};

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
  /** Icon-only title. Hover shows the label (network room). */
  iconTitle?: string;
  /** Sits before the title — e.g. peer space icons on a direct chat. */
  titleStart?: ReactNode;
  /** Extra header actions (group rename/archive). Same 36px control row. */
  trailingEnd?: ReactNode;
  /** Two rooms that sit side by side, such as a space and its ecosystem. */
  roomChoice?: {
    value: string;
    options: RoomChoiceOption[];
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
  iconTitle,
  titleStart,
  trailingEnd,
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
        {trailingEnd}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {titleStart}
        {mark && !roomChoice ? (
          <span
            className="inline-flex shrink-0 border border-foreground bg-foreground px-3 py-1 text-1 text-background"
            data-testid="chat-panel-archived-badge"
          >
            {mark}
          </span>
        ) : null}
        {roomChoice ? (
          <TooltipProvider delayDuration={200}>
            <div
              role="group"
              aria-label={roomChoice.ariaLabel}
              className="inline-flex shrink-0 border border-foreground"
            >
              {roomChoice.options.map((option) => {
                const selected = roomChoice.value === option.value;
                const Icon = ROOM_CHOICE_ICONS[option.value];
                const unread = option.unreadCount ?? 0;
                const unreadLabel =
                  unread > 0
                    ? option.unreadCountIsCapped || unread >= 100
                      ? t('channelUnreadCappedAria', { channel: option.label })
                      : t('channelUnreadAria', {
                          channel: option.label,
                          count: unread,
                        })
                    : option.label;
                return (
                  <Tooltip key={option.value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={unreadLabel}
                        onClick={() => roomChoice.onChange(option.value)}
                        className={cn(
                          'relative inline-flex h-[36px] w-[36px] items-center justify-center',
                          selected
                            ? 'bg-foreground text-background'
                            : 'bg-background text-foreground',
                        )}
                      >
                        {Icon ? (
                          <Icon
                            className="h-4 w-4"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        ) : (
                          <span className="px-2 text-1">{option.label}</span>
                        )}
                        {unread > 0 ? (
                          <CountBadge
                            count={unread}
                            capped={option.unreadCountIsCapped}
                            size="sm"
                            className="absolute -right-1 -top-1 z-10"
                          />
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {option.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        ) : iconTitle ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex h-[36px] w-[36px] items-center justify-center border border-foreground bg-foreground text-background"
                  aria-label={iconTitle}
                >
                  <Globe2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{iconTitle}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : displayTitle ? (
          <div className="flex min-w-0 flex-col items-end gap-0.5">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {displayTitle}
            </span>
            {displayDescription ? (
              <p className="craft-meta max-w-full truncate text-right">
                {displayDescription}
              </p>
            ) : null}
          </div>
        ) : displayDescription ? (
          <p className="craft-meta line-clamp-1">{displayDescription}</p>
        ) : null}
      </div>
    </div>
  );
}
