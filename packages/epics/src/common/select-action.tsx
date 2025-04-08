import { Card, Separator, Button, Skeleton } from '@hypha-platform/ui';
import Link from 'next/link';
import React from 'react';

type ActionProps = {
  title: string;
  description: string;
  group?: string;
  href: string;
  icon: React.ReactNode;
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
              <Link href={action.href} key={action.title}>
                <Card className="flex p-6 cursor-pointer space-x-4 items-center">
                  <div>{action.icon}</div>
                  <div className="flex flex-col">
                    <span className="text-2 font-medium">{action.title}</span>
                    <span className="text-1 text-neutral-11">
                      {action.description}
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
