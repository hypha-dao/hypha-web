import { DiscussionHead, DiscussionHeadProps } from './discussion-head';
import { Button, Skeleton } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { Image } from '@hypha-platform/ui';
import { MagicWandIcon } from '@radix-ui/react-icons';
import { Chat } from '../../interactions/components/chat';

import { MessageProps } from '../../interactions/components/message';
import Link from 'next/link';

export type DiscussionDetailProps = DiscussionHeadProps & {
  content: string;
  messages: MessageProps[];
  image: string;
  closeUrl: string;
};

export const DiscussionDetail = ({
  creator,
  title,
  isLoading,
  content,
  image,
  messages,
  closeUrl,
}: DiscussionDetailProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <DiscussionHead creator={creator} title={title} isLoading={isLoading} />
        <Link href={closeUrl} scroll={false}>
          <Button
            variant="ghost"
            colorVariant="neutral"
            className="flex items-center"
          >
            Close
            <RxCross1 className="ml-2" />
          </Button>
        </Link>
      </div>
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <Image
          height={100}
          width={554}
          className="w-full object-cover rounded-lg max-h-[100px]"
          src={image}
          alt={title ?? ''}
        />
      </Skeleton>
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <div className="text-2 text-gray-500">{content}</div>
      </Skeleton>
      <div className="flex w-full justify-end">
        <Skeleton
          width="200px"
          height="35px"
          loading={isLoading}
          className="rounded-lg"
        >
          <Button colorVariant="accent">
            <MagicWandIcon width={16} height={16} className="mr-2" />
            Generate AI Summary
          </Button>
        </Skeleton>
      </div>
      <Chat messages={messages} isLoading={isLoading} />
    </div>
  );
};
