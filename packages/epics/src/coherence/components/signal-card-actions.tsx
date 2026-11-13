'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarDays, Pencil } from 'lucide-react';
import { Button } from '@hypha-platform/ui';
import {
  Coherence,
  buildScheduleFromSignalSearchParams,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useCanManageSignal } from '../hooks/use-can-manage-signal';
import { useIsSignalCreator } from '../hooks/use-is-signal-creator';

type SignalCardActionsProps = {
  signal: Pick<
    Coherence,
    'id' | 'slug' | 'roomId' | 'creatorId' | 'title' | 'dueAt'
  >;
  className?: string;
  size?: 'sm' | 'md';
};

export function SignalCardActions({
  signal,
  className,
  size = 'sm',
}: SignalCardActionsProps) {
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const router = useRouter();
  const params = useParams<{ lang: string; id: string; tab?: string }>();
  const { space } = useSpaceBySlug(params.id ?? '');

  const canManage = useCanManageSignal({
    spaceSlug: params.id ?? '',
    web3SpaceId: space?.web3SpaceId ?? undefined,
  });

  const isCreator = useIsSignalCreator(signal.creatorId);

  const slug = signal.slug?.trim();
  if (!canManage || !slug) return null;

  const buttonClass =
    size === 'sm'
      ? 'h-6 w-6 min-h-6 min-w-6 max-h-6 max-w-6 shrink-0 p-0'
      : 'h-8 w-8 min-h-8 min-w-8 max-h-8 max-w-8 shrink-0 p-0';

  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  const stopActivation = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleEdit = (event: React.MouseEvent) => {
    stopActivation(event);
    if (!params.lang || !params.id) return;
    const tab = params.tab ?? 'coherence';
    router.push(`/${params.lang}/dho/${params.id}/${tab}/edit-signal/${slug}`);
  };

  const handleScheduleOnCalendar = (event: React.MouseEvent) => {
    stopActivation(event);
    if (!params.lang || !params.id) return;
    const paramsQuery = buildScheduleFromSignalSearchParams({
      coherenceId: signal.id,
      title: signal.title,
      dueAt: signal.dueAt,
    });
    router.push(
      `/${params.lang}/dho/${
        params.id
      }/calendar/new-scheduled-item?${paramsQuery.toString()}`,
      { scroll: false },
    );
  };

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-0 transition-opacity',
        className,
      )}
      draggable={false}
      onMouseDown={stopActivation}
      onClick={stopActivation}
    >
      <Button
        type="button"
        variant="ghost"
        colorVariant="neutral"
        className={cn(
          buttonClass,
          'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
        )}
        aria-label={t('scheduleOnCalendar')}
        title={t('scheduleOnCalendar')}
        onClick={handleScheduleOnCalendar}
      >
        <CalendarDays className={iconClass} aria-hidden />
      </Button>
      {isCreator ? (
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          className={cn(
            buttonClass,
            'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
          )}
          aria-label={tSignalCard('editMenu')}
          title={tSignalCard('editMenu')}
          onClick={handleEdit}
        >
          <Pencil className={iconClass} aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
