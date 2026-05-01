'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarResizeHandle,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import {
  AiPanelProvider,
  HumanChatPanelProvider,
  useAiPanel,
  useHumanChatPanel,
} from './human-chat-panel-context';
import { useIsSpaceContext } from './use-is-space-context';
import { PanelDualSidebarScrollBridge } from './panel-main-column-scroll-bridge';
import { PanelScrollInset } from './panel-scroll-inset';

// ─── Panel Providers ─────────────────────────────────────────────────────────
// Owns the open/close state for both panels and wraps children with the
// context providers. This allows components outside PanelWrapLayout (like
// MenuTop) to access panel state via useAiPanel() and useHumanChatPanel().

export function PanelProviders({ children }: { children: React.ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const toggleLeft = useCallback(() => setLeftOpen((prev) => !prev), []);
  const toggleRight = useCallback(() => setRightOpen((prev) => !prev), []);

  return (
    <AiPanelProvider value={{ open: leftOpen, toggle: toggleLeft }}>
      <HumanChatPanelProvider
        open={rightOpen}
        toggle={toggleRight}
        setOpen={setRightOpen}
      >
        {children}
      </HumanChatPanelProvider>
    </AiPanelProvider>
  );
}

// ─── Trigger Buttons ─────────────────────────────────────────────────────────
// Both triggers use custom contexts (not useSidebar()) so they work correctly
// regardless of SidebarProvider nesting order.

export function AiSidebarTrigger() {
  const { open, toggle } = useAiPanel();
  const t = useTranslations('AiPanel');
  const isSpace = useIsSpaceContext();

  if (!isSpace || open) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={t('openPanel')}
      aria-label={t('openPanel')}
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
}

export function HumanSidebarTrigger() {
  const { open, toggle } = useHumanChatPanel();
  const t = useTranslations('HumanChatPanel');
  const isSpace = useIsSpaceContext();

  if (!isSpace || open) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={t('openPanel')}
      aria-label={t('openPanel')}
    >
      <MessageCircle className="h-4 w-4" />
    </button>
  );
}

// ─── Panel Slot Types ────────────────────────────────────────────────────────

type PanelSlot = {
  content: React.ReactNode;
};

type PanelWrapLayoutProps = {
  children: React.ReactNode;
  left?: PanelSlot;
  right?: PanelSlot;
};

/** Matches scroll inset — `0px` so fixed chrome / dividers span full main column (lines may cross overlay scrollbar). */
const MAIN_COLUMN_SCROLLBAR_WIDTH_CSS = '0px';

const SIDEBAR_WIDTH_MIRROR_KEYS = [
  '--sidebar-left-width',
  '--sidebar-right-width',
  '--main-column-scrollbar-width',
] as const;

function mirrorMainColumnLayoutVarsToDocument(
  sidebarLeftPx: string,
  sidebarRightPx: string,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--sidebar-left-width', sidebarLeftPx);
  root.style.setProperty('--sidebar-right-width', sidebarRightPx);
  root.style.setProperty(
    '--main-column-scrollbar-width',
    MAIN_COLUMN_SCROLLBAR_WIDTH_CSS,
  );
}

function clearMainColumnLayoutMirrorFromDocument(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of SIDEBAR_WIDTH_MIRROR_KEYS) {
    root.style.removeProperty(key);
  }
}

type SidebarChromeWidths = { left: string; right: string };

const ZERO_SIDEBAR: SidebarChromeWidths = { left: '0px', right: '0px' };

/**
 * The flex layout reserves width via `[data-sidebar-gap]`; fixed sidebars and portaled
 * UI use `--sidebar-*-width` on `:root` and the wrapper. Those were previously hardcoded
 * to 320px while the gap could change via `SidebarResizeHandle` (280–600px), so the
 * main column, sticky DHO chrome, and dialogs could drift from the true column bounds.
 * Measure the actual gaps and mirror pixel widths to CSS variables.
 */
function useMeasuredSidebarGaps(
  shouldMeasure: boolean,
  measureKey: string,
): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  sidebarWidths: SidebarChromeWidths;
} {
  const [widths, setWidths] = useState<SidebarChromeWidths>(ZERO_SIDEBAR);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const measureGaps = useCallback(() => {
    const root = containerRef.current;
    if (typeof document === 'undefined' || !root) return;

    if (!shouldMeasure) {
      setWidths(ZERO_SIDEBAR);
      clearMainColumnLayoutMirrorFromDocument();
      return;
    }

    const gaps = root.querySelectorAll('[data-sidebar-gap]');
    let left = 0;
    let right = 0;
    for (const gap of gaps) {
      const el = gap as HTMLElement;
      const side = el.closest('[data-side]')?.getAttribute('data-side');
      const w = el.offsetWidth;
      if (side === 'left') {
        left = w;
      } else if (side === 'right') {
        right = w;
      }
    }

    const next: SidebarChromeWidths = {
      left: `${Math.round(left)}px`,
      right: `${Math.round(right)}px`,
    };
    setWidths((prev) =>
      prev.left === next.left && prev.right === next.right ? prev : next,
    );
    mirrorMainColumnLayoutVarsToDocument(next.left, next.right);
  }, [shouldMeasure]);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measureGaps();
    });
  }, [measureGaps]);

  useLayoutEffect(() => {
    if (!shouldMeasure) {
      setWidths(ZERO_SIDEBAR);
      clearMainColumnLayoutMirrorFromDocument();
      return;
    }
    const root = containerRef.current;
    if (!root) {
      return;
    }

    measureGaps();
    const ro = new ResizeObserver(() => {
      scheduleMeasure();
    });
    for (const gap of root.querySelectorAll('[data-sidebar-gap]')) {
      ro.observe(gap as Element);
    }

    return () => {
      ro.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearMainColumnLayoutMirrorFromDocument();
    };
  }, [measureGaps, scheduleMeasure, shouldMeasure, measureKey]);

  return { containerRef, sidebarWidths: widths };
}

// ─── Main Layout ─────────────────────────────────────────────────────────────
// Reads panel open/close state from PanelProviders contexts. Creates
// SidebarProvider wrappers for each side to drive sidebar animations.
// Sets CSS variables --sidebar-right-width and --sidebar-left-width
// on its outermost div so other components (e.g. SidePanel) can position
// themselves relative to the sidebars.
//
// Must be rendered inside <PanelProviders>.
//
// Keep sidebars above `ProposalOverlayShell` scrim (`z-40`) so chat/AI panels stay
// interactive while proposal modals are open (`modal={false}` on that dialog).

export function PanelWrapLayout({
  children,
  left,
  right,
}: PanelWrapLayoutProps) {
  const { open: leftOpen, toggle: toggleLeft } = useAiPanel();
  const { open: rightOpen, toggle: toggleRight } = useHumanChatPanel();
  const isSpace = useIsSpaceContext();

  // Panels are only available within a space context (/[lang]/dho/[id]/...)
  const effectiveLeft = isSpace ? left : undefined;
  const effectiveRight = isSpace ? right : undefined;

  const shouldMeasureSidebars = Boolean(
    (effectiveLeft && leftOpen) || (effectiveRight && rightOpen),
  );
  const gapMeasureKey = [
    shouldMeasureSidebars ? 'M' : '-',
    leftOpen ? 'lo' : '-',
    rightOpen ? 'ro' : '-',
    effectiveLeft ? 'L' : '-',
    effectiveRight ? 'R' : '-',
  ].join('-');

  const { containerRef, sidebarWidths } = useMeasuredSidebarGaps(
    shouldMeasureSidebars,
    gapMeasureKey,
  );

  // Core content that goes inside the scrollable SidebarInset (when panels wrap layout)
  let content = <>{children}</>;

  if (effectiveLeft && effectiveRight) {
    content = (
      <PanelDualSidebarScrollBridge
        leftOpen={leftOpen}
        onLeftOpenChange={(open) => {
          if (open !== leftOpen) toggleLeft();
        }}
        rightOpen={rightOpen}
        onRightOpenChange={(open) => {
          if (open !== rightOpen) toggleRight();
        }}
        leftContent={effectiveLeft.content}
        rightContent={effectiveRight.content}
      >
        {content}
      </PanelDualSidebarScrollBridge>
    );
  } else if (effectiveRight) {
    content = (
      <SidebarProvider
        defaultOpen={false}
        open={rightOpen}
        onOpenChange={(open) => {
          if (open !== rightOpen) toggleRight();
        }}
        style={
          {
            '--sidebar-width': '320px',
          } as React.CSSProperties
        }
      >
        <PanelScrollInset className="overflow-y-auto">
          {content}
        </PanelScrollInset>
        <Sidebar
          side="right"
          variant="sidebar"
          collapsible="offcanvas"
          className="z-[50]"
        >
          <SidebarResizeHandle />
          {effectiveRight.content}
        </Sidebar>
      </SidebarProvider>
    );
  } else if (effectiveLeft) {
    content = (
      <SidebarProvider
        defaultOpen={false}
        open={leftOpen}
        onOpenChange={(open) => {
          if (open !== leftOpen) toggleLeft();
        }}
        style={
          {
            '--sidebar-width': '320px',
          } as React.CSSProperties
        }
      >
        <Sidebar
          side="left"
          variant="sidebar"
          collapsible="offcanvas"
          className="z-[50]"
        >
          {effectiveLeft.content}
          <SidebarResizeHandle />
        </Sidebar>
        <PanelScrollInset className="overflow-y-auto">
          {content}
        </PanelScrollInset>
      </SidebarProvider>
    );
  }

  return (
    <div
      ref={containerRef}
      style={
        {
          '--sidebar-right-width': sidebarWidths.right,
          '--sidebar-left-width': sidebarWidths.left,
        } as React.CSSProperties
      }
    >
      {content}
    </div>
  );
}
