'use client';

import {
  Coherence,
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
  Skeleton,
} from '@hypha-platform/ui';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import React from 'react';

type SignalCardProps = { isLoading: boolean; refresh: () => Promise<void> };

export const SignalCard: React.FC<SignalCardProps & Coherence> = ({
  isLoading,
  title,
  description,
  type,
  slug,
  refresh,
}) => {
  const { jwt: authToken } = useJwt();
  const { updateCoherenceBySlug, isUpdatingCoherence } =
    useCoherenceMutationsWeb2Rsc(authToken);

  const badges: BadgeItem[] = [
    {
      label: type,
      variant: 'solid',
      colorVariant: (() => {
        switch (type) {
          case 'Opportunity':
            return 'accent';
          case 'Tension':
            return 'warn';
          default:
            return 'accent';
        }
      })(),
    },
  ];

  const allowConversation = React.useCallback(async () => {
    console.log('Start Conversation');
    //TODO
    await updateCoherenceBySlug({ slug, status: 'conversation' });
    await refresh();
  }, [updateCoherenceBySlug, slug, refresh]);
  const declineConversation = async () => {
    console.log('Not Relevant');
    //TODO
  };

  return (
    <Card className="h-full w-full space-y-5 pt-5">
      <CardContent className="relative space-y-4">
        <div className="flex flex-col items-start space-y-2">
          {badges?.length > 0 && (
            <BadgesList isLoading={isLoading} badges={badges ?? []} />
          )}
          <Skeleton
            className="min-w-full"
            width="120px"
            height="18px"
            loading={isLoading}
          >
            <CardTitle className="leading-5">{title}</CardTitle>
          </Skeleton>
        </div>
        <div className="flex flex-grow text-1 text-neutral-11">
          <Skeleton
            className="min-w-full"
            width="200px"
            height="48px"
            loading={isLoading}
          >
            <div className="line-clamp-3 w-full">
              {stripDescription(
                stripMarkdown(description, {
                  orderedListMarkers: false,
                  unorderedListMarkers: false,
                }),
              )}
            </div>
          </Skeleton>
        </div>
        <div className="flex flex-grow text-1 text-neutral-11 gap-3">
          <Button
            variant="outline"
            colorVariant="accent"
            disabled={isUpdatingCoherence}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              allowConversation();
            }}
          >
            <CheckIcon />
            Start Conversation
          </Button>
          <Button
            variant="outline"
            colorVariant="neutral"
            disabled={isUpdatingCoherence}
            className="bg-transparent text-neutral-11"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              declineConversation();
            }}
          >
            <Cross2Icon />
            Not Relevant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
