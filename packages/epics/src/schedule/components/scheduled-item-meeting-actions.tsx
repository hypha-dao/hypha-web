'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink, Video } from 'lucide-react';
import {
  resolveScheduledItemJoinUrl,
  type ScheduledItem,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type ScheduledItemMeetingActionsProps = {
  item: Pick<ScheduledItem, 'type' | 'matrixAutoLink' | 'meetingUrl'>;
  spaceSlug: string;
  lang?: string;
  className?: string;
  compact?: boolean;
};

export function ScheduledItemMeetingActions({
  item,
  spaceSlug,
  lang = 'en',
  className,
  compact = false,
}: ScheduledItemMeetingActionsProps) {
  const t = useTranslations('Calendar');
  const [copied, setCopied] = React.useState(false);
  const joinUrl = React.useMemo(
    () =>
      resolveScheduledItemJoinUrl(
        item,
        lang,
        spaceSlug,
        typeof window !== 'undefined' ? window.location.origin : undefined,
      ),
    [item, lang, spaceSlug],
  );

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!joinUrl) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-accent-8/35 bg-gradient-to-br from-accent-2/40 via-card/80 to-card/40 p-4 shadow-sm',
        className,
      )}
    >
      {!compact ? (
        <div className="mb-3 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-9 text-accent-contrast">
            <Video className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('meetingJoinTitle')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('meetingJoinHint')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild size={compact ? 'sm' : 'default'}>
          <a href={joinUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            {t('meetingJoin')}
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <Check className="size-4 text-success-11" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? t('meetingLinkCopied') : t('meetingCopyLink')}
        </Button>
      </div>

      <p className="mt-3 truncate text-xs text-muted-foreground" title={joinUrl}>
        {joinUrl}
      </p>
    </div>
  );
}
