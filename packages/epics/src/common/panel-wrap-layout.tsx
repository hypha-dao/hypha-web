'use client';

import React, { useCallback, useLayoutEffect, useState } from 'react';
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

/** Matches `PanelScrollInset` — portaled overlays read this from `document.documentElement`. */
const MAIN_COLUMN_SCROLLBAR_WIDTH_CSS = '10px';

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

// ─── Main Layout ─────────────────────────────────────────────────────────────
// Reads panel open/close state from PanelProviders contexts. Creates
// SidebarProvider wrappers for each side to drive sidebar animations.
// Sets CSS variables --sidebar-right-width and --sidebar-left-width
// on its outermost div so other components (e.g. SidePanel) can position
// themselves relative to the sidebars.
//
// Must be rendered inside <PanelProviders>.

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

  const sidebarLeftPx = leftOpen && effectiveLeft ? '320px' : '0px';
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
        <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
          <SidebarResizeHandle />
          {effectiveRight.content}
        </Sidebar>
      </SidebarProvider>
    );
  } else if (effectiveLeft) {
    content = (
      <SidebarProvider
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
        <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
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
