'use client';

import { ChatMember } from './chat-member';

export interface ChatMemberContainerProps {
  memberIds: string[];
  isLoading: boolean;
}

export const ChatMemberContainer: React.FC<ChatMemberContainerProps> = ({
  memberIds,
  isLoading,
}) => {
  return (
    <div className="w-full h-full flex-col">
      {isLoading ? (
        <>
          <ChatMember memberId={''} isLoading={true} />
          <ChatMember memberId={''} isLoading={true} />
        </>
      ) : (
        memberIds.map((memberId, index) => (
          <ChatMember key={index} memberId={memberId} isLoading={false} />
        ))
      )}
    </div>
  );
};
