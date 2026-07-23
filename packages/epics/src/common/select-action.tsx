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
    <div className="flex flex-col gap-6">
      {showTitle ? (
        <header className="flex flex-col gap-2">
          <Skeleton width="100px" height="24px" loading={isLoading}>
            <span className="text-4 font-semibold tracking-tight text-foreground">
              {title}
            </span>
          </Skeleton>
        </header>
      ) : null}
      <Skeleton
        width="100%"
        height="72px"
        loading={isLoading}
        className="rounded-lg"
      >
        <p className="w-full min-w-0 text-2 leading-relaxed text-muted-foreground">
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
          leftIcon={<Search className="text-accent-9" size="16px" />}
        />
      ) : null}
      <Separator />
      <div className="flex flex-col gap-6">
        {Object.entries(groupedActions || {}).length > 0 ? (
          Object.entries(groupedActions || {}).map(([group, groupActions]) => (
            <div key={group} className="flex flex-col gap-3">
              {group && (
                <h3 className="text-3 font-medium text-neutral-11">{group}</h3>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                        'craft-card group flex h-full items-start gap-3 p-3.5 transition-[border-color,background-color] duration-200 ease-out',
                        !action.disabled && 'cursor-pointer',
                        !action.disabled &&
                          'hover:border-border hover:bg-muted/15',
                        /* Inset ring — no offset so focus/selection does not optically shift content */
                        !action.disabled &&
                          'focus-within:border-accent-9 focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent-9/45',
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
                          'craft-icon-box size-9 text-accent-11 transition-[border-color,background-color,color] duration-200',
                          !action.disabled &&
                            'group-hover:border-border group-hover:bg-muted/35 group-hover:text-foreground group-focus-within:text-foreground',
                        )}
                        aria-hidden
                      >
                        {action.icon}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2 text-2 font-medium leading-snug text-foreground">
                          {action.title}
                          {comingSoon ? (
                            <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                              {tCommon('comingSoonBadge')}
                            </span>
                          ) : null}
                        </span>
                        {action.description ? (
                          <span className="line-clamp-1 text-1 font-normal leading-snug text-muted-foreground">
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
                      className="block h-full"
                    >
                      {card}
                    </Link>
                  ) : (
                    <div key={action.title} className="h-full">
                      {card}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-border/80 bg-background-2 p-5 text-sm text-muted-foreground">
            {noResultsLabel || tCommon('noMenusFound')}
          </div>
        )}
      </div>
    </div>
  );
};
