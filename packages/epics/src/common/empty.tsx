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
        'flex w-full flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground',
        className,
      )}
    >
      <div className="craft-empty-mark" aria-hidden>
        <Icon className="size-5" />
      </div>
      <div className="max-w-sm text-2 leading-relaxed text-neutral-11">
        {children}
      </div>
    </div>
  );
};
