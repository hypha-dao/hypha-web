'use client';

import type { ReactNode } from 'react';
import { JoinSpace } from '@hypha-platform/epics';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';

import { ActionButtons } from './action-buttons';
import {
  SPACE_MENU_TOP_FALLBACK_PX,
  useSpaceHeaderMorph,
} from './space-header-morph-context';

type SpaceHeaderFixedActionsProps = {
  mounted: boolean;
  identitySlot: ReactNode;
  navLink: ReactNode | null;
  web3SpaceId: number | null;
  spaceId: number;
};

/**
 * Fixed duplicate of `SpaceHeaderActionsRow` only while the in-flow row overlaps
 * MenuTop + identity strip; turns off once the row is absorbed (sticky).
 */
export function SpaceHeaderFixedActions({
  mounted,
  identitySlot,
  navLink,
  web3SpaceId,
  spaceId,
}: SpaceHeaderFixedActionsProps) {
  const { progress, reducedMotion, compactActionsMirror } =
    useSpaceHeaderMorph();

  const barOpacity = useMemo(() => {
    if (!compactActionsMirror) return 0;
    return Math.min(1, Math.max(0, (progress - 0.08) / 0.35));
  }, [compactActionsMirror, progress]);

  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!mounted || !portalReady || !compactActionsMirror) {
    return null;
  }

  const top = `calc(var(--app-menu-top-h, ${SPACE_MENU_TOP_FALLBACK_PX}px) + var(--app-subnav-h, 0px))`;

  return createPortal(
    <div
      className="fixed left-0 right-0 z-[29] border-b border-border bg-background-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
      style={{
        top,
        opacity: barOpacity,
        transform: reducedMotion
          ? undefined
          : `translateY(${(1 - barOpacity) * 4}px)`,
        transition: reducedMotion
          ? undefined
          : 'opacity 0.15s ease-out, transform 0.15s ease-out',
        pointerEvents: barOpacity > 0.2 ? 'auto' : 'none',
      }}
      role="region"
      aria-hidden={barOpacity < 0.05 || undefined}
    >
      <div className="mx-auto flex max-w-container-2xl flex-col gap-2 px-5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <div className="min-w-0 flex-1 overflow-hidden">{identitySlot}</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            {typeof web3SpaceId === 'number' ? (
              <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
            ) : null}
            {typeof web3SpaceId === 'number' ? (
              <ActionButtons web3SpaceId={web3SpaceId} />
            ) : null}
          </div>
          {navLink ? (
            <div className="flex shrink-0 items-center border-border pl-2 sm:border-l sm:pl-3">
              {navLink}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
