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

type DaoCardProps = {
  createdDate: string;
  description: string;
  icon: string;
  members: number;
  agreements: number;
  title: string;
  activeAgreements?: number;
  openDiscussions?: number;
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

export const CardOrganisation: React.FC<DaoCardProps> = ({
  description,
  icon,
  members,
  agreements,
  activeAgreements,
  openDiscussions,
  isLoading = false,
  title,
}) => {
  return (
    <Card className="h-full w-full">
      <CardHeader
        style={customCardHeaderStyles}
        className="p-0 rounded-tl-md rounded-tr-md overflow-hidden"
      >
        <Skeleton loading={isLoading} className="w-full h-full">
          <Image
            width={454}
            height={150}
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
            src={icon}
            alt={title}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="pt-5 relative">
        <Avatar style={customAvatarStyles}>
          <Skeleton width="64px" height="64px" loading={isLoading}>
            <AvatarImage src={icon} alt="logo" />
          </Skeleton>
        </Avatar>
        <div className="flex items-center justify-between mb-4">
          <Skeleton loading={isLoading} width="40px" height="26px">
            <CardTitle className="font-medium tracking-normal text-4">
              {title}
            </CardTitle>
          </Skeleton>
          <div className="flex">
            <div>
              {activeAgreements ? (
                <Badge
                  isLoading={isLoading}
                  variant="surface"
                  colorVariant="success"
                >
                  {activeAgreements} Active Agreements
                </Badge>
              ) : null}
            </div>
            <div className="ml-2">
              {openDiscussions ? (
                <Badge
                  isLoading={isLoading}
                  variant="surface"
                  colorVariant="warn"
                >
                  {openDiscussions} Open Discussions
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <Skeleton
          loading={isLoading}
          className="mb-4"
          width="100%"
          height="26px"
        >
          <div className="flex flex-grow text-1 text-neutral-11 mb-4 line-clamp-3">
            {description}
          </div>
        </Skeleton>
        <div className="flex flex-grow gap-2 text-xs items-center">
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
      </CardContent>
    </Card>
  );
};
