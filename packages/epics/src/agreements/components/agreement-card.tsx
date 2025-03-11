import { Text } from '@radix-ui/themes';
import {
  Card,
  Badge,
  Skeleton,
  StatusBadge,
  CardContent,
  CardHeader,
  CardTitle,
  Image,
} from '@hypha-platform/ui';
import { EyeOpenIcon, ChatBubbleIcon } from '@radix-ui/react-icons';
import { CardCommentProps } from '../../interactions/components/card-comment';
import { Avatar, AvatarImage } from '@radix-ui/react-avatar';

type Creator = {
  avatar?: string;
  name?: string;
  surname?: string;
};

type AgreementCardProps = {
  creator?: Creator;
  title?: string;
  commitment?: number;
  status?: string;
  views?: number;
  comments?: CardCommentProps[];
  isLoading?: boolean;
  leadImage?: string;
  description?: string;
};

export const AgreementCard: React.FC<AgreementCardProps> = ({
  commitment,
  status,
  title,
  creator,
  views,
  comments,
  isLoading,
  leadImage,
  description,
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
            Agreement
          </Badge>
          <Badge isLoading={isLoading} variant="outline" colorVariant="accent">
            {commitment}%
          </Badge>
          <StatusBadge status={status} isLoading={isLoading} />
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
              <Text className="ml-2 text-1 text-neutral-11">
                {creator?.name} {creator?.surname}
              </Text>
            </Skeleton>
          </div>
        </div>
        <div className="flex flex-grow text-1 text-neutral-11 mb-4">
          <Skeleton width="200px" height="48px" loading={isLoading}>
            <div className="line-clamp-2">{description}</div>
          </Skeleton>
        </div>
        <div className="flex flex-grow gap-2 text-1 text-neutral-11 items-center">
          <Skeleton width="16px" height="16px" loading={isLoading}>
            <div className="flex">
              <EyeOpenIcon className="mr-1" width={16} />
              <div>{views}</div>
            </div>
          </Skeleton>
          <Skeleton width="16px" height="16px" loading={isLoading}>
            <div className="flex ml-3">
              <ChatBubbleIcon className="mr-1" width={16} />
              <div>{comments?.length}</div>
            </div>
          </Skeleton>
        </div>
      </CardContent>
    </Card>
  );
};
