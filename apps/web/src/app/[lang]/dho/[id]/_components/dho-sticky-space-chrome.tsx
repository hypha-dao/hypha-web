'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  STICKY_SPACE_CHROME_AVATAR_CLASSNAME,
  STICKY_SPACE_CHROME_TITLE_CLASSNAME,
  getMainColumnScrollRoot,
  setMainColumnScrollY,
  subscribeMainColumnScroll,
  getMainColumnScrollY,
} from '@hypha-platform/epics';
import { Avatar, AvatarImage, Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

/** scrollTop so `el`'s top aligns with the main column scrollport top. */
function scrollTopToAlignElementTop(el: HTMLElement | null): number {
  if (!el || typeof window === 'undefined') return 0;
  const root = getMainColumnScrollRoot();
  if (root) {
    return (
      el.getBoundingClientRect().top -
      root.getBoundingClientRect().top +
      root.scrollTop
    );
  }
  return el.getBoundingClientRect().top + window.scrollY;
}

/**
 * Desktop (md+): pin a secondary chrome row under `MenuTop`. Lighter typography + avatar than
 * `CompactSpaceBanner` so it reads as tier-2 chrome. Actions / nested-space move via portal so the
 * same React trees (hooks) transition between positions — pixel-identical Button UI.
 *
 * Space scroll UX: default view hides the hero “top card” and pins the actions row under the
 * menu; scroll is clamped so users cannot scroll above that. A chevron scrolls smoothly to the top
 * to reveal the full banner again.
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
  const tDho = useTranslations('DHO');
  const menuTopPx = useMenuTopOffsetPx();
  /** Bottom edge of the space image banner — sticky engages when this passes under MenuTop */
  const bannerBottomSentinelRef = React.useRef<HTMLDivElement>(null);
  /** Hero / `CompactSpaceBanner` only — scroll-to-top reveals this “top card” */
  const heroBannerAnchorRef = React.useRef<HTMLDivElement | null>(null);

  const [flowActionsInnerEl, setFlowActionsInnerEl] =
    React.useState<HTMLDivElement | null>(null);
  const [stickyActionsEl, setStickyActionsEl] =
    React.useState<HTMLDivElement | null>(null);
  const [flowNestedEl, setFlowNestedEl] = React.useState<HTMLDivElement | null>(
    null,
  );

  const [stuck, setStuck] = React.useState(false);
  const stuckRef = React.useRef(false);

  const [flowMinH, setFlowMinH] = React.useState(44);

  const minScrollLockYRef = React.useRef(0);
  const clampRafRef = React.useRef(0);

  const recomputeMinScrollLock = React.useCallback(() => {
    const actions = flowActionsInnerEl;
    if (!actions) return;
    minScrollLockYRef.current = Math.max(
      0,
      Math.round(scrollTopToAlignElementTop(actions)),
    );
  }, [flowActionsInnerEl]);

  React.useLayoutEffect(() => {
    const outer = flowActionsInnerEl?.parentElement;
    if (!outer || stuck) return;
    const measure = () => {
      const h = Math.ceil(outer.getBoundingClientRect().height);
      if (h > 0) setFlowMinH(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [stuck, flowActionsInnerEl]);

  const scrollToShowHero = React.useCallback(() => {
    const el = heroBannerAnchorRef.current;
    if (!el) {
      setMainColumnScrollY(0, 'smooth');
      return;
    }
    const y = Math.max(0, Math.round(scrollTopToAlignElementTop(el)));
    setMainColumnScrollY(y, 'smooth');
  }, []);

  const snapToDefaultSpaceView = React.useCallback(() => {
    recomputeMinScrollLock();
    const y = minScrollLockYRef.current;
    if (y > 0) {
      setMainColumnScrollY(y, 'auto');
    }
  }, [recomputeMinScrollLock]);

  React.useLayoutEffect(() => {
    if (!flowActionsInnerEl) return;
    snapToDefaultSpaceView();
    const t = window.requestAnimationFrame(snapToDefaultSpaceView);
    return () => window.cancelAnimationFrame(t);
  }, [flowActionsInnerEl, snapToDefaultSpaceView]);

  React.useEffect(() => {
    const onResize = () => {
      recomputeMinScrollLock();
      const y = getMainColumnScrollY();
      if (y < minScrollLockYRef.current) {
        setMainColumnScrollY(minScrollLockYRef.current, 'auto');
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recomputeMinScrollLock]);

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
      raf = requestAnimationFrame(() => {
        raf = 0;
        tick();
        recomputeMinScrollLock();
        const minY = minScrollLockYRef.current;
        const y = getMainColumnScrollY();
        if (y < minY) {
          if (clampRafRef.current) cancelAnimationFrame(clampRafRef.current);
          clampRafRef.current = requestAnimationFrame(() => {
            clampRafRef.current = 0;
            setMainColumnScrollY(minY, 'auto');
          });
        }
      });
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
      if (clampRafRef.current) cancelAnimationFrame(clampRafRef.current);
    };
  }, [menuTopPx, recomputeMinScrollLock]);

  const logoSrc = logoUrl || defaultLogoSrc;

  const actionsPortalTarget = stuck ? stickyActionsEl : flowActionsInnerEl;
  const nestedPortalTarget = nestedSpacesSlot ? flowNestedEl : null;

  const renderScrollToTopButton = () => (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-10 w-10 shrink-0 border-border/80 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground"
      onClick={scrollToShowHero}
      title={tDho('spaceChrome.scrollToBanner')}
      aria-label={tDho('spaceChrome.scrollToBanner')}
    >
      <ChevronUp className="h-5 w-5" strokeWidth={2.25} aria-hidden />
    </Button>
  );

  return (
    <>
      <div
        className={cn(
          /* Leave room for main-column scrollbar (narrow-scrollbar ~8–12px) so it is not painted under this bar */
          'pointer-events-none fixed left-[var(--sidebar-left-width,0px)] z-[25] hidden md:block',
          'right-[calc(var(--sidebar-right-width,0px)+var(--main-column-scrollbar-width,10px))]',
          'bg-background supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-md',
          'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/80',
          'transition-[opacity,transform] duration-200 ease-linear motion-reduce:transition-none',
          stuck
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : '-translate-y-1 opacity-0 motion-reduce:translate-y-0',
        )}
        style={{ top: 'var(--menu-top-height, 4rem)' }}
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
          <div className="flex shrink-0 items-center gap-2">
            {renderScrollToTopButton()}
            <div
              ref={setStickyActionsEl}
              className="flex shrink-0 flex-nowrap items-center gap-2"
            />
          </div>
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

        <div className="flex flex-col gap-4">
          <div ref={heroBannerAnchorRef} className="relative">
            {banner}
            <div
              ref={bannerBottomSentinelRef}
              className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
              aria-hidden
            />
          </div>

          <div
            className={cn(
              'flex items-center justify-end gap-2 px-0 md:flex-nowrap md:min-h-[var(--secondary-chrome-actions-row-height,52px)]',
              stuck && 'pointer-events-none invisible opacity-0',
            )}
            style={stuck ? { minHeight: flowMinH } : undefined}
          >
            {renderScrollToTopButton()}
            <div
              ref={setFlowActionsInnerEl}
              className={cn(
                'flex min-h-[var(--secondary-chrome-actions-row-height,52px)] flex-1 flex-wrap items-center justify-end gap-2 md:flex-nowrap',
              )}
            />
          </div>
        </div>
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
