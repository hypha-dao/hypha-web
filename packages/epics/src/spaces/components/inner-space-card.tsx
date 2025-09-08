'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Image,
} from '@hypha-platform/ui';
import { Avatar, AvatarImage } from '@radix-ui/react-avatar';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { getDhoPathGovernance } from './space-card.container';

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
  spaceId?: number | null | undefined;
  parentTitle?: string;
  parentPath?: string;
  className?: string;
};

export const InnerSpaceCard: React.FC<InnerSpaceCardProps> = ({
  description,
  leadImageUrl,
  title,
  members,
  isLoading,
  spaceId,
  parentTitle,
  parentPath,
  className,
}) => {
  return (
    <Card className={cn('h-full w-full', className)}>
      <CardHeader className="p-0 rounded-tl-md rounded-tr-md overflow-hidden h-[150px]">
        <Skeleton
          width="100%"
          height="100%"
          loading={isLoading}
          className="rounded-tl-xl rounded-tr-xl object-cover"
        >
          <Image
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
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
                  by {parentTitle}
                </Link>
              ) : null}
            </CardTitle>
          </Skeleton>
        </div>

        <div className="flex flex-grow text-1 text-gray-500 mb-4">
          <Skeleton width="200px" height="48px" loading={isLoading}>
            <div className="line-clamp-3">{description}</div>
          </Skeleton>
        </div>

        <div className="flex gap-1 mb-4">
          <Skeleton width="24px" height="24px" loading={isLoading}>
            <div className="flex gap-1">
              {members
                ? members.slice(0, 3).map((member, index) => (
                    <Avatar key={`${member.name} ${member.surname} - ${index}`}>
                      <AvatarImage
                        className="rounded-lg"
                        src={member.avatar}
                        width={24}
                        height={24}
                      />
                    </Avatar>
                  ))
                : null}
            </div>
          </Skeleton>

          <Skeleton width="106px" height="24px" loading={isLoading}>
            {members && members.length > 3 ? (
              <Text className="ml-2 flex items-center text-1 text-action-light text-nowrap">
                + other {members.length - 3} members
              </Text>
            ) : null}
          </Skeleton>
        </div>
      </CardContent>
    </Card>
  );
};
