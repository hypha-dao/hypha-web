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
      {isOpen ? (
        <div className="w-[320px] flex-shrink-0 sticky top-0 h-screen flex flex-col overflow-hidden border-r border-border">
          <AiLeftPanel onClose={() => setIsOpen(false)} />
        </div>
      ) : (
        <div className="flex-shrink-0 flex items-start pt-4 pl-2">
          <button
            onClick={() => setIsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
            title="Open Hypha AI"
            aria-label="Open Hypha AI panel"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
