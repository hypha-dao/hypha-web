import React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { RxCircleBackslash } from 'react-icons/rx';
import { IconType } from 'react-icons';

type EmptyProps = {
  icon?: IconType;
  children: React.ReactNode;
  className?: string;
};

export const Empty = ({
  icon: Icon = RxCircleBackslash,
  children,
  className = '',
}: EmptyProps) => {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2.5 py-8 text-center',
        className,
      )}
    >
      <div className="craft-empty-mark" aria-hidden>
        <Icon className="size-4" />
      </div>
      <div className="max-w-xs text-1 font-normal leading-snug text-muted-foreground">
        {children}
      </div>
    </div>
  );
};
