'use client';

import {
  usePersonBySub,
  useUserPrivyIdByMatrixId,
} from '@hypha-platform/core/client';
import { Message } from '../types';
import { PersonAvatar } from '../../people/components/person-avatar';
import React from 'react';
import { Skeleton } from '@hypha-platform/ui';
import { formatDate } from '@hypha-platform/ui-utils';

type ChatMessageProps = {
  message: Message;
  isLoading: boolean;
};

export const ChatMessage = ({ message, isLoading }: ChatMessageProps) => {
  const { privyUserId, isLoading: isLoadingPrivyUserId } =
    useUserPrivyIdByMatrixId({ matrixUserId: message.sender });
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
    <div key={message.id} className="flex flex-row mt-3 mb-3 gap-x-3">
      <div>
        <PersonAvatar
          size="sm"
          isLoading={isLoading || isLoadingPrivyUserId || isLoadingPerson}
          avatarSrc={person?.avatarUrl}
          userName={displayName}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <div className="flex flex-row gap-x-2">
          <Skeleton height="12px" width="40px" loading={isLoading}>
            <div className="font-medium text-1 text-ellipsis overflow-hidden">
              {displayName}
            </div>
          </Skeleton>
          <Skeleton height="12px" width="40px" loading={isLoading}>
            <div className="text-1 text-neutral-9 font-regular text-ellipsis overflow-hidden">
              {formatDate(message.timestamp, true)}
            </div>
          </Skeleton>
        </div>
        <Skeleton height="12px" width="80px" loading={isLoading}>
          <div className="text-1 text-neutral-11 font-regular">
            {message.content}
          </div>
        </Skeleton>
      </div>
    </div>
  );
};
