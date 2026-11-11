'use client';

import React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { ResolvedCallTranscriptExcerpt } from './resolved-call-transcript-excerpt';

type CallTranscriptDetail = {
  id: number;
  call_session_id: string;
  language: string;
  text: string;
  occurred_at: string;
};

export function SpaceMemoryCallTranscriptDialog({
  open,
  onOpenChange,
  spaceSlug,
  transcriptId,
  title,
  subtitle,
  matrixChatRoomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  transcriptId: number;
  title: string;
  subtitle: string;
  matrixChatRoomId?: string | null;
}) {
  const t = useTranslations('CoherenceTab');
  const tCommon = useTranslations('Common');
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const {
    getAccessToken,
    user,
    isLoading: isAuthLoading,
  } = useAuthentication();
  const userId = user?.id?.trim() || null;

  const { data, error, isLoading, mutate } = useSWR(
    open && !isAuthLoading
      ? ([
          'space-memory-call-transcript',
          userId ?? 'anonymous',
          spaceSlug,
          transcriptId,
        ] as const)
      : null,
    async ([, scope, slug, id]) => {
      const token = scope === 'anonymous' ? null : await getAccessToken();
      const res = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug)}/call-transcripts/${id}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch call transcript: ${res.status}`);
      }
      return (await res.json()) as CallTranscriptDetail;
    },
    { revalidateOnFocus: false },
  );

  const body = React.useMemo(
    () => data?.text.replace(/\r\n/g, '\n').trim() ?? '',
    [data?.text],
  );
  const transcriptRef = React.useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = React.useState<
    'idle' | 'copied' | 'failed'
  >('idle');

  React.useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopy = async () => {
    // textContent is the rendered excerpt, including speaker names resolved so far.
    const text =
      transcriptRef.current?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    if (!text.trim()) {
      setCopyState('failed');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(720px,85dvh)] flex-col gap-0 overflow-hidden border-border/70 bg-background-2 p-0 shadow-md sm:max-w-2xl',
          'border-l-[3px] border-l-[var(--space-accent)]',
        )}
        style={spaceAccentPortalStyle}
      >
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 px-6 pb-4 pt-6">
          <DialogTitle className="pr-10 text-balance text-4 font-medium leading-snug tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-1 text-muted-foreground">
            {subtitle}
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            'narrow-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5',
            '[scrollbar-gutter:stable]',
          )}
        >
          {error ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-2 text-muted-foreground">
                {t('spaceMemoryFullTranscriptError')}
              </p>
              <Button
                type="button"
                variant="outline"
                colorVariant="accent"
                onClick={() => void mutate()}
              >
                {t('spaceMemoryRetry')}
              </Button>
            </div>
          ) : isLoading || !data ? (
            <p className="text-2 text-muted-foreground">
              {t('spaceMemoryFullTranscriptLoading')}
            </p>
          ) : (
            <div ref={transcriptRef}>
              <ResolvedCallTranscriptExcerpt
                excerpt={body}
                roomId={matrixChatRoomId}
                className="whitespace-pre-wrap text-2 leading-relaxed text-foreground"
              />
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            className="w-full sm:w-auto"
            disabled={!body || Boolean(error)}
            onClick={() => void handleCopy()}
          >
            {copyState === 'copied'
              ? t('spaceMemoryTranscriptCopied')
              : copyState === 'failed'
              ? t('spaceMemoryCopyTranscriptFailed')
              : t('spaceMemoryCopyTranscript')}
          </Button>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {tCommon('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
