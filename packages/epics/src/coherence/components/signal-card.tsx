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
  Separator,
  Skeleton,
} from '@hypha-platform/ui';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { formatDistanceToNow } from 'date-fns';
import {
  ChatBubbleIcon,
  UpdateIcon,
  ClockIcon,
  DotFilledIcon,
} from '@radix-ui/react-icons';
import React from 'react';
import type { BadgeProps } from '@hypha-platform/ui';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { useParams } from 'next/navigation';
import { MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

type SignalCardProps = {
  isLoading: boolean;
  refresh: () => Promise<void>;
  onOpenConversation?: () => void;
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
}) => {
  const { lang, id: spaceSlug } = useParams<{ lang: Locale; id: string }>();
  const { jwt: authToken } = useJwt();
  const { person } = useMe();
  const { updateCoherenceBySlug, deleteCoherenceBySlug } =
    useCoherenceMutationsWeb2Rsc(authToken);
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const locale = useLocale();
  const dateFnsLocale = React.useMemo(
    () => resolveDateFnsLocale(locale),
    [locale],
  );

  const [deleteOpen, setDeleteOpen] = React.useState(false);
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
      variant: 'solid',
      colorVariant: 'neutral',
    };
  });

  const handleUnarchive = React.useCallback(async () => {
    if (!slug) return;
    try {
      await updateCoherenceBySlug({ slug, archived: false });
      await refresh();
    } catch (error) {
      console.warn('Could not unarchive conversation:', error);
    }
  }, [slug, refresh, updateCoherenceBySlug]);

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
    slug != null && slug !== '' && spaceSlug && lang
      ? `/${lang}/dho/${spaceSlug}/coherence/edit/${slug}`
      : undefined;

  return (
    <Card
      className={cn(
        'h-full w-full space-y-5 rounded-2xl border-border/70 bg-card pt-5 shadow-sm',
        'transition-[border-color,box-shadow] duration-200 ease-out',
        'hover:border-accent-8/75 hover:shadow-md',
        'focus-within:border-accent-8/75 focus-within:shadow-md',
      )}
    >
      <CardContent className="relative space-y-4">
        <div className="flex flex-col items-start space-y-2">
          <div className="flex w-full items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {badges?.length > 0 ? (
                <BadgesList isLoading={isLoading} badges={badges ?? []} />
              ) : null}
              <span className="inline-flex items-center gap-1 text-1 text-muted-foreground">
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
            {isCreator && slug ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      colorVariant="neutral"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0"
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
                            void handleDelete().then(() => setDeleteOpen(false))
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
          <div className="flex flex-row">
            {priority === 'high' && (
              <div className="flex flex-row gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-error-11" />
                {t('highUrgency')}
              </div>
            )}
            {priority === 'medium' && (
              <div className="flex flex-row gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-warning-11" />
                {t('mediumUrgency')}
              </div>
            )}
            {priority === 'low' && (
              <div className="flex flex-row gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-neutral-11" />
                {t('lowUrgency')}
              </div>
            )}
          </div>
          <Skeleton
            className="min-w-full"
            width="120px"
            height="18px"
            loading={isLoading}
          >
            <CardTitle className="leading-5">{title}</CardTitle>
          </Skeleton>
          <div className="flex flex-grow text-1 text-neutral-11">
            <Skeleton
              className="min-w-full"
              width="200px"
              height="48px"
              loading={isLoading}
            >
              <div className="line-clamp-2 w-full">
                {stripDescription(
                  stripMarkdown(description, {
                    orderedListMarkers: false,
                    unorderedListMarkers: false,
                  }),
                )}
              </div>
            </Skeleton>
          </div>
          <div className="flex flex-row gap-1">
            <Skeleton loading={isLoading} height="16px" width="80px">
              <Users size={12} />
              <div className="text-neutral-11 text-1">
                {t('mentions', { count: messages })}
              </div>
            </Skeleton>
          </div>
          <div className="flex flex-row">
            {tagList?.length > 0 && (
              <BadgesList isLoading={isLoading} badges={tagList ?? []} />
            )}
          </div>
        </div>
        <Separator />
        <div className="flex gap-3">
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

          <div className="flex-grow"></div>
          <Button
            variant="ghost"
            colorVariant="neutral"
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <UpdateIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
