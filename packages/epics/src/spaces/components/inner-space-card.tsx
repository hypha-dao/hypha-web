'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Image,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';

type Member = {
  avatar: string;
  name: string;
  surname: string;
};

type InnerSpaceCardProps = {
  members?: Member[];
  leadImageUrl?: string;
  title?: string;
  description?: string;
  isLoading?: boolean;
  parentTitle?: string;
  parentPath?: string;
  createdAt?: Date;
  className?: string;
};

const DEFAULT_AVATAR_PATH = '/placeholder/default-profile.svg';

export const InnerSpaceCard: React.FC<InnerSpaceCardProps> = ({
  description,
  leadImageUrl,
  title,
  members,
  isLoading,
  parentTitle,
  parentPath,
  createdAt,
  className,
}) => {
  const avatarSize = 'w-[24px] h-[24px]';
  const skeletonSize = '24px';
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  return (
    <Card className={cn('h-full w-full', className)}>
      <CardHeader className="h-[150px] overflow-hidden rounded-tl-lg rounded-tr-lg p-0">
        <Skeleton
          width="100%"
          height="100%"
          loading={isLoading}
          className="rounded-tl-lg rounded-tr-lg object-cover"
        >
          <Image
            className="rounded-tl-lg rounded-tr-lg object-cover w-full h-full"
            src={leadImageUrl as string}
            alt={title as string}
            width={1200}
            height={400}
          />
        </Skeleton>
      </CardHeader>

      <CardContent className="pt-5 relative">
        <div className="flex flex-col items-start mb-5">
          <Skeleton width="150px" height="18px" loading={isLoading}>
            <CardTitle>
              {title}
              {parentTitle ? (
                <Link
                  className="text-accent-11 text-3 text-ellipsis overflow-hidden"
                  href={parentPath || '#'}
                >
                  {' '}
                  {tCommon('by')} {parentTitle}
                </Link>
              ) : null}
            </CardTitle>
          </Skeleton>
        </div>

        {description ? (
          <div className="mb-3 flex-grow text-1 font-normal text-muted-foreground">
            <Skeleton width="200px" height="16px" loading={isLoading}>
              <p className="line-clamp-1">{description}</p>
            </Skeleton>
          </div>
        ) : null}

        <div className="flex gap-1 mb-4">
          <Skeleton
            width={skeletonSize}
            height={skeletonSize}
            loading={isLoading}
            className="rounded-lg"
          >
            <div className="flex gap-1">
              {members
                ? members.slice(0, 3).map((member, index) => (
                    <Avatar
                      key={`${member.name} ${member.surname} - ${index}`}
                      className={`${avatarSize} rounded-lg`}
                    >
                      <AvatarImage
                        className={`${avatarSize} rounded-lg`}
                        src={member.avatar}
                        width={20}
                        height={20}
                      />
                      <AvatarFallback className={`${avatarSize} rounded-lg`}>
                        <Image
                          width={20}
                          height={20}
                          className={`${avatarSize} rounded-lg`}
                          src={DEFAULT_AVATAR_PATH}
                          alt={`${member.name} ${member.surname}`}
                        />
                      </AvatarFallback>
                    </Avatar>
                  ))
                : null}
            </div>
          </Skeleton>

          <Skeleton width="106px" height={skeletonSize} loading={isLoading}>
            {members && members.length > 3 ? (
              <Text className="ml-2 flex items-center text-1 text-action-light text-nowrap">
                {tCommon('otherMembers', { count: members.length - 3 })}
              </Text>
            ) : null}
          </Skeleton>
        </div>
        {createdAt && (
          <div className="flex flex-row">
            <Skeleton loading={isLoading} height="16px" width="80px">
              <div className="text-neutral-11 text-1">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};
