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
  usePersonById,
  useSpaceBySlug,
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
  type LucideReactIcon,
} from '@hypha-platform/ui';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChatBubbleIcon, ClockIcon } from '@radix-ui/react-icons';
import React from 'react';
import type { BadgeProps } from '@hypha-platform/ui';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, Pencil, Sparkles, Workflow } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import { useScrollParallax } from '../../common/use-scroll-parallax';
import { useParams, useRouter } from 'next/navigation';
import { PersonAvatar } from '../../people/components/person-avatar';

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
  accent: 'bg-accent-9/12',
  error: 'bg-error-9/14',
  warn: 'bg-warning-9/13',
  success: 'bg-success-9/12',
  neutral: 'bg-neutral-9/10',
};

const HERO_PRIORITY_SPOTLIGHT_CLASS_MAP: Record<SignalColorVariant, string> = {
  accent: 'bg-gradient-to-br from-accent-9/24 via-accent-8/11 to-transparent',
  error: 'bg-gradient-to-br from-error-9/26 via-error-8/12 to-transparent',
  warn: 'bg-gradient-to-br from-warning-9/26 via-warning-8/12 to-transparent',
  success:
    'bg-gradient-to-br from-success-9/24 via-success-8/11 to-transparent',
  neutral:
    'bg-gradient-to-br from-neutral-9/22 via-neutral-8/10 to-transparent',
};

const HERO_PRIORITY_VIGNETTE_CLASS_MAP: Record<SignalColorVariant, string> = {
  accent: 'bg-gradient-to-t from-accent-10/20 via-accent-9/10 to-transparent',
  error: 'bg-gradient-to-t from-error-10/22 via-error-9/10 to-transparent',
  warn: 'bg-gradient-to-t from-warning-10/22 via-warning-9/10 to-transparent',
  success:
    'bg-gradient-to-t from-success-10/20 via-success-9/10 to-transparent',
  neutral: 'bg-gradient-to-t from-neutral-10/16 via-neutral-9/8 to-transparent',
};

const HERO_PRIORITY_BOTTOM_EDGE_CLASS_MAP: Record<SignalColorVariant, string> =
  {
    accent: 'bg-gradient-to-t from-accent-10/24 via-accent-9/10 to-transparent',
    error: 'bg-gradient-to-t from-error-10/26 via-error-9/11 to-transparent',
    warn: 'bg-gradient-to-t from-warning-10/26 via-warning-9/11 to-transparent',
    success:
      'bg-gradient-to-t from-success-10/24 via-success-9/10 to-transparent',
    neutral:
      'bg-gradient-to-t from-neutral-10/18 via-neutral-9/9 to-transparent',
  };

const BADGE_ICON_COLOR_CLASS_MAP: Record<SignalColorVariant, string> = {
  accent: 'text-accent-10',
  error: 'text-error-10',
  warn: 'text-warning-10',
  success: 'text-success-10',
  neutral: 'text-neutral-11',
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
  const { person: creatorPerson, isLoading: isCreatorPersonLoading } =
    usePersonById({ id: creatorId });
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
  const createdAtRelative = React.useMemo(
    () =>
      createdAtDate
        ? formatDistanceToNowStrict(createdAtDate, {
            addSuffix: true,
            locale: dateFnsLocale,
          })
        : '',
    [createdAtDate, dateFnsLocale],
  );
  const normalizedMessagesCount = React.useMemo(() => {
    const parsed =
      typeof messages === 'number'
        ? messages
        : Number.parseFloat(`${messages}`);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.trunc(parsed);
  }, [messages]);
  const hasAiSignalTag = React.useMemo(
    () => tags.some((tag) => tag.trim().toLowerCase() === 'ai signal'),
    [tags],
  );
  const relaySourceSpaceSlug = React.useMemo(() => {
    const match = description.match(
      /Relayed from ecosystem space:\s*([a-z0-9-]+)/i,
    );
    return match?.[1] ?? null;
  }, [description]);
  const { space: relaySourceSpace, isLoading: isRelaySourceSpaceLoading } =
    useSpaceBySlug(relaySourceSpaceSlug ?? '');
  const isBackgroundJobSignal = React.useMemo(
    () =>
      /recent space-memory activity indicates a coordination opportunity/i.test(
        description,
      ) || /high-signal .* update/i.test(title),
    [description, title],
  );
  const creatorKind = React.useMemo<
    'person' | 'aiRole' | 'backgroundJob' | 'relay'
  >(() => {
    if (relaySourceSpaceSlug) return 'relay';
    if (isBackgroundJobSignal) return 'backgroundJob';
    if (hasAiSignalTag) return 'aiRole';
    return 'person';
  }, [relaySourceSpaceSlug, isBackgroundJobSignal, hasAiSignalTag]);
  const creatorLabel = React.useMemo(() => {
    if (creatorKind === 'relay') {
      return relaySourceSpace?.title || relaySourceSpaceSlug || 'Relay space';
    }
    if (creatorKind === 'backgroundJob') return 'Background job';
    if (creatorKind === 'aiRole') return 'AI role';
    return (
      creatorPerson?.nickname ||
      [creatorPerson?.name, creatorPerson?.surname].filter(Boolean).join(' ') ||
      'Member'
    );
  }, [creatorKind, creatorPerson, relaySourceSpace, relaySourceSpaceSlug]);

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
      icon: (coherenceType?.icon ?? 'ArrowUpRight') as LucideReactIcon,
      iconClassName: BADGE_ICON_COLOR_CLASS_MAP[typeColorVariant],
      label: typeLabel,
      variant: 'surface',
      colorVariant: typeColorVariant,
      className:
        'rounded-md border-none shadow-none font-medium text-foreground',
    };
    if (!priorityMeta) return [typeBadge];
    const priorityKey = `priorities.${priorityMeta.priority}`;
    const priorityLabel = t.has(priorityKey as never)
      ? t(priorityKey as never)
      : priorityMeta.priority;
    const priorityBadge: BadgeItem = {
      icon: (priorityMeta.icon ?? 'CircleDot') as LucideReactIcon,
      iconClassName: BADGE_ICON_COLOR_CLASS_MAP[priorityColorVariant],
      label: priorityLabel,
      variant: 'surface',
      colorVariant: priorityColorVariant,
      className:
        'rounded-md border-none shadow-none font-medium text-foreground',
    };
    return [typeBadge, priorityBadge];
  }, [
    coherenceType?.icon,
    priorityMeta,
    priorityColorVariant,
    t,
    typeLabel,
    typeColorVariant,
  ]);

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
        'group flex h-full w-full min-h-0 flex-col overflow-hidden rounded-xl border-border/70 bg-card pt-0 shadow-sm',
        'transition-[border-color,box-shadow] duration-200 ease-out',
        'hover:border-accent-8/75 hover:shadow-md',
        'focus-within:border-accent-8/75 focus-within:shadow-md',
        className,
      )}
    >
      <CardHeader className="relative h-[96px] shrink-0 overflow-hidden p-0 isolate">
        <Skeleton
          className="h-full min-w-full"
          width="100%"
          height="96px"
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
                height={96}
                className="block h-full w-full object-cover"
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
                  'pointer-events-none absolute inset-0',
                  HERO_PRIORITY_BOTTOM_EDGE_CLASS_MAP[priorityColorVariant],
                )}
                aria-hidden
              />
            </div>
          </div>
        </Skeleton>
      </CardHeader>
      <CardContent className="relative flex min-h-0 flex-1 flex-col gap-0 p-0">
        <div className="relative flex min-h-0 flex-1 flex-col gap-2.5 px-3 pb-2.5 pt-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Skeleton
                className="min-w-0"
                width="100%"
                height="20px"
                loading={isLoading}
              >
                <CardTitle className="line-clamp-2 text-base font-semibold leading-snug">
                  {title}
                </CardTitle>
              </Skeleton>
            </div>
            {isCreator && slug ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-1 text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {creatorKind === 'person' || creatorKind === 'relay' ? (
                  <PersonAvatar
                    size="sm"
                    shape="circle"
                    avatarSrc={
                      creatorKind === 'person'
                        ? creatorPerson?.avatarUrl ?? undefined
                        : relaySourceSpace?.logoUrl ?? undefined
                    }
                    userName={creatorLabel}
                    isLoading={
                      creatorKind === 'person'
                        ? isCreatorPersonLoading
                        : isRelaySourceSpaceLoading
                    }
                  />
                ) : (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent-8/70 bg-accent-3/25 text-accent-11">
                    {creatorKind === 'backgroundJob' ? (
                      <Workflow className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                )}
                <span className="max-w-[11rem] truncate text-neutral-10">
                  {creatorLabel}
                </span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <ClockIcon
                  className="h-3.5 w-3.5 shrink-0 text-neutral-10"
                  aria-hidden
                />
                {createdAtRelative}
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ChatBubbleIcon
                  className="h-3.5 w-3.5 shrink-0 text-accent-10"
                  aria-hidden
                />
                <span className="tabular-nums">{normalizedMessagesCount}</span>
              </span>
            </div>
            {metaBadges.length > 0 ? (
              <div className="ml-auto flex shrink-0 items-center">
                <BadgesList
                  isLoading={isLoading}
                  badges={metaBadges}
                  className="gap-1"
                />
              </div>
            ) : null}
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
                className="text-2 leading-snug text-neutral-11 line-clamp-2"
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
            <div className="mt-auto pt-0.5">
              <BadgesList
                isLoading={isLoading}
                badges={tagList ?? []}
                className="content-start"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex min-h-[2.75rem] shrink-0 flex-col justify-center bg-muted/10 px-3 py-1.5">
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
                  size="sm"
                  className="h-8 w-full bg-transparent hover:bg-accent-3/30"
                >
                  {t('unarchive')}
                </Button>
              </ConfirmDialog>
            </div>
          ) : (
            <Button
              variant="outline"
              colorVariant="accent"
              size="sm"
              className="h-8 w-full bg-transparent hover:bg-accent-3/30"
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
