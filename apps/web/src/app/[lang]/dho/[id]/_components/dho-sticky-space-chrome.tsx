'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  COMPACT_SPACE_BANNER_AVATAR_CLASSNAME,
  COMPACT_SPACE_BANNER_TITLE_CLASSNAME,
  subscribeMainColumnScroll,
} from '@hypha-platform/epics';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export type DhoStickySpaceChromeProps = {
  breadcrumbsRow: React.ReactNode;
  banner: React.ReactNode;
  actionsSlot: React.ReactNode;
  nestedSpacesSlot: React.ReactNode;
  title: string;
  logoUrl: string;
  logoAlt: string;
  defaultLogoSrc: string;
};

function useMenuTopOffsetPx(): number {
  const [px, setPx] = React.useState(64);

  React.useLayoutEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        '--menu-top-height',
      );
      const n = parseFloat(raw);
      setPx(Number.isFinite(n) && n > 0 ? n : 64);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(document.documentElement);
    window.addEventListener('resize', read);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);

  return px;
}

/**
 * Desktop (md+): pin a compact chrome row under `MenuTop`. Actions / nested-space move
 * via portal so the same React trees (hooks) transition between positions — pixel-identical Button UI.
 *
 * Note: `createPortal` remounts its subtree when the container DOM node changes (e.g. when
 * `actionsPortalTarget` swaps between in-flow and sticky targets). Stateful descendants reset;
 * lift state above the portaled subtree if that becomes a problem.
 */
export function DhoStickySpaceChrome({
  breadcrumbsRow,
  banner,
  actionsSlot,
  nestedSpacesSlot,
  title,
  logoUrl,
  logoAlt,
  defaultLogoSrc,
}: DhoStickySpaceChromeProps) {
  const menuTopPx = useMenuTopOffsetPx();
  /** Bottom edge of the space image banner — sticky engages when this passes under MenuTop */
  const bannerBottomSentinelRef = React.useRef<HTMLDivElement>(null);

  const [flowActionsEl, setFlowActionsEl] =
    React.useState<HTMLDivElement | null>(null);
  const [stickyActionsEl, setStickyActionsEl] =
    React.useState<HTMLDivElement | null>(null);
  const [flowNestedEl, setFlowNestedEl] = React.useState<HTMLDivElement | null>(
    null,
  );

  const [stuck, setStuck] = React.useState(false);
  const stuckRef = React.useRef(false);

  const [flowMinH, setFlowMinH] = React.useState(44);

  React.useLayoutEffect(() => {
    const el = flowActionsEl;
    if (!el || stuck) return;
    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setFlowMinH(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stuck, flowActionsEl]);

  React.useEffect(() => {
    const sentinel = bannerBottomSentinelRef.current;
    if (!sentinel) return;

    const mq = window.matchMedia('(min-width: 768px)');
    const HYST = 12;
    let raf = 0;

    const tick = () => {
      raf = 0;
      if (!mq.matches) {
        if (stuckRef.current) {
          stuckRef.current = false;
          setStuck(false);
        }
        return;
      }
      const bannerBottom = sentinel.getBoundingClientRect().bottom;
      let next = stuckRef.current;
      if (!next && bannerBottom <= menuTopPx) next = true;
      if (next && bannerBottom >= menuTopPx + HYST) next = false;
      if (next !== stuckRef.current) {
        stuckRef.current = next;
        setStuck(next);
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(tick);
    };

    tick();
    mq.addEventListener('change', onScroll);
    const unsubscribeScroll = subscribeMainColumnScroll(onScroll);
    window.addEventListener('resize', onScroll);
    return () => {
      mq.removeEventListener('change', onScroll);
      unsubscribeScroll();
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [menuTopPx]);

  const logoSrc = logoUrl || defaultLogoSrc;

  const actionsPortalTarget = stuck ? stickyActionsEl : flowActionsEl;
  const nestedPortalTarget = nestedSpacesSlot ? flowNestedEl : null;

  return (
    <>
      <div
        className={cn(
          /* Leave room for main-column scrollbar (narrow-scrollbar ~8–12px) so it is not painted under this bar */
          'pointer-events-none fixed left-[var(--sidebar-left-width,0px)] z-[25] hidden md:block',
          'right-[calc(var(--sidebar-right-width,0px)+var(--main-column-scrollbar-width,10px))]',
          'border-b border-border bg-background-2 transition-[opacity,transform,box-shadow] duration-200 ease-out',
          stuck
            ? 'pointer-events-auto translate-y-0 opacity-100 shadow-md'
            : '-translate-y-2 opacity-0',
        )}
        style={{ top: 'var(--menu-top-height, 4rem)' }}
        aria-hidden={!stuck}
      >
        <div className="mx-auto flex max-w-container-2xl items-center gap-3 px-8 py-2.5">
          {/* Match CompactSpaceBanner row: same avatar, title tokens, gap-6; px-8 L/R balances chrome */}
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Avatar className={COMPACT_SPACE_BANNER_AVATAR_CLASSNAME}>
              <AvatarImage
                src={logoSrc}
                alt={logoAlt}
                className="object-cover"
              />
            </Avatar>
            <p
              className={cn(
                COMPACT_SPACE_BANNER_TITLE_CLASSNAME,
                'min-w-0 flex-1 truncate text-foreground',
              )}
              aria-hidden
            >
              {title}
            </p>
          </div>
          <div
            ref={setStickyActionsEl}
            className="flex shrink-0 flex-nowrap items-center gap-2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:flex-nowrap md:gap-x-4">
          <div className="flex min-w-0 flex-1 items-center">
            {breadcrumbsRow}
          </div>
          {nestedSpacesSlot ? (
            <div ref={setFlowNestedEl} className="shrink-0" />
          ) : null}
        </div>

        <div className="relative">
          {banner}
          <div
            ref={bannerBottomSentinelRef}
            className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
            aria-hidden
          />
        </div>

        <div
          ref={setFlowActionsEl}
          className={cn(
            /* No extra horizontal padding: tab content (e.g. Claim) uses full container width */
            'flex justify-end gap-2 px-0 md:flex-nowrap',
            stuck && 'pointer-events-none invisible opacity-0',
          )}
          style={stuck ? { minHeight: flowMinH } : undefined}
        />
      </div>

      {actionsPortalTarget
        ? createPortal(actionsSlot, actionsPortalTarget)
        : null}
      {nestedSpacesSlot && nestedPortalTarget
        ? createPortal(nestedSpacesSlot, nestedPortalTarget)
        : null}
    </>
  );
}
