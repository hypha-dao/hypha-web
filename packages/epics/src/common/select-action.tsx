'use client';

import { Card, Separator, Skeleton, TextWithLinks } from '@hypha-platform/ui';
import clsx from 'clsx';
import Link from 'next/link';
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

type SelectActionProps = {
  isLoading?: boolean;
  title: string;
  content: string;
  actions: ActionProps[];
  children?: React.ReactNode;
  /** Set false when the modal sticky header already shows the same title. */
  showTitle?: boolean;
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
}: SelectActionProps) => {
  const tCommon = useTranslations('Common');
  const groupedActions = React.useMemo(
    () =>
      actions?.reduce<GroupedActions>((groups, action) => {
        const group = action.group || '';
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(action);
        return groups;
      }, {}),
    [actions],
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
      <Separator />
      <div className="flex flex-col gap-6">
        {Object.entries(groupedActions || {}).map(([group, groupActions]) => (
          <div key={group} className="flex flex-col gap-3">
            {group && (
              <h3 className="text-3 font-medium text-neutral-11">{group}</h3>
            )}
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
              const comingSoon = action.disabled && action.comingSoon === true;
              const card = (
                <Card
                  className={clsx(
                    'group flex items-start gap-4 rounded-2xl border border-border/80 bg-background-2 p-5 shadow-sm ring-2 ring-transparent transition-[border-color,box-shadow,--tw-ring-color,background-color] duration-200 ease-out md:p-6',
                    !action.disabled && 'cursor-pointer',
                    !action.disabled &&
                      'hover:border-accent-9 hover:bg-background-3/70 hover:shadow-md hover:ring-accent-10/45',
                    !action.disabled &&
                      'focus-within:border-accent-9 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background-2',
                    {
                      'pointer-events-none cursor-not-allowed border-border/70 bg-background-2 opacity-90':
                        action.disabled,
                    },
                  )}
                  aria-disabled={action.disabled}
                  onClick={handleClick}
                >
                  <div
                    className={clsx(
                      'flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-accent-11 ring-2 ring-transparent transition-[border-color,box-shadow,--tw-ring-color,color] duration-200 [&_svg]:shrink-0',
                      !action.disabled &&
                        /* Outline-style hover: ring + border — no solid fill */
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
                  aria-disabled={action.disabled}
                >
                  {card}
                </Link>
              ) : (
                <div key={action.title}>{card}</div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
