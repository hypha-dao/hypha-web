'use client';

import { MessageCircle, PanelRightClose } from 'lucide-react';
import { useSidebar } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export function HumanChatPanelHeader() {
  const { toggleSidebar } = useSidebar();
  const t = useTranslations('HumanChatPanel');
  return (
    <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-background-2 px-4 py-3">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary">
          <MessageCircle className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm text-foreground">
          {t('title')}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t('hidePanel')}
          aria-label={t('closePanel')}
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
