'use client';

import {
  Person,
  usePersonBySub,
  useUserPrivyIdByMatrixId,
} from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';
import React from 'react';
import { Skeleton } from '@hypha-platform/ui';
import { formatDate } from '@hypha-platform/ui-utils';

export interface ChatMemberProps {
  memberId: string;
  isLoading: boolean;
}

export const ChatMember: React.FC<ChatMemberProps> = ({
  memberId,
  isLoading,
}) => {
  const { privyUserId, isLoading: isLoadingPrivyUserId } =
    useUserPrivyIdByMatrixId({ matrixUserId: memberId });
  const { person, isLoading: isLoadingPerson } = usePersonBySub({
    sub: privyUserId,
  });
  const displayName = React.useMemo(() => {
    if (isLoadingPerson || !person) {
      return '';
    }
    return `${person.name} ${person.surname}`;
  }, [isLoadingPerson, person]);
  return (
    <div className="flex flex-row mt-3 mb-3 gap-x-3">
      <div>
        <PersonAvatar
          size="sm"
          isLoading={isLoading || isLoadingPrivyUserId || isLoadingPerson}
          avatarSrc={person?.avatarUrl}
          userName={displayName}
        />
      </div>
      <div className="flex flex-col items-center">
        <Skeleton height="12px" width="40px" loading={isLoading}>
          <div className="font-medium text-1 pt-1 pb-1 text-ellipsis overflow-hidden">
            {displayName}
          </div>
        </Skeleton>
      </div>
    </div>
  );
};
