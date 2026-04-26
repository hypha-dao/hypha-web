'use client';

import {
  Card,
  Input,
  Separator,
  Skeleton,
  TextWithLinks,
} from '@hypha-platform/ui';
import clsx from 'clsx';
import Link from 'next/link';
import { SearchIcon } from 'lucide-react';
import React from 'react';
import { useTranslations } from 'next-intl';

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

type SelectActionActionLayout = 'stack' | 'grid';

type SelectActionProps = {
  isLoading?: boolean;
  title: string;
  content: string;
  actions: ActionProps[];
  children?: React.ReactNode;
  /** Set false when the modal sticky header already shows the same title. */
  showTitle?: boolean;
  /**
   * When false, omit the trailing separator and empty action-cards section.
   * Use for full-page or content-only layouts.
   */
  showActionCards?: boolean;
  /** When false, omit the intro/description paragraph under the title. */
  showContent?: boolean;
  /**
   * `stack` — full-width rows (icon + text side by side), default.
   * `grid` — responsive card grid with vertical tiles (easier to scan, less overwhelming).
   */
  actionLayout?: SelectActionActionLayout;
  /** When true, show a search field and filter actions by title, description, or group label. */
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** Shown when no actions match the search (optional; omit to show nothing). */
  searchEmptyMessage?: string;
  /** Optional class on the root wrapper. */
  className?: string;
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
  showActionCards = true,
  showContent = true,
  actionLayout = 'stack',
  showSearch = false,
  searchPlaceholder = '',
  searchEmptyMessage,
  className,
}: SelectActionProps) => {
  const tCommon = useTranslations('Common');
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredActions = React.useMemo(() => {
    if (!showSearch || !searchTerm.trim()) return actions ?? [];
    const q = searchTerm.trim().toLowerCase();
    return (actions ?? []).filter((action) => {
      const title = action.title.toLowerCase();
      const desc = action.description.toLowerCase();
      const group = (action.group ?? '').toLowerCase();
      return title.includes(q) || desc.includes(q) || group.includes(q);
    });
  }, [actions, searchTerm, showSearch]);

  const groupedActions = React.useMemo(
    () =>
      filteredActions.reduce<GroupedActions>((groups, action) => {
        const group = action.group || '';
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(action);
        return groups;
      }, {}),
    [filteredActions],
  );

  const hasAnyFiltered = filteredActions.length > 0;

  return (
    <div className={clsx('flex flex-col gap-6', className)}>
      {showTitle ? (
        <header className="flex flex-col gap-2">
          <Skeleton width="100px" height="24px" loading={isLoading}>
            <span className="text-4 font-semibold tracking-tight text-foreground">
              {title}
            </span>
          </Skeleton>
        </header>
      ) : null}
      {showContent ? (
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
      ) : null}
      {children}
      {showActionCards ? (
        <>
          <Separator />
          {showSearch ? (
            <Input
              className="w-full min-w-0 sm:max-w-md"
              placeholder={searchPlaceholder}
              leftIcon={<SearchIcon className="h-4 w-4" aria-hidden />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label={searchPlaceholder}
            />
          ) : null}
          {!hasAnyFiltered && searchEmptyMessage ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {searchEmptyMessage}
            </p>
          ) : null}
          <div className="flex flex-col gap-8">
            {Object.entries(groupedActions || {}).map(
              ([group, groupActions]) => (
                <div key={group} className="flex flex-col gap-3">
                  {group && (
                    <h3 className="text-3 font-medium text-neutral-11">
                      {group}
                    </h3>
                  )}
                  <div
                    className={clsx(
                      actionLayout === 'grid' &&
                        'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3',
                      actionLayout === 'stack' && 'flex flex-col gap-3',
                    )}
                  >
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

                      const card =
                        actionLayout === 'grid' ? (
                          <Card
                            className={clsx(
                              'group flex h-full min-h-[11rem] cursor-pointer flex-col gap-3 border-border/80 p-4 shadow-sm ring-2 ring-transparent transition-[border-color,box-shadow,--tw-ring-color] duration-200 ease-out sm:p-5',
                              !action.disabled &&
                                'hover:border-accent-9 hover:shadow-md hover:ring-accent-10/45',
                              !action.disabled &&
                                'focus-within:border-accent-9 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background-2',
                              {
                                'pointer-events-none cursor-not-allowed opacity-55 saturate-50':
                                  action.disabled,
                              },
                            )}
                            aria-disabled={action.disabled}
                            onClick={handleClick}
                          >
                            <div
                              className={clsx(
                                'flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-accent-11 ring-2 ring-transparent transition-[border-color,box-shadow,--tw-ring-color,color] duration-200 [&_svg]:shrink-0',
                                !action.disabled &&
                                  'group-hover:border-accent-9 group-hover:text-foreground group-hover:ring-accent-10/50 group-focus-within:text-foreground',
                              )}
                              aria-hidden
                            >
                              {action.icon}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                              <span className="flex flex-wrap items-center gap-2 text-balance text-2 font-semibold leading-snug text-foreground">
                                {action.title}
                                {comingSoon ? (
                                  <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {tCommon('comingSoonBadge')}
                                  </span>
                                ) : null}
                              </span>
                              <span className="line-clamp-4 text-1 leading-relaxed text-muted-foreground">
                                <TextWithLinks text={action.description} />
                              </span>
                            </div>
                          </Card>
                        ) : (
                          <Card
                            className={clsx(
                              'group flex cursor-pointer items-start gap-4 border-border/80 p-5 shadow-sm ring-2 ring-transparent transition-[border-color,box-shadow,--tw-ring-color] duration-200 ease-out md:p-6',
                              !action.disabled &&
                                'hover:border-accent-9 hover:shadow-md hover:ring-accent-10/45',
                              !action.disabled &&
                                'focus-within:border-accent-9 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background-2',
                              {
                                'pointer-events-none cursor-not-allowed opacity-55 saturate-50':
                                  action.disabled,
                              },
                            )}
                            aria-disabled={action.disabled}
                            onClick={handleClick}
                          >
                            <div
                              className={clsx(
                                'flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-accent-11 ring-2 ring-transparent transition-[border-color,box-shadow,--tw-ring-color,color] duration-200 [&_svg]:shrink-0',
                                !action.disabled &&
                                  'group-hover:border-accent-9 group-hover:text-foreground group-hover:ring-accent-10/50 group-focus-within:text-foreground',
                              )}
                              aria-hidden
                            >
                              {action.icon}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex flex-wrap items-center gap-2 text-2 font-semibold leading-snug text-foreground">
                                {action.title}
                                {comingSoon ? (
                                  <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {tCommon('comingSoonBadge')}
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-1 leading-relaxed text-muted-foreground">
                                <TextWithLinks text={action.description} />
                              </span>
                            </div>
                          </Card>
                        );
                      return isLink ? (
                        <Link
                          href={action.href!}
                          target={action.target}
                          onClick={handleClick}
                          key={action.title}
                          className={clsx(
                            actionLayout === 'grid' &&
                              'block h-full min-w-0 no-underline',
                          )}
                          aria-disabled={action.disabled}
                        >
                          {card}
                        </Link>
                      ) : (
                        <div
                          key={action.title}
                          className={clsx(
                            actionLayout === 'grid' && 'h-full min-w-0',
                          )}
                        >
                          {card}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
