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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

type SignalCardProps = {
  isLoading: boolean;
  refresh: () => Promise<void>;
  onOpenConversation?: () => void;
  spaceSlug: string;
  lang: Locale;
  myVote?: -1 | 0 | 1;
  onVoteChange?: (next: -1 | 0 | 1) => void;
  onVotesSynced?: () => void | Promise<void>;
  isVoting?: boolean;
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
  id,
  creatorId,
  voteScore = 0,
  refresh,
  onOpenConversation,
  spaceSlug,
  lang,
  myVote = 0,
  onVoteChange,
  onVotesSynced,
  isVoting,
  className,
}) => {
  const { jwt: authToken } = useJwt();
  const { person } = useMe();
  const { updateCoherenceBySlug, deleteCoherenceBySlug, setCoherenceVote } =
    useCoherenceMutationsWeb2Rsc(authToken);
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const locale = useLocale();
  const dateFnsLocale = React.useMemo(
    () => resolveDateFnsLocale(locale),
    [locale],
  );

  const [expanded, setExpanded] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [voteError, setVoteError] = React.useState<string | null>(null);
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

  const handleUnarchive = React.useCallback(async () => {
    if (!slug) return;
    try {
      await updateCoherenceBySlug({ slug, archived: false });
      await refresh();
    } catch (error) {
      console.warn('Could not unarchive conversation:', error);
    }
  }, [slug, refresh, updateCoherenceBySlug]);

  const handleVote = React.useCallback(
    async (next: -1 | 0 | 1) => {
      if (!slug) return;
      setVoteError(null);
      try {
        await setCoherenceVote({ slug, value: next });
        onVoteChange?.(next);
        await refresh();
        await onVotesSynced?.();
      } catch (error) {
        console.warn('Could not vote:', error);
        const msg = error instanceof Error ? error.message : String(error);
        setVoteError(msg || tSignalCard('voteFailed'));
      }
    },
    [slug, setCoherenceVote, onVoteChange, onVotesSynced, refresh, tSignalCard],
  );

  const handleDelete = React.useCallback(async () => {
    if (!slug) return;
    try {
      await deleteCoherenceBySlug({ slug });
      await refresh();
    } catch (error) {
      console.warn('Could not delete signal:', error);
    }
  }, [slug, deleteCoherenceBySlug, refresh]);

  const editHref =
    slug != null && slug !== ''
      ? `/${lang}/dho/${spaceSlug}/coherence/edit/${slug}`
      : undefined;

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
        <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            {/* Column so type tag(s) stay on row 1 and clock/time always on row 2 */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {badges?.length > 0 ? (
                <BadgesList isLoading={isLoading} badges={badges ?? []} />
              ) : null}
              <span className="inline-flex items-center gap-1 text-1 text-muted-foreground">
                <ClockIcon
                  className="h-3.5 w-3.5 shrink-0 opacity-70"
                  aria-hidden
                />
                <ClockDistance createdAt={createdAt} locale={dateFnsLocale} />
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div
                className="flex items-center rounded-lg border border-border/70 bg-background/80 p-0.5"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant={myVote === 1 ? 'accent' : 'neutral'}
                  size="sm"
                  className="h-8 gap-1 px-2"
                  disabled={isLoading || isVoting || archived}
                  aria-pressed={myVote === 1}
                  aria-label={tSignalCard('voteUp')}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    void handleVote(myVote === 1 ? 0 : 1);
                  }}
                >
                  <TrendingUp className="h-4 w-4" aria-hidden />
                  <span className="tabular-nums text-1 font-medium">
                    {voteScore}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant={myVote === -1 ? 'accent' : 'neutral'}
                  size="sm"
                  className="h-8 px-2"
                  disabled={isLoading || isVoting || archived}
                  aria-pressed={myVote === -1}
                  aria-label={tSignalCard('voteDown')}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    void handleVote(myVote === -1 ? 0 : -1);
                  }}
                >
                  <TrendingDown className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {isCreator && slug ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        colorVariant="neutral"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={isLoading}
                        aria-label={tSignalCard('signalActions')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[10rem]">
                      {editHref ? (
                        <DropdownMenuItem asChild>
                          <Link
                            href={editHref}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <Pencil className="h-4 w-4" />
                            {t('editSignal')}
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={(e) => {
                          e.preventDefault();
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {tSignalCard('deleteMenu')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {tSignalCard('deleteSignal')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {tSignalCard('deleteConfirm')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
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
                              void handleDelete().then(() =>
                                setDeleteOpen(false),
                              )
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
          </div>
          {voteError ? (
            <p
              role="alert"
              className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-1 text-destructive"
            >
              {voteError}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {priority === 'high' && (
              <span className="inline-flex items-center gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-error-11" />
                {t('highUrgency')}
              </span>
            )}
            {priority === 'medium' && (
              <span className="inline-flex items-center gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-warning-11" />
                {t('mediumUrgency')}
              </span>
            )}
            {priority === 'low' && (
              <span className="inline-flex items-center gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-neutral-11" />
                {t('lowUrgency')}
              </span>
            )}
          </div>

          <Skeleton
            className="min-w-full"
            width="120px"
            height="22px"
            loading={isLoading}
          >
            <CardTitle className="text-base font-semibold leading-snug">
              {title}
            </CardTitle>
          </Skeleton>

          <Skeleton
            className="min-w-full"
            width="100%"
            height="72px"
            loading={isLoading}
          >
            <div
              className={cn(
                'text-1 leading-relaxed text-neutral-11',
                !expanded && 'line-clamp-4',
              )}
            >
              {plainDescription}
            </div>
          </Skeleton>

          {plainDescription.length > 140 ? (
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              size="sm"
              className="-mt-1 h-auto self-start px-1 py-0 text-1 font-medium text-accent-11"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? (
                <>
                  <ChevronUp className="mr-1 inline h-3.5 w-3.5" />
                  {tSignalCard('showLess')}
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 inline h-3.5 w-3.5" />
                  {tSignalCard('readMore')}
                </>
              )}
            </Button>
          ) : null}

          {tagList?.length > 0 ? (
            <BadgesList isLoading={isLoading} badges={tagList ?? []} />
          ) : null}

          <div className="flex flex-row gap-1 text-1 text-neutral-11">
            <Skeleton loading={isLoading} height="16px" width="120px">
              <span>{t('mentions', { count: messages })}</span>
            </Skeleton>
          </div>
        </div>

        {/* Fixed-height footer band so action row aligns across the grid when cards stretch */}
        <div className="mt-auto flex min-h-[4.75rem] shrink-0 flex-col justify-center border-t border-border px-4 py-3">
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
              disabled={isLoading || !roomId}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenConversation?.();
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

function ClockDistance({
  createdAt,
  locale,
}: {
  createdAt: Date | string;
  locale: ReturnType<typeof resolveDateFnsLocale>;
}) {
  return (
    <>
      {createdAt
        ? formatDistanceToNow(new Date(createdAt), {
            addSuffix: true,
            locale,
          })
        : ''}
    </>
  );
}
