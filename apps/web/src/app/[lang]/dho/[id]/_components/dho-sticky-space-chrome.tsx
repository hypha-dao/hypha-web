'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import {
  COMPACT_SPACE_BANNER_AVATAR_CLASS,
  COMPACT_SPACE_BANNER_CONTENT_INSET_PX_CLASS,
  COMPACT_SPACE_BANNER_TITLE_TEXT_CLASS,
} from '@hypha-platform/epics';
import { cn } from '@hypha-platform/ui-utils';

const PANEL_WRAP_SEL = '[data-hypha-panel-wrap-root]';

function getScrollableAncestors(start: Element | null): (Element | Window)[] {
  const out: (Element | Window)[] = [];
  let el: Element | null = start;
  while (el && el !== document.body) {
    const st = getComputedStyle(el);
    const oy = st.overflowY;
    const ox = st.overflowX;
    if (/(auto|scroll|overlay)/.test(oy) || /(auto|scroll|overlay)/.test(ox)) {
      out.push(el);
    }
    el = el.parentElement;
  }
  out.push(window);
  return out;
}

function useMenuTopOffsetPx(): number {
  /** Mirrors `--menu-top-fallback-height` until MenuTop publishes `--menu-top-height`. */
  const [px, setPx] = React.useState(70);

  React.useLayoutEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        '--menu-top-height',
      );
      const n = parseFloat(raw);
      const fallbackRaw = getComputedStyle(
        document.documentElement,
      ).getPropertyValue('--menu-top-fallback-height');
      const fb = parseFloat(fallbackRaw);
      setPx(
        Number.isFinite(n) && n > 0
          ? n
          : Number.isFinite(fb) && fb > 0
          ? fb
          : 70,
      );
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(document.documentElement);
    window.addEventListener('resize', read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);

  return px;
}

/** PanelWrapLayout sets sidebar widths on a nested div; sync to :root so portaled chrome can read them. */
function useSyncPanelSidebarWidthsToDocument(
  scopeRef: React.RefObject<HTMLElement | null>,
) {
  React.useLayoutEffect(() => {
    const sync = () => {
      const scope = scopeRef.current;
      const panelRoot = scope?.closest(PANEL_WRAP_SEL) as HTMLElement | null;
      if (!panelRoot) return;
      const cs = getComputedStyle(panelRoot);
      const left = cs.getPropertyValue('--sidebar-left-width').trim() || '0px';
      const right =
        cs.getPropertyValue('--sidebar-right-width').trim() || '0px';
      document.documentElement.style.setProperty('--sidebar-left-width', left);
      document.documentElement.style.setProperty(
        '--sidebar-right-width',
        right,
      );
    };

    sync();

    const scope = scopeRef.current;
    const panelRoot = scope?.closest(PANEL_WRAP_SEL) as HTMLElement | null;
    if (!panelRoot) return;

    const mo = new MutationObserver(sync);
    mo.observe(panelRoot, { attributes: true, attributeFilter: ['style'] });
    const ro = new ResizeObserver(sync);
    ro.observe(panelRoot);

    return () => {
      mo.disconnect();
      ro.disconnect();
      document.documentElement.style.removeProperty('--sidebar-left-width');
      document.documentElement.style.removeProperty('--sidebar-right-width');
    };
  }, [scopeRef]);
}

export type DhoStickySpaceChromeProps = {
  banner: React.ReactNode;
  actionsSlot: React.ReactNode;
  title: string;
  logoUrl: string;
  logoAlt: string;
  defaultLogoSrc: string;
};

/**
 * Desktop (md+): pin a compact chrome row under `MenuTop`. Actions move via portal so the same
 * React trees transition between positions. Horizontal inset matches `CompactSpaceBanner` (`px-8`).
 *
 * The sticky shell is portaled to `document.body` so it is not clipped by `SidebarInset`'s
 * overflow (fixed descendants are clipped to scroll containers in common browsers). Width is
 * constrained with `--sidebar-left-width` / `--sidebar-right-width` like other global overlays.
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
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const flowColumnRef = React.useRef<HTMLDivElement>(null);

  useSyncPanelSidebarWidthsToDocument(flowColumnRef);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

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
  }, [stuck, flowActionsEl, actionsSlot]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const mq = window.matchMedia('(min-width: 768px)');
    const HYST = 2;
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
      const bottom = sentinel.getBoundingClientRect().bottom;
      let next = stuckRef.current;
      if (!next && bottom <= menuTopPx) next = true;
      if (next && bottom >= menuTopPx + HYST) next = false;
      if (next !== stuckRef.current) {
        stuckRef.current = next;
        setStuck(next);
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(tick);
    };

    const scrollers = getScrollableAncestors(sentinel);
    tick();
    mq.addEventListener('change', onScroll);
    scrollers.forEach((s) =>
      s.addEventListener('scroll', onScroll, { passive: true }),
    );
    window.addEventListener('resize', onScroll);

    return () => {
      mq.removeEventListener('change', onScroll);
      scrollers.forEach((s) => s.removeEventListener('scroll', onScroll));
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [menuTopPx]);

  const logoSrc = logoUrl || defaultLogoSrc;

  const actionsPortalTarget = stuck ? stickyActionsEl : flowActionsEl;

  const stickyChrome = (
    <div
      className={cn(
        'pointer-events-none fixed z-[25] hidden md:block',
        'border-b border-border bg-background-2 transition-[opacity,box-shadow] duration-300 ease-out',
        stuck ? 'pointer-events-auto opacity-100 shadow-md' : 'opacity-0',
      )}
      style={{
        top: 'var(--menu-top-height, var(--menu-top-fallback-height, 70px))',
        left: 'var(--sidebar-left-width, 0px)',
        right: 'var(--sidebar-right-width, 0px)',
      }}
      aria-hidden={!stuck}
    >
      <div className="mx-auto h-full w-full max-w-container-2xl px-4">
        <div
          className={cn(
            'flex items-start justify-between gap-6 py-2.5',
            COMPACT_SPACE_BANNER_CONTENT_INSET_PX_CLASS,
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-6">
            <Avatar className={COMPACT_SPACE_BANNER_AVATAR_CLASS}>
              <AvatarImage
                src={logoSrc}
                alt={logoAlt}
                className="object-cover"
              />
            </Avatar>
            <p
              className={cn(
                COMPACT_SPACE_BANNER_TITLE_TEXT_CLASS,
                'min-w-0 truncate text-foreground',
              )}
            >
              {title}
            </p>
          </div>
          <div
            ref={setStickyActionsEl}
            className="flex shrink-0 flex-nowrap items-center justify-end gap-2"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mounted ? createPortal(stickyChrome, document.body) : null}

      <div ref={flowColumnRef} className="flex flex-col gap-4">
        <div className="relative">
          {banner}
          <div
            ref={sentinelRef}
            className="pointer-events-none absolute bottom-0 left-0 right-0 hidden h-px opacity-0 md:block"
            aria-hidden
          />
        </div>

        <div
          ref={setFlowActionsEl}
          className={cn(
            'flex justify-end gap-2 md:flex-nowrap',
            COMPACT_SPACE_BANNER_CONTENT_INSET_PX_CLASS,
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
