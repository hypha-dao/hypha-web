'use client';

import * as React from 'react';
import {
  STICKY_SPACE_CHROME_AVATAR_CLASSNAME,
  STICKY_SPACE_CHROME_TITLE_CLASSNAME,
  useMainColumnScrollY,
} from '@hypha-platform/epics';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTheme } from 'next-themes';

const STICKY_APPEAR_OFFSET_PX = 0;
const STICKY_COLLAPSE_DISTANCE_PX = 120;
const STICKY_HYSTERESIS_PX = 0.14;

export type DhoStickySpaceChromeProps = {
  renderBanner: (collapseProgress: number) => React.ReactNode;
  renderActions?: (variant: 'flow' | 'sticky') => React.ReactNode;
  renderTabs?: (variant: 'flow' | 'sticky') => React.ReactNode;
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
  renderBanner,
  renderActions,
  renderTabs,
  title,
  logoUrl,
  logoAlt,
  defaultLogoSrc,
}: DhoStickySpaceChromeProps) {
  const menuTopPx = useMenuTopOffsetPx();
  const mainScrollY = useMainColumnScrollY();
  const { resolvedTheme } = useTheme();
  /** Bottom edge of the space image banner — sticky engages when this passes under MenuTop */
  const bannerBottomSentinelRef = React.useRef<HTMLDivElement>(null);
  const [collapseProgress, setCollapseProgress] = React.useState(0);
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
        setCollapseProgress(0);
        if (stuckRef.current) {
          stuckRef.current = false;
          setStuck(false);
        }
        return;
      }

      const bannerBottom = sentinel.getBoundingClientRect().bottom;
      const appearAt = menuTopPx + STICKY_APPEAR_OFFSET_PX;
      const nextProgress = Math.min(
        1,
        Math.max(
          0,
          1 - (bannerBottom - appearAt) / STICKY_COLLAPSE_DISTANCE_PX,
        ),
      );
      setCollapseProgress((prev) =>
        Math.abs(prev - nextProgress) < 0.01 ? prev : nextProgress,
      );

      let next = stuckRef.current;
      if (!next && nextProgress >= 1 - STICKY_HYSTERESIS_PX) next = true;
      if (next && nextProgress <= 1 - STICKY_HYSTERESIS_PX * 2) next = false;
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
    window.addEventListener('resize', onScroll);
    return () => {
      mq.removeEventListener('change', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mainScrollY, menuTopPx]);

  const logoSrc = logoUrl || defaultLogoSrc;
  const isDark = resolvedTheme === 'dark';
  const stickyOpacity = collapseProgress;
  const stickyTranslateY = (1 - collapseProgress) * -10;
  const stickyShadowOpacity = 0.18 + collapseProgress * 0.14;
  const compactChromeInteractive = stuck;
  const hasActions = Boolean(renderActions);
  const hasTabs = Boolean(renderTabs);
  const flowAuxOpacity = Math.max(0, 1 - collapseProgress * 1.45);

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
          'transition-[opacity,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none',
          compactChromeInteractive
            ? 'pointer-events-auto'
            : 'pointer-events-none',
        )}
        style={{
          top: 'var(--menu-top-height, 70px)',
          opacity: stickyOpacity,
          transform: `translate3d(0, ${stickyTranslateY}px, 0)`,
          backgroundColor: isDark
            ? 'rgba(7,10,16,0.92)'
            : 'rgba(248,250,252,0.94)',
          backgroundImage: isDark
            ? 'linear-gradient(to right, rgba(0,0,0,0.58), rgba(0,0,0,0.42), rgba(0,0,0,0.5)), linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent-11, var(--space-accent, #4f46e5)) 14%, transparent), transparent 55%)'
            : 'linear-gradient(to right, rgba(255,255,255,0.78), rgba(255,255,255,0.64), rgba(255,255,255,0.74)), linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent-11, var(--space-accent, #4f46e5)) 11%, transparent), transparent 58%)',
          boxShadow: isDark
            ? `0 10px 28px -18px rgba(0,0,0,${
                0.34 + collapseProgress * 0.26
              }), inset 0 1px 0 rgba(255,255,255,0.06)`
            : `0 10px 24px -20px rgba(15,23,42,${stickyShadowOpacity}), inset 0 1px 0 rgba(255,255,255,0.78)`,
        }}
        aria-hidden={!compactChromeInteractive}
      >
        <div className="mx-auto flex max-w-container-2xl flex-col px-4 sm:px-6 md:px-8">
          <div className="flex min-h-11 items-center gap-3 py-2.5 sm:gap-4 md:min-h-[52px] md:py-3">
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
            {hasActions ? (
              <div className="flex shrink-0 flex-nowrap items-center gap-2">
                {renderActions?.('sticky')}
              </div>
            ) : null}
          </div>
          {hasTabs ? (
            <div className="border-t border-border/65 py-1.5">
              {renderTabs?.('sticky')}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          {renderBanner(collapseProgress)}
          <div
            ref={bannerBottomSentinelRef}
            className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
            aria-hidden
          />
        </div>

        {hasActions ? (
          <div
            className="flex justify-end gap-2 px-0 transition-opacity duration-200 ease-out md:min-h-[var(--secondary-chrome-actions-row-height,52px)] md:flex-nowrap md:items-center"
            style={{
              opacity: flowAuxOpacity,
              pointerEvents: flowAuxOpacity < 0.08 ? 'none' : undefined,
            }}
          >
            {renderActions?.('flow')}
          </div>
        ) : null}
        {hasTabs ? (
          <div
            className="transition-opacity duration-200 ease-out"
            style={{
              opacity: flowAuxOpacity,
              pointerEvents: flowAuxOpacity < 0.08 ? 'none' : undefined,
            }}
          >
            {renderTabs?.('flow')}
          </div>
        ) : null}
      </div>
    </>
  );
}
