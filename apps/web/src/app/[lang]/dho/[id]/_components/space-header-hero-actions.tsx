'use client';

import { JoinSpace } from '@hypha-platform/epics';

import { ActionButtons } from './action-buttons';

type SpaceHeaderHeroActionsProps = {
  web3SpaceId: number | null;
  spaceId: number;
};

/** Join + settings/create on the hero chrome (compact wrap for small screens) */
export function SpaceHeaderHeroActions({
  web3SpaceId,
  spaceId,
}: SpaceHeaderHeroActionsProps) {
  return (
    <div className="flex max-w-[min(100%,22rem)] flex-shrink-0 flex-wrap items-center justify-end gap-1.5 sm:max-w-none sm:gap-2">
      {typeof web3SpaceId === 'number' ? (
        <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
      ) : null}
      <ActionButtons web3SpaceId={web3SpaceId as number} />
    </div>
  );
}
