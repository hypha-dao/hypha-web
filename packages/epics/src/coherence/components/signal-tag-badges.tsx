'use client';

import { COHERENCE_TAGS } from '@hypha-platform/core/client';
import { Badge } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import {
  SIGNAL_TAG_BADGE_CLASS,
  SIGNAL_TAG_OVERFLOW_BADGE_CLASS,
} from '../utils/signal-tag-badge-styles';

function tagDisplayLabel(
  tag: string,
  t: ReturnType<typeof useTranslations<'CoherenceTab'>>,
): string {
  const translationKey = `tagLabels.${tag}`;
  return (COHERENCE_TAGS as readonly string[]).includes(tag) &&
    t.has(translationKey as never)
    ? t(translationKey as never)
    : tag;
}

type SignalTagBadgesProps = {
  tags?: string[] | null;
  maxVisible?: number;
  sizeClassName?: string;
  showHashPrefix?: boolean;
  className?: string;
};

export function SignalTagBadges({
  tags,
  maxVisible = 2,
  sizeClassName = 'text-[10px]',
  showHashPrefix = false,
  className,
}: SignalTagBadgesProps) {
  const t = useTranslations('CoherenceTab');
  const list = tags ?? [];
  if (list.length === 0) return null;

  const visible = list.slice(0, maxVisible);
  const overflow = list.length - maxVisible;

  return (
    <div
      className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}
    >
      {visible.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          colorVariant="neutral"
          className={cn(SIGNAL_TAG_BADGE_CLASS, sizeClassName)}
        >
          {showHashPrefix
            ? `#${tagDisplayLabel(tag, t)}`
            : tagDisplayLabel(tag, t)}
        </Badge>
      ))}
      {overflow > 0 ? (
        <Badge
          colorVariant="neutral"
          variant="outline"
          className={cn(SIGNAL_TAG_OVERFLOW_BADGE_CLASS, sizeClassName)}
        >
          +{overflow}
        </Badge>
      ) : null}
    </div>
  );
}
