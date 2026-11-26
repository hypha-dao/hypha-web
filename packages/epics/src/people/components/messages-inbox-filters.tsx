'use client';

import { useState, type ElementType } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  Globe2,
  LayoutGrid,
  MessageSquare,
  MessagesSquare,
  Radio,
  Scroll,
  Target,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import {
  MOBILE_INBOX_TABS,
  type InboxFilter,
  type MobileInboxTab,
} from './messages-inbox';

/** Channels, proposals, signals, quests, and context sit under Spaces. */
const SPACE_FILTERS: readonly InboxFilter[] = [
  'rooms',
  'proposals',
  'signals',
  'quests',
  'context',
];

const TOP_FILTERS: readonly InboxFilter[] = [
  'all',
  'direct',
  'spaces',
  'ecosystem',
  'network',
];

type FilterCounts = Record<InboxFilter, { total: number; unread: number }>;

const NESTED = new Set<InboxFilter>(SPACE_FILTERS);

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
  shifted = false,
}: {
  filter: InboxFilter;
  selected: boolean;
  counts: FilterCounts;
  onSelect: (filter: InboxFilter) => void;
  /** Room for the Spaces chevron, so the mark lines up beside it. */
  shifted?: boolean;
}) {
  const t = useTranslations('Connections');
  const Icon = FILTER_ICONS[filter];
  const nested = NESTED.has(filter);
  const { total, unread } = counts[filter];
  const title = t(`inbox.${filter}Title`);
  const description = t(`inbox.${filter}Body`);
  const unreadLabel =
    unread > 0 ? t('unread', { count: unread > 99 ? 99 : unread }) : null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={`inbox-filter-${filter}`}
      onClick={() => onSelect(filter)}
      className={cn(
        'flex w-full min-w-0 items-start gap-3 border-b border-border py-4 pr-4 text-left hover:bg-accent-2',
        nested ? 'py-3 pl-12' : shifted ? 'pl-9' : 'px-4',
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
        <span className="mt-1 block text-2 text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

function SpaceFilters({
  value,
  counts,
  onChange,
}: {
  value: InboxFilter;
  counts: FilterCounts;
  onChange: (filter: InboxFilter) => void;
}) {
  const t = useTranslations('Connections');
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="relative">
        <button
          type="button"
          className="absolute top-4.5 left-4 z-10 flex size-4 items-center justify-center text-neutral-9 hover:text-foreground"
          aria-expanded={open}
          aria-controls="inbox-space-filters"
          aria-label={t('inbox.spacesTitle')}
          data-testid="inbox-spaces-toggle"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? (
            <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden />
          ) : (
            <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden />
          )}
        </button>
        <FilterRow
          filter="spaces"
          shifted
          selected={value === 'spaces'}
          counts={counts}
          onSelect={(filter) => {
            setOpen(true);
            onChange(filter);
          }}
        />
      </div>
      {open ? (
        <div id="inbox-space-filters">
          {SPACE_FILTERS.map((filter) => (
            <FilterRow
              key={filter}
              filter={filter}
              selected={value === filter}
              counts={counts}
              onSelect={onChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Phone categories. They sit on the conversation list, not on a screen before it. */
export function MessagesInboxMobileTabs({
  value,
  onChange,
}: {
  value: MobileInboxTab;
  onChange: (tab: MobileInboxTab) => void;
}) {
  const t = useTranslations('Connections');
  return (
    <div
      role="tablist"
      aria-label={t('inbox.filterLabel')}
      className="flex h-11 w-full border border-border bg-neutral-3 lg:hidden"
    >
      {MOBILE_INBOX_TABS.map((tab) => {
        const selected = value === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`inbox-mobile-tab-${tab}`}
            onClick={() => onChange(tab)}
            className={cn(
              'min-w-0 flex-1 text-2 text-foreground',
              selected ? 'bg-background font-medium' : 'bg-transparent',
            )}
          >
            {tab === 'all'
              ? t('inbox.tabAll')
              : tab === 'direct'
              ? t('inbox.directTitle')
              : tab === 'groups'
              ? t('groups')
              : t('inbox.roomsTitle')}
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
        {TOP_FILTERS.map((filter) =>
          filter === 'spaces' ? (
            <SpaceFilters
              key={filter}
              value={value}
              counts={counts}
              onChange={onChange}
            />
          ) : (
            <FilterRow
              key={filter}
              filter={filter}
              selected={value === filter}
              counts={counts}
              onSelect={onChange}
            />
          ),
        )}
      </div>
    </nav>
  );
}
