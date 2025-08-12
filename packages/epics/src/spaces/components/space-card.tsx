import { DEFAULT_SPACE_LEAD_IMAGE } from '@hypha-platform/core/client';
import {
  Avatar,
  AvatarImage,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Image,
} from '@hypha-platform/ui';

type SpaceCardProps = {
  description: string;
  icon: string;
  members?: number;
  agreements?: number;
  title: string;
  isLoading?: boolean;
  leadImage?: string;
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

export const SpaceCard: React.FC<SpaceCardProps> = ({
  description,
  icon,
  members = 0,
  agreements = 0,
  isLoading = false,
  title,
  leadImage = DEFAULT_SPACE_LEAD_IMAGE,
}) => {
  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader
        style={customCardHeaderStyles}
        className="p-0 rounded-tl-md rounded-tr-md overflow-hidden flex-shrink-0"
      >
        <Skeleton loading={isLoading} className="w-full h-full">
          <Image
            width={454}
            height={150}
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
            src={leadImage ? leadImage : DEFAULT_SPACE_LEAD_IMAGE}
            alt={title}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pt-5 relative">
        <div>
          <Avatar style={customAvatarStyles}>
            <Skeleton width="64px" height="64px" loading={isLoading}>
              <AvatarImage src={icon} alt="logo" />
            </Skeleton>
          </Avatar>
        </div>
        <div className="flex flex-col flex-1">
          <div className="mb-4 flex-shrink-0">
            <Skeleton loading={isLoading} width="40px" height="26px">
              <CardTitle className="font-medium tracking-normal text-4">
                {title}
              </CardTitle>
            </Skeleton>
          </div>
          <div className="flex flex-col flex-1 flex-grow">
            <Skeleton
              loading={isLoading}
              className="mb-4"
              width="100%"
              height="26px"
            >
              <div className="text-1 text-neutral-11 mb-4 line-clamp-2">
                {description}
              </div>
            </Skeleton>
          </div>
          <div className="flex gap-2 text-xs items-center">
            <div className="flex">
              <Skeleton loading={isLoading} height="16px" width="80px">
                <div className="font-bold text-1">{members}</div>
                <div className="text-neutral-11 ml-1 text-1">Members</div>
              </Skeleton>
            </div>
            <div className="flex ml-3">
              <Skeleton loading={isLoading} height="16px" width="80px">
                <div className="font-bold text-1">{agreements}</div>
                <div className="text-neutral-11 ml-1 text-1">Agreements</div>
              </Skeleton>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
