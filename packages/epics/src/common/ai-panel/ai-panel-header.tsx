'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, PanelLeftClose, RefreshCw, Sparkles } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

import type { ModelOption } from './mock-data';

type AiPanelHeaderProps = {
  onClose: () => void;
  modelOptions: ModelOption[];
  selectedModel: ModelOption;
  onModelSelect: (model: ModelOption) => void;
  onResetChat?: () => void;
};

export function AiPanelHeader({
  onClose,
  modelOptions,
  selectedModel,
  onModelSelect,
  onResetChat,
}: AiPanelHeaderProps) {
  const [showModelMenu, setShowModelMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const SelectedIcon = selectedModel.icon;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showModelMenu &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelMenu]);

  return (
    <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-background-2 px-4 py-3">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm text-foreground">Hypha AI</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SelectedIcon className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">{selectedModel.label}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
          {showModelMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 w-44 animate-in fade-in slide-in-from-top-2 rounded-xl border border-border bg-popover py-1 shadow-2xl duration-200">
              {modelOptions.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onModelSelect(m);
                      setShowModelMenu(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted',
                      m.id === selectedModel.id
                        ? 'text-primary'
                        : 'text-foreground',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
