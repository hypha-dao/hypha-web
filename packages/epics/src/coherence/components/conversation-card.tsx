import { Card, CardContent, CardTitle, Skeleton } from '@hypha-platform/ui';
import { Coherence } from '../types';
import { PersonLabel } from '../../people/components/person-label';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { ChatBubbleIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { usePersonByWeb3Address } from '../../governance';

type ConversationCardProps = { isLoading: boolean };

export const ConversationCard: React.FC<ConversationCardProps & Coherence> = ({
  isLoading,
  title,
  description,
  creatorAddress,
}) => {
  const { isLoading: isPersonLoading, person: creator } =
    usePersonByWeb3Address(creatorAddress ?? '0x0');
  const views = 59; //TODO: compute number of conversation view
  const messages = 16; //TODO: compute number of conversation messages
  return (
    <Card className="h-full w-full space-y-5 pt-5">
      <CardContent className="relative space-y-4">
        <div className="flex flex-col items-start space-y-2">
          <Skeleton
            className="min-w-full"
            width="120px"
            height="18px"
            loading={isPersonLoading}
          >
            {creator && <PersonLabel isLoading={isLoading} creator={creator} />}
          </Skeleton>
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
        <div className="flex gap-2 text-xs items-center">
          <div className="flex flex-col gap-y-2 gap-x-4 flex-wrap">
            <div className="flex flex-row gap-y-2 gap-x-4 flex-wrap">
              <div className="flex flex-row">
                <Skeleton loading={isLoading} height="16px" width="80px">
                  <div className="font-bold text-1">
                    <EyeOpenIcon />
                  </div>
                  <div className="text-neutral-11 ml-1 text-1">{views}</div>
                </Skeleton>
              </div>
              <div className="flex flex-row">
                <Skeleton loading={isLoading} height="16px" width="80px">
                  <div className="font-bold text-1">
                    <ChatBubbleIcon />
                  </div>
                  <div className="text-neutral-11 ml-1 text-1">{messages}</div>
                </Skeleton>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-grow text-1 text-neutral-11"></div>
      </CardContent>
    </Card>
  );
};
