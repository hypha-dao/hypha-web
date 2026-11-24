'use client';

import type { ElementType, KeyboardEvent } from 'react';
import {
  BookOpen,
  Circle,
  FileText,
  Globe2,
  Hash,
  LayoutGrid,
  MessageSquare,
  MessagesSquare,
  Radio,
  Scroll,
  Target,
  User,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import {
  INBOX_FILTERS,
  MEMBER_INBOX_TABS,
  type InboxFilter,
  type MemberInboxTab,
} from './messages-inbox';

type FilterCounts = Record<InboxFilter, { total: number; unread: number }>;

const NESTED = new Set<InboxFilter>([
  'rooms',
  'proposals',
  'signals',
  'quests',
  'context',
]);

/** Same marks the rest of the app already uses for these places. */
const FILTER_ICONS: Record<InboxFilter, ElementType> = {
  all: MessagesSquare,
  direct: MessageSquare,
  spaces: LayoutGrid,
  rooms: Circle,
  proposals: FileText,
  signals: Radio,
  quests: Scroll,
  context: BookOpen,
  ecosystem: Target,
  network: Globe2,
};

function FilterRow({
  filter,
  selected,
  counts,
  onSelect,
}: {
  filter: InboxFilter;
  selected: boolean;
  counts: FilterCounts;
  onSelect: (filter: InboxFilter) => void;
}) {
  const t = useTranslations('Connections');
  const Icon = FILTER_ICONS[filter];
  const nested = NESTED.has(filter);
  const { total, unread } = counts[filter];
  const title = t(`inbox.${filter}Title`);
  const body = t(`inbox.${filter}Body`);
  const unreadLabel =
    unread > 0 ? t('unread', { count: unread > 99 ? 99 : unread }) : null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={`inbox-filter-${filter}`}
      onClick={() => onSelect(filter)}
      className={cn(
        'flex w-full min-w-0 items-start gap-3 border-b border-border px-4 py-4 text-left hover:bg-accent-2',
        nested && 'py-3 pl-8',
        selected && 'bg-accent-2',
      )}
    >
      <Icon
        className="mt-0.5 size-4 shrink-0 text-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-3">
          <span
            className={cn(
              'min-w-0 truncate text-3 text-foreground',
              selected && 'font-medium',
            )}
          >
            {title}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {/* Hide 0 while Matrix is still catching up and for empty filters. */}
            {total > 0 ? (
              <span className="text-1 text-muted-foreground">{total}</span>
            ) : null}
            {unread > 0 ? (
              <span
                className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-[10px] leading-none text-background"
                aria-label={unreadLabel ?? undefined}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </span>
        </span>
        <span className="mt-1 block text-2 text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}

const MEMBER_TAB_ICONS: Record<MemberInboxTab, ElementType> = {
  all: MessagesSquare,
  direct: User,
  groups: Users,
  channels: Hash,
};

const MEMBER_TAB_LABEL: Record<MemberInboxTab, string> = {
  all: 'memberAll',
  direct: 'memberDirect',
  groups: 'memberGroups',
  channels: 'memberChannels',
};

/**
 * The same four categories on every width. A phone shows them as one row
 * above the list, so opening a conversation is a single tap. A wide screen
 * keeps them beside the list.
 */
export function MemberInboxTabs({
  value,
  counts,
  onChange,
}: {
  value: MemberInboxTab;
  counts: Record<MemberInboxTab, { total: number; unread: number }>;
  onChange: (tab: MemberInboxTab) => void;
}) {
  const t = useTranslations('Connections');
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = MEMBER_INBOX_TABS.indexOf(value);
    if (index < 0) return;
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % MEMBER_INBOX_TABS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + MEMBER_INBOX_TABS.length) % MEMBER_INBOX_TABS.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = MEMBER_INBOX_TABS.length - 1;
    }
    if (next < 0) return;
    event.preventDefault();
    onChange(MEMBER_INBOX_TABS[next]!);
  };
  return (
    <div
      role="tablist"
      aria-label={t('inbox.filterLabel')}
      className="grid grid-cols-4 gap-1 rounded-lg bg-background-2 p-1 lg:flex lg:w-full lg:flex-col lg:gap-1 lg:rounded-none lg:bg-transparent lg:p-0"
    >
      {MEMBER_INBOX_TABS.map((tab) => {
        const Icon = MEMBER_TAB_ICONS[tab];
        const selected = value === tab;
        const unread = counts[tab]?.unread ?? 0;
        const label = t(`inbox.${MEMBER_TAB_LABEL[tab]}`);
        const tabId = `member-inbox-tab-${tab}`;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={selected}
            aria-controls="member-inbox-panel"
            tabIndex={selected ? 0 : -1}
            data-testid={tabId}
            onClick={() => onChange(tab)}
            onKeyDown={onTabKeyDown}
            className={cn(
              'flex min-w-0 items-center justify-center gap-1.5 rounded-md px-1 py-2 text-2 text-muted-foreground',
              'lg:justify-start lg:gap-2 lg:rounded-none lg:px-2 lg:py-2',
              selected &&
                'bg-background text-foreground shadow-sm lg:bg-accent-2 lg:shadow-[inset_2px_0_0_var(--accent-9)]',
            )}
          >
            <Icon
              className="hidden size-4 shrink-0 lg:block"
              strokeWidth={1.5}
              aria-hidden
            />
            <span className="truncate">{label}</span>
            {unread > 0 ? (
              <span
                className="grid h-[18px] min-w-[18px] shrink-0 place-items-center bg-accent-9 px-1 text-[10px] font-medium leading-none text-accent-contrast"
                aria-label={t('unread', { count: unread > 99 ? 99 : unread })}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function MessagesInboxFilters({
  value,
  counts,
  onChange,
}: {
  value: InboxFilter;
  counts: FilterCounts;
  onChange: (filter: InboxFilter) => void;
}) {
  const t = useTranslations('Connections');
  return (
    <nav aria-label={t('inbox.filterLabel')} className="min-w-0 lg:w-full">
      <div className="border border-border bg-background">
        {INBOX_FILTERS.map((filter) => (
          <FilterRow
            key={filter}
            filter={filter}
            selected={value === filter}
            counts={counts}
            onSelect={onChange}
          />
        ))}
      </div>
    </nav>
  );
}
