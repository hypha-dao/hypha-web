'use client';

import { DEFAULT_SPACE_LEAD_IMAGE } from '@hypha-platform/core/client';
import {
  Avatar,
  AvatarImage,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Image,
  Button,
} from '@hypha-platform/ui';
import { ExitIcon } from '@radix-ui/react-icons';
import { SpaceModeLabel } from './space-mode-label';
import { cn } from '@hypha-platform/ui-utils';
import { ExitSpace } from './exit-space';
import { useFormatter, useTranslations } from 'next-intl';

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
  isArchived?: boolean;
  configPath?: string;
  web3SpaceId?: number;
  createdAt: Date;
  className?: string;
  showExitButton?: boolean;
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
  isArchived = false,
  configPath,
  web3SpaceId,
  createdAt,
  className,
  showExitButton = false,
}) => {
  const t = useTranslations('Spaces');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  return (
    <Card
      className={cn('group relative w-full h-full flex flex-col', className)}
    >
      {showExitButton && web3SpaceId && (
        <div
          className="absolute w-[30px] h-[30px] top-[10px] right-[10px] invisible [@media(hover:none)]:visible group-hover:visible"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <ExitSpace
            web3SpaceId={web3SpaceId}
            exitButton={
              <Button
                size="icon"
                variant="outline"
                colorVariant="neutral"
                className="border-0 w-[30px] h-[30px]"
                title={t('exitSpace')}
              >
                <ExitIcon width={18} height={18} />
              </Button>
            }
          />
        </div>
      )}
      <CardHeader
        style={customCardHeaderStyles}
        className="relative p-0 rounded-tl-md rounded-tr-md overflow-hidden flex-shrink-0"
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
        <SpaceModeLabel
          web3SpaceId={web3SpaceId}
          isSandbox={isSandbox}
          isDemo={isDemo}
          isArchived={isArchived}
          configPath={configPath}
          className={cn(
            'absolute top-2 z-10 xl:hidden',
            showExitButton && web3SpaceId ? 'right-12' : 'right-2',
          )}
        />
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pt-5 relative min-w-0">
        <div>
          <Avatar className="w-[64px] h-[64px] absolute top-[-54px]">
            <Skeleton width="64px" height="64px" loading={isLoading}>
              <AvatarImage src={icon} alt="logo" />
            </Skeleton>
          </Avatar>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="mb-3 flex-shrink-0">
            <Skeleton loading={isLoading} width="40px" height="26px">
              <CardTitle className="font-medium tracking-normal text-4 truncate">
                {title}
              </CardTitle>
            </Skeleton>
          </div>
          <Skeleton
            loading={isLoading}
            className="mb-4"
            width="100%"
            height="26px"
          >
            <div
              className="text-1 text-neutral-11 mb-0 line-clamp-2"
              style={{
                lineHeight: 'calc(var(--text-1--line-height) * var(--text-1))',
                minHeight:
                  'calc(var(--text-1--line-height) * var(--text-1) * 2)',
              }}
              title={description}
            >
              {description}
            </div>
          </Skeleton>
          <div className="mt-auto flex gap-2 text-xs items-end min-w-0">
            <div className="flex flex-col gap-y-1 gap-x-4 flex-wrap min-w-0 flex-1">
              <div className="flex flex-row gap-y-2 gap-x-4 flex-wrap">
                <div className="flex flex-row">
                  <Skeleton loading={isLoading} height="16px" width="80px">
                    <div className="font-bold text-1">{members}</div>
                    <div className="text-neutral-11 ml-1 text-1">
                      {tCommon('Members')}
                    </div>
                  </Skeleton>
                </div>
                <div className="flex flex-row">
                  <Skeleton loading={isLoading} height="16px" width="80px">
                    <div className="font-bold text-1">{agreements}</div>
                    <div className="text-neutral-11 ml-1 text-1">
                      {tCommon('Agreements')}
                    </div>
                  </Skeleton>
                </div>
              </div>
              <div className="flex flex-row min-w-0 w-full max-w-full">
                {createdAt instanceof Date &&
                  !Number.isNaN(createdAt.getTime()) && (
                    <Skeleton loading={isLoading} height="16px" width="80px">
                      <div className="text-neutral-11 text-1 truncate w-full max-w-full">
                        {tCommon('createdOn', {
                          date: format.dateTime(createdAt, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          }),
                        })}
                      </div>
                    </Skeleton>
                  )}
              </div>
            </div>
            <SpaceModeLabel
              web3SpaceId={web3SpaceId}
              isSandbox={isSandbox}
              isDemo={isDemo}
              isArchived={isArchived}
              configPath={configPath}
              className="hidden xl:flex ml-2 mb-0.5 shrink-0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
