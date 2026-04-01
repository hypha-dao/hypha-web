'use client';

import React, { useCallback, useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
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
      <HumanChatPanelProvider open={rightOpen} toggle={toggleRight}>
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

  // Core content that goes inside the innermost SidebarInset
  let content = <>{children}</>;

  // Wrap with right panel if provided and in space context
  if (effectiveRight) {
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
        <SidebarInset className="overflow-y-auto">{content}</SidebarInset>
        <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
          <SidebarResizeHandle />
          {effectiveRight.content}
        </Sidebar>
      </SidebarProvider>
    );
  }

  // Wrap with left panel if provided and in space context
  if (effectiveLeft) {
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
        <SidebarInset className="overflow-y-auto">{content}</SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <div
      style={
        {
          '--sidebar-right-width':
            rightOpen && effectiveRight ? '320px' : '0px',
          '--sidebar-left-width': leftOpen && effectiveLeft ? '320px' : '0px',
        } as React.CSSProperties
      }
    >
      {content}
    </div>
  );
}
