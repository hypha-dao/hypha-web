import { ChatMember, useMatrix } from '@hypha-platform/core/client';
import React from 'react';
import { ChatMemberContainer } from './chat-member.container';

export interface ChatMembersProps {
  roomId: string;
  isLoading: boolean;
}

export const ChatMembers = ({ roomId, isLoading }: ChatMembersProps) => {
  const {
    isMatrixAvailable,
    getRoomMembers,
    registerRoomListener,
    unregisterRoomListener,
  } = useMatrix();
  const [onlineMemberIds, setOnlineMemberIds] = React.useState([] as string[]);
  const [offlineMemberIds, setOfflineMemberIds] = React.useState(
    [] as string[],
  );
  const [isMembersLoading, setIsMembersLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isMatrixAvailable) {
      console.log('Matrix client is not initialized');
      return;
    }

    const register = async (roomId: string) => {
      try {
        registerRoomListener(roomId, async () => {
          setIsMembersLoading(true);
          const members = await getRoomMembers(roomId);
          setOnlineMemberIds(
            members
              ?.filter((member) => member.presence)
              .map((member) => member.userId) ?? [],
          );
          setOfflineMemberIds(
            members
              ?.filter((member) => !member.presence)
              .map((member) => member.userId) ?? [],
          );
          setIsMembersLoading(false);
        });

        setIsMembersLoading(true);
        const members = await getRoomMembers(roomId);
        setOnlineMemberIds(
          members
            .filter((member) => member.presence)
            .map((member) => member.userId),
        );
        setOfflineMemberIds(
          members
            .filter((member) => !member.presence)
            .map((member) => member.userId),
        );
        setIsMembersLoading(false);
      } catch (error) {
        unregisterRoomListener(roomId);
        setIsMembersLoading(false);
      }
    };

    register(roomId);

    return () => {
      unregisterRoomListener(roomId);
    };
  }, [isMatrixAvailable, roomId]);

  return (
    <div className="flex flex-col">
      <div className="text-neutral-11">Online - {onlineMemberIds.length}</div>
      <ChatMemberContainer
        memberIds={onlineMemberIds}
        isLoading={isLoading || isMembersLoading}
      />
      <div className="text-neutral-11">Offline - {offlineMemberIds.length}</div>
      <ChatMemberContainer
        memberIds={offlineMemberIds}
        isLoading={isLoading || isMembersLoading}
      />
    </div>
  );
};
