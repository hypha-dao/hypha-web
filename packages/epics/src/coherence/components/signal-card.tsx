'use client';

import {
  Coherence,
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  DEFAULT_SPACE_LEAD_IMAGE,
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
  Badge,
  BadgesList,
  Button,
  Card,
  CardContent,
  CardHeader,
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
import { Trash2, Users } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

type SignalCardProps = {
  isLoading: boolean;
  refresh: () => Promise<void>;
  onOpenConversation?: () => void;
  className?: string;
  leadImage?: string;
};

const BADGE_COLOR_VARIANT_MAP: Record<string, BadgeProps['colorVariant']> = {
  accent: 'accent',
  error: 'error',
  warn: 'warn',
  warning: 'warn',
  success: 'success',
  neutral: 'neutral',
  tension: 'warn',
  insight: 'accent',
};

type SignalColorVariant = NonNullable<BadgeProps['colorVariant']>;

const HERO_TINT_CLASS_MAP: Record<SignalColorVariant, string> = {
  accent: 'bg-accent-9/23',
  error: 'bg-error-9/23',
  warn: 'bg-warning-9/23',
  success: 'bg-success-9/23',
  neutral: 'bg-neutral-9/23',
};

const HERO_PRIORITY_GRADIENT_CLASS_MAP: Record<SignalColorVariant, string> = {
  accent: 'to-accent-9/27',
  error: 'to-error-9/27',
  warn: 'to-warning-9/27',
  success: 'to-success-9/27',
  neutral: 'to-neutral-9/27',
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
  leadImage,
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

  const typeColorVariant = React.useMemo<SignalColorVariant>(
    () =>
      BADGE_COLOR_VARIANT_MAP[coherenceType?.colorVariant ?? 'accent'] ??
      'accent',
    [coherenceType?.colorVariant],
  );

  const priorityColorVariant = React.useMemo<SignalColorVariant>(
    () =>
      BADGE_COLOR_VARIANT_MAP[priorityMeta?.colorVariant ?? 'neutral'] ??
      'neutral',
    [priorityMeta?.colorVariant],
  );

  const metaBadges: BadgeItem[] = React.useMemo(() => {
    const typeBadge: BadgeItem = {
      label: typeLabel,
      icon: coherenceType?.icon as LucideReactIcon,
      variant: 'soft',
      colorVariant: typeColorVariant,
    };
    if (!priorityMeta) return [typeBadge];
    const priorityLabel = t(
      `priorities.${priorityMeta.priority}` as
        | 'priorities.high'
        | 'priorities.medium'
        | 'priorities.low',
    );
    const priorityBadge: BadgeItem = {
      label: priorityLabel,
      icon: priorityMeta.icon as LucideReactIcon,
      variant: 'soft',
      colorVariant: priorityColorVariant,
    };
    return [typeBadge, priorityBadge];
  }, [
    coherenceType,
    priorityMeta,
    t,
    typeLabel,
    typeColorVariant,
    priorityColorVariant,
  ]);

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
      <CardHeader className="relative h-48 shrink-0 overflow-hidden p-0">
        <Skeleton
          className="h-full min-w-full"
          width="100%"
          height="192px"
          loading={isLoading}
        >
          <Image
            width={640}
            height={192}
            className="h-full w-full object-cover"
            src={leadImage || DEFAULT_SPACE_LEAD_IMAGE}
            alt={title || ''}
          />
          <div
            className={cn(
              'absolute inset-0 pointer-events-none',
              HERO_TINT_CLASS_MAP[typeColorVariant],
            )}
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-transparent',
              HERO_PRIORITY_GRADIENT_CLASS_MAP[priorityColorVariant],
            )}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/22 to-transparent"
            aria-hidden
          />
        </Skeleton>
        {isCreator && slug ? (
          <>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              size="sm"
              className="absolute right-3 top-3 z-10 h-10 w-10 shrink-0 rounded-none border border-white/15 bg-black/45 p-0 text-neutral-1 shadow-sm backdrop-blur-[1px] hover:bg-black/55 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
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
      </CardHeader>
      <CardContent className="relative flex min-h-0 flex-1 flex-col gap-0 p-0">
        <div className="relative flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
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
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 text-1 text-muted-foreground">
            {metaBadges.length > 0 ? (
              <BadgesList isLoading={isLoading} badges={metaBadges} />
            ) : null}
            <div className="ml-auto flex min-w-0 items-center gap-3">
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
              <Badge
                isLoading={isLoading}
                variant="outline"
                colorVariant="neutral"
                className="gap-1.5"
              >
                <Users size={12} aria-hidden />
                <span>{t('mentions', { count: messages })}</span>
              </Badge>
            </div>
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
