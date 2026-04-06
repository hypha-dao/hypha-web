'use client';

import {
  Coherence,
  COHERENCE_TYPE_OPTIONS,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
} from '@hypha-platform/core/client';
import {
  BadgeItem,
  BadgesList,
  Button,
  Card,
  CardContent,
  CardTitle,
  ConfirmDialog,
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
import { useLocale, useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { resolveDateFnsLocale } from '../date-fns-locale';

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
  refresh,
  onOpenConversation,
}) => {
  const { jwt: authToken } = useJwt();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const locale = useLocale();
  const dateFnsLocale = React.useMemo(
    () => resolveDateFnsLocale(locale),
    [locale],
  );

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

  const tagList: BadgeItem[] = tags.map((tag) => ({
    label: `#${tag}`,
    variant: 'solid',
    colorVariant: 'neutral',
  }));

  const handleUnarchive = React.useCallback(async () => {
    if (!slug) return;
    try {
      await updateCoherenceBySlug({ slug, archived: false });
      await refresh();
    } catch (error) {
      console.warn('Could not unarchive conversation:', error);
    }
  }, [slug, refresh, updateCoherenceBySlug]);

  return (
    <Card className="h-full w-full space-y-5 pt-5">
      <CardContent className="relative space-y-4">
        <div className="flex flex-col items-start space-y-2">
          <div className="flex flex-row gap-3 w-full">
            {badges?.length > 0 && (
              <BadgesList isLoading={isLoading} badges={badges ?? []} />
            )}
            <div className="flex-grow"></div>
            <div className="flex flex-row gap-1 text-1 text-neutral-11">
              <ClockIcon className="h-4 w-4" />
              {createdAt
                ? formatDistanceToNow(new Date(createdAt), {
                    addSuffix: true,
                    locale: dateFnsLocale,
                  })
                : ''}
            </div>
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
