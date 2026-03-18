'use client';

import { PanelLeftClose } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

type AiLeftPanelProps = {
  onClose: () => void;
  className?: string;
};

export function AiLeftPanel({ onClose, className }: AiLeftPanelProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col bg-background-2 border-r border-border',
        className,
      )}
    >
      <div className="flex flex-shrink-0 items-center justify-end border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Close panel"
          aria-label="Close panel"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto" />
    </div>
  );
}
