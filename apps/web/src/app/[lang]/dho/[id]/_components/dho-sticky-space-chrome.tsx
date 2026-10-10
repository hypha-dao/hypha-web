'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useParams, usePathname } from 'next/navigation';
import {
  SPACE_HEADER_ACTIONS_ATTR,
  STICKY_SPACE_CHROME_AVATAR_CLASSNAME,
  STICKY_SPACE_CHROME_TITLE_CLASSNAME,
  animateMainColumnScrollBy,
  clearMainColumnScrollFreeze,
  freezeMainColumnScrollAt,
  getMainColumnNaturalMaxScroll,
  getMainColumnScrollElement,
  getMainColumnScrollY,
  holdMainColumnScrollHeight,
  HYPHA_SPACE_SWITCH_LINK_ATTR,
  isMainColumnScrollFrozen,
  planBannerContentFit,
  planShortPageScroll,
  reapplyMainColumnScrollFreeze,
  releaseMainColumnScrollHeightHold,
  scrollMainColumnBy,
  scrollMainColumnTo,
  subscribeMainColumnScroll,
} from '@hypha-platform/epics';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const STICKY_HYSTERESIS_PX = 16;
/** Full cover stays visible, then the row settles. Inside the 1–2s entry window. */
const SPACE_ENTRY_BANNER_HOLD_MS = 1500;
/**
 * Entry settle. Slightly slower than the 900ms cubic, which rushed through
 * the middle and then snapped. Screen changes do not use this duration.
 */
const SPACE_ENTRY_SETTLE_MS = 1100;
/** In-space return from the cover. Shorter than the entry intro. */
const SPACE_SCREEN_SETTLE_MIN_MS = 280;
const SPACE_SCREEN_SETTLE_MAX_MS = 520;
/**
 * Last pixels of the cover. Short on purpose: the row should finish fading as
 * it locks under the menu, not while the cover is still mostly on screen.
 */
const COVER_FADE_PX = 24;
const RESET_TO_TOP_SLACK_PX = 8;
const HEADER_ACTIONS_SELECTOR = `[${SPACE_HEADER_ACTIONS_ATTR}]`;
const ACTIONS_ALIGN_EPSILON_PX = 0.5;

/** Right edge of the last control, so gear/pill/mode share one measured edge. */
function clusterRightPx(el: HTMLElement): number {
  const last = el.lastElementChild;
  const target = last instanceof HTMLElement ? last : el;
  return target.getBoundingClientRect().right;
}

/**
 * Shift the sticky cluster so its right edge matches the header cluster.
 * The header box is the reference; this does not move it.
 */
function alignStickyActionsToHeader(
  sticky: HTMLElement,
  header: HTMLElement,
): void {
  sticky.style.transform = 'none';
  const shift = clusterRightPx(header) - clusterRightPx(sticky);
  sticky.style.transform =
    Math.abs(shift) < ACTIONS_ALIGN_EPSILON_PX
      ? ''
      : `translateX(${shift.toFixed(2)}px)`;
}

function setHeaderActionsShowing(header: HTMLElement, showing: boolean): void {
  header.style.visibility = showing ? '' : 'hidden';
  if (showing) header.removeAttribute('aria-hidden');
  else header.setAttribute('aria-hidden', 'true');
}

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
  /**
   * Recently Visited changed space. Settle on the banner; do not play the
   * cover intro and do not clamp the column to 0.
   */
  switchArrival: boolean;
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
      switchArrival: false,
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

/**
 * Recently Visited owns the scroll freeze across the layout swap. The source
 * chrome unmount must not drop it — that clamp is what flashes the cover.
 */
let spaceSwitchFreezeHeld = false;
let spaceSwitchEpoch = 0;

function armSpaceSwitchArrival(nextSpace: string, scrollTop: number): void {
  const mem = spaceEntryMemory(nextSpace);
  mem.switchArrival = true;
  // Screen change, not a first entry. The long cover hold must not run.
  mem.introduced = true;
  mem.headerInView = true;
  mem.scrollTop = Math.max(0, scrollTop);
  spaceSwitchFreezeHeld = true;
  spaceSwitchEpoch += 1;
  const epoch = spaceSwitchEpoch;
  window.setTimeout(() => {
    if (epoch !== spaceSwitchEpoch) return;
    const pending = spaceEntryMemory(nextSpace);
    if (!pending.switchArrival) return;
    pending.switchArrival = false;
    spaceSwitchFreezeHeld = false;
    clearMainColumnScrollFreeze();
    releaseMainColumnScrollHeightHold();
  }, 8000);
}

/** Tab `loading.tsx` is short on purpose. It is not a short screen. */
function isSpaceTabLoading(): boolean {
  return document.querySelector('[data-tab-loading]') != null;
}

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

function screenSettleDurationMs(distancePx: number): number {
  return Math.round(
    Math.min(
      SPACE_SCREEN_SETTLE_MAX_MS,
      Math.max(SPACE_SCREEN_SETTLE_MIN_MS, Math.abs(distancePx) * 1.45),
    ),
  );
}

/** 0 = cover fully open, 1 = banner flush under the menu. */
function coverFadeAmount(
  deltaPx: number,
  reduceMotion: boolean,
  stuck: boolean,
): number {
  if (reduceMotion) return stuck ? 1 : 0;
  if (deltaPx <= 0) return 1;
  if (deltaPx >= COVER_FADE_PX) return 0;
  const t = 1 - deltaPx / COVER_FADE_PX;
  return t * t * (3 - 2 * t);
}

type BannerScrollPlan =
  | { kind: 'keep-freeze' }
  | { kind: 'pin'; top: number }
  | { kind: 'ease'; top: number };

/**
 * In-space screen change. A clamp to 0 while the banner was already settled
 * is pinned back in place — it must not play the cover. A cover the member
 * actually has open eases straight to the banner and does not pass through 0.
 */
function planInSpaceBannerScroll(input: {
  frozen: boolean;
  current: number;
  rememberedTop: number;
  headerWasInView: boolean;
  liveTarget: number;
  reduceMotion: boolean;
}): BannerScrollPlan {
  if (input.frozen) return { kind: 'keep-freeze' };
  const resetToTop =
    !input.headerWasInView &&
    input.rememberedTop > STICKY_HYSTERESIS_PX &&
    input.current + RESET_TO_TOP_SLACK_PX < input.rememberedTop;
  if (resetToTop) return { kind: 'pin', top: Math.max(0, input.rememberedTop) };
  const target = Math.max(0, input.liveTarget);
  if (input.reduceMotion || Math.abs(target - input.current) <= 1) {
    return { kind: 'pin', top: target };
  }
  return { kind: 'ease', top: target };
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
 * `CompactSpaceBanner` so it reads as tier-2 chrome. The gear and status pills also live on the
 * space header. Those header controls stay the painted set until this row sticks; the portaled
 * copies then take the same right edge and the header cluster stops painting.
 *
 * Note: `createPortal` remounts its subtree when the container DOM node changes. The actions
 * slot is stable after mount so the subscription badge does not refetch on each stick.
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
  const bannerColumnRef = React.useRef<HTMLDivElement>(null);

  const [stuck, setStuck] = React.useState(false);
  const stuckRef = React.useRef(false);

  React.useLayoutEffect(() => {
    const sentinel = bannerBottomSentinelRef.current;
    const bar = stickyBarRef.current;
    if (!sentinel) return;

    const mq = window.matchMedia('(min-width: 768px)');
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;

    const applyFade = (deltaPx: number, stuckNow: boolean) => {
      const barEl = stickyBarRef.current;
      if (!barEl) return;
      const fade = mq.matches
        ? coverFadeAmount(deltaPx, reduceMq.matches, stuckNow)
        : 0;
      barEl.style.opacity = fade.toFixed(3);
    };

    const tick = () => {
      raf = 0;
      if (!mq.matches) {
        if (stuckRef.current) {
          stuckRef.current = false;
          setStuck(false);
        }
        applyFade(COVER_FADE_PX, false);
        return;
      }
      const bannerBottom = sentinel.getBoundingClientRect().bottom;
      let next = stuckRef.current;
      const appearAt = stickyAppearLineY(readMenuTopPx(), stickyBarRef.current);
      if (!next && bannerBottom <= appearAt + 0.5) next = true;
      if (next && bannerBottom >= appearAt + STICKY_HYSTERESIS_PX) next = false;
      applyFade(bannerBottom - appearAt, next);
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

  const freezeGenRef = React.useRef(0);
  const pathnameRef = React.useRef(pathname);
  pathnameRef.current = pathname;
  const landOnCollapsedBannerRef = React.useRef<(top: number) => void>(
    () => {},
  );

  const releaseFreezeWhenStable = React.useCallback((expectedTop: number) => {
    const gen = freezeGenRef.current;
    const pinPath = pathnameRef.current;
    const started = performance.now();
    let lastNatural = -1;
    let lastChange = started;
    const tick = () => {
      if (gen !== freezeGenRef.current || !isMainColumnScrollFrozen()) return;
      // Keep the column tall enough that a loading swap cannot clamp to 0.
      holdMainColumnScrollHeight(expectedTop);
      const naturalMax = getMainColumnNaturalMaxScroll();
      const navigatedNow = pathnameRef.current !== pinPath;
      const fit = planBannerContentFit(expectedTop, naturalMax);
      const elapsed = performance.now() - started;
      // Real short content cannot hold the banner on its own. Stay on the
      // banner and keep the height hold — releasing it clamps to 0 and opens
      // the cover. A loading skeleton is not a short screen.
      if (
        !fit.fillsBanner &&
        !isSpaceTabLoading() &&
        (navigatedNow || elapsed > 48)
      ) {
        landOnCollapsedBannerRef.current(expectedTop);
        return;
      }
      // The natural-height read drops min-height for one layout. Put the
      // pin back before paint.
      reapplyMainColumnScrollFreeze();
      const now = performance.now();
      if (lastNatural >= 0 && Math.abs(naturalMax - lastNatural) > 1) {
        lastChange = now;
      }
      lastNatural = naturalMax;
      const navigated = navigatedNow;
      const tallEnough = naturalMax + 2 >= expectedTop;
      const quiet = now - lastChange > 350;
      // Release the hold only when the screen can keep this offset. Letting
      // go of a short page clamps the scroll and opens the cover.
      if (
        (navigated && tallEnough && quiet) ||
        (elapsed > 5000 && tallEnough)
      ) {
        releaseMainColumnScrollHeightHold();
        reapplyMainColumnScrollFreeze();
        if (gen === freezeGenRef.current) {
          spaceSwitchFreezeHeld = false;
          clearMainColumnScrollFreeze();
        }
        return;
      }
      if (elapsed > 5000 && !isSpaceTabLoading()) {
        landOnCollapsedBannerRef.current(expectedTop);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const pinMainColumnAt = React.useCallback(
    (top: number) => {
      holdMainColumnScrollHeight(top);
      freezeGenRef.current += 1;
      freezeMainColumnScrollAt(top);
      releaseFreezeWhenStable(top);
    },
    [releaseFreezeWhenStable],
  );

  const settleCancelRef = React.useRef<(() => void) | null>(null);
  const cancelSettleMotion = React.useCallback(() => {
    settleCancelRef.current?.();
    settleCancelRef.current = null;
  }, []);

  const readBannerDelta = React.useCallback(() => {
    return bannerAlignDelta(
      bannerBottomSentinelRef.current,
      stickyBarRef.current,
    );
  }, []);

  const rememberBanner = React.useCallback(
    (top: number) => {
      if (!spaceSlug) return;
      const mem = spaceEntryMemory(spaceSlug);
      mem.introduced = true;
      mem.headerInView = false;
      mem.scrollTop = Math.max(0, top);
    },
    [spaceSlug],
  );

  /**
   * Short screen. The cover collapses only by scrolling, and a short page
   * has nothing to scroll, so extend the column first and write the banner
   * offset once. Keep the hold — releasing it clamps back to the open cover.
   * The freeze is cleared so a later scroll-up can still reveal the cover.
   */
  const landOnCollapsedBanner = React.useCallback(
    (top: number) => {
      cancelSettleMotion();
      cancelActiveIntro?.();
      freezeGenRef.current += 1;
      spaceSwitchFreezeHeld = false;
      const safe = Math.max(0, top);
      holdMainColumnScrollHeight(safe);
      clearMainColumnScrollFreeze();
      scrollMainColumnTo(safe, 'auto');
      if (!spaceSlug) return;
      const mem = spaceEntryMemory(spaceSlug);
      mem.introduced = true;
      mem.switchArrival = false;
      mem.scrollTop = safe;
      mem.headerInView = false;
      if (!mem.startPath) mem.startPath = pathnameRef.current;
    },
    [cancelSettleMotion, spaceSlug],
  );
  landOnCollapsedBannerRef.current = landOnCollapsedBanner;

  /** Drop a leftover offset so the next screen starts under the menu. */
  const releaseColumnToTop = React.useCallback(() => {
    cancelSettleMotion();
    cancelActiveIntro?.();
    freezeGenRef.current += 1;
    spaceSwitchFreezeHeld = false;
    clearMainColumnScrollFreeze();
    releaseMainColumnScrollHeightHold();
    scrollMainColumnTo(0, 'auto');
  }, [cancelSettleMotion]);

  /**
   * A loading skeleton keeps the reserved offset. Real content that cannot
   * hold it sits on the collapsed banner. A phone, or a banner we cannot
   * measure, goes to the top instead of an empty hold.
   */
  const bannerTopOrHeader = React.useCallback(
    (top: number): { short: boolean; top: number; release: boolean } => {
      const safe = Math.max(0, top);
      const delta = bannerAlignDelta(
        bannerBottomSentinelRef.current,
        stickyBarRef.current,
      );
      const current = getMainColumnScrollY();
      const plan = planShortPageScroll({
        reservedTop: safe,
        naturalMax: getMainColumnNaturalMaxScroll(),
        bannerTop: delta == null ? null : Math.max(0, current + delta),
        mobile: window.matchMedia('(max-width: 767px)').matches,
        loading: isSpaceTabLoading(),
      });
      if (plan.kind === 'top') return { short: true, top: 0, release: true };
      if (plan.kind === 'banner') {
        return { short: true, top: plan.top, release: false };
      }
      return { short: false, top: plan.top, release: false };
    },
    [],
  );

  /** Instant pin. Used when already on the banner, on a clamp back to 0, and for reduced motion. */
  const pinBanner = React.useCallback(
    (top: number) => {
      cancelSettleMotion();
      cancelActiveIntro?.();
      const next = bannerTopOrHeader(top);
      if (next.release) {
        releaseColumnToTop();
        return;
      }
      if (next.short) {
        landOnCollapsedBanner(next.top);
        return;
      }
      rememberBanner(next.top);
      pinMainColumnAt(next.top);
    },
    [
      bannerTopOrHeader,
      cancelSettleMotion,
      landOnCollapsedBanner,
      pinMainColumnAt,
      releaseColumnToTop,
      rememberBanner,
    ],
  );

  /**
   * Cover is actually on screen. Ease straight to the banner. The freeze
   * follows the frames so a loading swap cannot pull the column through 0.
   */
  const easeBanner = React.useCallback(
    (top: number) => {
      cancelSettleMotion();
      cancelActiveIntro?.();
      const next = bannerTopOrHeader(top);
      if (next.release) {
        releaseColumnToTop();
        return;
      }
      if (next.short) {
        landOnCollapsedBanner(next.top);
        return;
      }
      const safe = next.top;
      rememberBanner(safe);
      const from = getMainColumnScrollY();
      const delta = safe - from;
      if (Math.abs(delta) <= 1) {
        pinMainColumnAt(safe);
        return;
      }
      holdMainColumnScrollHeight(Math.max(safe, from));
      freezeGenRef.current += 1;
      const gen = freezeGenRef.current;
      freezeMainColumnScrollAt(Math.max(0, from));
      const watchForShortScreen = () => {
        if (gen !== freezeGenRef.current) return;
        const fit = planBannerContentFit(safe, getMainColumnNaturalMaxScroll());
        // Short content cannot finish the ease. Jump to the banner now and
        // keep the hold. Do not correct back to the open cover.
        if (!isSpaceTabLoading() && !fit.fillsBanner) {
          const settled = bannerTopOrHeader(safe);
          if (settled.release) {
            releaseColumnToTop();
            return;
          }
          landOnCollapsedBanner(settled.short ? settled.top : safe);
          return;
        }
        reapplyMainColumnScrollFreeze();
        requestAnimationFrame(watchForShortScreen);
      };
      requestAnimationFrame(watchForShortScreen);
      settleCancelRef.current = animateMainColumnScrollBy(
        delta,
        screenSettleDurationMs(delta),
        () => {
          settleCancelRef.current = null;
          if (gen !== freezeGenRef.current) return;
          const rest = readBannerDelta();
          const y = getMainColumnScrollY();
          const finalTop = Math.max(0, rest == null ? y : y + rest);
          pinBanner(finalTop);
        },
        { followFreeze: true, readRemainingDelta: readBannerDelta },
      );
    },
    [
      bannerTopOrHeader,
      cancelSettleMotion,
      landOnCollapsedBanner,
      pinBanner,
      pinMainColumnAt,
      readBannerDelta,
      releaseColumnToTop,
      rememberBanner,
    ],
  );

  const applyBannerPlan = React.useCallback(
    (plan: BannerScrollPlan) => {
      if (plan.kind === 'keep-freeze') return;
      if (plan.kind === 'ease') easeBanner(plan.top);
      else pinBanner(plan.top);
    },
    [easeBanner, pinBanner],
  );

  /** Banner offset to pin. If the cover is on screen, this is the banner — never 0. */
  const bannerPinTop = React.useCallback((): number => {
    const delta = bannerAlignDelta(
      bannerBottomSentinelRef.current,
      stickyBarRef.current,
    );
    const current = getMainColumnScrollY();
    const headerInView =
      delta == null ? current <= 2 : delta > STICKY_HYSTERESIS_PX;
    if (headerInView && delta != null && delta > 1) return current + delta;
    return current;
  }, []);

  React.useEffect(() => {
    return () => {
      // A Recently Visited switch already invalidated this instance's pin
      // and handed the freeze to the destination. Clearing it here clamps
      // the shared scrollport to the cover before the new banner can settle.
      if (spaceSwitchFreezeHeld) return;
      freezeGenRef.current += 1;
      cancelSettleMotion();
      clearMainColumnScrollFreeze();
      releaseMainColumnScrollHeightHold();
    };
  }, [cancelSettleMotion]);

  React.useEffect(() => {
    if (!spaceSlug || !pathname) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    if (!desktop.matches) return;

    const mem = spaceEntryMemory(spaceSlug);
    // Recently Visited already settled (or is about to). Never replay the intro.
    if (mem.switchArrival || mem.introduced) return;
    // In-space remounts (tab RSC refresh) used to run this effect again: scroll
    // to 0, hold, then settle — the header flash. Never restart after the visit
    // has a start path on a different route.
    if (mem.startPath && mem.startPath !== pathname) {
      mem.introduced = true;
      return;
    }

    const firstStart = mem.startPath == null;
    mem.startPath = pathname;
    if (mem.holdStartedAt == null) mem.holdStartedAt = performance.now();

    // Short page: the cover cannot collapse by user scroll. Land on the
    // banner before the intro marks the cover open or waits to ease.
    if (!isSpaceTabLoading() && !isMainColumnScrollFrozen()) {
      const delta = bannerAlignDelta(
        bannerBottomSentinelRef.current,
        stickyBarRef.current,
      );
      if (delta != null && delta > STICKY_HYSTERESIS_PX) {
        const fit = planBannerContentFit(
          getMainColumnScrollY() + delta,
          getMainColumnNaturalMaxScroll(),
        );
        if (!fit.fillsBanner) {
          landOnCollapsedBanner(fit.top);
          return;
        }
      }
    }

    mem.headerInView = true;

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

    const jumpToSettled = (): 'header' | 'banner' | 'noop' => {
      const delta = bannerAlignDelta(
        bannerBottomSentinelRef.current,
        stickyBarRef.current,
      );
      if (delta == null || delta <= 1) return 'noop';
      const fit = planBannerContentFit(
        getMainColumnScrollY() + delta,
        getMainColumnNaturalMaxScroll(),
      );
      // Short screen: hold the column, then jump to the banner. Do not
      // stay on the open cover.
      if (!isSpaceTabLoading() && !fit.fillsBanner) {
        holdMainColumnScrollHeight(fit.top);
        programmatic = true;
        scrollMainColumnTo(fit.top, 'auto');
        releaseProgrammatic();
        mem.introduced = true;
        mem.headerInView = false;
        mem.scrollTop = fit.top;
        return 'banner';
      }
      programmatic = true;
      scrollMainColumnBy(delta, 'auto');
      releaseProgrammatic();
      return 'banner';
    };

    const rememberUserPosition = () => {
      mem.introduced = true;
      mem.scrollTop = getMainColumnScrollY();
      mem.headerInView = readHeaderInView();
    };

    if (reduceMotion) {
      // Prefer reduced motion: jump, including a short page.
      let frames = 0;
      let raf = 0;
      const tryJump = () => {
        if (cancelled) return;
        if (isSpaceTabLoading() && frames < 180) {
          frames += 1;
          raf = window.requestAnimationFrame(tryJump);
          return;
        }
        jumpToSettled();
        mem.introduced = true;
        mem.headerInView = false;
        mem.scrollTop = getMainColumnScrollY();
      };
      raf = window.requestAnimationFrame(tryJump);
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
    // Re-runs (strict mode, remount) must not jump back to the top. A pin from
    // an in-space screen change must not be cleared either.
    if (
      firstStart &&
      !isMainColumnScrollFrozen() &&
      getMainColumnScrollY() > 2
    ) {
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

      const fit = planBannerContentFit(
        getMainColumnScrollY() + delta,
        getMainColumnNaturalMaxScroll(),
      );
      if (!isSpaceTabLoading() && !fit.fillsBanner) {
        holdMainColumnScrollHeight(fit.top);
        programmatic = true;
        scrollMainColumnTo(fit.top, 'auto');
        releaseProgrammatic();
        mem.introduced = true;
        mem.headerInView = false;
        mem.scrollTop = fit.top;
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
          mem.introduced = true;
          mem.headerInView = false;
          mem.scrollTop = getMainColumnScrollY();
        },
        { readRemainingDelta: readBannerDelta },
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
  }, [
    landOnCollapsedBanner,
    pathname,
    readBannerDelta,
    readHeaderInView,
    spaceSlug,
  ]);

  const prevPathRef = React.useRef<string | null>(null);

  // Before the first paint of a visit, sit on the cover. Otherwise the shared
  // scrollport can paint the previous page's offset and the settle looks like
  // two motions.
  React.useLayoutEffect(() => {
    if (!spaceSlug) return;
    const mem = spaceEntryMemory(spaceSlug);
    if (mem.switchArrival || mem.startPath || mem.introduced) return;
    if (isMainColumnScrollFrozen()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;
    if (getMainColumnScrollY() > 2) scrollMainColumnTo(0, 'auto');
  }, [spaceSlug]);

  React.useLayoutEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (!spaceSlug || !prev || prev === pathname) return;

    const prevSpace = spaceSlugFromPath(prev);
    if (!prevSpace || prevSpace !== spaceSlug) {
      // Recently Visited: ease to this space's banner. Do not drop the click
      // freeze or clamp to the cover — that is the screen-change path.
      if (spaceEntryMemory(spaceSlug).switchArrival) {
        return;
      }
      spaceSwitchFreezeHeld = false;
      freezeGenRef.current += 1;
      cancelSettleMotion();
      clearMainColumnScrollFreeze();
      releaseMainColumnScrollHeightHold();
      // New space: first paint is the cover. Reduced motion jumps to the
      // banner from the entry effect instead of flashing the cover.
      if (
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        !window.matchMedia('(max-width: 767px)').matches &&
        getMainColumnScrollY() > 2
      ) {
        scrollMainColumnTo(0, 'auto');
      }
      return;
    }

    // Same space, new screen. Drop any in-flight intro so it cannot scroll to
    // the top and play the entry settle again.
    cancelActiveIntro?.();
    const mem = spaceEntryMemory(spaceSlug);
    mem.introduced = true;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    // Trust memory for "was the cover open?". `current` may already be 0 if
    // Next scrolled or the loading skeleton clamped before this layout effect.
    const plan = planInSpaceBannerScroll({
      frozen: isMainColumnScrollFrozen(),
      current: getMainColumnScrollY(),
      rememberedTop: mem.scrollTop,
      headerWasInView: mem.headerInView,
      liveTarget: bannerPinTop(),
      reduceMotion,
    });
    if (plan.kind === 'keep-freeze') {
      const reservedTop = Math.max(mem.scrollTop, getMainColumnScrollY());
      const settled = bannerTopOrHeader(reservedTop);
      // The reserved offset is past this screen. An empty hold is not a pin.
      if (settled.release) {
        releaseColumnToTop();
        return;
      }
      if (settled.short) {
        landOnCollapsedBanner(settled.top);
        return;
      }
      // A click already reserved height and started the pin or the short ease.
      holdMainColumnScrollHeight(reservedTop);
      queueMicrotask(() => {
        reapplyMainColumnScrollFreeze();
      });
      return;
    }
    applyBannerPlan(plan);
  }, [
    applyBannerPlan,
    bannerPinTop,
    bannerTopOrHeader,
    cancelSettleMotion,
    landOnCollapsedBanner,
    pathname,
    releaseColumnToTop,
    spaceSlug,
  ]);

  // Short pages have no scroll range, so the cover never collapses on its
  // own. Hold the column and write the banner offset before paint. A loading
  // skeleton is ignored until the real screen is in the DOM.
  React.useLayoutEffect(() => {
    if (!spaceSlug) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;

    const collapseShort = (): boolean => {
      if (isMainColumnScrollFrozen()) return false;
      if (isSpaceTabLoading()) return false;
      const mem = spaceEntryMemory(spaceSlug);
      // The member scrolled the cover open. Leave it until the next screen.
      if (mem.introduced && mem.headerInView) return true;
      const delta = bannerAlignDelta(
        bannerBottomSentinelRef.current,
        stickyBarRef.current,
      );
      if (delta == null) return false;
      if (delta <= STICKY_HYSTERESIS_PX) return true;
      const fit = planBannerContentFit(
        getMainColumnScrollY() + delta,
        getMainColumnNaturalMaxScroll(),
      );
      if (fit.fillsBanner) return true;
      landOnCollapsedBanner(fit.top);
      return true;
    };

    if (collapseShort()) return;

    const root = getMainColumnScrollElement() ?? document.body;
    const observer = new MutationObserver(() => {
      if (collapseShort()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [landOnCollapsedBanner, pathname, spaceSlug]);

  // Recently Visited landed on this space. Ease straight to the banner.
  // The long first-entry hold stays for other arrivals.
  React.useLayoutEffect(() => {
    if (!spaceSlug) return;
    const mem = spaceEntryMemory(spaceSlug);
    if (!mem.switchArrival) return;
    if (window.matchMedia('(max-width: 767px)').matches) {
      mem.switchArrival = false;
      spaceSwitchFreezeHeld = false;
      clearMainColumnScrollFreeze();
      releaseMainColumnScrollHeightHold();
      return;
    }

    let cancelled = false;
    let deltaFrames = 0;
    let loadingFrames = 0;

    const finish = (delta: number | null) => {
      if (cancelled) return;
      mem.switchArrival = false;
      mem.introduced = true;
      if (!mem.startPath) mem.startPath = pathnameRef.current;
      const current = getMainColumnScrollY();
      const target = delta == null ? current : Math.max(0, current + delta);
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      if (reduceMotion || Math.abs(target - current) <= 1) pinBanner(target);
      else easeBanner(target);
    };

    const tick = () => {
      if (cancelled) return;
      const delta = readBannerDelta();
      if (delta == null && deltaFrames < 12) {
        deltaFrames += 1;
        requestAnimationFrame(tick);
        return;
      }
      // The skeleton cannot fill the banner. Wait for the real screen, then
      // collapse a short page onto the banner instead of leaving the cover open.
      if (isSpaceTabLoading() && loadingFrames < 180) {
        loadingFrames += 1;
        requestAnimationFrame(tick);
        return;
      }
      finish(delta);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [easeBanner, pinBanner, readBannerDelta, spaceSlug, pathname]);

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
    const releasePinForUserScroll = () => {
      spaceSwitchFreezeHeld = false;
      cancelSettleMotion();
      if (!isMainColumnScrollFrozen()) return;
      freezeGenRef.current += 1;
      clearMainColumnScrollFreeze();
      releaseMainColumnScrollHeightHold();
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 1) return;
      // Scrolling up reveals the cover. Scrolling down must not drop the pin —
      // a loading swap would then clamp to the top and flash the header.
      if (event.deltaY < 0) releasePinForUserScroll();
      markIntent();
    };
    const onTouch = () => {
      releasePinForUserScroll();
      markIntent();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !SCROLL_KEYS.has(event.key)) return;
      if (
        event.key === 'ArrowUp' ||
        event.key === 'PageUp' ||
        event.key === 'Home'
      ) {
        releasePinForUserScroll();
      }
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
        releasePinForUserScroll();
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
  }, [cancelSettleMotion, readHeaderInView, spaceSlug]);

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
      if (
        nextSpace &&
        nextSpace !== spaceSlug &&
        anchor.hasAttribute(HYPHA_SPACE_SWITCH_LINK_ATTR)
      ) {
        // Desktop only — the cover intro and banner settle are md+.
        if (window.matchMedia('(max-width: 767px)').matches) return;
        // Kill this space's pin before the layout swaps. The destination
        // eases from here to its own banner and must not pass through 0.
        cancelSettleMotion();
        cancelActiveIntro?.();
        freezeGenRef.current += 1;
        const current = getMainColumnScrollY();
        armSpaceSwitchArrival(nextSpace, current);
        holdMainColumnScrollHeight(Math.max(current, 1));
        freezeMainColumnScrollAt(current);
        return;
      }
      if (!nextSpace || nextSpace !== spaceSlug) return;
      if (
        anchor.pathname === window.location.pathname &&
        anchor.search === window.location.search
      ) {
        return;
      }

      const mem = spaceEntryMemory(spaceSlug);
      if (!mem.startPath) return;
      // Decide before Next.js scrollIntoView and before loading.tsx shrinks
      // the tab slot. Settled scroll stays put. A visible cover eases straight
      // to the banner — the freeze follows, so the column cannot pass through 0.
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const current = getMainColumnScrollY();
      applyBannerPlan(
        planInSpaceBannerScroll({
          frozen: false,
          current,
          rememberedTop: mem.scrollTop,
          headerWasInView: readHeaderInView(),
          liveTarget: bannerPinTop(),
          reduceMotion,
        }),
      );
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [applyBannerPlan, bannerPinTop, readHeaderInView, spaceSlug]);

  const logoSrc = logoUrl || defaultLogoSrc;

  /*
   * Header row owns the gear, date pill, and mode pill while that row is on
   * screen. Sticky copies stay mounted so the handoff width matches, but they
   * do not paint until the row has stuck — then the header cluster stops
   * painting so the two cannot ghost or stack. The sticky cluster is shifted
   * onto the header's right edge; the header box stays put.
   */
  React.useLayoutEffect(() => {
    const column = bannerColumnRef.current;
    const sticky = stickyActionsEl;
    if (!column) return;

    let apply = () => {};
    const ro = new ResizeObserver(() => apply());
    apply = () => {
      const header = column.querySelector(HEADER_ACTIONS_SELECTOR);
      if (!(header instanceof HTMLElement)) return;
      ro.observe(header);
      const md = window.matchMedia('(min-width: 768px)').matches;
      // Header keeps the only painted cluster until the sticky row has taken
      // its place. Sticky nodes stay mounted (so widths match) but do not paint.
      const stickyOwns =
        stuck && md && sticky != null && sticky.childElementCount > 0;
      setHeaderActionsShowing(header, !stickyOwns);
      if (!sticky) return;
      sticky.style.visibility = stickyOwns ? 'visible' : 'hidden';
      if (!stickyOwns) {
        sticky.style.transform = '';
        return;
      }
      alignStickyActionsToHeader(sticky, header);
    };

    apply();
    ro.observe(column);
    if (sticky) ro.observe(sticky);
    const bar = stickyBarRef.current;
    if (bar) ro.observe(bar);
    const mo = new MutationObserver(apply);
    mo.observe(column, { childList: true, subtree: true });
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', apply);
      const header = column.querySelector(HEADER_ACTIONS_SELECTOR);
      if (header instanceof HTMLElement) setHeaderActionsShowing(header, true);
      if (sticky) {
        sticky.style.transform = '';
        sticky.style.visibility = '';
      }
    };
  }, [stuck, stickyActionsEl]);

  // Always mounted once the slot exists so the handoff does not wait on a
  // second subscription fetch. Paint is gated in the layout effect above.
  const actionsPortalTarget = stickyActionsEl;

  return (
    <>
      <div
        ref={stickyBarRef}
        data-space-sticky-bar=""
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
          /*
           * Opacity is written from scroll progress so the row fades with the
           * cover. A translate would slide it out from under the menu and
           * read as a gap. `opacity-0` covers the first paint only.
           */
          'opacity-0',
          stuck && 'pointer-events-auto',
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

      <div ref={bannerColumnRef} className="flex flex-col">
        <div className="relative">
          {banner}
          <div
            ref={bannerBottomSentinelRef}
            data-space-banner-bottom=""
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
