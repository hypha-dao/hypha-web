import {
  Avatar,
  AvatarImage,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  title,
}) => {
  return (
    <Card className="h-full w-full">
      <CardHeader
        style={customCardHeaderStyles}
        className="p-0 rounded-tl-md rounded-tr-md overflow-hidden"
      >
        <img
          className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
          src={icon}
          alt={title}
        ></img>
      </CardHeader>
      <CardContent className="pt-5 relative">
        <Avatar style={customAvatarStyles}>
          <AvatarImage src={icon} alt="logo" />
        </Avatar>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="font-medium tracking-normal text-4">
            {title}
          </CardTitle>
          <div className="flex">
            <div>
              {activeAgreements ? (
                <Badge variant="surface" colorVariant="success">
                  {activeAgreements} Active Agreements
                </Badge>
              ) : null}
            </div>
            <div className="ml-2">
              {openDiscussions ? (
                <Badge variant="surface" colorVariant="warn">
                  {openDiscussions} Open Discussions
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-grow text-1 text-gray-500 mb-4 line-clamp-3">
          {description}
        </div>
        <div className="flex flex-grow gap-2 text-xs items-center">
          <div className="flex">
            <div className="font-bold text-1">{members}</div>
            <div className="text-gray-500 ml-1 text-1">Members</div>
          </div>
          <div className="flex ml-3">
            <div className="font-bold text-1">{agreements}</div>
            <div className="text-gray-500 ml-1 text-1">Agreements</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
