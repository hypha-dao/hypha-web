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
import { useTheme } from 'next-themes';

const STICKY_APPEAR_OFFSET_PX = 0;
const STICKY_HYSTERESIS_PX = 16;

export type DhoStickySpaceChromeProps = {
  banner: React.ReactNode;
  actionsSlot: React.ReactNode;
  title: string;
  logoUrl: string;
  logoAlt: string;
  defaultLogoSrc: string;
};

function useMenuTopOffsetPx(): number {
  const [px, setPx] = React.useState(70);
  const pxRef = React.useRef(px);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    pxRef.current = px;
  }, [px]);

  React.useLayoutEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        '--menu-top-height',
      );
      const n = parseFloat(raw);
      const next = Number.isFinite(n) && n > 0 ? n : 70;
      if (next !== pxRef.current) {
        pxRef.current = next;
        setPx(next);
      }
    };
    const scheduleRead = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        read();
      });
    };
    read();
    const mo = new MutationObserver(scheduleRead);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    window.addEventListener('resize', scheduleRead);
    return () => {
      mo.disconnect();
      window.removeEventListener('resize', scheduleRead);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
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
  banner,
  actionsSlot,
  title,
  logoUrl,
  logoAlt,
  defaultLogoSrc,
}: DhoStickySpaceChromeProps) {
  const menuTopPx = useMenuTopOffsetPx();
  const { resolvedTheme } = useTheme();
  /** Bottom edge of the space image banner — sticky engages when this passes under MenuTop */
  const bannerBottomSentinelRef = React.useRef<HTMLDivElement>(null);

  const [flowActionsEl, setFlowActionsEl] =
    React.useState<HTMLDivElement | null>(null);
  const [stickyActionsEl, setStickyActionsEl] =
    React.useState<HTMLDivElement | null>(null);
  const [hasActionsContent, setHasActionsContent] = React.useState(false);

  const [stuck, setStuck] = React.useState(false);
  const stuckRef = React.useRef(false);

  React.useEffect(() => {
    const sentinel = bannerBottomSentinelRef.current;
    if (!sentinel) return;

    const mq = window.matchMedia('(min-width: 768px)');
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
      const appearAt = menuTopPx + STICKY_APPEAR_OFFSET_PX;
      if (!next && bannerBottom <= appearAt - 1) next = true;
      if (next && bannerBottom >= appearAt + STICKY_HYSTERESIS_PX) next = false;
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
  // During hydration `resolvedTheme` can be undefined briefly; default to dark
  // to avoid flashing a light (white) secondary banner in dark mode sessions.
  const isDark = resolvedTheme !== 'light';

  React.useEffect(() => {
    const hasRenderableContent = (el: HTMLDivElement | null) => {
      if (!el) return false;
      return Array.from(el.childNodes).some((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) return true;
        if (node.nodeType === Node.TEXT_NODE) {
          return Boolean(node.textContent?.trim());
        }
        return false;
      });
    };

    const updateHasActionsContent = () => {
      const next =
        hasRenderableContent(flowActionsEl) ||
        hasRenderableContent(stickyActionsEl);
      setHasActionsContent((prev) => (prev === next ? prev : next));
    };

    updateHasActionsContent();

    const observer = new MutationObserver(updateHasActionsContent);
    if (flowActionsEl) {
      observer.observe(flowActionsEl, { childList: true, subtree: true });
    }
    if (stickyActionsEl) {
      observer.observe(stickyActionsEl, { childList: true, subtree: true });
    }

    return () => observer.disconnect();
  }, [flowActionsEl, stickyActionsEl]);

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
          'overflow-hidden border-b border-border/75',
          'supports-[backdrop-filter]:backdrop-blur-md',
          'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white/10',
          'transition-[opacity,transform,box-shadow] duration-250 ease-linear motion-reduce:transition-none',
          stuck
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : '-translate-y-1 opacity-0 motion-reduce:translate-y-0',
        )}
        style={{
          top: 'var(--menu-top-height, 70px)',
          backgroundColor: isDark
            ? 'rgba(7,10,16,0.92)'
            : 'rgba(248,250,252,0.94)',
          backgroundImage: isDark
            ? 'linear-gradient(to right, rgba(0,0,0,0.58), rgba(0,0,0,0.42), rgba(0,0,0,0.5)), linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent-11, var(--space-accent, #4f46e5)) 14%, transparent), transparent 55%)'
            : 'linear-gradient(to right, rgba(255,255,255,0.78), rgba(255,255,255,0.64), rgba(255,255,255,0.74)), linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent-11, var(--space-accent, #4f46e5)) 11%, transparent), transparent 58%)',
          boxShadow: isDark
            ? '0 10px 28px -18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 10px 24px -20px rgba(15,23,42,0.26), inset 0 1px 0 rgba(255,255,255,0.78)',
        }}
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

      <div
        className={cn('flex flex-col', hasActionsContent ? 'gap-4' : 'gap-0')}
      >
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
            /* Same min-height as HumanChatPanelTabs so bottom borders align with chat panel */
            'flex justify-end gap-2 px-0 md:flex-nowrap md:items-center',
            hasActionsContent &&
              'md:min-h-[var(--secondary-chrome-actions-row-height,52px)]',
            stuck && 'pointer-events-none invisible opacity-0',
          )}
          style={
            stuck
              ? { minHeight: 'var(--secondary-chrome-actions-row-height,52px)' }
              : undefined
          }
        />
      </div>

      {actionsPortalTarget
        ? createPortal(actionsSlot, actionsPortalTarget)
        : null}
    </>
  );
}
