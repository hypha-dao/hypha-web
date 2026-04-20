'use client';

import { JoinSpace } from '@hypha-platform/epics';
import { createPortal } from 'react-dom';

import { ActionButtons } from './action-buttons';
import { useSpaceHeaderMorph } from './space-header-morph-context';

type SpaceHeaderFixedActionsProps = {
  web3SpaceId: number | null;
  spaceId: number;
  mounted: boolean;
};

/**
 * Fixed duplicate of Join + actions while they scroll up but before the in-flow
 * row locks under the identity strip — prevents double-toolbar overlap with the
 * scroll position (see SpaceHeaderActionsRow absorption).
 */
export function SpaceHeaderFixedActions({
  web3SpaceId,
  spaceId,
  mounted,
}: SpaceHeaderFixedActionsProps) {
  const { progress, compactActionsAbsorbed } = useSpaceHeaderMorph();

  const show =
    mounted && progress > 0.14 && progress < 0.98 && !compactActionsAbsorbed;

  if (!show) return null;

  return createPortal(
    <div
      className="fixed right-0 left-0 z-[28] flex flex-wrap items-center justify-end gap-1.5 border-b border-border bg-background-2 px-5 py-2 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] sm:gap-2"
      style={{
        top: `calc(var(--app-menu-top-h, 65px) + var(--dho-identity-strip-h, 0px))`,
      }}
    >
      {typeof web3SpaceId === 'number' ? (
        <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
      ) : null}
      <ActionButtons web3SpaceId={web3SpaceId as number} />
    </div>,
    document.body,
  );
}
