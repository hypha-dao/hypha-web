import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Image,
  Badge,
} from '@hypha-platform/ui';
import { EyeOpenIcon, ChatBubbleIcon } from '@radix-ui/react-icons';
import { Avatar, AvatarImage } from '@radix-ui/react-avatar';
import { Text } from '@radix-ui/themes';

type CreatorType = {
  avatar?: string;
  name?: string;
  surname?: string;
};

type DiscussionCardProps = {
  creator?: CreatorType;
  leadImage?: string;
  title?: string;
  description?: string;
  views?: number;
  comments?: number;
  isLoading?: boolean | undefined;
  href?: string;
};

export const DiscussionCard: React.FC<DiscussionCardProps> = ({
  description,
  leadImage,
  views,
  comments,
  title,
  creator,
  isLoading,
  href,
}) => {
  return (
    <Card className="h-full w-full">
      <CardHeader className="p-0 rounded-tl-md rounded-tr-md overflow-hidden h-[150px]">
        <Skeleton loading={isLoading} height="150px" width="250px">
          <Image
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
            src={leadImage || '/placeholder/space-lead-image.png'}
            alt={title || 'TODO: make sure there is a title'}
            width={250}
            height={150}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="pt-5 relative">
        <div className="flex gap-x-1 mb-2">
          <Badge isLoading={isLoading} variant="solid" colorVariant="accent">
            Discussion
          </Badge>
        </div>
        <div className="flex flex-col items-start mb-4">
          <Skeleton width="120px" height="18px" loading={isLoading}>
            <CardTitle>{title}</CardTitle>
          </Skeleton>
          <div className="mt-2 flex items-center">
            <Skeleton
              width="24px"
              height="24px"
              className="rounded-md"
              loading={isLoading}
            >
              <Avatar>
                <AvatarImage
                  className="rounded-md"
                  width={24}
                  height={24}
                  src={creator?.avatar}
                  alt="logo"
                />
              </Avatar>
            </Skeleton>
            <Skeleton
              width="50px"
              height="16px"
              className="ml-2"
              loading={isLoading}
            >
              <Text className="ml-2 text-1 text-gray-500">
                {creator?.name} {creator?.surname}
              </Text>
            </Skeleton>
          </div>
        </div>
        <div className="flex flex-grow text-1 text-gray-500 mb-4">
          <Skeleton width="200px" height="48px" loading={isLoading}>
            <div className="line-clamp-3">{description}</div>
          </Skeleton>
        </div>
        <div className="flex flex-grow gap-2 text-1 text-gray-500 items-center">
          <Skeleton width="16px" height="16px" loading={isLoading}>
            <div className="flex">
              <EyeOpenIcon className="mr-1" width={16} />
              <div>{views}</div>
            </div>
          </Skeleton>
          <Skeleton width="16px" height="16px" loading={isLoading}>
            <div className="flex ml-3">
              <ChatBubbleIcon className="mr-1" width={16} />
              <div>{comments}</div>
            </div>
          </Skeleton>
        </div>
      </CardContent>
    </Card>
  );
};
