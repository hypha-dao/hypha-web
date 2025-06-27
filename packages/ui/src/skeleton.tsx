import React from 'react';
import { cn } from '@hypha-platform/ui-utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  loading?: boolean;
  children?: React.ReactNode;
}

function Skeleton({
  className,
  width,
  height,
  loading = false,
  children,
  ...props
}: SkeletonProps) {
  if (!loading) {
    return children;
  }

  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      style={{ width, height }}
      {...props}
    />
  );
}

export { Skeleton };
