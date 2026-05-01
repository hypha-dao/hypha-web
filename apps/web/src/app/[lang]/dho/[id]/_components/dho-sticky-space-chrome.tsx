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
 * Desktop (md+): pin a secondary chrome row under `MenuTop`. Lighter typography + avatar than
 * `CompactSpaceBanner` so it reads as tier-2 chrome. Actions / nested-space move via portal so the
 * same React trees (hooks) transition between positions — pixel-identical Button UI.
 *
 * **In-flow (not stuck):** portaled actions can sit in the banner footer host.
 * **Stuck (md+):** when the **hairline** between hero and metadata (`delimiterSentinelRef`
 * on `CompactSpaceBanner`) reaches the bottom of `MenuTop` (`--menu-top-height`), the
 * secondary bar becomes visible; its inner width uses the same
 * max-width + `px-4` as DHO `Container size="lg"` so it aligns with the banner edges.
 *
 * Note: `createPortal` remounts when `actionsPortalTarget` changes; stateful portaled
 * children reset across host swaps.
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
  /** Top edge of hairline between hero and footer strip — aligns with user-visible “delimiter” */
  const bannerDelimiterSentinelRef = React.useRef<HTMLDivElement>(null);

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
  const [inBannerActionsHost, setInBannerActionsHost] =
    React.useState<HTMLDivElement | null>(null);
  const setInBannerHostRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      setInBannerActionsHost(node);
    },
    [],
  );

  const bannerWithActionsHost = React.useMemo(() => {
    if (!React.isValidElement(banner)) return banner;
    return React.cloneElement(
      banner as React.ReactElement<{
        actionsPortalHostRef?: React.Ref<HTMLDivElement> | null;
        delimiterSentinelRef?: React.Ref<HTMLDivElement | null>;
      }>,
      {
        actionsPortalHostRef: setInBannerHostRef,
        delimiterSentinelRef: bannerDelimiterSentinelRef,
      },
    );
  }, [banner, setInBannerHostRef]);

  const actionsMeasureEl = React.useMemo(() => {
    if (stuck) return stickyActionsEl;
    if (inBannerActionsHost) return inBannerActionsHost;
    return flowActionsEl;
  }, [stuck, stickyActionsEl, inBannerActionsHost, flowActionsEl]);

  React.useLayoutEffect(() => {
    const el = actionsMeasureEl;
    if (!el) return;
    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setFlowMinH(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stuck, actionsMeasureEl]);

  React.useEffect(() => {
    const sentinel = bannerDelimiterSentinelRef.current;
    if (!sentinel) return;

    const mq = window.matchMedia('(min-width: 768px)');
    /** Hysteresis (px) so the bar does not flicker at the threshold. */
    const HYST = 8;
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
      /* Top of delimiter hairline: engage when it meets the bottom edge of MenuTop (same Y as menu header bottom). */
      const delimiterTop = sentinel.getBoundingClientRect().top;
      let next = stuckRef.current;
      if (!next && delimiterTop <= menuTopPx) next = true;
      if (next && delimiterTop > menuTopPx + HYST) next = false;
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

  const actionsPortalTarget = stuck
    ? stickyActionsEl
    : inBannerActionsHost ?? flowActionsEl;
  const nestedPortalTarget = nestedSpacesSlot ? flowNestedEl : null;

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
            ? 'pointer-events-auto visible translate-y-0 opacity-100'
            : 'invisible -translate-y-1 opacity-0 motion-reduce:translate-y-0',
        )}
        style={{ top: 'var(--menu-top-height, 4rem)' }}
        aria-hidden={!stuck}
      >
        <div
          className={cn(
            /* Match DHO `Container size="lg" className="... px-4!"` so the bar lines up with the space banner */
            'mx-auto flex w-full min-w-0 min-h-11 items-center gap-3 px-4 py-2.5',
            'max-w-container-sm md:max-w-container-md lg:max-w-container-xl xl:max-w-container-2xl',
            'md:min-h-[52px] md:py-3',
          )}
        >
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
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:flex-nowrap md:gap-x-4">
          <div className="flex min-w-0 flex-1 items-center">
            {breadcrumbsRow}
          </div>
          {nestedSpacesSlot ? (
            <div ref={setFlowNestedEl} className="shrink-0" />
          ) : null}
        </div>

        <div className="relative">{bannerWithActionsHost}</div>

        <div
          ref={setFlowActionsEl}
          className={cn(
            'flex justify-end gap-2 px-0 md:flex-nowrap md:items-center',
            /* Only reserve the actions row when portaling under the card (not into banner, not stuck). */
            !inBannerActionsHost &&
              'md:min-h-[var(--secondary-chrome-actions-row-height,52px)]',
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
