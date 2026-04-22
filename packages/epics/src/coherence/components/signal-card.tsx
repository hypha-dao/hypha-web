'use client';

import {
  Coherence,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  BadgeItem,
  BadgesList,
  Button,
  Card,
  CardContent,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LucideReactIcon,
  Skeleton,
} from '@hypha-platform/ui';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { formatDistanceToNow } from 'date-fns';
import {
  ChatBubbleIcon,
  ClockIcon,
  DotFilledIcon,
} from '@radix-ui/react-icons';
import React from 'react';
import type { BadgeProps } from '@hypha-platform/ui';
import { useLocale, useTranslations } from 'next-intl';
import { Trash2, Users } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

type SignalCardProps = {
  isLoading: boolean;
  refresh: () => Promise<void>;
  onOpenConversation?: () => void;
  className?: string;
};

export const SignalCard: React.FC<SignalCardProps & Coherence> = ({
  isLoading,
  title,
  description,
  type,
  priority,
  slug,
  createdAt,
  tags,
  archived,
  messages = 0,
  roomId,
  creatorId,
  refresh,
  onOpenConversation,
  className,
}) => {
  const { jwt: authToken } = useJwt();
  const { person } = useMe();
  const { updateCoherenceBySlug, deleteCoherenceBySlug } =
    useCoherenceMutationsWeb2Rsc(authToken);
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const dateFnsLocale = React.useMemo(
    () => resolveDateFnsLocale(locale),
    [locale],
  );

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const descriptionClampRef = React.useRef<HTMLParagraphElement>(null);
  const [descriptionTruncated, setDescriptionTruncated] = React.useState(false);
  const isCreator = person?.id === creatorId;

  const coherenceType = React.useMemo(
    () => COHERENCE_TYPE_OPTIONS.find((option) => option.type === type),
    [type],
  );

  const typeLabel = t(
    `types.${type}` as
      | 'types.Opportunity'
      | 'types.Risk'
      | 'types.Tension'
      | 'types.Insight'
      | 'types.Trend'
      | 'types.Proposal',
  );

  const badges: BadgeItem[] = [
    {
      label: typeLabel,
      icon: coherenceType?.icon as LucideReactIcon,
      variant: 'outline',
      colorVariant: (coherenceType?.colorVariant ??
        'accent') as BadgeProps['colorVariant'],
    },
  ];

  const tagList: BadgeItem[] = tags.map((tag) => {
    const displayLabel = (COHERENCE_TAGS as readonly string[]).includes(tag)
      ? t(
          `tagLabels.${tag}` as
            | 'tagLabels.Strategy'
            | 'tagLabels.Culture'
            | 'tagLabels.Onboarding'
            | 'tagLabels.Engagement'
            | 'tagLabels.Learning'
            | 'tagLabels.Capacity'
            | 'tagLabels.Network'
            | 'tagLabels.Reputation',
        )
      : tag;
    return {
      label: `#${displayLabel}`,
      variant: 'outline',
      colorVariant: 'neutral',
    };
  });

  const plainDescription = React.useMemo(
    () =>
      stripDescription(
        stripMarkdown(description, {
          orderedListMarkers: false,
          unorderedListMarkers: false,
        }),
      ),
    [description],
  );

  React.useLayoutEffect(() => {
    const el = descriptionClampRef.current;
    if (!el || !plainDescription.trim()) {
      setDescriptionTruncated(false);
      return;
    }
    const measure = () => {
      setDescriptionTruncated(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [plainDescription]);

  const handleUnarchive = React.useCallback(async () => {
    if (!slug) return;
    try {
      await updateCoherenceBySlug({ slug, archived: false });
      await refresh();
    } catch (error) {
      console.warn('Could not unarchive conversation:', error);
    }
  }, [slug, refresh, updateCoherenceBySlug]);

  const handleDelete = React.useCallback(async (): Promise<boolean> => {
    if (!slug) return false;
    setDeleteError(null);
    try {
      await deleteCoherenceBySlug({ slug });
      await refresh();
      return true;
    } catch (error) {
      console.warn('Could not delete signal:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setDeleteError(msg || tSignalCard('deleteFailed'));
      return false;
    }
  }, [slug, deleteCoherenceBySlug, refresh, tSignalCard]);

  return (
    <Card
      className={cn(
        'group flex h-full w-full min-h-0 flex-col overflow-hidden rounded-2xl border-border/70 bg-card pt-0 shadow-sm',
        'transition-[border-color,box-shadow] duration-200 ease-out',
        'hover:border-accent-8/75 hover:shadow-md',
        'focus-within:border-accent-8/75 focus-within:shadow-md',
        className,
      )}
    >
      <CardContent className="relative flex min-h-0 flex-1 flex-col gap-0 p-0">
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton
              className="min-w-0 flex-1"
              width="100%"
              height="22px"
              loading={isLoading}
            >
              <CardTitle className="line-clamp-2 pr-1 text-base font-semibold leading-snug">
                {title}
              </CardTitle>
            </Skeleton>
            {isCreator && slug ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  disabled={isLoading}
                  aria-label={tSignalCard('deleteMenu')}
                  title={tSignalCard('deleteMenu')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
                <AlertDialog
                  open={deleteOpen}
                  onOpenChange={(open) => {
                    setDeleteOpen(open);
                    if (!open) setDeleteError(null);
                  }}
                >
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {tSignalCard('deleteSignal')}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {tSignalCard('deleteConfirm')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError ? (
                      <p
                        role="alert"
                        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        {deleteError}
                      </p>
                    ) : null}
                    <AlertDialogFooter>
                      <AlertDialogCancel asChild>
                        <Button variant="outline" colorVariant="neutral">
                          {t('noLeave')}
                        </Button>
                      </AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button
                          colorVariant="error"
                          onClick={() =>
                            void handleDelete().then((deleted) => {
                              if (deleted) setDeleteOpen(false);
                            })
                          }
                        >
                          {tSignalCard('deleteConfirmAction')}
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 text-1 text-muted-foreground">
            {badges?.length > 0 ? (
              <BadgesList isLoading={isLoading} badges={badges ?? []} />
            ) : null}
            {priority === 'high' ? (
              <span className="inline-flex items-center gap-1 text-neutral-11">
                <DotFilledIcon className="h-3.5 w-3.5 shrink-0 text-error-11" />
                {t('highUrgency')}
              </span>
            ) : null}
            {priority === 'medium' ? (
              <span className="inline-flex items-center gap-1 text-neutral-11">
                <DotFilledIcon className="h-3.5 w-3.5 shrink-0 text-warning-11" />
                {t('mediumUrgency')}
              </span>
            ) : null}
            {priority === 'low' ? (
              <span className="inline-flex items-center gap-1 text-neutral-11">
                <DotFilledIcon className="h-3.5 w-3.5 shrink-0 text-neutral-11" />
                {t('lowUrgency')}
              </span>
            ) : null}
            <span className="inline-flex min-w-0 items-center gap-1">
              <ClockIcon
                className="h-3.5 w-3.5 shrink-0 opacity-70"
                aria-hidden
              />
              {createdAt
                ? formatDistanceToNow(new Date(createdAt), {
                    addSuffix: true,
                    locale: dateFnsLocale,
                  })
                : ''}
            </span>
          </div>

          <Skeleton
            className="min-w-full"
            width="100%"
            height="44px"
            loading={isLoading}
          >
            <div className="flex flex-col gap-1">
              <p
                ref={descriptionClampRef}
                className="text-1 leading-snug text-neutral-11 line-clamp-2"
              >
                {plainDescription}
              </p>
              {descriptionTruncated ? (
                <button
                  type="button"
                  className="w-fit text-left text-1 font-medium text-accent-11 underline-offset-4 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailsOpen(true);
                  }}
                >
                  {tSignalCard('readFullDescription')}
                </button>
              ) : null}
            </div>
          </Skeleton>

          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent
              className="max-h-[min(560px,85dvh)] gap-0 overflow-hidden p-0 sm:max-w-lg"
              onClick={(e) => e.stopPropagation()}
              onPointerDownOutside={(e) => e.stopPropagation()}
            >
              <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
                <DialogTitle className="pr-8 leading-snug">{title}</DialogTitle>
                <DialogDescription className="text-xs">
                  {tSignalCard('fullDescriptionDialogSubtitle')}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(420px,calc(85dvh-9rem))] overflow-y-auto px-6 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {plainDescription}
                </p>
              </div>
              <DialogFooter className="border-t border-border px-6 py-4">
                <Button
                  type="button"
                  variant="default"
                  colorVariant="accent"
                  className="w-full sm:w-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailsOpen(false);
                  }}
                >
                  {tCommon('close')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {tagList?.length > 0 ? (
            <BadgesList isLoading={isLoading} badges={tagList ?? []} />
          ) : null}

          <div className="flex flex-row gap-1">
            <Skeleton loading={isLoading} height="16px" width="80px">
              <Users size={12} />
              <div className="text-neutral-11 text-1">
                {t('mentions', { count: messages })}
              </div>
            </Skeleton>
          </div>
        </div>

        <div className="mt-auto flex min-h-[4.25rem] shrink-0 flex-col justify-center border-t border-border px-4 py-3">
          {archived ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <ConfirmDialog
                title={t('unarchiveConversation')}
                description={t('unarchiveConfirm')}
                customAcceptButtonText={t('yesUnarchive')}
                customRejectButtonText={t('noLeave')}
                onAcceptClicked={handleUnarchive}
              >
                <Button
                  variant="outline"
                  colorVariant="accent"
                  className="w-full"
                >
                  {t('unarchive')}
                </Button>
              </ConfirmDialog>
            </div>
          ) : (
            <Button
              variant="outline"
              colorVariant="accent"
              className="w-full"
              disabled={isLoading || !roomId}
              onClick={(e) => {
                if (onOpenConversation) {
                  e.stopPropagation();
                  e.preventDefault();
                  onOpenConversation();
                }
              }}
              title={!roomId ? tSignalCard('noConversationRoom') : undefined}
            >
              <ChatBubbleIcon />
              {t('openConversation')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
