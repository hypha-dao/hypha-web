import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Skeleton,
} from '@hypha-platform/ui';
import { Avatar, AvatarImage } from '@radix-ui/react-avatar';
import { Text } from '@radix-ui/themes';

type Member = {
  avatar: string;
  name: string;
  surname: string;
};

type InnerSpaceCardProps = {
  members?: Member[];
  image?: string;
  title?: string;
  description?: string;
  joinedStatus?: boolean;
  isLoading?: boolean;
};

const customCardHeaderStyles: React.CSSProperties = {
  height: '150px',
};

const customCardTitleStyles: React.CSSProperties = {
  fontSize: '18px',
  whiteSpace: 'nowrap',
  fontWeight: '500',
};

const truncatedDescription: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

export const InnerSpaceCard: React.FC<InnerSpaceCardProps> = ({
  description,
  image,
  title,
  members,
  joinedStatus,
  isLoading,
}) => {
  return (
    <Card className="h-full w-full">
      <CardHeader
        style={customCardHeaderStyles}
        className="p-0 rounded-tl-md rounded-tr-md overflow-hidden"
      >
        <Skeleton
          width="100%"
          height="100%"
          loading={isLoading}
          className="rounded-tl-xl rounded-tr-xl object-cover"
        >
          <img
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
            src={image}
            alt={title}
          />
        </Skeleton>
      </CardHeader>

      <CardContent className="pt-5 relative">
        <div className="flex flex-col items-start mb-5">
          <Skeleton width="150px" height="18px" loading={isLoading}>
            <CardTitle style={customCardTitleStyles}>{title}</CardTitle>
          </Skeleton>
        </div>

        <div className="flex flex-grow text-xs text-gray-500 mb-4">
          <Skeleton width="200px" height="48px" loading={isLoading}>
            <div style={truncatedDescription}>{description}</div>
          </Skeleton>
        </div>

        <div className="flex gap-1 mb-4">
          <Skeleton width="24px" height="24px" loading={isLoading}>
            <div className="flex gap-1">
              {members
                ? members.slice(0, 3).map((member, index) => (
                    <Avatar key={index}>
                      <AvatarImage
                        className="rounded-lg"
                        src={member.avatar}
                        width={24}
                        height={24}
                      />
                    </Avatar>
                  ))
                : null}
            </div>
          </Skeleton>

          <Skeleton width="106px" height="24px" loading={isLoading}>
            <Text className="ml-2 flex items-center text-xs text-action-light text-nowrap">
              + other {members ? members.length - 3 : null} members
            </Text>
          </Skeleton>
        </div>

        <Skeleton width="200px" height="32px" loading={isLoading}>
          <div>
            {joinedStatus ? (
              <Button
                className="rounded-lg w-full"
                variant="actionOutlineChecked"
                size="sm"
              >
                Joined
              </Button>
            ) : (
              <Button
                className="rounded-lg w-full"
                variant="actionOutline"
                size="sm"
              >
                Join
              </Button>
            )}
          </div>
        </Skeleton>
      </CardContent>
    </Card>
  );
};
