'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
    if (leftOpen) return;
    if (leftOverlayHideTimeoutRef.current) {
      clearTimeout(leftOverlayHideTimeoutRef.current);
      leftOverlayHideTimeoutRef.current = null;
    }
    setLeftOverlayVisible(true);
  }, [leftOpen]);
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
  const { open, overlayVisible, toggle, showAiOverlay, hideAiOverlay } =
    useAiPanel();
  const t = useTranslations('AiPanel');
  const isSpace = useIsSpaceContext();

  if (!isSpace || open) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      onMouseEnter={showAiOverlay}
      onMouseLeave={hideAiOverlay}
      onFocus={showAiOverlay}
      onBlur={hideAiOverlay}
      aria-expanded={open && overlayVisible}
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
    toggle: toggleLeft,
    showAiOverlay,
    hideAiOverlay,
  } = useAiPanel();
  const { open: rightOpen, toggle: toggleRight } = useHumanChatPanel();
  const isSpace = useIsSpaceContext();

  // Panels are only available within a space context (/[lang]/dho/[id]/...)
  const effectiveLeft = isSpace ? left : undefined;
  const effectiveRight = isSpace ? right : undefined;

  const leftExpanded = Boolean(leftOpen);
  const sidebarLeftPx = effectiveLeft
    ? leftExpanded
      ? '320px'
      : LEFT_SIDEBAR_ICON_WIDTH
    : '0px';
  const sidebarRightPx = rightOpen && effectiveRight ? '320px' : '0px';

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
        onLeftOpenChange={(open) => {
          if (open !== leftExpanded) toggleLeft();
        }}
        onLeftMouseEnter={showAiOverlay}
        onLeftMouseLeave={hideAiOverlay}
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
        open={leftExpanded}
        onOpenChange={(open) => {
          if (open !== leftExpanded) toggleLeft();
        }}
        style={
          {
            '--sidebar-width': '320px',
            '--sidebar-width-icon': LEFT_SIDEBAR_ICON_WIDTH,
          } as React.CSSProperties
        }
      >
        <Sidebar
          side="left"
          variant="sidebar"
          collapsible="icon"
          className="z-[50] overflow-visible"
          onMouseEnter={showAiOverlay}
          onMouseLeave={hideAiOverlay}
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
      style={
        {
          '--sidebar-right-width': sidebarRightPx,
          '--sidebar-left-width': sidebarLeftPx,
          transitionProperty: '--sidebar-left-width, --sidebar-right-width',
          transitionDuration: '200ms',
          transitionTimingFunction: 'linear',
        } as React.CSSProperties
      }
    >
      {content}
    </div>
  );
}
