'use client';

import React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { SIGNAL_STATUS_CARD_STACK_CLASS } from '../utils/signal-board-layout';
import { handleSignalColumnWheel } from '../utils/signal-column-scroll-chain';

type SignalStatusCardStackProps = React.ComponentProps<'div'>;

export function SignalStatusCardStack({
  className,
  onWheel,
  ...props
}: SignalStatusCardStackProps) {
  return (
    <div
      data-signal-card-stack=""
      className={cn(SIGNAL_STATUS_CARD_STACK_CLASS, className)}
      onWheel={(event) => {
        handleSignalColumnWheel(event);
        onWheel?.(event);
      }}
      {...props}
    />
  );
}
