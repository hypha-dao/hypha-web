'use client';

import { useTranslations } from 'next-intl';

import { Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { SpaceAccentSpinner } from '../space-accent-loader';

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
          className="rounded-lg"
        />
      </div>
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
        'relative flex min-h-0 flex-1 flex-col items-center justify-center',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      {showPreview ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-5 px-4 opacity-45">
          <ChatLoaderSkeletonRow align="start" bubbleWidth={200} />
          <ChatLoaderSkeletonRow align="end" bubbleWidth={152} />
          <ChatLoaderSkeletonRow align="start" bubbleWidth={176} />
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-3 text-center">
        <SpaceAccentSpinner size="md" />
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
