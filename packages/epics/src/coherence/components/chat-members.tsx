import { ChatMember, useMatrix } from '@hypha-platform/core/client';
import React from 'react';
import { ChatMemberContainer } from './chat-member.container';

export interface ChatMembersProps {
  isLoading: boolean;
  members: ChatMember[];
}

export const ChatMembers = ({ members, isLoading }: ChatMembersProps) => {
  const onlineMemberIds = React.useMemo(
    () =>
      members
        ?.filter((member) => member.presence)
        .map((member) => member.userId) ?? [],
    [members],
  );
  const offlineMemberIds = React.useMemo(
    () =>
      members
        ?.filter((member) => !member.presence)
        .map((member) => member.userId) ?? [],
    [members],
  );

  return (
    <div className="flex flex-col">
      <div className="text-neutral-11">Online - {onlineMemberIds.length}</div>
      <ChatMemberContainer memberIds={onlineMemberIds} isLoading={isLoading} />
      <div className="text-neutral-11">Offline - {offlineMemberIds.length}</div>
      <ChatMemberContainer memberIds={offlineMemberIds} isLoading={isLoading} />
    </div>
  );
};
