import {
  BadgeItem,
  BadgesList,
  Card,
  CardContent,
  CardTitle,
  Skeleton,
} from '@hypha-platform/ui';
import { Coherence } from '../types';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';

type SignalCardProps = { isLoading: boolean };

export const SignalCard: React.FC<SignalCardProps & Coherence> = ({
  isLoading,
  title,
  description,
  label,
}) => {
  const badges: BadgeItem[] = [{ label }];
  return (
    <Card className="h-full w-full space-y-5 pt-5">
      <CardContent className="relative space-y-4">
        <div className="flex flex-col items-start space-y-2">
          <BadgesList isLoading={isLoading} badges={badges ?? []} />
          <Skeleton
            className="min-w-full"
            width="120px"
            height="18px"
            loading={isLoading}
          >
            <CardTitle>{title}</CardTitle>
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
      </CardContent>
    </Card>
  );
};
