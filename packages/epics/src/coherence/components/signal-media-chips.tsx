'use client';

import { FileText, Image as ImageIcon, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SignalMediaCounts } from '../utils/signal-media';

export function SignalMediaChips({
  counts,
  className,
}: {
  counts: SignalMediaCounts;
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');
  const chips = [
    {
      key: 'videos',
      count: counts.videos,
      Icon: Play,
      label: 'signalVideosCount',
    },
    {
      key: 'images',
      count: counts.images,
      Icon: ImageIcon,
      label: 'signalImagesCount',
    },
    {
      key: 'documents',
      count: counts.documents,
      Icon: FileText,
      label: 'signalDocumentsCount',
    },
  ] as const;
  const visible = chips.filter((chip) => chip.count > 0);
  if (visible.length === 0) return null;

  return (
    <span
      className={cn('inline-flex flex-wrap items-center gap-1.5', className)}
    >
      {visible.map(({ key, count, Icon, label }) => (
        <span
          key={key}
          className="craft-chip inline-flex h-6 items-center gap-1 px-2 text-[11px] leading-none"
        >
          <Icon className="craft-icon-sm" aria-hidden />
          {t(label, { count })}
        </span>
      ))}
    </span>
  );
}

/** "1 video · 2 images · 1 doc", or null when the signal carries no media. */
export function useSignalMediaSummary(
  counts: SignalMediaCounts,
): string | null {
  const t = useTranslations('CoherenceTab');
  const parts = [
    counts.videos > 0 ? t('signalVideosCount', { count: counts.videos }) : null,
    counts.images > 0 ? t('signalImagesCount', { count: counts.images }) : null,
    counts.documents > 0
      ? t('signalDocumentsCount', { count: counts.documents })
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
