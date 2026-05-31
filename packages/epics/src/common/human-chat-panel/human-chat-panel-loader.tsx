'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type HumanChatPanelLoaderProps = {
  label?: string;
  /** Faint message-row skeletons while the timeline loads */
  showPreview?: boolean;
  className?: string;
};

function ChatLoaderSkeletonRow({
  align,
  bubbleWidth,
}: {
  align: 'start' | 'end';
  bubbleWidth: number;
}) {
  return (
    <div
      className={cn(
        'flex w-full gap-2.5 px-4',
        align === 'end' ? 'flex-row-reverse' : 'flex-row',
      )}
      aria-hidden
    >
      <Skeleton
        loading
        width={32}
        height={32}
        className="shrink-0 rounded-full"
      />
      <div
        className={cn(
          'flex min-w-0 flex-col gap-1.5',
          align === 'end' ? 'items-end' : 'items-start',
        )}
      >
        <Skeleton loading width={64} height={10} className="rounded-md" />
        <Skeleton
          loading
          width={bubbleWidth}
          height={40}
          className="rounded-2xl"
        />
      </div>
    </div>
  );
}

function LoaderIndicator({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative flex h-11 w-11 items-center justify-center">
        <div
          className="absolute inset-0 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--space-accent,#4a65d8)_22%,transparent)]"
          aria-hidden
        />
        <div
          className="absolute inset-[3px] rounded-full border border-[color:color-mix(in_srgb,var(--space-accent,#4a65d8)_35%,transparent)]"
          aria-hidden
        />
        <Loader2
          className="h-5 w-5 animate-spin text-[color:var(--space-accent,#4a65d8)]"
          strokeWidth={2.25}
          aria-hidden
        />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function HumanChatPanelLoader({
  label,
  showPreview = false,
  className,
}: HumanChatPanelLoaderProps) {
  const t = useTranslations('HumanChatPanel');
  const message = label ?? t('loading');

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        showPreview ? 'justify-end' : 'items-center justify-center',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      {showPreview ? (
        <div className="flex w-full flex-1 flex-col justify-end gap-6 pb-8 pt-12">
          <div className="pointer-events-none space-y-5 opacity-45">
            <ChatLoaderSkeletonRow align="start" bubbleWidth={200} />
            <ChatLoaderSkeletonRow align="end" bubbleWidth={152} />
            <ChatLoaderSkeletonRow align="start" bubbleWidth={176} />
          </div>
          <LoaderIndicator label={message} />
        </div>
      ) : (
        <LoaderIndicator label={message} />
      )}
    </div>
  );
}
