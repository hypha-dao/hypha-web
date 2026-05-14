'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Menu, MessageCircle, PanelLeftClose, Sparkles } from 'lucide-react';
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
import { useCompactHeaderMode } from './use-compact-header-mode';
import { PanelDualSidebarScrollBridge } from './panel-main-column-scroll-bridge';
import { PanelScrollInset } from './panel-scroll-inset';

// ─── Panel Providers ─────────────────────────────────────────────────────────
// Owns the open/close state for both panels and wraps children with the
// context providers. This allows components outside PanelWrapLayout (like
// MenuTop) to access panel state via useAiPanel() and useHumanChatPanel().

export function PanelProviders({ children }: { children: React.ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [leftOverlayVisible, setLeftOverlayVisible] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const leftOverlayHideTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const toggleRight = useCallback(() => setRightOpen((prev) => !prev), []);
  const openLeft = useCallback(() => {
    setLeftOpen(true);
    setLeftOverlayVisible(true);
  }, []);
  const closeLeft = useCallback(() => {
    setLeftOpen(false);
    setLeftOverlayVisible(false);
  }, []);
  const showLeftOverlay = useCallback(() => {
    if (leftOverlayHideTimeoutRef.current) {
      clearTimeout(leftOverlayHideTimeoutRef.current);
      leftOverlayHideTimeoutRef.current = null;
    }
    // Ensure the compact overlay menu can open immediately from an expanded state.
    setLeftOpen(false);
    setLeftOverlayVisible(true);
  }, []);
  const hideLeftOverlay = useCallback(() => {
    if (leftOverlayHideTimeoutRef.current) {
      clearTimeout(leftOverlayHideTimeoutRef.current);
    }
    leftOverlayHideTimeoutRef.current = setTimeout(() => {
      setLeftOverlayVisible(false);
      leftOverlayHideTimeoutRef.current = null;
    }, 220);
  }, []);
  const toggleLeftFromTrigger = useCallback(() => {
    setLeftOpen((prev) => {
      const next = !prev;
      // Trigger click controls chat panel visibility; hover controls overlay rail expansion.
      setLeftOverlayVisible(false);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (leftOverlayHideTimeoutRef.current) {
        clearTimeout(leftOverlayHideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AiPanelProvider
      value={{
        open: leftOpen,
        overlayVisible: leftOverlayVisible,
        toggle: toggleLeftFromTrigger,
        openAiPanel: openLeft,
        closeAiPanel: closeLeft,
        showAiOverlay: showLeftOverlay,
        hideAiOverlay: hideLeftOverlay,
      }}
    >
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
  const { open, overlayVisible, showAiOverlay, hideAiOverlay, closeAiPanel } =
    useAiPanel();
  const { open: rightOpen, toggle: toggleRight } = useHumanChatPanel();
  const isSpace = useIsSpaceContext();
  const isCompactHeader = useCompactHeaderMode();
  const t = useTranslations('AiPanel');

  if (!isSpace) return null;

  const isMenuOpen = overlayVisible;

  return (
    <button
      type="button"
      onClick={() => {
        if (isMenuOpen) {
          hideAiOverlay();
          return;
        }
        if (isCompactHeader && rightOpen) {
          toggleRight();
        }
        if (open) {
          closeAiPanel();
        }
        showAiOverlay();
      }}
      aria-expanded={isMenuOpen}
      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-muted p-0 text-muted-foreground ring-1 ring-border/70 transition-colors hover:text-foreground"
      title={isMenuOpen ? t('closePanel') : t('openPanel')}
      aria-label={isMenuOpen ? t('closePanel') : t('openPanel')}
    >
      {isMenuOpen ? (
        <PanelLeftClose className="h-4 w-4" />
      ) : (
        <Menu className="h-4 w-4" />
      )}
    </button>
  );
}

export function AiPanelTrigger() {
  const { open, openAiPanel, closeAiPanel, hideAiOverlay } = useAiPanel();
  const isSpace = useIsSpaceContext();
  const t = useTranslations('AiPanel');

  if (!isSpace) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (open) {
          closeAiPanel();
          return;
        }
        hideAiOverlay();
        openAiPanel();
      }}
      aria-expanded={open}
      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-muted p-0 text-muted-foreground ring-1 ring-border/70 transition-colors hover:text-foreground"
      title={open ? t('closePanel') : t('openPanel')}
      aria-label={open ? t('closePanel') : t('openPanel')}
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
}

export function HumanSidebarTrigger() {
  const { open, toggle, openHumanChatPanel } = useHumanChatPanel();
  const { open: leftOpen, overlayVisible, closeAiPanel } = useAiPanel();
  const t = useTranslations('HumanChatPanel');
  const isSpace = useIsSpaceContext();
  const isCompactHeader = useCompactHeaderMode();

  if (!isSpace || (open && !isCompactHeader)) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (open) {
          toggle();
          return;
        }
        if (isCompactHeader && (leftOpen || overlayVisible)) {
          closeAiPanel();
        }
        openHumanChatPanel();
      }}
      aria-expanded={open}
      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-muted p-0 text-muted-foreground ring-1 ring-border/70 transition-colors hover:text-foreground"
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
const PANEL_COMPACT_ATTR = 'data-compact-panels';
const LEFT_SIDEBAR_EXPANDED_WIDTH = '320px';
const RIGHT_SIDEBAR_WIDTH = '320px';
// Mobile: keep only a slim gutter so chat/menu content uses almost full width.
const RIGHT_SIDEBAR_WIDTH_COMPACT = 'min(560px, calc(100vw - 16px))';
const DUAL_PANEL_MIN_VIEWPORT_PX = 1200;
const MIN_MAIN_COLUMN_WIDTH_PX = 560;

const SIDEBAR_WIDTH_MIRROR_KEYS = [
  '--sidebar-left-width',
  '--sidebar-right-width',
  '--main-column-scrollbar-width',
] as const;
const LEFT_SIDEBAR_ICON_WIDTH = '72px';

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
  const {
    open: leftOpen,
    overlayVisible: leftOverlayVisible,
    openAiPanel,
    closeAiPanel,
  } = useAiPanel();
  const { open: rightOpen, toggle: toggleRight } = useHumanChatPanel();
  const isSpace = useIsSpaceContext();
  const isCompactUi = useCompactHeaderMode();

  // Panels are only available within a space context (/[lang]/dho/[id]/...)
  const effectiveLeft = isSpace ? left : undefined;
  const effectiveRight = isSpace ? right : undefined;
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1440;
    return window.innerWidth;
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const leftExpanded = Boolean(leftOpen || leftOverlayVisible);
  const leftFootprintPx = leftExpanded ? 320 : 72;
  const rightFootprintPx = rightOpen && effectiveRight ? 320 : 0;
  const forceCompactPanels =
    Boolean(effectiveLeft && effectiveRight) &&
    (viewportWidth < DUAL_PANEL_MIN_VIEWPORT_PX ||
      viewportWidth - leftFootprintPx - rightFootprintPx <
        MIN_MAIN_COLUMN_WIDTH_PX);
  const isCompactPanels = isCompactUi || forceCompactPanels;
  const rightSidebarWidth = isCompactPanels
    ? RIGHT_SIDEBAR_WIDTH_COMPACT
    : RIGHT_SIDEBAR_WIDTH;
  const leftExpandedSidebarWidth = LEFT_SIDEBAR_EXPANDED_WIDTH;
  const fallbackSidebarLeftPx = effectiveLeft
    ? leftExpanded
      ? leftExpandedSidebarWidth
      : LEFT_SIDEBAR_ICON_WIDTH
    : '0px';
  const fallbackSidebarRightPx =
    rightOpen && effectiveRight ? rightSidebarWidth : '0px';
  const [sidebarLeftPx, setSidebarLeftPx] = useState(fallbackSidebarLeftPx);
  const [sidebarRightPx, setSidebarRightPx] = useState(fallbackSidebarRightPx);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute(PANEL_COMPACT_ATTR, isCompactPanels ? 'true' : 'false');
    return () => root.removeAttribute(PANEL_COMPACT_ATTR);
  }, [isCompactPanels]);

  useEffect(() => {
    if (!isCompactPanels) return;
    if (leftExpanded && rightOpen) {
      // Compact mode allows one expanded rail at a time to preserve main content width.
      closeAiPanel();
    }
  }, [isCompactPanels, leftExpanded, rightOpen, closeAiPanel]);

  useLayoutEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const readSidebarWidths = () => {
      const gaps = root.querySelectorAll<HTMLElement>('[data-sidebar-gap]');
      let nextLeft = 0;
      let nextRight = 0;

      gaps.forEach((gap) => {
        const host = gap.closest<HTMLElement>('[data-side]');
        const side = host?.getAttribute('data-side');
        const width = Math.round(gap.getBoundingClientRect().width);
        if (!Number.isFinite(width) || width <= 0) return;
        if (side === 'right') {
          nextRight = Math.max(nextRight, width);
          return;
        }
        nextLeft = Math.max(nextLeft, width);
      });

      const resolvedLeft =
        effectiveLeft && nextLeft > 0 ? `${nextLeft}px` : fallbackSidebarLeftPx;
      const resolvedRight =
        effectiveRight && nextRight > 0
          ? `${nextRight}px`
          : fallbackSidebarRightPx;

      setSidebarLeftPx((prev) => (prev === resolvedLeft ? prev : resolvedLeft));
      setSidebarRightPx((prev) =>
        prev === resolvedRight ? prev : resolvedRight,
      );
    };

    const resizeObserver = new ResizeObserver(readSidebarWidths);
    const observeGaps = () => {
      resizeObserver.disconnect();
      const gaps = root.querySelectorAll<HTMLElement>('[data-sidebar-gap]');
      gaps.forEach((gap) => resizeObserver.observe(gap));
      readSidebarWidths();
    };

    const mutationObserver = new MutationObserver(observeGaps);
    mutationObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'data-collapsible', 'style'],
    });

    window.addEventListener('resize', readSidebarWidths);
    observeGaps();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', readSidebarWidths);
    };
  }, [
    effectiveLeft,
    effectiveRight,
    fallbackSidebarLeftPx,
    fallbackSidebarRightPx,
  ]);

  /** Radix portaled dialogs sit under `body` and do not inherit vars from this div — mirror to `:root`. */
  useLayoutEffect(() => {
    mirrorMainColumnLayoutVarsToDocument(sidebarLeftPx, sidebarRightPx);
    return () => {
      clearMainColumnLayoutMirrorFromDocument();
    };
  }, [sidebarLeftPx, sidebarRightPx]);

  // Core content that goes inside the scrollable SidebarInset (when panels wrap layout)
  let content = <>{children}</>;

  if (effectiveLeft && effectiveRight) {
    content = (
      <PanelDualSidebarScrollBridge
        leftOpen={leftExpanded}
        leftSidebarWidth={leftExpandedSidebarWidth}
        onLeftOpenChange={(open) => {
          if (open === leftExpanded) return;
          if (open) {
            if (isCompactPanels && rightOpen) {
              toggleRight();
            }
            openAiPanel();
            return;
          }
          closeAiPanel();
        }}
        rightOpen={rightOpen}
        onRightOpenChange={(open) => {
          if (open && isCompactPanels && leftExpanded) {
            closeAiPanel();
          }
          if (open !== rightOpen) toggleRight();
        }}
        rightSidebarWidth={rightSidebarWidth}
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
          if (open && isCompactPanels && leftExpanded) {
            closeAiPanel();
          }
          if (open !== rightOpen) toggleRight();
        }}
        style={
          {
            '--sidebar-width': rightSidebarWidth,
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
        open={leftExpanded}
        onOpenChange={(open) => {
          if (open === leftExpanded) return;
          if (open) {
            if (isCompactPanels && rightOpen) {
              toggleRight();
            }
            openAiPanel();
            return;
          }
          closeAiPanel();
        }}
        style={
          {
            '--sidebar-width': leftExpandedSidebarWidth,
            '--sidebar-width-icon': LEFT_SIDEBAR_ICON_WIDTH,
          } as React.CSSProperties
        }
      >
        <Sidebar
          side="left"
          variant="sidebar"
          collapsible="icon"
          className="z-[50] overflow-visible"
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
      className="min-w-0 overflow-x-clip"
      ref={wrapperRef}
      style={
        {
          '--sidebar-right-width': sidebarRightPx,
          '--sidebar-left-width': sidebarLeftPx,
          '--panel-left-inset': sidebarLeftPx,
          '--panel-right-inset': `calc(${sidebarRightPx} + ${MAIN_COLUMN_SCROLLBAR_WIDTH_CSS})`,
        } as React.CSSProperties
      }
    >
      {content}
    </div>
  );
}
