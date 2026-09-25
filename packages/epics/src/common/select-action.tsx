'use client';

import { Card, Separator, Skeleton, TextWithLinks } from '@hypha-platform/ui';
import clsx from 'clsx';
import Link from 'next/link';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@hypha-platform/ui';
import { Search } from 'lucide-react';

export type ActionProps = {
  title: string;
  description: string;
  group?: string;
  href?: string;
  /** Agreements vs treasury tab segment for relative links */
  baseTab?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  /** True when this action is disabled pending release; do not infer from title text (i18n). */
  comingSoon?: boolean;
  target?: string;
  defaultDurationDays?: number;
  onAction?: () => void;
};

type SelectActionProps = {
  isLoading?: boolean;
  title: string;
  content: string;
  actions: ActionProps[];
  children?: React.ReactNode;
  /** Set false when the modal sticky header already shows the same title. */
  showTitle?: boolean;
  searchPlaceholder?: string;
  noResultsLabel?: string;
};

type GroupedActions = {
  [key: string]: ActionProps[];
};

export const SelectAction = ({
  isLoading,
  title,
  content,
  actions,
  children,
  showTitle = true,
  searchPlaceholder,
  noResultsLabel,
}: SelectActionProps) => {
  const tCommon = useTranslations('Common');
  const [searchTerm, setSearchTerm] = React.useState('');
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const groupedActions = React.useMemo(
    () =>
      actions
        ?.filter((action) => {
          if (!normalizedSearch) return true;
          const haystack = [action.group, action.title, action.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedSearch);
        })
        .reduce<GroupedActions>((groups, action) => {
          const group = action.group || '';
          if (!groups[group]) {
            groups[group] = [];
          }
          groups[group].push(action);
          return groups;
        }, {}),
    [actions, normalizedSearch],
  );

  return (
    <div className="flex w-full flex-col gap-6 font-sans">
      {showTitle ? (
        <header className="flex flex-col gap-2">
          <Skeleton width="100px" height="24px" loading={isLoading}>
            <span className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-tight text-foreground">
              {title}
            </span>
          </Skeleton>
        </header>
      ) : null}
      <Skeleton
        width="100%"
        height="72px"
        loading={isLoading}
        className="rounded-none"
      >
        <p className="w-full min-w-0 font-sans text-2 leading-relaxed text-muted-foreground">
          {content}
        </p>
      </Skeleton>
      {children}
      {searchPlaceholder ? (
        <Input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-10 rounded-none border-border bg-background-2 shadow-none focus-visible:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-background-5"
          leftIcon={<Search className="text-muted-foreground" size="16px" />}
        />
      ) : null}
      <Separator />
      <div className="flex w-full flex-col gap-6">
        {Object.entries(groupedActions || {}).length > 0 ? (
          Object.entries(groupedActions || {}).map(([group, groupActions]) => (
            <div
              key={group}
              className="@container/select-action flex w-full flex-col gap-3"
            >
              {group && (
                <h3 className="[font-family:var(--font-family-heading)] text-3 font-medium text-foreground">
                  {group}
                </h3>
              )}
              {/* Container query: viewport md on iPad ≠ overlay width when panels are open */}
              <div className="grid w-full grid-cols-1 gap-3 @[36rem]/select-action:grid-cols-2">
                {groupActions.map((action) => {
                  const isLink = !action.onAction && !!action.href;

                  const handleClick = (e: React.MouseEvent) => {
                    if (action.disabled) {
                      e.preventDefault();
                      return;
                    }

                    if (action.onAction) {
                      e.preventDefault();
                      action.onAction();
                    }
                  };
                  const comingSoon =
                    action.disabled && action.comingSoon === true;
                  const card = (
                    <Card
                      className={clsx(
                        /* Full card tiles — not dense left-flush list rows.
                           Light rest is white (bg-background-2). Dark rest is
                           background-5 so cards lift off the #121212 sheet.
                           Never set bg-background-5 without the dark: variant. */
                        'craft-card-interactive group flex h-full w-full items-center gap-4 border border-border bg-background-2 p-5 shadow-none dark:bg-background-5 md:p-6',
                        !action.disabled && 'cursor-pointer',
                        {
                          'pointer-events-none cursor-not-allowed opacity-90':
                            action.disabled,
                        },
                      )}
                      aria-disabled={action.disabled}
                      onClick={handleClick}
                    >
                      <div
                        className={clsx(
                          'craft-icon-box size-10 text-muted-foreground transition-[border-color,color] duration-200',
                          !action.disabled &&
                            'group-hover:border-border group-hover:text-foreground group-focus-within:text-foreground',
                        )}
                        aria-hidden
                      >
                        {action.icon}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 font-sans">
                        <span className="flex flex-wrap items-center gap-2 [font-family:var(--font-family-heading)] text-2 font-semibold leading-snug text-foreground">
                          {action.title}
                          {comingSoon ? (
                            <span className="rounded-none border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {tCommon('comingSoonBadge')}
                            </span>
                          ) : null}
                        </span>
                        {action.description ? (
                          <span className="line-clamp-2 text-1 font-normal leading-relaxed text-muted-foreground">
                            <TextWithLinks text={action.description} />
                          </span>
                        ) : null}
                      </div>
                    </Card>
                  );
                  return isLink ? (
                    <Link
                      href={action.href!}
                      target={action.target}
                      onClick={handleClick}
                      key={action.title}
                      aria-disabled={action.disabled}
                      className="block h-full w-full min-w-0 rounded-none outline-none focus-visible:outline-none"
                    >
                      {card}
                    </Link>
                  ) : (
                    <div key={action.title} className="h-full w-full min-w-0">
                      {card}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-none border border-border bg-background-2 p-5 font-sans text-sm text-muted-foreground shadow-none dark:bg-background-5">
            {noResultsLabel || tCommon('noMenusFound')}
          </div>
        )}
      </div>
    </div>
  );
};
