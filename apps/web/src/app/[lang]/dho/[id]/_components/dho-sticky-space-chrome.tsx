'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  STICKY_SPACE_CHROME_AVATAR_CLASSNAME,
  STICKY_SPACE_CHROME_TITLE_CLASSNAME,
  subscribeMainColumnScroll,
} from '@hypha-platform/epics';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export type DhoStickySpaceChromeProps = {
  breadcrumbsRow: React.ReactNode;
  banner: React.ReactNode;
  actionsSlot: React.ReactNode;
  title: string;
  logoUrl: string;
  logoAlt: string;
  defaultLogoSrc: string;
};

function useMenuTopOffsetPx(): number {
  const [px, setPx] = React.useState(70);

  React.useLayoutEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        '--menu-top-height',
      );
      const n = parseFloat(raw);
      setPx(Number.isFinite(n) && n > 0 ? n : 70);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    window.addEventListener('resize', read);
    return () => {
      mo.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);

  return px;
}

/**
 * Desktop (md+): pin a secondary chrome row under `MenuTop`. Lighter typography + avatar than
 * `CompactSpaceBanner` so it reads as tier-2 chrome. Actions / nested-space move via portal so the
 * same React trees (hooks) transition between positions — pixel-identical Button UI.
 *
 * Note: `createPortal` remounts its subtree when the container DOM node changes (e.g. when
 * `actionsPortalTarget` swaps between in-flow and sticky targets). Stateful descendants reset;
 * lift state above the portaled subtree if that becomes a problem.
 */
export function DhoStickySpaceChrome({
  breadcrumbsRow,
  banner,
  actionsSlot,
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

  return (
    <>
      <div
        className={cn(
          /*
           * Use live panel inset vars (non-animated) so sticky chrome stays physically attached
           * to panel edges while users drag-resize left/right sidebars.
           */
          'pointer-events-none fixed left-[var(--panel-left-inset,var(--sidebar-left-width,0px))] z-[25] hidden md:block',
          'right-[var(--panel-right-inset,calc(var(--sidebar-right-width,0px)+var(--main-column-scrollbar-width,0px)))]',
          'bg-background supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-md',
          'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/80',
          'transition-[opacity,transform] duration-200 ease-linear motion-reduce:transition-none',
          stuck
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : '-translate-y-1 opacity-0 motion-reduce:translate-y-0',
        )}
        style={{ top: 'var(--menu-top-height, 70px)' }}
        aria-hidden={!stuck}
      >
        <div className="mx-auto flex min-h-11 max-w-container-2xl items-center gap-3 px-4 py-2.5 sm:px-6 md:min-h-[52px] md:py-3 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Avatar className={STICKY_SPACE_CHROME_AVATAR_CLASSNAME}>
              <AvatarImage
                src={logoSrc}
                alt={logoAlt}
                className="object-cover"
              />
            </Avatar>
            <p
              className={cn(
                STICKY_SPACE_CHROME_TITLE_CLASSNAME,
                'min-w-0 flex-1 truncate text-foreground',
              )}
              title={title}
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
        <div className="relative">
          {banner}
          <div
            ref={bannerBottomSentinelRef}
            className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
            aria-hidden
          />
        </div>

        <div className="flex min-w-0 items-center">{breadcrumbsRow}</div>

        <div
          ref={setFlowActionsEl}
          className={cn(
            /* Same min-height as HumanChatPanelTabs so bottom borders align with chat panel */
            'flex justify-end gap-2 px-0 md:flex-nowrap md:items-center md:min-h-[var(--secondary-chrome-actions-row-height,52px)]',
            stuck && 'pointer-events-none invisible opacity-0',
          )}
          style={stuck ? { minHeight: flowMinH } : undefined}
        />
      </div>

      {actionsPortalTarget
        ? createPortal(actionsSlot, actionsPortalTarget)
        : null}
    </>
  );
}
