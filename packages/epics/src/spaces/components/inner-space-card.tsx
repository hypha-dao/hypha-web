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
import { cn, LOCAL_DATE_SHORT_FORMAT_OPTIONS } from '@hypha-platform/ui-utils';
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
  const avatarSize = 'size-6';
  const skeletonSize = '24px';
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const hasValidCreatedAt =
    createdAt instanceof Date && !Number.isNaN(createdAt.getTime());

  return (
    <Card
      className={cn(
        'craft-card-interactive flex h-full w-full flex-col',
        className,
      )}
    >
      <CardHeader className="h-[120px] flex-shrink-0 overflow-hidden rounded-tl-lg rounded-tr-lg p-0">
        <Skeleton
          width="100%"
          height="100%"
          loading={isLoading}
          className="rounded-tl-lg rounded-tr-lg object-cover"
        >
          <Image
            className="h-full w-full rounded-tl-lg rounded-tr-lg object-cover"
            src={leadImageUrl as string}
            alt={title as string}
            width={1200}
            height={400}
          />
        </Skeleton>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col gap-2 p-3.5 pt-3.5">
        <div className="min-w-0 shrink-0">
          <Skeleton width="150px" height="18px" loading={isLoading}>
            <CardTitle className="line-clamp-2 text-3 font-medium tracking-tight">
              {title}
              {parentTitle ? (
                <Link
                  className="text-3 font-normal text-accent-11"
                  href={parentPath || '#'}
                >
                  {' '}
                  {tCommon('by')} {parentTitle}
                </Link>
              ) : null}
            </CardTitle>
          </Skeleton>
        </div>

        <div className="min-h-8">
          {description ? (
            <Skeleton width="200px" height="32px" loading={isLoading}>
              <p className="craft-meta line-clamp-2">{description}</p>
            </Skeleton>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <div className="flex min-h-6 items-center gap-1">
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
                <span className="craft-meta ml-1 truncate">
                  {tCommon('otherMembers', { count: members.length - 3 })}
                </span>
              ) : null}
            </Skeleton>
          </div>

          <div className="min-h-4">
            <Skeleton loading={isLoading} height="16px" width="80px">
              {hasValidCreatedAt ? (
                <p className="craft-meta">
                  {tCommon('createdOn', {
                    date: format.dateTime(
                      createdAt,
                      LOCAL_DATE_SHORT_FORMAT_OPTIONS,
                    ),
                  })}
                </p>
              ) : null}
            </Skeleton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
