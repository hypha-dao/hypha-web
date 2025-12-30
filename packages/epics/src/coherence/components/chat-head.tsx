'use client';

import { Text } from '@radix-ui/themes';
import { Skeleton } from '@hypha-platform/ui';
import { PersonAvatar } from '../../people/components/person-avatar';
import { ChatCreatorType } from '../types';

export type ChatHeadProps = {
  creator?: ChatCreatorType;
  createDate?: string;
  isLoading?: boolean;
};

export const ChatHead = ({
  creator,
  createDate,
  isLoading = false,
}: ChatHeadProps) => {
  const displayName =
    creator?.type === 'space'
      ? creator.name
      : `${creator?.name} ${creator?.surname}`.trim();

  return (
    <div className="flex gap-3 w-full">
      <div className="flex items-center space-x-3">
        <PersonAvatar
          size="lg"
          isLoading={isLoading}
          avatarSrc={creator?.avatar}
          userName={displayName}
        />
        <div className="flex justify-between items-center w-full">
          <div className="flex-col gap-y-2">
            <div className="font-medium text-[14px] text-ellipsis overflow-hidden ">
              {displayName}
            </div>
            <div className="flex gap-x-1">
              <Skeleton height="16px" width="80px" loading={isLoading}>
                <Text className="text-1 text-gray-500">
                  {createDate && <>Created on {createDate}</>}
                </Text>
              </Skeleton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
