import React from 'react';
import { cn } from '@hypha-platform/lib/utils';
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
        'py-7 gap-2 flex flex-col justify-center text-center items-center w-full text-neutral-11',
        className,
      )}
    >
      <Icon className="size-7" />
      <div className="text-1">{children}</div>
    </div>
  );
};
