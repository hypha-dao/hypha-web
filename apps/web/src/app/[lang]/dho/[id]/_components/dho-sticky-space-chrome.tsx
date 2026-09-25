'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useParams, usePathname } from 'next/navigation';
import {
  STICKY_SPACE_CHROME_AVATAR_CLASSNAME,
  STICKY_SPACE_CHROME_TITLE_CLASSNAME,
  animateMainColumnScrollBy,
  clearMainColumnScrollFreeze,
  freezeMainColumnScrollAt,
  getMainColumnScrollElement,
  getMainColumnScrollY,
  isMainColumnScrollFrozen,
  reapplyMainColumnScrollFreeze,
  scrollMainColumnBy,
  scrollMainColumnTo,
  subscribeMainColumnScroll,
} from '@hypha-platform/epics';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const STICKY_HYSTERESIS_PX = 16;
/** Full cover stays visible, then the row settles. Inside the 1–2s entry window. */
const SPACE_ENTRY_BANNER_HOLD_MS = 1500;
/** Controlled settle ease — browser `smooth` was ~300–500ms and felt like a snap. */
const SPACE_ENTRY_SETTLE_MS = 900;
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

type SpaceEntryMemory = {
  /** Path that started this visit. A later in-space path must not replay the intro. */
  startPath: string | null;
  /** Intro finished, or an in-space navigation superseded it. */
  introduced: boolean;
  holdStartedAt: number | null;
  scrollTop: number;
  /** Full cover is on screen. The next in-space route change scrolls to the banner. */
  headerInView: boolean;
};

function spaceEntryMemoryMap(): Map<string, SpaceEntryMemory> {
  const g = globalThis as typeof globalThis & {
    __hyphaSpaceEntryMemory?: Map<string, SpaceEntryMemory>;
  };
  if (!g.__hyphaSpaceEntryMemory) {
    g.__hyphaSpaceEntryMemory = new Map();
  }
  return g.__hyphaSpaceEntryMemory;
}

function spaceEntryMemory(spaceSlug: string): SpaceEntryMemory {
  const map = spaceEntryMemoryMap();
  let mem = map.get(spaceSlug);
  if (!mem) {
    mem = {
      startPath: null,
      introduced: false,
      holdStartedAt: null,
      scrollTop: 0,
      headerInView: true,
    };
    map.set(spaceSlug, mem);
  }
  return mem;
}

function spaceSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/\/dho\/([^/]+)/);
  return match?.[1] ?? null;
}

/** In-flight first-entry hold. Tab changes cancel it so it cannot scroll again. */
let cancelActiveIntro: (() => void) | null = null;

function readMenuTopPx(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--menu-top-height',
  );
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 70;
}

function stickyRowHeightPx(el: HTMLElement | null): number {
  if (!el) return 0;
  const height = el.getBoundingClientRect().height;
  return Number.isFinite(height) && height > 0 ? height : 0;
}

/**
 * Viewport Y of the sticky row's bottom edge. The row is fixed under MenuTop, so
 * engaging when the banner bottom reaches this line puts the row above the tab
 * menu instead of on top of the tabs and section title.
 */
function stickyAppearLineY(menuTopPx: number, bar: HTMLElement | null): number {
  return menuTopPx + stickyRowHeightPx(bar);
}

/** Pixels to scroll so the banner bottom meets the sticky row's bottom edge. */
function bannerAlignDelta(
  sentinel: HTMLElement | null,
  bar: HTMLElement | null,
): number | null {
  if (!sentinel || !bar) return null;
  const menuTop = readMenuTopPx();
  const appearAt = stickyAppearLineY(menuTop, bar);
  if (!(appearAt > menuTop)) return null;
  return sentinel.getBoundingClientRect().bottom - appearAt;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

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
      const next = readMenuTopPx();
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
  const params = useParams();
  const pathname = usePathname() ?? '';
  const spaceSlug =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : '';

  const menuTopPx = useMenuTopOffsetPx();
  /** Bottom edge of the space cover. Sticky engages when this meets the row's bottom edge. */
  const bannerBottomSentinelRef = React.useRef<HTMLDivElement>(null);
  const stickyBarRef = React.useRef<HTMLDivElement>(null);

  const [stickyActionsEl, setStickyActionsEl] =
    React.useState<HTMLDivElement | null>(null);

  const [stuck, setStuck] = React.useState(false);
  const stuckRef = React.useRef(false);

  React.useEffect(() => {
    const sentinel = bannerBottomSentinelRef.current;
    const bar = stickyBarRef.current;
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
      const appearAt = stickyAppearLineY(readMenuTopPx(), stickyBarRef.current);
      if (!next && bannerBottom <= appearAt + 0.5) next = true;
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
    const ro = bar ? new ResizeObserver(onScroll) : null;
    if (bar) ro?.observe(bar);
    return () => {
      mq.removeEventListener('change', onScroll);
      unsubscribeScroll();
      window.removeEventListener('resize', onScroll);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [menuTopPx]);

  const readHeaderInView = React.useCallback(() => {
    const delta = bannerAlignDelta(
      bannerBottomSentinelRef.current,
      stickyBarRef.current,
    );
    if (delta == null) return getMainColumnScrollY() <= 2;
    return delta > STICKY_HYSTERESIS_PX;
  }, []);

  const settleCancelRef = React.useRef<(() => void) | null>(null);
  const freezeGenRef = React.useRef(0);

  const releaseFreezeWhenStable = React.useCallback(
    (expectedTop: number, allowUnchangedRelease: boolean) => {
      const gen = freezeGenRef.current;
      const initialHeight = getMainColumnScrollElement()?.scrollHeight ?? 0;
      const started = performance.now();
      let changed = false;
      let ready = 0;
      const tick = () => {
        if (gen !== freezeGenRef.current || !isMainColumnScrollFrozen()) return;
        reapplyMainColumnScrollFreeze();
        const el = getMainColumnScrollElement();
        const height = el?.scrollHeight ?? 0;
        if (Math.abs(height - initialHeight) > 1) changed = true;
        const max = el
          ? Math.max(0, el.scrollHeight - el.clientHeight)
          : Math.max(
              0,
              document.documentElement.scrollHeight - window.innerHeight,
            );
        const tallEnough = max + 2 >= expectedTop;
        const elapsed = performance.now() - started;
        // A click-time watcher must see the tab slot change height before it
        // lets go — the outgoing page is already tall enough to hold scroll.
        const stable =
          tallEnough && (changed || (allowUnchangedRelease && elapsed > 700));
        if (stable) ready += 1;
        else ready = 0;
        if (ready >= 2 || elapsed > 4000) {
          if (gen === freezeGenRef.current) clearMainColumnScrollFreeze();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [],
  );

  const scrollToStickyBanner = React.useCallback(() => {
    settleCancelRef.current?.();
    settleCancelRef.current = null;
    clearMainColumnScrollFreeze();
    const desktop = window.matchMedia('(min-width: 768px)');
    if (!desktop.matches || !spaceSlug) return;
    const mem = spaceEntryMemory(spaceSlug);
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const delta = bannerAlignDelta(
      bannerBottomSentinelRef.current,
      stickyBarRef.current,
    );
    const finish = () => {
      settleCancelRef.current = null;
      mem.introduced = true;
      mem.headerInView = false;
      mem.scrollTop = getMainColumnScrollY();
      const rest = bannerAlignDelta(
        bannerBottomSentinelRef.current,
        stickyBarRef.current,
      );
      if (rest != null && Math.abs(rest) > 1) {
        scrollMainColumnBy(rest, 'auto');
        mem.scrollTop = getMainColumnScrollY();
      }
    };
    if (delta == null || delta <= 1) {
      finish();
      return;
    }
    let userTookOver = false;
    let cancelAnim: () => void = () => {};
    const detachInput = () => {
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('touchmove', takeOver, { capture: true });
    };
    const takeOver = () => {
      if (userTookOver) return;
      userTookOver = true;
      cancelAnim();
      detachInput();
      settleCancelRef.current = null;
      scrollMainColumnTo(getMainColumnScrollY(), 'auto');
      mem.introduced = true;
      mem.scrollTop = getMainColumnScrollY();
      mem.headerInView = readHeaderInView();
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 1) return;
      takeOver();
    };
    window.addEventListener('wheel', onWheel, { passive: true, capture: true });
    window.addEventListener('touchmove', takeOver, {
      passive: true,
      capture: true,
    });
    cancelAnim = animateMainColumnScrollBy(
      delta,
      reduceMotion ? 0 : SPACE_ENTRY_SETTLE_MS,
      () => {
        detachInput();
        settleCancelRef.current = null;
        if (userTookOver) return;
        finish();
      },
    );
    settleCancelRef.current = () => {
      userTookOver = true;
      cancelAnim();
      detachInput();
    };
  }, [readHeaderInView, spaceSlug]);

  React.useEffect(() => {
    return () => {
      settleCancelRef.current?.();
      clearMainColumnScrollFreeze();
    };
  }, []);

  React.useEffect(() => {
    if (!spaceSlug || !pathname) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    if (!desktop.matches) return;

    const mem = spaceEntryMemory(spaceSlug);
    // In-space remounts (tab RSC refresh) used to run this effect again: scroll
    // to 0, hold, then settle — the header flash. Never restart after the visit
    // has a start path on a different route.
    if (mem.startPath && mem.startPath !== pathname) {
      mem.introduced = true;
      return;
    }
    if (mem.introduced) return;

    const firstStart = mem.startPath == null;
    mem.startPath = pathname;
    mem.headerInView = true;
    if (mem.holdStartedAt == null) mem.holdStartedAt = performance.now();

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    let cancelled = false;
    let userTookOver = false;
    let animating = false;
    let programmatic = false;
    let cancelAnim: (() => void) | null = null;
    let holdTimer = 0;

    const releaseProgrammatic = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          programmatic = false;
        });
      });
    };

    const jumpToSettled = () => {
      const delta = bannerAlignDelta(
        bannerBottomSentinelRef.current,
        stickyBarRef.current,
      );
      if (delta == null || delta <= 1) return;
      programmatic = true;
      scrollMainColumnBy(delta, 'auto');
      releaseProgrammatic();
    };

    const rememberUserPosition = () => {
      mem.introduced = true;
      mem.scrollTop = getMainColumnScrollY();
      mem.headerInView = readHeaderInView();
    };

    if (reduceMotion) {
      // Prefer reduced motion: land on the sticky row with no hold/animation.
      const raf = window.requestAnimationFrame(() => {
        if (cancelled) return;
        jumpToSettled();
        mem.introduced = true;
        mem.headerInView = false;
        mem.scrollTop = getMainColumnScrollY();
      });
      const cancelThis = () => {
        cancelled = true;
        window.cancelAnimationFrame(raf);
      };
      cancelActiveIntro = cancelThis;
      return () => {
        cancelThis();
        if (cancelActiveIntro === cancelThis) cancelActiveIntro = null;
      };
    }

    // First entry only: show the full cover, then ease into the sticky row.
    // Re-runs (strict mode, remount) must not jump back to the top.
    if (firstStart && getMainColumnScrollY() > 2) {
      programmatic = true;
      scrollMainColumnTo(0, 'auto');
      releaseProgrammatic();
    }

    const takeOver = () => {
      userTookOver = true;
      rememberUserPosition();
      if (!animating) return;
      animating = false;
      cancelAnim?.();
      cancelAnim = null;
      programmatic = true;
      scrollMainColumnTo(getMainColumnScrollY(), 'auto');
      releaseProgrammatic();
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 1) return;
      takeOver();
    };
    const onTouchMove = () => {
      takeOver();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !SCROLL_KEYS.has(event.key)) return;
      takeOver();
    };

    const unsubscribeScroll = subscribeMainColumnScroll(() => {
      if (cancelled || programmatic || animating || userTookOver) return;
      if (getMainColumnScrollY() > 2) {
        userTookOver = true;
        rememberUserPosition();
      }
    });

    const elapsed =
      performance.now() - (mem.holdStartedAt ?? performance.now());
    holdTimer = window.setTimeout(() => {
      if (cancelled || userTookOver || !desktop.matches) return;
      if (getMainColumnScrollY() > 2) {
        rememberUserPosition();
        return;
      }

      const delta = bannerAlignDelta(
        bannerBottomSentinelRef.current,
        stickyBarRef.current,
      );
      if (delta == null || delta <= 1) {
        mem.introduced = true;
        mem.headerInView = false;
        mem.scrollTop = getMainColumnScrollY();
        return;
      }

      animating = true;
      programmatic = true;
      cancelAnim = animateMainColumnScrollBy(
        delta,
        SPACE_ENTRY_SETTLE_MS,
        () => {
          animating = false;
          cancelAnim = null;
          releaseProgrammatic();
          if (cancelled || userTookOver) return;
          const rest = bannerAlignDelta(
            bannerBottomSentinelRef.current,
            stickyBarRef.current,
          );
          if (rest != null && Math.abs(rest) > 1) {
            programmatic = true;
            scrollMainColumnBy(rest, 'auto');
            releaseProgrammatic();
          }
          mem.introduced = true;
          mem.headerInView = false;
          mem.scrollTop = getMainColumnScrollY();
        },
      );
    }, Math.max(0, SPACE_ENTRY_BANNER_HOLD_MS - elapsed));

    window.addEventListener('wheel', onWheel, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, {
      passive: true,
      capture: true,
    });
    window.addEventListener('keydown', onKeyDown, { capture: true });

    const cancelThis = () => {
      cancelled = true;
      window.clearTimeout(holdTimer);
      cancelAnim?.();
      cancelAnim = null;
    };
    cancelActiveIntro = cancelThis;

    return () => {
      cancelThis();
      if (cancelActiveIntro === cancelThis) cancelActiveIntro = null;
      unsubscribeScroll();
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [pathname, readHeaderInView, spaceSlug]);

  const pathnameRef = React.useRef(pathname);
  pathnameRef.current = pathname;
  const prevPathRef = React.useRef<string | null>(null);

  React.useLayoutEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (!spaceSlug || !prev || prev === pathname) return;

    const prevSpace = spaceSlugFromPath(prev);
    if (!prevSpace || prevSpace !== spaceSlug) {
      freezeGenRef.current += 1;
      clearMainColumnScrollFreeze();
      return;
    }

    // Same space, new screen. Drop any in-flight intro so it cannot scroll to
    // the top and play the entry settle again.
    cancelActiveIntro?.();
    const mem = spaceEntryMemory(spaceSlug);
    mem.introduced = true;

    if (mem.headerInView) {
      // Stop the click watcher so it cannot pin the header during the settle.
      freezeGenRef.current += 1;
      queueMicrotask(() => {
        if (pathnameRef.current !== pathname) {
          clearMainColumnScrollFreeze();
          return;
        }
        scrollToStickyBanner();
      });
      return;
    }

    if (isMainColumnScrollFrozen()) {
      queueMicrotask(() => {
        reapplyMainColumnScrollFreeze();
      });
      return;
    }

    freezeGenRef.current += 1;
    freezeMainColumnScrollAt(mem.scrollTop);
    queueMicrotask(() => {
      reapplyMainColumnScrollFreeze();
    });
    releaseFreezeWhenStable(mem.scrollTop, true);
  }, [pathname, releaseFreezeWhenStable, scrollToStickyBanner, spaceSlug]);

  React.useEffect(() => {
    if (!spaceSlug) return;

    let userIntent = false;
    let intentTimer = 0;
    const markIntent = () => {
      userIntent = true;
      window.clearTimeout(intentTimer);
      intentTimer = window.setTimeout(() => {
        userIntent = false;
      }, 160);
    };
    const remember = () => {
      if (!userIntent || isMainColumnScrollFrozen()) return;
      const mem = spaceEntryMemory(spaceSlug);
      if (!mem.startPath) return;
      mem.scrollTop = getMainColumnScrollY();
      mem.headerInView = readHeaderInView();
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 1) return;
      if (isMainColumnScrollFrozen()) clearMainColumnScrollFreeze();
      markIntent();
    };
    const onTouch = () => {
      if (isMainColumnScrollFrozen()) clearMainColumnScrollFreeze();
      markIntent();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !SCROLL_KEYS.has(event.key)) return;
      if (isMainColumnScrollFrozen()) clearMainColumnScrollFreeze();
      markIntent();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest('a, button, input, textarea, select, [role="button"]')
      ) {
        return;
      }
      const root = getMainColumnScrollElement();
      if (root ? target === root : true) {
        if (isMainColumnScrollFrozen()) clearMainColumnScrollFreeze();
        markIntent();
      }
    };

    const unsubscribe = subscribeMainColumnScroll(remember);
    window.addEventListener('wheel', onWheel, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouch, {
      passive: true,
      capture: true,
    });
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      window.clearTimeout(intentTimer);
      unsubscribe();
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('touchmove', onTouch, { capture: true });
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('pointerdown', onPointerDown, {
        capture: true,
      });
    };
  }, [readHeaderInView, spaceSlug]);

  React.useEffect(() => {
    if (!spaceSlug) return;
    const onClickCapture = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      const nextSpace = spaceSlugFromPath(anchor.pathname);
      if (!nextSpace || nextSpace !== spaceSlug) return;
      if (
        anchor.pathname === window.location.pathname &&
        anchor.search === window.location.search
      ) {
        return;
      }

      const mem = spaceEntryMemory(spaceSlug);
      if (!mem.startPath) return;
      mem.scrollTop = getMainColumnScrollY();
      mem.headerInView = readHeaderInView();
      // Pin before Next.js scroll and before the tab slot's height collapses.
      freezeGenRef.current += 1;
      freezeMainColumnScrollAt(mem.scrollTop);
      releaseFreezeWhenStable(mem.scrollTop, false);
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [readHeaderInView, releaseFreezeWhenStable, spaceSlug]);

  const logoSrc = logoUrl || defaultLogoSrc;

  const actionsPortalTarget = stuck ? stickyActionsEl : null;

  return (
    <>
      <div
        ref={stickyBarRef}
        className={cn(
          /*
           * Use live panel inset vars (non-animated) so sticky chrome stays physically attached
           * to panel edges while users drag-resize left/right sidebars.
           */
          'pointer-events-none fixed left-[var(--panel-left-inset,var(--sidebar-left-width,0px))] z-[25] hidden md:block',
          /*
           * Stop 0.25rem short of the column edge — the same width as
           * `.narrow-scrollbar` — so this bar does not paint over the thumb.
           * The header hairline is a 1px rule, not a framed border.
           */
          'right-[calc(var(--panel-right-inset,var(--sidebar-right-width,0px))+0.25rem)]',
          'h-[var(--secondary-chrome-actions-row-height,66px)]',
          'bg-page-background',
          'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border',
          'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          stuck
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : '-translate-y-1 opacity-0 motion-reduce:translate-y-0',
        )}
        style={{ top: 'var(--menu-top-height, 70px)' }}
        aria-hidden={!stuck}
      >
        <div className="mx-auto flex h-full max-w-container-2xl items-center gap-3 px-4 sm:px-6 md:px-8">
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
          {/* Allow shrink + horizontal scroll so Settings/badges stay reachable on iPad when panels narrow the column */}
          <div
            ref={setStickyActionsEl}
            className="flex min-w-0 shrink items-center gap-2 overflow-x-auto overscroll-x-contain touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          />
        </div>
      </div>

      <div className="flex flex-col">
        <div className="relative">
          {banner}
          <div
            ref={bannerBottomSentinelRef}
            className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
            aria-hidden
          />
        </div>
      </div>

      {actionsPortalTarget
        ? createPortal(actionsSlot, actionsPortalTarget)
        : null}
    </>
  );
}
