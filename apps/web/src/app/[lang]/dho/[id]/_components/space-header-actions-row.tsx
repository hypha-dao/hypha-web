'use client';

import { JoinSpace } from '@hypha-platform/epics';
import { cn } from '@hypha-platform/ui-utils';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ActionButtons } from './action-buttons';
import { useSpaceHeaderMorph } from './space-header-morph-context';

type SpaceHeaderActionsRowProps = {
  web3SpaceId: number | null;
  spaceId: number;
};

function parseCssPx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function SpaceHeaderActionsRow({
  web3SpaceId,
  spaceId,
}: SpaceHeaderActionsRowProps) {
  const {
    progress,
    compactActionsAbsorbed,
    setCompactActionsAbsorbed,
    setActionsRowHeightPx,
  } = useSpaceHeaderMorph();
  const measureRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [measuredH, setMeasuredH] = useState(44);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const sync = () => {
      const h = el.offsetHeight;
      setMeasuredH(h);
      setActionsRowHeightPx(h);
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    return () => ro.disconnect();
  }, [setActionsRowHeightPx]);

  useEffect(() => {
    const tick = () => {
      const row = rowRef.current;
      if (!row) return;
      const cs = getComputedStyle(document.documentElement);
      const menu = parseCssPx(cs.getPropertyValue('--app-menu-top-h')) || 65;
      const idStrip =
        parseCssPx(cs.getPropertyValue('--dho-identity-strip-h')) || 0;
      const threshold = menu + idStrip + 2;
      const top = row.getBoundingClientRect().top;
      setCompactActionsAbsorbed(top <= threshold && progress > 0.1);
    };

    tick();
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    return () => {
      window.removeEventListener('scroll', tick);
      window.removeEventListener('resize', tick);
    };
  }, [progress, setCompactActionsAbsorbed]);

  /** Fixed portal duplicates this row until it scrolls under MenuTop + identity strip. */
  const portalDuplicate = progress > 0.14 && !compactActionsAbsorbed;

  const stickyTop = `calc(var(--app-menu-top-h, 65px) + var(--dho-identity-strip-h, 0px))`;

  return (
    <div>
      {portalDuplicate ? (
        <div style={{ minHeight: measuredH }} aria-hidden />
      ) : null}

      <div
        ref={rowRef}
        className={cn(
          'flex flex-wrap justify-end gap-2',
          portalDuplicate ? 'pointer-events-none pt-0' : 'pt-5 sm:pt-6',
          compactActionsAbsorbed &&
            progress > 0.1 &&
            'sticky z-[28] border-b border-border bg-background-2 py-2 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]',
        )}
        style={
          compactActionsAbsorbed && progress > 0.1
            ? { top: stickyTop }
            : undefined
        }
      >
        <div
          ref={measureRef}
          className={cn(
            'flex flex-wrap justify-end gap-2',
            portalDuplicate && 'invisible',
          )}
          aria-hidden={portalDuplicate || undefined}
        >
          {typeof web3SpaceId === 'number' ? (
            <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
          ) : null}
          <ActionButtons web3SpaceId={web3SpaceId as number} />
        </div>
      </div>
    </div>
  );
}
