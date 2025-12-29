import {
  BadgeItem,
  BadgeProps,
  BadgesList,
  Button,
  Card,
  CardContent,
  CardTitle,
  Skeleton,
} from '@hypha-platform/ui';
import { Coherence } from '../types';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

type SignalCardProps = { isLoading: boolean };

export const SignalCard: React.FC<SignalCardProps & Coherence> = ({
  isLoading,
  title,
  description,
  label,
  labelType,
}) => {
  const badges: BadgeItem[] = [
    {
      label,
      variant: 'solid',
      colorVariant: (() => {
        switch (labelType) {
          case 'opportunity':
            return 'accent';
          case 'tensions':
            return 'warn';
          default:
            return 'accent';
        }
      })(),
    },
  ];
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
          <Button variant="outline" colorVariant="accent">
            <CheckIcon />
            Worth Conversation
          </Button>
          <Button
            variant="outline"
            colorVariant="neutral"
            className="bg-transparent text-neutral-11"
          >
            <Cross2Icon />
            Not Relevant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
