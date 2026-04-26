'use client';

import {
  Coherence,
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  BadgeItem,
  BadgesList,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LucideReactIcon,
  Skeleton,
  DynamicIcon,
} from '@hypha-platform/ui';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { formatDistanceToNow } from 'date-fns';
import { ChatBubbleIcon, ClockIcon } from '@radix-ui/react-icons';
import React from 'react';
import type { BadgeProps } from '@hypha-platform/ui';
import { useLocale, useTranslations } from 'next-intl';
import { Trash2, Users } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

type SignalCardProps = {
  isLoading: boolean;
  refresh: () => Promise<void>;
  onOpenConversation?: () => void;
  className?: string;
};

function typeHeroGradient(colorVariant: string | undefined): string {
  switch (colorVariant) {
    case 'success':
      return 'from-emerald-500/38 via-muted/55 to-background';
    case 'error':
      return 'from-rose-500/34 via-muted/55 to-background';
    case 'warn':
      return 'from-amber-500/32 via-muted/55 to-background';
    case 'tension':
      return 'from-orange-500/30 via-muted/55 to-background';
    case 'insight':
      return 'from-violet-500/30 via-muted/55 to-background';
    case 'accent':
    default:
      return 'from-accent-5/35 via-muted/60 to-background';
  }
}

/** Map coherence type tokens to supported `Badge` color variants. */
function typeToBadgeColor(
  cv: string | undefined,
): NonNullable<BadgeProps['colorVariant']> {
  switch (cv) {
    case 'success':
    case 'error':
    case 'warn':
    case 'neutral':
    case 'accent':
      return cv;
    case 'tension':
    case 'insight':
      return 'accent';
    default:
      return 'accent';
  }
}

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
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
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

  const priorityMeta = React.useMemo(
    () => COHERENCE_PRIORITY_OPTIONS.find((o) => o.priority === priority),
    [priority],
  );

  const metaBadges: BadgeItem[] = React.useMemo(() => {
    if (!priorityMeta) return [];
    const priorityLabel = t(
      `priorities.${priorityMeta.priority}` as
        | 'priorities.high'
        | 'priorities.medium'
        | 'priorities.low',
    );
    return [
      {
        label: priorityLabel,
        icon: priorityMeta.icon as LucideReactIcon,
        variant: 'outline',
        colorVariant: priorityMeta.colorVariant as BadgeProps['colorVariant'],
      },
    ];
  }, [priorityMeta, t]);

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

  const typeIconName = (coherenceType?.icon as LucideReactIcon) ?? 'CircleDot';
  const heroGradient = typeHeroGradient(coherenceType?.colorVariant);

  React.useLayoutEffect(() => {
    const el = descriptionClampRef.current;
    if (!el || !plainDescription.trim() || isLoading) {
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
  }, [plainDescription, isLoading]);

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
      try {
        await refresh();
      } catch (refreshErr) {
        console.warn('Signal deleted but list refresh failed:', refreshErr);
      }
      return true;
    } catch (error) {
      console.warn('Could not delete signal:', error);
      setDeleteError(tSignalCard('deleteFailed'));
      return false;
    }
  }, [slug, deleteCoherenceBySlug, refresh, tSignalCard]);

  const timeLine =
    createdAt && !isLoading
      ? formatDistanceToNow(new Date(createdAt), {
          addSuffix: true,
          locale: dateFnsLocale,
        })
      : '';

  const heroVisual = (
    <div className="relative isolate overflow-hidden">
      <div
        className={cn(
          'relative h-[5.25rem] w-full overflow-hidden bg-muted/50',
          'after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:via-background/55 after:to-background',
        )}
      >
        {isLoading ? (
          <Skeleton
            className="h-full w-full rounded-none"
            loading
            height="100%"
          />
        ) : (
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br motion-reduce:scale-100',
              heroGradient,
            )}
            aria-hidden
          />
        )}
      </div>
      <div className="relative z-10 -mt-10 px-3">
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-card shadow-md ring-4 ring-card',
            'motion-safe:transition-transform motion-safe:duration-200',
          )}
        >
          {isLoading ? (
            <Skeleton
              className="h-9 w-9 rounded-full"
              loading
              width="36px"
              height="36px"
            />
          ) : (
            <DynamicIcon
              name={typeIconName}
              size={28}
              className="text-[var(--space-accent,var(--color-accent-11))] opacity-95"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Card
      className={cn(
        'group flex h-full min-h-0 w-full flex-col overflow-hidden p-0',
        'border-border/80 transition-shadow duration-150 hover:border-border hover:shadow-sm',
        'motion-reduce:transition-none',
        className,
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        {isCreator && slug ? (
          <>
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              size="sm"
              className="absolute right-2 top-2 z-20 h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
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
              <AlertDialogContent
                overlayClassName="bg-black/75 backdrop-blur-sm supports-[backdrop-filter]:bg-black/65"
                className="border-l-[3px] border-l-[var(--space-accent)]"
                style={spaceAccentPortalStyle}
                data-space-accent-scope=""
                onClick={(e) => e.stopPropagation()}
              >
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
                  <Button
                    type="button"
                    colorVariant="accent"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const deleted = await handleDelete();
                      if (deleted) setDeleteOpen(false);
                    }}
                  >
                    {tSignalCard('deleteConfirmAction')}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}

        <div className="min-w-0 space-y-2 px-3 pb-3 pt-1">
          {heroVisual}

          <div className="flex min-w-0 items-start justify-between gap-1.5 pt-0.5">
            {isLoading ? (
              <Skeleton
                className="my-0.5"
                width="7rem"
                height="1.1rem"
                loading
              />
            ) : (
              <p
                className="text-4 line-clamp-2 min-w-0 flex-1 font-medium leading-tight"
                title={title || undefined}
              >
                {title}
              </p>
            )}
            {isLoading ? (
              <Skeleton className="my-0.5 h-5 w-20 shrink-0" loading />
            ) : (
              <Badge
                className="h-fit max-w-[42%] shrink-0 border text-[10px] font-medium uppercase"
                variant="outline"
                colorVariant={typeToBadgeColor(coherenceType?.colorVariant)}
              >
                {typeLabel}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="mt-0.5" width="6rem" height="0.7rem" loading />
          ) : (
            <p className="mt-0.5 line-clamp-1 text-1 text-muted-foreground">
              {timeLine ? (
                <span
                  className="inline-flex items-center gap-1"
                  title={timeLine}
                >
                  <ClockIcon
                    className="h-3 w-3 shrink-0 opacity-80"
                    aria-hidden
                  />
                  {timeLine}
                </span>
              ) : (
                '\u00a0'
              )}
            </p>
          )}

          {metaBadges.length > 0 ? (
            <div className="flex min-h-5 w-full max-w-full flex-wrap content-center gap-1.5">
              <BadgesList isLoading={isLoading} badges={metaBadges} />
            </div>
          ) : null}

          <Skeleton
            className="min-w-full"
            width="100%"
            height="44px"
            loading={isLoading}
          >
            <div className="flex flex-col gap-1">
              <p
                ref={descriptionClampRef}
                className="line-clamp-2 min-h-8 text-1 leading-snug text-muted-foreground"
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

          {/* Non-modal: focus is managed by Radix, but the scrim is below the app header
           * and offcanvas side panels; users can use top nav + side triggers while open. */}
          <Dialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            modal={false}
          >
            <DialogContent
              className={cn(
                'flex max-h-[min(560px,85dvh)] flex-col gap-0 overflow-hidden border-border/70 bg-card/95 p-0 shadow-2xl backdrop-blur-sm sm:max-w-lg',
                'border-l-[3px] border-l-[var(--space-accent)]',
              )}
              style={spaceAccentPortalStyle}
              onClick={(e) => e.stopPropagation()}
              onPointerDownOutside={(e) => e.stopPropagation()}
            >
              <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 bg-gradient-to-b from-muted/25 to-transparent px-6 pb-4 pt-6">
                <DialogTitle className="pr-10 text-balance text-lg font-semibold leading-snug tracking-tight">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {tSignalCard('fullDescriptionDialogSubtitle')}
                </DialogDescription>
              </DialogHeader>
              <div
                className={cn(
                  'narrow-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5',
                  '[scrollbar-gutter:stable]',
                )}
              >
                <p className="whitespace-pre-wrap text-sm leading-[1.65] text-foreground/95">
                  {plainDescription}
                </p>
              </div>
              <DialogFooter className="shrink-0 border-t border-border/60 bg-muted/10 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
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

          <div className="flex min-h-5 items-center gap-1 text-1 text-muted-foreground">
            <Skeleton loading={isLoading} height="16px" width="80px">
              <Users className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span>{t('mentions', { count: messages })}</span>
            </Skeleton>
          </div>
        </div>

        <div className="mt-auto border-t border-border/60 p-2.5">
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
      </div>
    </Card>
  );
};
