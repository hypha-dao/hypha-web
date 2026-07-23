'use client';

import {
  Coherence,
  COHERENCE_PRIORITY_OPTIONS,
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
  Button,
  Card,
  CardContent,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@hypha-platform/ui';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import { SignalTagBadges } from './signal-tag-badges';
import { SignalUpvoteControl } from './signal-upvote-control';
import { priorityLeftBorderClass } from '../utils/signal-priority-styles';
import { signalCardActiveClass } from '../utils/signal-active-styles';
import { useParams, useRouter } from 'next/navigation';
import { useCanManageSignal } from '../hooks/use-can-manage-signal';

type SignalCardProps = {
  isLoading: boolean;
  refresh: () => Promise<void>;
  onOpenConversation?: () => void;
  className?: string;
  leadImage?: string;
  isActive?: boolean;
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
  upvotes,
  refresh,
  onOpenConversation,
  className,
  leadImage: _leadImage,
  isActive = false,
}) => {
  const { jwt: authToken } = useJwt();
  const { person } = useMe();
  const { person: creatorPerson } = usePersonById({ id: creatorId });
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const params = useParams<{ lang: string; id: string; tab?: string }>();
  const { space: currentSpace } = useSpaceBySlug(params.id ?? '');
  const canManageSignal = useCanManageSignal({
    spaceSlug: params.id ?? '',
    web3SpaceId: currentSpace?.web3SpaceId ?? undefined,
  });
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
  const { space: relaySourceSpace } = useSpaceBySlug(
    relaySourceSpaceSlug ?? '',
  );
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
    if (creatorKind === 'backgroundJob') return 'AI Agent';
    if (creatorKind === 'aiRole') return 'AI Agent';
    return (
      [creatorPerson?.name, creatorPerson?.surname].filter(Boolean).join(' ') ||
      'Member'
    );
  }, [creatorKind, creatorPerson, relaySourceSpace, relaySourceSpaceSlug]);

  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [isArchiveMutating, setIsArchiveMutating] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const descriptionClampRef = React.useRef<HTMLParagraphElement>(null);
  const [descriptionTruncated, setDescriptionTruncated] = React.useState(false);
  const isCreator = person?.id === creatorId;
  const creatorDisplayName = React.useMemo(() => {
    if (isCreator) {
      const currentUserName = [person?.name, person?.surname]
        .filter(Boolean)
        .join(' ')
        .trim();
      return currentUserName || 'You';
    }

    if (creatorKind !== 'person') return creatorLabel;

    const resolvedPersonName = [creatorPerson?.name, creatorPerson?.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (resolvedPersonName) return resolvedPersonName;

    const raw = `${creatorId ?? ''}`.trim();
    if (!raw) return creatorLabel;

    if (raw.startsWith('@')) {
      const [localpart] = raw.slice(1).split(':');
      return localpart?.trim() || creatorLabel;
    }

    const [left] = raw.split(':');
    const fallback = left?.trim() || raw;
    if (/^\d+$/.test(fallback)) return creatorLabel;
    return fallback;
  }, [
    creatorId,
    creatorKind,
    creatorLabel,
    creatorPerson?.name,
    creatorPerson?.surname,
    isCreator,
    person?.name,
    person?.surname,
  ]);

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

  const priorityLabel = React.useMemo(() => {
    if (!priorityMeta) return t('priorities.medium');
    const priorityKey = `priorities.${priorityMeta.priority}`;
    return t.has(priorityKey as never)
      ? t(priorityKey as never)
      : priorityMeta.priority;
  }, [priorityMeta, t]);

  const createdAtShort = React.useMemo(
    () =>
      createdAtDate
        ? formatDistanceToNowStrict(createdAtDate, {
            addSuffix: false,
            locale: dateFnsLocale,
          })
        : '',
    [createdAtDate, dateFnsLocale],
  );

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

  const handleToggleArchive = React.useCallback(async (): Promise<boolean> => {
    if (!slug || isArchiveMutating) return false;
    setArchiveError(null);
    setIsArchiveMutating(true);
    try {
      await updateCoherenceBySlug({ slug, archived: !archived });
      try {
        await refresh();
      } catch (refreshErr) {
        console.warn(
          'Signal archive state updated but refresh failed:',
          refreshErr,
        );
      }
      return true;
    } catch (error) {
      console.warn(
        archived ? 'Could not unarchive signal:' : 'Could not archive signal:',
        error,
      );
      setArchiveError(t('errorOhSnap'));
      return false;
    } finally {
      setIsArchiveMutating(false);
    }
  }, [archived, slug, isArchiveMutating, refresh, t, updateCoherenceBySlug]);

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
        'group relative flex h-full w-full min-h-0 flex-col rounded-lg border-border/70 bg-background-2 shadow-none',
        'transition-[border-color,background-color] duration-200 ease-out',
        !isActive && 'hover:border-border hover:bg-muted/15',
        !isActive && 'focus-within:border-border focus-within:bg-muted/15',
        signalCardActiveClass(isActive),
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-0.5 rounded-l-lg opacity-80',
          priorityLeftBorderClass(priority),
        )}
        title={priorityLabel}
        aria-label={priorityLabel}
      />
      <CardContent className="relative flex flex-1 flex-col gap-0 p-0">
        <div className="relative flex flex-1 flex-col gap-2.5 px-3.5 pb-3 pt-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Skeleton
                  className="min-w-0"
                  width="100%"
                  height="20px"
                  loading={isLoading}
                >
                  <CardTitle className="line-clamp-2 text-3 font-medium leading-snug tracking-tight">
                    {title}
                  </CardTitle>
                </Skeleton>
              </div>
              {canManageSignal && slug ? (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
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
                    disabled={isLoading || isArchiveMutating}
                    aria-label={
                      archived
                        ? t('unarchiveConversation')
                        : t('archiveConversation')
                    }
                    title={
                      archived
                        ? t('unarchiveConversation')
                        : t('archiveConversation')
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setArchiveDialogOpen(true);
                    }}
                    onKeyDown={stopCardActivationKey}
                  >
                    {archived ? (
                      <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="truncate text-1 text-muted-foreground">
              <span>{typeLabel}</span>
              <span className="mx-1.5 text-border" aria-hidden>
                ·
              </span>
              <span>{priorityLabel}</span>
              {creatorDisplayName ? (
                <>
                  <span className="mx-1.5 text-border" aria-hidden>
                    ·
                  </span>
                  <span className="truncate">{creatorDisplayName}</span>
                </>
              ) : null}
              {createdAtShort ? (
                <>
                  <span className="mx-1.5 text-border" aria-hidden>
                    ·
                  </span>
                  <span className="tabular-nums">{createdAtShort}</span>
                </>
              ) : null}
              {normalizedMessagesCount > 0 ? (
                <>
                  <span className="mx-1.5 text-border" aria-hidden>
                    ·
                  </span>
                  <span
                    className="tabular-nums"
                    aria-label={t('messageCount', {
                      count: normalizedMessagesCount,
                    })}
                  >
                    {normalizedMessagesCount}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <Skeleton
            className="min-w-full"
            width="100%"
            height="40px"
            loading={isLoading}
          >
            <div className="flex min-h-[2.5rem] flex-col gap-0.5">
              <p
                ref={descriptionClampRef}
                className="line-clamp-2 text-2 leading-snug text-muted-foreground"
              >
                {plainDescription}
              </p>
              {descriptionTruncated ? (
                <button
                  type="button"
                  className="w-fit text-left text-1 text-muted-foreground/80 underline-offset-2 opacity-0 transition-opacity duration-150 hover:text-foreground hover:underline group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
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
                'flex max-h-[min(560px,85dvh)] flex-col gap-0 overflow-hidden border-border/70 bg-background-2 p-0 shadow-md sm:max-w-lg',
                'border-l-[3px] border-l-[var(--space-accent)]',
              )}
              style={spaceAccentPortalStyle}
              onClick={(e) => e.stopPropagation()}
              onPointerDownOutside={(e) => e.stopPropagation()}
            >
              <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 px-6 pb-4 pt-6">
                <DialogTitle className="pr-10 text-balance text-4 font-medium leading-snug tracking-tight">
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
                <p className="whitespace-pre-wrap text-2 leading-relaxed text-foreground">
                  {plainDescription}
                </p>
              </div>
              <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4">
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

          {tags?.length > 0 ? (
            <SignalTagBadges
              tags={tags}
              maxVisible={2}
              showHashPrefix={false}
              className="content-start gap-1"
            />
          ) : null}
        </div>

        <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-border/50 px-3.5 py-2">
          <SignalUpvoteControl
            slug={slug}
            upvotes={upvotes}
            refresh={refresh}
            compact
            disabled={isLoading || Boolean(archived)}
          />
          {onOpenConversation && !archived ? (
            <Button
              variant="ghost"
              colorVariant="neutral"
              size="sm"
              className="h-7 min-w-0 flex-1 justify-start px-2 text-muted-foreground hover:text-foreground"
              disabled={isLoading || !roomId}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenConversation();
              }}
              title={!roomId ? tSignalCard('noConversationRoom') : undefined}
            >
              <ChatBubbleIcon />
              <span className="truncate text-1">{t('openConversation')}</span>
            </Button>
          ) : null}
        </div>
        <AlertDialog
          open={archiveDialogOpen}
          onOpenChange={(open) => {
            if (isArchiveMutating) return;
            setArchiveDialogOpen(open);
            if (!open) setArchiveError(null);
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
                {archived
                  ? t('unarchiveConversation')
                  : t('archiveConversation')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {archived ? t('unarchiveConfirm') : t('archiveConfirm')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {archiveError ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {archiveError}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button
                  variant="outline"
                  colorVariant="neutral"
                  disabled={isArchiveMutating}
                  onKeyDown={stopCardActivationKey}
                >
                  {t('noLeave')}
                </Button>
              </AlertDialogCancel>
              <Button
                type="button"
                colorVariant="accent"
                disabled={isArchiveMutating}
                onClick={async (e) => {
                  e.stopPropagation();
                  const updated = await handleToggleArchive();
                  if (updated) setArchiveDialogOpen(false);
                }}
                onKeyDown={stopCardActivationKey}
              >
                {archived ? t('yesUnarchive') : t('yesArchive')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
