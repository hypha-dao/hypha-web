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
import {
  formatRelativeDateShort,
  stripDescription,
  stripMarkdown,
} from '@hypha-platform/ui-utils';
import {
  ChatBubbleIcon,
  UpdateIcon,
  ClockIcon,
  DotFilledIcon,
} from '@radix-ui/react-icons';
import React from 'react';
import { CardButtonColorVariant } from '../../common';
import { Users } from 'lucide-react';

type SignalCardProps = { isLoading: boolean; refresh: () => Promise<void> };

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
  refresh,
}) => {
  const { jwt: authToken } = useJwt();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);

  const coherenceType = React.useMemo(
    () => COHERENCE_TYPE_OPTIONS.find((option) => option.type === type),
    [type],
  );

  const badges: BadgeItem[] = [
    {
      label: type,
      icon: coherenceType?.icon as LucideReactIcon,
      variant: 'outline',
      colorVariant: (coherenceType?.colorVariant ??
        'accent') as CardButtonColorVariant,
    },
  ];

  const tagList: BadgeItem[] = tags.map((tag) => ({
    label: `#${tag}`,
    variant: 'solid',
    colorVariant: 'neutral',
  }));

  const handleUnarchive = React.useCallback(async () => {
    console.log('Unarchive conversation');
    try {
      await updateCoherenceBySlug({ slug, archived: false });
      await refresh();
    } catch (error) {
      console.warn('Could not unarchive conversation:', error);
    }
  }, [slug, refresh]);

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
              {formatRelativeDateShort(createdAt)}
            </div>
          </div>
          <div className="flex flex-row">
            {priority === 'high' && (
              <div className="flex flex-row gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-error-11" />
                High Urgency
              </div>
            )}
            {priority === 'medium' && (
              <div className="flex flex-row gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-warning-11" />
                Medium Urgency
              </div>
            )}
            {priority === 'low' && (
              <div className="flex flex-row gap-1 text-1 text-neutral-11">
                <DotFilledIcon className="h-4 w-4 text-neutral-11" />
                Low Urgency
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
              <div className="text-neutral-11 text-1">{messages} mentions</div>
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
                title="Unarchive Conversation"
                description="Do you really want to unarchive this conversation?"
                customAcceptButtonText="Yes, unarchive"
                customRejectButtonText="No, leave"
                onAcceptClicked={handleUnarchive}
              >
                <Button
                  variant="outline"
                  colorVariant="accent"
                  className="w-full"
                >
                  Unarchive
                </Button>
              </ConfirmDialog>
            </div>
          ) : (
            <Button
              variant="outline"
              colorVariant="accent"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <ChatBubbleIcon />
              Open conversation
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
