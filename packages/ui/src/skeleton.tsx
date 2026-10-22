import React from 'react';
import { cn } from '@hypha-platform/ui-utils';

import { isTextWave } from './wave';

import './wave.css';

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
  style,
  ...props
}: SkeletonProps) {
  if (!loading) {
    return children;
  }

  const textLine = isTextWave({ className, height });

  return (
    <div
      className={cn(
        'hypha-wave rounded-md',
        textLine && 'hypha-wave-text',
        className,
      )}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export { Skeleton };
