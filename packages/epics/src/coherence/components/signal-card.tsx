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
  Skeleton,
} from '@hypha-platform/ui';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChatBubbleIcon, ClockIcon } from '@radix-ui/react-icons';
import React from 'react';
import type { BadgeProps } from '@hypha-platform/ui';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, Pencil, Users } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import { useScrollParallax } from '../../common/use-scroll-parallax';
import { useParams, useRouter } from 'next/navigation';

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

const HERO_PRIORITY_WASH_CLASS_MAP: Record<SignalColorVariant, string> = {
  accent: 'bg-accent-9/18',
  error: 'bg-error-9/20',
  warn: 'bg-warning-9/19',
  success: 'bg-success-9/18',
  neutral: 'bg-neutral-9/16',
};

const HERO_PRIORITY_SPOTLIGHT_CLASS_MAP: Record<SignalColorVariant, string> = {
  accent: 'bg-gradient-to-br from-accent-9/34 via-accent-8/16 to-transparent',
  error: 'bg-gradient-to-br from-error-9/36 via-error-8/18 to-transparent',
  warn: 'bg-gradient-to-br from-warning-9/36 via-warning-8/18 to-transparent',
  success:
    'bg-gradient-to-br from-success-9/34 via-success-8/16 to-transparent',
  neutral:
    'bg-gradient-to-br from-neutral-9/30 via-neutral-8/14 to-transparent',
};

const HERO_PRIORITY_VIGNETTE_CLASS_MAP: Record<SignalColorVariant, string> = {
  accent: 'bg-gradient-to-t from-black/22 via-black/8 to-accent-10/14',
  error: 'bg-gradient-to-t from-black/24 via-black/10 to-error-10/16',
  warn: 'bg-gradient-to-t from-black/24 via-black/10 to-warning-10/16',
  success: 'bg-gradient-to-t from-black/22 via-black/8 to-success-10/14',
  neutral: 'bg-gradient-to-t from-black/22 via-black/8 to-neutral-10/12',
};

const HERO_PRIORITY_BOTTOM_EDGE_CLASS_MAP: Record<SignalColorVariant, string> =
  {
    accent: 'bg-gradient-to-t from-accent-10/30 via-accent-9/14 to-transparent',
    error: 'bg-gradient-to-t from-error-10/34 via-error-9/16 to-transparent',
    warn: 'bg-gradient-to-t from-warning-10/34 via-warning-9/16 to-transparent',
    success:
      'bg-gradient-to-t from-success-10/30 via-success-9/14 to-transparent',
    neutral:
      'bg-gradient-to-t from-neutral-10/24 via-neutral-9/12 to-transparent',
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
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const params = useParams<{ lang: string; id: string; tab?: string }>();
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const locale = useLocale();
  const dateFnsLocale = React.useMemo(
    () => resolveDateFnsLocale(locale),
    [locale],
  );
  const createdAtDate = React.useMemo(() => {
    if (!createdAt) return null;
    const parsed = new Date(createdAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [createdAt]);
  const normalizedMessagesCount = React.useMemo(() => {
    const parsed =
      typeof messages === 'number'
        ? messages
        : Number.parseFloat(`${messages}`);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.trunc(parsed);
  }, [messages]);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const { reduceMotion, parallaxY } = useScrollParallax({
    rate: 0.12,
    maxShiftPx: 20,
  });
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
      variant: 'surface',
      colorVariant: typeColorVariant,
    };
    if (!priorityMeta) return [typeBadge];
    const priorityKey = `priorities.${priorityMeta.priority}`;
    const priorityLabel = t.has(priorityKey as never)
      ? t(priorityKey as never)
      : priorityMeta.priority;
    const priorityBadge: BadgeItem = {
      label: priorityLabel,
      variant: 'outline',
      colorVariant: priorityColorVariant,
    };
    return [typeBadge, priorityBadge];
  }, [priorityMeta, t, typeLabel, typeColorVariant, priorityColorVariant]);

  const tagList: BadgeItem[] = tags.map((tag) => {
    const translationKey = `tagLabels.${tag}`;
    const displayLabel =
      (COHERENCE_TAGS as readonly string[]).includes(tag) &&
      t.has(translationKey as never)
        ? t(translationKey as never)
        : tag;
    return {
      label: `#${displayLabel}`,
      variant: 'outline',
      colorVariant: 'neutral',
      className: 'rounded-full',
      style: {
        borderColor:
          'color-mix(in srgb, var(--space-accent) 42%, var(--color-neutral-8) 58%)',
        backgroundColor:
          'color-mix(in srgb, var(--space-accent) 12%, transparent)',
        color: 'color-mix(in srgb, var(--space-accent) 78%, white 22%)',
      },
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

  const handleArchive = React.useCallback(async (): Promise<boolean> => {
    if (!slug || isDeleting) return false;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await updateCoherenceBySlug({ slug, archived: true });
      try {
        await refresh();
      } catch (refreshErr) {
        console.warn('Signal archived but list refresh failed:', refreshErr);
      }
      return true;
    } catch (error) {
      console.warn('Could not archive signal:', error);
      setDeleteError(t('errorOhSnap'));
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [slug, isDeleting, refresh, t, updateCoherenceBySlug]);

  const stopCardActivationKey = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
        }
        e.stopPropagation();
      }
    },
    [],
  );

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
      <CardHeader className="relative h-[104px] shrink-0 overflow-hidden p-0 isolate">
        <Skeleton
          className="h-full min-w-full"
          width="100%"
          height="104px"
          loading={isLoading}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-x-[-2%] top-[-24%] h-[152%] will-change-transform"
              style={
                reduceMotion
                  ? undefined
                  : { transform: `translate3d(0, ${parallaxY}px, 0)` }
              }
            >
              <Image
                width={640}
                height={104}
                className="h-full w-full object-cover"
                src={leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                alt=""
              />
              <div
                className={cn(
                  'absolute inset-0 pointer-events-none',
                  HERO_PRIORITY_WASH_CLASS_MAP[priorityColorVariant],
                )}
                aria-hidden
              />
              <div
                className={cn(
                  'pointer-events-none absolute inset-0',
                  HERO_PRIORITY_SPOTLIGHT_CLASS_MAP[priorityColorVariant],
                )}
                aria-hidden
              />
              <div
                className={cn(
                  'absolute inset-0 pointer-events-none',
                  HERO_PRIORITY_VIGNETTE_CLASS_MAP[priorityColorVariant],
                )}
                aria-hidden
              />
              <div
                className={cn(
                  'pointer-events-none absolute inset-x-0 bottom-0 h-20',
                  HERO_PRIORITY_BOTTOM_EDGE_CLASS_MAP[priorityColorVariant],
                )}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent"
                aria-hidden
              />
            </div>
          </div>
        </Skeleton>
      </CardHeader>
      <CardContent className="relative flex min-h-0 flex-1 flex-col gap-0 p-0">
        {isCreator && slug ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isLoading}
              aria-label={tSignalCard('editMenu')}
              title={tSignalCard('editMenu')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!params.lang || !params.id || !slug) return;
                const tab = params.tab ?? 'coherence';
                router.push(
                  `/${params.lang}/dho/${params.id}/${tab}/edit-signal/${slug}`,
                );
              }}
              onKeyDown={stopCardActivationKey}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isLoading}
              aria-label={t('archiveConversation')}
              title={t('archiveConversation')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeleteOpen(true);
              }}
              onKeyDown={stopCardActivationKey}
            >
              <Archive className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ) : null}
        <div className="relative flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2 pr-20 text-1 text-muted-foreground">
            {metaBadges.length > 0 ? (
              <BadgesList isLoading={isLoading} badges={metaBadges} />
            ) : null}
          </div>

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

          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-1 text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              <ClockIcon
                className="h-3.5 w-3.5 shrink-0 opacity-70"
                aria-hidden
              />
              {createdAtDate
                ? formatDistanceToNowStrict(createdAtDate, {
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
              <span>
                {t('messageCount', { count: normalizedMessagesCount })}
              </span>
            </Badge>
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
                    e.preventDefault();
                    e.stopPropagation();
                    setDetailsOpen(true);
                  }}
                  onKeyDown={stopCardActivationKey}
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
            <div className="mt-auto pt-1">
              <BadgesList
                isLoading={isLoading}
                badges={tagList ?? []}
                className="content-start"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex min-h-[3.5rem] shrink-0 flex-col justify-center border-t border-border px-4 py-2">
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
        <AlertDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (isDeleting) return;
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
              <AlertDialogTitle>{t('archiveConversation')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('archiveConfirm')}
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
                <Button
                  variant="outline"
                  colorVariant="neutral"
                  disabled={isDeleting}
                  onKeyDown={stopCardActivationKey}
                >
                  {t('noLeave')}
                </Button>
              </AlertDialogCancel>
              <Button
                type="button"
                colorVariant="accent"
                disabled={isDeleting}
                onClick={async (e) => {
                  e.stopPropagation();
                  const archived = await handleArchive();
                  if (archived) setDeleteOpen(false);
                }}
                onKeyDown={stopCardActivationKey}
              >
                {t('yesArchive')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
