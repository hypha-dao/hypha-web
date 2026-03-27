'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { AiLeftPanel } from './ai-left-panel';

type AiLeftPanelLayoutProps = {
  children: React.ReactNode;
};

export function AiLeftPanelLayout({ children }: AiLeftPanelLayoutProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex w-full">
      {isOpen && (
        <div className="fixed left-0 top-9 z-10 w-[320px] h-[calc(100vh-2.25rem)] flex flex-col overflow-hidden border-r border-border bg-background">
          <AiLeftPanel onClose={() => setIsOpen(false)} />
        </div>
      )}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-0 top-20 z-10 flex items-center gap-1.5 rounded-r-xl border border-l-0 border-border bg-primary px-2.5 py-2 text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
          title="Open Hypha AI"
          aria-label="Open Hypha AI panel"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}
      <div className={isOpen ? 'flex-1 min-w-0 ml-[320px]' : 'flex-1 min-w-0'}>
        {children}
      </div>
    </div>
  );
}
