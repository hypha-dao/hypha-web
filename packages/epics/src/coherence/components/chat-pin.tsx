'use client';

import {
  Message,
  usePersonBySub,
  useUserPrivyIdByMatrixId,
} from '@hypha-platform/core/client';
import { Skeleton, Card } from '@hypha-platform/ui';
import { PinIcon } from 'lucide-react';
import React from 'react';

export interface ChatPinProps {
  message: Message;
  isLoading: boolean;
}

export const ChatPin = ({ message, isLoading }: ChatPinProps) => {
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
      <Card className="flex flex-col gap-y-2 grow">
        <div className="flex flex-col gap-y-2 p-3">
          <Skeleton height="12px" width="40px" loading={isLoading}>
            <div className="flex flex-row font-medium text-1 gap-x-2 text-ellipsis overflow-hidden">
              <PinIcon size={12} />
              Pinned by {displayName}
            </div>
          </Skeleton>
          <Skeleton height="12px" width="80px" loading={isLoading}>
            <div className="text-1 text-neutral-11 font-regular">
              {message.content}
            </div>
          </Skeleton>
        </div>
      </Card>
    </div>
  );
};
