import {
  Avatar,
  AvatarImage,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Image,
} from '@hypha-platform/ui';
import { MemberType } from '@hypha-platform/graphql/rsc';

type OuterSpaceCardProps = {
  logo?: string;
  members?: MemberType[];
  title?: string;
  description?: string;
  projects?: number;
  isLoading?: boolean;
};

const customCardHeaderStyles: React.CSSProperties = {
  height: '150px',
};

const customAvatarStyles: React.CSSProperties = {
  width: '64px',
  height: '64px',
  position: 'absolute',
  top: '-54px',
};

export const OuterSpaceCard: React.FC<OuterSpaceCardProps> = ({
  description,
  logo,
  members,
  projects,
  title,
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
          <Image
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
            src={logo as string}
            alt={title as string}
            width={1200}
            height={400}
          />
        </Skeleton>
      </CardHeader>

      <CardContent className="pt-5 relative">
        <Avatar style={customAvatarStyles}>
          <Skeleton width="64px" height="64px" loading={isLoading}>
            <AvatarImage src={logo} alt="logo" />
          </Skeleton>
        </Avatar>

        <div className="flex items-center justify-between mb-4">
          <Skeleton width="150px" height="18px" loading={isLoading}>
            <CardTitle>{title}</CardTitle>
          </Skeleton>
        </div>

        <div className="flex flex-grow text-1 text-gray-500 mb-4">
          <Skeleton width="328px" height="28px" loading={isLoading}>
            <div className="line-clamp-3">{description}</div>
          </Skeleton>
        </div>

        <div className="flex flex-grow gap-2 text-1 items-center">
          <div className="flex">
            <Skeleton width="16px" height="16px" loading={isLoading}>
              <div className="font-bold">{members?.length}</div>
            </Skeleton>
            <Skeleton
              width="52px"
              height="16px"
              loading={isLoading}
              className="ml-1"
            >
              <div className="text-gray-500 ml-1">Members</div>
            </Skeleton>
          </div>

          <div className="flex ml-3">
            <Skeleton width="16px" height="16px" loading={isLoading}>
              <div className="font-bold">{projects}</div>
            </Skeleton>
            <Skeleton
              width="52px"
              height="16px"
              loading={isLoading}
              className="ml-1"
            >
              <div className="text-gray-500 ml-1">Projects</div>
            </Skeleton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
