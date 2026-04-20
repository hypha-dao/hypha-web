'use client';

import { JoinSpace } from '@hypha-platform/epics';
import { cn } from '@hypha-platform/ui-utils';

import { ActionButtons } from './action-buttons';

type SpaceHeaderActionsRowProps = {
  web3SpaceId: number | null;
  spaceId: number;
  className?: string;
};

/** Single in-flow Join + action buttons row below the hero. */
export function SpaceHeaderActionsRow({
  web3SpaceId,
  spaceId,
  className,
}: SpaceHeaderActionsRowProps) {
  if (typeof web3SpaceId !== 'number') return null;

  return (
    <div
      className={cn('flex flex-wrap justify-end gap-1.5 sm:gap-2', className)}
    >
      <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
      <ActionButtons web3SpaceId={web3SpaceId} />
    </div>
  );
}
