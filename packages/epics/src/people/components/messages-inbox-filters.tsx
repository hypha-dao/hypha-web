'use client';

import type { ElementType } from 'react';
import {
  Circle,
  Globe2,
  LayoutGrid,
  MessageSquare,
  MessagesSquare,
  Radio,
  Target,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import { type InboxFilter } from './messages-inbox';

type FilterCounts = Record<InboxFilter, { total: number; unread: number }>;

const NESTED = new Set<InboxFilter>(['rooms', 'signals']);

/** Same marks the rest of the app already uses for these places. */
const FILTER_ICONS: Record<InboxFilter, ElementType> = {
  all: MessagesSquare,
  direct: MessageSquare,
  spaces: LayoutGrid,
  rooms: Circle,
  signals: Radio,
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
        'flex w-full min-w-0 items-start gap-3 border-b border-border px-4 py-4 text-left',
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
            <span className="text-1 text-muted-foreground">{total}</span>
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
      <div className="overflow-hidden border border-border bg-background">
        {(
          [
            'all',
            'direct',
            'spaces',
            'rooms',
            'signals',
            'ecosystem',
            'network',
          ] as const
        ).map((filter) => (
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
