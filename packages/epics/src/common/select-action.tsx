'use client';

import { Card, Separator, Skeleton, TextWithLinks } from '@hypha-platform/ui';
import { isAbsoluteUrl } from '@hypha-platform/ui-utils';
import clsx from 'clsx';
import Link from 'next/link';
import React from 'react';

type ActionProps = {
  title: string;
  description: string;
  group?: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  target?: string;
};

type SelectActionProps = {
  isLoading?: boolean;
  title: string;
  content: string;
  actions: ActionProps[];
};

type GroupedActions = {
  [key: string]: ActionProps[];
};

export const SelectAction = ({
  isLoading,
  title,
  content,
  actions,
}: SelectActionProps) => {
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
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <Skeleton width="100px" height="24px" loading={isLoading}>
          <span className="text-4 text-secondary-foreground">{title}</span>
        </Skeleton>
      </div>
      <Skeleton
        width="100%"
        height="72px"
        loading={isLoading}
        className="rounded-lg"
      >
        <span className="text-2 text-neutral-11">{content}</span>
      </Skeleton>
      <Separator />
      <div className="flex flex-col gap-6">
        {Object.entries(groupedActions || {}).map(([group, groupActions]) => (
          <div key={group} className="flex flex-col gap-3">
            {group && (
              <h3 className="text-3 font-medium text-neutral-11">{group}</h3>
            )}
            {groupActions.map((action) => (
              <Link
                href={action.href}
                target={isAbsoluteUrl(action.href) ? '_blank' : undefined}
                key={action.title}
                target={action.target}
                {...(action.disabled && {
                  onClick: (e) => e.preventDefault(),
                  'aria-disabled': 'true',
                })}
              >
                <Card
                  className={clsx(
                    'flex p-6 cursor-pointer space-x-4 items-center',
                    {
                      'opacity-50 cursor-not-allowed': action.disabled,
                      // 'hover:border-accent-5': !action.disabled,
                    },
                  )}
                  aria-disabled={action.disabled}
                >
                  <div>{action.icon}</div>
                  <div className="flex flex-col">
                    <span className="text-2 font-medium">{action.title}</span>
                    <span className="text-1 text-neutral-11">
                      <TextWithLinks text={action.description} />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
