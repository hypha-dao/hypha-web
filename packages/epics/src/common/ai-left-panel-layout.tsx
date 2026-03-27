'use client';

import { Sparkles } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  useSidebar,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { AiLeftPanel } from './ai-left-panel';

type AiLeftPanelLayoutProps = {
  children: React.ReactNode;
};

function AiSidebarTrigger() {
  const { toggleSidebar, open } = useSidebar();
  const t = useTranslations('AiPanel');

  if (open) return null;

  return (
    <button
      onClick={toggleSidebar}
      className="fixed left-0 top-20 z-10 flex items-center gap-1.5 rounded-r-xl border border-l-0 border-border bg-primary px-2.5 py-2 text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
      title={t('openPanel')}
      aria-label={t('openPanel')}
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
}

export function AiLeftPanelLayout({ children }: AiLeftPanelLayoutProps) {
  return (
    <SidebarProvider
      defaultOpen={false}
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
        className="pt-16"
      >
        <AiLeftPanel />
      </Sidebar>
      <SidebarInset>
        <AiSidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
