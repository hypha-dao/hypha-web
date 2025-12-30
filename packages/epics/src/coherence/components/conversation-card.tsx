import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
  Skeleton,
} from '@hypha-platform/ui';
import { Coherence } from '../types';
import { PersonLabel } from '../../people/components/person-label';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import {
  ChatBubbleIcon,
  EyeOpenIcon,
  PaperPlaneIcon,
} from '@radix-ui/react-icons';
import { usePersonByWeb3Address } from '../../governance';
import React from 'react';

type ConversationCardProps = { isLoading: boolean };

export const ConversationCard: React.FC<ConversationCardProps & Coherence> = ({
  isLoading,
  title,
  description,
  creatorAddress,
}) => {
  const [message, setMessage] = React.useState<string>('');
  const { isLoading: isPersonLoading, person: creator } =
    usePersonByWeb3Address(creatorAddress ?? '0x0');
  const views = 59; //TODO: compute number of conversation view
  const messages = 16; //TODO: compute number of conversation messages

  const sendMessage = React.useCallback(() => {
    console.log('Send message into chat:', message);
    //TODO
    setMessage('');
  }, [message]);

  const proposeAgreement = () => {
    console.log('Propose agreement');
    //TODO
  };

  return (
    <Card className="h-full w-full space-y-5 pt-5">
      <CardContent className="relative space-y-3">
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
        <div className="w-full space-y-2">
          <div className="flex flex-grow text-1 text-neutral-11">
            <Input
              className="w-full"
              placeholder="Say something..."
              value={message}
              rightIcon={
                <Button
                  variant="ghost"
                  colorVariant="neutral"
                  className="w-6 h-6 p-0 pointer-events-auto!"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    sendMessage();
                  }}
                >
                  <PaperPlaneIcon />
                </Button>
              }
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendMessage();
                }
              }}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="flex flex-grow text-1 text-neutral-11">
            <Button
              variant="outline"
              colorVariant="accent"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                proposeAgreement();
              }}
            >
              Propose Agreement
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
