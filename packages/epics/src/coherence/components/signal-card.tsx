'use client';

import {
  Coherence,
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  CoherencePriority,
  CoherenceType,
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
  Image,
  LucideReactIcon,
  Skeleton,
} from '@hypha-platform/ui';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { formatDistanceToNow } from 'date-fns';
import { ChatBubbleIcon, ClockIcon } from '@radix-ui/react-icons';
import React from 'react';
import type { BadgeProps } from '@hypha-platform/ui';
import { useLocale, useTranslations } from 'next-intl';
import { MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

const SIGNAL_TYPE_BANNER: Record<CoherenceType, string> = {
  Opportunity: '/placeholder/signal-type-opportunity.svg',
  Risk: '/placeholder/signal-type-risk.svg',
  Tension: '/placeholder/signal-type-tension.svg',
  Insight: '/placeholder/signal-type-insight.svg',
  Trend: '/placeholder/signal-type-trend.svg',
  Proposal: '/placeholder/signal-type-proposal.svg',
};

const PRIORITY_BANNER_OVERLAY: Record<CoherencePriority, string> = {
  high: 'bg-destructive/25',
  medium: 'bg-warning-9/20',
  low: 'bg-success-9/15',
};

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
    const typeBadge: BadgeItem = {
      label: typeLabel,
      icon: coherenceType?.icon as LucideReactIcon,
      variant: 'outline',
      colorVariant: (coherenceType?.colorVariant ??
        'accent') as BadgeProps['colorVariant'],
    };
    return [typeBadge];
  }, [coherenceType, typeLabel]);

  const priorityLabel = React.useMemo(() => {
    if (!priorityMeta) return '';
    return t(
      `priorities.${priorityMeta.priority}` as
        | 'priorities.high'
        | 'priorities.medium'
        | 'priorities.low',
    );
  }, [priorityMeta, t]);

  const typeBannerSrc =
    SIGNAL_TYPE_BANNER[type] ?? SIGNAL_TYPE_BANNER.Opportunity;

  const signalBannerAlt = React.useMemo(() => {
    const pri =
      priorityLabel ||
      t(
        `priorities.${priority}` as
          | 'priorities.high'
          | 'priorities.medium'
          | 'priorities.low',
      );
    return t('typeSignalBannerAlt', {
      type: typeLabel,
      priority: pri,
    });
  }, [priority, priorityLabel, t, typeLabel]);

  const priorityOverlayClass =
    PRIORITY_BANNER_OVERLAY[priority] ?? PRIORITY_BANNER_OVERLAY.medium;

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
        <div className="relative w-full overflow-hidden">
          <Skeleton
            className="w-full rounded-none"
            width="100%"
            height="88px"
            loading={isLoading}
          >
            <div className="relative h-[5.5rem] w-full sm:h-24">
              <Image
                width={400}
                height={96}
                className="h-full w-full object-cover object-center"
                src={typeBannerSrc}
                alt={signalBannerAlt}
                unoptimized
              />
              <div
                className={cn(
                  'pointer-events-none absolute inset-0',
                  priorityOverlayClass,
                )}
                aria-hidden
              />
            </div>
          </Skeleton>
        </div>
        {isCreator && slug ? (
          <>
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              size="sm"
              className="absolute right-2 top-2 z-10 h-9 w-9 shrink-0 rounded-md border border-border/50 bg-background/80 p-0 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-background hover:text-destructive"
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
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4">
          <div className={cn('min-w-0', isCreator && slug && 'pr-10')}>
            <Skeleton
              className="min-w-0"
              width="100%"
              height="22px"
              loading={isLoading}
            >
              <CardTitle className="line-clamp-2 text-base font-semibold leading-snug">
                {title}
              </CardTitle>
            </Skeleton>
            {priorityLabel ? (
              <p className="mt-0.5 text-1 font-medium text-muted-foreground">
                {priorityLabel}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 text-1 text-muted-foreground">
            {metaBadges.length > 0 ? (
              <BadgesList isLoading={isLoading} badges={metaBadges} />
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
              className={cn(
                'flex max-h-[min(560px,85dvh)] flex-col gap-0 overflow-hidden border border-border/90 bg-background-2 p-0 shadow-2xl sm:max-w-lg',
                'border-l-[3px] border-l-[var(--space-accent)]',
              )}
              style={spaceAccentPortalStyle}
              onClick={(e) => e.stopPropagation()}
              onPointerDownOutside={(e) => e.stopPropagation()}
            >
              <DialogHeader
                className={cn(
                  'sticky top-0 z-[1] shrink-0 space-y-1 border-b border-border/90 bg-background-2/95 px-6 pb-4 pt-5 backdrop-blur-md supports-[backdrop-filter]:bg-background-2/80',
                )}
              >
                <DialogTitle className="pr-2 text-balance text-base font-semibold leading-tight tracking-tight text-foreground">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-1 text-muted-foreground">
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
              <DialogFooter className="shrink-0 border-t border-border/90 bg-muted/10 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
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

          <div className="inline-flex items-center gap-1.5 text-1 text-muted-foreground">
            <Skeleton loading={isLoading} height="16px" width="100px">
              <>
                <MessageSquare
                  className="h-3.5 w-3.5 shrink-0 opacity-70"
                  aria-hidden
                />
                <span className="text-neutral-11">
                  {t('messageCount', { count: messages ?? 0 })}
                </span>
              </>
            </Skeleton>
          </div>
        </div>

        <div className="mt-auto flex min-h-[4.25rem] shrink-0 flex-col justify-center border-t border-border/80 px-4 py-3">
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
