'use client';

import { PanelLeftClose, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAiPanel } from '../human-chat-panel-context';

type AiPanelHeaderProps = {
  onResetChat?: () => void;
};

export function AiPanelHeader({ onResetChat }: AiPanelHeaderProps) {
  const { setContentMode } = useAiPanel();
  const t = useTranslations('AiPanel');
  return (
    <div className="flex min-h-[var(--menu-top-height,65px)] min-w-0 flex-shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-background-2 px-4 py-3">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm text-foreground">
          {t('title')}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        {onResetChat && (
          <button
            type="button"
            onClick={onResetChat}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t('resetChat')}
            aria-label={t('resetChat')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setContentMode('menu');
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t('backToMenu')}
          aria-label={t('backToMenu')}
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
