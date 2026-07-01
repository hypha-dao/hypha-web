'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, CalendarDays, Pencil } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@hypha-platform/ui';
import {
  Coherence,
  buildScheduleFromSignalSearchParams,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useCanManageSignal } from '../hooks/use-can-manage-signal';

type SignalCardActionsProps = {
  signal: Pick<
    Coherence,
    'id' | 'slug' | 'roomId' | 'creatorId' | 'archived' | 'title' | 'dueAt'
  >;
  refresh: () => Promise<void>;
  className?: string;
  size?: 'sm' | 'md';
};

export function SignalCardActions({
  signal,
  refresh,
  className,
  size = 'sm',
}: SignalCardActionsProps) {
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const { jwt: authToken } = useJwt();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const router = useRouter();
  const params = useParams<{ lang: string; id: string; tab?: string }>();
  const { space } = useSpaceBySlug(params.id ?? '');

  const canManage = useCanManageSignal({
    spaceSlug: params.id ?? '',
    web3SpaceId: space?.web3SpaceId ?? undefined,
  });

  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

  const handleUnarchive = async (event: React.MouseEvent) => {
    stopActivation(event);
    setIsMutating(true);
    try {
      await updateCoherenceBySlug({ slug, archived: false });
      await refresh();
    } catch (archiveError) {
      console.warn('Could not unarchive signal:', archiveError);
    } finally {
      setIsMutating(false);
    }
  };

  const handleArchive = async () => {
    setError(null);
    setIsMutating(true);
    try {
      await updateCoherenceBySlug({ slug, archived: true });
      try {
        await refresh();
      } catch (refreshError) {
        console.warn('Signal archived but list refresh failed:', refreshError);
      }
      setArchiveOpen(false);
    } catch (archiveError) {
      console.warn('Could not archive signal:', archiveError);
      setError(t('errorOhSnap'));
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <>
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
          disabled={isMutating}
          aria-label={t('scheduleOnCalendar')}
          title={t('scheduleOnCalendar')}
          onClick={handleScheduleOnCalendar}
        >
          <CalendarDays className={iconClass} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          className={cn(
            buttonClass,
            'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
          )}
          disabled={isMutating}
          aria-label={tSignalCard('editMenu')}
          title={tSignalCard('editMenu')}
          onClick={handleEdit}
        >
          <Pencil className={iconClass} aria-hidden />
        </Button>
        {signal.archived ? (
          <Button
            type="button"
            variant="ghost"
            colorVariant="neutral"
            className={cn(
              buttonClass,
              'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
            disabled={isMutating}
            aria-label={t('unarchiveConversation')}
            title={t('unarchiveConversation')}
            onClick={handleUnarchive}
          >
            <ArchiveRestore className={iconClass} aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            colorVariant="neutral"
            className={cn(
              buttonClass,
              'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
            disabled={isMutating}
            aria-label={t('archiveConversation')}
            title={t('archiveConversation')}
            onClick={(event) => {
              stopActivation(event);
              setArchiveOpen(true);
            }}
          >
            <Archive className={iconClass} aria-hidden />
          </Button>
        )}
      </div>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent onClick={stopActivation}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archiveConversation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('archiveConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-sm text-error-11">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>
              {t('noLeave')}
            </AlertDialogCancel>
            <Button
              colorVariant="error"
              disabled={isMutating}
              onClick={handleArchive}
            >
              {t('yesArchive')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
