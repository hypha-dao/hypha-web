import {
  Card,
  Button,
  Skeleton,
  CardHeader,
  CardContent,
  Image,
  CardTitle,
  Badge,
} from '@hypha-platform/ui';
import { CreatorType } from './proposal-head';
import { Text } from '@radix-ui/themes';
import { Avatar, AvatarImage } from '@radix-ui/react-avatar';

type ProposalCardProps = {
  creator?: CreatorType;
  title?: string;
  commitment?: number;
  status?: string;
  isLoading?: boolean;
  leadImage?: string;
  description?: string;
};

const voted = false;

export const ProposalCard: React.FC<ProposalCardProps> = ({
  commitment,
  status,
  title,
  creator,
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
            Discussion
          </Badge>
          <Badge isLoading={isLoading} variant="outline" colorVariant="accent">
            {commitment}%
          </Badge>
          <Badge isLoading={isLoading} variant="outline" colorVariant="warn">
            On voting
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
        <Skeleton
          height="32px"
          width="200px"
          loading={isLoading}
          className="rounded-lg"
        >
          <div>
            {voted ? (
              <Button
                colorVariant="accent"
                className="rounded-lg w-full"
                variant="outline"
              >
                You voted yes
              </Button>
            ) : (
              <Button
                colorVariant="accent"
                className="rounded-lg w-full"
                variant="outline"
              >
                Vote now
              </Button>
            )}
          </div>
        </Skeleton>
      </CardContent>
    </Card>
  );
};
