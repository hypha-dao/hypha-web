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
import { SpaceModeLabel } from './space-mode-label';
import { cn, formatDate } from '@hypha-platform/ui-utils';

type SpaceCardProps = {
  description: string;
  icon: string;
  members?: number;
  agreements?: number;
  title: string;
  isLoading?: boolean;
  leadImage?: string;
  isSandbox?: boolean;
  isDemo?: boolean;
  configPath?: string;
  web3SpaceId?: number;
  createdAt: Date;
  className?: string;
};

const customCardHeaderStyles: React.CSSProperties = {
  height: '150px',
};

export const SpaceCard: React.FC<SpaceCardProps> = ({
  description,
  icon,
  members = 0,
  agreements = 0,
  isLoading = false,
  title,
  leadImage,
  isSandbox = false,
  isDemo = false,
  configPath,
  web3SpaceId,
  createdAt,
  className,
}) => {
  return (
    <Card className={cn('relative w-full h-full flex flex-col', className)}>
      <CardHeader
        style={customCardHeaderStyles}
        className="p-0 rounded-tl-md rounded-tr-md overflow-hidden flex-shrink-0"
      >
        <Skeleton loading={isLoading} className="w-full h-full">
          <Image
            width={454}
            height={150}
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
            src={leadImage || DEFAULT_SPACE_LEAD_IMAGE}
            alt={title}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pt-5 relative">
        <div>
          <Avatar className="w-[64px] h-[64px] absolute top-[-54px]">
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
            <div className="flex flex-col gap-y-2 gap-x-4 flex-wrap">
              <div className="flex flex-row gap-y-2 gap-x-4 flex-wrap">
                <div className="flex flex-row">
                  <Skeleton loading={isLoading} height="16px" width="80px">
                    <div className="font-bold text-1">{members}</div>
                    <div className="text-neutral-11 ml-1 text-1">Members</div>
                  </Skeleton>
                </div>
                <div className="flex flex-row">
                  <Skeleton loading={isLoading} height="16px" width="80px">
                    <div className="font-bold text-1">{agreements}</div>
                    <div className="text-neutral-11 ml-1 text-1">
                      Agreements
                    </div>
                  </Skeleton>
                </div>
              </div>
              <div className="flex flex-row">
                <Skeleton loading={isLoading} height="16px" width="80px">
                  <div className="text-neutral-11 text-1">
                    Created on {formatDate(createdAt, true)}
                  </div>
                </Skeleton>
              </div>
            </div>
            <div className="flex grow"></div>
            <SpaceModeLabel
              web3SpaceId={web3SpaceId}
              isSandbox={isSandbox}
              isDemo={isDemo}
              configPath={configPath}
              className="ml-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
