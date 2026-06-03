'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { CallRaisedHandEntry } from '@hypha-platform/core/client';

type HumanChatPanelCallRaisedHandsStripProps = {
  raisedHands: CallRaisedHandEntry[];
  resolveMemberLabel: (userId: string | undefined) => string;
  className?: string;
};

/** WCUX-REACT-6 — compact raised-hands summary above in-call controls. */
export function HumanChatPanelCallRaisedHandsStrip({
  raisedHands,
  resolveMemberLabel,
  className,
}: HumanChatPanelCallRaisedHandsStripProps) {
  const t = useTranslations('HumanChatPanel');
  if (raisedHands.length === 0) return null;

  const labels = raisedHands
    .map((entry) => resolveMemberLabel(entry.userId))
    .filter(Boolean);

  return (
    <div
      role="status"
      className={cn(
        'border-b border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-foreground',
        className,
      )}
    >
      <span className="font-medium">{t('callRaisedHandsTitle')}</span>{' '}
      <span className="text-muted-foreground">{labels.join(', ')}</span>
    </div>
  );
}
