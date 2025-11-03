'use client';

import { Text } from '@radix-ui/themes';
import {
  Card,
  StatusBadge,
  Skeleton,
  Image,
  Button,
  Badge,
} from '@hypha-platform/ui';
import { SewingPinFilledIcon } from '@radix-ui/react-icons';
// TODO: need for #1309
// import { useParams } from 'next/navigation';
// import {
// useSpaceBySlug,
// useUndelegateWeb3Rpc,
// } from '@hypha-platform/core/client';
// import { useState } from 'react';
// import { useJoinSpace } from '../../spaces';
// import { useAuthentication } from '@hypha-platform/authentication';
// import { useSpaceDelegate } from '@hypha-platform/core/client';

export type MemberCardProps = {
  name?: string;
  surname?: string;
  nickname?: string;
  location?: string;
  avatarUrl?: string;
  status?: string;
  isLoading?: boolean;
  minimize?: boolean;
  // isDelegate?: boolean;
};

export const MemberCard: React.FC<MemberCardProps> = ({
  name,
  surname,
  nickname,
  location,
  avatarUrl,
  status,
  isLoading,
  minimize,
  // isDelegate,
}) => {
  // const { id: spaceSlug } = useParams();
  // const { space } = useSpaceBySlug(spaceSlug as string);
  // const { undelegate, isUndelegating } = useUndelegateWeb3Rpc();
  // const [localIsDelegate, setLocalIsDelegate] = useState(isDelegate);
  // const { isMember } = useJoinSpace({ spaceId: space?.web3SpaceId as number });
  // const { isAuthenticated } = useAuthentication();

  // const isDisabled = isUndelegating || !isAuthenticated || !isMember;
  // const tooltipMessage = !isAuthenticated
  //   ? 'Please sign in to use this feature.'
  //   : !isMember
  //   ? 'Please join this space to use this feature.'
  //   : '';

  return (
    <Card className="w-full h-full p-5 mb-2 flex items-center">
      <Skeleton
        width={minimize ? '40px' : '64px'}
        height={minimize ? '40px' : '64px'}
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="rounded-lg mr-3 h-[64px]"
          src={avatarUrl || '/placeholder/default-profile.svg'}
          height={minimize ? 40 : 64}
          width={minimize ? 40 : 64}
          alt={nickname ?? ''}
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <Badge className="w-fit" colorVariant="accent">
            Member
          </Badge>
          {!minimize ? (
            <div className="flex gap-x-1">
              <StatusBadge isLoading={isLoading} status={status} />
            </div>
          ) : null}

          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Text className="text-4">
              {name} {surname}
            </Text>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <Text className="text-1 text-gray-500">@{nickname}</Text>
          </Skeleton>
        </div>

        <div className="flex justify-between flex-col gap-6 items-end">
          {/* {localIsDelegate ? (
            <Skeleton width="96px" height="32px" loading={isLoading}>
              <Button
                disabled={isDisabled}
                onClick={async (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    await undelegate({ spaceId: space?.web3SpaceId as number });
                    setLocalIsDelegate(false);
                  } catch (error) {
                    console.error('Undelegate failed:', error);
                  }
                }}
                title={tooltipMessage}
              >
                {isUndelegating ? 'Undelegating...' : 'Undelegate'}
              </Button>
            </Skeleton>
          ) : (
            <div className="w-[130px] h-[40px]" />
          )} */}
          <Skeleton
            width="96px"
            height="16px"
            loading={isLoading}
            // className={localIsDelegate ? 'mt-2' : ''}
          >
            <div className="flex items-center text-gray-500">
              <SewingPinFilledIcon className="mr-1" />
              <Text className="text-1">{location}</Text>
            </div>
          </Skeleton>
        </div>
      </div>
    </Card>
  );
};
