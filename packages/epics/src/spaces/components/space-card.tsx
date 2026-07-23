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
import { cn, LOCAL_DATE_SHORT_FORMAT_OPTIONS } from '@hypha-platform/ui-utils';
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
  height: '120px',
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
      className={cn(
        'craft-card-interactive group relative flex h-full w-full flex-col @container/spacecard',
        className,
      )}
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
        className="flex-shrink-0 overflow-hidden rounded-tl-lg rounded-tr-lg p-0"
      >
        <Skeleton loading={isLoading} className="w-full h-full">
          <Image
            width={454}
            height={120}
            className="rounded-tl-lg rounded-tr-lg object-cover w-full h-full"
            src={leadImage || DEFAULT_SPACE_LEAD_IMAGE}
            alt={title}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="relative flex flex-1 flex-col p-3.5 pt-4">
        <div>
          <Avatar className="absolute top-[-48px] h-14 w-14">
            <Skeleton width="56px" height="56px" loading={isLoading}>
              <AvatarImage src={icon} alt="logo" />
            </Skeleton>
          </Avatar>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="min-w-0 shrink-0 pt-1">
            <Skeleton loading={isLoading} width="40px" height="22px">
              <CardTitle className="truncate text-3 font-medium tracking-tight">
                {title}
              </CardTitle>
            </Skeleton>
          </div>
          <div className="min-h-4">
            {description ? (
              <Skeleton loading={isLoading} width="100%" height="16px">
                <p className="craft-meta line-clamp-1">{description}</p>
              </Skeleton>
            ) : null}
          </div>
          <div className="mt-auto flex items-end gap-2 pt-2">
            <div className="craft-meta flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <Skeleton loading={isLoading} height="16px" width="72px">
                <span>
                  <span className="text-foreground/80">{members}</span>{' '}
                  {tCommon('Members')}
                </span>
              </Skeleton>
              <Skeleton loading={isLoading} height="16px" width="72px">
                <span>
                  <span className="text-foreground/80">{agreements}</span>{' '}
                  {tCommon('Agreements')}
                </span>
              </Skeleton>
              <Skeleton loading={isLoading} height="16px" width="88px">
                <span className="min-h-4 truncate">
                  {createdAt instanceof Date &&
                  !Number.isNaN(createdAt.getTime())
                    ? format.dateTime(
                        createdAt,
                        LOCAL_DATE_SHORT_FORMAT_OPTIONS,
                      )
                    : null}
                </span>
              </Skeleton>
            </div>
            <SpaceModeLabel
              web3SpaceId={web3SpaceId}
              isSandbox={isSandbox}
              isDemo={isDemo}
              isArchived={isArchived}
              configPath={configPath}
              className="shrink-0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
