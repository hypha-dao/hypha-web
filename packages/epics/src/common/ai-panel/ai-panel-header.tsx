'use client';

import { PanelLeftClose, RefreshCw, Sparkles } from 'lucide-react';

type AiPanelHeaderProps = {
  onClose: () => void;
  onResetChat?: () => void;
};

export function AiPanelHeader({ onClose, onResetChat }: AiPanelHeaderProps) {
  return (
    <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-background-2 px-4 py-3">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm text-foreground">Hypha AI</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={onResetChat}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Reset chat"
          aria-label="Reset chat"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Hide AI panel"
          aria-label="Close panel"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
