import {
  Avatar,
  AvatarImage,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';

type CardOuterSpaceProps = {
  logo: string;
  members: number;
  title: string;
  description: string;
  projects: number;
};

const customCardHeaderStyles: React.CSSProperties = {
  height: '150px',
};

const customCardTitleStyles: React.CSSProperties = {
  fontSize: '18px',
  whiteSpace: 'nowrap',
  fontWeight: '500',
};

const customAvatarStyles: React.CSSProperties = {
  width: '64px',
  height: '64px',
  position: 'absolute',
  top: '-54px',
};

const truncateWithEllipsis: (inputText: string, maxLength: number) => string = (
  inputText,
  maxLength
) => {
  if (inputText.length > maxLength) {
    return inputText.slice(0, maxLength) + '...';
  }
  return inputText;
};

export const CardOuterSpace: React.FC<CardOuterSpaceProps> = ({
  description,
  logo,
  members,
  projects,
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
          src={logo}
          alt={title}
        ></img>
      </CardHeader>
      <CardContent className="pt-5 relative">
        <Avatar style={customAvatarStyles}>
          <AvatarImage src={logo} alt="logo" />
        </Avatar>
        <div className="flex items-center justify-between mb-4">
          <CardTitle style={customCardTitleStyles}>{title}</CardTitle>
        </div>
        <div className="flex flex-grow text-xs text-gray-500 mb-4">
          {truncateWithEllipsis(description, 100)}
        </div>
        <div className="flex flex-grow gap-2 text-xs items-center">
          <div className="flex">
            <div className="font-bold">{members}</div>
            <div className="text-gray-500 ml-1">Members</div>
          </div>
          <div className="flex ml-3">
            <div className="font-bold">{projects}</div>
            <div className="text-gray-500 ml-1">Projects</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
